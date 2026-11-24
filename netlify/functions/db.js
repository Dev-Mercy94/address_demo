// In-memory Serverless Demo Database for AddressHub Demo Application
// Eliminates MongoDB Atlas dependency, provides instant zero-latency responses with pre-seeded sample data
import crypto from 'crypto';
import {
  INITIAL_SAMPLE_ADDRESSES,
  INITIAL_SAMPLE_USERS,
  INITIAL_SAMPLE_IMPORTANT_DATES
} from './sample_data.js';

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

export const ALLOWED_ADDRESS_GROUPS = [
  'VIP',
  'ADVERTISEMENT',
  'HELP',
  'NORMAL',
  'CONTRIBUTOR',
  'CANCEL',
  'CALLBACK',
  'MATRIMONY',
  'PAYLATER',
  'NEWS'
];
export const DEFAULT_ADDRESS_GROUP = 'CONTRIBUTOR';

export function normalizeAddressGroup(group) {
  if (!group || typeof group !== 'string') return DEFAULT_ADDRESS_GROUP;
  const upper = group.trim().toUpperCase();
  if (ALLOWED_ADDRESS_GROUPS.includes(upper)) return upper;
  return null;
}

export class ObjectId {
  constructor(id) {
    this._id = id ? id.toString() : crypto.randomBytes(12).toString('hex');
  }

  toString() {
    return this._id;
  }

  toHexString() {
    return this._id;
  }

  valueOf() {
    return this._id;
  }

  static isValid(id) {
    if (!id) return false;
    if (typeof id === 'object' && id._id) return true;
    const str = id.toString();
    return /^[0-9a-fA-F]{24}$/.test(str) || (typeof id === 'string' && id.length > 0);
  }
}

// In-Memory Global Datastore
let globalAddresses = JSON.parse(JSON.stringify(INITIAL_SAMPLE_ADDRESSES));
let globalUsers = JSON.parse(JSON.stringify(INITIAL_SAMPLE_USERS));
let globalImportantDates = JSON.parse(JSON.stringify(INITIAL_SAMPLE_IMPORTANT_DATES));

function matchesValue(docVal, condition) {
  if (condition === undefined) return true;

  // RegExp match
  if (condition instanceof RegExp) {
    return condition.test(docVal != null ? String(docVal) : '');
  }

  // Operator object
  if (condition && typeof condition === 'object' && !(condition instanceof ObjectId)) {
    if (condition.$regex) {
      const reg = condition.$regex instanceof RegExp
        ? condition.$regex
        : new RegExp(condition.$regex, condition.$options || '');
      return reg.test(docVal != null ? String(docVal) : '');
    }
    if (condition.$in && Array.isArray(condition.$in)) {
      const targetStr = docVal != null ? docVal.toString() : '';
      return condition.$in.some(item => {
        if (!item) return targetStr === '';
        const itemStr = item.toString ? item.toString() : String(item);
        return itemStr === targetStr;
      });
    }
    if (condition.$ne !== undefined) {
      if (condition.$ne === null) {
        return docVal !== null && docVal !== undefined;
      }
      return docVal !== condition.$ne;
    }
    if (condition.$gte !== undefined) {
      return docVal >= condition.$gte;
    }
    if (condition.$lte !== undefined) {
      return docVal <= condition.$lte;
    }
    if (condition.$exists !== undefined) {
      const exists = docVal !== undefined && docVal !== null;
      return condition.$exists ? exists : !exists;
    }
  }

  // ObjectId comparison
  if (condition instanceof ObjectId || (condition && condition.toString && typeof condition === 'object')) {
    return (docVal != null ? docVal.toString() : '') === condition.toString();
  }

  // Primitive equality
  return docVal === condition;
}

function matchesQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, cond] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(cond)) continue;
      const matchedAny = cond.some(subQuery => matchesQuery(doc, subQuery));
      if (!matchedAny) return false;
      continue;
    }

    if (key === '$and') {
      if (!Array.isArray(cond)) continue;
      const matchedAll = cond.every(subQuery => matchesQuery(doc, subQuery));
      if (!matchedAll) return false;
      continue;
    }

    const docVal = doc[key];
    if (!matchesValue(docVal, cond)) {
      return false;
    }
  }

  return true;
}

class MockCursor {
  constructor(docs) {
    this._docs = docs;
    this._sortField = null;
    this._sortOrder = 1;
    this._skipCount = 0;
    this._limitCount = null;
  }

  sort(sortObj) {
    if (sortObj && typeof sortObj === 'object') {
      const [field, order] = Object.entries(sortObj)[0] || [];
      if (field) {
        this._sortField = field;
        this._sortOrder = order === -1 || order === 'desc' ? -1 : 1;
      }
    }
    return this;
  }

  skip(count) {
    this._skipCount = Math.max(0, parseInt(count || 0, 10));
    return this;
  }

  limit(count) {
    this._limitCount = Math.max(0, parseInt(count || 0, 10));
    return this;
  }

  project() {
    return this;
  }

  async toArray() {
    let result = [...this._docs];

    if (this._sortField) {
      result.sort((a, b) => {
        let valA = a[this._sortField];
        let valB = b[this._sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * this._sortOrder;
        if (valA > valB) return 1 * this._sortOrder;
        return 0;
      });
    }

    if (this._skipCount > 0) {
      result = result.slice(this._skipCount);
    }

    if (this._limitCount !== null && this._limitCount !== undefined) {
      result = result.slice(0, this._limitCount);
    }

    return result.map(doc => ({ ...doc }));
  }
}

class MockCollection {
  constructor(name, getDocs, setDocs) {
    this.name = name;
    this.getDocs = getDocs;
    this.setDocs = setDocs;
  }

