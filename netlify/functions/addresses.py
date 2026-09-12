import re
import math
import sys
from db import get_db, serialize_doc, escape_regex, json_response, handle_cors_preflight, ASCENDING, DESCENDING

# District name map (English <-> Tamil)
DISTRICT_TRANSLATION_MAP = {
    'Ariyalur': 'அரியலூர்',
    'Chengalpattu': 'செங்கல்பட்டு',
    'Chennai': 'சென்னை',
    'Coimbatore': 'கோயம்புத்தூர்',
    'Cuddalore': 'கடலூர்',
    'Dharmapuri': 'தர்மபுரி',
    'Dindigul': 'திண்டுக்கல்',
    'Erode': 'ஈரோடு',
    'Kallakurichi': 'கள்ளக்குறிச்சி',
    'Kanchipuram': 'காஞ்சீபுரம்',
    'Kanyakumari': 'கன்னியாகுமரி',
    'Karur': 'கரூர்',
    'Krishnagiri': 'கிருஷ்ணகிரி',
    'Madurai': 'மதுரை',
    'Mayiladuthurai': 'மயிலாடுதுறை',
    'Nagapattinam': 'நாகப்பட்டினம்',
    'Namakkal': 'நாமக்கல்',
    'Nilgiris': 'நீலகிரி',
    'Perambalur': 'பெரம்பலூர்',
    'Pudukkottai': 'புதுக்கோட்டை',
    'Ramanathapuram': 'இராமநாதபுரம்',
    'Ranipet': 'ராணிப்பேட்டை',
    'Salem': 'சேலம்',
    'Sivaganga': 'சிவகங்கை',
    'Tenkasi': 'தென்காசி',
    'Thanjavur': 'தஞ்சாவூர்',
    'Theni': 'தேனி',
    'Thoothukudi': 'தூத்துக்குடி',
    'Tiruchirappalli': 'திருச்சிராப்பள்ளி',
    'Tirunelveli': 'திருநெல்வேலி',
    'Tirupathur': 'திருப்பத்தூர்',
    'Tiruppur': 'திருப்பூர்',
    'Tiruvallur': 'திருவள்ளூர்',
    'Tiruvannamalai': 'திருவண்ணாமலை',
    'Tiruvarur': 'திருவாரூர்',
    'Vellore': 'வேலூர்',
    'Viluppuram': 'விழுப்புரம்',
    'Virudhunagar': 'விருதுநகர்'
}

