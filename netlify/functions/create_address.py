import json
import time
from datetime import datetime
from db import get_db, serialize_doc, json_response, handle_cors_preflight

def handler(event, context):
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method != 'POST':
        return json_response(405, {"error": "Method not allowed"})

    try:
        body_raw = event.get('body') or '{}'
        try:
            data = json.loads(body_raw)
        except Exception:
            return json_response(400, {"error": "Invalid JSON request body"})

        name = (data.get('name') or '').strip()
        address_line_1 = (data.get('address_line_1') or '').strip()
        district = (data.get('district') or '').strip()
        pincode = (data.get('pincode') or '').strip()

        if not name or not address_line_1 or not district or not pincode:
            return json_response(400, {"error": "Name, Address Line 1, District, and Pincode are required fields."})

        now = datetime.utcnow().isoformat() + "Z"
        new_doc = {
            "u_id": (data.get('u_id') or data.get('code') or '').strip(),
            "name": name,
            "door_no": (data.get('door_no') or '').strip(),
            "address_line_1": address_line_1,
            "address_line_2": (data.get('address_line_2') or '').strip(),
            "area": (data.get('area') or '').strip(),
            "city": (data.get('city') or '').strip(),
            "district": district,
            "state": (data.get('state') or 'Tamil Nadu').strip(),
            "country": (data.get('country') or 'India').strip(),
            "pincode": pincode,
            "phone": (data.get('phone') or '').strip(),
            "landmark": (data.get('landmark') or '').strip(),
            "notes": (data.get('notes') or '').strip(),
            "subscription": bool(data.get('subscription')),
            "subscription_date": (data.get('subscription_date') or '').strip(),
            "subscription_time": (data.get('subscription_time') or '').strip(),
            "subscription_amount": data.get('subscription_amount') if data.get('subscription_amount') is not None else 500,
            "created_at": now,
            "updated_at": now
        }

        client, db, is_atlas = get_db()
        u_id_val = new_doc.get('u_id')

        if u_id_val:
            if is_atlas:
                collection = db['addresses']
                existing_uid = collection.find_one({
                    "u_id": {"$regex": f"^{u_id_val}$", "$options": "i"}
                })
                if existing_uid:
                    return json_response(400, {"error": f"Address with U.ID '{u_id_val}' already exists. U.ID must be unique."})
            else:
                for r in db.records:
                    if (r.get('u_id') or '').strip().lower() == u_id_val.lower():
                        return json_response(400, {"error": f"Address with U.ID '{u_id_val}' already exists. U.ID must be unique."})

        if is_atlas:
            collection = db['addresses']
            res = collection.insert_one(new_doc)
            new_doc['_id'] = str(res.inserted_id)
            return json_response(201, serialize_doc(new_doc))
        else:
            new_doc['_id'] = f"mock_id_{int(time.time() * 1000)}"
            db.records.insert(0, new_doc)
            return json_response(201, new_doc)

    except Exception as err:
        print("Error in create_address handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
