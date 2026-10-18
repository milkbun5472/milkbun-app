// 用到才加载（她 2026-10-18：「来吧宝宝开始瘦身」）。
//   群里报开机白屏、白屏跳黑屏、要重进好几次：一百五十几个脚本开机一口气执行完，内存小的 iPhone 撑不住。
//   第一批搬出开机的：攻略手册、小游戏一整组、周刊、擂台、一起读、梦境、解梦馆、小剧场。
//   这一份钉住：index.html 里登记的那几份浏览器不执行、地址带版本号、文件都在；每一组都有人接（替身或外面那层）；
//   开机就要的那一小块已经拆出来（游戏目录、两个主屏图标）；问秋秋之前先把攻略装上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = R("index.html"), comp = R("js/components.js"), app = R("js/app.js"), asst = R("js/assistant.js");

// 替身那一张表（components.js 里 lazyScreen 那几行）
const stubTable = comp.slice(comp.indexOf("function lazyScreen("), comp.indexOf(".forEach(a => lazyScreen("));
const lazy = [...html.matchAll(/<script type="text\/lazy" data-lazy="([a-z]+)" data-src="([^"]+)"><\/script>/g)].map(m => ({ group: m[1], src: m[2] }));

test("登记延后的脚本：浏览器不执行、地址带 ?v=、文件都在，不会同时又当普通脚本加载一遍", () => {
  assert.ok(lazy.length >= 12, "只认出 " + lazy.length + " 份");
  lazy.forEach(x => {
    // 小世界那组（2026-10-18）里有 apps/fairy-garden/ 下的几份，版本号是游戏构建那一套（fg-…）
    assert.match(x.src, /^(js\/[a-z0-9-]+|apps\/fairy-garden\/(day\/)?[a-z0-9-]+)\.js\?v=(\d+\.\d+|fg-[0-9a-f]+)$/, x.src);
    assert.ok(fs.existsSync(path.join(__dirname, "..", x.src.split("?")[0])), "文件不在：" + x.src);
    assert.ok(!html.includes('<script src="' + x.src.split("?")[0]), "又当普通脚本加载了：" + x.src);
  });
  // 装载器和游戏目录要排在所有业务脚本前面
  assert.ok(html.indexOf("js/lazy-mods.js") < html.indexOf("js/engine.js"));
  assert.ok(html.indexOf("js/games-list.js") < html.indexOf("js/app.js"));
  // 从大文件里拆出来的「开机那半」放回原文件的位置：它们开机就跑的那几行要用 engine.js 里的东西（文字库 txtVaultReady 之类）。
  //   2026-10-18 study-core.js 一度排在 engine.js 前面：家里版是跳过了等文字库（迁移白跑），公共版装订成一份直接白屏
  ["js/study-core.js", "js/ledger-core.js", "js/fanfic-core.js", "js/char-day-core.js", "js/fairy-garden-core.js"].forEach(f => assert.ok(html.indexOf(f) > html.indexOf("js/engine.js"), f + " 排到 engine.js 前面了"));
});

test("每一组都有人接：页面那几组开机放了替身，攻略那组由值班室外面那层和秋秋接", () => {
  const groups = new Set(lazy.map(x => x.group));
  const stubbed = [...stubTable.matchAll(/\["([A-Za-z]+)", "([a-z]+)", "[^"]+"\]/g)].map(m => m[2]);
  [...groups].filter(g => g !== "manual").forEach(g => assert.ok(stubbed.includes(g), g + " 没有替身：点进去会报「没定义」"));
  assert.match(app, /screen === "codex"\) body = h\(LazyGate, \{ key: "lazy-manual", group: "manual"/);
  assert.match(asst, /if \(window\.LazyMods\) await window\.LazyMods\.load\("manual"\)/, "问秋秋之前没先装攻略");
  assert.match(asst, /p\.target === "open" && window\.LazyMods && !window\.LazyMods\.isLoaded\("manual"\)/, "「带你去那一页」没先装攻略");
});

test("替身的名字就是那份脚本自己挂到 window 上的名字", () => {
  [...stubTable.matchAll(/\["([A-Za-z]+)", "([a-z]+)", "[^"]+"\]/g)].forEach(m => {
    const files = lazy.filter(x => x.group === m[2]).map(x => R(x.src.split("?")[0])).join("\n");
    // 挂到 window 上，或者是那份脚本顶层的 function 声明（经典脚本里顶层 function 本来就挂在 window 上，phone-ui.js 那种）
    // 2026-10-18 起 garden 那组的 fairy-garden.js 是 (function (root) {…})(window) 包着的：root 就是 window，root.X = 也算挂上
    const viaRoot = /\}\)\(window\);/.test(files) ? "|^\\s*root\\." + m[1] + " = " : "";
    // 健康、星测、时刻那几份顶上写的是 const g = typeof window !== "undefined" ? window : globalThis：g.X = 也算
    //   拆开以后页面那半的 g 是从开机那半递过来的（const { g, … } = (typeof window …).XCore），同一个东西
    const viaG = /const g = typeof window !== "undefined" \? window : globalThis|const \{[^}]*\bg\b[^}]*\} = \(typeof window !== "undefined" \? window : globalThis\)/.test(files) ? "|^\\s*g\\." + m[1] + " = " : "";
    assert.match(files, new RegExp("window\\." + m[1] + " = |^function " + m[1] + "\\(" + viaRoot + viaG, "m"), m[1] + " 在 " + m[2] + " 那组里没有挂到 window 上");
  });
});

