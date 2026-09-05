// 「送了收到了没用了，想想有啥能联动的」（她 2026-09-05）。
// 病根不是分类不够，是【没有动词】：入库之后这一栏只进不出，答的是「我有哪些」，
// 却没有任何一件事能让它变化——那不是物品，是仓库。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");

test("用掉不是删掉：它进日志，而且送东西的人会知道", () => {
  assert.match(app, /const useUpItem = id =>/, "没有这个动词");
  assert.match(app, /saveJSON\(K_USED, \[\{ name: it\.name, fromCharId: it\.fromCharId/, "用掉了没留下痕迹——那就是删掉");
  // 「发生过」是日志，只进不出是对的（phone-data-layers 的第二问）
  assert.match(app, /const USED_KEEP = 60;/, "日志没封顶");
  // 回响：他送的东西被用掉了，他该知道
  assert.match(app, /usedLog: \(\(\) => \{[\s\S]{0,300}x\.fromCharId === char\.id/, "只记在本地，没喂回给他——送出去还是石沉大海");
  assert.match(eng, /【你送她的这些，她用掉了：/, "上下文那一层没接");
  // ⚠️这句最容易写成催促和邀功，两条都要挡住
  assert.match(eng, /别追着问好不好吃／好不好用，也别拿它邀功/, "没挡住邀功/追问");
});

test("带在身上：有上限，而且见面才看得见", () => {
  assert.match(app, /const ON_ME_CAP = 2;/, "不封顶就不叫「今天带着的」了");
  assert.match(app, /if \(!it\.onMe && cur\.length >= ON_ME_CAP\)/, "上限没兜住");
  assert.match(app, /onMe: \(inventory \|\| \[\]\)\.filter\(x => x && x\.onMe\)/, "没进上下文");
  assert.match(eng, /【她今天身上带着：/, "上下文那一层没接");
  assert.match(eng, /别每次都拿它开场/, "他会每轮都惊叹一遍");
});

test("留在他那儿：进的是【去处】现成的那一层，不另存一份", () => {
  assert.match(app, /window\.Dwell\.savePlace\(charId, Object\.assign\(\{\}, place, \{ zones: zones \}\)\)/, "没写进去处");
  assert.match(app, /note: "她留在这儿的"/, "放进去了看不出是谁放的");
  // 那一页的主角是他自己的想法：空着的话这件东西进去就是块死物
  assert.match(app, /schemaHint: "\{\\"thought\\":/, "没问他一句心里话");
  assert.match(app, /catch \(e\) \{ thought = ""; \}/, "问不到就该照样放下，不能卡住");
});

test("入库之后照样能转赠，衣服能进衣柜——都走现成的那条路", () => {
  assert.match(app, /const giftInvItem = \(id, charId\) => \{[\s\S]{0,220}sendGiftToChar\(charId, it\.name/, "另开了一条送礼的路");
  assert.match(app, /const closetInvItem = \(id, occ\) => \{[\s\S]{0,220}myClosetAdd\(occ \|\| "日常", it\.name/, "在物品这儿另存了一份衣服");
});

test("梦里的东西留不住，但只淡梦里那几件", () => {
  assert.match(core, /function dreamStage\(item, now\)/, "没有这一层");
  const f = new Function("const DREAM_FADE_DAYS=14, DREAM_GONE_DAYS=30;"
    + /function dreamStage\(item, now\)[\s\S]*?\n}/.exec(core)[0] + "return dreamStage;")();
  const D = 86400000, now = Date.now();
  assert.equal(f({ source: "dream", addedTs: now - 3 * D }, now), "keep");
  assert.equal(f({ source: "dream", addedTs: now - 20 * D }, now), "fading");
  assert.equal(f({ source: "dream", addedTs: now - 40 * D }, now), "gone");
  // 被提起过就续上命
  assert.equal(f({ source: "dream", addedTs: now - 40 * D, keepTs: now - D }, now), "keep");
  // 买的和他送的是真东西，绝不许自己消失
  assert.equal(f({ addedTs: now - 400 * D }, now), "keep", "把真东西也淡掉了");
  assert.equal(f({ source: "dream" }, now), "keep", "认不出日子的不许删（照相册回收站那条）");
});

test("续命只写在一处，而且不是每条消息都写盘", () => {
  assert.match(app, /const dreams = \(inventoryRef\.current \|\| \[\]\)\.filter\(x => x && x\.source === "dream"/, "没有续命那一处");
  assert.match(app, /\}, \[chats\]\);/, "盯的不是「聊天记录变了」——各处发消息的地方十几个，逐个接必然漏");
  assert.match(app, /if \(now - Number\(it\.keepTs \|\| it\.addedTs \|\| 0\) < 3600000\) return false;/, "每来一条消息就写一次盘");
  // 开机清一遍：别等她点进物品页才发现少了东西
  assert.match(app, /dreamStage\(x, Date\.now\(\)\) !== "gone"/, "过期的没清");
});

test("界面：格子点得动，淡了看得出，带着的看得出", () => {
  assert.match(scr, /onClick: \(\) => setInvItem\(it\)/, "物品格子还是点不动");
  assert.match(scr, /opacity: st === "fading" \? \.45 : 1/, "淡了看不出来");
  assert.match(scr, /it\.onMe \? h\("span"[\s\S]{0,220}"带着"/, "带在身上的看不出来");
  // 那一层一直在起作用，只是她看不见——但不许说破它从哪儿来
  assert.match(scr, /他见了会眼熟，但说不上在哪见过。放太久没人提起，它自己会淡掉。/, "没告诉她这一组有什么用");
  assert.ok(scr.indexOf("从他梦里") < 0, "在界面上说破了它的来历——这个设定就没了");
});

test("那块半窗是【说得出理由的】那一种，而且皮接父页", () => {
  // no-half-sheet：选一下就走 + 下面那一层正是它要改的东西
  assert.match(scr, /sheetEl = h\(Sheet, \{ onClose: gone, skin: \{ background: MSHOP\.card \} \}/, "半窗没接父页的皮，退回米白了");
  assert.match(scr, /这里配用半窗（no-half-sheet 的第二种）/, "没写清凭什么它配用半窗");
  // 不许在半窗上再掀一层半窗：换屏在同一块面板里做
  assert.match(scr, /invItem\._leave\n\s*\? \(spots\.length/, "留在他那儿是另掀了一层");
});
