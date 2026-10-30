// 私信跟着号走（2026-10-30：「私信能不能也分面具 看的是我现在用哪个号刷」）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("列表只给现在这个号的私信", () => {
  assert.match(app, /pms: \(forumPMs \|\| \[\]\)\.filter\(t => pmAcctOf\(t\) === pmAcctNow\(\)\)/);
  assert.match(app, /const pmAcctNow = \(\) => forumMe\.using === "alt" \? "alt" : forumMaskNow\(\);/);
});
test("开私信、刷私信都打上当前的号", () => {
  assert.equal((app.match(/\.\.\.pmAcctTag\(\)/g) || []).length, 3);
});
test("角色只认跟TA聊天用的那张面具；不认得就当陌生网友，也不进聊天", () => {
  assert.match(app, /const pmCharKnows = \(t, ch\) => !!ch && !\(t && t\.alt\) && String\(\(t && t\.mask\) \|\| ""\) === maskKeyOf\(ch\.id\);/);
  assert.match(app, /if \(pmChar && !pmCharKnows\(th, pmChar\)\) \{/);
  assert.match(app, /t\.charId === char\.id && pmCharKnows\(t, char\)\);/);
});
