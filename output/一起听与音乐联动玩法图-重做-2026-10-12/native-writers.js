window.__nativeMusic = function(env){
const {listenRef,listen,setListen,saveJSON,setCoupleDisc,coupleDiscRef,playerSongIdRef,audioElRef,roomMusicRef,setPlayer,playSong,stopPlayer,stepSong,goListen,musicReady,musicProvider,musicRequest,neteaseTrackInfo,active,ctxFor,toast,setGen,pChat,notifyApp}=env;
const taSwitchSong = async songSwitch => {
    const want = String(songSwitch).trim();
    if (/下一首|下首|next/i.test(want)) stepSong(1);
    else if (/上一首|上首|prev/i.test(want)) stepSong(-1);
    else {
      const _L = listenRef.current || {};
      const lib = (_L.songs || []).concat((_L.playlists || []).reduce((a, pl) => a.concat(pl.songs || []), [])); // 搜主库+所有歌单
      const hit = lib.find(s => s.title && (s.title === want || s.title.includes(want) || want.includes(s.title))) || null;
      if (hit) playSong(hit.id);
      else if (musicReady) { // 歌单里没有→去网易云搜来放（她 2026-07-13 想要的"TA自己搜歌"，做靠谱）
        try { const s = await neteaseSearchOne(want, { throwOnError: true }); if (s) playSong(resultToSong(neteaseTrackInfo(s))); else toast("网易云也没搜到《" + want + "》"); } catch (e) { toast("搜歌失败：" + (e.message || "")); }
      }
      else toast("没找到《" + want + "》这首歌");
    }
  };
const saveListen = updater => {
    // 播放器会在同一个点击事件里连续执行「写入整批队列 → 立即播放第一首」。
    // 只用 setState functional updater 时，React 要到下一次 render 才刷新 listenRef；
    // 第一首能靠传入的 song 对象播放，但下一首解析时可能看不见 nowBatch，队列就塌回单曲。
    // 因此先同步提交 ref，再更新 UI / 持久化：音频控制链当下就能读到完整队列。
    const prev = listenRef.current || listen || {};
    const n = typeof updater === "function" ? updater(prev) : updater;
    listenRef.current = n;
    setListen(n);
    saveJSON("x_listen", n);
    return n;
  };
const resolveSong = id => {
    if (id === KEEPALIVE_ID) return KEEPALIVE_SONG;
    const L = listenRef.current || {};
    if (L.nowSong && L.nowSong.id === id) return L.nowSong;
    // 云村「播放全部」的当前批次（日推/网易云歌单整单连播），不进「全部」库
    const b = (L.nowBatch || []).find(x => x.id === id);
    if (b) return b;
    let s = (L.songs || []).find(x => x.id === id);
    if (s) return s;
    for (const pl of (L.playlists || [])) { const f = (pl.songs || []).find(x => x.id === id); if (f) return f; }
    return null;
  };
const patchSongEverywhere = (id, patch) => saveListen(p => ({
    ...p,
    songs: (p.songs || []).map(s => s.id === id ? { ...s, ...patch } : s),
    playlists: (p.playlists || []).map(pl => ({ ...pl, songs: (pl.songs || []).map(s => s.id === id ? { ...s, ...patch } : s) })),
    nowSong: p.nowSong && p.nowSong.id === id ? { ...p.nowSong, ...patch } : p.nowSong
  }));
const toggleFav = id => {
    const s = resolveSong(id);
    const nowFav = !(s && s.fav);
    const inLib = (listenRef.current.songs || []).some(x => x.id === id);
    // 收藏一首还没进库的歌（搜索结果直接播的只暂存在 nowSong、不在 songs 里）→ 顺手加进「全部」，
    // 否则收藏列表(favs=songs.filter(fav))看不到它、且 nowSong 是临时的换首歌就丢了
    if (nowFav && !inLib && s) {
      saveListen(p => ({
        ...p,
        songs: [{ ...s, fav: true }, ...(p.songs || [])],
        nowSong: (p.nowSong && p.nowSong.id === id) ? { ...p.nowSong, fav: true } : p.nowSong
      }));
      return;
    }
    patchSongEverywhere(id, { fav: nowFav });
  };
const cyclePlayMode = () => saveListen(p => { const order = ["order", "one", "shuffle"]; const cur = p.playMode || "order"; return { ...p, playMode: order[(order.indexOf(cur) + 1) % 3] }; });
const cloneSong = s => ({ ...s, id: (s.id || "sg_") + "_pl" + Math.random().toString(36).slice(2, 6) });
const createPlaylist = (name, songObjs, extra) => { const id = "pl_" + Date.now(); saveListen(p => ({ ...p, playlists: [{ id, name: (name || "新歌单").trim() || "新歌单", songs: (songObjs || []).map(cloneSong), ts: Date.now(), ...(extra || {}) }, ...(p.playlists || [])] })); return id; };
const deletePlaylist = id => saveListen(p => ({ ...p, playlists: (p.playlists || []).filter(x => x.id !== id) }));
const renamePlaylist = (id, name) => { const nm = (name || "").trim(); if (nm) saveListen(p => ({ ...p, playlists: (p.playlists || []).map(x => x.id === id ? { ...x, name: nm } : x) })); };
const addToPlaylist = (plId, song) => { if (!song) return; saveListen(p => ({ ...p, playlists: (p.playlists || []).map(pl => pl.id === plId ? ((pl.songs || []).some(s => (song.neteaseId && s.neteaseId === song.neteaseId) || s.id === song.id) ? pl : { ...pl, songs: [...(pl.songs || []), cloneSong(song)] }) : pl) })); toast("已加入歌单"); };
const removeFromPlaylist = (plId, songId) => saveListen(p => ({ ...p, playlists: (p.playlists || []).map(pl => pl.id === plId ? { ...pl, songs: (pl.songs || []).filter(s => s.id !== songId) } : pl) }));
const acceptListenInvite = async (charId, songTitle) => {
    setListenPartner(charId);
    const tt = (songTitle || "").trim();
    if (tt) {
      const lib = listenRef.current.songs || [];
      let hit = lib.find(s => s.title && (s.title === tt || s.title.includes(tt) || tt.includes(s.title)));
      if (hit) playSong(hit.id);
      else if (musicReady) {
        try { const s = await neteaseSearchOne(tt, { cacheBust: false }); if (s) playSong(resultToSong(neteaseTrackInfo(s))); } catch (e) {}
      }
    }
    goListen();
  };
const setListenPartner = charId => saveListen(p => ({ ...p, partnerId: charId }));
const resultToSong = s => ({ id: "sg_" + Date.now() + "_" + s.id + "_" + Math.random().toString(36).slice(2, 5), source: "netease", neteaseId: String(s.id), title: s.name || ("网易云 " + s.id), artist: s.artist || "", cover: s.cover || null, gdPicId: s.gdPicId, gdLyricId: s.gdLyricId, ts: Date.now() });
const addNeteaseResult = s => saveListen(p => ({ ...p, songs: [resultToSong(s), ...(p.songs || []).filter(x => x.neteaseId !== String(s.id))].slice(0, 60) }));
const addResultToPlaylist = (plId, s) => addToPlaylist(plId, resultToSong(s));
const playNeteaseResult = s => playSong(resultToSong(s));
const playNeteaseList = list => {
    const rows = (list || []).filter(s => s && s.id);
    if (!rows.length) return;
    const ss = rows.map(s => ({ ...resultToSong(s), id: "sgn_" + s.id }));
    // 「播放全部」表达的是从头开始连播整张列表。若保留上一次的单曲循环模式，
    // 队列虽然完整，ended 仍会重播第一首，用户看到的就像「播放全部」坏了。
    saveListen(p => ({ ...p, nowBatch: ss, playMode: "order" }));
    playSong(ss[0], ss.map(x => x.id));
  };
const saveCoupleDisc = fn => setCoupleDisc(prev => { const n = fn(coupleDiscRef.current || prev); coupleDiscRef.current = n; saveJSON("x_coupleDisc", n); return n; });
const discSongsOf = cid => (((coupleDiscRef.current || {})[cid] || {}).songs || []);
const discAdd = async (cid, query, note) => {
    if (!musicReady) { toast("先在一起听里选择音乐源"); return false; }
    try {
      const sr = await neteaseSearchOne(query, { throwOnError: true });
      if (!sr) { toast("云村没搜到这首"); return false; }
      const info = neteaseTrackInfo(sr);
      const song = { id: "sgd_" + sr.id, source: "netease", neteaseId: String(sr.id), title: sr.name, artist: info.artist, cover: info.cover || null, gdPicId: info.gdPicId, gdLyricId: info.gdLyricId, by: "me", note: String(note || "").trim(), ts: Date.now() };
      saveCoupleDisc(pp => { const cur = pp[cid] || {}; return { ...pp, [cid]: { ...cur, songs: [song, ...(cur.songs || []).filter(x => x.neteaseId !== song.neteaseId)].slice(0, 30) } }; });
      // ⚠️返回【刻好的那一首】而不是 true：聊天里那张卡要显示云村搜到的真歌名和歌手，
      //   不能把模型写的那串搜索词原样贴上去（那多半是「歌名 歌手」拼一起的）。
      //   老调用点判的是真假，对象照样是真。
      return song;
    } catch (e) { toast("搜歌失败：" + (e.message || "")); return false; }
  };
const discSetNote = (cid, id, note) => saveCoupleDisc(pp => { const cur = pp[cid] || {}; return { ...pp, [cid]: { ...cur, songs: (cur.songs || []).map(x => x.id === id ? { ...x, note: String(note || "").trim() } : x) } }; });
const discRemove = (cid, id) => saveCoupleDisc(pp => { const cur = pp[cid] || {}; return { ...pp, [cid]: { ...cur, songs: (cur.songs || []).filter(x => x.id !== id) } }; });
const discPlay = (cid, fromId) => {
    const ss = discSongsOf(cid); if (!ss.length) return;
    let i = 0;
    if (fromId) { const k = ss.findIndex(x => x.id === fromId); if (k >= 0) i = k; }
    saveListen(pp => ({ ...pp, nowBatch: ss.map(x => ({ ...x })), playMode: "order" }));
    playSong(ss[i], ss.map(x => x.id));
  };
const discNextId = cid => {
    const ss = discSongsOf(cid); if (!ss.length) return null;
    const last = ((coupleDiscRef.current || {})[cid] || {}).lastId;
    const k = last ? ss.findIndex(x => x.id === last) : -1;
    return ss[k < 0 ? 0 : (k + 1) % ss.length].id;
  };
const discEnter = cid => {
    // 唱片是空的也要进这道门：不落针，但把她原来那首记下来（见 roomMusicEnter 上面那段）。
    // 她在空间里刻一首、放起来，出门时那首才还得回去。
    const has = discSongsOf(cid).length;
    roomMusicEnter(discSpinning, has ? () => discPlay(cid, discNextId(cid)) : null);  // 接着上次那首往下放
  };
const discLeave = () => roomMusicLeave(discSpinning);
const discSpinning = () => String(playerSongIdRef.current || "").indexOf("sgd_") === 0;
const roomMusicEnter = (isMine, play) => {
    if (isMine()) return;                     // 已经在放这一层的歌了，别打断
    const prevId = playerSongIdRef.current;
    const el = audioElRef.current;
    // ⚠️静音保活那首也要还：它占着 iOS 的音频会话，被顺手停掉＝后台保活断了。
    //   它本来就是「像歌一样播的一段静音」，playSong(KEEPALIVE_ID) 走的是同一条路。
    roomMusicRef.current = (prevId && resolveSong(prevId)) ? {
      id: prevId,
      queue: (((listenRef.current || {}).nowQueue) || []).slice(),
      t: (el && el.currentTime) || 0,
      playing: !!(el && !el.paused)
    } : null;
    if (typeof play === "function") play();
  };
const roomMusicLeave = async isMine => {
    if (!isMine()) { roomMusicRef.current = null; return; }  // 这一层压根没落针：她自己的歌照放，别动
    const prev = roomMusicRef.current;
    roomMusicRef.current = null;
    // 进来前本来就没在放 → 停干净（她说的「出来音乐会停，这个确实要这样」）
    if (!prev || !resolveSong(prev.id)) { stopPlayer(); return; }
    // 有得还就直接换回去，不先 stopPlayer——那会让播放器闪一下没影
    await playSong(prev.id, prev.queue.length ? prev.queue : undefined);
    const el2 = audioElRef.current;
    if (!el2) return;
    if (prev.t > 1) { try { el2.currentTime = prev.t; } catch (e) {} }   // 还回原来那个位置
    if (!prev.playing) { el2.pause(); setPlayer(p => ({ ...p, playing: false })); } // 原来是暂停的就还它一个暂停
  };
const phonePlaylistOf = cid => ((listenRef.current || {}).playlists || []).find(x => x && x.charId === cid) || null;
const phoneMusicMine = cid => () => {
    const cur = playerSongIdRef.current;
    if (!cur) return false;
    const pl = phonePlaylistOf(cid);
    return !!(pl && (pl.songs || []).some(x => x && x.id === cur));
  };
const phoneMusicNextId = cid => {
    const pl = phonePlaylistOf(cid);
    const ss = (pl && pl.songs) || [];
    if (!ss.length) return null;
    const k = ss.findIndex(x => x && x.id === (pl.lastId || ""));
    return ss[k < 0 ? 0 : (k + 1) % ss.length].id;
  };
const phoneMusicEnter = cid => {
    const pl = phonePlaylistOf(cid);
    const ss = (pl && pl.songs) || [];
    // ⚠️TA那张歌单还没刷出来时同理（唱片那边一模一样的形状，所以一起改——
    //   施工规则/one-public-mechanism.md：已有的那几处也要搬过去）：
    //   她在TA手机里刷出一张歌单、点开一首，出门那一下才还得回她自己的歌。
    const from = ss.length ? phoneMusicNextId(cid) : null;
    roomMusicEnter(phoneMusicMine(cid), from ? () => playSong(from, ss.map(x => x.id)) : null);
  };
const phoneMusicLeave = cid => roomMusicLeave(phoneMusicMine(cid));
const parseSongWants = rec => {
    let raw = rec && Array.isArray(rec.songs) ? rec.songs : Array.isArray(rec) ? rec : (rec && (rec.list || rec.data || rec.result || rec.tracks)) || [];
    return (Array.isArray(raw) ? raw : []).map(w => {
      if (typeof w === "string") { const parts = w.replace(/^\d+[.、)\s]+/, "").split(/\s*[-–—/]\s*/); return { title: (parts[0] || "").replace(/^《|》$/g, "").trim(), artist: (parts[1] || "").trim(), note: "" }; }
      return {
        title: String((w && (w.title || w.name || w.song)) || "").trim(),
        artist: String((w && (w.artist || w.singer || w.by)) || "").trim(),
        note: String((w && (w.note || w.thought || w.why || w.mood)) || "").replace(/\s+/g, " ").trim()
      };
    }).filter(s2 => s2.title);
  };
