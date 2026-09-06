// 她 2026-09-04：「聊天里的设置页现在弄了几个格子但是我感觉分类还是有点难找
// 你重新分类一遍」。
//
// 原来七格是按【代码里怎么放的】切的，于是：
//   · 「相处与主动」变成杂物间——内在状态／时间感知／性情／主动消息／默认线下
//     五件不相干的事挤在一起；
//   · 「线路与身份」的「身份」在这个 app 里根本不指那个意思，里面还混着
//     「能不能上网」这种跟 API 线路无关的能力开关；
//   · 「上下文诊断」和「线路与身份」共用同一个图标 ⌁，一眼分不出谁是谁；
//   · 七张 142px 的大卡要滚两屏才看得全——一眼扫不完的东西，怎么分类都难找。
//
// 现在按【她来找什么】切，标题写成她脑子里那句话。这份测试钉的是那几条判据，
// 不是钉具体文案：改文案随意，别把杂物间和撞车再养回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const CS = comp.slice(comp.indexOf("function ChatSettings({"));
assert.ok(CS.length > 20000, "抠不出 ChatSettings");

// 从源码里读出这一页现在怎么分的：settingPages 定义 + 每个 show(tab,...) 落在哪一类
const PAGES = [...CS.matchAll(/\{ key: "(\w+)", char: "(.)", title: "([^"]+)"/g)]
  .map(m => ({ key: m[1], char: m[2], title: m[3] }));
const SECTIONS = [...CS.matchAll(/show\("(\w+)",\s*\{\s*title: ([^\n]*?)(?:,\s*\.\.\.sec|,\s*danger)/g)]
  .map(m => ({ tab: m[1], title: m[2] }));

test("七类都在，而且每一类都有名有姓", () => {
  assert.equal(PAGES.length, 7, "现在是 " + PAGES.length + " 类");
  for (const p of PAGES) {
    assert.ok(/[一-鿿]/.test(p.title), "「" + p.key + "」的标题不是中文");
    assert.ok(/[一-鿿]/.test(p.char), "「" + p.key + "」的索引牌不是一个汉字");
  }
});

test("索引牌一类一个字，撞不了车", () => {
  // 原来两格共用 ⌁：几何符号本来就没几个分得开的，撞车是迟早的事。
  const chars = PAGES.map(p => p.char);
  assert.equal(new Set(chars).size, chars.length, "索引牌撞车了：" + chars.join(" "));
  const keys = PAGES.map(p => p.key);
  assert.equal(new Set(keys).size, keys.length, "key 撞车了：" + keys.join(" "));
});

test("没有杂物间：一类最多装四节", () => {
  // 「相处与主动」当初装了五节，那不是一类，是没分类。
  const byTab = {};
  for (const s of SECTIONS) (byTab[s.tab] = byTab[s.tab] || []).push(s.title);
  const fat = Object.entries(byTab).filter(([, v]) => v.length > 4);
  assert.deepEqual(fat.map(([k, v]) => k + " 装了 " + v.length + " 节"), [],
    "这一类又攒成杂物间了，拆开：\n  " + fat.map(([k, v]) => k + "：" + v.join(" / ")).join("\n  "));
});

test("每一节都落在真有那一格的类里，没有孤儿", () => {
  const keys = new Set(PAGES.map(p => p.key));
  const orphan = [...new Set(SECTIONS.map(s => s.tab))].filter(k => !keys.has(k));
  assert.deepEqual(orphan, [], "这几节挂在不存在的分类下，永远打不开：" + orphan.join(" / "));
  // 反过来：有格子却一节都没有 = 点进去一片空白。rooms 是嵌进来的整块，不走 show()
  const used = new Set(SECTIONS.map(s => s.tab));
  const empty = PAGES.map(p => p.key).filter(k => k !== "rooms" && !used.has(k));
  assert.deepEqual(empty, [], "这几格点进去是空的：" + empty.join(" / "));
});

test("只装一节的那几类，进去就摊开", () => {
  // 不然点进来是一片空白 + 一行跟页标题几乎一样的字，还得再点一下——比不分类还难用。
  const byTab = {};
  for (const s of SECTIONS) (byTab[s.tab] = byTab[s.tab] || []).push(s.title);
  const solo = Object.entries(byTab).filter(([, v]) => v.length === 1).map(([k]) => k).sort();
  const declared = [...CS.matchAll(/const SOLO = \{([^}]*)\}/g)]
    .flatMap(m => [...m[1].matchAll(/(\w+):/g)].map(x => x[1])).sort();
  assert.deepEqual(declared, solo, "SOLO 名单跟实际只有一节的那几类对不上");
  assert.match(CS, /const openTab = k => \{ setSettingsTab\(k\); setOpenSec\(SOLO\[k\] \|\| ""\); \}/);
  assert.match(CS, /onClick: \(\) => openTab\(page\.key\)/, "首页那一行没走 openTab，SOLO 就白写了");
});

test("每一行写着现在是什么状态（不用点进去就知道）", () => {
  // 「难找」有一半是「不点开看不出现在设成什么」。别的 app 的设置目录不会长这样，
  // 因为别处没有「他」——这是 tabs-not-plain-pills.md 那条判据要的：换个 app 就不成立。
  assert.equal(PAGES.length, [...CS.matchAll(/\n\s*state: \(\) =>/g)].length, "有几类没写状态那一行");
  assert.match(CS, /\}, page\.state\(\)\)/, "首页没把状态渲染出来");
});

