const assert = require("assert");
const kit = require("../js/yanqiu-cc-tools.js");

function storage() {
  const map = new Map();
  return { getItem:k => map.has(k) ? map.get(k) : null, setItem:(k,v) => map.set(k,String(v)) };
}

(async () => {
  assert.deepStrictEqual(kit.normalizeRequest({ name:"Read", args:{ file_path:"/tmp/a" } }), { toolName:"Read", arguments:{ file_path:"/tmp/a" } });
  assert.deepStrictEqual(kit.normalizeRequest({ name:"search_memory", args:{ query:"Lisa" } }), { toolName:"search_memory", arguments:{ query:"Lisa" } });
  assert.deepStrictEqual(kit.normalizeRequest({ name:"read_yanqiu_moments", args:{} }), { toolName:"read_yanqiu_moments", arguments:{} });
  assert.strictEqual(kit.normalizeRequest({ name:"Write", args:{ file_path:"/tmp/a" } }), null);

  let calls = 0, state = "queued";
  const cloud = {
    async yanqiuCcToolEnqueue() { calls++; return { id:"job-1", status:"queued" }; },
    async yanqiuCcToolResult() { return { id:"job-1", status:state, result:state === "completed" ? { text:"ok" } : null }; }
  };
  const mgr = kit.createManager({ storage:storage(), cloud });
  await mgr.enqueue({ charId:"yanqiu", turnId:"turn-1" }, { name:"Grep", args:{ pattern:"x" } });
  await mgr.enqueue({ charId:"yanqiu", turnId:"turn-1" }, { name:"Grep", args:{ pattern:"x" } });
  assert.strictEqual(calls, 2); // cloud idempotency owns retry; local tracking stays one row
  assert.strictEqual(mgr.status().length, 1);
  assert.deepStrictEqual(await mgr.poll(), []);
  state = "completed";
  const done = await mgr.poll();
  assert.strictEqual(done.length, 1);
  mgr.markDelivered("job-1");
  assert.deepStrictEqual(await mgr.poll(), []);
  console.log("yanqiu cc tools tests passed");
})().catch(error => { console.error(error); process.exit(1); });
