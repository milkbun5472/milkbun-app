// 她 2026-10-23：朋友圈也能替她付购物车；翻手机和朋友圈共用一份付钱的代码，钱没扣成就一件都不动
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /const payHerCart = \(charId, items, ledgerWhy, payLabel\) =>/);
assert.match(app, /if \(!walletSpend\(charId, total, ledgerWhy, "gift"\)\) return null;/);
assert.equal((app.match(/payHerCart\(/g) || []).length, 2, "翻手机一处、朋友圈一处（都走同一份）");
assert.ok(!/step\.do === "paycart"\) \{\s*const cartNow/.test(app), "翻手机那处又自己写了一份");
// 朋友圈两条生成路线都问、都接
assert.equal((app.match(/MOMENT_TAKEOUT_ASK \+ momentCartAsk\(\)/g) || []).length, 2);
assert.match(app, /if \(isMine\) \{ momentTakeouts\(reps, "author"\); momentCarts\(reps, "author"\); \}/);
assert.match(app, /momentCarts\(d\.reactions, "name"\); momentCarts\(d\.replies, "name"\);/);
// 购物车空着就不问；配角不付
assert.match(app, /if \(!cart\.length\) return "";/);
assert.match(app, /if \(!c \|\| c\.npc\) return;/);
console.log("ok");
