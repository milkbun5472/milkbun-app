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
  // 单人开口不另起一条直发；唯一一处 callAI 是「一起说」那一枪（几个人一次写，runProbe 只写一个人）
  assert.strictEqual((src.match(/callAI\(/g) || []).length, 1, "只有一起说那一处直发");
  assert.match(src, /maxTokens: Math\.min\(32000, 12000 \+ 4000 \* mine\.length\)/);
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
  assert.ok(/t: "typing"/.test(src) && /e\.t === "typing"/.test(src), "收发正在输入");
  assert.ok(/finally \{ typing\(false\)/.test(src), "说完或失败都熄灭");
});

test("重新连上：对面补发的话缺的补上、有的不重复、按时间排；等对方时不计时", () => {
  const { C } = load();
  let r = C.upsertRoom({ id: "r1", code: "123456", host: true, msgs: [{ id: "a", ts: 1, side: "me" }, { id: "c", ts: 3, side: "me" }] });
  r = C.mergeMsgs(r, [{ id: "b", ts: 2, side: "peer" }, { id: "c", ts: 3, side: "peer" }]);
  assert.deepStrictEqual(r.msgs.map(m => m.id), ["a", "b", "c"]);
  assert.strictEqual(C.loadRooms()[0].msgs.length, 3);
  assert.ok(/if \(!o\.patient && !o\.host\) clock = setTimeout/.test(src), "重新连上时先不计时");
  assert.ok(/t: "sync"/.test(src) && /e\.t === "sync"/.test(src), "互补漏掉的话");
  assert.ok(/if \(mesh\.current !== m\) return;/.test(src), "旧那一场的回调不再动新房间");
});

test("以前的房间能删；往上翻不被拽回底部", () => {
  const { C } = load();
  C.upsertRoom({ id: "x1", msgs: [] }); C.upsertRoom({ id: "x2", msgs: [] });
  C.removeRoom("x1");
  assert.deepStrictEqual(C.loadRooms().map(r => r.id), ["x2"]);
  assert.ok(!/\[n, tail\]\)/.test(src), "不再拿每次新建的 tail 当依赖");
  assert.ok(/stick\.current \|\|/.test(src), "只在本来就在底部时才跟到底");
});

// ───────────── 第二期：最多四个人 ─────────────
test("旧存档（peerNick / peerChars）读成 peers 里一个人，老消息归 TA；昵称对上时换成真 id", () => {
  const { C, store } = load();
  store.x_netroom = JSON.stringify([{ id: "old", code: "111111", host: true, myNick: "我", peerNick: "她", peerChars: [{ id: "p1", name: "乙" }],
    myChars: [{ id: "a", name: "甲" }], msgs: [{ id: "m1", side: "peer", kind: "user", name: "她", text: "在吗", ts: 1 }, { id: "m2", side: "me", kind: "user", name: "我", text: "在", ts: 2 }] }]);
  const r = C.loadRooms()[0];
  assert.ok(!("peerNick" in r) && !("peerChars" in r));
  assert.deepStrictEqual(r.peers.map(p => [p.peerId, p.nick, p.chars[0].name]), [[C.LEGACY, "她", "乙"]]);
  assert.strictEqual(r.msgs[0].peerId, C.LEGACY);
  assert.strictEqual(C.transcript(r), "她：在吗\n我：在");
  const r2 = C.upsertPeer(r, "realid", "她", []);
  assert.deepStrictEqual(r2.peers.map(p => p.peerId), ["realid"]);
  assert.strictEqual(r2.msgs[0].peerId, "realid");
  // 昵称对不上的是新来的人，不顶替老那位
  assert.strictEqual(C.upsertPeer(r, "x", "别人", []).peers.length, 2);
});

