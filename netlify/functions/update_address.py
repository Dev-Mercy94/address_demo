import json
from datetime import datetime
from db import get_db, serialize_doc, json_response, handle_cors_preflight, ObjectId, ReturnDocument

def handler(event, context):
    method = event.get('httpMethod', 'PUT')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method not in ['PUT', 'POST']:
        return json_response(405, {"error": "Method not allowed"})

    try:
        query_params = event.get('queryStringParameters') or {}
        address_id = query_params.get('id')
        
        body_raw = event.get('body') or '{}'
        try:
            updates = json.loads(body_raw)
        except Exception:
            return json_response(400, {"error": "Invalid JSON request body"})

        if not address_id:
            address_id = updates.get('_id') or updates.get('id')

        if not address_id:
            raw_path = event.get('path', '')
            parts = [p for p in raw_path.split('/') if p]
            if len(parts) > 0 and parts[-1] not in ['update_address', 'update-address']:
                address_id = parts[-1]

        if not address_id:
            return json_response(400, {"error": "Address ID parameter is required for update"})

        now = datetime.utcnow().isoformat() + "Z"

        if '_id' in updates:
            del updates['_id']
        if 'created_at' in updates:
            del updates['created_at']

        updates['updated_at'] = now

        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            query = {"_id": ObjectId(address_id)} if ObjectId.is_valid(address_id) else {"_id": address_id}
            
            result = collection.find_one_and_update(
                query,
                {"$set": updates},
                return_document=ReturnDocument.AFTER
            )

            if not result:
                return json_response(404, {"error": "Address not found"})

            return json_response(200, serialize_doc(result))
        else:
            record = next((r for r in db.records if str(r.get('_id')) == str(address_id)), None)
            if not record:
                return json_response(404, {"error": "Address not found"})

            record.update(updates)
            record['updated_at'] = now
            return json_response(200, record)

    except Exception as err:
        print("Error in update_address handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
