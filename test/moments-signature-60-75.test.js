// 朋友圈的签名和封面：从【查手机·微信】那份来，走 🌱 那一档，签名钉在头像下面。
// 她 2026-09-03：「现在朋友圈签名是跟着匿名信箱签名来的，改一下……然后签名固定在
// 头像下面，现在是会跟着朋友圈一起翻上去」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

test("签名和封面在 🌱 那一档：默认沿用，有理由才变；不许钉死也不许每次重写", () => {
  const m = phone.match(/const PHONE_EVOLVE = \{[\s\S]*?\n\};/);
  assert.ok(m, "找不到 PHONE_EVOLVE");
  assert.match(m[0], /"me\.signature"/);
  assert.match(m[0], /"me\.cover"/, "封面也得登记，否则每刷一次换一张");
  // 🔒 里绝不许出现它俩——钉死＝他这辈子只写过这一句签名
  const st = phone.match(/const PHONE_STICKY = \{[\s\S]*?\n\};/);
  assert.doesNotMatch(st[0], /signature|cover/);
});

test("查手机生成时真的问了这两栏，封面是文字描述不是图", () => {
  assert.match(phone, /\\"cover\\":\\"朋友圈封面的一句画面描述\\"/, "schemaHint 里要有 cover");
  assert.match(phone, /一句画面描述.*不是图片/, "要说清楚封面是描述不是图");
  // 只问 updates 那一路：签名封面基本不动，不写＝照旧
  assert.match(phone, /me 这一栏【基本不要动】/);
  assert.match(phone, /\*\*不写就是照旧\*\*/);
});

test("接到聊天这边的朋友圈：签名读微信那份，不再读匿名信箱", () => {
  assert.match(app, /\(\(\(\(phones\[momTarget\.id\] \|\| \{\}\)\.wechat \|\| \{\}\)\.me \|\| \{\}\)\.signature\)/);
  assert.match(app, /coverText: \(momTarget && !momTarget\.isMe\)/);
  // 匿名信箱那份只剩兜底，不能还是第一顺位
  const line = app.slice(app.indexOf("signature: (momTarget && momTarget.isMe)"), app.indexOf("coverText:"));
  assert.ok(line.indexOf("wechat") < line.indexOf("anon"), "微信那份要排在匿名箱前面");
});

test("签名钉在头像下面，不跟着朋友圈一起翻上去", () => {
  const seg = comp.slice(comp.indexOf("function MomentsProfile"), comp.indexOf("function VoiceEarComposer"));
  const iSign = seg.indexOf('sign ? h("div", { className: "shrink-0"');
  const iScroll = seg.indexOf('className: "flex-1 min-h-0 overflow-y-auto"');
  assert.ok(iSign > 0, "签名那一块要是 shrink-0（不滚的那一层）");
  assert.ok(iSign < iScroll, "签名必须排在滚动容器前面，否则还是会被翻上去");
  // 没设过图时用那句封面描述当封面
  assert.match(seg, /\(!cover && coverText\)/);
});
