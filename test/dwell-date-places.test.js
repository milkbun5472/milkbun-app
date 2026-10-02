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
  assert.match(a, /onDate: \(char, place\) => sendDateInvite\(char, place\)/);
});

test("约会券、TA开的线下、旅行挑地方时能从她钉的地方里挑", () => {
  assert.match(g, /\(card\.act === "date" \|\| card\.act === "offline"\) && typeof window !== "undefined" && window\.DatePlaces/);
  assert.match(a, /\+ \(window\.DatePlaces \? window\.DatePlaces\.hint\(\) : ""\)/);
});

test("约TA：先发邀请卡到线上，TA回话时决定（dateReply），答应了回一张回执，点「出发」才进见面", () => {
  const c = read("components.js");
  assert.match(a, /kind: "dateinvite"/);
  assert.match(a, /openCaps\.push\("dateReply"\)/);
  assert.match(a, /dateReply:"yes"\|"no"=回她的约会邀请；/);
  assert.match(a, /kind: "datereceipt"/);
  assert.match(a, /const dateGo = async \(charId, m\) => \{/);
  assert.match(c, /function DateInviteCard\(/);
  assert.match(c, /"出 发"/);
});

test("钉一个地方：先从下面现成的地方里挑（他的地方、常去、地图上的），挑不到再自己写", () => {
  assert.match(d, /const \[pinPick, setPinPick\] = useState\(false\);/);
  assert.match(d, /\[\]\.concat\(places\.map\(function \(p\) \{ return p\.name; \}\), todo\.map\(function \(f\) \{ return f\.name; \}\), mapPlaces\.map/);
  assert.match(d, /"从下面现成的里挑一个钉上："/);
  assert.match(d, /"自己写一个"/);
});

test("约会卡：两边带头像（跟位置卡、礼物卡一样）；发邀请不自动让TA回", () => {
  const c = read("components.js");
  assert.match(c, /function DateInviteCard\(\{ m, character, onGo, avatar, myAvatar \}\)/);
  assert.match(c, /!mine && avatar,/);
  assert.doesNotMatch(a, /setTimeout\(\(\) => replyNow\(char\.id, "", null, \{\}\), 600\)/);
});
