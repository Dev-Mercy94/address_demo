import { getDb, serializeDoc, escapeRegex, jsonResponse, handleCorsPreflight } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON request body' });
    }

    const items = payload.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse(200, {
        totalProcessed: 0,
        success: 0,
        duplicates: 0,
        invalid: 0,
        duplicateDetails: []
      });
    }

    const now = new Date().toISOString();
    let successCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const docsToInsert = [];
    const duplicateDetails = [];

    const { db } = await getDb();
    const collection = db.collection('addresses');

    const forceSave = Boolean(payload.force || payload.allow_duplicates || payload.skipDuplicateCheck);

    let existingDocs = [];
    if (!forceSave) {
      try {
        const cursor = collection.find({}, { projection: { name: 1, phone: 1, pincode: 1, address_line_1: 1, u_id: 1, district: 1 } });
        existingDocs = await cursor.toArray();
      } catch (err) {
        console.warn('Notice during duplicate check pre-fetch:', err);
      }
    }

    for (const item of items) {
      const name = (item.name || '').trim();
      const addressLine1 = (item.address_line_1 || item.addressLine1 || '').trim();
      const district = (item.district || '').trim();
      const pincode = (item.pincode || '').trim();
      const phone = (item.phone || '').trim();

      if (!name || !addressLine1 || !district || !pincode || name === 'Contact Name') {
        invalidCount++;
        continue;
      }

      const doc = {
        u_id: (item.u_id || item.code || item.uId || '').trim(),
        name,
        door_no: (item.door_no || item.doorNo || '').trim(),
        address_line_1: addressLine1,
        address_line_2: (item.address_line_2 || item.addressLine2 || '').trim(),
        area: (item.area || '').trim(),
        city: (item.city || '').trim(),
        district,
        state: (item.state || 'Tamil Nadu').trim(),
        country: (item.country || 'India').trim(),
        pincode,
        phone,
        landmark: (item.landmark || '').trim(),
        notes: (item.notes || '').trim(),
        subscription: Boolean(item.subscription),
        subscription_date: (item.subscription_date || '').trim(),
        subscription_time: (item.subscription_time || '').trim(),
        subscription_amount: item.subscription_amount !== undefined ? item.subscription_amount : 500,
        created_at: now,
        updated_at: now
      };

      if (!forceSave) {
        const nameLower = name.toLowerCase();
        const docDistrict = district.toLowerCase();
        let matchingExisting = null;

        for (const ex of existingDocs) {
          const exName = (ex.name || '').trim().toLowerCase();
          const exPhone = (ex.phone || '').trim();
          const exPin = (ex.pincode || '').trim();
          const exAddr1 = (ex.address_line_1 || '').trim().toLowerCase();
          const exDistrict = (ex.district || '').trim().toLowerCase();

          // If different districts, do NOT consider as duplicate
          if (docDistrict && exDistrict && docDistrict !== exDistrict) {
            continue;
          }

          if (exName === nameLower) {
            if (phone && exPhone && phone === exPhone) {
              matchingExisting = ex;
              break;
            }
            if (pincode && exPin && pincode === exPin) {
              matchingExisting = ex;
              break;
            }
            if (addressLine1 && exAddr1 && (addressLine1.toLowerCase().includes(exAddr1) || exAddr1.includes(addressLine1.toLowerCase()))) {
              matchingExisting = ex;
              break;
            }
          }
        }

        if (matchingExisting) {
          duplicateCount++;
          duplicateDetails.push({
            importedItem: doc,
            existingAddress: serializeDoc(matchingExisting)
          });
          continue;
        }

        existingDocs.push(doc);
      }

      docsToInsert.push(doc);
    }

    if (docsToInsert.length > 0) {
      // Deduplicate within the batch by u_id if present
      const uniqueBatch = [];
      const seenBatchUids = new Map();

      for (const doc of docsToInsert) {
        const uidKey = (doc.u_id || '').trim().toLowerCase();
        if (uidKey) {
          if (seenBatchUids.has(uidKey)) {
            uniqueBatch[seenBatchUids.get(uidKey)] = doc;
          } else {
            seenBatchUids.set(uidKey, uniqueBatch.length);
            uniqueBatch.push(doc);
          }
        } else {
          uniqueBatch.push(doc);
        }
      }

      // Collect all valid U.IDs to lookup existing records in one fast batch query
      const batchUids = uniqueBatch
        .map(d => (d.u_id || '').trim())
        .filter(Boolean);

      const existingUidMap = new Map();
      if (batchUids.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < batchUids.length; i += chunkSize) {
          const slice = batchUids.slice(i, i + chunkSize);
          const escaped = slice.map(u => escapeRegex(u));
          const regexFilter = new RegExp(`^(${escaped.join('|')})$`, 'i');
          const found = await collection.find(
            { u_id: { $regex: regexFilter } },
            { projection: { _id: 1, u_id: 1 } }
          ).toArray();
          for (const rec of found) {
            if (rec.u_id) {
              existingUidMap.set(rec.u_id.trim().toLowerCase(), rec._id);
            }
          }
        }
      }

      // Prepare bulk operations for one-shot database execution
      const bulkOps = [];
      for (const doc of uniqueBatch) {
        const uidKey = (doc.u_id || '').trim().toLowerCase();
        const existingId = uidKey ? existingUidMap.get(uidKey) : null;

        if (existingId) {
          bulkOps.push({
            updateOne: {
              filter: { _id: existingId },
              update: { $set: { ...doc, updated_at: now } }
            }
          });
        } else {
          bulkOps.push({
            insertOne: {
              document: doc
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        const bulkRes = await collection.bulkWrite(bulkOps, { ordered: false });
        const inserted = bulkRes.insertedCount || 0;
        const modified = bulkRes.modifiedCount || 0;
        const upserted = bulkRes.upsertedCount || 0;
        const matched = bulkRes.matchedCount || 0;
        successCount = inserted + modified + upserted + Math.max(0, matched - modified);
      }
    }

    return jsonResponse(200, {
      totalProcessed: items.length,
      success: successCount,
      duplicates: duplicateCount,
      invalid: invalidCount,
      duplicateDetails
    });
  } catch (err) {
    console.error('Error in import_addresses handler:', err);
    return jsonResponse(500, { error: `Import Error: ${err.message || 'Internal error'}` });
  }
}