const neteaseSearchOne = async (kw, { throwOnError = false, cacheBust = true } = {}) => {
    try {
      const d = await musicRequest("/search?keywords=" + encodeURIComponent(kw) + "&limit=1", { cacheBust });
      return (d && d.result && d.result.songs && d.result.songs[0]) || null;
    } catch (e) { if (throwOnError || musicProvider === "gd") throw e; return null; }
  };
const collectRealSongs = async ({ probeOnce, existingIds, mkId, target, cap, rounds }) => {
    const have = existingIds || new Set();
    const wants = [], added = [];
    const seenTitle = new Set(), tried = new Set();
    let miss = 0, dup = 0;
    for (let round = 1; round <= (rounds || 3) && added.length < target; round++) {
      const got = await probeOnce(round === 1 ? "" : "\n【上一轮只凑到 " + added.length + " 首】其中有些歌搜不到、有些和已有的重了。这轮换一批【更好搜、更主流平台上确实有】的歌，别再给上面那些。");
      got.forEach(w => { const k = w.title.toLowerCase(); if (!seenTitle.has(k)) { seenTitle.add(k); wants.push(w); } });
      for (const w of wants) {
        if (added.length >= cap) break;
        const k = w.title.toLowerCase();
        if (tried.has(k)) continue;
        tried.add(k);
        let hit = await neteaseSearchOne((w.title + " " + (w.artist || "")).trim());
        if (!hit) hit = await neteaseSearchOne(w.title); // 带歌手搜不到 → 只用歌名再试
        if (!hit) { miss++; continue; }
        const nid = String(hit.id);
        if (added.some(a => a.neteaseId === nid) || have.has(nid)) { dup++; continue; }
        const info = neteaseTrackInfo(hit);
        const cover = info.cover || null;
        const artist = info.artist || (w.artist || "");
        added.push({ id: mkId(nid), source: "netease", neteaseId: nid, title: hit.name || w.title, artist, cover, gdPicId: info.gdPicId, gdLyricId: info.gdLyricId, note: w.note || "", ts: Date.now() });
      }
    }
    return { wants, added, miss, dup };
  };
