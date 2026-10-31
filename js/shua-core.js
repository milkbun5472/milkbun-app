// 片刻的开机那半（2026-10-18 瘦身第八批，从 js/shua.js 拆出来）：聊天里刷到视频甩给她（ShuaKit）、聊天里那张视频卡（ShuaShareCard）、
//   主屏图标（GShua），这些开机就要。片刻整页在 js/shua.js，点进去才加载（js/lazy-mods.js）。
// ============================================================
// 片刻（原名刷刷，key 仍是 shua）—— 视频 app（她 2026-10-07：「整体做抖音界面，直播做其中一个板块」）
//   · 底栏五格：首页 / 直播 / ＋ / 消息 / 我。直播那一格就是 js/live.js 那个直播间，原样搬进来。
//   · 首页竖着一条一条往上刷。没有真视频：每条是「镜头里拍了什么」＋文案，点「画出来」才生图。
//   · 刷新跟论坛一样两颗：「刷几条路人的」「请TA们发」——后一颗能挑刷谁的。
//   · 「关注」只看她的人发的，「推荐」全混在一起。
//   · 不叫抖音：不冒用人家的牌子（名字只写在 APP_NAME 这一处）。她 2026-10-07 要个跟视频沾边的名字 → 「片刻」。
//   · 两套皮（她 2026-10-07：「跟论坛一样搞两套皮肤，切换了可以变成b站」）：竖屏（一条一条往上刷）／横屏（双列封面、
//     点进去是带弹幕的播放页）。跟论坛单列双列同一个道理：两种是两套视频，各刷各的，切过去是另一套，切回来原来的都在。
//     开关放在「我」里（论坛 2026-10-07 也是这么放的）。
// 存 x_shua（DURABLE_TEXT_KEYS，进 IDB）。
// ============================================================
(function () {
  const APP_NAME = "片刻";
  const INK = "#fff", DIM = "rgba(255,255,255,.66)", BLACK = "#0b0b0e", RED = "#fe2c55", LINE = "rgba(255,255,255,.14)";
  // 两套皮各一份颜色：竖屏是黑底红，横屏是白底粉。外面那几页（刷新／发一条／消息／我）跟着走
  const PAL = {
    v: { bg: BLACK, ink: INK, dim: DIM, line: LINE, accent: RED, field: "rgba(255,255,255,.06)", card: "#16161b", glow: "rgba(254,44,85,.22)" },
    b: { bg: "#f4f5f7", ink: "#18191c", dim: "#9499a0", line: "rgba(0,0,0,.08)", accent: "#fb7299", field: "#fff", card: "#fff", glow: "rgba(251,114,153,.18)" }
  };
  const vidSkin = v => v && v.skin === "b" ? "b" : "v";

  window.GShua = p => h(Svg, p,
    h("rect", { x: 5, y: 3, width: 14, height: 18, rx: 3 }),
    h("path", { d: "M10.5 9.2v5.6l4.4-2.8z" }));

  const S = v => String(v == null ? "" : v).trim();
  const arr = v => Array.isArray(v) ? v : [];
  const uid = p => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  const fmtN = n => { n = Number(n) || 0; return n >= 10000 ? (Math.round(n / 1000) / 10) + "w" : String(n); };
  const normWho = w => ["self", "part", "none"].indexOf(S(w)) >= 0 ? S(w) : "none";
  const normComments = (v, by) => arr(v).map(c => c && typeof c === "object" ? { id: uid("cm"), name: S(c.name).slice(0, 20), text: S(c.text).slice(0, 300), by: by || "npc", ts: Date.now() } : null)
    .filter(c => c && c.name && c.text).slice(0, 8);
  const normTags = v => arr(v).map(x => S(x).replace(/^#/, "").slice(0, 16)).filter(Boolean).slice(0, 4);
  // 一条视频的骨架：几种来源最后都长成这一个样子，界面只认这一份
  const mkVideo = (d, extra) => Object.assign({
    id: uid("sv"), scene: S(d.scene).slice(0, 600), who: normWho(d.who), caption: S(d.caption).slice(0, 300), tags: normTags(d.tags),
    likes: Math.max(0, Math.round(Number(d.likes) || 0)), comments: normComments(d.comments), liked: false, faved: false, img: "", ts: Date.now(),
    // 横屏那套多出来的几样：标题、简介、时长、播放量、分区、视频里飘过去的弹幕
    title: S(d.title).slice(0, 60), intro: S(d.intro).slice(0, 400), dur: /^\d{1,3}:\d{2}$/.test(S(d.dur)) ? S(d.dur) : "",
    plays: Math.max(0, Math.round(Number(d.plays) || 0)), zone: S(d.zone).slice(0, 10), dms: arr(d.dms).map(S).filter(Boolean).map(x => x.slice(0, 30)).slice(0, 14)
  }, extra);

  // ── 提示词（料全在 system / 推演任务里，user 只有一句触发）────────────
  // 横屏那套：同一个人、同一份生活，只是平台的样子不一样——是有标题、有简介、按分区放的那种长一点的视频
  // 两套皮各自是一种什么样的地方——只说事实（多长、人怎么看、推给谁），不说该拍什么（她 2026-10-07：「不然你都把路写死了」）。
  //   同一个人放进两种处境，自然会拍出不一样的东西；写进去哪种内容，模型就只会往那儿钻。
  // 文案和画面是两样东西（她 2026-10-07：「除了图片描述你没写抖音文案」）：只写「文案 caption」四个字，模型常常空着或者塞进 scene
  const CAPTION_FACT = "caption 是作者发布时自己配在视频底下的那段话，不是画面描述——看视频的人在画面下面读到的就是它；话题标签另写在 tags 里，这里不用再带。";
  // 今天几号照那只虚拟钟（2026-10-31）：调用的地方把「现在」传进来——角色发视频是TA那只钟，推荐流是主面具那只；没传才用现实
  const DATE_FACT = nowTs => { const d = new Date(nowTs || Date.now()); return "\n今天是 " + d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日。"; };
  const V_FACT = "\n这个平台是竖屏的：一条通常十几秒到一两分钟。人是一条接一条往上划着看的，不喜欢一秒就划走了。推荐流会把你的视频推给不认识你的人，他们不知道你是谁，只看这一条。";
  const B_FACT = "\n这个平台是横屏的：一条几分钟到几十分钟都有。人多半是点进来从头看下去，很多是冲着这个号来的。视频有标题、有简介、放在某个分区里，看的人会在画面上发弹幕。";
  const B_EXTRA = B_FACT + "另外写：标题 title、简介 intro（一两句）、时长 dur（分:秒）、播放量 plays（数字）、分区 zone（两三个字）、视频里飘过去的弹幕 dms（6~12 条，很短，看视频的人发的）。";
  const THREAD_FACT = "\n评论里要是有哪条你回了，写 thread：name 照抄那条评论的网名、reply 你回的那句、back 对方看到以后又回了你什么（没再回就空着）；一条都不回就整个空着。";
  // acc：这个号一贯的样子（第一次发时定下来，之后一直照着来——她 2026-10-07 要的第 5 条）
  // hot：今天平台上的热门（第 6 条）。跟不跟由TA
  function charInstruction(handle, skin, friends, acc, hot, extra, nowTs) {
    const has = acc && (acc.bio || acc.niche);
    return "你在一个叫「" + APP_NAME + "」的短视频平台上有账号" + (handle ? "，账号名「" + handle + "」" : "") + "。"
      + (has ? "这个号一贯是这个样子：" + (acc.niche ? "平时主要发" + acc.niche + "；" : "") + (acc.bio ? "简介写着「" + acc.bio + "」；" : "") + "现在 " + (acc.followers || 0) + " 个粉丝。照这个号一贯的样子来，偶尔破例也正常。"
        : "这是你在这个号上发的头几条，这个号是个什么样子由你定下来：写 bio（主页简介一句）、niche（你平时主要发什么，几个字）、followers（现在多少粉丝，数字，照你这个人在网上会有的样子）。")
      + (hot && hot.length ? "\n今天「" + APP_NAME + "」上的热门：" + hot.join("、") + "。跟不跟、借不借它说你自己的事，照你这个人来——大多数时候不必跟。" : "")
      + (extra || "")
      + DATE_FACT(nowTs) + "你现在发一条新视频。"
      + "拍什么、怎么拍、配什么文案，都从你此刻真实的生活和你这个人身上长出来——你今天在干嘛、最近心里装着什么、你这种人平时会不会发这种。"
      + "\n写：账号名 handle（" + (handle ? "照旧填「" + handle + "」" : "你会给自己起的那个") + "）、视频里拍了什么 scene（镜头里看得见的画面，2~4 句，像在讲一段视频怎么走）、"
      + "画面里有没有你 who（self 本人出镜 / part 只露手或背影 / none 没有人）、文案 caption（" + CAPTION_FACT + "）、话题 tags（0~4 个，不带井号）、点赞数 likes（数字，照你这个号该有的热度）、"
      + "底下的评论 comments（3~6 条：name 是刷到这条的网友的网名，text 是他们说的话；各人各说各的，不是一个调子）。"
      + THREAD_FACT
      + (skin === "b" ? B_EXTRA : V_FACT)
      // 熟人来评并进这一枪里（她 2026-10-07 嫌多调一次贵）：认识TA的那几个人评不评、评什么，TA这一枪顺手写
      + (friends && friends.length ? "\n认识你的人里，这几个也在刷「" + APP_NAME + "」，可能刷到这条：" + friends.map(f => f.name + (f.rel ? "（" + f.rel + "）" : "")).join("、")
        + "。他们评不评、评什么、当着网友的面说成什么样，照他们跟你的关系来，写进 friends（name 只能是这几个；一个都没刷到就空着）。" : "");
  }
  // world：这个世界是什么样（盖了「公开世界」章的世界书），跟今日热门同一份；没有就是现在的现实
  function worldLine(world) { const w = String(world || "").trim(); return w ? "【这个世界】\n" + w.slice(0, 3000) + "\n平台上的人都活在这个世界里：博主是谁、过什么日子、拍什么、说话用什么词，照这个世界来；世界书里没写到的地方，按这个世界自然会有的样子补。\n" : ""; }
  function npcSystem(uName, persona, n, skin, hot, regs, world, nowTs) {
    return AC() + CB() + worldLine(world)
      + (hot && hot.length ? "今天平台上的热门：" + hot.join("、") + "——推荐流里会有几条在蹭这些。\n" : "")
      + DATE_FACT(nowTs).slice(1) + "\n【场景】" + uName + "在刷「" + APP_NAME + "」的推荐流，刷到的是 " + n + " 个互不相识的博主各发的一条视频。"
      + (persona ? "\n推荐流会跟她平时在意的东西沾一点边，但不是全都对口——她是这样一个人：" + persona : "")
      + "\n\n每条一个不同的博主。题材、拍法、口吻、热度各不一样：有大号有小号，有认真做内容的也有随手一拍的。"
      + "\n写 videos（" + n + " 条），每条：author 博主网名、scene 视频里拍了什么（2~4 句，像在讲一段视频怎么走）、who 画面里有没有人（self 博主本人出镜 / part 只露手或背影 / none 没有人）、"
      + "caption 文案（" + CAPTION_FACT + "）、tags 话题（0~4 个，不带井号）、likes 点赞数（数字）、comments 评论（2~5 条，name 网友网名，text）。"
      + (skin === "b" ? B_EXTRA : V_FACT)
      + (regs ? regs + "\n这一批里可以有一条是熟面孔自己发的（author 照抄网名，拍的是他平时会拍的东西）。" : "");
  }
  // ── 熟面孔（她 2026-10-16：「论坛有意思是因为有一套熟人系统…片刻里面没有」）──────────────
  //   就是论坛那批常驻网友，换了片刻上的网名和刷视频的习惯。跟她的碰面账两边共用。
  //   regs：[{id,name,voice,tie}]；pairs：他们之间的交情；me：她这次用的号名
  // doing：这个平台上大家在干什么。片刻是「刷视频、发评论」，一起听广场是「听歌、写歌评」——同一批人、同一份交情，一段话两处用
  // tail：最后那句「怎么混进去」——各处字段名不一样（同人文书评是 author、一批只来一两位），给了就用给的
  function regularsBlock(regs, pairs, me, doing, tail) {
    if (!regs || !regs.length) return "";
    const pick = regs.filter(r => r.tie && r.tie.encounters).concat(regs.filter(r => !(r.tie && r.tie.encounters)).sort(() => Math.random() - 0.5)).slice(0, 6);
    const ids = new Set(pick.map(r => r.id));
    const tieOf = r => { const t = r.tie; if (!t || !t.encounters) return ""; const n0 = Math.min(9, t.encounters);
      const how = (t.warm || 0) >= (t.spar || 0) * 2 && t.warm > 1 ? "，碰上多半聊得来" : (t.spar || 0) >= (t.warm || 0) * 2 && t.spar > 1 ? "，碰上多半要抬两句杠" : "";
      return "；跟 @" + me + " 在评论区碰过 " + n0 + " 次" + how + "，再遇见认得出这个号，可以接着以前的调子（但不知道她的私生活）"; };
    const ps = (pairs || []).filter(p => ids.has(p.a) && ids.has(p.b)).map(p => "· " + p.line);
    return "\n\n【这个平台上的熟面孔】下面几位是常在这儿" + (doing || "刷视频、发评论") + "的老网友：\n" + pick.map(r => "· 「" + r.name + "」：" + r.voice + tieOf(r)).join("\n")
      + (ps.length ? "\n他们彼此之间：\n" + ps.join("\n") + "\n同一条底下碰见了可以接旧梗、互损，别每次重新认识。" : "")
      + (tail != null ? tail : "\n写评论时大约三分之一可以是他们（name 照抄上面的网名，同一串里一个人最多两条，tone 填 warm＝聊得来 / spar＝抬杠），其余是路人（tone 留空）。");
  }
  // 她评论之后那一串——一枪写完（她 2026-10-15：「论坛都不用两次调用」）。
  //   第一版 ooc 的病根不在一枪，在【没告诉模型谁是谁】：情侣号是他俩共用的、评论的「Lisa」就是他女朋友本人，
  //   都没写，于是他把自己的号当外人、把她当路人怼。现在把这几条身份钉死在最前面，再写路人。
  //   活人感：路人短、不复述视频、口气各异，有人只发哈哈，有人答非所问。
  function crowdSystem(v, o) {
    return AC() + CB()
      + "【场景】「" + APP_NAME + "」上一条视频（@" + v.author + "）拍的是：" + S(v.scene).slice(0, 160) + (v.caption ? "；文案：" + S(v.caption).slice(0, 80) : "") + "。"
      + "\n【谁是谁——写之前先看清】" + o.ids.join("")
      + (o.brief ? "\n\n" + o.brief : "")
      + "\n\n【这一串评论的现场】\n" + o.transcript
      + "\n\n「" + o.me + "」刚说了：「" + o.text + "」。写接在后面的正好 " + o.n + " 条回复 items（name、text、to 回的是这串里谁——照抄名字）："
      + (o.must ? "\n① 第一条必须是「" + o.must + "」回她的（name 照抄「" + o.must + "」）" + (o.mustChar ? "——就是上面那个人本人。TA平时怎么跟她说话，在评论区还是那个样子：网友看着不会让TA换一副腔调，该撩就撩、该贫就贫、该护着就护着，照TA的人设和你俩的关系来。是打字，没有动作和旁白；长短照TA想回的" : "——人家被回了总要接一句，冷淡、怼回去也算") + "。" : "")
      + "\n" + (o.must ? "② 其余" : "") + "是刷到这里的陌生网友：不认识这串里任何人，不知道谁跟谁什么关系。像真在刷评论区——短，一句甚至几个字；不复述视频、不总结、不写作文；有人只发「哈哈哈哈」或表情，有人抓一个词起哄，有人唱反调，有人答非所问；口气、长短、标点各不一样。可以回她，也可以回楼里别人。"
      + (o.regs || "")
      + "\n⚠️「" + o.me + "」是真人本人，绝对不许以她的名义写任何一句。";
  }
  function mineSystem(v, uName, chars, briefs, co, cp, same) {
    return AC() + CB()
      + "【场景】" + uName + "在「" + APP_NAME + "」上发了一条视频。拍的是：" + v.scene + "\n文案：" + (v.caption || "（没写）")
      + (same ? "\n这条是她照着 " + same.name + " 发的一条视频拍的同款（" + same.name + " 原来那条拍的是：" + S(same.scene).slice(0, 80) + "）。" + same.name + " 刷到了自己被拍同款，怎么接照TA这个人来。" : "")
      + (cp ? "\n这条发在她和 " + cp.name + " 共用的情侣号「" + cp.handle + "」上——" + cp.name + " 也是这个号的主人，不是路过的。" + cp.name + " 怎么在自己号的评论区接这一条（置顶补一句、跟粉丝互动、或者回她），照TA这个人来。另外写几条情侣号的粉丝在底下的话 crowd（3~6 条，name 网名、text）：多是嗑你俩的 CP 粉——催更、考古、起 CP 名、嗑到了、起哄，口气各不一样。" : "")
      + (co ? "\n这条是她和 " + co.name + " 一起出镜的合拍，" + co.name + " 就在画面里。" + co.name + " 评论时是合拍的另一半，当着大家的面怎么接，照TA跟她的关系来。另外写几条刷到这条的网友起哄 crowd（2~4 条，name 网名、text）。" : "")
      + "\n\n下面这几个人都认识她，都刷到了这条，每人写一条评论（实在不想评的才不写）。每个人照自己的人设、跟她的关系、此刻的心情来——他们平时私聊里怎么跟她说话（下面各自那几句），评论区里还是那个人，只是别人也看得见。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n写：comments（name 只能是：" + chars.map(c => c.name).join("、") + "；不想评的人就不写）、likes（这条视频的点赞数，数字）。";
  }

  // ── 分享卡：聊天里那一张（单聊、群聊走同一条 shareCardOf）──────────
  const shareSnap = v => Object.assign({ id: v.id || null, author: v.author, title: v.title || "", scene: v.scene, caption: v.caption, tags: arr(v.tags), img: v.img || "", skin: vidSkin(v), by: v.by, charId: v.charId || null, likes: v.likes || 0 },
    v.together ? { together: true, intro: S(v.intro).slice(0, 200), dur: v.dur || "", dms: arr(v.dms).slice(0, 6) } : {});
  // TA读到的那一段：视频长什么样照抄；是TA自己的那条就说一声
  const shareText = (snap, toCharId, fromName) => "[" + (fromName ? fromName + "从「" + APP_NAME + "」甩来一条视频" : "转发了一条「" + APP_NAME + "」上的视频") + "]"
    + "作者 @" + snap.author + (snap.title ? "｜标题《" + snap.title + "》" : "") + "｜视频里拍的是：" + snap.scene + (snap.caption ? "｜文案：" + snap.caption : "")
    + (snap.tags.length ? "｜" + snap.tags.map(x => "#" + x).join(" ") : "") + "｜" + snap.likes + " 赞"
    + (snap.together ? (snap.dur ? "｜时长 " + snap.dur : "") + (snap.intro ? "｜简介：" + snap.intro : "") + (arr(snap.dms).length ? "｜弹幕里飘过：" + snap.dms.join(" / ") : "")
      + "｜她拉你一起看这条：你俩现在一块儿从头看着，边看边聊，看到哪段聊哪段" : "")
    + (toCharId && snap.by === "char" && snap.charId === toCharId ? "｜（这就是你自己发的那条）" : "");
  // 刷什么他知道（她 2026-10-08）：只在本机数，不花调用。她这一周点赞过的路人视频里，同一个话题够三条，
  //   就给在片刻上有号的 TA 一句（点赞在平台上别人看得见）；够不上就是空串，一个字不发。
  const TASTE_MIN = 3, TASTE_DAYS = 7;
  function tasteLine(db, charId) {
    if (!db || !charId || !((db.accounts || {})[charId])) return "";
    const since = Date.now() - TASTE_DAYS * 86400000, n = {};
    arr(db.videos).filter(v => v.liked && v.by === "npc" && (v.likedTs || 0) >= since).forEach(v => arr(v.tags).concat(v.zone ? [v.zone] : []).forEach(t => { n[t] = (n[t] || 0) + 1; }));
    const top = Object.keys(n).filter(k => n[k] >= TASTE_MIN).sort((a, b) => n[b] - n[a]).slice(0, 2);
    return top.length ? "你在「" + APP_NAME + "」上看得见她点赞过什么：她这几天点赞了好几条「" + top.join("」「") + "」的视频。提不提照你这个人来。" : "";
  }
  window.__openShuaVideo = snap => { window.__shuaPending = snap; if (typeof window.__goScreen === "function") window.__goScreen("shua"); };
  function ShuaShareCard({ m }) {
    const v = m.shua || {};
    const src = v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
    return h("div", { "data-wk": "shuashare", role: "button", onClick: () => window.__openShuaVideo(v), className: "active:opacity-80", style: { cursor: "pointer", width: 220, maxWidth: "100%", borderRadius: 12, overflow: "hidden", background: "#111", border: "1px solid rgba(0,0,0,.08)" } },
      // ⚠️比例和最高高度一起写时，高度被卡住、宽度就跟着缩，卡片右边空出一条（她 2026-10-07 截图）。宽度铺满，高度定死
      h("div", { style: { position: "relative", width: "100%", height: v.skin === "b" ? 138 : 260, background: src ? "center/cover no-repeat url(\"" + src + "\")" : "linear-gradient(160deg,#3b2a4a,#111)", padding: 10 } },
        !src ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(255,255,255,.9)", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 10px 8px", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.7))" } },
          h("div", { "data-wk": "shuashareauthor", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#fff", fontWeight: 600 } }, "@" + (v.author || "")),
          (v.title || v.caption) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.88)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || v.caption) : null)),
      h("div", { style: { padding: "5px 10px", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.6)", background: "#111" } }, APP_NAME + " · " + fmtN(v.likes) + " 赞 · 点开看"));
  }
  window.ShuaShareCard = ShuaShareCard;
  window.ShuaKit = { worldLine, regularsBlock, tasteLine, shareSnap, shareText, APP_NAME, PAL, charInstruction, npcSystem, crowdSystem, mineSystem, mkVideo, vidSkin };

  // 页面那半要用的，原样递过去
  window.ShuaCore = { worldLine, APP_NAME, INK, DIM, BLACK, RED, LINE, PAL, vidSkin, S, arr, uid, AC, CB, fmtN, normComments, mkVideo, charInstruction, npcSystem, regularsBlock, crowdSystem, mineSystem };
})();
