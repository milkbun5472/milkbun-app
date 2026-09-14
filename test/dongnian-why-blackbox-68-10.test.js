// 她 2026-09-14：想我莫名其妙归零。我照着「哪个场最近有人说话」猜了两回，两回都不对
// （先怪旁观群旁白、再怪记忆互通，她都当场否掉了）。
//
// 病根不在哪一条判据错了，在于【归零这件事不留痕迹】：清完就完了，谁也说不出是被什么清的。
// 所以这一版不再猜——给它装个黑匣子：每次归零都记下什么时候、被哪儿的哪一下清的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const C = require("../js/interaction-clock.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const T = h => Date.parse("2026-09-14T" + h + ":00:00Z");

test("跨场景钟除了时间，还要交代来源", () => {
  const data = {
    groups: [{ id: "g1", memberIds: ["c1"] }, { id: "g2", memberIds: ["c1"], roomKind: "spectate" }],
    groupChats: { g1: [{ role: "user", ts: T("18") }], g2: [{ role: "narration", ts: T("23") }] },
    groupOfflines: { g1: [{ startTs: T("19"), msgs: [{ role: "user", ts: T("20") }] }] },
    offlines: { c1: [{ startTs: T("10"), msgs: [{ role: "user", ts: T("11") }] }] }
  };
  const w = C.latestUserSharedWhere("c1", data);
  assert.equal(w.ts, T("20"));
  assert.equal(w.kind, "groupOffline");
  assert.equal(w.gid, "g1");
  // 旁观群照旧不算（v68.07 那条），所以 23 点那条不该赢
  assert.notEqual(w.ts, T("23"));
});

test("一句都没开过口时，来源是空的，不许编一个", () => {
  const w = C.latestUserSharedWhere("c1", { groups: [], groupChats: {}, offlines: {} });
  assert.equal(w.ts, 0);
  assert.equal(w.kind, "");
  assert.equal(w.gid, "");
});

test("归零那一刻才写黑匣子，首次认识这段历史不算归零", () => {
  const seg = app.slice(app.indexOf("const elsewhere = gid ? null : dongnianWhereUserSpoke"), app.indexOf("// 推进：首跑从持久化的 lastTick"));
  assert.match(seg, /if \(seenTs\) \{\s*\n\s*try \{ await eng\.resetConnection\(\); \} catch \(e\) \{\}\s*\n\s*dongnianWhySet\(dnKey, Object\.assign\(\{ ts: otherTs \}, why \|\| \{\}\)\);/,
    "黑匣子必须跟 resetConnection 绑在一起：只在真归零那一刻写");
  // 自己那一场里谁开的口，也要分清是她还是别的成员
  assert.match(seg, /kind: gid \? \(m\.role === "user" \? "groupSaid" : "member"\) : "direct"/);
});

test("黑匣子单开一份存档，别挤进 x_jiwen 那张表", () => {
  assert.match(app, /loadJSON\("x_jiwenWhy", \{\}\)/);
  assert.match(app, /saveJSON\("x_jiwenWhy", m\)/);
  assert.ok(!/m\[dnKey\] = st; saveJSON\("x_jiwenWhy"/.test(app), "别把两份东西塞进同一张表");
});

test("界面上说人话，而且没归过零就不出现", () => {
  const seg = comp.slice(comp.indexOf("const renderDongnianWhy = () =>"), comp.indexOf("const renderDongnianElsewhere"));
  assert.match(seg, /if \(!dongnianWhy \|\| !dongnianWhy\.ts\) return null;/);
  assert.match(seg, /"上一次归零："/);
  ["你在私聊里说了话", "你在", "里开了口", "里有别人说了话"].forEach(k => assert.ok(seg.includes(k), "少了一种说法：" + k));
  // 两处渲染点都要挂上（这一页有两种排布）
  assert.equal((comp.match(/renderDongnianWhy\(\),/g) || []).length, 2);
  assert.match(app, /dongnianWhy: \(\(\) => \{/, "没递给界面等于白记");
});
