// 联机房间（第一期，她 2026-11-21 设计单「一」那一行）
// 两个人、房间号、各带几个自己的角色、手动点谁开口、文字消息、退出时勾要不要记进记忆。
//
// 怎么连：开房的人拿到 6 位房间号；两边借一个公共的免费中转节点（MQTT over WebSocket）
//   交换一次 WebRTC 的「怎么连我」（offer/answer，等 ICE 收齐整包发，不做 trickle），
//   连上以后立刻断开中转，之后的消息只在两台手机之间走（RTCDataChannel）。
//   不引第三方库：MQTT 那几种帧（CONNECT/SUBSCRIBE/PUBLISH QoS0/PINGREQ）这里自己编解码。
//
// 发给对方的只有：昵称、带来的角色的【名字和小头像】（≤64px）、房间里说的话。
//   人设、记忆、世界书一个字都不出这台手机（cardOf 只挑那几样字段，测试钉着）。
// 角色开口用的是【自己手机】的线路：runProbe(apiFor(id), ctxFor(char), { voice: true })——
//   buildBundle 那一整份（人设全文/心情/好感/记忆/反八股）白得，房间记录作为料放进 system。
// 聊天记录两边各存一份：x_netroom（x_ 键自动进 IDB 文字库，见 no-small-warehouse.md）。
// 记进记忆：退出时一人一格勾选；勾了的照「一起看」那条路——TA 用第一人称浓缩一两句，
//   交给宿主的 onAddMemory（app.js 的 keepWhereItHappened）落库。不勾什么都不留，历史里能补记。
(function (root) {
  "use strict";

  // ───────────── 纯逻辑（测试直接调这一段） ─────────────
  // 中转节点：按顺序试，前一个连不上换下一个
  const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://test.mosquitto.org:8081"];
  // topic 前缀：一段固定的随机串，免得跟公共节点上别人的 6 位数撞在一起
  const TOPIC_PREFIX = "qqnr-7f3k9q2xw4";
  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.qq.com:3478" },
    { urls: "stun:stun.miwifi.com:3478" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];
  const CONNECT_TIMEOUT = 20000;
  const FAIL_TEXT = "你们的网络直连不上，试试两边都换成 Wi-Fi 再开一次";
  const STORE_KEY = "x_netroom";
  const AVATAR_PX = 64;

  const utf8 = s => new TextEncoder().encode(String(s));
  const unutf8 = b => new TextDecoder().decode(b);
  function concat(parts) {
    let n = 0; parts.forEach(p => { n += p.length; });
    const out = new Uint8Array(n); let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  // MQTT 剩余长度：每字节 7 位，最高位表示「后面还有」
  function encLen(n) {
    const out = [];
    do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0);
    return Uint8Array.from(out);
  }
  function str(s) { const b = utf8(s); return concat([Uint8Array.from([b.length >> 8, b.length & 255]), b]); }
  function packet(first, body) { return concat([Uint8Array.from([first]), encLen(body.length), body]); }
  const mqtt = {
    connect(clientId, keepAlive) {
      const ka = keepAlive || 30;
      // 协议名 MQTT、级别 4（3.1.1）、clean session、心跳秒数，然后是 clientId
      return packet(0x10, concat([Uint8Array.from([0, 4, 77, 81, 84, 84]), Uint8Array.from([4, 0x02, ka >> 8, ka & 255]), str(clientId)]));
    },
    subscribe(id, topic) { return packet(0x82, concat([Uint8Array.from([id >> 8, id & 255]), str(topic), Uint8Array.from([0])])); },
    publish(topic, payload) { return packet(0x30, concat([str(topic), typeof payload === "string" ? utf8(payload) : payload])); },
    ping() { return Uint8Array.from([0xC0, 0]); },
    disconnect() { return Uint8Array.from([0xE0, 0]); },
    // 流式拆包：喂进来一段字节，吐出完整的包，剩下半截留着等下一段
    decoder() {
      let buf = new Uint8Array(0);
      return function feed(chunk) {
        buf = concat([buf, chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)]);
        const out = [];
        for (;;) {
          if (buf.length < 2) break;
          let mul = 1, len = 0, i = 1, b;
          do {
            if (i >= buf.length) { len = -1; break; }
            b = buf[i++]; len += (b & 127) * mul; mul *= 128;
          } while (b & 128);
          if (len < 0 || buf.length < i + len) break;
          const type = buf[0] >> 4, flags = buf[0] & 15, body = buf.slice(i, i + len);
          buf = buf.slice(i + len);
          const pk = { type, flags, body };
          if (type === 2) pk.code = body[1];                    // CONNACK
          if (type === 3) {                                     // PUBLISH
            const tl = (body[0] << 8) | body[1];
            pk.topic = unutf8(body.slice(2, 2 + tl));
            const qos = (flags >> 1) & 3;
            pk.payload = unutf8(body.slice(2 + tl + (qos ? 2 : 0)));
          }
          out.push(pk);
        }
        return out;
      };
    }
  };

  const topicOf = code => TOPIC_PREFIX + "/" + String(code);
  function newCode(rand) {
    const r = rand || Math.random;
    let s = ""; for (let i = 0; i < 6; i++) s += Math.floor(r() * 10);
    return s;
  }
  const validCode = c => /^\d{6}$/.test(String(c || "").trim());

  // 发给对方的角色名片：只这几样。人设、记忆、世界书、设定、关系……一样不带。
  function cardOf(char, avatar) {
    return { id: String(char.id), name: String(char.remark || char.name || "").slice(0, 40),
      avatar: typeof avatar === "string" && /^data:image\//.test(avatar) && avatar.length < 40000 ? avatar : "",
      emoji: char.avatarEmoji ? String(char.avatarEmoji).slice(0, 8) : "",
      color: /^#[0-9a-f]{3,8}$/i.test(String(char.color || "")) ? char.color : "" };
  }
  // 收到的名片也照这几样过一遍：对面多塞了什么，这边一样不收
  const cleanCard = c => cardOf({ id: c && c.id, name: c && c.name, avatarEmoji: c && c.emoji, color: c && c.color }, c && c.avatar);
  // 线上走的一条消息：也只这几样
  function wireMsg(m) {
    return { id: String(m.id), kind: m.kind === "char" ? "char" : "user", name: String(m.name || "").slice(0, 40),
      charId: m.kind === "char" ? String(m.charId || "") : "", text: String(m.text || "").slice(0, 8000), ts: Number(m.ts) || Date.now() };
  }
  // 存档：[{ id, code, host, startedAt, endedAt, myNick, peerNick, myChars:[{id,name}], peerChars:[card], msgs:[], remembered:{charId:ts} }]
  function loadRooms() { try { const v = loadJSON(STORE_KEY, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function saveRooms(list) { saveJSON(STORE_KEY, (list || []).slice(0, 60)); }
  function upsertRoom(room) {
    try { const list = loadRooms().filter(r => r.id !== room.id); list.unshift(room); saveRooms(list); } catch (e) {}
    return room;
  }
  // 房间在内存里那一份说了算，存档只是跟着写一份（存不住也不影响这一场聊下去）
  function addMsg(room, msg) {
    if ((room.msgs || []).some(m => m.id === msg.id)) return room;
    return upsertRoom(Object.assign({}, room, { msgs: (room.msgs || []).concat([msg]) }));
  }
  function patchRoom(room, patch) { return upsertRoom(Object.assign({}, room, patch)); }
  // 退出那张卡：勾了谁就只记谁；勾的必须是我自己带来的人（对面的人不归我记）
  function memoryTargets(myChars, picks) {
    const p = picks || {};
    return (myChars || []).filter(c => c && p[c.id] === true).map(c => c.id);
  }
  // 房间记录 → 给模型读的那一段：只有「谁：说了什么」，对面的人只是一个名字
  function transcript(room) {
    return (room.msgs || []).map(m => {
      const who = m.kind === "char"
        ? m.name + "（" + (m.side === "me" ? room.myNick : room.peerNick) + " 带来的）"
        : (m.side === "me" ? room.myNick : room.peerNick);
      return who + "：" + String(m.text || "").trim();
    }).join("\n");
  }
  function bans() {
    return (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n\n" + ECHO_QUESTION_BAN : "")
      + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n\n" + REGISTER_FOLLOWS_SCENE : "")
      + (root.ReplyPacing && typeof root.ReplyPacing.reading === "function" ? "\n\n" + root.ReplyPacing.reading() : "");
  }
  function lineInstruction(room, char) {
    const peers = (room.peerChars || []).map(c => c.name).filter(Boolean);
    const mine = (room.myChars || []).filter(c => c.id !== char.id).map(c => c.name);
    return "【这里是联机房间】" + room.myNick + " 用自己的手机和另一个人 " + room.peerNick + " 的手机连在了一起，两边各带了自己的人进来，大家在同一个房间里说话。"
      + "\n- 带你来的是 " + room.myNick + (mine.length ? "，跟你一起来的还有：" + mine.join("、") : "") + "。"
      + "\n- 对面是 " + room.peerNick + (peers.length ? "，TA 带来的是：" + peers.join("、") : "") + "。"
      + "对面这几位你只知道名字和他们在这里说过的话，其余的你不知道，也不用替他们补。"
      + "\n\n【房间里到现在的全部聊天】\n" + (transcript(room) || "（还没人说话）")
      + "\n\n【这一次】轮到你在房间里开口，接着上面的话说一句（想说几句也行，像在群里发消息）。只写你说出口的话本身，不写旁白，不替别人说话。"
      + bans();
  }
  function memoryInstruction(room, char) {
    return "把下面这次「" + room.myNick + " 带你进联机房间，跟 " + room.peerNick + " 那边的人聊天」的经历，浓缩成 1~3 句会长期记住的事（你的第一人称）："
      + "见了谁、聊了什么、谁让你印象深、你自己说过的要紧的话。只写沉淀下来的，不记流水账。对面的人你只知道名字和他们在这里说的话。"
      + "\n\n【这次房间里的全部聊天】\n" + transcript(room);
  }

  // 头像压到 64px 的 dataURL（发给对面的只有这一张小图）
  function smallAvatar(char) {
    return new Promise(done => {
      try {
        const raw = char && char.avatarImage ? (typeof resolveImg === "function" ? resolveImg(char.avatarImage) : char.avatarImage) : "";
        if (!raw || typeof Image === "undefined" || typeof document === "undefined") return done("");
        const img = new Image();
        if (/^https?:/.test(raw)) img.crossOrigin = "anonymous";
        const tm = setTimeout(() => done(""), 4000);
        img.onload = () => {
          clearTimeout(tm);
          try {
            const c = document.createElement("canvas"); c.width = c.height = AVATAR_PX;
            const x = c.getContext("2d"), s = Math.min(img.width, img.height) || 1;
            x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, AVATAR_PX, AVATAR_PX);
            done(c.toDataURL("image/jpeg", 0.75));
          } catch (e) { done(""); }
        };
        img.onerror = () => { clearTimeout(tm); done(""); };
        img.src = raw;
      } catch (e) { done(""); }
    });
  }

  // ───────────── 中转（只用来递一次名片） ─────────────
  function MqttLink(onMessage) {
    let ws = null, ping = null, closed = false, pid = 1;
    const feed = mqtt.decoder();
    const subWaits = [];
    const api = {
      open(url) {
        return new Promise((ok, no) => {
          let settled = false;
          const fail = e => { if (settled) return; settled = true; try { ws && ws.close(); } catch (_) {} no(e || new Error("连不上")); };
          const tm = setTimeout(() => fail(new Error("超时")), 7000);
          try { ws = new WebSocket(url, ["mqtt"]); } catch (e) { clearTimeout(tm); return fail(e); }
          ws.binaryType = "arraybuffer";
          ws.onopen = () => ws.send(mqtt.connect("qq" + Math.random().toString(36).slice(2, 12), 30));
          ws.onerror = () => { clearTimeout(tm); fail(new Error("连不上")); };
          ws.onclose = () => { clearTimeout(tm); if (!settled) fail(new Error("断了")); if (ping) clearInterval(ping); };
          ws.onmessage = ev => {
            feed(new Uint8Array(ev.data)).forEach(pk => {
              if (pk.type === 2) {
                clearTimeout(tm);
                if (pk.code !== 0) return fail(new Error("被拒绝了"));
                settled = true; ok(api);
                ping = setInterval(() => { try { ws.send(mqtt.ping()); } catch (e) {} }, 20000);
              } else if (pk.type === 9) { const w = subWaits.shift(); w && w(); }
              else if (pk.type === 3 && !closed) { try { onMessage(pk.topic, pk.payload); } catch (e) {} }
            });
          };
        });
      },
      subscribe(topic) { return new Promise(ok => { subWaits.push(ok); ws.send(mqtt.subscribe(pid++, topic)); setTimeout(ok, 3000); }); },
      publish(topic, obj) { try { ws.send(mqtt.publish(topic, JSON.stringify(obj))); } catch (e) {} },
      close() {
        closed = true; if (ping) clearInterval(ping);
        try { ws && ws.readyState === 1 && ws.send(mqtt.disconnect()); } catch (e) {}
        try { ws && ws.close(); } catch (e) {}
      }
    };
    return api;
  }
  async function openBroker(onMessage) {
    let last = null;
    for (const url of BROKERS) {
      const link = MqttLink(onMessage);
      try { return await link.open(url); } catch (e) { last = e; }
    }
    throw last || new Error("连不上");
  }
  function iceDone(pc) {
    return new Promise(ok => {
      if (pc.iceGatheringState === "complete") return ok();
      const tm = setTimeout(ok, 3500);   // 收不齐也别一直等：手上有的先发（有的公共 STUN 在某些网络里不回话）
      pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(tm); ok(); } });
    });
  }

  // 一次连线：host 开房等人，guest 拿房间号进。连上了回调 onOpen(channel)，失败回调 onFail(文字)
  function connectRoom(o) {
    const me = Math.random().toString(36).slice(2, 10);
    const topic = topicOf(o.code);
    let link = null, pc = null, dc = null, done = false, timer = null, hello = null;
    const finish = () => { if (timer) clearTimeout(timer); if (hello) clearInterval(hello); try { link && link.close(); } catch (e) {} link = null; };
    const fail = text => { if (done) return; done = true; finish(); try { pc && pc.close(); } catch (e) {} o.onFail && o.onFail(text); };
    const startClock = () => { if (!timer) timer = setTimeout(() => fail(FAIL_TEXT), CONNECT_TIMEOUT); };
    const wire = ch => {
      dc = ch;
      ch.onopen = () => { if (done) return; done = true; finish(); o.onOpen && o.onOpen(ch, pc); };
      ch.onclose = () => { o.onClose && o.onClose(); };
    };
    const mkPc = () => {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onconnectionstatechange = () => { if (!done && pc.connectionState === "failed") fail(FAIL_TEXT); };
      return pc;
    };
    const onMessage = async (t, payload) => {
      if (t !== topic || done) return;
      let m; try { m = JSON.parse(payload); } catch (e) { return; }
      if (!m || m.from === me) return;
      try {
        if (o.host && m.t === "hello" && !pc) {
          startClock(); o.onStatus && o.onStatus("有人进来了，正在接通…");
          mkPc(); wire(pc.createDataChannel("room", { ordered: true }));
          await pc.setLocalDescription(await pc.createOffer());
          await iceDone(pc);
          link && link.publish(topic, { from: me, to: m.from, t: "offer", sdp: pc.localDescription.sdp });
        } else if (!o.host && m.t === "offer" && m.to === me && !pc) {
          if (hello) { clearInterval(hello); hello = null; }
          o.onStatus && o.onStatus("找到房间了，正在接通…");
          mkPc(); pc.ondatachannel = ev => wire(ev.channel);
          await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
          await pc.setLocalDescription(await pc.createAnswer());
          await iceDone(pc);
          link && link.publish(topic, { from: me, to: m.from, t: "answer", sdp: pc.localDescription.sdp });
        } else if (o.host && m.t === "answer" && pc && !pc.remoteDescription) {
          await pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
        }
      } catch (e) { fail(FAIL_TEXT); }
    };
    (async () => {
      try { link = await openBroker(onMessage); }
      catch (e) { return fail("房间号这一步没走通：网络连不上，过一会儿再试"); }
      if (done) { link.close(); return; }
      await link.subscribe(topic);
      if (o.host) { o.onStatus && o.onStatus("等对方输入房间号…"); }
      else {
        startClock(); o.onStatus && o.onStatus("正在找房间…");
        const say = () => link && link.publish(topic, { from: me, t: "hello" });
        say(); hello = setInterval(say, 2500);
      }
    })();
    return { cancel() { done = true; finish(); try { pc && pc.close(); } catch (e) {} } };
  }

  const Core = { BROKERS, TOPIC_PREFIX, ICE_SERVERS, CONNECT_TIMEOUT, FAIL_TEXT, STORE_KEY, AVATAR_PX,
    mqtt, topicOf, newCode, validCode, cardOf, cleanCard, wireMsg, loadRooms, saveRooms, upsertRoom, addMsg, patchRoom,
    memoryTargets, transcript, lineInstruction, memoryInstruction };
  root.NetRoomCore = Core;

  // ───────────── 页面 ─────────────
  if (typeof React === "undefined") return;
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;
  const fs = px => "calc(" + px + "px * var(--app-fs, 1))";
  const fmt = ts => { const d = new Date(ts || 0); return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

  function Btn({ label, onClick, primary, disabled, wk }) {
    const t = useTheme();
    return h("button", { "data-wk": wk || "nrbtn", onClick, disabled, className: "active:opacity-70 disabled:opacity-40",
      style: { minHeight: 44, padding: "0 18px", borderRadius: 12, border: "1px solid " + (primary ? t.ink : t.line),
        background: primary ? t.ink : t.bg2, color: primary ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(14) } }, label);
  }
  function Note({ children }) {
    const t = useTheme();
    return h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, lineHeight: 1.7 } }, children);
  }
  // 输入框自己管自己的草稿（typing-hot-path.md）：父组件只在发送那一下拿到字
  function Composer({ onSend, disabled }) {
    const t = useTheme();
    const [txt, setTxt] = useState("");
    const ref = useRef(null);
    const send = () => { const s = txt.trim(); if (!s || disabled) return; onSend(s); setTxt(""); setTimeout(() => fitTextarea(ref.current, 120), 0); };
    return h("div", { className: "flex items-end", style: { gap: 8 } },
      h("textarea", { "data-wk": "nrinput", ref, rows: 1, value: txt, placeholder: disabled ? "对方已经离开了" : "说点什么…", disabled,
        onChange: e => { setTxt(e.target.value); fitTextarea(e.target, 120); },
        onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } },
        style: { flex: 1, minHeight: 40, resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink,
          padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.45 } }),
      h(Btn, { label: "发送", primary: true, onClick: send, disabled: disabled || !txt.trim(), wk: "nrsend" }));
  }
  function MsgRow({ m, room, myCharsById }) {
    const t = useTheme();
    const mine = m.side === "me";
    const owner = mine ? room.myNick : room.peerNick;
    let face = null;
    if (m.kind === "char") {
      const local = mine ? myCharsById[m.charId] : null;
      const card = !mine ? (room.peerChars || []).find(c => c.id === m.charId) : null;
      face = h(Avatar, { size: 34, character: local || { id: "nr_" + m.charId, name: m.name,
        avatarImage: card && card.avatar || "", avatarEmoji: card && card.emoji || "", color: card && card.color || "" } });
    }
    return h("div", { "data-wk": "nrmsg", "data-side": m.side, className: "flex", style: { gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start" } },
      face,
      h("div", { style: { maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 3 } }, m.kind === "char" ? m.name : owner),
        h("div", { "data-wk": "nrbubble", style: { padding: "8px 12px", borderRadius: 14, background: mine ? t.ink : t.bg2, color: mine ? t.bg : t.ink,
          border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text),
        m.kind === "char" && h("div", { "data-wk": "nrowner", style: { fontFamily: F_BODY, fontSize: fs(10.5), color: t.fog, marginTop: 3 } }, owner + " 带来的")));
  }
  function MsgList({ room, myCharsById, tail }) {
    const ref = useRef(null);
    const n = (room.msgs || []).length;
    useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [n, tail]);
    return h("div", { ref, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 } },
      !n && h(Note, null, "房间里还没人说话。你直接发，或者点下面一个头像让 TA 先开口。"),
      (room.msgs || []).map(m => h(MsgRow, { key: m.id, m, room, myCharsById })),
      tail);
  }

  function NetRoomApp(props) {
    const t = useTheme();
    const chars = props.characters || [];
    const charsById = {}; chars.forEach(c => { charsById[c.id] = c; });
    const [page, setPage] = useState("home");          // home / wait / pick / chat / leave / history / view
    const [nick, setNick] = useState((props.profile && props.profile.name) || "");
    const [code, setCode] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [status, setStatus] = useState("");
    const [err, setErr] = useState("");
    const [room, setRoom] = useState(null);
    const [picked, setPicked] = useState({});
    const [busy, setBusy] = useState({});
    const [gone, setGone] = useState(false);
    const [memPick, setMemPick] = useState({});
    const [saving, setSaving] = useState(false);
    const [rooms, setRooms] = useState(() => Core.loadRooms());
    const [viewId, setViewId] = useState(null);
    const entered = useRef(false);
    const conn = useRef(null), chan = useRef(null), pcRef = useRef(null), roomRef = useRef(null);
    roomRef.current = room;
    const commit = r => { roomRef.current = r; setRoom(r); };
    useEffect(() => () => { try { conn.current && conn.current.cancel(); } catch (e) {} try { chan.current && chan.current.close(); } catch (e) {} try { pcRef.current && pcRef.current.close(); } catch (e) {} }, []);
    const refresh = () => setRooms(Core.loadRooms());
    const myNick = () => String(nick || "").trim().slice(0, 20) || "朋友";

    const onWire = raw => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      const r = roomRef.current; if (!r || !m) return;
      if (m.t === "hi") {
        commit(Core.patchRoom(r, { peerNick: String(m.nick || "对方").slice(0, 20), peerChars: (m.chars || []).slice(0, 8).map(Core.cleanCard) }));
      } else if (m.t === "msg" && m.m) {
        commit(Core.addMsg(r, Object.assign(Core.wireMsg(m.m), { side: "peer" })));
      } else if (m.t === "bye") setGone(true);
    };
    const start = host => {
      setErr(""); setGone(false);
      const c = host ? Core.newCode() : String(joinCode).trim();
      if (!host && !Core.validCode(c)) { setErr("房间号是 6 位数字"); return; }
      setCode(c); setPage("wait"); setStatus("正在连…");
      conn.current = connectRoom({ code: c, host,
        onStatus: setStatus,
        onFail: text => { setErr(text); setPage("home"); conn.current = null; },
        onOpen: (ch, pc) => {
          chan.current = ch; pcRef.current = pc; conn.current = null;
          ch.onmessage = ev => onWire(ev.data);
          const r = { id: "nr_" + Date.now(), code: c, host, startedAt: Date.now(), endedAt: 0, myNick: myNick(), peerNick: "对方",
            myChars: [], peerChars: [], msgs: [], remembered: {} };
          commit(Core.upsertRoom(r)); setPage("pick");
        },
        onClose: () => setGone(true) });
    };
    const cancelWait = () => { try { conn.current && conn.current.cancel(); } catch (e) {} conn.current = null; setPage("home"); };
    const send = obj => { try { chan.current && chan.current.readyState === "open" && chan.current.send(JSON.stringify(obj)); } catch (e) {} };
    const enter = async () => {
      const list = chars.filter(c => picked[c.id]);
      const cards = [];
      for (const c of list) cards.push(Core.cardOf(c, await smallAvatar(c)));
      commit(Core.patchRoom(roomRef.current, { myNick: myNick(), myChars: list.map(c => ({ id: c.id, name: c.remark || c.name })) }));
      send({ t: "hi", nick: myNick(), chars: cards });
      entered.current = true; setPage("chat");
    };
    const post = (msg) => {
      const full = Object.assign(Core.wireMsg(msg), { side: "me" });
      commit(Core.addMsg(roomRef.current, full));
      send({ t: "msg", m: Core.wireMsg(full) });
    };
    const sayHuman = text => post({ id: "m" + Date.now() + Math.random().toString(36).slice(2, 6), kind: "user", name: myNick(), text, ts: Date.now() });
    const speak = async c => {
      const char = charsById[c.id];
      if (!char || busy[c.id]) return;
      const p = props.apiFor ? props.apiFor(char.id) : null;
      if (!p) { props.toast && props.toast("先去 设置·API 配一条线路"); return; }
      setBusy(b => Object.assign({}, b, { [c.id]: true }));
      try {
        const cur = roomRef.current;
        const d = await runProbe(p, props.ctxFor(char), { voice: true, tag: "netroom",
          instruction: Core.lineInstruction(cur, { id: char.id, name: char.remark || char.name }),
          schemaHint: "{\"text\":\"你在房间里说的话\"}", maxTokens: 12000 });
        const text = String((d && d.text) || "").trim();
        if (!text) throw new Error("TA 没想好说什么，再点一次");
        post({ id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), kind: "char", name: char.remark || char.name, charId: char.id, text, ts: Date.now() });
      } catch (e) { props.toast && props.toast("没说出来：" + ((e && e.message) || e)); }
      finally { setBusy(b => Object.assign({}, b, { [c.id]: false })); }
    };
    // 把一个人这次的经历记进 TA 的记忆（退出卡和历史里补记都走这一处）
    const remember = async (r, charId) => {
      const char = charsById[charId];
      if (!char) throw new Error("这个人已经不在你的角色里了");
      const p = props.apiFor ? props.apiFor(char.id) : null;
      if (!p) throw new Error("先去 设置·API 配一条线路");
      const d = await runProbe(p, props.ctxFor(char), { voice: true, tag: "netroom",
        instruction: Core.memoryInstruction(r, { id: char.id, name: char.remark || char.name }),
        schemaHint: "{\"memory\":\"1~3 句，第一人称\"}", maxTokens: 12000 });
      const text = String((d && d.memory) || "").trim();
      if (!text) throw new Error("没浓缩出什么");
      props.onAddMemory && props.onAddMemory(text, char.id);
      const rem = Object.assign({}, (Core.loadRooms().find(x => x.id === r.id) || r).remembered || {}, { [charId]: Date.now() });
      Core.patchRoom(Core.loadRooms().find(x => x.id === r.id) || r, { remembered: rem });
      return text;
    };
    const leave = async () => {
      const r = Core.patchRoom(roomRef.current, { endedAt: Date.now() });
      const ids = Core.memoryTargets(r.myChars, memPick);
      setSaving(true);
      send({ t: "bye" });
      try { chan.current && chan.current.close(); } catch (e) {} try { pcRef.current && pcRef.current.close(); } catch (e) {}
      let ok = 0;
      for (const id of ids) { try { await remember(r, id); ok++; } catch (e) { props.toast && props.toast("没记上：" + ((e && e.message) || e)); } }
      if (ok) props.toast && props.toast("记进了 " + ok + " 个人的记忆");
      setSaving(false); setRoom(null); setMemPick({}); entered.current = false; refresh(); setPage("home");
    };

    const shell = (head, body, foot) => h("div", { "data-wk": "nrpage", "data-part": page, className: "h-full flex flex-col", style: { background: t.bg, color: t.ink } },
      head, body, foot || null);
    const scroll = kids => h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14 } }, kids);
    const label = s => h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, s);
    const card = kids => h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 14, display: "flex", flexDirection: "column", gap: 10 } }, kids);

    if (page === "wait") return shell(h(Head, { zh: "联机", onBack: cancelWait }), scroll([
      code && room === null && h("div", { key: "c", style: { textAlign: "center", paddingTop: 30 } },
        h(Note, null, "房间号"),
        h("div", { "data-wk": "nrcode", style: { fontFamily: F_DISPLAY, fontSize: fs(40), letterSpacing: 8, margin: "6px 0 10px" } }, code)),
      h("div", { key: "s", style: { textAlign: "center" } }, h(Note, null, status)),
      h(Note, { key: "n" }, "把房间号发给对方，让 TA 在「联机」里点「输入房间号加入」。两个人都要开着这一页；20 秒连不上会提示你。")
    ]));

    if (page === "pick") return shell(h(Head, { zh: "带谁进来", onBack: () => setPage("leave") }), scroll([
      h(Note, { key: "n" }, "勾上要带进房间的人。对方只看得到 TA 们的名字和头像，人设、记忆、世界书都留在你手机上。TA 们开口用的是你自己的线路。"),
      chars.length ? chars.map(c => h("label", { key: c.id, className: "flex items-center", style: { gap: 12, minHeight: 48 } },
        h("input", { type: "checkbox", checked: !!picked[c.id], onChange: e => setPicked(p => Object.assign({}, p, { [c.id]: e.target.checked })) }),
        h(Avatar, { character: c, size: 36 }),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, c.remark || c.name)))
        : h(Note, { key: "e" }, "你还没有角色，也可以只你自己进去聊。"),
      h(Btn, { key: "go", label: "进房间", primary: true, onClick: enter, wk: "nrenter" })
    ]));

    if (page === "chat" && room) {
      const myChars = (room.myChars || []);
      const tail = Object.keys(busy).filter(k => busy[k]).map(k => h(Note, { key: "b" + k }, ((charsById[k] && (charsById[k].remark || charsById[k].name)) || "TA") + " 正在想…"));
      return shell(
        h(Head, { zh: "房间 " + room.code, sub: "和 " + room.peerNick + (gone ? " · 对方已离开" : ""), onBack: () => setPage("leave"),
          right: h("button", { "data-wk": "nrleave", onClick: () => setPage("leave"), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "退出") }),
        h(MsgList, { room, myCharsById: charsById, tail }),
        h("div", { "data-wk": "nrcomposer", className: "shrink-0", style: { borderTop: "1px solid " + t.line, background: t.bg, padding: "8px 12px", paddingBottom: COMPOSER_PAD_BOTTOM } },
          myChars.length > 0 && h("div", { className: "flex items-center", style: { gap: 10, paddingBottom: 8, overflowX: "auto" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, flexShrink: 0 } }, "点谁谁说"),
            myChars.map(c => h("button", { key: c.id, "data-wk": "nrspeaker", disabled: !!busy[c.id] || gone, onClick: () => speak(c),
              className: "active:opacity-60 disabled:opacity-40", style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 44 } },
              h(Avatar, { character: charsById[c.id] || { id: c.id, name: c.name }, size: 32 }),
              h("span", { style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog } }, busy[c.id] ? "在想…" : c.name)))),
          h(Composer, { onSend: sayHuman, disabled: gone })));
    }

    if (page === "leave" && room) {
      const myChars = room.myChars || [];
      return shell(h(Head, { zh: "离开房间", onBack: () => setPage(entered.current ? "chat" : "pick") }), scroll([
        h(Note, { key: "n" }, "要不要把这次的事记进 TA 的记忆？每个人单独勾。勾上的会用你的线路把这次聊天浓缩成一两句，写进 TA 的记忆库；不勾就什么都不留在 TA 身上。房间记录照样留着，之后在「以前的房间」里也能补记。"),
        myChars.length ? card(myChars.map(c => h("label", { key: c.id, className: "flex items-center", style: { gap: 12, minHeight: 44 } },
          h("input", { type: "checkbox", "data-wk": "nrmempick", checked: !!memPick[c.id], onChange: e => setMemPick(p => Object.assign({}, p, { [c.id]: e.target.checked })) }),
          h(Avatar, { character: charsById[c.id] || { id: c.id, name: c.name }, size: 32 }),
          h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, "记进 " + c.name + " 的记忆"))))
          : h(Note, { key: "e" }, "这次你没带人进来，没有要记的。"),
        h(Btn, { key: "go", label: saving ? "在记…" : "离开", primary: true, disabled: saving, onClick: leave, wk: "nrleaveok" })
      ]));
    }

    if (page === "view") {
      const r = rooms.find(x => x.id === viewId);
      if (!r) { setPage("home"); return null; }
      const fill = async id => {
        setSaving(true);
        try { await remember(r, id); props.toast && props.toast("记住了"); refresh(); }
        catch (e) { props.toast && props.toast("没记上：" + ((e && e.message) || e)); }
        finally { setSaving(false); }
      };
      return shell(h(Head, { zh: "房间 " + r.code, sub: fmt(r.startedAt) + " · 和 " + r.peerNick, onBack: () => setPage("home") }),
        h("div", { className: "flex-1 min-h-0 flex flex-col" },
          (r.myChars || []).length > 0 && h("div", { className: "shrink-0", style: { padding: "10px 14px", borderBottom: "1px solid " + t.line, display: "flex", flexWrap: "wrap", gap: 8 } },
            (r.myChars || []).map(c => h(Btn, { key: c.id, wk: "nrfill", disabled: saving || !charsById[c.id],
              label: (r.remembered || {})[c.id] ? c.name + " 已记过 · 再记一次" : "记进 " + c.name + " 的记忆", onClick: () => fill(c.id) }))),
          h(MsgList, { room: r, myCharsById: charsById })));
    }

    // 首页
    return shell(h(Head, { zh: "联机", onBack: props.onBack }), scroll([
      h(Note, { key: "intro" }, "跟另一台手机上的人开一个房间，两边各带自己的角色进来一起聊。只能两个人；两边都要同时开着这一页。"),
      card([
        label("你在房间里叫"),
        h("input", { key: "nick", "data-wk": "nrnick", value: nick, onChange: e => setNick(e.target.value), maxLength: 20, placeholder: "昵称",
          style: { minHeight: 42, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(14) } }),
        h(Btn, { key: "host", label: "开房间", primary: true, onClick: () => start(true), wk: "nrhost" }),
        h("div", { key: "j", className: "flex", style: { gap: 8 } },
          h("input", { "data-wk": "nrjoincode", value: joinCode, onChange: e => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6)), inputMode: "numeric", placeholder: "6 位房间号",
            style: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(15), letterSpacing: 2 } }),
          h(Btn, { label: "输入房间号加入", onClick: () => start(false), wk: "nrjoin" })),
        err && h("div", { key: "err", "data-wk": "nrerr", style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 } }, err),
        h(Note, { key: "priv" }, "对方只看得到你带的人的名字和头像，人设、记忆、世界书不出你的手机。聊天记录两边各存一份。")
      ]),
      label("以前的房间"),
      rooms.length ? rooms.map(r => h("button", { key: r.id, "data-wk": "nrhist", onClick: () => { setViewId(r.id); setPage("view"); }, className: "active:opacity-70",
        style: { textAlign: "left", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2, padding: "10px 14px", color: t.ink } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, "和 " + r.peerNick + " · 房间 " + r.code),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, marginTop: 2 } }, fmt(r.startedAt) + " · " + (r.msgs || []).length + " 条")))
        : h(Note, { key: "none" }, "还没开过房间。")
    ]));
  }
  if (typeof window !== "undefined") window.NetRoomApp = NetRoomApp;
})(typeof window !== "undefined" ? window : globalThis);
