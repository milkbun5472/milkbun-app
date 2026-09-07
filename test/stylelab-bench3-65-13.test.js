// 文风台第三批（收尾）：空台那一屏、台脚那几颗、结果那一行的「清空」。
// 空台是她点开这一页看见的【第一屏】——原来是一整段灰字糊在那儿，
// 要发链接给别人看的话，这一屏尤其不能是这样。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SL = fs.readFileSync(path.resolve(__dirname, "..", "js/style-lab.js"), "utf8");

test("空台：台上摆一个空版位，底下是三步，不是一整段灰字", () => {
  const w = SL.slice(SL.indexOf("// 空台：台上一个空版位"), SL.indexOf("// 已选＝排字槽"));
  assert.ok(w.length > 500, "抠不出空台那一段");
  assert.match(w, /border: "1px dashed " \+ t\.line/, "空版位不是个空位");
  assert.match(w, /borderRadius: "3px 5px 5px 3px"/, "空版位跟一块版不是同一个形状");
  assert.match(w, /台上还没有版/);
  // 三步：号码印成小方块，一眼看得出先干哪个
  assert.match(w, /\["1", "先从上面挑一样起手/);
  assert.match(w, /\["2", "在字盘里挑几根字条/);
  assert.match(w, /\["3", "去线下／小剧场／同人文的设置里/);
  // ⚠️「印成小方块」要连形状一起钉：只钉底色的话，把它改回一行小字也照样绿
  assert.match(w, /width: 18, height: 18, flexShrink: 0, borderRadius: 2, background: t\.ink, color: t\.bg2,\s*\n\s*fontFamily: "monospace", fontSize: 10\.5, display: "flex"/,
    "步骤号没印成小方块");
  // 原来那一整段没留着（撤掉东西要删除）
  assert.ok(!/还没有预设。\\n\\n「＋新建」/.test(SL), "那一整段灰字还在");
});

test("台上没有版的时候，台边那条虚线不孤零零挂着", () => {
  assert.match(SL, /paddingTop: presets\.length \? 9 : 0, borderTop: presets\.length \? "1px dashed " \+ t\.line : "none"/);
});

test("台脚那几颗跟台边的家伙什长一个样，不是药丸", () => {
  const w = SL.slice(SL.indexOf("// 台脚那几颗"), SL.indexOf("// ---- 测试台 ----"));
  assert.ok(w.length > 300, "抠不出台脚那一段");
  assert.match(w, /Object\.assign\(\{\}, S\.tool, \{ color: t\.tint \}\)/, "复制那颗还是药丸");
  assert.match(w, /删掉这块版/, "删的是一块版，不是「这条」");
  assert.match(w, /armed === cur\.id \? "真删？再点一下"/, "两下删的闸不能丢");
  // 结果那一行的「清空」也归工具
  assert.match(SL, /Object\.assign\(\{\}, S\.tool, \{ color: armed === "__runs" \? t\.accent : t\.fog, marginLeft: "auto" \}\)/);
});
