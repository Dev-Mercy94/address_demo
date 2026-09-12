import json
from datetime import datetime
from db import get_db, json_response, handle_cors_preflight

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
            payload = {}

        count = int(payload.get('count', 10))
        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            if payload.get('clearExisting') is not False:
                collection.delete_many({})

            districts_data = [
                {"district": "Chennai", "state": "Tamil Nadu", "pincodes": ["600001", "600002", "600004", "600018", "600028"], "cities": ["Chennai"], "areas": ["Mylapore", "Anna Nagar", "T. Nagar", "Velachery", "Adyar"]},
                {"district": "Coimbatore", "state": "Tamil Nadu", "pincodes": ["641001", "641002", "641004"], "cities": ["Coimbatore"], "areas": ["RS Puram", "Gandhipuram", "Peelamedu"]},
                {"district": "Madurai", "state": "Tamil Nadu", "pincodes": ["625001", "625002", "625009"], "cities": ["Madurai"], "areas": ["KK Nagar", "Anna Nagar", "Tallakulam"]},
                {"district": "Tiruchirappalli", "state": "Tamil Nadu", "pincodes": ["620001", "620002", "620017"], "cities": ["Tiruchirappalli"], "areas": ["Thillai Nagar", "Cantonment", "Srirangam"]}
            ]
            first_names = ["Aarav", "Aditi", "Ajay", "Anand", "Arun", "Bala", "Deepak", "Dinesh", "Ganesh", "Karthik", "Kumar", "Lakshmi", "Meena", "Rajesh", "Sanjay", "Suresh", "Vijay", "Vikram"]
            last_names = ["Kumar", "Sharma", "Patel", "Subramanian", "Raman", "Narayanan", "Pillai", "Mudaliar", "Gounder", "Iyer", "Reddy"]
            streets = ["Main Street", "Cross Street", "Station Road", "Bazaar Street", "Temple Road", "Gandhi Road", "Nehru Salai"]
            
            now = datetime.utcnow().isoformat() + "Z"
            docs = []
            for i in range(1, count + 1):
                d_obj = districts_data[i % len(districts_data)]
                fn = first_names[i % len(first_names)]
                ln = last_names[(i * 7) % len(last_names)]
                door_no = f"{(i % 120) + 1}/{(i % 5) + 1}"
                area = d_obj["areas"][i % len(d_obj["areas"])]
                docs.append({
                    "name": f"{fn} {ln}",
                    "door_no": door_no,
                    "address_line_1": f"{door_no}, {streets[i % len(streets)]}",
                    "address_line_2": area,
                    "area": area,
                    "city": d_obj["cities"][i % len(d_obj["cities"])],
                    "district": d_obj["district"],
                    "state": d_obj["state"],
                    "country": "India",
                    "pincode": d_obj["pincodes"][i % len(d_obj["pincodes"])],
                    "phone": f"987{(1000000 + (i * 137) % 8999999)}",
                    "landmark": "Near Bus Stand",
                    "notes": "Verified Address" if i % 10 == 0 else "",
                    "created_at": now,
                    "updated_at": now
                })

            res = collection.insert_many(docs, ordered=False)
            return json_response(200, {"success": True, "totalInserted": len(res.inserted_ids), "isAtlas": True})
        else:
            return json_response(200, {"success": True, "totalInserted": len(db.records), "isAtlas": False})

    except Exception as err:
        print("Error in seed handler:", err)
        return json_response(500, {"error": "Internal Server Error"})
