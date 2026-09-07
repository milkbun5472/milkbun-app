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
  // v61.58：默认布局改成她那套，文风台收在默认的「工作台」文件夹里
  // v64.53：默认布局按她那三页重排，文风台从「工作台」文件夹挪到第三页明面上。
  // 钉【意图】：默认桌面上摸得着（在页面上或在某个默认文件夹里都算）。
  // 摸得着＝要么自己躺在某一页上，要么在一个【本身摆在页面上】的默认文件夹里。
  // 只看文件夹存在是不够的：文件夹没摆上去，里面的东西一样点不到。
  const reachableInDefault = key => {
    const lay = comp.slice(comp.indexOf("const DEFAULT_LAYOUT = ["), comp.indexOf("const SP_RE = /^sp_/;"));
    if (new RegExp('"' + key + '"').test(lay)) return true;
    const fd = comp.slice(comp.indexOf("const DEFAULT_FOLDERS = {"), comp.indexOf("\n};", comp.indexOf("const DEFAULT_FOLDERS = {")));
    const m = fd.match(new RegExp('(f_def_\\w+):\\s+\\{ name: "[^"]+", keys: \\[[^\\]]*"' + key + '"[^\\]]*\\]'));
    return !!(m && new RegExp('"' + m[1] + '"').test(lay));
  };
  assert.ok(reachableInDefault("stylelab"), "默认桌面上摸不着文风台，新装的人找不到");

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
  // v65.10 抬到 40：tabs-not-plain-pills.md §2 那条「可点区别低于 40px」是这一页的地板，
  // 38 是当初随手写的，量出来就是差那 2px（排字槽里的 ↑↓× 三颗全在这个数上）。
  assert.ok(lab.indexOf("tapIcon: color => ({ minWidth: 40, minHeight: 40") > 0);
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

// —— 「试吃最低字数 1500 给我吐了 200」（她 2026-08-23）——
// 线下有 ensureOfflineMinimumScene 兜底补写，测试台第一版是裸调一次就完。
// 同一个模型在两边表现完全不同，那这个对照就白比了。

const RT = (model, stream) => {
  const store = {}, win = {}, calls = [];
  const sandbox = {
    window: win,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    saveJSON: (k, v) => { store[k] = JSON.stringify(v); },
    narrativeCore: () => "BASE", routeCanStream: () => stream !== false,
    offlineVisibleCharCount: t => String(t || "").replace(/\s/g, "").length,
    callAI: async (p, sys, msgs, opt) => { calls.push({ sys, opt, user: msgs[0].content }); return model(calls.length, opt); }
  };
  new Function(...Object.keys(sandbox), sp)(...Object.values(sandbox));
  return { SP: win.StylePresets, calls, store };
};




test("不设下限就只调一次，不平白多花一次钱", async () => {
  const h = RT(() => "戊".repeat(100));
  await h.SP.runTest({}, { char: { name: "x" }, minWords: 0 });
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].sys.indexOf("最终正文硬下限") < 0);
  assert.ok(h.calls[0].sys.indexOf("自然停下") > 0, "低下限时仍然是「写到需要回应就停」");
});

test("结果卡片要显示拿到几字 / 要几字，以及补写实况", () => {
  assert.ok(lab.indexOf('r.chars + " 字" + (r.want ? " / " + r.want : "")') > 0);
  assert.ok(lab.indexOf("(r.notes || []).join(") > 0);
  assert.ok(lab.indexOf("r.err || (r.want && r.chars < r.want) ? t.accent : t.fog") > 0, "没达标要标红");
});

// —— 「又 load failed 了」（她 2026-08-23）——
// 非流式线路上一个大请求两三分钟不吐首字节，网关当成死连接掐掉。
// 线下 v55.39 已经踩平过（NO_STREAM_CAP=4200 + 补写往上垒），试写台没跟上。




// —— 「但是我设的中转站应该都是 openai 格式的」（她 2026-08-23）——
// 说得对，所以 v55.57 那条 4200 上限对她一次都没生效：detectFormat 只看 baseUrl，
// openai 格式就一定 canStream=true。真凶是中转【收下 stream:true 却缓冲发回】——
// 照样几分钟没首字节、照样 Load failed，而我们还以为在流式。
// routeCanStream 判的是方言，不是「这家真的会推 SSE」，所以失败要能自己退回去。

const liar = (model, stream) => RT(model, stream);




