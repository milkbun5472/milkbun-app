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
// 记进记忆：退出时一人一格勾选；勾了的照「一起看」那条路——用第三人称浓缩一两句（跟记忆库其余条目一个口径），
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
  //   local=true 是落存档那一份（图换成本机引用）；不写是发上线那一份（带压小的图，不带本机引用）
  function wireMsg(m, local) {
    const w = { id: String(m.id), kind: m.kind === "char" ? "char" : "user", name: String(m.name || "").slice(0, 40),
      charId: m.kind === "char" ? String(m.charId || "") : "", text: String(m.text || "").slice(0, 8000), ts: Number(m.ts) || Date.now(),
      by: String(m.by || "").slice(0, 40) };
    if (m.turnId) w.turnId = String(m.turnId).slice(0, 60);
    if (m.edited) w.edited = true;
    if (m.recalled) { w.recalled = true; w.text = ""; return w; }
    const x = m.type ? cleanRich(m.type, m.x, local) : null;
    if (x) { w.type = m.type; w.x = x; w.text = richLine(w).slice(0, 8000); }
    return w;
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
  //   已经有的那条：补发来的那份是改过字／撤回过的（同一个人说的），照它换上——断线那会儿别人改的字，连回来也对得上
  function mergeMsgs(room, list) {
    const byId = {}; (list || []).forEach(m => { if (m && m.id) byId[m.id] = m; });
    let changed = false;
    const cur = (room.msgs || []).map(m => {
      const x = byId[m.id];
      if (!x || m.sys || x.side !== m.side || (m.side === "peer" && x.peerId !== m.peerId)) return m;
      if (x.recalled && !m.recalled) { changed = true; const o = Object.assign({}, m, { recalled: true, text: "" }); delete o.x; delete o.type; return o; }
      if (x.edited && !m.recalled && x.text && x.text !== m.text) { changed = true; return Object.assign({}, m, { text: x.text, edited: true }); }
      return m;
    });
    const have = new Set(cur.map(m => m.id));
    const add = (list || []).filter(m => m && m.id && !have.has(m.id));
    if (!add.length && !changed) return room;
    const msgs = cur.concat(add).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
    return upsertRoom(Object.assign({}, room, { msgs }));
  }
  // 补发来的一条：by 是我自己 → 记成我说的；否则记在 by 那个人名下（没写 by 的算发来的那个人）
  function syncedMsg(x, myPeerId, sender) {
    const w = wireMsg(wireMsg(x), true), by = w.by || sender;   // 补发来的不收图（存档里不放整张图）
    return by === myPeerId ? Object.assign(w, { side: "me" }) : Object.assign(w, { side: "peer", peerId: by });
  }
  // 退出那张卡：勾了谁就只记谁；勾的必须是我自己带来的人（对面的人不归我记）
  function memoryTargets(myChars, picks) {
    const p = picks || {};
    return (myChars || []).filter(c => c && p[c.id] === true).map(c => c.id);
  }
  // 房间记录 → 给模型读的那一段：只有「谁：说了什么」，别人带来的人只是一个名字
  //   opts.stamp(ts)：跟单聊给模型的记录同一种时间戳（app.js 的 aiStampFor → fmtStampAI，「今天14:32」「昨天…」「11/18（周二，4天前）…」），
  //   不给就不标。撤回的只留「撤回了一条消息」，原文不给模型；进出房间那几行照原样一行。
  function transcript(room, opts) {
    room = normalizeRoom(room);
    const stamp = opts && typeof opts.stamp === "function" ? opts.stamp : null;
    return (room.msgs || []).map(m => {
      const st = stamp ? stamp(m.ts) : "", pre = st ? "〔" + st + "〕" : "";
      if (m.sys) return pre + "（" + String(m.text || "").trim() + "）";
      const who = m.kind === "char" ? m.name + "（" + ownerNick(room, m) + " 带来的）" : ownerNick(room, m);
      if (m.recalled) return pre + who + " 撤回了一条消息";
      const body = m.type ? richLine(m) : String(m.text || "").trim();
      return pre + (m.type === "pat" ? "" : who + "：") + body + (m.edited ? "（改过）" : "");
    }).join("\n");
  }
  // 离最后一条过去多久：隔得久了模型才知道不是刚说完
  function sinceLast(room, now) {
    const ms = (room.msgs || []).filter(m => !m.sys), last = ms[ms.length - 1];
    if (!last || !last.ts) return "";
    const min = Math.round(((now || Date.now()) - Number(last.ts)) / 60000);
    if (min < 3) return "";
    return min < 60 ? min + " 分钟" : min < 60 * 24 ? Math.round(min / 60) + " 小时" : Math.round(min / 1440) + " 天";
  }
  function bans() {
    return (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n\n" + ECHO_QUESTION_BAN : "")
      + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n\n" + REGISTER_FOLLOWS_SCENE : "")
      + (root.ReplyPacing && typeof root.ReplyPacing.reading === "function" ? "\n\n" + root.ReplyPacing.reading() : "");
  }
  // 房间里每一方：「某某，TA 带来的是：甲、乙」一行一个
  //   presence：{ peerId: on / relay / fail / off }。给了就写上此刻在不在：离开的人听不见房里说话
  const PRESENCE_ZH = { on: "此刻在房里", relay: "此刻在房里", fail: "此刻跟这边连不上，听不到房里说的话", off: "已经离开了房间，听不到房里说的话" };
  function sidesLines(room, presence) {
    return (room.peers || []).map(p => {
      const names = (p.chars || []).map(c => c.name).filter(Boolean);
      const st = presence && PRESENCE_ZH[presence[p.peerId] || "off"];
      return "\n- " + p.nick + (names.length ? "，TA 带来的是：" + names.join("、") : "，没带人") + (st ? "（" + st + "）" : "") + "。";
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
  // opts：{ stamp, now, presence, emotes:[关键词], targets:[能拍的名字] }——都是可选的
  function capLines(room, char, opts) {
    const o = opts || {}, bits = [];
    const emotes = (o.emotes || []).filter(Boolean);
    if (emotes.length) bits.push("\"emote\":\"表情关键词\"——想甩一张表情包时填，只能从这几张里挑：" + emotes.slice(0, 120).join(" / ") + "。发多发少看你这个人");
    const tg = (o.targets || []).filter(x => x && x !== char.name);
    if (tg.length) bits.push("\"pat\":\"名字\"——想用「拍一拍」戳房里谁一下就填 TA 的名字（" + tg.join("、") + "）；是一个动作，不用再在 say 里写「拍了拍」");
    const poll = (room.msgs || []).slice().reverse().find(m => m.type === "poll" && !m.recalled && m.x && !(m.x.options || []).some(op => (op.voters || []).indexOf(char.name) >= 0));
    if (poll) bits.push("\"vote\":\"选项原文\"——房里那张" + (poll.x.ask ? "请示「" + poll.x.ask.what + "」（选项：准 / 驳）" : "投票「" + poll.x.title + "」（选项：" + poll.x.options.map(op => op.text).join(" / ") + "）") + "你还没投，想投就填");
    return bits.length ? "\n\n【顺手能做的】说话以外，这一次还可以在同一个 JSON 里加：\n- " + bits.join("\n- ") + "\n不想做就省略。红包不用你管：房里有红包时你会自己去抢。" : "";
  }
  function lineInstruction(room, char, opts) {
    room = normalizeRoom(room);
    const o = opts || {}, gap = sinceLast(room, o.now);
    const mine = (room.myChars || []).filter(c => c.id !== char.id).map(c => c.name);
    const n = 1 + (room.peers || []).length;
    return "【这里是联机房间】" + room.myNick + " 用自己的手机和别人的手机连在了一起，房间里一共 " + n + " 个人，每人各带了自己的人进来，大家在同一个房间里说话。"
      + "\n- 带你来的是 " + youLine(room, char) + (mine.length ? "，跟你一起来的还有：" + mine.join("、") : "") + "。"
      + "\n另外几方：" + (sidesLines(room, o.presence) || "\n- （还没别人进来）")
      + "\n别人带来的这几位你只知道名字和他们在这里说过的话，其余的你不知道，也不用替他们补。"
      + "\n\n【房间里到现在的全部聊天】" + (o.stamp ? "（每行前面〔〕里是那句话说的时间，只是时间标记，不要写进你说的话）" : "") + "\n" + (transcript(room, o) || "（还没人说话）")
      + (o.game ? "\n\n" + o.game : "")
      + (gap ? "\n（最后一条到现在已经过去 " + gap + " 了）" : "")
      + "\n\n【这一次】轮到你在房间里开口，接着上面的话开口，照你平时发消息的习惯：一条一个气泡，想连发几条就几条，跟在群里聊天一样。只写你说出口的话本身，不写旁白，不替别人说话。"
      + capLines(room, char, o)
      + bans();
  }
  // 模型交回来的几条气泡：say 数组为主；只给了一段 text 的，按空行/换行拆开
  function sayLines(d) {
    const arr = d && Array.isArray(d.say) ? d.say : d && typeof d.say === "string" ? [d.say] : d && d.text ? [d.text] : [];
    return arr.map(x => String(x == null ? "" : x)).join("\n").split(/\n+/).map(x => x.trim()).filter(Boolean);   // 一轮几条不设上限（她 2026-11-22），照 TA 自己想说多少
  }
  // ── 一起说（她 2026-11-22「有俩角色带进来的时候能让他们同时一个调用都说吗，跟群里一样」）──
  //   一次调用写几个人，形状照群聊线上：每人那一段（人设、心情、记忆、关系）由调用方用群聊那套拼好递进来（cast），
  //   这儿只摆房间这一层（几方、谁在线、带时间的记录）和群聊那份输出格式；输出用群聊同一套解析认人（jointLines）。
  //   chars：[{ id, name, you, emotes:[关键词] }]；opts 同 lineInstruction，另加 cast（成员那一大段）
  function jointInstruction(room, chars, opts) {
    room = normalizeRoom(room);
    const o = opts || {}, gap = sinceLast(room, o.now), list = (chars || []).filter(c => c && c.name);
    const names = list.map(c => c.name), n = 1 + (room.peers || []).length;
    const others = (room.myChars || []).filter(c => names.indexOf(c.name) < 0).map(c => c.name);
    const you = list.map(c => "\n- 带「" + c.name + "」来的是 " + youLine(room, c) + "。").join("");
    const emo = list.filter(c => (c.emotes || []).length).map(c => "\n  · " + c.name + "：" + c.emotes.slice(0, 80).join(" / ")).join("");
    const tg = (o.targets || []).filter(Boolean);
    const poll = (room.msgs || []).slice().reverse().find(m => m.type === "poll" && !m.recalled && m.x);
    const pollLine = poll ? "\"vote\":\"选项原文\"——房里那张" + (poll.x.ask ? "请示「" + poll.x.ask.what + "」（选项：准 / 驳）" : "投票「" + poll.x.title + "」（选项：" + poll.x.options.map(op => op.text).join(" / ") + "）") + "，还没投的人想投就在自己那条里填" : "";
    return (typeof groupBans === "function" ? groupBans({ echo: false }) + "\n\n" : "")
      + (typeof GROUP_MULTI_BUBBLE === "string" ? GROUP_MULTI_BUBBLE + "\n\n" : "")
      + "【这里是联机房间】" + room.myNick + " 用自己的手机和别人的手机连在了一起，房间里一共 " + n + " 个人，每人各带了自己的人进来，大家在同一个房间里说话。"
      + "\n这一次由你写「" + names.join("」「") + "」这几位在房间里接着往下说：写谁那一条你就是谁，像群里那样你一言我一语，接彼此的话也行、接房里别人的话也行，不是每人都得开口，同一个人也可以连发几条。"
      + you + (others.length ? "\n- 同一边带来、这一次不开口的还有：" + others.join("、") + "。" : "")
      + "\n另外几方：" + (sidesLines(room, o.presence) || "\n- （还没别人进来）")
      + "\n别人带来的人、房里的真人，你只知道名字和他们在这里说过的话，其余的不知道，也不替他们说话。"
      + (o.cast ? "\n\n" + o.cast : "")
      + "\n\n【房间里到现在的全部聊天】" + (o.stamp ? "（每行前面〔〕里是那句话说的时间，只是时间标记，不要写进说的话）" : "") + "\n" + (transcript(room, o) || "（还没人说话）")
      + (o.game ? "\n\n" + o.game : "")
      + (o.stamp ? "\n（现在是〔" + o.stamp(o.now || Date.now()) + "〕）" : "")
      + (gap ? "\n（最后一条到现在已经过去 " + gap + " 了）" : "")
      + "\n\n【输出】只输出 JSON 数组，按说话先后排。每一条 {\"name\":\"说话的人，只能是 " + names.join(" / ") + " 之一\",\"text\":\"说出口的话本身，一条一个气泡\""
      + (emo ? ",\"emote\":\"（可选）想甩表情包时填关键词，只能从这个人自己那几张里挑\"" : "")
      + (tg.length ? ",\"pat\":\"（可选）想用「拍一拍」戳谁就填名字（" + tg.join("、") + "），是一个动作，不用再在 text 里写\"" : "")
      + (pollLine ? ",\"vote\":\"（可选）" + pollLine + "\"" : "") + "}。"
      + (emo ? "\n各人能用的表情：" + emo : "")
      + "\n红包不用管：房里有红包时各人会自己去抢。"
      + bans();
  }
  // 模型交回来的那份数组 → 一条条要发的：认人照群聊（pickMember + 身份闸），不在这次名单里的整条丢掉
  //   chars：这次开口的那几位（真角色对象，带 id / name / remark）。返回 [{ char, text, emote, pat, vote }]
  function jointLines(raw, chars, userName) {
    const members = (chars || []).filter(c => c && c.name);
    let arr = typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : (() => { try { return JSON.parse(raw); } catch (e) { return null; } })();
    if (arr && !Array.isArray(arr) && typeof arr === "object") arr = ["items", "messages", "replies", "list"].map(k => arr[k]).find(Array.isArray) || (arr.name ? [arr] : null);
    if (!Array.isArray(arr) && typeof salvageGroupLines === "function") { const sv = salvageGroupLines(raw); if (sv.length) arr = sv; }
    if (!Array.isArray(arr)) return [];
    const pick = (typeof pickMember === "function" ? n => pickMember(members, n) : n => members.find(c => c.name === n || c.remark === n) || null);
    arr = arr.map(it => { if (!it || typeof it !== "object") return null; const c = pick(it.name); return c ? Object.assign({}, it, { name: c.name, _c: c }) : null; }).filter(Boolean);
    const G = root.GroupIdentityGuard;
    if (G && typeof G.sanitize === "function") arr = G.sanitize(arr, members, userName).items;
    const s = v => typeof v === "string" && v.trim() && v.trim() !== "null" ? v.trim() : "";
    return arr.map(it => ({ char: it._c || members.find(c => c.name === it.name), text: String(it.text == null ? "" : it.text).trim(), emote: s(it.emote), pat: s(it.pat), vote: s(it.vote) }))
      .filter(x => x.char && (x.text || x.emote || x.pat));   // 一起说也不设条数上限（她 2026-11-22）
  }
  // 上次给这个人记到哪儿了：remembered[charId] 存的是记到的最后一条的时间。新的＝那以后的；before＝之前最后几条，只当上下文
  function sinceRemembered(room, charId) {
    const all = ((room && room.msgs) || []).filter(m => m && !m.recalled);
    const last = Number(((room && room.remembered) || {})[charId]) || 0;
    const fresh = all.filter(m => (Number(m.ts) || 0) > last);
    const before = last ? all.filter(m => (Number(m.ts) || 0) <= last).slice(-4) : [];
    const upTo = fresh.reduce((x, m) => Math.max(x, Number(m.ts) || 0), last);
    return { fresh, before, upTo, last };
  }
  // 单聊里带的那一段：标题说清是哪儿、跟谁，正文是这一段最后十几句（带时间）
  function echoText(room, fresh, charName, you) {
    room = normalizeRoom(room);
    const tail = (fresh || []).filter(m => m && !m.recalled).slice(-14);
    if (!tail.length) return "";
    const who = peerNames(room);
    return "【前几天在联机房间里（" + (you || room.myNick) + " 带 " + (charName || "你") + " 去的" + (who.length ? "，跟 " + who.join("、") + " 那边的人" : "") + "）·真实发生过、你都记得·最后几句原话】已经结束了，"
      + (you || room.myNick) + " 在房间里叫「" + room.myNick + "」\n" + transcript(Object.assign({}, room, { msgs: tail }));
  }
  function memoryInstruction(room, char, before) {
    room = normalizeRoom(room);
    const prev = before && before.length ? "\n\n【上次已经记过的部分，最后几句只当上下文，别再记一遍】\n" + transcript(Object.assign({}, room, { msgs: before })) : "";
    return (youAlias(room, char) ? "（" + youAlias(room, char) + "）\n" : "") + "把下面这次「" + (char.you || room.myNick) + " 带你进联机房间，跟 " + (peerNames(room).join("、") || "别人") + " 那边的人聊天」的经历，写成一小段会长期记住的事（几句到一段，照实际聊了多少来，别凑字数也别压成一两句）。"
      // 第三人称（她 2026-11-22）：跟记忆库里单聊、群聊、线下抽出来的那些一个口径，混着注入时不会分不清「我」是谁
      + "写成第三人称：用名字称呼「" + (char.name || "TA") + "」和「" + (char.you || room.myNick) + "」，不写「我」「你」。"
      + "有则写、无则跳：见了谁、聊了什么话题、谁说了什么要紧的话或玩笑、气氛怎么样、有没有约好什么、跟谁更熟了一点、" + (char.name || "TA") + " 自己说过的要紧的话。不记流水账。别人带来的人你只知道名字和他们在这里说的话。"
      + "\n房间里的几方：" + sidesLines(room)
      + prev + "\n\n" + (prev ? "【上次记过以后新聊的，只记这一段】" : "【这次房间里的全部聊天】") + "\n" + transcript(room);
  }

  // ───────────── 加号里那些消息（她 2026-11-22：「聊天能不能带上我们聊天加号里面那一堆功能」） ─────────────
  // 一条消息多带两样：type（是哪一种）和 x（那一种自己的几样字段，cleanRich 一样一样挑）。text 永远是给人读、给模型读的那一行，
  //   旧版对端不认得 type 就只拿到 text——显示成一行字，不会崩。
  // 图片在线上是压小了的 dataURL（img），落到存档里换成本机图库的引用（imageRef / url 是 iv_…），存档里不放整张图。
  //   补发记录（sync）不带图：断线时漏掉的那张，补回来只剩说明那一行。
  const CHUNK = 12000;                                   // 一片多少字：DataChannel 跨浏览器能稳收的一条在 16KB 上下，留余量
  const IMG_MAX = { photo: 160000, emote: 60000 };       // 线上那张图最长多少字（压不进去就再缩）
  const FILE_TEXT_MAX = 12000;
  // game＝小游戏邀请卡、gamerec＝战绩卡（白名单在 js/netroom-games.js 的 cleanInvite / cleanRecord）
  const RICH_TYPES = ["emote", "photo", "voice", "geo", "pat", "rp", "poll", "namecard", "file", "game", "gamerec"];
  const GC = () => root.NetGameCore || null;
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const isImg = (v, max) => typeof v === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(v) && v.length <= max;
  const localRef = v => typeof v === "string" && /^(iv_|img_)[\w-]+$/.test(v) ? v.slice(0, 80) : "";
  const money = v => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
  const names = (a, n) => (Array.isArray(a) ? a : []).map(x => cut(x, 40)).filter((x, i, arr) => x && arr.indexOf(x) === i).slice(0, n);
  function cleanRich(type, x, local) {
    if (RICH_TYPES.indexOf(type) < 0 || !x || typeof x !== "object") return null;
    if (type === "emote") {
      const o = { keyword: cut(x.keyword, 40) };
      if (/^https?:\/\//.test(String(x.url || ""))) o.url = cut(x.url, 600);
      else if (local && localRef(x.url)) o.url = localRef(x.url);
      if (!local && isImg(x.img, IMG_MAX.emote)) o.img = x.img;
      return o;
    }
    if (type === "photo") {
      const o = { desc: cut(x.desc, 300) };
      if (local && localRef(x.imageRef)) o.imageRef = localRef(x.imageRef);
      if (!local && isImg(x.img, IMG_MAX.photo)) o.img = x.img;
      return o;
    }
    if (type === "voice") { const o = { content: cut(x.content, 2000) }; const d = Math.round(Number(x.dur) || 0); if (d > 0) o.dur = Math.min(600, d); return o; }
    if (type === "geo") return { name: cut(x.name, 60) };
    if (type === "pat") return { to: cut(x.to, 40) };
    if (type === "rp") {
      const count = Math.max(1, Math.min(50, Math.round(Number(x.count) || 1)));
      return { rpId: cut(x.rpId, 60), total: money(x.total), count, message: cut(x.message, 40),
        claims: (Array.isArray(x.claims) ? x.claims : []).slice(0, count).map(c => ({ key: cut(c && c.key, 90), name: cut(c && c.name, 40), amount: money(c && c.amount) })) };
    }
    if (type === "poll") {
      const o = { pollId: cut(x.pollId, 60), title: cut(x.title, 60), anon: !!x.anon,
        options: (Array.isArray(x.options) ? x.options : []).slice(0, 6).map(op => ({ text: cut(op && op.text, 40), voters: names(op && op.voters, 30) })) };
      if (x.ask && typeof x.ask === "object") o.ask = { what: cut(x.ask.what, 40), reason: cut(x.ask.reason, 120), amount: money(x.ask.amount) };
      return o;
    }
    if (type === "namecard") { const c = cardOf({ id: "card", name: x.name, avatarEmoji: x.emoji, color: x.color }, x.avatar); return { name: c.name, avatar: c.avatar, emoji: c.emoji, color: c.color }; }
    if (type === "game") return GC() ? GC().cleanInvite(x) : null;
    if (type === "gamerec") return GC() ? GC().cleanRecord(x) : null;
    if (type === "file") return { name: cut(x.name, 80), size: Math.max(0, Number(x.size) || 0), chars: Math.max(0, Number(x.chars) || 0), cut: !!x.cut, text: cut(x.text, FILE_TEXT_MAX) };
    return null;
  }
  // 一条消息给人读、给模型读的那一行
  function richLine(m) {
    const x = m.x || {}, who = m.name || "TA";
    if (m.type === "emote") return "[表情] " + (x.keyword || "");
    if (m.type === "photo") return x.desc ? "[照片] " + x.desc : "[照片]";
    if (m.type === "voice") return "[语音] " + (x.content || "");
    if (m.type === "geo") return "[位置] " + (x.name || "");
    if (m.type === "pat") return who + " 拍了拍 " + (x.to || "TA");
    if (m.type === "rp") {
      const cl = x.claims || [];
      return "[红包] " + (x.message || "恭喜发财，大吉大利") + "（" + x.count + " 个，只是玩法不动钱包）"
        + (cl.length ? "：" + cl.map(c => c.name + " 抢到 " + c.amount).join("、") + (cl.length >= x.count ? "，已被领完" : "") : "：还没人抢");
    }
    if (m.type === "poll") {
      const ops = (x.options || []).map(o => o.text + (x.anon ? "（" + o.voters.length + " 票）" : "（" + (o.voters.length ? o.voters.join("、") : "没人") + "）")).join(" / ");
      if (x.ask) return "[请示] " + who + "：" + x.ask.what + (x.ask.amount ? "（" + x.ask.amount + " 块）" : "") + (x.ask.reason ? "；理由：" + x.ask.reason : "") + "。大家投准或驳：" + ops;
      return "[投票] " + x.title + "：" + ops;
    }
    if (m.type === "namecard") return "[名片] " + (x.name || "");
    if (m.type === "game") return GC() ? GC().inviteLine(x) : "[小游戏邀请] " + (x.zh || "");
    if (m.type === "gamerec") return GC() ? GC().recordLine(x) : "[小游戏战绩] " + (x.zh || "") + "：" + (x.text || "");
    if (m.type === "file") return "[文件] " + (x.name || "文件") + "（" + (x.chars || 0) + " 字" + (x.cut ? "，只给了前面一段" : "") + "）\n" + String(x.text || "").slice(0, 4000);
    return String(m.text || "");
  }
  // 大的一条拆成几片发；收的那头按 来源|编号 拼回来，拼齐了才交出去
  function splitRaw(raw, size) {
    const n = Math.max(1, Math.ceil(raw.length / (size || CHUNK))), out = [];
    for (let i = 0; i < n; i++) out.push(raw.slice(i * (size || CHUNK), (i + 1) * (size || CHUNK)));
    return out;
  }
  function Joiner(ttl) {
    const box = {};
    return function (key, i, n, d, now) {
      const t = now || Date.now();
      Object.keys(box).forEach(k => { if (t - box[k].at > (ttl || 60000)) delete box[k]; });
      n = Math.round(Number(n)); i = Math.round(Number(i));
      if (!(n >= 1 && n <= 400 && i >= 0 && i < n) || typeof d !== "string") return null;
      const b = box[key] || (box[key] = { at: t, n, parts: {} });
      if (b.n !== n) return null;
      b.parts[i] = d;
      if (Object.keys(b.parts).length < n) return null;
      delete box[key];
      let s = ""; for (let k = 0; k < n; k++) s += b.parts[k];
      return s;
    };
  }
  // 红包：钱只是玩法（联机房里各人的钱包谁也看不见谁的，就像群里没开记忆互通时那样不动钱）。
  //   怎么拆只有发的那台手机知道（splits 不上线）；谁抢都要问发的那台，它按到达先后发下一份，再把领取名单广播给大家。
  function grabRp(x, splits, who) {
    if (!x || !Array.isArray(splits) || !splits.length || !who || !who.key) return { reason: "gone" };
    const cl = x.claims || [];
    if (cl.some(c => c.key === who.key)) return { reason: "claimed" };
    if (cl.length >= x.count || cl.length >= splits.length) return { reason: "empty" };
    const amount = money(splits[cl.length]);
    return { amount, x: Object.assign({}, x, { claims: cl.concat([{ key: String(who.key).slice(0, 90), name: cut(who.name, 40), amount }]) }) };
  }
  // 投一票：先从别的选项里把这个名字拿掉，再放进选的那一项（改票就是再投一次）
  function votePoll(x, opt, name) {
    const i = Math.round(Number(opt)), nm = cut(name, 40);
    if (!x || !nm || !(i >= 0 && i < (x.options || []).length)) return x;
    return Object.assign({}, x, { options: x.options.map((o, k) => ({ text: o.text, voters: (o.voters || []).filter(v => v !== nm).concat(k === i ? [nm] : []) })) });
  }
  // 请示什么时候算结案：房里除了递的人，其余人（真人和带来的角色）都投过了；过半准，一样多算驳
  function askResult(x, voterTotal) {
    if (!x || !x.ask) return null;
    const yes = ((x.options || [])[0] || {}).voters || [], no = ((x.options || [])[1] || {}).voters || [];
    if (yes.length + no.length < Math.max(1, voterTotal)) return null;
    return { status: yes.length > no.length ? "approved" : "rejected" };
  }
  // 重新说：把同一轮（turnId 一样的那几条）整个换成新的那几条，放回原来的位置
  function replaceTurn(room, turnId, list) {
    const msgs = (room.msgs || []);
    let at = msgs.findIndex(m => m.turnId === turnId);
    const rest = msgs.filter(m => m.turnId !== turnId);
    if (at < 0) at = rest.length;
    const add = (list || []).map(m => Object.assign({}, m, { turnId }));
    return Object.assign({}, room, { msgs: rest.slice(0, at).concat(add, rest.slice(at)) });
  }
  // 改字、撤回：只认发这条的那一端。who 是 "me"（自己手机上改自己的）或对面某人的 peerId；
  //   对面冒名改我的、改第三个人的，一律原样还回去。type 是卡片的（红包、投票……）不给改字，只能撤回。
  function ownsMsg(m, who) { return !!m && !m.sys && (who === "me" ? m.side === "me" : m.side === "peer" && m.peerId === who); }
  function editMsg(room, id, text, who) {
    const t = cut(text, 8000).trim();
    if (!t) return room;
    let hit = false;
    const msgs = (room.msgs || []).map(m => { if (m.id !== id || !ownsMsg(m, who) || m.recalled || m.type) return m; hit = true; return Object.assign({}, m, { text: t, edited: true }); });
    return hit ? Object.assign({}, room, { msgs }) : room;
  }
  function recallMsg(room, id, who) {
    let hit = false;
    const msgs = (room.msgs || []).map(m => {
      if (m.id !== id || !ownsMsg(m, who) || m.recalled) return m;
      hit = true;
      const o = Object.assign({}, m, { recalled: true, text: "" }); delete o.x; delete o.type; return o;
    });
    return hit ? Object.assign({}, room, { msgs }) : room;
  }
  // 只删我这边：不发给谁
  const dropMsg = (room, id) => Object.assign({}, room, { msgs: (room.msgs || []).filter(m => m.id !== id) });
  // 发的人删掉自己那条（两边一起删、不留「撤回了」那行）：跟改字一样只认发这条的那一端，冒名的原样还回去
  function dropOwnMsg(room, id, who) { const m = (room.msgs || []).find(x => x.id === id); return m && ownsMsg(m, who) ? dropMsg(room, id) : room; }
  // 进出房间那一行（灰字）：每台手机自己看见了就自己记一笔，不发给别人
  const sysMsg = (text, ts) => ({ id: "s" + (ts || Date.now()) + Math.random().toString(36).slice(2, 6), sys: true, side: "sys", kind: "user", name: "", text: cut(text, 200), ts: ts || Date.now() });

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
    let ws = null, ping = null, closed = false, pid = 1, lastRx = 0;
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
            lastRx = Date.now();
            feed(new Uint8Array(ev.data)).forEach(pk => {
              if (pk.type === 2) {
                clearTimeout(tm);
                if (pk.code !== 0) return fail(new Error("被拒绝了"));
                settled = true; ok(api);
                // 心跳：手机锁屏/切后台回来，这条线常常已经死了却不报 onclose——40 秒没收到任何东西就当断了，关掉重接
                lastRx = Date.now();
                ping = setInterval(() => {
                  if (Date.now() - lastRx > 40000) { try { ws.close(); } catch (e) {} return; }
                  try { ws.send(mqtt.ping()); } catch (e) {}
                }, 15000);
              } else if (pk.type === 9) { const w = subWaits.shift(); w && w(); }
              else if (pk.type === 3 && !closed) { try { onMessage(pk.topic, pk.payload); } catch (e) {} }
            });
          };
        });
      },
      subscribe(topic) { return new Promise(ok => { subWaits.push(ok); ws.send(mqtt.subscribe(pid++, topic)); setTimeout(ok, 3000); }); },
      publish(topic, obj) { try { ws.send(mqtt.publish(topic, JSON.stringify(obj))); } catch (e) {} },
      alive() { return !!ws && ws.readyState === 1 && Date.now() - lastRx < 40000; },
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
  const HB = "\u0000hb";   // 直连心跳（不当消息处理）
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
        L.state = "open"; L.rx = Date.now(); clearTimeout(L.timer); anyOpen = true; stopHello();
        o.onOpen && o.onOpen(id, ch);
      };
      ch.onclose = () => { if (links[id] !== L) return; const was = L.state === "open"; drop(id); if (was) o.onClose && o.onClose(id); };
      ch.onmessage = ev => { if (links[id] !== L) return; L.rx = Date.now(); if (ev.data === HB) return; o.onData && o.onData(id, ev.data); };
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
    // 房里还有认识的人没连上（对方锁屏、切后台、刚回来）：隔一会儿在中转上再喊一声「我在」，
    //   不再是一连上一个人就永远闭嘴——原来那样，先连上的那一个之外，晚醒的人谁也找不到你（她 11-22：「有时候能重连回去有时候回不去」）
    const missing = () => { const open = openIds(); return (o.knownIds ? o.knownIds() : []).filter(id => id && id !== o.me && open.indexOf(id) < 0); };
    const beat = setInterval(() => {
      if (dead) return;
      // 直连心跳：每 5 秒互相点一下；20 秒没收到对方任何东西＝那条线其实已经死了（对方锁屏/断网不一定报 onclose），当断开处理，好让 TA 回来时能重新接上
      Object.keys(links).forEach(id => { const L = links[id];
        if (L.state !== "open") return;
        try { L.dc && L.dc.readyState === "open" && L.dc.send(HB); } catch (e) {}
        if (Date.now() - (L.rx || 0) > 20000) { drop(id); o.onClose && o.onClose(id); } });
      if (!hello && link && missing().length && (++slow % 2 === 0)) pub({ t: "hello" });
    }, 5000);
    let slow = 0;
    // 中转那条线掉了：隔几秒自己再接上（房间里的直连不受影响，只是新人/回来的人暂时找不到）
    const openLink = async first => {
      try { link = await openBroker(onMessage, () => { link = null; if (!dead) setTimeout(() => openLink(false), 3000); }); }
      catch (e) { if (first) return fail("房间号这一步没走通：网络连不上，过一会儿再试"); if (!dead) setTimeout(() => openLink(false), 5000); return; }
      if (dead) { link.close(); return; }
      await link.subscribe(topic);
      if (!first) { if (missing().length) pub({ t: "hello" }); return; }
      if (o.host && !o.patient) o.onStatus && o.onStatus("等别人输入房间号…");
      else { o.onStatus && o.onStatus(o.patient ? "等别人也点「重新连上」…" : "正在找房间…"); sayHello(); }
    };
    const api = {
      openIds,
      state: id => (links[id] ? links[id].state : ""),
      sendTo(id, raw) { const L = links[id]; try { L && L.state === "open" && L.dc && L.dc.readyState === "open" && L.dc.send(raw); } catch (e) {} },
      close() { dead = true; clearInterval(beat); stopHello(); try { link && link.close(); } catch (e) {} link = null; Object.keys(links).forEach(drop); }
      // 页面从后台回到前台：中转那条线多半已经死了，先换一条新的，再喊一声让还没连上的人来接
      ,wake() {
        if (dead) return;
        if (!link || !link.alive()) { const old = link; link = null; try { old && old.close(); } catch (e) {} openLink(false); }
        else if (missing().length) pub({ t: "hello" });
      }
    };
    openLink(true);
    return api;
  }

  const Core = { BROKERS, TOPIC_PREFIX, ICE_SERVERS, CONNECT_TIMEOUT, FAIL_TEXT, STORE_KEY, AVATAR_PX, MAX_PEOPLE, LEGACY,
    mqtt, topicOf, newCode, validCode, cardOf, cleanCard, wireMsg, loadRooms, saveRooms, upsertRoom, addMsg, patchRoom,
    memoryTargets, transcript, lineInstruction, capLines, sinceLast, CHUNK, IMG_MAX, RICH_TYPES, cleanRich, richLine, splitRaw, Joiner, grabRp, votePoll, askResult, replaceTurn,
    ownsMsg, editMsg, recallMsg, dropMsg, dropOwnMsg, sysMsg, sidesLines, FILE_TEXT_MAX, memoryInstruction, sayLines, jointInstruction, jointLines, mergeMsgs, removeRoom, sinceRemembered, echoText,
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
  //   fillRef：话题卡那种「把一句话填进输入框」从这儿递进来；onPlus：输入框左边那颗 ＋（跟单聊、群聊同一颗）
  function Composer({ onSend, disabled, onPlus, plusOn, fillRef }) {
    const t = useTheme();
    const [txt, setTxt] = useState("");
    const ref = useRef(null);
    if (fillRef) fillRef.current = s => { setTxt(String(s || "")); setTimeout(() => { if (ref.current) { ref.current.focus(); fitTextarea(ref.current, 120); } }, 0); };
    const send = () => { const s = txt.trim(); if (!s || disabled) return; onSend(s); setTxt(""); setTimeout(() => fitTextarea(ref.current, 120), 0); };
    return h("div", { className: "flex items-end", style: { gap: 8 } },
      onPlus && h("button", { "data-wk": "chatplus", onClick: onPlus, disabled, className: "active:opacity-60 shrink-0 flex items-center justify-center disabled:opacity-40",
        style: { width: 32, height: 40, transform: plusOn ? "rotate(45deg)" : "none", transition: "transform .2s" } }, h(IPlus, { size: 22, color: t.fog })),
      h("textarea", { "data-wk": "nrinput", ref, rows: 1, value: txt, placeholder: disabled ? "房里暂时没有别人在线" : "说点什么…", disabled,
        onChange: e => { setTxt(e.target.value); fitTextarea(e.target, 120); },
        onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } },
        style: { flex: 1, minHeight: 40, resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink,
          padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.45 } }),
      h(Btn, { label: "发送", primary: true, onClick: send, disabled: disabled || !txt.trim(), wk: "nrsend" }));
  }
  // 把一张图压到线上放得下的大小：先按边长缩，还大就降质量、再缩（src 可以是 dataURL、iv_ 引用、网址）
  async function shrinkImg(src, maxDim, maxLen) {
    if (!src || typeof document === "undefined") return "";
    let url = typeof src === "string" && src.indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function"
      ? await imgVaultFetchBlob(src).then(b => b ? URL.createObjectURL(b) : "").catch(() => "") : (typeof resolveImg === "function" ? resolveImg(src) : src);
    if (!url) return "";
    const img = await new Promise(ok => { const im = new Image(); if (/^https?:/.test(url)) im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; setTimeout(() => ok(null), 8000); });
    if (!img) return "";
    let dim = maxDim, q = 0.82;
    for (let k = 0; k < 8; k++) {
      try {
        const sc = Math.min(1, dim / Math.max(img.width || 1, img.height || 1));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round((img.width || 1) * sc)); c.height = Math.max(1, Math.round((img.height || 1) * sc));
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL("image/jpeg", q);
        if (d.length <= maxLen) return d;
      } catch (e) { return ""; }
      if (q > 0.55) q -= 0.12; else dim = Math.round(dim * 0.75);
    }
    return "";
  }
  // 收到一条带图的：图落进本机图库（iv_），存档里只留引用
  async function landImages(w) {
    if (!w || !w.x || !w.x.img) return w;
    let ref = "";
    try { ref = typeof imgToVault === "function" ? await imgToVault(w.x.img) : ""; } catch (e) {}
    const x = Object.assign({}, w.x); delete x.img;
    if (ref && ref.indexOf("iv_") === 0) { if (w.type === "photo") x.imageRef = ref; else x.url = ref; }
    return Object.assign({}, w, { x });
  }
  // 表情包要发出去的那一份：网址照发；本机的（iv_／dataURL）压成小图带上
  async function emoteWire(url) {
    if (/^https?:\/\//.test(String(url || ""))) return { url };
    const img = await shrinkImg(url, 240, Core.IMG_MAX.emote);
    return img ? { img } : {};
  }
  // 一条消息里的那张卡／那颗气泡：跟单聊、群聊用的是同一批组件
  function RichBody({ m, mine, meName, onRp, onVote, voters, game, onRec }) {
    const t = useTheme();
    const x = m.x || {};
    // 小游戏的两张卡：房间页里能点（报名、开始、回看）；以前的房间里只剩那一行字
    const UI = root.NetGameUI;
    if ((m.type === "game" || m.type === "gamerec") && (!UI || !game && m.type === "game"))
      return h("div", { "data-wk": "nrbubble", style: { padding: "8px 12px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6, maxWidth: 260 } }, Core.richLine(m));
    if (m.type === "game") return h(UI.InviteCard, Object.assign({ x }, game));
    if (m.type === "gamerec") return h(UI.RecordCard, { x, onOpen: onRec });
    if (m.type === "emote") return h(EmoteBubble, { url: x.url || "", keyword: x.keyword, max: 112 });
    if (m.type === "photo") return h(PhotoCard, { m: { imageRef: x.imageRef || "", desc: x.desc }, mine, max: 220 });
    if (m.type === "voice") return h("div", { "data-wk": "bubble", "data-me": mine ? "1" : "0", "data-kind": "voice", style: { padding: "8px 12px", borderRadius: 14, background: mine ? t.ink : t.bg2, color: mine ? t.bg : t.ink, border: "1px solid " + t.line } },
      h(VoiceMsg, { m: { content: x.content, dur: x.dur }, isU: mine, speaker: null }));
    if (m.type === "geo") return h(GeoCard, { m: { name: x.name, ts: m.ts }, isU: mine, who: m.name, avatar: null, myAvatar: null });
    if (m.type === "rp") { const done = (x.claims || []).length >= x.count;
      return h(RedPacketCard, { rp: { message: x.message, count: x.count, claims: x.claims || [] }, onClick: onRp, foot: done ? "已被领完" : "抢红包 · 只是玩法" }); }
    if (m.type === "poll" && x.ask) return h(AskSlipCard, { m: { kind: "poll", ask: x.ask, options: x.options, pollId: x.pollId, ts: m.ts, askResult: Core.askResult(x, voters) }, asker: m.name, meName, money: n => "¥" + n,
      onVote: !mine ? onVote : undefined });
    if (m.type === "poll") return h(PollCard, { poll: Object.assign({ by: m.name }, x), meName, onVote });
    if (m.type === "namecard") return h("div", { style: { width: 220 } }, h(NameCardMsg, { m: { cardId: "nrcard", cardName: x.name, cardTag: "" },
      characters: [{ id: "nrcard", name: x.name, avatarImage: x.avatar || "", avatarEmoji: x.emoji || "", color: x.color || "" }] }));
    if (m.type === "file") return h(FileCard, { m: x, actions: typeof fileCardActions === "function" ? fileCardActions(x) : null });
    return null;
  }
  function MsgRow({ m, room, myCharsById, idx, onPress, onRelease, tools, rich }) {
    const t = useTheme();
    const mine = m.side === "me";
    const owner = Core.ownerNick(room, m);
    const press = onPress ? { onTouchStart: () => onPress(idx), onTouchEnd: onRelease, onMouseDown: () => onPress(idx), onMouseUp: onRelease, onMouseLeave: onRelease,
      onContextMenu: e => { e.preventDefault(); onPress(idx, true); } } : {};
    const center = (part, text) => h("div", Object.assign({ "data-wk": "nrmsg", "data-side": m.side, "data-nri": idx, "data-part": part, style: { textAlign: "center" } }, press),
      h("span", { "data-wk": "note", "data-part": part, style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, text));
    if (m.sys) return center("sys", m.text);
    const who = m.kind === "char" ? m.name : owner;
    if (m.recalled) return center("recalled", (mine && m.kind !== "char" ? "你" : who) + " 撤回了一条消息");
    if (m.type === "pat") return center("pat", Core.richLine(m));
    let face = null;
    if (m.kind === "char") {
      const local = mine ? myCharsById[m.charId] : null;
      const peer = !mine ? (Core.peerOf(room, m.peerId) || (room.peers || [])[0]) : null;
      const card = peer ? (peer.chars || []).find(c => c.id === m.charId) : null;
      face = h(Avatar, { size: 34, character: local || { id: "nr_" + m.charId, name: m.name,
        avatarImage: card && card.avatar || "", avatarEmoji: card && card.emoji || "", color: card && card.color || "" } });
    }
    const body = m.type && rich ? rich(m) : null;
    return h("div", { "data-wk": "nrmsg", "data-side": m.side, "data-nri": idx, "data-kind": m.type || "text", className: "flex", style: { gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start" } },
      face,
      h("div", { style: { maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 3 } }, who),
        body ? h("div", press, body)
          : h("div", Object.assign({ "data-wk": "nrbubble", style: { padding: "8px 12px", borderRadius: 14, background: mine ? t.ink : t.bg2, color: mine ? t.bg : t.ink,
            border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } }, press), m.text),
        m.edited && h("div", { "data-wk": "nredited", style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog, marginTop: 2 } }, "已编辑"),
        m.kind === "char" && h("div", { "data-wk": "nrowner", style: { fontFamily: F_BODY, fontSize: fs(10.5), color: t.fog, marginTop: 3, display: "flex", alignItems: "center", gap: 8 } }, owner + " 带来的", tools || null)));
  }
  function MsgList({ room, myCharsById, tail, rowProps }) {
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
      (room.msgs || []).map((m, i) => h(MsgRow, Object.assign({ key: m.id, m, room, myCharsById, idx: i }, rowProps ? rowProps(m, i) : {}))),
      tail);
  }

  // ＋ 里的那些：跟单聊、群聊用的同一套键（ChatToolKey）。两个人之间、本机的那几样（通话、通话记录、朋友圈、转账、亲属卡、给TA看手机、邀约、半窗）不放
  const NR_PANEL = [["location", "位置", "pin"], ["sticker", "表情包", "sticker"], ["photo", "照片", "picture"], ["voicemsg", "发语音", "wave"], ["chatsearch", "查找记录", "magnifier"],
    ["poll", "投票", "bars"], ["rp", "红包", "packet"], ["ask", "请示", "checklist"], ["pat", "拍一拍", "hand"], ["namecard", "名片", "contact"], ["file", "文件", "file"], ["topics", "话题卡", "quote"], ["game", "小游戏", "dice"], ["debate", "擂台", "podium"]];
  // 擂台单独一格（她 11-22：「擂台从小游戏里面移出来放聊天加号里面」），不再摆在小游戏架子最后
  // 房间页 ＋ 面板、各个小窗、长按菜单（拆在外面，免得 NetRoomApp 一大坨）
  function roomExtras(A) {
    const { t, room, sheet, setSheet, props, myNick, charsById } = A;
    const close = () => setSheet(null);
    const people = (room.peers || []).map(p => p.nick).concat(A.patTargets(room)).filter((x, i, a) => x && a.indexOf(x) === i && x !== myNick());
    const pickList = (title, rows, onPick) => h(Sheet, { onClose: close },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(10.5), letterSpacing: 1.2, color: t.fog, marginBottom: 10 } }, title),
      h("div", { className: "space-y-1", style: { maxHeight: "50vh", overflowY: "auto" } }, rows.map(r => h("button", { key: r.key, "data-wk": "nrpick", onClick: () => { close(); onPick(r); },
        className: "w-full flex items-center gap-3 py-2.5 px-2 active:opacity-60" },
        r.char ? h(Avatar, { character: r.char, size: 34, radius: 8 }) : null,
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, r.label)))));
    const myRow = room.msgs[A.menuAt];
    return [
      A.panel && h("div", { key: "panel", "data-wk": "chatpanel", className: "shrink-0 grid grid-cols-4 gap-y-5 px-5 py-5", style: Object.assign({ background: t.bg2, borderTop: "1px solid " + t.line }, CHAT_PANEL_SCROLL) },
        NR_PANEL.filter(([k]) => (k !== "topics" || (room.myChars || []).length) && (k !== "game" || !!root.NetGameSession)).map(([k, zh, glyph]) => h(ChatToolKey, { key: k, k, zh, glyph, onTap: A.onTap }))),
      sheet === "sticker" && h(Sheet, { key: "st", onClose: close, tall: true },
        h(StickerPanel, { packs: props.emotePacks || [], emotes: [], onPick: em => { close(); A.sendEmote(em); } })),
      sheet === "photo" && h(Sheet, { key: "ph", onClose: close },
        h("div", { className: "flex items-center justify-between mb-3" },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(19), color: t.ink } }, "发送照片"),
          h("button", { "data-wk": "nrphotosend", onClick: A.sendPhoto }, h(ISend, { size: 18, color: t.ink }))),
        h(ChatPhotoPick, { imgs: A.photoImgs, setImgs: A.setPhotoImgs, toast: props.toast, t }),
        h("input", { "data-wk": "input", value: A.photoText, onChange: e => A.setPhotoText(e.target.value), placeholder: A.photoImgs.length ? "可以顺手说一句（选填）" : "不选图就写一句照片里有什么",
          className: "w-full outline-none px-4 py-3 rounded-xl", style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, background: t.bg, marginTop: 10 } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5, marginTop: 7 } }, "图会压小了再发给房里的人（一次一张）；大家的角色看到的是你写的那句说明。")),
      sheet === "voicemsg" && h(Sheet, { key: "vo", onClose: close },
        h(VoiceEarComposer, { onSend: msg => { close(); A.sayRich("voice", { content: msg.content, dur: msg.dur }); }, onClose: close, senderName: myNick(), ownerKey: props.profile && (props.profile.id || props.profile.name), toast: props.toast })),
      sheet === "geo" && h(GeoStampSheet, { key: "geo", recent: [], places: [], onMoveMe: null, onClose: close, onSend: name => { close(); A.sayRich("geo", { name }); } }),
      sheet === "pat" && pickList("拍一拍 · 拍谁", people.map(n => ({ key: n, label: n })), r => A.sayRich("pat", { to: r.label })),
      sheet === "namecard" && pickList("名片 · 发谁的（只带名字和头像）", [{ key: "_me", label: myNick() + "（我自己）", me: true }].concat((props.characters || []).map(c => ({ key: c.id, label: c.remark || c.name, char: c }))),
        r => A.sendCard(r)),
      sheet === "rp" && h(RedPacketComposeSheet, { key: "rp", noWallet: true, memberCount: Math.max(1, A.headCount(room) - 1), members: [], myBalance: 0, onClose: close,
        onSubmit: (total, count, message) => { close(); A.sendRp(total, count, message); } }),
      sheet === "poll" && h(PollComposeSheet, { key: "poll", onClose: close, onSubmit: (title, opts, anon) => { close(); A.sayRich("poll", { pollId: "pl" + Date.now(), title, anon, options: opts.map(text => ({ text, voters: [] })) }); } }),
      sheet === "ask" && h(AskComposeDialog, { key: "ask", who: "", prev: null, onCancel: close,
        onSend: a => { close(); A.sayRich("poll", { pollId: "pl" + Date.now(), title: "请示：" + a.what, anon: false, ask: { what: a.what, reason: a.reason, amount: a.amount }, options: [{ text: "准", voters: [] }, { text: "驳", voters: [] }] }); } }),
      sheet === "chatsearch" && h(ChatSearchSheet, { key: "se", chars: [], meName: myNick(), onClose: close,
        messages: room.msgs.map(m => ({ role: m.side === "me" && m.kind !== "char" ? "user" : "assistant", senderName: m.kind === "char" ? m.name : Core.ownerNick(room, m),
          content: m.sys ? m.text : m.recalled ? "" : m.type ? Core.richLine(m) : m.text, ts: m.ts, recalled: !!m.recalled })),
        onLocate: i => { close(); setTimeout(() => { const el = document.querySelector('[data-wk="nrmsg"][data-nri="' + i + '"]'); el && el.scrollIntoView({ block: "center" }); }, 60); } }),
      sheet === "topics" && h(TopicCardsSheet, { key: "tp", charId: (room.myChars || [])[0].id, onClose: close, onUse: x => { close(); A.fillRef.current && A.fillRef.current(x.text); } }),
      A.rpOpen && (() => { const rp = room.msgs.find(m => m.type === "rp" && m.x && m.x.rpId === A.rpOpen); if (!rp) return null;
        const x = rp.x, mineC = (x.claims || []).find(c => c.key === A.myKey(""));
        const canOpen = !mineC && (x.claims || []).length < x.count;
        return h(RedPacketEnvelope, { key: "rpo" + A.rpOpen, who: rp.name, whoChar: rp.side === "me" ? null : null, message: x.message, canOpen, amountText: mineC ? "¥" + mineC.amount : "",
          claims: (x.claims || []).map(c => ({ name: c.name, amount: c.amount, me: c.key === A.myKey("") })), total: x.total, count: x.count, meName: myNick(),
          status: !mineC && !canOpen ? "手慢了，红包派完了" : "", onOpen: () => A.openRp(A.rpOpen), onClose: () => A.setRpOpen(null) }); })(),
      myRow && h(MsgMenu, { key: "menu", message: { content: myRow.recalled || myRow.sys ? "" : myRow.type ? Core.richLine(myRow) : myRow.text }, idx: A.menuAt, isMine: myRow.side === "me",
        items: A.menuItems(myRow), onClose: () => A.setMenuAt(null), onAction: act => { A.setMenuAt(null); A.onMenu(act, myRow); } })
    ];
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
    const netRef = useRef({ open: [], fail: [], reach: [] }); netRef.current = net;
    const [panel, setPanel] = useState(false);       // ＋ 面板开着没
    const [sheet, setSheet] = useState(null);        // ＋ 里点开的那一样
    const [photoImgs, setPhotoImgs] = useState([]), [photoText, setPhotoText] = useState("");
    const [menuAt, setMenuAt] = useState(null);      // 长按的那一条（下标）
    const [rpOpen, setRpOpen] = useState(null);      // 点开的那个红包（rpId）
    const fillRef = useRef(null);
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
    // 发给房里所有人：每条带编号和「谁说的」；直连不上的那几位由跟 TA 通着的人转过去。
    //   太长的（带图的、补发整份记录的）拆成几片发，每片一个编号，收的那头拼齐了再认
    //   to：只发给这一个人（小游戏里只给某人看的那份），直连不上就交给一个跟 TA 通着的人转，不广播
    const send = (obj, to) => {
      const m = mesh.current; if (!m) return;
      const env = Object.assign({ nid: Core.rid(), o: meId.current }, obj, to ? { to } : {});
      seen.current.add(env.nid);
      const raw = JSON.stringify(env);
      const out = raw.length > Core.CHUNK ? Core.splitRaw(raw, Core.CHUNK).map((d, i, a) => {
        const p = Object.assign({ nid: Core.rid(), o: meId.current, t: "part", pid: env.nid, i, n: a.length, d }, to ? { to } : {});
        seen.current.add(p.nid); return JSON.stringify(p);
      }) : [raw];
      const ids = to ? routeTo(to, null) : m.openIds();
      out.forEach(r => ids.forEach(id => m.sendTo(id, r)));
    };
    const routeTo = (to, cameFrom) => GC() ? GC().privateRoute(mesh.current ? mesh.current.openIds() : [], to, linkMap.current, cameFrom) : [];
    const sendLinks = () => { if (mesh.current) send({ t: "links", ids: mesh.current.openIds() }); };
    const joiner = useRef(Core.Joiner(60000));
    const left = useRef(new Set());       // 说过 bye 的人：TA 再报到时记一行「回来了」
    const pending = useRef({});           // 我在等的红包结果：rpId → resolve
    const onData = (fromId, raw) => {
      let e; try { e = JSON.parse(raw); } catch (_) { return; }
      if (!e || !e.nid || seen.current.has(e.nid)) return;
      seen.current.add(e.nid);
      const origin = String(e.o || fromId).slice(0, 40);
      const m = mesh.current;
      // 只给某一个人的：不是给我的就只往那个人那边递一下，自己不看、也不转给别人
      if (e.to) {
        const to = String(e.to).slice(0, 40);
        if (to !== meId.current) { if (m) routeTo(to, fromId).forEach(id => m.sendTo(id, raw)); return; }
      } else if (m) Core.forwardTargets(m.openIds(), fromId, origin, linkMap.current).forEach(id => m.sendTo(id, raw));
      if (e.t === "part") {
        const full = joiner.current(origin + "|" + String(e.pid || ""), e.i, e.n, e.d);
        if (!full) return;
        let inner; try { inner = JSON.parse(full); } catch (_) { return; }
        if (!inner || !inner.nid || seen.current.has(inner.nid)) return;
        seen.current.add(inner.nid);
        handle(inner, origin);
      } else handle(e, origin);
    };
    const nickOf = id => { const p = Core.peerOf(roomRef.current, id); return (p && p.nick) || "有人"; };
    const sysLine = text => { const r = roomRef.current; if (r) commit(Core.addMsg(r, Core.sysMsg(text))); };
    const updX = (pred, fn) => { const r = roomRef.current; if (!r) return;
      let hit = false; const msgs = (r.msgs || []).map(x => { if (!pred(x)) return x; hit = true; const nx = fn(x.x); return Object.assign({}, x, { x: nx, text: Core.richLine(Object.assign({}, x, { x: nx })) }); });
      if (hit) commit(Core.upsertRoom(Object.assign({}, r, { msgs }))); };
    const handle = (e, origin) => {
      const r = roomRef.current; if (!r) return;
      if (e.t === "links") { linkMap.current[origin] = (Array.isArray(e.ids) ? e.ids : []).map(String).slice(0, MAX_LINKS); syncNet(); }
      else if (e.t === "hi") {
        const known = !!Core.peerOf(r, origin), nick = String(e.nick || "对方").slice(0, 20);
        commit(Core.upsertRoom(Core.upsertPeer(r, origin, nick, (e.chars || []).slice(0, 8).map(Core.cleanCard))));
        if (!greeted.current.has(origin)) {
          greeted.current.add(origin);
          if (entered.current) {
            if (left.current.has(origin)) { left.current.delete(origin); sysLine(nick + " 回来了"); }
            else if (!known) sysLine(nick + " 进了房间");
            announce(roomRef.current);
            if (games.current) ensureGames().then(() => games.current && games.current.resend()).catch(() => {});
          }
        }
        syncNet();
      } else if (e.t === "msg" && e.m) {
        landImages(Core.wireMsg(e.m)).then(w => {
          commit(Core.addMsg(roomRef.current, Object.assign(Core.wireMsg(w, true), { side: "peer", peerId: origin, by: origin })));
          if (w.type === "rp") grabForMine(w.x.rpId);
        });
      } else if (e.t === "sync" && Array.isArray(e.msgs)) {
        commit(Core.mergeMsgs(r, e.msgs.slice(-600).map(x => Core.syncedMsg(x, meId.current, origin))));
      } else if (e.t === "typing" && e.id) {
        const k = origin + "|" + String(e.id).slice(0, 80), nm = String(e.name || "TA").slice(0, 20);
        setPeerTyping(x => { const n = Object.assign({}, x); if (e.on) n[k] = nm; else delete n[k]; return n; });
      } else if (e.t === "grab" && e.rpId) {
        // 别人来抢我发的红包：只有发的那台手机算数
        grabMine(String(e.rpId), { key: origin + "|" + String(e.charId || "").slice(0, 40), name: String(e.name || "").slice(0, 40) });
      } else if (e.t === "rp" && e.rpId && Array.isArray(e.claims)) {
        // 领取名单只认发红包那个人报的
        const id = String(e.rpId);
        updX(x => x.type === "rp" && x.side === "peer" && x.peerId === origin && x.x && x.x.rpId === id, x => Core.cleanRich("rp", Object.assign({}, x, { claims: e.claims }), true));
        const w = pending.current[id]; if (w) w();
      } else if (e.t === "vote" && e.pollId) {
        const id = String(e.pollId);
        updX(x => x.type === "poll" && x.x && x.x.pollId === id, x => Core.votePoll(x, e.opt, e.name));
      } else if (e.t === "edit" && e.id) {
        commit(Core.upsertRoom(Core.editMsg(r, String(e.id), e.text, origin)));
      } else if (e.t === "recall" && e.id) {
        commit(Core.upsertRoom(Core.recallMsg(r, String(e.id), origin)));
      } else if (e.t === "drop" && e.id) {
        commit(Core.upsertRoom(Core.dropOwnMsg(r, String(e.id), origin)));
      } else if (e.t === "reroll" && e.turnId && Array.isArray(e.msgs)) {
        // 重新说：只认那一轮本来就是 TA 那边的角色说的；换成 TA 新给的那几条
        const tid = String(e.turnId).slice(0, 60);
        const olds = (r.msgs || []).filter(x => x.turnId === tid);
        if (olds.some(x => !(x.side === "peer" && x.peerId === origin && x.kind === "char"))) return;
        Promise.all(e.msgs.slice(0, 12).map(x => landImages(Core.wireMsg(x)))).then(list => {
          const fresh = list.filter(w => w.kind === "char").map(w => Object.assign(Core.wireMsg(w, true), { side: "peer", peerId: origin, by: origin }));
          commit(Core.upsertRoom(Core.replaceTurn(roomRef.current, tid, fresh)));
        });
      } else if (e.t === "game") {
        // 小游戏：游戏那几样先装上（规则和棋盘在小游戏里），再交给这一局
        const gs = games.current; if (!gs) return;
        ensureGames().then(() => gs.onMessage(e, origin)).catch(() => {});
      } else if (e.t === "bye") {
        delete linkMap.current[origin];
        Object.keys(linkMap.current).forEach(k => { linkMap.current[k] = linkMap.current[k].filter(x => x !== origin); });
        if (!left.current.has(origin)) { left.current.add(origin); greeted.current.delete(origin); sysLine(nickOf(origin) + " 离开了房间"); }
        syncNet();
      }
      // 别的 t（以后的新版本发来的）：不认得就不理
    };
    // 报到：名片 + 我手上的全部记录（谁断线时漏掉的，靠这一份补上；别人的话带着 by，收的人认得是谁说的）
    const announce = async r => {
      const cards = [];
      for (const c of (r.myChars || [])) { const ch = charsById[c.id]; cards.push(ch ? Core.cardOf(ch, await smallAvatar(ch)) : Core.cleanCard({ id: c.id, name: c.name })); }
      send({ t: "hi", nick: r.myNick || myNick(), chars: cards });
      send({ t: "sync", msgs: (r.msgs || []).filter(m => !m.sys).slice(-600).map(m => Core.wireMsg(Object.assign({}, m, { by: m.side === "me" ? meId.current : (m.peerId || "") }))) });
    };
    // 断了以后连回原来那个房间：房间号、谁开的都照旧，聊天记录接着往下记（她 2026-11-22）
    const rejoin = r0 => { start(!!r0.host, r0); };
    const start = (host, resume) => {
      setErr(""); setPeerTyping({}); setNet({ open: [], fail: [], reach: [] });
      try { mesh.current && mesh.current.close(); } catch (e) {}
      mesh.current = null; linkMap.current = {}; seen.current = new Set(); greeted.current = new Set();
      games.current = newGames(); setGameId(null);
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
    // 手机锁屏、切后台再回来：叫连线层醒一醒（换掉死掉的中转线、喊没连上的人）
    useEffect(() => {
      const onVis = () => { if (document.visibilityState === "visible" && mesh.current && mesh.current.wake) mesh.current.wake(); };
      document.addEventListener("visibilitychange", onVis); window.addEventListener("pageshow", onVis); window.addEventListener("online", onVis);
      return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pageshow", onVis); window.removeEventListener("online", onVis); };
    }, []);
    const cancelWait = () => { try { mesh.current && mesh.current.close(); } catch (e) {} mesh.current = null; commit(null); setPage("home"); };
    const enter = async () => {
      const list = chars.filter(c => picked[c.id]);
      const cards = [];
      for (const c of list) cards.push(Core.cardOf(c, await smallAvatar(c)));
      commit(Core.patchRoom(roomRef.current, { myNick: myNick(), myChars: list.map(c => ({ id: c.id, name: c.remark || c.name, recent: !!withChat[c.id] })) }));
      send({ t: "hi", nick: myNick(), chars: cards });
      entered.current = true; setPage("chat");
    };
    // 存档那一份（图换成本机引用）和发出去那一份（压小的图）各过一遍 wireMsg
    const post = (msg) => {
      const full = Object.assign(Core.wireMsg(msg, true), { side: "me" });
      commit(Core.addMsg(roomRef.current, full));
      send({ t: "msg", m: Core.wireMsg(msg) });
      return full;
    };
    const mid = p => p + Date.now() + Math.random().toString(36).slice(2, 6);
    const sayHuman = text => post({ id: mid("m"), kind: "user", name: myNick(), text, ts: Date.now() });
    const sayRich = (type, x) => post({ id: mid("m"), kind: "user", name: myNick(), type, x, text: "", ts: Date.now() });
    // ── 红包：只是玩法，不动钱包 ──
    const myKey = charId => meId.current + "|" + (charId || "");
    const grabMine = (rpId, who) => {
      const r = roomRef.current; if (!r) return;
      const rp = (r.msgs || []).find(x => x.type === "rp" && x.side === "me" && x.x && x.x.rpId === rpId);
      if (!rp) return;
      const g = Core.grabRp(rp.x, (r.rpSplits || {})[rpId], who);
      if (g.x) updX(x => x.id === rp.id, () => g.x);
      const now = (roomRef.current.msgs || []).find(x => x.id === rp.id);
      send({ t: "rp", rpId, claims: (now && now.x && now.x.claims) || [] });
      const w = pending.current[rpId]; if (w) w();
    };
    const grab = (rpId, charId, name) => {
      const r = roomRef.current; if (!r) return;
      const rp = (r.msgs || []).find(x => x.type === "rp" && x.x && x.x.rpId === rpId);
      if (!rp) return;
      if (rp.side === "me") grabMine(rpId, { key: myKey(charId), name });
      else send({ t: "grab", rpId, charId: charId || "", name });
    };
    // 我带来的人三秒后开抢（照群里的规矩：给真人留三秒先手），先后错开一点
    const grabForMine = rpId => ((roomRef.current && roomRef.current.myChars) || []).forEach(c =>
      setTimeout(() => grab(rpId, c.id, c.name), 3000 + Math.random() * 1500));
    const sendRp = (total, count, message) => {
      const a = Math.round(Number(total) * 100) / 100; if (!(a > 0)) return;
      const splits = typeof splitRedPacket === "function" ? splitRedPacket(a, count) : [a];
      const rpId = mid("rp");
      commit(Core.patchRoom(roomRef.current, { rpSplits: Object.assign({}, roomRef.current.rpSplits || {}, { [rpId]: splits }) }));
      sayRich("rp", { rpId, total: a, count: splits.length, message: message || "恭喜发财，大吉大利", claims: [] });
      grabForMine(rpId);
    };
    // 我自己点开抢：等发红包那台手机报回结果（它不在线就抢不到）
    const openRp = async rpId => {
      const mine = () => { const rp = ((roomRef.current && roomRef.current.msgs) || []).find(x => x.type === "rp" && x.x && x.x.rpId === rpId);
        return rp && (rp.x.claims || []).find(c => c.key === myKey("")); };
      if (mine()) return "¥" + mine().amount;
      const got = new Promise(ok => { pending.current[rpId] = ok; setTimeout(ok, 6000); });
      grab(rpId, "", myNick());
      await got; delete pending.current[rpId];
      const c = mine();
      if (!c) props.toast && props.toast("没抢到：领完了，或者发红包的人这会儿不在线");
      return c ? "¥" + c.amount : null;
    };
    const vote = (pollId, opt, name) => {
      updX(x => x.type === "poll" && x.x && x.x.pollId === pollId, x => Core.votePoll(x, opt, name));
      send({ t: "vote", pollId, opt, name });
    };
    // 房里能投票的有几位（真人 + 各自带来的人）：请示要除了递的人都投过才结案
    const headCount = r => 1 + (r.peers || []).length + (r.myChars || []).length + (r.peers || []).reduce((n, p) => n + (p.chars || []).length, 0);
    // 能拍的人：房里的人（除了我）和所有角色
    const patTargets = r => (r.peers || []).map(p => p.nick).concat((r.myChars || []).map(c => c.name), ...(r.peers || []).map(p => (p.chars || []).map(c => c.name))).filter(Boolean);
    // 改字、撤回：本机先改，再告诉大家（别人那边只认我这一端发出的）；删除只删我这边
    const editOwn = (id, text) => { commit(Core.upsertRoom(Core.editMsg(roomRef.current, id, text, "me"))); send({ t: "edit", id, text }); };
    const recallOwn = id => { commit(Core.upsertRoom(Core.recallMsg(roomRef.current, id, "me"))); send({ t: "recall", id }); };
    // 删掉自己（和自己带来的人）发的那条：两边一起删
    const dropOwn = id => { commit(Core.upsertRoom(Core.dropOwnMsg(roomRef.current, id, "me"))); send({ t: "drop", id }); };
    const dropLocal = id => commit(Core.upsertRoom(Core.dropMsg(roomRef.current, id)));
    // ── 小游戏（js/netroom-games.js）：房主那台当庄，其余每台只管自己的座位 ──
    const games = useRef(null);
    const [, setGTick] = useState(0);
    const [gameId, setGameId] = useState(null);        // 正开着的那张牌桌
    const [recId, setRecId] = useState(null);          // 点开回看的那张战绩卡（消息 id）
    const [gamePend, setGamePend] = useState(null);    // 大厅里配好、还没发卡的那一局 { game, cfg }
    const [prep, setPrep] = useState({ surface: "", truth: "", mode: "host" });
    const [joinAt, setJoinAt] = useState(null), [joinPick, setJoinPick] = useState({});
    const [gameBusy, setGameBusy] = useState(false);
    const [gameWin, setGameWinRaw] = useState(null);
    // 自己带来的角色上桌怎么玩（随手、带不带最近单聊）：只在这台手机、只在替 TA 出手时用，不发给庄。牌技那一档走小游戏的「钉一档」（本机记着）
    const [charOpts, setCharOpts] = useState({}); const charOptsRef = useRef(charOpts); charOptsRef.current = charOpts;   // 牌桌那扇半窗：{ gid, min, box, pill, seen }
    const propsRef = useRef(props); propsRef.current = props;
    const pageRef = useRef(page); pageRef.current = page;
    const ensureGames = () => root.GameShared || !root.LazyMods ? Promise.resolve() : root.LazyMods.load("games");
    const newGames = () => root.NetGameSession ? root.NetGameSession({
      me: () => meId.current, nick: () => myNick(), nickOf: id => nickOf(id),
      send: (obj, to) => send(obj, to),
      post: (type, x) => sayRich(type, x),
      // 邀请卡只认开这一局的那个人改：我开的改我那条；别人开的只改 TA 发的那条
      patchCard: (gid, x, mine, origin) => updX(m => m.type === "game" && m.x && m.x.gid === gid && (mine ? m.side === "me" : m.side === "peer" && m.peerId === origin), () => x),
      hostApi: () => propsRef.current.gameApi ? propsRef.current.gameApi() : null,
      apiFor: id => propsRef.current.apiFor ? propsRef.current.apiFor(id) : null,
      charOf: id => (propsRef.current.characters || []).find(c => c.id === id) || null,
      charOpts: (gid, cid) => charOptsFor(cid),
      myChars: () => ((roomRef.current && roomRef.current.myChars) || []).map(c => c.id),
      presence: () => presence(),
      onChange: () => setGTick(n => n + 1),
      onOpenGame: gid => { if (pageRef.current === "chat") openGame(gid); },
      toast: s => propsRef.current.toast && propsRef.current.toast(s)
    }) : null;
    // 掉线托管：每三秒看一眼轮到的人还在不在
    useEffect(() => { const id = setInterval(() => { try { games.current && games.current.tick(Date.now()); } catch (e) {} }, 3000); return () => clearInterval(id); }, []);
    useEffect(() => { if ((gameWin || page === "gamerec" || page === "gameprep") && !root.GameShared) ensureGames().then(() => setGTick(n => n + 1)).catch(() => {}); }, [page, !!gameWin]);
    // 大厅里配好了：房主自己这边上谁＝开局配置里勾的那几个（观战就不坐），发一张邀请卡
    const sendInvite = (game, cfg, pz, setter) => {
      if (!games.current) games.current = newGames();
      if (!games.current) return;
      // 开局页自己定好了上谁（辩论：每个人挑哪一边）就照它的
      const picks = cfg.picks || (cfg.mode === "spectate" ? [] : [{ kind: "user" }]).concat((cfg.charIds || []).map(id => { const c = (roomRef.current.myChars || []).find(x => x.id === id); return c ? { kind: "char", charId: c.id, name: c.name } : null; }).filter(Boolean));
      games.current.invite({ key: game.key, zh: game.zh, min: game.min, max: game.max }, cfg, picks, pz || null, setter || null);
      setGamePend(null); setPage("chat");
    };
    const onConfigured = (game, cfg) => {
      if (game.key === "haigui" || game.key === "q25") { setGamePend({ game, cfg }); setPrep({ surface: "", truth: "", mode: "host" }); setPage("gameprep"); return; }
      sendInvite(game, cfg);
    };
    // 报名：你自己、你带进房间的人，勾谁谁占一个座位。聊天页和牌桌页都挂这一张（牌桌页下面也有邀请卡，点「加入」得有反应）
    // 这个角色这一局的设置：没调过的「带上最近单聊」跟 TA 在房间里那个勾一样
    const charOptsFor = cid => {
      const o = charOptsRef.current[cid] || {}, mc = ((roomRef.current && roomRef.current.myChars) || []).find(c => c.id === cid);
      const recent = o.recent != null ? !!o.recent : !!(mc && mc.recent), ch = charsById[cid];
      let recentText = "";
      if (recent && ch && propsRef.current.ctxFor) { try { recentText = String((propsRef.current.ctxFor(ch, { chat: true }) || {}).recentChat || "").slice(-600); } catch (e) {} }
      return { casual: !!o.casual, recent, recentText, botSkill: o.botSkill || "" };
    };
    const setCharOpt = (cid, k, v) => setCharOpts(m => Object.assign({}, m, { [cid]: Object.assign({}, m[cid] || {}, { [k]: v }) }));
    // 座位旁那两个字（大家都看得到）：钉的牌技档、随手
    const charTag = (key, cid) => {
      const GSh = root.GameShared, kinds = GC() ? GC().charOptKinds(key) : [], bits = [];
      if (kinds.indexOf("skill") >= 0 && GSh && GSh.skill) { const pin = GSh.skill.load()[cid], o = GSh.skill.PINS.find(x => x.k && x.k === pin); if (o) bits.push(o.zh); }
      if (kinds.indexOf("casual") >= 0 && (charOptsRef.current[cid] || {}).casual) bits.push("随手");
      const bs = (charOptsRef.current[cid] || {}).botSkill, BS = GSh && GSh.cards && GSh.cards.BOT_SKILL;
      if (kinds.indexOf("botSkill") >= 0 && BS && BS[bs]) bits.push(BS[bs].zh);
      if (kinds.indexOf("side") >= 0) { const sd = (charOptsRef.current[cid] || {}).side; if (sd) bits.push(sd === "pro" ? "正方" : "反方"); }
      return bits.join("·");
    };
    // 报名：你自己、你带进房间的人，勾谁谁占一个座位；勾上的角色下面展开这一盒能按人调的那几项（跟单机开局页同一批）
    const joinSheet = () => { const myChars = ((room && room.myChars) || []);
      if (!joinAt) return null;
      const kinds = GC() ? GC().charOptKinds(joinAt.key) : [], GSh = root.GameShared;
      const seg = (cid, k, val, opts) => h("div", { className: "flex flex-wrap", style: { gap: 6 } }, opts.map(o => h("button", { key: o.key, "data-wk": "nrcharopt", "data-part": k,
        onClick: () => k === "skill" ? (GSh.skill.save(cid, o.key), setGTick(n => n + 1)) : k === "side" ? setCharOpt(cid, "side", o.key) : k === "botSkill" ? setCharOpt(cid, k, o.key) : setCharOpt(cid, k, o.key === "casual"),
        style: { minHeight: 32, padding: "0 12px", borderRadius: 999, border: "1px solid " + (val === o.key ? t.ink : t.line), background: val === o.key ? t.ink : t.bg2, color: val === o.key ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(12.5) } }, o.zh)));
      // 辩论：上台的这一位站哪边（角色多一个「随人设」：开讲前由你这台按 TA 的人设挑）；大家都看得到
      const sideSeg = (cid, isChar) => h("div", { key: "side" }, seg(cid, "side", (charOptsRef.current[cid] || {}).side || "", (isChar ? [{ key: "", zh: "随人设" }] : [{ key: "", zh: "都行" }]).concat([{ key: "pro", zh: "正方" }, { key: "con", zh: "反方" }])));
      const optsOf = c => {
        if (!joinPick[c.id]) return null;
        const o = charOptsFor(c.id), rows = [];
        if (kinds.indexOf("skill") >= 0 && GSh && GSh.skill) rows.push(h("div", { key: "s" }, h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, margin: "2px 0 4px" } }, "牌技：" + GSh.skill.NOTE),
          seg(c.id, "skill", GSh.skill.load()[c.id] || "", GSh.skill.PINS.map(x => ({ key: x.k, zh: x.zh })))));
        if (kinds.indexOf("casual") >= 0 && GSh) rows.push(h("div", { key: "c" }, seg(c.id, "casual", o.casual ? "casual" : "serious", GSh.GMK_CASUAL_OPTS)));
        if (kinds.indexOf("botSkill") >= 0 && GSh && GSh.cards) rows.push(h("div", { key: "b" }, h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, margin: "2px 0 4px" } }, "牌手水平：你这台替 TA 出牌时照这一档（新手常出一张不那么好的，高手不失手）"),
          seg(c.id, "botSkill", o.botSkill || "normal", Object.keys(GSh.cards.BOT_SKILL).map(k => ({ key: k, zh: GSh.cards.BOT_SKILL[k].zh })))));
        if (kinds.indexOf("side") >= 0) rows.push(sideSeg(c.id, true));
        if (kinds.indexOf("recent") >= 0) rows.push(h("label", { key: "r", className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } },
          h("input", { type: "checkbox", "data-wk": "nrcharrecent", checked: o.recent, onChange: e => setCharOpt(c.id, "recent", e.target.checked) }), "带上 TA 最近单聊（TA 出题、提问、接句时记得你们最近聊了什么）"));
        return rows.length ? h("div", { "data-wk": "nrcharopts", style: { margin: "0 0 8px 42px", display: "flex", flexDirection: "column", gap: 6 } }, rows) : null;
      };
      return h(Sheet, { key: "gj", onClose: () => setJoinAt(null) },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(17), color: t.ink, marginBottom: 6 } }, "你这边上谁"),
          h(Note, null, "每人占一个座位。你带来的角色轮到时由你这台手机用 TA 的线路替 TA 出手；下面给 TA 调的只存在你这台、只在替 TA 出手时用。座位不够的，勾了也坐不上。"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 4, margin: "10px 0" } },
            [{ id: "_me", label: myNick() + "（我自己）" }].concat(myChars.map(c => ({ id: c.id, label: c.name, c }))).map(r => h(React.Fragment, { key: r.id },
              h("label", { className: "flex items-center", style: { gap: 12, minHeight: 44 } },
                h("input", { type: "checkbox", "data-wk": "nrgamepick", checked: !!joinPick[r.id], onChange: e => setJoinPick(p => Object.assign({}, p, { [r.id]: e.target.checked })) }),
                r.c ? h(Avatar, { character: charsById[r.c.id] || { id: r.c.id, name: r.c.name }, size: 30 }) : null,
                h("span", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink } }, r.label)),
              r.c ? optsOf(r.c) : (joinPick._me && kinds.indexOf("side") >= 0 ? h("div", { style: { margin: "0 0 8px 42px" } }, sideSeg("_me", false)) : null)))),
          h(Btn, { label: "坐下", primary: true, wk: "nrgamejoinok", disabled: !Object.keys(joinPick).some(k => joinPick[k]), onClick: () => {
            const sideOf = id => kinds.indexOf("side") >= 0 ? (charOptsRef.current[id] || {}).side || "" : "";
            const picks = (joinPick._me ? [{ kind: "user", side: sideOf("_me") }] : []).concat(myChars.filter(c => joinPick[c.id]).map(c => ({ kind: "char", charId: c.id, name: c.name, side: sideOf(c.id), tag: charTag(joinAt.key, c.id) })));
            const ja = joinAt; setJoinAt(null);
            const left = games.current ? games.current.join(ja.gid, picks, ja.host) : [];
            if (left.length) props.toast && props.toast("座位不够，" + left.length + " 个没坐上");
          } })); };
    // 她 2026-11-22 改过来：牌桌开着是整页，房间聊天是浮在上面的半窗（单聊半窗那一份外壳 HalfWinFrame）；牌桌收起成小条，轮到你会亮
    const msgCount = () => ((roomRef.current && roomRef.current.msgs) || []).filter(m => !m.sys).length;
    const setGameWin = fn => setGameWinRaw(w => GC() ? GC().winSet(w, typeof fn === "function" ? fn(w) : fn, msgCount()) : (typeof fn === "function" ? fn(w) : fn));
    const openGame = gid => { setGameId(gid); setPage("chat"); setGameWinRaw(w => GC() ? GC().winOpen(w, gid, msgCount()) : { gid, min: false, seen: msgCount() }); };
    // 当前对局给开口的角色当背景：正开着的那一局（没开就最近一局还在打的）；TA 坐在桌上就从 TA 那个座位看，私密那份只给 TA 自己那一座
    const gameStateFor = charId => {
      const gs = games.current, GCo = GC(); if (!gs || !GCo) return "";
      const gid = (gameWin && gameWin.gid) || gameId; const sv = gid ? gs.seen(gid) : null;
      if (!sv || !sv.view || (sv.inv.status !== "playing" && sv.inv.status !== "done")) return "";
      const si = charId ? sv.inv.seats.findIndex(x => x.kind === "char" && x.peer === meId.current && x.charId === charId) : -1;
      const mineP = si >= 0 ? gs.privOf(gid, si) : null;
      return GCo.stateText(sv.inv, sv.view, si, mineP);
    };
    // 她 2026-11-22：「聊天是那个半窗，游戏类是全屏」——牌桌开着时整页是牌桌，房间聊天缩成浮在上面的半窗；
    //   牌桌收起来就回到整页聊天，牌桌缩成一颗小条（轮到你会亮）。
    const [chatWin, setChatWinRaw] = useState({ min: true });
    const setChatWin = fn => { setChatWinRaw(w => typeof fn === "function" ? fn(w) : fn); setGameWinRaw(w => w ? Object.assign({}, w, { seen: msgCount() }) : w); };
    const gameParts = () => {
      if (!gameWin || !room) return null;
      const gs = games.current, gid = gameWin.gid, sv = gs ? gs.seen(gid) : null;
      const A = sv && GC() ? GC().ADAPTERS[sv.inv.key] : null;
      const shut = () => setGameWinRaw(null);
      const body = !sv || !A || !root.GameShared ? h("div", { style: { padding: 16 } }, h(Note, null, "在等房主那边把牌桌发过来…")) : (() => {
        const inv = sv.inv, isHost = gs.isHost(gid), done = inv.status === "done";
        const pr = presence(), hostGone = !isHost && pr[inv.host] !== "on" && pr[inv.host] !== "relay";
        return h("div", { "data-wk": "nrgamearea", className: "h-full", style: { overflowY: "auto", paddingBottom: 12 } },
          h("div", { style: { padding: "6px 16px 0", fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, inv.zh, h("span", { style: { marginLeft: 8, fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, done ? "这一局打完了" : inv.seats.some(x => x.peer === meId.current && x.kind !== "npc") ? "你在桌上" : "你在旁边看")),
          hostGone && h("div", { style: { padding: "8px 16px" } }, h(Note, null, "房主（这一局的庄）现在不在房里，这一局停在这儿；她回来就接着打。")),
          h(A.Table, { inv, view: sv.view, priv: sv.priv || null, myApi: props.gameApi ? props.gameApi() : null, me: meId.current, isHost, onMove: (seat, mv) => gs.move(gid, seat, mv), onReveal: () => gs.reveal(gid), side: sv.side || [], onSide: x => gs.side(gid, x), nick: myNick() }),
          done && h("div", { className: "flex", style: { gap: 8, padding: "0 16px 12px" } },
            isHost && h(Btn, { label: "再来一局", primary: true, wk: "nrgameagain", onClick: () => { gs.again(gid); shut(); } }),
            h(Btn, { label: "收起牌桌", wk: "nrgameback", onClick: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w) })));
      })();
      const turn = sv && A ? GC().myTurn(sv.inv, sv.view, meId.current) : false;
      // 牌桌整页开着、聊天半窗收着时，这期间房里来的新话
      const unread = chatWin.min && GC() ? GC().winUnread(gameWin, msgCount()) : 0;
      // 收起后的那颗小条：还是单聊半窗那一份外壳的收起样子，点了回到整页牌桌
      const pill = gameWin.min ? h(HalfWinFrame, { win: gameWin, setWin: setGameWin, forKey: "netgame", onClose: shut,
        pillLabel: (sv ? sv.inv.zh : "小游戏") + (turn ? " · 轮到你" : "") + " ▴", pillHot: turn }) : null;
      return { body, pill, unread, zh: sv ? sv.inv.zh : "小游戏", shut, full: !gameWin.min };
    };
    const gameHandlers = m => {
      const x = m.x || {}, gs = games.current;
      return { me: meId.current, busy: gameBusy, lost: x.host === meId.current && (x.status === "open" || x.status === "playing") && !(gs && gs.isHost(x.gid)),
        // 选人那张在半窗底下会被盖住：先把牌桌收起来
        onJoin: () => { setJoinPick({}); setJoinAt({ gid: x.gid, host: x.host, key: x.key }); setGameWin(w => w && !w.min ? Object.assign({}, w, { min: true }) : w); },
        onLeave: () => gs && gs.join(x.gid, [], x.host),
        onAdd: () => gs && gs.addSeat(x.gid),
        onCancel: () => gs && gs.cancel(x.gid),
        // 出题人：在能出题的座位里挨个换
        onSetter: () => { if (!gs || !root.NetGameCore || !x.setter) return; const C = root.NetGameCore, nx = C.nextSetter(x, C.setterSeat(x)); if (nx) gs.setSetter(x.gid, Object.assign({ mode: x.setter.mode === "turns" ? "turns" : "seat" }, nx)); },
        onStart: async () => { if (!gs) return; setGameBusy(true); try { if (await gs.start(x.gid)) openGame(x.gid); } finally { setGameBusy(false); } },
        onOpen: () => openGame(x.gid) };
    };
    // ── 角色开口：一次连发的几条算一轮（turnId），能整轮重新说 ──
    const presence = () => { const o = {}; ((roomRef.current && roomRef.current.peers) || []).forEach(p => { o[p.peerId] = netRef.current.open.indexOf(p.peerId) >= 0 ? "on" : netRef.current.reach.indexOf(p.peerId) >= 0 ? "relay" : netRef.current.fail.indexOf(p.peerId) >= 0 ? "fail" : "off"; }); return o; };
    const speak = async (c, rerollId) => {
      const char = charsById[c.id];
      if (!char || busy[c.id]) return;
      const p = props.apiFor ? props.apiFor(char.id) : null;
      if (!p) { props.toast && props.toast("先去 设置·API 配一条线路"); return; }
      setBusy(b => Object.assign({}, b, { [c.id]: true }));
      // 别人看得到「X 正在输入…」：开始想就亮，说完或没说成就灭
      const typing = on => send({ t: "typing", id: c.id, name: char.remark || char.name, on });
      typing(true);
      try {
        const cur0 = roomRef.current;
        // 重新说时，模型看到的记录里不放被换掉的那一轮
        const cur = rerollId ? Object.assign({}, cur0, { msgs: (cur0.msgs || []).filter(x => x.turnId !== rerollId) }) : cur0;
        // 跟单聊同一个 ctxFor（chat:true 带上日记回忆）；没勾「带上最近单聊」的，单聊和线下那几段不进这次的料
        const roomText = (cur.msgs || []).filter(m => !m.sys && !m.recalled).slice(-8).map(m => String(m.text || "")).join("\n");
        const ctx0 = props.ctxFor(char, { chat: true, roomText }), ctx = c.recent ? ctx0 : Object.assign({}, ctx0, { recentChat: "", pastOffline: "" });
        ctx.roomEcho = "";   // 房间自己的记录已经整份在下面了，不再带一遍
        const emotes = props.emotesFor ? props.emotesFor(char.id) : [];
        const d = await runProbe(p, ctx, { voice: true, tag: "netroom",
          instruction: Core.lineInstruction(cur, { id: char.id, name: char.remark || char.name, you: props.youFor ? props.youFor(char.id) : "" },
            { stamp: props.stampFor ? ts => props.stampFor(char.id, ts) : null, now: Date.now(), game: gameStateFor(char.id), presence: presence(), emotes: emotes.map(e => e.keyword), targets: patTargets(cur).concat([myNick()]) }),
          schemaHint: "{\"say\":[\"气泡1\",\"气泡2\"],\"emote\":\"（可选）\",\"pat\":\"（可选）\",\"vote\":\"（可选）\"}", maxTokens: 12000 });
        // 一次连发几条（她 2026-11-22：「为啥角色一次只会说一句话」）；老格式 text 也认
        const lines = Core.sayLines(d);
        const turnId = rerollId || mid("t"), nm = char.remark || char.name;
        const base = () => ({ id: mid("c"), kind: "char", name: nm, charId: char.id, ts: Date.now(), turnId, text: "" });
        const list = lines.map(text => Object.assign(base(), { text }));
        const ekw = d && typeof d.emote === "string" && d.emote.trim() && d.emote !== "null" ? d.emote.trim() : "";
        const em = ekw && props.emoteFor ? props.emoteFor(char.id, ekw) : null;
        if (em) list.push(Object.assign(base(), { type: "emote", x: Object.assign({ keyword: em.keyword, url: em.url }, await emoteWire(em.url)) }));
        const pt = d && typeof d.pat === "string" ? d.pat.trim() : "";
        if (pt && pt !== nm && patTargets(cur).concat([myNick()]).indexOf(pt) >= 0) list.push(Object.assign(base(), { type: "pat", x: { to: pt } }));
        if (!list.length) throw new Error("TA 没想好说什么，再点一次");
        const vt = d && typeof d.vote === "string" ? d.vote.trim() : "";
        if (vt) { const pl = (cur.msgs || []).slice().reverse().find(x => x.type === "poll" && !x.recalled && x.x);
          const oi = pl ? pl.x.options.findIndex(o => o.text === vt) : -1; if (oi >= 0) vote(pl.x.pollId, oi, nm); }
        if (rerollId) {
          // 换掉那一轮：旧的那份留在本机版本里，可以左右翻回去
          const r = roomRef.current, olds = (r.msgs || []).filter(x => x.turnId === rerollId);
          const local = list.map(x => Object.assign(Core.wireMsg(x, true), { side: "me" }));
          const v0 = (r.vers || {})[rerollId] || { list: [olds], cur: 0 };
          const v = { list: v0.list.concat([local]).slice(-8), cur: 0 }; v.cur = v.list.length - 1;
          commit(Core.upsertRoom(Object.assign(Core.replaceTurn(r, rerollId, local), { vers: Object.assign({}, r.vers || {}, { [rerollId]: v }) })));
          send({ t: "reroll", turnId: rerollId, msgs: list.map(x => Core.wireMsg(x)) });
        } else {
          for (let i = 0; i < list.length; i++) {
            if (i) await new Promise(r => setTimeout(r, Math.min(2200, 500 + String(list[i].text || "").length * 60)));
            post(Object.assign({}, list[i], { ts: Date.now() }));
          }
        }
      } catch (e) { props.toast && props.toast("没说出来：" + ((e && e.message) || e)); }
      finally { typing(false); setBusy(b => Object.assign({}, b, { [c.id]: false })); }
    };
    // ── 一起说：自己带来的几个人一次调用、照群聊那样轮流接话；整次一个 turnId，重新说整批重来 ──
    //   线路用第一个人自己的 apiFor（没有群，就照「没有群就用第一个人的」），费用算这台手机。
    //   每人那一段由 app 用群聊那套拼（castFor）；没递 castFor 的旧壳不给这个按钮。
    const speakTogether = async (ids, rerollId) => {
      const r0 = roomRef.current, mine = ((r0 && r0.myChars) || []).filter(c => ids.indexOf(c.id) >= 0 && charsById[c.id]);
      if (mine.length < 2 || mine.some(c => busy[c.id]) || !props.castFor) return;
      const lead = charsById[mine[0].id];
      const p = props.apiFor ? props.apiFor(lead.id) : null;
      if (!p) { props.toast && props.toast("先去 设置·API 配一条线路"); return; }
      const setAll = v => setBusy(b => Object.assign({}, b, ...mine.map(c => ({ [c.id]: v }))));
      setAll(true);
      const typing = on => mine.forEach(c => send({ t: "typing", id: c.id, name: c.name, on }));
      typing(true);
      try {
        const cur = rerollId ? Object.assign({}, r0, { msgs: (r0.msgs || []).filter(x => x.turnId !== rerollId) }) : r0;
        const recall = (cur.msgs || []).filter(m => !m.sys && !m.recalled).slice(-8).map(m => String(m.text || "")).join("\n");
        const cast = await props.castFor(mine.map(c => ({ id: c.id, recent: !!c.recent })), recall);
        const targets = patTargets(cur).concat([myNick()]);
        const sys = Core.jointInstruction(cur, mine.map(c => ({ id: c.id, name: c.name, you: props.youFor ? props.youFor(c.id) : "",
          emotes: (props.emotesFor ? props.emotesFor(c.id) : []).map(e => e.keyword) })),
          { stamp: props.stampFor ? ts => props.stampFor(lead.id, ts) : null, now: Date.now(), presence: presence(), targets, cast, game: gameStateFor(null) });
        // 料全在 system，user 只留一句触发（prompt-send-shape）；几个人各说几条，按人数给足
        const raw = await callAI(p, sys, [{ role: "user", content: "接着房里的话往下说。" }], { use: "chat", logLabel: "联机·一起说", maxTokens: Math.min(32000, 12000 + 4000 * mine.length) });
        const people = mine.map(c => charsById[c.id]);
        const got = Core.jointLines(raw, people, myNick());
        const turnId = rerollId || mid("t"), list = [];
        for (const it of got) {
          const nm = (mine.find(c => c.id === it.char.id) || {}).name || it.char.remark || it.char.name;
          const base = () => ({ id: mid("c"), kind: "char", name: nm, charId: it.char.id, ts: Date.now(), turnId, text: "" });
          if (it.text) Core.sayLines({ text: it.text }).forEach(text => list.push(Object.assign(base(), { text })));
          const em = it.emote && props.emoteFor ? props.emoteFor(it.char.id, it.emote) : null;
          if (em) list.push(Object.assign(base(), { type: "emote", x: Object.assign({ keyword: em.keyword, url: em.url }, await emoteWire(em.url)) }));
          if (it.pat && it.pat !== nm && targets.indexOf(it.pat) >= 0) list.push(Object.assign(base(), { type: "pat", x: { to: it.pat } }));
          if (it.vote) { const pl = (cur.msgs || []).slice().reverse().find(x => x.type === "poll" && !x.recalled && x.x);
            const oi = pl ? pl.x.options.findIndex(o => o.text === it.vote) : -1;
            if (oi >= 0 && !(pl.x.options[oi].voters || []).some(v => v === nm)) vote(pl.x.pollId, oi, nm); }
        }
        if (!list.length) throw new Error("他们没想好说什么，再点一次");
        const joints = Object.assign({}, (roomRef.current && roomRef.current.joints) || {}, { [turnId]: mine.map(c => c.id) });
        if (rerollId) {
          const r = roomRef.current, olds = (r.msgs || []).filter(x => x.turnId === rerollId);
          const local = list.map(x => Object.assign(Core.wireMsg(x, true), { side: "me" }));
          const v0 = (r.vers || {})[rerollId] || { list: [olds], cur: 0 };
          const v = { list: v0.list.concat([local]).slice(-8), cur: 0 }; v.cur = v.list.length - 1;
          commit(Core.upsertRoom(Object.assign(Core.replaceTurn(r, rerollId, local), { joints, vers: Object.assign({}, r.vers || {}, { [rerollId]: v }) })));
          send({ t: "reroll", turnId: rerollId, msgs: list.map(x => Core.wireMsg(x)) });
        } else {
          commit(Core.patchRoom(roomRef.current, { joints }));
          for (let i = 0; i < list.length; i++) {
            if (i) await new Promise(r => setTimeout(r, Math.min(2200, 500 + String(list[i].text || "").length * 60)));
            post(Object.assign({}, list[i], { ts: Date.now() }));
          }
        }
      } catch (e) { props.toast && props.toast("没说出来：" + ((e && e.message) || e)); }
      finally { typing(false); setAll(false); }
    };
    // 这一轮是谁说的：一起说那一轮整批重来，单人那一轮照旧只叫那一个人
    const redo = m => { const r = roomRef.current || {}, j = (r.joints || {})[m.turnId];
      if (j && j.length > 1) return speakTogether(j, m.turnId);
      const c = (r.myChars || []).find(x => x.id === m.charId); if (c) speak(c, m.turnId); };
    // 左右翻这一轮的几个版本：翻到哪版就把哪版发给大家
    const flipTurn = (turnId, dir) => {
      const r = roomRef.current, v = (r.vers || {})[turnId]; if (!v) return;
      const cur = Math.max(0, Math.min(v.list.length - 1, v.cur + dir)); if (cur === v.cur) return;
      const pick = v.list[cur];
      commit(Core.upsertRoom(Object.assign(Core.replaceTurn(r, turnId, pick), { vers: Object.assign({}, r.vers, { [turnId]: { list: v.list, cur } }) })));
      send({ t: "reroll", turnId, msgs: pick.map(x => Core.wireMsg(x)) });
    };
    // ＋ 里点了哪一样
    const onTap = k => {
      setPanel(false);
      if (k === "game") { setPage("gamepick"); return; }
      if (k === "debate") { const D = GC() && GC().ADAPTERS.debate; if (D && D.shelf) { setGamePend({ game: D.shelf, cfg: {} }); setPage("gameprep"); } else props.toast && props.toast("擂台还没装上，再点一次试试"); return; }
      if (k === "location") setSheet("geo");
      else if (k === "photo") { setPhotoImgs([]); setPhotoText(""); setSheet("photo"); }
      else if (k === "file") pickTextFile(msg => sayRich("file", msg));
      else setSheet(k === "voicemsg" ? "voicemsg" : k);
    };
    const sendEmote = async em => sayRich("emote", Object.assign({ keyword: em.keyword || "表情", url: em.url }, await emoteWire(em.url)));
    const sendPhoto = async () => {
      const cap = photoText.trim(), src = photoImgs[0];
      if (!src && !cap) { props.toast && props.toast("选一张图，或者写一句照片里有什么"); return; }
      setSheet(null);
      if (!src) { sayRich("photo", { desc: cap }); return; }
      const img = await shrinkImg(src, 1024, Core.IMG_MAX.photo);
      if (!img) { props.toast && props.toast("这张图没能压小，换一张试试"); return; }
      let ref = ""; try { ref = await imgToVault(img); } catch (e) {}
      sayRich("photo", { desc: cap, img, imageRef: ref });
    };
    const sendCard = async r => {
      if (r.me) { sayRich("namecard", { name: myNick(), avatar: "" }); return; }
      const c = r.char; sayRich("namecard", Object.assign({}, Core.cardOf(c, await smallAvatar(c))));
    };
    // 长按：按住半秒出菜单（右键直接出）
    const pressT = useRef(null);
    const onPress = (i, now) => { clearTimeout(pressT.current); if (now) setMenuAt(i); else pressT.current = setTimeout(() => setMenuAt(i), 480); };
    const onRelease = () => clearTimeout(pressT.current);
    // 自己发的能改字、撤回；自己带来的人说的也能；别人的只能删我这边。卡片（红包、投票……）不改字
    const menuItems = m => {
      if (m.sys || m.recalled) return [[m.side === "me" && !m.sys ? "del" : "delmine"]];
      const own = m.side === "me";
      if (!own) return [m.type ? [] : ["copy"], ["delmine"]];
      return [m.type ? [] : ["copy"], [m.type ? null : "edit", m.kind === "char" && m.turnId ? "reroll" : null].filter(Boolean), ["recall", "del"]];
    };
    const onMenu = (act, m) => {
      if (act === "copy") { typeof copyText === "function" && copyText(m.text); props.toast && props.toast("复制好了"); }
      else if (act === "del" && m.side === "me" && !m.sys) requestAppConfirm("删除这条消息？", "房里每个人那边都一起删掉，不留「撤回了」那一行。删了不能恢复。", () => dropOwn(m.id), "删除");
      else if (act === "del" || act === "delmine") requestAppConfirm("删除这条消息？", "只从你这台手机上删掉，房里别人那边还在。删了不能恢复。", () => dropLocal(m.id), "删除");
      else if (act === "recall") recallOwn(m.id);
      else if (act === "edit") requestAppPrompt("编辑这条消息", "改好以后房里每个人那边都会换成新的，标「已编辑」。", m.text, v => { if (String(v || "").trim()) editOwn(m.id, v); }, "改好了");
      else if (act === "reroll") redo(m);
    };
    // 每一行：长按、卡片、这一轮最后一条底下的「重新说 ‹ 1/2 ›」
    const rowProps = (r, interactive) => (m, i) => {
      const o = { rich: x => h(RichBody, { m: x, mine: x.side === "me", meName: myNick(), voters: Math.max(1, headCount(r) - 1),
        game: interactive && x.type === "game" ? gameHandlers(x) : null, onRec: () => { setRecId(x.id); setViewId(r.id); setPage("gamerec"); },
        onRp: interactive ? () => setRpOpen(x.x.rpId) : undefined, onVote: interactive ? opt => vote(x.x.pollId, opt, myNick()) : undefined }) };
      if (!interactive) return o;
      o.onPress = onPress; o.onRelease = onRelease;
      const next = r.msgs[i + 1];
      if (m.side === "me" && m.kind === "char" && m.turnId && !(next && next.turnId === m.turnId)) {
        const v = (r.vers || {})[m.turnId], jt = (r.joints || {})[m.turnId], c = (r.myChars || []).find(x => x.id === m.charId);
        const rb = jt && jt.length > 1 ? jt.some(id => busy[id]) : !!(c && busy[c.id]);
        const sb = { fontFamily: F_BODY, fontSize: fs(10.5), color: t.fog, minHeight: 24, padding: "0 4px" };
        o.tools = h("span", { "data-wk": "nrreroll", style: { display: "inline-flex", alignItems: "center", gap: 2 } },
          v && v.list.length > 1 && h("button", { "data-wk": "nrverprev", onClick: () => flipTurn(m.turnId, -1), disabled: v.cur <= 0, style: sb, className: "disabled:opacity-30" }, "‹"),
          v && v.list.length > 1 && h("span", { style: sb }, (v.cur + 1) + "/" + v.list.length),
          v && v.list.length > 1 && h("button", { "data-wk": "nrvernext", onClick: () => flipTurn(m.turnId, 1), disabled: v.cur >= v.list.length - 1, style: sb, className: "disabled:opacity-30" }, "›"),
          (c || jt) && h("button", { "data-wk": "nrrerollbtn", onClick: () => redo(m), disabled: rb, style: sb, className: "active:opacity-60 disabled:opacity-40" }, rb ? "在想…" : "重新说"));
      }
      return o;
    };
    // 把一个人这次的经历记进 TA 的记忆（退出卡和历史里补记都走这一处）
    const remember = async (r, charId) => {
      const char = charsById[charId];
      if (!char) throw new Error("这个人已经不在你的角色里了");
      const p = props.apiFor ? props.apiFor(char.id) : null;
      if (!p) throw new Error("先去 设置·API 配一条线路");
      // 只记上次记过以后的新话（她 2026-11-22）：同一个房间重回来接着聊，再记就从上一次记到的那条往后
      const live = Core.loadRooms().find(x => x.id === r.id) || r;
      const part = Core.sinceRemembered(live, charId);
      if (!part.fresh.length) throw new Error("上次记过以后没有新的话");
      const ask = () => runProbe(p, props.ctxFor(char), { voice: true, tag: "netroom",
        instruction: Core.memoryInstruction(Object.assign({}, live, { msgs: part.fresh }), { id: char.id, name: char.remark || char.name, you: props.youFor ? props.youFor(char.id) : "" }, part.before),
        schemaHint: "{\"memory\":\"一小段，第三人称\"}", maxTokens: 12000 });
      // 失败自动再试一次；还不行才报给她（她能在「以前的房间」里点重试）
      let d; try { d = await ask(); if (!String((d && d.memory) || "").trim()) d = await ask(); } catch (e) { d = await ask(); }
      const text = String((d && d.memory) || "").trim();
      if (!text) throw new Error("没浓缩出什么");
      props.onAddMemory && props.onAddMemory(text, char.id);
      // 刚聊完那几天，单聊里接得上原话：只给勾了记忆的这个人存一段房间最后几句（app 那边过了「最近几天」就不带）
      try { const echo = loadJSON("x_roomEcho", {}) || {};
        echo[charId] = { ts: Date.now(), text: Core.echoText(live, part.fresh, char.remark || char.name, props.youFor ? props.youFor(char.id) : "") };
        saveJSON("x_roomEcho", echo); } catch (e) {}
      const rem = Object.assign({}, (Core.loadRooms().find(x => x.id === r.id) || r).remembered || {}, { [charId]: part.upTo });
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
      let ok = 0; const bad = [];
      for (const id of ids) { try { await remember(r, id); ok++; } catch (e) { bad.push(((charsById[id] || {}).name || "TA") + "（" + ((e && e.message) || e) + "）"); } }
      setSaving(false); setRoom(null); setMemPick({}); entered.current = false; refresh();
      // 有人没记上：直接停在这个房间的记录页，那儿每个人一颗「记进 TA 的记忆」就是重试
      if (bad.length) { props.toast && props.toast((ok ? "记进了 " + ok + " 个人；" : "") + "没记上：" + bad.join("、") + "。在这页点那个人的按钮重试"); setViewId(r.id); setPage("view"); return; }
      if (ok) props.toast && props.toast("记进了 " + ok + " 个人的记忆");
      setPage("home");
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
      h(Note, { key: "n" }, "把房间号发给要来的人（算上你最多四个人），让她们在「联机」里点「输入房间号加入」。第一个人连上你就能进房间，后来的人随时能进。要来的人得开着这一页；20 秒连不上会提示。")
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

    const REJOIN_NOTE_PEERS = "房里暂时没有别人在线。谁回来点「重新连上」就会接上；你这边断了也点一下。刚才的记录都在。", REJOIN_NOTE_ALONE = "还没有别人进来。";
    // 输入区（点谁谁说那排＋输入框）：整页聊天和半窗聊天用同一份
    const composerEl = () => { const myChars = ((room && room.myChars) || []); const alone = !mesh.current || net.reach.length === 0;
      return (
h("div", { key: "cp", "data-wk": "nrcomposer", className: "shrink-0", style: { borderTop: "1px solid " + t.line, background: t.bg, padding: "8px 12px", paddingBottom: COMPOSER_PAD_BOTTOM } },
          myChars.length > 0 && h("div", { className: "flex items-center", style: { gap: 10, paddingBottom: 8, overflowX: "auto" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, flexShrink: 0 } }, "点谁谁说"),
            myChars.map(c => h("button", { key: c.id, "data-wk": "nrspeaker", disabled: !!busy[c.id] || alone, onClick: () => speak(c),
              className: "active:opacity-60 disabled:opacity-40", style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 44 } },
              h(Avatar, { character: charsById[c.id] || { id: c.id, name: c.name }, size: 32 }),
              h("span", { style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog } }, busy[c.id] ? "在想…" : c.name))),
            // 一起说：带了两个以上的人才有；一次调用让他们像群里那样轮流接话
            myChars.length > 1 && props.castFor && h("button", { "data-wk": "nrtogether", disabled: myChars.some(c => busy[c.id]) || alone, onClick: () => speakTogether(myChars.map(c => c.id)),
              className: "active:opacity-60 disabled:opacity-40", style: { flexShrink: 0, minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(11.5), color: t.ink } },
              myChars.some(c => busy[c.id]) ? "在想…" : "一起说")),
          h(Composer, { onSend: sayHuman, disabled: alone, fillRef, plusOn: panel, onPlus: () => setPanel(v => !v) }))); };
    if (page === "chat" && room) {
      const myChars = (room.myChars || []);
      const alone = !mesh.current || net.reach.length === 0;
      const online = 1 + net.reach.length;
      const tail = Object.keys(busy).filter(k => busy[k]).map(k => h(Note, { key: "b" + k }, ((charsById[k] && (charsById[k].remark || charsById[k].name)) || "TA") + " 正在想…"))
        .concat(Object.keys(peerTyping).map(k => h(Note, { key: "p" + k }, peerTyping[k] + " 正在输入…")));
      // 房里每个人一格：在线 / 直连不上（别人在转）/ 连不上 / 离开了
      const stateOf = id => net.open.indexOf(id) >= 0 ? "on" : net.reach.indexOf(id) >= 0 ? "relay" : net.fail.indexOf(id) >= 0 ? "fail" : "off";
      const stateText = { on: "在线", relay: "直连不上，别人在帮你们转", fail: "和她连不上", off: "离开了" };
      const peers = room.peers || [];
      const trouble = peers.filter(p => stateOf(p.peerId) === "fail" || stateOf(p.peerId) === "relay");
      const gp = gameParts();
      const chatCore = [
        h(MsgList, { key: "ml", room, myCharsById: charsById, tail, rowProps: rowProps(room, true) }),
        alone && h("div", { key: "rj", "data-wk": "nrrejoinbar", className: "shrink-0 flex items-center", style: { gap: 10, padding: "8px 14px", borderTop: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog, lineHeight: 1.5 } }, peers.length ? REJOIN_NOTE_PEERS : REJOIN_NOTE_ALONE),
          peers.length > 0 && h(Btn, { label: "重新连上", primary: true, onClick: () => rejoin(room), wk: "nrrejoin" })),
        composerEl()];
      if (gp && gp.full) return shell(
        h(Head, { zh: gp.zh, sub: "房间 " + room.code + " · 在线 " + online + " 人", onBack: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w),
          right: h("button", { "data-wk": "nrgameback", onClick: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "回到聊天") }),
        h("div", { "data-wk": "nrgamefull", className: "flex-1 min-h-0" }, gp.body),
        h(HalfWinFrame, { win: chatWin, setWin: setChatWin, forKey: "netchat",
          pillLabel: "房间聊天" + (gp.unread ? " · " + gp.unread + " 条新消息" : "") + " ▴", pillHot: gp.unread > 0 },
          h("div", { "data-wk": "nrchathalf", className: "h-full flex flex-col", style: { background: t.bg } }, chatCore)),
        ...roomExtras({ t, room, sheet, setSheet, props, myNick, charsById, panel, onTap, patTargets, headCount, sendEmote, sendPhoto, sendCard, sayRich, sendRp,
          photoImgs, setPhotoImgs, photoText, setPhotoText, fillRef, rpOpen, setRpOpen, openRp, myKey, menuAt, setMenuAt, menuItems, onMenu }),
        joinSheet());
      return shell(
        h(Head, { zh: "房间 " + room.code, sub: "在线 " + online + " 人", onBack: () => setPage("leave"),
          right: h("button", { "data-wk": "nrleave", onClick: () => setPage("leave"), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "退出") }),
        peers.length > 0 && h("div", { "data-wk": "nrpeerbar", className: "shrink-0", style: { padding: "6px 14px", borderBottom: "1px solid " + t.line, display: "flex", flexWrap: "wrap", gap: "4px 12px" } },
          peers.map(p => { const st = stateOf(p.peerId); return h("span", { key: p.peerId, "data-wk": "nrpeer", "data-state": st, style: { fontFamily: F_BODY, fontSize: fs(11.5), color: st === "on" ? t.ink : t.fog } },
            (st === "on" ? "● " : "○ ") + p.nick + (st === "on" ? "" : " · " + stateText[st])); }),
          trouble.length > 0 && h("div", { style: { width: "100%", fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5 } },
            "和 " + trouble.map(p => p.nick).join("、") + " 直连不上：" + (trouble.some(p => stateOf(p.peerId) === "relay") ? "话由房里其他人转过去，可能慢一点。" : "她收不到你的话。两边都换成 Wi-Fi 再试。"))),
        ...chatCore,
        ...roomExtras({ t, room, sheet, setSheet, props, myNick, charsById, panel, onTap, patTargets, headCount, sendEmote, sendPhoto, sendCard, sayRich, sendRp,
          photoImgs, setPhotoImgs, photoText, setPhotoText, fillRef, rpOpen, setRpOpen, openRp, myKey, menuAt, setMenuAt, menuItems, onMenu }),
        joinSheet(), gp && gp.pill);
    }

    // ── 小游戏那几页 ──
    if (page === "gamepick" && room) {
      // 挑游戏、设开局：就是小游戏大厅那一套，只摆接得住多台手机一起玩的那几盒；勾的角色＝你这边上场的人
      const G = root.Games;
      const mine = (room.myChars || []).map(c => charsById[c.id]).filter(Boolean);
      if (!G || !root.NetGameCore) return shell(h(Head, { zh: "小游戏", onBack: () => setPage("chat") }), scroll([h(Note, { key: "n" }, "小游戏没装上，回去再点一次试试。")]));
      // 联机这一桌接不住的那几项收起来（彩头、注入最近聊天、言秋亲打、教学、谁来想棋、25 问谁出题——谁出题在下一页选），每盒写一句这边怎么玩
      const NOTE = { gomoku: "落子归 app 里的棋手（角色、NPC 都是），不花调用。", chess: "角色照 TA 估过的水平走（没估过按会下），NPC 由房主那台走；没有提示、悔棋和教学。",
        xiangqi: "角色照 TA 估过的水平走（没估过按会下），NPC 由房主那台走；没有提示、悔棋和教学。", jungle: "角色照 TA 估过的水平走（没估过按会下），NPC 由房主那台走；没有提示、悔棋和教学。",
        go: "棋盘大小照下面挑的；双方连着停一手就由房主那台估死子、数子。没有提示、悔棋和教学。", haigui: "下一页选谁出题。", q25: "下一页选谁出题。",
        story: "三圈，每人每次抽一个要用上的词；角色用带 TA 来的那台、TA 自己的线路接。", tod: "每人约两轮，题由下一位出；角色出题、回答都用带 TA 来的那台的线路。",
        monopoly: "钱和地都在房主那台结算；不买的地自动拍卖，讨价还价在房间里说。",
        spy: "词由房主那台出、只发到各人自己的手机；描述、投票轮流来，角色用带 TA 来的那台、TA 自己的线路。",
        uno: "每人的手牌只发到自己那台；角色、NPC 由手机替着出（不花调用）。没有「每人自己想」。",
        oldmaid: "每人的手牌只发到自己那台，抽的时候只看得到下家牌背。", liar: "每人的骰子只发到自己那台，开了才一起亮。",
        poker: "底牌只发到自己那台，摊牌才亮；角色、NPC 由手机替着下（不花调用）。没有「输的人答真心话」和「每人自己想」。",
        blackjack: "庄家是手机；每人的牌只发到自己那台，一手结算时才一起亮。没有「TA 坐庄」和「每人自己想」。",
        doudizhu: "正好 3 个座位，真人不够用角色和 NPC 补；手牌只发到自己那台，底牌定了地主才亮。",
        mahjong: "正好 4 个座位，真人不够用角色和 NPC 补；手牌只发到自己那台。牌墙自动摸；四川的换三张、定缺由手机替每家挑。",
        lingxi: "两个人各写各的，两边都交了才一起亮；角色用带 TA 来的那台、TA 自己的线路。房主随时能结束。" };
      // 不在单机小游戏目录里、只在房间里有的那几盒（辩论擂台）：摆在架子最后，点了去它自己的开局页
      const extra = root.NetGameCore.supported().filter(k => k !== "debate").map(k => root.NetGameCore.ADAPTERS[k].shelf).filter(Boolean)
        .map(g => Object.assign({}, g, { onPick: () => { setGamePend({ game: g, cfg: {} }); setPage("gameprep"); } }));
      return h(G, { characters: mine, profile: props.profile, only: root.NetGameCore.supported(), extra, onConfigured,
        setupHide: ["stake", "injectChat", "ccSeat", "boardTeach", "gmkBrain", "q25Host", "skillPins", "cardBrain", "bjDealer", "pkTruth", "mjAutoDraw", "mjSwap"], setupNote: g => (NOTE[g.key] || "") + (GC() && GC().charOptKinds(g.key).length ? "你带的角色怎么玩（牌技、牌手水平、随手、带不带最近单聊）在邀请卡上点「换人／加入」那张单里调。" : ""),
        intro: "挑一盒、设好开局（开局页里勾的角色就是你这边上场的人），房里会出现一张邀请卡，大家在卡上报名，你点开始。", onBack: () => setPage("chat") });
    }
    // 自己带开局页的那几盒（辩论擂台）：页面在它自己的文件里，这儿只套顶栏
    const prepA = page === "gameprep" && room && gamePend && GC() ? GC().ADAPTERS[gamePend.game.key] : null;
    if (prepA && prepA.Prep) return shell(h(Head, { zh: gamePend.game.zh, onBack: () => setPage("gamepick") }), scroll([
      h(prepA.Prep, { key: "p", myChars: (room.myChars || []).map(c => charsById[c.id]).filter(Boolean), myApi: props.gameApi ? props.gameApi() : null, nick: myNick(), onSend: (cfg, pz) => sendInvite(gamePend.game, cfg, pz) })]));
    if (page === "gameprep" && room && gamePend) {
      // 谁出题：房主（就是你，下面写或者现出）／系统现出／指定一个座位／轮流（每局「再来一局」换下一个座位）。出题的人这一局不参与问
      const soup = gamePend.game.key === "haigui", md = prep.mode;
      const MODES = [{ key: "host", zh: "我出" }, { key: "system", zh: "系统出" }, { key: "seat", zh: "指定一个人" }, { key: "turns", zh: "轮流" }];
      const tip = { host: "你是庄也是出题人：" + (soup ? "汤底" : "答案") + "只在你这台手机上，别人看不到。自己写一道就填下面两格；空着就用你的线路现出一道（开局时出，花你一次调用）。你坐在桌上的话这一局不参与问。",
        system: "开局时用你（庄）的线路现出一道，谁都不知道" + (soup ? "汤底" : "答案") + "，大家一起猜。判每个问题也走你的线路。",
        seat: "大家坐好以后，在邀请卡上点「出题人」选是谁（真人或者谁带来的角色）。开局时出题的人在她自己那台手机上出题（选的是角色，就由带 TA 来的那台用 TA 的线路和人设出），" + (soup ? "汤底" : "答案") + "只交给你这台判题，别人看不到；出题的这一局不参与问。",
        turns: "跟「指定一个人」一样，先由第一个坐下的人出；每打完一局点「再来一局」，出题人按座位顺序换下一个。" }[md];
      return shell(h(Head, { zh: soup ? "出一锅汤" : "出一道 25 问", onBack: () => setPage("gamepick") }), scroll([
        h("div", { key: "m", "data-wk": "nrsettermode", className: "flex flex-wrap", style: { gap: 6 } }, MODES.map(o => h("button", { key: o.key, onClick: () => setPrep(p => Object.assign({}, p, { mode: o.key })),
          style: { minHeight: 36, padding: "0 14px", borderRadius: 999, border: "1px solid " + (md === o.key ? t.ink : t.line), background: md === o.key ? t.ink : t.bg2, color: md === o.key ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(13) } }, o.zh))),
        h(Note, { key: "n" }, tip),
        md === "host" && h("textarea", { key: "s", "data-wk": "nrsoupsurface", value: prep.surface, rows: soup ? 3 : 1, placeholder: soup ? "汤面：大家看得到的那段怪事" : "答案：一个东西（比如：雨伞）", onChange: e => setPrep(p => Object.assign({}, p, { surface: e.target.value.slice(0, soup ? 600 : 40) })),
          style: { width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) } }),
        md === "host" && h("textarea", { key: "t", "data-wk": "nrsouptruth", value: prep.truth, rows: soup ? 4 : 1, placeholder: soup ? "汤底：真相（只你看得到）" : "类别（大家看得到）：比如 物品", onChange: e => setPrep(p => Object.assign({}, p, { truth: e.target.value.slice(0, soup ? 1200 : 20) })),
          style: { width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) } }),
        h(Btn, { key: "go", label: "发邀请卡", primary: true, wk: "nrsoupsend", onClick: () => {
          const pz = md === "host" && prep.surface.trim() && (prep.truth.trim() || !soup) ? (soup ? { surface: prep.surface, truth: prep.truth } : { secret: prep.surface, category: prep.truth }) : null;
          sendInvite(gamePend.game, gamePend.cfg, pz, { mode: md });
        } })
      ]));
    }
    if (page === "gamerec") {
      const r = (room && room.id === viewId ? room : null) || rooms.find(x => x.id === viewId) || room;
      const m = r && (r.msgs || []).find(x => x.id === recId);
      const A = m && root.NetGameCore ? root.NetGameCore.ADAPTERS[m.x.key] : null;
      const back = () => setPage(room && entered.current ? "chat" : "view");
      return shell(h(Head, { zh: m ? m.x.zh + " · 回看" : "回看", onBack: back }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: 24 } },
          m && h("div", { style: { padding: "12px 16px 0" } }, h(Note, null, m.x.text)),
          m && A && m.x.replay && root.GameShared ? h(A.Replay, { rec: m.x }) : h("div", { style: { padding: 16 } }, h(Note, null, m ? "这一局没有能回看的棋谱。" : "找不到这张战绩卡了。"))));
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
              label: !(r.remembered || {})[c.id] ? "记进 " + c.name + " 的记忆" : Core.sinceRemembered(r, c.id).fresh.length ? "把新聊的记进 " + c.name + " 的记忆" : c.name + " 已经记到最新", onClick: () => fill(c.id) }))),
          h("div", { className: "shrink-0", style: { padding: "10px 14px", borderBottom: "1px solid " + t.line } },
            h(Btn, { label: "重新连上这个房间", primary: true, wide: true, onClick: () => { setNick(r.myNick || nick); rejoin(r); }, wk: "nrrejoin" }),
            h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "房里还有人开着就直接接上；都走了的话，要别人也在她那边的「以前的房间」里点开这个房间、点「重新连上」。记录接在后面，断开那会儿的话会补齐。")),
          h(MsgList, { room: r, myCharsById: charsById, rowProps: rowProps(r, false) }),
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
