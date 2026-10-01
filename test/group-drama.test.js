// 修罗场（群友 2026-10-01）：群设置开了，各自跟她的关系对全群公开
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js"), e = src("engine.js");

test("群设置里有修罗场开关，存进群设置", () => {
  assert.match(c, /const \[gDrama, setGDrama\] = useState\(!!gs\.drama\);/);
  assert.match(c, /drama: gDrama, defaultOffline: gDefaultOffline,/);
  assert.match(c, /row\("修罗场（关系不保密）"/);
});

test("线上群聊：开了就用修罗场那段替掉关系隐私铁律；关着照旧", () => {
  assert.match(a, /const gRelRule = gsFor\(groupId\)\.drama \? groupDramaRule\(groupId\) : "\\n\\n【成员间关系 · ⚠️关系隐私铁律】/);
  assert.match(a, /const groupDramaRule = gid => gsFor\(gid\)\.drama/);
});

test("群线下也吃同一段", () => {
  assert.match(a, /gCtx\.dramaRule = groupDramaRule\(group\.id\);/);
  assert.match(e, /relLines \+ \(ctx\.dramaRule \|\| ""\) \+/);
});
