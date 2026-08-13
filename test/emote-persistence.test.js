const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");

assert(app.includes('if (!saveJSON("x_emotePacks", next))'), "emote UI must not update before persistence succeeds");
assert(app.includes('setEmotePacks(next);'), "persisted emote packs must update the visible matrix");
assert(app.includes('if (!commitEmotePacks(next)) return 0;'), "failed batch import must report zero instead of fake success");
assert(app.includes('本地空间可能已满'), "failed persistence needs a useful recovery message");
assert(/cacheHistory: _histCache, stream: _engineerChat, timeout: 180000/.test(app), "ordinary private chat must get the same three-minute allowance as offline chat");

console.log("emote persistence and private timeout tests passed");
