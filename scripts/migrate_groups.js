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

async function migrateAddressGroups() {
  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('addresses');

    console.log('Creating index on addressGroup...');
    await collection.createIndex({ addressGroup: 1 });
    await collection.createIndex({ addressGroup: 1, name: 1 });

    console.log('Finding records without addressGroup or with null/empty addressGroup...');
    const filter = {
      $or: [
        { addressGroup: { $exists: false } },
        { addressGroup: null },
        { addressGroup: '' }
      ]
    };

    const countToUpdate = await collection.countDocuments(filter);
    console.log(`Found ${countToUpdate.toLocaleString()} address records that need addressGroup migrated to "NORMAL".`);

    if (countToUpdate > 0) {
      const result = await collection.updateMany(filter, {
        $set: { addressGroup: 'NORMAL' }
      });
      console.log(`Successfully migrated ${result.modifiedCount.toLocaleString()} records to addressGroup: "NORMAL".`);
    } else {
      console.log('All records already have valid addressGroup values.');
    }

    // Report group distribution
    const groupAgg = await collection.aggregate([
      { $group: { _id: '$addressGroup', count: { $sum: 1 } } }
    ]).toArray();
    console.log('Current Address Group Distribution:');
    groupAgg.forEach(g => {
      console.log(`  - ${g._id || 'NORMAL'}: ${g.count.toLocaleString()}`);
    });

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.close();
  }
}

migrateAddressGroups();
