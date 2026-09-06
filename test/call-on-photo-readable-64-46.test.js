// 视频通话有画面时，字得自己站得住（她 2026-09-06：「视频画画会把聊天框和聊天
// 记录盖住」→ 追问确认是【台词和通话框】看不见）。
//
// ⚠️不是层序问题。无头浏览器里按她的机型量过：台词气泡和输入栏都在图【上面】，
//   位置也正常，加不加 z-index 一模一样。真正的病是【被冲白了】——这一屏除了
//   气泡，名字/时长/旁白/说话人/输入框全是白字压在一层很淡的全屏暗罩上，
//   照片一亮就全读不出来。
// ⚠️不许靠「把全屏罩调暗」来治：那等于把他的脸一起压没，为了读字牺牲掉这个
//   功能本身。所以是【谁要被读，谁自己带底】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const call = cmp.slice(cmp.indexOf("function CallScreen({"), cmp.indexOf("function CallReceipt") > 0 ? cmp.indexOf("function CallReceipt") : cmp.length);

test("两样工具都在，而且只在有画面时才出手", () => {
  assert.match(call, /const onPhoto = !!bgUrl;/);
  assert.match(call, /const litText = onPhoto \? \{ textShadow:/, "没有那道字影");
  assert.match(call, /const litPlate = \(from, to\) => onPhoto \? \{/, "没有那层自带的暗底");
  // 没有画面时两样都是 null —— 语音通话那一屏一个像素都不该动
  assert.match(call, /const litText = onPhoto \? \{[^}]*\} : null;/);
  assert.match(call, /WebkitBackdropFilter: "blur\(3px\)"\n  \} : null;/, "没画面时那层底也发出去了");
});

test("飘在照片上的每一处白字都带上了字影", () => {
  // 时长那行、旁白、说话人名（列表里那处 + 「对方」那处）、「正在说」
  const musts = [
    /fontSize: 13,\n\s*color: onPhoto \? "rgba\(255,255,255,0\.86\)"/,          // 时长
    /fontStyle: "italic"[^\n]*onPhoto \? "rgba\(255,255,255,0\.88\)"[^\n]*\}, litText\)/, // 旁白
    /fontSize: 11\.5, color: onPhoto \? "rgba\(255,255,255,0\.88\)"[^\n]*\}, litText\)/   // 正在说
  ];
  musts.forEach((re, i) => assert.match(call, re, "第 " + (i + 1) + " 处白字没带字影/没提亮"));
  // 说话人名那两处【都】要改到——只改一处就是「一层写在两处，第二处没跟上」
  const nameHits = call.match(/fontSize: 10, color: onPhoto \? "rgba\(255,255,255,0\.85\)"[^\n]*\}, litText\)/g) || [];
  assert.equal(nameHits.length, 2, "说话人名那两处只改了 " + nameHits.length + " 处");
  assert.equal(call.indexOf('fontSize: 10, color: "rgba(255,255,255,0.5)"'), -1, "还有一处留着原来那个淡到看不见的灰");
});

test("顶上那块和输入栏各自压一层底，中间那块【不许】压", () => {
  assert.match(call, /className: "shrink-0 pt-10 pb-3 flex flex-col items-center",\n\s*style: Object\.assign\(\{\}, litPlate\("\.62", "0"\)\)/,
    "顶上名字时长那块没有自己的底");
  assert.match(call, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \+ 4px\)"\n\s*\}, litPlate\("0", "\.78"\)\)/,
    "输入栏那一条没有自己的底");
  // 中间那一大块（他的脸）不许被压：litPlate 只许出现这两次
  const plates = call.match(/litPlate\(/g) || [];
  assert.equal(plates.length, 2, "litPlate 被用了 " + plates.length + " 处（只该是顶上那块和输入栏）——多压一处就是把他的脸也糊掉了");
});

test("全屏那层罩没被调暗（治法不是把脸一起压没）", () => {
  assert.match(call, /rgba\(10,10,12,\.58\) 0,rgba\(10,10,12,\.42\) 30%,rgba\(10,10,12,\.74\) 100%/,
    "有人把全屏罩调暗了——那是把他的脸一起压没，不是让字读得清");
});