test("一切正常就只调一次，退回逻辑不平白多花钱", async () => {
  const h = liar(() => "甲".repeat(1600), true);
  const r = await h.SP.runTest({}, { char: { name: "x" }, minWords: 1500 });
  assert.equal(h.calls.length, 1);
  assert.deepEqual(r.notes, []);
});


// —— 「很多都说支持 100w 上下文，不应该 4200 就被截断」（她 2026-08-23）——
// 她是对的，我把两件事搞混了：
// · Load failed 是【墙上时间】问题（非流式久久没首字节被网关掐），
// · 我却拿 max_tokens 去压时长——而思考模型的推理 token 也算在 max_tokens 里，
//   4200 被推理吃掉三千多，剩几百个给正文，首轮就只吐 202 字。
// 100w 上下文是【输入】侧，跟输出上限无关。
// 正确做法：上限给足（推理有地方放），用「这一轮写多少字」控制时长。









// —— 「那我不是要调用很多次 api」（她 2026-08-24）——
// 她按次计费，调用次数就是钱。我上一版为了「不被网关掐断」把每轮切到 700 字，
// 1500 字就要垒四五次——优化过头了。默认不分段：每轮把还差的一次要完。







// —— 「酒馆用差不多的站子，一次调用就能生成那么多不被截断，我只要一次调用」
//    （她 2026-08-24）——
// 去翻了她那份 Ako 1.91：openai_max_tokens 65535、字数给了下限【和上限】、
// 还有一条字数锁让模型自己数着写。三样我都做错了，然后拿多次调用去补窟窿。

test("一次试写就是一次调用，不偷偷补写", async () => {
  const h = RT(() => "甲".repeat(202), false);
  const r = await h.SP.runTest({ name: "A" }, { char: { name: "x" }, minWords: 1500 });
  assert.equal(h.calls.length, 1, "写不够也不许自己再调一次");
  assert.equal(r.chars, 202);
  assert.match(r.notes.join(""), /就这一次调用没再补/, "写不够要照实说，别悄悄花钱");
  // 补写阶梯的零件必须全部拆干净，别留着以后又偷偷长回来
  ["stripOverlap", "lowerChunk", "CHUNKKEY", "LEN_FLOOR", "THINK_HEADROOM"].forEach(n =>
    assert.ok(sp.indexOf(n) < 0, sp.indexOf(n) + " 处还留着 " + n));
});

test("max_tokens 是天花板不是预付款——按酒馆的量给", async () => {
  const h = RT(() => "甲".repeat(1600), false);
  await h.SP.runTest({ name: "A" }, { char: { name: "x" }, minWords: 1500 });
  assert.ok(h.calls[0].opt.maxTokens >= 16000,
    "只给了 " + h.calls[0].opt.maxTokens + "——思考模型的推理也算在里面，给小了正文就只剩两百字");
  assert.match(sp, /OUT_CEILING = 65535/);
  assert.ok(sp.indexOf("它是【天花板】不是预付款") > 0, "为什么给这么大，写在代码里");
});

test("字数要给下限【和上限】，还要让它自己数着写", () => {
  const rule = new Function("minW", sp.slice(sp.indexOf("function wordRule"), sp.indexOf("async function runTest")) + "\nreturn wordRule(minW);");
  const t = rule(1500);
  assert.match(t, /不少于 1500 字/);
  assert.match(t, /不超过 2025 字/, "只给下限模型没有目标区间，写到哪算哪");
  assert.match(t, /自己数着写/);
  assert.match(t, /没到下限就继续往下写，不要提前收尾/);
  assert.match(t, /不用场景铺陈、外貌描写、环境渲染或多余细节凑数/, "别让它拿景物注水");
  assert.equal(rule(0), "", "没设下限时这段整个不出现");
});

test("线路不肯 clamp 才退一档，只为这一种错多花一次", async () => {
  const h = RT(n => { if (n === 1) throw new Error("max_tokens is too large for this model"); return "甲".repeat(1600); }, false);
  const r = await h.SP.runTest({ name: "B" }, { char: { name: "x" }, minWords: 1500 });
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].opt.maxTokens, 8192);
  assert.match(r.notes.join(""), /不接受 \d+ 的 max_tokens，退到 8192 重试/);

  const other = RT(() => { throw new Error("Load failed"); }, false);
  await assert.rejects(() => other.SP.runTest({ name: "C" }, { char: { name: "x" }, minWords: 1500 }), /Load failed/);
  assert.equal(other.calls.length, 1, "别的错不许拿第二次调用去撞");
});

