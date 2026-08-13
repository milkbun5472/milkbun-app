#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("supabase/migrations-manifest.json", "utf8"));
const disk = readdirSync("supabase").filter(x => x.endsWith(".sql")).sort();
const listed = Object.keys(manifest.migrations || {}).sort();
const missing = disk.filter(x => !listed.includes(x));
const stale = listed.filter(x => !disk.includes(x));
const bad = listed.filter(x => !["applied", "unknown", "test", "audit", "retired"].includes(manifest.migrations[x].status));
if (missing.length || stale.length || bad.length) {
  console.error([missing.length ? "untracked SQL: " + missing.join(", ") : "", stale.length ? "missing SQL: " + stale.join(", ") : "", bad.length ? "invalid status: " + bad.join(", ") : ""].filter(Boolean).join("\n"));
  process.exit(1);
}
console.log(`Supabase manifest OK: ${listed.length} SQL files; unknown migrations remain blocked pending verification.`);
