#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const allowed = new Set(["KEY_DZZI", "KEY_ANTHROPIC", "KEY_SILICONFLOW"]);
const name = String(process.argv[2] || "");
if (!allowed.has(name)) throw new Error("unsupported secret name");

const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 16 * 1024) throw new Error("secret is unexpectedly large");
  chunks.push(chunk);
}
const value = Buffer.concat(chunks).toString("utf8").trim();
if (!value || /[\r\n]/.test(value)) throw new Error("secret is empty or contains a newline");

const file = new URL("./.env", import.meta.url);
const source = await readFile(file, "utf8");
const line = `${name}=${value}`;
const next = new RegExp(`^${name}=.*$`, "m").test(source)
  ? source.replace(new RegExp(`^${name}=.*$`, "m"), line)
  : `${source.replace(/\s*$/, "")}\n${line}\n`;
await writeFile(file, next, { mode: 0o600 });
console.log(`${name} stored; value was not printed`);
