import { getDb, jsonResponse, handleCorsPreflight, ObjectId } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  if (!['PUT', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const q = event.queryStringParameters || {};
    let addressId = q.id;

    let updates = {};
    try {
      updates = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON request body' });
    }

    if (!addressId) {
      addressId = updates._id || updates.id;
    }

    if (!addressId) {
      const parts = (event.path || '').split('/').filter(Boolean);
      if (parts.length > 0 && !['update_address', 'update-address'].includes(parts[parts.length - 1])) {
        addressId = parts[parts.length - 1];
      }
    }

    if (!addressId) {
      return jsonResponse(400, { error: 'Address ID parameter is required for update' });
    }

    const now = new Date().toISOString();
    delete updates._id;
    delete updates.created_at;
    updates.updated_at = now;

    const { db } = await getDb();
    const collection = db.collection('addresses');

    let query = { _id: addressId };
    if (ObjectId.isValid(addressId)) {
      query = { _id: new ObjectId(addressId) };
    }

    const result = await collection.findOneAndUpdate(
      query,
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return jsonResponse(404, { error: 'Address not found' });
    }

    return jsonResponse(200, {
      ...result,
      _id: result._id.toString()
    });
  } catch (err) {
    console.error('Error in update_address handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
