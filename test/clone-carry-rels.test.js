// 群友 2026-11-03：「克隆了一份新的角色，但是关系不能导过去，要重新弄」。克隆完问一句，带过去就照样连一份。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const seg = app.slice(app.indexOf("const cloneChar = c =>"), app.indexOf("const delChar = id =>"));
assert.match(seg, /const newId = "char_" \+ Date\.now\(\);/);
assert.match(seg, /requestAppConfirm\("关系也一起带过去吗？"/);
assert.match(seg, /if \(!rels\[nk\]\) saveRel\(nk, String\(r\.label \|\| ""\), r\.note \|\| ""\)/, "走 saveRel：跟我那条线照样对好感起点");
// 换端点的算法
const c = { id: "A" }, newId = "N";
const rels = { "A->B": { label: "x" }, "me->A": { label: "y" }, "B->C": { label: "z" } };
const own = Object.keys(rels).filter(k => { const [a, b] = k.split("->"); return (a === c.id || b === c.id) && a !== b; });
const nks = own.map(k => { const [a, b] = k.split("->"); return (a === c.id ? newId : a) + "->" + (b === c.id ? newId : b); });
assert.deepEqual(nks.sort(), ["N->B", "me->N"]);
