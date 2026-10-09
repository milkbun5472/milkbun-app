// 秋秋小窝（她 2026-10-08）：大家传、大家导；第一版不收图、没有举报键、不能有她的名字。
//   这一份钉三件事：接线（真的点得到）、打包（不带记忆和绑定）、导入（各回各的库、id 不撞她自己的）。
//   桩照【写存档的那段】写（施工规则/stub-from-the-writer.md）：
//     世界书词条 ← screens.js WorldBookEntryPage 的 base；文风 ← components.js importStyleFile；
//     预设 ← style-presets.js importBundle 落盘的形状。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const nest = R("js/nest.js"), app = R("js/app.js"), comp = R("js/components.js"), html = R("index.html"),
  screens = R("js/screens.js"), ts = R("js/theme-studio.js"), tsui = R("js/theme-studio-ui.js"), engine = R("js/engine.js");

function loadNest(store) {
  const g = { StylePresets: null };
  const saved = {};
  const loadJSON = (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d);
  const saveJSON = (k, v) => { saved[k] = v; store[k] = v; return true; };
  new Function("window", "React", "h", "Svg", "loadJSON", "saveJSON", "localStorage", nest)(
    g, { useState: () => [], useEffect: () => {}, useRef: () => ({}) }, () => null, () => null, loadJSON, saveJSON, { getItem: () => null });
  return { N: g.Nest, g, saved };
}

