"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cloud = fs.readFileSync(path.join(__dirname, "../js/cloud.js"), "utf8");

test("App→CC 长票正文存 content，metadata 只保留小型路由字段", () => {
  const start = cloud.indexOf("async yanqiuCcToolEnqueue");
  const end = cloud.indexOf("async yanqiuCcToolResult", start);
  const segment = cloud.slice(start, end);
  assert.match(segment, /content:\s*payloadText/);
  assert.match(segment, /payload_storage:\s*"content_json"/);
  assert.doesNotMatch(segment, /metadata:\s*\{[\s\S]*arguments:/);
  assert.match(segment, /payloadText\.length\s*>\s*15500/);
});
