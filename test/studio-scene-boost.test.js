// 她 2026-10-16：线下生图比照相馆好看（场景加成）→「做个开关吧」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("照相馆场景加成：开关开着才写画面、带地点和场景图；题材换画风漫画不加", () => {
  const i = app.indexOf("const studioShoot = async"), j = app.indexOf("const out = await generateSelfieImage(", i);
  assert.ok(i > 0 && j > i, "抠不出 studioShoot");
  const f = app.slice(i, j);
  assert.match(f, /const boost = !!\(opt && opt\.expand\) && !theme && !\(opt && \(opt\.restyle \|\| opt\.comic\)\);/);
  assert.match(f, /RESTYLE_LINE \+ sceneShot \+/);
  assert.match(f, /if \(wRefS && !firstRef\) refs\.push\(wRefS\.img\);/);
  assert.match(f, /maxTokens: 65000/);
  assert.match(scr, /paint, expand \}\)/);
  assert.match(scr, /saveJSON\("x_studioExpand", v\)/);
});