test("谁 offer：每一对只有 peerId 小的那边发；另一边敲门", () => {
  const { C } = load();
  assert.strictEqual(C.shouldOffer("a1", "b2"), true);
  assert.strictEqual(C.shouldOffer("b2", "a1"), false);
  ["k", "m", "z", "c"].forEach(x => ["k", "m", "z", "c"].forEach(y => { if (x !== y) assert.notStrictEqual(C.shouldOffer(x, y), C.shouldOffer(y, x)); }));
  assert.match(src, /if \(shouldOffer\(o\.me, id\)\) offerTo\(id, peerSess\);/);
  assert.match(src, /m\.t === "offer" && !shouldOffer\(o\.me, from\)/);
});

test("满员：算上自己四个人就不放新人，认识的人回来照放", () => {
  const { C } = load();
  assert.strictEqual(C.MAX_PEOPLE, 4);
  assert.strictEqual(C.admit(["a", "b"], "c"), "ok");
  assert.strictEqual(C.admit(["a", "b", "c"], "d"), "full");
  assert.strictEqual(C.admit(["a", "b", "c"], "b"), "ok");
  assert.match(src, /pub\(\{ t: "full", to: from \}\)/);
  assert.match(src, /房间满了/);
});

test("提示词和记忆总结列出每一方和 TA 带来的人", () => {
  const { C } = load();
  const room = { myNick: "我", myChars: [{ id: "a", name: "甲" }], msgs: [{ id: "1", side: "peer", peerId: "p2", kind: "char", name: "丁", text: "好", ts: 1 }],
    peers: [{ peerId: "p1", nick: "小红", chars: [{ id: "x", name: "乙" }] }, { peerId: "p2", nick: "小蓝", chars: [{ id: "y", name: "丁" }] }, { peerId: "p3", nick: "小绿", chars: [] }] };
  const ins = C.lineInstruction(room, { id: "a", name: "甲" });
  assert.match(ins, /一共 4 个人/);
  assert.match(ins, /小红，TA 带来的是：乙/); assert.match(ins, /小蓝，TA 带来的是：丁/); assert.match(ins, /小绿，没带人/);
  assert.match(ins, /丁（小蓝 带来的）：好/);
  const mem = C.memoryInstruction(room, { id: "a", name: "甲" });
  assert.match(mem, /小红、小蓝、小绿/);
});

test("谁离开只标 TA：其他人照样通着；直连不上的由别人转", () => {
  const { C } = load();
  // 我(m)直连 a、b；b 报自己连着 m、c → c 经 b 转得到
  assert.deepStrictEqual(C.reachable("m", ["a", "b"], { b: ["m", "c"] }).sort(), ["a", "b", "c"]);
  // a 走了：只少 a
  assert.deepStrictEqual(C.reachable("m", ["b"], { b: ["m", "c"] }).sort(), ["b", "c"]);
  // 转发：只转给跟说话人没直连的
  assert.deepStrictEqual(C.forwardTargets(["a", "b", "c"], "a", "a", { b: ["a"], c: [] }), ["c"]);
  assert.match(src, /e\.t === "bye"/);
  assert.match(src, /和 TA 连不上/);
});

test("补发别人的话：by 认人，我自己说的回到我这边", () => {
  const { C } = load();
  assert.strictEqual(C.syncedMsg({ id: "1", text: "x", by: "me1" }, "me1", "p").side, "me");
  const m = C.syncedMsg({ id: "2", text: "y", by: "p3" }, "me1", "p");
  assert.strictEqual(m.side, "peer"); assert.strictEqual(m.peerId, "p3");
  assert.strictEqual(C.syncedMsg({ id: "3", text: "z" }, "me1", "p").peerId, "p");
});

