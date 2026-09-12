import { getDb, serializeDoc, escapeRegex, jsonResponse, handleCorsPreflight, ObjectId } from './db.js';

function parseDateComponents(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return [null, null, null];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return [y, m, d];
    }
  }
  return [null, null, null];
}

function calculateDateMeta(dateStr, itemType) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [y, m, d] = parseDateComponents(dateStr);
  if (!m || !d) {
    return {
      formatted_date: dateStr,
      display_date: dateStr,
      days_until: 9999,
      is_today: false,
      is_this_week: false,
      is_this_month: false,
      is_upcoming: false,
      age: null,
      years_completed: null
    };
  }

  // Next occurrence calculation
  let thisYearOccurrence;
  try {
    thisYearOccurrence = new Date(today.getFullYear(), m - 1, d);
  } catch {
    thisYearOccurrence = new Date(today.getFullYear(), m - 1, 28);
  }

  let nextOccurrence;
  if (thisYearOccurrence < today) {
    try {
      nextOccurrence = new Date(today.getFullYear() + 1, m - 1, d);
    } catch {
      nextOccurrence = new Date(today.getFullYear() + 1, m - 1, 28);
    }
  } else {
    nextOccurrence = thisYearOccurrence;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const deltaDays = Math.round((nextOccurrence - today) / msPerDay);
  const isToday = deltaDays === 0;
  const isThisWeek = deltaDays >= 0 && deltaDays <= 7;
  const isThisMonth = (m === today.getMonth() + 1) && (deltaDays <= 31 || (nextOccurrence.getMonth() === today.getMonth()));
  const isUpcoming = deltaDays >= 0 && deltaDays <= 30;

  let age = null;
  let yearsCompleted = null;
  if (y) {
    const yearsDiff = today.getFullYear() - y;
    const isPastThisYear = (today.getMonth() + 1 > m) || (today.getMonth() + 1 === m && today.getDate() >= d);
    const currentAge = isPastThisYear ? Math.max(0, yearsDiff) : Math.max(0, yearsDiff - 1);
    const turningAge = isPastThisYear ? yearsDiff : yearsDiff + 1;

    if (itemType === 'birthday') {
      age = (isToday || (deltaDays >= 0 && deltaDays <= 30)) ? turningAge : currentAge;
    } else {
      yearsCompleted = (isToday || (deltaDays >= 0 && deltaDays <= 30)) ? turningAge : currentAge;
    }
  }

  const monthsAbbr = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const displayDate = `${String(d).padStart(2, '0')} ${monthsAbbr[m] || ''}`;

  return {
    formatted_date: dateStr,
    display_date: displayDate,
    day: d,
    month: m,
    year: y,
    days_until: deltaDays,
    is_today: isToday,
    is_this_week: isThisWeek,
    is_this_month: isThisMonth,
    is_upcoming: isUpcoming,
    age,
    years_completed: yearsCompleted
  };
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();

  try {
    const { db } = await getDb();
    const queryParams = event.queryStringParameters || {};
    const method = event.httpMethod;

    if (method === 'GET') {
      const category = (queryParams.category || '').trim().toLowerCase();
      const typeFilter = (queryParams.type || queryParams.anniversary_type || '').trim().toLowerCase();
      const timeframe = (queryParams.filter || queryParams.timeframe || 'all').trim().toLowerCase();
      const uId = (queryParams.u_id || queryParams.uId || '').trim();
      const search = (queryParams.search || '').trim();
      const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(queryParams.limit, 10) || 100), 500);
      const skip = (page - 1) * limit;

      const collection = db.collection('important_dates');
      const addrCollection = db.collection('addresses');

      const count = await collection.countDocuments({});
      if (count === 0) {
        const nowStr = new Date().toISOString();
        const sampleDocs = [
          { u_id: 'T-0001', name: 'Arun Kumar', phone: '9876543210', type: 'wedding', date: '2015-09-12', notes: '11th Wedding Anniversary', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0002', name: 'Priya', phone: '9876543211', type: 'shop_opening', date: '2020-09-18', notes: 'Boutique Anniversary', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0003', name: 'Ramesh', phone: '9876543212', type: 'death', date: '2018-09-25', notes: 'Memorial Anniversary', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0004', name: 'Karthik', phone: '9876543214', type: 'business_anniversary', date: '2019-09-03', notes: 'Tech Venture Anniversary', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0001', name: 'Arun Kumar', phone: '9876543210', type: 'birthday', date: '1984-09-05', notes: '42nd Birthday', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0002', name: 'Priya', phone: '9876543211', type: 'birthday', date: '1991-09-12', notes: '35th Birthday', created_at: nowStr, updated_at: nowStr },
          { u_id: 'T-0005', name: 'Suresh', phone: '9876543213', type: 'birthday', date: '1975-09-20', notes: '51st Birthday', created_at: nowStr, updated_at: nowStr }
        ];
        await collection.insertMany(sampleDocs);
      }

      const cursor = collection.find({}).sort({ date: 1 });
      const rawItems = await cursor.toArray();
      const allItems = [];

      for (const doc of rawItems) {
        const item = serializeDoc(doc);
        if (!item.u_id && item.address_id && ObjectId.isValid(item.address_id)) {
          try {
            const addr = await addrCollection.findOne({ _id: new ObjectId(item.address_id) });
            if (addr && addr.u_id) {
              item.u_id = addr.u_id;
            }
          } catch {}
        }
        allItems.push(item);
      }

      const enriched = allItems.map(item => ({
        ...item,
        ...calculateDateMeta(item.date, item.type)
      }));

      let filtered = enriched;
      if (category === 'birthday') {
        filtered = filtered.filter(it => it.type === 'birthday');
      } else if (category === 'anniversary') {
        filtered = filtered.filter(it => it.type !== 'birthday');
      }

      if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(it => (it.type || '').toLowerCase() === typeFilter);
      }

      if (uId) {
        const uClean = uId.toLowerCase();
        filtered = filtered.filter(it => (it.u_id || '').toLowerCase().includes(uClean));
      }

      if (timeframe === 'today') {
        filtered = filtered.filter(it => it.is_today);
      } else if (timeframe === 'this_week') {
        filtered = filtered.filter(it => it.is_this_week);
      } else if (timeframe === 'this_month') {
        filtered = filtered.filter(it => it.is_this_month);
      } else if (timeframe === 'upcoming') {
        filtered = filtered.filter(it => it.is_upcoming);
      }

      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(it =>
          (it.name || '').toLowerCase().includes(s) ||
          (it.u_id || '').toLowerCase().includes(s) ||
          (it.phone || '').toLowerCase().includes(s) ||
          (it.notes || '').toLowerCase().includes(s) ||
          (it.type || '').toLowerCase().includes(s)
        );
      }

      filtered.sort((a, b) => {
        const diff = (a.days_until || 9999) - (b.days_until || 9999);
        if (diff !== 0) return diff;
        return (a.name || '').localeCompare(b.name || '');
      });

      const totalCount = filtered.length;
      const paginatedItems = filtered.slice(skip, skip + limit);

      const birthdayItems = enriched.filter(it => it.type === 'birthday');
      const anniversaryItems = enriched.filter(it => it.type !== 'birthday');

      const counts = {
        total: enriched.length,
        birthdays: {
          total: birthdayItems.length,
          today: birthdayItems.filter(it => it.is_today).length,
          this_week: birthdayItems.filter(it => it.is_this_week).length,
          this_month: birthdayItems.filter(it => it.is_this_month).length,
          upcoming: birthdayItems.filter(it => it.is_upcoming).length
        },
        anniversaries: {
          total: anniversaryItems.length,
          today: anniversaryItems.filter(it => it.is_today).length,
          this_week: anniversaryItems.filter(it => it.is_this_week).length,
          this_month: anniversaryItems.filter(it => it.is_this_month).length,
          upcoming: anniversaryItems.filter(it => it.is_upcoming).length
        }
      };

      return jsonResponse(200, {
        items: paginatedItems,
        total: totalCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        counts
      });
    }

    if (method === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }

      const validTypes = ['birthday', 'wedding', 'death', 'shop_opening', 'business_anniversary', 'other'];
      const now = new Date().toISOString();

      if (Array.isArray(body.items)) {
        const docsToInsert = [];
        for (const it of body.items) {
          const nameIt = (it.name || body.name || '').trim();
          const uidIt = (it.u_id || it.uId || body.u_id || body.uId || '').trim();
          const phoneIt = (it.phone || body.phone || '').trim();
          const dateIt = (it.date || '').trim();
          let typeIt = (it.type || 'other').trim().toLowerCase();
          const notesIt = (it.notes || '').trim();
          const relationIt = (it.relation || it.relationship || '').trim();
          const contactPersonIt = (it.contact_person || body.contact_person || body.name || '').trim();
          const addrIt = (it.address_id || it.addressId || body.address_id || body.addressId || '').trim();

          if (!nameIt || !dateIt) continue;
          if (!validTypes.includes(typeIt)) typeIt = 'other';

          const remindersIt = Array.isArray(it.reminders) ? it.reminders : [0, 45, 30, 7];

          docsToInsert.push({
            u_id: uidIt,
            name: nameIt,
            phone: phoneIt,
            type: typeIt,
            date: dateIt,
            notes: notesIt,
            relation: relationIt,
            contact_person: contactPersonIt,
            custom_message: (it.custom_message || body.custom_message || '').trim(),
            reminders: remindersIt,
            address_id: addrIt || null,
            created_at: now,
            updated_at: now
          });
        }

        if (docsToInsert.length === 0) {
          return jsonResponse(400, { error: 'At least one valid date record with name and date is required' });
        }

        const collection = db.collection('important_dates');
        const res = await collection.insertMany(docsToInsert);
        const serializedCreated = docsToInsert.map((doc, idx) => ({
          ...serializeDoc({ ...doc, _id: res.insertedIds[idx] }),
          ...calculateDateMeta(doc.date, doc.type)
        }));

        return jsonResponse(201, {
          message: `${serializedCreated.length} important dates created successfully`,
          items: serializedCreated,
          count: serializedCreated.length
        });
      }

      // Single item create
      const name = (body.name || '').trim();
      let uIdVal = (body.u_id || body.uId || '').trim();
      const phone = (body.phone || '').trim();
      const dateVal = (body.date || '').trim();
      let itemType = (body.type || 'other').trim().toLowerCase();
      const notes = (body.notes || '').trim();
      const relationVal = (body.relation || body.relationship || '').trim();
      const contactPersonVal = (body.contact_person || '').trim();
      const customMessageVal = (body.custom_message || '').trim();
      const addressId = (body.address_id || body.addressId || '').trim();

      if (!name) return jsonResponse(400, { error: 'Name is required' });
      if (!dateVal) return jsonResponse(400, { error: 'Date is required' });
      if (!validTypes.includes(itemType)) itemType = 'other';

      if (!uIdVal && addressId && ObjectId.isValid(addressId)) {
        try {
          const addr = await db.collection('addresses').findOne({ _id: new ObjectId(addressId) });
          if (addr && addr.u_id) uIdVal = addr.u_id;
        } catch {}
      }

      const reminders = Array.isArray(body.reminders) ? body.reminders : [0, 45, 30, 7];

      const newDoc = {
        u_id: uIdVal,
        name,
        phone,
        type: itemType,
        date: dateVal,
        notes,
        relation: relationVal,
        contact_person: contactPersonVal,
        custom_message: customMessageVal,
        reminders,
        address_id: addressId || null,
        created_at: now,
        updated_at: now
      };

      const collection = db.collection('important_dates');
      const res = await collection.insertOne(newDoc);
      newDoc._id = res.insertedId;

      const meta = calculateDateMeta(newDoc.date, newDoc.type);
      return jsonResponse(201, {
        message: 'Important date created successfully',
        item: { ...serializeDoc(newDoc), ...meta }
      });
    }

    if (method === 'PUT') {
      let itemId = (queryParams.id || '').trim();
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }

      if (!itemId && body._id) itemId = String(body._id);
      if (!itemId) return jsonResponse(400, { error: 'Record ID is required for update' });

      const updateFields = {};
      if ('name' in body) updateFields.name = (body.name || '').trim();
      if ('u_id' in body || 'uId' in body) updateFields.u_id = (body.u_id || body.uId || '').trim();
      if ('phone' in body) updateFields.phone = (body.phone || '').trim();
      if ('type' in body) updateFields.type = (body.type || 'other').trim().toLowerCase();
      if ('date' in body) updateFields.date = (body.date || '').trim();
      if ('notes' in body) updateFields.notes = (body.notes || '').trim();
      if ('relation' in body || 'relationship' in body) updateFields.relation = (body.relation || body.relationship || '').trim();
      if ('contact_person' in body) updateFields.contact_person = (body.contact_person || '').trim();
      if ('custom_message' in body) updateFields.custom_message = (body.custom_message || '').trim();
      if ('reminders' in body && Array.isArray(body.reminders)) updateFields.reminders = body.reminders;
      if ('address_id' in body || 'addressId' in body) updateFields.address_id = (body.address_id || body.addressId || '').trim() || null;

      updateFields.updated_at = new Date().toISOString();

      const collection = db.collection('important_dates');
      let query = { _id: itemId };
      if (ObjectId.isValid(itemId)) {
        query = { $or: [{ _id: new ObjectId(itemId) }, { _id: itemId }] };
      }

      const res = await collection.findOneAndUpdate(query, { $set: updateFields }, { returnDocument: 'after' });
      if (!res) {
        return jsonResponse(404, { error: 'Important date not found' });
      }

      const serialized = serializeDoc(res);
      const meta = calculateDateMeta(serialized.date, serialized.type);
      return jsonResponse(200, {
        message: 'Important date updated successfully',
        item: { ...serialized, ...meta }
      });
    }

    if (method === 'DELETE') {
      const itemId = (queryParams.id || '').trim();
      if (!itemId) return jsonResponse(400, { error: 'Record ID is required for deletion' });

      const collection = db.collection('important_dates');
      let query = { _id: itemId };
      if (ObjectId.isValid(itemId)) {
        query = { $or: [{ _id: new ObjectId(itemId) }, { _id: itemId }] };
      }

      const res = await collection.deleteOne(query);
      if (res.deletedCount === 0) {
        return jsonResponse(404, { error: 'Important date not found' });
      }

      return jsonResponse(200, { message: 'Important date deleted successfully', id: itemId });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in important_dates handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
