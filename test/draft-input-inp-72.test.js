// 打字 INP 手术（2026-09-21）：草稿状态从整块聊天组件搬进公共 DraftInput——
// 以前每敲一键，住着草稿的那个大组件连同整窗两百条消息全部重画；现在只重画输入格。
// 桩按【写入方】钉：DraftInput 自己持有 useState 草稿、fire 时清空并上交 trim 后的值；
// 四个面只许通过 h(DraftInput,{...}) 接线，不许再自持 input 状态。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

function slice(src, fromFn, toFn) {
  const i = src.indexOf(fromFn), j = src.indexOf(toFn, i);
  assert.ok(i > 0 && j > i, "抠不出 " + fromFn);
  return src.slice(i, j);
}

test("DraftInput 自己攥着草稿：内部 useState + fire 清空上交", () => {
  const d = slice(comp, "function DraftInput(", "function ReplyKey(");
  assert.match(d, /const \[draft, setDraft\] = useState\(""\)/);
  assert.match(d, /const fire = \(\) => \{ const v = draft\.trim\(\); if \(!v\) return; setDraft\(""\); onSubmit && onSubmit\(v\); \}/);
  // 按钮区拿到的是 (draft, fire, clear)，靠它们亮灭发送键、带走草稿
  assert.match(d, /after \? after\(draft, fire, clear\) : null/);
});

test("四个面不再自持输入状态，全部走 DraftInput", () => {
  const chat = slice(comp, "function ChatThread(", "function callActionsFor(");
  const off = slice(comp, "function OfflineMode(", "function GroupOfflineMode(");
  const goff = slice(comp, "function GroupOfflineMode(", "function GroupThread(");
  const grp = slice(comp, "function GroupThread(", "function GroupSettingsSheet(");
  for (const [name, src] of [["单聊", chat], ["单聊线下", off], ["群线下", goff], ["群聊", grp]]) {
    assert.ok(!src.includes('const [input, setInput] = useState("")'), name + " 不许再把草稿养在大组件里");
    assert.ok(src.includes("h(DraftInput, {"), name + " 要接公共 DraftInput");
  }
  // send/reply 改为收现成的值，不再自己去掏输入框
  assert.match(chat, /const send = \(v\) => \{\s*\n\s*if \(!v \|\| sending\) return;/);
  assert.match(grp, /const send = \(v\) => \{\s*\n\s*if \(!v \|\| sending\) return;/);
});
