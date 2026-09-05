const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");

test("塔罗保留原入口、基础与主题牌阵册和 1 至 8 位自定义牌阵", () => {
  for (const mode of ["reading", "relation", "daily", "forchar"]) {
    assert.match(tarot, new RegExp(mode + ":\\s*\\{"));
  }
  for (const spread of ["guide", "single", "timeline", "choice", "love", "relation5", "unsaid", "story", "closeness", "shortterm", "blindspot", "healing", "desire"]) {
    assert.match(tarot, new RegExp(spread + ":\\s*\\{"));
  }
  assert.match(tarot, /const SPREAD_GROUPS =/);
  assert.match(tarot, /basic: \{ zh: "基础"/);
  assert.match(tarot, /relation: \{ zh: "关系"/);
  assert.match(tarot, /inner: \{ zh: "自我"/);
  assert.match(tarot, /const \[spreadGroup, setSpreadGroup\]/);
  assert.match(tarot, /allSpreads\[k\]\.group \|\| "basic"/);
  assert.match(tarot, /const allSpreads = Object\.assign\(\{\}, SPREADS\)/);
  assert.match(tarot, /x_tarot_custom_spreads/);
  assert.match(tarot, /positions\.length < 1 \|\| positions\.length > 8/);
  assert.match(tarot, /自己写 1～8 个牌位/);
});

test("新占卜由用户亲手选牌且模型看不到未选牌", () => {
  assert.match(tarot, /const \[deal, setDeal\]/);
  assert.match(tarot, /完整 78 张/);
  assert.match(tarot, /pool: shuffle\(DECK\)\.map/);
  assert.match(tarot, /pending: null, shuffleNo: 1/);
  assert.match(tarot, /const confirmCard/);
  assert.match(tarot, /重新洗牌（清空已选）/);
  assert.match(tarot, /牌会抬起；按确认后才算抽到/);
  assert.match(tarot, /chosen\.length !== spread\.length/);
  assert.match(tarot, /const cards = deal\.chosen\.map\(i => deal\.pool\[i\]\)/);
  assert.match(tarot, /模型看不到没选中的牌/);
  assert.match(tarot, /revealed: \[\], supplements: \[\]/);
});

test("78 张真实牌面使用本地图片并兼容旧存档", () => {
  assert.match(tarot, /const MAJOR_FILES =/);
  assert.match(tarot, /assets\/tarot-rws\//);
  assert.match(tarot, /function cardImage\(c\)/);
  assert.match(tarot, /h\("img", \{ src: cardImage\(c\)/);
  const cards = fs.readdirSync(path.join(root, "assets/tarot-rws")).filter(x => /\.jpg$/i.test(x));
  assert.equal(cards.length, 78);
});

test("解牌输出包含高预算的占卜师综合总结", () => {
  assert.match(tarot, /readerSummary（220~520 字）/);
  assert.match(tarot, /StylePresets\.OUT_CEILING/);
  assert.match(tarot, /\|\| 65535/);
  // v63.01 no-english-titles：中英夹着的那半英文删掉
  assert.match(tarot, /"占卜师总结"/);
  assert.match(tarot, /readerSummary: out\.readerSummary/);
});

test("结果页逐张翻牌并提供不耗模型的本地牌义", () => {
  assert.match(tarot, /function cardReference\(c\)/);
  assert.match(tarot, /const oldSession = !Array\.isArray\(s\.revealed\)/);
  assert.match(tarot, /const allRevealed = cards\.every/);
  assert.match(tarot, /全部翻完才揭示完整解读/);
  assert.match(tarot, /allRevealed \? \(s\.reads \|\| \[\]\)\.map/);
});

test("补牌精确挂到牌位且整副最多三张", () => {
  assert.match(tarot, /async function readSupplement/);
  assert.match(tarot, /supplements\.length >= 3/);
  assert.match(tarot, /posIndex: i/);
  assert.match(tarot, /为这个牌位补一张/);
});

test("塔罗详情返回后恢复历史滚动位置", () => {
  assert.match(tarot, /const homeScrollRef = useRef\(null\)/);
  assert.match(tarot, /homeScrollTop\.current = homeScrollRef\.current\.scrollTop/);
  assert.match(tarot, /homeScrollRef\.current\.scrollTop = top/);
});

test("角色可自己选问题，给角色算卦前允许接受犹豫或拒绝", () => {
  assert.match(tarot, /async function askReadingIntent/);
  assert.match(tarot, /accept\|hesitate\|refuse/);
  assert.match(tarot, /intent\.decision === "refuse"/);
  assert.match(tarot, /return \{ refused: true, intent: intent \}/);
  assert.match(tarot, /让 Ta 自己问/);
});

test("桌边追问单独留在塔罗存档，不直写正式记忆或主聊天", () => {
  assert.match(tarot, /async function continueAtTable/);
  assert.match(tarot, /小桌边继续聊/);
  assert.match(tarot, /followups: done/);
  const follow = tarot.slice(tarot.indexOf("async function continueAtTable"));
  assert.doesNotMatch(follow, /addMemEntry\(/);
  assert.doesNotMatch(follow, /saveJSON\("x_chat:/);
});

test("给角色算一卦的转发按钮在牌面前可见，并明确回执", () => {
  const questionAt = tarot.indexOf('s.mode !== "daily" && s.question');
  const forwardAt = tarot.indexOf('"把这一卦转发给 " + s.charName');
  const cardsAt = tarot.indexOf('// 牌阵', questionAt);
  assert.ok(questionAt >= 0 && forwardAt > questionAt && forwardAt < cardsAt);
  assert.match(tarot, /setForwarded\(true\)/);
  assert.match(tarot, /已转发给/);
});

test("店主只作为低存在感环境，不替角色解牌", () => {
  assert.match(tarot, /const SHOP_MOMENTS/);
  assert.match(tarot, /店主退到书架后面，把这张小桌留给你们/);
  // v60.78 起这一句改成解牌时顺便生成（她 2026-09-03：本地五句转两轮就眼熟了），
  // 本地那几句退成兜底。⚠冻的是【它只是环境】，不是它从哪儿来：
  // 生成的那一句同样不许点评牌面、不许提问题、不许替角色说话
  assert.match(tarot, /shopMoment: out\.moment \|\| shopMoment/);
  assert.match(tarot, /别写心理活动、别点评牌面、别提问题内容/);
});
