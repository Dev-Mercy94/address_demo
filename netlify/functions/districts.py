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
                {"$group": {"_id": "$district", "state": {"$first": "$state"}, "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]))

            res = [{"district": d.get('_id') or 'Unknown', "state": d.get('state') or 'Tamil Nadu', "count": d.get('count', 0)} for d in agg]
            return json_response(200, res)
        else:
            district_map = {}
            for r in db.records:
                key = r.get('district') or 'Unknown'
                if key not in district_map:
                    district_map[key] = {"district": key, "state": r.get('state') or 'Tamil Nadu', "count": 0}
                district_map[key]["count"] += 1

            result = sorted(district_map.values(), key=lambda x: x["count"], reverse=True)
            return json_response(200, result)

    except Exception as err:
        print("Error in districts handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
