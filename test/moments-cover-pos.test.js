const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const c=fs.readFileSync(__dirname+"/../js/components.js","utf8"),a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
test("朋友圈封面能拖着调位置，点好了才存",()=>{
  assert.ok(c.includes('posNow + "/cover no-repeat url('));
  assert.ok(c.includes('"调位置"')&&c.includes('"好了"')&&c.includes('"mocoveradj"'));
  assert.ok(c.includes('onSetCoverPos && onSetCoverPos(adj.x + "% " + adj.y + "%")'));
  assert.ok(a.includes('"@pos", pos)'));
});
