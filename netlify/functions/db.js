import { MongoClient, ObjectId } from 'mongodb';
import dns from 'node:dns';

// Fix querySrv ECONNREFUSED on Windows / router DNS servers by using reliable public DNS resolvers
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Ignore if restricted in specific environment
}

let cachedClient = null;
let cachedDb = null;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

export function handleCorsPreflight() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
}

export function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data)
  };
}

export function serializeDoc(doc) {
  if (!doc) return null;
  const newDoc = { ...doc };
  if (newDoc._id) newDoc._id = newDoc._id.toString();
  return newDoc;
}

export function escapeRegex(text) {
  return (text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export const ALLOWED_ADDRESS_GROUPS = ['VIP', 'ADVERTISEMENT', 'HELP', 'NORMAL'];
export const DEFAULT_ADDRESS_GROUP = 'NORMAL';

export function normalizeAddressGroup(group) {
  if (!group || typeof group !== 'string') return DEFAULT_ADDRESS_GROUP;
  const upper = group.trim().toUpperCase();
  if (ALLOWED_ADDRESS_GROUPS.includes(upper)) return upper;
  return null;
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || 'address_management_db';

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 20,
    family: 4 // Force IPv4 to prevent 1-minute IPv6 fallback delays on Windows
  });

  await client.connect();
  const db = client.db(dbName);
  cachedClient = client;
  cachedDb = db;

  // Ensure essential indexes on addresses collection asynchronously in background
  try {
    const addressesColl = db.collection('addresses');
    addressesColl.createIndex({ addressGroup: 1 }).catch(() => {});
    addressesColl.createIndex({ addressGroup: 1, name: 1 }).catch(() => {});
  } catch (idxErr) {
    // Non-blocking
  }

  return { client, db };
}

export { ObjectId };

