// 四层手机数据模型
//
//   🔒 硬钉死 PHONE_STICKY —— 号码、账号 id、过敏和真忌口。变了就等于换了个人。
//   🌱 缓慢演化 PHONE_EVOLVE —— 昵称、签名、给她的备注、对她的评价、住址、口味偏好。
//      默认沿用，但允许变：关系会长，人会搬家。钉死等于他永远拿第一次的眼光看她。
//   📚 累积日志 PHONE_GROW —— 发生过的事。
//   ♻️ 当前快照（不登记）—— 只表示此刻，名册必须能出。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const P = new Function(phoneSrc + "; return { PHONE_STICKY, PHONE_EVOLVE, PHONE_GROW, PHONE_EVOLVE_CHURN, phoneKeepIdentity, phoneEvolveMerge, phoneMergeSaved, phoneIdentityBlock, phoneEvolveBlock, phoneProbeSpec, PHONE_APPS, PHONE_LIVE_KEYS };")();
const char = { name: "某人" };

// ── 🔒 硬钉死 ──────────────────────────────────────────────

test("🔒 只收真·身份：号码、账号 id、过敏与真忌口", () => {
  // 判据：这一栏变了，是「他变了」还是「系统忘了」？只有换个人才会变的才进这层。
  const flat = Object.keys(P.PHONE_STICKY).reduce((a, k) => a.concat(P.PHONE_STICKY[k]), []);
  // 邮箱地址和账号 id 是一回事：换了就是换了个账号
  flat.forEach(pt => assert.ok(
    /(uid|Id|number|addr|avoidTags)$/.test(pt),
    pt + " 不该硬钉死——它会随关系和生活变，属于 🌱"));
});

test("🔒 刷新之后账号 id 和真忌口原样留着", () => {
  const old = { account: { uid: "1043827", name: "旧昵称" }, taste: { avoidTags: ["生姜丝"], likeTags: ["羊肉"] } };
  const gen = { account: { uid: "9999999", name: "新昵称" }, taste: { avoidTags: ["香菜"], likeTags: ["牛肉"] } };
  const out = P.phoneKeepIdentity("takeout", old, gen);
  assert.equal(out.account.uid, "1043827");
  assert.deepEqual(out.taste.avoidTags, ["生姜丝"], "过敏和真忌口是身体的事，不是心情");
  // 🌱 那几项这一层不管
  assert.equal(out.account.name, "新昵称");
  assert.deepEqual(out.taste.likeTags, ["牛肉"]);
});

// ── 🌱 缓慢演化 ────────────────────────────────────────────

test("🌱「对你的评价」绝不许硬钉死", () => {
  // 钉死等于关系长了他还拿第一次见面的眼光看你（Codex 2026-08-29 指出，是我做错了）
  assert.ok(P.PHONE_STICKY.wechat.indexOf("userContact") < 0, "对你的评价被硬钉死了");
  assert.ok(P.PHONE_EVOLVE.wechat.indexOf("userContact") >= 0, "对你的评价该在 🌱 层");
  // 备注、昵称、签名同理：恋爱、吵架、和好都会改
  ["me.wechatName", "me.signature"].forEach(pt =>
    assert.ok(P.PHONE_EVOLVE.wechat.indexOf(pt) >= 0, pt + " 该在 🌱 层"));
});

test("🌱 地址不许硬钉死——会搬家，也会多出「她家」那一条", () => {
  ["shopping", "takeout"].forEach(k => {
    assert.ok((P.PHONE_STICKY[k] || []).indexOf("addrs") < 0, k + " 的地址被硬钉死了");
    assert.ok(P.PHONE_EVOLVE[k].indexOf("addrs") >= 0, k + " 的地址该在 🌱 层");
  });
});

test("🌱 口味要拆：过敏/真忌口硬钉死，喜欢什么和预算习惯可以变", () => {
  assert.ok(P.PHONE_STICKY.takeout.indexOf("taste.avoidTags") >= 0);
  ["taste.spicyTags", "taste.likeTags", "taste.budget", "taste.habit"].forEach(pt =>
    assert.ok(P.PHONE_EVOLVE.takeout.indexOf(pt) >= 0, pt + " 该在 🌱 层"));
  // 整块 taste 不许再出现在任何一层里（那样就分不开了）
  assert.ok(P.PHONE_STICKY.takeout.indexOf("taste") < 0 && P.PHONE_EVOLVE.takeout.indexOf("taste") < 0);
});

