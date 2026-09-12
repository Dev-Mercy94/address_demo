import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    let data = {};
    try {
      data = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON request body' });
    }

    const name = (data.name || '').trim();
    const address_line_1 = (data.address_line_1 || '').trim();
    const district = (data.district || '').trim();
    const pincode = (data.pincode || '').trim();

    if (!name || !address_line_1 || !district || !pincode) {
      return jsonResponse(400, { error: 'Name, Address Line 1, District, and Pincode are required fields.' });
    }

    const now = new Date().toISOString();
    const newDoc = {
      u_id: (data.u_id || data.code || '').trim(),
      name,
      door_no: (data.door_no || '').trim(),
      address_line_1,
      address_line_2: (data.address_line_2 || '').trim(),
      area: (data.area || '').trim(),
      city: (data.city || '').trim(),
      district,
      state: (data.state || 'Tamil Nadu').trim(),
      country: (data.country || 'India').trim(),
      pincode,
      phone: (data.phone || '').trim(),
      landmark: (data.landmark || '').trim(),
      notes: (data.notes || '').trim(),
      subscription: Boolean(data.subscription),
      subscription_date: (data.subscription_date || '').trim(),
      subscription_time: (data.subscription_time || '').trim(),
      subscription_amount: data.subscription_amount !== undefined ? data.subscription_amount : 500,
      created_at: now,
      updated_at: now
    };

    const { db } = await getDb();
    const collection = db.collection('addresses');

    const uIdVal = newDoc.u_id;
    if (uIdVal) {
      const existing = await collection.findOne({
        u_id: new RegExp(`^${uIdVal}$`, 'i')
      });
      if (existing) {
        return jsonResponse(400, { error: `Address with U.ID '${uIdVal}' already exists. U.ID must be unique.` });
      }
    }

    const res = await collection.insertOne(newDoc);
    newDoc._id = res.insertedId.toString();

    return jsonResponse(201, newDoc);
  } catch (err) {
    console.error('Error in create_address handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
