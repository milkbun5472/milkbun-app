// 她 2026-11-02：深夜台想法挺好，就是一想她就报顶格结论（骨头酥了、命给她）。写法要求里加判据。
const assert = require("node:assert/strict"), fs = require("fs");
const s = fs.readFileSync("js/phone.js", "utf8");
const seg = s.slice(s.indexOf("    latenight: {\n      instruction:"), s.indexOf("    mail: {"));
assert.match(seg, /【thought 和 note 怎么写才是他】/);
assert.match(seg, /判据：这一句里有没有一样只属于她、或者只属于这条片子的具体东西/);
assert.match(seg, /跟某个具体的人有关的那种/, "跟她有关的片子照旧可以有");
