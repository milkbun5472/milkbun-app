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
