const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const fic = R("fanfic.js"), engine = R("engine.js"), screens = R("screens.js");
// rpMessages 是纯函数，抠出来真跑
const M = (() => {
  const a = fic.indexOf("  const RP_WINDOW_CHARS = 9000;");
  // ⚠️收尾锚在【函数】上，不要锚在注释上：注释是会被重写的
  //（v61.15 把「降落节点」这套话换成人话，这条当场抠空、报「抠不出 rpMessages」）。
  const b = fic.indexOf("  async function genRPStart(");
  assert.ok(a > 0 && b > a, "抠不出 rpMessages");
  return new Function(fic.slice(a, b) + "\nreturn rpMessages;")();
})();
// saveRP 也抠出来真跑（saveJSON / K_RP 换成桩，把落盘的那份接住）
const SR = (() => {
  const i = fic.indexOf("  const RP_KEEP = 30;");
  const j = fic.indexOf("\n  }", fic.indexOf("  function saveRP(list) {")) + 4;
  assert.ok(i > 0 && j > i, "抠不出 saveRP");
  const box = {};
  const f = new Function("box", 'const K_RP="k";const saveJSON=(k,v)=>{box.v=v;};'
    + fic.slice(i, j) + "\nreturn saveRP;")(box);
  return { save: l => { f(l); return box.v; } };
})();
const sess = n => ({ transcript: Array.from({ length: n }, (_, i) =>
  i % 2 ? { who: "nar", text: "叙事".repeat(150) } : { who: "me", text: "行动" + (i / 2 + 1) }) });