const genCharPlaylist = async char => {
    if (!char) return;
    if (!active) { toast("请先到设置配置 API"); return; }
    if (!musicReady) { toast("先在一起听里选择音乐源"); return; }
    setGen(g => ({ ...g, charPlaylist: char.id }));
    try {
      // 已有歌单：新生成【往里加】不覆盖、跳过重复。先拿到已有的歌，既让模型别再推、也在入库时去重。
      const existingPl = (listenRef.current.playlists || []).find(x => x.charId === char.id);
      const existingSongs = (existingPl && existingPl.songs) || [];
      const existingIds = new Set(existingSongs.map(s => s.neteaseId).filter(Boolean));
      const existingTitles = existingSongs.map(s => s.title).filter(Boolean);
      const avoidStr = existingTitles.length ? "\n**这张歌单里已经有这些歌了，别再推荐它们、也别推重复的，给全新的：** " + existingTitles.slice(0, 50).join("、") : "";
      // 用干净上下文：去掉手机在听/最近听歌/朋友圈等会污染推荐的字段（否则角色只会照抄用户刚搜的、或查手机里那两首）
      const cleanCtx = Object.assign({}, ctxFor(char), { listenLog: "", nowPlaying: "", momentLog: "", forumEcho: "", giftLog: "", recentChat: "" });
      const probeOnce = async nudge => {
        try {
          const rec = await runProbe(active, cleanCtx, {
            voice: true,
            instruction: "你是「" + char.name + "」。**完全按你自己的人设、成长背景、性格和音乐口味**，一次性列出 **18 首**你自己私下真会单曲循环、真实存在、能在主流平台搜到的歌（华语/欧美/日韩都行，别编造不存在的歌，风格可多样）。**别照抄任何你手机里在听/最近听过/用户刚搜过或已有的歌，要发自内心喜欢的。songs 数组必须给满 18 个元素，给少了这次就白跑了。**\n每首还要写一句 note：**这一首对你意味着什么**。第一人称，你自己的口气。\n【形状必须散开，不许套模板】她 2026-08-29 报「备注有点不自然」——上一版全都写成「……的时候」，十九条一个句式，等于一条都没写。所以：**绝对不许每条都用「……的时候」「……时」收尾，全篇这种收尾最多两条**。有的写一个具体场景，有的写一句评价，有的写一个突然冒出来的念头，有的是抱怨，有的只有三五个字（「循环了一个月。」「不知道为什么。」「难听，但戒不掉。」），有的是半句没说完的话。长短要差得很开。\n【这不是恋爱歌单】**大多数歌跟用户没有关系**。你自己的活计、旧事、烦躁、无聊、走过的某段路、某个早就不联系的人，都可以占满一首歌。全部歌里提到用户的最多三四首，别每首都往那儿绕。\n【写的是你，不是歌】不要评价旋律、编曲、歌词写得多好，也不要写「这首歌很治愈/很有力量/让我想起某段时光」这种谁都能说的话。换个角色还说得通的 note 就是写坏了。" + avoidStr + (nudge || "") + " 别写序号别写解释。",
            schemaHint: "{\"songs\":[{\"title\":\"某首歌\",\"artist\":\"某歌手\",\"note\":\"第一人称一句，长短形状各不相同\"}]}（songs 必须 18 个元素）", maxTokens: (window.StylePresets && window.StylePresets.OUT_CEILING) || 65000
          });
          return parseSongWants(rec);
        } catch (e) { return []; }
      };
      // 这条漏斗跟情侣唱片共用（见 collectRealSongs）：不够就再要一轮，且只搜没试过的候选
      const TARGET = 12;
      const { wants, added, miss, dup } = await collectRealSongs({ probeOnce, existingIds, mkId: nid => "sg_" + Date.now() + "_" + nid, target: TARGET, cap: 16, rounds: 3 });
      if (!wants.length) { toast("没生成出歌，重试下"); return; }
      if (!added.length) { toast("这轮 " + wants.length + " 首网易云一首都没搜到（换个接口或稍后再试）"); return; }
      // 往已有歌单里【追加】新歌、按 neteaseId + 歌名歌手去重；没有就新建
      let freshCount = 0;
      saveListen(p => {
        const pls = p.playlists || [];
        const existing = pls.find(x => x.charId === char.id);
        if (existing) {
          const haveIds = new Set((existing.songs || []).map(s => s.neteaseId).filter(Boolean));
          const haveKeys = new Set((existing.songs || []).map(s => (String(s.title) + "|" + String(s.artist)).toLowerCase()));
          const fresh = added.filter(s => !(s.neteaseId && haveIds.has(s.neteaseId)) && !haveKeys.has((String(s.title) + "|" + String(s.artist)).toLowerCase()));
          freshCount = fresh.length;
          const merged = Object.assign({}, existing, { songs: [...(existing.songs || []), ...fresh], cover: existing.cover || (added[0] && added[0].cover) || null, ts: Date.now() });
          return { ...p, playlists: [merged, ...pls.filter(x => x.charId !== char.id)] };
        }
        freshCount = added.length;
        return { ...p, playlists: [{ id: "pl_" + Date.now(), name: char.name + "的歌单", charId: char.id, cover: added[0].cover || null, songs: added, ts: Date.now() }, ...pls] };
      });
      // 没凑够就明说没凑够、以及卡在哪一道（搜不到 / 已经有了），
      // 别报一个「好了」让她以为这就是全部（版本号铁律 0 的同一条：只报真实发生的事）
      const shortNote = added.length < TARGET
        ? "（只凑到 " + added.length + " 首" + [miss ? "网易云搜不到 " + miss + " 首" : "", dup ? "重复 " + dup + " 首" : ""].filter(Boolean).map(x => "，" + x).join("") + "，再点一次可以继续加）"
        : "";
      if (!existingSongs.length) toast(char.name + " 的歌单好了 · " + added.length + " 首" + shortNote);
      else if (freshCount) toast("给 " + char.name + " 的歌单又添了 " + freshCount + " 首" + (added.length - freshCount > 0 ? "（跳过 " + (added.length - freshCount) + " 首重复）" : shortNote));
      else toast("这轮推的歌都已经在歌单里了，没新增");
    } catch (e) { toast("生成失败：" + (e.message || "重试")); }
    finally { setGen(g => ({ ...g, charPlaylist: null })); }
  };
