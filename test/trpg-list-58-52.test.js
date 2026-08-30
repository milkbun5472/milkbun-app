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
  const body = grab("  const load = () => {", "  // 所有写盘走这一个口子", 2400);
  const fn = new Function("localStorage", "itemsFix", "fateOf", "lsWrite",
    body + "\nreturn load;")(localStorage, itemsFix, () => 1,
      (k, v) => { localStorage.setItem(k, JSON.stringify(v)); return true; });
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

// ── 写不进去的时候要看得见（她 2026-08-30 第二轮：「还是删不掉宝宝」）──────────
// 原来每处写盘都是 try{setItem}catch(e){}：写失败一声不吭，界面上那个团当场消失、
// 重开又原样回来，看起来就是「怎么都删不掉」。实测拿云端恢复的冻结期一比就是这个样子。
function loadLsWrite(fakeLs) {
  const i = src.indexOf("  function lsWrite(key, value, zh) {");
  const j = src.indexOf("  const persist = list =>", i);
  assert.ok(i > 0 && j > i && j - i < 2600, "抠不出 lsWrite");
  return new Function("localStorage", "window", "console",
    src.slice(i, j) + "\nreturn lsWrite;")(fakeLs, { __trpgToast: () => {} }, { error: () => {} });
}
// 一个带【字节预算】的假 localStorage：写完之后总量超预算就抛 quota，
// 跟真的一样——所以「先挪走旧的再写」这一步是真的能腾出空间，不是假装
function fakeLs(opts) {
  const o = opts || {};
  const store = Object.assign({}, o.init);
  const total = extraK => Object.keys(store).reduce((n, k) => n + store[k].length, 0) + extraK;
  return {
    store,
    getItem: k => (k in store ? store[k] : null),
    removeItem: k => { delete store[k]; },
    setItem: (k, v) => {
      if (o.swallow) return;               // 云端恢复冻结期：写进来直接丢掉
      const s = String(v);
      const after = total(s.length) - ((k in store) ? store[k].length : 0);
      if (o.budget != null && after > o.budget) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
      store[k] = s;
    }
  };
}

test("写满了就先把旧的挪走再写——删团是变小的写，这样落得下去", () => {
  // 预算刚好放得下现在这一份；写新的那一刻【旧的还占着】，所以第一次必然抛
  const old = '["旧的一大坨旧的一大坨"]', nw = JSON.stringify(["剩下的"]);
  const ls = fakeLs({ init: { x_trpg: old }, budget: old.length + nw.length - 1 });
  const ok = loadLsWrite(ls)("x_trpg", ["剩下的"], "这场跑团");
  assert.equal(ok, true, "写满时没有重试，删团就白点了");
  assert.equal(ls.store.x_trpg, JSON.stringify(["剩下的"]));
});

test("两次都写不进去时，旧的原样放回去——绝不把一整份存档写没", () => {
  // 新的比预算还大：挪走旧的也放不下，这时候必须把旧的原样放回去
  const old = '["她的全部跑团"]';
  const ls = fakeLs({ init: { x_trpg: old }, budget: old.length });
  const ok = loadLsWrite(ls)("x_trpg", ["剩下的但更长更长更长更长更长更长"], "这场跑团");
  assert.equal(ok, false);
  assert.equal(ls.store.x_trpg, old, "写失败还把她的存档删了，这比删不掉严重得多");
});

test("写进去了但读回来不是这一份，就当没写成", () => {
  const ls = fakeLs({ init: { x_trpg: "[]" }, swallow: true });   // 冻结期：setItem 是空操作
  assert.equal(loadLsWrite(ls)("x_trpg", ["新的"], "这场跑团"), false, "没读回来核一遍，界面会以为删掉了");
});

