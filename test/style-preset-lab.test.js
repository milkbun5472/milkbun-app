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

// —— 她 2026-08-23 传了一份 Ako 1.91 酒馆预设，要拆成能勾的模块 ——
// 仓库是公开的，Ako 的正文不进 git；这里只测导入这条路本身。

const SPU = (() => {
  const store = {};
  const win = {};
  const sandbox = {
    window: win,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    saveJSON: (k, v) => { store[k] = JSON.stringify(v); },
    callAI: async () => "", narrativeCore: () => ""
  };
  new Function(...Object.keys(sandbox), sp)(...Object.values(sandbox));
  return win.StylePresets;
})();

const BUNDLE = {
  modules: [
    { id: "t_a", cat: "t_cat", catZh: "测试类", name: "甲", hint: "h", text: "甲的正文写得够长了吧" },
    { id: "t_b", cat: "t_cat", catZh: "测试类", name: "乙", hint: "h", text: "乙的正文写得够长了吧" },
    { name: "", text: "没名字的要被丢掉" },
    { name: "没正文的", text: "  " }
  ],
  presets: [{ id: "t_p", name: "测试预设", mods: ["t_a", "t_b"] }]
};

test("json 包能一次导入一堆可勾选模块", () => {
  const r = SPU.importBundle(BUNDLE);
  assert.deepEqual(r, { modules: 2, presets: 1 });
  assert.equal(SPU.userModules().length, 2, "缺名字或缺正文的要被丢掉");
  const cat = SPU.allCats().find(c => c.id === "t_cat");
  assert.ok(cat && cat.user && cat.mods.length === 2, "导入的模块要自成一类挂在内置分类后面");
  assert.equal(SPU.allCats().length, SPU.CATS.length + 1);
});

test("导入的模块和内置模块平级：能混用、顺序照排", () => {
  const mixed = SPU.textFor({ mods: ["ac_no_ceo", "t_a"] }, "offline", {});
  assert.ok(mixed.indexOf("别滑进霸总腔") >= 0 && mixed.indexOf("甲的正文") >= 0);
  assert.ok(mixed.indexOf("别滑进霸总腔") < mixed.indexOf("甲的正文"));
  assert.ok(SPU.textFor({ mods: ["t_b", "t_a"] }, "offline", {}).indexOf("乙的正文") < SPU.textFor({ mods: ["t_b", "t_a"] }, "offline", {}).indexOf("甲的正文"));
});

test("同一包导两次不会变出两份", () => {
  SPU.importBundle(BUNDLE);
  assert.equal(SPU.userModules().length, 2);
  assert.equal(SPU.list().filter(p => p.id === "t_p").length, 1);
});

test("导入的模块顶不掉内置模块", () => {
  SPU.importBundle({ modules: [{ id: "ac_no_ceo", name: "冒名顶替", text: "把内置那条换掉" }] });
  assert.ok(SPU.moduleById("ac_no_ceo").text.indexOf("把内置那条换掉") < 0);
});

test("删掉导入的模块，用到它的预设自动跳过、不报错", () => {
  SPU.removeUserModule("t_a");
  const txt = SPU.textFor(SPU.byId("t_p"), "offline", {});
  assert.ok(txt.indexOf("甲的正文") < 0);
  assert.ok(txt.indexOf("乙的正文") >= 0, "只掉这一条，别的照留");
});

test("不认识的 json 直接拒绝，不当成空包默默吞掉", () => {
  assert.throws(() => SPU.importBundle({ foo: 1 }), /没有 modules 也没有 presets/);
  assert.throws(() => SPU.importBundle(null), /没有 modules 也没有 presets/);
});

test("界面上 json 走导包、别的文件仍走整段手写", () => {
  assert.ok(lab.indexOf("SP.importBundle(d)") > 0);
  assert.ok(lab.indexOf("const takeText") > 0);
  assert.ok(lab.indexOf("SP.allCats()") > 0, "模块库要显示导入的分类");
  assert.ok(lab.indexOf("SP.moduleById(id)") > 0, "已选列表要认得导入的模块");
  assert.ok(lab.indexOf("SP.removeUserModule(m.id)") > 0, "导入的模块要能删");
});

