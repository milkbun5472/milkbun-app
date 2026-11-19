// 她 2026-11-19：「朋友圈能不能选择走后台」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("朋友圈那一行能挑走线上／走后台，跟心上同一个口子", () => {
  const pol = R("js/auto-refresh-policy.js"), app = R("js/app.js");
  assert.match(pol, /id: "moments"[\s\S]{0,200}rates: \[\{ id: "online", zh: "走线上"/);
  assert.match(app, /const policyApiFor = \(feature, id, base\) =>/);
  assert.match(app, /const desireApiFor = id => policyApiFor\("desire", id\);/);
  assert.equal((app.match(/policyApiFor\("moments"/g) || []).length, 3, "自己发、评论回复、刷到她的那三枪都走它");
});
