const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const wk = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
const body = wk.slice(wk.indexOf("function articleBody(a, compact) {"), wk.indexOf("function pairedArticle"));

// 她 2026-09-01：「你看他金句在下面单独重复了一次，而不是直接把文章里那句做成大字号 bold」。
// 原来 pullQuoteFor 从正文里挑一句，再在第一段底下【又印一遍】——
// 同一句话在同一屏出现两次，读起来像排版出错，不像杂志。
test("金句不许再印第二遍：就地放大，一个字都不重复", () => {
  // 那个「再印一遍」的 blockquote 必须没了
  assert.ok(wk.indexOf("blockquote") < 0, "金句又在段落底下单独印了一遍");
  assert.ok(body.indexOf("pull && j === 0") < 0, "还留着「第一段底下再印一遍」那一手");
  // 换成：找出那句落在哪一段的哪个位置，把这一段切成【前 / 那一句 / 后】
  assert.match(body, /if \(pull\) paras\.some\(function \(p, j\) \{ const k = p\.indexOf\(pull\); if \(k >= 0\) \{ hitAt = j; hitIdx = k; return true; \} return false; \}\);/,
    "没去正文里找那一句在哪儿——找不到就只能再印一遍");
  assert.match(body, /const before = hit \? p\.slice\(0, hitIdx\) : p;/);
  assert.match(body, /const after = hit \? p\.slice\(hitIdx \+ pull\.length\) : "";/);
  assert.match(body, /after \? h\("div", \{ style: paraStyle \}, after\) : null/, "那一句后面的半段丢了——正文会缺一块");
  // 就地放大：大字号、加粗、上色；但不许加引号或边框（加了就又成了「另引一段」）
  assert.match(body, /hit \? h\("div", \{ style: \{ fontFamily: L\.titleFace, fontSize: L\.face === "mono" \? 18 : 21, fontWeight: 700[\s\S]{0,120}\} \}, pull\) : null/,
    "那一句没有被放大加粗");
  assert.ok(!/borderLeft[^\n]{0,40}\}, pull\)/.test(body), "又给它加了边框，看着还是「另引一段」");
  // ⚠️首字下沉和放大句不许抢同一个位置
  assert.match(body, /if \(hitAt === 0 && hitIdx === 0\) hitAt = -1;/, "那一句正好压在第一段开头时会跟首字下沉打架");
  assert.match(body, /first \? h\("span",[\s\S]{0,200}\} \}, before\.slice\(0, 1\)\)/, "首字下沉取的还是整段的第一个字，切开之后会取错");
  // compact（次条）本来就不放大
  assert.match(body, /const pull = compact \? "" : pullQuoteFor\(a\);/);
});

// 她同一句话里还说「周刊 ui 感觉还是差点意思」。看的是黑色侦探档案那一版：
// 三篇稿子长得一模一样——同一个方框、同一道投影、右上角都写着同一句话。
// 方框＋投影读起来是【三张卡片】，不是【一版】。一版报纸上的稿子从来不等重。
test("卷宗那一版：头条和次条不等重，靠规矩分开不靠盒子", () => {
  const dossier = wk.slice(wk.indexOf("function dossierLayout()"), wk.indexOf("function classicLayout()"));
  // 盒子和投影撤掉
  assert.ok(dossier.indexOf('boxShadow: "5px 5px 0 "') < 0, "那道卡片投影还在");
  assert.ok(!/border: "1px solid " \+ L\.tint \+ "88"/.test(dossier), "每篇外面还框着一个盒子");
  // 头条一条粗规矩、次条一条细规矩
  assert.match(dossier, /const lead = i === 0;/);
  assert.match(dossier, /borderTop: \(lead \? "5px solid " : "1px solid "\) \+ L\.tint/, "头条和次条的规矩一样粗，看不出谁是头条");
  assert.match(dossier, /fontSize: lead \? 26 : 17/, "头条和次条的标题一样大");
  assert.match(dossier, /articleBody\(a, !lead\)/, "次条没有收紧");
  // 卷宗标签压在规矩上（卷宗边上贴的那种），不是框里的一行小字
  assert.match(dossier, /display: "inline-block"[\s\S]{0,180}background: L\.tint[\s\S]{0,80}"EXHIBIT " \+ String\.fromCharCode\(65 \+ i\)/);
  // 那个三处都一样的「WEEKLY LOG」撤掉——写着同一句话的东西什么也没说
  // 只看活代码——注释里要留着病因（那句话里就有 WEEKLY LOG）
  const live = dossier.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf("WEEKLY LOG") < 0, "三篇右上角还写着同一句话");
  assert.match(dossier, /三处写着同一句话的东西什么也没说/, "病因没写在代码里，下一个人会再加回去");
});

