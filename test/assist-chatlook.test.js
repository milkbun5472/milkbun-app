// 秋秋能改这一个人聊天窗的 CSS 和排版（她 2026-09-30：「如果我跟它提我要啥，所有挂点它都能改了吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const asst = R("js/assistant.js"), eng = R("js/engine.js"), app = R("js/app.js");

test("两个新写入口：chatcss 走 ThemeStudio 洗、chatlayout 走公共那道洗；app 两处都接上", () => {
  assert.match(asst, /chatcss: \{/);
  assert.match(asst, /const bad = ts\.unsafeReason\(css\); if \(bad\) throw new Error\(bad\);/);
  assert.match(asst, /ctx\.onPatchChatSetting\(id, \{ customCSS: css \}\)/);
  assert.match(asst, /chatlayout: \{/);
  assert.match(asst, /sanitizeChatLayoutPatch\(obj, known\)/);
  assert.equal((app.match(/onPatchChatSetting: \(charId, patch\) => patchChatSetting\(charId, patch\)/g) || []).length, 2);
  assert.match(asst, /p\.target === "chatlayout" \|\| p\.target === "grouplayout"\) throw new Error\("排版这一栏要整份给/);
});
test("排版那道洗：只收那几档，编的门牌和怪值都丢", () => {
  const body = eng.slice(eng.indexOf("function sanitizeChatLayoutPatch"), eng.indexOf("// OOC 改旧准则"));
  const f = new Function(body + "\nreturn sanitizeChatLayoutPatch;")();
  const o = f({ bubble: "plain", avatar: "weird", top: 999, name: 1, deco: { ta: { frame: "iv_fake", pend: "https://x.com/w.png", pendPos: "tl", frameSize: 500 } } }, []);
  assert.equal(o.bubble, "plain"); assert.equal(o.avatar, undefined); assert.equal(o.top, 240); assert.equal(o.name, true);
  assert.equal(o.deco.ta.frame, undefined, "编出来的门牌要挡掉"); assert.equal(o.deco.ta.pend, "https://x.com/w.png"); assert.equal(o.deco.ta.frameSize, 200);
});
test("气泡透明度秋秋也能调；提示词里告诉它新挂点和尺寸变量", () => {
  assert.match(eng, /if \(obj\.myAlpha != null\) num\("myAlpha", 0, 100\);/);
  assert.match(asst, /data-first／data-last/);
  assert.match(asst, /var\(--app-h\)/);
});

test("能发图给秋秋：两处输入栏共用一颗，图只跟着这一句发给模型、记录里只留缩略图", () => {
  assert.match(asst, /function AssistAttach\(\{ pic, setPic, small, toast \}\)/);
  assert.equal((asst.match(/h\(AssistAttach, \{ pic: pic, setPic: setPic/g) || []).length, 2, "整页和小悬浮屏都要有");
  assert.match(asst, /imageDataUrls: img \? \[img\] : undefined/);
  assert.match(asst, /pic: pic && !isFile \? pic\.thumb : undefined/);
  assert.match(asst, /A\.ask\(act, ctx, before, q, isFile \? pic : \(pic \? pic\.full : null\)\)/);
  assert.match(asst, /if \(\(!q && !pic\) \|\| A\.isBusy\(\)\) return;/, "只发图不写字也要发得出去");
});

test("秋秋也能改某一个群：groupcss / grouplayout，快照里看得见群和现在的排版、CSS", () => {
  assert.match(asst, /groupcss: \{/);
  assert.match(asst, /grouplayout: \{/);
  assert.match(asst, /ctx\.onPatchGroupSetting\(id, \{ customCSS: css \}\)/);
  assert.match(asst, /if \(!\(ctx\.groups \|\| \[\]\)\.some\(g => g && g\.id === id\)\) throw new Error\("没有这个群："/);
  assert.equal((app.match(/onPatchGroupSetting: \(gid, patch\) => saveGroupSettings\(gid, patch\)/g) || []).length, 2);
  assert.match(asst, /return \{ 角色: chars, 群: groups,/);
  assert.match(asst, /row\.聊天窗CSS = /);
});
