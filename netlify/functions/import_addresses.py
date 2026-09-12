import re
import sys
import json
import time
from datetime import datetime
from db import get_db, serialize_doc, escape_regex, json_response, handle_cors_preflight, sanitize_unicode

def handler(event, context):
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method != 'POST':
        return json_response(405, {"error": "Method not allowed"})

    try:
        body_raw = event.get('body') or '{}'
        try:
            payload = json.loads(body_raw)
            payload = sanitize_unicode(payload)
        except Exception:
            return json_response(400, {"error": "Invalid JSON request body"})

        items = payload.get('items') or []
        items = sanitize_unicode(items)
        if not items:
            return json_response(200, {
                "totalProcessed": 0,
                "success": 0,
                "duplicates": 0,
                "invalid": 0,
                "duplicateDetails": []
            })

        now = datetime.utcnow().isoformat() + "Z"
        success_count = 0
        duplicate_count = 0
        invalid_count = 0
        docs_to_insert = []
        duplicate_details = []

        client, db, is_atlas = get_db()

        existing_docs = []
        if is_atlas:
            try:
                collection = db['addresses']
                all_ex = collection.find({})
                for ex in all_ex:
                    existing_docs.append(serialize_doc(ex))
            except Exception as e:
                print("Notice during batch dup pre-fetch:", e, file=sys.stderr)
        elif db and hasattr(db, 'records'):
            for r in db.records:
                existing_docs.append(serialize_doc(r))

        force_save = bool(payload.get('force') or payload.get('allow_duplicates') or payload.get('skipDuplicateCheck'))

        for item in items:
            name = (item.get('name') or '').strip()
            address_line_1 = (item.get('address_line_1') or item.get('addressLine1') or '').strip()
            district = (item.get('district') or '').strip()
            pincode = (item.get('pincode') or '').strip()
            phone = (item.get('phone') or '').strip()

            if not name or not address_line_1 or not district or not pincode or name == 'Contact Name':
                invalid_count += 1
                continue

            doc = {
                "u_id": (item.get('u_id') or item.get('code') or item.get('uId') or '').strip(),
                "name": name,
                "door_no": (item.get('door_no') or item.get('doorNo') or '').strip(),
                "address_line_1": address_line_1,
                "address_line_2": (item.get('address_line_2') or item.get('addressLine2') or '').strip(),
                "area": (item.get('area') or '').strip(),
                "city": (item.get('city') or '').strip(),
                "district": district,
                "state": (item.get('state') or 'Tamil Nadu').strip(),
                "country": (item.get('country') or 'India').strip(),
                "pincode": pincode,
                "phone": phone,
                "landmark": (item.get('landmark') or '').strip(),
                "notes": (item.get('notes') or '').strip(),
                "subscription": bool(item.get('subscription')),
                "subscription_date": (item.get('subscription_date') or '').strip(),
                "subscription_time": (item.get('subscription_time') or '').strip(),
                "subscription_amount": item.get('subscription_amount') if item.get('subscription_amount') is not None else 500,
                "created_at": now,
                "updated_at": now
            }

            if not force_save:
                name_lower = name.lower()
                matching_existing = None

                for ex in existing_docs:
                    ex_name = (ex.get('name') or '').strip().lower()
                    ex_phone = (ex.get('phone') or '').strip()
                    ex_pin = (ex.get('pincode') or '').strip()
                    ex_addr1 = (ex.get('address_line_1') or '').strip().lower()

                    if ex_name == name_lower:
                        if phone and ex_phone and phone == ex_phone:
                            matching_existing = ex
                            break
                        if pincode and ex_pin and pincode == ex_pin:
                            matching_existing = ex
                            break
                        if address_line_1 and ex_addr1 and (address_line_1.lower() in ex_addr1 or ex_addr1 in address_line_1.lower()):
                            matching_existing = ex
                            break

                if matching_existing:
                    duplicate_count += 1
                    duplicate_details.append({
                        "importedItem": doc,
                        "existingAddress": matching_existing
                    })
                    continue

                existing_docs.append(doc)
            
            docs_to_insert.append(doc)

        if docs_to_insert:
            if is_atlas:
                collection = db['addresses']
                
                # 1. Deduplicate within the incoming batch by u_id (case-insensitive)
                unique_batch = []
                seen_batch_uids = {}
                for doc in docs_to_insert:
                    uid_key = (doc.get('u_id') or '').strip().lower()
                    if uid_key:
                        if uid_key in seen_batch_uids:
                            # Replace earlier doc in same batch with latest
                            unique_batch[seen_batch_uids[uid_key]] = doc
                        else:
                            seen_batch_uids[uid_key] = len(unique_batch)
                            unique_batch.append(doc)
                    else:
                        unique_batch.append(doc)

                # 2. Insert or update existing database records by u_id
                for doc in unique_batch:
                    uid = (doc.get('u_id') or '').strip()
                    if uid:
                        existing = collection.find_one({
                            "u_id": re.compile(f"^{escape_regex(uid)}$", re.IGNORECASE)
                        })
                        if existing:
                            doc_update = dict(doc)
                            doc_update['updated_at'] = now
                            collection.update_one(
                                {"_id": existing['_id']},
                                {"$set": doc_update}
                            )
                            success_count += 1
                            continue

                    res = collection.insert_one(doc)
                    if res.inserted_id:
                        success_count += 1
            else:
                for doc in docs_to_insert:
                    uid = (doc.get('u_id') or '').strip().lower()
                    if uid:
                        match_idx = -1
                        for idx, r in enumerate(db.records):
                            if (r.get('u_id') or '').strip().lower() == uid:
                                match_idx = idx
                                break
                        if match_idx != -1:
                            db.records[match_idx] = {
                                **doc,
                                '_id': db.records[match_idx].get('_id', f"mock_id_{int(time.time()*1000)}"),
                                'updated_at': now
                            }
                            success_count += 1
                            continue

                    doc['_id'] = f"mock_id_{int(time.time()*1000)}_{len(db.records)}"
                    db.records.insert(0, doc)
                    success_count += 1

        return json_response(200, {
            "totalProcessed": len(items),
            "success": success_count,
            "duplicates": duplicate_count,
            "invalid": invalid_count,
            "duplicateDetails": duplicate_details
        })

    except Exception as err:
        err_msg = str(err).encode('utf-8', errors='replace').decode('utf-8')
        print("Error in import_addresses handler:", err_msg, file=sys.stderr)
        return json_response(500, {"error": f"Import Error: {err_msg}"})

