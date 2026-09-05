// v63.09 玩法⑤（她 2026-09-05「都可以做，按顺序来」的最后一件）：碎掉的梦会回来。
// 从真梦进来、半路碎的（entered.outcome === "broken"）是一场【未完成的梦】：隔 2~7 晚 Ta 会再做一次——
// 不掷骰子（1B 决定论）、不看那晚情绪够不够；一场梦只回来一次。
// 进去时从碎之前那一幕接着做：碎的那一幕整个丢掉，选项重新给——这几天你们又聊过，Ta 心里的重量变了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const D = require("../js/dream-loop-core.js");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const dream = read("js/dream.js"), shadow = read("js/dream-loop-shadow.js"), journal = read("js/dreamjournal.js");

test("recurDue：只认碎了的、没回来过的、本身不是回来的；隔 2~7 晚；最近碎的先", () => {
  const b = (night, extra) => Object.assign({ key: "c1|" + night, charId: "c1", nightKey: night, entered: { outcome: "broken" } }, extra || {});
  assert.equal(D.nightsBetween("2026-09-01", "2026-09-04"), 3);
  assert.equal(D.recurDue([b("2026-09-03")], "c1", "2026-09-04"), null, "隔一晚太早");
  assert.equal(D.recurDue([b("2026-09-02")], "c1", "2026-09-04").key, "c1|2026-09-02");
  assert.equal(D.recurDue([b("2026-08-20")], "c1", "2026-09-04"), null, "隔太久就不回了");
  assert.equal(D.recurDue([b("2026-09-02", { recurred: "x" })], "c1", "2026-09-04"), null, "回来过一次的不再回");
  assert.equal(D.recurDue([b("2026-09-02", { recurOf: "y" })], "c1", "2026-09-04"), null, "回来的那场再碎也不再回");
  assert.equal(D.recurDue([b("2026-09-02", { entered: { outcome: "fulfilled" } })], "c1", "2026-09-04"), null, "抵达的不回");
  assert.equal(D.recurDue([b("2026-09-02")], "c2", "2026-09-04"), null, "别人的梦不回");
  assert.equal(D.recurDue([b("2026-08-30"), b("2026-09-01")], "c1", "2026-09-04").nightKey, "2026-09-01", "最近碎的那场先回来");
  assert.equal(D.RECUR_MIN_NIGHTS, 2); assert.equal(D.RECUR_MAX_NIGHTS, 7);
});

test("observe：该回来的夜不看情绪，直接 queued；带 recurOf；原行记 recurred（一场只回一次）", () => {
  assert.match(shadow, /const back = C\.recurDue \? C\.recurDue\(all, char\.id, night\) : null;/);
  assert.match(shadow, /const verdict = back \? \{ dream: true, reason: "recur" \} : C\.shouldDream\(material, \{\}\);/, "回来的夜还在看情绪阈值");
  assert.match(shadow, /if \(back\) \{ row\.recurOf = back\.key; row\.motifs = back\.motifs \|\| \[\]; row\.tone = back\.tone \|\| ""; \}/);
  assert.match(shadow, /tx\.objectStore\("dreams"\)\.put\(\{ \.\.\.back, recurred: key \}\)/, "原行没记 recurred，下次还会回");
});

test("进去：从碎之前接着做——碎的那一幕丢掉，前面的原样带着，进门自动往下织", () => {
  const store = { x_dream_saves: JSON.stringify([{ id: "dm_old", loopKey: "c1|2026-09-01", nightKey: "2026-09-01", status: "broken", wrongText: "把门推开", whyWrong: "那扇门后面是他不肯看的东西",
    scenes: [{ text: "一", chosen: 0, options: [{ text: "a", kind: "accord" }, { text: "b", kind: "accord" }, { text: "c", kind: "resist" }] },
             { text: "二", chosen: 1, options: [{ text: "a", kind: "accord" }, { text: "b", kind: "accord" }, { text: "c", kind: "resist" }] },
             { text: "三", chosen: 2, options: [{ text: "a", kind: "accord" }, { text: "b", kind: "accord" }, { text: "把门推开", kind: "resist" }] }] }]) };
  const g = { window: null, loadJSON: (k, fb) => (k in store ? JSON.parse(store[k]) : fb), saveJSON: (k, v) => { store[k] = JSON.stringify(v); return true; },
    useState: v => [typeof v === "function" ? v() : v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, React: { Fragment: "f" },
    h: () => null, Head: () => null, Avatar: () => null, F_BODY: "a", F_DISPLAY: "b", requestAppConfirm: () => {}, isOocMsg: () => false };
  g.window = g; g.DreamLoop = { markEntered: () => Promise.resolve(), excerptsFor: () => ["又聊了一次那扇门"], listDreams: () => Promise.resolve([]) };
  vm.runInNewContext(dream, g);
  const row = { key: "c1|2026-09-04", charId: "c1", nightKey: "2026-09-04", status: "queued", recurOf: "c1|2026-09-01", motifs: ["门"], tone: "闷" };
  const s = g.Dream.sessionFromLoop(row, { characters: [{ id: "c1", name: "沈屿白", persona: "x" }], profile: { name: "Lisa" }, couples: {} });
  assert.equal(s.scenes.length, 2, "碎的那一幕（第三幕）该丢掉，前两幕带着");
  assert.equal(s.scenes[1].chosen, 1, "带着的幕保持已选");
  assert.equal(s.recur.brokenAt, 3); assert.equal(s.recur.wrongText, "把门推开"); assert.equal(s.recur.firstNight, "2026-09-01");
  const block = g.Dream.loopMaterialBlock(s);
  assert.match(block, /【这场梦 Ta 不是第一次做】2026-09-01 夜做到第 3 幕，在「把门推开」那一步碎了（那扇门后面是他不肯看的东西）/);
  assert.match(block, /逆鳞可以挪位置、可以变形/);
  // 进门自动接着织（带着已选的幕进来，不用她再按「继续做梦」）
  assert.match(dream, /else if \(dreaming && s\.recur && scenes\.length && scenes\[scenes\.length - 1\]\.chosen != null && !kicked\.current\) \{\s*\n[^\n]*\n\s*kicked\.current = true;\s*\n\s*retryNext\(\);/);
  // 没有原场（比如她删了那场梦）就当一场新的真梦做，不崩
  const s2 = g.Dream.sessionFromLoop({ ...row, recurOf: "不存在" }, { characters: [{ id: "c1", name: "沈屿白" }], profile: {} });
  assert.equal(s2.scenes.length, 0); assert.equal(s2.recur, null);
});

test("两边都标出来：梦境列表「又做了一次」、解梦馆那栏也是", () => {
  assert.match(dream, /"又做了一次 · 上次碎在半路"/);
  assert.match(dream, /夜又做了一次）/);
  assert.match(dream, /这场梦 Ta 又做了一次。上次做到第 /, "正文顶上没说明这是回来的梦");
  assert.match(journal, /d\.recurOf \? "又做了一次"/);
});
