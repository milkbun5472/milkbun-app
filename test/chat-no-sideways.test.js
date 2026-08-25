const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 她 2026-08-25：「我翻的时候还会往右跑」——截图里整列气泡左移、头像被切掉半个，
// 也就是聊天列表被横向滚了出去。聊天列表【永远】不该横着滚。

test("两个聊天列表都锁死横向", () => {
  const rows = comp.split("\n");
  const scrollers = rows
    .map((l, n) => ({ l, n: n + 1 }))
    .filter(x => /className: "flex-1 overflow-y-auto px-4 py-4 space-y-[12]"/.test(x.l));
  assert.equal(scrollers.length, 2, "单聊 + 群聊两个消息列表");
  scrollers.forEach(x => {
    const near = rows.slice(x.n - 4, x.n).join("\n");
    // ① 就算里面真有比容器宽的东西也滚不出去
    assert.match(near, /overflowX: "hidden"/, "第 " + x.n + " 行的列表没锁 overflow-x");
    // ② 这条才是治「翻的时候往右跑」的：只接竖向拖动，手指斜一点也不会被当成横移
    assert.match(near, /touchAction: "pan-y pinch-zoom"/, "第 " + x.n + " 行的列表没锁 touch-action");
  });
});

test("留着 pinch-zoom，别把缩放一起禁了", () => {
  assert.doesNotMatch(comp, /touchAction: "pan-y"[^ ]/, "光写 pan-y 会顺手禁掉双指缩放");
});

// 成因那一类也要堵：flex 子项默认 min-width:auto，不肯缩到内容最小宽度以下。
// 里面只要有个更宽的东西（语音条 minWidth 208、照片 maxWidth 260、长链接不断行…）
// 就会把整行撑出去，列表于是能横着滚。
test("气泡那一列要 minWidth:0，别被内容撑出去", () => {
  const hits = [...comp.matchAll(/alignItems: isU \? "flex-end" : "flex-start",\n\s*maxWidth: "72%",\n\s*minWidth: 0/g)];
  assert.equal(hits.length, 2, "单聊 + 群聊的气泡列都要有");
});
