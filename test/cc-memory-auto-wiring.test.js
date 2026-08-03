const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync(require.resolve("../js/app.js"),"utf8");
const html=fs.readFileSync(require.resolve("../index.html"),"utf8");

test("CC 自动记忆复用正式抽取器且不另写旁路记忆",()=>{
  assert.match(html,/cc-memory-auto\.js/);
  assert.match(app,/extractAndAddForChar\(charId, plan\.messages/);
  assert.match(app,/MemoryExtractionGate/);
  assert.match(app,/MemoryNearDuplicate/);
});

test("只有抽取成功才提交 ledgerKey，失败保留待重试",()=>{
  const start=app.indexOf("const runCcAutoMemory");
  const block=app.slice(start,start+1800);
  assert.ok(block.indexOf("await extractAndAddForChar") < block.indexOf("CcMemoryAuto.commit"));
  assert.match(block,/CcMemoryAuto\.fail/);
});

test("无新云行时仍检查本地积压，刷新后不会漏批次",()=>{
  const empty=app.indexOf("if (!rows.length)");
  assert.ok(empty>=0);
  assert.match(app.slice(empty,empty+700),/await runCcAutoMemory/);
});
