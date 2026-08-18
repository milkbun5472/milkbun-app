#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const snapshotFile = process.argv[2];
if (!snapshotFile) throw new Error("usage: migrate-storage.mjs <storage-bucket-snapshot.json>");
const oldKey = process.env.OLD_SERVICE_ROLE_KEY;
const newKey = process.env.NEW_SERVICE_ROLE_KEY;
if (!oldKey || !newKey) throw new Error("missing private service role key environment variables");

const bucket = JSON.parse(readFileSync(snapshotFile, "utf8"));
const oldBase = "https://nposjnafsbikwfeoudbg.supabase.co/storage/v1";
const newBase = "http://127.0.0.1:8800/storage/v1";
const auth = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });
const pathFor = (name) => name.split("/").map(encodeURIComponent).join("/");
const digest = (buf) => createHash("sha256").update(buf).digest("hex");

let count = 0;
let bytes = 0;
let stale = 0;
for (const object of bucket.objects || []) {
  const path = `${encodeURIComponent(bucket.id)}/${pathFor(object.name)}`;
  const source = await fetch(`${oldBase}/object/authenticated/${path}`, { headers: auth(oldKey) });
  if (source.status === 400 || source.status === 404) {
    const detail = await source.json().catch(() => ({}));
    if (detail.code === "NoSuchKey" || detail.statusCode === "404") {
      stale++;
      continue;
    }
  }
  if (!source.ok) throw new Error(`old storage read failed: ${source.status}`);
  const body = Buffer.from(await source.arrayBuffer());
  const contentType = source.headers.get("content-type") || object.metadata?.mimetype || "application/octet-stream";
  const put = await fetch(`${newBase}/object/${path}`, {
    method: "POST",
    headers: { ...auth(newKey), "Content-Type": contentType, "x-upsert": "true" },
    body
  });
  if (!put.ok) throw new Error(`new storage write failed: ${put.status}`);
  const check = await fetch(`${newBase}/object/authenticated/${path}`, { headers: auth(newKey) });
  if (!check.ok) throw new Error(`new storage verify read failed: ${check.status}`);
  const copied = Buffer.from(await check.arrayBuffer());
  if (body.length !== copied.length || digest(body) !== digest(copied)) {
    throw new Error("storage byte fingerprint mismatch");
  }
  count++;
  bytes += body.length;
}
console.log(JSON.stringify({ migrated_objects: count, verified_bytes: bytes, stale_metadata_rows: stale }));