test("一屏放得下：一列窄行，不是两列大卡", () => {
  assert.doesNotMatch(CS, /minHeight: 142/, "又变回 142px 的大卡了，七张要滚两屏");
  assert.doesNotMatch(CS, /grid grid-cols-2 gap-3/, "又变回两列网格了");
  assert.match(CS, /flexDirection: "column", gap: 8/, "首页不是一列");
});

test("挪过位置的那几节留在新家（附理由，别再挪回去）", () => {
  const at = t => (SECTIONS.find(s => s.title.includes(t)) || {}).tab;
  // 时间感知答的是「他知不知道今天几号」，不是相处
  assert.equal(at("时间感知"), "know");
  // 默认进线下答的是「点进来先看到哪一屏」，不是相处
  assert.equal(at("点进来先看到哪一屏"), "look");
  // 能上网／驻场眼睛是他的本事，跟走哪条 API 线不是一回事
  assert.equal(at("TA 有什么本事"), "act");
  // 走哪条线路那一格只剩 API
  assert.equal(at("API 线路"), "route");
});

test("标题里不留英文（连 LineField 那一处一起）", () => {
  // 施工规则/no-english-titles.md。这一页原来顶着一行 CHAT CONFIG，
  // 「备注名 / Remark」「拍一拍签名 / Nudge」也各挂一条。
  assert.doesNotMatch(CS, /"CHAT CONFIG"/, "CHAT CONFIG 又回来了");
  // LineField 跟 Head 同一条：有中文主名时纯拉丁的 en 不发。改这一个组件，几十处一起合规
  const LF = comp.slice(comp.indexOf("function LineField({"), comp.indexOf("function LineInput("));
  assert.match(LF, /const enCJK = \/\[一-鿿\]\/\.test\(String\(en \|\| ""\)\);/);
  assert.match(LF, /const side = \(zh && !enCJK\) \? "" : \(en \|\| ""\);/);
  assert.match(LF, /side \? \/\*#__PURE__\*\/React\.createElement\("span"/, "没有 en 时那一栏还占着位");
});

test("这一页是整页，不是半窗", () => {
  // no-half-sheet.md：分类页收起来只有四五行，半窗就缩成小半屏、上面糊着聊天。
  assert.doesNotMatch(CS, /React\.createElement\(Sheet, \{\n?\s*key: settingsTab/, "又掀回半窗了");
  assert.match(CS, /ReactDOM\.createPortal\(/);
  assert.match(CS, /position: "fixed", inset: 0/);
  assert.match(CS, /className: "h-full flex flex-col"/);
  // 顶栏用公共的 Head（mobile-ui-layout.md §1），返回键一层一层退
  assert.match(CS, /h\(Head, \{/);
  assert.match(CS, /if \(settingsTab\) \{ setSettingsTab\(""\); setOpenSec\(""\); \} else onClose\(\);/,
    "返回键没有一层一层退");
});
