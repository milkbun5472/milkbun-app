// 朋友圈的图能再画一张（群里肉肉肉酱意面 2026-10-03：「朋友圈的图能不能加个重 roll 啊」）
//
// 原来重不了，病根一行：momentGenImage 开头 `isImgRef(mom.image)` 就 return false
// ——已经画出来的那张，它直接当成「没得画」。
// 重拍要用【当初那段画面描述】，它第一次生成时就存进了 imageDesc；
// 手贴进来的图没有描述，那就不该出现这颗按钮。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");

const fn = (() => {
  const i = app.indexOf("  const momentGenImage = async (momentId, quiet, force) =>");
  const j = app.indexOf("  window.momentGenImage", i);  // 不含那一行赋值
  assert.ok(i > 0 && j > i, "抠不出 momentGenImage");
  return app.slice(i, j);
})();

test("① 已经是图时：不给 force 照旧不画，给了 force 才用 imageDesc 重画", () => {
  assert.match(fn, /const already = isImgRef\(mom\.image\);/);
  assert.match(fn, /if \(already && !force\) return false;/, "没有 force 时要维持原样");
  assert.match(fn, /const desc = already \? String\(mom\.imageDesc\) : String\(mom\.image\);/,
    "重拍必须用当初那段描述，不是把图当描述");
});

test("② 没留描述的（手贴图/老数据）说清重拍不了，不许拿图当描述去画", () => {
  assert.match(fn, /if \(already && !String\(mom\.imageDesc \|\| ""\)\.trim\(\)\)/);
  assert.match(fn, /重拍不了/);
});

test("③ 画完把新那张交回去（大图要原地换掉，不是关了再点开）", () => {
  assert.match(fn, /return ref;/, "成功时要返回新图");
  assert.match(comp, /if \(ok && onDone\) onDone\(ok\);/, "按钮要把它递给调用方");
  assert.equal((comp.match(/onDone: nextRef => \{ if \(nextRef\) setImgView\(nextRef\); \}/g) || []).length, 2,
    "信息流和个人页两处大图都要原地换图");
});

test("④ 两处大图都有这颗键，且只在留着描述时出现", () => {
  const btn = comp.slice(comp.indexOf("function MomentReshootButton"), comp.indexOf("function AutoImgSwitch"));
  assert.match(btn, /if \(!momentId \|\| !hasDesc/, "没描述就不该出现");
  assert.match(btn, /window\.momentGenImage\(momentId, false, true\)/, "要带 force");
  assert.equal((comp.match(/h\(MomentReshootButton, \{ momentId: imgMid/g) || []).length, 2);
});

test("⑤ 点开已经是图的那条时，也要记下是哪条动态（原来只有描述那一支记）", () => {
  const sets = comp.match(/setImgView\(m\.image\); setImgMid\(m\.characterId \? m\.id : null\);/g) || [];
  assert.ok(sets.length >= 2, "两处「点图看大图」的入口都要 setImgMid，不然重拍键不知道拍谁");
});

// 真跑一遍那段判断
test("⑥ 真跑：三种情况各走各的路", async () => {
  const mk = (mom, ready = true) => {
    const toasts = [];
    const deps = {
      momentsRef: { current: [mom] },
      isImgRef: v => typeof v === "string" && v.startsWith("iv_"),
      imgApiReady: () => ready,
      toast: m => toasts.push(m),
      characters: [{ id: "c1", name: "阿川" }],
      drawFromDesc: async (c, desc) => "iv_NEW:" + desc,
      pMom: fnp => { const n = fnp([mom]); Object.assign(mom, n[0]); },
      window: { momentGenImage: null },   // 段尾那句 window.momentGenImage=… 要有个落处
    };
    const f = new Function(...Object.keys(deps), fn + "\nreturn momentGenImage;")(...Object.values(deps));
    return { f, toasts };
  };
  // 还只是描述 → 照旧画
  let m1 = { id: "m1", characterId: "c1", image: "窗台上的多肉" };
  assert.equal(await mk(m1).f("m1"), "iv_NEW:窗台上的多肉");
  // 已经是图、没给 force → 不画
  let m2 = { id: "m2", characterId: "c1", image: "iv_old", imageDesc: "窗台上的多肉" };
  assert.equal(await mk(m2).f("m2"), false);
  // 已经是图、给了 force → 用 imageDesc 重画
  let m3 = { id: "m3", characterId: "c1", image: "iv_old", imageDesc: "窗台上的多肉" };
  assert.equal(await mk(m3).f("m3", false, true), "iv_NEW:窗台上的多肉");
  // 已经是图、但没描述 → 说清重拍不了
  let m4 = { id: "m4", characterId: "c1", image: "iv_old" };
  const w = mk(m4);
  assert.equal(await w.f("m4", false, true), false);
  assert.match(w.toasts.join(" "), /重拍不了/);
});
