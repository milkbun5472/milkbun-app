// 账号的关注、粉丝照身份定（查手机、论坛资料共用一句），格式示范不摆小数字；论坛里他的粉丝数她能自己改
import { readFileSync } from "node:fs"; import assert from "node:assert/strict"; import vm from "node:vm";
const r = f => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
const eng = r("engine.js"), phone = r("phone.js"), app = r("app.js"), ui = r("screens-ui.js");
assert.match(eng, /const ACCOUNT_SCALE_RULE = /);
assert.equal((phone.match(/ACCOUNT_SCALE_RULE \+/g) || []).length, 2);
assert.match(app, /ACCOUNT_SCALE_RULE \+ FORUM_ALT_NAME_RULE/);
for (const s of [phone, app]) assert.ok(!/\\"(followers|fans|following|altFollowers)\\":\d/.test(s));
const ctx = {}; vm.createContext(ctx); vm.runInContext(eng.match(/function accountCount[\s\S]*?\n}\n/)[0], ctx);
assert.equal(ctx.accountCount("12.3万"), 123000); assert.equal(ctx.accountCount("1,234"), 1234); assert.equal(ctx.accountCount("3k"), 3000); assert.ok(Number.isNaN(ctx.accountCount("很多")));
assert.match(app, /accountCount\(d\.followers\)/);
assert.match(app, /onEditCharMeta: editCharForumMeta/);
assert.match(ui, /"data-wk": "forumfans", "data-part": "char"/);
console.log("account scale ok");
