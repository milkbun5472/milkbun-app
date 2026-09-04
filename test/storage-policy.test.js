const assert = require("assert");
const fs = require("fs");
const path = require("path");
const S = require("../js/storage-policy.js");
const fsRead = p => fs.readFileSync(path.join(__dirname, p), "utf8");

// v61.78 整体抬了五倍：这几个数原来是照 localStorage 那 5MB 定的，
// 但聊天早就搬进 IndexedDB（下面钉着 IDB_TEXT_PREFIXES 里有 x_chat:），
// 它根本不撞那堵墙——留得少只有代价、没有好处。
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.79), 1000);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.8), 600);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.899), 600);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 0.9), 400);
assert.strictEqual(S.chatKeep(S.LOCAL_LIMIT * 1.2), 400);
assert.strictEqual(S.chatKeep(0), 1000);
// 两处必须相等：app 里那个默认值和这里的常态档是同一条线，分家了就会
// 「归档时留 1000、建回来只铺 200」——一层写在两处的老形状。
assert.match(fsRead("../js/app.js"), /const CHAT_KEEP_LOCAL = 1000;/);

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
assert.match(app, /used < 0\.8 \* 5 \* 1024 \* 1024/);
assert.match(app, /x_chatAutoArchiveDay/);
assert.match(app, /offloadAllChats\(\{ silent: true \}\)/);
assert.match(app, /result\.fails === 0/);
assert.match(app, /await window\.Cloud\.chatArchiveAppend\(charId, drop\)[\s\S]*pChat\(charId/);
assert.match(app, /await window\.Cloud\.chatArchiveAppend\(archKey, older\)[\s\S]*pGChat\(groupId/);

const engine = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const cloud = fs.readFileSync(path.join(__dirname, "../js/cloud.js"), "utf8");
assert.match(engine, /IDB_TEXT_PREFIXES = \["x_fanfic_", "x_memLib", "x_offline:", "x_goffline:", "x_chat:", "x_gchat:"\]/);
assert.match(engine, /function storedJSONText\(k\)/);
assert.match(engine, /back === s && \(!needsLocalJournal \|\| localStorage\.getItem\(k\) === s\)/);
assert.match(engine, /async function idbTxtApplySnapshot\(data, preserveKeys\)/);
assert.match(app, /MemoryAudit\.build\(storedJSONText\("x_memLib"\)/);
assert.match(app, /window\.__txtMirror\.forEach\(\(v, k\) => offlineKeys\.add\(k\)\)/);
assert.match(app, /await idbTxtClear\(\)/);
assert.match(cloud, /storedJSONText\("x_memLib"\)/);
assert.match(cloud, /!\(tableMemoryMode\(\) && k === "x_memLib"\)/);
assert.match(cloud, /if \(tableMemoryMode\(\) && k === "x_memLib"\) return/);
assert.match(cloud, /await idbTxtApplySnapshot\(data \|\| \{\}/);
assert.match(cloud, /await this\.apply\(row\.data\)/);

console.log("storage policy tests passed");
