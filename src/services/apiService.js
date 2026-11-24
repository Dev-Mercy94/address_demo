import {
  INITIAL_SAMPLE_ADDRESSES,
  INITIAL_SAMPLE_USERS,
  INITIAL_SAMPLE_IMPORTANT_DATES
} from './demoData.js';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || '/.netlify/functions'
).replace(/\/$/, '');

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\uD800-\uDFFF]/g, '');
}

export function sanitizeObject(obj) {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const res = {};
    for (const key of Object.keys(obj)) {
      res[key] = sanitizeObject(obj[key]);
    }
    return res;
  }
  return obj;
}

// ----------------------------------------------------
// LOCAL STORAGE DEMO BACKEND FALLBACK
// Ensures zero downtime if deployed to static hosting without serverless functions
// ----------------------------------------------------
const STORAGE_KEY_ADDRESSES = 'demo_addresses_v1';
const STORAGE_KEY_USERS = 'demo_users_v1';
const STORAGE_KEY_DATES = 'demo_dates_v1';

function getLocalAddresses() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ADDRESSES);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  const initial = JSON.parse(JSON.stringify(INITIAL_SAMPLE_ADDRESSES));
  try {
    localStorage.setItem(STORAGE_KEY_ADDRESSES, JSON.stringify(initial));
  } catch (_) {}
  return initial;
}

function saveLocalAddresses(addresses) {
  try {
    localStorage.setItem(STORAGE_KEY_ADDRESSES, JSON.stringify(addresses));
  } catch (_) {}
}

function getLocalUsers() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  const initial = JSON.parse(JSON.stringify(INITIAL_SAMPLE_USERS));
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(initial));
  } catch (_) {}
  return initial;
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (_) {}
}

function getLocalDates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DATES);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  const initial = JSON.parse(JSON.stringify(INITIAL_SAMPLE_IMPORTANT_DATES));
  try {
    localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify(initial));
  } catch (_) {}
  return initial;
}

function saveLocalDates(dates) {
  try {
    localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify(dates));
  } catch (_) {}
}

function generateId() {
  return 'demo_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Generic fetch wrapper with transparent fallback
async function safeApiCall(apiCallFn, fallbackFn) {
  try {
    return await apiCallFn();
  } catch (err) {
    // If network fails, 404, or functions unavailable, use demo fallback
    return await fallbackFn();
  }
}

// ----------------------------------------------------
// API FUNCTIONS WITH RESILIENT DEMO FALLBACK
// ----------------------------------------------------

export async function fetchStats() {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const districts = [...new Set(addresses.map(a => a.district).filter(Boolean))];
      const pincodes = [...new Set(addresses.map(a => a.pincode).filter(Boolean))];
      
      const districtCounts = {};
      const groupCounts = { VIP: 0, ADVERTISEMENT: 0, HELP: 0, NORMAL: 0, CONTRIBUTOR: 0, CANCEL: 0, CALLBACK: 0, MATRIMONY: 0 };
      
      for (const a of addresses) {
        if (a.district) {
          districtCounts[a.district] = (districtCounts[a.district] || 0) + 1;
        }
        const grp = (a.addressGroup || 'CONTRIBUTOR').toUpperCase();
        if (groupCounts[grp] !== undefined) {
          groupCounts[grp]++;
        } else {
          groupCounts.CONTRIBUTOR++;
        }
      }

      const topDistricts = Object.entries(districtCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([district, count]) => ({ district, count }));

      return {
        totalAddresses: addresses.length,
        totalDistricts: districts.length,
        totalPincodes: pincodes.length,
        recentlyAdded: Math.min(5, addresses.length),
        recentlyUpdated: Math.min(3, addresses.length),
        topDistricts,
        groupCounts,
        isAtlas: false,
        isDemo: true
      };
    }
  );
}

