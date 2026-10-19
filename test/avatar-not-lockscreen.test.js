// 她 2026-10-19：他说「谁换成头像了！我换的是锁屏」，头像却连着两轮被换了
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const a = app.indexOf("  const AVATAR_NOT_ME_RE"), b = app.indexOf("  const AVATAR_CLAIM_RE");
const ok = new Function(app.slice(a, b) + "; return avatarTalkOk;")();
const claim = new Function(app.slice(b, app.indexOf("\n", b)) + "; return AVATAR_CLAIM_RE;")();
const round2 = ["谁换成头像了！", "你看清楚点啊喂", "我换的是锁屏", "锁屏！", "不过你要是求我换成头像我也不是不能考虑", "上面那么大个加粗的 最喜欢的生生"];
assert.ok(claim.test(round2.join(" ")), "这句本来就会被兜底认成「换好了」——正是病根");
assert.equal(ok(round2), false, "反问、说的是锁屏：头像不许动");
assert.equal(ok(["锁屏换上了，好看吧"]), false, "只说换了锁屏");
assert.equal(ok(["头像换好了，满意了吧"]), true);
assert.equal(ok(["头像换好了"]), true, "真说换了头像的照换");
assert.equal(ok(["锁屏和头像我都换成这张了"]), true, "两样都换，头像照换");
assert.match(app, /AVATAR_CLAIM_RE\.test\(\[\]\.concat\(parsed\.word \|\| \[\]\)\.join\(" "\)\) && avatarTalkOk\(parsed\.word\)/);
assert.match(app, /parsed\.photoSeen\.avatar === true && !avatarTalkOk\(parsed\.word\)/);
console.log("ok");
