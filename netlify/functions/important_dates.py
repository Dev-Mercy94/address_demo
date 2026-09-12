import json
import re
import math
from datetime import datetime, date, timedelta
from db import get_db, serialize_doc, escape_regex, json_response, handle_cors_preflight, ObjectId

def parse_date_components(date_str):
    if not date_str:
        return None, None, None
    try:
        parts = date_str.split('-')
        if len(parts) == 3:
            return int(parts[0]), int(parts[1]), int(parts[2])
    except Exception:
        pass
    return None, None, None

def calculate_date_meta(date_str, item_type):
    today = date.today()
    y, m, d = parse_date_components(date_str)
    if not (m and d):
        return {
            "formatted_date": date_str,
            "display_date": date_str,
            "days_until": 9999,
            "is_today": False,
            "is_this_week": False,
            "is_this_month": False,
            "is_upcoming": False,
            "age": None,
            "years_completed": None
        }

    try:
        # Next occurrence calculation
        this_year_occurrence = date(today.year, m, d)
    except ValueError:
        # Leap year fallback (e.g. Feb 29)
        this_year_occurrence = date(today.year, m, 28)

    if this_year_occurrence < today:
        try:
            next_occurrence = date(today.year + 1, m, d)
        except ValueError:
            next_occurrence = date(today.year + 1, m, 28)
    else:
        next_occurrence = this_year_occurrence

    delta_days = (next_occurrence - today).days
    is_today = (delta_days == 0)
    is_this_week = (0 <= delta_days <= 7)
    is_this_month = (m == today.month and (delta_days <= 31 or next_occurrence.month == today.month))
    is_upcoming = (0 <= delta_days <= 30)

    # Calculate Age or Years Completed
    age = None
    years_completed = None
    if y:
        years_diff = today.year - y
        if (today.month, today.day) < (m, d):
            current_age = max(0, years_diff - 1)
        else:
            current_age = max(0, years_diff)
        
        turning_age = years_diff if (today.month, today.day) <= (m, d) else years_diff + 1

        if item_type == 'birthday':
            age = turning_age if is_today or (0 <= delta_days <= 30) else current_age
        else:
            years_completed = turning_age if is_today or (0 <= delta_days <= 30) else current_age

    # Format Month & Day e.g., "12 Sep"
    months_abbr = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    display_date = f"{d:02d} {months_abbr[m]}"

    return {
        "formatted_date": date_str,
        "display_date": display_date,
        "day": d,
        "month": m,
        "year": y,
        "days_until": delta_days,
        "is_today": is_today,
        "is_this_week": is_this_week,
        "is_this_month": is_this_month,
        "is_upcoming": is_upcoming,
        "age": age,
        "years_completed": years_completed
    }

