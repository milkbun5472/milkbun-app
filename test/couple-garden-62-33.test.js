// 花房（v62.33，她 2026-09-04 拍板）：花靠你们真实的相处长，不靠浇水按钮。
// 养料蹭抽卡那条已经在跑的事件流——GachaKit 判定「真的相处了一段」，花吃同一份；
// 判闸（90 分钟一段、日封顶）全在 GachaKit，花这头一条都不重写。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const K = require("../js/garden.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const now = 1700000000000;

test("引擎：没种不吃、吃了会长、到点开花、打盹不掉东西", () => {
  // 没种花（species 空）一口都不吃——花是他挑的，不是自动长出来的
  const empty = { species: "", fed: 0 };
  assert.equal(K.feed(empty, 40, now), empty, "没种也在长");
  // 吃了会长，lastFedTs 跟着走
  let g = { species: "小雏菊", fed: 0, lastFedTs: 0, bloomTs: 0 };
  g = K.feed(g, 40, now);
  assert.equal(g.fed, 40); assert.equal(g.lastFedTs, now);
  assert.equal(K.stageOf(g.fed).key, "sprout");
  // 一路吃到 480 开花，bloomTs 只记第一次
  g = K.feed(g, 440, now + 1000);
  assert.equal(K.stageOf(g.fed).key, "bloom");
  assert.equal(g.bloomTs, now + 1000);
  const again = K.feed(g, 40, now + 2000);
  assert.equal(again.bloomTs, now + 1000, "开花时刻被后面的喂食改写了");
  // 打盹只是姿态：一周没喂 dozing 为真，fed 一分不掉
  assert.equal(K.dozing({ species: "x", lastFedTs: now - 8 * 86400000 }, now), true);
  assert.equal(K.dozing({ species: "x", lastFedTs: now - 86400000 }, now), false);
});

test("养料只从 gachaEarn 那一处流进来，花这头不新造任何闸", () => {
  const earn = cut(app, "  const gachaEarn = (charId, kind) => {", "\n  };");
  assert.match(earn, /if \(r\.got > 0\) try \{ gardenFeed\(charId, r\.got\); \} catch \(e\) \{\}/, "花没蹭上同一条事件流");
  const feed = cut(app, "  const gardenFeed = (charId, amount) => {", "\n  };");
  assert.ok(!/SESSION_GAP|DAILY_CAP|dayPts/.test(feed), "花这头又写了一遍闸——那是 GachaKit 的活");
  assert.match(feed, /window\.GardenKit\.feed\(g, amount, Date\.now\(\)\)/, "没走 GardenKit.feed");
});

test("挑花是唯一花调用的一步：prompt 只给判据；收干花零调用、进册子", () => {
  const plant = cut(app, "const gardenPlantGen = async char => {", "\n  const gardenKeep");
  assert.match(plant, /换一对情侣照样成立的那一句，就是挑坏了/, "why 没给判据");
  assert.match(plant, /不是花语大全里最好听的那一种/, "会挑成花语大全");
  assert.ok(!/如「|例如|比如「/.test(plant), "提示词里塞了内容示范");
  assert.match(plant, /coupleKeep\(char\.id, /, "种下没凝记忆");
  const keep = cut(app, "  const gardenKeep = charId => {", "\n  //");
  assert.ok(keep.indexOf("runProbe") < 0 && keep.indexOf("callAI") < 0, "收干花不许花调用");
  assert.match(keep, /kept: \[\{ species: g\.species, why: g\.why, color: g\.color, ts: Date\.now\(\) \}/, "干花没进册子");
});

test("开花他主动来说：照纪念日那条路的闸，一茬只说一次", () => {
  const bloom = cut(app, "// —— 花开主动（v62.33）", "// —— 备忘录·到期提醒主动");
  ["laneBusy", "viewRef.current.charId === c.id", "hist(c).length < 2", "currentlyTogetherWithChar", "hr2 < 8 || hr2 > 23"]
    .forEach(gate => assert.ok(bloom.indexOf(gate) > 0, "少了这道闸：" + gate));
  assert.match(bloom, /if \(!g2 \|\| !g2\.bloomTs \|\| g2\.told\) continue;/, "会反复来说同一茬");
  assert.match(bloom, /DeliveryCommit\.once\("bloom:" \+ c\.id \+ ":" \+ g2\.bloomTs/, "没走 DeliveryCommit，会重发");
  assert.match(bloom, /told: true/, "说完没记，一茬会说好几遍");
  assert.match(app, /opts\.bloom \? "garden_bloom" :/, "出口没标，账上分不出这一条");
  assert.match(app, /opts\.bloom \? bloomHint :/, "hint 写了没接进链（v55.95 那个形状）");
  assert.match(app, /别写成植物播报、也别硬煽情/, "hint 没拦住播报腔");
});

test("窗台在墙上、花房整页、durable 与脚本都挂了", () => {
  const collage = cut(scr, "const wall = (k, o) =>", "只属于你俩的私密层");
  assert.match(collage, /wall\("garden"/, "墙上没有窗台");
  const page = cut(scr, "function CoupleGarden({", "\nfunction ");
  assert.match(page, /className: "h-full flex flex-col"/, "花房不是整页");
  assert.ok(page.indexOf("h(Sheet") < 0, "花房用了半窗");
  // ⚠️页里那句「没有进度条」的说明文字是给她看的，别让断言撞上自己人——只查真的进度条代码
  assert.ok(!/g\.fed \+ " \/|<progress|width: .{0,20}fed/.test(page), "长势做成数值进度条了——长到哪儿看它自己");
  assert.match(eng, /"x_coupleGarden"/, "没登记 durable");
  assert.match(html, /js\/garden\.js\?v=/, "index.html 没挂 garden.js");
});