const genCoupleDisc = async char => {
    if (!char) return;
    if (!active) { toast("请先到设置配置 API"); return; }
    if (!musicReady) { toast("先在一起听里选择音乐源"); return; }
    setGen(g => ({ ...g, coupleDisc: char.id }));
    try {
      const existing = discSongsOf(char.id);
      const existingIds = new Set(existing.map(s => s.neteaseId).filter(Boolean));
      const avoidStr = existing.length ? "\n**这张唱片上已经有这些了，别再给、也别给重复的：** " + existing.map(s => s.title).filter(Boolean).slice(0, 40).join("、") : "";
      const cleanCtx = Object.assign({}, ctxFor(char), { listenLog: "", nowPlaying: "", momentLog: "", forumEcho: "", giftLog: "" });
      const probeOnce = async nudge => {
        try {
          const rec = await runProbe(active, cleanCtx, {
            voice: true,
            instruction: "你是「" + char.name + "」。你和用户是恋人，你们有一张【我们的唱片】——你亲手往上刻歌，进这个空间它就会自己响起来。\n一次性列出 **14 首**你真会放给你们俩听的、**真实存在、主流平台搜得到**的歌（华语/欧美/日韩都行，别编造）。songs 必须给满 14 个元素。\n【这张不是你自己的歌单】它是放给你们俩的：有的是你想让 TA 听见的，有的是某件事之后你才开始循环的，有的只是 TA 在旁边时你会顺手放的。**但也不许十四首全是情歌**——你们相处里有安静的、无聊的、闹的、赌气的、天快亮的时候，那些也该有各自的歌。曲风别一路到底，快慢冷暖要拉开。\n每首写一句 note，刻在这张唱片的 B 面：**为什么是这首**。第一人称，说给 TA 听，不是写乐评。\n【怎么算写对了】：\n· 说的是你和 TA 之间的某件具体的事、某个时刻、某个你没讲出口的念头，不是这首歌本身好在哪；\n· **换一对情侣、换一个角色照样成立的那一句，就是写坏了**；\n· 十四条的句式必须散开——长短差得开，有的很短，有的没说完，有的是问句，有的是抱怨，有的干脆答非所问。**同一个句式全篇最多两条**；\n· 不许出现「治愈」「温暖」「陪伴」「岁月」这类谁都能说的词。" + avoidStr + (nudge || "") + " 别写序号别写解释。",
            schemaHint: "{\"songs\":[{\"title\":\"歌名\",\"artist\":\"歌手\",\"note\":\"第一人称一句，说给 TA 听\"}]}（songs 必须 14 个元素）",
            maxTokens: (window.StylePresets && window.StylePresets.OUT_CEILING) || 65000
          });
          return parseSongWants(rec);
        } catch (e) { return []; }
      };
      // id 一律 sgd_ 开头——离开空间时靠这个前缀认出「现在放的是不是唱片」
      const { wants, added, miss, dup } = await collectRealSongs({ probeOnce, existingIds, mkId: nid => "sgd_" + nid, target: 10, cap: 14, rounds: 3 });
      if (!wants.length) { toast("没生成出歌，重试下"); return; }
      if (!added.length) { toast("这轮 " + wants.length + " 首网易云一首都没搜到（换个接口或稍后再试）"); return; }
      const stamped = added.map(x => Object.assign({}, x, { by: "ta" }));
      saveCoupleDisc(pp => {
        const cur = pp[char.id] || {};
        const old = cur.songs || [];
        const haveIds = new Set(old.map(s => s.neteaseId).filter(Boolean));
        const fresh = stamped.filter(s2 => !(s2.neteaseId && haveIds.has(s2.neteaseId)));
        return Object.assign({}, pp, { [char.id]: Object.assign({}, cur, { songs: [...old, ...fresh].slice(0, 30) }) });
      });
      const shortNote = added.length < 10
        ? "（只凑到 " + added.length + " 首" + [miss ? "网易云搜不到 " + miss + " 首" : "", dup ? "重复 " + dup + " 首" : ""].filter(Boolean).map(x => "，" + x).join("") + "，再点一次可以继续刻）"
        : "";
      toast(char.name + " 往唱片上刻了 " + added.length + " 首" + shortNote);
    } catch (e) { toast("生成失败：" + (e.message || "重试")); }
    finally { setGen(g => ({ ...g, coupleDisc: null })); }
  };
