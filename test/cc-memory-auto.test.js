const test = require("node:test");
const assert = require("node:assert/strict");
const Auto = require("../js/cc-memory-auto.js");

function storage() { const m = new Map(); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)) }; }
const msg = (key, role, ts, extra={}) => ({ ledgerImported:true, ledgerKey:key, role, ts, content:key, ...extra });

test("CC 合格原话攒成批次，并带少量真实前文而不带撤回行", () => {
  const old = { role:"assistant", content:"前文", ts:1 };
  const rows = [old, msg("a","user",2), msg("gone","assistant",3,{recalled:true}), msg("b","assistant",4)];
  const p = Auto.plan(rows, Auto.normalize(null,"u","c"));
  assert.deepEqual(p.keys,["a","b"]);
  assert.deepEqual(p.messages.map(x=>x.content),["前文","a","b"]);
});

test("成功后逐 ledgerKey 幂等，刷新重载不会重复抽取", () => {
  const s=storage(), initial=Auto.load(s,"u","c"), rows=[msg("a","user",2),msg("b","assistant",3)];
  const p=Auto.plan(rows,initial); Auto.commit(s,initial,p.keys,1000);
  assert.equal(Auto.plan(rows,Auto.load(s,"u","c")),null);
});

test("失败只留诊断不盖章，下次仍会补跑", () => {
  const s=storage(), initial=Auto.load(s,"u","c"), rows=[msg("a","user",2),msg("b","assistant",3)];
  Auto.fail(s,initial,new Error("offline"),1000);
  const next=Auto.load(s,"u","c");
  assert.equal(next.last_error,"offline");
  assert.deepEqual(Auto.plan(rows,next).keys,["a","b"]);
});

test("换账号或换角色不会继承别人的抽取书签", () => {
  const s=storage(), a=Auto.load(s,"u1","c1"); Auto.commit(s,a,["a","b"],1000);
  assert.deepEqual(Auto.load(s,"u2","c1").processed_keys,[]);
  assert.deepEqual(Auto.load(s,"u1","c2").processed_keys,[]);
});

test("历史积压超过窗口时从最早批次推进，不给未审旧行提前盖章", () => {
  const rows=Array.from({length:150},(_,i)=>msg("k"+i,i%2?"assistant":"user",i+1));
  const p=Auto.plan(rows,Auto.normalize(null,"u","c"));
  assert.equal(p.messages.length,120);
  assert.equal(p.keys.length,120);
  assert.equal(p.keys[0],"k0");
  assert.equal(p.keys.at(-1),"k119");
  assert.equal(p.keys.includes("k149"),false);
});
