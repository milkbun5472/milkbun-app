// v63.38 小游戏审计批 11：终局「把这局收进记忆」。
// 小游戏是沙盒（读主线、不写主线——four-surfaces 第 5 条）。这颗按钮是唯一例外，
// 而例外必须是【她亲手点的】：默认一个字不写、点一次只写一条、写的对象只有
// 上场的真实角色（NPC 没有主线，言秋的记忆走 CC 不走 app 记忆库）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const games = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("app 侧那扇门：只收真实角色、打小游戏标签、knownBy 跟 charIds 一致", () => {
  const seg = cut(app, "keepGameMemory: (charIds, text) => {", "},");
  assert.match(seg, /filter\(id => characters\.some\(c => c\.id === id\)\)/, "没过滤到真实角色，NPC 的 key 会写进记忆库");
  assert.match(seg, /tags: \["小游戏"\], charIds: ids, knownBy: ids, source: "manual"/, "写入的形状不对");
  assert.match(seg, /if \(!t0 \|\| !ids\.length\) return false;/, "空局也写了");
});

test("按钮是唯一入口：七桌各一颗，点一次只写一条，全 NPC 局给说法", () => {
  assert.equal((games.match(/h\(KeepMemBtn,\s*\{/g) || []).length, 7, "七个终局屏该各有一颗（卧底/狼人/阿瓦隆/猜谜/真心话/大富翁/UNO）");
  assert.equal((games.match(/if\s*\(\s*!props\.keepGameMemory\s*\)\s*return false;/g) || []).length, 7, "有的桌没兜住 prop 缺席");
  assert.equal((games.match(/return props\.keepGameMemory\(realCharIds\(/g) || []).length, 7, "有的桌没走 realCharIds——NPC 或言秋会被写进去");
  const btn = cut(games, "function KeepMemBtn(props)", "\n  }");
  assert.match(btn, /if \(kept\) return;/, "能连点连写");
  assert.match(btn, /这局上场的都是 NPC/, "全 NPC 局没有说法");
  const rc = cut(games, "function realCharIds(players)", "\n  }");
  assert.match(rc, /!p\.isNpc && !p\.isUser && !p\.engineer/, "realCharIds 的过滤不对（言秋的记忆走 CC，不走 app 记忆库）");
});

test("默认不写：games.js 里没有任何自动调用 keepGameMemory 的地方", () => {
  // 每一处 props.keepGameMemory 的出现都只许在 keep 回调里：7 个兜底判断 + 7 个 return 调用
  assert.equal((games.match(/props\.keepGameMemory/g) || []).length, 14, "出现次数对不上——多出来的那处八成是自动写");
});