// ===== v60.03 =====
// 她 2026-09-01 问「采访 prompt 怎么样」，然后：「你说的都做吧」。
// 我提的四条：① 动作长进回答里 ② 动作的闸收紧 ③ 答案长短不齐 ④ 记者得有声纹。
test("括号动作长在回答里，不再是接在句尾的独立字段", () => {
  // ⚠️原来 action 是独立字段，渲染时只能接在整段答话后面——那个位置本身就出卖它：
  //   读起来是贴上去的舞台指示，不是「当时发生了」。所以不再向模型索取这个字段。
  const iv = wk.slice(wk.indexOf("async function genInterview("), wk.indexOf("throw new Error(\"「\" + char.name + \"」采访生成失败"));
  assert.ok(iv.indexOf('"action":"（可选）') < 0, "输出形状里还留着那个独立的 action 字段");
  assert.match(iv, /有括号动作就夹在它真的发生的那一处/, "输出形状没说清动作该夹在哪儿");
  assert.match(iv, /放在它【真的发生的那一刻】——话说到一半停下来去做的那一下，就夹在那半句后面/);
  assert.match(iv, /不要等整段说完再补一句收尾神态/);
  // 老存档里那些接在句尾的 action 还得显示得出来（解析仍收一手）
  assert.match(wk, /action: String\(x\.action \|\| ""\)\.trim\(\)/, "老存档里的动作会凭空消失");
});

test("动作的闸要硬：绝大多数轮次不该有，而且只许是拍得到的那一下", () => {
  const iv = wk.slice(wk.indexOf("async function genInterview("), wk.indexOf("② 狗仔"));
  // 「可选」这种软话挡不住——一个存在的字段就会被填满
  assert.match(iv, /绝大多数轮次【不该有】动作/, "闸太松，会变成每条答话后面都挂一个括号");
  assert.match(iv, /情绪注解（他有些无奈／语气冷下来／苦笑）一律不许写——那是替观众下判断，不是拍到的画面/);
  assert.match(iv, /一条回答里至多一个括号，括号里至多十来个字/);
});

test("答案长短要不齐——每条都两三句是生成感最明显的破绽", () => {
  const iv = wk.slice(wk.indexOf("async function genInterview("), wk.indexOf("② 狗仔"));
  assert.match(iv, /至少一轮短到一句、甚至半句/);
  assert.match(iv, /至少一轮是他真的说开了的一大段/);
  assert.match(iv, /全篇每条都两三句，那是稿子不是采访/);
});

test("记者有自己的嗓子，但不许有名字（NAME_GUARD 只准写本周出场人物）", () => {
  const rv = wk.slice(wk.indexOf("const REPORTER_VOICE ="), wk.indexOf("// 人名铁律"));
  // 原来只有三个形容词
  assert.ok(rv.indexOf("机灵、擅长挖料、语气俏皮") < 0, "记者还是三个形容词，答的人有原话、问的人没声音");
  assert.match(rv, /署名就是「本刊记者」/);
  assert.match(rv, /先把你观察到的那个事实摆出来，再把问号压在它后面/, "没说清他【怎么问】");
  assert.match(rv, /换个角度问，不是把同一句再念一遍/);
  assert.match(rv, /你会承认自己猜错/);
  assert.match(rv, /偶尔半截的追问、偶尔一个语气词/, "记者的问题也该有语气，不然又是有声音的人对没声音的人");
  // ⚠️不许给示例问题：会被逐字抄到每个角色头上（prompt-no-content-samples.md）
  assert.match(wk, /不写任何示例问题——示例问题会被逐字抄到每个角色头上/);
  assert.ok(!/例如[：:]\s*「/.test(rv) && rv.indexOf("？」") < 0, "记者人格里塞了示例问题，会被逐字照抄");
});

test("渲染：括号那几段另设一套字；朗读只念他说出口的话", () => {
  assert.match(wk, /const ACT_RE = \/（\[\^（）\]\{1,24\}）\|\\\(\[\^\(\)\]\{1,24\}\\\)\/g;/);
  assert.match(wk, /function splitAct\(text\)/);
  assert.match(wk, /splitAct\(qa\.a\)\.map\(function \(seg, k\)/, "回答还是整段一个样式，括号没被切出来");
  assert.match(wk, /seg\.act[\s\S]{0,180}fontStyle: "italic", color: L\.muted/, "括号那几段没换字换色");
  // ⚠️朗读念到括号就成了「他伸手」这种旁白
  assert.match(wk, /function spokenOnly\(text\) \{ return String\(text \|\| ""\)\.replace\(ACT_RE, ""\)/);
  assert.match(wk, /text: spokenOnly\(qa\.a\)/, "朗读会把括号里的动作念出来");
});