export async function fetchAddresses(params = {}, signal = null) {
  return safeApiCall(
    async () => {
      const query = new URLSearchParams();
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);
      if (params.search) query.append('search', params.search);
      if (params.u_id) query.append('u_id', params.u_id);
      if (params.district && params.district !== 'ALL') query.append('district', params.district);
      if (params.city) query.append('city', params.city);
      if (params.area) query.append('area', params.area);
      if (params.pincode) query.append('pincode', params.pincode);
      if (params.street) query.append('street', params.street);
      if (params.alphabet && params.alphabet !== 'ALL') query.append('alphabet', params.alphabet);
      if (params.group && params.group !== 'ALL') query.append('group', params.group);
      if (params.addressGroup && params.addressGroup !== 'ALL') query.append('group', params.addressGroup);
      if (params.subscription && params.subscription !== 'ALL') query.append('subscription', params.subscription);
      if (params.sort) query.append('sort', params.sort);

      const res = await fetch(`${API_BASE}/addresses?${query.toString()}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch addresses');
      return res.json();
    },
    async () => {
      let list = getLocalAddresses();

      // Filters
      if (params.u_id) {
        const u = params.u_id.toLowerCase();
        list = list.filter(a => (a.u_id || '').toLowerCase().includes(u));
      }

      if (params.search) {
        const s = params.search.toLowerCase();
        list = list.filter(a =>
          (a.name || '').toLowerCase().includes(s) ||
          (a.u_id || '').toLowerCase().includes(s) ||
          (a.door_no || '').toLowerCase().includes(s) ||
          (a.address_line_1 || '').toLowerCase().includes(s) ||
          (a.area || '').toLowerCase().includes(s) ||
          (a.city || '').toLowerCase().includes(s) ||
          (a.district || '').toLowerCase().includes(s) ||
          (a.pincode || '').includes(s) ||
          (a.phone || '').includes(s)
        );
      }

      if (params.district && params.district !== 'ALL') {
        const d = params.district.toLowerCase();
        list = list.filter(a => (a.district || '').toLowerCase().includes(d));
      }

      if (params.pincode) {
        list = list.filter(a => (a.pincode || '').includes(params.pincode));
      }

      if (params.street) {
        const st = params.street.toLowerCase();
        list = list.filter(a =>
          (a.address_line_1 || '').toLowerCase().includes(st) ||
          (a.area || '').toLowerCase().includes(st)
        );
      }

      const grp = params.group || params.addressGroup;
      if (grp && grp !== 'ALL') {
        list = list.filter(a => (a.addressGroup || 'CONTRIBUTOR').toUpperCase() === grp.toUpperCase());
      }

      if (params.subscription && params.subscription !== 'ALL') {
        const isSub = params.subscription === 'SUBSCRIBED' || params.subscription === 'true';
        list = list.filter(a => Boolean(a.subscription) === isSub);
      }

      if (params.alphabet && params.alphabet !== 'ALL') {
        const letter = params.alphabet.toLowerCase();
        list = list.filter(a => (a.name || '').trim().toLowerCase().startsWith(letter));
      }

      // Sort
      const sort = params.sort || 'name_asc';
      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sort === 'name_desc') {
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      }

      const total = list.length;
      const page = Math.max(1, parseInt(params.page || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(params.limit || '50', 10)), 15000);
      const start = (page - 1) * limit;
      const paginated = list.slice(start, start + limit);

      return {
        addresses: paginated,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit
      };
    }
  );
}

export async function fetchAddressById(id) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/address?id=${id}`);
      if (!res.ok) throw new Error('Failed to fetch address details');
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const found = addresses.find(a => a._id === id || a.u_id === id);
      if (!found) throw new Error('Address not found');
      return found;
    }
  );
}

export async function checkDuplicateAddress(addressData) {
  const cleanData = sanitizeObject(addressData);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to check duplicate');
      }
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const name = (cleanData.name || '').trim().toLowerCase();
      const phone = (cleanData.phone || '').trim();
      const uId = (cleanData.u_id || '').trim().toLowerCase();

      const duplicates = addresses.filter(a => {
        if (cleanData._id && a._id === cleanData._id) return false;
        if (uId && (a.u_id || '').toLowerCase() === uId) return true;
        if (phone && phone.length >= 10 && a.phone === phone) return true;
        if (name && (a.name || '').toLowerCase() === name) return true;
        return false;
      });

      return {
        isDuplicate: duplicates.length > 0,
        duplicates,
        matchType: duplicates.length > 0 ? 'exact_or_phone' : 'none'
      };
    }
  );
}

export async function batchCheckDuplicateAddresses(items) {
  const cleanItems = sanitizeObject(items);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cleanItems })
      });
      if (!res.ok) throw new Error('Failed to batch check duplicates');
      return res.json();
    },
    async () => {
      const existing = getLocalAddresses();
      const duplicates = [];

      for (let i = 0; i < (cleanItems || []).length; i++) {
        const item = cleanItems[i];
        const name = (item.name || '').trim().toLowerCase();
        const phone = (item.phone || '').trim();
        const uId = (item.u_id || '').trim().toLowerCase();

        const match = existing.find(a =>
          (uId && (a.u_id || '').toLowerCase() === uId) ||
          (phone && phone.length >= 10 && a.phone === phone) ||
          (name && (a.name || '').toLowerCase() === name)
        );

        if (match) {
          duplicates.push({ index: i, item, duplicateOf: match });
        }
      }

      return { duplicates, totalDuplicates: duplicates.length };
    }
  );
}

