const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("线下经过卡能把丢了的那一场放回往期，往期里有就不动",()=>{
  const i=a.indexOf("const restoreOfflineFromCard");assert.ok(i>0);
  const seg=a.slice(i,a.indexOf("const resummarizeOffline",i));
  assert.ok(seg.includes('if (offlineLogSessionFor(list, log)) { toast("这一场还在往期里'));
  assert.ok(seg.includes('r.who === "【场景】"'));
  assert.equal((a.match(/onRestoreOffline: i => restoreOfflineFromCard\(/g)||[]).length,2);
  assert.ok(c.includes('"data-wk": "offlogrestore"'));
  assert.equal((c.match(/onRestore: onRestoreOffline \? \(\) => onRestoreOffline\(i\) : null/g)||[]).length,2);
});
