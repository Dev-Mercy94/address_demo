import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

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
      payload = {};
    }

    const count = parseInt(payload.count, 10) || 10;
    const { db } = await getDb();
    const collection = db.collection('addresses');

    if (payload.clearExisting === true) {
      await collection.deleteMany({});
    }

    try {
      await collection.createIndex({ addressGroup: 1 });
      await collection.createIndex({ addressGroup: 1, name: 1 });
    } catch (e) {}

    const districtsData = [
      { district: 'Chennai', state: 'Tamil Nadu', pincodes: ['600001', '600002', '600004', '600018', '600028'], cities: ['Chennai'], areas: ['Mylapore', 'Anna Nagar', 'T. Nagar', 'Velachery', 'Adyar'] },
      { district: 'Coimbatore', state: 'Tamil Nadu', pincodes: ['641001', '641002', '641004'], cities: ['Coimbatore'], areas: ['RS Puram', 'Gandhipuram', 'Peelamedu'] },
      { district: 'Madurai', state: 'Tamil Nadu', pincodes: ['625001', '625002', '625009'], cities: ['Madurai'], areas: ['KK Nagar', 'Anna Nagar', 'Tallakulam'] },
      { district: 'Tiruchirappalli', state: 'Tamil Nadu', pincodes: ['620001', '620002', '620017'], cities: ['Tiruchirappalli'], areas: ['Thillai Nagar', 'Cantonment', 'Srirangam'] }
    ];

    const firstNames = ['Aarav', 'Aditi', 'Ajay', 'Anand', 'Arun', 'Bala', 'Deepak', 'Dinesh', 'Ganesh', 'Karthik', 'Kumar', 'Lakshmi', 'Meena', 'Rajesh', 'Sanjay', 'Suresh', 'Vijay', 'Vikram'];
    const lastNames = ['Kumar', 'Sharma', 'Patel', 'Subramanian', 'Raman', 'Narayanan', 'Pillai', 'Mudaliar', 'Gounder', 'Iyer', 'Reddy'];
    const streets = ['Main Street', 'Cross Street', 'Station Road', 'Bazaar Street', 'Temple Road', 'Gandhi Road', 'Nehru Salai'];
    const groups = ['VIP', 'ADVERTISEMENT', 'HELP', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL'];

    const now = new Date().toISOString();
    const docs = [];

    for (let i = 1; i <= count; i++) {
      const dObj = districtsData[i % districtsData.length];
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 7) % lastNames.length];
      const doorNo = `${(i % 120) + 1}/${(i % 5) + 1}`;
      const area = dObj.areas[i % dObj.areas.length];

      docs.push({
        name: `${fn} ${ln}`,
        door_no: doorNo,
        address_line_1: `${doorNo}, ${streets[i % streets.length]}`,
        address_line_2: area,
        area,
        city: dObj.cities[i % dObj.cities.length],
        district: dObj.district,
        state: dObj.state,
        country: 'India',
        pincode: dObj.pincodes[i % dObj.pincodes.length],
        phone: `987${1000000 + ((i * 137) % 8999999)}`,
        addressGroup: groups[i % groups.length],
        landmark: 'Near Bus Stand',
        notes: i % 10 === 0 ? 'Verified Address' : '',
        created_at: now,
        updated_at: now
      });
    }

    const res = await collection.insertMany(docs, { ordered: false });
    return jsonResponse(200, { success: true, totalInserted: res.insertedCount, isAtlas: true });
  } catch (err) {
    console.error('Error in seed handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}

