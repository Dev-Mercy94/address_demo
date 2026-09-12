import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { db } = await getDb();
    const collection = db.collection('addresses');

    const agg = await collection.aggregate([
      { $match: { pincode: { $ne: null, $ne: '' } } },
      {
        $group: {
          _id: '$pincode',
          district: { $first: '$district' },
          city: { $first: '$city' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 100 }
    ]).toArray();

    const res = agg.map(p => ({
      pincode: p._id || 'Unknown',
      district: p.district || '',
      city: p.city || '',
      count: p.count || 0
    }));

    return jsonResponse(200, res);
  } catch (err) {
    console.error('Error in pincodes handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
