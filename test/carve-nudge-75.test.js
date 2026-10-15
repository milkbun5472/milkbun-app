// 她 2026-10-14：「他是不是也不会特别主动发情侣空间刻歌」——门槛降下来、隔久了推一把、她开口要就一定刻；不再重复挂两份
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.equal((app.match(/openCaps\.push\("carve"\)/g) || []).length, 1);
assert.doesNotMatch(app, /非送给 " \+ uName \+ " 不可的歌才刻/);
assert.match(app, /你已经 " \+ days \+ " 天没往唱片上刻歌了/);
assert.match(app, /她刚提到刻歌／唱片：这一轮就挑一首刻给她/);
console.log("ok");
