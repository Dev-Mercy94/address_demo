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

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      payload = {};
    }

    const queryParams = event.queryStringParameters || {};
    const action = payload.action || queryParams.action || 'get_profile';

    const { db } = await getDb();
    const usersColl = db.collection('users');

    // 1. CREATE / REGISTER ADMIN USER
    if (['create', 'register', 'create_user'].includes(action)) {
      const username = (payload.username || '').trim().toLowerCase();
      const password = payload.password || '';
      const name = (payload.name || 'Administrator').trim();
      const role = (payload.role || 'admin').trim();

      if (!username || !password) {
        return jsonResponse(400, { error: 'Username and password are required' });
      }

      if (password.length < 4) {
        return jsonResponse(400, { error: 'Password must be at least 4 characters' });
      }

      const now = new Date().toISOString();
      const existing = await usersColl.findOne({ username });
      if (existing) {
        return jsonResponse(400, { error: `Username '${username}' already exists.` });
      }

      const newUser = {
        username,
        password_hash: hashPassword(password),
        name,
        role,
        created_at: now,
        updated_at: now
      };

      const res = await usersColl.insertOne(newUser);
      const sessionToken = crypto.randomBytes(24).toString('hex');

      return jsonResponse(201, {
        success: true,
        message: `Admin user '${username}' created successfully!`,
        token: sessionToken,
        user: {
          id: res.insertedId.toString(),
          username,
          name,
          role,
          token: sessionToken
        }
      });
    }

    // 2. CHANGE PASSWORD
    if (['change_password', 'update_password'].includes(action)) {
      const username = (payload.username || '').trim().toLowerCase();
      const currentPassword = payload.current_password || payload.currentPassword || '';
      const newPassword = payload.new_password || payload.newPassword || '';

      if (!username) {
        return jsonResponse(400, { error: 'Username is required' });
      }
      if (!currentPassword || !newPassword) {
        return jsonResponse(400, { error: 'Current password and new password are required' });
      }
      if (newPassword.length < 4) {
        return jsonResponse(400, { error: 'New password must be at least 4 characters' });
      }

      const user = await usersColl.findOne({ username });
      if (!user) {
        return jsonResponse(404, { error: 'User account not found' });
      }

      if (!verifyPassword(currentPassword, user.password_hash || '')) {
        return jsonResponse(400, { error: 'Current password is incorrect' });
      }

      const now = new Date().toISOString();
      const newHash = hashPassword(newPassword);

      await usersColl.updateOne(
        { _id: user._id },
        { $set: { password_hash: newHash, updated_at: now } }
      );

      return jsonResponse(200, {
        success: true,
        message: 'Password changed and securely updated in database!'
      });
    }

    // 3. UPDATE PROFILE DETAILS
    if (['update_profile', 'update'].includes(action)) {
      const currentUsername = (payload.current_username || payload.currentUsername || '').trim().toLowerCase();
      const newName = (payload.name || '').trim();
      const newUsername = (payload.new_username || payload.newUsername || '').trim().toLowerCase();

      if (!currentUsername) {
        return jsonResponse(400, { error: 'Current username is required' });
      }

      const user = await usersColl.findOne({ username: currentUsername });
      if (!user) {
        return jsonResponse(404, { error: 'User account not found' });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (newName) updates.name = newName;
      if (newUsername && newUsername !== currentUsername) {
        const taken = await usersColl.findOne({ username: newUsername });
        if (taken) {
          return jsonResponse(400, { error: `Username '${newUsername}' is already taken.` });
        }
        updates.username = newUsername;
      }

      await usersColl.updateOne({ _id: user._id }, { $set: updates });

      return jsonResponse(200, {
        success: true,
        message: 'Profile updated successfully!',
        user: {
          id: user._id.toString(),
          username: updates.username || user.username,
          name: updates.name || user.name,
          role: user.role || 'admin'
        }
      });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Users handler error:', err);
    return jsonResponse(500, { error: `User management error: ${err.message}` });
  }
}