test("重新连上直接回到房间页（输入框在），不停在等人那页", () => {
  const i = src.indexOf("const start = (host, resume) =>"), j = src.indexOf("const cancelWait", i);
  assert.ok(i > 0 && j > i);
  const body = src.slice(i, j);
  assert.match(body, /if \(base\) \{ commit\(Core\.patchRoom\(base, \{ endedAt: 0 \}\)\); entered\.current = true; setPage\("chat"\); \}/);
  // 外壳收任意几块：房间页传了顶栏/有谁/记录/重新连上/输入区五块，不许只收前三块把输入区丢掉
  assert.match(src, /const shell = \(\.\.\.parts\) =>/);
  // 房间页里输入框一直渲染着，没人在线只是灰掉
  assert.match(src, /h\(Composer, \{ onSend: sayHuman, disabled: alone,/);
});

test("面具跟着角色走：按 TA 认的那张面具名字称呼你，昵称不一样时说清是同一个人", () => {
  const { C } = load();
  const room = { id: "m1", myNick: "小雨", peers: [], myChars: [{ id: "a", name: "甲" }], msgs: [] };
  const t1 = C.lineInstruction(room, { id: "a", name: "甲", you: "阿梨" });
  assert.ok(t1.includes("带你来的是 阿梨（你认识的 阿梨 在这个房间里用的名字是「小雨」"));
  const t2 = C.lineInstruction(room, { id: "a", name: "甲", you: "小雨" });
  assert.ok(t2.includes("带你来的是 小雨") && !t2.includes("你认识的"));
  assert.ok(C.memoryInstruction(room, { id: "a", name: "甲", you: "阿梨" }).includes("阿梨 带你进联机房间"));
});

// ── ＋ 面板那些消息（2026-11-22）──
const IMG = "data:image/jpeg;base64," + "A".repeat(500);
test("每种新消息上线只带该带的字段：人设、本机引用、多塞的字段都不出去", () => {
  const { C } = load();
  const w = (type, x) => C.wireMsg({ id: "1", kind: "user", name: "小雨", type, x, ts: 1 });
  assert.deepStrictEqual(Object.keys(w("emote", { keyword: "哭", url: "iv_abc", img: IMG, persona: "x" }).x).sort(), ["img", "keyword"]);
  assert.deepStrictEqual(w("photo", { desc: "猫", imageRef: "iv_1", img: IMG, memory: "x" }).x, { desc: "猫", img: IMG });
  assert.deepStrictEqual(w("geo", { name: "公园", lat: 1 }).x, { name: "公园" });
  assert.deepStrictEqual(w("pat", { to: "阿梨", extra: 1 }).x, { to: "阿梨" });
  assert.deepStrictEqual(Object.keys(w("voice", { content: "嗨", dur: 3, voiceId: "v" }).x).sort(), ["content", "dur"]);
  assert.deepStrictEqual(Object.keys(w("namecard", { name: "甲", avatar: IMG, persona: "人设", memLib: [1], worldbook: "w" }).x).sort(), ["avatar", "color", "emoji", "name"]);
  assert.deepStrictEqual(Object.keys(w("file", { name: "a.txt", text: "x".repeat(20000), chars: 20000, path: "/u" }).x).sort(), ["chars", "cut", "name", "size", "text"]);
  assert.strictEqual(w("file", { name: "a.txt", text: "x".repeat(20000) }).x.text.length, C.FILE_TEXT_MAX || 12000);
  assert.deepStrictEqual(Object.keys(w("rp", { rpId: "r", total: 5, count: 2, message: "", claims: [], splits: [1, 4] }).x).sort(), ["claims", "count", "message", "rpId", "total"]);
  // 落存档那一份：不留整张图，只留本机引用
  const loc = C.wireMsg({ id: "1", type: "photo", x: { desc: "猫", imageRef: "iv_1", img: IMG } }, true);
  assert.deepStrictEqual(loc.x, { desc: "猫", imageRef: "iv_1" });
  // 红包怎么拆只在发的那台手机：splits 绝不上线，也不在消息里
  assert.match(src, /rpSplits: Object\.assign\(\{\}, roomRef\.current\.rpSplits/);
});

test("transcript 里每种都有能读的一行；时间戳照单聊那种；撤回不给原文；进出房间一行", () => {
  const { C } = load();
  const m = (o) => Object.assign({ id: Math.random() + "", kind: "user", side: "me", ts: 1000 }, o);
  const room = { myNick: "小雨", peers: [{ peerId: "p", nick: "阿梨", chars: [] }], msgs: [
    m({ type: "photo", x: { desc: "一只猫" } }), m({ type: "emote", x: { keyword: "开心" } }), m({ type: "voice", x: { content: "到了" } }),
    m({ type: "geo", x: { name: "西湖" } }), m({ type: "pat", name: "小雨", x: { to: "阿梨" } }),
    m({ type: "rp", x: { rpId: "r", count: 2, message: "发财", claims: [{ key: "p|", name: "阿梨", amount: 1.2 }] } }),
    m({ type: "poll", x: { title: "吃啥", options: [{ text: "面", voters: ["阿梨"] }, { text: "饭", voters: [] }] } }),
    m({ type: "namecard", x: { name: "沈某" } }), m({ type: "file", x: { name: "a.txt", chars: 3, text: "abc" } }),
    m({ text: "秘密原文", recalled: true }), C.sysMsg("阿梨 离开了房间", 1000) ] };
  const tx = C.transcript(room, { stamp: ts => "今天10:00" });
  ["[照片] 一只猫", "[表情] 开心", "[语音] 到了", "[位置] 西湖", "小雨 拍了拍 阿梨", "[红包] 发财", "阿梨 抢到 1.2", "[投票] 吃啥：面（阿梨）", "[名片] 沈某", "[文件] a.txt", "abc", "撤回了一条消息", "（阿梨 离开了房间）", "〔今天10:00〕"]
    .forEach(s => assert.ok(tx.includes(s), "缺：" + s));
  assert.ok(!tx.includes("秘密原文"));
  assert.ok(C.transcript(room).indexOf("〔") < 0, "不给 stamp 就不标时间");
});

test("在线状态进提示词；离最后一条过去多久写上；能做的事（表情/拍/投票）按房里现有的写", () => {
  const { C } = load();
  const room = { myNick: "小雨", peers: [{ peerId: "p", nick: "阿梨", chars: [] }, { peerId: "q", nick: "老周", chars: [] }], myChars: [{ id: "a", name: "甲" }],
    msgs: [{ id: "1", kind: "user", side: "peer", peerId: "p", type: "poll", x: { pollId: "pl", title: "吃啥", options: [{ text: "面", voters: [] }, { text: "饭", voters: [] }] }, ts: 1 }] };
  const tx = C.lineInstruction(room, { id: "a", name: "甲" }, { presence: { p: "on", q: "off" }, now: 3 * 3600e3, emotes: ["哭哭"], targets: ["阿梨"] });
  assert.ok(tx.includes("阿梨，没带人（此刻在房里）"));
  assert.ok(tx.includes("老周，没带人（已经离开了房间，听不到房里说的话）"));
  assert.ok(tx.includes("已经过去 3 小时"));
  assert.ok(tx.includes("哭哭") && tx.includes("\"pat\"") && tx.includes("投票「吃啥」"));
});

test("大的一条拆片再拼回来；缺片不交；图超上限不上线", () => {
  const { C } = load();
  const raw = "字".repeat(C.CHUNK * 2 + 5);
  const parts = C.splitRaw(raw, C.CHUNK);
  assert.strictEqual(parts.length, 3);
  assert.ok(parts.every(p => p.length <= C.CHUNK));
  const J = C.Joiner(60000);
  assert.strictEqual(J("o|1", 2, 3, parts[2], 1), null);
  assert.strictEqual(J("o|1", 0, 3, parts[0], 1), null);
  assert.strictEqual(J("o|1", 1, 3, parts[1], 1), raw);
  assert.strictEqual(J("o|2", 5, 3, "x", 1), null, "序号越界不收");
  const big = "data:image/jpeg;base64," + "A".repeat(C.IMG_MAX.photo + 1);
  assert.ok(!C.wireMsg({ id: "1", type: "photo", x: { desc: "", img: big } }).x.img);
  assert.ok(C.IMG_MAX.photo < 200000 && C.IMG_MAX.emote < C.IMG_MAX.photo);
  // 发的那头超过一片就拆
  assert.match(src, /raw\.length > Core\.CHUNK \? Core\.splitRaw\(raw, Core\.CHUNK\)/);
});

test("未知类型不崩：显示成那一行字；不认得的 t 不理", () => {
  const { C } = load();
  const w = C.wireMsg({ id: "1", kind: "user", text: "[新玩意] 一行字", type: "hologram", x: { a: 1 } });
  assert.strictEqual(w.type, undefined); assert.strictEqual(w.text, "[新玩意] 一行字");
  assert.strictEqual(C.wireMsg({ id: "2", type: "photo", x: null, text: "t" }).type, undefined);
  assert.match(src, /别的 t（以后的新版本发来的）：不认得就不理/);
});

test("红包：按先后发下一份，同一人只能抢一次，领完就没了", () => {
  const { C } = load();
  let x = { rpId: "r", total: 3, count: 2, claims: [] };
  const sp = [1, 2];
  let g = C.grabRp(x, sp, { key: "p|", name: "阿梨" }); assert.strictEqual(g.amount, 1); x = g.x;
  assert.strictEqual(C.grabRp(x, sp, { key: "p|", name: "阿梨" }).reason, "claimed");
  g = C.grabRp(x, sp, { key: "p|c1", name: "甲" }); assert.strictEqual(g.amount, 2); x = g.x;
  assert.strictEqual(C.grabRp(x, sp, { key: "q|", name: "老周" }).reason, "empty");
  assert.strictEqual(C.grabRp(x, null, { key: "z", name: "z" }).reason, "gone", "不是发的那台手机没有 splits，算不了");
  // 只有发红包那个人报的名单才认
  assert.match(src, /x\.type === "rp" && x\.side === "peer" && x\.peerId === origin/);
});

test("投票改票、请示要除递的人都投完才结案", () => {
  const { C } = load();
  let x = { options: [{ text: "准", voters: [] }, { text: "驳", voters: [] }], ask: { what: "买猫" } };
  x = C.votePoll(x, 0, "甲"); x = C.votePoll(x, 1, "甲");
  assert.deepStrictEqual(x.options.map(o => o.voters), [[], ["甲"]]);
  assert.strictEqual(C.votePoll(x, 9, "乙"), x);
  assert.strictEqual(C.askResult(x, 2), null);
  x = C.votePoll(x, 0, "乙"); x = C.votePoll(x, 0, "丙");
  assert.strictEqual(C.askResult(x, 3).status, "approved");
});

test("改字、撤回只认发这条的那一端；删除只删本机不外发", () => {
  const { C } = load();
  const room = { msgs: [{ id: "a", side: "me", kind: "user", text: "打措了" }, { id: "b", side: "peer", peerId: "p", kind: "char", text: "TA 的话" }] };
  assert.strictEqual(C.editMsg(room, "a", "打错了", "me").msgs[0].text, "打错了");
  assert.ok(C.editMsg(room, "a", "打错了", "me").msgs[0].edited);
  assert.strictEqual(C.editMsg(room, "a", "冒名", "p"), room, "别人不能改我的");
  assert.strictEqual(C.editMsg(room, "b", "冒名", "q"), room, "第三个人不能改 p 的");
  assert.strictEqual(C.editMsg(room, "b", "改", "p").msgs[1].text, "改");
  const rc = C.recallMsg(room, "b", "p");
  assert.ok(rc.msgs[1].recalled && !rc.msgs[1].text);
  assert.strictEqual(C.recallMsg(room, "b", "me"), room);
  assert.ok(!C.transcript(Object.assign({ peers: [{ peerId: "p", nick: "阿梨" }] }, rc)).includes("TA 的话"));
  assert.strictEqual(C.wireMsg(rc.msgs[1]).text, "", "撤回的补发出去也不带原文");
  assert.deepStrictEqual(C.dropMsg(room, "a").msgs.map(m => m.id), ["b"]);
  const i = src.indexOf("const dropLocal = "), j = src.indexOf("\n", i);
  assert.ok(i > 0 && !/send\(/.test(src.slice(i, j)), "删除不外发");
  assert.match(src, /Core\.editMsg\(r, String\(e\.id\), e\.text, origin\)/);
});

test("重新说：同一轮整轮换掉放回原处；只认那一轮本来是 TA 那边角色说的", () => {
  const { C } = load();
  const room = { msgs: [{ id: "1", text: "前" }, { id: "2", turnId: "t", text: "旧1" }, { id: "3", turnId: "t", text: "旧2" }, { id: "4", text: "后" }] };
  const r = C.replaceTurn(room, "t", [{ id: "5", text: "新" }]);
  assert.deepStrictEqual(r.msgs.map(m => m.text), ["前", "新", "后"]);
  assert.strictEqual(r.msgs[1].turnId, "t");
  assert.match(src, /olds\.some\(x => !\(x\.side === "peer" && x\.peerId === origin && x\.kind === "char"\)\)/);
});

test("角色开口跟单聊同一份料：ctxFor(chat) + runProbe(voice) 的 buildBundle，带时间戳、在线状态、表情清单", () => {
  const i = src.indexOf("const speak = async (c, rerollId) =>"), j = src.indexOf("const flipTurn", i);
  assert.ok(i > 0 && j > i);
  const body = src.slice(i, j);
  assert.match(body, /props\.ctxFor\(char, \{ chat: true, roomText \}\)/);
  assert.match(body, /runProbe\(p, ctx, \{ voice: true/);
  assert.match(body, /stamp: props\.stampFor/);
  assert.match(body, /presence: presence\(\)/);
  assert.match(body, /emotes: emotes\.map/);
  const app = read("js/app.js");
  assert.match(app, /stampFor: \(charId, ts\) => aiStampFor\(charId, ts\)/);
  assert.match(app, /emoteFor: \(charId, kw\) => emoteMatch\(emotesForChar\(charId\), kw\)/);
});

test("记进记忆用第三人称，点名角色和她", () => {
  const { C } = load();
  const t = C.memoryInstruction({ id: "m", myNick: "小雨", peers: [], myChars: [], msgs: [] }, { id: "a", name: "甲", you: "阿梨" });
  assert.ok(t.includes("写成第三人称") && t.includes("「甲」和「阿梨」") && !t.includes("你的第一人称"));
  assert.ok(src.includes('1~3 句，第三人称'));
});

// ── 一起说（她 2026-11-22「有俩角色带进来的时候能让他们同时一个调用都说吗，跟群里一样」）──
test("一起说：只在自己带了两个以上的人时出现，一次 callAI", () => {
  const i = src.indexOf("const speakTogether = async"), j = src.indexOf("const redo = ", i);
  assert.ok(i > 0 && j > i, "抠不出 speakTogether");
  const body = src.slice(i, j);
  assert.strictEqual((body.match(/callAI\(/g) || []).length, 1, "整次只打一枪");
  assert.ok(!/runProbe\(/.test(body), "不是一人一枪");
  assert.match(body, /mine\.length < 2/);
  assert.match(src, /myChars\.length > 1 && props\.castFor && h\("button", \{ "data-wk": "nrtogether"/);
});

test("一起说：输出里不在这次名单上的名字整条丢掉（别人带来的角色、真人都不行）", () => {
  const { C } = load();
  const chars = [{ id: "a", name: "甲" }, { id: "b", name: "乙", remark: "小乙" }];
  const raw = JSON.stringify([{ name: "甲", text: "早" }, { name: "丙", text: "我是别人带来的" }, { name: "小乙", text: "嗯", emote: "开心" }, { name: "莉莎", text: "替真人说" }, { name: "甲", text: "" }]);
  const got = C.jointLines(raw, chars, "莉莎");
  assert.deepStrictEqual(got.map(x => [x.char.id, x.text, x.emote]), [["a", "早", ""], ["b", "嗯", "开心"]]);
});

test("一起说：认人和解析走群聊那套公共函数，成员那段由 app 用群聊拼法递进来", () => {
  const i = src.indexOf("function jointLines("), j = src.indexOf("function memoryInstruction(", i);
  assert.ok(i > 0 && j > i);
  const jl = src.slice(i, j);
  ["parseJSONLoose", "salvageGroupLines", "pickMember", "GroupIdentityGuard"].forEach(f => assert.ok(jl.includes(f), "没走 " + f));
  const k = src.indexOf("function jointInstruction("), ji = src.slice(k, i);
  ["groupBans", "GROUP_MULTI_BUBBLE", "sidesLines", "transcript"].forEach(f => assert.ok(ji.includes(f), "没走 " + f));
  const app = read("js/app.js");
  const a = app.indexOf('screen === "netroom"'), b = app.indexOf('screen === "zhaoying"', a);
  assert.ok(a > 0 && b > a);
  const pr = app.slice(a, b);
  ["castFor:", "groupNowSegs(", "memberPrivateContextFor(", "groupMemSplit(", "groupRelLines(", "groupPersonaText(", "memberLabel("].forEach(f => assert.ok(pr.includes(f), "props 里没走 " + f));
});

test("一起说：房间那一层照单人那份（几方、面具、记录），料全在 system", () => {
  const { C } = load();
  const room = { id: "r", myNick: "莉莎", myChars: [{ id: "a", name: "甲" }, { id: "b", name: "乙" }], peers: [{ peerId: "p1", nick: "阿柚", chars: [{ name: "丙" }] }],
    msgs: [{ id: "1", side: "peer", peerId: "p1", kind: "char", name: "丙", text: "你们好", ts: 1 }] };
  const s = C.jointInstruction(room, [{ id: "a", name: "甲", you: "小莉", emotes: ["开心"] }, { id: "b", name: "乙" }], { cast: "【成员】CAST", targets: ["阿柚"] });
  assert.match(s, /CAST/);
  assert.match(s, /丙（阿柚 带来的）：你们好/);
  assert.match(s, /只能是 甲 \/ 乙 之一/);
  assert.match(s, /你认识的 小莉 在这个房间里用的名字是「莉莎」/);
  assert.match(s, /甲：开心/);
  assert.ok(src.includes('[{ role: "user", content: "接着房里的话往下说。" }]'));
});

test("一起说：整次一个 turnId，重新说整批重来", () => {
  assert.match(src, /const redo = m => \{/);
  const i = src.indexOf("const redo = m =>"), body = src.slice(i, i + 300);
  assert.match(body, /speakTogether\(j, m\.turnId\)/);
  assert.match(src, /else if \(act === "reroll"\) redo\(m\);/);
});

test("世界书拿房间里的话去触发；一起说也带世界书和线上预设", () => {
  assert.ok(src.includes("props.ctxFor(char, { chat: true, roomText })"), "单人开口把房间里的话交去匹配世界书");
  const app = read("js/app.js");
  const i = app.indexOf('screen === "netroom"'), seg = app.slice(i, app.indexOf('screen === "zhaoying"', i));
  assert.ok(/c\.worldbook = loreForContext\("chat", \[char\.id\], o\.roomText/.test(seg));
  assert.ok(/lore = loreForContext\("chat", people\.map/.test(seg) && /onlinePresetBlock\(pr\)/.test(seg));
});
