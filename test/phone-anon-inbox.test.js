// 查手机里的匿名信箱必须和主 App 共用 x_anon；不能只摆图标，也不能另生成一套假问答。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("匿名信箱进了查手机注册表、桌面和全屏路由", () => {
  assert.match(phone, /key: "anon",\s*zh: "匿名信箱"/);
  assert.match(phone, /const PHONE_LIVE_KEYS = \[[^\]]*"anon"[^\]]*\]/);
  assert.match(phone, /const FULL_BLEED_KEYS = \[[^\]]*"anon"[^\]]*\]/);
  assert.match(phone, /if \(key === "anon"\) return h\(AnonBox, \{/);
  assert.match(phone, /onClose: ctx\.onBack/);
});

test("匿名信箱只读 x_anon 真数据，问答、刷新和删除都接回原处理器", () => {
  assert.match(app, /anonFor: cid => \(anon \|\| \{\}\)\[cid\] \|\| \{\}/);
  assert.match(app, /onRefreshAnonPersona: refreshAnonPersona/);
  assert.match(app, /onGenAnonQuestion: genNetizenQ/);
  assert.match(app, /onAskAnon: askAnon/);
  assert.match(app, /onDelAnonRecord: delAnonRecord/);
  assert.match(phone, /anon: anonFor \? anonFor\(char\.id\) : \{\}/);
  assert.match(phone, /onAskAnon: q => onAskAnon && onAskAnon\(char, q\)/);
  assert.match(phone, /onDelAnonRecord: ts => onDelAnonRecord && onDelAnonRecord\(char\.id, ts\)/);
});

test("匿名信箱没有进入全刷模型管线，首次点开只补同一份马甲", () => {
  assert.match(app, /PHONE_APPS\.filter\(a => !a\.soon && PHONE_LIVE_KEYS\.indexOf\(a\.key\) < 0\)/);
  assert.match(phone, /a\.key === "anon" && !\(liveCtx\.anon \|\| \{\}\)\.netname/);
  assert.match(phone, /onRefreshAnonPersona\(char\)/);
});

test("匿名信箱复用既有全屏安全区、独立滚动和返回按钮", () => {
  const block = components.match(/function AnonBox\([\s\S]*?\nfunction /)?.[0] || "";
  assert.match(block, /className: "absolute inset-0 z-\[70\] flex flex-col"/);
  assert.match(block, /paddingTop: "env\(safe-area-inset-top\)"/);
  assert.match(block, /className: "flex-1 overflow-y-auto relative"/);
  assert.match(block, /onClick: onClose/);
});
