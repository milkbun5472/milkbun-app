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

const SCREENS = ("Home Cast CastForm Messages MomentsProfile MyWallet KinshipBill ChatThread GroupThread " +
  "ContactDetail Ties Lifestyle PhoneCarry Carry CharWallet EmoteMatrix Favorites Forum Shop Us WorldBook " +
  "StudyApp ReadTogether Debate Dream Tarot DreamJournalApp YanqiuMomentsApp RescueConsole VpsCodexApp " +
  "LoungeEntryApp Ledger CodexApp Memo CapsuleApp Pomodoro Games TheaterApp StyleLabApp AssistantApp " +
  "ImpressionApp FanficApp WeeklyApp MemoryLib Diary ListenTogether Calendar Config CharMap").split(" ");

const bodyOf = name => {
  for (const [f, s] of SRC) {
    let i = -1;
    for (const p of ["function " + name + "(", "const " + name + " = ", name + "({"]) {
      i = s.indexOf(p);
      if (i >= 0) break;
    }
    if (i < 0) continue;
    const rest = s.slice(i + 10);
    const m = /\n(function |const [A-Z])/.exec(rest);
    return { file: f, body: s.slice(i, i + 10 + (m ? m.index : 60000)) };
  }
  return null;
};

test("每个整屏界面都自己让开刘海（用共用顶栏 Head，或自己写 safeTop）", () => {
  const missing = [];
  SCREENS.forEach(n => {
    const got = bodyOf(n);
    if (!got) { missing.push(n + "（没找到这个组件）"); return; }
    const usesHead = /(React\.createElement|h)\(\s*Head\b/.test(got.body);
    const usesSafe = got.body.includes("safeTop(") || got.body.includes("safe-area-inset-top");
    if (!usesHead && !usesSafe) missing.push(n + " (" + got.file + ")");
  });
  assert.deepEqual(missing, [], "这些界面顶上会被刘海压住：\n  " + missing.join("\n  "));
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
