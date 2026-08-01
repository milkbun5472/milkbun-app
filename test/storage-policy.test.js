const assert = require("assert");
const fs = require("fs");
const path = require("path");
const S = require("../js/storage-policy.js");

assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.79), 200);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.8), 120);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.899), 120);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.9), 80);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 1.2), 80);
assert.strictEqual(S.chatKeep(0), 200);

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
assert.match(app, /used < 0\.8 \* 5 \* 1024 \* 1024/);
assert.match(app, /x_chatAutoArchiveDay/);
assert.match(app, /offloadAllChats\(\{ silent: true \}\)/);
assert.match(app, /result\.fails === 0/);
assert.match(app, /await window\.Cloud\.chatArchiveAppend\(charId, drop\)[\s\S]*pChat\(charId/);
assert.match(app, /await window\.Cloud\.chatArchiveAppend\(archKey, older\)[\s\S]*pGChat\(groupId/);

console.log("storage policy tests passed");
