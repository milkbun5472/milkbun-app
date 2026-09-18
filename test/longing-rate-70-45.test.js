// 她 2026-09-18：「我们思念值应该是不是固定的是要随机的根据各种 factor 本地算的」
//   「那你看看思念怎么算的，不应该每个人都一样的」。
// 原来 app.js 里那个 connectionRateFn 只认最后一条消息里的关键词，四个硬写的常量
//   （0.0003 / 0.0005 / 0.0010 / 0.0007）——换谁来都是那四个数。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../js/longing-rate.js");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fixed = o => L.compute({ ...o, rand: () => 0.5 });   // 抖动钉死，只看别的档

test("那四个硬写的常量真的没了，不是在旁边又加了一层", () => {
  assert.ok(!/if \(c\.length < 8\) return 0\.0010;/.test(app), "旧的那四档还留着");
  assert.match(app, /window\.LongingRate\.compute\(\{/, "没接上公共那层");
  assert.match(html, /<script src="js\/longing-rate\.js\?v=/, "文件没挂进 index.html，线上就是 undefined");
  // 读不到公共层时退回原来那个默认值，不许塌成 0（塌成 0 ＝ 所有人永远不想她）
  assert.match(app, /if \(typeof window === "undefined" \|\| !window\.LongingRate\) return 0\.0007;/);
});

test("两个人设不一样的角色，速度必须真的不一样", () => {
  const 黏人 = fixed({ charId: "c1", temperament: { socialBias: 0.68, sensitivity: { connection: 1.24 } }, affinity: 90 });
  const 清冷 = fixed({ charId: "c2", temperament: { socialBias: 0.28 }, affinity: 20 });
  assert.ok(黏人 > 清冷 * 2.5, "拉不开差距就等于没做：" + 黏人 + " vs " + 清冷);
});

test("连两个设定一模一样的角色也不完全一样（天生那一档）", () => {
  const a = fixed({ charId: "aaa" }), b = fixed({ charId: "bbb" });
  assert.notEqual(a, b);
  // ⚠️但天生这一档【不是随机】：同一个 id 每次都得是同一个数，
  //   不然今天黏人明天清冷，那不叫性格，叫抽奖。
  assert.equal(L.innateMul("aaa"), L.innateMul("aaa"));
  assert.ok(L.innateMul("aaa") >= 0.86 && L.innateMul("aaa") <= 1.14);
});

test("抖动那一档才是随机的，而且只在 ±10% 里动", () => {
  const lo = L.compute({ charId: "c1", rand: () => 0 });
  const hi = L.compute({ charId: "c1", rand: () => 1 });
  assert.ok(hi > lo, "一点都不抖＝思念是个秒表");
  assert.ok(hi / lo < 1.3, "抖太狠了，性格就被噪声盖过去了");
});

test("睡着的人不会一分钟比一分钟更想你", () => {
  const 醒着 = fixed({ charId: "c1", temperament: { socialBias: 0.68 } });
  const 睡着 = fixed({ charId: "c1", temperament: { socialBias: 0.68 }, seqType: "sleep" });
  assert.ok(睡着 < 醒着 * 0.35);
  // 但也不是停住：睡一夜起来该有点想（她说过「想我莫名其妙归零」那次的反面）
  assert.ok(睡着 > 0);
});

test("好感只许小幅参与：讨厌也是一种惦记", () => {
  assert.ok(L.affinityMul(0) >= 0.75 && L.affinityMul(100) <= 1.25);
  const 零好感 = fixed({ charId: "c1", affinity: 0 });
  assert.ok(零好感 > 0, "好感 0 的人被算成永远不想她");
});

test("认不出来的心情一律当 1，不猜", () => {
  assert.equal(L.moodMul("蓝色的星期四"), 1);
  assert.equal(L.moodMul(""), 1);
  assert.ok(L.moodMul("有点想她") > 1.2);
  assert.ok(L.moodMul("困") < 0.8);
});

test("每一档都读不到时，还是原来那个默认值附近——不许塌成 0、不许炸上天", () => {
  const 光秃秃 = fixed({ charId: "c1" });
  assert.ok(光秃秃 > L.BASE * 0.8 && 光秃秃 < L.BASE * 1.25, "什么都没配的角色被改了行为");
  assert.ok(L.compute({ charId: "c1", affinity: 999, temperament: { socialBias: 9 }, moodLabel: "想她", rand: () => 1 }) <= L.CEIL);
  assert.ok(L.compute({ charId: "c1", affinity: -999, temperament: { socialBias: -9 }, seqType: "sleep", moodLabel: "困", lastMessage: { content: "晚安" }, rand: () => 0 }) >= L.FLOOR);
});

test("性情读的是【已有那份】性情锚点，不另立一张词表", () => {
  // EmotionA 的 temperament 里就有 socialBias / sensitivity.connection，别在 longing-rate 里再抄一份黏人清单
  const lr = fs.readFileSync(path.join(root, "js/longing-rate.js"), "utf8");
  assert.ok(!/黏人\|依恋|socialBias:\s*\.68/.test(lr), "又抄了一份性情词表");
  assert.match(lr, /t\.socialBias/);
  assert.match(lr, /t\.sensitivity && t\.sensitivity\.connection/);
  // app.js 那头要真的把它预取出来喂进去
  assert.match(app, /const dongnianTemperRef = useRef\(\{\}\);/);
  assert.match(app, /await dongnianTemperSync\(char\.id\);/, "没人去刷那份缓存，等于永远是 null");
  assert.match(app, /temperament: dongnianTemperRef\.current\[char\.id\] \|\| null,/);
});

test("群里那一场不掺好感：思念冲的是群里的人，不是 Lisa", () => {
  assert.match(app, /affinity: gid \? 50 : affOf\(char\.id\),/);
});

test("「此刻在做什么」只算一份：schedNowFor 那几行抽出来了，没写第二遍", () => {
  assert.equal((app.match(/const schedNowTypeFor = char => \{/g) || []).length, 1);
  assert.match(app, /seqType: schedNowTypeFor\(char\)/);
  assert.equal((app.match(/schedCurrentSeqIdx\(disp, true, char\)/g) || []).length, 4,
    "算「此刻哪一段」的地方变多了——多出来那处多半又抄了一遍");
});
