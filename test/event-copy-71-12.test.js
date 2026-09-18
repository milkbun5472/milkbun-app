// 她 2026-09-18 转小红书群里读者 ! YOLO 的许愿池：
//   「老大，我还有一个许愿池就是记忆总结成事件以后，可不可以把那个事件给我一个
//     复制按钮，然后我加到记忆库里面去。因为有的时候我是觉得记忆他太多了，
//     我想精简一下，才把它总结成事件的」
//
// 顺手收了一笔旧债：复制这件事全库手写了四处，而且四处各缺一块——
// 单聊和群聊那两处【没等结果就报「已复制」】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const trpg = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");

// ⚠️这条是这次搬家的全部意义：手写的那几处只要还剩一处，它就会继续骗人
test("复制只有公共那一处，四处手写的都搬过来了", () => {
  const stray = [["js/app.js", app], ["js/screens.js", screens], ["js/trpg.js", trpg]]
    .filter(([, src]) => src.includes("navigator.clipboard"));
  assert.deepEqual(stray.map(x => x[0]), [], "还有人自己写 navigator.clipboard");
  assert.ok(comp.includes("async function copyText(text)"), "公共那一层没了");
  // 搬过去不是各自包一层：四处都得真的在叫它
  assert.ok(app.includes("copyText(m.content)"), "单聊长按复制没搬");
  assert.ok(app.includes('copyText(m.content || "")'), "群聊长按复制没搬");
  assert.ok(screens.includes("await copyText(s)"), "主屏布局那处没搬");
  assert.ok(trpg.includes("copyText(txt)"), "跑团打包模组没搬");
});

test("等真写进去了才算数，写不进去要说实话", () => {
  const i = comp.indexOf("async function copyText(text)"), j = comp.indexOf("function requestAppPrompt(", i);
  assert.ok(i > 0 && j > i, "抠不出 copyText");
  const seg = comp.slice(i, j);
  assert.ok(seg.includes("await navigator.clipboard.writeText(s)"), "又变回不等结果了");
  assert.ok(seg.includes('createElement("textarea")') && seg.includes('execCommand("copy")'), "没有退路——非 https 下 clipboard 压根不存在");
  assert.ok(/return !!ok;/.test(seg), "老那条路的成败没往外报");
  // 四处的提示都得看它的返回值，不许写死一句「已复制」
  assert.ok(/copyText\(m\.content\)\.then\(ok => toast\(ok \?/.test(app), "单聊又在无条件报已复制");
  assert.ok(/copyText\(m\.content \|\| ""\)\.then\(ok => toast\(ok \?/.test(app), "群聊又在无条件报已复制");
});

test("提示的措辞和停留时长留给各家，公共那层不抹平", () => {
  const i = comp.indexOf("async function copyText(text)"), j = comp.indexOf("function requestAppPrompt(", i);
  const seg = comp.slice(i, j);
  assert.ok(!/toast/.test(seg), "公共那层自己发提示了——四处的分寸会被将就掉");
  assert.ok(trpg.includes("7000"), "跑团那句原来停 7 秒，搬完丢了");
  assert.ok(screens.includes("主屏布局已复制，直接粘给言秋"), "主屏布局那句措辞丢了");
});

test("事件册：梗概和全文各一颗，复制的是她真能粘的东西", () => {
  const i = screens.indexOf("function EventShelfSection("), j = screens.indexOf("function MemoryCorrectionPreviewSheet(", i);
  assert.ok(i > 0 && j > i, "抠不出 EventShelfSection");
  const seg = screens.slice(i, j);
  assert.ok(seg.includes("复制梗概"), "没有复制梗概那一颗——她要的是精简");
  assert.ok(seg.includes("复制全文"), "没有复制全文那一颗");
  assert.ok(/copyText\(detail\.event\.title \+ "："/.test(seg), "梗概那颗要带上标题，不然粘进记忆库是一句没头没尾的话");
  assert.ok(/copyText\(detail\.event\.title \+ "\\n\\n"/.test(seg), "全文那颗要带上标题");
  // 没有梗概的事件不该出现一颗点了复制出空话的按钮
  assert.ok(/detail\.event\.synopsis \? h\("button"/.test(seg), "没梗概时那颗该不出现");
});

// ⚠️记忆库是只进不出的（改都改不了，只能软归档）。替她自动写进去＝把「精简」
//   变成「又多一条」，而且撤不回来。她要的就是一颗复制按钮，别自作主张。
test("只给复制，不替她往记忆库里写", () => {
  const i = screens.indexOf("function EventShelfSection("), j = screens.indexOf("function MemoryCorrectionPreviewSheet(", i);
  const seg = screens.slice(i, j);
  assert.ok(!/onAddMemory|saveMemor|addMemor/i.test(seg), "事件册自己往记忆库写了——粘不粘归她");
});
