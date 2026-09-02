const fs = require("fs");
const assert = require("assert");

const src = fs.readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");

assert.match(src, /function isOocRecord\(m\)[\s\S]*?m\.kind === "ooc"[\s\S]*?indexOf\("ooc_"\)/,
  "渲染层应同时识别普通 OOC 与旧版 system OOC 回复");
assert.match(src, /isOocRecord\(m\)\) \? h\("button"[\s\S]*?onDeleteMessages\(\[i\]\)/,
  "单人线上 system OOC 回复应可删除");
assert.match(src, /function OffCard[\s\S]*?if \(m\.kind === "ooc"\)[\s\S]*?editable && onDelete[\s\S]*?onDelete\(m\.id\)/,
  "单人/群体线下 OOC 应通过消息 id 删除");

assert.doesNotMatch(src, /confirm\("删除这条 OOC 记录/,
  "OOC 小叉应直接删除，避免 iOS/PWA 吞掉原生 confirm 后看似无响应");
assert.match(src, /onDelete\(m\.id, msgIndex\)/,
  "线下旧记录应把当前下标作为缺失或失配 id 的删除兜底");

const appSrc = fs.readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
// ⚠️别冻形参名（v60.15 侧房隔离把它从 charId 改成 scopeKey，行为没变，这条却红了）
assert.match(appSrc, /offlineDelMsg = \(\w+, msgId, fallbackIndex\)[\s\S]{0,400}?Number\.isInteger\(fallbackIndex\)[\s\S]{0,300}?filter\(\(_, i\) => i !== idx\)/,
  "单人线下删除应在 id 无法命中时按当前下标兜底");
assert.match(appSrc, /groupOfflineDelMsg = \(\w+, msgId, fallbackIndex\)[\s\S]{0,400}?Number\.isInteger\(fallbackIndex\)[\s\S]{0,300}?filter\(\(_, i\) => i !== idx\)/,
  "群体线下删除应在 id 无法命中时按当前下标兜底");

console.log("ooc-delete-controls: ok");
