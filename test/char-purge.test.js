const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const P = require("../js/char-purge.js");
const mem = init => { const m = new Map(Object.entries(init)); return { get length() { return m.size; }, key: i => Array.from(m.keys())[i], getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
test("删角色把TA的东西一起清：按人键、按人表、带 charId 的记录；别人的一个不动", () => {
  const ls = mem({
    "x_chat:c1": "[1]", "x_chat:c1::room::r9": "[1]", "x_chat:c2": "[2]",
    "x_chatSettings": JSON.stringify({ c1: { a: 1 }, c2: { a: 2 }, "c1::room::r9": {} }),
    "x_favorites": JSON.stringify([{ charId: "c1" }, { charId: "c2" }]),
    "x_characters": JSON.stringify([{ id: "c1" }]),
    "x_cloudMeta": JSON.stringify({ c1: 1 })
  });
  const changed = P.sweep(["c1"], ls);
  assert.ok(!ls.m.has("x_chat:c1") && !ls.m.has("x_chat:c1::room::r9") && ls.m.has("x_chat:c2"));
  assert.deepStrictEqual(JSON.parse(ls.getItem("x_chatSettings")), { c2: { a: 2 } });
  assert.deepStrictEqual(JSON.parse(ls.getItem("x_favorites")), [{ charId: "c2" }]);
  assert.strictEqual(ls.getItem("x_characters"), JSON.stringify([{ id: "c1" }]), "名单由调用方管");
  assert.strictEqual(ls.getItem("x_cloudMeta"), JSON.stringify({ c1: 1 }), "同步那几把锁不碰");
  assert.ok(changed.includes("x_chatSettings") && changed.includes("x_favorites"));
});
test("doDelChar 接上了：扫存档、记忆库走 saveMemLib、梦另清，确认框说清楚", () => {
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  const fn = app.slice(app.indexOf("const doDelChar = "), app.indexOf("const saveRemark ="));
  // v75.055 起删卷宗和「完全重置」共用 purgeCharData；doDelChar 调它，sweep 多一个 keep 参数（删卷宗不传）
  assert.ok(/purgeCharData\(doomed\);/.test(fn));
  assert.ok(/window\.CharPurge\.sweep\(gone, null, keep, only\)/.test(fn));
  assert.ok(/saveMemLib\(next\)/.test(fn));
  assert.ok(/removeCharDreams\(x\)/.test(fn));
  assert.ok(app.includes("聊天、线下、记忆、梦、收藏这些属于 TA 的东西也一起清掉。"));
  assert.ok(fs.readFileSync(__dirname + "/../index.html", "utf8").includes('src="js/char-purge.js?v='));
});

test("清除 / 重置：按类挑，设置类永远留着；两个入口都开同一张选择页，选择页先说导出", () => {
  const ls = mem({ "x_chat:c1": "[1]", x_chatSettings: JSON.stringify({ c1: { a: 1 } }), x_affinities: JSON.stringify({ c1: 80, c2: 50 }), x_favorites: JSON.stringify([{ charId: "c1" }]) });
  // 只挑「聊天」：聊天清了，好感和收藏留着
  let changed = P.sweep(["c1"], ls, null, ["chat"]);
  assert.deepEqual(changed, ["x_chat:c1"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_affinities")), { c1: 80, c2: 50 });
  // 全选：设置类还是不动
  changed = P.sweep(["c1"], ls, null, P.CATS.map(c => c.id));
  assert.ok(changed.includes("x_affinities") && changed.includes("x_favorites") && !changed.includes("x_chatSettings"));
  assert.deepEqual(JSON.parse(ls.getItem("x_chatSettings")), { c1: { a: 1 } });
  for (const [k, c] of [["x_offline:c1", "chat"], ["x_memories", "memory"], ["x_moods", "state"], ["x_rels", "bond"], ["x_diaries", "life"], ["x_moments", "phone"], ["x_promises", "things"], ["x_offlineSettings", "settings"]]) assert.equal(P.catOf(k), c, k);
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  const run = app.slice(app.indexOf("const resetCharData = "), app.indexOf("const saveRemark ="));
  assert.ok(/purgeCharData\(new Set\(\[id\]\), null, only\)/.test(run));
  assert.ok(/chatArchiveClear\(id\)/.test(run) && !/pC\(/.test(run), "重置不许动卷宗");
  assert.ok(/setResetAsk\(\{ id, preset: "all" \}\)/.test(app), "档案馆入口");
  assert.ok(/onClearChat: \(\) => \{ setChatSettingsOpen\(false\); setResetAsk\(\{ id: activeChar\.id, preset: "chat" \}\); \}/.test(app), "聊天设置入口");
  assert.ok(/x_affinities: v => setAffinities\(v\)/.test(app) && /x_states: v => \{ statesRef\.current = v; setStates\(v\); \}/.test(app));
  const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  const ch = comp.slice(comp.indexOf("function ResetChooser("), comp.indexOf("function ChatSettings("));
  assert.ok(ch.includes("先去 设置 → 数据 → 导入与导出 → 导出全部数据"));
  assert.ok(/CATS\.map\(c => h\("div", \{ key: c\.id, "data-reset-cat": c\.id/.test(ch) && /h\(Toggle, \{ on: on\.has\(c\.id\)/.test(ch));
  assert.ok(fs.readFileSync(__dirname + "/../js/screens.js", "utf8").includes('"data-wk": "castfreset", onClick: () => onReset(initial.id)'));
});

test("重置／删除也扫得到：我钱包里跟TA有关的流水、TA送的订单外卖、TA发的朋友圈和论坛帖（她 2026-10-10）", () => {
  const P = require("../js/char-purge.js");
  const mem = {}; const ls = { get length() { return Object.keys(mem).length; }, key: i => Object.keys(mem)[i], getItem: k => mem[k] == null ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  ls.setItem("x_walletLog", JSON.stringify([{ id: "a", ref: { charId: "c1" } }, { id: "b", ref: { charId: "c2" } }, { id: "c" }]));
  ls.setItem("x_shopOrders", JSON.stringify([{ id: "o1", fromCharId: "c1" }, { id: "o2", fromCharId: null }]));
  ls.setItem("x_takeoutLog", JSON.stringify([{ id: "t1", fromCharId: "c1" }]));
  ls.setItem("x_moments", JSON.stringify([{ id: "m1", characterId: "c1" }, { id: "m2", mine: true }]));
  ls.setItem("x_forumPosts", JSON.stringify([{ id: "p1", authorId: "c1" }, { id: "p2", authorId: null }]));
  P.sweep(["c1"], ls, null, ["money"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_walletLog")).map(x => x.id), ["b", "c"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_shopOrders")).map(x => x.id), ["o2"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_takeoutLog")), []);
  assert.equal(JSON.parse(ls.getItem("x_moments")).length, 2, "只勾了钱包那一类，朋友圈不该动");
  P.sweep(["c1"], ls, null, ["phone"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_moments")).map(x => x.id), ["m2"]);
  assert.deepEqual(JSON.parse(ls.getItem("x_forumPosts")).map(x => x.id), ["p2"]);
  assert.ok(P.CATS.some(c => c.id === "money"));
});
