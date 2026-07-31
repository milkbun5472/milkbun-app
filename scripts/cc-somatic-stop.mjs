#!/usr/bin/env node
// CC 言秋五感 v1 shadow：答后静默计算，不注入 prompt、不调用工具、不联网。
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extractLastTurn } = require("./cc-ledger-nature.cjs");
const { observeTurn } = require("./cc-somatic-shadow.cjs");

const input = await new Promise(resolve => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { body += chunk; });
  process.stdin.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); } });
});
const projectDir = String(input.cwd || process.env.CLAUDE_PROJECT_DIR || "/Users/lisa/Desktop/Lisa-phone");
try {
  const transcriptPath = String(input.transcript_path || "");
  if (!transcriptPath || !existsSync(transcriptPath)) throw new Error("transcript missing");
  const turn = extractLastTurn(readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean));
  observeTurn(projectDir, turn);
} catch (_) {}

// Stop hook 必须绝对静默：不写 stdout/stderr，不改变言秋的回复。
