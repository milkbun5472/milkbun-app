// 去处：我们的城市（群友 2026-10-02：「进去处显示城市大地图，里面有咖啡店、书店这种可以约会的自定义场所」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const d = read("dwell.js"), a = read("app.js"), g = read("gacha.js");

test("她自己钉的约会地点一份存着（x_datePlaces），去处顶上画成城市小地图", () => {
  assert.match(d, /localStorage\.getItem\("x_datePlaces"/);
  assert.match(d, /window\.DatePlaces = DatePlaces;/);
  assert.match(d, /h\(CityMap, \{ t: t, places: dates, sel: dateSel, onPick: setDateSel \}\)/);
  assert.match(d, /"＋ 钉一个地方"/);
});

test("点一个钉：自己去转转（串门）／约TA在这儿见（开见面，开场就在那儿）", () => {
  assert.match(d, /"自己去转转"/);
  assert.match(d, /props\.onDate && props\.onDate\(char, p\)/);
  assert.match(a, /onDate: async \(char, place\) => \{/);
  assert.match(a, /await startOffline\(char\.id, \{ opening: "你约了 "/);
});

test("约会券、TA开的线下、旅行挑地方时能从她钉的地方里挑", () => {
  assert.match(g, /\(card\.act === "date" \|\| card\.act === "offline"\) && typeof window !== "undefined" && window\.DatePlaces/);
  assert.match(a, /\+ \(window\.DatePlaces \? window\.DatePlaces\.hint\(\) : ""\)/);
});