// ── 她 2026-08-30：「下面的框跟其他查手机这些的对齐」──
test("底栏只吃 0.4 条安全区，和主聊天输入栏、购物底栏同一把尺子", () => {
  assert.match(engine, /const COMPOSER_PAD_BOTTOM = "calc\(env\(safe-area-inset-bottom\) \* 0\.4\)";/);
  // 原来吃的是【整条】，刘海机上比别处高出一截（mobile-ui-layout §2 点名不许）
  assert.doesNotMatch(fic, /paddingBottom: "env\(safe-area-inset-bottom\)"/, "还在吃整条安全区");
  const i = fic.indexOf("  function BottomNav(props) {");
  const seg = fic.slice(i, i + 1600);
  assert.match(seg, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  // 图标/字号/间距也对齐购物那条
  assert.match(seg, /h\(it\.G, \{ size: 21,/);
  assert.match(seg, /fontSize: 10, fontWeight: on \? 600 : 400/);
  assert.match(seg, /className: "flex-1 py-2 flex flex-col items-center gap-0\.5 active:opacity-60"/);
  assert.match(screens, /paddingBottom: COMPOSER_PAD_BOTTOM \} \},\n\s*\[\["home", "首页", GShop\]/, "购物那条底栏是这把尺子的出处");
});

// ── 改名穿书 ──
test("叫穿书了，但存档键和 mode key 一个都没动", () => {
  assert.match(fic, /\{ key: "rp", label: "穿书", G: IPortal \}/);
  ["穿书设定", "穿书中", "＋ 新穿书", "还没有穿书存档", "选一篇穿进去"].forEach(x =>
    assert.ok(fic.indexOf(x) > 0, "这处没改名：" + x));
  assert.match(fic, /【穿书 · 互动叙事引擎】玩家『穿』进了一篇同人文里/);
  assert.match(fic, /【玩家的身份 \/ 穿进去的方式】/);
  // ⚠️改了这两样旧存档就读不出来了
  assert.match(fic, /const K_RP = "x_fanfic_rp";/);
  ["left", "right", "passerby", "random"].forEach(k =>
    assert.ok(fic.indexOf('key: "' + k + '"') > 0, "mode key 被改了：" + k));
  // 体裁标签里「穿越」是读者用的词，留着，另外把「穿书」也认上
  assert.match(fic, /IF线\|AU\|au\|穿越\|穿书\|重生/);
});

test("「我的」页那个入口撤干净了，连那条线一起", () => {
  assert.doesNotMatch(fic, /穿越同人文/, "入口还在");
  assert.equal((fic.match(/onEnterRP/g) || []).length, 0, "撤东西要删干净，别留半条线");
});

// ── 穿书的逻辑 ──
test("天降模式不许再发「读者不出场」——那和身份锚点正面打架", () => {
  const i = fic.indexOf("    const playerIsThirdParty =");
  assert.ok(i > 0, "没分出天降这一支");
  const seg = fic.slice(i, i + 420);
  assert.match(seg, /mode === "passerby" \|\| mode === "random"/);
  // ⚠️认的是【它真的当了那个条件】：只找变量名的话，把 cpBlock 的第二个参数
  // 改成写死的 false，声明还在、测试照样绿（第一版就是这么漏过去的）
  assert.match(seg, /parts\.push\(cpBlock\(cpChars, playerIsThirdParty\s*\n?\s*\? \{ includeMe: true, meName: \(identity && identity\.name\) \|\| userName \|\| "我", mePersona: "" \}\s*\n?\s*: \{\}\)\);/);
  // cpBlock 里那条尾巴就是打架的那句
  assert.match(fic, /读者\/『我』不出场、不作为角色写进去/);
  assert.match(fic, /const soloTail = bothChars \? /);
  assert.doesNotMatch(fic, /parts\.push\(cpBlock\(cpChars\)\);/, "还在无条件发那条尾巴");
});

test("世界书真的进了穿书的 system——原来一路传到底、从没被引用过", () => {
  const i = fic.indexOf("  function buildRPSystem(");
  const seg = fic.slice(i, fic.indexOf("  // 生成可选降落节点", i));
  assert.match(seg, /if \(worldbook && worldbook\.trim\(\)\) \{\n\s*if \(typeof WORLDBOOK_RULE !== "undefined"\) parts\.push\(WORLDBOOK_RULE\);\n\s*parts\.push\("【全局世界书（严格遵循/,
    "穿书还是收不到世界书");
  // 身份也要合得上世界书
  const j = fic.indexOf("  async function genRPIdentity(");
  assert.match(fic.slice(j, j + 1400), /这个身份要合得上里面的设定与禁忌/);
  // 降落点用不上就把参数删掉，别留个没人引用的（worldbook 就是那个反面教材）。
  // v60.91 多了个 know（你带着什么进去）——它是【真被引用的】，见下面那一句。
  assert.match(fic, /async function genLandings\(active, fic, tab, cpChars, mode, userName, know\) \{/);
  const gi = fic.indexOf("async function genLandings(");
  assert.match(fic.slice(gi, gi + 900), /rpKnowLine\(know, mode, cpChars, userName\)/, "know 收了却没用，就是又一个 worldbook");
  assert.doesNotMatch(fic, /genLandings\(props\.active, newFic, tabOf\(newFic\), cpc, mode, props\.userName, props\.worldbook\)/);
});

test("玩到第六回合，前面做过的事得留下痕迹", () => {
  // 短局：全带上，没有前情
  const short = M(sess(6), "现在这一步");
  assert.equal(short.filter(m => /前情提要/.test(m.content)).length, 0, "才六条就掐了");
  assert.ok(short[short.length - 1].content.indexOf("现在这一步") > 0);
  // 长局：窗口收住了，但掉出去的【玩家行动】压成一行带回来
  const long = M(sess(60), "现在这一步");
  const recap = long.filter(m => /前情提要/.test(m.content));
  assert.equal(recap.length, 1, "长局没有前情——前面做过的一切一点痕迹不留");
  assert.match(recap[0].content, /行动1/, "最早那几步丢了");
  assert.match(recap[0].content, /别当成新指令重演一遍/, "不说清楚模型会把前情当指令重演");
  assert.ok(long.length < 60, "窗口没收住");
  // 预算是按字数收的，不是死板的 slice(-10)
  assert.doesNotMatch(fic, /\(session\.transcript \|\| \[\]\)\.slice\(-10\)/);
  assert.match(fic, /const RP_WINDOW_CHARS = 9000;/);
  assert.match(fic, /all\.length - i > RP_WINDOW_MIN && chars \+ c > RP_WINDOW_CHARS/);
  // 再长也至少留最近这几条
  assert.ok(M(sess(400), "x").length >= 10, "长局把最近几轮也挤掉了");
});

test("存档封顶，而且排序键得是存档里真有的字段", () => {
  assert.match(fic, /const RP_KEEP = 30;/);
  // 真跑一遍：只看常量在不在的话，把那个三元改成 true ? a 测试照样绿
  const many = Array.from({ length: 45 }, (_, k) => ({ id: "s" + k, updatedAt: k }));
  const out = SR.save(many);
  assert.equal(out.length, 30, "存档没封顶");
  assert.equal(out[0].id, "s44", "留下的不是最近那几局");
  assert.equal(out[29].id, "s15");
  assert.equal(SR.save(many.slice(0, 5)).length, 5, "没满的时候不该动它");
  // createdAt 也认（老存档只有 createdAt）
  assert.equal(SR.save(Array.from({ length: 40 }, (_, k) => ({ id: "c" + k, createdAt: k })))[0].id, "c39");
  const i = fic.indexOf("  function saveRP(list) {");
  const seg = fic.slice(i, i + 600);
  assert.match(seg, /y\.updatedAt \|\| y\.createdAt/, "按 ts 排的话全是 0−0，静默空转");
  assert.doesNotMatch(seg, /\(y\.ts \|\| 0\)/);
  // 存档确实是 createdAt/updatedAt，没有 ts
  assert.match(fic, /createdAt: Date\.now\(\), updatedAt: Date\.now\(\) \};\n\s*persist\(\[sess\]/);
  // 每走一步都会 bump，所以正在玩的那局永远在最前面、不会被挤掉。
  // ⚠️原来数的是「ss.updatedAt 出现 3 次」——那冻的是长相不是行为：
  // v60.97 多了「结算原著这一页」和「收尾」两处落笔，次数从 3 变 5，
  // 行为一点没坏，测试却红了。改成按判据数：【凡是往 transcript 里落笔的地方，都得 bump】。
  const writes = fic.split("ss.transcript =").slice(1);
  assert.ok(writes.length >= 3, "找不到往 transcript 落笔的地方了");
  writes.forEach((seg, k) => {
    const end = seg.indexOf("return ss;");
    assert.ok(end > 0, "第 " + (k + 1) + " 处落笔没在 onUpdate 回调里");
    assert.match(seg.slice(0, end), /ss\.updatedAt = Date\.now\(\);/,
      "第 " + (k + 1) + " 处往 transcript 落了笔却没 bump updatedAt，这一局会被挤掉");
  });
});
