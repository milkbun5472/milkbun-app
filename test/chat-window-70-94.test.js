// 小红书那位读者（她 2026-09-18 转来）：「某一天聊的特别猛，它那个聊天框好像会有一点卡顿，
//   然后我一直往上翻的话可以翻到底。是不是？没有做就是懒加载」——对，一条都没做。
// 她定的窗口：200 条（「做200条吧宝宝」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// ⚠️切片钉函数名，不钉注释（施工规则/anchor-on-code.md）
const cut = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return comp.slice(i, j); };
const ONE = cut("function ChatThread({", "function GroupThread({");
const GRP = cut("function GroupThread({", "function GroupSettingsSheet(");
const HOOK = cut("function useChatWindow(ref, total, resetKey) {", "function ChatThread({");

test("她定的是 200", () => {
  assert.match(comp, /const CHAT_WINDOW = 200;/);
});

// ⚠️这一条是整件事里唯一会【删错消息】的地方：
//   i 是这条消息在 messages 里的原始下标，撤回、多选、删除、转发全靠它定位
//   （selIds.map(i => messages[i]) / onDeleteMessages([i])）。
//   窗口外的必须 early-return，不许 slice 之后重新编号——错一位就是删错。
test("窗口外的用 early-return 跳过，绝不许切片重新编号", () => {
  assert.match(ONE, /if \(i < winStart\) return \[\];/, "单聊");
  assert.match(GRP, /if \(i < winStart\) return null;/, "群聊");
  assert.match(ONE, /messages\.flatMap\(\(m, i\) => \{/, "单聊改成切片了——下标会错位");
  assert.match(GRP, /messages\.map\(\(m, i\) => \{/, "群聊改成切片了");
  assert.ok(!/messages\.slice\([^)]*\)\.(map|flatMap)\(\(m, i\)/.test(comp), "有人把 messages 切了再编号");
  // 靠下标定位的那几处还在（它们就是「错一位＝删错」的原因）
  assert.match(ONE, /selIds\.slice\(\)\.sort\(\(a, b\) => a - b\)\.map\(i => messages\[i\]\)/);
  assert.match(GRP, /onDeleteMessages\(\[i\]\)/);
});

test("往上翻要能一路翻回第一条，而且看得见还剩多少", () => {
  [["单聊", ONE], ["群聊", GRP]].forEach(([zh, seg]) => {
    assert.match(seg, /onScroll: e => \{ if \(e\.target\.scrollTop < 320\) growMore\(\); \}/, zh + " 翻到顶不会自动补");
    assert.match(seg, /"↑ 上面还有 " \+ winStart \+ " 条 · 点开或往上翻"/, zh + " 没告诉她上面还有多少");
    assert.match(seg, /winStart > 0 \? h\("button", \{\n\s*onClick: growMore/, zh + " 那颗按钮点不动");
  });
});

// ⚠️补一段＝DOM 前面凭空多出几百条。不把滚动位置顶回原处，
//   她正在看的那一段会当场往下窜掉一大截。
test("补完要把滚动位置顶回原处", () => {
  assert.match(HOOK, /growRef\.current = el\.scrollHeight - el\.scrollTop;/);
  assert.match(HOOK, /React\.useLayoutEffect\(\(\) => \{[\s\S]{0,200}?el\.scrollTop = el\.scrollHeight - growRef\.current;/);
  // ⚠️必须是 useLayoutEffect：useEffect 在浏览器画完之后才跑，中间那一帧她会看见内容往下窜
  assert.ok(!/\n  useEffect\(\(\) => \{\n    const el = ref\.current;\n    if \(!el \|\| !growRef\.current\) return;/.test(comp),
    "改成 useEffect 了：那一帧会闪一下");
  // core.js 那份解构里没有 useLayoutEffect，写裸的是 undefined
  assert.ok(!/\n  useLayoutEffect\(/.test(comp), "写了裸的 useLayoutEffect，运行时是 undefined");
});

test("她正在往上翻的时候，来了新消息也别把她甩回最新的", () => {
  [["单聊", ONE], ["群聊", GRP]].forEach(([zh, seg]) => {
    const i = seg.indexOf("if (growing()) return;");
    const j = seg.indexOf('el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });');
    assert.ok(i > 0 && i < j, zh + "：滚到底那一下没躲开「正在往上翻」");
  });
  assert.match(HOOK, /growing: \(\) => !!growRef\.current/);
});

test("换个人／换个群，窗口收回去", () => {
  assert.match(HOOK, /useEffect\(\(\) => \{ setWinN\(CHAT_WINDOW\); \}, \[resetKey\]\);/);
  assert.match(ONE, /useChatWindow\(ref, messages\.length, \(character && character\.id\) \+ "\|" \+ \(room && room\.id \|\| ""\)\)/);
  assert.match(GRP, /useChatWindow\(ref, messages\.length, group && group\.id\)/);
});

// 施工规则/one-public-mechanism.md：第二处出现时先开公共的，已有的也搬过去
test("这一层只有一份，单聊群聊都问它要", () => {
  assert.equal((comp.match(/function useChatWindow\(/g) || []).length, 1);
  assert.equal((comp.match(/useChatWindow\(ref, messages\.length/g) || []).length, 2, "有一处没搬过来，或者又多写了一份");
  // v71.15 旁边多了一支 useListWindow（记忆库那种往【下】长的名单），它自己也有 winN。
  // 所以这儿改成只看聊天那一支的身体里有没有第二份——原来数全文，加个兄弟就误伤。
  const i = comp.indexOf("function useChatWindow(ref, total, resetKey)");
  const j = comp.indexOf("const LIST_WINDOW =", i);
  assert.ok(i > 0 && j > i, "抠不出 useChatWindow");
  assert.equal((comp.slice(i, j).match(/const \[winN, setWinN\] = useState/g) || []).length, 1, "窗口状态被抄了第二份");
  // ⚠️那一支不许长出滚动补偿：聊天往上长要把滚动位置顶回去，名单往下长不用，
  //   两边补法是反的（所以当初没合成一支）。
  const k = comp.indexOf("function useListWindow(total, resetKey)");
  assert.ok(k > 0 && !/scrollTop/.test(comp.slice(k, comp.indexOf("const mTight =", k))), "往下长的那支混进了往上长的补法");
});