def handler(event, context):
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return handle_cors_preflight()

    if method != 'GET':
        return json_response(405, {"error": "Method not allowed"})

    try:
        query_params = event.get('queryStringParameters') or {}
        page = max(1, int(query_params.get('page', 1)))
        limit = min(max(1, int(query_params.get('limit', 50))), 500)
        skip = (page - 1) * limit

        u_id = (query_params.get('u_id') or query_params.get('uId') or '').strip()
        search = (query_params.get('search') or '').strip()
        district = (query_params.get('district') or '').strip()
        city = (query_params.get('city') or '').strip()
        area = (query_params.get('area') or '').strip()
        pincode = (query_params.get('pincode') or '').strip()
        street = (query_params.get('street') or '').strip()
        alphabet = (query_params.get('alphabet') or '').strip()
        sort = query_params.get('sort') or 'name_asc'

        client, db, is_atlas = get_db()

        if is_atlas:
            collection = db['addresses']
            match_conditions = {}

            if u_id:
                match_conditions['u_id'] = re.compile(escape_regex(u_id), re.IGNORECASE)

            if search:
                s_regex = re.compile(escape_regex(search), re.IGNORECASE)
                match_conditions['$or'] = [
                    {'u_id': s_regex},
                    {'name': s_regex},
                    {'door_no': s_regex},
                    {'address_line_1': s_regex},
                    {'address_line_2': s_regex},
                    {'area': s_regex},
                    {'city': s_regex},
                    {'district': s_regex},
                    {'pincode': s_regex},
                    {'phone': s_regex}
                ]

            if district and district != 'ALL':
                ta_dist = DISTRICT_TRANSLATION_MAP.get(district, district)
                dist_regex = re.compile(f"^({escape_regex(district)}|{escape_regex(ta_dist)})", re.IGNORECASE)
                match_conditions['district'] = dist_regex

            if city:
                match_conditions['city'] = re.compile(escape_regex(city), re.IGNORECASE)

            if area:
                ar_regex = re.compile(escape_regex(area), re.IGNORECASE)
                if '$and' not in match_conditions:
                    match_conditions['$and'] = []
                match_conditions['$and'].append({
                    '$or': [
                        {'area': ar_regex},
                        {'address_line_1': ar_regex},
                        {'address_line_2': ar_regex}
                    ]
                })

            if pincode:
                match_conditions['pincode'] = re.compile(f"^{escape_regex(pincode)}", re.IGNORECASE)

            if street:
                st_regex = re.compile(escape_regex(street), re.IGNORECASE)
                if '$and' not in match_conditions:
                    match_conditions['$and'] = []
                match_conditions['$and'].append({
                    '$or': [
                        {'address_line_1': st_regex},
                        {'address_line_2': st_regex},
                        {'area': st_regex}
                    ]
                })

            if alphabet and alphabet != 'ALL':
                match_conditions['name'] = re.compile(f"^{escape_regex(alphabet)}", re.IGNORECASE)

            # Sort options
            sort_option = [('name', ASCENDING)]
            if sort == 'name_desc':
                sort_option = [('name', DESCENDING)]
            elif sort == 'pincode_asc':
                sort_option = [('pincode', ASCENDING), ('name', ASCENDING)]
            elif sort == 'pincode_desc':
                sort_option = [('pincode', DESCENDING), ('name', ASCENDING)]
            elif sort == 'created_desc':
                sort_option = [('created_at', DESCENDING)]
            elif sort == 'updated_desc':
                sort_option = [('updated_at', DESCENDING)]

            if len(match_conditions) == 0:
                total = collection.estimated_document_count()
            else:
                total = collection.count_documents(match_conditions)

            cursor = collection.find(match_conditions).sort(sort_option).skip(skip).limit(limit)
            raw_items = list(cursor)
            serialized_items = serialize_doc(raw_items) or []

            total_pages = math.ceil(total / limit) if total > 0 else 1

            return json_response(200, {
                "success": True,
                "data": serialized_items,
                "addresses": serialized_items,
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": total_pages
            })
        else:
            # Fallback for local memory store
            filtered = list(db.records)

            if search:
                s = search.lower()
                filtered = [r for r in filtered if
                    s in (r.get('name') or '').lower() or
                    s in (r.get('door_no') or '').lower() or
                    s in (r.get('address_line_1') or '').lower() or
                    s in (r.get('area') or '').lower() or
                    s in (r.get('city') or '').lower() or
                    s in (r.get('district') or '').lower() or
                    s in (r.get('pincode') or '').lower() or
                    s in (r.get('phone') or '').lower()
                ]

            if district and district != 'ALL':
                ta_dist = DISTRICT_TRANSLATION_MAP.get(district, district)
                filtered = [r for r in filtered if
                    r.get('district') == district or
                    r.get('district') == ta_dist or
                    (r.get('district') or '').lower() == district.lower()
                ]

            if city:
                ci = city.lower()
                filtered = [r for r in filtered if ci in (r.get('city') or '').lower()]

            if area:
                ar = area.lower()
                filtered = [r for r in filtered if
                    ar in (r.get('area') or '').lower() or
                    ar in (r.get('address_line_1') or '').lower() or
                    ar in (r.get('address_line_2') or '').lower()
                ]

            if pincode:
                filtered = [r for r in filtered if (r.get('pincode') or '').startswith(pincode)]

            if street:
                st = street.lower()
                filtered = [r for r in filtered if
                    st in (r.get('address_line_1') or '').lower() or
                    st in (r.get('address_line_2') or '').lower() or
                    st in (r.get('area') or '').lower()
                ]

            if alphabet and alphabet != 'ALL':
                filtered = [r for r in filtered if (r.get('name') or '').lower().startswith(alphabet.lower())]

            if sort == 'name_asc':
                filtered.sort(key=lambda x: (x.get('name') or '').lower())
            elif sort == 'name_desc':
                filtered.sort(key=lambda x: (x.get('name') or '').lower(), reverse=True)
            elif sort == 'pincode_asc':
                filtered.sort(key=lambda x: (x.get('pincode') or '', (x.get('name') or '').lower()))
            elif sort == 'pincode_desc':
                filtered.sort(key=lambda x: (x.get('pincode') or '', (x.get('name') or '').lower()), reverse=True)
            elif sort == 'created_desc':
                filtered.sort(key=lambda x: x.get('created_at') or '', reverse=True)
            elif sort == 'updated_desc':
                filtered.sort(key=lambda x: x.get('updated_at') or '', reverse=True)

            total = len(filtered)
            page_items = filtered[skip:skip + limit]
            total_pages = math.ceil(total / limit) if total > 0 else 1

            return json_response(200, {
                "success": True,
                "data": page_items,
                "addresses": page_items,
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": total_pages
            })

    except Exception as err:
        print("Error in addresses handler:", err, file=sys.stderr)
        return json_response(500, {"error": "Internal Server Error"})
