from db import get_db, json_response, handle_cors_preflight

def handler(event, context):
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method != 'GET':
        return json_response(405, {"error": "Method not allowed"})

    try:
        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            agg = list(collection.aggregate([
                {"$group": {"_id": "$pincode", "district": {"$first": "$district"}, "city": {"$first": "$city"}, "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 100}
            ]))

            res = [{"pincode": p.get('_id') or 'Unknown', "district": p.get('district'), "city": p.get('city'), "count": p.get('count', 0)} for p in agg]
            return json_response(200, res)
        else:
            pincode_map = {}
            for r in db.records:
                key = r.get('pincode') or 'Unknown'
                if key not in pincode_map:
                    pincode_map[key] = {"pincode": key, "district": r.get('district'), "city": r.get('city'), "count": 0}
                pincode_map[key]["count"] += 1

            result = sorted(pincode_map.values(), key=lambda x: x["count"], reverse=True)[:100]
            return json_response(200, result)

    except Exception as err:
        print("Error in pincodes handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
