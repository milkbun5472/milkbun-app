// v61.42 她 2026-09-03：「陆衍的衣服写成了这个风格，但是别人的都是正常描述是啥衣服，
// 所以看陆衍状态卡就只能看到他穿着 xx 场合的衣服」。
//
// 病根在提示词：name 那一栏只说「这一身的叫法」，模型于是给了个【场合名】
//（「日常采购与平价餐厅出行套」）。可场合已经有 occasion 那一栏了——写两遍等于 name 是空的。
// 而 name 会顺着 carryContextText 进聊天上下文，模型再照抄进 wearing，
// 状态卡上就成了「他穿着 xx 场合的衣服」。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const scr = fs.readFileSync("js/screens.js", "utf8");

const outfitLabel = (() => {
  const a = scr.indexOf("const GARMENT_RE =");
  const b = scr.indexOf("// 随身物摘要");
  const box = {};
  new Function("box", scr.slice(a, b) + "\nbox.f = outfitLabel;")(box);
  return box.f;
})();

test("名字写成场合时，退回 note 里那句真说了衣服的话", () => {
  assert.equal(outfitLabel({ name: "日常采购与平价餐厅出行套",
    note: "炭黑色极简薄款棒球领夹克，内搭白T，配深灰水洗牛仔裤。" }, "外出约会"), "炭黑色极简薄款棒球领夹克");
  assert.equal(outfitLabel({ name: "见客户那一身", note: "深蓝西装三件套，衬衫熨得笔挺" }, "正式场合"), "深蓝西装三件套");
});

test("本来就写对的名字原样不动", () => {
  const good = "浅灰棉质宽松T恤配米白抽绳休闲裤";
  assert.equal(outfitLabel({ name: good, note: "柔软透气的纯棉面料" }, "居家"), good);
  assert.equal(outfitLabel({ name: "月白细麻直裰", note: "腰间束一条素带" }, "平常"), "月白细麻直裰");
});

test("note 也说不清就原样用，不许硬切场合前缀", () => {
  // 切出来是「的那套」这种残句，比原名还糟
  const odd = "外出约会与日常私服的那套";
  assert.equal(outfitLabel({ name: odd, note: "" }, "外出约会与日常私服"), odd);
});

test("名字空着时用 note 顶上，不返回空", () => {
  assert.equal(outfitLabel({ name: "", note: "月白细麻直裰，腰间束一条素带" }, "平常"), "月白细麻直裰");
});

test("喂给角色的上下文和衣柜格子都过这一道，不然只修了一半", () => {
  assert.match(scr, /g\.sets\.slice\(0, 4\)\.map\(x => outfitLabel\(x, g\.occasion\)\)/, "喂上下文那处没过");
  assert.match(scr, /\} \}, outfitLabel\(it, g\.occasion\)\)/, "衣柜格子没过");
  assert.match(scr, /isCloth \? outfitLabel\(sheet, sheet\._occ\) : sheet\.name/, "详情页没过");
});

test("提示词那头也说清了：name 写衣服，不写场合", () => {
  assert.match(scr, /【name 写的是衣服本身，不是场合】/);
  assert.match(scr, /把 note 盖住只看 name，能不能看出他穿的是什么/, "少了判据");
  // 两处 schemaHint（单栏 outfit / 四栏合一）都得改，各写一份迟早只改一处
  assert.equal((scr.match(/不许写成场合名/g) || []).length, 2);
});
