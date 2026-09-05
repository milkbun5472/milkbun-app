// 攻略（她 2026-09-04：「重做一遍名片问号里的攻略…最上面写如果不会问秋秋」；
// 2026-09-05：「有些同一个页面的都分开两条了。理想状态是点开每个 app
// 一个界面详细说明他能干啥」）。
//
// v63.45 起这一页【自己不存数据】：说明只剩 assistant-manual.js 那一份，
// 攻略按 app 把它归堆——一个 app 一行，点开是整页。
// 原来它另存了一份 53 条的 DB：同一件事写了两遍（改一处漏一处），
// 而且是按【话题】切的——聊天一个 app 被拆成七条摆在一起，桌面拆成五条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/codex.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const manSrc = fs.readFileSync(path.join(root, "js/assistant-manual.js"), "utf8");
const M = (() => { const g = {}; new Function("window", manSrc)(g); return g.AssistantManual; })();

test("攻略自己不再存一份说明——只有一份数据", () => {
  assert.ok(!/const DB = \[/.test(src), "那份 53 条的 DB 又长回来了");
  assert.match(src, /window\.AssistantManual/, "没接手册那一份");
  // 说明书那一页只剩壳：皮 + 怎么摆，一句功能说明都不许写死在这儿
  // 旧那份 DB 的指纹：一句话点题 + "\n· " 分点。这一页里一条都不许再有
  const code = src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(code.indexOf("\\n· ") < 0, "攻略里又写死了带分点的功能说明");
  // ⚠️别写成 /b: "/：sub: "这台手机的说明书" 也以 b 结尾，会误伤
  assert.ok(!/\{ cat: "/.test(code) && !/, b: "/.test(code), "旧那份 DB 的字段又回来了");
});

test("一个 app 一行，点开是整页——不是把同一页拆成好几条摆着", () => {
  // 目录那一层：一行一个 app
  assert.match(src, /M\.APPS\.filter\(hitApp\)/, "目录不是按 app 列的");
  assert.match(src, /setOpen\(a\.id\)/, "点一行不是打开那个 app");
  // 详情那一层：整页（no-half-sheet），把这个 app 名下的词条全摊开
  assert.match(src, /if \(open\) \{/, "没有详情那一页");
  assert.match(src, /const list = app \? M\.appEntries\(app\.id\) : \[\];/, "详情页没把这个 app 的词条捞全");
  assert.match(src, /className: "h-full flex flex-col", style: manualSkin\(t\)/);
  assert.match(src, /className: "flex-1 min-h-0 overflow-y-auto/);
  assert.ok(!/h\(Sheet,/.test(src), "详情做成半窗了");
  // 返回一次退一层：详情 → 目录 → 出去
  assert.match(src, /bg: "transparent", onBack: \(\) => setOpen\(null\)/, "详情页的返回不是退一层");
  // 原来那种「展开一条」的折叠式没了
  assert.ok(!/setOpen\(on \? null : e\.t\)/.test(src), "又变回原地展开的折叠条了");
});

test("聊天那七条、桌面那五条，现在归成一页", () => {
  // 她点名的就是这个：同一个页面被拆成好几条摆在目录里
  const chat = M.appEntries("chat").map(e => e.id);
  ["chat", "offline", "group", "call"].forEach(k => assert.ok(chat.includes(k), "聊天这一页少了：" + k));
  assert.equal(M.APPS.filter(a => a.id === "chat").length, 1, "聊天在目录里还是不止一行");
  // 反过来：一个 app 只在目录里出现一次
  const ids = M.APPS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length, "目录里有重复的 app");
  // 每个 app 底下至少有一条，不许有空页
  M.APPS.forEach(a => assert.ok(M.appEntries(a.id).length, a.id + " 这一页是空的"));
  // ⚠️跟 app 同名的那一条必须排在最前面：目录那一行显示的是第一条的话。
  //   不排的话「人格档案馆」那一行会显示成「他今天一天的安排」——那是它名下
  //   schedule 那一条，因为 schedule 在词条表里排得更靠前（浏览器里看出来的）。
  M.APPS.forEach(a => {
    const first = M.appEntries(a.id)[0];
    if (M.byId(a.id)) assert.equal(first.id, a.id, a.zh + " 这一行显示的是它名下别的一条：" + first.id);
  });
  // 每条词条都得挂在一个真存在的 app 上
  M.entries.forEach(e => assert.ok(ids.includes(e.app), e.id + " 挂在一个不存在的 app 上：" + e.app));
});

test("主屏上每个 app 都在攻略里找得到", () => {
  const names = [...comp.matchAll(/kind: "app", zh: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(names.length >= 25, "主屏 app 名单抓少了：" + names.length);
  const all = M.APPS.map(a => a.zh).join("\n") + "\n"
    + M.entries.map(e => e.zh + e.what + (e.how || "") + (e.more || []).join("") + (e.kw || []).join(" ")).join("\n");
  // 几个在攻略里换了叫法的，按它现在的说法算数
  const alias = { "秋秋": "秋秋（就是我）", "梦境": "梦" };
  const missing = names.filter(n => all.indexOf(alias[n] || n) < 0);
  assert.deepEqual(missing, [], "这几个 app 攻略里没写：" + missing.join(" "));
});

test("最上面那一条是「问秋秋」，详情页底下也有一条，都点得进去", () => {
  assert.match(src, /这儿没写的，问秋秋/);
  assert.match(src, /这一页还有不明白的，直接问秋秋/, "详情页底下没有那条");
  assert.equal((src.match(/props\.onAskAssistant && props\.onAskAssistant\(\)/g) || []).length, 2,
    "两处都得真的点得进去");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /onAskAssistant: \(\) => setScreen\("assistant"\)/, "App 那头没把这条线接上");
});

test("每一条都是「一句话点题 + 分点」，不是一大坨", () => {
  // 言秋那一片（三席会客 / 互救台 / 值班室）手册里本来就只有一句——
  // 那是他的东西，除了他本人不许动，这儿也不替他写说明
  const YQ = ["lounge", "rescue", "vpscodex"];
  M.entries.forEach(e => {
    if (YQ.includes(e.id)) { assert.ok(e.what && e.where, e.id + "：连一句都没有"); return; }
    assert.ok(e.what && e.what.length >= 12, e.id + "：正文太短，等于没写");
    // 目录那一行只给一句够认出来的话——长的在这儿掐掉，命中之后才发全文
    assert.ok(M.teaser(e).length <= 44, e.id + "：目录那一行太长");
    (e.more || []).forEach(m => assert.ok(m && m.length >= 4, e.id + "：有一条分点是空的"));
  });
  // 攻略把分点画成分点，不是糊成一段
  assert.match(src, /\(e\.more \|\| \[\]\)\.length \? h\("div"/, "详情页没把分点画出来");
  assert.match(src, /\}, "·"\)/, "分点前面没有点");
});

test("不留英文标题（no-english-titles）", () => {
  assert.ok(!/en: "/.test(src), "又给 Head 传英文副标题了");
  assert.match(src, /sub: "这台手机的说明书"/);
  M.APPS.forEach(a => assert.ok(/[一-龥]/.test(a.zh), "这一页的名字里没有中文：" + a.id));
});

test("形状不是一排药丸（tabs-not-plain-pills）", () => {
  // 章节号 + 条目号（01.03）＝说明书那套编法
  assert.match(src, /no2\(ci\) \+ "\." \+ no2\(i\)/, "条目没有说明书那种章节编号");
  assert.ok(!/CATS\.map\([^)]*=> h\("button"/.test(src), "分类被做成了一排可点的标签");
  // 目录和详情两层里都不许出现并列的圆角药丸当分类用
  const listPart = src.slice(src.indexOf("apps.length === 0"));
  assert.ok(!/borderRadius: 999/.test(listPart), "分类又摆成一排药丸了");
  // 点得着（tabs-not-plain-pills 第 1 条）
  assert.match(src, /minHeight: 44/, "目录那一行的可点区不够");
});

test("那条「先导出再删」的规矩必须写在攻略里（never-say-delete-first）", () => {
  const all = M.entries.map(e => (e.what || "") + (e.how || "") + (e.more || []).join("")).join("\n");
  assert.ok(/导出/.test(all) && /json/i.test(all), "说明书里没告诉她删之前先导出");
});
