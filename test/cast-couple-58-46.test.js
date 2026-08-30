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

// v58.48 改：她 2026-08-30「不要做 tag，做底部有信息那样：时区、生日……
// 不要情侣天数和刚聊过和好感度」。所以卡上写的换成【放着不动也成立】的东西——
// 好感/情侣/上次说话是关系的近况，不是档案。
test("底部信息栏三格：时区 / 生日 / 人设厚度", () => {
  assert.match(cast, /cell\("TIMEZONE", tz/);
  assert.match(cast, /cell\("BIRTHDAY", bd/);
  assert.match(cast, /cell\("PERSONA", plen/);
  assert.doesNotMatch(cast, /chips/, "又改回小胶囊了");
});

test("关系的近况不进档案卡", () => {
  // 注释里说得着这几个词（写着为什么拿掉），所以只看代码，先把注释行剥掉
  const code = cast.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ["好感", "affinity", "couple", "刚聊过", "castAgo", "lastTs"].forEach(k =>
    assert.ok(!code.includes(k), "卡上又出现了「" + k + "」——那是关系近况，不是档案"));
  const call = app.slice(app.indexOf('screen === "cast") body'), app.indexOf('screen === "castForm"'));
  assert.ok(!/affOf|couples\[|lastTs/.test(call), "app 那边还在白算一遍近况递过来");
  assert.ok(!/castAgo/.test(screens), "castAgo 没人用了就该删掉，不是留着");
});

test("没填的字段照实写「—」，不冒充有值", () => {
  assert.match(cast, /c\.birthday\s*\?/, "生日没填也当有值用");
  assert.match(cast, /: "—"/, "空的那一格得有个老实的占位");
  assert.match(cast, /cell = \(label, value, dim\)/, "空值那一格要压成灰的，跟填了的分得开");
});

test("算得出岁数就不重复写年份（一格只有 80 来 px）", () => {
  assert.match(cast, /replace\(\/\^\\d\{4\}\[-\/\.\]\/, ""\) \+ " · " \+ age \+ "岁"/,
    "「1997-3-15 · 29岁」会被截掉");
});

// 她 2026-08-30：「这样一个卡片还是太 plain 了……很有层次感」
test("卡片是有层次的：书脊、装订孔、纸纹、贴上去的照片", () => {
  assert.match(cast, /装订孔/, "书脊上那三个孔没了");
  assert.match(cast, /repeating-linear-gradient\(58deg/, "纸纹没了");
  assert.match(cast, /transform: "rotate\(-1\.6deg\)"/, "头像不再是贴上去的照片");
  // 三层影：贴纸的近影 + 托起来的远影 + 内圈上沿的亮线
  const sh = cast.match(/boxShadow: "0 1px 2px rgba\(46,38,29,\.07\)[^"]*"/);
  assert.ok(sh && /inset 0 1px 0/.test(sh[0]) && sh[0].split("),").length >= 3, "卡片的影只剩一层了");
  // 纸纹不许盖到书脊上（盖上去书脊就成了条纹）
  const tex = cast.slice(cast.indexOf("repeating-linear-gradient(58deg") - 240, cast.indexOf("repeating-linear-gradient(58deg"));
  assert.match(tex, /left: 8/, "纸纹盖到书脊上了");
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