test("接线：主屏有图标、路由进得去、脚本先于 app.js 加载", () => {
  assert.match(comp, /nest: \{ kind: "app", zh: "小窝", G: window\.GNest/);
  assert.match(nest, /window\.GNest = /);
  assert.match(app, /screen === "nest"\) body = h\(window\.NestApp, \{/);
  const i = html.indexOf("js/nest.js?v="), j = html.indexOf("js/app.js?v=");
  assert.ok(i > 0 && j > i, "nest.js 没加载，或者排在 app.js 后面");
});

test("走秋秋机自己的前门：包里不许有 Worker 真地址、不许有她的名字", () => {
  assert.match(nest, /const NEST = "https:\/\/qiuqiu-machine\.pages\.dev\/nest";/);
  assert.ok(!/workers\.dev/.test(nest), "Worker 真地址进了包——里头带着账号名");
  assert.ok(!/lisa/i.test(nest), "小窝里出现了她的名字");
  assert.ok(!/report|举报/.test(nest.replace(/^\s*\/\/.*$/gm, "")), "她说了不要举报键");
});

test("设备编号只有一份：礼物线和小窝都问 qqDeviceId 要", () => {
  assert.match(engine, /function qqDeviceId\(\) \{/);
  const gh = engine.slice(engine.indexOf("function giftHeaders"), engine.indexOf("function qqDeviceId"));
  assert.ok(gh.length > 0, "抠不出 giftHeaders");
  assert.match(gh, /const d = qqDeviceId\(\);/);
  assert.equal((engine.match(/localStorage\.setItem\("qq_giftDevice"/g) || []).length, 1, "编号又在第二处生成了");
  assert.match(nest, /qqDeviceId\(\)/);
});

test("主题包换了名字：导出写 qq-theme，老文件照样导得进来", () => {
  assert.match(ts, /const PACK_KIND = "qq-theme", PACK_KINDS_READ = \[PACK_KIND, \["lis", "a-theme"\]\.join\(""\)\];/);
  assert.match(ts, /kind: PACK_KIND, format: 1/);
  assert.match(ts, /PACK_KINDS_READ\.indexOf\(pkg\.kind\) < 0/);
  assert.match(tsui, /"qq-theme-" \+ new Date\(\)/);
  assert.match(screens, /"qq-bubble-" \+ new Date\(\)/);
});

test("主题工作台接得住小窝递过来的那一份，接完就清", () => {
  const i = tsui.indexOf("const ho = g.__nestHandoff;");
  assert.ok(i > 0, "主题工作台不接小窝的包");
  const seg = tsui.slice(i, i + 900);
  assert.match(seg, /g\.__nestHandoff = null;/, "不清掉的话，下次进工作台又导一遍");
  assert.match(seg, /applyPack\(ho\.text\)/, "主题／美化没走手动导入那条路");
  assert.match(seg, /patchDraft\(\{ globalCSS:/, "CSS 没进草稿");
});

test("世界书：传上去不带 id 和绑定的角色；导进来换新 id、一个角色都不绑", () => {
  const entry = { id: "le_1", title: "雾港", keyword: "雾", category: "世界观", charIds: ["c_mine"], payload: "港口终年起雾", regex: false, enabled: true, alwaysOn: true, ensemble: false, priority: 3, scope: { chat: true } };
  const { N } = loadNest({});
  const out = JSON.parse(N.packLore([entry]));
  assert.equal(out.kind, "qq-lore");
  assert.equal(out.entries[0].charIds, undefined, "把她的角色 id 传上去了");
  assert.equal(out.entries[0].id, undefined);
  assert.equal(out.entries[0].payload, "港口终年起雾");
  let got = null;
  N.importInto("lore", JSON.stringify({ kind: "qq-lore", entries: [Object.assign({}, entry)] }), "雾港", { onAddLore: l => { got = l; } });
  assert.deepEqual(got[0].charIds, [], "别人那份的绑定跟进来了");
  assert.match(got[0].id, /^le_nest_/);
});

test("文风：落进 x_offlineStyles，形状跟文风库自己导入的一样", () => {
  const { N, saved } = loadNest({ x_offlineStyles: [{ key: "custom_1", name: "旧的", prompt: "x", custom: true }] });
  N.importInto("style", JSON.stringify({ kind: "qq-style", name: "冷调", prompt: "短句" }), "冷调", {});
  const list = saved.x_offlineStyles;
  assert.equal(list.length, 2, "把她原来的文风顶掉了");
  assert.deepEqual(Object.keys(list[1]).sort(), ["custom", "imported", "key", "name", "prompt"]);
  assert.match(comp, /\{ key, name, prompt, custom: true, imported: true \}/, "文风库自己导入的形状变了，这边要跟着改");
});

test("预设：id 全部换新，模块引用跟着换，内置模块不动", () => {
  const { N, g } = loadNest({});
  let bundle = null;
  g.StylePresets = { importBundle: b => { bundle = b; return { presets: b.presets.length, modules: b.modules.length }; } };
  N.importInto("preset", JSON.stringify({ modules: [{ id: "um_x", name: "我的", text: "t" }], presets: [{ id: "sp_a", name: "P", mods: ["um_x", "cam_hands"] }] }), "P", {});
  assert.notEqual(bundle.presets[0].id, "sp_a", "沿用别人的 id，会原地盖掉她自己那份同 id 的预设");
  assert.equal(bundle.presets[0].mods[0], bundle.modules[0].id, "模块换了 id，预设还指着旧的");
  assert.equal(bundle.presets[0].mods[1], "cam_hands", "内置模块被改名了");
});

test("人设：只带名字、简介、正文；导进来是新建一个角色", () => {
  const { N } = loadNest({});
  const out = JSON.parse(N.packPersona({ id: "c1", name: "沈", tagline: "医生", persona: "正文", longMem: "秘密", avatar: "iv_1" }));
  assert.deepEqual(Object.keys(out).sort(), ["kind", "name", "persona", "tagline"]);
  let made = null;
  N.importInto("persona", JSON.stringify(out), "沈", { onAddChar: o => { made = o; } });
  assert.deepEqual(made, { name: "沈", tagline: "医生", persona: "正文" });
  assert.match(app, /onAddChar: o => \{ createCharFromAssistant\(o\); \}/);
});

// 她 2026-10-08：「如果想要 css 应用在单一个聊天怎么弄」——CSS 导入先问放哪儿，能只放给一个人／一个群／一个人的线下
test("CSS 只放一处：接在那一格后面，不顶掉原来的；写入口是设置自己那三个", () => {
  const { N, g } = loadNest({});
  const slots = { "chat:c1": "a{color:red}" }, wrote = [];
  const props = { cssSlotOf: (w, id) => slots[w + ":" + id] || "", onPatchCssSlot: (w, id, css) => { wrote.push([w, id]); slots[w + ":" + id] = css; } };
  N.cssInto("chat", "c1", "b{color:blue}", "蓝", props);
  assert.match(slots["chat:c1"], /^a\{color:red\}\n\n\/\* 小窝：蓝 \*\/\nb\{color:blue\}$/, "把她原来那格顶掉了");
  N.cssInto("group", "g1", "c{}", "x", props);
  assert.equal(slots["group:g1"], "/* 小窝：x */\nc{}");
  g.ThemeStudio = { unsafeReason: () => "花括号不配对" };
  assert.throws(() => N.cssInto("offline", "c1", "d{", "坏", props), /放不进去/);
  assert.deepEqual(wrote, [["chat", "c1"], ["group", "g1"]], "不安全的也落盘了");
  assert.deepEqual(Object.keys(N.CSS_SLOTS), ["chat", "group", "offline"]);
  assert.match(app, /onPatchCssSlot: \(where, id, css\) => where === "chat" \? patchChatSetting\(id, \{ customCSS: css \}\)/);
  assert.match(app, /saveGroupSettings\(id, \{ customCSS: css \}\) : saveOfflineSettings\(id, \{ customCSS: css \}\)/);
});

test("详情页有复制；CSS 点导入先问放哪儿", () => {
  assert.match(nest, /const ok = await copyText\(it\.payload\);/);
  assert.match(nest, /if \(it && it\.kind === "css" && !placing\) \{ setPlacing\(true\); return; \}/);
  assert.match(nest, /placing \? h\(CssPlace, \{/);
});