test("报错带上等了多久——分得清网关掐断和 CORS/密钥", async () => {
  const h = RT(() => { throw new Error("Load failed"); }, false);
  await h.SP.runTest({ name: "C" }, { char: { name: "x" }, minWords: 1500 }).catch(e =>
    assert.match(e.message, /等了 \d+ 秒/));
});

test("界面上说清每份只花一次调用", () => {
  assert.ok(lab.indexOf('"每份【只调一次 API】，不偷偷补写。"') > 0);
  assert.ok(lab.indexOf('tPicks.length + " 份 = " + tPicks.length + " 次调用。"') > 0);
});

// —— 三次试写全在 60 秒整挂掉（她 2026-08-24 的截图）——
// 60 秒是 nginx proxy_read_timeout 和 iOS 请求超时的共同默认值：非流式请求
// 只要生成超过 60 秒就必被掐，跟 max_tokens、上下文长度都没关系。
// 酒馆能一次写这么长是因为它【真的在流式】——字节一直在流，读超时永远不触发。
// 所以关键不是额度，是能不能流；能不能流又取决于线路怎么配的。

const stubbed = (opts, model) => {
  const win = {};
  new Function("window", "localStorage", "loadJSON", "saveJSON", "callAI", "narrativeCore", "routeCanStream", "detectFormat", "Date", sp)(
    win, { getItem: () => null, setItem: () => {} }, (k, d) => d, () => {},
    model, () => "",
    p => !p.proxyRef && !/anthropic|googleapis/.test(p.baseUrl || ""),
    p => (/anthropic/.test(p.baseUrl || "") ? "anthropic" : "openai"),
    opts.Date || Date);
  return win.StylePresets;
};

test("失败时说清这条线路能不能流、为什么不能", async () => {
  const SPX = stubbed({}, async () => { throw new Error("Load failed"); });
  const cases = [
    [{ name: "a", baseUrl: "https://api.anthropic.com" }, /anthropic 方言/],
    [{ name: "b", baseUrl: "https://x/v1" }, /本该能流式/],
    [{ name: "c", baseUrl: "https://api.anthropic.com" }, /anthropic 方言/]
  ];
  for (const [route, want] of cases) {
    await SPX.runTest(route, { char: { name: "x" }, minWords: 1500 }).catch(e => assert.match(e.message, want));
  }
});

test("60 秒上下挂掉要点名是读超时，并给出根治和将就两条路", async () => {
  let now = 1e6;
  const SPX = stubbed({ Date: { now: () => now } }, async () => { now += 60000; throw new Error("Load failed"); });
  await SPX.runTest({ name: "a", baseUrl: "https://api.anthropic.com" }, { char: { name: "x" }, minWords: 1500 })
    .catch(e => {
      assert.match(e.message, /等了 60 秒/);
      assert.match(e.message, /读超时到点了/);
      assert.match(e.message, /跟 max_tokens、上下文长度都没关系/, "别让她再去调额度");
      assert.match(e.message, /换一条 openai 方言的线路/, "根治");
      assert.match(e.message, /最低字数调低到 800/, "将就");
    });
});

test("能流式却也挂了，说法要不一样——那是中转谎报", async () => {
  let now = 1e6;
  const SPX = stubbed({ Date: { now: () => now } }, async () => { now += 60000; throw new Error("Load failed"); });
  await SPX.runTest({ name: "b", baseUrl: "https://x/v1" }, { char: { name: "x" }, minWords: 1500 })
    .catch(e => {
      assert.match(e.message, /中转收下了 stream 却缓冲发回/);
      assert.ok(e.message.indexOf("换一条 openai 方言的线路") < 0, "本来就是 openai 方言，别叫她换");
    });
});

test("瞬间失败不当成读超时——那是密钥/CORS/DNS", async () => {
  const SPX = stubbed({}, async () => { throw new Error("Load failed"); });
  await SPX.runTest({ name: "b", baseUrl: "https://x/v1" }, { char: { name: "x" }, minWords: 1500 })
    .catch(e => assert.ok(e.message.indexOf("读超时到点了") < 0, "0 秒就挂跟超时没关系"));
});

test("花钱之前就告诉她这条线路有 60 秒天花板", () => {
  assert.ok(lab.indexOf("这条线路发不出流式 · 有 60 秒天花板") > 0);
  assert.ok(lab.indexOf("SP.routeInfo(props.active)") > 0);
  assert.ok(lab.indexOf("if (r.canStream) return null;") > 0, "能流式就别唠叨");
  assert.ok(lab.indexOf("等三次试写全挂了才知道") > 0, "为什么要前置，写在代码里");
});
