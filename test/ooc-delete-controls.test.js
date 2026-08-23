const fs = require("fs");
const assert = require("assert");

const src = fs.readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");

assert.match(src, /function isOocRecord\(m\)[\s\S]*?m\.kind === "ooc"[\s\S]*?indexOf\("ooc_"\)/,
  "渲染层应同时识别普通 OOC 与旧版 system OOC 回复");
assert.match(src, /isOocRecord\(m\)\) \? h\("button"[\s\S]*?onDeleteMessages\(\[i\]\)/,
  "单人线上 system OOC 回复应可删除");
assert.match(src, /function OffCard[\s\S]*?if \(m\.kind === "ooc"\)[\s\S]*?editable && onDelete[\s\S]*?onDelete\(m\.id\)/,
  "单人/群体线下 OOC 应通过消息 id 删除");

const oocDeleteLabels = (src.match(/删除这条 OOC 记录/g) || []).length;
assert.ok(oocDeleteLabels >= 4, "四类 OOC 展示路径都应提供删除操作");

console.log("ooc-delete-controls: ok");
