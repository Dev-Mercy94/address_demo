import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'node:dns';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {}

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'address_management_db';

if (!uri) {
  console.error('Error: MONGODB_URI environment variable is not defined in .env');
  process.exit(1);
}

async function seedDatabase() {
  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('addresses');

    console.log('Ensuring indexes...');
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ pincode: 1 });
    await collection.createIndex({ district: 1 });
    await collection.createIndex({ city: 1 });
    await collection.createIndex({ phone: 1 });
    await collection.createIndex({ addressGroup: 1 });
    await collection.createIndex({ addressGroup: 1, name: 1 });
    await collection.createIndex({ district: 1, pincode: 1, name: 1 });

    console.log('Clearing existing address records...');
    await collection.deleteMany({});

    const totalTarget = 10;
    const batchSize = 5000;

    console.log(`Starting bulk insertion of ${totalTarget.toLocaleString()} records into MongoDB collection "addresses"...`);

    const districtsData = [
      { district: 'Chennai', state: 'Tamil Nadu', pincodes: ['600001', '600002', '600004', '600018', '600028', '600040', '600096'], cities: ['Chennai'], areas: ['Mylapore', 'Anna Nagar', 'T. Nagar', 'Velachery', 'Adyar', 'Guindy', 'Kilpauk', 'Royapettah'] },
      { district: 'Coimbatore', state: 'Tamil Nadu', pincodes: ['641001', '641002', '641004', '641006', '641012', '641035'], cities: ['Coimbatore'], areas: ['RS Puram', 'Gandhipuram', 'Peelamedu', 'Singanallur', 'Saibaba Colony', 'Saravanampatti'] },
      { district: 'Madurai', state: 'Tamil Nadu', pincodes: ['625001', '625002', '625009', '625016', '625020'], cities: ['Madurai'], areas: ['KK Nagar', 'Anna Nagar', 'Tallakulam', 'Goripalayam', 'Simmakkal', 'Villapuram'] },
      { district: 'Tiruchirappalli', state: 'Tamil Nadu', pincodes: ['620001', '620002', '620017', '620020'], cities: ['Tiruchirappalli', 'Srirangam'], areas: ['Thillai Nagar', 'Cantonment', 'Srirangam', 'KKB Nagar', 'Woraiyur'] },
      { district: 'Salem', state: 'Tamil Nadu', pincodes: ['636001', '636004', '636007', '636008'], cities: ['Salem'], areas: ['Fairlands', 'Hasthampatti', 'Suramangalam', 'Shevapet', 'Alagapuram'] },
      { district: 'Erode', state: 'Tamil Nadu', pincodes: ['638001', '638002', '638009', '638011'], cities: ['Erode'], areas: ['Perundurai Road', 'Bhavani', 'Surampatti', 'Collectorate Area', 'Veerapanchatram'] },
      { district: 'Tirunelveli', state: 'Tamil Nadu', pincodes: ['627001', '627002', '627007', '627011'], cities: ['Tirunelveli', 'Palayamkottai'], areas: ['Palayamkottai', 'Town', 'Vannarpettai', 'High Ground'] },
      { district: 'Vellore', state: 'Tamil Nadu', pincodes: ['632001', '632002', '632004', '632009'], cities: ['Vellore', 'Katpadi'], areas: ['Sathuvachari', 'Katpadi', 'Gandhinagar', 'Thorapadi'] },
      { district: 'Thanjavur', state: 'Tamil Nadu', pincodes: ['613001', '613005', '613007'], cities: ['Thanjavur', 'Kumbakonam'], areas: ['Medical College Area', 'South Rampart', 'Kumbakonam Main'] },
      { district: 'Tiruppur', state: 'Tamil Nadu', pincodes: ['641601', '641602', '641604', '641607'], cities: ['Tiruppur'], areas: ['Avinashi Road', 'Dharapuram Road', 'Kangayam Road', 'PN Road'] }
    ];

    const firstNames = ['Aarav', 'Aditi', 'Ajay', 'Anand', 'Ananya', 'Arun', 'Bala', 'Bhavana', 'Chitra', 'Deepak', 'Devi', 'Dinesh', 'Elango', 'Ganesh', 'Gowri', 'Hari', 'Indira', 'Jagadeesh', 'Janani', 'Karthik', 'Kavitha', 'Kumar', 'Lakshmi', 'Mani', 'Meena', 'Murali', 'Nandhini', 'Naveen', 'Nisha', 'Pradeep', 'Priya', 'Rahul', 'Rajesh', 'Ram', 'Ramesh', 'Riya', 'Sanjay', 'Santhosh', 'Saraswathi', 'Sathish', 'Selvam', 'Shankar', 'Siddharth', 'Subhash', 'Sundar', 'Suresh', 'Swathi', 'Thangaraj', 'Uma', 'Vaishnavi', 'Varun', 'Venkatesh', 'Vidya', 'Vijay', 'Vikram', 'Vimal', 'Yogesh'];
    const lastNames = ['Kumar', 'Sharma', 'Verma', 'Patel', 'Subramanian', 'Raman', 'Narayanan', 'Pillai', 'Mudaliar', 'Gounder', 'Nadar', 'Chettiar', 'Naidu', 'Rao', 'Iyer', 'Iyengar', 'Reddy', 'Singh', 'Gupta', 'Menon', 'Nair'];
    const streets = ['Main Street', 'Cross Street', 'Station Road', 'Bazaar Street', 'Temple Road', 'Gandhi Road', 'Nehru Salai', 'Anna Salai', 'Ring Road', 'Hospital Road', 'College Road', 'School Street'];
    const landmarks = ['Near Bus Stand', 'Opposite Railway Station', 'Behind Post Office', 'Near Signal', 'Near Temple', 'Opposite Supermarket', 'Next to SBI Bank'];
    const groups = ['VIP', 'ADVERTISEMENT', 'HELP', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL'];

    let totalInserted = 0;
    const now = new Date().toISOString();

    for (let b = 0; b < totalTarget; b += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalTarget - b);
      const docs = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const idx = b + i + 1;
        const dObj = districtsData[idx % districtsData.length];
        const fn = firstNames[idx % firstNames.length];
        const ln = lastNames[(idx * 7) % lastNames.length];

        docs.push({
          name: `${fn} ${ln}`,
          door_no: `${(idx % 120) + 1}/${(idx % 5) + 1}`,
          address_line_1: `${(idx % 120) + 1}, ${streets[idx % streets.length]}`,
          address_line_2: dObj.areas[idx % dObj.areas.length],
          area: dObj.areas[idx % dObj.areas.length],
          city: dObj.cities[idx % dObj.cities.length],
          district: dObj.district,
          state: dObj.state,
          country: 'India',
          pincode: dObj.pincodes[idx % dObj.pincodes.length],
          phone: `987${(1000000 + (idx * 137) % 8999999).toString()}`,
          addressGroup: groups[idx % groups.length],
          landmark: landmarks[idx % landmarks.length],
          notes: idx % 10 === 0 ? 'Verified Address' : '',
          created_at: now,
          updated_at: now
        });
      }

      const result = await collection.insertMany(docs, { ordered: false });
      totalInserted += result.insertedCount;
      console.log(`Inserted batch ${b / batchSize + 1}: ${totalInserted.toLocaleString()} / ${totalTarget.toLocaleString()} records`);
    }


    console.log(`Successfully seeded ${totalInserted.toLocaleString()} address records into MongoDB Atlas!`);
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await client.close();
  }
}

seedDatabase();
