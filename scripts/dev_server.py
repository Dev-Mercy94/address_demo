import os
import sys
import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import importlib

# Add netlify/functions to search path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNCTIONS_DIR = os.path.join(BASE_DIR, 'netlify', 'functions')
if FUNCTIONS_DIR not in sys.path:
    sys.path.insert(0, FUNCTIONS_DIR)

# Pre-load database connection so it stays warm and fast across all requests
try:
    import db
    db.get_db()
    print("[dev_server] MongoDB connection pool pre-warmed.", file=sys.stderr)
except Exception as e:
    print(f"[dev_server] Warning pre-warming db: {e}", file=sys.stderr)

MODULE_CACHE = {}

def get_function_module(name):
    norm_name = name.replace('-', '_')
    if norm_name == 'import':
        norm_name = 'import_addresses'
    
    if norm_name in MODULE_CACHE:
        return MODULE_CACHE[norm_name]
    
    try:
        mod = importlib.import_module(norm_name)
        MODULE_CACHE[norm_name] = mod
        return mod
    except Exception as e:
        print(f"[dev_server] Error loading module {norm_name}: {e}", file=sys.stderr)
        return None

class APIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Keep dev console clean unless error
        if args and str(args[0]).startswith(('4', '5')):
            sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format%args))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        self.handle_api_request('GET')

    def do_POST(self):
        self.handle_api_request('POST')

    def do_PUT(self):
        self.handle_api_request('PUT')

    def do_DELETE(self):
        self.handle_api_request('DELETE')

    def handle_api_request(self, method):
        parsed_url = urllib.parse.urlparse(self.path)
        raw_path = parsed_url.path
        
        func_name = raw_path \
            .replace('/.netlify/functions/', '') \
            .replace('/api/', '') \
            .replace('/api', '') \
            .strip('/') \
            .split('/')[0] or 'addresses'

        # Parse query params
        raw_query = urllib.parse.parse_qs(parsed_url.query, keep_blank_values=True)
        query_params = {k: v[0] if len(v) == 1 else v for k, v in raw_query.items()}

        # Read body if present
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8', errors='replace') if content_length > 0 else None

        event = {
            'httpMethod': method,
            'path': raw_path,
            'queryStringParameters': query_params,
            'headers': dict(self.headers),
            'body': body
        }

        mod = get_function_module(func_name)
        if not mod or not hasattr(mod, 'handler'):
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Function {func_name} not found"}).encode('utf-8'))
            return

        try:
            result = mod.handler(event, {})
            status_code = result.get('statusCode', 200)
            headers = result.get('headers', {})
            body_res = result.get('body', '')

            self.send_response(status_code)
            has_cors = False
            for k, v in headers.items():
                if k.lower() == 'access-control-allow-origin':
                    has_cors = True
                self.send_header(k, str(v))
            
            if not has_cors:
                self.send_header('Access-Control-Allow-Origin', '*')

            self.end_headers()
            
            if isinstance(body_res, str):
                self.wfile.write(body_res.encode('utf-8'))
            elif isinstance(body_res, bytes):
                self.wfile.write(body_res)
            else:
                self.wfile.write(json.dumps(body_res).encode('utf-8'))

        except Exception as e:
            print(f"[dev_server] Exception executing {func_name}: {e}", file=sys.stderr)
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

def run_server(port=5055):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, APIHandler)
    print(f"[dev_server] API server listening on http://127.0.0.1:{port}", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5055
    run_server(port)