def handler(event, context):
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    client, db, is_atlas = get_db()
    query_params = event.get('queryStringParameters') or {}

    # Handle GET
    if method == 'GET':
        category = (query_params.get('category') or '').strip().lower() # 'birthday' | 'anniversary' | ''
        type_filter = (query_params.get('type') or query_params.get('anniversary_type') or '').strip().lower()
        timeframe = (query_params.get('filter') or query_params.get('timeframe') or 'all').strip().lower()
        u_id = (query_params.get('u_id') or query_params.get('uId') or '').strip()
        search = (query_params.get('search') or '').strip()
        page = max(1, int(query_params.get('page', 1)))
        limit = min(max(1, int(query_params.get('limit', 100))), 500)
        skip = (page - 1) * limit

        all_items = []
        if is_atlas:
            collection = db['important_dates']
            addr_collection = db['addresses']

            if collection.count_documents({}) == 0:
                now_str = datetime.utcnow().isoformat() + "Z"
                sample_docs = [
                    {
                        "u_id": "T-0001",
                        "name": "Arun Kumar",
                        "phone": "9876543210",
                        "type": "wedding",
                        "date": "2015-09-12",
                        "notes": "11th Wedding Anniversary",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0002",
                        "name": "Priya",
                        "phone": "9876543211",
                        "type": "shop_opening",
                        "date": "2020-09-18",
                        "notes": "Boutique Anniversary",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0003",
                        "name": "Ramesh",
                        "phone": "9876543212",
                        "type": "death",
                        "date": "2018-09-25",
                        "notes": "Memorial Anniversary",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0004",
                        "name": "Karthik",
                        "phone": "9876543214",
                        "type": "business_anniversary",
                        "date": "2019-09-03",
                        "notes": "Tech Venture Anniversary",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0001",
                        "name": "Arun Kumar",
                        "phone": "9876543210",
                        "type": "birthday",
                        "date": "1984-09-05",
                        "notes": "42nd Birthday",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0002",
                        "name": "Priya",
                        "phone": "9876543211",
                        "type": "birthday",
                        "date": "1991-09-12",
                        "notes": "35th Birthday",
                        "created_at": now_str,
                        "updated_at": now_str
                    },
                    {
                        "u_id": "T-0005",
                        "name": "Suresh",
                        "phone": "9876543213",
                        "type": "birthday",
                        "date": "1975-09-20",
                        "notes": "51st Birthday",
                        "created_at": now_str,
                        "updated_at": now_str
                    }
                ]
                collection.insert_many(sample_docs)

            cursor = collection.find({}).sort("date", 1)
            for doc in cursor:
                item = serialize_doc(doc)
                # If u_id is missing and address_id exists, attempt to lookup u_id
                if not item.get('u_id') and item.get('address_id'):
                    try:
                        addr = addr_collection.find_one({"_id": ObjectId(item['address_id'])})
                        if addr and addr.get('u_id'):
                            item['u_id'] = addr['u_id']
                    except Exception:
                        pass
                all_items.append(item)
        else:
            all_items = list(db.important_dates) if hasattr(db, 'important_dates') else []

        # Enrich items with date calculations
        enriched = []
        for item in all_items:
            meta = calculate_date_meta(item.get('date'), item.get('type'))
            enriched_item = {**item, **meta}
            enriched.append(enriched_item)

        # Apply Category & Type Filter
        filtered = enriched
        if category == 'birthday':
            filtered = [it for it in filtered if it.get('type') == 'birthday']
        elif category == 'anniversary':
            filtered = [it for it in filtered if it.get('type') != 'birthday']

        if type_filter and type_filter != 'all':
            filtered = [it for it in filtered if (it.get('type') or '').lower() == type_filter]

        # Filter by u_id if specified
        if u_id:
            u_clean = u_id.lower()
            filtered = [it for it in filtered if u_clean in (it.get('u_id') or '').lower()]

        # Apply Timeframe Filter
        if timeframe == 'today':
            filtered = [it for it in filtered if it.get('is_today')]
        elif timeframe == 'this_week':
            filtered = [it for it in filtered if it.get('is_this_week')]
        elif timeframe == 'this_month':
            filtered = [it for it in filtered if it.get('is_this_month')]
        elif timeframe == 'upcoming':
            filtered = [it for it in filtered if it.get('is_upcoming')]

        # Apply Search
        if search:
            s = search.lower()
            filtered = [
                it for it in filtered
                if s in (it.get('name') or '').lower()
                or s in (it.get('u_id') or '').lower()
                or s in (it.get('phone') or '').lower()
                or s in (it.get('notes') or '').lower()
                or s in (it.get('type') or '').lower()
            ]

        # Sort by upcoming days
        filtered.sort(key=lambda x: (x.get('days_until', 9999), x.get('name', '')))

        total_count = len(filtered)
        paginated_items = filtered[skip : skip + limit]

        # Also calculate summary counts for quick badges
        birthday_items = [it for it in enriched if it.get('type') == 'birthday']
        anniversary_items = [it for it in enriched if it.get('type') != 'birthday']

        counts = {
            "total": len(enriched),
            "birthdays": {
                "total": len(birthday_items),
                "today": len([it for it in birthday_items if it.get('is_today')]),
                "this_week": len([it for it in birthday_items if it.get('is_this_week')]),
                "this_month": len([it for it in birthday_items if it.get('is_this_month')]),
                "upcoming": len([it for it in birthday_items if it.get('is_upcoming')])
            },
            "anniversaries": {
                "total": len(anniversary_items),
                "today": len([it for it in anniversary_items if it.get('is_today')]),
                "this_week": len([it for it in anniversary_items if it.get('is_this_week')]),
                "this_month": len([it for it in anniversary_items if it.get('is_this_month')]),
                "upcoming": len([it for it in anniversary_items if it.get('is_upcoming')])
            }
        }

        return json_response(200, {
            "items": paginated_items,
            "total": total_count,
            "page": page,
            "limit": limit,
            "totalPages": max(1, math.ceil(total_count / limit)),
            "counts": counts
        })

    # Handle POST (Create - supports single date object or batch array of dates)
    elif method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            return json_response(400, {"error": "Invalid JSON body"})

        valid_types = ['birthday', 'wedding', 'death', 'shop_opening', 'business_anniversary', 'other']
        now = datetime.utcnow().isoformat() + "Z"

        # Check if batch items are submitted
        batch_items = body.get('items') if isinstance(body.get('items'), list) else None

        if batch_items:
            created_items = []
            docs_to_insert = []
            
            for it in batch_items:
                name_it = (it.get('name') or body.get('name') or '').strip()
                uid_it = (it.get('u_id') or it.get('uId') or body.get('u_id') or body.get('uId') or '').strip()
                phone_it = (it.get('phone') or body.get('phone') or '').strip()
                date_it = (it.get('date') or '').strip()
                type_it = (it.get('type') or 'other').strip().lower()
                notes_it = (it.get('notes') or '').strip()
                relation_it = (it.get('relation') or it.get('relationship') or '').strip()
                contact_person_it = (it.get('contact_person') or body.get('contact_person') or body.get('name') or '').strip()
                addr_it = (it.get('address_id') or it.get('addressId') or body.get('address_id') or body.get('addressId') or '').strip()

                if not name_it or not date_it:
                    continue

                if type_it not in valid_types:
                    type_it = 'other'

                reminders_it = it.get('reminders')
                if not isinstance(reminders_it, list):
                    reminders_it = [0, 45, 30, 7]

                doc = {
                    "u_id": uid_it,
                    "name": name_it,
                    "phone": phone_it,
                    "type": type_it,
                    "date": date_it,
                    "notes": notes_it,
                    "relation": relation_it,
                    "contact_person": contact_person_it,
                    "custom_message": (it.get('custom_message') or body.get('custom_message') or '').strip(),
                    "reminders": reminders_it,
                    "address_id": addr_it if addr_it else None,
                    "created_at": now,
                    "updated_at": now
                }
                docs_to_insert.append(doc)

            if not docs_to_insert:
                return json_response(400, {"error": "At least one valid date record with name and date is required"})

            if is_atlas:
                collection = db['important_dates']
                res = collection.insert_many(docs_to_insert)
                for idx, inserted_id in enumerate(res.inserted_ids):
                    docs_to_insert[idx]['_id'] = str(inserted_id)
            else:
                for idx, doc in enumerate(docs_to_insert):
                    doc['_id'] = f"mock_date_{len(db.important_dates) + 1 + idx}"
                    db.important_dates.insert(0, doc)

            serialized_created = [
                {**serialize_doc(doc), **calculate_date_meta(doc['date'], doc['type'])}
                for doc in docs_to_insert
            ]
            return json_response(201, {
                "message": f"{len(serialized_created)} important dates created successfully",
                "items": serialized_created,
                "count": len(serialized_created)
            })

        # Single item create
        name = (body.get('name') or '').strip()
        u_id_val = (body.get('u_id') or body.get('uId') or '').strip()
        phone = (body.get('phone') or '').strip()
        date_val = (body.get('date') or '').strip()
        item_type = (body.get('type') or 'other').strip().lower()
        notes = (body.get('notes') or '').strip()
        relation_val = (body.get('relation') or body.get('relationship') or '').strip()
        contact_person_val = (body.get('contact_person') or '').strip()
        custom_message_val = (body.get('custom_message') or '').strip()
        address_id = (body.get('address_id') or body.get('addressId') or '').strip()

        if not name:
            return json_response(400, {"error": "Name is required"})
        if not date_val:
            return json_response(400, {"error": "Date is required"})

        if item_type not in valid_types:
            item_type = 'other'

        # If u_id is empty and address_id is provided, try looking up u_id from address
        if not u_id_val and address_id and is_atlas:
            try:
                addr = db['addresses'].find_one({"_id": ObjectId(address_id)})
                if addr and addr.get('u_id'):
                    u_id_val = addr['u_id']
            except Exception:
                pass

        reminders = body.get('reminders')
        if not isinstance(reminders, list):
            reminders = [0, 45, 30, 7]

        new_doc = {
            "u_id": u_id_val,
            "name": name,
            "phone": phone,
            "type": item_type,
            "date": date_val,
            "notes": notes,
            "relation": relation_val,
            "contact_person": contact_person_val,
            "custom_message": custom_message_val,
            "reminders": reminders,
            "address_id": address_id if address_id else None,
            "created_at": now,
            "updated_at": now
        }

        if is_atlas:
            collection = db['important_dates']
            res = collection.insert_one(new_doc)
            new_doc['_id'] = str(res.inserted_id)
        else:
            new_id = f"mock_date_{len(db.important_dates) + 1}"
            new_doc['_id'] = new_id
            db.important_dates.insert(0, new_doc)

        meta = calculate_date_meta(new_doc['date'], new_doc['type'])
        return json_response(201, {
            "message": "Important date created successfully",
            "item": {**serialize_doc(new_doc), **meta}
        })

    # Handle PUT (Update)
    elif method == 'PUT':
        item_id = (query_params.get('id') or '').strip()
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            return json_response(400, {"error": "Invalid JSON body"})

        if not item_id and body.get('_id'):
            item_id = str(body.get('_id'))

        if not item_id:
            return json_response(400, {"error": "Record ID is required for update"})

        update_fields = {}
        if 'name' in body:
            update_fields['name'] = (body['name'] or '').strip()
        if 'u_id' in body or 'uId' in body:
            update_fields['u_id'] = (body.get('u_id') or body.get('uId') or '').strip()
        if 'phone' in body:
            update_fields['phone'] = (body['phone'] or '').strip()
        if 'type' in body:
            update_fields['type'] = (body['type'] or 'other').strip().lower()
        if 'date' in body:
            update_fields['date'] = (body['date'] or '').strip()
        if 'notes' in body:
            update_fields['notes'] = (body['notes'] or '').strip()
        if 'relation' in body or 'relationship' in body:
            update_fields['relation'] = (body.get('relation') or body.get('relationship') or '').strip()
        if 'contact_person' in body:
            update_fields['contact_person'] = (body['contact_person'] or '').strip()
        if 'custom_message' in body:
            update_fields['custom_message'] = (body['custom_message'] or '').strip()
        if 'notes' in body:
            update_fields['notes'] = (body['notes'] or '').strip()
        if 'relation' in body or 'relationship' in body:
            update_fields['relation'] = (body.get('relation') or body.get('relationship') or '').strip()
        if 'contact_person' in body:
            update_fields['contact_person'] = (body.get('contact_person') or '').strip()
        if 'reminders' in body and isinstance(body['reminders'], list):
            update_fields['reminders'] = body['reminders']
        if 'address_id' in body or 'addressId' in body:
            update_fields['address_id'] = (body.get('address_id') or body.get('addressId') or '').strip() or None

        update_fields['updated_at'] = datetime.utcnow().isoformat() + "Z"

        if is_atlas:
            collection = db['important_dates']
            try:
                obj_id = ObjectId(item_id)
            except Exception:
                obj_id = item_id

            res = collection.find_one_and_update(
                {"_id": obj_id},
                {"$set": update_fields},
                return_document=True
            )
            if not res:
                return json_response(404, {"error": "Important date not found"})
            doc = serialize_doc(res)
        else:
            found = False
            doc = None
            for idx, item in enumerate(db.important_dates):
                if str(item.get('_id')) == str(item_id):
                    db.important_dates[idx].update(update_fields)
                    doc = db.important_dates[idx]
                    found = True
                    break
            if not found:
                return json_response(404, {"error": "Important date not found in mock store"})

        meta = calculate_date_meta(doc.get('date'), doc.get('type'))
        return json_response(200, {
            "message": "Important date updated successfully",
            "item": {**doc, **meta}
        })

    # Handle DELETE
    elif method == 'DELETE':
        item_id = (query_params.get('id') or '').strip()
        if not item_id:
            return json_response(400, {"error": "Record ID is required for deletion"})

        if is_atlas:
            collection = db['important_dates']
            try:
                obj_id = ObjectId(item_id)
            except Exception:
                obj_id = item_id

            res = collection.delete_one({"_id": obj_id})
            if res.deleted_count == 0:
                return json_response(404, {"error": "Important date not found"})
        else:
            initial_len = len(db.important_dates)
            db.important_dates = [it for it in db.important_dates if str(it.get('_id')) != str(item_id)]
            if len(db.important_dates) == initial_len:
                return json_response(404, {"error": "Important date not found in mock store"})

        return json_response(200, {"message": "Important date deleted successfully", "id": item_id})

    return json_response(405, {"error": "Method not allowed"})
