from datetime import datetime, timedelta
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
            total_addresses = collection.count_documents({})
            
            district_list = collection.distinct('district')
            pincode_list = collection.distinct('pincode')

            date_24h_ago = (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"
            recently_added = collection.count_documents({"created_at": {"$gte": date_24h_ago}})
            recently_updated = collection.count_documents({"updated_at": {"$gte": date_24h_ago}})

            district_agg = list(collection.aggregate([
                {"$group": {"_id": "$district", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 8}
            ]))

            top_districts = [{"district": d.get('_id') or 'Unspecified', "count": d.get('count', 0)} for d in district_agg]

            return json_response(200, {
                "totalAddresses": total_addresses,
                "totalDistricts": len(district_list),
                "totalPincodes": len(pincode_list),
                "recentlyAdded": recently_added,
                "recentlyUpdated": recently_updated,
                "topDistricts": top_districts,
                "isAtlas": True
            })
        else:
            stats_data = db.get_stats()
            district_map = {}
            for r in db.records:
                d = r.get('district')
                if d:
                    district_map[d] = district_map.get(d, 0) + 1
            top_districts = [{"district": k, "count": v} for k, v in sorted(district_map.items(), key=lambda x: x[1], reverse=True)[:8]]

            return json_response(200, {
                **stats_data,
                "topDistricts": top_districts,
                "isAtlas": False
            })

    except Exception as err:
        print("Error in stats handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
