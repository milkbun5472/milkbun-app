const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-09-01：「我在情侣空间删掉了，查手机日历这边还显示有」。
// 纪念日同时写进两处（x_coupleAnniv + x_calendar），删只删了一处。

test("日历里那份记得自己是谁的影子", () => {
  assert.match(app, /const saveCalEvent = \(view, dateKey, title, note, srcId\) =>/, "日历事件不记出处");
  assert.match(app, /\.\.\.\(srcId \? \{ srcId: srcId \} : \{\}\)/, "出处没落进事件里");
  assert.match(app, /saveCalEvent\(char\.id,[\s\S]{0,90}"情侣纪念日", anId\)/, "加纪念日时没把出处传下去");
  assert.match(app, /const anId = "an_" \+ Date\.now\(\);/, "两处用的不是同一个 id");
});

test("删纪念日时把日历里那份一起删掉", () => {
  assert.match(app, /const dropAnnivEvents = \(charId, an\) =>/, "没有跟着删的那一步");
  assert.match(app, /e\.srcId === an\.id/, "没按出处删");
  // 老数据没有出处，得退回按名字认——不然她已经存下的那些永远删不掉
  assert.match(app, /!e\.srcId && e\.note === "情侣纪念日" && String\(e\.title \|\| ""\)\.trim\(\) === String\(an\.name \|\| ""\)\.trim\(\)/, "老数据没有退路");
  assert.match(app, /if \(gone\) \{ try \{ dropAnnivEvents\(gone\.characterId, gone\)/, "删的时候没调用");
});

// ⚠️「只写日历、不写纪念日表」的那个入口造出来的事件，情侣空间根本列不出来，
// 于是永远删不掉。而且它在 Us 里从头到尾没人调用。
test("那个只写一处的入口删掉了", () => {
  assert.ok(app.indexOf("onAddAnniversary") < 0, "app 侧还留着只写日历的那个入口");
  assert.ok(scr.indexOf("onAddAnniversary") < 0, "Us 还收着那个没人用的道具");
});

test("开机对一次账，把已经成了孤儿的影子清掉", () => {
  const i = app.indexOf('const _an = loadJSON("x_coupleAnniv", []);');
  assert.ok(i > 0, "开机没有对账");
  const seg = app.slice(i, app.indexOf("setCoupleLetters", i));
  assert.match(seg, /if \(!e \|\| e\.note !== "情侣纪念日"\) return true;/, "把不相干的事件也扫了");
  assert.match(seg, /String\(e\.title \|\| ""\)\.indexOf\("♥"\) === 0\) return true;/, "「在一起」那条会被误杀——它不在纪念日表里，但不是孤儿");
  assert.match(seg, /alive\[cid\] && alive\[cid\]\.has\(String\(e\.title \|\| ""\)\.trim\(\)\)/, "没有按表里还在不在来判断");
  // 日历 state 在更早就载进去了，只写盘的话这次开机屏幕上还是脏的
  assert.match(seg, /saveJSON\("x_calendar", next\); setCalendar\(next\);/, "只写了盘没更新界面，要等下次开机才干净");
  assert.ok(app.indexOf('setCalendar(loadJSON("x_calendar"') < i, "对账跑在日历载入之前了，那就不用手动更新 state");
});

// 真跑一遍那段对账逻辑
test("真跑一遍：孤儿掉、对得上的留、在一起那条留、别人的事件不碰", () => {
  const reconcile = (cal, an) => {
    const alive = {};
    an.forEach(a => { if (a && a.characterId) (alive[a.characterId] = alive[a.characterId] || new Set()).add(String(a.name || "").trim()); });
    let hit = false;
    const next = JSON.parse(JSON.stringify(cal));
    Object.keys(next.chars || {}).forEach(cid => {
      const b = next.chars[cid] || {};
      Object.keys(b).forEach(k => {
        const kept = (b[k] || []).filter(e => {
          if (!e || e.note !== "情侣纪念日") return true;
          if (String(e.title || "").indexOf("♥") === 0) return true;
          const ok = alive[cid] && alive[cid].has(String(e.title || "").trim());
          if (!ok) hit = true;
          return !!ok;
        });
        if (kept.length) b[k] = kept; else delete b[k];
      });
    });
    return { next, hit };
  };
  const cal = { world: {}, mine: {}, chars: { c1: {
    "2026-12-3": [{ id: "e1", title: "第一次一起看雪", note: "情侣纪念日", srcId: "an_1" }],
    "2026-7-9": [{ id: "e2", title: "测试用的纪念日", note: "情侣纪念日" }],
    "2026-5-24": [{ id: "e3", title: "♥ 和 沈屿白 在一起", note: "情侣纪念日" }],
    "2026-6-1": [{ id: "e4", title: "我自己记的一件事", note: "" }]
  } } };
  const r = reconcile(cal, [{ id: "an_1", characterId: "c1", name: "第一次一起看雪" }]);
  const titles = [];
  Object.keys(r.next.chars.c1).forEach(k => r.next.chars.c1[k].forEach(e => titles.push(e.title)));
  assert.ok(r.hit, "没认出有孤儿");
  assert.deepEqual(titles.sort(), ["♥ 和 沈屿白 在一起", "我自己记的一件事", "第一次一起看雪"].sort());
  assert.ok(!r.next.chars.c1["2026-7-9"], "空掉的那天没删掉，日历上会留一个空格子");
  // 没有孤儿时不许瞎写盘
  assert.equal(reconcile(r.next, [{ id: "an_1", characterId: "c1", name: "第一次一起看雪" }]).hit, false, "干净的日历也被判成要改");
});