test("写失败要弹出来告诉她，不是闷着", () => {
  const fail = grab("  function trpgWriteFail(zh, why) {", "  const persist = list =>", 900);
  assert.match(fail, /window\.__trpgToast/, "写失败没有任何提示");
  assert.match(fail, /没保存成功/, "提示里得说明白是没存下来");
  const hook = grab("    // 把 toast 借给模块顶层的 lsWrite 用", "    const [busy, setBusy]", 700);
  assert.match(hook, /window\.__trpgToast = props\.toast/, "toast 没接上，弹不出来");
  assert.match(hook, /delete window\.__trpgToast/, "离开跑团要把钩子摘掉");
});

test("存不下就不改界面——不然当场消失、重开又回来", () => {
  const up = grab("    const update = fn => setCamps", "    // 图库:出过的图永久归档", 400);
  assert.match(up, /return persist\(n\) \? n : p;/, "存不下还照改界面，就是「看起来删掉了其实没删」");
});

test("跑团里所有写盘都走同一个口子", () => {
  const raw = src.split("\n").filter(l => /localStorage\.setItem\(/.test(l) && !/function lsWrite/.test(l));
  assert.deepEqual(raw.map(l => l.trim()).filter(l => !/^var s = |^try \{ localStorage\.setItem\(key, s\)|localStorage\.setItem\(key, old\)|localStorage\.removeItem\(key\); localStorage\.setItem\(key, s\)/.test(l)),
    [], "还有人自己写 setItem，失败了照样一声不吭：\n" + raw.join("\n"));
});

// ── 不用系统弹窗（她 2026-08-30 第三轮：「.55 根本没有确认框」）───────────────
// iOS 上系统弹窗会被吞掉（Safari 连着弹几次之后可以「阻止此页面的对话框」，
// 一旦点过就一直是 no-op，confirm() 直接返回 false）——于是 ✕ 点了什么都不发生，
// 连问都不问。实测把 window.confirm 改成永远返回 false，症状一模一样。
test("跑团里一处系统 confirm 都不许留", () => {
  const code = src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const left = (code.match(/[^.\w]confirm\(/g) || []);
  assert.deepEqual(left, [], "还在用系统弹窗，那台机器上它是不弹的");
  // 八处删除/确认全都换成了自己那一层
  assert.ok((src.match(/askConfirm\(/g) || []).length >= 8, "有的地方漏换了");
});

test("自己画的那一层：一定弹得出来，取消什么都不做", () => {
  const sheet = grab("    const askSheet = ask && h(\"div\"", "    // 面板里的一块", 1800);
  assert.match(sheet, /position: "fixed", inset: 0, zIndex: 200/, "层级不够会被别的东西盖住");
  assert.match(sheet, /onClick: \(\) => setAsk\(null\)[\s\S]{0,400}"取消"/, "没有取消，或者取消不关");
  // 点「删除」才执行，而且先关层再执行（不然动作里再弹一次会被这一层压着）
  assert.match(sheet, /const f = ask\.onYes; setAsk\(null\); if \(f\) f\(\);/);
});

test("每一个页面都挂着这一层，不然在那一页点删除就什么都不出来", () => {
  const rets = src.split("\n").filter(l => /return h\("div", \{ style: S\.wrap \}/.test(l));
  assert.ok(rets.length >= 5, "S.wrap 的页面少了：" + rets.length);
  const missed = rets.filter(l => !/askSheet/.test(l));
  assert.deepEqual(missed, [], "这几页没挂确认层：\n" + missed.join("\n"));
});

test("硬闯问过一次就不再问第二遍", () => {
  const pick = grab("    const pickChoice = async (c, force) => {", "    const send = () =>", 1600);
  assert.match(pick, /if \(!force && c\.need/, "点了「硬闯」还会再弹一次，永远进不去");
  assert.match(pick, /pickChoice\(c, true\)/);
  assert.match(pick, /if \(c\.need && !hasItem\(camp\.items, c\.need\)\) return turn\(c\.text \+ "\(没有「"/, "硬闯之后没把「硬闯」这件事写进宣言");
});
