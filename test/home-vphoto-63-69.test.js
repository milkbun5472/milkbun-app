// 她 2026-09-05：「做几个竖着的照片样式吧宝宝。然后你看图横着的边框离屏幕还有一段距离，
// 这个能不能缩小」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));

// ── 主屏左右那道留白 ─────────────────────────────────────────
test("留白只写一份：页壳、dock、一起听那条兜底，三处同一个数", () => {
  assert.match(comp, /const HOME_PAD_X = 12;/);
  // 页壳原来是 tailwind 的 px-5＝20，dock 是 px-4＝16——两边本来就没对齐
  const page = cut('return h("div", { key: pi,', "overscrollBehaviorY");
  assert.match(page, /paddingLeft: HOME_PAD_X, paddingRight: HOME_PAD_X/);
  assert.ok(page.indexOf("px-5") < 0, "页壳还挂着 px-5");
  const dock = cut('className: "relative shrink-0 pt-1"', "paddingBottom");
  assert.match(dock, /paddingLeft: HOME_PAD_X, paddingRight: HOME_PAD_X/);
  assert.ok(dock.indexOf("px-4") < 0, "dock 还挂着 px-4，跟组件那一排又对不齐了");
  // ⚠️一起听那张卡量不到自己宽度时靠这个数反推一格有多宽。写死在两处的话，
  //   改了这边那边就落单——而且不报错，只会让首帧的碟大一圈或小一圈。
  assert.match(comp, /window\.innerWidth : 390\) - HOME_PAD_X \* 2 - 8 \* 3/);
  assert.equal((bare(comp).match(/HOME_PAD_X/g) || []).length, 6, "又有人自己拼了一个留白");
});

// ── 三款竖照片 ──────────────────────────────────────────────
test("三款竖着的照片样式都在，格数对得上", () => {
  const seg = cut("const HOME_PHOTO_FRAMES = [", "\n];");
  assert.match(seg, /\{ id: "filmV4", name: "竖胶卷".*need: 4 \}/);
  assert.match(seg, /\{ id: "clipline3", name: "垂绳夹照".*need: 3 \}/);
  assert.match(seg, /\{ id: "tower4", name: "叠下来的一摞".*need: 4 \}/);
  // 挑样式那一页是整份铺开的，加了就选得到
  assert.match(comp, /HOME_PHOTO_FRAMES\.map\(function \(p\)/);
});

test("新建时自动挑竖格子——摆进横格子里这三种骨架就不成立了", () => {
  assert.match(comp, /const HOME_PHOTO_FRAMES_TALL = \{ filmV4: 1, clipline3: 1, tower4: 1 \};/);
  assert.match(comp, /HOME_PHOTO_FRAMES_TALL\[decorDraftFrame\] \? "column"/);
  // 原来那几款横的照旧走 wide / large，别顺手改坏
  assert.match(comp, /decorDraftFrame === "film3" \|\| decorDraftFrame === "slats5"/);
});

test("骨架真的是竖的，不是把横的换个名字", () => {
  const fv = cut('} else if (frame === "filmV4")', '} else if (frame === "clipline3")');
  // 齿孔竖着重复（180deg）。横胶卷那款是 90deg，照抄过来会变成一条横纹
  assert.match(fv, /repeating-linear-gradient\(180deg,#161513 0 9px/);
  assert.equal((fv.match(/repeating-linear-gradient\(180deg,rgba\(255,255,255,\.75\)/g) || []).length, 2, "两边的齿孔不齐");
  assert.match(fv, /gridTemplateRows: "repeat\(4,minmax\(0,1fr\)\)"/, "四格没有竖着排");
  // 横的那款照旧是 90deg，别被顺手改了
  const f3 = cut('if (frame === "film3")', '} else if (frame === "fan3")');
  assert.match(f3, /repeating-linear-gradient\(90deg,#161513 0 8px/);

  const cl = cut('} else if (frame === "clipline3")', '} else if (frame === "tower4")');
  assert.match(cl, /position: "absolute", left: "50%", top: 0, bottom: 0, width: 1\.6/, "那根绳没从上垂到下");
  assert.match(cl, /linear-gradient\(180deg,#c9a878,#a8875a\)/, "木夹子没了");

  const tw = cut('} else if (frame === "tower4")', '} else if (frame === "timeline5")');
  const tops = [...tw.matchAll(/top: "(\d+)%"/g)].map(m => Number(m[1]));
  assert.equal(tops.length, 4, "一摞该有四张");
  assert.deepEqual(tops, [...tops].sort((a, b) => a - b), "四张没有一张比一张往下");
  assert.ok(tops[3] - tops[0] >= 60, "四张挤在一块儿，看不出是往下叠的");
});
