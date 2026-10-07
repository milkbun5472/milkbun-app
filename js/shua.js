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
  const KEY = "x_shua";
  const CAP = 200;            // 最多留几条视频
  const NPC_BATCH = 5;        // 一次刷几条路人的
  const PICK_MAX = 5;         // 一次最多请几个人发
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
  const EMPTY = { videos: [], accounts: {}, notes: [], me: {} };
  const load = () => { try { const v = loadJSON(KEY, null); return v && typeof v === "object" ? Object.assign({}, EMPTY, v) : Object.assign({}, EMPTY); } catch (e) { return Object.assign({}, EMPTY); } };
  const fmtN = n => { n = Number(n) || 0; return n >= 10000 ? (Math.round(n / 1000) / 10) + "w" : String(n); };
  const hue = s => { let x = 0; String(s || "").split("").forEach(c => { x = (x * 31 + c.charCodeAt(0)) % 360; }); return x; };
  const tint = v => "linear-gradient(160deg,hsl(" + hue(v.id) + ",38%,26%),hsl(" + ((hue(v.id) + 60) % 360) + ",32%,12%))";
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
  const B_EXTRA = "\n这是一个以横屏中长视频为主的平台：视频有标题、有简介、有分区，看的人会在画面上发弹幕。所以另外写：标题 title、简介 intro（一两句）、时长 dur（分:秒）、播放量 plays（数字）、分区 zone（两三个字）、视频里飘过去的弹幕 dms（6~12 条，很短，看视频的人发的）。";
  const ACC_ADD = ',"bio":"","niche":"","followers":0';
  const FRIENDS_ADD = ',"friends":[{"name":"","text":""}]';
  const B_SHAPE_ADD = ',"title":"","intro":"","dur":"08:24","plays":0,"zone":"","dms":[""]';
  const CHAR_SHAPE = '{"handle":"","scene":"","who":"self","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}';
  // acc：这个号一贯的样子（第一次发时定下来，之后一直照着来——她 2026-10-07 要的第 5 条）
  // hot：今天平台上的热门（第 6 条）。跟不跟由TA
  function charInstruction(handle, skin, friends, acc, hot) {
    const has = acc && (acc.bio || acc.niche);
    return "你在一个叫「" + APP_NAME + "」的短视频平台上有账号" + (handle ? "，账号名「" + handle + "」" : "") + "。"
      + (has ? "这个号一贯是这个样子：" + (acc.niche ? "平时主要发" + acc.niche + "；" : "") + (acc.bio ? "简介写着「" + acc.bio + "」；" : "") + "现在 " + (acc.followers || 0) + " 个粉丝。照这个号一贯的样子来，偶尔破例也正常。"
        : "这是你在这个号上发的头几条，这个号是个什么样子由你定下来：写 bio（主页简介一句）、niche（你平时主要发什么，几个字）、followers（现在多少粉丝，数字，照你这个人在网上会有的样子）。")
      + (hot && hot.length ? "\n今天「" + APP_NAME + "」上的热门：" + hot.join("、") + "。跟不跟、借不借它说你自己的事，照你这个人来——大多数时候不必跟。" : "")
      + "你现在发一条新视频。"
      + "拍什么、怎么拍、配什么文案，都从你此刻真实的生活和你这个人身上长出来——你今天在干嘛、最近心里装着什么、你这种人平时会不会发这种。"
      + "\n写：账号名 handle（" + (handle ? "照旧填「" + handle + "」" : "你会给自己起的那个") + "）、视频里拍了什么 scene（镜头里看得见的画面，2~4 句，像在讲一段视频怎么走）、"
      + "画面里有没有你 who（self 本人出镜 / part 只露手或背影 / none 没有人）、文案 caption、话题 tags（0~4 个，不带井号）、点赞数 likes（数字，照你这个号该有的热度）、"
      + "底下的评论 comments（3~6 条：name 是刷到这条的网友的网名，text 是他们说的话；各人各说各的，不是一个调子）。"
      + (skin === "b" ? B_EXTRA : "")
      // 熟人来评并进这一枪里（她 2026-10-07 嫌多调一次贵）：认识TA的那几个人评不评、评什么，TA这一枪顺手写
      + (friends && friends.length ? "\n认识你的人里，这几个也在刷「" + APP_NAME + "」，可能刷到这条：" + friends.map(f => f.name + (f.rel ? "（" + f.rel + "）" : "")).join("、")
        + "。他们评不评、评什么、当着网友的面说成什么样，照他们跟你的关系来，写进 friends（name 只能是这几个；一个都没刷到就空着）。" : "");
  }
  const NPC_SHAPE = '{"videos":[{"author":"","scene":"","who":"none","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}]}';
  function npcSystem(uName, persona, n, skin, hot) {
    return AC() + CB()
      + (hot && hot.length ? "今天平台上的热门：" + hot.join("、") + "——推荐流里会有几条在蹭这些。\n" : "")
      + "【场景】" + uName + "在刷「" + APP_NAME + "」的推荐流，刷到的是 " + n + " 个互不相识的博主各发的一条视频。"
      + (persona ? "\n推荐流会跟她平时在意的东西沾一点边，但不是全都对口——她是这样一个人：" + persona : "")
      + "\n\n每条一个不同的博主。题材、拍法、口吻、热度各不一样：有大号有小号，有认真做内容的也有随手一拍的。"
      + "\n写 videos（" + n + " 条），每条：author 博主网名、scene 视频里拍了什么（2~4 句，像在讲一段视频怎么走）、who 画面里有没有人（self 博主本人出镜 / part 只露手或背影 / none 没有人）、"
      + "caption 文案、tags 话题（0~4 个，不带井号）、likes 点赞数（数字）、comments 评论（2~5 条，name 网友网名，text）。"
      + (skin === "b" ? B_EXTRA.replace("\n这是", "\n这个推荐流是在") : "");
  }
  const REPLY_SHAPE = '{"reply":""}';
  // alt：她用小号评的。TA只看得见一个陌生账号，不知道是她（跟论坛小号同一条：小号一个字都不漏）
  function replyInstruction(v, uName, text, alt) {
    return "你在「" + APP_NAME + "」上发的那条视频——拍的是：" + v.scene + "；文案：" + v.caption + "。"
      + (alt ? "\n底下一个你不认识的账号「" + alt + "」评论了你：「" + text + "」。评论区别人都看得见。"
        : "\n底下" + uName + "用她自己的号评论了你：「" + text + "」。评论区别人都看得见。")
      + "\n你回不回、怎么回（当着所有人的面），照你这个人来；不想回就把 reply 留空。";
  }
  // 她小号发的视频，TA刷到了（她 2026-10-07 选的第 1 条）：认不认得出是她，全看TA对她的了解
  const SPOT_SHAPE = '{"spots":[{"name":"","comment":"","recognized":false,"why":""}]}';
  function spotSystem(v, alt, uName, chars, briefs) {
    return AC() + CB()
      + "【场景】下面这几个人都认识 " + uName + "。他们在「" + APP_NAME + "」上各自刷到了一个叫「" + alt + "」的账号发的视频：" + v.scene + (v.caption ? "；文案：" + v.caption : "") + "。"
      + "\n这个号谁都没关注过，粉丝很少。它是不是 " + uName + " 的小号，每个人只能从这条视频本身（拍的东西、口气、细节）和自己对她的了解去判断——认不出来再正常不过，各人各判，不必一致。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n每人写一项 spots：name（只能是：" + chars.map(c => c.name).join("、") + "）、comment 会不会在底下评论（不评就空着；评的话是公开的，用自己的号评）、recognized 觉得是不是她（true/false）、why 为什么这么觉得（一句，心里想的，不会被看到）。";
  }
  const HOT_SHAPE = '{"topics":[{"title":"","heat":0,"about":""}]}';
  function hotSystem(uName, world, date) {
    return AC() + CB()
      + "【场景】今天是 " + date + "。「" + APP_NAME + "」这个短视频平台今天的热门话题。"
      + (world ? "\n这个平台在这样一个世界里，热门从这个世界正在发生的事、时节和大家的日常里长出来：\n" + world : "\n热门从时节、日常和这个世界正在发生的事里长出来。")
      + "\n写 6~8 个 topics：title 话题名（不带井号，像平台上真会冒出来的那种）、heat 热度（数字）、about 一句话说这是怎么回事。大小事都有，别全是一个调子。";
  }
  const MINE_SHAPE = '{"comments":[{"name":"","text":""}],"likes":0}';
  function mineSystem(v, uName, chars, briefs, co, cp) {
    return AC() + CB()
      + "【场景】" + uName + "在「" + APP_NAME + "」上发了一条视频。拍的是：" + v.scene + "\n文案：" + (v.caption || "（没写）")
      + (cp ? "\n这条发在她和 " + cp.name + " 共用的情侣号「" + cp.handle + "」上——" + cp.name + " 也是这个号的主人，不是路过的。" + cp.name + " 怎么在自己号的评论区接这一条（置顶补一句、跟粉丝互动、或者回她），照TA这个人来。另外写几条情侣号的粉丝在底下的话 crowd（2~4 条，name 网名、text）。" : "")
      + (co ? "\n这条是她和 " + co.name + " 一起出镜的合拍，" + co.name + " 就在画面里。" + co.name + " 评论时是合拍的另一半，当着大家的面怎么接，照TA跟她的关系来。另外写几条刷到这条的网友起哄 crowd（2~4 条，name 网名、text）。" : "")
      + "\n\n下面这几个人都认识她，都刷到了这条。各自照自己的性子决定评不评、评什么——评论区是公开的，别人都看得见；谁跟她什么关系、此刻什么心情，决定他当着别人怎么说。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n写：comments（name 只能是：" + chars.map(c => c.name).join("、") + "；不想评的人就不写）、likes（这条视频的点赞数，数字）。";
  }

  // ── 一条视频（整屏那一格）─────────────────────────────────
  function VideoPane({ v, charOf, onLike, onFave, onComments, onDraw, drawing, height, onShare, onAuthor }) {
    const ch = v.charId ? charOf(v.charId) : null;
    const src = v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
    const railBtn = (icon, n, on, fn, key) => h("button", { key: key, onClick: fn, className: "active:opacity-60 flex flex-col items-center", style: { color: on ? RED : INK, minWidth: 44, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" } },
      icon(on ? RED : INK),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, marginTop: 4, color: INK, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, n));
    return h("div", { style: { position: "relative", height: height, scrollSnapAlign: "start", scrollSnapStop: "always", overflow: "hidden", background: src ? "#000" : tint(v) } },
      src ? h("img", { src: src, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null,
      h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.28) 0,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 52%,rgba(0,0,0,.66) 100%)" } }),
      // 没画出来的时候，画面那几句摆在正中，当它就是这一段视频
      !src ? h("div", { style: { position: "absolute", left: 26, right: 70, top: "26%", fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,.9)", textShadow: "0 1px 4px rgba(0,0,0,.4)" } }, v.scene) : null,
      h("div", { className: "flex flex-col items-center", style: { position: "absolute", right: 10, bottom: 110, gap: 18 } },
        h("button", { onClick: onAuthor, "aria-label": "看这个号", className: "active:opacity-70", style: { width: 46, height: 46, borderRadius: 99, border: "2px solid #fff", overflow: "hidden", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY } },
          ch ? h(Avatar, { character: ch, size: 42 }) : S(v.author).slice(0, 1)),
        railBtn(c => h(IHeart, { size: 30, color: c, filled: true }), fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike, "l"),
        railBtn(c => h(Svg, { size: 30, color: c, sw: 1.8 }, h("path", { d: "M4 5.5h16v10.5H10l-4.5 3.5V16H4z" })), fmtN(arr(v.comments).length), false, onComments, "c"),
        railBtn(c => h(Svg, { size: 30, color: c, sw: 1.8 }, h("path", { fill: c === RED ? c : "none", d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z" })), v.faved ? "已收藏" : "收藏", v.faved, onFave, "f"),
        onShare ? railBtn(c => h(Svg, { size: 30, color: c, sw: 1.8 }, h("path", { d: "M13 5l7 6.5-7 6.5v-4c-5 0-8 1.5-10 5 .8-5.5 3.8-9 10-9.5z" })), "分享", false, onShare, "s") : null,
        onDraw ? railBtn(c => h(IPencil, { size: 28, color: c }), drawing ? "画着…" : (src ? "重画" : "画出来"), false, drawing ? null : onDraw, "d") : null),
      h("div", { style: { position: "absolute", left: 14, right: 72, bottom: 22 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: INK, fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, "@" + (v.author || "") + (v.withName ? "  与 @" + v.withName + " 合拍" : "")),
        src && v.scene ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: DIM, marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        v.caption ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: INK, marginTop: 6, lineHeight: 1.55, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, v.caption,
          arr(v.tags).length ? h("span", { style: { fontWeight: 600 } }, " " + v.tags.map(x => "#" + x).join(" ")) : null) : null));
  }

  // ── 评论区（整页）──────────────────────────────────────
  function CommentsPage({ v, busy, onSend, onBack, t, P }) {
    const [text, setText] = useState("");
    const send = () => { const x = text.trim(); if (!x || busy) return; setText(""); onSend(x); };
    return h("div", { className: "h-full flex flex-col", style: { background: P.bg } },
      h(Head, { zh: arr(v.comments).length + " 条评论", sub: "@" + v.author, bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: 12 } },
        arr(v.comments).length ? arr(v.comments).map(c => h("div", { key: c.id, style: { padding: "10px 0", borderBottom: "1px solid " + P.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: c.by === "me" ? P.accent : c.by === "char" ? "#d89a2b" : P.dim } }, c.name + (c.by === "char" && c.isAuthor ? " · 作者" : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: P.ink, marginTop: 3, lineHeight: 1.55 } }, c.text))) :
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.dim, textAlign: "center", padding: "40px 0" } }, "还没有评论"),
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim, padding: "8px 0" } }, "……") : null),
      h("div", { className: "shrink-0 flex items-end px-3", style: { gap: 8, paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + P.line } },
        h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 1, placeholder: "善语结善缘，说点什么", className: "flex-1 outline-none resize-none",
          style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5 } }),
        h("button", { onClick: send, disabled: busy || !text.trim(), className: "active:opacity-70 shrink-0", style: { width: 52, height: 42, borderRadius: 12, background: (busy || !text.trim()) ? "rgba(255,255,255,.1)" : P.accent, color: "#fff", fontFamily: F_BODY, fontSize: 13 } }, "发送")));
  }

  // ── 刷新那一页：两颗，跟论坛一样 ────────────────────────
  function RefreshPage({ characters, busy, prog, onNpc, onChars, onHot, hotDay, onBack, t, P }) {
    const [pick, setPick] = useState(characters.slice(0, 3).map(c => c.id));
    const toggle = id => setPick(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]).slice(0, PICK_MAX));
    // ⚠️按不了的时候字色跟着皮走（2026-10-07 群友截图：横着看那套底是白的，白字压白底，「正在刷…」整个看不见，像卡死了）
    const big = (title, sub, fn, dis) => h("button", { onClick: fn, disabled: dis, className: "w-full text-left active:opacity-80", style: { borderRadius: 16, padding: "16px 18px", background: dis ? P.field : "linear-gradient(120deg,#fe2c55,#7a3cff)", color: dis ? P.ink : "#fff", border: "1px solid " + (dis ? P.line : "transparent"), opacity: dis ? .75 : 1 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17 } }, title), h("div", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .85, marginTop: 4 } }, sub));
    return h("div", { className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: "刷新", bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        h("div", { style: { marginTop: 8 } }, big(busy === "npc" ? "正在刷…" : "刷几条路人的", "推荐流里互不认识的博主，一次 " + NPC_BATCH + " 条（调一次模型）", onNpc, busy === "npc" || busy === "chars")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "22px 0 10px" } }, "请谁发（每人一条，最多 " + PICK_MAX + " 个）"),
        h("div", { className: "flex flex-wrap", style: { gap: 12 } }, characters.map(c => {
          const on = pick.indexOf(c.id) >= 0;
          return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 58, opacity: on ? 1 : .45 } },
            h("div", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (on ? P.accent : "transparent") } }, h(Avatar, { character: c, size: 46 })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.ink, marginTop: 4, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name));
        })),
        h("div", { style: { marginTop: 14 } }, big(busy === "chars" ? "TA们在拍…" + (prog ? "（" + prog + "）" : "") : "请TA们发", busy === "chars" ? "可以先退出去刷，拍好一条就出一条" : "挑中的人各发一条，照TA此刻的生活来", () => onChars(pick), busy === "npc" || busy === "chars" || !pick.length),
        onHot ? h("div", { style: { marginTop: 14 } }, big(busy === "hot" ? "正在看今天的热门…" : (hotDay ? "重刷今天的热门" : "看看今天的热门"), "这个世界今天在聊什么，一天一份（调一次模型）。TA 们发视频时知道，跟不跟看各人", onHot, busy === "npc" || busy === "chars" || busy === "hot")) : null)));
  }

  // ── 发一条（＋）──────────────────────────────────────
  function PostPage({ busy, onPost, onLive, onBack, P, skin, characters, onAlt }) {
    const [scene, setScene] = useState(""), [caption, setCaption] = useState(""), [who, setWho] = useState("self"), [title, setTitle] = useState("");
    const [withId, setWithId] = useState("");   // 和谁一起出镜（合拍，第 4 条）
    const field = (val, set, ph, rows) => h("textarea", { value: val, onChange: e => set(e.target.value), rows: rows, placeholder: ph, className: "w-full outline-none resize-none",
      style: { borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, marginTop: 8 } });
    const chip = (k, label) => h("button", { key: k, onClick: () => setWho(k), className: "active:opacity-60", style: { minHeight: 34, padding: "0 13px", borderRadius: 999, border: "1px solid " + (who === k ? P.ink : P.line), background: who === k ? P.ink : "transparent", color: who === k ? P.bg : P.dim, fontFamily: F_BODY, fontSize: 12.5 } }, label);
    return h("div", { className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: "发一条", bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        h("button", { onClick: onLive, className: "w-full text-left active:opacity-80", style: { marginTop: 6, borderRadius: 16, padding: "14px 18px", background: "linear-gradient(120deg,#e2556b,#46326e)", color: "#fff" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, "开直播"), h("div", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .85, marginTop: 3 } }, "你开播，你的人混在观众里看着")),
        skin === "b" ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, marginTop: 22 } }, "标题") : null,
        skin === "b" ? field(title, setTitle, "这条视频叫什么", 1) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, marginTop: skin === "b" ? 16 : 22 } }, "视频里拍了什么"),
        field(scene, setScene, "镜头里看得见什么，怎么走的", 3),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, marginTop: 16 } }, "文案"),
        field(caption, setCaption, "配一句话，可以带 #话题", 2),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "16px 0 8px" } }, "画面里有没有你"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } }, chip("self", "我出镜"), chip("part", "只露手或背影"), chip("none", "没有人")),
        // 合拍：小号发的不给选（小号就是不想让人知道是她）
        !onAlt && (characters || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "16px 0 8px" } }, "和谁一起出镜（合拍，可不选）") : null,
        !onAlt && (characters || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 10 } }, characters.map(c => h("button", { key: c.id, onClick: () => setWithId(w => w === c.id ? "" : c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 52, opacity: withId === c.id ? 1 : .5 } },
          h("div", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (withId === c.id ? P.accent : "transparent") } }, h(Avatar, { character: c, size: 40 })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: P.ink, marginTop: 3, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)))) : null,
        h("button", { disabled: !!busy || !scene.trim(), onClick: () => onPost({ scene: scene.trim(), caption: caption.trim(), who, title: title.trim(), withId: onAlt ? "" : withId }),
          className: "w-full active:opacity-80", style: { marginTop: 24, minHeight: 48, borderRadius: 14, background: (!scene.trim() || busy) ? "rgba(255,255,255,.1)" : P.accent, color: "#fff", fontFamily: F_BODY, fontSize: 14.5 } }, busy ? "发着…" : "发布")));
  }

  // ── 横屏那套：双列封面 + 带弹幕的播放页 ─────────────────────
  const B = PAL.b;
  const imgOf = v => v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
  const coverBg = v => { const src = imgOf(v); return src ? "center/cover no-repeat url(\"" + src + "\")" : tint(v); };
  function BCard({ v, onOpen }) {
    return h("button", { onClick: onOpen, className: "text-left active:opacity-80", style: { borderRadius: 8, overflow: "hidden", background: B.card, boxShadow: "0 1px 4px rgba(0,0,0,.05)", display: "flex", flexDirection: "column" } },
      h("div", { style: { position: "relative", aspectRatio: "16 / 10", background: coverBg(v), padding: 7 } },
        !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.88)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        h("div", { className: "flex items-center", style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 7px 4px", gap: 8, background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55))", fontFamily: F_BODY, fontSize: 10.5, color: "#fff" } },
          h("span", null, "▶ " + fmtN(v.plays)), h("span", null, "弹 " + fmtN(arr(v.dms).length + arr(v.comments).length)),
          v.dur ? h("span", { style: { marginLeft: "auto" } }, v.dur) : null)),
      h("div", { style: { padding: "7px 8px 9px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: B.ink, lineHeight: 1.45, height: 36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || v.caption || v.scene),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: B.dim, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (v.by === "char" ? "作者 · " : "") + v.author)));
  }
  function BDetail({ v, charOf, busy, onBack, onLike, onFave, onDraw, drawing, onSend, onShare, onAuthor }) {
    const [text, setText] = useState("");
    const ch = v.charId ? charOf(v.charId) : null;
    const send = () => { const x = text.trim(); if (!x || busy) return; setText(""); onSend(x); };
    const act = (label, n, on, fn) => h("button", { onClick: fn, className: "flex-1 active:opacity-60 flex flex-col items-center", style: { color: on ? B.accent : B.dim, minHeight: 44 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 700 : 400 } }, label), h("span", { style: { fontFamily: F_BODY, fontSize: 11, marginTop: 2 } }, n));
    return h("div", { className: "h-full flex flex-col", style: { background: B.bg } },
      // 播放器那一块：黑底，画面（或那几句）＋飘过去的弹幕
      h("div", { "data-wk": "head", className: "shrink-0", style: { position: "relative", background: "#000", paddingTop: safeTop(0) } },
        h("div", { style: { position: "relative", aspectRatio: "16 / 9", background: coverBg(v), overflow: "hidden" } },
          !imgOf(v) ? h("div", { style: { position: "absolute", left: 18, right: 18, top: "28%", fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.92)" } }, v.scene) : null,
          window.LiveKit && window.LiveKit.NoiseLayer ? h(window.LiveKit.NoiseLayer, { noise: v.dms, seed: v.id }) : null,
          h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60", style: { position: "absolute", left: 6, top: 4, width: 40, height: 40 } }, h(IArrow, { size: 20, color: "#fff" })))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: 10 } },
        h("div", { style: { background: B.card, padding: "12px 14px" } },
          h("button", { onClick: onAuthor, className: "flex items-center text-left active:opacity-70", style: { gap: 10 } },
            ch ? h(Avatar, { character: ch, size: 34 }) : h("div", { style: { width: 34, height: 34, borderRadius: 99, background: tint(v), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY } }, S(v.author).slice(0, 1)),
            h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: B.accent } }, v.author + (v.withName ? " · 与 " + v.withName + " 合拍" : "")), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: B.dim } }, fmtN(v.plays) + " 播放" + (v.zone ? " · " + v.zone : "")))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: B.ink, marginTop: 10, lineHeight: 1.5 } }, v.title || v.caption),
          (v.intro || (v.title && v.caption)) ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: B.dim, marginTop: 6, lineHeight: 1.6 } }, v.intro || v.caption) : null,
          arr(v.tags).length ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, v.tags.map(x => h("span", { key: x, style: { fontFamily: F_BODY, fontSize: 11, color: B.dim, background: B.bg, borderRadius: 99, padding: "3px 9px" } }, x))) : null,
          h("div", { className: "flex", style: { marginTop: 10 } },
            act("点赞", fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike),
            act("收藏", v.faved ? "已收藏" : "收藏", v.faved, onFave),
            onShare ? act("分享", "给 TA", false, onShare) : null,
            onDraw ? act(drawing ? "画着…" : (imgOf(v) ? "重画" : "画出来"), "封面", false, drawing ? null : onDraw) : null)),
        h("div", { style: { background: B.card, marginTop: 8, padding: "6px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: B.ink, padding: "8px 0" } }, "评论 " + arr(v.comments).length),
          arr(v.comments).map(c => h("div", { key: c.id, style: { padding: "9px 0", borderTop: "1px solid " + B.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: c.by === "me" ? B.accent : c.by === "char" ? "#d89a2b" : B.dim } }, c.name + (c.isAuthor ? " · 作者" : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: B.ink, marginTop: 3, lineHeight: 1.55 } }, c.text))),
          busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: B.dim, padding: "8px 0" } }, "……") : null)),
      h("div", { className: "shrink-0 flex items-end px-3", style: { gap: 8, paddingTop: 8, background: B.card, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + B.line } },
        h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 1, placeholder: "发一条友善的评论", className: "flex-1 outline-none resize-none",
          style: { minHeight: 40, maxHeight: 100, borderRadius: 20, border: "none", background: B.bg, color: B.ink, padding: "10px 14px", fontFamily: F_BODY, fontSize: 13.5 } }),
        h("button", { onClick: send, disabled: busy || !text.trim(), className: "active:opacity-70 shrink-0", style: { width: 52, height: 40, borderRadius: 20, background: (busy || !text.trim()) ? B.line : B.accent, color: "#fff", fontFamily: F_BODY, fontSize: 13 } }, "发布")));
  }

  // ── 整个 app ─────────────────────────────────────────
  function ShuaApp(props) {
    const t = useTheme();
    const { characters, profile, toast } = props;
    const [db, setDb] = useState(load);
    const dbRef = useRef(db); dbRef.current = db;
    const [tab, setTab] = useState("home");          // home | live | msg | me
    const [feed, setFeed] = useState("rec");          // follow | rec
    const [page, setPage] = useState(null);           // null | {kind:"comments"|"bdetail",id} | {kind:"refresh"} | {kind:"post"} | {kind:"mine"}
    const [liveStart, setLiveStart] = useState("");   // 从「＋ → 开直播」进直播那一格
    const [busy, setBusy] = useState(null);
    const [topic, setTopic] = useState("");   // 首页只看沾这个热门话题的
    const [prog, setProg] = useState("");
    const [drawing, setDrawing] = useState(null);
    const [paneH, setPaneH] = useState(600);
    const feedRef = useRef(null);
    const posRef = useRef({});   // 每一格滑到哪儿了（点进评论再回来要还在原地）
    const uName = (profile && profile.name) || "我";
    const skin = db.skin === "b" ? "b" : "v";
    const P = PAL[skin];
    useEffect(function () { const el = feedRef.current; if (el && el.clientHeight && el.clientHeight !== paneH) setPaneH(el.clientHeight); });
    const save = next => { const n = Object.assign({}, next, { videos: arr(next.videos).slice(0, CAP), notes: arr(next.notes).slice(0, 100) }); dbRef.current = n; setDb(n); saveJSON(KEY, n); };
    const patchV = (id, fn) => save(Object.assign({}, dbRef.current, { videos: dbRef.current.videos.map(v => v.id === id ? fn(v) : v) }));
    const addVideos = list => save(Object.assign({}, dbRef.current, { videos: list.concat(dbRef.current.videos) }));
    const note = text => save(Object.assign({}, dbRef.current, { notes: [{ id: uid("n"), text, ts: Date.now(), unread: true }].concat(dbRef.current.notes) }));
    const charOf = id => characters.find(c => c.id === id);
    // 小号（她 2026-10-07：「片刻能不能也搞小号，跟论坛一样」）：在「我」里起名、切换。
    //   用小号时：发的视频、评论都挂小号的名；小号发的视频悄悄的——认识她的人不会被叫来评论；
    //   小号去评 TA 的视频，TA 只当是个陌生人。
    const altName = S(db.me && db.me.altHandle);
    const onAlt = !!(altName && db.me && db.me.using === "alt");   // 情侣号那一档另算，见下面 cpId
    // 情侣号（她 2026-10-07）：只给在一起的人开，一人一个，你俩共用。using 写成 "cp:角色id"
    const cps = db.cps || {};
    const togetherIds = props.togetherIds ? props.togetherIds() : [];
    const using = (db.me && db.me.using) || "main";
    const cpId = /^cp:/.test(using) && cps[using.slice(3)] && togetherIds.indexOf(using.slice(3)) >= 0 ? using.slice(3) : "";
    const onCp = !!cpId;
    const myName = onCp ? cps[cpId].handle : onAlt ? altName : (S(db.me && db.me.handle) || uName);
    const shapeChar = (sk, withFriends, newAcc) => (sk === "b" ? CHAR_SHAPE.replace(/\}$/, B_SHAPE_ADD + "}") : CHAR_SHAPE).replace(/\}$/, (withFriends ? FRIENDS_ADD : "") + (newAcc ? ACC_ADD : "") + "}");
    const shapeNpc = sk => sk === "b" ? NPC_SHAPE.replace('"comments":[{"name":"","text":""}]}]}', '"comments":[{"name":"","text":""}]' + B_SHAPE_ADD + '}]}') : NPC_SHAPE;

    // 今日热门（第 6 条）：一天一份，点了才刷（一次调用）。从这个世界里正在发生的事长出来
    const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
    const hotToday = () => (db.hot && db.hot.day === todayKey() ? arr(db.hot.topics).map(x => x.title) : []);
    const genHot = async () => {
      if (!props.ask) return;
      setBusy("hot");
      try {
        const r = await props.ask(hotSystem(uName, props.worldHint ? props.worldHint() : "", new Date().toLocaleDateString()), HOT_SHAPE);
        const topics = arr(r && r.topics).map(x => x && { title: S(x.title).replace(/^#/, "").slice(0, 20), heat: Math.max(0, Math.round(Number(x.heat) || 0)), about: S(x.about).slice(0, 80) }).filter(x => x && x.title).slice(0, 8);
        if (!topics.length) { toast("热门没刷出来，再点一次"); return; }
        save(Object.assign({}, dbRef.current, { hot: { day: todayKey(), topics } }));
        setPage(null); setTab("home");
      } catch (e) { toast("热门没刷出来：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    // 请TA们发：每人一条，各走自己那一整份料。
    // ⚠️拍好一条就落一条，不等最慢那个（群友 2026-10-07：「刷新会卡着刷不出来」——原来 Promise.all 要等五个人全回来，
    //   一个人的线路卡住，整批都看不见；再加一层 3 分钟的兜底，过了就当这个人这回没拍）
    const genChars = async ids => {
      const pick = ids.map(charOf).filter(Boolean).slice(0, PICK_MAX);
      if (!pick.length) return;
      const sk = skin;
      setBusy("chars"); setProg("0/" + pick.length);
      let done = 0;
      const names = [], failed = [];
      const toCp = {};   // 这一批里谁这条发在情侣号上
      const one = c => {
        const acc = (dbRef.current.accounts || {})[c.id] || {};
        const timeout = new Promise(res => setTimeout(() => res(null), 180000));
        // 有关系的优先，最多三个；没关系网就随便两个——不是每条都有人刷到，所以一半的时候不递
        const others = characters.filter(x => x.id !== c.id);
        const tied = others.filter(x => props.relOf && props.relOf(c.id, x.id));
        const friends = Math.random() < 0.5 ? (tied.length ? tied : others).slice().sort(() => Math.random() - 0.5).slice(0, tied.length ? 3 : 2)
          .map(x => ({ id: x.id, name: x.name, rel: props.relOf ? props.relOf(c.id, x.id) : "" })) : [];
        const newAcc = !(acc.bio || acc.niche);
        // 有情侣号的那位，三回里大约有一回这条发在情侣号上
        const cpHere = (dbRef.current.cps || {})[c.id];
        if (cpHere && togetherIds.indexOf(c.id) >= 0 && Math.random() < 0.33) toCp[c.id] = cpHere;
        return Promise.race([props.probeAs(c, charInstruction(acc.handle, sk, friends, acc, hotToday()) + (toCp[c.id] ? "\n这一条你不发在自己的号上，发在你和 " + uName + " 共用的情侣号「" + toCp[c.id].handle + "」上——拍的多半跟你俩有关，她也会看到。" : ""), shapeChar(sk, friends.length > 0, newAcc)).catch(() => null), timeout]).then(d => {
          done++; setProg(done + "/" + pick.length);
          if (!d || !S(d.scene)) { failed.push(c.name); return; }
          const accounts = Object.assign({}, dbRef.current.accounts);
          const handle = S((accounts[c.id] || {}).handle) || S(d.handle).slice(0, 20) || c.name;
          const prevAcc = accounts[c.id] || {};
          const hadAcc = !!(prevAcc.bio || prevAcc.niche);
          // 号的样子第一次定下来就不再改；粉丝慢慢涨：这条有多少赞，大概有个零头会关注
          accounts[c.id] = Object.assign({}, prevAcc, { handle },
            hadAcc ? {} : { bio: S(d.bio).slice(0, 60), niche: S(d.niche).slice(0, 20) },
            { followers: Math.max(0, Math.round(Number(hadAcc ? prevAcc.followers : d.followers) || 0)) + Math.round((Number(d.likes) || 0) * 0.01) });
          const cpA = toCp[c.id];
          const nv = mkVideo(d, cpA ? { by: "char", charId: c.id, author: cpA.handle, skin: sk, cp: c.id, withCharId: c.id } : { by: "char", charId: c.id, author: handle, skin: sk });
          arr(d.friends).forEach(f => {
            const fr = f && friends.find(x => x.name === S(f.name));
            if (fr && S(f.text)) nv.comments.push({ id: uid("cm"), name: S(((dbRef.current.accounts || {})[fr.id] || {}).handle) || fr.name, text: S(f.text).slice(0, 300), by: "char", charId: fr.id, ts: Date.now() });
          });
          save(Object.assign({}, dbRef.current, { accounts, videos: [nv].concat(dbRef.current.videos) }));
          names.push(c.name);
        });
      };
      try {
        await Promise.all(pick.map(one));
        if (names.length) toast(names.join("、") + " 发了新视频" + (failed.length ? "（" + failed.join("、") + " 这回没拍出来）" : ""));
        else toast("这一轮没发出来，再点一次试试");
        if (names.length) { setPage(p => p && p.kind === "refresh" ? null : p); setTab("home"); setFeed("follow"); posRef.current = {}; if (feedRef.current) feedRef.current.scrollTop = 0; }
      } finally { setBusy(null); setProg(""); }
    };
    // 刷几条路人的：一枪写完
    const genNpc = async () => {
      const sk = skin;
      setBusy("npc");
      try {
        const d = await props.ask(npcSystem(uName, String((profile && profile.persona) || "").slice(0, 600), NPC_BATCH, sk, hotToday()), shapeNpc(sk));
        const vids = arr(d && d.videos).filter(x => x && S(x.scene) && S(x.author)).map(x => mkVideo(x, { by: "npc", author: S(x.author).slice(0, 20), skin: sk }));
        if (!vids.length) { toast("这一批没刷出来，再点一次"); return; }
        addVideos(vids); setPage(null); setTab("home"); setFeed("rec");
        posRef.current = {}; if (feedRef.current) feedRef.current.scrollTop = 0;
      } catch (e) { toast("没刷出来：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(null); }
    };
    // 她评论：TA的视频，TA当着大家的面回不回
    const comment = async (id, text) => {
      const asAlt = onAlt ? altName : "";
      patchV(id, v => Object.assign({}, v, { comments: arr(v.comments).concat([{ id: uid("cm"), name: myName, text, by: "me", alt: !!asAlt, ts: Date.now() }]) }));
      const v = dbRef.current.videos.find(x => x.id === id);
      const c = v && v.by === "char" ? charOf(v.charId) : null;
      if (!c) return;
      setBusy("reply");
      try {
        const d = await props.probeAs(c, replyInstruction(v, uName, text, asAlt), REPLY_SHAPE);
        const r = S(d && d.reply).slice(0, 300);
        if (r) { patchV(id, x => Object.assign({}, x, { comments: arr(x.comments).concat([{ id: uid("cm"), name: v.author, text: r, by: "char", isAuthor: true, ts: Date.now() }]) })); note(v.author + " 回复了你：" + r); }
      } catch (e) { toast("TA没回上：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    // 她小号发的那条：几个人里随缘有一两个刷到。评了她看得见；认出来了只记在TA心里，她不会被告知
    const spotAlt = async (v, alt) => {
      // 一枪写完（她 2026-10-07 嫌贵）：随缘挑一两个人，各自一份短人设，各写各的评不评、认没认出来
      const pool = characters.slice().sort(() => Math.random() - 0.5).slice(0, 2).filter(() => Math.random() < 0.45);
      if (!pool.length || !props.ask) return;
      try {
        const r = await props.ask(spotSystem(v, alt, uName, pool, pool.map(props.briefFor)), SPOT_SHAPE, pool[0].id);
        arr(r && r.spots).forEach(d => {
          const c = d && pool.find(x => x.name === S(d.name)); if (!c) return;
          const cm = S(d.comment).slice(0, 300);
          const handle = S(((dbRef.current.accounts || {})[c.id] || {}).handle) || c.name;
          if (cm) { patchV(v.id, x => Object.assign({}, x, { comments: arr(x.comments).concat([{ id: uid("cm"), name: handle, text: cm, by: "char", charId: c.id, ts: Date.now() }]) })); note(handle + " 评论了你小号的视频：" + cm); }
          if (d.recognized === true && props.remember) props.remember([c.id], "你在「" + APP_NAME + "」上刷到一个叫「" + alt + "」的小号发的视频（拍的是：" + S(v.scene).slice(0, 60) + "），你觉得那是 " + uName + " 的小号" + (S(d.why) ? "——" + S(d.why).slice(0, 80) : "") + "。她不知道你认出来了。");
        });
      } catch (e) {}
    };

    // 她发一条：认识她的人刷到了
    const postMine = async d => {
      const v = mkVideo({ scene: d.scene, caption: d.caption, who: d.who, title: d.title, tags: (d.caption.match(/#([^\s#]+)/g) || []).map(x => x.slice(1)) }, { by: "me", author: myName, likes: 0, comments: [], skin });
      const co = d.withId ? charOf(d.withId) : null;
      if (co) { v.withCharId = co.id; v.withName = S(((dbRef.current.accounts || {})[co.id] || {}).handle) || co.name; }
      if (onAlt) v.alt = true;
      // 发在情侣号上：TA也是这个号的主人，画面默认你俩（画出来锁两张脸），TA当然会看到
      const cpChar = onCp ? charOf(cpId) : null;
      if (cpChar) { v.cp = cpId; if (!co) { v.withCharId = cpChar.id; } }
      addVideos([v]); setPage(null); setTab("me");
      if (onAlt) { spotAlt(v, altName); return; }   // 小号发的：悄悄的，不叫认识她的人来；但TA们自己刷到了另说
      // 合拍的那一位一定在（TA就在画面里），其余随缘两个
      const lead = cpChar || co;
      const pool = (lead ? [lead] : []).concat(characters.filter(c => !lead || c.id !== lead.id).sort(() => Math.random() - 0.5).slice(0, lead ? 2 : 3));
      if (!pool.length) return;
      setBusy("post");
      try {
        const r = await props.ask(mineSystem(v, uName, pool, pool.map(props.briefFor), co, cpChar ? { name: cpChar.name, handle: cps[cpId].handle } : null), (co || cpChar) ? MINE_SHAPE.replace(/\}$/, ',"crowd":[{"name":"","text":""}]}') : MINE_SHAPE, pool[0].id);
        const names = pool.map(c => c.name);
        const cms = arr(r && r.comments).filter(x => x && names.indexOf(S(x.name)) >= 0 && S(x.text))
          .map(x => { const c = pool.find(cc => cc.name === S(x.name)); return { id: uid("cm"), name: S(((dbRef.current.accounts || {})[c.id] || {}).handle) || c.name, text: S(x.text).slice(0, 300), by: "char", charId: c.id, ts: Date.now() }; });
        const likes = Math.max(0, Math.round(Number(r && r.likes) || 0));
        // 合拍的起哄：网友那几句（只有合拍才有）
        const crowd = (co || cpChar) ? normComments(r && r.crowd) : [];
        if (cpChar) save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [cpId]: Object.assign({}, (dbRef.current.cps || {})[cpId], { followers: ((((dbRef.current.cps || {})[cpId] || {}).followers) || 0) + Math.round(Math.max(0, Number(r && r.likes) || 0) * 0.02) }) }) }));
        patchV(v.id, x => Object.assign({}, x, { likes, plays: Math.max(likes * 8, likes), comments: cms.concat(crowd) }));
        cms.forEach(c => note(c.name + " 评论了你的视频：" + c.text));
      } catch (e) { toast("评论区还空着：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    const draw = async v => {
      setDrawing(v.id);
      try {
        const ref = v.withCharId && props.drawDuo ? await props.drawDuo(v.withCharId, v.scene) : await props.draw(v.by === "char" ? v.charId : null, v.scene, v.who);
        patchV(v.id, x => Object.assign({}, x, { img: ref }));
      }
      catch (e) { toast("没画出来：" + ((e && e.message) || "")); }
      finally { setDrawing(null); }
    };
    const like = v => patchV(v.id, x => Object.assign({}, x, { liked: !x.liked }));
    const fave = v => patchV(v.id, x => Object.assign({}, x, { faved: !x.faved }));

    // 两套各刷各的：没标皮的旧视频算竖屏那套
    const ofSkin = arr(db.videos).filter(v => vidSkin(v) === skin);
    const topicHit = v => !topic || [v.caption, v.title, v.scene].concat(arr(v.tags)).some(x => String(x || "").indexOf(topic) >= 0);
    const list = ofSkin.filter(v => v.by !== "me" && (feed === "rec" || v.by === "char") && topicHit(v));
    const hot = db.hot && db.hot.day === todayKey() ? arr(db.hot.topics) : [];
    // 热门那一条：横着一排，点一个只看沾这个话题的，再点一下放开
    const hotStrip = (ink, dim, bg) => hot.length ? h("div", { className: "flex items-center", style: { gap: 8, overflowX: "auto", padding: "4px 12px 6px", whiteSpace: "nowrap", background: bg } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: P.accent, flexShrink: 0 } }, "热门"),
      hot.map(x => h("button", { key: x.title, onClick: () => setTopic(t2 => t2 === x.title ? "" : x.title), className: "active:opacity-60 shrink-0",
        style: { fontFamily: F_BODY, fontSize: 12, color: topic === x.title ? P.accent : ink, fontWeight: topic === x.title ? 700 : 400, minHeight: 28, textShadow: skin === "v" ? "0 1px 3px rgba(0,0,0,.6)" : "none" } }, "#" + x.title))) : null;
    // 大号、小号、情侣号各看各的作品；情侣号里TA发的也算
    const mine = onCp ? ofSkin.filter(v => v.cp === cpId) : ofSkin.filter(v => v.by === "me" && !v.cp && !!v.alt === onAlt);
    const unread = arr(db.notes).filter(n => n.unread).length;

    // 全屏的那几页
    if (page && page.kind === "comments") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(CommentsPage, { v, t, P, busy: busy === "reply", onSend: x => comment(v.id, x), onBack: () => setPage(page.back || null) });
    }
    if (page && page.kind === "bdetail") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(BDetail, { v, charOf, busy: busy === "reply", onBack: () => setPage(page.back || null), onLike: () => like(v), onFave: () => fave(v),
        onDraw: props.canDraw ? () => draw(v) : null, drawing: drawing === v.id, onSend: x => comment(v.id, x),
        onShare: props.onShare ? () => setPage({ kind: "share", id: v.id, back: page }) : null,
        onAuthor: v.by === "char" ? () => setPage({ kind: "acct", charId: v.charId, back: page }) : null });
    }
    // TA的号（第 5 条）：主页简介、平时发什么、粉丝，下面是这个号发过的（当前这套皮的）
    if (page && page.kind === "acct") {
      const c = charOf(page.charId), acc = (db.accounts || {})[page.charId] || {};
      const vids = ofSkin.filter(v => v.by === "char" && v.charId === page.charId);
      if (c) return h("div", { className: "h-full flex flex-col", style: { background: P.bg } },
        h(Head, { zh: acc.handle || c.name, bg: "transparent", ink: P.ink, onBack: () => setPage(page.back || null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: 20 } },
          h("div", { className: "flex items-center", style: { gap: 14, marginTop: 6 } },
            h(Avatar, { character: c, size: 64 }),
            h("div", { className: "flex", style: { gap: 18 } },
              [[vids.length, "作品"], [vids.reduce((n, v) => n + (Number(v.likes) || 0), 0), "获赞"], [acc.followers || 0, "粉丝"]].map(x => h("div", { key: x[1] },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: P.ink } }, fmtN(x[0])),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim } }, x[1]))))),
          acc.bio ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.ink, marginTop: 12, lineHeight: 1.6 } }, acc.bio) : null,
          acc.niche ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: P.dim, marginTop: 4 } }, "平时发：" + acc.niche) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "18px 0 8px" } }, "作品"),
          vids.length ? h("div", { style: { display: "grid", gridTemplateColumns: skin === "b" ? "1fr 1fr" : "repeat(3,1fr)", gap: skin === "b" ? 8 : 3 } }, vids.map(v => skin === "b"
            ? h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id, back: page }) })
            : h("button", { key: v.id, onClick: () => setPage({ kind: "comments", id: v.id, back: page }), className: "active:opacity-80", style: { position: "relative", aspectRatio: "3 / 4", overflow: "hidden", background: coverBg(v), textAlign: "left", padding: 6 } },
              !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.caption || v.scene) : null,
              h("div", { style: { position: "absolute", left: 6, bottom: 4, fontFamily: F_BODY, fontSize: 10.5, color: INK, textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, "赞 " + fmtN(v.likes))))) :
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.dim, textAlign: "center", padding: "30px 0" } }, "这套里还没发过")));
    }
    // 分享给 TA（她 2026-10-07 选的第 3 条）：挑人，开过小房间的再挑发进哪间。落一张卡，不让TA当场开口
    if (page && page.kind === "share") {
      const v = db.videos.find(x => x.id === page.id);
      const roomsOf = c => (window.ChatRooms && c ? window.ChatRooms.list(c.id).filter(r => r && !r.main) : []);
      const done = (c, rid) => { props.onShare(v, c, rid); setPage(page.back || null); };
      if (v) return h("div", { className: "h-full flex flex-col", style: { background: P.bg } },
        h(Head, { zh: page.to ? "发到 " + page.to.name + " 的哪儿" : "分享给谁", bg: "transparent", ink: P.ink, onBack: () => page.to ? setPage(Object.assign({}, page, { to: null })) : setPage(page.back || null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
          page.to ? [{ id: "main", name: "主聊天" }].concat(roomsOf(page.to)).map(r => h("button", { key: r.id, onClick: () => done(page.to, r.id), className: "w-full text-left active:opacity-70",
            style: { minHeight: 46, padding: "0 14px", marginTop: 8, borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, fontFamily: F_BODY, fontSize: 14 } }, r.id === "main" ? "主聊天" : "小房间「" + (r.name || "没起名的房间") + "」"))
          : h("div", { className: "flex flex-wrap", style: { gap: 14, marginTop: 12 } }, characters.map(c => h("button", { key: c.id, onClick: () => roomsOf(c).length ? setPage(Object.assign({}, page, { to: c })) : done(c, "main"),
            className: "active:opacity-70 flex flex-col items-center", style: { width: 60 } }, h(Avatar, { character: c, size: 48 }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.ink, marginTop: 4, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name))))));
    }
    if (page && page.kind === "refresh") return h(RefreshPage, { characters, t, P, busy, prog, onHot: props.ask ? genHot : null, hotDay: hot.length > 0, onNpc: genNpc, onChars: genChars, onBack: () => setPage(null) });
    if (page && page.kind === "post") return h(PostPage, { P, skin, characters, onAlt: onAlt || onCp, busy: busy === "post", onPost: postMine, onLive: () => { setPage(null); setLiveStart("setup:host"); setTab("live"); }, onBack: () => setPage(null) });

    // ⚠️点进评论／播放页是整页换掉的，回来时首页重新挂一遍——原来就从第一条开始了
    //   （群友 2026-10-07：「每次点视频的评论，看完了又会回到第一条」）。按「哪一格哪一套」记住滑到哪儿，挂回来时放回去。
    //   竖屏记的是第几条（格高可能变），横屏记像素。
    const posKey = (page && page.kind === "mine" ? "mine" : tab + "|" + feed) + "|" + skin;
    const keepPos = (el, unit) => {
      if (!el || el.__posKept) return;
      el.__posKept = true;
      const at = posRef.current[posKey] || 0;
      if (at) requestAnimationFrame(() => { el.scrollTop = unit ? at * unit : at; });
    };
    const feedView = (vids, empty) => h("div", { ref: el => { feedRef.current = el; keepPos(el, paneH); },
      onScroll: e => { posRef.current[posKey] = Math.round(e.currentTarget.scrollTop / (paneH || 1)); }, className: "flex-1 min-h-0", style: { overflowY: "auto", scrollSnapType: "y mandatory", background: BLACK } },
      vids.length ? vids.map(v => h(VideoPane, { key: v.id, v, height: paneH, charOf,
        onLike: () => like(v), onFave: () => fave(v),
        onComments: () => setPage({ kind: "comments", id: v.id, back: page }),
        onShare: props.onShare ? () => setPage({ kind: "share", id: v.id, back: page }) : null,
        onAuthor: v.by === "char" ? () => setPage({ kind: "acct", charId: v.charId, back: page }) : null,
        onDraw: props.canDraw ? () => draw(v) : null, drawing: drawing === v.id })) : empty);
    const gridView = (vids, empty) => h("div", { ref: el => keepPos(el, 0), onScroll: e => { posRef.current[posKey] = e.currentTarget.scrollTop; }, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 8px 14px", background: B.bg } },
      vids.length ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, vids.map(v => h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id, back: page }) }))) : empty);
    const emptyFeed = h("div", { style: { height: "100%", minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 30px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: P.dim, textAlign: "center", lineHeight: 1.6 } }, feed === "follow" ? "你关注的人还没发过视频" : "还什么都没有"),
      h("button", { onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-70", style: { minHeight: 42, padding: "0 22px", borderRadius: 999, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: 13.5 } }, "刷一刷"));

    // 「我」那一格点进自己的作品
    if (page && page.kind === "mine") return h("div", { className: "h-full flex flex-col", style: { background: P.bg } },
      h(Head, { zh: "我的作品", bg: "transparent", ink: P.ink, onBack: () => setPage(null) }),
      skin === "b" ? gridView(mine, null) : feedView(mine, null));

    const feedTabs = (ink, dim, bar) => [["follow", "关注"], ["rec", "推荐"]].map(f => h("button", { key: f[0], onClick: () => setFeed(f[0]), className: "active:opacity-60 flex flex-col items-center", style: { minHeight: 36 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 16, color: feed === f[0] ? ink : dim, fontWeight: feed === f[0] ? 700 : 400, textShadow: skin === "v" ? "0 1px 3px rgba(0,0,0,.5)" : "none" } }, f[1]),
      h("span", { style: { width: 18, height: 2.5, borderRadius: 2, marginTop: 4, background: feed === f[0] ? bar : "transparent" } })));
    let body;
    if (tab === "home" && skin === "v") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { position: "relative", background: BLACK } },
      // 顶上那两个字：关注 / 推荐，浮在画面上
      h("div", { "data-wk": "head", className: "flex items-center justify-center", style: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3, paddingTop: safeTop(8), paddingBottom: 6, gap: 26 } },
        props.onBack ? h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50", style: { position: "absolute", left: 10, bottom: 2, width: 40, height: 40, color: INK } }, h(IArrow, { size: 20, color: INK })) : null,
        h("div", { className: "flex flex-col items-center" }, h("div", { className: "flex items-center", style: { gap: 26 } }, feedTabs(INK, DIM, INK)), hotStrip(INK, DIM, "transparent")),
        h("button", { onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-60", style: { position: "absolute", right: 12, bottom: 6, minHeight: 32, padding: "0 10px", borderRadius: 999, background: "rgba(0,0,0,.28)", color: INK, fontFamily: F_BODY, fontSize: 12.5 } }, "刷新")),
      feedView(list, emptyFeed));
    else if (tab === "home") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { background: B.bg } },
      // 横屏那套的顶栏：白底，左边返回、中间关注推荐、右边刷新——不浮在画面上
      h("div", { "data-wk": "head", className: "shrink-0 flex items-center justify-center", style: { position: "relative", background: B.card, paddingTop: safeTop(6), paddingBottom: 4, gap: 26, borderBottom: "1px solid " + B.line } },
        props.onBack ? h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50", style: { position: "absolute", left: 8, bottom: 0, width: 40, height: 40 } }, h(IArrow, { size: 20, color: B.ink })) : null,
        h("div", { className: "flex flex-col items-center", style: { maxWidth: "70%" } }, h("div", { className: "flex items-center", style: { gap: 26 } }, feedTabs(B.ink, B.dim, B.accent)), hotStrip(B.ink, B.dim, "transparent")),
        h("button", { onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-60", style: { position: "absolute", right: 10, bottom: 4, minHeight: 32, padding: "0 12px", borderRadius: 999, background: B.bg, color: B.accent, fontFamily: F_BODY, fontSize: 12.5 } }, "刷新")),
      gridView(list, emptyFeed));
    else if (tab === "live") body = h("div", { className: "flex-1 min-h-0 flex flex-col" },
      window.LiveApp ? h(window.LiveApp, Object.assign({}, props.live, { key: "live_" + liveStart, embedded: true, startView: liveStart || "home" })) : null);
    else if (tab === "msg") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { background: P.bg } },
      h(Head, { zh: "消息", bg: "transparent", ink: P.ink, right: unread ? h("button", { onClick: () => save(Object.assign({}, dbRef.current, { notes: dbRef.current.notes.map(n => Object.assign({}, n, { unread: false })) })), style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, minHeight: 40 } }, "全部已读") : null }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4" },
        arr(db.notes).length ? arr(db.notes).map(n => h("div", { key: n.id, style: { padding: "12px 0", borderBottom: "1px solid " + P.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: n.unread ? P.ink : P.dim, lineHeight: 1.55 } }, (n.unread ? "● " : "") + n.text),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: P.dim, marginTop: 3 } }, new Date(n.ts).toLocaleString()))) :
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.dim, textAlign: "center", padding: "50px 0" } }, "还没有人找你")));
    else body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { background: skin === "b" ? "linear-gradient(180deg,#ffe4ec 0," + B.bg + " 220px)" : "linear-gradient(180deg,#2a1d33 0,#0b0b0e 260px)" } },
      h(Head, { zh: myName, bg: "transparent", ink: P.ink }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 20 } },
        h("div", { className: "flex items-center", style: { gap: 14, marginTop: 6 } },
          h(Avatar, { character: { name: uName, avatarImage: profile && profile.avatarImage }, size: 70 }),
          h("div", { className: "flex", style: { gap: 20 } },
            [[mine.length, "作品"], [mine.reduce((n, v) => n + (Number(v.likes) || 0), 0), "获赞"], [onCp ? (cps[cpId].followers || 0) : onAlt ? 0 : characters.length, "粉丝"]].map(x => h("div", { key: x[1] },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: P.ink } }, fmtN(x[0])),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim } }, x[1]))))),
        h("input", { key: "h_" + skin, defaultValue: S(db.me && db.me.handle), placeholder: "账号名（默认用你的名字）", onBlur: e => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { handle: e.target.value.trim().slice(0, 20) }) })),
          className: "w-full outline-none", style: { marginTop: 14, minHeight: 38, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: 13 } }),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 8 } },
          h("input", { key: "alt_" + skin, defaultValue: altName, placeholder: "小号叫什么（不填就没有小号）", onBlur: e => { const v = e.target.value.trim().slice(0, 20); save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { altHandle: v, using: v ? (dbRef.current.me || {}).using : "main" }) })); },
            className: "flex-1 outline-none", style: { minHeight: 38, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: 13 } }),
          altName ? h("button", { onClick: () => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { using: onAlt ? "main" : "alt" }) })), className: "active:opacity-70 shrink-0",
            style: { minHeight: 38, padding: "0 12px", borderRadius: 10, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: 12.5 } }, onAlt ? "切回大号" : "切到小号") : null),
        // 情侣号：在一起的那几位各一行。没开过就「开一个」，开过就「切过去」；正用着时一颗「切回大号」
        togetherIds.length ? h("div", { style: { marginTop: 12 } }, togetherIds.map(id => {
          const c = charOf(id); if (!c) return null;
          const a = cps[id];
          return h("div", { key: id, className: "flex items-center", style: { gap: 8, marginTop: 6 } },
            h(Avatar, { character: c, size: 26 }),
            a ? h("input", { key: "cp_" + id, defaultValue: a.handle, onBlur: e => { const v = e.target.value.trim().slice(0, 20); if (v) save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: Object.assign({}, a, { handle: v }) }) })); },
              className: "flex-1 outline-none", style: { minHeight: 36, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 10px", fontFamily: F_BODY, fontSize: 12.5 } })
              : h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, color: P.dim } }, "和 " + c.name + " 的情侣号"),
            h("button", { onClick: () => {
                const me2 = Object.assign({}, dbRef.current.me);
                if (!a) { save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: { handle: (S(dbRef.current.me && dbRef.current.me.handle) || uName) + "和" + c.name, followers: 0, ts: Date.now() } }), me: Object.assign(me2, { using: "cp:" + id }) })); return; }
                save(Object.assign({}, dbRef.current, { me: Object.assign(me2, { using: cpId === id ? "main" : "cp:" + id }) }));
              }, className: "active:opacity-70 shrink-0", style: { minHeight: 36, padding: "0 12px", borderRadius: 10, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: 12 } },
              !a ? "开一个" : cpId === id ? "切回大号" : "切过去"));
        })) : null,
        onCp ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim, marginTop: 6, lineHeight: 1.5 } }, "现在用的是情侣号「" + cps[cpId].handle + "」：发的视频是你俩的，画面默认你俩一起，" + (charOf(cpId) || {}).name + " 也会在自己号的评论区接。作品里也有 TA 发在这个号上的。") : null,
        onAlt ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim, marginTop: 6, lineHeight: 1.5 } }, "现在用的是小号「" + altName + "」：发的视频不会叫认识你的人来看，评 TA 的视频 TA 也不知道是你。") : null,
        // 首页样子：跟论坛「首页排版」同一个位置、同一个道理——两套视频，各刷各的
        h("div", { className: "flex items-center justify-between", style: { marginTop: 14, padding: "10px 12px", borderRadius: 12, background: P.field, border: "1px solid " + P.line } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.ink } }, "首页样子"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: P.dim, marginTop: 2 } }, "两种是两套视频，切过去刷的是另一套")),
          h("div", { className: "flex", style: { borderRadius: 999, overflow: "hidden", border: "1px solid " + P.line } },
            [["v", "竖着刷"], ["b", "横着看"]].map(o => h("button", { key: o[0], onClick: () => { save(Object.assign({}, dbRef.current, { skin: o[0] })); setFeed("rec"); }, className: "active:opacity-60",
              style: { minHeight: 32, padding: "0 14px", fontFamily: F_BODY, fontSize: 12.5, background: skin === o[0] ? P.accent : "transparent", color: skin === o[0] ? "#fff" : P.dim } }, o[1])))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "20px 0 8px" } }, "作品"),
        mine.length ? h("div", { style: { display: "grid", gridTemplateColumns: skin === "b" ? "1fr 1fr" : "repeat(3,1fr)", gap: skin === "b" ? 8 : 3 } }, mine.map(v => skin === "b"
          ? h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id }) })
          : h("button", { key: v.id, onClick: () => setPage({ kind: "mine" }), className: "active:opacity-80", style: { position: "relative", aspectRatio: "3 / 4", overflow: "hidden", background: coverBg(v), textAlign: "left", padding: 6 } },
            !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.caption || v.scene) : null,
            h("div", { style: { position: "absolute", left: 6, bottom: 4, fontFamily: F_BODY, fontSize: 10.5, color: INK, textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, "赞 " + fmtN(v.likes))))) :
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: P.dim, textAlign: "center", padding: "30px 0" } }, "还没发过，点底栏中间的 ＋")));

    // 底栏：真的短视频 app 就是这么分的——中间那颗是「拍」，不是一个普通 tab
    const tabBtn = (k, label) => h("button", { key: k, onClick: () => { setTab(k); if (k !== "live") setLiveStart(""); }, className: "flex-1 active:opacity-60 flex flex-col items-center justify-center", style: { minHeight: 48, position: "relative" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: tab === k ? (skin === "b" ? P.accent : P.ink) : P.dim, fontWeight: tab === k ? 700 : 400 } }, label),
      k === "msg" && unread ? h("span", { style: { position: "absolute", top: 8, right: "22%", minWidth: 16, height: 16, borderRadius: 99, background: P.accent, color: "#fff", fontSize: 10, lineHeight: "16px", textAlign: "center", padding: "0 4px" } }, unread > 99 ? "99+" : unread) : null);
    const barBg = skin === "b" ? B.card : BLACK;
    return h("div", { className: "h-full flex flex-col", style: { background: barBg } },
      body,
      h("div", { className: "shrink-0 flex items-center", style: { background: barBg, borderTop: "1px solid " + P.line, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4)" } },
        tabBtn("home", "首页"), tabBtn("live", "直播"),
        h("button", { onClick: () => setPage({ kind: "post" }), "aria-label": "发一条", className: "active:opacity-70 flex items-center justify-center", style: { flex: 1, minHeight: 48 } },
          skin === "b"
            ? h("span", { style: { width: 40, height: 30, borderRadius: 10, background: B.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: 20, lineHeight: "30px", textAlign: "center" } }, "+")
            : h("span", { style: { width: 42, height: 28, borderRadius: 8, background: "linear-gradient(90deg,#25f4ee 0 4px,#fff 4px calc(100% - 4px),#fe2c55 calc(100% - 4px))", color: BLACK, fontFamily: F_DISPLAY, fontSize: 20, lineHeight: "28px", textAlign: "center" } }, "+")),
        tabBtn("msg", "消息"), tabBtn("me", "我")));
  }

  // ── 分享卡：聊天里那一张（单聊、群聊走同一条 shareCardOf）──────────
  const shareSnap = v => ({ author: v.author, title: v.title || "", scene: v.scene, caption: v.caption, tags: arr(v.tags), img: v.img || "", skin: vidSkin(v), by: v.by, charId: v.charId || null, likes: v.likes || 0 });
  // TA读到的那一段：视频长什么样照抄；是TA自己的那条就说一声
  const shareText = (snap, toCharId, fromName) => "[" + (fromName ? fromName + "从「" + APP_NAME + "」甩来一条视频" : "转发了一条「" + APP_NAME + "」上的视频") + "]"
    + "作者 @" + snap.author + (snap.title ? "｜标题《" + snap.title + "》" : "") + "｜视频里拍的是：" + snap.scene + (snap.caption ? "｜文案：" + snap.caption : "")
    + (snap.tags.length ? "｜" + snap.tags.map(x => "#" + x).join(" ") : "") + "｜" + snap.likes + " 赞"
    + (toCharId && snap.by === "char" && snap.charId === toCharId ? "｜（这就是你自己发的那条）" : "");
  function ShuaShareCard({ m }) {
    const v = m.shua || {};
    const src = v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
    return h("div", { style: { width: 220, maxWidth: "100%", borderRadius: 12, overflow: "hidden", background: "#111", border: "1px solid rgba(0,0,0,.08)" } },
      h("div", { style: { position: "relative", aspectRatio: v.skin === "b" ? "16 / 10" : "3 / 4", maxHeight: 240, background: src ? "center/cover no-repeat url(\"" + src + "\")" : "linear-gradient(160deg,#3b2a4a,#111)", padding: 10 } },
        !src ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,.9)", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 10px 8px", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.7))" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#fff", fontWeight: 600 } }, "@" + (v.author || "")),
          (v.title || v.caption) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,.88)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || v.caption) : null)),
      h("div", { style: { padding: "5px 10px", fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.6)", background: "#111" } }, APP_NAME + " · " + fmtN(v.likes) + " 赞"));
  }
  window.ShuaShareCard = ShuaShareCard;
  window.ShuaApp = ShuaApp;
  window.ShuaKit = { shareSnap, shareText, APP_NAME, PAL, charInstruction, npcSystem, replyInstruction, mineSystem, mkVideo, vidSkin };
})();
