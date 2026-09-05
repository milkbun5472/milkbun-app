const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const start = comp.indexOf("function MuyuWidget({ editMode })");
const end = comp.indexOf("// 情侣空间轮播组件", start);
assert.ok(start > 0 && end > start, "抠不出木鱼组件");
const muyu = comp.slice(start, end);

test("木鱼只换皮肤，2x2 占位和原有敲击行为都保留", () => {
  assert.match(muyu, /MUYU_IDLE = 5000/, "五秒清零被改了");
  assert.match(muyu, /localStorage\.setItem\("x_muyu"/, "本地功德存档没了");
  assert.match(muyu, /setTimeout\(\(\) => setCombo\(0\), 2000\)/, "两秒连击规则被改了");
  assert.match(muyu, /onClick: knock/, "木鱼点不动了");
  assert.match(muyu, /navigator\.vibrate\(8\)/, "轻震反馈没了");
  assert.match(muyu, /className: "relative flex flex-col items-center justify-center h-full"/, "木鱼不再填满原组件格");
});

test("木鱼放在蒲团上、暖木雕刻，不退回旧的扁平色块", () => {
  // v63.08：那层发白的 radial-gradient 托盘换成了【蒲团】——原来木鱼像贴在玻璃上的贴纸，
  // 没有「它放在哪儿」这件事。判词跟着换成新形状，不是把断言放宽。
  assert.match(muyu, /id: "wkPuTuan"/, "蒲团没了");
  assert.match(muyu, /stroke: "#c99a5e", strokeWidth: 1\.6/, "蒲团的绲边没了");
  assert.doesNotMatch(muyu, /radial-gradient\(ellipse at 50% 36%/, "又退回那层发白的玻璃托盘了");
  assert.match(muyu, /id: "muyuWood"/, "暖木渐变没了");
  assert.match(muyu, /id: "muyuMallet"/, "独立木槌没了");
  assert.match(muyu, /wk-muyu-ring/, "敲击扩散反馈没了");
  assert.match(muyu, /"\+1 功德"/, "功德反馈文案没了");
  assert.match(muyu, /combo \+ " COMBO"/, "连击胶囊没了");
  assert.match(muyu, /right: 4, top: 9/, "连击胶囊没挪到右上角，会继续压住底下的功德数字");
  assert.doesNotMatch(muyu, /right: 5, bottom: 3/, "连击胶囊又回到底部和功德数字叠在一起了");
  assert.doesNotMatch(muyu, /fill: "rgba\(178,138,88,0\.9\)"/, "退回旧木鱼色块了");
});
