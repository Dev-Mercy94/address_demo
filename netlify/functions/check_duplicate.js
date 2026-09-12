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

    const uId = (payload.u_id || '').trim();
    const name = (payload.name || '').trim();
    const phone = (payload.phone || '').trim();
    const pincode = (payload.pincode || '').trim();
    const addressLine1 = (payload.address_line_1 || '').trim();

    if (!name && !phone && !uId) {
      return jsonResponse(200, { duplicateFound: false });
    }

    const { db } = await getDb();
    const collection = db.collection('addresses');

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
