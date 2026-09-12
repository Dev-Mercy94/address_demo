import sys
import os
import json
import importlib

# Add netlify/functions directory to Python module search path
functions_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'netlify', 'functions')
if functions_dir not in sys.path:
    sys.path.insert(0, functions_dir)

def sanitize_unicode(obj):
    if isinstance(obj, str):
        return obj.encode('utf-8', errors='replace').decode('utf-8')
    elif isinstance(obj, dict):
        return {sanitize_unicode(k): sanitize_unicode(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_unicode(item) for item in obj]
    return obj

def main():
    if hasattr(sys.stdin, 'reconfigure'):
        try:
            sys.stdin.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    if len(sys.argv) < 2:
        res = {"statusCode": 400, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": "Function name required"})}
        print(json.dumps(res), file=sys.stdout)
        return

    func_name = sys.argv[1].replace('-', '_')
    if func_name == 'import':
        func_name = 'import_addresses'
    
    # Read event JSON from stdin
    stdin_content = sys.stdin.read()
    if isinstance(stdin_content, str):
        stdin_content = stdin_content.encode('utf-8', errors='replace').decode('utf-8')

    try:
        event = json.loads(stdin_content) if stdin_content else {}
        event = sanitize_unicode(event)
    except Exception:
        event = {}

    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        module = importlib.import_module(func_name)
        if not hasattr(module, 'handler'):
            res = {"statusCode": 500, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": f"Handler not found in module {func_name}"})}
            sys.stdout = real_stdout
            print(json.dumps(res, default=str), file=sys.stdout)
            return

        res = module.handler(event, {})
        res = sanitize_unicode(res)
        sys.stdout = real_stdout
        print(json.dumps(res, default=str), file=sys.stdout)
    except Exception as err:
        sys.stdout = real_stdout
        err_msg = str(err).encode('utf-8', errors='replace').decode('utf-8')
        res = {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Python serverless error: {err_msg}"})
        }
        print(json.dumps(res, default=str), file=sys.stdout)

if __name__ == '__main__':
    main()

