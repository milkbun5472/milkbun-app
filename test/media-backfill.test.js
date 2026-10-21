const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const body = eng.slice(eng.indexOf("async function mediaBackfill("), eng.indexOf("// 回前台/联网时补送。"));
const imgOpen = () => "img", vaultOpen = () => "vault";
const run = (env) => new Function("window", "idbImgOpen", "idbVaultOpen", "idbAllKeys", "mediaLocalRead", body + "\nreturn mediaBackfill;")(
  env.window, imgOpen, vaultOpen, async o => env.keys[o === imgOpen ? "selfies" : "vault"], async (b, k) => env.blob(b, k));
test("补传：本机两个图库里云上没有的才传，已有的跳过", async () => {
  const put = [];
  const window = { Cloud: { getUser: async () => ({ id: "u" }), mediaList: async b => new Set(b === "vault" ? ["iv_a"] : []), mediaPut: async (b, k) => { put.push(b + "/" + k); return true; } } };
  const fn = run({ window, keys: { selfies: ["s1"], vault: ["iv_a", "iv_b"] }, blob: () => ({ size: 3 }) });
  const prog = [];
  const r = await fn(p => prog.push(p));
  assert.deepEqual(put, ["selfies/s1", "vault/iv_b"]);
  assert.equal(r.sent, 2); assert.equal(r.total, 2); assert.equal(r.stopped, "");
  assert.equal(prog[prog.length - 1].done, 2);
});
test("没登录不传；连着失败三张就停", async () => {
  let fn = run({ window: { Cloud: { getUser: async () => null, mediaPut: async () => true } }, keys: { selfies: ["a"], vault: [] }, blob: () => ({ size: 1 }) });
  assert.equal((await fn()).stopped, "login");
  let n = 0;
  fn = run({ window: { Cloud: { getUser: async () => ({ id: "u" }), mediaList: async () => new Set(), mediaPut: async () => { n++; return false; } } }, keys: { selfies: ["a", "b", "c", "d", "e"], vault: [] }, blob: () => ({ size: 1 }) });
  const r = await fn();
  assert.equal(r.stopped, "net"); assert.equal(n, 3);
});
