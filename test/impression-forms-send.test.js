// 她 2026-11-02：月度印象十二种写法整体改（读完不用猜），背面三格不限一句，卡片能发给他看
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const core = R("js/impression-core.js"), imp = R("js/impression.js"), app = R("js/app.js"), comp = R("js/components.js");
assert.match(core, /const QUOTE_FLOOR = "不管哪一种写法，读完都不用猜/);
assert.match(core, /【这一张的写法·必须照办】" \+ QUOTE_FLOOR \+ form/);
assert.doesNotMatch(core, /≤25 字|≤30 字/, "背面三格不再限一句");
assert.equal((core.match(/写成一段话，想写多长写多长（≤160 字）/g) || []).length, 4, "moment、shift 两种说法、him：一段话，不限一两句（2026-11-02）");
assert.match(core, /moment: S30\(d\.moment, 240\), shift: S30\(d\.shift, 240\),\n\s*him: S30\(d\.him, 240\)/);
// 发给他看
assert.match(imp, /"data-part": "send", onClick: \(\) => \{ if \(props\.onSendCard\(curChar, e\) !== false\)/);
assert.match(app, /onSendCard: \(cid, e\) => \{/);
assert.match(app, /kind: "impshare", read: true,[^\n]*\n\s*content: "\[月度印象\] 给你看你写我的那一张/);
assert.match(comp, /m\.kind === "ledgershare" \|\| m\.kind === "petshare" \|\| m\.kind === "impshare"/);
assert.match(comp, /m\.kind !== "impshare" && typeof window/);
console.log("ok");
