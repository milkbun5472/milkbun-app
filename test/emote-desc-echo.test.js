const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const pick = (a, b) => eng.slice(eng.indexOf(a), eng.indexOf(b, eng.indexOf(a)));
const fns = new Function(pick("const EMOTE_SLOT_RE", "function emoteSlotWords") + pick("function emoteSlotWords", "//   （她 2026-09-30 截图），语音照旧掉到最后") + "; return { emoteSlotWords, emoteSlotOf };")();
const norm = s => String(s || "").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
const emotes = [{ keyword: "黄色小狗叉腰冒星星✨" }];
test("表情旁边漏出来的那句描述拿掉，夹着自己话的留着（群友 2026-10-26）", () => {
  const r = fns.emoteSlotWords([{ emote: "黄色小狗叉腰冒星星✨" }, "黄色小狗叉腰冒星星", "能随时感知到你我就安心了"], emotes, norm);
  assert.deepEqual(r.words.filter(w => fns.emoteSlotOf(w) == null), ["能随时感知到你我就安心了"]);
  const r2 = fns.emoteSlotWords(["[表情] 黄色小狗叉腰冒星星✨", "黄色小狗好可爱呀你看"], emotes, norm);
  assert.deepEqual(r2.words.filter(w => fns.emoteSlotOf(w) == null), ["黄色小狗好可爱呀你看"]);
  const r3 = fns.emoteSlotWords(["小狗叉腰冒星星", "嗯"], emotes, norm);   // 不挨着表情的不动
  assert.ok(r3.words.includes("嗯"));
});
