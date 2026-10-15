// 表情面板的描述：默认关、能开；开了印在图上（她 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
test("StickerPanel：caption 开才印字，字压在图上不另起白底", () => {
  const src = R("js/components.js"), i = src.indexOf("function StickerPanel("), seg = src.slice(i, src.indexOf("// 底下那一排", i));
  assert.ok(/caption && em\.keyword \? h\("div", \{ style: \{ position: "absolute"/.test(seg));
  assert.ok(/onCaption\(!caption\)/.test(seg));
  assert.equal((src.match(/caption: !!emoteCaption, onCaption: onEmoteCaption/g) || []).length, 2);
  assert.equal((R("js/app.js").match(/emoteCaption: !!prefs\.emoteCaption/g) || []).length, 2);
});
