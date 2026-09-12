import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { db } = await getDb();
    const collection = db.collection('addresses');

    const totalAddresses = await collection.countDocuments({});
    const districtList = await collection.distinct('district');
    const pincodeList = await collection.distinct('pincode');

    const date24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentlyAdded = await collection.countDocuments({
      created_at: { $gte: date24hAgo }
    });
    const recentlyUpdated = await collection.countDocuments({
      updated_at: { $gte: date24hAgo }
    });

    const districtAgg = await collection.aggregate([
      { $match: { district: { $ne: null } } },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]).toArray();

    const topDistricts = districtAgg.map(d => ({
      district: d._id || 'Unspecified',
      count: d.count || 0
    }));

    return jsonResponse(200, {
      totalAddresses,
      totalDistricts: districtList.filter(Boolean).length,
      totalPincodes: pincodeList.filter(Boolean).length,
      recentlyAdded,
      recentlyUpdated,
      topDistricts,
      isAtlas: true
    });
  } catch (err) {
    console.error('Error in stats handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
