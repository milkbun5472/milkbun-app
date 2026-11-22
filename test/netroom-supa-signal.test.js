// 联机「递名片」可插拔（2026-11-22）：公共 MQTT 中转一份、自己的 Supabase Realtime broadcast 一份，
//   两份对 Mesh 的接口一样（open/subscribe/publish/close/alive）；连接码只装 url + anon key + 房间号
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js");

// ── 假中转：照 MqttLink 往外写的那几种帧（netroom.js 的 mqtt.connect/subscribe/publish）回话
function fakeMqttWorld(opts) {
  const socks = [];
  class WS {
    constructor(url) {
      this.url = url; this.readyState = 0; this.subs = [];
      socks.push(this);
      setTimeout(() => { if (opts && opts.refuse) { this.onerror && this.onerror(); this.onclose && this.onclose(); return; } this.readyState = 1; this.onopen && this.onopen(); }, 0);
    }
    send(b) {
      b = Uint8Array.from(b);
      const type = b[0] >> 4;
      const reply = (w, bytes) => setTimeout(() => w.readyState === 1 && w.onmessage && w.onmessage({ data: Uint8Array.from(bytes).buffer }), 0);
      if (type === 1) reply(this, [0x20, 2, 0, 0]);
      else if (type === 8) { this.subs.push("*"); reply(this, [0x90, 3, b[2], b[3], 0]); }
      else if (type === 3) socks.forEach(w => w.subs.length && reply(w, b));
    }
    close() { if (this.readyState === 3) return; this.readyState = 3; this.onclose && this.onclose(); }
  }
  return { WS, socks };
}
// ── 假 Supabase：照 SupaLink 调的那几样（createClient → channel().on().subscribe / send / removeChannel）
function fakeSupaWorld(opts) {
  const chans = {}; const made = [];
  const createClient = (url, key, o) => {
    made.push({ url, key, o });
    return {
      channel(name, cfg) {
        const ch = { name, cfg, h: null, cb: null,
          on(kind, filter, fn) { ch.h = { kind, filter, fn }; return ch; },
          subscribe(cb) { ch.cb = cb; (chans[name] = chans[name] || []).push(ch); setTimeout(() => cb(opts && opts.refuse ? "CHANNEL_ERROR" : "SUBSCRIBED"), 0); return ch; },
          send(m) { (chans[name] || []).forEach(o2 => { if (o2 !== ch && o2.h && m.event === o2.h.filter.event) setTimeout(() => o2.h.fn({ payload: m.payload }), 0); }); return Promise.resolve("ok"); } };
        return ch;
      },
      removeChannel(ch) { chans[ch.name] = (chans[ch.name] || []).filter(x => x !== ch); },
      realtime: { disconnect() {} }
    };
  };
  return { createClient, chans, made };
}
function load(extra) {
  const w = Object.assign({ loadJSON: (k, d) => d, saveJSON: () => {} }, extra || {});
  new Function("window", "loadJSON", "saveJSON", "WebSocket", src)(w, w.loadJSON, w.saveJSON, w.WebSocket);
  return w.NetRoomCore;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const ANON = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "anon", ref: "abc" })).toString("base64url") + ".sig";
const SERVICE = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".sig";

test("连接码：打包再解开是同一份；里面只有 u/k/c 三样", () => {
  const C = load();
  const s = C.packJoin({ url: "https://abc.supabase.co/rest/v1/", key: ANON, extra: "x", session: "tok" }, "123456");
  assert.ok(s.startsWith(C.JOIN_PREFIX));
  const raw = JSON.parse(Buffer.from(s.slice(C.JOIN_PREFIX.length), "base64url").toString("utf8"));
  assert.deepStrictEqual(Object.keys(raw).sort(), ["c", "k", "u"]);
  assert.strictEqual(raw.u, "https://abc.supabase.co");
  assert.deepStrictEqual(C.parseJoin("  " + s + "\n"), { code: "123456", sig: { url: "https://abc.supabase.co", key: ANON } });
  assert.deepStrictEqual(C.parseJoin("654321"), { code: "654321", sig: null });
  // 新式 publishable key 也认
  assert.ok(C.packJoin({ url: "https://abc.supabase.co", key: "sb_publishable_xyz" }, "111111"));
});

test("连接码：坏串、缺东西、service key 一律不认", () => {
  const C = load();
  const enc = o => C.JOIN_PREFIX + Buffer.from(JSON.stringify(o)).toString("base64url");
  [null, "", "12345", "1234567", "abc", C.JOIN_PREFIX, C.JOIN_PREFIX + "!!!", C.JOIN_PREFIX + "e30",
    enc({ u: "https://a.supabase.co", k: ANON, c: "12" }),
    enc({ u: "http://a.supabase.co", k: ANON, c: "123456" }),
    enc({ u: "https://a.supabase.co", k: "", c: "123456" }),
    enc({ u: "https://a.supabase.co", k: SERVICE, c: "123456" }),
    enc({ u: "https://a.supabase.co", k: "sb_secret_abc", c: "123456" }),
    "QQNR9." + Buffer.from("{}").toString("base64url")].forEach(x => assert.strictEqual(C.parseJoin(x), null, String(x)));
  assert.strictEqual(C.packJoin({ url: "https://a.supabase.co", key: SERVICE }, "123456"), "");
  assert.strictEqual(C.packJoin({ url: "https://a.supabase.co", key: "sb_secret_1" }, "123456"), "");
  assert.strictEqual(C.packJoin({ url: "https://a.supabase.co", key: ANON }, "12a456"), "");
});