test("开机就要的那一小块留在开机：游戏目录走 games-list.js，两个主屏图标在 components.js", () => {
  assert.doesNotMatch(app, /window\.Games\.LIST/, "聊天那头又去读 games.js 的目录了（那份点进小游戏才有）");
  assert.match(app, /Array\.isArray\(window\.GamesList\)/);
  assert.match(R("js/games.js"), /const GAMES = \(typeof window !== "undefined" && window\.GamesCatalog\)/);
  assert.match(comp, /window\.GTheater = /);
  assert.match(comp, /window\.GDreamBook = /);
  assert.doesNotMatch(R("js/theater.js"), /window\.GTheater = /);
  assert.doesNotMatch(R("js/dreamjournal.js"), /window\.GDreamBook = /);
});

// 装载器本身：同一组只装一次、按登记顺序装、断网失败下次能重试、闲下来只下载不执行
test("装载器：按顺序挂、只装一次、失败了能重来", async () => {
  const added = [];
  let fail = true;
  const tags = [
    { attrs: { type: "text/lazy", "data-lazy": "g", "data-src": "js/a.js?v=1" } },
    { attrs: { type: "text/lazy", "data-lazy": "g", "data-src": "js/b.js?v=1" } }
  ].map(t => ({ getAttribute: k => t.attrs[k], setAttribute: (k, v) => { t.attrs[k] = v; } }));
  const document = {
    querySelectorAll: () => tags,
    createElement: () => ({}),
    head: { appendChild: s => { added.push(s.src); setTimeout(() => (s.src === "js/b.js?v=1" && fail) ? s.onerror() : s.onload(), 0); } }
  };
  const g = { addEventListener() {} };
  new Function("window", "document", "globalThis", R("js/lazy-mods.js"))(g, document, g);
  const L = g.LazyMods;
  await assert.rejects(L.load("g"), /没下载下来/);
  assert.deepEqual(added, ["js/a.js?v=1", "js/b.js?v=1"]);
  assert.equal(L.isLoaded("g"), false);
  fail = false;
  await L.load("g");
  assert.deepEqual(added, ["js/a.js?v=1", "js/b.js?v=1", "js/b.js?v=1"], "重来时把已经跑过的 a 又跑了一遍");
  assert.equal(L.isLoaded("g"), true);
  await L.load("g");
  assert.equal(added.length, 3, "装好了还在重复装");
  assert.equal(L.isLoaded("没登记的组"), true, "没登记延后的组当它本来就在");
});

