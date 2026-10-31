// 查手机里他的账号：关注、粉丝照身份定，格式示范不摆小数字
import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const s = readFileSync(new URL("../js/phone.js", import.meta.url), "utf8");
assert.match(s, /const PHONE_ACCOUNT_SCALE = /);
assert.equal((s.match(/PHONE_ACCOUNT_SCALE \+/g) || []).length, 2);
assert.ok(!s.includes("多数人很少"));
assert.ok(!/\\"followers\\":\d/.test(s) && !/\\"fans\\":\d/.test(s));
console.log("phone account scale ok");
