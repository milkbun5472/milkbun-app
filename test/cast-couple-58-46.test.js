const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const screens = R("screens.js"), comp = R("components.js"), app = R("app.js");
const cast = screens.slice(screens.indexOf("function Cast("), screens.indexOf("function CastForm("));

// ── 人格档案馆 ──────────────────────────────────────────
// 她 2026-08-30：「名字改了叫人格档案馆但是上面还是显示叫名录」
test("顶栏和主屏图标都叫人格档案馆，全 app 不再有第二个名字", () => {
  assert.match(cast, /fontSize: 17, color: t\.ink \} \}, "人格档案馆"\)/, "顶栏还写着别的名字");
  assert.match(comp, /cast: \{ kind: "app", zh: "人格档案馆"/, "主屏图标还叫旧名字");
  const files = fs.readdirSync(path.join(__dirname, "..", "js")).filter(f => f.endsWith(".js"));
  const left = [];
  files.forEach(f => {
    R(f).split("\n").forEach((l, n) => {
      // 引她原话的那一行除外——那是她说的，不能改
      if (/名录/.test(l) && !/名字改了叫人格档案馆/.test(l)) left.push(f + ":" + (n + 1));
    });
  });
  assert.deepEqual(left, [], "这些地方还写着旧名字：" + left.join(" "));
});

// 那个 FILE 编号是拿 id 哈希出来的，跟日记那条假条形码一个毛病（她让删过一次）
test("卡片上不再有编出来的卷宗号", () => {
  assert.ok(!/castFileNo/.test(screens), "假卷宗号又回来了");
  assert.doesNotMatch(cast, /FILE ·/);
});

// 一栏恒定写着同一句话＝零信息。原来没设时区就写「跟随系统」、没生日写「未录入」、
// 谁都挂一个「在册」——三栏加起来占掉一整块，什么都没说
test("卡上只写真的有的：没设的字段不出现", () => {
  assert.match(cast, /if \(c\.tz\) chips\.push/, "时区没设也会写一行");
  assert.match(cast, /if \(c\.birthday\) chips\.push/, "生日没填也会写一行");
  assert.doesNotMatch(cast, /"跟随系统"|"未录入"/);
  assert.doesNotMatch(cast, /"在册"/, "又挂上那个谁都有的标签了");
});

test("好感 / 情侣 / 上次说话是真数据，从 app 那边算好递进来", () => {
  assert.match(cast, /md\.couple === "together"/);
  assert.match(cast, /md\.aff != null/);
  assert.match(cast, /castAgo\(md\.lastTs, now\)/);
  const call = app.slice(app.indexOf('screen === "cast") body'), app.indexOf('screen === "castForm"'));
  assert.match(call, /aff: Math\.round\(affOf\(c\.id\)\)/, "好感没递进去");
  assert.match(call, /couple: cp \? cp\.status : ""/, "情侣状态没递进去");
  assert.match(call, /lastTs: lastTs/, "上次说话时间没递进去");
});

test("castAgo 按真实间隔说话，未来时间不瞎猜", () => {
  const i = screens.indexOf("function castAgo"), j = screens.indexOf("function CastSection");
  assert.ok(i > 0 && j > i && j - i < 1200, "抠不出 castAgo");
  const castAgo = new Function(screens.slice(i, j) + "\nreturn castAgo;")();
  const now = new Date(2026, 7, 30, 14, 0, 0).getTime();
  assert.equal(castAgo(0, now), "");
  assert.equal(castAgo(now + 60000, now), "", "未来时间该闭嘴");
  assert.equal(castAgo(now - 10 * 60000, now), "刚聊过");
  assert.equal(castAgo(now - 3 * 3600e3, now), "3小时前");
  assert.equal(castAgo(now - 20 * 3600e3, now), "昨天");
  assert.equal(castAgo(now - 5 * 86400e3, now), "5天前");
  assert.match(castAgo(now - 200 * 86400e3, now), /月.*日/);
});

// mobile-ui-layout.md：子页面禁止 30–40px 大标题和大块上下留白
test("档案馆用紧凑标题栏，不放大标题", () => {
  assert.doesNotMatch(cast, /fontSize: 2[5-9]|fontSize: 3\d/, "又摆了个大标题上去");
  assert.match(cast, /paddingTop: safeTop\(8\)/);
  assert.match(cast, /chips\.length = Math\.min\(chips\.length, 4\)/, "小标不封顶，一张卡会撑成三行");
});

// ── 情侣邀请 ────────────────────────────────────────────
// 她 2026-08-30：「情侣空间发送邀请没有头像，还会自动回复不等我说完」
test("邀请卡跟别的自己发的卡一样带头像", () => {
  const i = comp.indexOf('if (m.kind === "couple_invite")');
  const seg = comp.slice(i, i + 400);
  assert.match(seg, /dsp\.myAvatar && h\(Avatar/, "自己发出去的邀请卡没有头像");
  assert.match(seg, /justify-end/);
});

test("发出邀请不再自动开口，等她点了才回应", () => {
  const i = app.indexOf("const sendCoupleInvite = async char =>");
  const j = app.indexOf("const askCoupleInvite", i);
  assert.ok(i > 0 && j > i && j - i < 2200, "抠不出 sendCoupleInvite");
  const send = app.slice(i, j);
  assert.doesNotMatch(send, /setTimeout\(async/, "又变成发完自己接话了");
  assert.doesNotMatch(send, /callAI/, "发出邀请这一步不该调模型");
  const card = comp.slice(comp.indexOf("function CoupleInviteCard"), comp.indexOf("// 解除拉黑申请卡片"));
  assert.match(card, /onAsk\(m\.cid\)/, "卡上没有让 TA 回应的按钮");
  assert.match(card, /m\.status === "pending" \|\| m\.status === "failed"/, "失败之后不能再问一次");
});

test("她在邀请之后说的话，一起递给 TA", () => {
  const i = app.indexOf("const askCoupleInvite");
  const j = app.indexOf("const respondCoupleInvite", i);
  assert.ok(i > 0 && j > i && j - i < 2600, "抠不出 askCoupleInvite");
  const ask = app.slice(i, j);
  assert.match(ask, /line\.slice\(at \+ 1\)/, "没有把邀请之后那几句捞出来");
  assert.match(ask, /after\.concat\(\[\{ role: "user", content: "（回应情侣邀请）" \}\]\)/, "捞出来了却没递给模型");
  assert.match(ask, /if \(gen\.coupleAsk\) return;/, "连点两下会问两次，白花两次钱");
  assert.match(ask, /status: "failed"/, "失败了卡片没留下再问一次的口子");
});
