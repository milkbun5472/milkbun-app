// 秋秋小窝 · 账号（她 2026-10-16）：昵称+密码+恢复码；不登录能逛能导入，不能传不能评；
//   列表是纸条墙、点进去是留言簿（她定的 A+B 混）。这一份钉前端这几件：
//   令牌只放这台手机（qq_ 键，不进存档不上云）、请求带上令牌、令牌过期会自己清、
//   前门没接上时别装成「空的小窝」、上传不再让人手填署名、要登录的地方先去登录。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const nest = fs.readFileSync(path.resolve(__dirname, "..", "js/nest.js"), "utf8");

// 桩照 nest.js 真用到的那几样写：localStorage 的 getItem/setItem/removeItem、fetch 回 { ok, status, json() }
function load(fetchImpl) {
  const store = {}, g = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); };
  new Function("window", "React", "h", "Svg", "loadJSON", "saveJSON", "localStorage", "fetch", "qqDeviceId", nest)(
    g, { useState: () => [], useEffect: () => {}, useRef: () => ({}) }, () => null, () => null, (k, d) => d, () => true, localStorage, fetch, () => "dev-1");
  return { N: g.Nest, store, calls };
}
const ok = body => ({ ok: true, status: 200, json: async () => body });

test("令牌放 qq_ 键：不是 x_，所以不进存档、不上云、不跟着导出走", () => {
  const { N, store } = load(async () => ok({}));
  N.setSession("tok123", { id: "u1", name: "小鱼干", created: 1 });
  const keys = Object.keys(store);
  assert.deepEqual(keys.sort(), ["qq_nestMe", "qq_nestTok"]);
  assert.ok(!keys.some(k => k.startsWith("x_")), "登录凭据进了存档");
  assert.equal(N.cachedMe().name, "小鱼干");
  N.clearSession();
  assert.equal(N.sessionTok(), ""); assert.equal(N.cachedMe(), null);
});

test("登录了的请求带上令牌；没登录的不带", async () => {
  const { N, calls } = load(async () => ok({ items: [] }));
  await N.api("/list");
  assert.equal(calls[0].init.headers.authorization, undefined);
  N.setSession("tok123", { id: "u1", name: "a" });
  await N.api("/list");
  assert.equal(calls[1].init.headers.authorization, "Bearer tok123");
  assert.equal(calls[1].init.headers["x-qq-device"], "dev-1", "老东西认领要用的设备编号丢了");
});

test("拿着令牌还被说「要登录」：令牌过期了，自己清掉", async () => {
  const { N } = load(async () => ({ ok: false, status: 401, json: async () => ({ error: "登录以后才能这么做" }) }));
  N.setSession("old", { id: "u1", name: "a" });
  await assert.rejects(N.api("/upload", { method: "POST", body: {} }), /登录以后/);
  assert.equal(N.sessionTok(), "", "过期的令牌还留着，每次都会被拒");
});

test("前门没接上时回的是整张网页：别当成空的小窝，说清楚连不上", async () => {
  const { N } = load(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }));
  await assert.rejects(N.api("/list"), /门没接上/);
});

test("上传不再让人手填署名：署名就是账号名（后端也照账号名写）", () => {
  const i = nest.indexOf("function Upload("), j = nest.indexOf("function NestApp(", i);
  assert.ok(i > 0 && j > i);
  const up = nest.slice(i, j);
  assert.ok(!/nick/.test(up), "上传页还留着署名那一格");
  assert.match(up, /署名就是你的小窝昵称/);
});

test("要登录的地方都先去登录，登完接着做：传一个、铃铛、点赞收藏关注、留言", () => {
  const home = nest.slice(nest.indexOf("function NestApp("));
  assert.match(home, /me \? push\(\{ v: "upload" \}\) : needLogin\(\{ v: "upload" \}\)/);
  assert.match(home, /me \? push\(\{ v: "notices" \}\) : needLogin\(\{ v: "notices" \}\)/);
  // ⚠️先把「接着去哪」取出来再清：setStack 的更新函数是晚一拍才跑的，在里面读 after.current 读到的已经是清掉之后的 null
  //   （2026-10-16 实测：没登录点「传一个」→ 注册 → 回到了首页，没进上传页）
  assert.match(home, /const next = after\.current; after\.current = null; setMe\(u\); setStack\(s => s\.slice\(0, -1\)\.concat\(next \? \[next\] : \[\]\)\)/, "登完没接着去刚才要去的地方");
  const det = nest.slice(nest.indexOf("function Detail("), nest.indexOf("function Guestbook("));
  assert.match(det, /if \(!me\) \{ onLogin\(\); return; \}/);
  const gb = nest.slice(nest.indexOf("function Guestbook("), nest.indexOf("function Profile("));
  assert.match(gb, /"登录以后才能签"/);
});

test("注册和恢复之后先给她看恢复码，点了「我存好了」才进", () => {
  const lg = nest.slice(nest.indexOf("function Login("), nest.indexOf("function Upload("));
  assert.match(lg, /if \(d\.recovery\) setRec\(\{ code: d\.recovery, user: d\.user \}\); else/);
  assert.match(lg, /只在这里出现这一次/);
  assert.match(lg, /"我存好了"/);
});

test("每一层都是整页（不用半窗）、顶栏走公共 Head、只有一个主滚动区", () => {
  for (const fn of ["Detail", "Profile", "Notices", "Login", "NestApp"]) {
    const i = nest.indexOf("function " + fn + "(");
    const seg = nest.slice(i, i + 9000);
    assert.ok(i > 0, fn);
    assert.match(seg, /className: "h-full flex flex-col"/, fn + " 外壳不是整页");
    assert.match(seg, /h\(Head, \{/, fn + " 没用公共顶栏");
    assert.ok(!/h\(Sheet,/.test(seg), fn + " 用了半窗");
  }
});

test("纸条歪的角度照 id 算：同一张每次一样，不会一刷新就乱抖；最多歪一度多", () => {
  const { N } = load(async () => ok({}));
  assert.equal(N.tilt("abc123"), N.tilt("abc123"));
  for (const id of ["a", "b", "zz9", "0f3c", "item-77"]) assert.ok(Math.abs(N.tilt(id)) <= 1.1, id);
});
