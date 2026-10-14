// 她 2026-10-14：「你给我发个邀约」，TA在旁白里说发了，卡没出来——那一轮必给 dateAsk，冷却也不挡
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /const _askedInvite = /);
assert.match(app, /\(_askedInvite \|\| \(!_moodNeg && !_harsh && dateAskReady\(charId\) && Math\.random\(\) < 0\.1\)\)/);
assert.match(app, /只在旁白里写「发过去了」她是收不到的/);
assert.match(app, /\(dateAskReady\(charId\) \|\| \(typeof recentUserText === "string"/);
console.log("ok");