test("这台能用的 Supabase：联机单独填的优先，其次云同步那份，都没有就是 null", () => {
  const C = load();
  assert.strictEqual(C.supaCfg({}, null), null);
  assert.strictEqual(C.supaCfg({ on: true }, "not json"), null);
  assert.deepStrictEqual(C.supaCfg({}, JSON.stringify({ url: "https://b.supabase.co", key: ANON })), { url: "https://b.supabase.co", key: ANON });
  assert.deepStrictEqual(C.supaCfg({ url: "https://a.supabase.co", key: ANON }, { url: "https://b.supabase.co", key: ANON }).url, "https://a.supabase.co");
  assert.strictEqual(C.supaCfg({ url: "https://a.supabase.co", key: SERVICE }, null), null);
});

// 两份实现走同一套：连上 → 订阅 → 一边发另一边收到 → alive → close 以后不再 alive、不再收
async function sameBehavior(openA, openB) {
  const gotB = [];
  const A = await openA((t, p) => {}, () => {});
  const B = await openB((t, p) => gotB.push([t, JSON.parse(p)]), () => {});
  await A.subscribe("qqnr/123456"); await B.subscribe("qqnr/123456");
  assert.ok(A.alive() && B.alive());
  A.publish("qqnr/123456", { t: "hello", from: "a" });
  await wait(20);
  assert.deepStrictEqual(gotB, [["qqnr/123456", { t: "hello", from: "a" }]]);
  B.close(); assert.ok(!B.alive());
  A.publish("qqnr/123456", { t: "hello", from: "a" }); await wait(20);
  assert.strictEqual(gotB.length, 1);
  A.close();
}
test("公共中转（MQTT）走通这套行为", async () => {
  const W = fakeMqttWorld(); const C = load({ WebSocket: W.WS });
  await sameBehavior((m, d) => C.openBroker(m, d), (m, d) => C.openBroker(m, d));
});
test("自己的 Supabase（broadcast）走通同一套行为；client 不存登录态", async () => {
  const S = fakeSupaWorld(); const C = load();
  const cfg = { url: "https://a.supabase.co", key: ANON };
  const f = C.signalFor(cfg, S.createClient);
  await sameBehavior(f, f);
  assert.strictEqual(S.made[0].key, ANON);
  assert.strictEqual(S.made[0].o.auth.persistSession, false);
  assert.strictEqual(C.signalFor(null), C.openBroker, "没配就走公共中转");
});
test("Supabase：订阅被拒＝打开失败；连好以后频道断了回调 onDrop", async () => {
  const C = load();
  const bad = C.signalFor({ url: "https://a.supabase.co", key: ANON }, fakeSupaWorld({ refuse: true }).createClient);
  const L = await bad(() => {}, () => {});
  await assert.rejects(L.subscribe("t"));
  const S = fakeSupaWorld(); let drops = 0;
  const L2 = await C.signalFor({ url: "https://a.supabase.co", key: ANON }, S.createClient)(() => {}, () => drops++);
  await L2.subscribe("t");
  S.chans.t[0].cb("CLOSED");
  assert.strictEqual(drops, 1); assert.ok(!L2.alive());
});

test("房间号这一步没走通：公共中转失败的提示里有备用路；Supabase 失败说该查什么", async () => {
  const W = fakeMqttWorld({ refuse: true }); const C = load({ WebSocket: W.WS });
  assert.match(C.BROKER_FAIL_TEXT, /自己的 Supabase/);
  let got = "";
  const m1 = C.Mesh({ code: "123456", me: "a", onFail: t => { got = t; } });
  await wait(30); m1.close();
  assert.strictEqual(got, C.BROKER_FAIL_TEXT);
  got = "";
  const m2 = C.Mesh({ code: "123456", me: "a", signal: async () => { throw new Error("x"); }, onFail: t => { got = t; } });
  await wait(30); m2.close();
  assert.strictEqual(got, C.SUPA_FAIL_TEXT);
});

test("界面：没配 Supabase 时开关灰着并说去哪配；加入框认房间号和连接码", () => {
  const app = src.slice(src.indexOf("function NetRoomApp("));
  assert.match(app, /"data-wk": "nrsupaon", disabled: !supa/);
  assert.match(app, /Core\.parseJoin\(joinCode\)/);
  assert.match(app, /signal: s0 \? Core\.signalFor\(s0\) : null/);
  assert.match(app, /sig: s0 \|\| null/, "房间记着走哪条路，重新连上照旧");
  assert.ok(!/service_role|serviceKey|access_token/.test(app.split("\n").filter(l => /packJoin/.test(l)).join("")));
});

test("递名片那一格有「怎么弄？一步一步看」：点开是攻略里那一节，教程只住攻略一份", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/netroom.js"), "utf8");
  assert.ok(src.includes('"怎么弄？一步一步看"') && src.includes('d.indexOf("### 连不上房间号时")'));
  const man = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/assistant-manual.js"), "utf8");
  assert.ok(man.includes("### 连不上房间号时"), "攻略里那一节标题还在（界面按它切）");
});
