// 她 2026-09-13 追问的那句：「那问题是我里面那么多牌阵和不同的问法，他怎么选」。
//
// v67.69 那一格只让他挑 mode（reading/relation/daily），可牌桌上真正摆得出来的是
// 十三个牌阵 + 她自己存的那几个，外加「这问题是谁的」那一档。他手上没有这份名单，
// 就只能永远落在那一档的默认牌阵上——那等于代码替他挑好了，他挑的那一下是假的。
//
// 办法是【把真名单给他】，不是替他挑一个：名单只有一份（Tarot.spreadMenu），
// 认不出来的名字一律落回默认，不硬塞一个她没有的牌阵进去。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 真跑那份名单：把 SPREADS 那一段抠出来，自定义牌阵按【她真正存的那个形状】给
// （tarot.js 写盘那头：{id, name, positions[]}，见 loadCustomSpreads 的过滤条件）
const mkMenu = customs => {
  const i = tarot.indexOf("  const SPREADS = {");
  const j = tarot.indexOf("  const SHOP_MOMENTS");
  const k = tarot.indexOf("  Tarot.spreadMenu = function (modeKey) {");
  const k2 = tarot.indexOf("  window.Tarot = Tarot;");
  const body = tarot.slice(i, j) + "\nconst Tarot = {};\n" + tarot.slice(k, k2) + "\nreturn Tarot;";
  return new Function("loadJSON", "saveJSON", body)(() => customs, () => {});
};

test("名单是真的：十三个内置的 + 她自己存的那几个，每个带几张牌", () => {
  const T = mkMenu([{ id: "x1", name: "我的三张", positions: ["一", "二", "三"] }]);
  const menu = T.spreadMenu("reading");
  assert.equal(menu.length, 14, "名单漏了（或者多编了一个她没有的）");
  const guide = menu.filter(x => x.key === "guide")[0];
  assert.deepEqual(guide, { key: "guide", zh: "三张指引", n: 3, group: "basic" });
  const mine = menu.filter(x => x.key === "custom:x1")[0];
  assert.deepEqual(mine, { key: "custom:x1", zh: "我的三张", n: 3, group: "custom" });
  // 每日一牌固定一张，没得挑——就别给他一张挑不了的单子
  assert.deepEqual(T.spreadMenu("daily"), []);
  // 认名字这一关：她没有的一律认不出来
  assert.equal(T.hasSpread("unsaid"), true);
  assert.equal(T.hasSpread("custom:x1"), true);
  assert.equal(T.hasSpread("custom:没有这个"), false);
  assert.equal(T.hasSpread("凯尔特十字"), false, "他编一个牌阵名就通过了");
  assert.equal(T.hasSpread(""), false);
  assert.equal(T.defaultSpread("reading"), "guide");
});

test("发给他的那一格里有这份真名单，而且不是代码替他挑", () => {
  const seg = app.slice(app.indexOf('const roomTarotOn = roomActionOn("tarot");'), app.indexOf("// ⚠️这一条必须挂在【Protocol v2】上"));
  assert.match(seg, /window\.Tarot\.spreadMenu\("reading"\)/, "名单另抄了一份");
  assert.match(seg, /spreadMenu\.map\(x => x\.key \+ "=" \+ x\.zh \+ "·" \+ x\.n \+ "张"\)/);
  assert.match(seg, /拿不准就留空/, "没给他「不挑」这条路");
  // 问法那一档也给了：问的是她的事，还是他自己的事
  assert.match(seg, /asker：you＝这一卦问的是她的事/);
  assert.match(seg, /me＝你自己想问的事/);
  assert.match(seg, /daily＝今日一牌（固定一张，不用填 spread）/);
});

test("他报了个她没有的牌阵：当他没挑，不硬塞", () => {
  const seg = app.slice(app.indexOf("if (roomTarotOn && parsed.tarotInvite"), app.indexOf("if (roomGamesOn && parsed.gameInvite"));
  assert.match(seg, /T0 && T0\.hasSpread && T0\.hasSpread\(tv\.spread\)\) \? String\(tv\.spread\) : ""/);
  assert.match(seg, /mode !== "daily"/, "每日一牌那一档还在认牌阵");
  // 卡上那一行要写清楚是哪一个牌阵（她点开之前就看得见）
  assert.match(seg, /sessionTitle: modeZh \+ \(spreadZh \? " · " \+ spreadZh : ""\)/);
  // v67.72：他明说了就听他的，没说才按档位给默认（forchar 那一档默认是 me）
  assert.match(seg, /asker: String\(tv\.asker \|\| ""\) === "me" \? "me" : \(String\(tv\.asker \|\| ""\) === "you" \? "you" : \(mode === "forchar" \? "me" : "you"\)\)/);
});

test("点开之后：牌阵、那一组、问法都替她落好，但都只是默认值", () => {
  assert.match(app, /ask: String\(m\.ask \|\| ""\), spreadKey: String\(m\.spread \|\| ""\), asker: String\(m\.asker \|\| "you"\)/);
  assert.match(tarot, /spreadKey: Tarot\.hasSpread\(e\.spreadKey\) \? String\(e\.spreadKey\) : ""/,
    "塔罗这头没再认一次——房里存着的老卡上可能写着一个她后来删掉的牌阵");
  assert.match(tarot, /owner: e\.asker === "me" \? "character" : ""/);
  assert.match(tarot, /const \[spreadKey, setSpreadKey\] = useState\(props\.initSpreadKey \|\| DEFAULT_SPREAD\[props\.modeKey\] \|\| "guide"\);/);
  assert.match(tarot, /const \[questionOwner, setQuestionOwner\] = useState\(props\.initOwner \|\| "user"\);/);
  // 他挑的牌阵在哪一组就先翻到哪一组，不然她看见的是另一组，像没生效
  assert.match(tarot, /\(SPREADS\[props\.initSpreadKey\] \|\| \{\}\)\.group/);
  assert.match(tarot, /String\(props\.initSpreadKey\)\.indexOf\("custom:"\) === 0 \? "custom" : ""/);
  // 卡上那句话按问法分两种说法
  assert.match(comp, /\(m\.asker === "me" \? "他自己想问的：" : "想替你问的："\)/);
});
