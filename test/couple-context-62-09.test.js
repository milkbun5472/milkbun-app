// 情侣空间接进上下文（v62.09，她 2026-09-04 同意）：
// ① 问答揭晓/交换日记回页/情书 → 各凝一条记忆库条目（不做常驻注入——她按次计费，
//    常驻块每轮白烧；记忆库条目聊到相关才被检索，平时零成本）。
// ② 愿望板进 togetherLines（发呆的土壤）——整屋子唯一「朝前」的素材。
// ③ 甜蜜值打卡接 GachaKit：原来纯装饰，哪儿都不接。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const gacha = fs.readFileSync(path.join(root, "js/gacha.js"), "utf8");

test("三样纸面往来各凝一条记忆，走同一个 coupleKeep", () => {
  assert.match(app, /const coupleKeep = \(charId, text, tag\) => \{/, "没有共用的凝记忆口");
  // source 必须是非 manual：manual 会绕开 isDupMem 去重，重复调用就攒重
  assert.match(app, /tags: \[tag, "情侣空间"\], charIds: \[charId\], knownBy: \[charId\], source: "couple"/,
    "source/tags/knownBy 的形状不对");
  assert.ok((app.match(/coupleKeep\(char\.id, "情侣问答小本里答过「/g) || []).length >= 2,
    "问答两条成功路径（CC 亲笔 + 引擎兜底）没都凝");
  assert.match(app, /coupleKeep\(cid, "交换日记里（" \+ page\.date/, "交换日记回页没凝");
  assert.ok((app.match(/写过一封情书《/g) || []).length >= 2, "他写的和她写的情书没都凝");
});

test("愿望板进 togetherLines：只给一条、做成的和搁着的不进", () => {
  const i = app.indexOf("  const togetherLines = char => {");
  const j = app.indexOf("  const ambientMaterialFor");
  const src = app.slice(i, j);
  assert.match(src, /x_coupleHome/, "没读愿望板");
  assert.match(src, /w\.status !== "done" && w\.status !== "shelved"/, "做成的/搁着的也进去了");
  assert.match(src, /\.slice\(0, 1\)\s*\n?\s*\.forEach\(w =>/, "愿望不止一条——会变成待办清单");
  // 真跑一遍：钉着的那条进、做成的不进
  const mk = store => new Function("loadJSON", src + "\nreturn togetherLines;")((k, d) => (k in store ? store[k] : d));
  const out = mk({
    x_coupleHome: { c1: { wishes: [
      { title: "去看一次海", status: "wish" },
      { title: "已经去过的", status: "done" }
    ] } }
  })({ id: "c1" });
  assert.match(out, /去看一次海/);
  assert.ok(!out.includes("已经去过的"), "做成的愿望还在土壤里");
});

test("甜蜜值打卡接 GachaKit 的 sweet 档，gachaEarn 回报真给了多少", () => {
  assert.match(gacha, /EARN = \{ chat: 40, offline: 60, sweet: 20 \}/, "gacha 侧没有 sweet 档");
  assert.match(app, /const got = gachaEarn\(char\.id, "sweet"\);/, "打卡没接 gachaEarn");
  assert.match(app, /return r\.got;/, "gachaEarn 不回报 got，toast 只能谎报");
  // 判断在 updater 外面：toast/攒点是副作用，不进 setState updater（严格模式跑两遍）
  assert.match(app, /const box = loadJSON\("x_coupleSweet", \{\}\);/, "打卡判断还塞在 updater 里");
});
