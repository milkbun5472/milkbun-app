const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "trpg.js"), "utf8");
const { itemsFix } = require("../js/trpg.js");
const grab = (a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};

// 把 load() 原样跑起来（它只用到 localStorage / itemsFix / fateOf）
function loadWith(saved) {
  const store = { x_trpg: JSON.stringify(saved) };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
  const body = grab("  const load = () => {", "  const persist = list =>", 2400);
  const fn = new Function("localStorage", "itemsFix", "fateOf",
    body + "\nreturn load;")(localStorage, itemsFix, () => 1);
  return { list: fn(), store };
}

// 她 2026-08-30：「跑团旧版的 x 没用删除不了」。
// 病根：更老的存档压根没有 id，列表按 key: c.id 渲染，几个团的 key 全是 undefined，
// React 把它们认成同一个节点 —— 点甲的 ✕ 弹的是乙的标题、删掉的是乙（实测三个老团一起没）。
test("老存档读进来就把 id 补齐，而且各不相同", () => {
  const { list, store } = loadWith([
    { title: "老团甲", createdAt: 1000 },
    { title: "老团乙", createdAt: 1000 },
    { title: "新团", id: "rpg_x", createdAt: 2000 }
  ]);
  const ids = list.map(c => c.id);
  assert.ok(ids.every(Boolean), "还有团没有 id：" + JSON.stringify(ids));
  assert.equal(new Set(ids).size, 3, "补出来的 id 撞了：" + JSON.stringify(ids));
  assert.equal(ids[2], "rpg_x", "本来有 id 的不许改动——改了等于把她的团换了一个");
  // 补完要落盘，不然下次读进来又是一批新 id
  assert.deepEqual(JSON.parse(store.x_trpg).map(c => c.id), ids, "补好的 id 没写回去");
});

test("已经齐全的存档不白写一遍", () => {
  const full = [{ id: "rpg_1", title: "团", createdAt: 1, squadId: "sq_1", items: [], party: [], msgs: [] }];
  const { store } = loadWith(full);
  assert.equal(store.x_trpg, JSON.stringify(full), "什么都没缺却又落了一次盘");
});

test("列表按 c.id 当 key——所以 id 必须齐", () => {
  const card = grab("    const campCard = c => {", "    // ---- 组建队伍", 2600);
  assert.match(card, /key: c\.id/);
  // ✕ 的点击范围要够大：它就贴在卡片本身的 onClick 旁边，小了一歪就进团了
  const x = card.slice(card.indexOf('h("button", { onClick: e => { e.stopPropagation();'), card.indexOf('"✕"'));
  const w = /width: (\d+), height: (\d+)/.exec(x);
  assert.ok(w && Number(w[1]) >= 40 && Number(w[2]) >= 40, "✕ 的点击范围小于 40×40：" + (w ? w[0] : "压根没写宽高"));
});

// 删过的图下次进跑团又回来了：补档那一步把团里还引用着的图【全部】收回来
test("图库删掉的图不会被补档收回来", () => {
  const gone = grab("  const loadGalGone = ", "  // 输出天花板", 1200);
  assert.match(gone, /x_trpgGalleryGone/, "没有墓碑，删了也会被补回来");
  const back = grab("      // 图库上线前已出过的封面与画面", "      if (add.length)", 900);
  assert.match(back, /loadGalGone\(\)\.forEach\(img => have\[img\] = 1\)/, "补档那一步没绕开墓碑");
  const del = grab('h("button", { onClick: () => { const id = galView.id', '}, style: { padding: "8px 16px"', 400);
  assert.match(del, /galTomb\(img\)/, "删的时候没立墓碑");
});

// 她 2026-08-30：「队伍平时能不能收纳到哪儿不要在主页占位，主界面只留开的团，
// 然后开完的团也单独找地方收纳，在主页的团也归纳整理一下方便找」
const listView = grab("    // 最近动过的排前面", "  }\n  if (inApp) window.TrpgApp", 3000);

test("入口页分三格：在演 / 已落幕 / 小分队", () => {
  assert.match(listView, /tab\("live", "在演", live\.length\)/);
  assert.match(listView, /tab\("done", "已落幕", done\.length\)/);
  assert.match(listView, /tab\("squad", "小分队", squads\.length\)/);
  // 小分队不再无条件铺在列表最上面
  assert.ok(!/\bsquadsBlock,\s*$/m.test(listView), "小分队又摆回主列表顶上了");
  assert.match(listView, /listTab === "squad"[\s\S]{0,200}squadsBlock/, "小分队那一格里没有队伍");
});

test("在演那格只有没落幕的团，落幕的只在自己那格", () => {
  assert.match(listView, /const live = camps\.filter\(c => !c\.ended\)/);
  assert.match(listView, /const done = camps\.filter\(c => c\.ended\)/);
  assert.match(listView, /listTab === "done"[\s\S]{0,120}done\.map\(campCard\)/);
});

test("按最近动过排序，卡上写清是哪支队、上次什么时候动的", () => {
  assert.match(listView, /\.sort\(byRecent\)/);
  assert.match(listView, /const byRecent = \(a, b\) => lastTs\(b\) - lastTs\(a\)/, "排序反了会把最老的顶到最上面");
  const i = src.indexOf("    const campAgo = c => {");
  const j = src.indexOf("    // 入口:战役列表", i);
  assert.ok(i > 0 && j > i && j - i < 1200, "抠不出 campAgo");
  const campAgo = new Function(src.slice(i, j) + "\nreturn campAgo;")();
  const N = Date.now(), D = 86400e3;
  assert.equal(campAgo({ msgs: [{ ts: N - 10 * 60000 }] }), "刚动过");
  assert.equal(campAgo({ msgs: [{ ts: N + 60000 }] }), "", "未来时间不瞎猜");
  assert.equal(campAgo({ msgs: [], createdAt: 0 }), "");
  assert.match(campAgo({ msgs: [{ ts: N - 5 * D }] }), /天前/);
  assert.match(campAgo({ msgs: [{ ts: N - 200 * D }] }), /月.*日/);
  const card = grab("    const campCard = c => {", "    // ---- 组建队伍", 2600);
  assert.match(card, /\[c\.squadName \|\| "", campAgo\(c\)\]\.filter\(Boolean\)\.join\(" · "\)/, "卡上没写是哪支队、上次什么时候动的");
});