test("🌱 模型没给的不许把旧值抹掉", () => {
  const old = { me: { wechatName: "屿", signature: "旧签名" }, userContact: { name: "Lisa", remark: "L" } };
  const out = P.phoneEvolveMerge("wechat", old, { me: { wechatName: "" }, userContact: null });
  assert.equal(out.me.wechatName, "屿");
  assert.deepEqual(out.userContact, old.userContact);
});

test("🌱 一次刷新最多真改动两项，多的回填旧值", () => {
  // 光靠提示词说「别乱改」只是降概率，模型高兴起来能把六项一起换掉，
  // 那 🌱 就退化成 ♻️ 了。代码这一道是保证。
  assert.equal(P.PHONE_EVOLVE_CHURN, 2);
  const old = { account: { name: "甲", member: "乙", style: "丙", persona: "丁" }, addrs: [{ label: "戊" }], habit: { budget: "己" } };
  const gen = { account: { name: "A", member: "B", style: "C", persona: "D" }, addrs: [{ label: "E" }], habit: { budget: "F" } };
  const out = P.phoneEvolveMerge("shopping", old, gen);
  const paths = ["account.name", "account.member", "account.style", "account.persona"];
  const changed = paths.filter(pt => pt.split(".").reduce((o, k) => o[k], out) !== pt.split(".").reduce((o, k) => o[k], old)).length
    + (out.addrs[0].label === "E" ? 1 : 0) + (out.habit.budget === "F" ? 1 : 0);
  assert.equal(changed, P.PHONE_EVOLVE_CHURN, "改动没被收口，实际改了 " + changed + " 项");
});

test("🌱 以前压根没有的那一项，随新的（别留空洞）", () => {
  const out = P.phoneEvolveMerge("wechat", { me: {} }, { me: { wechatName: "刚长出来的" } });
  assert.equal(out.me.wechatName, "刚长出来的");
});

test("🌱 和 🔒 一起生效，互不干扰", () => {
  const old = { account: { uid: "111", name: "老昵称" }, orders: [{ shop: "上一轮的店", time: "8月20日 12:00" }] };
  const gen = { account: { uid: "999", name: "新昵称" }, orders: [{ shop: "这一轮的店", time: "今天 12:00" }] };
  const out = P.phoneMergeSaved("takeout", old, gen, new Date(2026, 7, 29, 15, 0).getTime());
  assert.equal(out.account.uid, "111", "🔒 没钉住");
  assert.equal(out.account.name, "新昵称", "🌱 不该被钉死");
  assert.deepEqual(Array.from(out.orders, x => x.shop), ["这一轮的店", "上一轮的店"], "📚 没攒上");
});

// ── ♻️ 名册必须能出 ────────────────────────────────────────

test("名册走【累积 + 墓碑】，不是 ♻️ 重掷也不是只进不出", () => {
  // v57.75 我先把它们改成了 ♻️，v57.76 改回累积 —— 理由：♻️ 的字段压根不发回给
  // 模型，它每次会凭空编一份新黑名单，比只进不出还糟。
  // 正解是累积保稳定 + retired 保能出去。
  const R = new Function(phoneSrc + "; return { PHONE_RETIRE };")();
  // 判据（v59.53 补进规则文件）：**这一栏里的东西会不会「不再是」？**
  // 会，就是名册。店会不去了（v59.53）、便签会被划掉或事情办完（v59.56）。
  [["calls", "frequent"], ["calls", "blocked"], ["liked", "follows"], ["liked", "drafts"],
   ["browser", "marks"], ["shopping", "wish"], ["takeout", "wish"],
   ["shopping", "shops"], ["takeout", "shops"], ["notes", "items"]].forEach(([app, f]) => {
    assert.ok(P.PHONE_GROW[app] && P.PHONE_GROW[app][f] > 0, app + "." + f + " 该累积（保稳定）");
    assert.ok(R.PHONE_RETIRE[app] && R.PHONE_RETIRE[app][f], app + "." + f + " 没有墓碑，只进不出");
  });
  // 日志那几条不需要墓碑：发生过就是发生过
  // 日志那几条不需要墓碑：通话打过就是打过、短信收到就是收到、刷到的帖子刷到就是刷到。
  // ⚠️便签 v59.56 从这儿挪到上面去了——它答的是「现在还记着哪几件事」，
  // 划掉的、撕了的、办完的都该能退出（她 2026-09-01 选的「乙」）。
  [["calls", "calls"], ["calls", "sms"], ["liked", "items"]].forEach(([app, f]) => {
    assert.ok(P.PHONE_GROW[app][f] > 0);
    assert.ok(!(R.PHONE_RETIRE[app] && R.PHONE_RETIRE[app][f]), app + "." + f + " 是日志，不该有退出机制");
  });
});

