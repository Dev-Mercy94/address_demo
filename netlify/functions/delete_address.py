from db import get_db, json_response, handle_cors_preflight, ObjectId

def handler(event, context):
    method = event.get('httpMethod', 'DELETE')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method not in ['DELETE', 'POST']:
        return json_response(405, {"error": "Method not allowed"})

    try:
        query_params = event.get('queryStringParameters') or {}
        address_id = query_params.get('id')

        if not address_id:
            raw_path = event.get('path', '')
            parts = [p for p in raw_path.split('/') if p]
            if len(parts) > 0 and parts[-1] not in ['delete_address', 'delete-address']:
                address_id = parts[-1]

        if not address_id:
            return json_response(400, {"error": "Address ID parameter is required for deletion"})

        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            query = {"_id": ObjectId(address_id)} if ObjectId.is_valid(address_id) else {"_id": address_id}
            res = collection.delete_one(query)

            if res.deleted_count == 0:
                return json_response(404, {"error": "Address not found"})

            return json_response(200, {"success": True, "id": address_id})
        else:
            idx = next((i for i, r in enumerate(db.records) if str(r.get('_id')) == str(address_id)), -1)
            if idx == -1:
                return json_response(404, {"error": "Address not found"})

            db.records.pop(idx)
            return json_response(200, {"success": True, "id": address_id})

    except Exception as err:
        print("Error in delete_address handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
