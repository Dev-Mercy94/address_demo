import { getDb, jsonResponse, handleCorsPreflight, ObjectId } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();
  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const queryParams = event.queryStringParameters || {};
    let addressId = queryParams.id;

    if (!addressId) {
      const rawPath = event.path || '';
      const parts = rawPath.split('/').filter(Boolean);
      if (parts.length > 0 && !['delete_address', 'delete-address'].includes(parts[parts.length - 1])) {
        addressId = parts[parts.length - 1];
      }
    }

    if (!addressId) {
      return jsonResponse(400, { error: 'Address ID parameter is required for deletion' });
    }

    const { db } = await getDb();
    const collection = db.collection('addresses');

    let query = { _id: addressId };
    if (ObjectId.isValid(addressId)) {
      query = { $or: [{ _id: new ObjectId(addressId) }, { _id: addressId }] };
    }

    const res = await collection.deleteOne(query);
    if (res.deletedCount === 0) {
      return jsonResponse(404, { error: 'Address not found' });
    }

    return jsonResponse(200, { success: true, id: addressId });
  } catch (err) {
    console.error('Error in delete_address handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
