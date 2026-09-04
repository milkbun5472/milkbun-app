// 她 2026-09-04 亲手给了一份秋秋的新提示词，要求换上去。
//
// ⚠️换默认这件事有个老坑：她那份是【存下来的拷贝】，改了默认她那边一个字都不会变
//   （SKIN_VER 那次一模一样：内置改了、她手上还是旧的、界面什么都没说，看着像我没改）。
//   所以这一版把历次旧默认逐字记下来：她那份原样等于其中一版＝她从没自己动过 → 自动跟上新的；
//   她自己改过一个字就绝不覆盖。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/assistant.js"), "utf8");

function load(stored) {
  const g = {};
  global.window = g;
  global.localStorage = {
    _v: stored === undefined ? null : JSON.stringify({ prompt: stored }),
    getItem(k) { return k === "x_assistCfg" ? this._v : null; },
    setItem() {}, removeItem() {}
  };
  global.document = { readyState: "complete", addEventListener() {}, head: { appendChild() {} },
    getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {}, classList: { add() {} } }),
    documentElement: {}, body: { appendChild() {} }, querySelector: () => null };
  global.React = { createElement: () => null, useRef: () => ({}), useState: () => [null, () => {}], useEffect() {}, Fragment: "f" };
  global.h = () => null; global.useState = () => [null, () => {}]; global.useEffect = () => {}; global.useRef = () => ({});
  global.useTheme = () => ({}); global.F_BODY = ""; global.F_DISPLAY = "";
  delete require.cache[require.resolve("../js/assistant.js")];
  require("../js/assistant.js");
  return g.Assistant;
}

test("换上她给的那一份，逐字照抄", () => {
  const A = load(undefined);
  const p = A.DEFAULT_PROMPT;
  // 她那份的头尾和几处只有她会这么写的句子——挑几句钉住，别润色
  assert.ok(p.startsWith("你是秋秋，住在这台手机里的小肥鸟向导。"), "开头不是她给的那一句");
  assert.ok(p.trim().endsWith("可爱来自你本来就是秋秋，不需要时时提醒别人你很可爱。啾。"), "结尾那一句不见了");
  for (const line of [
    "你的口癖是「啾」，会自然地混在说话里，频率不固定。",
    "但不会句句都啾，也不会连续啾个不停。",
    "不为了显得周到而硬凑注意事项。",
    "你是一只认真帮她看着这台小手机的小肥鸟。"
  ]) assert.ok(p.includes(line), "少了这一句：" + line);
  // 旧那份的味道不许残留
  assert.ok(!p.includes("机灵、稳当、不端着"), "旧默认那段性格还在");
  assert.ok(!p.includes("偶尔用一个 emoji"), "旧默认那句 emoji 还在");
});

test("她那份还是旧默认 → 自动跟上；她自己改过 → 绝不覆盖", () => {
  const NEW = load(undefined).DEFAULT_PROMPT;
  // ① 从没设过
  assert.equal(load(undefined).loadCfg().prompt, NEW);
  // ② 存的还是历次旧默认里的某一版（＝她从没自己动过）
  const olds = load(undefined).LEGACY_PROMPTS;
  assert.ok(Array.isArray(olds) && olds.length >= 1,
    "没有 LEGACY_PROMPTS——那改了默认，她那份存下来的永远不会跟上");
  // ⚠️这几串是【历史档案】：她 localStorage 里存的就是那些字，改一个字这道匹配就失效，
  //   她那份永远升不上来，而且什么都不会报错。所以按内容指纹钉死——
  //   它不是「写得好不好」的问题，是「跟她机器上那份一模一样」的问题。
  const crypto = require("node:crypto");
  const sum = olds.map(o => crypto.createHash("sha256").update(o).digest("hex").slice(0, 12));
  assert.deepEqual(sum, ["6c5768971baa"],
    "旧默认那几串被动过了（或者新增了一版没登记）。它们是历史档案，不许润色；\n" +
    "  真要新增一版，把新指纹加进这个名单：" + JSON.stringify(sum));
  for (const old of olds) assert.equal(load(old).loadCfg().prompt, NEW, "她那份还是旧默认，却没跟上新的");
  // ③ 她自己写过的
  assert.equal(load("我自己写的").loadCfg().prompt, "我自己写的", "把她自己写的覆盖掉了");
  // ④ 她按过清空（存的是空串）——那是她的选择，别拿默认塞回去
  assert.equal(load("").loadCfg().prompt, "", "清空按钮又变成假的了");
});

test("这份预设只放「它是谁、怎么说话、干哪两件事」", () => {
  // 结构那几样（能改哪几件、代码那道门、输出成什么形状）不许混进来：
  // 那是安全面和契约，被她随手删一行就会出事。
  const A = load(undefined);
  const p = A.DEFAULT_PROMPT;
  for (const leak of ["JSON", "字段", "patch", "schema", "工具调用"])
    assert.ok(!p.includes(leak), "预设里混进了结构/契约：" + leak);
  // 她能改的那两件事本身要写清楚
  assert.ok(p.includes("先准备一份具体的改动稿给她看"), "「先出稿再落地」这条没了");
  assert.ok(p.includes("不知道的事情不要猜"), "诚实那条没了");
});
