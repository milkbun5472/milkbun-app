const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「从视频界面按缩小键页面会崩」——浏览器里复现是 React error #300
// （Rendered fewer hooks than expected）：v60.35 那个 useIdbImgUrl 写在了
// `if (minimized) return` 的【后面】，按缩小键那一下少调一个 hook，当场崩。
// 仓库里已经吃过一次一模一样的亏，见 test/translate-detect.test.js 那条。
test("CallScreen 的 hook 全部排在提前 return 之前", () => {
  const i = comp.indexOf("function CallScreen(");
  const end = comp.indexOf("function anonNightBg(", i);
  assert.ok(end > i, "找不到 CallScreen 的结尾");
  const body = comp.slice(i, end);
  const early = body.indexOf("if (minimized) {");
  assert.ok(early > 0, "找不到 minimized 那一支");
  const after = body.slice(early);
  const hooks = after.match(/\b(useState|useEffect|useRef|useMemo|useCallback|useIdbImgUrl|useTtsPlayer|useTheme|useKbLift)\(/g) || [];
  assert.deepEqual(hooks, [], "提前 return 后面还有 hook：" + hooks.join("/"));
  assert.match(body.slice(0, early), /const bgUrl = useIdbImgUrl\(bg\);/, "取底图那个 hook 得排在早退前面");
});

// 她同一条：「明明已经回到家给我喝抹茶了，电话里还是说刚带了抹茶回来」
// 单人通话走 buildBundle，最近的聊天是白得的；群通话自己拼 sys，
// 送进去的只有【这通电话里说过的话】——群里五分钟前发生的事一个字都看不到。
test("群通话看得见这通电话之前群里刚聊过什么", () => {
  const gc = app.slice(app.indexOf("// 群通话：多角色你一言我一语"), app.indexOf("} catch (e) {\n      toast(\"通话回复失败"));
  assert.match(gc, /const gcChat = cur\.groupId \? \(groupChatsRef\.current\[cur\.groupId\] \|\| \[\]\) : \[\]/);
  assert.match(gc, /slice\(-12\)/, "给多少条要写死，别一路把整个群聊塞进去（她按次计费）");
  assert.match(gc, /fmtStampAI\(m\.ts\)/, "不带时间戳就分不出「刚才」和「很久以前」");
  assert.match(gc, /【这通电话之前，群里刚聊过这些】/);
  assert.match(gc, /这些【已经发生过了】，就在刚才。别当没发生、别把已经做完的事再说成正要去做。/);
  assert.match(gc, /\+ gcHistBlock \+ gcTime \+ gcPrivBlock/, "算出来了却没拼进 sys");
  assert.ok(!/m\.recalled/.test(gc) === false, "撤回的不该还念出来");
});

test("群聊记录那一行怎么写，群聊和群通话共用一份", () => {
  assert.match(app, /const groupHistLine = m => m\.kind === "callend"/);
  assert.match(app, /const fmtGLine = groupHistLine;/, "群聊那一处要用这一份，不是各写各的");
  assert.equal((app.match(/const groupHistLine = /g) || []).length, 1);
});
