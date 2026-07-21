const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");
const engine = fs.readFileSync("js/engine.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

assert(components.includes('"入场前群聊条数"'), "group offline settings must expose the online transition count");
assert(components.includes('min: 0, max: 30, step: 1, onChange: setSOnlineN'), "online transition count must be bounded and disableable");
assert(app.includes('onlinePrelude: groupOnlinePrelude(groupId)'), "new group offline sessions must snapshot online context at entry");
assert(app.includes('if (!Array.isArray(workSess.onlinePrelude))'), "existing active sessions must receive one migration snapshot");
assert(engine.includes('【刚刚在线上群聊的最后几句·入场衔接】'), "group offline prompt must distinguish online prelude from offline history");
assert(engine.includes('不要假装这些话刚在线下又说了一遍'), "online context must not be replayed as duplicate offline dialogue");

console.log("group offline online prelude tests passed");
