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

    const { db } = await getDb();
    const collection = db.collection('addresses');

    // BATCH MODE SUPPORT
    if (payload.items && Array.isArray(payload.items)) {
      const duplicates = [];
      const batchSize = 50;
      const items = payload.items;

      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const chunkConditions = [];

        for (const item of chunk) {
          const uId = (item.u_id || '').trim();
          const name = (item.name || '').trim();
          const phone = (item.phone || '').trim();
          const pincode = (item.pincode || '').trim();
          const addressLine1 = (item.address_line_1 || '').trim();

          if (!name && !phone && !uId) continue;

          const conds = [];
          if (uId) {
            conds.push({ u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') } });
          }
          if (phone && phone.length >= 10) {
            conds.push({ phone });
          }
          if (name && phone) {
            conds.push({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, phone });
          }
          if (name && pincode && addressLine1) {
            conds.push({
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              pincode,
              address_line_1: { $regex: new RegExp(escapeRegex(addressLine1), 'i') }
            });
          } else if (name && pincode) {
            conds.push({
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              pincode
            });
          }

          if (conds.length > 0) {
            chunkConditions.push({ $or: conds });
          }
        }

        if (chunkConditions.length > 0) {
          const matches = await collection.find({ $or: chunkConditions }).toArray();
          if (matches.length > 0) {
            for (const match of matches) {
              const matchName = (match.name || '').toLowerCase();
              const matchPhone = match.phone || '';
              const matchUid = (match.u_id || '').toLowerCase();
              const matchPin = match.pincode || '';

              const importedItem = chunk.find(item => {
                const uId = (item.u_id || '').trim().toLowerCase();
                const name = (item.name || '').trim().toLowerCase();
                const phone = (item.phone || '').trim();
                const pincode = (item.pincode || '').trim();

                if (uId && uId === matchUid) return true;
                if (phone && phone.length >= 10 && phone === matchPhone) return true;
                if (name === matchName && phone === matchPhone) return true;
                if (name === matchName && pincode === matchPin) return true;
                return false;
              });

              if (importedItem) {
                // Check if already added to duplicates
                if (!duplicates.find(d => d.existingAddress._id.toString() === match._id.toString())) {
                  duplicates.push({
                    importedItem,
                    existingAddress: serializeDoc(match)
                  });
                }
              }
            }
          }
        }
      }

      return jsonResponse(200, { duplicates });
    }

    // SINGLE ITEM MODE (Legacy)
    const uId = (payload.u_id || '').trim();
    const name = (payload.name || '').trim();
    const phone = (payload.phone || '').trim();
    const pincode = (payload.pincode || '').trim();
    const addressLine1 = (payload.address_line_1 || '').trim();

    if (!name && !phone && !uId) {
      return jsonResponse(200, { duplicateFound: false });
    }

    const queryConditions = [];

    if (uId) {
      queryConditions.push({
        u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') }
      });
    }

    if (phone && phone.length >= 10) {
      queryConditions.push({ phone });
    }

    if (name && phone) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        phone
      });
    }

    if (name && pincode && addressLine1) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        pincode,
        address_line_1: { $regex: new RegExp(escapeRegex(addressLine1), 'i') }
      });
    } else if (name && pincode) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        pincode
      });
    }

    if (queryConditions.length > 0) {
      const match = await collection.findOne({ $or: queryConditions });
      if (match) {
        return jsonResponse(200, {
          duplicateFound: true,
          existingAddress: serializeDoc(match)
        });
      }
    }

    return jsonResponse(200, { duplicateFound: false });
  } catch (err) {
    console.error('Error in check_duplicate handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