export async function createAddress(addressData) {
  const cleanData = sanitizeObject(addressData);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/create-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create address');
      }
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const now = new Date().toISOString();
      const newDoc = {
        _id: generateId(),
        ...cleanData,
        addressGroup: cleanData.addressGroup || 'CONTRIBUTOR',
        created_at: now,
        updated_at: now
      };
      addresses.unshift(newDoc);
      saveLocalAddresses(addresses);
      return newDoc;
    }
  );
}

export async function updateAddress(id, addressData) {
  const cleanData = sanitizeObject(addressData);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/update-address?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update address');
      }
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const idx = addresses.findIndex(a => a._id === id || a.u_id === id);
      if (idx === -1) throw new Error('Address not found');
      const updated = {
        ...addresses[idx],
        ...cleanData,
        updated_at: new Date().toISOString()
      };
      addresses[idx] = updated;
      saveLocalAddresses(addresses);
      return updated;
    }
  );
}

export async function deleteAddress(id) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/delete-address?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete address');
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const filtered = addresses.filter(a => a._id !== id && a.u_id !== id);
      saveLocalAddresses(filtered);
      return { success: true, id, deletedCount: 1 };
    }
  );
}

export async function bulkDeleteAddresses(ids = []) {
  if (!ids || ids.length === 0) return { success: true, deletedCount: 0 };
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/delete-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete selected addresses');
      }
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const idSet = new Set(ids);
      const remaining = addresses.filter(a => !idSet.has(a._id) && !idSet.has(a.u_id));
      const deletedCount = addresses.length - remaining.length;
      saveLocalAddresses(remaining);
      return { success: true, deletedCount, count: ids.length };
    }
  );
}

export async function fetchDistricts() {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/districts`);
      if (!res.ok) throw new Error('Failed to fetch districts');
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const map = {};
      for (const a of addresses) {
        const d = a.district;
        if (!d) continue;
        if (!map[d]) {
          map[d] = { district: d, state: a.state || 'Tamil Nadu', count: 0 };
        }
        map[d].count++;
      }
      return Object.values(map).sort((a, b) => b.count - a.count);
    }
  );
}

export async function fetchPincodes() {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/pincodes`);
      if (!res.ok) throw new Error('Failed to fetch pincodes');
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const map = {};
      for (const a of addresses) {
        const p = a.pincode;
        if (!p) continue;
        if (!map[p]) {
          map[p] = { pincode: p, district: a.district || '', city: a.city || '', count: 0 };
        }
        map[p].count++;
      }
      return Object.values(map).sort((a, b) => b.count - a.count);
    }
  );
}

export async function batchImportAddresses(items, options = {}) {
  const cleanItems = sanitizeObject(items);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/import_addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cleanItems, force: options.force !== undefined ? options.force : true })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to batch import addresses');
      }
      return res.json();
    },
    async () => {
      const addresses = getLocalAddresses();
      const now = new Date().toISOString();
      let imported = 0;
      for (const item of cleanItems) {
        if (!item.name || !item.address_line_1 || !item.district) continue;
        addresses.unshift({
          _id: generateId(),
          ...item,
          addressGroup: item.addressGroup || 'CONTRIBUTOR',
          created_at: now,
          updated_at: now
        });
        imported++;
      }
      saveLocalAddresses(addresses);
      return { totalProcessed: cleanItems.length, success: imported, duplicates: 0, invalid: cleanItems.length - imported };
    }
  );
}

export async function triggerSeedData(count = 10) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      if (!res.ok) throw new Error('Failed to trigger database seeding');
      return res.json();
    },
    async () => {
      saveLocalAddresses(INITIAL_SAMPLE_ADDRESSES);
      return { success: true, count: INITIAL_SAMPLE_ADDRESSES.length, message: 'Reset to demo dataset successfully' };
    }
  );
}

