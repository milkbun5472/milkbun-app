// 主页面先用存着的、新版后台一块一块下齐再换（她 2026-11-15：国内每秒几 KB，每发一版白屏干等十来分钟）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SW = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const BASE = "https://t.invalid/phone/";

function makeSW(server) {
  const listeners = {}, entries = new Map(), posted = [];
  const keyOf = k => typeof k === "string" ? new URL(k, BASE).href : k.url;
  const cache = {
    put: async (k, v) => { entries.set(keyOf(k), v); },
    match: async k => entries.get(keyOf(k)),
    keys: async () => [...entries.keys()].map(url => ({ url })),
    delete: async k => entries.delete(keyOf(k)),
  };
  const fetched = [];
  const ctx = {
    URL, console, Response,
    caches: { open: async () => cache, match: async k => entries.get(keyOf(k)), keys: async () => [] },
    fetch: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      fetched.push(url);
      if (server.offline) throw Error("offline");
      const body = server.files[url.split("?")[0] === BASE ? BASE : url];
      if (body == null) return new Response("nope", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": /\.js/.test(url) ? "application/javascript" : "text/html" } });
    },
    self: {
      location: new URL(BASE + "sw.js"),
      addEventListener: (n, f) => { listeners[n] = f; },
      clients: { matchAll: async () => [{ postMessage: m => posted.push(m) }], claim: async () => {} },
    },
  };
  vm.runInNewContext(SW, ctx);
  const navigate = async (p = "") => {
    let result; const waits = [];
    listeners.fetch({ request: { url: BASE + p, method: "GET", mode: "navigate" }, respondWith: r => { result = r; }, waitUntil: w => waits.push(w) });
    const res = await result; await Promise.all(waits);
    return { text: await res.clone().text(), waits: waits.length };
  };
  const asset = async (p) => {
    let result; listeners.fetch({ request: { url: BASE + p, method: "GET", mode: "cors" }, respondWith: r => { result = r; } });
    const res = await result; await new Promise(r => setTimeout(r, 20)); return res;
  };
  return { navigate, asset, entries, posted, fetched };
}
const page = v => '<script src="vendor/react.js"></script><script>var L=["js/bundle.js?v=' + v + '","js/bundle-2.js?v=' + v + '"]</script>'
  + '<script type="text/lazy" data-src="js/lazy.js?v=' + v + '"></script>' + v;

test("有存着的首页就先用它，新版下齐了才换上，并告诉页面", async () => {
  const server = { files: { [BASE]: page("A"), [BASE + "js/bundle.js?v=A"]: "a1", [BASE + "js/bundle-2.js?v=A"]: "a2", [BASE + "vendor/react.js"]: "r" } };
  const sw = makeSW(server);
  assert.match((await sw.navigate()).text, /A$/, "头一回没存着，只能走网络");
  for (const k of [BASE + "js/bundle.js?v=A", BASE + "js/bundle-2.js?v=A"]) sw.entries.set(k, "x");
  // 发新版 B
  Object.assign(server.files, { [BASE]: page("B"), [BASE + "js/bundle.js?v=B"]: "b1", [BASE + "js/bundle-2.js?v=B"]: "b2" });
  const r = await sw.navigate();
  assert.match(r.text, /A$/, "这一次照旧秒开存着的旧版");
  assert.equal(r.waits, 1, "后台去下新版要挂在 waitUntil 上");
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=B") && sw.entries.has(BASE + "js/bundle-2.js?v=B"), "排队清单里的块要下进来");
  assert.ok(!sw.entries.has(BASE + "js/lazy.js?v=B"), "点进去才加载的不在开机清单里");
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=A"), "换上的那一刻不清旧的：旧页面可能还在用");
  assert.deepEqual(sw.posted.map(m => m.type), ["QQ_UPDATE_READY"]);
  assert.match((await sw.navigate()).text, /B$/, "下一次打开就是新版");
  assert.ok(!sw.entries.has(BASE + "js/bundle.js?v=A"), "用上新版之后的下一轮才清旧的");
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=B"));
});

test("新版有一块没拿到：不换首页，旧版的文件也不许清", async () => {
  const server = { files: { [BASE]: page("A"), [BASE + "js/bundle.js?v=A"]: "a1", [BASE + "js/bundle-2.js?v=A"]: "a2", [BASE + "vendor/react.js"]: "r" } };
  const sw = makeSW(server);
  await sw.navigate();
  for (const k of [BASE + "js/bundle.js?v=A", BASE + "js/bundle-2.js?v=A"]) await sw.entries.set(k, "x");
  Object.assign(server.files, { [BASE]: page("B"), [BASE + "js/bundle.js?v=B"]: "b1" });  // bundle-2 B 缺
  await sw.navigate();
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=B"), "下好的那块先存住，下次接着来");
  assert.ok(sw.entries.has(BASE + "js/bundle-2.js?v=A"), "旧首页还要用旧的那块");
  assert.equal(sw.posted.length, 0);
  assert.match((await sw.navigate()).text, /A$/, "没下齐就还是旧版");
});

test("拿回来的是进门页：不当新版", async () => {
  const server = { files: { [BASE]: page("A"), [BASE + "js/bundle.js?v=A"]: "a1", [BASE + "js/bundle-2.js?v=A"]: "a2", [BASE + "vendor/react.js"]: "r" } };
  const sw = makeSW(server);
  await sw.navigate();
  server.files[BASE] = "<form>先敲个门</form>";
  await sw.navigate();
  assert.match((await sw.navigate()).text, /A$/);
  assert.equal(sw.posted.length, 0);
});

test("救援页跳回来（?launch=）照旧网络优先", async () => {
  const server = { files: { [BASE]: page("A"), [BASE + "js/bundle.js?v=A"]: "a1", [BASE + "js/bundle-2.js?v=A"]: "a2", [BASE + "vendor/react.js"]: "r" } };
  const sw = makeSW(server);
  await sw.navigate();
  server.files[BASE] = page("C");
  server.files[BASE + "index.html?launch=1&fresh=2"] = page("C");
  const r = await sw.navigate("index.html?launch=1&fresh=2");
  assert.equal(r.waits, 0);
  assert.match(r.text, /C$/);
});

test("页面那头：收到下好了就冒提示，回前台问一声", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.includes('e.data.type === "QQ_UPDATE_READY"'));
  assert.ok(html.includes('postMessage({ type: "QQ_CHECK_UPDATE" })'));
  assert.ok(SW.includes('d.type === "QQ_CHECK_UPDATE"'));
  assert.ok(/SW_VERSION = "archive-sw-v8"/.test(SW), "缓存柜名字不许动：一改，所有人存着的全清，要整份重下");
});

test("旧页面再要一次旧文件，不许把后台刚下好的新文件挤掉", async () => {
  const server = { files: { [BASE]: page("A"), [BASE + "js/bundle.js?v=A"]: "a1", [BASE + "js/bundle-2.js?v=A"]: "a2", [BASE + "vendor/react.js"]: "r" } };
  const sw = makeSW(server);
  await sw.navigate();
  Object.assign(server.files, { [BASE]: page("B"), [BASE + "js/bundle.js?v=B"]: "b1", [BASE + "js/bundle-2.js?v=B"]: "b2" });
  await sw.navigate();                                   // 后台下齐了 B
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=B"));
  sw.entries.delete(BASE + "js/bundle.js?v=A");          // 旧页面要的旧文件不在柜子里，得走网络
  await sw.asset("js/bundle.js?v=A");
  assert.ok(sw.entries.has(BASE + "js/bundle.js?v=B"), "缓存优先那条路的「删同名旧版」误删了刚下好的新版");
});
