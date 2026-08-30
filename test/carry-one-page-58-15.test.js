const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-08-30：「保留柜子，刷新出来内容在同一个界面显示，上下滑动看其他的，
// 只不过点击哪一格可以优先跳转到那里」
test("点哪一格进的都是同一页，只是先滚到那一栏", () => {
  assert.match(screens, /function CarryAll\(props\)/);
  assert.match(screens, /if \(open\) return h\(CarryAll, \{/, "还在一格一页");
  assert.match(screens, /scrollTo: open, onBack: \(\) => setOpen\(null\)/);
  // 跳转靠 offsetTop，不是靠重新挂载
  const i = screens.indexOf("function CarryAll(props)");
  const seg = screens.slice(i, i + 4200);
  assert.match(seg, /sc\.scrollTop = Math\.max\(0, el\.offsetTop - 8\)/);
  // ⚠️挂载那一帧下面几栏还没高度，只滚一次等于没滚
  assert.match(seg, /const a = setTimeout\(go, 60\), b = setTimeout\(go, 260\);/);
  assert.match(seg, /return \(\) => \{ clearTimeout\(a\); clearTimeout\(b\); \};/, "定时器要清掉");
  // 顶上那排小标签点了也跳
  assert.match(seg, /onClick: \(\) => \{ const el = secRefs\.current\[x\.key\], sc = scRef\.current;/);
});

test("每一栏的内容仍然由 CarrySection 画，没有第二份渲染", () => {
  const i = screens.indexOf("function CarryAll(props)");
  const seg = screens.slice(i, i + 4200);
  assert.match(seg, /h\(CarrySection, \{\n\s*embedded: true, char, sectionKey: x\.key/);
  // 嵌入模式：外壳/皮肤/标题栏都由整页画，这里只交内容 + 自己那两个弹层
  assert.match(screens, /if \(embedded\) return h\(React\.Fragment, null, content, sheetNode, giftNode\);/);
  assert.match(screens, /function CarrySection\(\{ char, sectionKey, data, gifts, busyKey, giftBusy, pinned, onTogglePin, onPeek, onGen, onGenGiftThought, onBack, embedded \}\)/);
  // 弹层得是 fixed：嵌进滚动容器之后，absolute 要看祖先链上谁碰巧是 positioned
  assert.match(screens, /className: "fixed inset-0 flex items-center justify-center z-50 px-6"/);
  assert.doesNotMatch(screens, /className: "absolute inset-0 flex items-center justify-center z-50 px-6"/);
});

test("整页只生成一次，不是五个嵌入块各触发一次", () => {
  // ⚠️嵌入模式不许再走「打开就自己生成」——五块各来一次就又回到一栏一刀了
  assert.match(screens, /if \(embedded \|\| isGifts \|\| data\) return;/);
  const i = screens.indexOf("function CarryAll(props)");
  const seg = screens.slice(i, i + 4200);
  assert.match(seg, /const empty = CARRY_SECTIONS\.filter\(x => !x\.gifts\)\.every\(x => !data\[x\.key\]\);/);
  assert.match(seg, /if \(empty && !busyKey && typeof onGenAll === "function"\) onGenAll\(char\);/,
    "整页该走一次调用那条（onGenAll），不是 onGen");
  // 右上角那个刷新也是整页一次
  assert.match(seg, /onClick: \(\) => onGenAll\(char\), disabled: !!busyKey, "aria-label": "全部重新翻一遍"/);
});

test("合成一页之后只有一张皮，靠小标题分栏而不是靠换底色", () => {
  const i = screens.indexOf("function CarryAll(props)");
  const seg = screens.slice(i, i + 4200);
  assert.equal((seg.match(/pageSkin\(/g) || []).length, 1, "整页只该有一张皮；一栏一张就成了色带");
  assert.match(seg, /style: pageSkin\("cloth", t, \{ tint: CARRY_TINT\.bag, word: "CARRY" \}\)/);
  // 分栏靠这一栏自己的色相 + 一条渐隐的线
  assert.match(seg, /color: carryTint\(x\.key, \.95\)/);
  assert.match(seg, /background: "linear-gradient\(90deg," \+ carryTint\(x\.key, \.3\) \+ ",rgba\(0,0,0,0\)\)"/);
  // 没礼物的时候不摆一个空栏
  assert.match(seg, /const secs = CARRY_SECTIONS\.filter\(x => !x\.gifts \|\| \(gifts \|\| \[\]\)\.length\);/);
});
