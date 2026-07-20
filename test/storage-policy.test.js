const assert = require("assert");
const S = require("../js/storage-policy.js");

assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.79), 200);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.8), 120);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.899), 120);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.9), 80);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 1.2), 80);
assert.strictEqual(S.chatKeep(0), 200);

console.log("storage policy tests passed");
