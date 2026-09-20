const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「有些角色之前还会不在句尾加句号的，然后上下文污染了一下之后又开始加了」。
// 查下来是回归：旧的 ANTI_CLICHE_LEGACY 里有明确的第⑨条「标点像真人打字…日常发消息大多不打句号」，
// v52.48 那次 prompt v2 重写把它丢了，只剩「标点没有固定格式，自然决定」——
// 于是唯一的标点信号变成了聊天记录本身，一旦被污染就自我强化，再也回不来。

// 把常量原样抠出来，验的是【真正发给模型的那段字】，不是源码里有没有这行注释
const grabConst = name => {
  const i = engine.indexOf("const " + name + " = `");
  assert.ok(i >= 0, "找不到 " + name);
  const start = engine.indexOf("`", i) + 1;
  return engine.slice(start, engine.indexOf("`", start));
};
const ONLINE = grabConst("ONLINE_CHAT_RULE_V2");

test("句尾不打句号这条规则回来了，而且说得可判定", () => {
  assert.match(ONLINE, /标点按【手机打字】来，不按【写文章】来/);
  assert.match(ONLINE, /日常消息句尾不打句号/);
  // 传语气的标点不能一起误杀
  ["问号", "感叹号", "省略号", "波浪号"].forEach(k =>
    assert.ok(ONLINE.includes(k), "传语气的标点要留着：" + k));
});

// ⚠️v70.19 她点名把【这一条不跟聊天记录走】那一整段删了（精简那一摞时）。
//   **这一段当初正是为了治她 2026-08-22 报的那个 bug**（见本文件开头）：
//   上文一旦被句号污染就自我强化，再也回不来。删掉之后，
//   剩下的只有上面那句「日常消息句尾不打句号」——它说了该怎么打，
//   **没说「别跟着记录学」**，也没了「老派人设可以打全标点」那个窄例外。
//   所以这一条改成【记住它被删过】：要是哪天她又报「聊着聊着又开始加句号了」，
//   第一个该看的就是这儿，而不是再去别处找新病因。
test("标点那条只剩「怎么打」，没有「别跟记录学」——她点名删的，记在这儿", () => {
  assert.match(ONLINE, /日常消息句尾不打句号/, "连怎么打都没了那就是删过头了");
  assert.ok(!/是上文被污染了/.test(ONLINE), "又被加回来了？那得先跟她确认一次");
  // 窄例外也跟着走了：人设写着老派的角色现在也会被要求不打句号
  assert.ok(!/只有【人设卡里明写了】/.test(ONLINE));
});

// 同一个矛盾又犯了一次（v56.89）：这份清单里当初还留着「断句」，而它和下面那条
// 「一条消息＝一句话」直接打架——模型挑省事的那条听，于是一条里塞两三句。
// 她 2026-08-27 拿参考 app 对了一轮：总字数两边一样，平均每条 10~13 对 17~21，差的全在断句。
test("「没有固定格式」的清单里，标点和断句都不能再有", () => {
  assert.ok(!/断句、标点和完整程度没有固定格式/.test(ONLINE), "标点当年就该拆走");
  assert.ok(!/数量、长度、断句和完整程度没有固定格式/.test(ONLINE), "断句也要拆走，它跟下面那条硬规则打架");
  assert.match(ONLINE, /一轮说几条、总共说多长，没有固定格式/, "数量和总长仍旧自由，这半不许收");
});

test("断句给一条硬的：一条消息＝一句话", () => {
  assert.match(ONLINE, /【说多少自由，一条里塞几句不自由】一条消息＝一句话/);
  // ⚠️原来钉的是「别拿逗号把两三句缝进同一条」。这条守的是【别缝在一起】，
  //   不是那个「两三」——那一族数字正是默认三个气泡的来源（no-bubble-count-anchor-71-99）。
  assert.match(ONLINE, /别拿逗号把几句话缝进同一条/);
  // 群聊只把「word 只包含」换成「每条 text 只包含」，所以这段不能点字段名，两处才都读得通
  assert.ok(!/一个 word 元素＝一句话/.test(ONLINE), "写死 word 的话，群聊那份读起来就是错的");
});

test("单聊和群聊两条线路都真的拿到这段字", () => {
  // 单聊：engineerEyes 之外都拼 ONLINE_CHAT_RULE_V2
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/);
  // 群聊：只把第一段的字段名换掉，后面整段照带
  const m = app.match(/ONLINE_CHAT_RULE_V2\.replace\("([^"]+)", "([^"]+)"\)/);
  assert.ok(m, "群聊那处的改写形状变了，得重新确认标点规则还在不在");
  const groupRule = ONLINE.replace(m[1], m[2]);
  assert.match(groupRule, /日常消息句尾不打句号/, "群聊也必须带上");
  // 【这一条不跟聊天记录走】v70.19 删了（见上），这儿不再钉它
  assert.match(groupRule, /每条 text 只包含/, "字段名替换本身要还生效");
});

test("只管线上打字，不许波及线下叙事和写字类产出", () => {
  // ONLINE_CHAT_RULE_V2 只在这两处注入；线下/日记/情书走的是另外的规则常量。
  // 只数【真的注入】的那几行——注释里提到它不算（v54.81 兜底那段注释就提了一次）。
  const inject = app.split("\n").filter(l => l.includes("ONLINE_CHAT_RULE_V2") && !/^\s*\/\//.test(l));
  assert.equal(inject.length, 2, "注入点数量变了，确认没被塞进线下或日记：\n" + inject.join("\n"));
  assert.ok(!grabConst("NARRATIVE_ANTI_CLICHE_LEGACY_V1").includes("句尾不打句号"),
    "线下是叙事散文，标点该好好打");
});
