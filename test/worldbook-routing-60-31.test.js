"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const study = fs.readFileSync(path.join(root, "js/study.js"), "utf8");
const read = fs.readFileSync(path.join(root, "js/read.js"), "utf8");
const pomodoro = fs.readFileSync(path.join(root, "js/pomodoro.js"), "utf8");
const debate = fs.readFileSync(path.join(root, "js/debate.js"), "utf8");
const dream = fs.readFileSync(path.join(root, "js/dream.js"), "utf8");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
const games = fs.readFileSync(path.join(root, "js/games.js"), "utf8");
const fanfic = fs.readFileSync(path.join(root, "js/fanfic.js"), "utf8");
const ledger = fs.readFileSync(path.join(root, "js/ledger.js"), "utf8");
const memo = fs.readFileSync(path.join(root, "js/memo.js"), "utf8");

function loadRouting() {
  const start = engine.indexOf("function loreScopeOn");
  const end = engine.indexOf("// 情侣空间", start);
  assert.ok(start >= 0 && end > start, "找不到世界书路由实现");
  const ctx = {
    window: {},
    getQueryVec: function () { return null; },
    _loreVecCache: function () { return new Map(); },
    cosSim: function () { return 0; },
    Map
  };
  vm.createContext(ctx);
  vm.runInContext(engine.slice(start, end), ctx);
  return ctx.window.WorldBookRouting;
}

const routing = loadRouting();
const base = {
  id: "lore-1", title: "夜港", payload: "港口城十一点宵禁", enabled: true,
  alwaysOn: true, priority: 3, charIds: [], scope: { chat: true }
};

assert.equal(routing.selectLore([base], { scope: "chat", charIds: [], text: "" }).length, 1, "旧聊天词条应继续默认进入聊天");
assert.equal(routing.selectLore([base], { scope: "social", charIds: [], text: "" }).length, 0, "未开放公开世界的词条不能串进论坛/动态");
assert.equal(routing.selectLore([{ ...base, scope: { study: true } }], { scope: "study", charIds: [], text: "" }).length, 1, "开放共读学习的词条应进入学习场景");
assert.equal(routing.selectLore([{ ...base, ensemble: true, scope: { chat: true } }], { scope: "creative", charIds: [], text: "" }).length, 1, "旧群像开关应兼容到故事创作");

const bound = { ...base, charIds: ["char-a"], scope: { study: true } };
assert.equal(routing.selectLore([bound], { scope: "study", charIds: ["char-b"], text: "" }).length, 0, "角色绑定词条不能串给其他角色");
assert.equal(routing.selectLore([bound], { scope: "study", charIds: ["char-a"], text: "" }).length, 1, "角色绑定词条应给到本人");

const triggered = { ...base, alwaysOn: false, keyword: "宵禁，通行证", scope: { study: true } };
assert.equal(routing.selectLore([triggered], { scope: "study", charIds: [], text: "今天学微积分" }).length, 0, "无关话题不能触发词条");
assert.equal(routing.selectLore([triggered], { scope: "study", charIds: [], text: "讲讲银色通行证" }).length, 1, "当前语境命中关键词时应触发");
assert.equal(routing.loreEntryState(triggered, { scope: "study", text: "讲讲通行证" }).code, "keyword", "UI 诊断应与路由结论一致");

const scopeKeys = ["chat", "subjects", "lifestyle", "diary", "study", "creative", "social", "debate"];
for (const key of scopeKeys) assert.match(screens, new RegExp('\\["' + key + '",'), "UI 缺少去向：" + key);
// ⚠这两条冻的是【首页有没有把那三道门说清楚】，不是那两句话的原文——
// v60.87 把首页重做了（她说上一版「好平淡」），文案跟着换了，但三道门一句没少。
// 冻长相的写法会让「改得更好」和「改坏了」一样红。
const wbSeg = screens.slice(screens.indexOf("function WorldBook({ entries"), screens.indexOf("function WorldBookEntrySheet("));
["给谁", "什么时候", "去哪"].forEach(k => assert.ok(wbSeg.includes(k), "世界书首页没说清这一道门：" + k));
assert.match(wbSeg, /进上下文|才会注入|送得出去/, "世界书首页要说清没过门就不会被送出去");
assert.doesNotMatch(screens, /群像注入/, "新 UI 不应继续暴露从未生效的旧开关名");
assert.match(screens, /flex-1 min-h-0 overflow-y-auto px-5/, "世界书应只有一个主滚动区");

assert.doesNotMatch(app, /const \[worldbook\s*,\s*setWorldbook\]/, "不能恢复绕过 scope 的扁平全局世界书");
assert.doesNotMatch(app, /(?:const|function)\s+deriveWorldbook\b/, "不能恢复旧的全局常驻拼接器");
for (const scope of scopeKeys) assert.match(app, new RegExp('(?:loreForContext\\("' + scope + '"|loreFor\\([^\\n]+, "' + scope + '")'), "App 缺少去向路由：" + scope);
assert.match(app, /worldbookFor: \(charId, text\) => loreForContext\("study"/, "学习/共读应支持发送时按角色与语境取世界书");
assert.match(app, /worldbookFor: \(charId, text\) => loreForContext\("lifestyle"/, "番茄钟应支持发送时按角色与语境取世界书");
assert.match(app, /loreForContext\("social", canSee\.map/, "动态生成应按可见角色取公开世界设定");
assert.match(app, /forumWorldCtx = text =>[^\n]+loreForContext\("social", \[\], text\)/, "论坛生成应把当前话题交给公开世界路由");

assert.match(study, /props\.worldbookFor\(chars\[i\]\.id, subject\.trim\(\)\)/, "能力判定应按候选角色取设定");
assert.match(study, /props\.worldbookFor\(char\.id, \[sessRef\.current\.subject, recent\]/, "学习对话应按说话角色和近期课堂触发设定");
assert.match(read, /props\.worldbookFor\(partner\.id, String\(text \|\| ""\)\)/, "共读应按搭档与当前页触发设定");
assert.match(pomodoro, /props\.worldbookFor\(c\.id, \(task\.trim\(\) \|\| "专注"\)/, "番茄钟应按陪伴角色与任务触发设定");
assert.match(debate, /props\.worldbookFor\(ids, \[s\.topic, prevTranscript\(s\)/, "擂台每轮应按台上角色与完整争论触发设定");
assert.match(dream, /props\.worldbookFor\(ids, text\)/, "梦境应按做梦人与客串角色触发设定");
assert.match(tarot, /props\.worldbookFor\(c\.id, \[deal\.finalQuestion/, "塔罗应按解牌角色与问题触发设定");
assert.match(games, /【本局世界设定】/, "小游戏应把每个入局角色自己的设定接入角色副本");
assert.match(fanfic, /props\.worldbookFor\(ids, \[f\.title/, "同人文续章应按 CP 与文章语境触发设定");
assert.match(ledger, /routedLore\(\[c\.id\]/, "记账主动批注应按看到账目的角色触发设定");
assert.match(memo, /props\.worldbookFor\(\[c\.id\], itemDesc\)/, "备忘提醒应按看见提醒的角色触发设定");

console.log("worldbook routing 60.31 tests passed");
