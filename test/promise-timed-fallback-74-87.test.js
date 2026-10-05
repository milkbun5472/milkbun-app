// 她 2026-10-05 截图：「到了我给你打电话」「乖乖等我二十分钟」——模型没填 laterPromise，到点什么都没来
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const grab = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const src = grab("  // 「二十分钟」「15 分钟」", "const PACT_VIA = ");
const f = new Function("promiseAfterTs", "PROMISE_EVENT_WORDS", src + "; return promiseFromWords;")(() => 0, {});
test("嘴上按时间约了来找她，兜底照样记成约回", () => {
  const p = f("c1", ["我衣服换好了 车钥匙在手上 马上开车去你楼下", "到了我给你打电话 咱下午不上这破班了", "乖乖等我二十分钟！"]);
  assert.equal(p.minutes, 20); assert.equal(p.how, "voice");
  assert.equal(f("c1", ["半小时后视频给你"]).minutes, 30);
  assert.equal(f("c1", ["一个小时后找你"]).minutes, 60);
  assert.equal(f("c1", ["忙完跟你说"]), null, "没说几分钟的不兜（原来就这么定的）");
  assert.equal(f("c1", ["今天好累", "你吃了吗"]), null, "没约就别记");
});
