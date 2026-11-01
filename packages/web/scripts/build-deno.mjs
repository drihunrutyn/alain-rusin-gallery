import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const marker = resolve(root, "packages/web/dist-edge/prebuilt.json");
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
if (typeof globalThis.Deno !== "undefined" && existsSync(marker) && !process.argv.includes("--seal")) {
  const manifest = JSON.parse(readFileSync(marker, "utf8"));
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (!name.startsWith("packages/web/dist/") && !name.startsWith("packages/web/dist-edge/"))
      throw new Error("Invalid prebuilt path");
    if (name.split("/").includes("..") || hash(resolve(root, name)) !== expected)
      throw new Error(`Prebuilt integrity check failed: ${name}`);
  }
  if (!manifest.files["packages/web/dist/index.html"] || !manifest.files["packages/web/dist-edge/server.js"])
    throw new Error("Incomplete prebuilt deployment");
  console.log("Verified Node-built frontend and Deno server; no Vite build needed in Deno.");
} else if (process.argv.includes("--seal")) {
  const files = Object.fromEntries(
    ["packages/web/dist", "packages/web/dist-edge"].flatMap((dir) => walk(resolve(root, dir)))
      .filter((file) => file !== marker)
      .sort().map((file) => [relative(root, file).replaceAll("\\", "/"), hash(file)])
  );
  writeFileSync(marker, JSON.stringify({ files }));
  console.log(`Sealed ${Object.keys(files).length} build files for Deno.`);
} else {
  for (const args of [["run", "build", "--workspace", "@template/web"], ["run", "build:edge"]]) {
    const result = spawnSync("npm", args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}