test("同一条路径不许同时登记在两层里", () => {
  Object.keys(P.PHONE_EVOLVE).forEach(k => {
    const st = P.PHONE_STICKY[k] || [];
    P.PHONE_EVOLVE[k].forEach(pt =>
      assert.ok(st.indexOf(pt) < 0, k + "." + pt + " 同时在 🔒 和 🌱 里，行为不确定"));
  });
});

test("凡是有账号身份的 app，🔒 和 🌱 至少各占一条", () => {
  const { FIXTURES } = require("./helpers/phone-render.js");
  P.PHONE_APPS.map(a => a.key)
    .filter(k => P.PHONE_LIVE_KEYS.indexOf(k) < 0)
    .filter(k => { const d = FIXTURES[k]; return !!(d && (d.me || d.account || d.archive)); })
    .forEach(k => assert.ok((P.PHONE_STICKY[k] || []).length,
      k + " 有账号身份却没登记 🔒，刷一次换一个号"));
});

// ── 两块都要喂回提示词 ──────────────────────────────────────

test("🔒 和 🌱 用不同的说法发回去", () => {
  const known = { account: { uid: "1043827", name: "只买合用的" }, addrs: [{ label: "家", detail: "老地方" }],
    taste: { avoidTags: ["生姜丝"], likeTags: ["羊肉"] } };
  const lock = P.phoneIdentityBlock("takeout", known);
  const grow = P.phoneEvolveBlock("takeout", known);
  assert.match(lock, /1043827/);
  assert.match(lock, /一个字都不要改/);
  assert.ok(lock.indexOf("老地方") < 0, "地址不该出现在 🔒 那一段");
  assert.match(grow, /老地方/);
  assert.match(grow, /只买合用的/);
  assert.match(grow, /不是永远不能变/, "🌱 那段要说清楚它可以变");
  assert.match(grow, /最多动其中一两项/);
  // 都拼进了推演任务
  const ins = P.phoneProbeSpec("takeout", char, [], "", [], known).instruction;
  assert.ok(ins.indexOf("1043827") > 0 && ins.indexOf("老地方") > 0);
  assert.ok(P.phoneProbeSpec("takeout", char, [], "", []).instruction.indexOf("1043827") < 0);
});

test("两处生成调用都把旧那份传过去了", () => {
  const calls = (appSrc.match(/^.*phoneProbeSpec\(.*$/gm) || []);
  assert.ok(calls.length >= 2, "找不到两处生成调用");
  calls.forEach(c => assert.match(c, /avoid, known,/, "这处没把身份传过去：" + c.trim().slice(0, 100)));
  // 要守的是【每个调用点自己读一次】，不是全文件恰好有两处 known
  //（随身物 v57.83 也用了同一个变量名，数全文件会误伤）。
  calls.forEach(c => {
    const i = appSrc.indexOf(c);
    const before = appSrc.slice(Math.max(0, i - 400), i);
    assert.match(before, /const known = \(\(phonesRef\.current \|\| \{\}\)\[char\.id\] \|\| \{\}\)\[key\];/,
      "这处调用点没有自己读一次 known，可能在跟别处共用一个变量");
  });
});

test("存进去之前代码把四层按顺序走一遍（规则降概率，代码才保证）", () => {
  const m = appSrc.match(/const savePhoneApp = \(charId, key, d\) => \{[\s\S]*?\n  \};/);
  assert.ok(m);
  assert.match(m[0], /phoneMergeSaved\(key, cur\[key\], d, Date\.now\(\)\)/);
  assert.match(phoneSrc, /function phoneMergeSaved[\s\S]{0,400}phoneEvolveMerge\(appKey, oldData, phoneKeepIdentity\(appKey, oldData, newData\)\)/,
    "四层顺序不对：必须 🔒 → 🌱 → 📚");
});

test("脏数据不炸", () => {
  for (const [o, n] of [[null, null], [{}, null], ["字符串", { a: 1 }], [{ account: "不是对象" }, { account: { name: "x" } }], [[], {}]]) {
    assert.doesNotThrow(() => P.phoneKeepIdentity("takeout", o, n));
    assert.doesNotThrow(() => P.phoneEvolveMerge("takeout", o, n));
  }
  assert.equal(P.phoneIdentityBlock("takeout", null), "");
  assert.equal(P.phoneEvolveBlock("notes", { items: [] }), "");
});
