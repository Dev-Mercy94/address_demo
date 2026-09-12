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
        const cursor = collection.find({}, { projection: { name: 1, phone: 1, pincode: 1, address_line_1: 1, u_id: 1 } });
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
        let matchingExisting = null;

        for (const ex of existingDocs) {
          const exName = (ex.name || '').trim().toLowerCase();
          const exPhone = (ex.phone || '').trim();
          const exPin = (ex.pincode || '').trim();
          const exAddr1 = (ex.address_line_1 || '').trim().toLowerCase();

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

      for (const doc of uniqueBatch) {
        const uid = (doc.u_id || '').trim();
        if (uid) {
          const existing = await collection.findOne({
            u_id: { $regex: new RegExp(`^${escapeRegex(uid)}$`, 'i') }
          });
          if (existing) {
            const docUpdate = { ...doc, updated_at: now };
            await collection.updateOne({ _id: existing._id }, { $set: docUpdate });
            successCount++;
            continue;
          }
        }

        const res = await collection.insertOne(doc);
        if (res.insertedId) {
          successCount++;
        }
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
