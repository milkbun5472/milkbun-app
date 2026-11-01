const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("进群记住几条没看，群里挂一颗跳到第一条没看的",()=>{
  assert.ok(a.includes("setGOpenUnread(was > 0 ? { id: id, n: was } : null)"));
  assert.ok(a.includes("openUnread: gOpenUnread && gOpenUnread.id === activeGroup.id ? gOpenUnread.n : 0"));
  assert.ok(c.includes('"data-wk": "gunreadjump"'));
  assert.ok(c.includes("const idx = Math.max(0, messages.length - openUnread);"));
});

// 窗口还没撑开到那条（她 2026-11-02「点那个新消息也跳转不上去」）：不拿旧的 start 放弃，过一会儿再找那一条本身
{
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(src, /if \(o\.single && i < start\) return;/, "群聊不靠 start 放弃");
  assert.match(src, /if \(left > 0\) setTimeout\(\(\) => tryFind\(left - 1\), 150\);/);
  assert.match(src, /tryFind\(10\);/);
  // 窗口里还没有那一条、它前面也没有气泡：不能先跳到窗口最上面那条（那是错的位置）
  assert.match(src, /if \(!node && \(inWin \|\| left <= 0\)\) for \(let j = i \+ 1;/);
}
