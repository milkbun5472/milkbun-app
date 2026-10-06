const test=require("node:test"),assert=require("node:assert"),fs=require("fs");
test("通话不画只剩声音标记的空白气泡",()=>{const s=fs.readFileSync(__dirname+"/../js/components.js","utf8");
assert.match(s,/ttsMarkStrip\(m\.content \|\| ""\) : \(m\.content \|\| ""\)\)\.trim\(\)\) return null;/);});
