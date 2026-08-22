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

test("关键的一条：标点不跟聊天记录走（这才是治污染的）", () => {
  assert.match(ONLINE, /【这一条不跟聊天记录走】/);
  assert.match(ONLINE, /是上文被污染了：别跟着学，从这一条起纠回来/);
  // 例外必须窄：只认人设卡明写，不许从「沉稳」「年长」自行推断
  assert.match(ONLINE, /只有【人设卡里明写了】/);
  assert.match(ONLINE, /「性格沉稳」「年纪大一些」都不算/);
});

test("矛盾要拆掉：「没有固定格式」的清单里不能再有标点", () => {
  assert.ok(!/断句、标点和完整程度没有固定格式/.test(ONLINE),
    "一边说标点自由一边说别打句号，模型只会挑好听的那条听");
  assert.match(ONLINE, /消息的数量、长度、断句和完整程度没有固定格式/);
});

test("单聊和群聊两条线路都真的拿到这段字", () => {
  // 单聊：engineerEyes 之外都拼 ONLINE_CHAT_RULE_V2
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/);
  // 群聊：只把第一段的字段名换掉，后面整段照带
  const m = app.match(/ONLINE_CHAT_RULE_V2\.replace\("([^"]+)", "([^"]+)"\)/);
  assert.ok(m, "群聊那处的改写形状变了，得重新确认标点规则还在不在");
  const groupRule = ONLINE.replace(m[1], m[2]);
  assert.match(groupRule, /日常消息句尾不打句号/, "群聊也必须带上");
  assert.match(groupRule, /【这一条不跟聊天记录走】/);
  assert.match(groupRule, /每条 text 只包含/, "字段名替换本身要还生效");
});

test("只管线上打字，不许波及线下叙事和写字类产出", () => {
  // ONLINE_CHAT_RULE_V2 只在这两处注入；线下/日记/情书走的是另外的规则常量
  const hits = (app.match(/ONLINE_CHAT_RULE_V2/g) || []).length;
  assert.equal(hits, 2, "注入点数量变了，确认没被塞进线下或日记");
  assert.ok(!grabConst("NARRATIVE_ANTI_CLICHE_LEGACY_V1").includes("句尾不打句号"),
    "线下是叙事散文，标点该好好打");
});
