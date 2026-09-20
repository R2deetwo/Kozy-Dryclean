import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
for path in ("/v3/senders?limit=100", "/v3/senders/domains?limit=50", "/v3/domains?limit=50"):
    req = urllib.request.Request(f"https://api.brevo.com{path}", headers={"api-key": KEY, "accept": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req) as r:
            print(path, "->", json.dumps(json.load(r))[:900])
    except urllib.error.HTTPError as e:
        print(path, "-> HTTP", e.code, e.read().decode()[:200])
    print()
