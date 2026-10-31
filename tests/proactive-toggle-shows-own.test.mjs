import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), cmp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
assert.match(app, /proactive: window\.AutoRefreshPolicy\.enabled\(autoRefreshRef\.current, "proactive", activeChar\.id\),\s*proactiveBlock: autoBlockWhy\(activeChar\.id\)/);
assert.match(app, /if \(!!s\.proactive !== window\.AutoRefreshPolicy\.enabled\(/);
assert.match(app, /const autoBlockWhy = charId =>/);
assert.match(cmp, /settings\.proactiveBlock \? h\("div", \{ "data-wk": "proactiveblock"/);
assert.match(app, /OWN_LINE_FEATURES\[feature\] \? quietNow\("bg"\) : bgOff\(\)/);
assert.match(app, /OWN_LINE_FEATURES = \{ proactive: 1, diary: 1, moments: 1/);
console.log("proactive toggle ok");
