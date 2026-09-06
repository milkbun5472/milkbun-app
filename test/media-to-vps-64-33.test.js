// 图库存到 VPS（她 2026-09-06：「昨天数据丢了然后所以图也没了，以后有没有办法
// 图库存到 vps 里，换页面啥的也都不会失效」）。
//
// 像素从来没进过云：saves 那一行只有 x_ 文本，图在本机 IndexedDB 里。
// 现在多一层——写完本机进上传队列，读不到就回 VPS 拉一份并回填本机。
//
// ⚠️这一层的铁律是【永远不许连累本机那条路】：桶没开、没登录、断网，
//   都只是这一张没上去/没拉到，本机照旧。所以下面把三种坏情况各跑一遍。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const cloud = fs.readFileSync(path.join(__dirname, "..", "js", "cloud.js"), "utf8");

// 队列那一段真跑起来（不是拿正则看一眼）
function mkQueue() {
  const store = {};
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const seg = eng.slice(eng.indexOf('const MEDIA_Q_KEY = "x_mediaUpQ";'), eng.indexOf("async function remoteMediaGet"));
  const ctx = {
    localStorage: ls, JSON, Math, Number, String, Object, Array, Promise,
    window: { addEventListener() {} }, document: { addEventListener() {}, hidden: false },
    idbVaultGetOnly: null, idbImgGetOnly: null
  };
  vm.createContext(ctx);
  vm.runInContext(seg + "\nglobalThis.__q = { mediaQueueRead, mediaQueueAdd, mediaDrain, mediaQueueWrite };", ctx);
  return { api: ctx.__q, ctx, store };
}

test("队列里只放名字，不放像素", () => {
  const { api, store } = mkQueue();
  api.mediaQueueAdd("selfies", "img_a");
  api.mediaQueueAdd("vault", "iv_b");
  assert.deepEqual(api.mediaQueueRead(), ["selfies|img_a", "vault|iv_b"]);
  // 队列整份加起来也就几十个字节——像素还在 IndexedDB 里躺着
  assert.ok(String(store["x_mediaUpQ"]).indexOf("data:") < 0, "队列里混进了像素");
  // 同一张再写一次不许攒成两条
  api.mediaQueueAdd("selfies", "img_a");
  assert.deepEqual(api.mediaQueueRead(), ["vault|iv_b", "selfies|img_a"]);
});

test("送不上去就原样留着（桶没开、没登录、断网都算）", async () => {
  const { api, ctx } = mkQueue();
  ctx.idbImgGetOnly = async () => ({ size: 10, type: "image/png" });
  api.mediaQueueAdd("selfies", "img_a");
  // ① 压根没有 Cloud 那个口
  assert.equal(await api.mediaDrain(4), 0);
  assert.deepEqual(api.mediaQueueRead(), ["selfies|img_a"], "没有云的时候把队列丢了");
  // ② 有口但一直失败（桶还没开）
  ctx.window.Cloud = { mediaPut: async () => false };
  assert.equal(await api.mediaDrain(4), 0);
  assert.deepEqual(api.mediaQueueRead(), ["selfies|img_a"], "失败之后没留着，这张就永远上不去了");
  // ③ mediaPut 直接抛，也不许把队列弄丢
  ctx.window.Cloud = { mediaPut: async () => { throw new Error("boom"); } };
  assert.equal(await api.mediaDrain(4), 0);
  assert.deepEqual(api.mediaQueueRead(), ["selfies|img_a"]);
  // ④ 通了就送走
  ctx.window.Cloud = { mediaPut: async () => true };
  assert.equal(await api.mediaDrain(4), 1);
  assert.deepEqual(api.mediaQueueRead(), []);
});

test("本机已经没这张了：出队，不许永远堵在队头", async () => {
  const { api, ctx } = mkQueue();
  ctx.window.Cloud = { mediaPut: async () => true };
  ctx.idbImgGetOnly = async () => null;          // 删掉了 / 清过了
  ctx.idbVaultGetOnly = async () => ({ size: 3 });
  api.mediaQueueAdd("selfies", "img_gone");
  api.mediaQueueAdd("vault", "iv_ok");
  assert.equal(await api.mediaDrain(4), 1, "后面那张没被送出去——前面那张堵住了");
  assert.deepEqual(api.mediaQueueRead(), []);
});

test("队列有天花板，不会变成第二个图库", () => {
  const { api } = mkQueue();
  const cap = Number(eng.match(/const MEDIA_Q_CAP = (\d+);/)[1]);
  for (let i = 0; i < cap + 50; i++) api.mediaQueueAdd("selfies", "img_" + i);
  const q = api.mediaQueueRead();
  assert.equal(q.length, cap, "天花板没兜住");
  assert.equal(q[q.length - 1], "selfies|img_" + (cap + 49), "最新那张不在队尾");
  assert.equal(q[0], "selfies|img_50", "挤掉的不是最旧的那批");
});

test("读：本机 → 原生壳 → VPS，拉回来还要回填本机", () => {
  const get = eng.match(/async function idbImgGet\(k\) \{[^\n]*\n?/)[0];
  assert.ok(get.indexOf("idbImgGetOnly") < get.indexOf("nativeMediaGet"), "本机不是第一顺位");
  assert.ok(get.indexOf("nativeMediaGet") < get.indexOf('remoteMediaGet("selfies"'), "VPS 排在原生壳前面了");
  assert.match(get, /remoteMediaGet\("selfies", k\)[\s\S]*idbImgPutOnly\(k, far\)/, "从 VPS 拉回来之后没回填本机——下次还得再拉一次");
  const vget = eng.match(/async function idbVaultGet\(k\) \{[^\n]*\n?/)[0];
  assert.match(vget, /idbVaultGetOnly[\s\S]*remoteMediaGet\("vault", k\)[\s\S]*idbVaultPutOnly\(k, far\)/,
    "图库那一支没接上 VPS（自拍接了、图库没接，就是「一层写在两处」）");
});

test("写：两个仓都进队列", () => {
  assert.match(eng, /async function idbImgPut\(k, blob\)[^\n]*mediaQueueAdd\("selfies", k\)/);
  assert.match(eng, /async function idbVaultPut\(k, blob\)[^\n]*mediaQueueAdd\("vault", k\)/);
});

test("上传那一层排空时不许自己去云里拉一份回来再传上去", () => {
  const seg = eng.slice(eng.indexOf("async function mediaLocalRead"), eng.indexOf("async function mediaDrain"));
  assert.match(seg, /idbVaultGetOnly\(k\)/, "走了会回源的那一支，等于白跑一个来回");
  assert.equal(seg.indexOf("await idbVaultGet(k)"), -1);
});

test("云那三个口一律不抛，而且只用一个桶", () => {
  ["mediaPut", "mediaGet", "mediaDel"].forEach(fn => {
    const i = cloud.indexOf("async " + fn + "(");
    assert.ok(i > 0, "找不到 " + fn);
    const body = cloud.slice(i, cloud.indexOf("\n    },", i));
    assert.match(body, /catch \(e\) \{ return (false|null); \}/, fn + " 会抛——上云成了多一个故障点");
    assert.match(body, /this\.MEDIA_BUCKET/, fn + " 没走那个统一的桶");
  });
  // 路径按账号分目录：换个账号不许看见上一个人的图
  assert.match(cloud, /return user\.id \+ "\/" \+ String\(bucket \|\| "misc"\) \+ "\/" \+ String\(key\);/);
  assert.match(cloud, /if \(!user\) return "";/, "没登录时还给了一个路径出去");
});
