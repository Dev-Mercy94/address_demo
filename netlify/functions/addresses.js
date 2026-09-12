import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

const DISTRICT_TRANSLATION_MAP = {
  'Ariyalur': 'அரியலூர்',
  'Chengalpattu': 'செங்கல்பட்டு',
  'Chennai': 'சென்னை',
  'Coimbatore': 'கோயம்புத்தூர்',
  'Cuddalore': 'கடலூர்',
  'Dharmapuri': 'தர்மபுரி',
  'Dindigul': 'திண்டுக்கல்',
  'Erode': 'ஈரோடு',
  'Kallakurichi': 'கள்ளக்குறிச்சி',
  'Kanchipuram': 'காஞ்சீபுரம்',
  'Kanyakumari': 'கன்னியாகுமரி',
  'Karur': 'கரூர்',
  'Krishnagiri': 'கிருஷ்ணகிரி',
  'Madurai': 'மதுரை',
  'Mayiladuthurai': 'மயிலாடுதுறை',
  'Nagapattinam': 'நாகப்பட்டினம்',
  'Namakkal': 'நாமக்கல்',
  'Nilgiris': 'நீலகிரி',
  'Perambalur': 'பெரம்பலூர்',
  'Pudukkottai': 'புதுக்கோட்டை',
  'Ramanathapuram': 'இராமநாதபுரம்',
  'Ranipet': 'ராணிப்பேட்டை',
  'Salem': 'சேலம்',
  'Sivaganga': 'சிவகங்கை',
  'Tenkasi': 'தென்காசி',
  'Thanjavur': 'தஞ்சாவூர்',
  'Theni': 'தேனி',
  'Thoothukudi': 'தூத்துக்குடி',
  'Tiruchirappalli': 'திருச்சிராப்பள்ளி',
  'Tirunelveli': 'திருநெல்வேலி',
  'Tirupathur': 'திருப்பத்தூர்',
  'Tiruppur': 'திருப்பூர்',
  'Tiruvallur': 'திருவள்ளூர்',
  'Tiruvannamalai': 'திருவண்ணாமலை',
  'Tiruvarur': 'திருவாரூர்',
  'Vellore': 'வேலூர்',
  'Viluppuram': 'விழுப்புரம்',
  'Virudhunagar': 'விருதுநகர்'
};

function escapeRegex(text) {
  return (text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const q = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(q.limit || '50', 10)), 500);
    const skip = (page - 1) * limit;

    const u_id = (q.u_id || q.uId || '').trim();
    const search = (q.search || '').trim();
    const district = (q.district || '').trim();
    const city = (q.city || '').trim();
    const area = (q.area || '').trim();
    const pincode = (q.pincode || '').trim();
    const street = (q.street || '').trim();
    const alphabet = (q.alphabet || '').trim();
    const sort = q.sort || 'name_asc';

    const { db } = await getDb();
    const collection = db.collection('addresses');
    const query = {};

    if (u_id) {
      query.u_id = new RegExp(escapeRegex(u_id), 'i');
    }

    if (search) {
      const sReg = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { u_id: sReg },
        { name: sReg },
        { door_no: sReg },
        { address_line_1: sReg },
        { address_line_2: sReg },
        { area: sReg },
        { city: sReg },
        { district: sReg },
        { pincode: sReg },
        { phone: sReg }
      ];
    }

    if (district && district !== 'ALL') {
      const taDist = DISTRICT_TRANSLATION_MAP[district] || district;
      query.district = new RegExp(`^(${escapeRegex(district)}|${escapeRegex(taDist)})`, 'i');
    }

    if (city) {
      query.city = new RegExp(escapeRegex(city), 'i');
    }

    if (area) {
      const arReg = new RegExp(escapeRegex(area), 'i');
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [{ area: arReg }, { address_line_1: arReg }, { address_line_2: arReg }]
      });
    }

    if (pincode) {
      query.pincode = new RegExp(`^${escapeRegex(pincode)}`, 'i');
    }

    if (street) {
      const stReg = new RegExp(escapeRegex(street), 'i');
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [{ address_line_1: stReg }, { address_line_2: stReg }, { area: stReg }]
      });
    }

    if (alphabet && alphabet !== 'ALL') {
      query.name = new RegExp(`^${escapeRegex(alphabet)}`, 'i');
    }

    let sortOption = { name: 1 };
    if (sort === 'name_desc') sortOption = { name: -1 };
    else if (sort === 'pincode_asc') sortOption = { pincode: 1, name: 1 };
    else if (sort === 'pincode_desc') sortOption = { pincode: -1, name: 1 };
    else if (sort === 'created_desc') sortOption = { created_at: -1 };
    else if (sort === 'updated_desc') sortOption = { updated_at: -1 };

    const total = Object.keys(query).length === 0
      ? await collection.estimatedDocumentCount()
      : await collection.countDocuments(query);

    const items = await collection.find(query).sort(sortOption).skip(skip).limit(limit).toArray();

    const serializedItems = items.map(item => ({
      ...item,
      _id: item._id.toString()
    }));

    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return jsonResponse(200, {
      success: true,
      data: serializedItems,
      addresses: serializedItems,
      total,
      page,
      limit,
      totalPages
    });
  } catch (err) {
    console.error('Addresses query error:', err);
    return jsonResponse(500, { error: err.message || 'Failed to query addresses' });
  }
}
