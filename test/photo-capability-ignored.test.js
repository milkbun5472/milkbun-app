const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 她 2026-08-22 自己试出来的：「有个中转站的模型怎么催都不发图，换别的直接能发」。
// 这层失败以前完全静默——photo 能力确实给了模型，模型就是不吐那个字段，
// 她只看到角色打哈哈，分不清是「他不想拍」还是「这个模型不认这个能力」，只能一个个换着试。

test("要了却没拍时会说出来，并指向真正的病根", () => {
  assert.match(app, /if \(!photoScene && canSelfie && !photoCooldown\.cooling\) \{/);
  assert.match(app, /不是他不肯，是这个聊天模型没吐 photo 字段/);
  assert.match(app, /去 设置·API 换一个模型多半立刻就发/, "要给出下一步，不然说了也没用");
});

test("只在她真的开口要过时才提示", () => {
  assert.match(app, /PHOTO_REQUEST_RE\.test\(String\(m\.content \|\| ""\)\)/);
  assert.match(app, /\.slice\(-4\)\.filter\(m => m && m\.role === "user"\)/, "只看最近几轮她说的话");
});

test("连着两轮才提示：偶尔一轮不拍是人物反应，不是故障", () => {
  assert.match(app, /noPhotoStreakRef\.current\[charId\] === 2/);
  assert.match(app, /偶尔一轮他就是想逗你，那是人物反应，不该报错/);
  // 拍成了就清零，否则计数会一直累加、隔很久突然弹一句莫名其妙的提示
  assert.match(app, /\} else if \(photoScene\) noPhotoStreakRef\.current\[charId\] = 0;/);
  assert.match(app, /const noPhotoStreakRef = useRef\(\{\}\);/);
});

test("冷却轮不算数——那轮能力本来就没给模型，怪不到模型头上", () => {
  // canSelfie 已经含 !cooling，这里再显式排一次，读代码时一眼看得出前提
  assert.match(app, /!photoScene && canSelfie && !photoCooldown\.cooling/);
  assert.match(app, /const canSelfie = canSelfieBase && !photoCooldown\.cooling;/);
});
