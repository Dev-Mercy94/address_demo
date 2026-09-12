import re
import json
from db import get_db, serialize_doc, escape_regex, json_response, handle_cors_preflight

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
        except Exception:
            return json_response(400, {"error": "Invalid JSON request body"})

        u_id = (payload.get('u_id') or '').strip()
        name = (payload.get('name') or '').strip()
        phone = (payload.get('phone') or '').strip()
        pincode = (payload.get('pincode') or '').strip()
        address_line_1 = (payload.get('address_line_1') or '').strip()

        if not name and not phone and not u_id:
            return json_response(200, {"duplicateFound": False})

        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            query_conditions = []

            if u_id:
                query_conditions.append({
                    "u_id": re.compile(f"^{escape_regex(u_id)}$", re.IGNORECASE)
                })

            if phone and len(phone) >= 10:
                query_conditions.append({
                    "phone": phone
                })

            if name and phone:
                query_conditions.append({
                    "name": re.compile(f"^{escape_regex(name)}$", re.IGNORECASE),
                    "phone": phone
                })
            
            if name and pincode and address_line_1:
                query_conditions.append({
                    "name": re.compile(f"^{escape_regex(name)}$", re.IGNORECASE),
                    "pincode": pincode,
                    "address_line_1": re.compile(escape_regex(address_line_1), re.IGNORECASE)
                })
            elif name and pincode:
                query_conditions.append({
                    "name": re.compile(f"^{escape_regex(name)}$", re.IGNORECASE),
                    "pincode": pincode
                })

            if query_conditions:
                match = collection.find_one({"$or": query_conditions})
                if match:
                    return json_response(200, {
                        "duplicateFound": True,
                        "existingAddress": serialize_doc(match)
                    })
        else:
            name_lower = name.lower()
            u_id_lower = u_id.lower() if u_id else ''
            match = None
            for r in db.records:
                r_uid = (r.get('u_id') or '').lower()
                r_name = (r.get('name') or '').lower()
                r_phone = (r.get('phone') or '').strip()
                r_pin = (r.get('pincode') or '').strip()
                r_addr = (r.get('address_line_1') or '').lower()

                if u_id_lower and r_uid == u_id_lower:
                    match = r
                    break
                if phone and len(phone) >= 10 and r_phone == phone:
                    match = r
                    break
                if name_lower and r_name == name_lower:
                    if phone and r_phone == phone:
                        match = r
                        break
                    if pincode and r_pin == pincode:
                        match = r
                        break
                    if address_line_1 and address_line_1.lower() in r_addr:
                        match = r
                        break
            if match:
                return json_response(200, {"duplicateFound": True, "existingAddress": match})

        return json_response(200, {"duplicateFound": False})

    except Exception as err:
        print("Error in check_duplicate handler:", err)
        return json_response(500, {"error": "Internal Server Error"})

