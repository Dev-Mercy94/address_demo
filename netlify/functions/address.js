import { getDb, jsonResponse, handleCorsPreflight, ObjectId } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const q = event.queryStringParameters || {};
    let addressId = q.id;

    if (!addressId) {
      const parts = (event.path || '').split('/').filter(Boolean);
      if (parts.length > 0 && !['address', 'addresses'].includes(parts[parts.length - 1])) {
        addressId = parts[parts.length - 1];
      }
    }

    if (!addressId) {
      return jsonResponse(400, { error: 'Address ID parameter is required' });
    }

    const { db } = await getDb();
    const collection = db.collection('addresses');

    let query = { _id: addressId };
    if (ObjectId.isValid(addressId)) {
      query = { _id: new ObjectId(addressId) };
    }

    const address = await collection.findOne(query);
    if (!address) {
      return jsonResponse(404, { error: 'Address not found' });
    }

    return jsonResponse(200, {
      ...address,
      _id: address._id.toString()
    });
  } catch (err) {
    console.error('Error in address handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
