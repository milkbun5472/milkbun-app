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
  assert.ok(/window\.CharPurge\.sweep\(gone, null, keep\)/.test(fn));
  assert.ok(/saveMemLib\(next\)/.test(fn));
  assert.ok(/removeCharDreams\(x\)/.test(fn));
  assert.ok(app.includes("聊天、线下、记忆、梦、收藏这些属于 TA 的东西也一起清掉。"));
  assert.ok(fs.readFileSync(__dirname + "/../index.html", "utf8").includes('src="js/char-purge.js?v='));
});

test("完全重置：留卷宗、留设置表，清掉其余；确认框先说导出", () => {
  const ls = mem({ "x_chat:c1": "[1]", x_chatSettings: JSON.stringify({ c1: { a: 1 } }), x_affinities: JSON.stringify({ c1: 80, c2: 50 }) });
  const changed = P.sweep(["c1"], ls, ["x_chatSettings"]);
  assert.ok(changed.includes("x_chat:c1") && changed.includes("x_affinities") && !changed.includes("x_chatSettings"));
  assert.deepEqual(JSON.parse(ls.getItem("x_chatSettings")), { c1: { a: 1 } });
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  const fn = app.slice(app.indexOf("const resetChar = "), app.indexOf("const saveRemark ="));
  assert.ok(/purgeCharData\(new Set\(\[id\]\), \["x_chatSettings", "x_offlineSettings", "x_charCurrency", "x_avatarSwap"\]\)/.test(fn));
  assert.ok(fn.includes("先去 设置 → 数据 → 导出全部数据"));
  assert.ok(/chatArchiveClear\(id\)/.test(fn));
  assert.ok(!/pC\(/.test(fn), "重置不许动卷宗");
  assert.ok(/x_affinities: v => setAffinities\(v\)/.test(app) && /x_schedules: v => \{ schedulesRef\.current = v; setSchedules\(v\); \}/.test(app));
  assert.ok(/x_rels/.test(app.slice(app.indexOf("const purgeCharData = "), app.indexOf("const resetChar = "))));
  assert.ok(fs.readFileSync(__dirname + "/../js/screens.js", "utf8").includes('"data-wk": "castfreset", onClick: () => onReset(initial.id)'));
});
