const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const sp = R("js/style-presets.js");
const lab = R("js/style-lab.js");
const engine = R("js/engine.js");
const theater = R("js/theater.js");
const comp = R("js/components.js");
const fanfic = R("js/fanfic.js");
const app = R("js/app.js");
const index = R("index.html");

// 文风预设台（Lisa 2026-08-23）。一处生产、三处消费；三处各有「吃不吃」，
// 不吃＝行为和以前一字不差。这份测试盯的就是那句「一字不差」。

// 真跑 style-presets.js
const SP = (() => {
  const store = {};
  const win = {};
  const sandbox = {
    window: win,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    saveJSON: (k, v) => { store[k] = JSON.stringify(v); },
    callAI: async () => "", narrativeCore: () => "NARRATIVE_CORE"
  };
  new Function(...Object.keys(sandbox), sp)(...Object.values(sandbox));
  return win.StylePresets;
})();

test("模块 id 唯一、每条都有真正的正文", () => {
  const ids = [];
  SP.CATS.forEach(c => c.mods.forEach(m => {
    ids.push(m.id);
    const txt = typeof m.text === "function" ? m.text({ uName: "她" }) : m.text;
    assert.ok(String(txt || "").trim().length > 30, m.id + " 的正文太短或是空的");
    assert.ok(String(m.name || "").trim(), m.id + " 没有名字");
    assert.ok(String(m.hint || "").trim(), m.id + " 没有一句话说明");
  }));
  assert.equal(new Set(ids).size, ids.length, "有重复的模块 id");
  assert.ok(ids.length >= 18, "模块太少了：" + ids.length);
});

test("开关关着 = 一个字都不注入", () => {
  assert.equal(SP.blockFor({ presetId: "sp_x" }, "offline"), "");
  assert.equal(SP.blockFor({ presetOn: true }, "offline"), "");
  assert.equal(SP.blockFor(null, "offline"), "");
  assert.equal(SP.wrap(""), "");
  assert.equal(SP.wrap("   "), "");
});

test("勾选顺序就是喂进去的顺序", () => {
  const p = { id: "sp_1", mods: ["ac_no_label", "cam_hands", "craft_subtext"], free: "", freePos: "after" };
  const a = SP.textFor(p, "offline", {});
  const b = SP.textFor({ ...p, mods: ["craft_subtext", "cam_hands", "ac_no_label"] }, "offline", {});
  assert.ok(a.indexOf("不给情绪贴标签") < a.indexOf("近景在手上"));
  assert.ok(b.indexOf("近景在手上") < b.indexOf("不给情绪贴标签"));
  assert.notEqual(a, b);
});

test("手写块能放模块前面也能放后面", () => {
  const base = { id: "sp_2", mods: ["ac_no_label"], free: "我的霜骨" };
  assert.ok(SP.textFor({ ...base, freePos: "after" }, "offline", {}).endsWith("我的霜骨"));
  assert.ok(SP.textFor({ ...base, freePos: "before" }, "offline", {}).startsWith("我的霜骨"));
});

test("小剧场本来就有的三条，在小剧场里自动跳过、别的地方照给", () => {
  const p = { id: "sp_3", mods: ["cam_no_shrink", "lay_paragraph", "beat_one", "ac_no_label"] };
  const th = SP.textFor(p, "theater", { uName: "她" });
  const off = SP.textFor(p, "offline", { uName: "她" });
  ["镜头不随人物收缩", "成段,不要一句一行", "【节拍】一次回复只演"].forEach(k => {
    assert.ok(th.indexOf(k) < 0, "小剧场重复注入了：" + k);
    assert.ok(off.indexOf(k) >= 0, "线下没吃到：" + k);
  });
  assert.ok(th.indexOf("不给情绪贴标签") >= 0, "非 builtin 的模块不该被跳过");
});

test("节拍模块会带上用户名，不写死成某一个人", () => {
  assert.ok(SP.SM_BEAT("阿棠").indexOf("阿棠") >= 0);
  assert.ok(SP.textFor({ mods: ["beat_one"] }, "offline", { uName: "阿棠" }).indexOf("阿棠") >= 0);
});

test("小剧场那三条只留一份字面量，theater.js 引用它", () => {
  ["镜头不随人物收缩", "成段,不要一句一行", "【节拍】一次回复只演"].forEach(k => {
    assert.ok(theater.indexOf(k) < 0, "theater.js 里还留着副本：" + k);
    assert.ok(sp.indexOf(k) >= 0, "style-presets.js 里没有：" + k);
  });
  ["SM_BEAT(uName)", "SM_CAMERA", "SM_PARAGRAPH"].forEach(k =>
    assert.ok(theater.indexOf("window.StylePresets." + k) >= 0, "theater.js 没引用 " + k));
});

