const fs = require("fs"), assert = require("assert"), vm = require("vm"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx); try { vm.runInContext(R("js/engine.js"), ctx); } catch (e) {}
const f = vm.runInContext("rareLookLine", ctx);
// 她 2026-11-28：同人本里金发角色和白发的她被画成两个棕发
assert(/「阿金」「我」/.test(f([{ name: "阿金", appearance: "金色短发" }, { name: "我", appearance: "白发红瞳" }, { name: "路人", appearance: "黑发" }])));
assert.equal(f([{ name: "路人", appearance: "黑发" }]), "");
const app = R("js/app.js"), fic = R("js/fanfic.js");
assert(/rareLookLine\(who\)/.test(app), "同人图带上这一句");
assert(/photoMe\(userName\(profile\), _peer \|\| null\)/.test(app), "同人图里的「我」照面具");
assert(/"data-wk": "ficartdel"/.test(fic) && /if \(x\.book && x\.book\.cover === k\) delete x\.book;/.test(fic), "同人图能删");
console.log("ok rare-look-fic");
