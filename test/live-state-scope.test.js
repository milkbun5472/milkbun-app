const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 状态生命周期（2026-08-18，Codex 第六样 + Lisa 实测「运动衣穿了好几天、大半夜还准备晨跑」）。
// 死因不是 TTL 太长，是模型每轮把上一轮的值原样复述，旧写法「有值就刷新时间戳」把它续了命。
test("值没变就不刷新时间戳，TTL 才会真的到期", () => {
  assert.match(app, /const putLiveField = \(patch, live, key, value, now\)/);
  assert.match(app, /if \(!sameStateValue\(v, live && live\[key\]\)\) patch\[key \+ "UpdatedAt"\] = now;/);
  // 用同一条规则复刻行为
  const same = (a, b) => String(a || "").replace(/\s+/g, "") === String(b || "").replace(/\s+/g, "");
  const put = (patch, live, key, value, now) => {
    const v = String(value == null ? "" : value).trim();
    if (!v) return;
    patch[key] = v;
    if (!same(v, live && live[key])) patch[key + "UpdatedAt"] = now;
    else if (!(Number((live && live[key + "UpdatedAt"]) || 0) > 0)) patch[key + "UpdatedAt"] = now;
  };
  const t0 = 1000;
  let live = { wearing: "灰色运动衣", wearingUpdatedAt: t0 };
  for (let i = 1; i <= 6; i++) { const p = {}; put(p, live, "wearing", "灰色运动衣", t0 + i * 1000); live = Object.assign({}, live, p); }
  assert.equal(live.wearingUpdatedAt, t0, "原样复述不许续命");
  const p2 = {}; put(p2, live, "wearing", "白衬衫", t0 + 9000);
  assert.equal(p2.wearingUpdatedAt, t0 + 9000, "真的换了才刷新");
  // 从没有时间戳的老数据补一个，否则永远算不出年龄
  const p3 = {}; put(p3, { wearing: "旧值" }, "wearing", "旧值", 55);
  assert.equal(p3.wearingUpdatedAt, 55);
});

test("action 收成一拍量级；换场景后穿着降级为不知道", () => {
  assert.match(app, /action: 45 \* 60000/, "动作不该按小时活着");
  assert.match(app, /st\.wearing = null; st\.wearingUpdatedAt = 0;/, "换地方＝换场景，穿着转未知");
  assert.match(app, /!sameStateValue\(st\.place, _live0\.place\) && !parsed\.wearing/,
    "同一轮已报新穿着时不要反而清掉它");
});

test("字段空着＝现在不知道，不是沿用旧的，也不是替他编一套", () => {
  assert.match(engine, /字段空着的意思是【现在不知道】/);
  assert.match(engine, /不是「沿用你记得的上一套」/);
  assert.match(engine, /宁可空着也别编/);
});