  async createIndex() {
    return 'index_created';
  }

  find(query = {}) {
    const all = this.getDocs();
    const filtered = all.filter(d => matchesQuery(d, query));
    return new MockCursor(filtered);
  }

  async findOne(query = {}) {
    const all = this.getDocs();
    const found = all.find(d => matchesQuery(d, query));
    return found ? { ...found } : null;
  }

  async insertOne(doc) {
    const all = this.getDocs();
    const newDoc = { ...doc };
    if (!newDoc._id) {
      newDoc._id = crypto.randomBytes(12).toString('hex');
    } else {
      newDoc._id = newDoc._id.toString();
    }
    all.unshift(newDoc);
    this.setDocs(all);
    return { insertedId: newDoc._id };
  }

  async insertMany(docs) {
    const all = this.getDocs();
    const insertedIds = {};
    docs.forEach((doc, idx) => {
      const newDoc = { ...doc };
      if (!newDoc._id) {
        newDoc._id = crypto.randomBytes(12).toString('hex');
      } else {
        newDoc._id = newDoc._id.toString();
      }
      insertedIds[idx] = newDoc._id;
      all.unshift(newDoc);
    });
    this.setDocs(all);
    return { insertedCount: docs.length, insertedIds };
  }

  async updateOne(query, update) {
    const all = this.getDocs();
    const idx = all.findIndex(d => matchesQuery(d, query));
    if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };

    const doc = all[idx];
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    all[idx] = doc;
    this.setDocs(all);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(query, update, options = {}) {
    const all = this.getDocs();
    const idx = all.findIndex(d => matchesQuery(d, query));
    if (idx === -1) return null;

    const doc = all[idx];
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    all[idx] = doc;
    this.setDocs(all);
    return { ...doc };
  }

  async deleteOne(query) {
    const all = this.getDocs();
    const idx = all.findIndex(d => matchesQuery(d, query));
    if (idx === -1) return { deletedCount: 0 };
    all.splice(idx, 1);
    this.setDocs(all);
    return { deletedCount: 1 };
  }

  async deleteMany(query = {}) {
    const all = this.getDocs();
    if (Object.keys(query).length === 0) {
      const count = all.length;
      this.setDocs([]);
      return { deletedCount: count };
    }
    const remaining = all.filter(d => !matchesQuery(d, query));
    const deletedCount = all.length - remaining.length;
    this.setDocs(remaining);
    return { deletedCount };
  }

  async countDocuments(query = {}) {
    const all = this.getDocs();
    if (Object.keys(query).length === 0) return all.length;
    return all.filter(d => matchesQuery(d, query)).length;
  }

  async distinct(field) {
    const all = this.getDocs();
    const set = new Set();
    for (const d of all) {
      if (d[field]) set.add(d[field]);
    }
    return Array.from(set);
  }

  aggregate(pipeline = []) {
    let result = [...this.getDocs()];

    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter(d => matchesQuery(d, stage.$match));
      }

      if (stage.$group) {
        const groups = new Map();
        const groupSpec = stage.$group;
        const idExpr = groupSpec._id;

        for (const doc of result) {
          let key;
          if (typeof idExpr === 'string' && idExpr.startsWith('$')) {
            const field = idExpr.slice(1);
            key = doc[field];
          } else if (idExpr && typeof idExpr === 'object' && idExpr.$ifNull) {
            const [fieldRef, fallback] = idExpr.$ifNull;
            const field = fieldRef.startsWith('$') ? fieldRef.slice(1) : fieldRef;
            key = doc[field] || fallback;
          } else {
            key = idExpr;
          }

          if (!groups.has(key)) {
            groups.set(key, { _id: key, count: 0, items: [] });
          }
          const grp = groups.get(key);
          grp.count += 1;
          grp.items.push(doc);

          // Group accumulators like state: { $first: '$state' }
          for (const [outKey, acc] of Object.entries(groupSpec)) {
            if (outKey === '_id' || outKey === 'count') continue;
            if (acc && acc.$first && acc.$first.startsWith('$')) {
              const srcField = acc.$first.slice(1);
              if (grp[outKey] === undefined) {
                grp[outKey] = doc[srcField];
              }
            }
          }
        }

        result = Array.from(groups.values());
      }

      if (stage.$sort) {
        const [field, order] = Object.entries(stage.$sort)[0] || [];
        if (field) {
          const dir = order === -1 ? -1 : 1;
          result.sort((a, b) => {
            const valA = a[field] || 0;
            const valB = b[field] || 0;
            return valA < valB ? -1 * dir : valA > valB ? 1 * dir : 0;
          });
        }
      }

      if (stage.$limit) {
        result = result.slice(0, stage.$limit);
      }
    }

    return {
      async toArray() {
        return result;
      }
    };
  }
}

class MockDb {
  collection(name) {
    if (name === 'addresses') {
      return new MockCollection('addresses', () => globalAddresses, (docs) => { globalAddresses = docs; });
    }
    if (name === 'users') {
      return new MockCollection('users', () => globalUsers, (docs) => { globalUsers = docs; });
    }
    if (name === 'important_dates') {
      return new MockCollection('important_dates', () => globalImportantDates, (docs) => { globalImportantDates = docs; });
    }
    // Fallback collection
    let fallbackStore = [];
    return new MockCollection(name, () => fallbackStore, (docs) => { fallbackStore = docs; });
  }
}

const mockDbInstance = new MockDb();

export async function getDb() {
  return {
    client: { close: async () => {} },
    db: mockDbInstance
  };
}
