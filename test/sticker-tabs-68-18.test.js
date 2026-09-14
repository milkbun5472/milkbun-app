// 她 2026-09-14：「聊天表情包能不能搞个分栏，按每一套可以单独一个 tab，
// 跟微信表情包栏差不多」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

test("发表情那一格只有一份：单聊和群聊都挂在 StickerPanel 上", () => {
  // ⚠️原来单聊和群聊各写了一份一模一样的四列网格——要分栏就得改两处，
  //   改一处必然漏一处（施工规则/one-public-mechanism.md）。
  assert.ok(comp.indexOf("function StickerPanel(") > 0, "没有公共那一份");
  assert.equal((comp.match(/h\(StickerPanel, \{/g) || []).length, 2, "两处聊天都要用它");
  assert.equal((comp.match(/setStickerOpen\(false\); \}, className: "active:opacity-70", style: \{ border/g) || []).length, 0,
    "旧的那份手写网格还留着一份");
  // 两处都得把分好组的那份递下去
  assert.equal((comp.match(/packs: emotePacks, emotes: emotes,/g) || []).length, 2);
  assert.equal((comp.match(/^  emotePacks,$/gm) || []).length, 2, "两个组件都要收这个 prop");
});

test("分组视图另给一份，拍平的那几个不许动", () => {
  // 选择器要分好组的；喂模型、按关键词找图要的还是那一长串——两边读同一份 x_emotePacks
  assert.match(app, /const emotePacksForChar = charId =>/);
  assert.match(app, /const emotePacksForGroup = memberIds =>/);
  assert.match(app, /emotePacks: emotePacksForChar\(activeChar\.id\)/);
  assert.match(app, /emotePacks: emotePacksForGroup\(activeGroup\.memberIds\)/);
  // 拍平那几个还在（v68.18 只是【另加】一份视图）
  assert.match(app, /const emotesForCharMine = charId =>/);
  assert.match(app, /const emotesForGroupMine = memberIds =>/);
  // 空包不摆一格空栏
  assert.match(app, /\.filter\(pk => pk\.emotes\.length\)/);
});

test("底下那排是封面，不是一排药丸；还记得上次停在哪一栏", () => {
  const seg = comp.slice(comp.indexOf("function StickerPanel("), comp.indexOf("function ConfirmDialog("));
  // 每一格摆那一套的第一张图（施工规则/tabs-not-plain-pills.md：认的是图不是字）
  assert.match(seg, /src: \(pk\.emotes\[0\] \|\| \{\}\)\.url/);
  assert.match(seg, /"aria-label": pk\.name/, "读屏要念得出这是哪一套");
  // 选中那一格：描边 + 底下一道线
  assert.match(seg, /boxShadow: on \? "inset 0 -2px 0 " \+ t\.tint : "none"/);
  // 上次停在哪一栏记在本机
  assert.match(seg, /localStorage\.setItem\("x_emoteTab", id\)/);
  // 最近用过：只存 id，不存图
  assert.match(seg, /const RECENT_KEY = "x_emoteRecent";/);
  assert.match(seg, /const next = \[em\.id\]\.concat\(recentIds\.filter\(x => x !== em\.id\)\)\.slice\(0, 16\);/);
  assert.ok(seg.indexOf("url: em.url, keyword: em.keyword, content") < 0, "最近用过那一栏把图也存了一份");
  // 只有一套时不摆那一排
  assert.match(seg, /tabs\.length > 1 \? h\("div"/);
});
