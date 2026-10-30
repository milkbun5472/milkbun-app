// 群友 2026-10-30：「表情包那块可以给 char 画表情包，能不能加上可以画小U自己的表情包」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
test("画我自己那一套：挑有参考照的面具 → 同一套九宫格 → 存进「面具名 的表情」", () => {
  assert.match(app, /if \(String\(charId \|\| ""\)\.indexOf\("__me:"\) === 0\) return makeMyEmoteSet\(String\(charId\)\.slice\(5\), setOpt\);/);
  assert.match(app, /if \(!me\.refPhoto\) \{ toast\("先在「我的面具」里给这张面具传一张参考照，脸才锁得住"\); return; \}/);
  assert.match(app, /generateSelfieImage\(prompt, \[me\.refPhoto\]/);
  assert.match(app, /charIds: charId && !_meM \? \[charId\] : _meM \?/, "她自己那组贴的是认这张面具的人，不是 charId");
  assert.match(app, /myFaces: \[\{ id: "", name:/);
  assert.match(ui, /myFaces\.filter\(f => f\.ok\)\.map\(f => h\("button", \{ key: "me_" \+ \(f\.id \|\| "main"\), "data-wk": "emomyface", onClick: \(\) => \{ setSetPick\(false\); onMakeSet\("__me:" \+ f\.id/);
  assert.match(ui, /"data-wk": "emomyface"[^\n]*\n[^\n]*minHeight: 40/);
});

// 她 2026-10-30：「他们知道是我吧」——角色只收到「[表情] 关键词」，原来不知道画的是她
test("照她的脸画的表情：存时打标记，她发出去角色收到「画的是她自己」", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(app, /\.\.\.\(_meM \? \{ selfFace: true \} : \{\}\) \};/);
  assert.equal((comp.match(/content: "\[表情\] " \+ em\.keyword \+ \(em\.selfFace \? "（画的是她自己）" : ""\)/g) || []).length, 2, "单聊、群聊两处");
});

// 她 2026-10-30「能给他们用吧」：她那一套默认给认这张面具的人用；角色那边单独说「画的是她」，不算进「你的专属」
test("她自己的表情：默认给认这张面具的人，提示词里单独一行、不混进他的专属", () => {
  assert.match(app, /_meM \? \(characters \|\| \[\]\)\.filter\(x => x && !x\.npc && String\(maskKeyOf\(x\.id\) \|\| ""\) === String\(_meK \|\| ""\)\)\.map\(x => x\.id\)/);
  assert.match(app, /【她自己的表情】（照她本人画的 Q 版小人，表情里那个人是她；你也能发）/);
  assert.match(app, /String\(pk\.fromCharFace \|\| ""\)\.indexOf\("__me:"\) !== 0 && \(pk\.charIds \|\| \[\]\)\.includes\(charId\)/, "不算进他的专属");
});
