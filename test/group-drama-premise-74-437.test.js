// 修罗场（她 2026-10-02 一路调下来）：只摆局面，不规定反应。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const i = app.indexOf("  const groupDramaRule = gid =>"), j = app.indexOf("  const saveGroupSettings = (", i);
assert.ok(i > 0 && j > i, "抠不出 groupDramaRule");
const seg = app.slice(i, j);
const t0 = app.indexOf("const gDramaTail = "), t1 = app.indexOf('        : "";', t0);
assert.ok(t0 > 0 && t1 > t0, "抠不出 gDramaTail");
const tail = app.slice(t0, t1);
// 只看字符串里的字，不看注释（注释里记着当初删掉的那些话）
const said = src => (src.match(/"(?:[^"\\\n]|\\.)*"/g) || []).join("");

test("不再留「这轮可以不来」的口子", () => {
  assert.ok(!/不必每一轮都提，该来的时候自然会来/.test(said(seg)));
});

test("摆出事实：原本不知道、陌生人之间交集是她", () => {
  assert.match(seg, /除非你的设定里写明你早就知道，否则你原本并不知道这里还有别人跟她是这种关系/);
  assert.match(seg, /互相就是陌生人，你们之间的交集是她/);
});

// 她 2026-10-02：「你这本身就是一个限制吧宝宝，修罗场也可以有别的」
test("不把一次截图写成规则：不写死唯一男朋友、不规定冲谁、不下「不许岔开」的判决", () => {
  const all = said(seg) + said(tail);
  ["唯一的男朋友", "她刚才那句是冲谁的", "不是语法题", "语法题岔过去", "你一直以为自己是她【唯一】"].forEach(w =>
    assert.ok(all.indexOf(w) < 0, "又写回去了：" + w));
  assert.match(seg, /也可以都不是/, "反应的范围要留口子");
});

test("线上群聊和群线下都走这一份", () => {
  assert.match(app, /gCtx\.dramaRule = groupDramaRule\(group\.id\);/);
  assert.match(app, /const gRelRule = gsFor\(groupId\)\.drama \? groupDramaRule\(groupId\)/);
});

test("修罗场开着时，在群聊历史【后面】、输出要求前面再摆一次局面", () => {
  assert.match(app, /\+ gQuoteCatalogText \+ gDramaTail \+ "\\n\\n【输出】/);
  assert.match(app, /const gDramaTail = gsFor\(groupId\)\.drama\n/);
  assert.ok(app.indexOf("const gDramaTail = ") < app.indexOf("+ gDramaTail + "), "用在声明之前了（TDZ）");
  assert.match(tail, /按你自己那张卡来/);
  assert.match(tail, /全都跟 " \+ userName\(profile\) \+ " 在一起/, "点名摆出谁跟她在一起");
  assert.match(seg, /记录里还没人把这件事说破过，那就是这一刻/, "发现的那一刻得有");
  assert.match(seg, /先翻你自己那张卡/, "怎么反应先照卡上写的那个人");
});
