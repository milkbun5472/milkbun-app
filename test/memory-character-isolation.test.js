const fs = require("fs");
const assert = require("assert");
const vm = require("vm");

const source = fs.readFileSync("js/engine.js", "utf8");
const start = source.indexOf("const MEM_STOP");
const end = source.indexOf("function formatMemLib", start);
assert(start >= 0 && end > start, "memory retrieval source must be present");
const sandbox = { window: {}, console, Date, Set, Map, Math, saveJSON() {} };
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end) + "\nthis.retrieveMemories = retrieveMemories;", sandbox);

const now = Date.now();
const lib = [
  { id: "yanqiu", text: "Lisa 和言秋去吃海胆饭", tags: ["海胆"], charIds: ["yanqiu"], ts: now },
  { id: "ayu", text: "Lisa 和阿屿聊过海胆", tags: ["海胆"], charIds: ["ayu"], ts: now },
  { id: "gumu", text: "顾暮自己的晚餐", tags: ["晚餐"], charIds: ["gumu"], ts: now }
];
const got = sandbox.retrieveMemories(lib, "gumu", "海胆饭", { touch: false, vec: false, limit: 10 });
assert(!got.some(x => x.id === "yanqiu" || x.id === "ayu"), "another character's bound memories must never cross into Gu Mu");
console.log("memory character isolation tests passed");
