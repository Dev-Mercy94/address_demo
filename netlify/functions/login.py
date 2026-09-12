import os
import sys
import json
import time
import hashlib
import secrets
from datetime import datetime
from db import get_db, json_response, handle_cors_preflight, serialize_doc

def hash_password(password, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}${pw_hash}"

def verify_password(password, stored_hash):
    try:
        salt, pw_hash = stored_hash.split('$')
        computed_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
        return computed_hash == pw_hash
    except Exception:
        return False

def ensure_default_admin(db, is_atlas):
    try:
        if is_atlas:
            users_coll = db['users']
            users_coll.create_index([("username", 1)], unique=True)
            if users_coll.count_documents({}) == 0:
                default_user = {
                    "username": "admin",
                    "password_hash": hash_password("admin123"),
                    "name": "Administrator",
                    "role": "admin",
                    "created_at": datetime.utcnow().isoformat() + "Z"
                }
                users_coll.insert_one(default_user)
                print("Default admin account initialized in MongoDB users collection.", file=sys.stderr)
        else:
            if not hasattr(db, 'users') or not db.users:
                db.users = [{
                    "_id": "user_admin_1",
                    "username": "admin",
                    "password_hash": hash_password("admin123"),
                    "name": "Administrator",
                    "role": "admin",
                    "created_at": datetime.utcnow().isoformat() + "Z"
                }]
    except Exception as err:
        print("Notice while ensuring default admin:", err, file=sys.stderr)

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
            return json_response(400, {"error": "Invalid JSON request payload"})

        username = (payload.get('username') or '').strip().lower()
        password = payload.get('password') or ''

        if not username or not password:
            return json_response(400, {"error": "Username and password are required"})

        client, db, is_atlas = get_db()
        ensure_default_admin(db, is_atlas)

        user = None
        if is_atlas:
            users_coll = db['users']
            user = users_coll.find_one({"username": username})
        else:
            if hasattr(db, 'users'):
                user = next((u for u in db.users if u.get('username') == username), None)

        if not user:
            return json_response(401, {"error": "Invalid username or password"})

        stored_hash = user.get('password_hash', '')
        if not verify_password(password, stored_hash):
            return json_response(401, {"error": "Invalid username or password"})

        # Generate session auth token
        session_token = secrets.token_hex(24)
        user_data = {
            "id": str(user.get('_id')),
            "username": user.get('username'),
            "name": user.get('name', 'Administrator'),
            "role": user.get('role', 'admin'),
            "token": session_token,
            "loginTime": datetime.utcnow().isoformat() + "Z"
        }

        return json_response(200, {
            "success": True,
            "message": "Authentication successful",
            "token": session_token,
            "user": user_data
        })

    except Exception as err:
        print("Login handler error:", err, file=sys.stderr)
        return json_response(500, {"error": "Authentication server error"})
