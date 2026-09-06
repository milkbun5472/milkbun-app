// v63.04 玩法③（她 2026-09-05「都可以做，按顺序来」的第二件）：踩到逆鳞不立刻碎。
// 原来逆鳞在字面上分不出来，踩到即碎＝掷骰子，玩家什么都学不到。
// 现在：踩到 → 梦变质一幕、Ta 的潜意识在挣扎 → 你再选一次；三条里一条合 Ta 心意（face）→ 第四种结局「直面」，
// 另外两条（shatter）才碎。一场梦只给一次机会；回档抹掉那一幕，机会还回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const dream = fs.readFileSync(path.join(__dirname, "..", "js", "dream.js"), "utf8");

function loadDream() {
  const store = {};
  const g = { window: null, loadJSON: (k, fb) => (k in store ? JSON.parse(store[k]) : fb), saveJSON: (k, v) => { store[k] = JSON.stringify(v); return true; },
    useState: v => [typeof v === "function" ? v() : v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, React: { Fragment: "f" },
    h: () => null, Head: () => null, Avatar: () => null, F_BODY: "a", F_DISPLAY: "b", requestAppConfirm: () => {}, isOocMsg: () => false, __store: store };
  g.window = g; g.DreamLoop = { markEntered: () => Promise.resolve(), excerptsFor: () => [], listDreams: () => Promise.resolve([]) };
  vm.runInNewContext(dream, g); return g;
}

test("挣扎那一幕的选项：恰好一个 face、其余 shatter；少于三条不认；多标的只留第一个", () => {
  const g = loadDream(), N = g.Dream.normStruggleOptions;
  assert.equal(N([{ text: "a" }, { text: "b" }]), null);
  let o = N([{ text: "a", kind: "shatter" }, { text: "b", kind: "shatter" }, { text: "c", kind: "shatter" }]);
  assert.equal(o.filter(x => x.kind === "face").length, 1, "一个都没标就得补一个");
  o = N([{ text: "a", kind: "face" }, { text: "b", kind: "face" }, { text: "c", kind: "face" }]);
  assert.equal(o.filter(x => x.kind === "face").length, 1, "标多了只许留一个");
  o = N([{ text: "a", kind: "face" }, { text: "b" }, { text: "c" }, { text: "d" }]);
  assert.equal(o.length, 3);
});

test("pick：第一次踩逆鳞走挣扎、第二次直接碎；挣扎幕里 face → 直面、其余 → 碎", () => {
  const P = dream.slice(dream.indexOf("    async function pick(idx) {"), dream.indexOf("    async function retryNext"));
  assert.match(P, /if \(cur\.struggle\) \{/, "挣扎那一幕的回应没有专门的分支");
  assert.match(P, /if \(chosen\.kind === "face"\) \{[\s\S]*?weaveFace\(/, "face 没接到直面");
  assert.match(P, /status: "faced", ending: r\.face, dreamCore: r\.core/);
  assert.match(P, /if \(!s\.struggled\) \{[\s\S]*?weaveStruggle\(/, "第一次踩逆鳞没走挣扎");
  assert.match(P, /struggled: true, struggleFor: chosen\.text/, "机会没记成用过");
  // 挣扎织不出来时退回直接碎，不能卡死
  assert.match(P, /catch \(e\) \{ \/\* 挣扎没织出来：退回原来的路，直接碎 \*\/ \}/);
});

test("回档：抹掉挣扎幕就把机会还回去", () => {
  // ⚠️v64.88 起确认走 requestAppConfirm，真正干活的挪进了 rewindToNow（原生 confirm 在 PWA 里会被吞掉）
  const ri = dream.indexOf("    const rewindToNow = k => {"); const R = dream.slice(ri, dream.indexOf("\n    };", ri));
  assert.match(dream, /requestAppConfirm\("回到第 " \+ \(k \+ 1\) \+ " 幕重新选？", tail, \(\) => rewindToNow\(k\)/, "回档前那一问没了");
  assert.match(R, /const stillStruggling = kept\.some\(sc => sc && sc\.struggle\);/);
  assert.match(R, /struggled: stillStruggling/);
});

test("直面是第四种结局：有自己的块、落地页有点、结算算「他会主动讲」", () => {
  assert.match(dream, /s\.status === "faced"\s*\n\s*\? h\("div"/, "结局块没有直面");
  assert.match(dream, /"直　面"/);
  assert.match(dream, /faced \? \{ txt: "直面", c: GOOD_LIT \}/, "落地页那颗点没有直面");
  assert.match(dream, /patch\.status === "fulfilled" \|\| patch\.status === "faced" \|\| patch\.status === "broken"/, "结算漏了 faced");
  const g = loadDream();
  g.Dream.settleLoopDream({ id: "d", loopKey: "k", charId: "c1", material: { tone: "闷" }, dreamCore: "他怕被看穿" }, "faced");
  const seen = JSON.parse(g.__store.x_dreamSeen).c1;
  assert.equal(seen.mode, "tell"); assert.equal(seen.line, "他怕被看穿");
});

test("提示词：挣扎幕写的是挣扎不是崩塌，face 得从这个人身上长出来；直面写的是看见不是治愈", () => {
  const S = dream.slice(dream.indexOf("async function weaveStruggle("), dream.indexOf("async function weaveFace("));
  assert.match(S, /别写崩塌，写【挣扎】/);
  assert.match(S, /换个人就不成立/, "face 那条没钉在人设上");
  assert.match(S, /三个字面上都像好选择，别露馅/);
  const F = dream.slice(dream.indexOf("async function weaveFace("), dream.indexOf("// ---- 模型：梦碎"));
  assert.match(F, /别写成和解或治愈，写【看见】/);
  // Setup 那句说明跟着改了
  assert.match(dream, /踩到了梦会先挣扎一幕，只给你一次机会安抚它/);
});
