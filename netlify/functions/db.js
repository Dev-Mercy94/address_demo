import { MongoClient, ObjectId } from 'mongodb';

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
    connectTimeoutMS: 8000,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 20
  });

  await client.connect();
  const db = client.db(dbName);
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export { ObjectId };
