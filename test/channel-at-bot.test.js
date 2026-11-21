// 小频默认关、称号满一周才评；@ 名单和 @ 了谁（她 2026-11-20）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const grab = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
test("atMentions：认本名和备注，长名字先比；@所有人", () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(grab(en, "function atMentions(", "function spaceTitlesDue(") + ";this.f=atMentions;", ctx);
  const m = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾朝阳" }, { id: "c", name: "陆衍", remark: "小陆" }];
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.f("@顾朝阳 你说呢 @小陆", m))), { all: false, ids: ["b", "c"] });
  assert.equal(ctx.f("@所有人 吃啥", m).all, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.f("没点名", m).ids)), []);
});
test("spaceTitlesDue：从没评过的要从起算满 7 天", () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(grab(en, "function spaceTitlesDue(", "function spaceWeekTitles(") + ";this.f=spaceTitlesDue;", ctx);
  const D = 86400000, now = 100 * D;
  assert.equal(ctx.f(0, now - 2 * D, now), false);
  assert.equal(ctx.f(0, now - 7 * D, now), true);
  assert.equal(ctx.f(now - 8 * D, 0, now), true);
  assert.equal(ctx.f(now - 3 * D, 0, now), false);
});
test("接线：小频没开就不动；@ 名单接进群输入框；@ 提示进群提示词", () => {
  assert.match(grab(ap, "const spaceBotTick = ", "const _tStart"), /if \(!sp\.bot\) return;/);
  assert.match(ap, /spaceTitlesDue\(sp\.titlesTs, _tStart, Date\.now\(\)\)/);
  assert.match(cs, /atList: _gSpect \? null : \[\{ key: "__all", label: "所有人" \}\]/);
  assert.match(ap, /gWelcomeHint \+ gAtHint \+ gListenHint/);
  assert.match(cs, /const \[bot, setBot\] = useState\(!!space\.bot\)/);
});
