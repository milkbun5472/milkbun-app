import fs from "node:fs";
const app = fs.readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*["']v([0-9.]+)["']/)?.[1];
const html = fs.readFileSync("index.html", "utf8"), manifest = fs.readFileSync("manifest.json", "utf8");
const seen = [...html.matchAll(/(?:app\.js|engine\.js|screens\.js|components\.js|manifest\.json)\?v=([0-9.]+)/g), ...manifest.matchAll(/launch=([0-9.]+)/g)].map(m => m[1]);
if (!app || seen.length < 6 || seen.some(v => v !== app)) { console.error(`Version mismatch: APP_VERSION=${app || "missing"}, refs=${seen.join(",")}`); process.exit(1); }
console.log(`Version check OK: v${app}`);
