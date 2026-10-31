// 他发出去的照片，下一轮把实际画面给他看；照片仓的图也能读（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
test("expandMessageImages 认照片仓的图", () => {
  const a = eng.indexOf("async function expandMessageImages"), b = eng.slice(a, a + 2500);
  assert.match(b, /else if \(typeof idbImgGet === "function"\) \{/);
});
test("只给他最近那一轮发的照片，挂到紧跟着的她的消息上，写明是他自己发的", () => {
  assert.match(app, /m\.kind === "selfie" && m\.imgKey && !m\.failed && !m\.pending && \(m\.turnId \? m\.turnId === _lastTurn : m === _lastTurn\)\) _ownPicNext = m\.imgKey;/);
  assert.match(app, /_imageRefs: \[_own, _uRef\]\.filter\(Boolean\)/);
  assert.match(app, /是你上一轮自己发出去的那张照片实际生成出来的样子/);
});
test("她的自拍也给他看（自拍存在 imgKey 上）", () => {
  assert.match(app, /m\.imageRef \|\| \(m\.kind === "selfie" \? m\.imgKey : null\)/);
});
