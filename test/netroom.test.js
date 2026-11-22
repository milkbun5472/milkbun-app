// 联机房间第一期（2026-11-22）：MQTT 帧、只发名字头像、消息存取、退出时记忆勾选
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js");

// 存档桩：照写入方 saveJSON(STORE_KEY, …) 那一处（netroom.js 的 saveRooms）
function load() {
  const store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  new Function("window", "loadJSON", "saveJSON", src)(w, w.loadJSON, w.saveJSON);
  return { C: w.NetRoomCore, store };
}

test("存档写的是 x_ 键（进 IDB 文字库），不直连 localStorage", () => {
  const { C } = load();
  assert.strictEqual(C.STORE_KEY, "x_netroom");
  assert.match(src, /function saveRooms\(list\) \{ saveJSON\(STORE_KEY,/);
  assert.ok(!/localStorage/.test(src.split("\n").map(l => l.split("//")[0]).join("\n")), "不许直连 localStorage");
});

test("MQTT：CONNECT / SUBSCRIBE / PUBLISH / PINGREQ 编码对得上 3.1.1", () => {
  const { C } = load();
  const c = C.mqtt.connect("ab", 30);
  assert.deepStrictEqual(Array.from(c), [0x10, 14, 0, 4, 77, 81, 84, 84, 4, 2, 0, 30, 0, 2, 97, 98]);
  const s = C.mqtt.subscribe(1, "t/1");
  assert.deepStrictEqual(Array.from(s), [0x82, 8, 0, 1, 0, 3, 116, 47, 49, 0]);
  assert.deepStrictEqual(Array.from(C.mqtt.ping()), [0xC0, 0]);
  const p = C.mqtt.publish("t", "hi");
  assert.deepStrictEqual(Array.from(p), [0x30, 5, 0, 1, 116, 104, 105]);
});

test("MQTT：长包的剩余长度走多字节，拆包能跨段拼回来", () => {
  const { C } = load();
  const big = "x".repeat(300);
  const pk = C.mqtt.publish("room/1", big);
  assert.strictEqual(pk[1] & 128, 128, "300 多字节要用两字节长度");
  const feed = C.mqtt.decoder();
  assert.deepStrictEqual(feed(pk.slice(0, 50)), []);
  const out = feed(Uint8Array.from([...pk.slice(50), 0x20, 2, 0, 0, 0xD0, 0]));
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].type, 3);
  assert.strictEqual(out[0].topic, "room/1");
  assert.strictEqual(out[0].payload, big);
  assert.strictEqual(out[1].type, 2); assert.strictEqual(out[1].code, 0);
  assert.strictEqual(out[2].type, 13);
});

test("房间号 6 位数字；topic 带固定前缀", () => {
  const { C } = load();
  for (let i = 0; i < 50; i++) assert.ok(C.validCode(C.newCode()));
  assert.ok(!C.validCode("12345")); assert.ok(!C.validCode("12a456"));
  assert.strictEqual(C.topicOf("123456"), C.TOPIC_PREFIX + "/123456");
  assert.ok(C.TOPIC_PREFIX.length >= 10);
});

test("发给对方的名片只有名字和小头像：人设、记忆、世界书一个字段都不带", () => {
  const { C } = load();
  const char = { id: "c1", name: "陆闻", persona: "人设全文", memory: "长期记忆", lore: "世界书", avatarImage: "iv_1", greeting: "开场白", avatarEmoji: "🐱", color: "#aabbcc" };
  const card = C.cardOf(char, "data:image/jpeg;base64,AAAA");
  assert.deepStrictEqual(Object.keys(card).sort(), ["avatar", "color", "emoji", "id", "name"]);
  const s = JSON.stringify(card);
  ["人设全文", "长期记忆", "世界书", "开场白", "iv_1"].forEach(x => assert.ok(s.indexOf(x) < 0, x));
  // 不是 dataURL 的头像（原图地址/仓库键）一律不发
  assert.strictEqual(C.cardOf(char, "https://x/y.png").avatar, "");
  // 收到的名片多塞了东西，这边照样只收那几样
  assert.deepStrictEqual(Object.keys(C.cleanCard(Object.assign({ persona: "x" }, card))).sort(), ["avatar", "color", "emoji", "id", "name"]);
  // 进房那一下发出去的就是这份名片
  assert.match(src, /cards\.push\(Core\.cardOf\(c, await smallAvatar\(c\)\)\)/);
  assert.match(src, /send\(\{ t: "hi", nick: myNick\(\), chars: cards \}\)/);
  assert.match(src, /const AVATAR_PX = 64;/);
});

test("消息存取：两边各存一份，同 id 不重复，对面的话标 peer", () => {
  const { C, store } = load();
  const r = C.upsertRoom({ id: "nr_1", code: "123456", myNick: "我", peerNick: "她", myChars: [{ id: "c1", name: "陆闻" }], peerChars: [], msgs: [], remembered: {} });
  let cur = C.addMsg(r, Object.assign(C.wireMsg({ id: "m1", kind: "user", name: "我", text: "你好", ts: 1 }), { side: "me" }));
  cur = C.addMsg(cur, Object.assign(C.wireMsg({ id: "m2", kind: "char", name: "乙", charId: "p1", text: "嗨", ts: 2, persona: "不该带" }), { side: "peer" }));
  cur = C.addMsg(cur, Object.assign(C.wireMsg({ id: "m2", kind: "char", name: "乙", charId: "p1", text: "嗨", ts: 2 }), { side: "peer" }));
  assert.strictEqual(cur.msgs.length, 2);
  const back = C.loadRooms()[0];
  assert.strictEqual(back.msgs.length, 2);
  assert.ok(!("persona" in back.msgs[1]));
  assert.ok(store.x_netroom);
  const tx = C.transcript(Object.assign({}, back, { peerNick: "她" }));
  assert.match(tx, /^我：你好\n乙（她 带来的）：嗨$/);
});

