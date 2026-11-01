// 查手机：心声不从半句切断；他开过的底部单子换页/看完时收起（2026-10-29 截图）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "peek-phone.js"), "utf8");
const a = src.indexOf("function clipThink("), b = src.indexOf("function closeSheets(");
const ctx = { S: v => String(v == null ? "" : v) }; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + ";this.clip = clipThink;", ctx);
test("短的原样，长的退到句末", () => {
  const short = "（你……你怎么能跟别人做这种事啊？！还叫得那么……难听死了！太不要脸了！大骗子！Lisa你到底把本少爷当成什么了？！一个随便的人吗）";
  assert.equal(ctx.clip(short), short);
  const long = "这句很长。".repeat(40);
  const out = ctx.clip(long);
  assert.ok(out.length <= 160 && /。$/.test(out));
});
test("open、back、看完都收单子；线下单子的收起键带 data-sheet-close", () => {
  assert.equal((src.match(/closeSheets\(\)/g) || []).length, 4);
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const o = comp.indexOf("function offSheet(");
  assert.match(comp.slice(o, o + 1500), /"data-sheet-close": "1"/);
});