const phonePeekTag = (tier, what, hiddenWhat) => ({
    given: "｜（这是TA自己给她的，她现在拿来跟你说。**不是她翻到的、也不是她打听来的**，别往「被撞破」或者「你怎么知道」那边演。按你当初给出去时的心思接。）",
    open: "｜（这东西TA本来就没瞒着你，就当她随口提起。）",
    quiet: "｜（**TA没告诉过你这个，是她自己翻你" + what + "翻到的。**TA此刻在意的多半不是这条内容本身，而是「她翻过我" + what + "、还翻到了这里」。不动声色、笑着揭过去、反问她还看了什么、恼、或者干脆坦白——按你的人设和你俩现在的关系来，别一上来就配合地把内容解释一遍。）",
    hidden: "｜（**这是TA藏起来的东西**：" + (hiddenWhat || "匿名的／小号的／深夜的／删掉的／设了私密的") + "。TA从没打算让任何人看到，尤其是她。现在被摆到台面上了。**这一刻发生的不是「她问了个问题」，是「TA被撞破了」。**你有权不答、反问、翻脸、装作没听懂，也有权承认；唯独不许像客服一样顺从地解释一遍。）"
  }[tier]);
const forwardPhonePeekToChat = (char, peek) => {
    if (!char || !peek) return;
    const tier = ["given", "open", "quiet", "hidden"].includes(peek.tier) ? peek.tier : "quiet";
    const label = String(peek.label || "手机");
    const what = String(peek.what || "手机");
    // ⚠️原来这儿是 title 60 字、正文 300 字，硬切、连个省略号都不给
    //   （她 2026-09-22：「便签也能字数多一点对吧，不然被截断」）。
    //   一条便签、一段批注本来就可能上千字，摆到 TA 面前却断在半句上——
    //   TA 看到的也是断的，于是接话接得莫名其妙。这是一条消息的量，不缺这点预算。
    const cut = (v, n) => { const x = String(v || "").replace(/\s+/g, " ").trim(); return x.length > n ? x.slice(0, n) + "…（后面还有）" : x; };
    const title = cut(peek.title, 120);
    const text = cut(peek.text, 3000);
    const lead = String(peek.lead || ("[我翻了你的手机]在你的〈" + label + "〉里看到了："));
    pChat(char.id, p => [...p, {
      role: "user", kind: "phonepeek",
      peek: { label, title, text, tier, what },
      content: lead + (title ? "《" + title + "》" : "") + (text ? (title ? "｜" : "") + text : "") + phonePeekTag(tier, what, peek.hiddenWhat),
      ts: Date.now(), read: false
    }]);
    toast("已摆到 " + (char.remark || char.name) + characterText(char, " 面前（他会知道你翻了他的") + what + "）");
  };
