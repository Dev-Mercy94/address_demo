from db import get_db, serialize_doc, json_response, handle_cors_preflight, ObjectId

def handler(event, context):
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method != 'GET':
        return json_response(405, {"error": "Method not allowed"})

    try:
        query_params = event.get('queryStringParameters') or {}
        address_id = query_params.get('id')
        
        if not address_id:
            # Check path if passed in URL like /addresses/:id
            raw_path = event.get('path', '')
            parts = [p for p in raw_path.split('/') if p]
            if len(parts) > 0 and parts[-1] not in ['address', 'addresses']:
                address_id = parts[-1]

        if not address_id:
            return json_response(400, {"error": "Address ID parameter is required"})

        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            query = {"_id": ObjectId(address_id)} if ObjectId.is_valid(address_id) else {"_id": address_id}
            address = collection.find_one(query)
            if not address:
                return json_response(404, {"error": "Address not found"})
            return json_response(200, serialize_doc(address))
        else:
            address = next((r for r in db.records if str(r.get('_id')) == str(address_id)), None)
            if not address:
                return json_response(404, {"error": "Address not found"})
            return json_response(200, address)

    except Exception as err:
        print("Error in address handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
