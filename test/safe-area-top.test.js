const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const read = f => fs.readFileSync(R(f), "utf8");
const app = read("app.js");
const SRC = fs.readdirSync(path.join(__dirname, "..", "js"))
  .filter(f => f.endsWith(".js"))
  .map(f => [f, read(f)]);

// 她 2026-08-27：「主界面做了 ios 适配，但是其他界面几乎没有，顶上都会白一块」
// 病因：根节点先垫一条 env(safe-area-inset-top) 高、theme.bg 色的空带，界面放在它下面。
// 主屏壁纸铺在根节点上看不出来；别的界面顶栏是 t.bg2／聊天壁纸／封面图，那条带子就露出来了。
test("根节点不许再垫那条空带——它就是「白一块」本人", () => {
  assert.doesNotMatch(app, /height: "env\(safe-area-inset-top\)"/, "根节点还留着那条空带");
  assert.doesNotMatch(app, /isStandalone/, "空带撤了，判断也要一起删掉，别留半截");
});

test("只留一把尺子，别一处一处手写 calc", () => {
  const eng = read("engine.js");
  assert.match(eng, /function safeTop\(px\)/, "safeTop 没了");
  assert.match(eng, /env\(safe-area-inset-top, 0px\)/, "要带 0px 兜底：非 PWA 打开时这个变量是空的");
});

// 每一个整屏界面都得自己让开刘海：要么用共用顶栏 Head，要么自己写 safeTop
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

test("每个整屏界面都自己让开刘海（用 Head，或自己写 safeTop）", () => {
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
  const comp = read("components.js");
  const i = comp.indexOf("function Head(");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /paddingTop: safeTop\(20\)/, "Head 没让开刘海");
  assert.doesNotMatch(seg, /pt-5/, "让开的高度改用 safeTop 算，别再留 tailwind 的 pt-5 双份");
});

test("聊天/群聊顶栏顶到最上沿，壁纸从它后面透上来", () => {
  const comp = read("components.js");
  const hits = (comp.match(/className: "shrink-0 px-4 pb-3 flex items-center gap-3",\n\s*style: \{\n\s*paddingTop: safeTop\(20\)/g) || []).length;
  assert.equal(hits, 2, "单聊和群聊两个顶栏都要接，现在只有 " + hits + " 个");
});

test("线下房间把让位从外壳挪进顶栏——外壳是壁纸，让在外壳上就又是一条空带", () => {
  const comp = read("components.js");
  assert.doesNotMatch(comp, /backgroundRepeat: "no-repeat", paddingTop: "env\(safe-area-inset-top\)"/,
    "线下外壳还在自己垫");
  const hits = (comp.match(/px-4 py-3 shrink-0", style: \{ paddingTop: safeTop\(12\)/g) || []).length;
  assert.equal(hits, 2, "单人线下 + 多人线下两个顶栏都要接，现在只有 " + hits + " 个");
});