test("三处消费方都接了预设，而且都走同一个 blockFor 开关", () => {
  assert.match(engine, /function offlineResolveStyleText\(session, ctx\)/);
  assert.match(engine, /window\.StylePresets\.blockFor\(s, "offline", ctx \|\| \{\}\)/);
  assert.match(theater, /window\.StylePresets\.blockFor\(line, "theater"/);
  assert.match(fanfic, /window\.StylePresets\.textFor\(p, "fanfic", \{\}\)/);
});

test("开关关着时线下的回落路径和以前一模一样", () => {
  const body = engine.slice(engine.indexOf("function offlineResolveStyleText"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  assert.match(fn, /return s\.stylePrompt \? s\.stylePrompt : offlineStyleText\(s\.styleKey\)/);
  // 「用真值判断不是 != null」那条老坑不能因为这次重构又踩回去
  assert.ok(fn.indexOf("!= null") < 0);
});

test("本场口味挪到了文风之后（后面的模型看得更重）", () => {
  ["false", "true"].forEach(grp => {
    const i = engine.indexOf("offlineTasteBlock(session.taste, " + grp + ")");
    assert.ok(i > 0, "找不到 " + grp + " 的口味块");
    const j = engine.lastIndexOf("window.StylePresets.wrap(styleText)", i);
    assert.ok(j > 0 && j < i, grp + " 的口味块还在文风前面");
  });
});

test("【文风要求】那段外壳只剩一份", () => {
  const hits = engine.split("【文风要求 · 文体层最高优先】").length - 1;
  assert.equal(hits, 0, "engine.js 里还留着手抄的外壳");
  assert.equal(sp.split("【文风要求 · 文体层最高优先】").length - 1, 1);
  assert.match(SP.wrap("X"), /本场口味/); // 挪位之后得跟模型说清口味不翻文风的规矩
});

test("线下两处设置页共用同一个预设小节，不再各写一份", () => {
  assert.equal(comp.split("function OfflineStylePresetSection(").length - 1, 1);
  assert.equal(comp.split("h(OfflineStylePresetSection, {").length - 1, 2);
  assert.equal(comp.split("onChangeStyle({ styleKey, presetOn, presetId, stylePrompt:").length - 1, 2);
  assert.equal(comp.split("onSaveSettings({ presetOn, presetId,").length - 1, 2);
  assert.equal(comp.split("onStart({ opening: opening.trim(), styleKey, presetOn, presetId,").length - 1, 2);
});

test("session 上真的存得下 presetOn / presetId", () => {
  assert.equal(app.split("presetOn: !!patch.presetOn, presetId: patch.presetId").length - 1, 2);
  assert.equal(app.split("presetOn: !!opts.presetOn,").length - 1, 2);
});

test("跳过去还能跳回来（线下是浮层，得先收再挂回去）", () => {
  assert.match(app, /const styleLabRef = useRef\(null\)/);
  assert.match(app, /styleLabRef\.current = \{ screen: screen, charId: offlineChar && offlineChar\.id, groupId: offlineGroup && offlineGroup\.id \}/);
  const back = app.slice(app.indexOf("const backFromStyleLab"), app.indexOf("const backFromStyleLab") + 700);
  assert.ok(back.indexOf("setOfflineChar(c)") > 0, "回来时没把线下浮层挂回去");
  assert.ok(back.indexOf("setOfflineGroup(g)") > 0, "回来时没把群线下浮层挂回去");
  assert.ok(back.indexOf("styleLabRef.current = null") > 0, "回来之后没清掉来路，会串");
  assert.match(app, /screen === "stylelab"\) body = h\(StyleLabApp/);
  assert.equal(app.split("onOpenStyleLab: goStyleLab").length - 1, 3); // 线下 + 群线下 + 小剧场
});

test("测试台的剧本是固定的，否则两份预设没法比", () => {
  assert.ok(SP.TEST_SCENES.length >= 4);
  SP.TEST_SCENES.forEach(s => {
    assert.ok(s.id && s.name && s.setting && s.user, "场景缺字段：" + s.id);
  });
  assert.equal(new Set(SP.TEST_SCENES.map(s => s.id)).size, SP.TEST_SCENES.length);
  // 场景写死在代码里，界面上只能选不能改
  assert.ok(lab.indexOf("SP.TEST_SCENES.map") > 0);
  assert.ok(lab.indexOf("setTScene") > 0 && lab.indexOf("setSceneText") < 0);
});

test("试写走线下同一套叙事底座，但不掺记忆库/行程/前情", () => {
  const fn = sp.slice(sp.indexOf("async function runTest"));
  assert.ok(fn.indexOf("narrativeCore") > 0);
  ["memLib", "schedNow", "priorSummary", "记忆库", "前情提要"].forEach(k =>
    assert.ok(fn.indexOf(k) < 0, "测试台掺了 " + k + "，对照就不干净了"));
});

test("同人文是勾进它自己的多选，不另造开关", () => {
  assert.match(fanfic, /function labStylePresets\(\)/);
  assert.match(fanfic, /\(cfg\.styles \|\| \[\]\)\.concat\(labStylePresets\(\)\)\.concat\(sharedStylePresets\(\)\)/);
  assert.ok(fanfic.indexOf("presetOn") < 0, "同人文不该有第二套开关");
});

test("版本指纹一致，两个新文件都挂上了", () => {
  const v = /APP_VERSION = "v([\d.]+)"/.exec(app)[1];
  ["style-presets", "style-lab"].forEach(f => {
    assert.ok(index.indexOf('js/' + f + '.js?v=' + v) > 0, f + " 的 ?v= 没跟上 " + v);
  });
  const bump = R("scripts/bump-version.mjs");
  ["style-presets", "style-lab"].forEach(f =>
    assert.ok(bump.indexOf('"' + f + '"') > 0, f + " 没进 bump 脚本的 CORE，下次发版会掉队"));
  // 加载顺序：数据层要在 engine 之前，界面层在 components 之前
  assert.ok(index.indexOf("js/style-presets.js") < index.indexOf("js/engine.js"));
  assert.ok(index.indexOf("js/style-lab.js") < index.indexOf("js/components.js"));
});

test("首页能点进去", () => {
  assert.match(comp, /stylelab: \{ kind: "app", zh: "文风台"/);
  assert.ok(comp.indexOf('"vpscodex", "assistant", "stylelab"') > 0, "默认布局里没有它，新装的人找不到");
});
