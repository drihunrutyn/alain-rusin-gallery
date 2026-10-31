"""Deploy tracked source from private GitHub to Deno Deploy v2; no third-party packages."""
import base64
import json
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[3]
token = os.environ["DENO_DEPLOY_TOKEN"]
app = os.environ["DENO_APP_ID"]
database = os.environ["DENO_DATABASE_INSTANCE"]
files = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
assets = {}
for name in files:
    if not name or name.startswith(".git/") or name == ".env" or name.startswith(".env.") and name != ".env.example":
        continue
    path = root / name
    if not path.is_file():
        continue
    assets[name] = {"kind": "file", "encoding": "base64", "content": base64.b64encode(path.read_bytes()).decode()}
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
payload = {
    "assets": assets,
    "labels": {"custom.sha": sha, "custom.source": "github"},
    "production": {"databases": [{"instance": database, "name": "alain-rusin-production"}]},
    "preview": {"databases": [{"instance": database, "name": "alain-rusin-preview"}]},
}
request = urllib.request.Request(f"https://api.deno.com/v2/apps/{app}/deploy", data=json.dumps(payload).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(request, timeout=180) as response:
        revision = json.load(response)
except urllib.error.HTTPError as error:
    print("Deno Deploy rejected the request with HTTP", error.code)
    raise SystemExit(1)
print("Deno revision submitted:", revision["id"], "status:", revision["status"])
print("Check Deno build logs before treating this as a successful deployment.")
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("revision=" + revision["id"] + "\n")