// —— 她导进去变成了一大坨（2026-08-23）——
// 原因：靠文件名 /\.json$/ 认包，iOS 从「文件」里选出来常常没有扩展名，
// 于是整包掉进「手写／导入」那格。改成看内容判定，并补两条不靠文件选择器的路。

test("认包看内容不看文件名", () => {
  assert.ok(lab.indexOf("/^\\s*[{\\[]/.test") > 0, "要按开头的 { 或 [ 判形状");
  assert.ok(lab.indexOf("/\\.json$/i.test(file.name)") < 0, "不许再靠文件名认包");
  assert.ok(lab.indexOf("⚠️判定看的是内容不是文件名") > 0, "病因写在代码里");
});

test("选不出文件时还有两条路：粘贴、和把已经变成一坨的那条就地拆开", () => {
  assert.ok(lab.indexOf("const pasteBundle") > 0);
  assert.ok(lab.indexOf('"粘贴模块包"') > 0);
  assert.ok(lab.indexOf('"拆成模块"') > 0);
  assert.ok(lab.indexOf("commit(SP.list().filter(p => p.id !== cur.id))") > 0, "拆开之后原来那条一坨要删掉");
});

test("是 json 但不是模块包，要报错，不许再倒进手写框", () => {
  assert.ok(lab.indexOf("里面没有 modules／presets，不是模块包") > 0);
  // takeText 的分支：认出包 → bundle；是 json 但没有那两个键 → 抛；其余 → free
  const fn = lab.slice(lab.indexOf("const takeText"), lab.indexOf("const peek"));
  assert.ok(fn.indexOf('return "bundle"') > 0 && fn.indexOf('return "free"') > 0);
  assert.ok(fn.indexOf("if (d) throw new Error") > 0);
});

// —— 「想删预设删不掉，按不动按钮」（她 2026-08-23）——
// 两个原因叠在一起：热区只有十几像素高；删除走 confirm()，装成 PWA 之后
// 弹不出来时代码把它当成「取消」，表现同样是「按了没反应」。

test("预设台里不许再用 confirm 做删除确认", () => {
  const calls = lab.split("\n").filter(l => !/^\s*\/\//.test(l) && l.indexOf("confirm(") >= 0);
  assert.deepEqual(calls, [], "PWA 里弹不出来就等于静默取消");
  assert.ok(lab.indexOf("PWA 之后不一定弹得出来") > 0, "病因写在代码里");
});

test("删除改成点两下：先问一句，再点才真删，还能反悔", () => {
  assert.ok(lab.indexOf('const [armed, setArmed] = useState("")') > 0);
  assert.ok(lab.indexOf('armed === cur.id ? "真删？再点一下" : "删掉这条"') > 0);
  assert.ok(lab.indexOf('h("button", { onClick: () => setArmed(""), style: S.tapGhost(t.fog) }, "算了")') > 0);
  const fn = lab.slice(lab.indexOf("const delPreset"), lab.indexOf("const toggleMod"));
  assert.ok(fn.indexOf("if (armed !== cur.id) { setArmed(cur.id); return; }") > 0, "第一下只上膛");
  assert.ok(fn.indexOf('setArmed(""); commit(next)') > 0, "删完要卸膛，否则下一条一点就没");
});

test("小字按钮都给够热区，别再是一条 15px 高的字", () => {
  assert.ok(lab.indexOf("tapGhost: color => ({ minHeight: 40") > 0);
  assert.ok(lab.indexOf("tapIcon: color => ({ minWidth: 38, minHeight: 38") > 0);
  // 原来那几个 padding:0 / padding:"0 4px" 的写法不许留着
  assert.ok(lab.indexOf('fontSize: 14, padding: "0 4px"') < 0);
  assert.ok(lab.indexOf('color: t.accent }, "删掉这条")') < 0);
});

test("导入模块的「删」是独立按钮，不是套在模块按钮里的 span", () => {
  const seg = lab.slice(lab.indexOf("c.mods.map(m =>"), lab.indexOf("c.mods.map(m =>") + 1800);
  assert.ok(seg.indexOf('m.user ? h("button"') > 0, "按钮套按钮在 iOS 上点谁看运气");
  assert.ok(seg.indexOf('m.user ? h("span"') < 0);
  assert.ok(lab.indexOf("按钮套按钮在 iOS 上点谁很看运气") > 0);
});
