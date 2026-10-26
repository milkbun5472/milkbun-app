// 群友 2026-10-25：平板说没有要补传的，手机上表情包和头像却是空的——本机没有的 iv_ 图从来不去云上拿
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
assert.match(eng, /function resolveImg\(v\) \{ if \(!v \|\| typeof v !== "string"\) return v; if \(v\.indexOf\("iv_"\) === 0\) \{ const u = _imgCache\(\)\.get\(v\); if \(!u\) _imgPullMiss\(v\); return u \|\| ""; \} return v; \}/);
assert.match(eng, /function _imgPullMiss\(k\) \{/);
assert.match(eng, /idbVaultGet\(k\)\.then\(b => \{/);
assert.match(eng, /new CustomEvent\("img-vault-filled"\)/);
assert.match(app, /window\.addEventListener\("img-vault-filled", on\)/);
// 浏览器里实际跑：node scripts/checks/img-pull-missing-browser.cjs
console.log("ok");
