import os
import sys
import re
import json
import time
from datetime import datetime
try:
    from bson import ObjectId
except ImportError:
    class ObjectId:
        def __init__(self, val=None):
            self.val = str(val) if val else ""
        def __str__(self):
            return str(self.val)
        def __repr__(self):
            return f"ObjectId('{self.val}')"
        def __eq__(self, other):
            return str(self) == str(other)

try:
    from pymongo import MongoClient, ReturnDocument, ASCENDING, DESCENDING
except ImportError:
    MongoClient = None
    ReturnDocument = None
    ASCENDING = 1
    DESCENDING = -1

_cached_client = None
_cached_db = None
_mock_store = None

def sanitize_unicode(obj):
    if isinstance(obj, str):
        return obj.encode('utf-8', errors='replace').decode('utf-8')
    elif isinstance(obj, dict):
        return {sanitize_unicode(k): sanitize_unicode(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_unicode(item) for item in obj]
    return obj

def get_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Content-Type": "application/json"
    }

def handle_cors_preflight():
    return {
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": ""
    }

def json_response(status_code, data):
    sanitized_data = sanitize_unicode(data)
    return {
        "statusCode": status_code,
        "headers": get_cors_headers(),
        "body": json.dumps(sanitized_data, default=str)
    }

def get_db():
    global _cached_client, _cached_db, _mock_store

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

    mongodb_uri = os.environ.get("MONGODB_URI")
    db_name = os.environ.get("MONGODB_DATABASE") or os.environ.get("MONGODB_DB_NAME") or "address_management_db"

    if mongodb_uri and mongodb_uri.startswith("mongodb"):
        if _cached_client and _cached_db is not None:
            return _cached_client, _cached_db, True

        try:
            client = MongoClient(
                mongodb_uri,
                connectTimeoutMS=5000,
                socketTimeoutMS=20000,
                serverSelectionTimeoutMS=4000,
                maxPoolSize=50,
                minPoolSize=5
            )
            db = client[db_name]
            _cached_client = client
            _cached_db = db
            
            try:
                ensure_indexes(db)
            except Exception as e:
                print("Index creation notice:", e, file=sys.stderr)

            return client, db, True
        except Exception as err:
            print("MongoDB Atlas Connection error:", err, file=sys.stderr)

    if _mock_store is None:
        _mock_store = generate_mock_dataset(10)
    return None, _mock_store, False

def ensure_indexes(db):
    try:
        collection = db["addresses"]
        collection.create_index([("u_id", 1)])
        collection.create_index([("name", 1)])
        collection.create_index([("pincode", 1)])
        collection.create_index([("district", 1)])
        collection.create_index([("city", 1)])
        collection.create_index([("phone", 1)])
        collection.create_index([("subscription", 1)])
        collection.create_index([("created_at", -1)])
        collection.create_index([("district", 1), ("pincode", 1), ("name", 1)])
    except Exception as err:
        pass

    try:
        dates_col = db["important_dates"]
        dates_col.create_index([("type", 1)])
        dates_col.create_index([("date", 1)])
        dates_col.create_index([("name", 1)])
        dates_col.create_index([("address_id", 1)])
        dates_col.create_index([("created_at", -1)])
    except Exception as err:
        pass

def serialize_doc(doc):
    if not doc:
        return None
    if isinstance(doc, dict):
        res = {}
        for k, v in doc.items():
            if k == '_id':
                res['_id'] = str(v)
            elif isinstance(v, datetime):
                res[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, dict):
                res[k] = serialize_doc(v)
            elif isinstance(v, list):
                res[k] = [serialize_doc(item) for item in v]
            else:
                res[k] = v
        return res
    elif isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    return doc

def escape_regex(text):
    if not text:
        return ""
    return re.escape(text.strip())

class MockStore:
    def __init__(self, records, important_dates=None):
        self.records = records
        self.important_dates = important_dates if important_dates is not None else []

    def get_stats(self):
        districts = set(r.get('district') for r in self.records if r.get('district'))
        pincodes = set(r.get('pincode') for r in self.records if r.get('pincode'))
        return {
            "totalAddresses": len(self.records),
            "totalDistricts": len(districts),
            "totalPincodes": len(pincodes),
            "recentlyAdded": min(len(self.records), 120),
            "recentlyUpdated": min(len(self.records), 45)
        }

def generate_mock_dataset(count):
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
    records = []
    for i in range(1, count + 1):
        d_obj = districts_data[i % len(districts_data)]
        fn = first_names[i % len(first_names)]
        ln = last_names[(i * 7) % len(last_names)]
        door_no = f"{(i % 120) + 1}/{(i % 5) + 1}"
        area = d_obj["areas"][i % len(d_obj["areas"])]
        records.append({
            "_id": f"mock_id_{i}",
            "u_id": f"T-{(i):04d}",
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
            "subscription": (i % 2 == 1),
            "subscription_date": "31-Aug-2026" if (i % 2 == 1) else "",
            "subscription_time": f"{(10 + (i % 3)):02d}:{(15 + (i * 7) % 40):02d} AM" if (i % 2 == 1) else "",
            "subscription_amount": 500 if (i % 2 == 1) else 0,
            "created_at": now,
            "updated_at": now
        })

    mock_dates = [
        {
            "_id": "mock_date_1",
            "address_id": "mock_id_1",
            "name": "Arun Kumar",
            "phone": "9876543210",
            "type": "wedding",
            "date": "2015-09-12",
            "notes": "11th Wedding Anniversary",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_2",
            "address_id": "mock_id_2",
            "name": "Priya Raman",
            "phone": "9876543211",
            "type": "shop_opening",
            "date": "2020-09-18",
            "notes": "Boutique Anniversary",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_3",
            "address_id": "mock_id_3",
            "name": "Ramesh Patel",
            "phone": "9876543212",
            "type": "death",
            "date": "2018-09-25",
            "notes": "Memorial Anniversary",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_4",
            "address_id": "mock_id_4",
            "name": "Arun Kumar",
            "phone": "9876543210",
            "type": "birthday",
            "date": "1984-09-05",
            "notes": "42nd Birthday",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_5",
            "address_id": "mock_id_5",
            "name": "Priya Raman",
            "phone": "9876543211",
            "type": "birthday",
            "date": "1991-09-12",
            "notes": "35th Birthday",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_6",
            "address_id": "mock_id_6",
            "name": "Suresh Iyer",
            "phone": "9876543213",
            "type": "birthday",
            "date": "1975-09-20",
            "notes": "51st Birthday",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": "mock_date_7",
            "address_id": "mock_id_7",
            "name": "Karthik Reddy",
            "phone": "9876543214",
            "type": "business_anniversary",
            "date": "2019-09-03",
            "notes": "Tech Venture 7th Year",
            "created_at": now,
            "updated_at": now
        }
    ]
    return MockStore(records, mock_dates)

