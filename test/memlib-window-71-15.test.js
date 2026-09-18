// 她 2026-09-18 一口气报了两件：
//   「还有我怎么点不了记忆库事件了」
//   「还有记忆库记忆多的话也会很卡有没有办法也做懒加载啊」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

const evShelf = () => {
  const i = screens.indexOf("function EventShelfSection("), j = screens.indexOf("function MemoryCorrectionPreviewSheet(", i);
  assert.ok(i > 0 && j > i, "抠不出 EventShelfSection");
  return screens.slice(i, j);
};
const memLib = () => {
  const i = screens.indexOf("function MemoryLib("), j = screens.indexOf("function MemCfgSheet(", i);
  assert.ok(i > 0 && j > i, "抠不出 MemoryLib");
  return screens.slice(i, j);
};

// ── ①「点不了记忆库事件」──────────────────────────────────────────────
// 病根：正文是故意不落缓存的（只在打开时直连云取），而原来那句是
//   `const d = await getEvent(ev.id); if (d) setDetail(d);`
// 没登录／断网／云抽一下，getEvent 返回 null，于是【什么都不做，一个字都不说】。
// 书架上明明列着这件事（列表读的是本地镜像），点下去却像坏了。
test("点了必须先开窗，不许什么都不做", () => {
  const seg = evShelf();
  assert.ok(/onClick: async \(\) => \{\s*\n\s*setDetail\(\{ event: ev, links: \[\], loading: true/.test(seg),
    "还是先去云上取、取到了才开窗——取不到就等于点了没反应");
  assert.ok(!/if \(d\) setDetail\(d\);/.test(seg), "那句会吞掉失败的写法又回来了");
});

test("取不回来要在窗里说为什么，并退到梗概", () => {
  const seg = evShelf();
  assert.ok(seg.includes("正文在云上，这会儿取不回来"), "没登录/没网时一声不吭");
  assert.ok(/catch \(e\) \{\s*\n\s*setDetail\(\{ event: ev, links: \[\], loading: false, why: "正文取不回来："/.test(seg),
    "云抛错时没往窗里说");
  assert.ok(/detail\.event\.narrative \|\| detail\.event\.synopsis/.test(seg),
    "正文没有就该退到梗概——镜像里一直有它，总好过一片空白");
  assert.ok(seg.includes("detail.loading"), "取的过程中没有任何交代");
});

// ── ②「记忆库很卡，能不能懒加载」─────────────────────────────────────
test("长名单只画一截，往下翻到底再续", () => {
  assert.ok(comp.includes("function useListWindow(total, resetKey)"), "公共那一层没了");
  assert.ok(/const LIST_WINDOW = \d+;/.test(comp), "一截是多少没定");
  const seg = memLib();
  assert.ok(seg.includes("useListWindow(list.length,"), "记忆库没接懒加载");
  assert.ok(seg.includes("list.slice(0, memShown).map((e, index)"), "还是整摞全画出来");
});

// ⚠️这一条是这次最容易写坏的地方：窗口只许切【画出来的那几张】。
//   把 list 本身切了的话，上面那排「在册/常驻/未了」和「这一摞 N 张」会当场变成骗人的数。
test("切的只是画出来的那几张，数字仍按全部算", () => {
  const seg = memLib();
  assert.ok(/const list = \(entries \|\| \[\]\)\.filter/.test(seg), "list 的算法变了");
  assert.ok(!/const list = [\s\S]{0,400}\.slice\(0, mem/.test(seg), "list 本身被切了——上面那排数字会跟着变小");
  assert.ok(seg.includes('"这一摞 " + list.length + " 张"'), "「这一摞 N 张」改成按窗口算了");
});

test("换筛选／换搜索词就收回去，别把上一摞翻开的长度带过来", () => {
  const seg = memLib();
  assert.ok(/useListWindow\(list\.length, statusFilter \+ "\|" \+ filter \+ "\|" \+ qlc\)/.test(seg),
    "三个筛选条件少了哪个，换过去都会直接露出一长条");
  const i = comp.indexOf("function useListWindow(total, resetKey)"), j = comp.indexOf("const mTight =", i);
  const hook = comp.slice(i, j);
  assert.ok(/useEffect\(\(\) => \{ setWinN\(LIST_WINDOW\); \}, \[resetKey\]\);/.test(hook), "换了条件窗口没收回去");
});

// ⚠️一声不吭地停在第 60 条，看着像「后面的记忆没了」
test("剩下多少要说出来，哨子就挂在那句话上", () => {
  const seg = memLib();
  assert.ok(/memMore \? h\("div", \{ ref: memSentinel/.test(seg), "哨子没挂上，翻到底也不会续");
  assert.ok(seg.includes('"还有 " + memMore + " 条，往下翻"'), "没告诉她后面还有");
});

test("两支窗口住在一起，但没有硬合成一支", () => {
  // 聊天往上长（补完要把滚动位置顶回去），记忆库往下长（前面没多东西，不用补）。
  // 合成一支就得同时表达两种补法，而补错方向那一下是屏幕上当场看得出来的。
  assert.ok(comp.includes("function useChatWindow(ref, total, resetKey)"), "聊天那支没了");
  const i = comp.indexOf("function useListWindow(total, resetKey)");
  const j = comp.indexOf("function useChatWindow(ref, total, resetKey)");
  assert.ok(i > 0 && j > 0 && Math.abs(i - j) < 3000, "两支离散了——下次改一支会漏掉另一支");
  const hook = comp.slice(i, comp.indexOf("const mTight =", i));
  assert.ok(!/scrollTop/.test(hook), "往下长的那支不该有滚动补偿——它前面什么都没多");
  assert.ok(hook.includes("IntersectionObserver"), "盯哨子比监听滚动稳：外面是哪一层在滚，各页不一样");
});
