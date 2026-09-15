const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/.netlify/functions' : 'https://addresshubmanagement.netlify.app/.netlify/functions')
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

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchAddresses(params = {}, signal = null) {
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
  if (params.sort) query.append('sort', params.sort);

  const res = await fetch(`${API_BASE}/addresses?${query.toString()}`, { signal });
  if (!res.ok) throw new Error('Failed to fetch addresses');
  return res.json();
}

export async function fetchAddressById(id) {
  const res = await fetch(`${API_BASE}/address?id=${id}`);
  if (!res.ok) throw new Error('Failed to fetch address details');
  return res.json();
}

export async function checkDuplicateAddress(addressData) {
  const cleanData = sanitizeObject(addressData);
  const res = await fetch(`${API_BASE}/check-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanData)
  });
  if (!res.ok) throw new Error('Failed to check duplicate');
  return res.json();
}

export async function batchCheckDuplicateAddresses(items) {
  const cleanItems = sanitizeObject(items);
  const res = await fetch(`${API_BASE}/check-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cleanItems })
  });
  if (!res.ok) throw new Error('Failed to batch check duplicates');
  return res.json();
}

export async function createAddress(addressData) {
  const cleanData = sanitizeObject(addressData);
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
}

export async function updateAddress(id, addressData) {
  const cleanData = sanitizeObject(addressData);
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
}

export async function deleteAddress(id) {
  const res = await fetch(`${API_BASE}/delete-address?id=${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete address');
  return res.json();
}

export async function fetchDistricts() {
  const res = await fetch(`${API_BASE}/districts`);
  if (!res.ok) throw new Error('Failed to fetch districts');
  return res.json();
}

export async function fetchPincodes() {
  const res = await fetch(`${API_BASE}/pincodes`);
  if (!res.ok) throw new Error('Failed to fetch pincodes');
  return res.json();
}

export async function batchImportAddresses(items, options = {}) {
  const cleanItems = sanitizeObject(items);
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
}

export async function triggerSeedData(count = 10) {
  const res = await fetch(`${API_BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count })
  });
  if (!res.ok) throw new Error('Failed to trigger database seeding');
  return res.json();
}

export async function loginAdmin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Server error (${res.status}). Please check your credentials.`);
    }
    if (!data) {
      throw new Error('Invalid server response format.');
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && (err.message || '').toLowerCase().includes('fetch')) {
      throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
    }
    throw err;
  }
}

export async function registerAdmin(username, password, name = 'Administrator') {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', username, password, name })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register admin account');
  }
  return data;
}

export async function changeAdminPassword(username, currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'change_password', username, current_password: currentPassword, new_password: newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to change password');
  }
  return data;
}

export async function updateAdminProfile(currentUsername, newName, newUsername) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_profile', current_username: currentUsername, name: newName, new_username: newUsername })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data;
}

export async function fetchImportantDates(params = {}) {
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
}

export async function createImportantDate(dateData) {
  const cleanData = sanitizeObject(dateData);
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
}

export async function updateImportantDate(id, dateData) {
  const cleanData = sanitizeObject(dateData);
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
}

export async function deleteImportantDate(id) {
  const res = await fetch(`${API_BASE}/important_dates?id=${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete important date');
  }
  return res.json();
}

