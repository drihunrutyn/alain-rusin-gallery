"""Deploy source and integrity-checked Node build to Deno Deploy v2."""
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
marker = root / "packages/web/dist-edge/prebuilt.json"
if not marker.is_file():
    raise SystemExit("Missing verified Node build; run the build and --seal first")
for directory in (root / "packages/web/dist", root / "packages/web/dist-edge"):
    files.extend(str(path.relative_to(root)) for path in directory.rglob("*") if path.is_file())
assets = {}
for name in files:
    if not name or name.startswith(".git/") or name == ".env" or name.startswith(".env.") and name != ".env.example":
        continue
    path = root / name
    if path.is_file():
        assets[name] = {"kind": "file", "encoding": "base64", "content": base64.b64encode(path.read_bytes()).decode()}
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
payload = {
    "assets": assets,
    "labels": {"custom.sha": sha, "custom.source": "github"},
    "production": {"databases": [{"instance": database, "name": "alain-rusin-production"}]},
    "preview": {"databases": [{"instance": database, "name": "alain-rusin-preview"}]},
}
def request(path, data=None):
    return urllib.request.Request("https://api.deno.com/v2/" + path, data=data,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(request(f"apps/{app}/deploy", json.dumps(payload).encode()), timeout=180) as response:
        revision = json.load(response)
except urllib.error.HTTPError as error:
    print("Deno Deploy rejected the request with HTTP", error.code)
    raise SystemExit(1)
print("Deno revision submitted:", revision["id"], "status:", revision["status"], flush=True)
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("revision=" + revision["id"] + "\n")
progress = request(f"revisions/{revision['id']}/progress")
progress.add_header("Accept", "application/x-ndjson")
with urllib.request.urlopen(progress, timeout=480) as response:
    for line in response:
        if line.strip():
            stages = json.loads(line)
            print("Build:", {name: value.get("status") for name, value in stages.items() if isinstance(value, dict)}, flush=True)
with urllib.request.urlopen(request(f"revisions/{revision['id']}"), timeout=60) as response:
    final = json.load(response)
print("Final Deno status:", final["status"], flush=True)
if final["status"] != "succeeded":
    print("Inspect Deno build logs; previous successful revision stays live.")
    raise SystemExit(1)