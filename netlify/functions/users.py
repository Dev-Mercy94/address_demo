import os
import sys
import json
import time
import hashlib
import secrets
from datetime import datetime
from db import get_db, json_response, handle_cors_preflight, serialize_doc, ObjectId

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

def handler(event, context):
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    try:
        body_raw = event.get('body') or '{}'
        try:
            payload = json.loads(body_raw)
        except Exception:
            payload = {}

        action = payload.get('action') or (event.get('queryStringParameters') or {}).get('action') or 'get_profile'
        client, db, is_atlas = get_db()
        users_coll = db['users'] if is_atlas else None

        # 1. CREATE / REGISTER ADMIN USER
        if action in ['create', 'register', 'create_user']:
            username = (payload.get('username') or '').strip().lower()
            password = payload.get('password') or ''
            name = (payload.get('name') or 'Administrator').strip()
            role = (payload.get('role') or 'admin').strip()

            if not username or not password:
                return json_response(400, {"error": "Username and password are required"})

            if len(password) < 4:
                return json_response(400, {"error": "Password must be at least 4 characters"})

            now = datetime.utcnow().isoformat() + "Z"
            password_hash = hash_password(password)

            new_user = {
                "username": username,
                "password_hash": password_hash,
                "name": name,
                "role": role,
                "created_at": now,
                "updated_at": now
            }

            if is_atlas:
                existing = users_coll.find_one({"username": username})
                if existing:
                    return json_response(400, {"error": f"Username '{username}' already exists."})

                res = users_coll.insert_one(new_user)
                new_user['_id'] = str(res.inserted_id)
            else:
                if not hasattr(db, 'users'):
                    db.users = []
                if any(u.get('username') == username for u in db.users):
                    return json_response(400, {"error": f"Username '{username}' already exists."})
                new_user['_id'] = f"user_{int(time.time()*1000)}"
                db.users.append(new_user)

            session_token = secrets.token_hex(24)
            user_safe = {
                "id": str(new_user['_id']),
                "username": new_user['username'],
                "name": new_user['name'],
                "role": new_user['role'],
                "token": session_token
            }

            return json_response(201, {
                "success": True,
                "message": f"Admin user '{username}' created successfully!",
                "token": session_token,
                "user": user_safe
            })

        # 2. CHANGE PASSWORD
        elif action in ['change_password', 'update_password']:
            username = (payload.get('username') or '').strip().lower()
            current_password = payload.get('current_password') or payload.get('currentPassword') or ''
            new_password = payload.get('new_password') or payload.get('newPassword') or ''

            if not username:
                return json_response(400, {"error": "Username is required"})
            if not current_password or not new_password:
                return json_response(400, {"error": "Current password and new password are required"})
            if len(new_password) < 4:
                return json_response(400, {"error": "New password must be at least 4 characters"})

            user = None
            if is_atlas:
                user = users_coll.find_one({"username": username})
            else:
                if hasattr(db, 'users'):
                    user = next((u for u in db.users if u.get('username') == username), None)

            if not user:
                return json_response(404, {"error": "User account not found"})

            stored_hash = user.get('password_hash', '')
            if not verify_password(current_password, stored_hash):
                return json_response(400, {"error": "Current password is incorrect"})

            now = datetime.utcnow().isoformat() + "Z"
            new_hash = hash_password(new_password)

            if is_atlas:
                users_coll.update_one(
                    {"_id": user['_id']},
                    {"$set": {"password_hash": new_hash, "updated_at": now}}
                )
            else:
                user['password_hash'] = new_hash
                user['updated_at'] = now

            return json_response(200, {
                "success": True,
                "message": "Password changed and securely updated in database!"
            })

        # 3. UPDATE PROFILE DETAILS (NAME / USERNAME)
        elif action in ['update_profile', 'update']:
            current_username = (payload.get('current_username') or payload.get('currentUsername') or '').strip().lower()
            new_name = (payload.get('name') or '').strip()
            new_username = (payload.get('new_username') or payload.get('newUsername') or '').strip().lower()

            if not current_username:
                return json_response(400, {"error": "Current username is required"})

            user = None
            if is_atlas:
                user = users_coll.find_one({"username": current_username})
            else:
                if hasattr(db, 'users'):
                    user = next((u for u in db.users if u.get('username') == current_username), None)

            if not user:
                return json_response(404, {"error": "User account not found"})

            updates = {"updated_at": datetime.utcnow().isoformat() + "Z"}
            if new_name:
                updates['name'] = new_name
            if new_username and new_username != current_username:
                # Check duplicate
                if is_atlas:
                    if users_coll.find_one({"username": new_username}):
                        return json_response(400, {"error": f"Username '{new_username}' is already taken."})
                else:
                    if any(u.get('username') == new_username for u in db.users):
                        return json_response(400, {"error": f"Username '{new_username}' is already taken."})
                updates['username'] = new_username

            if is_atlas:
                users_coll.update_one({"_id": user['_id']}, {"$set": updates})
            else:
                user.update(updates)

            updated_user = {
                "id": str(user.get('_id')),
                "username": updates.get('username', user.get('username')),
                "name": updates.get('name', user.get('name')),
                "role": user.get('role', 'admin')
            }

            return json_response(200, {
                "success": True,
                "message": "Profile updated successfully!",
                "user": updated_user
            })

        else:
            return json_response(400, {"error": f"Unknown action: {action}"})

    except Exception as err:
        print("Users handler error:", err, file=sys.stderr)
        return json_response(500, {"error": f"User management error: {str(err)}"})
