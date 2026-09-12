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
      {
        $group: {
          _id: '$district',
          state: { $first: '$state' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    const res = agg
      .filter(d => d._id)
      .map(d => ({
        district: d._id || 'Unknown',
        state: d.state || 'Tamil Nadu',
        count: d.count || 0
      }));

    return jsonResponse(200, res);
  } catch (err) {
    console.error('Error in districts handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
