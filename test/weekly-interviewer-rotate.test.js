// 她 2026-09-23：「周刊目前采访固定有点无聊……每周从抽到的三版里面挑一个当采访人问问题，
// 这样每周出来的采访语气也不一样。然后这个也 log，每一种语气都轮过一轮后再重新新一轮抽。
// 不过这样以后会不会出现某一周的三个都已经被抽到去采访了、选不中的情况」——会，所以挑法是
// 【三版里挑最久没当过采访人的那一版】：从没当过的排最前，一定挑得出来。「花边也一起换」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const wk = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
const fn = name => { const i = wk.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return wk.slice(i, wk.indexOf("\n  }\n", i) + 4); };

const P = (() => {
  const ctx = {};
  vm.createContext(ctx);
  const i = wk.indexOf("const VOICES = ["), j = wk.indexOf("\n  ];", i) + 5;
  const craft = wk.slice(wk.indexOf("const REPORTER_CRAFT ="), wk.indexOf("function interviewerBlock("));
  vm.runInContext(wk.slice(i, j) + "\n" + craft + "\n" + ["normalizeVoiceId", "knownVoice", "issueStart", "interviewerFor", "interviewerOfIssue", "interviewerBlock"].map(fn).join("\n")
    + "\nthis.pick = interviewerFor; this.of = interviewerOfIssue; this.block = interviewerBlock; this.V = VOICES; this.REPORTER_VOICE = REPORTER_VOICE;", ctx);
  return ctx;
})();
const V = id => P.V.find(v => v.id === id);
// 桩照【写存档的那段】来：出刊时采访版存的是 { type: "interview", interviewerId }，期数按 weekOf.start 排
const issue = (start, ivBy) => ({ weekOf: { start }, sections: [{ type: "cover" }, Object.assign({ type: "interview", entries: [] }, ivBy ? { interviewerId: ivBy } : {})] });

test("三版里挑最久没当过采访人的：从没当过的排最前", () => {
  const past = [issue(100, "noir"), issue(200, "tabloid")];
  assert.equal(P.pick([V("noir"), V("tabloid"), V("markets")], past, 300).id, "markets", "从没当过的那一版没排最前");
  assert.equal(P.pick([V("noir"), V("tabloid")], past, 300).id, "noir", "都当过的时候，该挑最久没当的那一版");
});

test("她担心的那种周：三版都已经当过采访人——照样挑得出，不卡住", () => {
  const past = [issue(100, "noir"), issue(200, "tabloid"), issue(300, "markets")];
  const got = P.pick([V("markets"), V("tabloid"), V("noir")], past, 400);
  assert.ok(got, "这一周选不出采访人");
  assert.equal(got.id, "noir");
});

test("连着出十几期：每一版都轮得到，没有哪一版一直当", () => {
  const ids = P.V.map(v => v.id), past = [], count = {};
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let w = 1; w <= 30; w++) {
    const bag = ids.slice(), three = [];
    while (three.length < 3) three.push(bag.splice(Math.floor(rnd() * bag.length), 1)[0]);
    const who = P.pick(three.map(V), past, w * 100).id;
    count[who] = (count[who] || 0) + 1;
    past.push(issue(w * 100, who));
  }
  assert.equal(Object.keys(count).length, ids.length, "三十期里有一版一次都没当过采访人：" + JSON.stringify(count));
  assert.ok(Math.max(...Object.values(count)) <= 6, "有一版当得太多了：" + JSON.stringify(count));
});

test("只数这一期之前的；老期数（没有这一格）不算", () => {
  const past = [issue(100), issue(500, "noir")];     // 500 那期在本期之后（重生成老期数时）
  assert.equal(P.pick([V("noir"), V("tabloid")], past, 300).id, "noir", "拿后面那期的记录算前面这期，重生成老期数会把轮次打乱");
  assert.equal(P.of(issue(100)), null, "老期数该是老记者");
  assert.equal(P.of(issue(100, "noir")).id, "noir");
});

test("换的是嗓子，不是被采访的人；问法的规矩不变；花边一起换", () => {
  const b = P.block(V("victorian"));
  assert.match(b, /由本刊「维多利亚社交小报」那一版的笔来问、来写/);
  assert.ok(b.indexOf(V("victorian").world) > 0, "那一版的腔调没给到");
  assert.match(b, /只管【你】——你怎么发问、花边怎么写。被采访的人照旧用TA自己的声音/, "不写这句，维多利亚那版的禁用词会把答话的人也改成古话");
  assert.match(b, /先把你观察到的那个事实摆出来，再把问号压在它后面/, "换了采访人，问法的规矩丢了");
  assert.match(b, /署名仍是「本刊记者」，不给自己起名字/);
  assert.equal(P.block(null), "【叙述者人格 · 记者（NPC，非角色卡）】" + P.REPORTER_VOICE, "没挑出采访人时该退回老记者");
  // 花边：专访和狗仔在同一次调用里、同一个「你」写——采访人换了，花边跟着换
  assert.match(wk, /② 狗仔：同一个你，写一段花边小道消息/);
  assert.match(wk, /"\\n\\n" \+ interviewerBlock\(interviewer\) \+/);
});

test("出刊记下这一期是谁问的；补一位、重刷跟原来那位一样", () => {
  assert.match(wk, /const interviewer = interviewerFor\(weekVoices, loadIssues\(\), win\.start\);/);
  assert.match(wk, /type: "interview", entries: entries \}, interviewer \? \{ interviewerId: interviewer\.id \} : \{\}\)/);
  assert.equal((wk.match(/win\.label, window\.Weekly\.interviewerOfIssue\(issue\)\)/g) || []).length, 2, "补一位或重刷换了个采访人");
  assert.match(wk, /"本期采访人 · " \+ ivBy\.name/);
});
