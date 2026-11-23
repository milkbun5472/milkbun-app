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
  // 自己的中转（TURN，她 11-23「教她们搭」）：两台手机怎么都直连不上时，话经它转过去。
  //   只要房里有一个人填了，跟她相连的那几条一般就能通；内容照旧加密，中转看不到聊什么。
  //   地址可填几条（逗号/空格/换行隔开），没写 turn:/turns: 的补成 turn:
  function cleanTurn(o) {
    if (!o || typeof o !== "object") return null;
    const urls = String(o.url || "").split(/[\s,，]+/).map(u => u.trim()).filter(Boolean)
      .map(u => /^turns?:/i.test(u) ? u : "turn:" + u.replace(/^[a-z]+:\/\//i, ""));
    if (!urls.length) return null;
    return { urls, username: String(o.user || "").trim(), credential: String(o.pass || "").trim() };
  }
  const iceFor = turn => { const c = cleanTurn(turn); return c ? ICE_SERVERS.concat([c]) : ICE_SERVERS; };
  const CONNECT_TIMEOUT = 20000;
  const FAIL_TEXT = "你们的网络直连不上：两边开着梯子的先关掉，再开一次房间；还不行就换一种连法（比如一边改用流量），或者在联机首页「连不上的时候」里填一个自己的中转";
  // 房间号这一步（递名片）没走通：公共中转那条提示里带上备用路；自己的 Supabase 那条指出该查什么
  const BROKER_FAIL_TEXT = "房间号这一步没走通：公共中转这会儿连不上，过一会儿再试。也可以改用自己的 Supabase：开房的人在「联机」首页打开「用自己的 Supabase 递名片」再开房，把连接码整串发给要来的人（怎么配见秋秋攻略「联机」）。";
  const SUPA_FAIL_TEXT = "连不上这个 Supabase：看项目地址和公开密钥对不对、项目有没有被暂停（Paused）。也可以关掉「用自己的 Supabase 递名片」改走公共中转。";
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
    const q = cleanQuote(m.quote); if (q) w.quote = q;
    const x = m.type ? cleanRich(m.type, m.x, local) : null;
    if (x) { w.type = m.type; w.x = x; w.text = richLine(w).slice(0, 8000); }
    return w;
  }
  // 引用：线上只带三样——被引那条的 id、谁说的、原话前 80 字。旧版对端不认得 quote，只显示正文
  function cleanQuote(q) {
    if (!q || typeof q !== "object" || !q.id) return null;
    return { id: String(q.id).slice(0, 60), name: String(q.name || "").slice(0, 40), text: String(q.text || "").replace(/\s+/g, " ").slice(0, 80) };
  }
  // 引一条：谁说的照气泡上那个名字（角色是角色名，真人是 TA 的昵称）
  function quoteOf(room, m) {
    if (!m || m.sys || m.recalled) return null;
    return cleanQuote({ id: m.id, name: m.kind === "char" ? m.name : ownerNick(room, m), text: m.type ? richLine(m) : m.text });
  }
  // 被引的那条现在怎样：还在 / 撤回了 / 删掉了（找不到）
  function quoteState(room, q) {
    const m = q && ((room && room.msgs) || []).find(x => x.id === q.id);
    return !m ? "gone" : m.recalled ? "recalled" : "ok";
  }
  // 给模型的引用编号：最后 n 条能引的话各一个 Q 号（transcript 里标在行首，模型填 quote 用它）
  function quoteCatalog(room, n) {
    const ms = ((room && room.msgs) || []).filter(m => m && !m.sys && !m.recalled && m.type !== "pat").slice(-(n || 30));
    return ms.map((m, i) => ({ alias: "Q" + (i + 1), id: m.id }));
  }
  function resolveQuote(room, alias) {
    const a = String(alias || "").trim().toUpperCase(); if (!/^Q\d+$/.test(a)) return null;
    const hit = quoteCatalog(room, 30).find(x => x.alias === a);
    return hit ? quoteOf(room, ((room && room.msgs) || []).find(m => m.id === hit.id)) : null;
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
  // face：这个人自己的名片（名字＋进房时那张小头像，跟角色名片同一套 cleanCard）；旧版对端不发，就留着上次的
  function upsertPeer(room, peerId, nick, chars, face) {
    const r = normalizeRoom(room);
    const peers = (r.peers || []).slice();
    let i = peers.findIndex(p => p.peerId === peerId);
    let msgs = r.msgs || [];
    if (i < 0) {
      const j = peers.findIndex(p => p.peerId === LEGACY && p.nick === nick);
      if (j >= 0) { i = j; msgs = msgs.map(m => m.peerId === LEGACY ? Object.assign({}, m, { peerId }) : m); }
    }
    const old = i >= 0 ? peers[i] : null;
    const rec = { peerId, nick: String(nick || "对方").slice(0, 20), chars: (chars || []).slice(0, 8) };
    const fc = face && typeof face === "object" ? cleanCard(face) : (old && old.face) || null;
    if (fc && (fc.avatar || fc.emoji || fc.color)) rec.face = fc;
    if (i >= 0) peers[i] = rec; else peers.push(rec);
    return Object.assign({}, r, { peers, msgs });
  }
  // 最近一次进房用的昵称（「朋友」是没填时的兜底，不算她填的）
  const lastNick = rooms => { const r = (rooms || []).slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)).find(x => x && String(x.myNick || "").trim() && x.myNick !== "朋友"); return r ? String(r.myNick).trim().slice(0, 20) : ""; };
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
  //   这个房间里我当庄、还没打完的那几局存档（netroom-games.js 的 x_netGameHost）也一起删
  const HOST_GAMES_KEY = "x_netGameHost";
  const hostGamesIn = id => { try { const v = loadJSON(HOST_GAMES_KEY, {}); return Object.keys((v && v[id] && v[id].games) || {}).length; } catch (e) { return 0; } };
  function removeRoom(id) {
    try { saveRooms(loadRooms().filter(r => r.id !== id)); } catch (e) {}
    try { const v = loadJSON(HOST_GAMES_KEY, {}); if (v && v[id]) { delete v[id]; saveJSON(HOST_GAMES_KEY, v); } } catch (e) {}
  }
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
    const add = (list || []).filter(m => m && m.id && !have.has(m.id) && !isDropped(room, m));
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
    const alias = {}; ((opts && opts.catalog) || []).forEach(x => { alias[x.id] = x.alias; });
    return (room.msgs || []).map(m => {
      const st = stamp ? stamp(m.ts) : "", pre = (alias[m.id] ? "[" + alias[m.id] + "] " : "") + (st ? "〔" + st + "〕" : "");
      if (m.sys) return pre + "（" + String(m.text || "").trim() + "）";
      const who = m.kind === "char" ? m.name + "（" + ownerNick(room, m) + " 带来的）" : ownerNick(room, m);
      if (m.recalled) return pre + who + " 撤回了一条消息";
      const q = m.quote ? "（回复 " + (m.quote.name || "有人") + "：「" + m.quote.text + "」" + (quoteState(room, m.quote) === "ok" ? "" : "，那条后来没了") + "）" : "";
      const body = m.type ? richLine(m) : String(m.text || "").trim();
      return pre + (m.type === "pat" ? "" : who + "：") + q + body + (m.edited ? "（改过）" : "");
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
  //   watch＝她开着「旁观」：人在看，但角色当她不在——这一行只写她带来的人，不说她在场
  const PRESENCE_ZH = { on: "此刻在房里", relay: "此刻在房里", fail: "此刻跟这边连不上，听不到房里说的话", off: "已经离开了房间，听不到房里说的话", watch: "本人此刻不在房里，听不到房里说的话" };
  function sidesLines(room, presence) {
    return (room.peers || []).map(p => {
      const names = (p.chars || []).map(c => c.name).filter(Boolean);
      const st = presence && PRESENCE_ZH[presence[p.peerId] || "off"];
      if (presence && presence[p.peerId] === "watch") return names.length ? "\n- " + names.join("、") + "（是 " + p.nick + " 带来的，" + p.nick + " " + st + "）。" : "";
      return "\n- " + p.nick + (names.length ? "，TA 带来的是：" + names.join("、") : "，没带人") + (st ? "（" + st + "）" : "") + "。";
    }).join("");
  }
  // 房里此刻在场的真人有几个（自己旁观不算、别人旁观/离开不算；不给 presence 就照人头算）
  function humansHere(room, o) {
    const ps = room.peers || [];
    return (o.watch ? 0 : 1) + (o.presence ? ps.filter(p => o.presence[p.peerId] === "on" || o.presence[p.peerId] === "relay").length : ps.length);
  }
  // 房间开头那一句：自己旁观时不提她的名字、不说「带你来的人在房里」
  function roomHead(room, o) {
    return o.watch ? "【这里是联机房间】几台手机连在了一起，每人各带了自己的人进来，大家在同一个房间里说话。此刻房里在场的真人有 " + humansHere(room, o) + " 个。"
      : "【这里是联机房间】" + room.myNick + " 用自己的手机和别人的手机连在了一起，房间里一共 " + (1 + (room.peers || []).length) + " 个人，每人各带了自己的人进来，大家在同一个房间里说话。";
  }
  // 「带你来的是谁」那一句：旁观时只说那个人此刻不在，面具名、房里用的名字一概不给
  const bringLine = (room, char, o) => o.watch ? "带你来的人此刻不在房里，听不到房里说的话" : "带你来的是 " + youLine(room, char);
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
  // ＋ 里那些角色也能自己用的（字段名和说法照群聊那份：pollNew / askNew / redpacket / voice / photo，单聊的 location，朋友圈的 song）。
  //   单人开口和一起说共用这一份；joint＝一起说那份（每人一条，voice 填 true），否则单人那份（voice 是几句话的数组）。
  //   o.photo：能拍照的人（单人＝true/false；一起说＝名字数组）；o.songs：手边那些歌的歌名；o.cards：能推名片的人名
  function actBits(o, joint) {
    o = o || {};
    const bits = [
      "\"pollNew\":{\"title\":\"投票题目\",\"options\":[\"选项1\",\"选项2\"],\"anon\":true或false}——房里要拿主意、要挑一个、要看看大家怎么想时，谁都可以自己发起一张投票（至少两个选项；anon 为匿名投票），房里的人和别人带来的人都能投",
      "\"askNew\":{\"what\":\"想干嘛\",\"reason\":\"理由\",\"amount\":要花的钱数（不花钱写 0）}——自己有件事想先让大家批（想买个东西、想请假……照这个人会有的事），大家投准或驳，过半就准",
      "\"redpacket\":{\"total\":金额数字,\"count\":份数,\"message\":\"祝福语\"}——有好事想请客、谁有喜事、哄人、认输赔罪、节日、或者纯粹想热闹一下的时候就发，不必等人开口要；房里的红包只是玩法、不动钱包，数目照这个人的处境和性子来",
      "\"location\":{\"name\":\"在哪儿\"}——想让房里知道你此刻在哪儿时发个位置",
      joint ? "\"voice\":true——这条作为语音发（显示成语音气泡+转文字）：手上腾不出手打字、这段话打字太长、或者情绪上来了想让人听见声音时就这么发，不必等人问；发多发少按这个人自己的习惯来"
        : "\"voice\":[\"说成语音的那句\"]——这几句用语音发（显示成语音气泡+转文字，不用再写进 say）：手上腾不出手打字、这段话打字太长、或者情绪上来了想让人听见声音时就这么发，不必等人问；发多发少按这个人自己的习惯来",
      "\"namecard\":\"名字\"——想把一个人介绍给房里认识，就推 TA 的名片（只带名字和头像）" + ((o.cards || []).length ? "，能推的：" + o.cards.slice(0, 30).join("、") : ""),
      "\"topic\":\"一句话题\"——冷场了、或者想换个话头，就抛一张话题卡给大家接",
      o.songOn ? "\"song\":\"歌名 歌手\"——想给房里放一首歌时发，成一张歌曲卡，大家都能点开听" + ((o.songs || []).length ? "；你手边那些歌里有：" + o.songs.slice(0, 30).join(" / ") + "，也可以是别的歌" : "") + ((o.playlist || []).length ? "；想点房间歌单里的哪首就写那首（歌单里有：" + o.playlist.slice(-12).join(" / ") + "）" : "") : ""
    ].filter(Boolean);
    const ph = joint ? (o.photo || []).filter(Boolean) : o.photo ? ["你"] : [];
    if (ph.length) bits.push("\"photo\":{\"kind\":\"self（自拍）/ part（只露一截身体）/ view（画面里没有人）\",\"scene\":\"画面里是什么\"}——想让房里看看你此刻的样子、或者眼前的东西时拍一张，手机会真画出来" + (joint ? "（能拍的：" + ph.join("、") + "）" : ""));
    boardBits(o.board).forEach(b => bits.push(b));   // 墙和文档（房间里摆着的东西，见 boardBits）
    return bits;
  }
  // 房里此刻谁在听什么（正在听那份在线状态），开口时带上
  const listenBlock = o => { const L = (o && o.listen) || []; return L.length ? "\n\n【房里此刻在放的歌】\n" + L.join("\n") + "\n（各人在自己手机上放，两边不同步；聊到时你清楚是这首，能自然接住）" : ""; };
  function capLines(room, char, opts) {
    const o = opts || {}, bits = [];
    const emotes = (o.emotes || []).filter(Boolean);
    bits.push("\"quote\":\"Q 编号\"——想正式回上面某一句（让它挂在你第一条气泡上面）就填那行前面的 Q 号；只是顺着聊不用填");
    if (emotes.length) bits.push("\"emote\":\"表情关键词\"——想甩一张表情包时填，只能从这几张里挑：" + emotes.slice(0, 120).join(" / ") + "。发多发少看你这个人");
    const tg = (o.targets || []).filter(x => x && x !== char.name);
    if (tg.length) bits.push("\"pat\":\"名字\"——想用「拍一拍」戳房里谁一下就填 TA 的名字（" + tg.join("、") + "）；是一个动作，不用再在 say 里写「拍了拍」");
    const poll = (room.msgs || []).slice().reverse().find(m => m.type === "poll" && !m.recalled && m.x && !(m.x.options || []).some(op => (op.voters || []).indexOf(char.name) >= 0));
    if (poll) bits.push("\"vote\":\"选项原文\"——房里那张" + (poll.x.ask ? "请示「" + poll.x.ask.what + "」（选项：准 / 驳）" : "投票「" + poll.x.title + "」（选项：" + poll.x.options.map(op => op.text).join(" / ") + "）") + "你还没投，想投就填");
    actBits(o.acts, false).forEach(b => bits.push(b));
    return "\n\n【顺手能做的】说话以外，这一次还可以在同一个 JSON 里加：\n- " + bits.join("\n- ") + "\n不想做就省略。别人发的红包不用你管：房里有红包时你会自己去抢。";
  }
  function lineInstruction(room, char, opts) {
    room = normalizeRoom(room);
    const o = opts || {}, gap = sinceLast(room, o.now), pr = promptRoom(room).room;
    const mine = (room.myChars || []).filter(c => c.id !== char.id).map(c => c.name);
    return roomHead(room, o)
      + "\n- " + bringLine(room, char, o) + (mine.length ? "，跟你一起来的还有：" + mine.join("、") : "") + "。"
      + "\n另外几方：" + (sidesLines(room, o.presence) || "\n- （还没别人进来）")
      + "\n别人带来的这几位你只知道名字和他们在这里说过的话，其余的你不知道，也不用替他们补。"
      + (o.known || "")
      + recapBlock(room)
      + "\n\n【房间里到现在的聊天】" + (o.stamp ? "（每行前面〔〕里是那句话说的时间，只是时间标记，不要写进你说的话）" : "") + "\n" + (transcript(pr, Object.assign({}, o, { catalog: quoteCatalog(pr, 30) })) || "（还没人说话）")
      + (o.game ? "\n\n" + o.game : "") + listenBlock(o) + (o.boardText || "")
      + (gap ? "\n（最后一条到现在已经过去 " + gap + " 了）" : "")
      + "\n\n【这一次】轮到你在房间里开口，接着上面的话开口，照你平时发消息的习惯：一条一个气泡，想连发几条就几条，跟在群里聊天一样。只写你说出口的话本身，不写旁白，不替别人说话。"
      + capLines(room, char, o)
      + bans();
  }
  // 能拍的名字：旁观的真人不在场，拍不到（自己旁观就不带自己的昵称）
  function watchTargets(room, myNick, presence, watch) {
    const pr = presence || {}, ps = (room && room.peers) || [];
    return ps.filter(p => pr[p.peerId] !== "watch").map(p => p.nick)
      .concat(((room && room.myChars) || []).map(c => c.name), ...ps.map(p => (p.chars || []).map(c => c.name)), watch ? [] : [myNick]).filter(Boolean);
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
    const o = opts || {}, gap = sinceLast(room, o.now), list = (chars || []).filter(c => c && c.name), pr = promptRoom(room).room;
    const names = list.map(c => c.name);
    const others = (room.myChars || []).filter(c => names.indexOf(c.name) < 0).map(c => c.name);
    const you = o.watch ? "\n- 带他们来的人此刻不在房里，听不到房里说的话。" : list.map(c => "\n- 带「" + c.name + "」来的是 " + youLine(room, c) + "。").join("");
    const emo = list.filter(c => (c.emotes || []).length).map(c => "\n  · " + c.name + "：" + c.emotes.slice(0, 80).join(" / ")).join("");
    const tg = (o.targets || []).filter(Boolean);
    const poll = (room.msgs || []).slice().reverse().find(m => m.type === "poll" && !m.recalled && m.x);
    const pollLine = poll ? "\"vote\":\"选项原文\"——房里那张" + (poll.x.ask ? "请示「" + poll.x.ask.what + "」（选项：准 / 驳）" : "投票「" + poll.x.title + "」（选项：" + poll.x.options.map(op => op.text).join(" / ") + "）") + "，还没投的人想投就在自己那条里填" : "";
    return (typeof groupBans === "function" ? groupBans({ echo: false }) + "\n\n" : "")
      + (typeof GROUP_MULTI_BUBBLE === "string" ? GROUP_MULTI_BUBBLE + "\n\n" : "")
      + roomHead(room, o)
      + "\n这一次由你写「" + names.join("」「") + "」这几位在房间里接着往下说：写谁那一条你就是谁，像群里那样你一言我一语，接彼此的话也行、接房里别人的话也行，不是每人都得开口，同一个人也可以连发几条。"
      + you + (others.length ? "\n- 同一边带来、这一次不开口的还有：" + others.join("、") + "。" : "")
      + "\n另外几方：" + (sidesLines(room, o.presence) || "\n- （还没别人进来）")
      + "\n别人带来的人、房里的真人，你只知道名字和他们在这里说过的话，其余的不知道，也不替他们说话。"
      + (o.known ? o.known : "")
      + (o.cast ? "\n\n" + o.cast : "")
      + recapBlock(room)
      + "\n\n【房间里到现在的聊天】" + (o.stamp ? "（每行前面〔〕里是那句话说的时间，只是时间标记，不要写进说的话）" : "") + "\n" + (transcript(pr, Object.assign({}, o, { catalog: quoteCatalog(pr, 30) })) || "（还没人说话）")
      + (o.game ? "\n\n" + o.game : "") + listenBlock(o) + (o.boardText || "")
      + (o.stamp ? "\n（现在是〔" + o.stamp(o.now || Date.now()) + "〕）" : "")
      + (gap ? "\n（最后一条到现在已经过去 " + gap + " 了）" : "")
      + "\n\n【输出】只输出 JSON 数组，按说话先后排。每一条 {\"name\":\"说话的人，只能是 " + names.join(" / ") + " 之一\",\"text\":\"说出口的话本身，一条一个气泡\""
      + ",\"quote\":\"（可选）想正式回上面某一句时填那行前面的 Q 号\""
      + (emo ? ",\"emote\":\"（可选）想甩表情包时填关键词，只能从这个人自己那几张里挑\"" : "")
      + (tg.length ? ",\"pat\":\"（可选）想用「拍一拍」戳谁就填名字（" + tg.join("、") + "），是一个动作，不用再在 text 里写\"" : "")
      + (pollLine ? ",\"vote\":\"（可选）" + pollLine + "\"" : "") + "}。"
      + (emo ? "\n各人能用的表情：" + emo : "")
      + "\n说话以外，每人那一条里还可以顺手加（不想做就省略，同一条里的 text 照常说话）：\n- " + actBits(o.acts, true).join("\n- ")
      + "\n别人发的红包不用管：房里有红包时各人会自己去抢。"
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
    return arr.map(it => Object.assign({ char: it._c || members.find(c => c.name === it.name), text: String(it.text == null ? "" : it.text).trim(), emote: s(it.emote), pat: s(it.pat), vote: s(it.vote), quote: s(it.quote) },
      { acts: actsOf(it, { joint: true }) }))
      .filter(x => x.char && (x.text || x.emote || x.pat || x.acts.any));   // 一起说也不设条数上限（她 2026-11-22）
  }
  // 角色这一条里顺手做的那几样 → 要落成的东西（纯函数，单人和一起说同一份）。
  //   rich：直接能发的 [{type,x}]（投票、请示、位置、话题卡）；rp：红包；photo：要拍的那张（{kind,scene}，旧版 selfie 字符串＝自拍）；
  //   song：歌名（交给调用方去找）；card：要推名片的那个名字；voice：单人＝要说成语音的那几句，一起说＝true（这条整条用语音）
  function actsOf(d, o) {
    const out = { rich: [], rp: null, photo: null, song: "", card: "", note: "", file: null, voice: null, any: false };
    if (!d || typeof d !== "object") return out;
    const s = v => typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : "";
    const pn = d.pollNew;
    if (pn && typeof pn === "object") {
      const ops = (Array.isArray(pn.options) ? pn.options : []).map(x => s(String(x == null ? "" : x)).slice(0, 40)).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 6);
      if (s(pn.title) && ops.length >= 2) out.rich.push({ type: "poll", x: { title: s(pn.title).slice(0, 60), anon: pn.anon === true, options: ops.map(text => ({ text, voters: [] })) } });
    }
    const an = d.askNew;
    if (an && typeof an === "object" && s(an.what)) out.rich.push({ type: "poll", x: { title: "请示：" + s(an.what).slice(0, 40), anon: false,
      ask: { what: s(an.what).slice(0, 40), reason: s(an.reason).slice(0, 120), amount: money(an.amount) }, options: [{ text: "准", voters: [] }, { text: "驳", voters: [] }] } });
    const rp = d.redpacket;
    if (rp && typeof rp === "object" && money(rp.total) > 0) out.rp = { total: Math.min(money(rp.total), 99999), count: Math.max(1, Math.min(50, Math.round(Number(rp.count) || 1))), message: s(rp.message).slice(0, 40) || "恭喜发财，大吉大利" };
    const geo = d.location && typeof d.location === "object" ? s(d.location.name) : s(d.location);
    if (geo) out.rich.push({ type: "geo", x: { name: geo.slice(0, 60) } });
    if (s(d.topic)) out.rich.push({ type: "topic", x: { text: s(d.topic).slice(0, 200) } });
    if (d.photo && typeof d.photo === "object" && s(d.photo.scene || d.photo.desc)) {
      const k = String(d.photo.kind || "").toLowerCase();
      out.photo = { scene: s(d.photo.scene || d.photo.desc).slice(0, 300), kind: k === "view" || k === "none" ? "view" : k === "part" || d.photo.face === false ? "part" : "self" };
    } else if (s(d.selfie)) out.photo = { scene: s(d.selfie).slice(0, 300), kind: "self" };
    const sg = d.song && typeof d.song === "object" ? s([d.song.title, d.song.artist].filter(Boolean).join(" ")) : s(d.song);
    if (sg) out.song = sg.slice(0, 80);
    if (s(d.namecard)) out.card = s(d.namecard).slice(0, 40);
    // 墙上贴一张、往共用文档里写（形状照频道那份：note.text；file 的 name + add/remove 或 text）
    const nt = d.note && typeof d.note === "object" ? s(d.note.text) : s(d.note);
    if (nt) out.note = nt.slice(0, NOTE_MAX);
    const fl = d.file && typeof d.file === "object" ? d.file : null, lines = v => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x == null ? "" : x)).filter(x => x.trim()).slice(0, 60).map(x => x.slice(0, 400));
    if (fl && s(fl.name)) { const f = { name: s(fl.name).slice(0, 40), add: lines(fl.add), remove: lines(fl.remove) };
      if (typeof fl.text === "string" && fl.text.trim()) f.text = fl.text.slice(0, DOC_TEXT_MAX);
      if (f.text || f.add.length || f.remove.length) out.file = f; }
    if (o && o.joint) { if (d.voice === true || d.voice === "true") out.voice = true; }
    else if (Array.isArray(d.voice)) { const v = d.voice.map(x => typeof x === "object" && x ? s(x.t || x.text) : s(x)).filter(Boolean).map(x => x.slice(0, 2000)); if (v.length) out.voice = v; }
    else if (d.voice === true) out.voice = true;
    out.any = !!(out.rich.length || out.rp || out.photo || out.song || out.card || out.note || out.file || (Array.isArray(out.voice) && out.voice.length));
    return out;
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
      + (() => { const met = metIn(room); return met.length ? "\n另外在 people 里给别人带来的这几位各写一两句 " + (char.name || "TA") + " 对 TA 的印象（第三人称，只照这里看到的写）：" + met.map(w => "「" + w.name + "」").join("、") + "。" : ""; })()
      + boardMemo(room)
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
  // topic＝话题卡（一句话题）；song＝歌曲卡：只有歌名、歌手、封面小图（网址）、能公开放的那串编号，音频本体从不上线
  const RICH_TYPES = ["emote", "photo", "voice", "geo", "pat", "rp", "poll", "namecard", "file", "game", "gamerec", "topic", "song"];
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
      if (x.pic || x.img || localRef(x.imageRef)) o.pic = true;   // 这张本来有图（补发时没带图的，收的人凭它来要）
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
    if (type === "topic") { const tx = cut(x.text, 200).trim(); return tx ? { text: tx } : null; }
    if (type === "song") return cleanSong(x);
    if (type === "file") return { name: cut(x.name, 80), size: Math.max(0, Number(x.size) || 0), chars: Math.max(0, Number(x.chars) || 0), cut: !!x.cut, text: cut(x.text, FILE_TEXT_MAX) };
    return null;
  }
  // 歌曲卡 / 正在听：只认这几样。cover 只收网址（不收 dataURL）；nid 只收数字（公开的那串歌曲编号）
  function cleanSong(x) {
    if (!x || typeof x !== "object") return null;
    const title = cut(x.title, 60).trim(); if (!title) return null;
    const o = { title, artist: cut(x.artist, 60).trim() };
    if (/^https?:\/\//.test(String(x.cover || ""))) o.cover = cut(x.cover, 600);
    const nid = String(x.nid || x.neteaseId || "").trim(); if (/^\d{1,20}$/.test(nid)) o.nid = nid;
    return o;
  }
  const songLine = x => "《" + ((x && x.title) || "") + "》" + (x && x.artist ? " - " + x.artist : "");
  // 别人发来的歌，点开在这台怎么放（不做两台同步，各放各的）：
  //   link＝带着公开编号、这台也接了音乐源 → 照那串编号直接放；local＝这台自己的曲库里按歌名（和歌手）对得上 → 放她自己那份；
  //   miss＝都没有 → 告诉她这首在发歌的人手机上，给可搜的歌名
  function songPlan(x, lib, canLink) {
    if (!x || !x.title) return { how: "miss", query: "" };
    const query = x.title + (x.artist ? " " + x.artist : "");
    if (x.nid && canLink) return { how: "link", query, song: { id: "sgd_" + x.nid, source: "netease", neteaseId: x.nid, title: x.title, artist: x.artist || "", cover: x.cover || null } };
    const norm = v => String(v || "").replace(/\s+/g, "").toLowerCase();
    const hit = (lib || []).find(s0 => s0 && norm(s0.title) === norm(x.title) && (!x.artist || !s0.artist || norm(s0.artist) === norm(x.artist)));
    if (hit && (hit.source !== "netease" || canLink)) return { how: "local", query, song: hit };
    return { how: "miss", query };
  }
  // 「正在听」：每台把自己此刻在放的那首当在线状态广播（不进记录）。np：{ peerId|"me": { who, title, artist } }
  function listenLines(np) {
    return Object.keys(np || {}).map(k => np[k]).filter(v => v && v.title && v.who).map(v => v.who + " 在听" + songLine(v));
  }
  // 一条消息给人读、给模型读的那一行
  function richLine(m) {
    const x = m.x || {}, who = m.name || "有人";   // 名字缺了：发的人可能是真人也可能是角色，不用 TA
    if (m.type === "emote") return "[表情] " + (x.keyword || "");
    if (m.type === "photo") return x.desc ? "[照片] " + x.desc : "[照片]";
    if (m.type === "voice") return "[语音] " + (x.content || "");
    if (m.type === "geo") return "[位置] " + (x.name || "");
    if (m.type === "pat") return who + " 拍了拍 " + (x.to || "某人");
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
    if (m.type === "topic") return "[话题卡] " + (x.text || "");
    if (m.type === "song") return "[分享了一首歌] " + songLine(x);
    if (m.type === "file") return "[文件] " + (x.name || "文件") + "（" + (x.chars || 0) + " 字" + (x.cut ? "，只给了前面一段" : "") + "）\n" + String(x.text || "").slice(0, 4000);
    return String(m.text || "");
  }
  // ───────────── 房间里的墙、歌单、文档（她 2026-11-22「把频道里的三样搬进联机房间」） ─────────────
  // 都挂在房间上：room.board = { notes, songs, docs, tombs }，跟聊天记录一起进存档、报到时整份补给别人。
  //   便签 { id, by, name, charId?, text, ts }：by＝贴的那台手机的 peerId（角色贴的也记在带 TA 来的那台上），name＝署名
  //   歌单 { id, by, name, song, ts }：手动加进来的那几首；房里发过的歌卡不另存，现算进来（id＝"sm_"+消息 id，归发卡的那个人）
  //   文档：跟频道文件同一个形状（engine.js 的 chfApplyDoc），多两样：ver＝第几版（只增不减，旧版本盖不了新版本）、
  //     names＝写过的人 key → 名字。key：真人＝peerId，角色＝peerId|charId（每人一种颜色就照 key 分）
  //   tombs [{ id, by }]：删掉的东西。只认作者本人删：by 对不上作者的那条墓碑不算数
  const NOTE_MAX = 140, BOARD_NOTES = 60, BOARD_SONGS = 60, BOARD_DOCS = 12, DOC_TEXT_MAX = 20000, DOC_HIST_WIRE = 8, BOARD_TOMBS = 300;
  const CHAR_NOTES_PER_DAY = 4, CHAR_DOCS_PER_DAY = 3;   // 角色一天在一个房间里最多贴几张、新开几份（照频道那份分寸）
  const LOCK_TTL = 60000, LOCK_BEAT = 20000;           // 锁：拿着的人每 20 秒报一次还在，60 秒没音信就当放了
  const listOf = v => Array.isArray(v) ? v : [];
  const ownerOf = key => String(key || "").split("|")[0];
  function boardOf(room) { const b = (room && room.board) || {}; return { notes: listOf(b.notes), songs: listOf(b.songs), docs: listOf(b.docs), tombs: listOf(b.tombs) }; }
  const withBoard = (room, b) => Object.assign({}, room, { board: b });
  const tombed = (b, id, by) => b.tombs.some(x => x && x.id === id && x.by === ownerOf(by));
  function cleanNote(n) {
    if (!n || typeof n !== "object") return null;
    const o = { id: cut(n.id, 60), by: cut(n.by, 40), name: cut(n.name, 40), text: cut(n.text, NOTE_MAX).trim(), ts: Number(n.ts) || 0 };
    if (!o.id || !o.by || !o.text) return null;
    if (n.charId) o.charId = cut(n.charId, 40);
    return o;
  }
  function cleanPick(x) {
    if (!x || typeof x !== "object") return null;
    const song = cleanSong(x.song); if (!song || !x.id || !x.by) return null;
    return { id: cut(x.id, 60), by: cut(x.by, 40), name: cut(x.name, 40), song, ts: Number(x.ts) || 0 };
  }
  function cleanDoc(d, wire) {
    if (!d || typeof d !== "object" || !d.id) return null;
    const name = cut(d.name, 40).trim(); if (!name) return null;
    const names = {}; Object.keys(d.names && typeof d.names === "object" ? d.names : {}).slice(0, 30).forEach(k => { names[cut(k, 90)] = cut(d.names[k], 40); });
    const H = listOf(d.history).slice(wire ? -DOC_HIST_WIRE : -(typeof CHF_HIST_CAP === "number" ? CHF_HIST_CAP : 30))
      .filter(x => x && typeof x === "object").map(x => ({ by: cut(x.by, 90), ts: Number(x.ts) || 0, before: cut(x.before, DOC_TEXT_MAX), after: cut(x.after, DOC_TEXT_MAX) }));
    return { id: cut(d.id, 60), kind: "doc", name, text: cut(d.text, DOC_TEXT_MAX), ver: Math.max(1, Math.round(Number(d.ver) || 1)),
      createdBy: cut(d.createdBy, 90), createdTs: Number(d.createdTs) || 0, updatedBy: cut(d.updatedBy || d.createdBy, 90), updatedTs: Number(d.updatedTs || d.createdTs) || 0, names, history: H };
  }
  // 贴一张：同一个 id 不重复，删过的不再贴回来
  function noteAdd(room, n) {
    const b = boardOf(room), x = cleanNote(n);
    if (!x || b.notes.some(y => y.id === x.id) || tombed(b, x.id, x.by)) return room;
    return withBoard(room, Object.assign(b, { notes: b.notes.concat([x]).slice(-BOARD_NOTES) }));
  }
  // 歌名对得上就算同一首（频道歌单那套认法：大小写、标点、括号里的版本都不算）
  const songKey = s0 => (typeof chpSongNorm === "function" ? chpSongNorm : (v => String(v || "").replace(/\s+/g, "").toLowerCase()))(s0 && s0.title);
  function songAdd(room, x) {
    const b = boardOf(room), p = cleanPick(x);
    if (!p || b.songs.some(y => y.id === p.id) || tombed(b, p.id, p.by) || playlist(room).some(y => songKey(y.song) === songKey(p.song))) return room;
    return withBoard(room, Object.assign(b, { songs: b.songs.concat([p]).slice(-BOARD_SONGS) }));
  }
  // 这条消息是哪台手机的
  const msgOwner = (room, m) => m.side === "me" ? String((room && room.myPeerId) || "") : String(m.peerId || "");
  // 房间歌单：房里发过的歌卡（自动收进来）＋手动加的，删掉的不算，同一首只留最早那次；新的在后
  function playlist(room) {
    const b = boardOf(room), seen = new Set(), out = [];
    const auto = ((room && room.msgs) || []).filter(m => m && m.type === "song" && !m.recalled && m.x && m.x.title)
      .map(m => ({ id: "sm_" + m.id, by: msgOwner(room, m), name: m.name || "", song: cleanSong(m.x), ts: Number(m.ts) || 0, card: true }));
    auto.concat(b.songs).filter(x => x.song && !tombed(b, x.id, x.by)).sort((a, c) => a.ts - c.ts).forEach(x => { const k = songKey(x.song); if (!k || seen.has(k)) return; seen.add(k); out.push(x); });
    return out;
  }
  // 作者删自己的那一样（便签、歌单里那首、文档）：by 对不上作者就什么都不动；对上了留一块墓碑，补记录时也不会再冒回来
  function boardDrop(room, id, by) {
    const b = boardOf(room), k = String(id || ""), who = ownerOf(by);
    const item = b.notes.find(x => x.id === k) || b.songs.find(x => x.id === k) || playlist(room).find(x => x.id === k);
    const doc = b.docs.find(x => x.id === k);
    const owner = item ? ownerOf(item.by) : doc ? ownerOf(doc.createdBy) : "";
    if (!k || !who || owner !== who || tombed(b, k, who)) return room;
    return withBoard(room, { notes: b.notes.filter(x => x.id !== k), songs: b.songs.filter(x => x.id !== k), docs: b.docs.filter(x => x.id !== k),
      tombs: b.tombs.concat([{ id: k, by: who }]).slice(-BOARD_TOMBS) });
  }
  // 收一份文档：比手上这份新（ver 大）才换；同一版两边内容不一样（锁没拦住的极少数）按最后写的那个人 peerId 小的算；删过的不收
  function docPut(room, d) {
    const b = boardOf(room), x = cleanDoc(d, false);
    if (!x || tombed(b, x.id, x.createdBy)) return { room, ok: false };
    const i = b.docs.findIndex(y => y.id === x.id), old = i >= 0 ? b.docs[i] : null;
    if (old && (x.ver < old.ver || (x.ver === old.ver && (x.text === old.text || !(ownerOf(x.updatedBy) < ownerOf(old.updatedBy)))))) return { room, ok: false };
    if (old && x.history.length < old.history.length) x.history = old.history.filter(h0 => !x.history.some(y => y.ts === h0.ts && y.by === h0.by)).concat(x.history).slice(-(typeof CHF_HIST_CAP === "number" ? CHF_HIST_CAP : 30));
    const docs = b.docs.slice(); if (i >= 0) docs[i] = x; else docs.push(x);
    return { room: withBoard(room, Object.assign(b, { docs: docs.slice(-BOARD_DOCS) })), ok: true };
  }
  // 写一份（新建或改）：形状和改法照频道文件（chfApplyDoc），这边多记版本号和名字。op：create / edit / ""（没改字）
  function docWrite(room, name, text, key, who, now) {
    const b = boardOf(room);
    if (typeof chfApplyDoc !== "function") return { room, doc: null, op: "" };
    const r = chfApplyDoc(b.docs, name, text, key, now);
    if (!r.op || !r.file) return { room, doc: r.file, op: "" };
    const old = b.docs.find(x => x.id === r.file.id);
    const doc = cleanDoc(Object.assign({}, r.file, { ver: ((old && old.ver) || 0) + 1, names: Object.assign({}, (old && old.names) || {}, { [key]: who }) }), false);
    return { room: withBoard(room, Object.assign(b, { docs: r.files.map(x => x.id === doc.id ? doc : x).slice(-BOARD_DOCS) })), doc, op: r.op };
  }
  function docRename(room, id, name, key, who, now) {
    const b = boardOf(room), old = b.docs.find(x => x.id === id), nm = cut(name, 40).trim();
    if (!old || !nm || nm === old.name) return { room, doc: null };
    const doc = Object.assign({}, old, { name: nm, ver: old.ver + 1, updatedBy: key, updatedTs: now || Date.now(), names: Object.assign({}, old.names, { [key]: who }) });
    return { room: withBoard(room, Object.assign(b, { docs: b.docs.map(x => x.id === id ? doc : x) })), doc };
  }
  // 报到时补给别人的那份（文档历史只带最近几次，免得一份就拆几十片）
  function boardWire(room) {
    const b = boardOf(room);
    return { notes: b.notes, songs: b.songs, docs: b.docs.map(d => cleanDoc(d, true)).filter(Boolean), tombs: b.tombs.slice(-BOARD_TOMBS) };
  }
  // 收到别人的那份：先认 TA 自己的墓碑（只认 TA 删 TA 自己的），再把缺的补上，文档按版本号
  function mergeBoard(room, inc, origin) {
    if (!inc || typeof inc !== "object") return room;
    let r = room;
    listOf(inc.tombs).filter(x => x && x.by === origin && x.id).slice(-BOARD_TOMBS).forEach(x => { r = boardDrop(r, cut(x.id, 60), origin); const b = boardOf(r);
      if (!tombed(b, cut(x.id, 60), origin)) r = withBoard(r, Object.assign(b, { tombs: b.tombs.concat([{ id: cut(x.id, 60), by: origin }]).slice(-BOARD_TOMBS) })); });
    listOf(inc.notes).slice(-BOARD_NOTES).forEach(n => { r = noteAdd(r, n); });
    listOf(inc.songs).slice(-BOARD_SONGS).forEach(x => { r = songAdd(r, x); });
    listOf(inc.docs).slice(-BOARD_DOCS).forEach(d => { r = docPut(r, d).room; });
    return r;
  }
  // ── 文档的锁：谁在写、什么时候拿的。只在线上广播、不进存档 ──
  //   locks：{ docId: { peer, name, at, since } }；at＝最近一次听到 TA 还拿着（收到的那一刻，用本机钟，不怕两台钟不准）
  //   拿：别人拿着、没过期就拿不到；两个人同时拿（都以为空着）按 peerId 小的算，大的那个被挤掉
  function lockLive(locks, docId, now) { const x = (locks || {})[docId]; return x && (now || Date.now()) - x.at < LOCK_TTL ? x : null; }
  function lockTake(locks, docId, peer, name, now) {
    const t = now || Date.now(), cur = lockLive(locks, docId, t);
    if (cur && cur.peer !== peer) return { locks, ok: false, holder: cur };
    return { locks: Object.assign({}, locks, { [docId]: { peer, name: cut(name, 40), at: t, since: cur ? cur.since : t } }), ok: true };
  }
  function lockFree(locks, docId, peer) { const cur = (locks || {})[docId]; if (!cur || cur.peer !== peer) return locks; const n = Object.assign({}, locks); delete n[docId]; return n; }
  // 听到一条锁的消息 ev：{ doc, on, name }，from＝发的那台。lost＝因为这条被挤掉的那个人（多半就是自己）
  function lockHear(locks, ev, from, now) {
    const t = now || Date.now(), id = cut(ev && ev.doc, 60); if (!id || !from) return { locks, lost: "" };
    if (!ev.on) return { locks: lockFree(locks, id, from), lost: "" };
    const cur = lockLive(locks, id, t);
    if (cur && cur.peer !== from && !(String(from) < String(cur.peer))) return { locks, lost: "" };
    return { locks: Object.assign({}, locks, { [id]: { peer: from, name: cut(ev.name, 40), at: t, since: cur && cur.peer === from ? cur.since : t } }), lost: cur && cur.peer !== from ? cur.peer : "" };
  }
  function lockDropPeer(locks, peer) { const n = {}; Object.keys(locks || {}).forEach(k => { if (locks[k].peer !== peer) n[k] = locks[k]; }); return n; }
  function lockPrune(locks, now) { const n = {}; Object.keys(locks || {}).forEach(k => { if (lockLive(locks, k, now)) n[k] = locks[k]; }); return n; }
  // 这份此刻为什么不能动：别人在写 → 「某某正在写」；有人的角色正在开口 → 「某某正在说话」；能动 → ""
  //   speaking：此刻在生成的角色名字（自己这台的和别人报来的「正在输入」）
  function lockReason(locks, docId, me, speaking, now) {
    const cur = lockLive(locks, docId, now);
    if (cur && cur.peer === me) return "";
    if (cur) return (cur.name || "有人") + " 正在写";
    const sp = listOf(speaking).filter(Boolean);
    return sp.length ? sp[0] + " 正在说话，等说完再写" : "";
  }
  // 角色今天在这个房间里贴了几张、新开了几份（只算这台手机带来的人）
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  function charNotesToday(room, me, now) { return boardOf(room).notes.filter(n => n.by === me && n.charId && sameDay(n.ts, now || Date.now())).length; }
  function charDocsToday(room, me, now) { return boardOf(room).docs.filter(d => ownerOf(d.createdBy) === me && String(d.createdBy).indexOf("|") > 0 && sameDay(d.createdTs, now || Date.now())).length; }
  // ── 给角色开口带上的那一块：墙上贴着什么、歌单里最近几首、有哪些文档（正文只带聊天里提到的、或刚改过的，截一截）──
  //   o：{ locks, me, nameOf(key), recent(最近几句聊天), now }
  const DOC_BODY_MAX = 1600;
  function boardBlock(room, o) {
    o = o || {};
    const b = boardOf(room), out = [], now = o.now || Date.now();
    const nm = k => (o.nameOf && o.nameOf(k)) || "有人";
    if (b.notes.length) out.push("墙上的便签：" + b.notes.slice(-8).map(n => "「" + n.text.slice(0, 50) + "」（" + (n.name || "有人") + "）").join(" "));
    const pl = playlist(room);
    if (pl.length) out.push("房间歌单（最近几首）：" + pl.slice(-8).map(x => songLine(x.song) + (x.name ? "，" + x.name + (x.card ? "发的" : "加的") : "")).join("；"));
    if (b.docs.length) {
      const rt = String(o.recent || ""), hit = d => typeof chfMentioned === "function" ? chfMentioned(d.name, rt) : rt.indexOf(d.name) >= 0;
      const docs = b.docs.slice().sort((x, y) => (y.updatedTs || 0) - (x.updatedTs || 0));
      out.push("共用文档（谁都能打开看、改，也能新开一份）：\n" + docs.map(d => { const lk = lockLive(o.locks, d.id, now);
        return "· 《" + d.name + "》" + String(d.text || "").length + " 字，最后是 " + nm(d.updatedBy) + " 动的" + (lk ? "；此刻 " + (lk.name || "有人") + " 正在写，这份这一轮动不了" : ""); }).join("\n"));
      docs.filter(d => hit(d) || now - (d.updatedTs || 0) < 30 * 60000).slice(0, 2).forEach(d => { const tx = String(d.text || "");
        out.push("《" + d.name + "》" + (tx.length > DOC_BODY_MAX ? "（太长，只给开头和最后一截）" : "全文") + "：\n" + (tx.length > DOC_BODY_MAX ? tx.slice(0, 1000) + "\n……\n" + tx.slice(-500) : tx || "（还是空的）")); });
    }
    return out.length ? "\n\n【房间里摆着的东西】\n" + out.join("\n") : "";
  }
  // 能做的那几样（接在 actBits 里）：o.noteOk＝今天还能贴；o.docOk＝能往文档里写（有文档被锁着的那份照样写不进）；o.docNew＝今天还能新开
  function boardBits(o) {
    o = o || {}; const bits = [];
    if (o.noteOk) bits.push("\"note\":{\"text\":\"往墙上贴一张便签\"}——房间顶上那面墙，谁都看得到；想记一句、留个话、起个哄就贴，几个字也行");
    if (o.docOk) bits.push("\"file\":{\"name\":\"文档名\",\"add\":[\"往末尾添的一行\"],\"remove\":[\"要删掉的那一行原文\"]}——聊出了计划、清单、结论，或者想留下点什么，就顺手写进共用文档：add 是添、remove 是把逐字对上的那几行删掉，两样可以只写一样；想整份重写就写 {\"name\",\"text\":\"整份全文\"}。名字跟已有的一样就是改那一份"
      + (o.docNew ? "，没有就新开一份" : "；今天新开得够多了，这会儿往已有的里写") + "。此刻有人正在写的那份动不了");
    return bits;
  }
  // 退房记忆时带上的那几行：墙上贴着什么、文档叫什么、开头写了什么（短，别撑爆）
  function boardMemo(room) {
    const b = boardOf(room), out = [];
    if (b.notes.length) out.push("墙上的便签：" + b.notes.slice(-6).map(n => "「" + n.text.slice(0, 40) + "」（" + (n.name || "有人") + "）").join(" "));
    b.docs.slice(-3).forEach(d => out.push("共用文档《" + d.name + "》：" + String(d.text || "").replace(/\s+/g, " ").slice(0, 200)));
    return out.length ? "\n\n【房间里留下的东西】\n" + out.join("\n") : "";
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
  // 补发的记录里缺图的那几条（最近 limit 张）：照片本来有图却没落进本机，表情包没有能显示的那张
  function missingImgs(room, limit) {
    return ((room && room.msgs) || []).filter(m => m && !m.recalled && m.x && ((m.type === "photo" && m.x.pic && !m.x.imageRef) || (m.type === "emote" && !m.x.url)))
      .slice(-(limit || 20)).map(m => m.id);
  }
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
  // 两边一起删的墓碑：断线的人回来时，删过的那条别从 TA 补发的记录里又冒回来。
  //   tombs＝我自己删的（报到时随 sync 发出去，有上限）；gone＝别人报来的「TA 删了 TA 自己的哪条」（只认发这条的那个人）
  const TOMB_MAX = 200;
  function tombOwn(room, id) {
    const m = (room.msgs || []).find(x => x.id === id);
    if (!m || !ownsMsg(m, "me")) return room;
    const r = dropMsg(room, id);
    return Object.assign(r, { tombs: (room.tombs || []).filter(x => x !== id).concat([id]).slice(-TOMB_MAX) });
  }
  function applyDrops(room, ids, by) {
    let r = room; const gone = (room.gone || []).slice();
    (Array.isArray(ids) ? ids : []).slice(-TOMB_MAX).forEach(x => {
      const id = String(x || "").slice(0, 60); if (!id) return;
      r = dropOwnMsg(r, id, by);
      if (!gone.some(g => g.id === id && g.by === by)) gone.push({ id, by });
    });
    return Object.assign({}, r, { gone: gone.slice(-TOMB_MAX * 2) });
  }
  // 补发来的这条是不是早被说它的人删掉了
  function isDropped(room, m) {
    if (!m || !m.id) return false;
    if (m.side === "me") return (room.tombs || []).indexOf(m.id) >= 0;
    return (room.gone || []).some(g => g.id === m.id && g.by === m.peerId);
  }
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

  // ───────────── 递名片的路是可以换的 ─────────────
  // Mesh 只认这五样：open（连上，返回自己）/ subscribe(topic) / publish(topic, obj) / close() / alive()。
  //   收到东西回调 onMessage(topic, 字符串)；连好以后断了回调 onDrop()。
  //   默认是上面那条公共 MQTT 中转；开房的人选了「用自己的 Supabase 递名片」就换成下面这条。
  // Supabase 这条只用 Realtime 的 broadcast：不建表、不读写数据库，跟云同步的存档没有任何来往。
  //   而且只递 offer/answer 这些「怎么连我」，连上以后聊天照样是手机之间直连，不经过它。
  const SUPA_EVENT = "m";
  const supaChannelName = topic => String(topic).replace(/[^A-Za-z0-9_-]/g, "-");
  function SupaLink(cfg, onMessage, onDrop, createClient) {
    let sb = null, closed = false, dropped = false;
    const chans = {};   // topic → { ch, ok }
    const make = createClient || (typeof window !== "undefined" && window.supabase && window.supabase.createClient);
    const lost = () => { if (closed || dropped) return; dropped = true; api.close(); onDrop && onDrop(); };
    const api = {
      async open() {
        if (!make) throw new Error("没有 Supabase");
        // 不存登录态、不刷新令牌：这个 client 只拿公开密钥递名片，跟云同步登录的那个互不相干
        sb = make(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "qq-netroom-sig" } });
        return api;
      },
      subscribe(topic) {
        return new Promise((ok, no) => {
          let settled = false;
          const tm = setTimeout(() => { if (!settled) { settled = true; no(new Error("超时")); } }, 10000);
          const ch = sb.channel(supaChannelName(topic), { config: { broadcast: { self: false, ack: false } } });
          const rec = { ch, ok: false };
          chans[topic] = rec;
          ch.on("broadcast", { event: SUPA_EVENT }, msg => {
            if (closed) return;
            const d = msg && msg.payload && msg.payload.d;
            if (typeof d === "string") { try { onMessage(topic, d); } catch (e) {} }
          });
          ch.subscribe(status => {
            if (status === "SUBSCRIBED") { rec.ok = true; if (!settled) { settled = true; clearTimeout(tm); ok(); } return; }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              rec.ok = false;
              if (!settled) { settled = true; clearTimeout(tm); no(new Error("连不上")); }
              else lost();
            }
          });
        });
      },
      publish(topic, obj) {
        const rec = chans[topic];
        try { rec && rec.ok && rec.ch.send({ type: "broadcast", event: SUPA_EVENT, payload: { d: JSON.stringify(obj) } }); } catch (e) {}
      },
      alive() { return !closed && !dropped && Object.keys(chans).some(k => chans[k].ok); },
      close() {
        closed = true;
        Object.keys(chans).forEach(k => { const rec = chans[k]; rec.ok = false; try { sb && sb.removeChannel(rec.ch); } catch (e) {} delete chans[k]; });
        try { sb && sb.realtime && sb.realtime.disconnect && sb.realtime.disconnect(); } catch (e) {}
      }
    };
    return api;
  }
  // 按房间记着的那份配置挑一条路：sig 为空走公共中转；有 {url,key} 走那个 Supabase
  const signalFor = (sig, createClient) => (sig && sig.url && sig.key)
    ? (onMessage, onDrop) => SupaLink(sig, onMessage, onDrop, createClient).open()
    : openBroker;

  // ───────────── 连接码：把 Supabase 地址 + 公开密钥 + 房间号打成一串 ─────────────
  // 格式：「QQNR1.」+ base64url(JSON {u, k, c})。只放这三样，永远不放 service key、不放登录态。
  const JOIN_PREFIX = "QQNR1.";
  const b64u = {
    enc(str) { const b = utf8(str); let bin = ""; b.forEach(x => { bin += String.fromCharCode(x); }); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec(s) { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "===".slice((t.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))); }
  };
  const cleanSupaUrl = u => String(u || "").trim().replace(/\/(rest|auth|storage|realtime|functions)\/v1.*$/i, "").replace(/\/+$/, "");
  // 这把钥匙是不是只能给别人的那种：新式 sb_secret_ 和老式 JWT 里 role=service_role 的一律不收
  function secretKey(k) {
    k = String(k || "");
    if (/^sb_secret_/i.test(k)) return true;
    const parts = k.split(".");
    if (parts.length === 3) { try { const p = JSON.parse(b64u.dec(parts[1])); if (p && p.role && p.role !== "anon") return true; } catch (e) {} }
    return false;
  }
  function cleanSupa(cfg) {
    if (!cfg || typeof cfg !== "object") return null;
    const url = cleanSupaUrl(cfg.url), key = String(cfg.key || "").trim();
    if (!/^https:\/\/[^\s/]+$/i.test(url) || !key || key.length > 2000 || /\s/.test(key) || secretKey(key)) return null;
    return { url, key };
  }
  function packJoin(cfg, code) {
    const c = cleanSupa(cfg);
    if (!c || !validCode(code)) return "";
    return JOIN_PREFIX + b64u.enc(JSON.stringify({ u: c.url, k: c.key, c: String(code).trim() }));
  }
  // 加入时输入框里的东西：6 位房间号 → 走公共中转；连接码 → 那个 Supabase + 房间号；别的都当坏串
  function parseJoin(raw) {
    const s = String(raw || "").replace(/\s+/g, "");
    if (validCode(s)) return { code: s, sig: null };
    if (s.indexOf(JOIN_PREFIX) !== 0) return null;
    let o; try { o = JSON.parse(b64u.dec(s.slice(JOIN_PREFIX.length))); } catch (e) { return null; }
    if (!o || !validCode(o.c)) return null;
    const sig = cleanSupa({ url: o.u, key: o.k });
    return sig ? { code: String(o.c), sig } : null;
  }
  // 这台手机能用的 Supabase：联机页里单独填的那份优先，没有就用云同步那份（公共版设置里填的 x_byoSupa）
  function supaCfg(own, byoRaw) {
    const a = cleanSupa(own);
    if (a) return a;
    let b = null; try { b = typeof byoRaw === "string" ? JSON.parse(byoRaw) : byoRaw; } catch (e) {}
    return cleanSupa(b);
  }
  // 连不上时看一眼两边递过来的地址单子，说出是谁那边、为什么（她 11-23：「能不能让她们看到是谁为什么连不上」）
  //   地址单子里：srflx＝从外网看得到的地址（拿到了才能直连），relay＝中转给的地址。哪边一个都没有，就是哪边的网络挡住了
  function iceKinds(sdp) {
    const k = { host: 0, srflx: 0, relay: 0 };
    (String(sdp || "").match(/ typ (host|srflx|prflx|relay)/g) || []).forEach(x => { const t = x.slice(5); k[t === "prflx" ? "srflx" : t]++; });
    return k;
  }
  // d: { mine: 我递出去的 sdp, theirs: 她递来的 sdp（没收到＝null）, turn: 我填了中转没 }
  function diagnose(d) {
    if (!d || !d.mine) return { who: "你", why: "你这台还没准备好连接", fix: "退出房间再进一次" };
    if (!d.theirs) return { who: "她", why: "她那台一直没回话", fix: "让她看看手机是不是锁屏了、还开着这个房间，然后点「重新连上」" };
    const a = iceKinds(d.mine), b = iceKinds(d.theirs);
    if (d.turn && !a.relay) return { who: "你", why: "你填的中转没接通", fix: "看看中转的地址、用户名、密码有没有抄错，或者中转的流量用完了" };
    if (!a.srflx && !a.relay) return { who: "你", why: "你这边的网络把直连挡住了", fix: "关掉梯子再试；连着公司、学校的网就换成流量" };
    if (!b.srflx && !b.relay) return { who: "她", why: "她那边的网络把直连挡住了", fix: "让她关掉梯子再试；连着公司、学校的网就换成流量" };
    if (a.relay || b.relay) return { who: "中转", why: "走中转也没打通", fix: "中转可能流量用完了，或者地址不对，换一个试试" };
    return { who: "两边", why: "两边的网络都不让对方直接连进来", fix: "一边换成流量试试；还不行就房里有人在联机首页「连不上的时候」填一个自己的中转" };
  }
  const diagOf = (pc, turn) => { try { return diagnose({ mine: pc.localDescription && pc.localDescription.sdp, theirs: pc.remoteDescription && pc.remoteDescription.sdp, turn }); } catch (e) { return null; } };
  // 「测一下我的网络」：自己跟自己要一张地址单子，看拿不拿得到外面的地址、中转通不通（不连任何人）
  async function probeNet(turn) {
    const c = cleanTurn(turn), pc = new RTCPeerConnection({ iceServers: c ? ICE_SERVERS.concat([c]) : ICE_SERVERS });
    try { pc.createDataChannel("probe"); await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc, !!c);
      const k = iceKinds(pc.localDescription && pc.localDescription.sdp);
      return { out: k.srflx > 0, turn: !!c, relay: k.relay > 0 };
    } finally { try { pc.close(); } catch (e) {} }
  }
  function iceDone(pc, slow) {
    return new Promise(ok => {
      if (pc.iceGatheringState === "complete") return ok();
      const tm = setTimeout(ok, slow ? 6000 : 3500);   // 配了中转多等一会儿：中转那条地址要先跟它要   // 收不齐也别一直等：手上有的先发（有的公共 STUN 在某些网络里不回话）
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
    let ice = o.ice || null;   // 自己没填中转时，房里别人借来的那份由 setIce 换进来
    const tries = {};          // 每个人自动重连过几次：连上清零；最多两次，免得一直刷
    const pub = obj => { try { link && link.publish(topic, Object.assign({ from: o.me, s: sess }, obj)); } catch (e) {} };
    const stopHello = () => { if (hello) clearInterval(hello); hello = null; if (clock) clearTimeout(clock); clock = null; };
    const fail = text => { if (dead) return;
      if (text === FAIL_TEXT) { const L = Object.keys(links).map(id => links[id])[0]; const d = L && (L.diag || diagOf(L.pc, !!ice));
        if (d) text = "看下来是" + d.why + "：" + d.fix + "。" + text; }
      api.close(); o.onFail && o.onFail(text); };
    const drop = id => { const L = links[id]; if (!L) return; delete links[id]; clearTimeout(L.timer); try { L.pc.close(); } catch (e) {} };
    const openIds = () => Object.keys(links).filter(id => links[id].state === "open");
    const linkFail = (id, L) => {
      if (links[id] !== L || L.state === "open") return;
      clearTimeout(L.timer); L.diag = diagOf(L.pc, !!ice); try { L.pc.close(); } catch (e) {}
      L.state = "fail"; o.onLinkFail && o.onLinkFail(id);
      // 连不上先别认命：隔十几秒自己再连一次（刚切回前台、Wi-Fi 和流量刚换过时常常第二次就通）
      if ((tries[id] = (tries[id] || 0) + 1) <= 2) setTimeout(() => { if (!dead && links[id] === L) linkTo(id, null); }, 12000 * tries[id]);
    };
    const wire = (id, L, ch) => {
      L.dc = ch;
      ch.onopen = () => {
        if (links[id] !== L || dead) return;
        L.state = "open"; L.rx = Date.now(); clearTimeout(L.timer); tries[id] = 0; anyOpen = true; stopHello();
        o.onOpen && o.onOpen(id, ch);
      };
      ch.onclose = () => { if (links[id] !== L) return; const was = L.state === "open"; drop(id); if (was) o.onClose && o.onClose(id); };
      ch.onmessage = ev => { if (links[id] !== L) return; L.rx = Date.now(); if (ev.data === HB) return; o.onData && o.onData(id, ev.data); };
    };
    const mkLink = (id, peerSess) => {
      drop(id);
      const pc = new RTCPeerConnection({ iceServers: ice || ICE_SERVERS });
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
        await iceDone(L.pc, !!ice);
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
          await iceDone(L.pc, !!ice);
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
      const openSig = o.signal || openBroker;
      let L = null;
      try {
        L = await openSig(onMessage, () => { if (link === L) link = null; if (!dead) setTimeout(() => openLink(false), 3000); });
        if (dead) { L.close(); return; }
        await L.subscribe(topic);
        link = L;
      }
      catch (e) { try { L && L.close(); } catch (_) {} if (first) return fail(o.signal ? SUPA_FAIL_TEXT : BROKER_FAIL_TEXT); if (!dead) setTimeout(() => openLink(false), 5000); return; }
      if (!first) { if (missing().length) pub({ t: "hello" }); return; }
      if (o.host && !o.patient) o.onStatus && o.onStatus("等别人输入房间号…");
      else { o.onStatus && o.onStatus(o.patient ? "等别人也点「重新连上」…" : "正在找房间…"); sayHello(); }
    };
    const api = {
      openIds,
      state: id => (links[id] ? links[id].state : ""),
      diag: id => (links[id] ? links[id].diag || null : null),
      // 房里有人借来中转：自己没填才换上；换上以后把连不上的那几条马上重连一次
      setIce(next) { if (dead || ice || !next) return false; ice = next;
        Object.keys(links).forEach(id => { if (links[id].state === "fail") { tries[id] = 0; linkTo(id, null); } }); return true; },
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

  // ── 在联机里认识的人（她 2026-11-22）：退房勾了「记进记忆」的角色，另记一份见过的别人家的角色 ──
  //   存 x_netroomKnown（进 IDB）：{ 我的角色 id: { "对方 peerId/对方角色 id": { peerId, charId, name, owner, note, times, lastTs, rooms:[房间 id] } } }
  //   认人只认 peerId＋角色 id（名字会改，改了照样认得）；只存名字、谁带来的、一两句印象、几次、上次——对方的人设一个字都不存（本来也没收到）。
  const KNOWN_KEY = "x_netroomKnown";
  const loadKnown = () => { try { const o = loadJSON(KNOWN_KEY, {}); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
  const saveKnown = k => { try { saveJSON(KNOWN_KEY, k); } catch (e) {} };
  const knownKey = (peerId, charId) => String(peerId || "") + "/" + String(charId || "");
  // 这一段里真开过口的别人家的角色：[{ peerId, charId, name, owner }]
  function metIn(room, msgs) {
    room = normalizeRoom(room);
    const seen = {}, out = [];
    (msgs || room.msgs || []).forEach(m => {
      if (!m || m.sys || m.side !== "peer" || m.kind !== "char" || !m.charId || !m.peerId || m.peerId === LEGACY) return;
      const k = knownKey(m.peerId, m.charId); if (seen[k]) return; seen[k] = 1;
      const p = peerOf(room, m.peerId), card = p && (p.chars || []).find(c => c.id === m.charId);
      out.push({ peerId: m.peerId, charId: m.charId, name: String((card && card.name) || m.name || "").slice(0, 40), owner: String((p && p.nick) || "").slice(0, 20) });
    });
    return out;
  }
  // 记一次：people 是模型交回来的 [{ name, note }]，按名字对上这次见到的人；一个房间只算一次「一起玩过」
  function meetPeople(known, myCharId, room, people, ts) {
    const all = Object.assign({}, known || {}), mine = Object.assign({}, all[myCharId] || {});
    const notes = {}; (Array.isArray(people) ? people : []).forEach(x => { if (x && x.name && x.note) notes[String(x.name).trim()] = String(x.note).trim().slice(0, 160); });
    metIn(room).forEach(w => {
      const k = knownKey(w.peerId, w.charId), old = mine[k] || {};
      const rooms = (old.rooms || []).slice(), fresh = rooms.indexOf(room.id) < 0;
      if (fresh) rooms.push(room.id);
      mine[k] = { peerId: w.peerId, charId: w.charId, name: w.name || old.name || "", owner: w.owner || old.owner || "",
        note: notes[w.name] || old.note || "", times: (Number(old.times) || 0) + (fresh ? 1 : 0), lastTs: Math.max(Number(old.lastTs) || 0, Number(ts) || 0), rooms: rooms.slice(-30) };
    });
    all[myCharId] = mine;
    return all;
  }
  function forgetKnown(known, myCharId, key) {
    const all = Object.assign({}, known || {}), mine = Object.assign({}, all[myCharId] || {});
    delete mine[key]; all[myCharId] = mine; return all;
  }
  const agoZh = (ts, now) => { const d = Math.floor(((now || Date.now()) - (Number(ts) || 0)) / 86400000); return d <= 0 ? "今天" : d === 1 ? "昨天" : d + " 天前"; };
  // 开口时那一段：房里现在有 TA 认识的别人家的角色，才写「你们见过」
  //   who：一起说时几个人各一段，写上是谁记得的
  function knownLine(known, myCharId, room, now, who) {
    room = normalizeRoom(room);
    const mine = (known || {})[myCharId] || {}, rows = [];
    (room.peers || []).forEach(p => (p.chars || []).forEach(c => {
      const k = mine[knownKey(p.peerId, c.id)]; if (!k) return;
      rows.push("\n- " + c.name + "（" + p.nick + " 带来的）" + (k.name && k.name !== c.name ? "，上次见时叫「" + k.name + "」" : "")
        + "：" + (k.note ? k.note + "；" : "") + "之前在联机里一起玩过 " + (k.times || 1) + " 次，上次是" + agoZh(k.lastTs, now) + "。");
    }));
    return rows.length ? "\n\n" + (who ? "【" + who + " 以前在联机里见过的人】（" + who + " 自己记得的印象）：" : "【你们见过】房里有你以前在联机里见过的人（只是你记得的印象）：") + rows.join("") : "";
  }

  // ── 前情小卡（她 2026-11-22）：隔一阵子再连回同一个房间，顶上一张「上次聊到哪」──
  //   只用房间记录（transcript）写，不读任何人的人设；写好存进这个房间的 recap，重进时没有新话就直接用这份，不再花调用。
  //   recap：{ talk, said:[…], plans:[…], game, upTo(总结到的最后一条 ts), at(写的时间) }
  const RECAP_GAP = 6 * 3600 * 1000, RECAP_MIN = 6, RECAP_LONG = 120, RECAP_TAIL = 60;
  const lastTalkTs = room => ((room && room.msgs) || []).filter(m => m && !m.sys).reduce((x, m) => Math.max(x, Number(m.ts) || 0), 0);
  // 这次连回来要不要出卡：上次已经离开过，或者最后一句隔了 6 小时以上；话太少（不到 6 句）不出
  function recapDue(room, now) {
    const ms = ((room && room.msgs) || []).filter(m => m && !m.sys && !m.recalled);
    if (ms.length < RECAP_MIN) return false;
    return !!(room.endedAt > 0) || ((now || Date.now()) - lastTalkTs(room)) >= RECAP_GAP;
  }
  // 存着的那份还能直接用吗：总结到的那条之后没有新话
  const recapFresh = room => !!(room && room.recap && room.recap.upTo && room.recap.upTo >= lastTalkTs(room));
  function recapInstruction(room, opts) {
    room = normalizeRoom(room);
    return "下面是一个多人聊天房间的完整记录：几个真人各用自己的手机进来，各带了自己的角色一起聊。有人隔了一阵子又回到这个房间，要在聊天最上面给她看一张「上次聊到哪」的小卡。"
      + "\n只根据记录里真的出现过的话写，不猜、不补记录里没有的事，也不评价任何人。用名字称呼人。"
      + "\n\n【房间记录】" + ((opts && opts.stamp) ? "（〔〕里是时间）" : "") + "\n" + (transcript(room, opts) || "（空）")
      + "\n\n【输出】只输出一个 JSON：{\"talk\":\"上次主要聊了什么，一两句\",\"said\":[\"谁说了什么要紧的话，一条一句，最多三条\"],\"plans\":[\"约好了什么、说好下次干什么，没有就空数组\"],\"game\":\"最后一局小游戏的结果，一句；没玩就空字符串\"}";
  }
  function cleanRecap(d, upTo, now) {
    if (!d || typeof d !== "object") return null;
    const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
    const arr = (v, k) => (Array.isArray(v) ? v : []).map(x => s(x, 120)).filter(Boolean).slice(0, k);
    const r = { talk: s(d.talk, 240), said: arr(d.said, 3), plans: arr(d.plans, 3), game: s(d.game, 120), upTo: Number(upTo) || 0, at: now || Date.now() };
    return r.talk || r.said.length || r.plans.length || r.game ? r : null;
  }
  // 给模型的那一段前情
  function recapText(recap) {
    if (!recap) return "";
    return "【前情：这个房间之前聊到哪（由房间记录总结）】"
      + (recap.talk ? "\n- 聊了：" + recap.talk : "")
      + recap.said.map(x => "\n- 要紧的话：" + x).join("")
      + recap.plans.map(x => "\n- 约好的：" + x).join("")
      + (recap.game ? "\n- 上一局：" + recap.game : "");
  }
  // 开口时房间记录给到多少：有前情、记录又很长（超过 120 条），就只带前情没盖到的新话，至少最近 60 条
  function promptRoom(room) {
    const rc = room && room.recap, ms = (room && room.msgs) || [];
    if (!rc || ms.length <= RECAP_LONG) return { room, cut: false };
    let i = ms.findIndex(m => (Number(m.ts) || 0) > (rc.upTo || 0));
    if (i < 0) i = ms.length;
    let k = ms.length, n = 0;   // 往回数够 60 条真说的话（进出房那几行不算），引用编号跟整份记录对得上
    while (k > 0 && n < RECAP_TAIL) { k--; if (ms[k] && !ms[k].sys) n++; }
    const from = Math.max(0, Math.min(i, k));
    return from > 0 ? { room: Object.assign({}, room, { msgs: ms.slice(from) }), cut: true } : { room, cut: false };
  }
  function recapBlock(room) { const t = recapText(room && room.recap); return t ? "\n\n" + t + (promptRoom(room).cut ? "\n（更早的记录太长，下面只给最近这一段）" : "") : ""; }

  const Core = { cleanTurn, iceFor, iceKinds, diagnose, probeNet, BROKERS, BROKER_FAIL_TEXT, SUPA_FAIL_TEXT, JOIN_PREFIX, MqttLink, openBroker, SupaLink, signalFor, packJoin, parseJoin, cleanSupa, supaCfg, secretKey, Mesh, TOPIC_PREFIX, ICE_SERVERS, CONNECT_TIMEOUT, FAIL_TEXT, STORE_KEY, AVATAR_PX, MAX_PEOPLE, LEGACY,
    mqtt, topicOf, newCode, validCode, cardOf, cleanCard, wireMsg, loadRooms, saveRooms, upsertRoom, addMsg, patchRoom,
    memoryTargets, transcript, lineInstruction, actBits, actsOf, cleanSong, songPlan, listenLines, capLines, sinceLast, CHUNK, IMG_MAX, RICH_TYPES, cleanRich, richLine, splitRaw, Joiner, grabRp, votePoll, askResult, replaceTurn,
    ownsMsg, editMsg, recallMsg, dropMsg, dropOwnMsg, tombOwn, applyDrops, isDropped, TOMB_MAX, missingImgs, cleanQuote, quoteOf, quoteState, quoteCatalog, resolveQuote, sysMsg, sidesLines, FILE_TEXT_MAX, memoryInstruction, sayLines, humansHere, watchTargets, jointInstruction, jointLines, mergeMsgs, removeRoom, hostGamesIn, HOST_GAMES_KEY, sinceRemembered, echoText,
    RECAP_GAP, RECAP_LONG, RECAP_TAIL, recapDue, recapFresh, recapInstruction, cleanRecap, recapText, promptRoom, lastTalkTs,
    KNOWN_KEY, loadKnown, saveKnown, knownKey, metIn, meetPeople, forgetKnown, knownLine,
    normalizeRoom, upsertPeer, peerOf, lastNick,
    NOTE_MAX, LOCK_TTL, LOCK_BEAT, CHAR_NOTES_PER_DAY, CHAR_DOCS_PER_DAY, boardOf, cleanNote, cleanDoc, noteAdd, songAdd, playlist, boardDrop, docPut, docWrite, docRename, boardWire, mergeBoard,
    lockLive, lockTake, lockFree, lockHear, lockDropPeer, lockPrune, lockReason, charNotesToday, charDocsToday, boardBlock, boardBits, boardMemo, ownerNick, peerNames, syncedMsg, shouldOffer, admit, forwardTargets, reachable, rid, Mesh };
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
  // 一轮完了停在桌上的那一条：这一轮怎么了＋「接着来」（按钮是单机骗子骰／德州「下一手」那一颗）。只有开局的人那台能点
  function PauseBar({ pause, isHost, onGo, hostName }) {
    const t = useTheme(), G = root.GameShared;
    return h("div", { "data-wk": "nrgamepause", style: { margin: "8px 16px 0", padding: "12px 14px", borderRadius: 13, border: "1px solid " + t.tint + "55", background: t.tint + "10", textAlign: "center" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(10.5), letterSpacing: 1, color: t.tint, marginBottom: 4 } }, "这一轮完了"),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.6, marginBottom: 10 } }, pause.line),
      isHost && G && G.GameNextBtn ? h(G.GameNextBtn, { t, wk: "nrgameresume", onClick: onGo }, "接着来")
        : h("div", { "data-wk": "nrgameheld", style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } }, "这一轮停着，等 " + (hostName || "开局的人") + " 点「接着来」"),
      isHost ? h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginTop: 8 } }, "停着的时候谁都不出手，角色照样能开口；聊够了点「接着来」。") : null);
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
  function RichBody({ m, mine, meName, onRp, onVote, voters, game, onRec, onSong, speaker }) {
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
      h(VoiceMsg, { m: { content: x.content, dur: x.dur, emo: x.emo }, isU: mine && !speaker, speaker: speaker || null }));
    if (m.type === "geo") return h(GeoCard, { m: { name: x.name, ts: m.ts }, isU: mine, who: m.name, avatar: null, myAvatar: null });
    if (m.type === "rp") { const done = (x.claims || []).length >= x.count;
      return h(RedPacketCard, { rp: { message: x.message, count: x.count, claims: x.claims || [] }, onClick: onRp, foot: done ? "已被领完" : "抢红包 · 只是玩法" }); }
    if (m.type === "poll" && x.ask) return h(AskSlipCard, { m: { kind: "poll", ask: x.ask, options: x.options, pollId: x.pollId, ts: m.ts, askResult: Core.askResult(x, voters) }, asker: m.name, meName, money: n => "¥" + n,
      onVote: !mine ? onVote : undefined });
    if (m.type === "poll") return h(PollCard, { poll: Object.assign({ by: m.name }, x), meName, onVote });
    if (m.type === "namecard") return h("div", { style: { width: 220 } }, h(NameCardMsg, { m: { cardId: "nrcard", cardName: x.name, cardTag: "" },
      characters: [{ id: "nrcard", name: x.name, avatarImage: x.avatar || "", avatarEmoji: x.emoji || "", color: x.color || "" }] }));
    if (m.type === "song") return h("button", { "data-wk": "nrsong", onClick: onSong, className: "active:opacity-70 flex items-center text-left",
      style: { gap: 10, padding: 10, borderRadius: 14, background: t.bg2, border: "1px solid " + t.line, width: 240 } },
      x.cover ? h("img", { src: x.cover, alt: "", style: { width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 } })
        : h("div", { style: { width: 44, height: 44, borderRadius: 8, background: t.bg, border: "1px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, h(CGlyph, { k: "note", size: 22, color: t.sub })),
      h("div", { style: { minWidth: 0, flex: 1 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.title),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (x.artist || "") + (x.artist ? " · " : "") + "点一下在你这台放")));
    if (m.type === "topic") return h("div", { "data-wk": "nrtopic", style: { padding: "10px 12px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line, maxWidth: 240 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(10.5), letterSpacing: 1.2, color: t.fog, marginBottom: 4 } }, "话题卡"),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.55 } }, x.text));
    if (m.type === "file") return h(FileCard, { m: x, actions: typeof fileCardActions === "function" ? fileCardActions(x) : null });
    return null;
  }
  // 气泡上面那块引用：挂点跟单聊同一套（quote / quoteicon / quotetext），点一下跳到原来那条
  function QuoteChip({ q, room, mine }) {
    const t = useTheme();
    const st = Core.quoteState(room, q);
    const jump = () => {
      const i = (room.msgs || []).findIndex(x => x.id === q.id); if (i < 0 || typeof document === "undefined") return;
      const el = document.querySelector('[data-wk="nrmsg"][data-nri="' + i + '"]'); if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      try { el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 700 }); } catch (e) {}
    };
    return h("button", { "data-wk": "quote", "data-me": mine ? "1" : "0", "data-state": st, onClick: st === "ok" ? jump : undefined,
      style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, background: t.bg, borderLeft: "2px solid " + t.line, borderRadius: 4, padding: "2px 8px", marginBottom: 3,
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" } },
      h("span", { "data-wk": "quoteicon" }, "❝ "),
      h("span", { "data-wk": "quotetext" }, st === "recalled" ? "原消息已撤回" : st === "gone" ? "原消息已删除" : (q.name ? q.name + "：" : "") + q.text));
  }
  function MsgRow({ m, room, myCharsById, idx, onPress, onRelease, tools, rich, selfFace }) {
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
    } else if (m.kind === "user") {
      // 真人也有头像（她 11-22：真人的头像拿不到）：自己的用本机主页那张，别人的用她进房时发来的小头像（peer.face）
      const peer = !mine ? Core.peerOf(room, m.peerId) : null, fc = peer && peer.face;
      face = h(Avatar, { size: 34, character: mine ? Object.assign({ id: "nr_me", name: m.name }, selfFace || {})
        : { id: "nr_u_" + (m.peerId || m.name), name: m.name, avatarImage: fc && fc.avatar || "", avatarEmoji: fc && fc.emoji || "", color: fc && fc.color || "" } });
    }
    const body = m.type && rich ? rich(m) : null;
    return h("div", { "data-wk": "nrmsg", "data-side": m.side, "data-nri": idx, "data-kind": m.type || "text", className: "flex", style: { gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start" } },
      face,
      h("div", { style: { maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 3 } }, who),
        m.quote && h(QuoteChip, { q: m.quote, room, mine }),
        body ? h("div", press, body)
          : h("div", Object.assign({ "data-wk": "nrbubble", style: { padding: "8px 12px", borderRadius: 14, background: mine ? t.ink : t.bg2, color: mine ? t.bg : t.ink,
            border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } }, press), m.text),
        m.edited && h("div", { "data-wk": "nredited", style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog, marginTop: 2 } }, "已编辑"),
        m.kind === "char" && h("div", { "data-wk": "nrowner", style: { fontFamily: F_BODY, fontSize: fs(10.5), color: t.fog, marginTop: 3, display: "flex", alignItems: "center", gap: 8 } }, owner + " 带来的", tools || null)));
  }
  function MsgList({ room, myCharsById, tail, rowProps, selfFace }) {
    const ref = useRef(null);
    const n = (room.msgs || []).length;
    // 往上翻的时候不许拽回来（她 2026-11-22）：只有人本来就在底部附近、或者是自己刚发的，才跟到底。
    //   原来依赖里放的是 tail 这个每次渲染都新建的数组，等于每渲染一次就拽一次。
    const stick = useRef(true);
    const last = n ? room.msgs[n - 1] : null;
    const tailKey = (tail || []).map(x => x && x.key).join("|");
    // 小游戏的邀请卡、战绩卡谁发的都跟到底（她 11-22：不是房主的人打完回到聊天也要停在最新那条）
    const force = last && (last.side === "me" || last.type === "gamerec" || last.type === "game");
    useEffect(() => { const el = ref.current; if (el && (stick.current || force)) { el.scrollTop = el.scrollHeight; stick.current = true; } }, [n, tailKey]);
    // 图片、卡片晚一拍才撑开高度：刚才「到底了」又被顶回半截。停在底部时，里面长高了就再跟一次底
    const inner = useRef(null);
    useEffect(() => {
      const el = ref.current, box = inner.current; if (!el || !box || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
      ro.observe(box); return () => ro.disconnect();
    }, []);
    const onScroll = e => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    return h("div", { ref, onScroll, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "12px 14px" } }, h("div", { ref: inner, style: { display: "flex", flexDirection: "column", gap: 12 } },
      !n && h(Note, null, "房间里还没人说话。你直接发，或者点下面一个头像让 TA 先开口。"),
      (room.msgs || []).map((m, i) => h(MsgRow, Object.assign({ key: m.id, m, room, myCharsById, idx: i, selfFace }, rowProps ? rowProps(m, i) : {}))),
      tail));
  }

  // ＋ 里的那些：跟单聊、群聊用的同一套键（ChatToolKey）。两个人之间、本机的那几样（通话、通话记录、朋友圈、转账、亲属卡、给TA看手机、邀约、半窗）不放
  // ＋ 里单独一格进的那几盒（擂台、跑团）：开局页点返回回到房间聊天，不落到小游戏大厅（她 11-22）
  const OWN_SLOT = { debate: true, trpg: true };
  const NR_PANEL = [["location", "位置", "pin"], ["sticker", "表情包", "sticker"], ["photo", "照片", "picture"], ["voicemsg", "发语音", "wave"], ["chatsearch", "查找记录", "magnifier"],
    ["poll", "投票", "bars"], ["rp", "红包", "packet"], ["ask", "请示", "checklist"], ["pat", "拍一拍", "hand"], ["namecard", "名片", "contact"], ["file", "文件", "file"], ["topics", "话题卡", "quote"], ["listen", "一起听", "note"], ["game", "小游戏", "dice"], ["debate", "擂台", "podium"], ["trpg", "跑团", "d20"]];
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
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5, marginTop: 7 } }, "可以一次挑几张，图会压小了一张张发给房里的人；那句说明跟在第一张上，大家的角色看到的是这句说明。")),
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
      sheet === "listen" && (() => { const cur = props.nowSong ? props.nowSong() : null, lib = props.songLib ? props.songLib().slice(0, 200) : [];
        return h(Sheet, { key: "li", onClose: close, tall: true },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(19), color: t.ink, marginBottom: 6 } }, "一起听 · 发一首歌"),
          h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5, marginBottom: 10 } }, "发出去的是一张歌曲卡（歌名、歌手、封面），不传歌本身。别人点卡在她自己那台放：能直接放的就放，她曲库里有同名的就放她那份，都没有会告诉她去搜。两台不同步，各放各的。"),
          h("button", { "data-wk": "nrsongnow", disabled: !cur, onClick: () => { close(); A.sendSong(cur); }, className: "w-full text-left active:opacity-60 disabled:opacity-40",
            style: { padding: "12px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: fs(14), color: t.ink, marginBottom: 10 } },
            cur ? "发我正在听的《" + cur.title + "》" + (cur.artist ? " - " + cur.artist : "") : "现在没在放歌，从下面挑一首"),
          lib.length ? h("div", { className: "space-y-1", style: { maxHeight: "50vh", overflowY: "auto" } }, lib.map((s0, i) => h("button", { key: (s0.id || "") + i, "data-wk": "nrpick", onClick: () => { close(); A.sendSong(s0); },
            className: "w-full text-left py-2.5 px-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink } }, "《" + s0.title + "》" + (s0.artist ? " - " + s0.artist : ""))))
            : h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog } }, "曲库里还没有歌：去「一起听」里加几首。")); })(),
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
    // 昵称：她上一次进房填的那个优先（重进房间、开局的人回来都不退回「朋友」），没填过才用自己的名字
    const [nick, setNick] = useState(() => Core.lastNick(Core.loadRooms()) || (props.profile && props.profile.name) || "");
    const [code, setCode] = useState("");
    const [joinCode, setJoinCode] = useState("");
    // 用自己的 Supabase 递名片：联机页里单独填的那份（x_netroomSupa，可不填）优先，没有就用云同步那份（x_byoSupa）
    const [supaOwn, setSupaOwn] = useState(() => { try { return loadJSON("x_netroomSupa", {}) || {}; } catch (e) { return {}; } });
    const byoRaw = (() => { try { return loadJSON("x_byoSupa", null); } catch (e) { return null; } })();   // 公共版云同步填的那份；家里版没有
    const supa = Core.supaCfg(supaOwn, byoRaw);
    const useSupa = !!(supa && supaOwn.on);
    const [probe, setProbe] = useState(null);   // 「测一下我的网络」的结果
    const saveSupaOwn = patch => { const next = Object.assign({}, supaOwn, patch); setSupaOwn(next); try { saveJSON("x_netroomSupa", next); } catch (e) {} };
    const [sig, setSig] = useState(null);   // 这一场递名片用的 Supabase（null＝公共中转）
    const [status, setStatus] = useState("");
    const [err, setErr] = useState("");
    const [room, setRoom] = useState(null);
    const [picked, setPicked] = useState({});
    const [busy, setBusy] = useState({});
    const busyRef = useRef({}); busyRef.current = busy;
    // 前情小卡：show＝这次连回来要不要摆；fold＝收起成一条；busy＝正在写
    const [knownTick, setKnownTick] = useState(0);   // 删了一条「认识的人」以后重画
    const [recapUi, setRecapUi] = useState({ show: false, fold: false, busy: false, err: "" });
    const [withChat, setWithChat] = useState({});   // 带上 TA 最近的单聊（只进自己这边的模型，不发给别人）
    // 允许自拍：没动过的照 TA 能不能出图（接了图像通道、填了外貌或参考照）
    const [selfieSet, setSelfieSet] = useState({});
    const selfieOn = id => selfieSet[id] !== undefined ? !!selfieSet[id] : !!(props.selfieOk && props.selfieOk(id));
    const [peerTyping, setPeerTyping] = useState({}); const peerTypingRef = useRef({}); peerTypingRef.current = peerTyping;   // 别人哪几个角色正在输入：{ peerId|charId: 名字 }
    // 别人谁开着「旁观」：{ peerId: true }。她们的角色照旧能开口，只是角色当她们本人不在
    const [peerWatch, setPeerWatchS] = useState({}); const peerWatchRef = useRef({});
    const setPeerWatch = fn => { const n = fn(peerWatchRef.current); peerWatchRef.current = n; setPeerWatchS(n); };
    // 正在听：别人报来的（peerId → { who, title, artist }）和我这台此刻在放的。像在线状态，不进聊天记录、不存档
    const npRef = useRef({}), myNp = useRef(null);
    const [np, setNp] = useState({});
    const npSent = useRef(0);
    const tableSayRef = useRef(null);
    const [tableBusy, setTableBusy] = useState(false);   // 牌桌上「说一句」那一格
    const sayAtTable = gid => { const el = tableSayRef.current, v = el ? String(el.value || "").trim() : ""; if (!v || !games.current || !games.current.say) return; games.current.say(gid, v); el.value = ""; };   // 上一次报「正在听」的时刻
    // 房间里的墙、歌单、文档（存在 room.board；锁只在线上，不进存档）
    const [boardTab, setBoardTab] = useState("");    // 顶上那一条开着哪一格：""＝收起 / wall / songs / docs
    const [docId, setDocId] = useState(null);         // 正打开的那份文档
    const locksRef = useRef({}), [locks, setLocksRaw] = useState({});
    const setLocks = l => { locksRef.current = l; setLocksRaw(l); };
    const myLocks = useRef(new Set());               // 我此刻拿着的那几份：心跳只报这几份
    const [net, setNet] = useState({ open: [], fail: [], reach: [] });   // 直连通着的 / 直连失败的 / 直接或经人转得到的
    const netRef = useRef({ open: [], fail: [], reach: [] }); netRef.current = net;
    const [panel, setPanel] = useState(false);       // ＋ 面板开着没
    const [sheet, setSheet] = useState(null);        // ＋ 里点开的那一样
    const [photoImgs, setPhotoImgs] = useState([]), [photoText, setPhotoText] = useState("");
    const [menuAt, setMenuAt] = useState(null);      // 长按的那一条（下标）
    const [rpOpen, setRpOpen] = useState(null);      // 点开的那个红包（rpId）
    const fillRef = useRef(null);
    const [quoted, setQuoted] = useState(null);      // 输入框上面那条待发的引用 { id, name, text }
    const [repick, setRepick] = useState(false);     // 「换人」：进房以后回到挑人那页
    const [memPick, setMemPick] = useState({});
    const [saving, setSaving] = useState(false);
    const [rooms, setRooms] = useState(() => Core.loadRooms());
    const [viewId, setViewId] = useState(null);
    const [delAsk, setDelAsk] = useState(false);
    const [, setGuideTick] = useState(0);   // 教程那段懒加载回来以后重画一次   // 删房间记录要点两下
    useEffect(() => { setDelAsk(false); }, [viewId, page]);
    const entered = useRef(false);
    const mesh = useRef(null), roomRef = useRef(null), meId = useRef("");
    const linkMap = useRef({});          // 各人报来的「我跟谁直连着」
    const seen = useRef(new Set());      // 收过的消息编号（经别人转来的同一条只认一次）
    const greeted = useRef(new Set());   // 这一场已经见过名片的人：头一回见到就再报一次自己的到
    roomRef.current = room;
    const commit = r => { roomRef.current = r; setRoom(r); };
    useEffect(() => () => { try { myLocks.current.forEach(id => send({ t: "dlock", doc: id, on: false })); mesh.current && mesh.current.close(); } catch (e) {} }, []);
    const refresh = () => setRooms(Core.loadRooms());
    const myNick = () => String(nick || "").trim().slice(0, 20) || "朋友";
    // 我自己的名片（hi 里的 me）：名字＋压到 64px 的头像，跟角色名片一样只这几样
    const selfFaceOf = () => { const pf = props.profile || {}; return { avatarImage: pf.avatarImage || "", avatarEmoji: pf.avatarEmoji || "", color: pf.color || "" }; };
    const myFace = async nm => Core.cardOf({ id: "me", name: nm, avatarEmoji: props.profile && props.profile.avatarEmoji, color: props.profile && props.profile.color }, await smallAvatar(props.profile || null));
    // 牌桌上每个座位的头像：自己的角色从本机取，别人带来的角色、别的真人用进房名片上那张小图
    const faceOf = s => {
      const r = roomRef.current; if (!s || !r) return null;
      if (s.peer === meId.current) {
        if (s.kind === "user") return props.profile ? { avatarImage: props.profile.avatarImage || "", avatarEmoji: props.profile.avatarEmoji || "", color: props.profile.color || "" } : null;
        const ch = charsById[s.charId]; return ch ? { id: ch.id, avatarImage: ch.avatarImage || "", avatarEmoji: ch.avatarEmoji || "", color: ch.color || "" } : null;
      }
      const p = Core.peerOf(r, s.peer); if (!p) return null;
      const c = s.kind === "user" ? p.face : (p.chars || []).find(x => x.id === s.charId);
      return c ? { avatarImage: c.avatar || "", avatarEmoji: c.emoji || "", color: c.color || "" } : null;
    };
    if (root.NetGameUI && root.NetGameUI.setFaces) root.NetGameUI.setFaces(faceOf);

    const syncNet = () => {
      const m = mesh.current; if (!m) return;
      const open = m.openIds();
      const fail = Object.keys(linkMap.current).concat(((roomRef.current && roomRef.current.peers) || []).map(p => p.peerId))
        .filter((x, i, a) => a.indexOf(x) === i && m.state(x) === "fail");
      const reach = Core.reachable(meId.current, open, linkMap.current);
      const diag = {}; fail.forEach(id => { const d = m.diag && m.diag(id); if (d) diag[id] = d; });
      setNet({ open, fail, reach, diag });
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
    // 中转借给房里的人（她 11-23）：开着「借给房里的人」时，跟谁直连上了就只沿那条直连把中转递给谁（直连本身加密，不走公共中转）。
    //   对方只放在这一次联机的内存里用，不存、不显示；她自己填了中转就用她自己的
    const shareTurn = id => { const c = supaOwn.turnShare !== false && Core.cleanTurn(supaOwn.turn); if (c && mesh.current) send({ t: "turn", ice: c }, id); };
    const sendLinks = () => { if (mesh.current) send({ t: "links", ids: mesh.current.openIds() }); };
    const joiner = useRef(Core.Joiner(60000));
    const left = useRef(new Set());       // 说过 bye 的人：TA 再报到时记一行「回来了」
    const pending = useRef({});           // 我在等的红包结果：rpId → resolve
    const asked = useRef(new Set());      // 这一场已经跟人要过的图（消息 id），不重复要
    const waitGrabs = useRef({});         // 发红包的人不在线时攒着的抢：peerId → [{ rpId, charId, name }]，TA 一回来就补发
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
      if (e.t === "turn") { const x = e.ice || {}, c = Core.cleanTurn({ url: (Array.isArray(x.urls) ? x.urls : []).slice(0, 4).join(","), user: x.username, pass: x.credential });
        if (c && mesh.current && mesh.current.setIce && mesh.current.setIce(Core.ICE_SERVERS.concat([c]))) sysLine(nickOf(origin) + " 把她的中转借给房里用了，连不上的人正在重新接");
        return; }
      if (e.t === "links") { linkMap.current[origin] = (Array.isArray(e.ids) ? e.ids : []).map(String).slice(0, MAX_LINKS); syncNet(); }
      else if (e.t === "hi") {
        const known = !!Core.peerOf(r, origin), nick = String(e.nick || "对方").slice(0, 20);
        commit(Core.upsertRoom(Core.upsertPeer(r, origin, nick, (e.chars || []).slice(0, 8).map(Core.cleanCard), e.me)));
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
        flushGrabs(origin);
        if (myNp.current) send({ t: "np", song: myNp.current });
      } else if (e.t === "msg" && e.m) {
        landImages(Core.wireMsg(e.m)).then(w => {
          commit(Core.addMsg(roomRef.current, Object.assign(Core.wireMsg(w, true), { side: "peer", peerId: origin, by: origin })));
          if (w.type === "rp") grabForMine(w.x.rpId);
        });
      } else if (e.t === "sync" && Array.isArray(e.msgs)) {
        // 先照 TA 报来的墓碑删（只删 TA 自己的），再补记录；补完还缺图的那几张跟 TA 要
        const r1 = Array.isArray(e.drops) ? Core.upsertRoom(Core.applyDrops(r, e.drops, origin)) : r;
        commit(Core.mergeMsgs(r1, e.msgs.slice(-600).map(x => Core.syncedMsg(x, meId.current, origin))));
        const want = Core.missingImgs(roomRef.current, 20).filter(id => !asked.current.has(id));
        if (want.length) { want.forEach(id => asked.current.add(id)); send({ t: "needimg", ids: want }, origin); }
        flushGrabs(origin);
      } else if (e.t === "needimg" && Array.isArray(e.ids)) {
        // 别人缺的图：我手上有就一张张压小了单独发给 TA（每张自己拆片）
        (async () => { for (const id of e.ids.slice(0, 20).map(x => String(x).slice(0, 60))) {
          const m = ((roomRef.current && roomRef.current.msgs) || []).find(x => x.id === id && !x.recalled && x.x);
          const ref = m && (m.type === "photo" ? m.x.imageRef : m.type === "emote" && !/^https?:/.test(String(m.x.url || "")) ? m.x.url : "");
          if (!ref) continue;
          const img = await shrinkImg(ref, m.type === "photo" ? 1024 : 240, m.type === "photo" ? Core.IMG_MAX.photo : Core.IMG_MAX.emote);
          if (img) send({ t: "img", id, img }, origin);
        } })();
      } else if (e.t === "img" && e.id) {
        // 补回来的一张：只补本来就缺图的那条
        const id = String(e.id).slice(0, 60), m = (r.msgs || []).find(x => x.id === id && !x.recalled && x.x);
        if (!m || Core.missingImgs(r, 600).indexOf(id) < 0 || !/^data:image\//.test(String(e.img || ""))) return;
        landImages({ type: m.type, x: Core.cleanRich(m.type, Object.assign({}, m.x, { img: e.img }), false) }).then(w => {
          const ref = w.x && (m.type === "photo" ? w.x.imageRef : w.x.url); if (!ref) return;
          updX(x => x.id === id, x => Object.assign({}, x, m.type === "photo" ? { imageRef: ref } : { url: ref }));
        });
      } else if (e.t === "board") {
        commit(Core.upsertRoom(Core.mergeBoard(r, e, origin)));
      } else if (e.t === "bnote" && e.note) {
        const n = Core.cleanNote(Object.assign({}, e.note, { by: origin })), r2 = n ? Core.noteAdd(r, n) : r;   // 只能替自己那台贴
        if (r2 !== r) { commit(Core.upsertRoom(r2)); sysLine((n.name || nickOf(origin)) + " 往墙上贴了张便签：「" + n.text.slice(0, 40) + "」"); }
      } else if (e.t === "bsong" && e.song) {
        const x = Object.assign({}, e.song, { by: origin }), r2 = Core.songAdd(r, x);
        if (r2 !== r) { commit(Core.upsertRoom(r2)); sysLine((x.name || nickOf(origin)) + " 把《" + ((x.song && x.song.title) || "") + "》加进了歌单"); }
      } else if (e.t === "bdrop" && e.id) {
        const r2 = Core.boardDrop(r, String(e.id).slice(0, 60), origin); if (r2 !== r) commit(Core.upsertRoom(r2));
      } else if (e.t === "bdoc" && e.doc) {
        // 只认最后写的那个人自己发来的那一版；版本号比我手上的旧就不收
        if (String((e.doc && e.doc.updatedBy) || "").split("|")[0] !== origin) return;
        const res = Core.docPut(r, e.doc); if (!res.ok) return;
        commit(Core.upsertRoom(res.room)); docLine(Core.boardOf(res.room).docs.find(d => d.id === String(e.doc.id)));
      } else if (e.t === "dlock" && e.doc) {
        const res = Core.lockHear(locksRef.current, e, origin, Date.now()); setLocks(res.locks);
        if (res.lost === meId.current && myLocks.current.has(String(e.doc))) { myLocks.current.delete(String(e.doc)); props.toast && props.toast(nickOf(origin) + " 同时也打开写了这份，先归 TA；你刚才写的没存上"); }
      } else if (e.t === "watch") {
        setPeerWatch(x => { const n = Object.assign({}, x); if (e.on) n[origin] = true; else delete n[origin]; return n; });
      } else if (e.t === "np") {
        const sg = Core.cleanSong(e.song), n = Object.assign({}, npRef.current);
        if (sg) n[origin] = { who: nickOf(origin), title: sg.title, artist: sg.artist }; else delete n[origin];
        npRef.current = n; setNp(n);
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
        commit(Core.upsertRoom(Core.applyDrops(r, [String(e.id)], origin)));
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
        setLocks(Core.lockDropPeer(locksRef.current, origin));
        setPeerWatch(x => { const n = Object.assign({}, x); delete n[origin]; return n; });
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
      send({ t: "hi", nick: r.myNick || myNick(), chars: cards, me: await myFace(r.myNick || myNick()) });
      send({ t: "watch", on: !!r.watch });
      send(Object.assign({ t: "board" }, Core.boardWire(r)));
      myLocks.current.forEach(id => { const x = locksRef.current[id]; send({ t: "dlock", doc: id, on: true, name: (x && x.name) || myNick() }); });
      send({ t: "sync", drops: (r.tombs || []).slice(-Core.TOMB_MAX), msgs: (r.msgs || []).filter(m => !m.sys).slice(-600).map(m => Core.wireMsg(Object.assign({}, m, { by: m.side === "me" ? meId.current : (m.peerId || "") }))) });
    };
    // 断了以后连回原来那个房间：房间号、谁开的都照旧，聊天记录接着往下记（她 2026-11-22）
    // 写一张前情卡：一次调用，走后台那条线路（她挑过后台线路就走那条，没挑就跟线上）；auto＝连回来时自己写的那次，后台线路选了「无」就不写
    const makeRecap = async (roomId, auto) => {
      const r = Core.loadRooms().find(x => x.id === roomId);
      if (!r) return;
      const p = props.recapApi ? props.recapApi(!!auto) : null;
      if (!p) { if (!auto) props.toast && props.toast("先去 设置·API 配一条线路"); setRecapUi(u => Object.assign({}, u, { show: !!r.recap })); return; }
      setRecapUi(u => Object.assign({}, u, { show: true, busy: true, err: "" }));
      try {
        // 只给房间记录，不给任何人设（料全放 system，user 一句触发）
        const sys = Core.recapInstruction(r, { stamp: props.stampFor && (r.myChars || [])[0] ? ts => props.stampFor(r.myChars[0].id, ts) : null });
        const raw = await callAI(p, sys, [{ role: "user", content: "开始。" }], { logLabel: "联机·前情", maxTokens: 12000 });
        const d = typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : JSON.parse(raw);
        const rc = Core.cleanRecap(d, Core.lastTalkTs(r), Date.now());
        if (!rc) throw new Error("没总结出来");
        const live = Core.loadRooms().find(x => x.id === roomId) || r;
        const next = Core.patchRoom(live, { recap: rc });
        if (roomRef.current && roomRef.current.id === roomId) commit(next);
        setRecapUi(u => Object.assign({}, u, { busy: false }));
      } catch (e) { setRecapUi(u => Object.assign({}, u, { busy: false, err: "没总结出来：" + ((e && e.message) || e) })); }
    };
    const rejoin = r0 => {
      // 隔了 6 小时以上、或上次已经离开过：顶上出前情卡；没有新话就用存着的那份，不再调用
      const r1 = Core.loadRooms().find(x => x.id === r0.id) || r0;
      const due = Core.recapDue(r1, Date.now());
      setRecapUi({ show: due, fold: false, busy: false, err: "" });
      start(!!r0.host, r0);
      // 不自动总结（她 11-22：「要大家各自按键才会总结，不要进来就自动」）：卡上只摆一颗「总结一下」，点了才花这一次调用
    };
    const start = (host, resume) => {
      setErr(""); setPeerTyping({}); setPeerWatch(() => ({})); setNet({ open: [], fail: [], reach: [] });
      try { mesh.current && mesh.current.close(); } catch (e) {}
      mesh.current = null; linkMap.current = {}; seen.current = new Set(); greeted.current = new Set();
      games.current = newGames(resume ? resume.id : ""); setGameId(null);
      // 回原来的房间、我在这儿当过庄还没打完的局：把小游戏装上、从存档接回来（别人回来报到时 resend 再发给 TA 们）
      if (resume && Core.hostGamesIn(resume.id)) ensureGames().then(() => { if (!games.current) games.current = newGames(resume.id); games.current && games.current.boot && games.current.boot(); }).catch(() => {});
      const got = !resume && !host ? Core.parseJoin(joinCode) : null;
      if (!resume && !host && !got) { setErr("没认出来：填 6 位房间号，或者把朋友发来的连接码整串粘进来"); return; }
      const c = resume ? resume.code : host ? Core.newCode() : got.code;
      let base = resume ? (Core.loadRooms().find(x => x.id === resume.id) || resume) : null;
      // 递名片走哪条路：回原来的房间照那个房间记着的；开房看开关；加入看粘进来的是不是连接码
      const s0 = resume ? Core.cleanSupa(base && base.sig) : host ? (useSupa ? supa : null) : got.sig;
      setSig(s0);
      if (base && !base.myPeerId) base = Core.patchRoom(base, { myPeerId: Core.rid() });   // 老房间头一回连：补一个自己的 id
      meId.current = base ? base.myPeerId : Core.rid();
      if (base && base.myNick && base.myNick !== "朋友") setNick(base.myNick);
      if (base) { commit(Core.patchRoom(base, { endedAt: 0 })); entered.current = true; setPage("chat"); }
      else { commit(null); entered.current = false; setPage("wait"); }
      setCode(c); setStatus("正在连…");
      const m = Mesh({ code: c, host, patient: !!resume, me: meId.current, signal: s0 ? Core.signalFor(s0) : null, ice: Core.cleanTurn(supaOwn.turn) ? Core.iceFor(supaOwn.turn) : null,
        knownIds: () => ((roomRef.current && roomRef.current.peers) || []).map(p => p.peerId).concat(mesh.current ? Object.keys(linkMap.current).concat(mesh.current.openIds()) : []),
        onStatus: setStatus,
        onFail: text => { if (mesh.current !== m) return; mesh.current = null; setErr(text); if (!entered.current) setPage("home"); syncNet(); },
        onLinkFail: id => { if (mesh.current !== m) return; syncNet(); if (!entered.current && !roomRef.current) setStatus("有人进来了但没接通：" + FAIL_TEXT); },
        onOpen: id => {
          if (mesh.current !== m) return;
          if (!roomRef.current) {
            const r = { id: "nr_" + Date.now(), code: c, host, myPeerId: meId.current, startedAt: Date.now(), endedAt: 0, myNick: myNick(),
              peers: [], myChars: [], msgs: [], remembered: {}, sig: s0 || null };
            commit(Core.upsertRoom(r)); setPage("pick");
          } else if (entered.current) announce(roomRef.current);
          shareTurn(id); sendLinks(); syncNet();
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
      const before = ((roomRef.current && roomRef.current.myChars) || []).map(c => c.name);
      const cards = [];
      for (const c of list) cards.push(Core.cardOf(c, await smallAvatar(c)));
      commit(Core.patchRoom(roomRef.current, { myNick: myNick(), myChars: list.map(c => ({ id: c.id, name: c.remark || c.name, recent: !!withChat[c.id], selfie: selfieOn(c.id) })) }));
      send({ t: "hi", nick: myNick(), chars: cards, me: await myFace(myNick()) });
      if (myNp.current) send({ t: "np", song: myNp.current });   // 进房那一下把自己在听的也报上
      if (repick) {
        // 换人：名片重发一遍，别人那边跟着换；移出的人以前说的话照旧留着
        setRepick(false);
        const now = list.map(c => c.remark || c.name), add = now.filter(n => before.indexOf(n) < 0), out = before.filter(n => now.indexOf(n) < 0);
        if (add.length || out.length) sysLine((add.length ? "带进来了 " + add.join("、") : "") + (add.length && out.length ? "，" : "") + (out.length ? out.join("、") + " 先走了" : ""));
      }
      entered.current = true; setPage("chat");
    };
    const openRepick = () => {
      const r = roomRef.current; if (!r) return;
      const p = {}, w = {}, sf = {}; (r.myChars || []).forEach(c => { p[c.id] = true; if (c.recent) w[c.id] = true; if (c.selfie !== undefined) sf[c.id] = !!c.selfie; });
      setPicked(p); setWithChat(w); setSelfieSet(sf); setRepick(true); setPage("pick");
    };
    // 存档那一份（图换成本机引用）和发出去那一份（压小的图）各过一遍 wireMsg
    const post = (msg) => {
      const full = Object.assign(Core.wireMsg(msg, true), { side: "me" });
      commit(Core.addMsg(roomRef.current, full));
      send({ t: "msg", m: Core.wireMsg(msg) });
      return full;
    };
    const mid = p => p + Date.now() + Math.random().toString(36).slice(2, 6);
    // 旁观：角色当她不在场；只影响角色开口时的提示词，不会自己接话、不多花调用。她一开口就自动关掉
    const setWatch = on => { const r = roomRef.current; if (!r || !!r.watch === !!on) return; commit(Core.patchRoom(r, { watch: !!on })); send({ t: "watch", on: !!on }); };
    const unwatch = () => setWatch(false);
    const sayHuman = text => { unwatch(); const q = quoted; setQuoted(null); post(Object.assign({ id: mid("m"), kind: "user", name: myNick(), text, ts: Date.now() }, q ? { quote: q } : {})); };
    const sayRich = (type, x) => (unwatch(), post({ id: mid("m"), kind: "user", name: myNick(), type, x, text: "", ts: Date.now() }));
    // ── 墙、歌单、文档：改了先落自己这份，再广播给房里；作者只认发的那台（收的那头把 by 换成发来的人） ──
    const boardKey = charId => meId.current + (charId ? "|" + charId : "");
    // 文档里写过的人叫什么：自己＝「我」，其余照文档里记的名字
    const docName = (d, k) => k === meId.current ? "我" : ((d && d.names && d.names[k]) || nickOf(String(k || "").split("|")[0]));
    const docLine = d => { if (!d) return; const h0 = (d.history || [])[d.history.length - 1];
      sysLine(docName(d, d.updatedBy).replace(/^我$/, "你") + (h0 && !h0.before ? " 新开了一份《" + d.name + "》" : " 改了《" + d.name + "》" + (h0 && typeof chfDiffSummary === "function" ? "：" + chfDiffSummary(h0.before, h0.after) : ""))); };
    const addNote = (text, ch) => {
      const r = roomRef.current; if (!r) return;
      const n = Core.cleanNote({ id: mid("n"), by: meId.current, name: ch ? ch.name : myNick(), charId: ch ? ch.id : "", text, ts: Date.now() });
      const r2 = n ? Core.noteAdd(r, n) : r; if (r2 === r) return;
      commit(Core.upsertRoom(r2)); send({ t: "bnote", note: n });
      if (ch) sysLine(ch.name + " 往墙上贴了张便签：「" + n.text.slice(0, 40) + "」");
    };
    const dropBoard = id => { const r = roomRef.current; if (!r) return; const r2 = Core.boardDrop(r, id, meId.current); if (r2 === r) return; commit(Core.upsertRoom(r2)); send({ t: "bdrop", id }); };
    const addPick = s0 => {
      const r = roomRef.current, song = songX(s0); if (!r || !song) return;
      const x = { id: mid("sp"), by: meId.current, name: myNick(), song, ts: Date.now() }, r2 = Core.songAdd(r, x);
      if (r2 === r) { props.toast && props.toast("歌单里已经有这首了"); return; }
      commit(Core.upsertRoom(r2)); send({ t: "bsong", song: x });
    };
    // 锁：拿到了就广播「我在写」，之后每 20 秒报一次；放了就广播一句。别人 60 秒没音信就当 TA 放了
    const takeLock = (id, name) => { const res = Core.lockTake(locksRef.current, id, meId.current, name, Date.now()); if (!res.ok) return false;
      setLocks(res.locks); myLocks.current.add(id); send({ t: "dlock", doc: id, on: true, name }); return true; };
    const freeLock = id => { if (!myLocks.current.has(id)) return; myLocks.current.delete(id); setLocks(Core.lockFree(locksRef.current, id, meId.current)); send({ t: "dlock", doc: id, on: false }); };
    useEffect(() => {
      const iv = setInterval(() => {
        const now = Date.now(); let l = Core.lockPrune(locksRef.current, now);
        myLocks.current.forEach(id => { const x = l[id] || { peer: meId.current, name: myNick(), since: now }; l = Object.assign({}, l, { [id]: Object.assign({}, x, { at: now }) }); send({ t: "dlock", doc: id, on: true, name: x.name }); });
        setLocks(l);
      }, Core.LOCK_BEAT);
      return () => clearInterval(iv);
    }, []);
    // 此刻正在开口的角色（自己这台在想的、别人报来的「正在输入」）：有人在说，文档就先锁着
    const speakingNames = () => Object.keys(busyRef.current).filter(k => busyRef.current[k]).map(k => (charsById[k] && (charsById[k].remark || charsById[k].name)) || "TA")
      .concat(Object.keys(peerTypingRef.current).map(k => peerTypingRef.current[k]));
    const docWhy = id => Core.lockReason(locksRef.current, id, meId.current, speakingNames(), Date.now());
    const startEdit = d => { const why = docWhy(d.id); if (why) { props.toast && props.toast(why); return false; }
      if (!takeLock(d.id, myNick())) { props.toast && props.toast(docWhy(d.id) || "有人正在写"); return false; } return true; };
    const writeDoc = (name, text, key, who) => {
      const r = roomRef.current; if (!r) return null;
      const res = Core.docWrite(r, name, text, key, who, Date.now()); if (!res.op) return res.doc;
      commit(Core.upsertRoom(res.room)); send({ t: "bdoc", doc: Core.cleanDoc(res.doc, true) }); docLine(res.doc);
      return res.doc;
    };
    // 她存下（或者从历史里恢复）：手上没锁就先拿，拿不到就不写
    const saveDoc = (d, txt) => {
      const held = myLocks.current.has(d.id);
      if (!held && !startEdit(d)) return;
      writeDoc(d.name, txt, meId.current, myNick());
      if (!held) freeLock(d.id);
    };
    const newDoc = () => requestAppPrompt("新开一份文档", "起个名字，房里每个人都能打开看、改。", "", v => { const n = String(v || "").trim(); if (!n) return;
      const d = writeDoc(n, "", meId.current, myNick()); if (d) setDocId(d.id); }, "开");
    const renameDoc = (d, n) => { if (docWhy(d.id)) { props.toast && props.toast(docWhy(d.id)); return; }
      const res = Core.docRename(roomRef.current, d.id, n, meId.current, myNick(), Date.now()); if (!res.doc) return;
      commit(Core.upsertRoom(res.room)); send({ t: "bdoc", doc: Core.cleanDoc(res.doc, true) }); };
    // 角色往文档里写：照频道那套（add/remove 按行改，text 整份重写），写之前也要拿锁；别人正在写、或者今天新开够了就不写
    const charWrite = (charId, nm, f) => {
      const r = roomRef.current; if (!r || !f) return;
      const nk = x => typeof chfNameKey === "function" ? chfNameKey(x) : String(x || "");
      const old = Core.boardOf(r).docs.find(d => nk(d.name) === nk(f.name));
      if (!old && Core.charDocsToday(r, meId.current, Date.now()) >= Core.CHAR_DOCS_PER_DAY) return;
      if (old && (myLocks.current.has(old.id) || Core.lockLive(locksRef.current, old.id, Date.now()))) { sysLine(nm + " 想改《" + old.name + "》，有人正在写，没动"); return; }
      const lockId = old ? old.id : "new:" + nk(f.name);
      if (!takeLock(lockId, nm)) return;
      try { writeDoc(old ? old.name : f.name, typeof chfPatchText === "function" ? chfPatchText(old ? old.text : "", f) : (f.text || f.add.join("\n")), boardKey(charId), nm); }
      finally { freeLock(lockId); }
    };
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
      if (rp.side === "me") { grabMine(rpId, { key: myKey(charId), name }); return; }
      // 发红包的人不在线：钱怎么分只在 TA 手机上，别人替不了（两个人同时替 TA 分，同一份会被分给两个人），先攒着等 TA 回来
      if (!senderOn(rp)) { const q = waitGrabs.current[rp.peerId] || (waitGrabs.current[rp.peerId] = []);
        if (!q.some(g => g.rpId === rpId && g.charId === (charId || ""))) q.push({ rpId, charId: charId || "", name }); return; }
      send({ t: "grab", rpId, charId: charId || "", name });
    };
    const senderOn = rp => { const st = presence()[rp.peerId]; return st === "on" || st === "relay"; };
    const flushGrabs = id => { const q = waitGrabs.current[id]; if (!q || !q.length) return; delete waitGrabs.current[id];
      q.forEach(g => send({ t: "grab", rpId: g.rpId, charId: g.charId, name: g.name })); };
    // 我带来的人三秒后开抢（照群里的规矩：给真人留三秒先手），先后错开一点
    const grabForMine = (rpId, exceptId) => ((roomRef.current && roomRef.current.myChars) || []).filter(c => c.id !== exceptId).forEach(c =>
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
      const rp0 = ((roomRef.current && roomRef.current.msgs) || []).find(x => x.type === "rp" && x.x && x.x.rpId === rpId);
      if (rp0 && rp0.side === "peer" && !senderOn(rp0)) {
        grab(rpId, "", myNick());
        props.toast && props.toast("发红包的 " + nickOf(rp0.peerId) + " 这会儿不在线：钱怎么分在她手机上。已经替你排上了，她一回来就自动抢");
        return null;
      }
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
    const dropOwn = id => { commit(Core.upsertRoom(Core.tombOwn(roomRef.current, id))); send({ t: "drop", id }); };
    const dropLocal = id => commit(Core.upsertRoom(Core.dropMsg(roomRef.current, id)));
    // ── 小游戏（js/netroom-games.js）：开局的人那台当庄，其余每台只管自己的座位 ──
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
    // rid：这一份管的是哪个房间（存档按房间存）；不给就跟着当前房间
    const newGames = rid => root.NetGameSession ? root.NetGameSession({
      roomId: () => rid || (roomRef.current && roomRef.current.id) || "",
      me: () => meId.current, nick: () => myNick(), nickOf: id => nickOf(id),
      send: (obj, to) => send(obj, to),
      post: (type, x) => sayRich(type, x),
      // 邀请卡只认开这一局的那个人改：我开的改我那条；别人开的只改 TA 发的那条
      // x 也可以是函数：拿旧卡算新卡（开局的人说「这一局没了」时只改状态）
      patchCard: (gid, x, mine, origin) => updX(m => m.type === "game" && m.x && m.x.gid === gid && (mine ? m.side === "me" : m.side === "peer" && m.peerId === origin), old => typeof x === "function" ? x(old) : x),
      // 我自己发过的邀请卡（重进房间后，内存里已经没有的那几局要告诉大家作废）
      myCards: () => ((roomRef.current && roomRef.current.msgs) || []).filter(m => m.type === "game" && m.side === "me" && m.x).map(m => m.x),
      hostApi: route => route === "offline" && propsRef.current.offlineApi ? propsRef.current.offlineApi() : propsRef.current.gameApi ? propsRef.current.gameApi() : null,
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
    // 大厅里配好了：开局的人自己这边上谁＝开局配置里勾的那几个（观战就不坐），发一张邀请卡
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
      return { casual: !!o.casual, recent, recentText, botSkill: o.botSkill || "", talk: o.talk === true };   // 她 11-22：默认不自己开口，勾了才边玩边说
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
      const sideSeg = (cid, isChar) => h("div", { key: "side" }, seg(cid, "side", (charOptsRef.current[cid] || {}).side || "", (isChar ? [{ key: "", zh: "随人设" }] : [{ key: "", zh: "都行" }]).concat([{ key: "pro", zh: "正方" }, { key: "con", zh: "反方" }], isChar ? [{ key: "aud", zh: "观众席" }] : [])));
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
        if (kinds.indexOf("talk") >= 0) rows.push(h("label", { key: "t", className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } },
          h("input", { type: "checkbox", "data-wk": "nrchartalk", checked: o.talk, onChange: e => setCharOpt(c.id, "talk", e.target.checked) }), "自己边玩边说（勾了：TA 出手时顺带一句、隔几手随口说几句；不勾：只在你点 TA 头像时开口）"));
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
          h(Btn, { label: "坐下", primary: true, wk: "nrgamejoinok", disabled: !Object.keys(joinPick).some(k => joinPick[k] && (kinds.indexOf("side") < 0 || (charOptsRef.current[k] || {}).side !== "aud")), onClick: () => {
            const sideOf = id => kinds.indexOf("side") >= 0 ? (charOptsRef.current[id] || {}).side || "" : "";
            const picks = (joinPick._me ? [{ kind: "user", side: sideOf("_me") }] : []).concat(myChars.filter(c => joinPick[c.id] && sideOf(c.id) !== "aud").map(c => ({ kind: "char", charId: c.id, name: c.name, side: sideOf(c.id), tag: charTag(joinAt.key, c.id) })));
            // 挑了「观众席」的角色不上台：只在台下，点 TA 的头像才发一条弹幕（她 11-22）
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
      const txt = GCo.stateText(sv.inv, sv.view, si, mineP, sv.side);
      // 一轮完了停着：告诉开口的人现在是歇口气聊天的时候
      return txt && sv.pause ? txt + "\n（这一轮刚完：" + sv.pause.line + "。桌上停着，大家在聊，等开局的人点「接着来」。）" : txt;
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
      const body = !sv || !A || !root.GameShared ? h("div", { style: { padding: 16 } }, h(Note, null, "牌桌还没到，在等开局的那台手机发过来…")) : (() => {
        const inv = sv.inv, isHost = gs.isHost(gid), done = inv.status === "done";
        const pr = presence(), hostGone = !isHost && pr[inv.host] !== "on" && pr[inv.host] !== "relay";
        return h("div", { "data-wk": "nrgamearea", className: "h-full", style: { overflowY: "auto", paddingBottom: 12 } },
          h("div", { style: { padding: "6px 16px 0", fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, inv.zh, h("span", { style: { marginLeft: 8, fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, done ? "这一局打完了" : inv.seats.some(x => x.peer === meId.current && x.kind !== "npc") ? "你在桌上" : "你在旁边看")),
          hostGone && h("div", { style: { padding: "8px 16px" } }, h(Note, null, "开局的人不在，这一局等她回来接着打。")),
          sv.pause && !done && h(PauseBar, { pause: sv.pause, isHost, onGo: () => gs.resume(gid), hostName: (inv.seats.find(x => x.kind === "user" && x.peer === inv.host) || {}).name || "" }),
          h(A.Table, { charsById, inv: sv.pause && !done && GC().heldInv ? GC().heldInv(inv) : inv, view: sv.view, priv: sv.priv || null, myApi: props.gameApi ? props.gameApi() : null, me: meId.current, isHost, onMove: (seat, mv) => sv.pause ? (props.toast && props.toast("这一轮停着，等开局的人点「接着来」")) : gs.move(gid, seat, mv), onReveal: () => gs.reveal(gid), side: sv.side || [], onSide: x => gs.side(gid, x), nick: myNick() }),
          // 桌上谁的角色正在想／在说（对方那边的也看得到）
          (() => { const ty = [].concat(...Object.keys(sv.typing || {}).map(k => sv.typing[k] || [])); return ty.length ? h("div", { "data-wk": "nrgametyping", style: { padding: "6px 16px 0", fontFamily: F_BODY, fontSize: fs(12), color: t.fog } }, ty.join("、") + " 正在说…") : null; })(),
          !(A && A.ownTalk) && root.NetGameUI && h(root.NetGameUI.TalkStrip, { lines: (sv.side || []).filter(x => x.kind === "talk"), charOf: l => { const st = l && l.seat >= 0 ? inv.seats[l.seat] : null; return st && st.kind === "char" ? charsById[st.charId] || null : null; } }),
          // 我带上这一桌的角色：点谁谁在牌桌上说一句，「一起说」让几位一次说（她 11-22：角色不自动接话，只有她点了才开口）
          !done && (() => { const seatedMine = inv.seats.filter(x => x.kind === "char" && x.peer === meId.current);
            // 有台下的游戏（擂台）：我带进房间、没上台的角色也在这一排，点了在台下发一条弹幕
            const aud = A && A.cheer ? (room.myChars || []).filter(c => !seatedMine.some(x => x.charId === c.id)).map(c => ({ charId: c.id, name: c.name, aud: true })) : [];
            const mineAt = seatedMine.concat(aud);
            if (!mineAt.length) return null;
            const go = ids => { if (tableBusy) return; setTableBusy(true); Promise.resolve(gs.talkNow ? gs.talkNow(gid, ids) : 0).catch(() => 0).then(() => setTableBusy(false)); };
            return h("div", { "data-wk": "nrtablespeak", className: "flex items-center", style: { gap: 10, padding: "8px 16px 0", overflowX: "auto" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, flexShrink: 0 } }, tableBusy ? "在想…" : "点谁谁说"),
              mineAt.map(x => h("button", { key: x.charId, "data-wk": "nrtablespeaker", disabled: tableBusy, onClick: () => go([x.charId]), className: "active:opacity-60 disabled:opacity-40",
                style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 44 } },
                h(Avatar, { character: charsById[x.charId] || { id: x.charId, name: x.name }, size: 30 }),
                h("span", { style: { fontFamily: F_BODY, fontSize: fs(10), color: t.fog } }, x.aud ? x.name + "·台下" : x.name))),
              mineAt.length > 1 && h("button", { "data-wk": "nrtabletogether", disabled: tableBusy, onClick: () => go(mineAt.map(x => x.charId)), className: "active:opacity-60 disabled:opacity-40",
                style: { flexShrink: 0, minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(11.5), color: t.ink } }, "一起说")); })(),
          // 牌桌上「说一句」（单机牌桌 CardSay 那一格的样子和挂点）：玩的人、观战的人都能说；角色不自动接，要她点上面的头像
          !done && !(A && A.ownTalk) && h("div", { "data-wk": "gamesay", style: { display: "flex", gap: 6, padding: "8px 16px 0" } },
            // 不受控：打字不重画整间房（typing-hot-path）
            h("input", { "data-wk": "gameinput", "data-part": "talk", ref: tableSayRef, defaultValue: "", maxLength: 160,
              onKeyDown: e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); sayAtTable(gid); } }, placeholder: "在牌桌上说一句",
              style: { flex: 1, minWidth: 0, boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: fs(13), outline: "none" } }),
            h("button", { "data-wk": "gamesaybtn", onClick: () => sayAtTable(gid),
              style: { flexShrink: 0, border: "1px solid " + t.ink, borderRadius: 999, padding: "0 15px", minHeight: 40, color: t.bg, background: t.ink, fontFamily: F_BODY, fontSize: fs(13) } }, "说")),
          done && h("div", { className: "flex", style: { gap: 8, padding: "0 16px 12px" } },
            isHost && h(Btn, { label: "再来一局", primary: true, wk: "nrgameagain", onClick: () => { gs.again(gid); shut(); } }),
            h(Btn, { label: "收起牌桌", wk: "nrgameback", onClick: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w) })));
      })();
      const turn = sv && A ? GC().myTurn(sv.inv, sv.view, meId.current, sv.priv, sv.pause) : false;
      // 牌桌整页开着、聊天半窗收着时，这期间房里来的新话
      const unread = chatWin.min && GC() ? GC().winUnread(gameWin, msgCount()) : 0;
      // 收起后的那颗小条：还是单聊半窗那一份外壳的收起样子，点了回到整页牌桌
      const pill = gameWin.min ? h(HalfWinFrame, { win: gameWin, setWin: setGameWin, forKey: "netgame", onClose: shut,
        pillLabel: (sv ? sv.inv.zh : "小游戏") + (turn ? " · 轮到你" : "") + " ▴", pillHot: turn }) : null;
      // 桌面底纹：单机那一张桌的同一块（铺在整页外壳上，顶栏透明）
      const bg = sv && root.GameShared && root.GameShared.tableBg ? root.GameShared.tableBg(sv.inv.key, t) : null;
      return { body, pill, unread, zh: sv ? sv.inv.zh : "小游戏", shut, full: !gameWin.min, bg };
    };
    // 房里开着的每一局：聊天页顶上、整页牌桌顶上都挂这一条，左右滑；点了按身份去报名／玩／观战
    const tablesBar = () => {
      if (!room || !GC() || !GC().openTables) return null;
      const gs = games.current;
      const rows = (room.msgs || []).filter(m => m.type === "game" && m.x).map(m => { const sv = gs ? gs.seen(m.x.gid) : null;
        return { x: sv && sv.inv && sv.inv.gid === m.x.gid ? Object.assign({}, m.x, { status: sv.inv.status, seats: sv.inv.seats }) : m.x, hostNick: ownerNick(room, m), pause: sv ? sv.pause : null, view: sv ? sv.view : null, m }; });
      // 接不上的局不挂横幅（她 11-22 截图：重进房间以后横幅里还是那几局、点进去玩不了）：
      //   我开的、可这台已经不记得了（重进过）；别人开的、开局的人现在不在房里——都先不列，她回来报到时卡会重新挂上
      const pr = presence();
      const live = rows.filter(r => r.x.status !== "lost" && (r.x.host === meId.current ? !!(gs && gs.isHost(r.x.gid)) : (pr[r.x.host] === "on" || pr[r.x.host] === "relay")));
      const list = GC().openTables(live, meId.current);
      if (!list.length) return null;
      const byGid = {}; rows.forEach(r => { byGid[r.x.gid] = r.m; });
      const cur = gameWin && !gameWin.min ? gameWin.gid : "";
      const GO = { join: "去报名", play: "进去玩", watch: "去观战" };
      return h("div", { key: "tb", "data-wk": "nrtables", className: "shrink-0", style: { display: "flex", gap: 8, overflowX: "auto", padding: "7px 14px", borderBottom: "1px solid " + t.line } },
        list.map(x => h("button", { key: x.gid, "data-wk": "nrtable", "data-go": x.go, "data-on": x.gid === cur ? "1" : "0",
          onClick: () => x.go === "join" ? gameHandlers(byGid[x.gid]).onJoin() : openGame(x.gid),
          style: { flex: "0 0 auto", textAlign: "left", padding: "6px 11px", borderRadius: 14, background: t.bg2, border: x.gid === cur ? "2px solid " + t.tint : "1px solid " + t.line, fontFamily: F_BODY, color: t.ink } },
          h("div", { style: { fontSize: fs(12.5), fontWeight: 600, whiteSpace: "nowrap" } }, x.zh + " · " + (x.hostNick || "有人") + " 开的"),
          h("div", { style: { fontSize: fs(11), color: t.fog, whiteSpace: "nowrap", marginTop: 1 } }, x.seated + " 人在桌上 · " + x.state + " · " + GO[x.go]))));
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
    const presence = () => { const o = {}; ((roomRef.current && roomRef.current.peers) || []).forEach(p => { const st = netRef.current.open.indexOf(p.peerId) >= 0 ? "on" : netRef.current.reach.indexOf(p.peerId) >= 0 ? "relay" : netRef.current.fail.indexOf(p.peerId) >= 0 ? "fail" : "off";
      o[p.peerId] = (st === "on" || st === "relay") && peerWatchRef.current[p.peerId] ? "watch" : st; }); return o; };
    const watchNow = () => !!(roomRef.current && roomRef.current.watch);
    const talkTargets = r => Core.watchTargets(r, myNick(), presence(), watchNow());
    // ── 一起听：歌曲卡只带元数据（Core.cleanSong），点开在自己这台放；不做两台同步 ──
    const songX = s0 => s0 ? Core.cleanSong({ title: s0.title, artist: s0.artist, cover: s0.cover, nid: s0.source === "netease" ? s0.neteaseId : "" }) : null;
    const sendSong = s0 => { const x = songX(s0); if (x) sayRich("song", x); };
    const playCard = x => {
      const plan = Core.songPlan(x, props.songLib ? props.songLib() : [], !!(props.canNetease && props.canNetease()));
      if (plan.how !== "miss" && props.playSong) { props.playSong(plan.song); props.toast && props.toast("在你这台放《" + x.title + "》" + (plan.how === "local" ? "（你曲库里那份）" : "")); return; }
      try { navigator.clipboard && navigator.clipboard.writeText(plan.query); } catch (e) {}
      props.toast && props.toast("这首在发歌的人手机上，你这边没有。歌名「" + plan.query + "」已经复制好，可以去一起听里搜");
    };
    // 每隔几秒看一眼自己这台在放什么，变了才广播（暂停、没在放＝空）
    useEffect(() => {
      if (!props.nowSong) return;
      // 每次都从 propsRef 现拿：这个 effect 只挂一次，直接用 props.nowSong 会一直拿着第一次那份（播放器状态是那一刻的，后来切歌、播放都看不见——她 11-22：横幅连自己的歌都不显示）
      const tick = () => { const f = (propsRef.current || props).nowSong, s0 = f ? f() : null, x = s0 && s0.playing ? songX(s0) : null;
        const v = x ? { title: x.title, artist: x.artist } : null;
        // 没变也每 30 秒再报一次：刚进房（还在「带谁进来」那页）时报出去的那一声，房里的人可能还没在听（她 11-22：不是房主的人在听什么，房主那边横幅上看不到）
        const same = JSON.stringify(v) === JSON.stringify(myNp.current);
        if (same && !(v && Date.now() - npSent.current > 30000)) return;
        myNp.current = v; npSent.current = Date.now(); if (!same) setNp(Object.assign({}, npRef.current)); send({ t: "np", song: v }); };
      tick(); const iv = setInterval(tick, 4000); return () => clearInterval(iv);
    }, []);
    // 角色顺手做的那几样（Core.actsOf 解出来的）落成要发的消息，接在这一轮后面；拍照、红包开抢这种要等的，交回 later 等这一轮发完再做
    const actPrompt = (ids) => ({
      photo: ids.filter(id => ((roomRef.current && roomRef.current.myChars) || []).some(c => c.id === id && c.selfie)).map(id => (((roomRef.current.myChars || []).find(c => c.id === id)) || {}).name),
      songs: props.songLib ? props.songLib().slice(0, 30).map(s0 => s0.title + (s0.artist ? " " + s0.artist : "")) : [],
      cards: chars.map(c => c.remark || c.name), songOn: !!props.findSong,
      playlist: Core.playlist(roomRef.current).map(x => x.song.title + (x.song.artist ? " " + x.song.artist : "")),
      board: { noteOk: Core.charNotesToday(roomRef.current, meId.current, Date.now()) < Core.CHAR_NOTES_PER_DAY, docOk: true, docNew: Core.charDocsToday(roomRef.current, meId.current, Date.now()) < Core.CHAR_DOCS_PER_DAY } });
    // 墙、歌单、文档那一块（给角色开口用）
    const boardText = cur => Core.boardBlock(cur, { locks: locksRef.current, me: meId.current, now: Date.now(),
      nameOf: k => k === meId.current ? myNick() : ((Core.boardOf(cur).docs.find(d => d.names && d.names[k]) || { names: {} }).names[k] || nickOf(String(k || "").split("|")[0])),
      recent: (cur.msgs || []).filter(m => !m.sys && !m.recalled).slice(-12).map(m => String(m.text || "")).join("\n") });
    // 房里此刻谁在听什么（给角色开口用）：我这台 + 别人报来的「正在听」
    const listenNow = () => Core.listenLines(Object.assign({}, npRef.current, myNp.current ? { me: Object.assign({ who: myNick() }, myNp.current) } : {}));
    const actsInto = async (charId, nm, acts, base, list) => {
      const later = [];
      if (!acts) return later;
      acts.rich.forEach(r => list.push(Object.assign(base(), { type: r.type, x: r.type === "poll" ? Object.assign({ pollId: mid("pl") }, r.x) : r.x })));
      if (acts.card) { const c = chars.find(x => x.name === acts.card || x.remark === acts.card);
        list.push(Object.assign(base(), { type: "namecard", x: c ? Core.cardOf(c, await smallAvatar(c)) : { name: acts.card } })); }
      if (acts.song) { let sg = null; try { sg = props.findSong ? await props.findSong(acts.song) : null; } catch (e) {}
        const x = Core.cleanSong(sg ? { title: sg.title, artist: sg.artist, cover: sg.cover, nid: sg.source === "netease" ? sg.neteaseId : "" } : { title: acts.song });
        if (x) list.push(Object.assign(base(), { type: "song", x })); }
      if (acts.rp) {
        // 只是玩法：跟她自己发的同一套（拆法只在这台手机上，别人来抢都问这台），不动钱包
        const splits = typeof splitRedPacket === "function" ? splitRedPacket(acts.rp.total, acts.rp.count) : [acts.rp.total];
        const rpId = mid("rp");
        commit(Core.patchRoom(roomRef.current, { rpSplits: Object.assign({}, roomRef.current.rpSplits || {}, { [rpId]: splits }) }));
        list.push(Object.assign(base(), { type: "rp", x: { rpId, total: acts.rp.total, count: splits.length, message: acts.rp.message, claims: [] } }));
        later.push(() => grabForMine(rpId, charId));
      }
      // 墙和文档：等这一轮的话发完再贴、再写（今天贴满了就不贴）
      if (acts.note) later.push(() => { if (Core.charNotesToday(roomRef.current, meId.current, Date.now()) < Core.CHAR_NOTES_PER_DAY) addNote(acts.note, { id: charId, name: nm }); });
      if (acts.file) later.push(() => charWrite(charId, nm, acts.file));
      const me = ((roomRef.current && roomRef.current.myChars) || []).find(c => c.id === charId);
      if (acts.photo && me && me.selfie) later.push(() => shootFor(charId, nm, acts.photo, base));
      return later;
    };
    // 角色拍一张：用这台的生图线路和 TA 的参考照（app 那边 drawPhoto），压小了发；画不出来就发一张只有描述的照片
    const shootFor = async (charId, nm, ph, base) => {
      const typing = on => send({ t: "typing", id: charId, name: nm, on });
      typing(true);
      let img = null;
      try { const raw = props.drawPhoto ? await props.drawPhoto(charId, ph.scene, ph.kind) : null; img = raw ? await shrinkImg(raw, 1024, Core.IMG_MAX.photo) : null; } catch (e) { img = null; }
      typing(false);
      if (!img) { post(Object.assign(base(), { ts: Date.now(), type: "photo", x: { desc: ph.scene } })); return; }
      let ref = ""; try { ref = await imgToVault(img); } catch (e) {}
      post(Object.assign(base(), { ts: Date.now(), type: "photo", x: { desc: ph.scene, img, imageRef: ref } }));
    };
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
            { stamp: props.stampFor ? ts => props.stampFor(char.id, ts) : null, now: Date.now(), game: gameStateFor(char.id), presence: presence(), watch: watchNow(), known: Core.knownLine(Core.loadKnown(), char.id, cur, Date.now()), emotes: emotes.map(e => e.keyword), targets: talkTargets(cur), acts: Object.assign(actPrompt([char.id]), { photo: actPrompt([char.id]).photo.length > 0 }), listen: listenNow(), boardText: boardText(cur) }),
          schemaHint: "{\"say\":[\"气泡1\",\"气泡2\"],\"quote\":\"（可选）Q编号\",\"emote\":\"（可选）\",\"pat\":\"（可选）\",\"vote\":\"（可选）\",\"pollNew\":\"（可选）\",\"askNew\":\"（可选）\",\"redpacket\":\"（可选）\",\"location\":\"（可选）\",\"voice\":\"（可选）\",\"namecard\":\"（可选）\",\"topic\":\"（可选）\",\"song\":\"（可选）\",\"photo\":\"（可选）\"}", maxTokens: 12000 });
        // 一次连发几条（她 2026-11-22：「为啥角色一次只会说一句话」）；老格式 text 也认
        const lines = Core.sayLines(d);
        const turnId = rerollId || mid("t"), nm = char.remark || char.name;
        const base = () => ({ id: mid("c"), kind: "char", name: nm, charId: char.id, ts: Date.now(), turnId, text: "" });
        const q0 = d && typeof d.quote === "string" ? Core.resolveQuote(cur, d.quote) : null;
        const acts = Core.actsOf(d, {});
        // voice:true＝这一轮说的整段用语音；数组＝那几句用语音
        const list = acts.voice === true && lines.length ? [Object.assign(base(), { type: "voice", x: { content: lines.join("\n") } }, q0 ? { quote: q0 } : {})]
          : lines.map((text, i) => Object.assign(base(), { text }, i === 0 && q0 ? { quote: q0 } : {}));
        if (Array.isArray(acts.voice)) acts.voice.forEach(v => list.push(Object.assign(base(), { type: "voice", x: { content: v } })));
        const later = await actsInto(char.id, nm, acts, base, list);
        const ekw = d && typeof d.emote === "string" && d.emote.trim() && d.emote !== "null" ? d.emote.trim() : "";
        const em = ekw && props.emoteFor ? props.emoteFor(char.id, ekw) : null;
        if (em) list.push(Object.assign(base(), { type: "emote", x: Object.assign({ keyword: em.keyword, url: em.url }, await emoteWire(em.url)) }));
        const pt = d && typeof d.pat === "string" ? d.pat.trim() : "";
        if (pt && pt !== nm && talkTargets(cur).indexOf(pt) >= 0) list.push(Object.assign(base(), { type: "pat", x: { to: pt } }));
        if (!list.length && !later.length) throw new Error("TA 没想好说什么，再点一次");
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
        later.forEach(f => f());
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
        const targets = talkTargets(cur);
        const sys = Core.jointInstruction(cur, mine.map(c => ({ id: c.id, name: c.name, you: props.youFor ? props.youFor(c.id) : "",
          emotes: (props.emotesFor ? props.emotesFor(c.id) : []).map(e => e.keyword) })),
          { stamp: props.stampFor ? ts => props.stampFor(lead.id, ts) : null, now: Date.now(), known: (K => mine.map(c => Core.knownLine(K, c.id, cur, Date.now(), c.name)).join(""))(Core.loadKnown()),
            presence: presence(), watch: watchNow(), targets, cast, game: gameStateFor(null), acts: actPrompt(mine.map(c => c.id)), listen: listenNow(), boardText: boardText(cur) });
        // 料全在 system，user 只留一句触发（prompt-send-shape）；几个人各说几条，按人数给足
        const raw = await callAI(p, sys, [{ role: "user", content: "接着房里的话往下说。" }], { use: "chat", logLabel: "联机·一起说", maxTokens: Math.min(32000, 12000 + 4000 * mine.length) });
        const people = mine.map(c => charsById[c.id]);
        const got = Core.jointLines(raw, people, myNick());
        const turnId = rerollId || mid("t"), list = [], later = [];
        for (const it of got) {
          const nm = (mine.find(c => c.id === it.char.id) || {}).name || it.char.remark || it.char.name;
          const base = () => ({ id: mid("c"), kind: "char", name: nm, charId: it.char.id, ts: Date.now(), turnId, text: "" });
          const q1 = it.quote ? Core.resolveQuote(cur, it.quote) : null;
          if (it.text && it.acts && it.acts.voice === true) list.push(Object.assign(base(), { type: "voice", x: { content: it.text } }, q1 ? { quote: q1 } : {}));
          else if (it.text) Core.sayLines({ text: it.text }).forEach((text, i) => list.push(Object.assign(base(), { text }, i === 0 && q1 ? { quote: q1 } : {})));
          (await actsInto(it.char.id, nm, it.acts, base, list)).forEach(f => later.push(f));
          const em = it.emote && props.emoteFor ? props.emoteFor(it.char.id, it.emote) : null;
          if (em) list.push(Object.assign(base(), { type: "emote", x: Object.assign({ keyword: em.keyword, url: em.url }, await emoteWire(em.url)) }));
          if (it.pat && it.pat !== nm && targets.indexOf(it.pat) >= 0) list.push(Object.assign(base(), { type: "pat", x: { to: it.pat } }));
          if (it.vote) { const pl = (cur.msgs || []).slice().reverse().find(x => x.type === "poll" && !x.recalled && x.x);
            const oi = pl ? pl.x.options.findIndex(o => o.text === it.vote) : -1;
            if (oi >= 0 && !(pl.x.options[oi].voters || []).some(v => v === nm)) vote(pl.x.pollId, oi, nm); }
        }
        if (!list.length && !later.length) throw new Error("他们没想好说什么，再点一次");
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
        later.forEach(f => f());
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
      if (k === "trpg") { const D = GC() && GC().ADAPTERS.trpg; if (D && D.shelf) { setGamePend({ game: D.shelf, cfg: {} }); setPage("gameprep"); } else props.toast && props.toast("跑团还没装上，再点一次试试"); return; }
      if (k === "debate") { const D = GC() && GC().ADAPTERS.debate; if (D && D.shelf) { setGamePend({ game: D.shelf, cfg: {} }); setPage("gameprep"); } else props.toast && props.toast("擂台还没装上，再点一次试试"); return; }
      if (k === "location") setSheet("geo");
      else if (k === "photo") { setPhotoImgs([]); setPhotoText(""); setSheet("photo"); }
      else if (k === "file") pickTextFile(msg => sayRich("file", msg));
      else setSheet(k === "voicemsg" ? "voicemsg" : k);
    };
    const sendEmote = async em => sayRich("emote", Object.assign({ keyword: em.keyword || "表情", url: em.url }, await emoteWire(em.url)));
    // 一次挑几张（跟单聊同一个 ChatPhotoPick）：一张张压小、各发一条（各自拆片）；说明只跟在第一张上
    const sendPhoto = async () => {
      const cap = photoText.trim(), srcs = photoImgs.slice(0, typeof CHAT_PHOTO_MAX === "number" ? CHAT_PHOTO_MAX : 6);
      if (!srcs.length && !cap) { props.toast && props.toast("选一张图，或者写一句照片里有什么"); return; }
      setSheet(null);
      if (!srcs.length) { sayRich("photo", { desc: cap }); return; }
      let bad = 0, first = true;
      for (const src of srcs) {
        const img = await shrinkImg(src, 1024, Core.IMG_MAX.photo);
        if (!img) { bad++; continue; }
        let ref = ""; try { ref = await imgToVault(img); } catch (e) {}
        sayRich("photo", { desc: first ? cap : "", img, imageRef: ref }); first = false;
      }
      if (bad) props.toast && props.toast(bad + " 张图没能压小，没发出去，换一张试试");
    };
    const sendCard = async r => {
      if (r.me) { sayRich("namecard", { name: myNick(), avatar: "" }); return; }
      const c = r.char; sayRich("namecard", Object.assign({}, Core.cardOf(c, await smallAvatar(c))));
    };
    // 长按：按住半秒出菜单（右键直接出）
    const pressT = useRef(null);
    const onPress = (i, now) => { clearTimeout(pressT.current); if (now) setMenuAt(i); else pressT.current = setTimeout(() => setMenuAt(i), 480); };
    const onRelease = () => clearTimeout(pressT.current);
    // 往左滑一下就引用：跟单聊同一只手势钩子，只是这里一行的挂点是 nrmsg / data-nri
    useLongPressMenu(() => {}, { rowSel: '[data-wk="nrmsg"][data-nri]', rowAttr: "data-nri", onSwipeLeft: i => {
      const r = roomRef.current, m = r && (r.msgs || [])[i];
      if (pageRef.current !== "chat" || !m || m.sys || m.recalled || m.type === "pat") return;
      const q = Core.quoteOf(r, m); if (q) setQuoted(q);
    } });
    // 自己发的能改字、撤回；自己带来的人说的也能；别人的只能删我这边。卡片（红包、投票……）不改字
    const menuItems = m => {
      if (m.sys || m.recalled) return [[m.side === "me" && !m.sys ? "del" : "delmine"]];
      const own = m.side === "me", first = (m.type ? [] : ["copy"]).concat(m.type === "pat" ? [] : ["quote"]);
      if (!own) return [first, ["delmine"]];
      return [first, [m.type ? null : "edit", m.kind === "char" && m.turnId ? "reroll" : null].filter(Boolean), ["recall", "del"]];
    };
    const onMenu = (act, m) => {
      if (act === "copy") { typeof copyText === "function" && copyText(m.text); props.toast && props.toast("复制好了"); }
      else if (act === "del" && m.side === "me" && !m.sys) requestAppConfirm("删除这条消息？", "房里每个人那边都一起删掉，不留「撤回了」那一行。删了不能恢复。", () => dropOwn(m.id), "删除");
      else if (act === "del" || act === "delmine") requestAppConfirm("删除这条消息？", "只从你这台手机上删掉，房里别人那边还在。删了不能恢复。", () => dropLocal(m.id), "删除");
      else if (act === "quote") { const q = Core.quoteOf(roomRef.current, m); if (q) setQuoted(q); }
      else if (act === "recall") recallOwn(m.id);
      else if (act === "edit") requestAppPrompt("编辑这条消息", "改好以后房里每个人那边都会换成新的，标「已编辑」。", m.text, v => { if (String(v || "").trim()) editOwn(m.id, v); }, "改好了");
      else if (act === "reroll") redo(m);
    };
    // 每一行：长按、卡片、这一轮最后一条底下的「重新说 ‹ 1/2 ›」
    const rowProps = (r, interactive) => (m, i) => {
      const o = { rich: x => h(RichBody, { m: x, mine: x.side === "me", meName: myNick(), speaker: x.type === "voice" && x.kind === "char" && x.side === "me" && x.charId ? charsById[x.charId] || null : null, voters: Math.max(1, headCount(r) - 1),
        game: interactive && x.type === "game" ? gameHandlers(x) : null, onRec: () => { setRecId(x.id); setViewId(r.id); setPage("gamerec"); },
        onRp: interactive ? () => setRpOpen(x.x.rpId) : undefined, onSong: () => playCard(x.x), onVote: interactive ? opt => vote(x.x.pollId, opt, myNick()) : undefined }) };
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
        schemaHint: "{\"memory\":\"一小段，第三人称\",\"people\":[{\"name\":\"别人带来的那位的名字\",\"note\":\"一两句印象，第三人称\"}]}", maxTokens: 12000 });
      // 失败自动再试一次；还不行才报给她（她能在「以前的房间」里点重试）
      let d; try { d = await ask(); if (!String((d && d.memory) || "").trim()) d = await ask(); } catch (e) { d = await ask(); }
      const text = String((d && d.memory) || "").trim();
      if (!text) throw new Error("没浓缩出什么");
      props.onAddMemory && props.onAddMemory(text, char.id);
      // 在联机里认识的人：这一段里开过口的别人家的角色，各记名字＋印象＋几次＋上次（不存对方人设）
      try { Core.saveKnown(Core.meetPeople(Core.loadKnown(), char.id, Object.assign({}, live, { msgs: part.fresh }), d && d.people, part.upTo)); } catch (e) {}
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

    // 连接码：复制给要来的人。剪贴板不让写就弹一个能长按全选的框
    const copySig = async (sg, cd) => {
      const s1 = Core.packJoin(sg, cd); if (!s1) return;
      try { await navigator.clipboard.writeText(s1); props.toast && props.toast("连接码复制好了：整串发给要来的人"); }
      catch (e) { try { window.prompt("长按全选复制这串连接码", s1); } catch (_) {} }
    };
    const sigCard = (sg, cd, key) => h("div", { key, "data-wk": "nrsigcard", style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 14, display: "flex", flexDirection: "column", gap: 8 } },
      h(Note, null, "这个房间用你自己的 Supabase 递名片：别人要用连接码进来，只有房间号进不来。"),
      h("div", { "data-wk": "nrsigcode", style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, wordBreak: "break-all", lineHeight: 1.5, maxHeight: 64, overflow: "hidden" } }, Core.packJoin(sg, cd)),
      h(Btn, { label: "复制连接码", primary: true, onClick: () => copySig(sg, cd), wk: "nrsigcopy" }),
      h(Note, null, "连接码里有这个项目的公开密钥，只发给信得过的人。Supabase 只用来递名片，聊天内容不经过它；云同步的存档有行级安全挡着，拿着这串也读不到。"));
    // 外壳收任意几块（顶栏、正文、底下几条）：原来只收三块，房间页多了「重新连上」那条以后输入框被挤成第四块丢掉了
    const shell = (...parts) => shellOn(null, ...parts);
    const shellOn = (bg, ...parts) => h("div", { "data-wk": "nrpage", "data-part": page, className: "h-full flex flex-col", style: Object.assign({ background: t.bg }, bg || {}, { color: t.ink }) },
      ...parts.map(x => x || null));
    const scroll = kids => h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14 } }, kids);
    const label = s => h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, s);
    const card = kids => h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 14, display: "flex", flexDirection: "column", gap: 10 } }, kids);
    const withWhom = r => "和 " + (Core.peerNames(r).join("、") || "还没人");

    if (page === "wait") return shell(h(Head, { zh: "联机", onBack: cancelWait }), scroll([
      code && h("div", { key: "c", style: { textAlign: "center", paddingTop: 30 } },
        h(Note, null, "房间号"),
        h("div", { "data-wk": "nrcode", style: { fontFamily: F_DISPLAY, fontSize: fs(40), letterSpacing: 8, margin: "6px 0 10px" } }, code)),
      code && sig && sigCard(sig, code, "k"),
      h("div", { key: "s", style: { textAlign: "center" } }, h(Note, null, status)),
      h(Note, { key: "n" }, (sig ? "把上面整串连接码发给要来的人" : "把房间号发给要来的人") + "（算上你最多四个人），让她们在「联机」首页粘进「房间号」那一格、点「加入」。第一个人连上你就能进房间，后来的人随时能进。要来的人得开着这一页；20 秒连不上会提示。")
    ]));

    if (page === "pick") return shell(h(Head, { zh: repick ? "换人" : "带谁进来", onBack: () => { if (repick) { setRepick(false); setPage("chat"); } else setPage("leave"); } }), scroll([
      repick && h(Note, { key: "rp" }, "勾掉的人先走，新勾的人进来；别人那边的名单跟着换。走了的人以前说的话照旧留在记录里，退出时能记进记忆的只有现在名单上的人。"),
      h(Note, { key: "n" }, "勾上要带进房间的人。别人只看得到 TA 们的名字和头像，人设、记忆、世界书都留在你手机上。TA 们开口用的是你自己的线路。「带上最近单聊」：TA 开口时记得你们最近在单聊里说过什么，聊天原文不发给别人，但 TA 可能自己在房间里提起。「允许自拍」：TA 想发照片时用你这台的生图线路真画一张（按张计费），关了 TA 就不发照片；默认照 TA 能不能出图来。"),
      chars.length ? chars.map(c => h("div", { key: c.id, "data-wk": "nrpickrow", style: { padding: "6px 0" } },
        // 名字一行写满，两颗开关挪到下面一行（她 11-22 截图：并排时名字被挤成一字一行）
        h("label", { className: "flex items-center", style: { gap: 12, minHeight: 48 } },
          h("input", { type: "checkbox", checked: !!picked[c.id], onChange: e => setPicked(p => Object.assign({}, p, { [c.id]: e.target.checked })) }),
          h(Avatar, { character: c, size: 36 }),
          h("div", { className: "truncate", style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(14) } }, c.remark || c.name)),
        picked[c.id] && h("div", { className: "flex flex-wrap", style: { gap: 8, paddingLeft: 72 } },
        picked[c.id] && h("button", { "data-wk": "nrwithchat", "data-on": withChat[c.id] ? "1" : "0", onClick: e => { e.preventDefault(); setWithChat(p => Object.assign({}, p, { [c.id]: !p[c.id] })); },
          style: { minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + (withChat[c.id] ? t.ink : t.line), background: withChat[c.id] ? t.ink : "transparent", color: withChat[c.id] ? t.bg : t.fog, fontFamily: F_BODY, fontSize: fs(12) } },
          withChat[c.id] ? "✓ 带上最近单聊" : "带上最近单聊"),
        picked[c.id] && h("button", { "data-wk": "nrselfie", "data-on": selfieOn(c.id) ? "1" : "0", onClick: e => { e.preventDefault(); setSelfieSet(p => Object.assign({}, p, { [c.id]: !selfieOn(c.id) })); },
          style: { minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + (selfieOn(c.id) ? t.ink : t.line), background: selfieOn(c.id) ? t.ink : "transparent", color: selfieOn(c.id) ? t.bg : t.fog, fontFamily: F_BODY, fontSize: fs(12) } },
          selfieOn(c.id) ? "✓ 允许自拍" : "允许自拍"))))
        : h(Note, { key: "e" }, "你还没有角色，也可以只你自己进去聊。"),
      h(Btn, { key: "go", label: repick ? "换好了" : "进房间", primary: true, onClick: enter, wk: "nrenter" })
    ]));

    const REJOIN_NOTE_PEERS = "房里暂时没有别人在线。谁回来点「重新连上」就会接上；你这边断了也点一下。刚才的记录都在。", REJOIN_NOTE_ALONE = "还没有别人进来。";
    // 输入区（点谁谁说那排＋输入框）：整页聊天和半窗聊天用同一份
    const composerEl = () => { const myChars = ((room && room.myChars) || []); const alone = !mesh.current || net.reach.length === 0;
      return h(React.Fragment, { key: "cpw" },
        quoted && h(QuoteDraftBar, { key: "qd", text: (quoted.name ? quoted.name + "：" : "") + quoted.text, onClear: () => setQuoted(null) }),
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
              myChars.some(c => busy[c.id]) ? "在想…" : "一起说"),
            // 旁观：角色看不见我。还是点头像才开口，只是 TA 们当我不在房里
            h("button", { "data-wk": "nrwatch", "data-on": room && room.watch ? "1" : "0", onClick: () => setWatch(!(room && room.watch)),
              className: "active:opacity-60", style: { flexShrink: 0, minHeight: 32, padding: "0 10px", borderRadius: 16, border: "1px solid " + (room && room.watch ? t.ink : t.line), background: room && room.watch ? t.ink : "transparent", color: room && room.watch ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(11.5) } },
              room && room.watch ? "✓ 旁观中" : "旁观")),
          room && room.watch && h("div", { "data-wk": "nrwatchnote", style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, paddingBottom: 6, lineHeight: 1.5 } },
            "旁观中：角色当你不在房里，照样点头像让 TA 说。你一发消息就自动退出旁观。"),
          h(Composer, { onSend: sayHuman, disabled: alone, fillRef, plusOn: panel, onPlus: () => setPanel(v => !v) }))); };
    // ── 房间顶上那一条：墙 / 歌单 / 文档，点哪格展开哪格，再点收起（她 2026-11-22） ──
    const boardEl = () => {
      const r = roomRef.current; if (!r) return null;
      const b = Core.boardOf(r), pl = Core.playlist(r), me = meId.current;
      const tabs = [["wall", "墙", b.notes.length], ["songs", "歌单", pl.length], ["docs", "文档", b.docs.length]];
      const small = { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.6 };
      const tap = (txt, on, wk) => h("button", { "data-wk": wk, onClick: on, className: "active:opacity-60", style: { color: t.accent, fontFamily: F_BODY, fontSize: fs(12) } }, txt);
      // 墙／歌单／文档的画法都是频道那几份公共的（NoteWall / SongShelf / FileRow / IndexTabs，她 2026-11-22「胶囊好丑，参考频道，抽成公共的」）
      const panel = boardTab === "wall" ? h(NoteWall, { notes: b.notes, nameOfNote: (n, by) => by === n.by ? (n.by === me && !n.charId ? "我" : (n.name || "有人")) : (by === me ? "我" : nickOf(by)),
          mineOf: n => n.by === me, onAdd: addNote, note: "谁都能贴；自己贴的（和自己带来的人贴的）自己能撕。",
          actionsOf: n => [n.by === me ? tap("撕掉", () => dropBoard(n.id), "nrnotetear") : null] })
        : boardTab === "songs" ? (() => { const lib = props.songLib ? props.songLib() : [], cur = props.nowSong ? props.nowSong() : null;
          const has = x => pl.some(y => typeof chpSongMatch === "function" ? !!chpSongMatch([y.song], x) : y.song.title === x.title);
          return h(SongShelf, { rows: pl.map(x => ({ key: x.id, title: x.song.title, artist: x.song.artist, by: (x.by === me ? "我" : x.name || nickOf(x.by)) + (x.card ? " 发的歌卡" : " 加的"),
              actions: [["放这首", () => playCard(x.song)], x.by === me ? ["拿掉", () => dropBoard(x.id)] : null] })),
            now: cur, nowIn: cur && cur.title && has(cur), lib, libIn: has, onAdd: x => { if (!has(x)) addPick(x); },
            note: "房里发过的歌卡会自己收进来。点「放这首」在你这台放，各放各的；自己加的自己能拿掉。" }); })()
        : boardTab === "docs" ? h(React.Fragment, null,
          h("div", { style: { padding: "0 0 8px" } },
            h("button", { "data-wk": "nrdocnew", onClick: newDoc, className: "active:opacity-60", style: shelfBtn(t) }, "新开一份")),
          h("div", { style: Object.assign({}, small, { paddingBottom: 10 }) }, "一份同时只能一个人写：有人在写、或者有人的角色正在说话时，别人只能看。"),
          b.docs.length ? h("div", { style: { margin: "0 -16px" } }, b.docs.slice().sort((x, y) => (y.updatedTs || 0) - (x.updatedTs || 0)).map(d => { const why = docWhy(d.id);
            return h(FileRow, { key: d.id, wk: "nrdocrow", part: "doc", locked: !!why, onClick: () => setDocId(d.id), title: "《" + d.name + "》",
              meta: docName(d, d.updatedBy) + " · " + String(d.text || "").length + " 字" + (why ? " · " + why : "") }); }))
            : h("div", { style: small }, "还没有文档。聊出了计划、清单，可以放进来，TA 们也会顺手往里写。"))
        : null;
      // 她 2026-11-22：不要下拉半屏，跟频道一样点进去是一整页；顶上那排是频道同款矮索引签，点「聊天」回到房间
      const ZH = { wall: "墙", songs: "房间歌单", docs: "文档" };
      const items = [["chat", "聊天"], ["wall", "墙" + (b.notes.length ? " " + b.notes.length : "")], ["songs", "歌单" + (pl.length ? " " + pl.length : "")], ["docs", "文档" + (b.docs.length ? " " + b.docs.length : "")]];
      const go = k => setBoardTab(k === "chat" ? "" : k);
      return [
        h("div", { key: "bd", "data-wk": "nrboard", className: "shrink-0" }, h(IndexTabs, { items, tab: "chat", onTab: go })),
        panel && h(PageSheet, { key: "bdpage", onClose: () => setBoardTab(""), zh: ZH[boardTab], sub: "房间 " + r.code, scrollKey: "nrboard-" + boardTab },
          h(IndexTabs, { items, tab: boardTab, onTab: go }),
          h("div", { "data-wk": "nrboardpanel", "data-part": boardTab, style: { padding: "14px 16px 28px" } }, panel))];
    };
    // 打开的那份文档：频道文件同一页（ChfDocPage），多了锁——别人在写、角色在说话时只能看
    const docEl = () => {
      const r = roomRef.current, d = r && docId ? Core.boardOf(r).docs.find(x => x.id === docId) : null;
      if (!d || typeof ChfDocPage !== "function") return null;
      const mineDoc = String(d.createdBy || "").split("|")[0] === meId.current;
      return h(ChfDocPage, { key: "doc" + d.id, file: d, nameOf: k => docName(d, k), lockNote: docWhy(d.id),
        onEditStart: () => startEdit(d), onEditEnd: () => freeLock(d.id), onSave: txt => saveDoc(d, txt),
        onRename: n => renameDoc(d, n), onDelete: mineDoc ? () => { dropBoard(d.id); setDocId(null); } : null,
        onClose: () => { freeLock(d.id); setDocId(null); } });
    };
    if (page === "chat" && room) {
      const myChars = (room.myChars || []);
      const alone = !mesh.current || net.reach.length === 0;
      const online = 1 + net.reach.length;
      const tail = Object.keys(busy).filter(k => busy[k]).map(k => h(Note, { key: "b" + k }, ((charsById[k] && (charsById[k].remark || charsById[k].name)) || "TA") + " 正在想…"))
        .concat(Object.keys(peerTyping).map(k => h(Note, { key: "p" + k }, peerTyping[k] + " 正在输入…")));
      // 房里每个人一格：在线 / 直连不上（别人在转）/ 连不上 / 离开了
      const stateOf = id => net.open.indexOf(id) >= 0 ? "on" : net.reach.indexOf(id) >= 0 ? "relay" : net.fail.indexOf(id) >= 0 ? "fail" : "off";
      const stateText = { on: "在线", relay: "直连不上，别人在帮你们转", fail: "和她连不上", off: "离开了", watch: "在旁观" };
      const peers = room.peers || [];
      const trouble = peers.filter(p => stateOf(p.peerId) === "fail" || stateOf(p.peerId) === "relay");
      const gp = gameParts();
      const rc = room.recap;
      // 前情小卡：连回来时摆在聊天顶上；能收起成一条、能关掉、能「重新总结」（重新总结会再花一次调用）
      const recapEl = recapUi.show && h("div", { key: "rc", "data-wk": "nrrecap", "data-fold": recapUi.fold ? "1" : "0", className: "shrink-0",
        style: { margin: "8px 12px 0", padding: recapUi.fold ? "6px 12px" : "10px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2 } },
        h("div", { className: "flex items-center", style: { gap: 8 } },
          h("button", { "data-wk": "nrrecapfold", onClick: () => setRecapUi(u => Object.assign({}, u, { fold: !u.fold })), style: { flex: 1, minWidth: 0, minHeight: 32, textAlign: "left", fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } },
            (recapUi.fold ? "▸ " : "▾ ") + "上次聊到哪" + (recapUi.busy ? " · 正在总结…" : "")),
          // 还没总结过：一颗「总结一下」，点了才调用
          !rc && !recapUi.busy && h("button", { "data-wk": "nrrecapgo", onClick: () => makeRecap(room.id, false), style: { minHeight: 32, padding: "0 10px", borderRadius: 999, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(11.5), color: t.ink } }, "总结一下"),
          rc && !recapUi.fold && !recapUi.busy && h("button", { "data-wk": "nrrecapredo", onClick: () => makeRecap(room.id, false), style: { minHeight: 32, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, "重新总结"),
          h("button", { "data-wk": "nrrecapclose", onClick: () => setRecapUi(u => Object.assign({}, u, { show: false })), style: { minHeight: 32, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(12), color: t.fog } }, "×")),
        !recapUi.fold && recapUi.err && h(Note, null, recapUi.err),
        !recapUi.fold && rc && h("div", { "data-wk": "nrrecapbody", style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.sub || t.ink, lineHeight: 1.7, marginTop: 4 } },
          rc.talk && h("div", null, rc.talk),
          rc.said.map((x, i) => h("div", { key: "s" + i }, "· " + x)),
          rc.plans.map((x, i) => h("div", { key: "p" + i }, "· 约好：" + x)),
          rc.game && h("div", null, "· 上一局：" + rc.game),
          h("div", { style: { fontSize: fs(10.5), color: t.fog, marginTop: 4 } }, "照房间记录总结到 " + fmt(rc.upTo) + "；TA 们开口时也会带上这段。")));
      const chatCore = [
        recapEl,
        h(MsgList, { key: "ml", room, myCharsById: charsById, tail, rowProps: rowProps(room, true), selfFace: selfFaceOf() }),
        alone && h("div", { key: "rj", "data-wk": "nrrejoinbar", className: "shrink-0 flex items-center", style: { gap: 10, padding: "8px 14px", borderTop: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog, lineHeight: 1.5 } }, peers.length ? REJOIN_NOTE_PEERS : REJOIN_NOTE_ALONE),
          peers.length > 0 && h(Btn, { label: "重新连上", primary: true, onClick: () => rejoin(room), wk: "nrrejoin" })),
        composerEl()];
      if (gp && gp.full) return shellOn(gp.bg,
        h(Head, { zh: gp.zh, sub: "房间 " + room.code + " · 在线 " + online + " 人", bg: gp.bg ? "transparent" : undefined, onBack: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w),
          right: h("button", { "data-wk": "nrgameback", onClick: () => setGameWin(w => w ? Object.assign({}, w, { min: true }) : w), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "回到聊天") }),
        tablesBar(),
        h("div", { "data-wk": "nrgamefull", className: "flex-1 min-h-0" }, gp.body),
        h(HalfWinFrame, { win: chatWin, setWin: setChatWin, forKey: "netchat",
          pillLabel: "房间聊天" + (gp.unread ? " · " + gp.unread + " 条新消息" : "") + " ▴", pillHot: gp.unread > 0 },
          h("div", { "data-wk": "nrchathalf", className: "h-full flex flex-col", style: { background: t.bg2 } }, chatCore)),
        ...roomExtras({ t, room, sheet, setSheet, props, myNick, charsById, panel, onTap, patTargets, headCount, sendEmote, sendPhoto, sendCard, sendSong, sayRich, sendRp,
          photoImgs, setPhotoImgs, photoText, setPhotoText, fillRef, rpOpen, setRpOpen, openRp, myKey, menuAt, setMenuAt, menuItems, onMenu }),
        joinSheet());
      return shell(
        h(Head, { zh: "房间 " + room.code, sub: "在线 " + online + " 人", onBack: () => setPage("leave"),
          right: h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 } },
            room.sig && h("button", { "data-wk": "nrsigcopy", onClick: () => copySig(room.sig, room.code), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "连接码"),
            h("button", { "data-wk": "nrrepick", onClick: openRepick, style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "换人"),
            h("button", { "data-wk": "nrleave", onClick: () => setPage("leave"), style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, "退出")) }),
        peers.length > 0 && h("div", { "data-wk": "nrpeerbar", className: "shrink-0", style: { padding: "6px 14px", borderBottom: "1px solid " + t.line, display: "flex", flexWrap: "wrap", gap: "4px 12px" } },
          peers.map(p => { const st = stateOf(p.peerId); return h("span", { key: p.peerId, "data-wk": "nrpeer", "data-state": st, style: { fontFamily: F_BODY, fontSize: fs(11.5), color: st === "on" ? t.ink : t.fog } },
            (st === "on" ? "● " : "○ ") + p.nick + (st === "on" ? (peerWatch[p.peerId] ? " · " + stateText.watch : "") : " · " + stateText[st])); }),
          trouble.map(p => { const relay = stateOf(p.peerId) === "relay", d = !relay && net.diag && net.diag[p.peerId];
            return h("div", { key: "d" + p.peerId, "data-wk": "nrdiag", style: { width: "100%", fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5 } },
              "和 " + p.nick + " 直连不上：" + (relay ? "话由房里其他人转过去，可能慢一点。"
                : d ? d.why + "。" + d.fix + "。"
                : "她收不到你的话。两边先关掉梯子再试；还不行就一边改用流量，或者填一个自己的中转（首页「连不上的时候」）。")); })),
        (() => { const L = Core.listenLines(Object.assign({}, np, myNp.current ? { me: Object.assign({ who: "你" }, myNp.current) } : {}));
          return L.length > 0 && h("div", { key: "np", "data-wk": "nrlisten", className: "shrink-0", style: { padding: "5px 14px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.5 } },
            L.map((x, i) => h("div", { key: i, style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "♪ " + x))); })(),
        ...boardEl() || [],
        tablesBar(),
        ...chatCore, docEl(),
        ...roomExtras({ t, room, sheet, setSheet, props, myNick, charsById, panel, onTap, patTargets, headCount, sendEmote, sendPhoto, sendCard, sendSong, sayRich, sendRp,
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
      const NOTE = { gomoku: "落子归 app 里的棋手（角色、NPC 都是），不花调用。", chess: "角色照 TA 估过的水平走（没估过按会下），NPC 由开局的人那台走；没有提示、悔棋和教学。",
        xiangqi: "角色照 TA 估过的水平走（没估过按会下），NPC 由开局的人那台走；没有提示、悔棋和教学。", jungle: "角色照 TA 估过的水平走（没估过按会下），NPC 由开局的人那台走；没有提示、悔棋和教学。",
        go: "棋盘大小照下面挑的；双方连着停一手就由开局的人那台估死子、数子。没有提示、悔棋和教学。", haigui: "下一页选谁出题。", q25: "下一页选谁出题。",
        story: "三圈，每人每次抽一个要用上的词；角色用带 TA 来的那台、TA 自己的线路接。", tod: "每人约两轮，题由下一位出；角色出题、回答都用带 TA 来的那台的线路。",
        monopoly: "钱和地都在开局的人那台结算；不买的地自动拍卖，讨价还价在房间里说。",
        spy: "词由开局的人那台出、只发到各人自己的手机；描述、投票轮流来，角色用带 TA 来的那台、TA 自己的线路。",
        uno: "每人的手牌只发到自己那台；角色、NPC 由手机替着出（不花调用）。没有「每人自己想」。",
        oldmaid: "每人的手牌只发到自己那台，抽的时候只看得到下家牌背。", liar: "每人的骰子只发到自己那台，开了才一起亮。",
        poker: "底牌只发到自己那台，摊牌才亮；角色、NPC 由手机替着下（不花调用）。没有「输的人答真心话」和「每人自己想」。",
        blackjack: "庄家是手机；每人的牌只发到自己那台，一手结算时才一起亮。没有「TA 坐庄」和「每人自己想」。",
        doudizhu: "正好 3 个座位，真人不够用角色和 NPC 补；手牌只发到自己那台，底牌定了地主才亮。",
        mahjong: "正好 4 个座位，真人不够用角色和 NPC 补；手牌只发到自己那台。牌墙自动摸；四川的换三张、定缺由手机替每家挑。",
        lingxi: "两个人各写各的，两边都交了才一起亮；角色用带 TA 来的那台、TA 自己的线路。开局的人随时能结束。" };
      // 不在单机小游戏目录里、只在房间里有的那几盒（辩论擂台）：摆在架子最后，点了去它自己的开局页
      const extra = root.NetGameCore.supported().filter(k => k !== "debate" && k !== "trpg")   /* 擂台、跑团各在 ＋ 里单独一格（她 11-22） */.map(k => root.NetGameCore.ADAPTERS[k].shelf).filter(Boolean)
        .map(g => Object.assign({}, g, { onPick: () => { setGamePend({ game: g, cfg: {} }); setPage("gameprep"); } }));
      // 开局多两项：一轮完了停不停（有「一轮」的那几盒）；真心话转几轮
      const setupExtra = g => { const A = root.NetGameCore.ADAPTERS[g.key] || {}, out = [];
        if (A.roundEnd) out.push({ key: "autoNext", label: "一轮完了", def: "pause", options: [{ key: "pause", zh: "停下来聊聊" }, { key: "auto", zh: "自动接着来" }],
          hint: v => v === "auto" ? "一轮接一轮不停，跟以前一样。" : "每一轮（一手、一夜一天、一个任务）结束停在桌上，大家和角色可以先聊几句；你点「接着来」才开下一轮。" });
        if (g.key === "tod") out.push({ key: "todRounds", label: "转几轮", def: "0", options: [{ key: "0", zh: "不限" }, { key: "6", zh: "6 轮" }, { key: "10", zh: "10 轮" }, { key: "20", zh: "20 轮" }],
          hint: v => v === "0" ? "一直转下去，你随时点「收桌」结束。" : "转满 " + v + " 轮自动收桌；中途也能点「收桌」。" });
        // 尺度：单机真心话那个「尺度放开点」开关，同一句说明
        if (g.key === "tod") out.push({ key: "todHot", label: "尺度", def: "mild", options: [{ key: "mild", zh: "轻松好玩" }, { key: "hot", zh: "尺度放开点" }],
          hint: v => v === "hot" ? "真心话 / 大冒险 会更暧昧大胆。" : "朋友聚会的尺度，轻松好玩。" });
        return out; };
      return h(G, { characters: mine, profile: props.profile, only: root.NetGameCore.supported(), extra, onConfigured, setupExtra,
        setupHide: ["stake", "injectChat", "ccSeat", "boardTeach", "gmkBrain", "q25Host", "skillPins", "cardBrain", "bjDealer", "pkTruth", "mjAutoDraw", "mjSwap", "wolf_whitewolf", "av_lady"], setupNote: g => (NOTE[g.key] || (root.NetGameCore.ADAPTERS[g.key] || {}).note || "") + (GC() && GC().charOptKinds(g.key).length ? "你带的角色怎么玩（牌技、牌手水平、随手、带不带最近单聊）在邀请卡上点「换人／加入」那张单里调。" : ""),
        intro: "挑一盒、设好开局（开局页里勾的角色就是你这边上场的人），房里会出现一张邀请卡，大家在卡上报名，你点开始。", onBack: () => setPage("chat") });
    }
    // 自己带开局页的那几盒（辩论擂台）：页面在它自己的文件里，这儿只套顶栏
    const prepA = page === "gameprep" && room && gamePend && GC() ? GC().ADAPTERS[gamePend.game.key] : null;
    if (prepA && prepA.Prep) return shell(h(Head, { zh: gamePend.game.zh, onBack: () => { setGamePend(null); setPage(OWN_SLOT[gamePend.game.key] ? "chat" : "gamepick"); } }), scroll([
      h(prepA.Prep, { key: "p", allChars: props.characters || [], myChars: (room.myChars || []).map(c => charsById[c.id]).filter(Boolean), myApi: props.gameApi ? props.gameApi() : null, nick: myNick(), onSend: (cfg, pz) => sendInvite(gamePend.game, cfg, pz) })]));
    if (page === "gameprep" && room && gamePend) {
      // 谁出题：开局的人（就是你，下面写或者现出）／系统现出／指定一个座位／轮流（每局「再来一局」换下一个座位）。出题的人这一局不参与问
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
          m && A && m.x.replay && root.GameShared ? h(A.Replay, { rec: m.x }) : h("div", { style: { padding: 16 } }, h(Note, null, m ? "这一局没有能回看的棋谱。" : "找不到这张战绩卡了。")),
          m && m.x.talk && root.NetGameUI && root.GameShared ? h(root.NetGameUI.TalkStrip, { lines: m.x.talk, maxHeight: "none" }) : null));
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
          h(MsgList, { room: r, myCharsById: charsById, rowProps: rowProps(r, false), selfFace: selfFaceOf() }),
          h("div", { className: "shrink-0", style: { padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid " + t.line } },
            h(Btn, { label: delAsk ? "确定删掉这个房间的记录？" : "删除这个房间的记录", disabled: saving, wk: "nrdel", onClick: () => {
              if (!delAsk) { setDelAsk(true); return; }
              Core.removeRoom(r.id); setDelAsk(false); refresh(); setPage("home"); props.toast && props.toast("删掉了；已经记进角色记忆的那几句还在");
            } }))));
    }

    // 在联机里认识的人：按我的角色分组，每条能删
    if (page === "known") {
      const K = Core.loadKnown(), ids = Object.keys(K).filter(id => Object.keys(K[id] || {}).length);
      const del = (cid, key) => { Core.saveKnown(Core.forgetKnown(Core.loadKnown(), cid, key)); setKnownTick(n => n + 1); };
      return shell(h(Head, { zh: "在联机里认识的人", onBack: () => setPage("home") }), scroll([
        h(Note, { key: "n" }, "退出时勾了「记进记忆」的角色，会记下在房里见过的别人家的角色：名字、谁带来的、一两句印象、一起玩过几次。只记这些，对方的人设不在你手机上。下次房里又遇到，TA 开口时记得见过。删掉一条，TA 就当没见过这个人。"),
        ids.length ? ids.map(cid => card([
          label((charsById[cid] && (charsById[cid].remark || charsById[cid].name)) || "已经不在的角色"),
          ...Object.keys(K[cid]).sort((a, b) => (K[cid][b].lastTs || 0) - (K[cid][a].lastTs || 0)).map(key => { const k = K[cid][key];
            return h("div", { key, "data-wk": "nrknown", className: "flex items-start", style: { gap: 10 } },
              h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 } },
                (k.name || "TA") + (k.owner ? "（" + k.owner + " 带来的）" : ""),
                k.note && h("div", { style: { fontSize: fs(12), color: t.fog } }, k.note),
                h("div", { style: { fontSize: fs(11), color: t.fog } }, "一起玩过 " + (k.times || 1) + " 次 · 上次 " + fmt(k.lastTs))),
              h("button", { "data-wk": "nrknowndel", onClick: () => del(cid, key), style: { flexShrink: 0, minHeight: 36, padding: "0 8px", fontFamily: F_BODY, fontSize: fs(12), color: t.fog } }, "删掉"));
          })
        ]))
        : h(Note, { key: "e" }, "还没有。退出房间时勾上「记进 TA 的记忆」，TA 见过的别人家的角色就会记在这儿。")
      ]));
    }
    // 首页
    const supaGuideText = () => guideText("### 连不上房间号时");
    const guideText = head => {
      const m = root.AssistantManual && root.AssistantManual.byId ? root.AssistantManual.byId("netroom") : null;
      if (!m || !m.doc) return root.AssistantManual ? "教程没加载出来，去秋秋攻略里搜「联机」。" : "正在加载教程…";
      const d = String(m.doc), i = d.indexOf(head); if (i < 0) return "教程没找到，去秋秋攻略里搜「联机」。";
      const j = d.indexOf("\n### ", i + 5);
      return d.slice(i, j > 0 ? j : undefined).replace(/^### [^\n]*\n+/, "").replace(/\*\*/g, "").trim();
    };
    // 首页
    // 「怎么弄？一步一步看」：点开就是攻略「联机」里对应那一节（教程只住攻略那一份，这儿切出来摆）
    const guideFold = (key, wk, text) => h("details", { key, "data-wk": wk, onToggle: e => { const d = e.currentTarget; if (d.open && !root.AssistantManual && root.LazyMods) root.LazyMods.load("manual").then(() => setGuideTick(n => n + 1)).catch(() => {}); },
        style: { padding: "10px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2 } },
        h("summary", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, cursor: "pointer", minHeight: 28 } }, "怎么弄？一步一步看"),
        h("div", { "data-wk": wk + "body", style: { fontFamily: F_BODY, fontSize: fs(12), color: t.sub, lineHeight: 1.85, marginTop: 8, whiteSpace: "pre-wrap" } }, text()));
    const supaBox = card([
      h("label", { key: "on", className: "flex items-center", style: { gap: 10, minHeight: 44, opacity: supa ? 1 : 0.45 } },
        h("input", { type: "checkbox", "data-wk": "nrsupaon", disabled: !supa, checked: useSupa, onChange: e => saveSupaOwn({ on: e.target.checked }) }),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, "用自己的 Supabase 递名片")),
      h(Note, { key: "why" }, supa
        ? "房间号进不去（公共中转连不上）时用。只管你开的房：开房后会多一串连接码，整串发给要来的人；加入别人的房不用开它，把连接码整串粘进上面「房间号」那一格就行。"
        : "还没有可用的 Supabase：在下面填一个项目的地址和公开密钥（anon key）就能打开。不会配看秋秋攻略「联机」。"),
      // 跟云同步那页同一个样子：点开就是攻略「联机」里那一节教程，边看边弄（她 11-22：「直接在递 supabase 那一层也写一份」）
      //   教程只住攻略那一份（netroom 条目里「### 连不上房间号时」那一节），这儿切出来摆，不另抄
      guideFold("guide", "nrsupaguide", supaGuideText),
      h("details", { key: "own", "data-wk": "nrsupaown" },
        h("summary", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, minHeight: 36, cursor: "pointer" } }, "联机用的项目（可不填，" + (byoRaw ? "不填就用云同步那个" : "填了才能打开上面的开关") + "）"),
        ["url", "key"].map(k => h("input", { key: k, "data-wk": k === "url" ? "nrsupaurl" : "nrsupakey", defaultValue: supaOwn[k] || "", placeholder: k === "url" ? "https://xxxx.supabase.co" : "公开密钥（anon public key）",
          onBlur: e => saveSupaOwn({ [k]: e.target.value.trim() }),
          style: { width: "100%", marginTop: 6, minHeight: 40, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(12.5) } })),
        supaOwn.key && Core.secretKey(supaOwn.key) && h(Note, { key: "sec" }, "这把是 service key（只能你自己用的那把），不能拿来联机：换成 anon public 那把。"))
    ]);
    // 自己的中转：跟递名片那块同一个样子，填完离开那一格就存
    const turn = supaOwn.turn || {};
    const turnBox = card([
      h("div", { key: "t", style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink } }, "自己的中转" + (Core.cleanTurn(turn) ? "（已填，开房、进房都会用上）" : "")),
      h(Note, { key: "why" }, "进了房间却提示「直连不上」、换网络也不行时用：填好以后两台手机连不通，话就经这台中转转过去，内容照旧加密、中转看不到聊什么。房里有一个人填了就行。"),
      guideFold("guide", "nrturnguide", () => guideText("### 直连不上时：自己的中转")),
      ...[["url", "中转地址（turn: 开头，几条用逗号隔开）", "nrturnurl"], ["user", "用户名", "nrturnuser"], ["pass", "密码", "nrturnpass"]].map(([k, ph, wk]) =>
        h("input", { key: k, "data-wk": wk, defaultValue: turn[k] || "", placeholder: ph, autoCapitalize: "off", autoCorrect: "off", spellCheck: false,
          onBlur: e => saveSupaOwn({ turn: Object.assign({}, supaOwn.turn || {}, { [k]: e.target.value.trim() }) }),
          style: { width: "100%", minHeight: 40, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(12.5) } })),
      h("label", { key: "share", className: "flex items-center", style: { gap: 10, minHeight: 44 } },
        h("input", { type: "checkbox", "data-wk": "nrturnshare", checked: supaOwn.turnShare !== false, onChange: e => saveSupaOwn({ turnShare: e.target.checked }) }),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14) } }, "借给房里的人一起用")),
      h(Note, { key: "sharewhy" }, supaOwn.turnShare !== false
        ? "开着：你跟谁连上了，就把这个中转的地址、用户名、密码悄悄发给她那台，好让房里其他人之间连不通时也能走它。只沿你们俩的加密直连发，不经过公共中转；她那边不显示、不存，退出房间就没了，转话用的是你中转的流量。但真懂行的人能从她手机里翻出来，所以这里别填你别处也在用的密码。"
        : "关着：这个中转只有你自己这台用。房里别人之间连不通，你帮不上。")
    ]);
    const runProbe = async () => { setProbe({ busy: true }); try { setProbe(await Core.probeNet(supaOwn.turn)); } catch (e) { setProbe({ err: true }); } };
    const probeBox = card([
      h("div", { key: "t", className: "flex items-center", style: { gap: 10 } },
        h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: fs(14), color: t.ink } }, "测一下我的网络"),
        h(Btn, { label: probe && probe.busy ? "在测…" : "测一下", onClick: () => !(probe && probe.busy) && runProbe(), wk: "nrprobe" })),
      h(Note, { key: "res" }, !probe ? "几秒钟看看这台能不能直连、填的中转通不通；不连任何人、不花调用。"
        : probe.busy ? "在跟外面要地址，最多等几秒…"
        : probe.err ? "这台浏览器测不了：可能不支持直连，换个浏览器试试。"
        : (probe.out ? "这台能从外面被找到，一般能直连。" : "这台拿不到外面的地址：多半开着梯子，或者这张网拦着直连。关掉梯子、或者换成流量再测一次。")
          + (probe.turn ? (probe.relay ? "中转也通了。" : "填的中转没接通：地址、用户名、密码再对一下，或者中转的流量用完了。") : ""))
    ]);
    // 首页排法（她 11-23「看起来好乱」）：进门的事在最上面；以前的房间、认识的人其次；
    //   递名片那块是房间号连不上才用的，收到最底下折起来（开着自己的 Supabase 时默认展开）
    const rowBtn = (key, wk, onClick, title, meta) => h("button", { key, "data-wk": wk, onClick, className: "active:opacity-70 flex items-center",
      style: { textAlign: "left", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2, padding: "10px 14px", color: t.ink, gap: 10, minHeight: 52 } },
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
        meta && h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, marginTop: 2 } }, meta)),
      h("span", { style: { color: t.fog, fontSize: fs(16) } }, "›"));
    const knownN = (() => { const K = loadKnown(), seen = {}; Object.keys(K).forEach(c => Object.keys(K[c] || {}).forEach(k => { seen[k] = 1; })); return Object.keys(seen).length; })();
    return shell(h(Head, { zh: "联机", onBack: props.onBack }), scroll([
      h(Note, { key: "intro" }, "跟别的手机上的人开一个房间，各带自己的角色进来一起聊。算上你最多四个人，要连的人都得开着这一页。"),
      card([
        h("div", { key: "nk", className: "flex items-center", style: { gap: 10 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.sub, flexShrink: 0 } }, "你在房间里叫"),
          h("input", { "data-wk": "nrnick", value: nick, onChange: e => setNick(e.target.value), maxLength: 20, placeholder: "昵称",
            style: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(14) } })),
        h(Btn, { key: "host", label: "开一个房间", primary: true, onClick: () => start(true), wk: "nrhost" }),
        h("div", { key: "or", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, textAlign: "center" } }, "或者，进朋友开的房间"),
        h("div", { key: "j", className: "flex", style: { gap: 8 } },
          h("input", { "data-wk": "nrjoincode", value: joinCode, onChange: e => { const v = e.target.value.replace(/\s+/g, ""); setJoinCode(/^\d*$/.test(v) ? v.slice(0, 6) : v.slice(0, 3000)); }, placeholder: "房间号", inputMode: "numeric", autoCapitalize: "off", autoCorrect: "off", spellCheck: false,
            style: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: fs(15), letterSpacing: 2 } }),
          h(Btn, { label: "加入", onClick: () => start(false), wk: "nrjoin" })),
        err && h("div", { key: "err", "data-wk": "nrerr", style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 } }, err),
        h(Note, { key: "priv" }, "别人只看得到你带的角色的名字和头像，人设、记忆、世界书不出你的手机；聊天记录每人各存一份。")
      ]),
      label("以前的房间"),
      rooms.length ? rooms.map(r => rowBtn(r.id, "nrhist", () => { setViewId(r.id); setPage("view"); }, withWhom(r) + " · 房间 " + r.code, fmt(r.startedAt) + " · " + (r.msgs || []).length + " 条"))
        : h(Note, { key: "none" }, "还没开过房间。"),
      rowBtn("kn", "nrknownopen", () => setPage("known"), "在联机里认识的人", knownN ? knownN + " 位别人家的角色" : "退房时记进记忆的角色，会记下在房里见过谁"),
      h("details", { key: "supa", "data-wk": "nrsupafold", open: (useSupa || !!Core.cleanTurn(supaOwn.turn)) || undefined, style: { marginTop: 6 } },
        h("summary", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.sub, minHeight: 36, cursor: "pointer" } }, "连不上的时候" + ([Core.cleanTurn(supaOwn.turn) && "正在用自己的中转", useSupa && "正在用自己的 Supabase"].filter(Boolean).length ? "（" + [Core.cleanTurn(supaOwn.turn) && "正在用自己的中转", useSupa && "正在用自己的 Supabase"].filter(Boolean).join("、") + "）" : "")),
        h("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 10 } }, probeBox, turnBox, supaBox))
    ]));
  }
  if (typeof window !== "undefined") window.NetRoomApp = NetRoomApp;
})(typeof window !== "undefined" ? window : globalThis);