const onToChat=(charId, rows) => pChat(charId, p => [...p, ...rows.map(r => ({ role: r.role, content: r.content, ts: r.ts, read: true, via: "listen", listenSong: r.song || "" }))]);
const applyParsed=async(parsed,char)=>{const charId=char.id,chatKey=charId,turnId="demo-turn",isCouple=true;let delivered=false;
if (parsed.songSwitch && String(parsed.songSwitch).toLowerCase() !== "null") await taSwitchSong(parsed.songSwitch);
if (parsed.listenInvite && typeof parsed.listenInvite === "object" && (parsed.listenInvite.song || parsed.listenInvite.say)) {
        const inv = parsed.listenInvite;
        pChat(chatKey, p => [...p, { role: "assistant", kind: "listeninvite", turnId: "li_" + Date.now(), song: inv.song ? String(inv.song).trim() : "", say: inv.say ? String(inv.say).trim() : "", content: "[一起听邀请]" + (inv.say ? " " + inv.say : ""), ts: Date.now(), read: false }]);
        delivered = true;
      }
if (parsed.carve && typeof parsed.carve === "object" && isCouple && musicReady) {
        const _q = String(parsed.carve.song || "").trim();
        const _note = String(parsed.carve.note || "").trim();
        if (_q) {
          try {
            const _sg = await discAdd(charId, _q, _note);
            if (_sg) {
              pChat(chatKey, p => [...p, { role: "system", kind: "carved", charId: charId,
                title: _sg.title, artist: _sg.artist, cover: _sg.cover || "", note: _note,
                ts: Date.now(), turnId }]);
              delivered = true;
              notifyApp("us");
              if (window.Notify) window.Notify.push({ title: char.name + " 刻了一首歌给你",
                body: _sg.title + (_sg.artist ? " · " + _sg.artist : ""), tag: "carve-" + charId, charId: charId });
            }
          } catch (e) {/* 刻不上不连累这一轮回复 */}
        }
      }
return delivered;};
return {taSwitchSong,saveListen,resolveSong,patchSongEverywhere,toggleFav,cyclePlayMode,cloneSong,createPlaylist,deletePlaylist,renamePlaylist,addToPlaylist,removeFromPlaylist,acceptListenInvite,setListenPartner,resultToSong,addNeteaseResult,addResultToPlaylist,playNeteaseResult,playNeteaseList,saveCoupleDisc,discSongsOf,discAdd,discSetNote,discRemove,discPlay,discNextId,discEnter,discLeave,discSpinning,roomMusicEnter,roomMusicLeave,phonePlaylistOf,phoneMusicMine,phoneMusicNextId,phoneMusicEnter,phoneMusicLeave,parseSongWants,neteaseSearchOne,collectRealSongs,genCharPlaylist,genCoupleDisc,phonePeekTag,forwardPhonePeekToChat,onToChat,applyParsed};
};