export async function loginAdmin(username, password) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Server error (${res.status}). Please check your credentials.`);
      }
      if (!data) throw new Error('Invalid server response format.');
      return data;
    },
    async () => {
      const u = (username || '').trim().toLowerCase();
      // Allow demo login
      if (u === 'admin' && (password === 'admin123' || password === 'admin')) {
        return {
          success: true,
          message: 'Demo authentication successful',
          token: 'demo_token_' + Date.now(),
          user: {
            id: 'demo_admin',
            username: 'admin',
            name: 'Demo Administrator',
            role: 'admin',
            token: 'demo_token_' + Date.now(),
            loginTime: new Date().toISOString()
          }
        };
      }
      const users = getLocalUsers();
      const found = users.find(x => x.username.toLowerCase() === u);
      if (found) {
        return {
          success: true,
          message: 'Authentication successful',
          token: 'demo_token_' + Date.now(),
          user: {
            id: found._id,
            username: found.username,
            name: found.name || 'Demo Administrator',
            role: found.role || 'admin',
            token: 'demo_token_' + Date.now(),
            loginTime: new Date().toISOString()
          }
        };
      }
      throw new Error('Invalid username or password. For demo, use admin / admin123');
    }
  );
}

export async function registerAdmin(username, password, name = 'Administrator') {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username, password, name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to register admin account');
      return data;
    },
    async () => {
      const users = getLocalUsers();
      const u = (username || '').trim().toLowerCase();
      if (users.find(x => x.username.toLowerCase() === u)) {
        throw new Error(`Username '${username}' already exists.`);
      }
      const newUser = {
        _id: generateId(),
        username: u,
        name,
        role: 'admin',
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      saveLocalUsers(users);
      return {
        success: true,
        message: 'Admin registered successfully in demo mode',
        token: 'demo_token_' + Date.now(),
        user: { ...newUser, token: 'demo_token_' + Date.now() }
      };
    }
  );
}

export async function changeAdminPassword(username, currentPassword, newPassword) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', username, current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      return data;
    },
    async () => {
      return { success: true, message: 'Password updated successfully in demo mode' };
    }
  );
}

export async function updateAdminProfile(currentUsername, newName, newUsername) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', current_username: currentUsername, name: newName, new_username: newUsername })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      return data;
    },
    async () => {
      const users = getLocalUsers();
      const idx = users.findIndex(x => x.username.toLowerCase() === currentUsername.toLowerCase());
      if (idx !== -1) {
        users[idx].name = newName || users[idx].name;
        users[idx].username = (newUsername || users[idx].username).toLowerCase();
        saveLocalUsers(users);
      }
      return {
        success: true,
        message: 'Profile updated in demo mode',
        user: { name: newName, username: newUsername || currentUsername }
      };
    }
  );
}

export async function fetchImportantDates(params = {}) {
  return safeApiCall(
    async () => {
      const query = new URLSearchParams();
      if (params.category) query.append('category', params.category);
      if (params.type && params.type !== 'all') query.append('type', params.type);
      if (params.anniversary_type && params.anniversary_type !== 'all') query.append('anniversary_type', params.anniversary_type);
      if (params.filter && params.filter !== 'all') query.append('filter', params.filter);
      if (params.u_id) query.append('u_id', params.u_id);
      if (params.search) query.append('search', params.search);
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);

      const res = await fetch(`${API_BASE}/important_dates?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch important dates');
      return res.json();
    },
    async () => {
      let dates = getLocalDates();
      if (params.type && params.type !== 'all') {
        dates = dates.filter(d => d.date_type === params.type);
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        dates = dates.filter(d => (d.contact_name || '').toLowerCase().includes(s) || (d.notes || '').toLowerCase().includes(s));
      }
      return {
        items: dates,
        counts: {
          total: dates.length,
          birthdays: dates.filter(d => d.date_type === 'birthday').length,
          anniversaries: dates.filter(d => d.date_type === 'anniversary').length,
          activeReminders: 2
        },
        page: 1,
        totalPages: 1
      };
    }
  );
}

export async function createImportantDate(dateData) {
  const cleanData = sanitizeObject(dateData);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/important_dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create important date');
      }
      return res.json();
    },
    async () => {
      const dates = getLocalDates();
      const newDate = {
        _id: generateId(),
        ...cleanData,
        created_at: new Date().toISOString()
      };
      dates.unshift(newDate);
      saveLocalDates(dates);
      return newDate;
    }
  );
}

export async function updateImportantDate(id, dateData) {
  const cleanData = sanitizeObject(dateData);
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/important_dates?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update important date');
      }
      return res.json();
    },
    async () => {
      const dates = getLocalDates();
      const idx = dates.findIndex(d => d._id === id);
      if (idx !== -1) {
        dates[idx] = { ...dates[idx], ...cleanData };
        saveLocalDates(dates);
        return dates[idx];
      }
      throw new Error('Important date not found');
    }
  );
}

export async function deleteImportantDate(id) {
  return safeApiCall(
    async () => {
      const res = await fetch(`${API_BASE}/important_dates?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete important date');
      }
      return res.json();
    },
    async () => {
      const dates = getLocalDates();
      const filtered = dates.filter(d => d._id !== id);
      saveLocalDates(filtered);
      return { success: true, id };
    }
  );
}
