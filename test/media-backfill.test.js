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

// 她 2026-10-21 问「照片进云会不会公共版撑爆」时查出来的：公共版那份建表内容只建了 saves 一张表，
//   没建放图片的 media 桶 —— 照着弄完的人一张图也传不上去，界面却说成「传到一半断了」，于是反复点。
test("桶没建出来：单独说出来，不说成「断了」", async () => {
  const window = { Cloud: { mediaErr: "", getUser: async () => ({ id: "u" }),
    mediaList: async function () { this.mediaErr = "nobucket"; return null; },   // 列目录就先失败
    mediaPut: async function () { this.mediaErr = "nobucket"; return false; } } };
  const fn = run({ window, keys: { selfies: ["s1", "s2", "s3", "s4"], vault: [] }, blob: () => ({ size: 3 }) });
  const r = await fn(() => {});
  assert.equal(r.stopped, "nobucket");
  assert.equal(r.sent, 0);
  // 真·断网那一档照旧说「断了」
  const w2 = { Cloud: { mediaErr: "Failed to fetch", getUser: async () => ({ id: "u" }), mediaList: async () => null, mediaPut: async () => false } };
  const r2 = await run({ window: w2, keys: { selfies: ["a", "b", "c"], vault: [] }, blob: () => ({ size: 3 }) })(() => {});
  assert.equal(r2.stopped, "net");
});

test("桶没建出来时，界面给的是「去建一下」而不是「再点一次」；云那头认得出这个错", () => {
  const scr = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
  const cloud = fs.readFileSync(__dirname + "/../js/cloud.js", "utf8");
  assert.match(scr, /mediaFill\.stopped === "nobucket" \? "云上还没建放图片的地方（media 桶）/);
  assert.match(cloud, /bucket not found\|not_found/i, "云那头没认出「桶不存在」这个错");
  assert.match(cloud, /return this\._mediaNote\(error\);/, "上传那一处没把原因记下来");
});
