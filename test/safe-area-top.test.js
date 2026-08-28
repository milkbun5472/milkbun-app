const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JSDIR = path.join(__dirname, "..", "js");
const read = f => fs.readFileSync(path.join(JSDIR, f), "utf8");
const app = read("app.js"), comp = read("components.js"), eng = read("engine.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const SRC = fs.readdirSync(JSDIR).filter(f => f.endsWith(".js")).map(f => [f, read(f)]);

// v56.58 把这套拆了，主屏当场散架（.claude/rules/home-screen-layout.md）。这几条是那次的封条。
test("100vh 那一套原封不动——这是底部白边的最终解法", () => {
  assert.match(html, /html, body, #root \{ height: 100vh;/, "壳子的 100vh 没了");
  assert.match(html, /html, body \{ width: 100%; height: 100vh; overflow: hidden;/);
  assert.match(app, /height: "100vh"/, "app 外壳的 100vh 没了");
  assert.match(comp, /height: "100vh", \/\/ 保持 100vh（底部白边最终解法，勿改成 100%\/dvh）/, "Home 的 100vh 没了");
  // 只看真赋值：注释里那句「不用 100dvh」是说明，不是用法
  [html, app, comp].forEach(s => assert.doesNotMatch(s, /[:=]\s*["']?\d+dvh/, "不许真的用上 dvh"));
});

test("主屏仍旧留着根节点那条空带，壁纸照旧铺在根节点上", () => {
  assert.match(app, /const _safeTop = \{ height: screen === "home" \? "env\(safe-area-inset-top\)" : 0 \};/,
    "主屏那条空带的条件被改了");
  assert.match(app, /\(screen === "home" && wallpaper\) \? "center\/cover no-repeat url\("/, "主屏壁纸不再铺在根节点上");
  assert.doesNotMatch(comp, /overflow-hidden pt-3 flex flex-col".*\n.*paddingTop/, "Home 内容区不许再补 paddingTop");
});

// 白带的成因：空带和顶栏是两个元素、两层 backdrop-filter，交界处必然留一道亮线。
// 做法是照 ai-virtual-phone 的聊天页看来的：它压根没有那条空带，顶栏自己吃掉刘海。
test("只留一把尺子 safeTop，别一处一处手写 calc", () => {
  assert.match(eng, /function safeTop\(px\)/, "safeTop 没了");
  assert.match(eng, /env\(safe-area-inset-top, 0px\)/, "要带 0px 兜底：非 PWA 打开时这个变量是空的");
});

// v56.63 的普查只问「这个组件里出现过 Head 没有」，于是漏了一整类：
// 某个分支（列表页／空状态）用 Head，真正显示的那个分支自己写顶栏。
// 查手机、行程、日记、随身全是这个形状，她 2026-08-27 撞到查手机那页顶栏钻进刘海里。
// 改成【逐个顶栏】查：所有 shrink-0 + pt-N 的 className，附近没有 safeTop 的一律报出来；
// 确实不是顶栏的写进 INNER 里，连理由一起。
const INNER = {
  "components.js|shrink-0 flex items-center justify-between px-2 pt-1 pb-1": "日历月视图里的月份切换行，上面还有日历自己的顶栏",
  "components.js|flex justify-center gap-1.5 pt-2 shrink-0": "主屏页码点——主屏不许动",
  "components.js|relative shrink-0 px-4 pt-1": "主屏 dock 区——主屏不许动",
  "components.js|shrink-0 pt-10 pb-3 flex flex-col items-center": "通话浮层内部；外壳自己已经让开了刘海",
  "components.js|shrink-0 px-5 pt-5 pb-3 flex items-center gap-3": "通话记录浮层内部；外壳自己已经让开了刘海",
  "components.js|active:opacity-50 shrink-0 pt-0.5": "记录行里的删除按钮，不是顶栏",
  "codex.js|px-5 pt-2 pb-3 shrink-0": "搜索框那一行，上面还有 Head",
  "vps-codex.js|px-4 pt-2 shrink-0": "底部输入行，让的是下边",
  "phone.js|shrink-0 flex items-center gap-3 px-5 pt-6 pb-4": "接在 Head 底下的一行，不是顶栏",
  "phone.js|shrink-0 px-5 pt-1 pb-2 flex items-end justify-between": "角色手机状态栏下面的桌面标题行，不是顶栏"
};

test("逐个顶栏查：谁没让开刘海就报谁的名字", () => {
  const bad = [];
  SRC.forEach(([f, src]) => {
    const re = /className: "([^"]*\bshrink-0\b[^"]*\bpt-\d[^"]*|[^"]*\bpt-\d[^"]*\bshrink-0\b[^"]*)"/g;
    let m;
    while ((m = re.exec(src))) {
      const near = src.slice(m.index + m[0].length, m.index + m[0].length + 200);
      if (near.includes("safeTop(") || near.includes("safe-area-inset-top")) continue;
      const key = f + "|" + m[1];
      if (INNER[key]) continue;
      bad.push(key + "  (第 " + (src.slice(0, m.index).split("\n").length) + " 行)");
    }
  });
  assert.deepEqual(bad, [], "这些顶栏会被刘海压住；确实不是顶栏的写进 INNER 并说明理由：\n  " + bad.join("\n  "));
});

// Head 一个人盖住三十几个界面——它要是掉了，一片一起掉
test("共用顶栏 Head 自己把状态栏那一条涂上", () => {
  const i = comp.indexOf("function Head(");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /paddingTop: safeTop\(20\)/, "Head 没让开刘海");
  assert.doesNotMatch(seg, /pt-5/, "让开的高度改用 safeTop 算，别再留 tailwind 的 pt-5 双份");
});

test("单聊和群聊顶栏顶到屏幕最上沿，壁纸从它后面透上来", () => {
  const hits = (comp.match(/className: "shrink-0 px-4 pb-3 flex items-center gap-3",\n\s*style: \{\n\s*paddingTop: safeTop\(20\)/g) || []).length;
  assert.equal(hits, 2, "单聊和群聊两个顶栏都要接，现在只有 " + hits + " 个");
});

test("线下房间把让位从外壳挪进顶栏——外壳画的是壁纸，让在外壳上又是一条带子", () => {
  assert.doesNotMatch(comp, /backgroundRepeat: "no-repeat", paddingTop: "env\(safe-area-inset-top\)"/,
    "线下外壳还在自己垫");
  const hits = (comp.match(/px-4 py-3 shrink-0", style: \{ paddingTop: safeTop\(12\)/g) || []).length;
  assert.equal(hits, 2, "单人线下 + 多人线下两个顶栏都要接，现在只有 " + hits + " 个");
});