// 拆成「开机那半 + 页面那半」的几份：页面那半用到的、开机那半里定义的名字，必须一个不落地递过去。
//   2026-10-18 记账拆完漏了 genComments（async function 那种写法当时没认出来），选角色批注一点就报找不到。
test("拆开的两半：页面那半用到的开机那半的名字，全都递过去了（async function、一行几个 const 也算）", () => {
  const nocom = t => t.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  [["js/ledger-core.js", "js/ledger.js", "LedgerCore"], ["js/fanfic-core.js", "js/fanfic.js", "FanficCore"], ["js/shua-core.js", "js/shua.js", "ShuaCore"], ["js/pomodoro-core.js", "js/pomodoro.js", "PomoCore"], ["js/trpg-core.js", "js/trpg.js", "TrpgCore"], ["js/health-core.js", "js/health.js", "HealthCore"], ["js/astro-core.js", "js/astro.js", "AstroCore"], ["js/shike-core.js", "js/shike.js", "ShikeCore"], ["js/dwell-core.js", "js/dwell.js", "DwellCore"], ["js/watch-core.js", "js/watch.js", "WatchCore"]].forEach(([cf, uf, v]) => {
    if (!fs.existsSync(path.join(__dirname, "..", cf))) return;
    const core = R(cf), ui = R(uf);
    const names = new Set();
    core.split("\n").forEach(l => {
      let m = /^  (?:const|let|var)\s+(.*)$/.exec(l);
      // 只认最外层的「名字 =」：一行里箭头函数自己的局部变量（const r = x => …）不算（2026-10-18 健康那份就有）
      if (m) { let d = 0, seg = ""; for (const ch of m[1] + ",") {
        if ("([{".includes(ch)) d++; else if (")]}".includes(ch)) d--;
        if (d === 0 && ch === ",") { const mm = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(seg); if (mm) names.add(mm[1]); seg = ""; } else seg += ch;
      } }
      m = /^  (?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(l);
      if (m) names.add(m[1]);
    });
    const dm = new RegExp("const \\{ ([^}]*) \\} = (?:window|\\(typeof window !== \"undefined\" \\? window : globalThis\\))\\." + v + ";").exec(ui);
    assert.ok(dm, uf + " 没从 window." + v + " 取");
    const have = new Set(dm[1].split(",").map(x => x.trim()));
    const own = new Set([...ui.matchAll(/^  (?:async\s+)?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
    const body = nocom(ui.replace(dm[0], ""));
    const miss = [...names].filter(n => !have.has(n) && !own.has(n) && new RegExp("(?<![\\w$.])" + n.replace(/\$/g, "\\$") + "(?![\\w$])").test(body));
    assert.deepEqual(miss, [], uf + " 用到了却没从 " + cf + " 递过来：" + miss.join("、"));
  });
});

// 页面那半拿到的是 const 解构出来的一份，给它重新赋值就是「Assignment to constant variable」，整页打不开。
//   2026-10-18 同人文拆完，FanficApp 每次画都给 ficMeOf / ficProfile 赋值，当场炸；改成经 setFicMe 递回开机那半。
//   同名的局部 const（页面里自己声明的那种）不算。
test("拆开的两半：页面那半不给共用的名字重新赋值", () => {
  [["js/ledger.js", "LedgerCore"], ["js/fanfic.js", "FanficCore"], ["js/shua.js", "ShuaCore"], ["js/pomodoro.js", "PomoCore"], ["js/trpg.js", "TrpgCore"], ["js/health.js", "HealthCore"], ["js/astro.js", "AstroCore"], ["js/shike.js", "ShikeCore"], ["js/dwell.js", "DwellCore"], ["js/watch.js", "WatchCore"]].forEach(([uf, v]) => {
    if (!fs.existsSync(path.join(__dirname, "..", uf))) return;
    const ui = R(uf).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    const dm = new RegExp("const \\{ ([^}]*) \\} = (?:window|\\(typeof window !== \"undefined\" \\? window : globalThis\\))\\." + v + ";").exec(ui);
    if (!dm) return;
    const body = ui.replace(dm[0], "");
    const hit = dm[1].split(",").map(x => x.trim()).filter(n => {
      const re = new RegExp("(^|[^\\w$.])" + n.replace(/\$/g, "\\$") + "\\s*(=(?!=)|\\+=|-=|\\+\\+|--)", "m");
      const m = re.exec(body);
      if (!m) return false;
      // 那一行是 const/let 声明（局部同名）就放过
      const line = body.slice(body.lastIndexOf("\n", m.index) + 1, body.indexOf("\n", m.index));
      return !new RegExp("\\b(const|let|var)\\s+[^=]*\\b" + n + "\\b").test(line);
    });
    assert.deepEqual(hit, [], uf + " 给共用的名字重新赋值了：" + hit.join("、"));
  });
});
