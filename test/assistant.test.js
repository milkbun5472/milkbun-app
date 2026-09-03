const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/assistant.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

// 她 2026-08-22 要的 app 内帮手：能直接改，但每一步都要她点头。
// 选型时明确了范围：文风 / 人设 / 外貌 / 记忆库，其余一律不碰。

// 把核心那段抠出来真跑（不含界面）
const A = (() => {
  const i = src.indexOf("(function () {\n  const useState = React.useState;");
  const j = src.indexOf("// ============================================================\n// 界面：");
  const store = {};
  const sandbox = {
    React: { useState: () => [] },
    h: () => null, Svg: null,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    callAI: async () => "", parseJSONLoose: () => ({}), extractJSON: () => ({}),
    window: {}
  };
  new Function(...Object.keys(sandbox), src.slice(i, j))(...Object.values(sandbox));
  return { api: sandbox.window.Assistant, store };
})();

// ⚠️这张表是【安全面】，所以故意冻死成员：多一样就是多一处能写坏她数据的口子，
// 加东西必须同时改这里，让人看见自己在扩权。v61.00 她要「css 装修 + 更新人物档案」，
// 于是多了 theme 和 profile 两样。
test("能改的只有白名单那几样", () => {
  assert.deepEqual(Object.keys(A.api.TARGETS).sort(),
    ["appearance", "memory", "persona", "profile", "style", "theme"]);
  assert.match(src, /不在这张表里的一律不许碰/);
});

test("不认识的类型直接拒，别悄悄放过去", () => {
  assert.throws(() => A.api.apply({ target: "settings", id: "x", text: "改点别的" }, {}), /不认识的改动类型/);
  assert.throws(() => A.api.apply({ target: "chat", id: "x", text: "改聊天记录" }, {}), /不认识的改动类型/);
});

test("除新建文风外，没说改谁就不许写", () => {
  assert.throws(() => A.api.apply({ target: "persona", id: "", text: "新人设" }, {}), /这条没说要改谁/);
  assert.throws(() => A.api.apply({ target: "memory", id: "", text: "一条记忆" }, {}), /这条没说要改谁/);
});

test("文风：有 id 就原地覆盖，没 id 就新建", () => {
  A.store["x_offlineStyles"] = JSON.stringify([{ key: "c1", name: "旧的", prompt: "老文风", custom: true }]);
  A.api.apply({ target: "style", id: "c1", text: "新文风" }, {});
  let list = JSON.parse(A.store["x_offlineStyles"]);
  assert.equal(list.length, 1, "覆盖不该多出一条");
  assert.equal(list[0].prompt, "新文风");
  assert.equal(list[0].name, "旧的", "没给 name 就别动名字");
  A.api.apply({ target: "style", id: "", name: "帮手写的", text: "另一份" }, {});
  list = JSON.parse(A.store["x_offlineStyles"]);
  assert.equal(list.length, 2);
  assert.equal(list[1].custom, true, "新建的要标成自定义");
});

test("角色与记忆必须经过 app 传进来的写入口，拿不到就报错不硬写", () => {
  assert.throws(() => A.api.apply({ target: "persona", id: "c1", text: "x" }, {}), /没接角色写入口/);
  assert.throws(() => A.api.apply({ target: "memory", id: "c1", text: "x" }, {}), /没接记忆写入口/);
  const seen = [];
  A.api.apply({ target: "persona", id: "c1", text: "新人设" }, { onPatchCharacter: (id, p) => seen.push([id, p]) });
  assert.deepEqual(seen, [["c1", { persona: "新人设" }]]);
});

test("记忆按行切条，编号和项目符号要剥掉", () => {
  let got = null;
  const n = A.api.apply({ target: "memory", id: "c1", text: "1. 他怕打雷\n· 她喜欢下雨天\n- 两人约好去看海\n\n  " },
    { onAddMemories: (id, items) => { got = [id, items]; } });
  assert.equal(n, 3, "空行不算一条");
  assert.deepEqual(got[1], ["他怕打雷", "她喜欢下雨天", "两人约好去看海"]);
  assert.throws(() => A.api.apply({ target: "memory", id: "c1", text: "   " }, { onAddMemories: () => {} }), /没有可写入的条目/);
});

test("现状快照给它看得见 app 此刻的样子（诊断靠它）", () => {
  const snap = A.api.snapshot({ characters: [{ id: "c1", name: "阿川", persona: "王爷", appearance: "玄色长袍", refPhoto: "iv_1", photoStyle: "realistic" }] });
  assert.equal(snap["角色"][0]["名字"], "阿川");
  assert.equal(snap["角色"][0]["有参考照"], true);
  assert.ok(Array.isArray(snap["已存的文风预设"]));
  assert.ok(Array.isArray(snap["最近报错"]));
});

test("提示词里把「只是草稿、由她点头」写死", () => {
  assert.match(src, /你给出的 patch 只是【草稿】/);
  assert.match(src, /text 必须是【改完的完整内容】/, "要能整段替换，不然没法一键应用");
  assert.match(src, /一次别超过 3 条 patch/);
  assert.match(src, /拿不准她想要什么就先问，别擅自动手/);
  assert.match(src, /永远】不自己落库/);
});

test("界面必须先摆改前改后再给应用按钮", () => {
  // 两种改法各有各的摆法（v61.11）：整段替换摆改前/改后，只改一小段摆那一段。
  assert.match(src, /"改前"/);
  assert.match(src, /"改后 · 整段替换"/);
  assert.match(src, /"原文这一段"/);
  assert.match(src, /"换成"/);
  assert.match(src, /"应用这条"/);
  assert.match(src, /"跳过"/);
  assert.match(src, /textDecoration: "line-through"/, "改前要划掉，一眼看出差别");
});

test("接线：加载、图标、屏幕分发、两个写入口", () => {
  assert.match(index, /<script src="js\/assistant\.js\?v=/);
  // v61.11 她把它改名叫「秋秋」（存档 key 仍是 assistant，不跟着改名）
  assert.match(comp, /assistant: \{ kind: "app", zh: "秋秋"/);
  assert.match(app, /screen === "assistant"\) body = h\(AssistantApp, \{/);
  assert.match(app, /onPatchCharacter: \(id, patch\) => pC\(list => list\.map\(c => c\.id === id \? \{ \.\.\.c, \.\.\.patch \} : c\)\)/);
  assert.match(app, /onAddMemories: \(charId, items\)/);
  assert.match(app, /source: "assistant"/, "帮手写的记忆要标出来源");
});
