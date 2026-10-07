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
  const skinOf = v => v && v.skin === "b" ? "b" : "v";

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
  const B_SHAPE_ADD = ',"title":"","intro":"","dur":"08:24","plays":0,"zone":"","dms":[""]';
  const CHAR_SHAPE = '{"handle":"","scene":"","who":"self","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}';
  function charInstruction(handle, skin) {
    return "你在一个叫「" + APP_NAME + "」的短视频平台上有账号" + (handle ? "，账号名「" + handle + "」" : "") + "。你现在发一条新视频。"
      + "拍什么、怎么拍、配什么文案，都从你此刻真实的生活和你这个人身上长出来——你今天在干嘛、最近心里装着什么、你这种人平时会不会发这种。"
      + "\n写：账号名 handle（" + (handle ? "照旧填「" + handle + "」" : "你会给自己起的那个") + "）、视频里拍了什么 scene（镜头里看得见的画面，2~4 句，像在讲一段视频怎么走）、"
      + "画面里有没有你 who（self 本人出镜 / part 只露手或背影 / none 没有人）、文案 caption、话题 tags（0~4 个，不带井号）、点赞数 likes（数字，照你这个号该有的热度）、"
      + "底下的评论 comments（3~6 条：name 是刷到这条的网友的网名，text 是他们说的话；各人各说各的，不是一个调子）。"
      + (skin === "b" ? B_EXTRA : "");
  }
  const NPC_SHAPE = '{"videos":[{"author":"","scene":"","who":"none","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}]}';
  function npcSystem(uName, persona, n, skin) {
    return AC() + CB()
      + "【场景】" + uName + "在刷「" + APP_NAME + "」的推荐流，刷到的是 " + n + " 个互不相识的博主各发的一条视频。"
      + (persona ? "\n推荐流会跟她平时在意的东西沾一点边，但不是全都对口——她是这样一个人：" + persona : "")
      + "\n\n每条一个不同的博主。题材、拍法、口吻、热度各不一样：有大号有小号，有认真做内容的也有随手一拍的。"
      + "\n写 videos（" + n + " 条），每条：author 博主网名、scene 视频里拍了什么（2~4 句，像在讲一段视频怎么走）、who 画面里有没有人（self 博主本人出镜 / part 只露手或背影 / none 没有人）、"
      + "caption 文案、tags 话题（0~4 个，不带井号）、likes 点赞数（数字）、comments 评论（2~5 条，name 网友网名，text）。"
      + (skin === "b" ? B_EXTRA.replace("\n这是", "\n这个推荐流是在") : "");
  }
  const REPLY_SHAPE = '{"reply":""}';
  function replyInstruction(v, uName, text) {
    return "你在「" + APP_NAME + "」上发的那条视频——拍的是：" + v.scene + "；文案：" + v.caption + "。"
      + "\n底下" + uName + "用她自己的号评论了你：「" + text + "」。评论区别人都看得见。"
      + "\n你回不回、怎么回（当着所有人的面），照你这个人来；不想回就把 reply 留空。";
  }
  const MINE_SHAPE = '{"comments":[{"name":"","text":""}],"likes":0}';
  function mineSystem(v, uName, chars, briefs) {
    return AC() + CB()
      + "【场景】" + uName + "在「" + APP_NAME + "」上发了一条视频。拍的是：" + v.scene + "\n文案：" + (v.caption || "（没写）")
      + "\n\n下面这几个人都认识她，都刷到了这条。各自照自己的性子决定评不评、评什么——评论区是公开的，别人都看得见；谁跟她什么关系、此刻什么心情，决定他当着别人怎么说。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n写：comments（name 只能是：" + chars.map(c => c.name).join("、") + "；不想评的人就不写）、likes（这条视频的点赞数，数字）。";
  }

  // ── 一条视频（整屏那一格）─────────────────────────────────
  function VideoPane({ v, charOf, onLike, onFave, onComments, onDraw, drawing, height }) {
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
        h("div", { style: { width: 46, height: 46, borderRadius: 99, border: "2px solid #fff", overflow: "hidden", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY } },
          ch ? h(Avatar, { character: ch, size: 42 }) : S(v.author).slice(0, 1)),
        railBtn(c => h(IHeart, { size: 30, color: c, filled: true }), fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike, "l"),
        railBtn(c => h(Svg, { size: 30, color: c, sw: 1.8 }, h("path", { d: "M4 5.5h16v10.5H10l-4.5 3.5V16H4z" })), fmtN(arr(v.comments).length), false, onComments, "c"),
        railBtn(c => h(Svg, { size: 30, color: c, sw: 1.8 }, h("path", { fill: c === RED ? c : "none", d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z" })), v.faved ? "已收藏" : "收藏", v.faved, onFave, "f"),
        onDraw ? railBtn(c => h(IPencil, { size: 28, color: c }), drawing ? "画着…" : (src ? "重画" : "画出来"), false, drawing ? null : onDraw, "d") : null),
      h("div", { style: { position: "absolute", left: 14, right: 72, bottom: 22 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: INK, fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, "@" + (v.author || "")),
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
  function RefreshPage({ characters, busy, onNpc, onChars, onBack, t, P }) {
    const [pick, setPick] = useState(characters.slice(0, 3).map(c => c.id));
    const toggle = id => setPick(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]).slice(0, PICK_MAX));
    const big = (title, sub, fn, dis) => h("button", { onClick: fn, disabled: dis, className: "w-full text-left active:opacity-80", style: { borderRadius: 16, padding: "16px 18px", background: dis ? P.field : "linear-gradient(120deg,#fe2c55,#7a3cff)", color: "#fff", opacity: dis ? .5 : 1 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17 } }, title), h("div", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .85, marginTop: 4 } }, sub));
    return h("div", { className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: "刷新", bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        h("div", { style: { marginTop: 8 } }, big(busy === "npc" ? "正在刷…" : "刷几条路人的", "推荐流里互不认识的博主，一次 " + NPC_BATCH + " 条（调一次模型）", onNpc, !!busy)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: P.dim, margin: "22px 0 10px" } }, "请谁发（每人一条，最多 " + PICK_MAX + " 个）"),
        h("div", { className: "flex flex-wrap", style: { gap: 12 } }, characters.map(c => {
          const on = pick.indexOf(c.id) >= 0;
          return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 58, opacity: on ? 1 : .45 } },
            h("div", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (on ? P.accent : "transparent") } }, h(Avatar, { character: c, size: 46 })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.ink, marginTop: 4, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name));
        })),
        h("div", { style: { marginTop: 14 } }, big(busy === "chars" ? "TA们在拍…" : "请TA们发", "挑中的人各发一条，照TA此刻的生活来", () => onChars(pick), !!busy || !pick.length))));
  }

  // ── 发一条（＋）──────────────────────────────────────
  function PostPage({ busy, onPost, onLive, onBack, P, skin }) {
    const [scene, setScene] = useState(""), [caption, setCaption] = useState(""), [who, setWho] = useState("self"), [title, setTitle] = useState("");
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
        h("button", { disabled: !!busy || !scene.trim(), onClick: () => onPost({ scene: scene.trim(), caption: caption.trim(), who, title: title.trim() }),
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
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: B.dim, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (v.by === "char" ? "UP · " : "") + v.author)));
  }
  function BDetail({ v, charOf, busy, onBack, onLike, onFave, onDraw, drawing, onSend }) {
    const [text, setText] = useState("");
    const ch = v.charId ? charOf(v.charId) : null;
    const send = () => { const x = text.trim(); if (!x || busy) return; setText(""); onSend(x); };
    const act = (label, n, on, fn) => h("button", { onClick: fn, className: "flex-1 active:opacity-60 flex flex-col items-center", style: { color: on ? B.accent : B.dim, minHeight: 44 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 700 : 400 } }, label), h("span", { style: { fontFamily: F_BODY, fontSize: 11, marginTop: 2 } }, n));
    return h("div", { className: "h-full flex flex-col", style: { background: B.bg } },
      // 播放器那一块：黑底，画面（或那几句）＋飘过去的弹幕
      h("div", { className: "shrink-0", style: { position: "relative", background: "#000", paddingTop: safeTop(0) } },
        h("div", { style: { position: "relative", aspectRatio: "16 / 9", background: coverBg(v), overflow: "hidden" } },
          !imgOf(v) ? h("div", { style: { position: "absolute", left: 18, right: 18, top: "28%", fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.92)" } }, v.scene) : null,
          window.LiveKit && window.LiveKit.NoiseLayer ? h(window.LiveKit.NoiseLayer, { noise: v.dms, seed: v.id }) : null,
          h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60", style: { position: "absolute", left: 6, top: 4, width: 40, height: 40 } }, h(IArrow, { size: 20, color: "#fff" })))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: 10 } },
        h("div", { style: { background: B.card, padding: "12px 14px" } },
          h("div", { className: "flex items-center", style: { gap: 10 } },
            ch ? h(Avatar, { character: ch, size: 34 }) : h("div", { style: { width: 34, height: 34, borderRadius: 99, background: tint(v), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY } }, S(v.author).slice(0, 1)),
            h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: B.accent } }, v.author), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: B.dim } }, fmtN(v.plays) + " 播放" + (v.zone ? " · " + v.zone : "")))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: B.ink, marginTop: 10, lineHeight: 1.5 } }, v.title || v.caption),
          (v.intro || (v.title && v.caption)) ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: B.dim, marginTop: 6, lineHeight: 1.6 } }, v.intro || v.caption) : null,
          arr(v.tags).length ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, v.tags.map(x => h("span", { key: x, style: { fontFamily: F_BODY, fontSize: 11, color: B.dim, background: B.bg, borderRadius: 99, padding: "3px 9px" } }, x))) : null,
          h("div", { className: "flex", style: { marginTop: 10 } },
            act("点赞", fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike),
            act("收藏", v.faved ? "已收藏" : "收藏", v.faved, onFave),
            onDraw ? act(drawing ? "画着…" : (imgOf(v) ? "重画" : "画出来"), "封面", false, drawing ? null : onDraw) : null)),
        h("div", { style: { background: B.card, marginTop: 8, padding: "6px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: B.ink, padding: "8px 0" } }, "评论 " + arr(v.comments).length),
          arr(v.comments).map(c => h("div", { key: c.id, style: { padding: "9px 0", borderTop: "1px solid " + B.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: c.by === "me" ? B.accent : c.by === "char" ? "#d89a2b" : B.dim } }, c.name + (c.isAuthor ? " · UP" : "")),
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
    const [drawing, setDrawing] = useState(null);
    const [paneH, setPaneH] = useState(600);
    const feedRef = useRef(null);
    const uName = (profile && profile.name) || "我";
    const skin = db.skin === "b" ? "b" : "v";
    const P = PAL[skin];
    useEffect(function () { const el = feedRef.current; if (el && el.clientHeight && el.clientHeight !== paneH) setPaneH(el.clientHeight); });
    const save = next => { const n = Object.assign({}, next, { videos: arr(next.videos).slice(0, CAP), notes: arr(next.notes).slice(0, 100) }); dbRef.current = n; setDb(n); saveJSON(KEY, n); };
    const patchV = (id, fn) => save(Object.assign({}, dbRef.current, { videos: dbRef.current.videos.map(v => v.id === id ? fn(v) : v) }));
    const addVideos = list => save(Object.assign({}, dbRef.current, { videos: list.concat(dbRef.current.videos) }));
    const note = text => save(Object.assign({}, dbRef.current, { notes: [{ id: uid("n"), text, ts: Date.now(), unread: true }].concat(dbRef.current.notes) }));
    const charOf = id => characters.find(c => c.id === id);
    const myName = S(db.me && db.me.handle) || uName;
    const shapeChar = sk => sk === "b" ? CHAR_SHAPE.replace(/\}$/, B_SHAPE_ADD + "}") : CHAR_SHAPE;
    const shapeNpc = sk => sk === "b" ? NPC_SHAPE.replace('"comments":[{"name":"","text":""}]}]}', '"comments":[{"name":"","text":""}]' + B_SHAPE_ADD + '}]}') : NPC_SHAPE;

    // 请TA们发：每人一条，各走自己那一整份料
    const genChars = async ids => {
      const pick = ids.map(charOf).filter(Boolean).slice(0, PICK_MAX);
      if (!pick.length) return;
      const sk = skin;
      setBusy("chars");
      try {
        const got = await Promise.all(pick.map(c => {
          const acc = (dbRef.current.accounts || {})[c.id] || {};
          return props.probeAs(c, charInstruction(acc.handle, sk), shapeChar(sk)).then(d => ({ c, d })).catch(() => null);
        }));
        const ok = got.filter(x => x && x.d && S(x.d.scene));
        if (!ok.length) { toast("这一轮没发出来，再点一次试试"); return; }
        const accounts = Object.assign({}, dbRef.current.accounts);
        const vids = ok.map(({ c, d }) => {
          const handle = S((accounts[c.id] || {}).handle) || S(d.handle).slice(0, 20) || c.name;
          accounts[c.id] = Object.assign({}, accounts[c.id], { handle });
          return mkVideo(d, { by: "char", charId: c.id, author: handle, skin: sk });
        });
        save(Object.assign({}, dbRef.current, { accounts, videos: vids.concat(dbRef.current.videos) }));
        setPage(null); setTab("home"); setFeed("follow");
        if (feedRef.current) feedRef.current.scrollTop = 0;
        toast(ok.map(x => x.c.name).join("、") + " 发了新视频");
      } finally { setBusy(null); }
    };
    // 刷几条路人的：一枪写完
    const genNpc = async () => {
      const sk = skin;
      setBusy("npc");
      try {
        const d = await props.ask(npcSystem(uName, String((profile && profile.persona) || "").slice(0, 600), NPC_BATCH, sk), shapeNpc(sk));
        const vids = arr(d && d.videos).filter(x => x && S(x.scene) && S(x.author)).map(x => mkVideo(x, { by: "npc", author: S(x.author).slice(0, 20), skin: sk }));
        if (!vids.length) { toast("这一批没刷出来，再点一次"); return; }
        addVideos(vids); setPage(null); setTab("home"); setFeed("rec");
        if (feedRef.current) feedRef.current.scrollTop = 0;
      } catch (e) { toast("没刷出来：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(null); }
    };
    // 她评论：TA的视频，TA当着大家的面回不回
    const comment = async (id, text) => {
      patchV(id, v => Object.assign({}, v, { comments: arr(v.comments).concat([{ id: uid("cm"), name: myName, text, by: "me", ts: Date.now() }]) }));
      const v = dbRef.current.videos.find(x => x.id === id);
      const c = v && v.by === "char" ? charOf(v.charId) : null;
      if (!c) return;
      setBusy("reply");
      try {
        const d = await props.probeAs(c, replyInstruction(v, uName, text), REPLY_SHAPE);
        const r = S(d && d.reply).slice(0, 300);
        if (r) { patchV(id, x => Object.assign({}, x, { comments: arr(x.comments).concat([{ id: uid("cm"), name: v.author, text: r, by: "char", isAuthor: true, ts: Date.now() }]) })); note(v.author + " 回复了你：" + r); }
      } catch (e) { toast("TA没回上：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    // 她发一条：认识她的人刷到了
    const postMine = async d => {
      const v = mkVideo({ scene: d.scene, caption: d.caption, who: d.who, title: d.title, tags: (d.caption.match(/#([^\s#]+)/g) || []).map(x => x.slice(1)) }, { by: "me", author: myName, likes: 0, comments: [], skin });
      addVideos([v]); setPage(null); setTab("me");
      const pool = characters.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      if (!pool.length) return;
      setBusy("post");
      try {
        const r = await props.ask(mineSystem(v, uName, pool, pool.map(props.briefFor)), MINE_SHAPE, pool[0].id);
        const names = pool.map(c => c.name);
        const cms = arr(r && r.comments).filter(x => x && names.indexOf(S(x.name)) >= 0 && S(x.text))
          .map(x => { const c = pool.find(cc => cc.name === S(x.name)); return { id: uid("cm"), name: S(((dbRef.current.accounts || {})[c.id] || {}).handle) || c.name, text: S(x.text).slice(0, 300), by: "char", charId: c.id, ts: Date.now() }; });
        const likes = Math.max(0, Math.round(Number(r && r.likes) || 0));
        patchV(v.id, x => Object.assign({}, x, { likes, plays: Math.max(likes * 8, likes), comments: cms }));
        cms.forEach(c => note(c.name + " 评论了你的视频：" + c.text));
      } catch (e) { toast("评论区还空着：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    const draw = async v => {
      setDrawing(v.id);
      try { const ref = await props.draw(v.by === "char" ? v.charId : null, v.scene, v.who); patchV(v.id, x => Object.assign({}, x, { img: ref })); }
      catch (e) { toast("没画出来：" + ((e && e.message) || "")); }
      finally { setDrawing(null); }
    };
    const like = v => patchV(v.id, x => Object.assign({}, x, { liked: !x.liked }));
    const fave = v => patchV(v.id, x => Object.assign({}, x, { faved: !x.faved }));

    // 两套各刷各的：没标皮的旧视频算竖屏那套
    const ofSkin = arr(db.videos).filter(v => skinOf(v) === skin);
    const list = ofSkin.filter(v => v.by !== "me" && (feed === "rec" || v.by === "char"));
    const mine = ofSkin.filter(v => v.by === "me");
    const unread = arr(db.notes).filter(n => n.unread).length;

    // 全屏的那几页
    if (page && page.kind === "comments") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(CommentsPage, { v, t, P, busy: busy === "reply", onSend: x => comment(v.id, x), onBack: () => setPage(page.back || null) });
    }
    if (page && page.kind === "bdetail") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(BDetail, { v, charOf, busy: busy === "reply", onBack: () => setPage(page.back || null), onLike: () => like(v), onFave: () => fave(v),
        onDraw: props.canDraw ? () => draw(v) : null, drawing: drawing === v.id, onSend: x => comment(v.id, x) });
    }
    if (page && page.kind === "refresh") return h(RefreshPage, { characters, t, P, busy, onNpc: genNpc, onChars: genChars, onBack: () => setPage(null) });
    if (page && page.kind === "post") return h(PostPage, { P, skin, busy: busy === "post", onPost: postMine, onLive: () => { setPage(null); setLiveStart("setup:host"); setTab("live"); }, onBack: () => setPage(null) });

    const feedView = (vids, empty) => h("div", { ref: feedRef, className: "flex-1 min-h-0", style: { overflowY: "auto", scrollSnapType: "y mandatory", background: BLACK } },
      vids.length ? vids.map(v => h(VideoPane, { key: v.id, v, height: paneH, charOf,
        onLike: () => like(v), onFave: () => fave(v),
        onComments: () => setPage({ kind: "comments", id: v.id, back: page }),
        onDraw: props.canDraw ? () => draw(v) : null, drawing: drawing === v.id })) : empty);
    const gridView = (vids, empty) => h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 8px 14px", background: B.bg } },
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
        feedTabs(INK, DIM, INK),
        h("button", { onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-60", style: { position: "absolute", right: 12, bottom: 6, minHeight: 32, padding: "0 10px", borderRadius: 999, background: "rgba(0,0,0,.28)", color: INK, fontFamily: F_BODY, fontSize: 12.5 } }, "刷新")),
      feedView(list, emptyFeed));
    else if (tab === "home") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { background: B.bg } },
      // 横屏那套的顶栏：白底，左边返回、中间关注推荐、右边刷新——不浮在画面上
      h("div", { "data-wk": "head", className: "shrink-0 flex items-center justify-center", style: { position: "relative", background: B.card, paddingTop: safeTop(6), paddingBottom: 4, gap: 26, borderBottom: "1px solid " + B.line } },
        props.onBack ? h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50", style: { position: "absolute", left: 8, bottom: 0, width: 40, height: 40 } }, h(IArrow, { size: 20, color: B.ink })) : null,
        feedTabs(B.ink, B.dim, B.accent),
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
            [[mine.length, "作品"], [mine.reduce((n, v) => n + (Number(v.likes) || 0), 0), "获赞"], [characters.length, "粉丝"]].map(x => h("div", { key: x[1] },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: P.ink } }, fmtN(x[0])),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: P.dim } }, x[1]))))),
        h("input", { key: "h_" + skin, defaultValue: S(db.me && db.me.handle), placeholder: "账号名（默认用你的名字）", onBlur: e => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { handle: e.target.value.trim().slice(0, 20) }) })),
          className: "w-full outline-none", style: { marginTop: 14, minHeight: 38, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: 13 } }),
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

  window.ShuaApp = ShuaApp;
  window.ShuaKit = { APP_NAME, PAL, charInstruction, npcSystem, replyInstruction, mineSystem, mkVideo, skinOf };
})();
