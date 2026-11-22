// 联机房间（她 2026-11-21 设计单「一」那一行；第二期起最多四个人，网状直连）
// 房间号、房间号、各带几个自己的角色、手动点谁开口、文字消息、退出时勾要不要记进记忆。
//
// 怎么连：开房的人拿到 6 位房间号；两边借一个公共的免费中转节点（MQTT over WebSocket）
//   交换 WebRTC 的「怎么连我」（offer/answer，等 ICE 收齐整包发，不做 trickle）。每两个人之间一条直连（Mesh），
//   消息只在手机之间走（RTCDataChannel）；中转在房间里一直挂着，新人和断了回来的人靠它找到大家。
//   某两人之间直连不通时，跟两边都通着的人替他们转（forwardTargets），每条带编号去重。
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
  // 线上走的一条消息：也只这几样。by 是说这句话那个人的 peerId（补发别人的话时靠它认人）
  function wireMsg(m) {
    return { id: String(m.id), kind: m.kind === "char" ? "char" : "user", name: String(m.name || "").slice(0, 40),
      charId: m.kind === "char" ? String(m.charId || "") : "", text: String(m.text || "").slice(0, 8000), ts: Number(m.ts) || Date.now(),
      by: String(m.by || "").slice(0, 40) };
  }
  // 存档：[{ id, code, host, myPeerId, startedAt, endedAt, myNick, peers:[{peerId,nick,chars:[card]}], myChars:[{id,name,recent}],
  //   msgs:[{…wireMsg, side:"me"|"peer", peerId}], remembered:{charId:ts} }]
  // 两人时期的老存档是 peerNick / peerChars 两个单数字段：读的时候折成 peers 里一个人（peerId 记作 legacy），
  //   老消息里 side 是 peer 的都归这个人。那人回来时报的昵称对得上，就把 legacy 换成 TA 真的 peerId。
  const LEGACY = "legacy";
  function normalizeRoom(r) {
    if (!r || typeof r !== "object") return r;
    if (Array.isArray(r.peers) && !("peerNick" in r) && !("peerChars" in r)) return r;
    const out = Object.assign({}, r);
    let peers = Array.isArray(r.peers) ? r.peers.slice() : [];
    if (!Array.isArray(r.peers) && (r.peerNick || (r.peerChars || []).length || (r.msgs || []).some(m => m && m.side === "peer")))
      peers = [{ peerId: LEGACY, nick: String(r.peerNick || "对方"), chars: (r.peerChars || []).slice() }];
    delete out.peerNick; delete out.peerChars;
    out.peers = peers;
    const first = peers[0] && peers[0].peerId;
    out.msgs = (r.msgs || []).map(m => m && m.side === "peer" && !m.peerId && first ? Object.assign({}, m, { peerId: first }) : m);
    return out;
  }
  // 收到某人的名片：有就更新，没有就添；对得上昵称的 legacy 那一位换成真 id（消息跟着换）
  function upsertPeer(room, peerId, nick, chars) {
    const r = normalizeRoom(room);
    const peers = (r.peers || []).slice();
    let i = peers.findIndex(p => p.peerId === peerId);
    let msgs = r.msgs || [];
    if (i < 0) {
      const j = peers.findIndex(p => p.peerId === LEGACY && p.nick === nick);
      if (j >= 0) { i = j; msgs = msgs.map(m => m.peerId === LEGACY ? Object.assign({}, m, { peerId }) : m); }
    }
    const rec = { peerId, nick: String(nick || "对方").slice(0, 20), chars: (chars || []).slice(0, 8) };
    if (i >= 0) peers[i] = rec; else peers.push(rec);
    return Object.assign({}, r, { peers, msgs });
  }
  const peerOf = (room, id) => ((room && room.peers) || []).find(p => p.peerId === id) || null;
  // 这条话是谁那边的：自己 → 我的昵称；对面 → 按 peerId 找那个人（找不到就第一个人，再不行「对方」）
  function ownerNick(room, m) {
    if (m.side === "me") return room.myNick || "我";
    const p = peerOf(room, m.peerId) || (room.peers || [])[0];
    return (p && p.nick) || "对方";
  }
  const peerNames = room => (room.peers || []).map(p => p.nick).filter(Boolean);
  function loadRooms() { try { const v = loadJSON(STORE_KEY, []); return Array.isArray(v) ? v.map(normalizeRoom) : []; } catch (e) { return []; } }
  function saveRooms(list) { saveJSON(STORE_KEY, (list || []).slice(0, 60)); }
  function upsertRoom(room) {
    room = normalizeRoom(room);
    try { const list = loadRooms().filter(r => r.id !== room.id); list.unshift(room); saveRooms(list); } catch (e) {}
    return room;
  }
  // 房间在内存里那一份说了算，存档只是跟着写一份（存不住也不影响这一场聊下去）
  function addMsg(room, msg) {
    if ((room.msgs || []).some(m => m.id === msg.id)) return room;
    return upsertRoom(Object.assign({}, room, { msgs: (room.msgs || []).concat([msg]) }));
  }
  function patchRoom(room, patch) { return upsertRoom(Object.assign({}, room, patch)); }
  // 删一个房间的记录（只删这台手机上这一份；对方那份、已经记进记忆的不动）
  function removeRoom(id) { try { saveRooms(loadRooms().filter(r => r.id !== id)); } catch (e) {} }
  // 重新连上以后，别人把 TA 手上的记录整份再发一遍：这边缺的补上、有的不重复，按时间排回去
  function mergeMsgs(room, list) {
    const have = new Set((room.msgs || []).map(m => m.id));
    const add = (list || []).filter(m => m && m.id && !have.has(m.id));
    if (!add.length) return room;
    const msgs = (room.msgs || []).concat(add).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
    return upsertRoom(Object.assign({}, room, { msgs }));
  }
  // 补发来的一条：by 是我自己 → 记成我说的；否则记在 by 那个人名下（没写 by 的算发来的那个人）
  function syncedMsg(x, myPeerId, sender) {
    const w = wireMsg(x), by = w.by || sender;
    return by === myPeerId ? Object.assign(w, { side: "me" }) : Object.assign(w, { side: "peer", peerId: by });
  }
  // 退出那张卡：勾了谁就只记谁；勾的必须是我自己带来的人（对面的人不归我记）
  function memoryTargets(myChars, picks) {
    const p = picks || {};
    return (myChars || []).filter(c => c && p[c.id] === true).map(c => c.id);
  }
  // 房间记录 → 给模型读的那一段：只有「谁：说了什么」，别人带来的人只是一个名字
  function transcript(room) {
    room = normalizeRoom(room);
    return (room.msgs || []).map(m => {
      const who = m.kind === "char" ? m.name + "（" + ownerNick(room, m) + " 带来的）" : ownerNick(room, m);
      return who + "：" + String(m.text || "").trim();
    }).join("\n");
  }
  function bans() {
    return (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n\n" + ECHO_QUESTION_BAN : "")
      + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n\n" + REGISTER_FOLLOWS_SCENE : "")
      + (root.ReplyPacing && typeof root.ReplyPacing.reading === "function" ? "\n\n" + root.ReplyPacing.reading() : "");
  }
  // 房间里每一方：「某某，TA 带来的是：甲、乙」一行一个
  function sidesLines(room) {
    return (room.peers || []).map(p => {
      const names = (p.chars || []).map(c => c.name).filter(Boolean);
      return "\n- " + p.nick + (names.length ? "，TA 带来的是：" + names.join("、") : "，没带人") + "。";
    }).join("");
  }
  // 面具跟着角色走（她 2026-11-22）：这个人认的是哪张面具，就按那张的名字认她；
  //   房间里大家看到的是她进房时填的昵称，两个不一样时说清「房间记录里的 X 就是她」。
  function youAlias(room, char) {
    const you = String((char && char.you) || "").trim(), nick = String(room.myNick || "").trim();
    return you && nick && you !== nick ? "你认识的 " + you + " 在这个房间里用的名字是「" + nick + "」，房间记录里写着「" + nick + "」的那些话就是 " + you + " 说的" : "";
  }
  function youLine(room, char) {
    const you = String((char && char.you) || "").trim() || room.myNick;
    const a = youAlias(room, char);
    return you + (a ? "（" + a + "）" : "");
  }
  function lineInstruction(room, char) {
    room = normalizeRoom(room);
    const mine = (room.myChars || []).filter(c => c.id !== char.id).map(c => c.name);
    const n = 1 + (room.peers || []).length;
    return "【这里是联机房间】" + room.myNick + " 用自己的手机和别人的手机连在了一起，房间里一共 " + n + " 个人，每人各带了自己的人进来，大家在同一个房间里说话。"
      + "\n- 带你来的是 " + youLine(room, char) + (mine.length ? "，跟你一起来的还有：" + mine.join("、") : "") + "。"
      + "\n另外几方：" + (sidesLines(room) || "\n- （还没别人进来）")
      + "\n别人带来的这几位你只知道名字和他们在这里说过的话，其余的你不知道，也不用替他们补。"
      + "\n\n【房间里到现在的全部聊天】\n" + (transcript(room) || "（还没人说话）")
      + "\n\n【这一次】轮到你在房间里开口，接着上面的话开口，照你平时发消息的习惯：一条一个气泡，想连发几条就几条，跟在群里聊天一样。只写你说出口的话本身，不写旁白，不替别人说话。"
      + bans();
  }
  // 模型交回来的几条气泡：say 数组为主；只给了一段 text 的，按空行/换行拆开
  function sayLines(d) {
    const arr = d && Array.isArray(d.say) ? d.say : d && typeof d.say === "string" ? [d.say] : d && d.text ? [d.text] : [];
    return arr.map(x => String(x == null ? "" : x)).join("\n").split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 8);
  }
  function memoryInstruction(room, char) {
    room = normalizeRoom(room);
    return (youAlias(room, char) ? "（" + youAlias(room, char) + "）\n" : "") + "把下面这次「" + (char.you || room.myNick) + " 带你进联机房间，跟 " + (peerNames(room).join("、") || "别人") + " 那边的人聊天」的经历，浓缩成 1~3 句会长期记住的事（你的第一人称）："
      + "见了谁、聊了什么、谁让你印象深、你自己说过的要紧的话。只写沉淀下来的，不记流水账。别人带来的人你只知道名字和他们在这里说的话。"
      + "\n房间里的几方：" + sidesLines(room)
      + "\n\n【这次房间里的全部聊天】\n" + transcript(room);
  }

  // ───────────── 多人：谁跟谁连、谁 offer、满员、谁在线 ─────────────
  const MAX_PEOPLE = 4;
  const MAX_LINKS = MAX_PEOPLE - 1;
  const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  // 每两个人之间只许一边发 offer：peerId 小的那个发，大的那个敲门请对方发（不会两边同时 offer 撞车）
  const shouldOffer = (me, other) => String(me) < String(other);
  // 开房的人收到一个新面孔：房里（算上自己）满 4 个就不放；认识的人（回来的）永远放
  function admit(knownIds, id) {
    const ids = Array.from(new Set((knownIds || []).filter(Boolean)));
    if (ids.indexOf(id) >= 0) return "ok";
    return ids.length + 1 >= MAX_PEOPLE ? "full" : "ok";
  }
  // 我收到一条从 cameFrom 那条线来、origin 说的话：该替谁转一下？
  //   只转给跟 origin 没直连的人（TA 自己报过的直连名单里没有 origin；还没报过的也转，多一份重复会被去重）
  function forwardTargets(openIds, cameFrom, origin, linkMap) {
    const lm = linkMap || {};
    return (openIds || []).filter(x => x !== cameFrom && x !== origin && !((lm[x] || []).indexOf(origin) >= 0));
  }
  // 现在跟谁还通着（直连的 + 经别人转得到的）：从自己的直连出发，沿着各人报的直连名单走一遍
  function reachable(me, myOpen, linkMap) {
    const lm = linkMap || {}, seen = new Set([me]), q = (myOpen || []).slice(), out = [];
    while (q.length) {
      const x = q.shift(); if (seen.has(x)) continue;
      seen.add(x); out.push(x);
      (lm[x] || []).forEach(y => { if (!seen.has(y)) q.push(y); });
    }
    return out;
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

  // ───────────── 中转（递「怎么连我」；房间开着时一直挂着，新人和回来的人靠它找到大家） ─────────────
  function MqttLink(onMessage, onDrop) {
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
          ws.onclose = () => { clearTimeout(tm); if (ping) clearInterval(ping); if (!settled) fail(new Error("断了")); else if (!closed && onDrop) onDrop(); };
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
  async function openBroker(onMessage, onDrop) {
    let last = null;
    for (const url of BROKERS) {
      const link = MqttLink(onMessage, onDrop);
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

  // 一场联机：每两个人之间一条直连（四人六条）。中转节点在房间里一直开着：
  //   新来的人、断了回来的人都靠它找到大家。开房的人负责「介绍」：放不放新人、把房里有谁告诉 TA。
  // o: { code, me(我的 peerId), host, patient, knownIds(), onOpen(id,ch), onClose(id), onData(id,raw), onLinkFail(id), onStatus, onFail(文字) }
  function Mesh(o) {
    const topic = topicOf(o.code), sess = rid();
    const links = {};    // peerId → { pc, dc, lid, state: pending/open/fail, sess, timer }
    let link = null, hello = null, clock = null, anyOpen = false, dead = false;
    const pub = obj => { try { link && link.publish(topic, Object.assign({ from: o.me, s: sess }, obj)); } catch (e) {} };
    const stopHello = () => { if (hello) clearInterval(hello); hello = null; if (clock) clearTimeout(clock); clock = null; };
    const fail = text => { if (dead) return; api.close(); o.onFail && o.onFail(text); };
    const drop = id => { const L = links[id]; if (!L) return; delete links[id]; clearTimeout(L.timer); try { L.pc.close(); } catch (e) {} };
    const openIds = () => Object.keys(links).filter(id => links[id].state === "open");
    const linkFail = (id, L) => {
      if (links[id] !== L || L.state === "open") return;
      clearTimeout(L.timer); try { L.pc.close(); } catch (e) {}
      L.state = "fail"; o.onLinkFail && o.onLinkFail(id);
    };
    const wire = (id, L, ch) => {
      L.dc = ch;
      ch.onopen = () => {
        if (links[id] !== L || dead) return;
        L.state = "open"; clearTimeout(L.timer); anyOpen = true; stopHello();
        o.onOpen && o.onOpen(id, ch);
      };
      ch.onclose = () => { if (links[id] !== L) return; const was = L.state === "open"; drop(id); if (was) o.onClose && o.onClose(id); };
      ch.onmessage = ev => { if (links[id] === L) o.onData && o.onData(id, ev.data); };
    };
    const mkLink = (id, peerSess) => {
      drop(id);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const L = { pc, dc: null, lid: rid(), state: "pending", sess: peerSess || null };
      links[id] = L;
      pc.onconnectionstatechange = () => {
        if (links[id] !== L || pc.connectionState !== "failed") return;
        if (L.state === "open") { drop(id); o.onClose && o.onClose(id); } else linkFail(id, L);
      };
      L.timer = setTimeout(() => linkFail(id, L), CONNECT_TIMEOUT);
      return L;
    };
    const offerTo = async (id, peerSess) => {
      const L = mkLink(id, peerSess);
      try {
        wire(id, L, L.pc.createDataChannel("room", { ordered: true }));
        await L.pc.setLocalDescription(await L.pc.createOffer());
        await iceDone(L.pc);
        if (links[id] === L) pub({ t: "offer", to: id, lid: L.lid, sdp: L.pc.localDescription.sdp });
      } catch (e) { linkFail(id, L); }
    };
    // 要跟 id 连：轮到我 offer 就 offer，不轮到我就敲门请 TA 来 offer
    const linkTo = (id, peerSess) => {
      const L = links[id];
      if (L && L.state !== "fail" && (!peerSess || !L.sess || L.sess === peerSess)) return;   // 已经通着或正在通
      if (shouldOffer(o.me, id)) offerTo(id, peerSess);
      else { if (L && L.state === "fail") drop(id); pub({ t: "knock", to: id }); }
    };
    const onMessage = async (t, payload) => {
      if (t !== topic || dead) return;
      let m; try { m = JSON.parse(payload); } catch (e) { return; }
      if (!m || !m.from || m.from === o.me) return;
      const from = String(m.from).slice(0, 40);
      try {
        if (m.t === "hello") {
          const L = links[from];
          if (L && L.state !== "fail" && L.sess === m.s) return;
          if (o.host) {
            if (admit(o.knownIds ? o.knownIds() : [], from) === "full") { pub({ t: "full", to: from }); return; }
            o.onStatus && o.onStatus("有人进来了，正在接通…");
            pub({ t: "roster", to: from, ids: openIds() });
            linkTo(from, m.s);
          } else if ((o.knownIds ? o.knownIds() : []).indexOf(from) >= 0) linkTo(from, m.s);
          return;
        }
        if (m.to !== o.me) return;
        if (m.t === "full") { if (!anyOpen) fail("房间满了：一个房间最多四个人"); }
        else if (m.t === "roster") {
          if (!o.patient && !clock && !anyOpen) clock = setTimeout(() => { if (!anyOpen) fail(FAIL_TEXT); }, CONNECT_TIMEOUT);
          o.onStatus && o.onStatus("找到房间了，正在接通…");
          (Array.isArray(m.ids) ? m.ids : []).slice(0, MAX_PEOPLE).forEach(id => { id = String(id); if (id !== o.me) linkTo(id, null); });
        } else if (m.t === "knock") {
          if (shouldOffer(o.me, from)) { const L = links[from]; if (!(L && L.state !== "fail" && (!L.sess || L.sess === m.s))) offerTo(from, m.s); }
        } else if (m.t === "offer" && !shouldOffer(o.me, from)) {
          const L = mkLink(from, m.s);
          L.pc.ondatachannel = ev => wire(from, L, ev.channel);
          await L.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
          await L.pc.setLocalDescription(await L.pc.createAnswer());
          await iceDone(L.pc);
          if (links[from] === L) pub({ t: "answer", to: from, lid: m.lid, sdp: L.pc.localDescription.sdp });
        } else if (m.t === "answer") {
          const L = links[from];
          if (!L || L.lid !== m.lid || L.pc.remoteDescription) return;
          L.sess = m.s;
          await L.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
        }
      } catch (e) { const L = links[from]; if (L) linkFail(from, L); }
    };
    const sayHello = () => {
      stopHello();
      if (!o.patient && !o.host) clock = setTimeout(() => { if (!anyOpen) fail(FAIL_TEXT); }, CONNECT_TIMEOUT);
      const say = () => pub({ t: "hello" });
      say(); hello = setInterval(say, 2500);
    };
    // 中转那条线掉了：隔几秒自己再接上（房间里的直连不受影响，只是新人/回来的人暂时找不到）
    const openLink = async first => {
      try { link = await openBroker(onMessage, () => { link = null; if (!dead) setTimeout(() => openLink(false), 3000); }); }
      catch (e) { if (first) return fail("房间号这一步没走通：网络连不上，过一会儿再试"); if (!dead) setTimeout(() => openLink(false), 5000); return; }
      if (dead) { link.close(); return; }
      await link.subscribe(topic);
      if (!first) return;
      if (o.host && !o.patient) o.onStatus && o.onStatus("等别人输入房间号…");
      else { o.onStatus && o.onStatus(o.patient ? "等别人也点「重新连上」…" : "正在找房间…"); sayHello(); }
    };
    const api = {
      openIds,
      state: id => (links[id] ? links[id].state : ""),
      sendTo(id, raw) { const L = links[id]; try { L && L.state === "open" && L.dc && L.dc.readyState === "open" && L.dc.send(raw); } catch (e) {} },
      close() { dead = true; stopHello(); try { link && link.close(); } catch (e) {} link = null; Object.keys(links).forEach(drop); }
    };
    openLink(true);
    return api;
  }

  const Core = { BROKERS, TOPIC_PREFIX, ICE_SERVERS, CONNECT_TIMEOUT, FAIL_TEXT, STORE_KEY, AVATAR_PX, MAX_PEOPLE, LEGACY,
    mqtt, topicOf, newCode, validCode, cardOf, cleanCard, wireMsg, loadRooms, saveRooms, upsertRoom, addMsg, patchRoom,
    memoryTargets, transcript, lineInstruction, memoryInstruction, sayLines, mergeMsgs, removeRoom,
    normalizeRoom, upsertPeer, peerOf, ownerNick, peerNames, syncedMsg, shouldOffer, admit, forwardTargets, reachable, rid, Mesh };
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
      h("textarea", { "data-wk": "nrinput", ref, rows: 1, value: txt, placeholder: disabled ? "房里暂时没有别人在线" : "说点什么…", disabled,
        onChange: e => { setTxt(e.target.value); fitTextarea(e.target, 120); },
        onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } },
        style: { flex: 1, minHeight: 40, resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink,
          padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.45 } }),
      h(Btn, { label: "发送", primary: true, onClick: send, disabled: disabled || !txt.trim(), wk: "nrsend" }));
  }
  function MsgRow({ m, room, myCharsById }) {
    const t = useTheme();
    const mine = m.side === "me";
    const owner = Core.ownerNick(room, m);
    let face = null;
    if (m.kind === "char") {
      const local = mine ? myCharsById[m.charId] : null;
      const who = !mine ? (Core.peerOf(room, m.peerId) || (room.peers || [])[0]) : null;
      const card = who ? (who.chars || []).find(c => c.id === m.charId) : null;
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
    // 往上翻的时候不许拽回来（她 2026-11-22）：只有人本来就在底部附近、或者是自己刚发的，才跟到底。
    //   原来依赖里放的是 tail 这个每次渲染都新建的数组，等于每渲染一次就拽一次。
    const stick = useRef(true);
    const last = n ? room.msgs[n - 1] : null;
    const tailKey = (tail || []).map(x => x && x.key).join("|");
    useEffect(() => { const el = ref.current; if (el && (stick.current || (last && last.side === "me"))) { el.scrollTop = el.scrollHeight; stick.current = true; } }, [n, tailKey]);
    const onScroll = e => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    return h("div", { ref, onScroll, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 } },
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
    const [withChat, setWithChat] = useState({});   // 带上 TA 最近的单聊（只进自己这边的模型，不发给别人）
    const [peerTyping, setPeerTyping] = useState({});   // 别人哪几个角色正在输入：{ peerId|charId: 名字 }
    const [net, setNet] = useState({ open: [], fail: [], reach: [] });   // 直连通着的 / 直连失败的 / 直接或经人转得到的
    const [memPick, setMemPick] = useState({});
    const [saving, setSaving] = useState(false);
    const [rooms, setRooms] = useState(() => Core.loadRooms());
    const [viewId, setViewId] = useState(null);
    const [delAsk, setDelAsk] = useState(false);   // 删房间记录要点两下
    useEffect(() => { setDelAsk(false); }, [viewId, page]);
    const entered = useRef(false);
    const mesh = useRef(null), roomRef = useRef(null), meId = useRef("");
    const linkMap = useRef({});          // 各人报来的「我跟谁直连着」
    const seen = useRef(new Set());      // 收过的消息编号（经别人转来的同一条只认一次）
    const greeted = useRef(new Set());   // 这一场已经见过名片的人：头一回见到就再报一次自己的到
    roomRef.current = room;
    const commit = r => { roomRef.current = r; setRoom(r); };
    useEffect(() => () => { try { mesh.current && mesh.current.close(); } catch (e) {} }, []);
    const refresh = () => setRooms(Core.loadRooms());
    const myNick = () => String(nick || "").trim().slice(0, 20) || "朋友";

    const syncNet = () => {
      const m = mesh.current; if (!m) return;
      const open = m.openIds();
      const fail = Object.keys(linkMap.current).concat(((roomRef.current && roomRef.current.peers) || []).map(p => p.peerId))
        .filter((x, i, a) => a.indexOf(x) === i && m.state(x) === "fail");
      const reach = Core.reachable(meId.current, open, linkMap.current);
      setNet({ open, fail, reach });
      setPeerTyping(x => { const n = {}; Object.keys(x).forEach(k => { if (reach.indexOf(k.split("|")[0]) >= 0) n[k] = x[k]; }); return n; });
    };
    // 发给房里所有人：每条带编号和「谁说的」；直连不上的那几位由跟 TA 通着的人转过去
    const send = obj => {
      const m = mesh.current; if (!m) return;
      const env = Object.assign({ nid: Core.rid(), o: meId.current }, obj);
      seen.current.add(env.nid);
      const raw = JSON.stringify(env);
      m.openIds().forEach(id => m.sendTo(id, raw));
    };
    const sendLinks = () => { if (mesh.current) send({ t: "links", ids: mesh.current.openIds() }); };
    const onData = (fromId, raw) => {
      let e; try { e = JSON.parse(raw); } catch (_) { return; }
      if (!e || !e.nid || seen.current.has(e.nid)) return;
      seen.current.add(e.nid);
      const origin = String(e.o || fromId).slice(0, 40);
      const m = mesh.current;
      if (m) Core.forwardTargets(m.openIds(), fromId, origin, linkMap.current).forEach(id => m.sendTo(id, raw));
      const r = roomRef.current; if (!r) return;
      if (e.t === "links") { linkMap.current[origin] = (Array.isArray(e.ids) ? e.ids : []).map(String).slice(0, MAX_LINKS); syncNet(); }
      else if (e.t === "hi") {
        commit(Core.upsertRoom(Core.upsertPeer(r, origin, String(e.nick || "对方").slice(0, 20), (e.chars || []).slice(0, 8).map(Core.cleanCard))));
        if (!greeted.current.has(origin)) { greeted.current.add(origin); if (entered.current) announce(roomRef.current); }
        syncNet();
      } else if (e.t === "msg" && e.m) {
        commit(Core.addMsg(r, Object.assign(Core.wireMsg(e.m), { side: "peer", peerId: origin, by: origin })));
      } else if (e.t === "sync" && Array.isArray(e.msgs)) {
        commit(Core.mergeMsgs(r, e.msgs.slice(-600).map(x => Core.syncedMsg(x, meId.current, origin))));
      } else if (e.t === "typing" && e.id) {
        const k = origin + "|" + String(e.id).slice(0, 80), nm = String(e.name || "TA").slice(0, 20);
        setPeerTyping(x => { const n = Object.assign({}, x); if (e.on) n[k] = nm; else delete n[k]; return n; });
      } else if (e.t === "bye") {
        delete linkMap.current[origin];
        Object.keys(linkMap.current).forEach(k => { linkMap.current[k] = linkMap.current[k].filter(x => x !== origin); });
        syncNet();
      }
    };
    // 报到：名片 + 我手上的全部记录（谁断线时漏掉的，靠这一份补上；别人的话带着 by，收的人认得是谁说的）
    const announce = async r => {
      const cards = [];
      for (const c of (r.myChars || [])) { const ch = charsById[c.id]; cards.push(ch ? Core.cardOf(ch, await smallAvatar(ch)) : Core.cleanCard({ id: c.id, name: c.name })); }
      send({ t: "hi", nick: r.myNick || myNick(), chars: cards });
      send({ t: "sync", msgs: (r.msgs || []).slice(-600).map(m => Core.wireMsg(Object.assign({}, m, { by: m.side === "me" ? meId.current : (m.peerId || "") }))) });
    };
    // 断了以后连回原来那个房间：房间号、谁开的都照旧，聊天记录接着往下记（她 2026-11-22）
    const rejoin = r0 => { start(!!r0.host, r0); };
    const start = (host, resume) => {
      setErr(""); setPeerTyping({}); setNet({ open: [], fail: [], reach: [] });
      try { mesh.current && mesh.current.close(); } catch (e) {}
      mesh.current = null; linkMap.current = {}; seen.current = new Set(); greeted.current = new Set();
      const c = resume ? resume.code : host ? Core.newCode() : String(joinCode).trim();
      if (!host && !Core.validCode(c)) { setErr("房间号是 6 位数字"); return; }
      let base = resume ? (Core.loadRooms().find(x => x.id === resume.id) || resume) : null;
      if (base && !base.myPeerId) base = Core.patchRoom(base, { myPeerId: Core.rid() });   // 老房间头一回连：补一个自己的 id
      meId.current = base ? base.myPeerId : Core.rid();
      if (base) { commit(Core.patchRoom(base, { endedAt: 0 })); entered.current = true; setPage("chat"); }
      else { commit(null); entered.current = false; setPage("wait"); }
      setCode(c); setStatus("正在连…");
      const m = Mesh({ code: c, host, patient: !!resume, me: meId.current,
        knownIds: () => ((roomRef.current && roomRef.current.peers) || []).map(p => p.peerId).concat(mesh.current ? Object.keys(linkMap.current).concat(mesh.current.openIds()) : []),
        onStatus: setStatus,
        onFail: text => { if (mesh.current !== m) return; mesh.current = null; setErr(text); if (!entered.current) setPage("home"); syncNet(); },
        onLinkFail: id => { if (mesh.current !== m) return; syncNet(); if (!entered.current && !roomRef.current) setStatus("有人进来了但没接通：" + FAIL_TEXT); },
        onOpen: () => {
          if (mesh.current !== m) return;
          if (!roomRef.current) {
            const r = { id: "nr_" + Date.now(), code: c, host, myPeerId: meId.current, startedAt: Date.now(), endedAt: 0, myNick: myNick(),
              peers: [], myChars: [], msgs: [], remembered: {} };
            commit(Core.upsertRoom(r)); setPage("pick");
          } else if (entered.current) announce(roomRef.current);
          sendLinks(); syncNet();
        },
        onClose: () => { if (mesh.current !== m) return; sendLinks(); syncNet(); },
        onData });
      mesh.current = m;
    };
    const cancelWait = () => { try { mesh.current && mesh.current.close(); } catch (e) {} mesh.current = null; commit(null); setPage("home"); };
    const enter = async () => {
      const list = chars.filter(c => picked[c.id]);
      const cards = [];
      for (const c of list) cards.push(Core.cardOf(c, await smallAvatar(c)));
      commit(Core.patchRoom(roomRef.current, { myNick: myNick(), myChars: list.map(c => ({ id: c.id, name: c.remark || c.name, recent: !!withChat[c.id] })) }));
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
      // 别人看得到「X 正在输入…」：开始想就亮，说完或没说成就灭
      const typing = on => send({ t: "typing", id: c.id, name: char.remark || char.name, on });
      typing(true);
      try {
        const cur = roomRef.current;
        // 没勾「带上最近单聊」的，单聊和线下那几段不进这次的料
        const ctx0 = props.ctxFor(char), ctx = c.recent ? ctx0 : Object.assign({}, ctx0, { recentChat: "", pastOffline: "" });
        const d = await runProbe(p, ctx, { voice: true, tag: "netroom",
          instruction: Core.lineInstruction(cur, { id: char.id, name: char.remark || char.name, you: props.youFor ? props.youFor(char.id) : "" }),
          schemaHint: "{\"say\":[\"气泡1\",\"气泡2\"]}", maxTokens: 12000 });
        // 一次连发几条（她 2026-11-22：「为啥角色一次只会说一句话」）；老格式 text 也认
        const lines = Core.sayLines(d);
        if (!lines.length) throw new Error("TA 没想好说什么，再点一次");
        for (let i = 0; i < lines.length; i++) {
          if (i) await new Promise(r => setTimeout(r, Math.min(2200, 500 + lines[i].length * 60)));
          post({ id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), kind: "char", name: char.remark || char.name, charId: char.id, text: lines[i], ts: Date.now() });
        }
      } catch (e) { props.toast && props.toast("没说出来：" + ((e && e.message) || e)); }
      finally { typing(false); setBusy(b => Object.assign({}, b, { [c.id]: false })); }
    };
    // 把一个人这次的经历记进 TA 的记忆（退出卡和历史里补记都走这一处）
    const remember = async (r, charId) => {
      const char = charsById[charId];
      if (!char) throw new Error("这个人已经不在你的角色里了");
      const p = props.apiFor ? props.apiFor(char.id) : null;
      if (!p) throw new Error("先去 设置·API 配一条线路");
      const d = await runProbe(p, props.ctxFor(char), { voice: true, tag: "netroom",
        instruction: Core.memoryInstruction(r, { id: char.id, name: char.remark || char.name, you: props.youFor ? props.youFor(char.id) : "" }),
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
      // 给 bye 一点时间发出去再拆线
      await new Promise(ok => setTimeout(ok, 300));
      try { mesh.current && mesh.current.close(); } catch (e) {} mesh.current = null;
      let ok = 0;
      for (const id of ids) { try { await remember(r, id); ok++; } catch (e) { props.toast && props.toast("没记上：" + ((e && e.message) || e)); } }
      if (ok) props.toast && props.toast("记进了 " + ok + " 个人的记忆");
      setSaving(false); setRoom(null); setMemPick({}); entered.current = false; refresh(); setPage("home");
    };

    // 外壳收任意几块（顶栏、正文、底下几条）：原来只收三块，房间页多了「重新连上」那条以后输入框被挤成第四块丢掉了
    const shell = (...parts) => h("div", { "data-wk": "nrpage", "data-part": page, className: "h-full flex flex-col", style: { background: t.bg, color: t.ink } },
      ...parts.map(x => x || null));
    const scroll = kids => h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14 } }, kids);
    const label = s => h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, s);
    const card = kids => h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 14, display: "flex", flexDirection: "column", gap: 10 } }, kids);
    const withWhom = r => "和 " + (Core.peerNames(r).join("、") || "还没人");

    if (page === "wait") return shell(h(Head, { zh: "联机", onBack: cancelWait }), scroll([
      code && h("div", { key: "c", style: { textAlign: "center", paddingTop: 30 } },
        h(Note, null, "房间号"),
        h("div", { "data-wk": "nrcode", style: { fontFamily: F_DISPLAY, fontSize: fs(40), letterSpacing: 8, margin: "6px 0 10px" } }, code)),
      h("div", { key: "s", style: { textAlign: "center" } }, h(Note, null, status)),
      h(Note, { key: "n" }, "把房间号发给要来的人（算上你最多四个人），让 TA 们在「联机」里点「输入房间号加入」。第一个人连上你就能进房间，后来的人随时能进。要来的人得开着这一页；20 秒连不上会提示。")
    ]));

    if (page === "pick") return shell(h(Head, { zh: "带谁进来", onBack: () => setPage("leave") }), scroll([
      h(Note, { key: "n" }, "勾上要带进房间的人。别人只看得到 TA 们的名字和头像，人设、记忆、世界书都留在你手机上。TA 们开口用的是你自己的线路。「带上最近单聊」：TA 开口时记得你们最近在单聊里说过什么，聊天原文不发给别人，但 TA 可能自己在房间里提起。"),
      chars.length ? chars.map(c => h("label", { key: c.id, className: "flex items-center", style: { gap: 12, minHeight: 48 } },
        h("input", { type: "checkbox", checked: !!picked[c.id], onChange: e => setPicked(p => Object.assign({}, p, { [c.id]: e.target.checked })) }),
        h(Avatar, { character: c, size: 36 }),
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(14) } }, c.remark || c.name),
        picked[c.id] && h("button", { "data-wk": "nrwithchat", "data-on": withChat[c.id] ? "1" : "0", onClick: e => { e.preventDefault(); setWithChat(p => Object.assign({}, p, { [c.id]: !p[c.id] })); },
          style: { flexShrink: 0, minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + (withChat[c.id] ? t.ink : t.line), background: withChat[c.id] ? t.ink : "transparent", color: withChat[c.id] ? t.bg : t.fog, fontFamily: F_BODY, fontSize: fs(12) } },
          withChat[c.id] ? "✓ 带上最近单聊" : "带上最近单聊")))
        : h(Note, { key: "e" }, "你还没有角色，也可以只你自己进去聊。"),
      h(Btn, { key: "go", label: "进房间", primary: true, onClick: enter, wk: "nrenter" })
    ]));

    if (page === "chat" && room) {
      const myChars = (room.myChars || []);
      const alone = !mesh.current || net.reach.length === 0;
      const online = 1 + net.reach.length;
      const tail = Object.keys(busy).filter(k => busy[k]).map(k => h(Note, { key: "b" + k }, ((charsById[k] && (charsById[k].remark || charsById[k].name)) || "TA") + " 正在想…"))
        .concat(Object.keys(peerTyping).map(k => h(Note, { key: "p" + k }, peerTyping[k] + " 正在输入…")));
      // 房里每个人一格：在线 / 直连不上（别人在转）/ 连不上 / 离开了
      const stateOf = id => net.open.indexOf(id) >= 0 ? "on" : net.reach.indexOf(id) >= 0 ? "relay" : net.fail.indexOf(id) >= 0 ? "fail" : "off";
      const stateText = { on: "在线", relay: "直连不上，别人在帮你们转", fail: "和 TA 连不上", off: "离开了" };
      const peers = room.peers || [];
      const trouble = peers.filter(p => stateOf(p.peerId) === "fail" || stateOf(p.peerId) === "relay");
      return shell(
        h(Head, { zh: "房间 " + room.code, sub: "在线 " + online + " 人", onBack: () => setPage("leave"),
          right: h("button", { "data-wk": "nrleave", onClick: () => setPage("leave"), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "退出") }),
        peers.length > 0 && h("div", { "data-wk": "nrpeerbar", className: "shrink-0", style: { padding: "6px 14px", borderBottom: "1px solid " + t.line, display: "flex", flexWrap: "wrap", gap: "4px 12px" } },
          peers.map(p => { const st = stateOf(p.peerId); return h("span", { key: p.peerId, "data-wk": "nrpeer", "data-state": st, style: { fontFamily: F_BODY, fontSize: fs(11.5), color: st === "on" ? t.ink : t.fog } },
            (st === "on" ? "● " : "○ ") + p.nick + (st === "on" ? "" : " · " + stateText[st])); }),
          trouble.length > 0 && h("div", { style: { width: "100%", fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5 } },
            "和 " + trouble.map(p => p.nick).join("、") + " 直连不上：" + (trouble.some(p => stateOf(p.peerId) === "relay") ? "话由房里其他人转过去，可能慢一点。" : "TA 收不到你的话。两边都换成 Wi-Fi 再试。"))),
        h(MsgList, { room, myCharsById: charsById, tail }),
        alone && h("div", { "data-wk": "nrrejoinbar", className: "shrink-0 flex items-center", style: { gap: 10, padding: "8px 14px", borderTop: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog, lineHeight: 1.5 } }, peers.length ? "房里暂时没有别人在线。谁回来点「重新连上」就会接上；你这边断了也点一下。刚才的记录都在。" : "还没有别人进来。"),
          peers.length > 0 && h(Btn, { label: "重新连上", primary: true, onClick: () => rejoin(room), wk: "nrrejoin" })),
        h("div", { "data-wk": "nrcomposer", className: "shrink-0", style: { borderTop: "1px solid " + t.line, background: t.bg, padding: "8px 12px", paddingBottom: COMPOSER_PAD_BOTTOM } },
          myChars.length > 0 && h("div", { className: "flex items-center", style: { gap: 10, paddingBottom: 8, overflowX: "auto" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, flexShrink: 0 } }, "点谁谁说"),
            myChars.map(c => h("button", { key: c.id, "data-wk": "nrspeaker", disabled: !!busy[c.id] || alone, onClick: () => speak(c),
              className: "active:opacity-60 disabled:opacity-40", style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 44 } },
              h(Avatar, { character: charsById[c.id] || { id: c.id, name: c.name }, size: 32 }),
              h("span", { style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog } }, busy[c.id] ? "在想…" : c.name)))),
          h(Composer, { onSend: sayHuman, disabled: alone })));
    }

    if (page === "leave" && room) {
      const myChars = room.myChars || [];
      return shell(h(Head, { zh: "离开房间", onBack: () => setPage(entered.current ? "chat" : "pick") }), scroll([
        h(Note, { key: "n" }, "你走了房间还在，其他人接着聊。要不要把这次的事记进 TA 的记忆？每个人单独勾。勾上的会用你的线路把这次聊天浓缩成一两句，写进 TA 的记忆库；不勾就什么都不留在 TA 身上。房间记录照样留着，之后在「以前的房间」里也能补记、也能重新连回来。"),
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
      return shell(h(Head, { zh: "房间 " + r.code, sub: fmt(r.startedAt) + " · " + withWhom(r), onBack: () => setPage("home") }),
        h("div", { className: "flex-1 min-h-0 flex flex-col" },
          (r.myChars || []).length > 0 && h("div", { className: "shrink-0", style: { padding: "10px 14px", borderBottom: "1px solid " + t.line, display: "flex", flexWrap: "wrap", gap: 8 } },
            (r.myChars || []).map(c => h(Btn, { key: c.id, wk: "nrfill", disabled: saving || !charsById[c.id],
              label: (r.remembered || {})[c.id] ? c.name + " 已记过 · 再记一次" : "记进 " + c.name + " 的记忆", onClick: () => fill(c.id) }))),
          h("div", { className: "shrink-0", style: { padding: "10px 14px", borderBottom: "1px solid " + t.line } },
            h(Btn, { label: "重新连上这个房间", primary: true, wide: true, onClick: () => { setNick(r.myNick || nick); rejoin(r); }, wk: "nrrejoin" }),
            h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "房里还有人开着就直接接上；都走了的话，要别人也在 TA 那边的「以前的房间」里点开这个房间、点「重新连上」。记录接在后面，断开那会儿的话会补齐。")),
          h(MsgList, { room: r, myCharsById: charsById }),
          h("div", { className: "shrink-0", style: { padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid " + t.line } },
            h(Btn, { label: delAsk ? "确定删掉这个房间的记录？" : "删除这个房间的记录", disabled: saving, wk: "nrdel", onClick: () => {
              if (!delAsk) { setDelAsk(true); return; }
              Core.removeRoom(r.id); setDelAsk(false); refresh(); setPage("home"); props.toast && props.toast("删掉了；已经记进角色记忆的那几句还在");
            } }))));
    }

    // 首页
    return shell(h(Head, { zh: "联机", onBack: props.onBack }), scroll([
      h(Note, { key: "intro" }, "跟别的手机上的人开一个房间，各带自己的角色进来一起聊。算上你最多四个人；要连的人都得开着这一页。"),
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
        h(Note, { key: "priv" }, "别人只看得到你带的人的名字和头像，人设、记忆、世界书不出你的手机。聊天记录每人各存一份。")
      ]),
      label("以前的房间"),
      rooms.length ? rooms.map(r => h("button", { key: r.id, "data-wk": "nrhist", onClick: () => { setViewId(r.id); setPage("view"); }, className: "active:opacity-70",
        style: { textAlign: "left", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2, padding: "10px 14px", color: t.ink } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, withWhom(r) + " · 房间 " + r.code),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, marginTop: 2 } }, fmt(r.startedAt) + " · " + (r.msgs || []).length + " 条")))
        : h(Note, { key: "none" }, "还没开过房间。")
    ]));
  }
  if (typeof window !== "undefined") window.NetRoomApp = NetRoomApp;
})(typeof window !== "undefined" ? window : globalThis);
