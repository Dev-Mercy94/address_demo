import crypto from 'crypto';
import { getDb, jsonResponse, handleCorsPreflight } from './db.js';

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const pwHash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}$${pwHash}`;
}

function verifyPassword(password, storedHash) {
  try {
    if (!storedHash || !storedHash.includes('$')) return false;
    const [salt, pwHash] = storedHash.split('$');
    const computedHash = crypto.createHash('sha256').update(salt + password).digest('hex');
    return computedHash === pwHash;
  } catch (err) {
    return false;
  }
}

async function ensureDefaultAdmin(db) {
  try {
    const usersColl = db.collection('users');
    await usersColl.createIndex({ username: 1 }, { unique: true });
    const count = await usersColl.countDocuments({});
    if (count === 0) {
      const defaultUser = {
        username: 'admin',
        password_hash: hashPassword('admin123'),
        name: 'Administrator',
        role: 'admin',
        created_at: new Date().toISOString()
      };
      await usersColl.insertOne(defaultUser);
    }
  } catch (err) {
    console.error('Notice ensuring default admin:', err);
  }
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const username = (payload.username || '').trim().toLowerCase();
    const password = payload.password || '';

    if (!username || !password) {
      return jsonResponse(400, { error: 'Username and password are required' });
    }

    const { db } = await getDb();
    await ensureDefaultAdmin(db);

    const usersColl = db.collection('users');
    const user = await usersColl.findOne({ username });

    if (!user) {
      return jsonResponse(401, { error: 'Invalid username or password' });
    }

    const storedHash = user.password_hash || '';
    if (!verifyPassword(password, storedHash)) {
      return jsonResponse(401, { error: 'Invalid username or password' });
    }

    const sessionToken = crypto.randomBytes(24).toString('hex');
    const userData = {
      id: user._id.toString(),
      username: user.username,
      name: user.name || 'Administrator',
      role: user.role || 'admin',
      token: sessionToken,
      loginTime: new Date().toISOString()
    };

    return jsonResponse(200, {
      success: true,
      message: 'Authentication successful',
      token: sessionToken,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    return jsonResponse(500, { error: err.message || 'Authentication server error' });
  }
}