test("退出那张卡：只记勾上的、只记自己带来的", () => {
  const { C } = load();
  const mine = [{ id: "a", name: "甲" }, { id: "c", name: "丙" }];
  assert.deepStrictEqual(C.memoryTargets(mine, {}), []);
  assert.deepStrictEqual(C.memoryTargets(mine, { a: true, c: false }), ["a"]);
  assert.deepStrictEqual(C.memoryTargets(mine, { a: true, c: true, p1: true }), ["a", "c"]);
  // 记忆走宿主的公共那一处，不在模块里另写一份
  const app = read("js/app.js");
  assert.match(app, /screen === "netroom"\)[\s\S]{0,900}onAddMemory: \(text, charId\) => keepWhereItHappened\(/);
  assert.match(src, /props\.onAddMemory && props\.onAddMemory\(text, char\.id\)/);
});

test("角色开口走 runProbe(voice)、料在 system、maxTokens 不低于 8000", () => {
  assert.match(src, /runProbe\(p, props\.ctxFor\(char\), \{ voice: true, tag: "netroom",/);
  const n = [...src.matchAll(/maxTokens: (\d+)/g)].map(m => +m[1]);
  assert.ok(n.length >= 2 && n.every(x => x >= 8000), String(n));
  assert.ok(!/callAI\(/.test(src), "不另起一条直发");
  const { C } = load();
  const ins = C.lineInstruction({ myNick: "我", peerNick: "她", myChars: [{ id: "a", name: "甲" }], peerChars: [{ id: "p", name: "乙" }], msgs: [] }, { id: "a", name: "甲" });
  assert.match(ins, /乙/);
});

test("不引第三方库、不下载代码；入口挂在一起玩", () => {
  assert.ok(!/import\s*\(|<script|unpkg|jsdelivr|cdnjs/.test(src));
  const comp = read("js/components.js");
  assert.match(comp, /netroom: \{ kind: "app", zh: "联机", G: FG\("netroom", GNetRoom\) \}/);
  assert.match(comp, /\["NetRoomApp", "netroom", "联机"\]/);
  assert.match(read("index.html"), /data-lazy="netroom" data-src="js\/netroom\.js\?v=/);
});

test("角色一次能连发几条：say 数组拆成几个气泡，老的 text 也认", () => {
  const { C } = load();
  assert.deepStrictEqual(C.sayLines({ say: ["嗯", " 你们好 ", ""] }), ["嗯", "你们好"]);
  assert.deepStrictEqual(C.sayLines({ text: "第一句\n\n第二句" }), ["第一句", "第二句"]);
  assert.deepStrictEqual(C.sayLines({}), []);
});

test("带上最近单聊只在勾了的人身上；对面看得到正在输入", () => {
  assert.ok(/c\.recent \? ctx0 : Object\.assign\(\{\}, ctx0, \{ recentChat: "", pastOffline: "" \}\)/.test(src), "没勾的不带单聊");
  assert.ok(/recent: !!withChat\[c\.id\]/.test(src), "勾选记在 myChars 上");
  assert.ok(/t: "typing"/.test(src) && /m\.t === "typing"/.test(src), "收发正在输入");
  assert.ok(/finally \{ typing\(false\)/.test(src), "说完或失败都熄灭");
});

test("重新连上：对面补发的话缺的补上、有的不重复、按时间排；等对方时不计时", () => {
  const { C } = load();
  let r = C.upsertRoom({ id: "r1", code: "123456", host: true, msgs: [{ id: "a", ts: 1, side: "me" }, { id: "c", ts: 3, side: "me" }] });
  r = C.mergeMsgs(r, [{ id: "b", ts: 2, side: "peer" }, { id: "c", ts: 3, side: "peer" }]);
  assert.deepStrictEqual(r.msgs.map(m => m.id), ["a", "b", "c"]);
  assert.strictEqual(C.loadRooms()[0].msgs.length, 3);
  assert.ok(/if \(!o\.patient\) startClock\(\)/.test(src), "重新连上时先不计时");
  assert.ok(/t: "sync"/.test(src) && /m\.t === "sync"/.test(src), "两边互补漏掉的话");
  assert.ok(/if \(chan\.current === ch\) setGone\(true\)/.test(src), "旧线关掉不误报离开");
});

test("以前的房间能删；往上翻不被拽回底部", () => {
  const { C } = load();
  C.upsertRoom({ id: "x1", msgs: [] }); C.upsertRoom({ id: "x2", msgs: [] });
  C.removeRoom("x1");
  assert.deepStrictEqual(C.loadRooms().map(r => r.id), ["x2"]);
  assert.ok(!/\[n, tail\]\)/.test(src), "不再拿每次新建的 tail 当依赖");
  assert.ok(/stick\.current \|\|/.test(src), "只在本来就在底部时才跟到底");
});
