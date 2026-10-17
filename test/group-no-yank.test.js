const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("群里她在上面看时，新消息不把她拽到底，底下挂一颗",()=>{
  // v75.941 起这段收进 useNewBelow，单聊、群聊共用
  assert.ok(c.includes('if (!atBottomRef.current && added > 0 && !(last && last.role === "user")) { setNewBelow(n => n + added); return false; }'));
  assert.ok(c.includes('h(NewBelowPill, { n: nb.newBelow, onGo: nb.go, group: true })'));
  assert.ok(c.includes('"data-wk": group ? "gnewbelow" : "newbelow"'), "群里那颗挂点还叫 gnewbelow（写死，不从外面传）");
});
test("单聊也接上：同一份 useNewBelow；TA连发时只跟到这一轮第一条顶到上沿",()=>{
  assert.ok(c.includes('h(NewBelowPill, { n: nb.newBelow, onGo: nb.go })'));
  assert.equal((c.match(/const nb = useNewBelow\(ref, /g)||[]).length,2);
  assert.ok(c.includes('else if (turnTopRef.current == null) turnTopRef.current = _prevH;'));
});
