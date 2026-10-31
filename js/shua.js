// 片刻页面那半（2026-10-18 瘦身第八批）：开机那半在 js/shua-core.js，这里点进片刻才加载。
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
  const { APP_NAME, INK, DIM, BLACK, RED, LINE, PAL, vidSkin, S, arr, uid, AC, CB, fmtN, normComments, mkVideo, charInstruction, npcSystem, regularsBlock, crowdSystem, mineSystem } = window.ShuaCore;
  const KEY = "x_shua";
  const CAP = 200;            // 最多留几条视频
  const NPC_BATCH = 5;        // 一次刷几条路人的
  const PICK_MAX = 5;         // 一次最多请几个人发
  const EMPTY = { videos: [], accounts: {}, notes: [], me: {} };
  const load = () => { try { const v = loadJSON(KEY, null); return v && typeof v === "object" ? Object.assign({}, EMPTY, v) : Object.assign({}, EMPTY); } catch (e) { return Object.assign({}, EMPTY); } };
  const hue = s => { let x = 0; String(s || "").split("").forEach(c => { x = (x * 31 + c.charCodeAt(0)) % 360; }); return x; };
  const tint = v => "linear-gradient(160deg,hsl(" + hue(v.id) + ",38%,26%),hsl(" + ((hue(v.id) + 60) % 360) + ",32%,12%))";
  // 今天几号（她 2026-10-07：「十月份为什么能刷出暴雪」）：不给日子，模型拍的季节是随手挑的
  const CHARGE_CUT = 0.25;   // 横着看充电：作者到手 75%
  const SERIES_ADD = ',"series":""';
  const ACC_ADD = ',"bio":"","niche":"","followers":0';
  const FRIENDS_ADD = ',"friends":[{"name":"","text":""}]';
  // 评论区有后续（她 2026-10-08）：TA回了哪条网友评论、对方又回了什么，同一枪里写；有来有回的那一下记进TA的记忆，聊天里想起来自己会提
  const THREAD_ADD = ',"thread":{"name":"","reply":"","back":""}';
  const B_SHAPE_ADD = ',"title":"","intro":"","dur":"08:24","plays":0,"zone":"","dms":[""]';
  const CHAR_SHAPE = '{"handle":"","scene":"","who":"self","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}';
  const NPC_SHAPE = '{"videos":[{"author":"","scene":"","who":"none","caption":"","tags":[""],"likes":0,"comments":[{"name":"","text":""}]}]}';
  // 她小号发的视频，TA刷到了（她 2026-10-07 选的第 1 条）：认不认得出是她，全看TA对她的了解
  const SPOT_SHAPE = '{"spots":[{"name":"","comment":"","recognized":false,"why":""}]}';
  function spotSystem(v, alt, uName, chars, briefs) {
    return AC() + CB()
      + "【场景】下面这几个人都认识 " + uName + "。他们在「" + APP_NAME + "」上各自刷到了一个叫「" + alt + "」的账号发的视频：" + v.scene + (v.caption ? "；文案：" + v.caption : "") + "。"
      + "\n这个号谁都没关注过，粉丝很少。它是不是 " + uName + " 的小号，每个人只能从这条视频本身（拍的东西、口气、细节）和自己对她的了解去判断——认不出来再正常不过，各人各判，不必一致。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n每人写一项 spots：name（只能是：" + chars.map(c => c.name).join("、") + "）、comment 会不会在底下评论（不评就空着；评的话是公开的，用自己的号评）、recognized 觉得是不是她（true/false）、why 为什么这么觉得（一句，心里想的，不会被看到）。";
  }
  // 熟人评论用他们自己的口气（v75.010：她可以在刷新页打开，多一次调用）
  function acqSystem(v, host, others, briefs) {
    return AC() + CB()
      + "【场景】" + host.name + "在「" + APP_NAME + "」上发了一条视频（账号「" + v.author + "」）。拍的是：" + v.scene + (v.caption ? "\n文案：" + v.caption : "")
      + "\n\n下面这几个人都认识 " + host.name + "，都刷到了这条。评不评、评什么、当着网友的面说成什么样，照各自的性子和跟 " + host.name + " 的关系来；不想评的就不写。"
      + "\n\n" + others.map((c, i) => briefs[i] + (c.rel ? "\n跟 " + host.name + " 的关系：" + c.rel : "")).join("\n\n")
      + "\n\n写：comments（name 只能是：" + others.map(c => c.name).join("、") + "）。";
  }
  const HOT_SHAPE = '{"topics":[{"title":"","heat":0,"about":""}]}';
  function hotSystem(uName, world, date) {
    return AC() + CB()
      + "【场景】今天是 " + date + "。「" + APP_NAME + "」这个短视频平台今天的热门话题。"
      + (world ? "\n这个平台在这样一个世界里，热门从这个世界正在发生的事、时节和大家的日常里长出来：\n" + world : "\n热门从时节、日常和这个世界正在发生的事里长出来。")
      + "\n写 6~8 个 topics：title 话题名（不带井号，像平台上真会冒出来的那种）、heat 热度（数字）、about 一句话说这是怎么回事。大小事都有，别全是一个调子。"
      // 同款挑战（她 2026-10-08）：短视频平台上一天里总有一两个是大家照着拍的模板——只说有这么一类，拍什么不写
      + "其中一两个是大家照着同一个模板拍同款的挑战（about 里说清模板是怎么拍的）。";
  }
  // ── 她评论之后的那一串（她 2026-10-15：「发评论之后作者回复有点少，论坛很活，复刻一下」）──
  //   照论坛「回我那层楼」那一套：一枪写 2~5 条接在她这句后面——被她回的那个人【必回】，
  //   作者看情况，再来几个路人，可以互相搭话、唱反调；不是每条都冲着她。
  //   原来只有作者一个人、还写着「不想回就留空」，于是常常一句没有；路人的视频更是谁都不理她。
  const CROWD_SHAPE = '{"items":[{"name":"","text":"","to":"","tone":""}]}';
  const MINE_SHAPE = '{"comments":[{"name":"","text":""}],"likes":0}';

  // ── 图标：竖着刷右边那排、横着看播放页那排共用一套 ───────────
  const icon = (k, c, size, on) => k === "like" ? h(IHeart, { size, color: c, filled: true })
    : k === "pen" ? h(IPencil, { size, color: c })
    : h(Svg, { size, color: c, sw: 1.8 },
      k === "cm" ? h("path", { d: "M4 5.5h16v10.5H10l-4.5 3.5V16H4z" })
      : k === "fav" ? h("path", { fill: on ? c : "none", d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z" })
      : k === "share" ? h("path", { d: "M13 5l7 6.5-7 6.5v-4c-5 0-8 1.5-10 5 .8-5.5 3.8-9 10-9.5z" })
      : k === "same" ? [h("rect", { key: 1, x: 4, y: 6, width: 11, height: 13, rx: 2 }), h("path", { key: 2, d: "M9 3h9a2 2 0 0 1 2 2v11" })]
      : k === "del" ? h("path", { d: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" })
      : k === "coin" ? [h("circle", { key: 1, cx: 12, cy: 12, r: 8.5 }), h("path", { key: 2, d: "M9 9.5h6M12 9.5v6" })]
      : k === "charge" ? h("path", { fill: on ? c : "none", d: "M13 3L5 13.5h6L10 21l9-11h-6z" })
      : null);

  // ── 收藏夹那一排：真的文件夹（她 2026-10-07：「你这收藏夹还是胶囊啊」；tabs-not-plain-pills）──
  //   上面一只耳朵、下面一个夹身。选中的那个是【打开的】：整个往上抬一截、着色，夹身里冒出一张纸；
  //   没选的平躺在一排、只描边。新建那个是虚线的空夹子。长按挑文件夹那一排用同一个，小一号。
  function FolderTab({ name, count, on, dashed, small, onClick, P, onInk }) {
    const w = small ? 62 : 78, hb = small ? 36 : 48;
    const line = dashed ? "1.5px dashed " + P.line : "1.5px solid " + (on ? P.accent : P.line);
    return h("button", { "data-wk": "shuafolder", "data-on": on ? "1" : "0", onClick, className: "active:opacity-70 shrink-0 flex flex-col", style: { width: w, paddingTop: on ? 0 : 6, minHeight: 44, transition: "padding .15s" } },
      h("span", { style: { display: "block", width: "42%", height: small ? 6 : 8, borderRadius: "5px 6px 0 0", border: line, borderBottom: "none", background: on ? P.accent : "transparent" } }),
      h("span", { style: { position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", height: hb, marginTop: -1, borderRadius: "0 8px 8px 8px", border: line, background: on ? P.accent : "transparent", padding: "0 7px " + (small ? 4 : 6) + "px", overflow: "hidden", textAlign: "left" } },
        on ? h("span", { style: { position: "absolute", left: 8, right: 8, top: -1, height: small ? 6 : 8, borderRadius: "0 0 3px 3px", background: onInk, opacity: .85 } }) : null,
        h("span", { "data-wk": "shuafoldername", style: { position: "relative", fontFamily: F_BODY, fontSize: small ? 11.5 : 12.5, fontWeight: on ? 700 : 400, color: on ? onInk : dashed ? P.dim : P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name),
        count != null ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: on ? onInk : P.dim, opacity: on ? .85 : 1 } }, count + " 条") : null));
  }

  // ── 一条视频（整屏那一格）─────────────────────────────────
  function VideoPane({ v, charOf, onLike, onFave, onComments, onDraw, onEditDraw, drawing, height, onShare, onAuthor, onDel, onSame }) {
    const [open, setOpen] = useState(false);   // 画面那段太长时先收着，点一下展开（展开了在框里滑）
    const [more, setMore] = useState(false);   // 「⋯」：扔掉、画出来收在这儿，右边那排才不会顶到状态栏
    // 双击画面点赞、冒一颗心（只点亮，不会因为双击把赞取消掉；跟抖音一样）
    const tapRef = useRef(0);
    const [heart, setHeart] = useState(null);
    const onTap = e => {
      if (e.target && e.target.closest && e.target.closest("button,a,input,textarea,label")) return;   // 点在右边那排、展开字上不算
      const now = Date.now();
      if (now - tapRef.current < 300) {
        tapRef.current = 0;
        const r = e.currentTarget.getBoundingClientRect();
        setHeart({ x: e.clientX - r.left, y: e.clientY - r.top, k: now });
        if (!v.liked) onLike();
        setTimeout(() => setHeart(hh => hh && hh.k === now ? null : hh), 800);
      } else tapRef.current = now;
    };
    const ch = v.charId ? charOf(v.charId) : null;
    const src = v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
    const railBtn = (icon, n, on, fn, key) => h("button", { "data-wk": "shuarailbtn", "data-on": on ? "1" : "0", key: key, onClick: fn, className: "active:opacity-60 flex flex-col items-center", style: { color: on ? RED : INK, minWidth: 44, minHeight: 44, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" } },
      icon(on ? RED : INK),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", marginTop: 2, color: INK, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, n));
    return h("div", { "data-wk": "shuavcard", onClick: onTap, style: { position: "relative", height: height, scrollSnapAlign: "start", scrollSnapStop: "always", overflow: "hidden", background: src ? "#000" : tint(v) } },
      src ? h("img", { src: src, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null,
      h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.28) 0,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 52%,rgba(0,0,0,.66) 100%)" } }),
      heart ? h("div", { key: heart.k, "data-wk": "shuaheart", "aria-hidden": "true", style: { position: "absolute", left: heart.x - 40, top: heart.y - 40, zIndex: 6, pointerEvents: "none", animation: "shuaHeartPop .8s ease-out forwards" } },
        h("style", null, "@keyframes shuaHeartPop{0%{transform:scale(.4) rotate(-12deg);opacity:0}20%{transform:scale(1.15) rotate(-12deg);opacity:1}60%{transform:scale(1) rotate(-12deg);opacity:1}100%{transform:scale(1.3) translateY(-40px) rotate(-12deg);opacity:0}}"),
        h(IHeart, { size: 80, color: RED, filled: true })) : null,
      // 没画出来的时候，画面那几句摆在正中，当它就是这一段视频（她 2026-10-07：「做居中而不是居左上」）
      !src ? h("div", { "data-wk": "shuascene", className: "flex items-center justify-center", style: { position: "absolute", left: 30, right: 66, top: 110, bottom: 200, pointerEvents: "none" } },
        h("div", { onClick: () => setOpen(o => !o), style: { pointerEvents: "auto", maxHeight: "100%", overflowY: open ? "auto" : "hidden", textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.75, color: "rgba(255,255,255,.9)", textShadow: "0 1px 4px rgba(0,0,0,.4)" } },
          h("div", { style: open ? null : { display: "-webkit-box", WebkitLineClamp: 9, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene),
          !open && S(v.scene).length > 140 ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: DIM, marginTop: 6 } }, "展开") : null)) : null,
      // 右边那排压矮（她 2026-10-07：「右边状态栏太高了上面几个按不到」）：图标小一号、间距收紧，扔掉和画出来进「⋯」
      h("div", { className: "flex flex-col items-center", style: { position: "absolute", right: 8, bottom: 96, gap: 8 } },
        h("button", { "data-wk": "shuaauthorbtn", onClick: onAuthor, "aria-label": "看这个号", className: "active:opacity-70", style: { width: 46, height: 46, borderRadius: 99, border: "2px solid #fff", overflow: "hidden", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY } },
          ch ? h(Avatar, { character: ch, size: 42 }) : S(v.author).slice(0, 1)),
        railBtn(c => icon("like", c, 27), fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike, "l"),
        railBtn(c => icon("cm", c, 27), fmtN(arr(v.comments).length), false, onComments, "c"),
        railBtn(c => icon("fav", c, 27, c === RED), v.faved ? "已收藏" : "收藏", v.faved, onFave, "f"),
        onShare ? railBtn(c => icon("share", c, 27), "分享", false, onShare, "s") : null,
        onSame ? railBtn(c => icon("same", c, 25), "拍同款", false, onSame, "same") : null,
        (onDel || onDraw) ? h("div", { key: "more", style: { position: "relative" } },
          h("button", { "data-wk": "shuamorebtn", onClick: () => setMore(m => !m), "aria-label": "更多", className: "active:opacity-60", style: { minWidth: 44, minHeight: 40, color: INK, fontSize: "calc(22px * var(--app-fs, 1))", lineHeight: "40px", textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, drawing ? "…" : "⋯"),
          more ? h("div", { "data-wk": "shuamoremenu", style: { position: "absolute", right: 48, bottom: 0, minWidth: 120, borderRadius: 10, background: "rgba(28,28,34,.96)", padding: "4px 0", boxShadow: "0 6px 20px rgba(0,0,0,.4)" } },
            onDraw ? h("button", { "data-wk": "shuamoreitem", "data-part": "draw", onClick: () => { setMore(false); if (!drawing) onDraw(); }, className: "active:opacity-60 text-left", style: { display: "block", width: "100%", minHeight: 42, padding: "0 14px", color: INK, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, drawing ? "画着…" : (src ? "重画" : "画出来")) : null,
            onEditDraw && !drawing ? h("button", { "data-wk": "shuamoreitem", "data-part": "editdraw", onClick: () => { setMore(false); onEditDraw(); }, className: "active:opacity-60 text-left", style: { display: "block", width: "100%", minHeight: 42, padding: "0 14px", color: INK, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "改画面描述再画") : null,
            onDel ? h("button", { "data-wk": "shuamoreitem", "data-part": "del", onClick: () => { setMore(false); onDel(); }, className: "active:opacity-60 text-left", style: { display: "block", width: "100%", minHeight: 42, padding: "0 14px", color: INK, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "扔掉这条") : null) : null) : null),
      h("div", { "data-wk": "shuacaption", style: { position: "absolute", left: 14, right: 72, bottom: 22 } },
        h("div", { "data-wk": "shuaauthor", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, "@" + (v.author || "") + (v.withName ? "  与 @" + v.withName + " 合拍" : "")),
        src && v.scene ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: DIM, marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        (v.caption || arr(v.tags).length) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: INK, marginTop: 6, lineHeight: 1.55, textShadow: "0 1px 3px rgba(0,0,0,.6)", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.caption || "",
          arr(v.tags).length ? h("span", { style: { fontWeight: 600 } }, (v.caption ? " " : "") + v.tags.map(x => "#" + x).join(" ")) : null) : null));
  }

  // ── 评论区（整页）──────────────────────────────────────
  function CommentsPage({ v, busy, onSend, onReply, onBack, t, P, sheet, emotePacks, onMore, more, onPerson }) {
    const [text, setText] = useState("");
    const [emoOpen, setEmoOpen] = useState(false);
    // 发一张表情：直接发出去（回着谁就回谁），字面写成「[表情：关键词]」好让接话的人知道发了什么
    const sendEmo = em => { if (!em || !em.url || busy) return; const x = "[表情：" + (em.keyword || "表情") + "]"; setEmoOpen(false);
      if (replyTo && onReply) { onReply(replyTo.id, x, replyTo.sub ? replyTo.name : "", em.url); setReplyTo(null); return; } onSend(x, em.url); };
    const emoImg = u => u ? h("img", { src: typeof resolveImg === "function" ? resolveImg(u) : u, alt: "", style: { display: "block", width: 72, height: 72, objectFit: "contain", marginTop: 4, borderRadius: 8 } }) : null;
    // 熟面孔名字后面带个小标（论坛那批老网友）
    const regTag = x => x.reg ? h("span", { "data-wk": "shuaregtag", style: { marginLeft: 4, padding: "0 4px", borderRadius: 4, fontSize: "calc(9.5px * var(--app-fs, 1))", border: "1px solid " + P.line, color: P.dim } }, "熟面孔") : null;
    const nameOf = (x, label) => x.reg ? h("span", null, label, regTag(x)) : x.by === "char" && x.charId && onPerson
      ? h("button", { "data-wk": "shuacmtperson", onClick: () => onPerson(x.charId), className: "active:opacity-60", style: { color: "inherit", font: "inherit", padding: 0 } }, label) : label;
    const moreBtn = onMore ? h("button", { "data-wk": "shuamorecmt", onClick: onMore, disabled: !!more, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.accent, minHeight: 36, padding: "0 10px" } }, more ? "有人路过…" : "刷点评论") : null;
    const [replyTo, setReplyTo] = useState(null);   // { id 那条评论, name 回的是谁 }
    const send = () => { const x = text.trim(); if (!x || busy) return; setText(""); if (replyTo && onReply) { onReply(replyTo.id, x, replyTo.sub ? replyTo.name : ""); setReplyTo(null); return; } onSend(x); };
    const rb = (id, name, sub) => onReply ? h("button", { "data-wk": "shuareplybtn", onClick: () => setReplyTo({ id, name, sub }), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim, marginLeft: 8 } }, "回复") : null;
    // sheet：竖着刷里从底下升起来的那一层（她 2026-10-15：「切到新窗口看评论不像抖音那样方便」）——
    //   顶上一根把手＋标题＋✕，把手那一截往下一拉就收；内容和整页那版是同一份。
    const dragY = useRef(0);
    const sheetHead = sheet ? h("div", { "data-wk": "shuacmtsheethead", className: "shrink-0", style: { position: "relative", padding: "8px 0 10px", textAlign: "center", touchAction: "none" },
        onTouchStart: e => { dragY.current = e.touches[0].clientY; },
        onTouchEnd: e => { const dy = (e.changedTouches[0] || {}).clientY - dragY.current; if (dy > 50) onBack(); } },
      h("div", { "aria-hidden": "true", style: { width: 36, height: 4, borderRadius: 2, background: P.line, margin: "0 auto 8px" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: P.ink, fontWeight: 600 } }, arr(v.comments).length + " 条评论"),
      moreBtn ? h("div", { style: { position: "absolute", left: 6, top: 8 } }, moreBtn) : null,
      h("button", { onClick: onBack, "aria-label": "收起评论", className: "active:opacity-60", style: { position: "absolute", right: 6, top: 4, width: 44, height: 44, color: P.dim, fontSize: "calc(16px * var(--app-fs, 1))" } }, "✕")) : null;
    return h("div", { "data-wk": "shuacmtpage", className: "h-full flex flex-col", style: { background: P.bg, ...(sheet ? { borderRadius: "14px 14px 0 0" } : {}) } },
      sheet ? sheetHead : h(Head, { zh: arr(v.comments).length + " 条评论", sub: "@" + v.author, bg: "transparent", ink: P.ink, onBack: onBack }),
      !sheet && moreBtn ? h("div", { className: "shrink-0 flex justify-end px-3" }, moreBtn) : null,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: 12 } },
        arr(v.comments).length ? arr(v.comments).map(c => h("div", { "data-wk": "shuacmt", "data-me": c.by === "me" ? "1" : "0", key: c.id, style: { padding: "10px 0", borderBottom: "1px solid " + P.line } },
          h("div", { "data-wk": "shuacmtname", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: c.by === "me" ? P.accent : c.by === "char" ? "#d89a2b" : P.dim } }, nameOf(c, c.name + (c.by === "char" && c.isAuthor ? " · 作者" : ""))),
          h("div", { "data-wk": "shuacmttext", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: P.ink, marginTop: 3, lineHeight: 1.55 } }, c.emo ? null : c.text, c.emo ? emoImg(c.emo) : null, c.by !== "me" ? rb(c.id, c.name, false) : null),
          arr(c.replies).length ? h("div", { style: { marginTop: 6, paddingLeft: 10, borderLeft: "2px solid " + P.line } }, c.replies.map(r => h("div", { "data-wk": "shuareply", "data-me": r.by === "me" ? "1" : "0", key: r.id, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: P.ink, padding: "2px 0" } },
            h("span", { style: { color: r.by === "me" ? P.accent : r.by === "char" ? "#d89a2b" : P.dim } }, nameOf(r, r.name) , (r.to ? " 回复 @" + r.to : "") + "："), r.emo ? emoImg(r.emo) : r.text, r.by !== "me" ? rb(c.id, r.name, true) : null))) : null)) :
          h("div", { "data-wk": "shuaempty", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.dim, textAlign: "center", padding: "40px 0" } }, "还没有评论"),
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim, padding: "8px 0" } }, "……") : null),
      emoOpen && typeof StickerPanel === "function" ? h("div", { "data-wk": "shuaemopanel", className: "shrink-0", style: { maxHeight: 260, overflowY: "auto", borderTop: "1px solid " + P.line, background: "#fff" } },
        h(StickerPanel, { packs: emotePacks, onPick: sendEmo })) : null,
      h("div", { "data-wk": "shuacompose", className: "shrink-0 flex items-end px-3", style: { gap: 8, paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + P.line } },
        replyTo ? h("button", { onClick: () => setReplyTo(null), "aria-label": "取消回复", className: "shrink-0 active:opacity-60", style: { width: 28, height: 42, color: P.dim, fontSize: "calc(15px * var(--app-fs, 1))" } }, "✕") : null,
        arr(emotePacks).length && typeof StickerPanel === "function" ? h("button", { "data-wk": "shuaemobtn", "data-on": emoOpen ? "1" : "0", onClick: () => setEmoOpen(o => !o), "aria-label": "表情", className: "shrink-0 active:opacity-60", style: { width: 36, height: 42, fontSize: "calc(20px * var(--app-fs, 1))", color: emoOpen ? P.accent : P.dim } }, "☺") : null,
        h("textarea", { "data-wk": "shuainput", value: text, onChange: e => setText(e.target.value), rows: 1, placeholder: replyTo ? "回复 @" + replyTo.name + "（点这里左边的 ✕ 取消）" : "善语结善缘，说点什么", className: "flex-1 outline-none resize-none",
          style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
        h("button", { "data-wk": "shuasend", onClick: send, disabled: busy || !text.trim(), className: "active:opacity-70 shrink-0", style: { width: 52, height: 42, borderRadius: 12, background: (busy || !text.trim()) ? "rgba(255,255,255,.1)" : P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "发送")));
  }

  // 今天是不是在一起的整百天／整周年（不是就空）
  function annivLabel(since, d0) {
    const s0 = new Date(since); s0.setHours(0, 0, 0, 0);
    const days = Math.round((d0 - s0) / 86400000), years = d0.getFullYear() - s0.getFullYear();
    if (years >= 1 && d0.getMonth() === s0.getMonth() && d0.getDate() === s0.getDate()) return "在一起 " + years + " 周年";
    return days > 0 && days % 100 === 0 ? "在一起第 " + days + " 天" : "";
  }
  // ── 情侣挑战（她 2026-10-15「都做吧」第 3 条）：两个人分开写答案，最后一起亮出来 ─────
  const CP_CHALLENGES = ["对方手机里给我的备注是什么", "我们第一次见面，我穿的是什么", "对方最受不了我哪一点", "谁先说的喜欢", "吵完架通常谁先低头", "对方最常对我说的一句话",
    "对方最喜欢我身上哪个地方", "我们俩谁更粘人", "对方吃醋的时候会怎么样", "如果明天放一天假，对方最想跟我干嘛", "对方偷偷存了我哪张照片", "我们之间最好笑的一次"];
  function CpChallengePage({ P, cName, busy, onGo, onBack }) {
    const [q, setQ] = useState(() => CP_CHALLENGES[Math.floor(Math.random() * CP_CHALLENGES.length)]);
    const [ans, setAns] = useState("");
    const next = () => setQ(x => { let y = x; while (y === x) y = CP_CHALLENGES[Math.floor(Math.random() * CP_CHALLENGES.length)]; return y; });
    return h("div", { "data-wk": "shuacpchal", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: "情侣挑战", bg: "transparent", ink: P.ink, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginTop: 8, lineHeight: 1.6 } }, "你和 " + cName + " 各写各的答案，谁也看不见谁的，发出去的时候一起亮出来，评论区看你俩对不对得上。"),
        h("div", { "data-wk": "shuacpq", style: { marginTop: 16, padding: "16px 18px", borderRadius: 16, background: "linear-gradient(120deg,#fe2c55,#7a3cff)", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", lineHeight: 1.5 } }, q),
        h("button", { onClick: next, className: "active:opacity-60", style: { marginTop: 8, minHeight: 36, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: P.accent } }, "换一题"),
        h("textarea", { "data-wk": "shuafield", value: ans, onChange: e => setAns(e.target.value), rows: 3, placeholder: "你的答案", className: "w-full outline-none resize-none",
          style: { borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55, marginTop: 8 } }),
        h("button", { "data-wk": "shuacpchalgo", disabled: !!busy || !ans.trim(), onClick: () => onGo(q, ans.trim()), className: "w-full active:opacity-80",
          style: { marginTop: 18, minHeight: 48, borderRadius: 14, background: (!ans.trim() || busy) ? "rgba(255,255,255,.1)" : P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))" } }, busy ? cName + " 在写他的答案…" : "写好了，一起亮出来")));
  }

  // ── 刷新那一页：两颗，跟论坛一样 ────────────────────────
  function RefreshPage({ characters, busy, prog, onNpc, onSearch, npcCity, onChars, onHot, hotDay, realFriends, onRealFriends, onBack, t, P }) {
    const [q, setQ] = useState("");
    const [pick, setPick] = useState(characters.slice(0, 3).map(c => c.id));
    const toggle = id => setPick(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]).slice(0, PICK_MAX));
    // ⚠️按不了的时候字色跟着皮走（2026-10-07 群友截图：横着看那套底是白的，白字压白底，「正在刷…」整个看不见，像卡死了）
    const big = (title, sub, fn, dis) => h("button", { "data-wk": "shuabig", onClick: fn, disabled: dis, className: "w-full text-left active:opacity-80", style: { borderRadius: 16, padding: "16px 18px", background: dis ? P.field : "linear-gradient(120deg,#fe2c55,#7a3cff)", color: dis ? P.ink : "#fff", border: "1px solid " + (dis ? P.line : "transparent"), opacity: dis ? .75 : 1 } },
      h("div", { "data-wk": "shuabigtitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))" } }, title), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .85, marginTop: 4 } }, sub));
    return h("div", { "data-wk": "shuarefresh", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: "刷新", bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        onSearch ? h("form", { "data-wk": "shuasearch", onSubmit: e => { e.preventDefault(); if (q.trim() && busy !== "npc") onSearch(q.trim()); }, className: "flex items-center", style: { gap: 8, marginTop: 8 } },
          h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜点什么：想刷到哪类视频", maxLength: 30, style: { flex: 1, minWidth: 0, minHeight: 44, padding: "0 14px", borderRadius: 999, border: "1px solid " + P.line, background: "rgba(255,255,255,.08)", color: P.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", outline: "none" } }),
          h("button", { type: "submit", disabled: !q.trim() || busy === "npc", className: "active:opacity-70", style: { minHeight: 44, padding: "0 18px", borderRadius: 999, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", opacity: !q.trim() || busy === "npc" ? .5 : 1 } }, busy === "npc" ? "搜着…" : "搜")) : null,
        h("div", { style: { marginTop: 8 } }, big(busy === "npc" ? "正在刷…" : npcCity ? "刷几条「" + npcCity + "」的路人" : "刷几条路人的", (npcCity ? "住在「" + npcCity + "」的博主，刷完进同城" : "推荐流里互不认识的博主") + "，一次 " + NPC_BATCH + " 条（花一次调用）", onNpc, busy === "npc" || busy === "chars")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, margin: "22px 0 10px" } }, "请谁发（每人一条，最多 " + PICK_MAX + " 个）"),
        h("div", { className: "flex flex-wrap", style: { gap: 12 } }, characters.map(c => {
          const on = pick.indexOf(c.id) >= 0;
          return h("button", { "data-wk": "shuacharpick", "data-on": on ? "1" : "0", key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 58, opacity: on ? 1 : .45 } },
            h("div", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (on ? P.accent : "transparent") } }, h(Avatar, { character: c, size: 46 })),
            h("div", { "data-wk": "shuacharname", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.ink, marginTop: 4, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name));
        })),
        h("div", { style: { marginTop: 14 } }, big(busy === "chars" ? "TA们在拍…" + (prog ? "（" + prog + "）" : "") : "请TA们发", busy === "chars" ? "可以先退出去刷，拍好一条就出一条" : "挑中的人各发一条，照TA此刻的生活来", () => onChars(pick), busy === "npc" || busy === "chars" || !pick.length),
        onRealFriends ? h("button", { "data-wk": "shuarealfriends", "data-on": realFriends ? "1" : "0", onClick: onRealFriends, className: "w-full text-left active:opacity-70 flex items-center", style: { gap: 10, marginTop: 10, minHeight: 40 } },
          h("span", { style: { width: 18, height: 18, borderRadius: 5, border: "1.5px solid " + (realFriends ? P.accent : P.line), background: realFriends ? P.accent : "transparent", flexShrink: 0 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, lineHeight: 1.5 } }, "认识 TA 的人来评时，让他们用自己的口气写（每条多调一次；关着时是 TA 发视频那一次顺手写的）")) : null,
        onHot ? h("div", { style: { marginTop: 14 } }, big(busy === "hot" ? "正在看今天的热门…" : (hotDay ? "重刷今天的热门" : "看看今天的热门"), "这个世界今天在聊什么，一天一份（调一次模型）。TA 们发视频时知道，跟不跟看各人", onHot, busy === "npc" || busy === "chars" || busy === "hot")) : null)));
  }

  // ── 发一条（＋）──────────────────────────────────────
  function PostPage({ busy, onPost, onLive, onBack, P, skin, characters, onAlt, same }) {
    const [scene, setScene] = useState(""), [caption, setCaption] = useState(same ? "拍了 @" + same.author + " 的同款 " : ""), [who, setWho] = useState("self"), [title, setTitle] = useState("");
    const [withId, setWithId] = useState("");   // 和谁一起出镜（合拍，第 4 条）
    // 拿一张照片当画面（她 2026-10-15：「自己发视频可以上传照片写描述假装是视频」）：照片铺成画面，描述就是这段视频拍了什么
    const [pic, setPic] = useState(""), [picBusy, setPicBusy] = useState(false);
    const pickPic = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      setPicBusy(true);
      try { const d = await resizeImageFile(f, 1280, 0.86); setPic(typeof imgToVault === "function" ? await imgToVault(d) : d); }
      catch (err) { } finally { setPicBusy(false); }
    };
    const field = (val, set, ph, rows) => h("textarea", { "data-wk": "shuafield", value: val, onChange: e => set(e.target.value), rows: rows, placeholder: ph, className: "w-full outline-none resize-none",
      style: { borderRadius: 12, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55, marginTop: 8 } });
    const chip = (k, label) => h("button", { "data-wk": "shuachip", "data-on": who === k ? "1" : "0", key: k, onClick: () => setWho(k), className: "active:opacity-60", style: { minHeight: 34, padding: "0 13px", borderRadius: 999, border: "1px solid " + (who === k ? P.ink : P.line), background: who === k ? P.ink : "transparent", color: who === k ? P.bg : P.dim, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    return h("div", { "data-wk": "shuapost", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% -10%," + P.glow + ",rgba(0,0,0,0) 60%)," + P.bg } },
      h(Head, { zh: same ? "拍同款" : "发一条", bg: "transparent", ink: P.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        // 拍同款（她 2026-10-07 选的第 3 条）：上面摆着原视频，你照着拍一条自己的
        same ? h("div", { "data-wk": "shuasameref", style: { marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid " + P.line, background: P.field } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim } }, "原视频 @" + same.author),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: P.ink, marginTop: 4, lineHeight: 1.55 } }, same.scene)) : null,
        same ? null : h("button", { "data-wk": "shualivedoor", onClick: onLive, className: "w-full text-left active:opacity-80", style: { marginTop: 6, borderRadius: 16, padding: "14px 18px", background: "linear-gradient(120deg,#e2556b,#46326e)", color: "#fff" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "开直播"), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .85, marginTop: 3 } }, "你开播，你的人混在观众里看着")),
        skin === "b" ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginTop: 22 } }, "标题") : null,
        skin === "b" ? field(title, setTitle, "这条视频叫什么", 1) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginTop: skin === "b" ? 16 : 22 } }, "画面（可选）：放一张照片当这段视频"),
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 8 } },
          pic ? h("img", { src: typeof resolveImg === "function" ? resolveImg(pic) : pic, alt: "", style: { width: 64, height: 86, objectFit: "cover", borderRadius: 10, border: "1px solid " + P.line } }) : null,
          h("label", { "data-wk": "shuapostpic", className: "active:opacity-70", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, border: "1px dashed " + P.line, color: P.ink, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", display: "inline-flex", alignItems: "center", cursor: "pointer" } },
            picBusy ? "放进来…" : pic ? "换一张" : "选一张照片",
            h("input", { type: "file", accept: "image/*", onChange: pickPic, style: { display: "none" } })),
          pic ? h("button", { onClick: () => setPic(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, minHeight: 40 } }, "不用了") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginTop: 16 } }, pic ? "这段视频拍了什么（照着照片写，大家看到的是照片＋这段）" : "视频里拍了什么"),
        field(scene, setScene, "镜头里看得见什么，怎么走的", 3),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginTop: 16 } }, "文案"),
        field(caption, setCaption, "配一句话，可以带 #话题", 2),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, margin: "16px 0 8px" } }, "画面里有没有你"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } }, chip("self", "我出镜"), chip("part", "只露手或背影"), chip("none", "没有人")),
        // 合拍：小号发的不给选（小号就是不想让人知道是她）
        !onAlt && (characters || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, margin: "16px 0 8px" } }, "和谁一起出镜（合拍，可不选）") : null,
        !onAlt && (characters || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 10 } }, characters.map(c => h("button", { "data-wk": "shuawithpick", "data-on": withId === c.id ? "1" : "0", key: c.id, onClick: () => setWithId(w => w === c.id ? "" : c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 52, opacity: withId === c.id ? 1 : .5 } },
          h("div", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (withId === c.id ? P.accent : "transparent") } }, h(Avatar, { character: c, size: 40 })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: P.ink, marginTop: 3, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)))) : null,
        h("button", { "data-wk": "shuapostbtn", disabled: !!busy || !scene.trim(), onClick: () => onPost({ scene: scene.trim(), caption: caption.trim(), who, title: title.trim(), withId: onAlt ? "" : withId, same: same || null, img: pic || "" }),
          className: "w-full active:opacity-80", style: { marginTop: 24, minHeight: 48, borderRadius: 14, background: (!scene.trim() || busy) ? "rgba(255,255,255,.1)" : P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))" } }, busy ? "发着…" : "发布")));
  }

  // ── 横屏那套：双列封面 + 带弹幕的播放页 ─────────────────────
  const B = PAL.b;
  const imgOf = v => v.img ? (typeof resolveImg === "function" ? resolveImg(v.img) : v.img) : "";
  const coverBg = v => { const src = imgOf(v); return src ? "center/cover no-repeat url(\"" + src + "\")" : tint(v); };
  function BCard({ v, onOpen }) {
    return h("button", { "data-wk": "shuabcard", onClick: onOpen, className: "text-left active:opacity-80", style: { borderRadius: 8, overflow: "hidden", background: B.card, boxShadow: "0 1px 4px rgba(0,0,0,.05)", display: "flex", flexDirection: "column" } },
      h("div", { style: { position: "relative", aspectRatio: "16 / 10", background: coverBg(v), padding: 7 } },
        !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.88)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene) : null,
        h("div", { className: "flex items-center", style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 7px 4px", gap: 8, background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55))", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#fff" } },
          h("span", null, "▶ " + fmtN(v.plays)), h("span", null, "弹 " + fmtN(arr(v.dms).length + arr(v.comments).length)),
          v.dur ? h("span", { style: { marginLeft: "auto" } }, v.dur) : null)),
      h("div", { style: { padding: "7px 8px 9px" } },
        h("div", { "data-wk": "shuabcardtitle", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: B.ink, lineHeight: 1.45, height: 36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || v.caption || v.scene),
        h("div", { "data-wk": "shuabcardsub", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: B.dim, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (v.by === "char" ? "作者 · " : "") + v.author)));
  }
  // 横着看专属（她 2026-10-07 选的第 2 条）：投币、充电、你自己发弹幕、楼中楼
  // 充电（她 2026-10-08：胶囊、不能自定义）：一格一节电池，钱越多电越满；最后一格自己填
  function ChargePanel({ onCharge }) {
    const [own, setOwn] = useState("");
    const cell = (n, bars) => h("button", { "data-wk": "shuacharge", key: n, onClick: () => onCharge(n), className: "active:opacity-70 flex flex-col items-center", style: { padding: "8px 0 6px", borderRadius: 10, background: B.bg, minHeight: 64 } },
      h("span", { style: { position: "relative", width: 34, height: 18, borderRadius: 4, border: "1.5px solid " + B.accent, display: "flex", gap: 2, padding: 2 } },
        [0, 1, 2, 3].map(i => h("span", { key: i, style: { flex: 1, borderRadius: 1, background: i < bars ? B.accent : "transparent" } })),
        h("span", { style: { position: "absolute", right: -5, top: 5, width: 3, height: 6, borderRadius: 1, background: B.accent } })),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: B.ink, marginTop: 6 } }, "¥" + n));
    const ok = Number(own) > 0;
    return h("div", { style: { marginTop: 8 } },
      h("div", { "data-wk": "shuachargegrid", style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 } }, [[6, 1], [18, 2], [50, 3], [128, 4]].map(x => cell(x[0], x[1]))),
      h("div", { className: "flex items-center", style: { gap: 8, marginTop: 8 } },
        h("input", { "data-wk": "shuachargeinput", value: own, onChange: e => setOwn(e.target.value.replace(/[^\d]/g, "").slice(0, 6)), inputMode: "numeric", placeholder: "自己填多少", style: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 10, border: "1px solid " + B.line, background: B.card, color: B.ink, padding: "0 10px", fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" } }),
        h("button", { "data-wk": "shuachargebtn", disabled: !ok, onClick: () => { onCharge(Math.round(Number(own))); setOwn(""); }, className: "active:opacity-70", style: { minHeight: 38, padding: "0 16px", borderRadius: 10, background: ok ? B.accent : B.line, color: B.card, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "充")));
  }
  function BDetail({ v, charOf, busy, onFollowSeries, seriesOn, onBack, onLike, onFave, onDraw, onEditDraw, drawing, onSend, onShare, onAuthor, onDel, coinsLeft, onCoin, onCharge, onDm, onReply, onMore, moreBusy }) {
    const [text, setText] = useState("");
    const [mode, setMode] = useState("cm");          // cm 评论 / dm 弹幕
    const [replyTo, setReplyTo] = useState(null);    // 回复哪一条评论（楼中楼）
    const [charging, setCharging] = useState(false);
    const [open, setOpen] = useState(false);     // 播放器里那段画面描写：先露三行
    const [more, setMore] = useState(false);     // 右上角「⋯」：扔掉、画出来收在这儿
    const ch = v.charId ? charOf(v.charId) : null;
    const send = () => {
      const x = text.trim(); if (!x || busy) return; setText("");
      if (mode === "dm" && onDm) { onDm(x); return; }
      if (replyTo && onReply) { onReply(replyTo.id, x); setReplyTo(null); return; }
      onSend(x);
    };
    const act = (k, n, on, fn) => h("button", { "data-wk": "shuaact", "data-on": on ? "1" : "0", onClick: fn, className: "flex-1 active:opacity-60 flex flex-col items-center", style: { color: on ? B.accent : B.dim, minHeight: 50 } },
      icon(k, on ? B.accent : B.dim, 24, on), h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", marginTop: 3, whiteSpace: "nowrap" } }, n));
    const moreItem = (label, fn) => h("button", { "data-wk": "shuamoreitem", onClick: () => { setMore(false); if (fn) fn(); }, className: "active:opacity-60 text-left", style: { display: "block", width: "100%", minHeight: 42, padding: "0 16px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: B.ink } }, label);
    return h("div", { "data-wk": "shuabdetail", className: "h-full flex flex-col", style: { background: B.bg } },
      // 播放器那一块：黑底，画面（或那几句）＋飘过去的弹幕
      h("div", { "data-wk": "head", className: "shrink-0", style: { position: "relative", background: "#000", paddingTop: safeTop(0) } },
        h("div", { style: { position: "relative", aspectRatio: "16 / 9", background: coverBg(v), overflow: "hidden" } },
          !imgOf(v) ? h("div", { onClick: () => setOpen(o => !o), style: { position: "absolute", left: 18, right: 18, top: 44, bottom: 10, overflowY: open ? "auto" : "hidden", fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "rgba(255,255,255,.92)" } },
            h("div", { style: open ? null : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene),
            !open && S(v.scene).length > 60 ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.6)", marginTop: 4 } }, "点一下看全") : null) : null,
          window.LiveKit && window.LiveKit.NoiseLayer ? h(window.LiveKit.NoiseLayer, { noise: arr(v.dms).concat(arr(v.myDms).map(x => x.text)), seed: v.id + "_" + arr(v.myDms).length }) : null,
          h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60", style: { position: "absolute", left: 6, top: 4, width: 40, height: 40 } }, h(IArrow, { size: 20, color: "#fff" })),
          (onDel || onDraw) ? h("button", { onClick: () => setMore(m => !m), "aria-label": "更多", className: "active:opacity-60", style: { position: "absolute", right: 6, top: 4, width: 40, height: 40, color: "#fff", fontSize: "calc(20px * var(--app-fs, 1))", lineHeight: "40px" } }, "⋯") : null,
          more ? h("div", { "data-wk": "block", style: { position: "absolute", right: 10, top: 44, zIndex: 5, minWidth: 130, borderRadius: 10, background: B.card, boxShadow: "0 6px 20px rgba(0,0,0,.25)", padding: "4px 0" } },
            onDraw ? moreItem(drawing ? "画着…" : (imgOf(v) ? "重画封面" : "画出来"), drawing ? null : onDraw) : null,
            onEditDraw && !drawing ? moreItem("改画面描述再画", () => { setMore(false); onEditDraw(); }) : null,
            onDel ? moreItem("扔掉这条", onDel) : null) : null)),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: 10 } },
        h("div", { "data-wk": "shuabinfo", style: { background: B.card, padding: "12px 14px" } },
          h("button", { "data-wk": "shuaauthorbtn", onClick: onAuthor, className: "flex items-center text-left active:opacity-70", style: { gap: 10 } },
            ch ? h(Avatar, { character: ch, size: 34 }) : h("div", { style: { width: 34, height: 34, borderRadius: 99, background: tint(v), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY } }, S(v.author).slice(0, 1)),
            h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: B.accent } }, v.author + (v.withName ? " · 与 " + v.withName + " 合拍" : "")), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: B.dim } }, fmtN(v.plays) + " 播放" + (v.zone ? " · " + v.zone : "")))),
          h("div", { "data-wk": "shuabtitle", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: B.ink, marginTop: 10, lineHeight: 1.5 } }, v.title || v.caption),
          v.series ? h("div", { className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: B.accent, marginTop: 4 } }, "系列《" + v.series + "》· 第 " + (v.ep || 1) + " 期",
            onFollowSeries ? h("button", { "data-wk": "shuaseriesfollow", "data-on": seriesOn ? "1" : "0", onClick: onFollowSeries, className: "active:opacity-70", style: { minHeight: 26, padding: "0 10px", borderRadius: 8, border: "1px solid " + B.accent, background: seriesOn ? "transparent" : B.accent, color: seriesOn ? B.accent : "#fff", fontSize: "calc(11px * var(--app-fs, 1))" } }, seriesOn ? "已追更" : "追更") : null) : null,
          (v.intro || (v.title && v.caption)) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: B.dim, marginTop: 6, lineHeight: 1.6 } }, v.intro || v.caption) : null,
          arr(v.tags).length ? h("div", { "data-wk": "block", className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, v.tags.map(x => h("span", { "data-wk": "shuatag", key: x, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: B.dim, background: B.bg, borderRadius: 99, padding: "3px 9px" } }, x))) : null,
          h("div", { "data-wk": "shuaactbar", className: "flex", style: { marginTop: 10 } },
            act("like", fmtN(v.likes + (v.liked ? 1 : 0)), v.liked, onLike),
            onCoin ? act("coin", v.myCoins ? "投过 " + v.myCoins : String(v.coins || "投币"), !!v.myCoins, onCoin) : null,
            act("fav", v.faved ? "已收藏" : "收藏", v.faved, onFave),
            onCharge ? act("charge", v.charged ? "¥" + v.charged : "充电", !!v.charged, () => setCharging(c => !c)) : null,
            onShare ? act("share", "分享", false, onShare) : null),
          onCoin ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: B.dim, marginTop: 2, textAlign: "right" } }, "今天还剩 " + coinsLeft + " 枚硬币") : null,
          charging && onCharge ? h(ChargePanel, { onCharge: n => { setCharging(false); onCharge(n); } }) : null),
        h("div", { "data-wk": "shuabcmts", style: { background: B.card, marginTop: 8, padding: "6px 14px" } },
          h("div", { className: "flex items-center justify-between", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: B.ink, padding: "8px 0" } }, "评论 " + arr(v.comments).length,
            onMore ? h("button", { "data-wk": "shuamorecmt", onClick: onMore, disabled: !!moreBusy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: B.accent, minHeight: 32, padding: "0 4px" } }, moreBusy ? "有人路过…" : "刷点评论") : null),
          arr(v.comments).map(c => h("div", { "data-wk": "shuacmt", "data-me": c.by === "me" ? "1" : "0", key: c.id, style: { padding: "9px 0", borderTop: "1px solid " + B.line } },
            h("div", { "data-wk": "shuacmtname", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: c.by === "me" ? B.accent : c.by === "char" ? "#d89a2b" : B.dim } }, c.name + (c.isAuthor ? " · 作者" : "")),
            h("div", { "data-wk": "shuacmttext", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: B.ink, marginTop: 3, lineHeight: 1.55 } }, c.text),
            // 楼中楼：回复挂在这一条底下
            arr(c.replies).length ? h("div", { style: { marginTop: 6, padding: "6px 10px", borderRadius: 8, background: B.bg } }, c.replies.map(r => h("div", { "data-wk": "shuareply", "data-me": r.by === "me" ? "1" : "0", key: r.id, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: B.ink, padding: "2px 0" } },
              h("span", { style: { color: r.by === "me" ? B.accent : r.by === "char" ? "#d89a2b" : B.dim } }, r.name + "："), r.text))) : null,
            onReply ? h("button", { "data-wk": "shuareplybtn", onClick: () => { setReplyTo(c); setMode("cm"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: B.dim, marginTop: 4 } }, "回复") : null)),
          busy ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: B.dim, padding: "8px 0" } }, "……") : null)),
      h("div", { "data-wk": "shuacompose", className: "shrink-0 flex items-end px-3", style: { gap: 8, paddingTop: 8, background: B.card, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + B.line } },
        onDm ? h("button", { "data-wk": "shuadmtoggle", "data-on": mode === "dm" ? "1" : "0", onClick: () => { setMode(m => m === "dm" ? "cm" : "dm"); setReplyTo(null); }, className: "active:opacity-60 shrink-0",
          style: { height: 40, padding: "0 10px", borderRadius: 20, background: mode === "dm" ? B.accent : B.bg, color: mode === "dm" ? "#fff" : B.dim, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "弹") : null,
        h("textarea", { "data-wk": "shuainput", value: text, onChange: e => setText(e.target.value), rows: 1, placeholder: mode === "dm" ? "发个弹幕，飘在画面上" : replyTo ? "回复 @" + replyTo.name : "发一条友善的评论", className: "flex-1 outline-none resize-none",
          style: { minHeight: 40, maxHeight: 100, borderRadius: 20, border: "none", background: B.bg, color: B.ink, padding: "10px 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
        h("button", { "data-wk": "shuasend", onClick: send, disabled: busy || !text.trim(), className: "active:opacity-70 shrink-0", style: { width: 52, height: 40, borderRadius: 20, background: (busy || !text.trim()) ? B.line : B.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "发布")));
  }

  // ── 整个 app ─────────────────────────────────────────
  function ShuaApp(props) {
    const t = useTheme();
    const { characters, profile, toast } = props;
    // 从聊天里点视频卡过来的（群友 2026-10-08：「能点到原视频里吗」）：读存档这一步顺手找到那一条——
    //   旧卡没记 id 就按作者＋画面认；已经被刷掉了就照卡上的样子补回去。补的那条要跟着这一次的 db 一起进来，所以写在这儿
    const [db, setDb] = useState(() => {
      const d0 = load(), sn = window.__shuaPending;
      if (!sn) return d0;
      window.__shuaPending = null;
      const vids = arr(d0.videos);
      let v = (sn.id && vids.find(x => x.id === sn.id)) || vids.find(x => x.author === sn.author && x.scene === sn.scene);
      let out = d0;
      if (!v) {
        v = mkVideo(sn, { by: sn.by === "char" ? "char" : sn.by === "me" ? "me" : "npc", author: S(sn.author).slice(0, 20) || "某个博主", charId: sn.charId || null, skin: sn.skin === "b" ? "b" : "v", img: sn.img || "" });
        out = Object.assign({}, d0, { videos: [v].concat(vids) }); saveJSON(KEY, out);
      }
      pendingPage = vidSkin(v) === "b" ? { kind: "bdetail", id: v.id, fromChat: true } : { kind: "one", id: v.id, fromChat: true };
      return out;
    });
    const dbRef = useRef(db); dbRef.current = db;
    const [tab, setTab] = useState("home");          // home | live | msg | me
    const [feed, setFeed] = useState("rec");          // follow | rec
    const [page, setPage] = useState(() => { const p0 = pendingPage; pendingPage = null; return p0; });
    // 竖着刷里点评论：不换页，从底下升一层（哪条视频的评论）
    const [sheet, setSheet] = useState(null);
    const [cpEdit, setCpEdit] = useState("");   // 情侣号卡片里正在「自己改」的是哪一张
    useEffect(() => { setSheet(null); }, [page]);   // 换页（分享、进主页…）就把评论层收掉
    // null | {kind:"comments"|"bdetail",id} | {kind:"refresh"} | {kind:"post"} | {kind:"mine"}
    const [liveStart, setLiveStart] = useState("");   // 从「＋ → 开直播」进直播那一格
    const [busy, setBusy] = useState(null);
    const [topic, setTopic] = useState("");   // 首页只看沾这个热门话题的
    const [cityPick, setCityPick] = useState("");
    const [folder, setFolder] = useState("all");
    const [fName, setFName] = useState(null);
    const [picking, setPicking] = useState(null);  // 长按了哪一条，正在给它挑文件夹
    const pressRef = useRef(null);      // 正在起名的新文件夹   // 收藏那一格看哪个文件夹   // 同城看的是哪座城
    const [prog, setProg] = useState("");
    const [drawing, setDrawing] = useState(null);
    const [paneH, setPaneH] = useState(600);
    const feedRef = useRef(null);
    const posRef = useRef({});   // 每一格滑到哪儿了（点进评论再回来要还在原地）
    const uName = (profile && profile.name) || "我";
    const skin = db.skin === "b" ? "b" : "v";
    const P = PAL[skin];
    useEffect(function () { const el = feedRef.current; if (el && el.clientHeight && el.clientHeight !== paneH) setPaneH(el.clientHeight); });
    // 收藏的不会被刷掉（她 2026-10-07）：满了只挤掉没收藏的那些
    const capVideos = vs => { let left = CAP; return arr(vs).filter(v => v.faved || v.by === "me" || (left-- > 0)); };
    const save = next => { const n = Object.assign({}, next, { videos: capVideos(next.videos), notes: arr(next.notes).slice(0, 100) }); dbRef.current = n; setDb(n); saveJSON(KEY, n); };
    const patchV = (id, fn) => save(Object.assign({}, dbRef.current, { videos: dbRef.current.videos.map(v => v.id === id ? fn(v) : v) }));
    const addVideos = list => save(Object.assign({}, dbRef.current, { videos: list.concat(dbRef.current.videos) }));
    // 记下是哪条视频（群友 2026-10-08：「消息能点到原视频里吗，不然都不知道是哪个视频了」）
    const note = (text, vid) => save(Object.assign({}, dbRef.current, { notes: [{ id: uid("n"), text, vid: vid || null, ts: Date.now(), unread: true }].concat(dbRef.current.notes) }));
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
    // 按面具发（她 2026-10-09，跟论坛同一套）：大号跟着「现在用哪张面具」走。
    //   只有跟她用同一张面具聊的人认得出是她；别的人刷到当陌生博主、看她评论当陌生网友。小号、情侣号不分面具。
    const maskList = props.masks ? props.masks() : [];
    const maskUse = !onAlt && !onCp && db.me && db.me.mask && maskList.some(m => m.id === db.me.mask) ? db.me.mask : "";
    const maskName = maskUse ? (maskList.find(m => m.id === maskUse) || {}).name : "";
    const knows = c => !c || onAlt || onCp || !props.maskKeyOf || props.maskKeyOf(c.id) === maskUse;
    const myName = onCp ? cps[cpId].handle : onAlt ? altName : maskUse ? maskName : (S(db.me && db.me.handle) || uName);
    const shapeChar = (sk, withFriends, newAcc) => (sk === "b" ? CHAR_SHAPE.replace(/\}$/, B_SHAPE_ADD + SERIES_ADD + "}") : CHAR_SHAPE).replace(/\}$/, (withFriends ? FRIENDS_ADD : "") + (newAcc ? ACC_ADD : "") + THREAD_ADD + "}");
    const shapeNpc = sk => sk === "b" ? NPC_SHAPE.replace('"comments":[{"name":"","text":""}]}]}', '"comments":[{"name":"","text":""}]' + B_SHAPE_ADD + '}]}') : NPC_SHAPE;

    // 今日热门（第 6 条）：一天一份，点了才刷（一次调用）。从这个世界里正在发生的事长出来
    // 平台是大家共用的，照主面具那只钟（主屏的钟也是它）
    const mainNow = () => new Date(typeof vclockMainMap === "function" ? vclockMainMap(Date.now()) : Date.now());
    const todayKey = () => { const d = mainNow(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
    const hotToday = () => (db.hot && db.hot.day === todayKey() ? arr(db.hot.topics).map(x => x.title + (x.about ? "（" + S(x.about).slice(0, 40) + "）" : "")) : []);
    const genHot = async () => {
      if (!props.ask) return;
      setBusy("hot");
      try {
        const r = await props.ask(hotSystem(uName, props.worldHint ? props.worldHint() : "", mainNow().toLocaleDateString()), HOT_SHAPE);
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
    // forceCp：情侣号页上那颗「让TA往这个号发一条」（她 2026-10-15）——这一回不掷那三分之一，直接发在情侣号上
    // ── 情侣号好玩一点（她 2026-10-15「都做吧」）────────────────────────
    // TA往情侣号发一条时多知道的几件事：粉丝是嗑你俩的、这条是不是偷拍她、是不是纪念日、能不能顺手改号
    const cpPostLine = (c, a, isCandid, anniv) => "\n这一条你不发在自己的号上，发在你和 " + uName + " 共用的情侣号「" + a.handle + "」上" + (a.bio ? "（主页简介：" + a.bio + "）" : "") + "，号上有 " + (a.followers || 0) + " 个粉丝，多半是嗑你俩的 CP 粉。"
      + (anniv ? "今天是你们的「" + anniv + "」，这一条是纪念日发的——拍什么、文案怎么写照你这个人来。" : isCandid ? "这一条是你背着她偷偷拍的她（她没注意的时候：睡着、吃东西、发呆、在忙……画面里是她），文案是你写的，她还不知道你发了。" : "拍的多半跟你俩有关，她也会看到。")
      + "\n底下网友评论 comments 多是这个号的 CP 粉：催更、考古以前的视频、给你俩起 CP 名、嗑到了、起哄——口气各不一样。"
      + "\n号名和简介你俩谁都能改" + (a.lastEdit && a.lastEdit.by === "me" ? "（她最近刚改过：现在这个名字和简介是她弄的）" : "") + "：想顺手改，就在 cpEdit 写新的 handle／bio；不改就都留空。";
    // 情侣号涨粉；跨过一千、一万、十万、百万时消息里落一条，TA也记一笔（聊天时说不说看TA）
    const cpFans = (id, add) => {
      const a = (dbRef.current.cps || {})[id]; if (!a || !(add > 0)) return;
      const was = a.followers || 0, now = was + Math.round(add);
      save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: Object.assign({}, a, { followers: now }) }) }));
      const mark = [1000, 10000, 100000, 1000000].find(m => was < m && now >= m);
      if (!mark) return;
      const label = mark >= 10000 ? (mark / 10000) + " 万" : mark + "";
      note("你俩的情侣号「" + a.handle + "」粉丝破 " + label + " 了", null);
      if (props.remember) props.remember([id], "你和 " + uName + " 在「" + APP_NAME + "」上共用的情侣号「" + a.handle + "」粉丝破了 " + label + "。");
    };
    // 情侣挑战：TA照自己写答案（看不见她的），再当成你俩情侣号上的一条视频发出去——评论走发视频那一套（TA也会来评）
    const playChallenge = async (q, mine) => {
      const c = charOf(cpId); if (!c || !props.probeAs) return;
      setBusy("chal");
      let his = "";
      try {
        const d = await props.probeAs(c, "【这一轮发生在「" + APP_NAME + "」】你和 " + uName + " 在你俩的情侣号上玩情侣挑战，题目是：「" + q + "」。两个人分开写答案，谁也看不见谁的，待会儿一起亮出来。写你的答案——照你知道的、你俩真实的事来答，一两句。", '{"answer":""}');
        his = S(d && d.answer).slice(0, 200);
      } catch (e) { toast("挑战没玩成：" + ((e && e.message) || "")); setBusy(null); return; }
      setBusy(null);
      if (!his) { toast(c.name + " 没写出来，再试一次"); return; }
      await postMine({ scene: "情侣挑战「" + q + "」：两个人分开写答案，一起亮出来。\n" + uName + " 写的：" + mine + "\n" + c.name + " 写的：" + his, caption: "#情侣挑战 " + q, who: "self", title: "情侣挑战｜" + q, withId: "", same: null, chal: { q, me: mine, him: his } });
    };
    // opts.anniv：纪念日那一条的由头（自动发）；opts.quiet：不切页、不弹「发了新视频」（后台自动发时）
    const genChars = async (ids, forceCp, opts) => {
      opts = opts || {};
      const pick = ids.map(charOf).filter(Boolean).slice(0, PICK_MAX);
      if (!pick.length) return;
      const sk = skin;
      setBusy("chars"); setProg("0/" + pick.length);
      let done = 0;
      const names = [], failed = [];
      const toCp = {};   // 这一批里谁这条发在情侣号上
      const candid = {};   // 这一批里谁那条是偷拍她的
      const one = c => {
        const acc = (dbRef.current.accounts || {})[c.id] || {};
        // 有关系的优先，最多三个；没关系网就随便两个——不是每条都有人刷到，所以一半的时候不递
        const others = characters.filter(x => x.id !== c.id);
        const tied = others.filter(x => props.relOf && props.relOf(c.id, x.id));
        const friends = Math.random() < 0.5 ? (tied.length ? tied : others).slice().sort(() => Math.random() - 0.5).slice(0, tied.length ? 3 : 2)
          .map(x => ({ id: x.id, name: x.name, rel: props.relOf ? props.relOf(c.id, x.id) : "" })) : [];
        const newAcc = !(acc.bio || acc.niche);
        // 有情侣号的那位，三回里大约有一回这条发在情侣号上
        const cpHere = (dbRef.current.cps || {})[c.id];
        if (cpHere && togetherIds.indexOf(c.id) >= 0 && (forceCp || Math.random() < 0.33)) toCp[c.id] = cpHere;
        // 偷拍她（第 2 条）：发在情侣号上的，大约一半是背着她拍的她；纪念日那条不算
        if (toCp[c.id] && !opts.anniv && Math.random() < 0.5) candid[c.id] = true;
        const realFr = !!(dbRef.current.me && dbRef.current.me.realFriends);
        // 横着看那套：TA号上已有的系列，和最近几条底下有人发过的弹幕（她发的也在里面，TA不知道是谁）
        let extra = "";
        // 自己最近发过的几条（她 2026-10-26 去重）：同一个画面、同一句文案别再发一遍
        const mineAll = dbRef.current.videos.filter(x => x.by === "char" && x.charId === c.id).slice(0, 8);
        if (mineAll.length) extra += "\n【你最近已经发过的】下面这些已经发过了，别再拍同一个画面、配同一句文案，换个说法也算发过：\n" + mineAll.map(x => "· " + S(x.scene).slice(0, 40) + (S(x.caption) ? "｜" + S(x.caption).slice(0, 30) : "")).join("\n");
        if (sk === "b") {
          const mineB = dbRef.current.videos.filter(x => x.by === "char" && x.charId === c.id && vidSkin(x) === "b");
          const ser = {}; mineB.forEach(x => { if (x.series && !ser[x.series]) ser[x.series] = x; });
          const sl = Object.keys(ser).slice(0, 3).map(k => "《" + k + "》已经更到第 " + (ser[k].ep || 1) + " 期（上一期拍的是：" + S(ser[k].scene).slice(0, 50) + "）");
          if (sl.length) extra += "\n你这个号上的系列：" + sl.join("；") + "。这一条可以是某个系列的下一期，也可以不是。";
          extra += "\n想开一个新系列或者接着某个系列，就在 series 写系列名（接着更就照抄原名）；不是系列就空着。";
          const heard = mineB.slice(0, 3).flatMap(x => arr(x.myDms).map(d => d.text)).slice(0, 6);
          if (heard.length) extra += "\n你最近几条视频画面上，有人发过这几条弹幕：" + heard.map(x => "「" + x + "」").join("") + "（不知道是谁发的）。";
        }
        return props.probeAs(c, charInstruction(acc.handle, sk, realFr ? [] : friends, acc, hotToday(), extra, typeof vclockMap === "function" ? vclockMap(Date.now(), c.id) : 0) + (toCp[c.id] ? cpPostLine(c, toCp[c.id], candid[c.id], opts.anniv) : ""), toCp[c.id] ? shapeChar(sk, !realFr && friends.length > 0, newAcc).replace(/\}$/, ',"cpEdit":{"handle":"","bio":""}}') : shapeChar(sk, !realFr && friends.length > 0, newAcc), { timeout: 180000 }).catch(() => null).then(d => {   // 等 3 分钟、到点真掐断（原来在外面赛跑，赛输了请求还在跑）
          done++; setProg(done + "/" + pick.length);
          if (!d || !S(d.scene)) { failed.push(c.name); return; }
          // 跟TA发过的字面差不多：这条就当没发
          const accounts = Object.assign({}, dbRef.current.accounts);
          const handle = S((accounts[c.id] || {}).handle) || S(d.handle).slice(0, 20) || c.name;
          const prevAcc = accounts[c.id] || {};
          const hadAcc = !!(prevAcc.bio || prevAcc.niche);
          // 号的样子第一次定下来就不再改；粉丝慢慢涨：这条有多少赞，大概有个零头会关注
          accounts[c.id] = Object.assign({}, prevAcc, { handle },
            hadAcc ? {} : { bio: S(d.bio).slice(0, 60), niche: S(d.niche).slice(0, 20) },
            { followers: Math.max(0, Math.round(Number(hadAcc ? prevAcc.followers : d.followers) || 0)) + Math.round((Number(d.likes) || 0) * 0.01) });
          const cpA = toCp[c.id];
          const nv = mkVideo(d, cpA ? { by: "char", charId: c.id, author: cpA.handle, skin: sk, cp: c.id, withCharId: c.id, ...(candid[c.id] ? { candid: true } : {}), ...(opts.anniv ? { anniv: opts.anniv } : {}) } : { by: "char", charId: c.id, author: handle, skin: sk });
          // 号的掌控权（第 4 条）：TA顺手改了情侣号的名字／简介 → 改掉，消息里告诉她
          if (cpA && d.cpEdit && typeof d.cpEdit === "object") {
            const nh = S(d.cpEdit.handle).slice(0, 20), nb = S(d.cpEdit.bio).slice(0, 80);
            const ch = {}; if (nh && nh !== cpA.handle) ch.handle = nh; if (nb && nb !== (cpA.bio || "")) ch.bio = nb;
            if (Object.keys(ch).length) {
              save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [c.id]: Object.assign({}, (dbRef.current.cps || {})[c.id], ch, { lastEdit: { by: c.id, ts: Date.now() } }) }) }));
              if (ch.handle) nv.author = ch.handle;
              note(c.name + " 把情侣号" + (ch.handle ? "的名字改成了「" + ch.handle + "」" : "") + (ch.handle && ch.bio ? "，" : "") + (ch.bio ? "简介改成了「" + ch.bio + "」" : ""), null);
            }
          }
          if (sk === "b" && S(d.series)) {
            nv.series = S(d.series).replace(/[《》]/g, "").slice(0, 20);
            nv.ep = dbRef.current.videos.filter(x => x.by === "char" && x.charId === c.id && x.series === nv.series).length + 1;
          }
          arr(d.friends).forEach(f => {
            const fr = f && friends.find(x => x.name === S(f.name));
            if (fr && S(f.text)) nv.comments.push({ id: uid("cm"), name: S(((dbRef.current.accounts || {})[fr.id] || {}).handle) || fr.name, text: S(f.text).slice(0, 300), by: "char", charId: fr.id, ts: Date.now() });
          });
          const th = d.thread && typeof d.thread === "object" ? d.thread : null;
          const thCm = th && S(th.reply) ? nv.comments.find(x => x.by === "npc" && x.name === S(th.name)) : null;
          if (thCm) {
            thCm.replies = [{ id: uid("rp"), name: nv.author, text: S(th.reply).slice(0, 300), by: "char", charId: c.id, ts: Date.now() }]
              .concat(S(th.back) ? [{ id: uid("rp"), name: thCm.name, text: S(th.back).slice(0, 300), by: "npc", ts: Date.now() }] : []);
            if (S(th.back) && props.remember) props.remember([c.id], "你在「" + APP_NAME + "」发的视频（" + S(nv.scene).slice(0, 40) + "）底下，网友「" + thCm.name + "」说「" + S(thCm.text).slice(0, 60) + "」，你回了「" + S(th.reply).slice(0, 60) + "」，对方又回你「" + S(th.back).slice(0, 60) + "」。");
          }
          save(Object.assign({}, dbRef.current, { accounts, videos: [nv].concat(dbRef.current.videos) }));
          if (cpA) cpFans(c.id, Math.round((Number(d.likes) || 0) * 0.03) + 20);
          // 追更（她 2026-10-08）：她追着的系列出了新一期，消息里落一条，点进去就是这一期
          if (nv.series && ((dbRef.current.me || {}).series || {})[c.id + "|" + nv.series]) note((accounts[c.id] || {}).handle + " 的《" + nv.series + "》更新到第 " + nv.ep + " 期", nv.id);
          names.push(c.name);
          if (realFr && friends.length && props.ask) {
            const frs = friends.map(f => Object.assign({}, charOf(f.id) || {}, { rel: f.rel })).filter(f => f.id);
            props.ask(acqSystem(nv, c, frs, frs.map(props.briefFor)), MINE_SHAPE.replace(',"likes":0', ""), c.id).then(r => {
              const cms = arr(r && r.comments).map(x => { const f = x && frs.find(y => y.name === S(x.name)); return f && S(x.text) ? { id: uid("cm"), name: S(((dbRef.current.accounts || {})[f.id] || {}).handle) || f.name, text: S(x.text).slice(0, 300), by: "char", charId: f.id, ts: Date.now() } : null; }).filter(Boolean);
              if (cms.length) patchV(nv.id, x => Object.assign({}, x, { comments: arr(x.comments).concat(cms) }));
            }).catch(() => {});
          }
        });
      };
      try {
        await Promise.all(pick.map(one));
        if (opts.quiet) return;
        if (names.length) toast(names.join("、") + " 发了新视频" + (failed.length ? "（" + failed.join("、") + " 这回没拍出来）" : ""));
        else toast("这一轮没发出来，再点一次试试");
        if (names.length) { setPage(p => p && p.kind === "refresh" ? null : p); setTab("home"); setFeed("follow"); posRef.current = {}; if (feedRef.current) feedRef.current.scrollTop = 0; }
      } finally { setBusy(null); setProg(""); }
    };
    // 刷几条路人的：一枪写完
    // city：同城那一格刷的（她 2026-10-07 选的第 3 条）——这批博主都在这座城里
    // q：搜一个词（她 2026-10-24「抖音 b 站能不能加个搜索，指定刷出啥」）——搜出来的都是路人博主的视频，
    //   刷完首页只看沾这个词的（跟点热门话题同一个筛法，上面挂一颗「搜：词 ✕」可以放开）
    // 首页顶上那颗「搜」（她 2026-10-24「我的片刻在哪搜索啊」：原来只藏在刷新页里）
    const askSearch = () => { if (typeof requestAppPrompt !== "function" || !props.ask) return;
      requestAppPrompt("搜点什么", "写一个词，刷一页跟它有关的路人视频；首页只看沾这个词的，顶上点一下放开。", "", q => { q = S(q).trim(); if (q) genNpc(null, q); }, "搜", { maxLength: 30 }); };
    const genNpc = async (city, q) => {
      const sk = skin;
      q = S(q).slice(0, 30);
      setBusy("npc");
      try {
        const d = await props.ask(npcSystem(uName, String((profile && profile.persona) || "").slice(0, 600), NPC_BATCH, sk, hotToday(), regsText(), props.worldHint ? props.worldHint() : "", typeof vclockMainMap === "function" ? vclockMainMap(Date.now()) : 0)
          + (city ? "\n这一批是「同城」：这几个博主都住在「" + city + "」，拍的东西跟这座城有关或者就发生在这座城里；城里是什么样子从你知道的这个地方长出来。"
            + (props.cityNote ? props.cityNote(city) : "") : "")
          + (q ? "\n这一批是「搜索结果」：有人在搜「" + q + "」，这几条都是跟「" + q + "」有关的视频——拍法、角度、口气各不一样，就像真在平台上搜出来的一页。每一条都得正面就是这个词说的那件事，点进来的人一眼认得出「对，我搜的就是这个」；不许借字面绕去别的行当（康复、健身、画画、考据那种），也不许用谐音、双关、误会来交差。尺度跟着这个词走，该多大就多大，不要含糊其辞。" : ""), shapeNpc(sk));
        const vids = arr(d && d.videos).filter(x => x && S(x.scene) && S(x.author)).map(x => mkVideo(x, Object.assign({ by: "npc", author: S(x.author).slice(0, 20), skin: sk }, city ? { city } : {}, regOf(x.author) ? { reg: regOf(x.author) } : {})))
          .map(v => q ? Object.assign({}, v, { tags: arr(v.tags).concat([q]), q }) : v);
        if (!vids.length) { toast(q ? "这一批没刷出来：模型可能不肯写这个词，换个说法或者换个宽松的后台模型" : "这一批没刷出来，再点一次"); return; }
        addVideos(vids); setPage(null); setTab("home"); setFeed(city ? "city" : "rec");
        if (q) setTopic(q);
        posRef.current = {}; if (feedRef.current) feedRef.current.scrollTop = 0;
      } catch (e) { toast(q ? "没刷出来：模型可能不肯写这个词，换个说法，或者换个宽松的后台模型" : "没刷出来：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(null); }
    };
    // 她评论 / 回楼：都走 crowd（上面那一串）。回复一条一条冒出来，隔一两秒一条，像真有人陆续在回（节奏同论坛）
    const crowd = async (vid, cmId, myText, targetCm) => {
      const v = dbRef.current.videos.find(x => x.id === vid); if (!v || !props.ask) return;
      const cm = arr(v.comments).find(x => x.id === cmId); if (!cm) return;
      const authorC = v.by === "char" ? charOf(v.charId) : (v.cp ? charOf(v.cp) : null);
      const tgtC = targetCm && targetCm.charId ? charOf(targetCm.charId) : null;
      // 谁一定接：她回的是角色 → 那个角色；在角色的视频 / 你俩的情侣号底下评论 → 作者本人；回的是路人 → 那个路人
      const resp = tgtC || (!targetCm || targetCm.isAuthor ? authorC : null);
      const handleOf = c => c === authorC && (v.by === "char" || v.cp) ? v.author : S(((dbRef.current.accounts || {})[c.id] || {}).handle) || c.name;
      const must = resp ? handleOf(resp) : targetCm && targetCm.by === "npc" ? S(targetCm.name) : "";
      const stranger = !!onAlt || (resp && !knows(resp));
      const ids = [];
      if (v.cp) ids.push("\n· 「" + v.author + "」是 " + uName + " 和 " + (authorC || {}).name + " 两个人共用的情侣号；以这个号名说话的就是 " + (authorC || {}).name + " 本人。");
      else if (v.by === "char" && authorC) ids.push("\n· 「" + v.author + "」是 " + authorC.name + " 自己的号，视频是TA发的。");
      else if (v.by === "me") ids.push("\n· 这条视频是「" + myName + "」自己发的。");
      else ids.push("\n· 「" + v.author + "」是一个普通博主，跟谁都不认识。");
      if (resp && resp !== authorC) ids.push("\n· 「" + handleOf(resp) + "」是 " + resp.name + " 自己的号。");
      ids.push(stranger ? "\n· 「" + myName + "」是个谁都不认识的账号，没人知道背后是谁" + (resp ? "，" + resp.name + " 也不知道" : "") + "。"
        : "\n· 「" + myName + "」就是 " + uName + " 本人" + (resp ? "，" + resp.name + " 认得出是她" : "") + "。");
      const lines = [cm.name + "：" + cm.text].concat(arr(cm.replies).map(r => r.name + (r.to ? " 回复 @" + r.to : "") + "：" + r.text));
      const put = r => patchV(vid, xv => Object.assign({}, xv, { comments: arr(xv.comments).map(c2 => c2.id === cmId ? Object.assign({}, c2, { replies: arr(c2.replies).concat([r]) }) : c2) }));
      setBusy("reply");
      try {
        // 条数不固定、而且要多（她 2026-10-15：「路人和整体回复数太固定了」「不不不我嫌少了评论」）：
        //   每回随机，少的时候三四个路人，热闹起来十来个。
        const CROWD_N = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 12];
        const crowdN = CROWD_N[Math.floor(Math.random() * CROWD_N.length)];
        const nTotal = (must ? 1 : 0) + (must ? crowdN : Math.max(1, crowdN));
        const d = await props.ask(crowdSystem(v, { regs: regsText(), me: myName, text: myText, n: String(nTotal), must, mustChar: !!resp, ids, brief: resp && props.briefFor ? props.briefFor(resp) : "", transcript: lines.join("\n") }), CROWD_SHAPE, (resp || authorC || {}).id);
        const items = arr(d && d.items).filter(x => x && S(x.text) && S(x.name) && S(x.name) !== myName).slice(0, nTotal + 1);
        let wait = 0;
        items.forEach((x, k) => {
          const isResp = resp && (k === 0 || S(x.name) === must);
          const name = isResp ? must : S(x.name).slice(0, 20);
          // 路人顶着认识的人的名字说话：丢掉
          if (!isResp && resp && name === must) return;
          const to = S(x.to) && S(x.to) !== name ? S(x.to).slice(0, 20) : "";
          const reg = isResp ? null : regOf(name);
          if (reg && to === myName) touchReg(reg, "theirs", x.tone);
          const r = { id: uid("rp"), name, text: S(x.text).slice(0, 300), by: isResp ? "char" : "npc", ...(isResp ? { charId: resp.id } : {}), ...(isResp && resp === authorC ? { isAuthor: true } : {}), ...(reg ? { reg } : {}), ...(to ? { to } : {}), ts: Date.now() + k };
          wait += k ? 900 + Math.random() * 2200 : 500;
          setTimeout(() => { put(r); if (to === myName || (k === 0 && must)) note(name + " 回复了你：" + r.text, vid); }, wait);
        });
        if (!items.length) toast("这回没人接话");
        setTimeout(() => setBusy(b => b === "reply" ? null : b), wait + 200);
      } catch (e) { toast("回复没刷出来：" + ((e && e.message) || "")); setBusy(null); }
    };
    // 熟面孔（论坛那批人）：拼进提示词的那一段、按网名认人、记碰面账（她用小号时不记，跟论坛一样）
    const regsText = () => props.regulars ? regularsBlock(props.regulars(), props.regularPairs ? props.regularPairs() : [], myName) : "";
    const regOf = name => { if (!props.regulars) return null; const r = props.regulars().find(x => x.name === S(name)); return r ? r.id : null; };
    const touchReg = (id, dir, tone) => { if (id && props.touchRegular && !onAlt) props.touchRegular(id, dir, tone === "warm" || tone === "spar" ? tone : ""); };
    // 刷点评论（她 2026-10-15：「跟论坛一样可以不用自己评论直接生成路人评论」）：一枪写一批路过的网友，
    //   有的另起一条，有的回底下已有的那几条；一两秒冒一条。认识的人不在这一枪里（他们各走自己那份）。
    const moreComments = async vid => {
      const v = dbRef.current.videos.find(x => x.id === vid); if (!v || !props.ask) return;
      const n = [4, 5, 6, 6, 7, 8, 9, 10][Math.floor(Math.random() * 8)];
      const have = arr(v.comments).slice(-14).map(c => c.name + "：" + c.text + arr(c.replies).slice(-3).map(r => "\n  " + r.name + (r.to ? " 回复 @" + r.to : "") + "：" + r.text).join("")).join("\n");
      const authorC = v.by === "char" ? charOf(v.charId) : (v.cp ? charOf(v.cp) : null);
      const known = [v.by !== "npc" ? v.author : "", myName].filter(Boolean);
      const sys = AC() + CB() + "【场景】「" + APP_NAME + "」上一条视频（@" + v.author + "）拍的是：" + S(v.scene).slice(0, 200) + (v.caption ? "；文案：" + S(v.caption).slice(0, 80) : "") + "。"
        + (v.cp ? "\n这是一个情侣号，刷到的多半是这个号的 CP 粉：催更、考古以前的视频、给他俩起 CP 名、嗑到了、起哄。" : "")
        + (have ? "\n\n【底下已有的评论】\n" + have : "\n\n底下还没有评论。")
        + "\n\n写正好 " + n + " 条刚刷到这条的陌生网友的评论 items（name 网名、text、to：要是在回底下某一条就照抄那条的网名，另起一条就空着）。"
        + "\n他们素不相识，只看得见这条视频和这些评论，不认识「" + known.join("」「") + "」，只当普通账号。像真在刷评论区：短，一句甚至几个字；不复述视频、不写作文；有人只发「哈哈哈哈」或表情，有人抓一个词起哄，有人唱反调，有人答非所问，有人在楼里接别人的话；口气、长短、标点各不一样。"
        + "\n⚠️不许以「" + known.join("」「") + "」的名义写任何一句。" + regsText();
      setBusy("more:" + vid);
      try {
        const d = await props.ask(sys, CROWD_SHAPE, authorC ? authorC.id : null);
        const bad = new Set(known);
        const items = arr(d && d.items).filter(x => x && S(x.text) && S(x.name) && !bad.has(S(x.name))).slice(0, n + 2);
        if (!items.length) { toast("这回没人路过"); setBusy(null); return; }
        let wait = 0;
        items.forEach((x, k) => {
          wait += k ? 700 + Math.random() * 1800 : 300;
          setTimeout(() => patchV(vid, xv => {
            const name = S(x.name).slice(0, 20), text = S(x.text).slice(0, 200), to = S(x.to), reg = regOf(name);
            if (reg && to === myName) touchReg(reg, "theirs", x.tone);
            const host = to && to !== name ? arr(xv.comments).find(c => c.name === to) || arr(xv.comments).find(c => arr(c.replies).some(r => r.name === to)) : null;
            if (host) return Object.assign({}, xv, { comments: arr(xv.comments).map(c => c.id === host.id ? Object.assign({}, c, { replies: arr(c.replies).concat([{ id: uid("rp"), name, text, by: "npc", ...(reg ? { reg } : {}), ...(to !== host.name ? { to } : {}), ts: Date.now() }]) }) : c) });
            return Object.assign({}, xv, { comments: arr(xv.comments).concat([{ id: uid("cm"), name, text, by: "npc", ...(reg ? { reg } : {}), ts: Date.now() }]) });
          }), wait);
        });
        setTimeout(() => setBusy(b => b === "more:" + vid ? null : b), wait + 200);
      } catch (e) { toast("没刷出评论：" + ((e && e.message) || "")); setBusy(null); }
    };
    // 她评论：落一条自己的，然后那一串陆续接上来（作者的视频作者必回；她自己的视频是路人和认识的人来接）
    const comment = (id, text, emo) => {
      const v0 = dbRef.current.videos.find(x => x.id === id); if (!v0) return;
      const mine = { id: uid("cm"), name: myName, text, by: "me", alt: !!onAlt, ...(maskUse ? { mask: maskUse } : {}), ...(emo ? { emo } : {}), ts: Date.now() };
      patchV(id, v => Object.assign({}, v, { comments: arr(v.comments).concat([mine]) }));
      crowd(id, mine.id, text, { name: v0.author, isAuthor: true, by: v0.by });
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
          if (cm) { patchV(v.id, x => Object.assign({}, x, { comments: arr(x.comments).concat([{ id: uid("cm"), name: handle, text: cm, by: "char", charId: c.id, ts: Date.now() }]) })); note(handle + " 评论了你小号的视频：" + cm, v.id); }
          if (d.recognized === true && props.remember) props.remember([c.id], "你在「" + APP_NAME + "」上刷到一个叫「" + alt + "」的小号发的视频（拍的是：" + S(v.scene).slice(0, 60) + "），你觉得那是 " + uName + " 的小号" + (S(d.why) ? "——" + S(d.why).slice(0, 80) : "") + "。她不知道你认出来了。");
        });
      } catch (e) {}
    };

    // 她发一条：认识她的人刷到了
    const postMine = async d => {
      const v = mkVideo({ scene: d.scene, caption: d.caption, who: d.who, title: d.title, tags: (d.caption.match(/#([^\s#]+)/g) || []).map(x => x.slice(1)) }, { by: "me", author: myName, likes: 0, comments: [], skin, ...(d.img ? { img: d.img, photo: true } : {}) });
      const co = d.withId ? charOf(d.withId) : null;
      if (co) { v.withCharId = co.id; v.withName = S(((dbRef.current.accounts || {})[co.id] || {}).handle) || co.name; }
      if (onAlt) v.alt = true;
      if (maskUse) v.mask = maskUse;
      const sameChar0 = d.same && d.same.by === "char" ? charOf(d.same.charId) : null;
      const sameChar = sameChar0 && knows(sameChar0) ? sameChar0 : null;
      if (d.same) { v.sameOf = d.same.id; v.sameAuthor = d.same.author; }
      if (d.chal) v.chal = d.chal;
      // 发在情侣号上：TA也是这个号的主人，画面默认你俩（画出来锁两张脸），TA当然会看到
      const cpChar = onCp ? charOf(cpId) : null;
      if (cpChar) { v.cp = cpId; if (!co) { v.withCharId = cpChar.id; } }
      addVideos([v]); setPage(null); setTab("me");
      if (onAlt) { spotAlt(v, altName); return; }   // 小号发的：悄悄的，不叫认识她的人来；但TA们自己刷到了另说
      // 合拍的那一位一定在（TA就在画面里），其余随缘两个
      // 刷到、来评论的只叫认得出这张面具的人（合拍的那一位本来就在画面里，照旧来）
      const lead = cpChar || co || sameChar;
      // 谁刷到了：本机先掷骰子（她 2026-10-15）——先掷有没有人刷到，再掷几个、是谁；
      //   掷中的那几位一枪写完，各带自己的人设、跟你的关系、你俩最近怎么说话（briefFor），外加防八股那一套（AC）。
      //   一个都没刷到就不花这次调用。合拍／情侣号／被拍同款的那一位本来就在，不掷。
      // 她自己身边的配角也刷得到她发的（群里 2026-10-22「我自己的 npc 在别的 app 也该能跟我互动」）：大号发的才来，跟角色一起掷
      const myNpcs = maskUse ? [] : arr(props.myNpcs).filter(Boolean);
      const others = characters.filter(c => (!lead || c.id !== lead.id) && knows(c)).concat(myNpcs).sort(() => Math.random() - 0.5);
      const anyone = lead ? true : Math.random() < 0.4;   // 四成（她 2026-10-15：「太多了改成四成」）
      const howMany = anyone ? [1, 1, 2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 8)] - (lead ? 1 : 0) : 0;
      const pool = (lead ? [lead] : []).concat(others.slice(0, Math.max(0, howMany)));
      if (!pool.length) { patchV(v.id, x => Object.assign({}, x, { likes: Math.floor(Math.random() * 40), plays: Math.floor(Math.random() * 400) })); return; }
      setBusy("post");
      try {
        const r = await props.ask(mineSystem(v, uName, pool, pool.map(props.briefFor), co, cpChar ? { name: cpChar.name, handle: cps[cpId].handle } : null, sameChar && !onAlt ? { name: sameChar.name, scene: d.same.scene } : null), (co || cpChar) ? MINE_SHAPE.replace(/\}$/, ',"crowd":[{"name":"","text":""}]}') : MINE_SHAPE, pool[0].id);
        const names = pool.map(c => c.name);
        const cms = arr(r && r.comments).filter(x => x && names.indexOf(S(x.name)) >= 0 && S(x.text))
          .map(x => { const c = pool.find(cc => cc.name === S(x.name)); return { id: uid("cm"), name: S(((dbRef.current.accounts || {})[c.id] || {}).handle) || c.name, text: S(x.text).slice(0, 300), by: "char", charId: c.id, ts: Date.now() }; });
        const likes = Math.max(0, Math.round(Number(r && r.likes) || 0));
        // 合拍的起哄：网友那几句（只有合拍才有）
        const crowd = (co || cpChar) ? normComments(r && r.crowd) : [];
        if (cpChar) cpFans(cpId, Math.round(Math.max(0, Number(r && r.likes) || 0) * 0.02) + 10);
        patchV(v.id, x => Object.assign({}, x, { likes, plays: Math.max(likes * 8, likes), comments: cms.concat(crowd) }));
        cms.forEach(c => note(c.name + " 评论了你的视频：" + c.text, v.id));
      } catch (e) { toast("评论区还空着：" + ((e && e.message) || "")); }
      finally { setBusy(null); }
    };
    // scene2：她改过的画面描述（她 2026-10-17：片刻也要能改描述再画）
    const draw = async (v, scene2) => {
      setDrawing(v.id);
      try {
        const sc = String(scene2 || "").trim() || v.scene;
        const ref = v.withCharId && props.drawDuo ? await props.drawDuo(v.withCharId, sc) : await props.draw(v.by === "char" ? v.charId : null, sc, v.who);
        patchV(v.id, x => Object.assign({}, x, { img: ref }, sc !== v.scene ? { scene: sc } : {}));
      }
      catch (e) { toast("没画出来：" + ((e && e.message) || "")); }
      finally { setDrawing(null); }
    };
    // 扔掉不想要的那条（ooc 的、写坏的）。先问一句，删了就没了
    const editDraw = v => {
      if (typeof requestAppPrompt !== "function") return;
      requestAppPrompt("改画面描述再画", "改这一段，照新的画一张封面。", v.scene || "", txt => { if (String(txt || "").trim()) draw(v, txt); }, "照这个画", { multiline: true });
    };
    const del = v => {
      const go = () => { save(Object.assign({}, dbRef.current, { videos: dbRef.current.videos.filter(x => x.id !== v.id) })); setPage(p => p && p.id === v.id ? (p.back || null) : p); toast("扔掉了"); };
      requestAppConfirm("扔掉这条视频？", "扔了就找不回来了" + (v.img ? "，画出来的那张图也一起不要了" : "") + "。", go, "扔掉");
    };
    // 投币：一天两枚，一条最多投两枚（B站就是这么算的）
    const coinKey = todayKey();
    const coinsLeft = db.me && db.me.coinDay === coinKey ? (db.me.coinLeft || 0) : 2;
    const coin = v => {
      if (coinsLeft <= 0) { toast("今天的硬币投完了，明天再来"); return; }
      if ((v.myCoins || 0) >= 2) { toast("一条最多投两枚"); return; }
      const nv = Object.assign({}, v, { myCoins: (v.myCoins || 0) + 1, coins: (v.coins || 0) + 1 });
      save(Object.assign({}, dbRef.current, { videos: dbRef.current.videos.map(x => x.id === v.id ? nv : x), me: Object.assign({}, dbRef.current.me, { coinDay: coinKey, coinLeft: coinsLeft - 1 }) }));
    };
    // 充电：真金白银，从她钱包出、进TA钱包；TA会记得有人充过（用大号充的知道是她）
    const charge = (v, amt) => {
      const c = charOf(v.charId); if (!c || !props.pay) return;
      if (typeof props.wallet === "number" && props.wallet < amt) { toast("钱包余额不够"); return; }
      props.pay(-amt, "片刻充电 · " + v.author);
      // 平台抽成（她 2026-10-08：「b站我打赏他只能收到75%」）
      if (props.charPay) props.charPay(c.id, Math.floor(amt * (1 - CHARGE_CUT)), "片刻收到充电（平台抽走 " + Math.round(CHARGE_CUT * 100) + "%）");
      patchV(v.id, x => Object.assign({}, x, { charged: (x.charged || 0) + amt }));
      if (props.remember) props.remember([c.id], onAlt || !knows(c) ? "有个叫「" + myName + "」的账号在「" + APP_NAME + "」上给你的视频充了 " + amt + " 元电，你不知道是谁。" : uName + "在「" + APP_NAME + "」上给你的视频充了 " + amt + " 元电。");
      toast("充了 ¥" + amt);
    };
    // 她自己发的弹幕：飘在画面上；TA下次在横着看那套发视频时会看到（不知道是谁）
    const dm = (v, text) => { patchV(v.id, x => Object.assign({}, x, { myDms: arr(x.myDms).concat([{ text: text.slice(0, 30), ts: Date.now() }]).slice(-20) })); toast("弹幕发出去了"); };
    // 楼中楼：她回了某一条评论（或那条底下的某个人）——被回的那个必接，旁人看情况
    const reply = (v, cid, text, toName, emo) => {
      const target = arr(v.comments).find(x => x.id === cid); if (!target) return;
      patchV(v.id, x => Object.assign({}, x, { comments: arr(x.comments).map(cm => cm.id === cid ? Object.assign({}, cm, { replies: arr(cm.replies).concat([{ id: uid("rp"), name: myName, text, by: "me", ...(toName ? { to: toName } : {}), ...(emo ? { emo } : {}), ts: Date.now() }]) }) : cm) }));
      const sub = toName ? arr(target.replies).slice().reverse().find(r => r.name === toName && r.by !== "me") : null;
      const who = sub || (target.by !== "me" ? target : arr(target.replies).slice().reverse().find(r => r.by !== "me")) || null;
      if (who && who.by === "npc") touchReg(who.reg || regOf(who.name), "mine");   // 她去接熟面孔的话
      crowd(v.id, cid, text, who);
    };
    const like = v => { patchV(v.id, x => Object.assign({}, x, { liked: !x.liked, likedTs: x.liked ? 0 : Date.now() })); sawCandid(v); };
    // 纪念日自动发（第 5 条）：在一起满整百天、整周年那天，进片刻时TA自己往情侣号发一条（一天一回，一次调用）
    useEffect(() => {
      if (!props.coupleOf || !props.probeAs) return;
      // 「今天」和「在一起那天」都照这个人那只钟算（虚拟时间拨过的话，纪念日是钟上的那天）
      const vm = (t, id) => typeof vclockMap === "function" ? vclockMap(t, id) : t;
      togetherIds.forEach(id => {
        const d0 = new Date(vm(Date.now(), id)); d0.setHours(0, 0, 0, 0);
        const key = d0.getFullYear() + "-" + (d0.getMonth() + 1) + "-" + d0.getDate();
        const a = (dbRef.current.cps || {})[id], cp = props.coupleOf(id) || {};
        if (!a || !cp.since || a.annivDone === key) return;
        const label = annivLabel(vm(Number(cp.since) || cp.since, id), d0);
        if (!label) return;
        save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: Object.assign({}, a, { annivDone: key }) }) }));
        genChars([id], true, { anniv: label, quiet: true }).then(() => note((charOf(id) || {}).name + " 在你俩的情侣号上发了一条「" + label + "」", null)).catch(() => {});
      });
    }, []);
    // 她刷到了TA偷拍她的那条（点赞或点开评论）：TA记一笔「她看到了」，只记一次
    const sawCandid = v => {
      if (!v || !v.candid || v.candidSeen || !v.charId) return;
      patchV(v.id, x => Object.assign({}, x, { candidSeen: Date.now() }));
      if (props.remember) props.remember([v.charId], uName + " 刷到了你背着她偷偷发在情侣号上的那条（" + S(v.scene).slice(0, 50) + "），她看到了。");
    };
    const fave = v => patchV(v.id, x => Object.assign({}, x, { faved: !x.faved }));

    // 两套各刷各的：没标皮的旧视频算竖屏那套
    const ofSkin = arr(db.videos).filter(v => vidSkin(v) === skin);
    const favAll = ofSkin.filter(v => v.faved);
    const topicHit = v => !topic || [v.caption, v.title, v.scene].concat(arr(v.tags)).some(x => String(x || "").indexOf(topic) >= 0);
    const cities = skin === "v" && props.cities ? props.cities() : [];
    const cityNow = cities.indexOf(cityPick) >= 0 ? cityPick : (cities[0] || "");
    const list = feed === "city" && cities.length ? ofSkin.filter(v => v.city && v.city === cityNow)
      : ofSkin.filter(v => v.by !== "me" && !v.city && (feed === "rec" ? v.by !== "char" : v.by === "char") && topicHit(v));
    // ⚠️关注只放你的人发的，推荐只放路人（她 2026-10-07：「关注和推荐看到的都是一样的」——原来推荐是全部，只刷过你的人时两边一模一样）
    const hot = db.hot && db.hot.day === todayKey() ? arr(db.hot.topics) : [];
    // 热门那一条：横着一排，点一个只看沾这个话题的，再点一下放开
    const hotStrip = (ink, dim, bg) => topic && !hot.some(x => x.title === topic) ? h("div", { "data-wk": "shuasearchchip", className: "flex items-center", style: { gap: 8, padding: "4px 12px 6px", background: bg } },
        h("button", { onClick: () => setTopic(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.accent, fontWeight: 700, minHeight: 28, textShadow: skin === "v" ? "0 1px 3px rgba(0,0,0,.6)" : "none" } }, "搜：" + topic + "  ✕"))
      : hot.length ? h("div", { "data-wk": "shuahot", className: "flex items-center", style: { gap: 8, overflowX: "auto", maxWidth: "100%", padding: "4px 12px 6px", whiteSpace: "nowrap", background: bg, touchAction: "pan-x", overscrollBehaviorX: "contain" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.accent, flexShrink: 0 } }, "热门"),
      hot.map(x => h("button", { "data-wk": "shuahotchip", "data-on": topic === x.title ? "1" : "0", key: x.title, onClick: () => setTopic(t2 => t2 === x.title ? "" : x.title), className: "active:opacity-60 shrink-0",
        style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: topic === x.title ? P.accent : ink, fontWeight: topic === x.title ? 700 : 400, minHeight: 28, textShadow: skin === "v" ? "0 1px 3px rgba(0,0,0,.6)" : "none" } }, "#" + x.title))) : null;
    // 大号、小号、情侣号各看各的作品；情侣号里TA发的也算
    const mine = onCp ? ofSkin.filter(v => v.cp === cpId) : ofSkin.filter(v => v.by === "me" && !v.cp && !!v.alt === onAlt && (onAlt || String(v.mask || "") === maskUse));
    const unread = arr(db.notes).filter(n => n.unread).length;

    // 全屏的那几页
    // 评论层：上面三成露着视频，点那块就收；评论区占下面七成。
    //   首页、单条视频、我的作品、收藏都挂这一层（她 2026-10-15：「从我的作品、收藏或者别人主页点进单条视频…也改了」）
    const sheetLayer = () => {
      const sheetV = sheet ? arr(db.videos).find(x => x.id === sheet) : null;
      return sheetV ? h("div", { "data-wk": "shuacmtsheet", style: { position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column" } },
        h("div", { onClick: () => setSheet(null), "aria-label": "收起评论", style: { flex: "0 0 30%", background: "rgba(0,0,0,.25)" } }),
        h("div", { style: { flex: "1 1 auto", minHeight: 0, boxShadow: "0 -6px 20px rgba(0,0,0,.35)", borderRadius: "14px 14px 0 0", overflow: "hidden" } },
          h(CommentsPage, cmtProps(sheetV, { sheet: true, onBack: () => setSheet(null) })))) : null;
    };
    // 评论区（整页和底下那一层）共用的那几样：发、回、带表情、点名字进主页、刷点评论
    const cmtProps = (v, extra) => Object.assign({ v, t, P, busy: busy === "reply" || busy === "more:" + v.id,
      onSend: (x, emo) => comment(v.id, x, emo), onReply: (cid, x, to, emo) => reply(v, cid, x, to, emo),
      emotePacks: props.emotePacks || [], onMore: props.ask ? () => moreComments(v.id) : null, more: busy === "more:" + v.id,
      onPerson: id => charOf(id) ? setPage({ kind: "acct", charId: id, back: page }) : null }, extra);
    const withSheet = node => h("div", { className: "h-full", style: { position: "relative" } }, node, sheetLayer());
    if (page && page.kind === "comments") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(CommentsPage, cmtProps(v, { onBack: () => setPage(page.back || null) }));
    }
    if (page && page.kind === "bdetail") {
      const v = db.videos.find(x => x.id === page.id);
      if (v) return h(BDetail, { v, charOf, seriesOn: !!(v.series && v.charId && ((dbRef.current.me || {}).series || {})[v.charId + "|" + v.series]),
        onFollowSeries: v.series && v.charId && v.by === "char" ? () => { const k = v.charId + "|" + v.series, me = dbRef.current.me || {}, sr = Object.assign({}, me.series); if (sr[k]) delete sr[k]; else sr[k] = true; save(Object.assign({}, dbRef.current, { me: Object.assign({}, me, { series: sr }) })); toast(sr[k] ? "追更了，出新一期会在消息里提醒你" : "不追了"); } : null, busy: busy === "reply" || busy === "more:" + v.id, onMore: props.ask ? () => moreComments(v.id) : null, moreBusy: busy === "more:" + v.id, onBack: () => page.fromChat && window.__goScreen ? window.__goScreen("thread") : setPage(page.back || null), onLike: () => like(v), onFave: () => fave(v),
        onDraw: props.canDraw ? () => draw(v) : null, onEditDraw: props.canDraw ? () => editDraw(v) : null, drawing: drawing === v.id, onSend: x => comment(v.id, x),
        onShare: props.onShare ? () => setPage({ kind: "share", id: v.id, back: page }) : null,
        onAuthor: v.by === "char" ? () => setPage({ kind: "acct", charId: v.charId, back: page }) : null,
        onDel: () => del(v),
        coinsLeft, onCoin: v.by === "me" ? null : () => coin(v),
        onCharge: v.by === "char" && props.pay ? amt => charge(v, amt) : null,
        onDm: x => dm(v, x), onReply: (cid, x) => reply(v, cid, x) });
    }
    // TA的号（第 5 条）：主页简介、平时发什么、粉丝，下面是这个号发过的（当前这套皮的）
    if (page && page.kind === "acct") {
      const c = charOf(page.charId), acc = (db.accounts || {})[page.charId] || {};
      const vids = ofSkin.filter(v => v.by === "char" && v.charId === page.charId);
      if (c) return h("div", { "data-wk": "shuaprofile", className: "h-full flex flex-col", style: { background: P.bg } },
        h(Head, { zh: acc.handle || c.name, bg: "transparent", ink: P.ink, onBack: () => setPage(page.back || null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: 20 } },
          h("div", { "data-wk": "shuaprofilehead", className: "flex items-center", style: { gap: 14, marginTop: 6 } },
            h(Avatar, { character: c, size: 64 }),
            h("div", { className: "flex", style: { gap: 18 } },
              [[vids.length, "作品"], [vids.reduce((n, v) => n + (Number(v.likes) || 0), 0), "获赞"], [acc.followers || 0, "粉丝"]].map(x => h("div", { key: x[1] },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: P.ink } }, fmtN(x[0])),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim } }, x[1]))))),
          acc.bio ? h("div", { "data-wk": "shuabio", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.ink, marginTop: 12, lineHeight: 1.6 } }, acc.bio) : null,
          acc.niche ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim, marginTop: 4 } }, "平时发：" + acc.niche) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, margin: "18px 0 8px" } }, "作品"),
          vids.length ? h("div", { style: { display: "grid", gridTemplateColumns: skin === "b" ? "1fr 1fr" : "repeat(3,1fr)", gap: skin === "b" ? 8 : 3 } }, vids.map(v => skin === "b"
            ? h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id, back: page }) })
            : h("button", { "data-wk": "shuatile", key: v.id, onClick: () => setPage({ kind: "one", id: v.id, back: page }), className: "active:opacity-80", style: { position: "relative", aspectRatio: "3 / 4", overflow: "hidden", background: coverBg(v), textAlign: "left", padding: 6 } },
              !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.caption || v.scene) : null,
              h("div", { style: { position: "absolute", left: 6, bottom: 4, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: INK, textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, "赞 " + fmtN(v.likes))))) :
            h("div", { "data-wk": "shuaempty", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.dim, textAlign: "center", padding: "30px 0" } }, "这套里还没发过")));
    }
    // 分享给 TA（她 2026-10-07 选的第 3 条）：挑人，开过小房间的再挑发进哪间。落一张卡，不让TA当场开口
    if (page && page.kind === "share") {
      const v = db.videos.find(x => x.id === page.id);
      // 一起看（她 2026-10-08）：横着看的长视频可以拉 TA 一起看——卡里带着简介、时长、几条弹幕，TA 读到卡就知道你俩在一块儿看；不额外调用
      const together = !!page.together && vidSkin(v || {}) === "b";
      const done = (c, rid) => { props.onShare(together ? Object.assign({}, v, { together: true }) : v, c, rid); setPage(page.back || null); };
      if (v) return h(ShareToCharPicker, { characters, wk: "shuashare", title: "分享给谁", ink: P.ink, line: P.line, field: P.field, bg: P.bg, onPick: done, onBack: () => setPage(page.back || null),
        top: vidSkin(v) === "b" ? h("button", { "data-wk": "shuatogether", "data-on": together ? "1" : "0", onClick: () => setPage(Object.assign({}, page, { together: !page.together })), className: "w-full text-left active:opacity-70", style: { minHeight: 42, marginTop: 4, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: together ? P.accent : P.dim } },
          (together ? "● " : "○ ") + "拉 TA 一起看（TA 会跟你边看边聊）") : null });
    }
    if (page && page.kind === "refresh") return h(RefreshPage, { characters, t, P, busy, prog,
      realFriends: !!(db.me && db.me.realFriends), onRealFriends: () => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { realFriends: !(dbRef.current.me && dbRef.current.me.realFriends) }) })), onHot: props.ask ? genHot : null, hotDay: hot.length > 0, onSearch: props.ask ? (q => genNpc(null, q)) : null, onNpc: () => genNpc(feed === "city" && cities.length ? cityNow : ""), npcCity: feed === "city" && cities.length ? cityNow : "", onChars: genChars, onBack: () => setPage(null) });
    if (page && page.kind === "cpchal") return h(CpChallengePage, { P, cName: (charOf(cpId) || {}).name || "TA", busy: busy === "chal" || busy === "post", onGo: playChallenge, onBack: () => setPage(null) });
    if (page && page.kind === "post") return h(PostPage, { P, skin, characters, onAlt: onAlt || onCp, same: page.same || null, busy: busy === "post", onPost: postMine, onLive: () => { setPage(null); setLiveStart("setup:host"); setTab("live"); }, onBack: () => setPage(null) });

    // ⚠️点进评论／播放页是整页换掉的，回来时首页重新挂一遍——原来就从第一条开始了
    //   （群友 2026-10-07：「每次点视频的评论，看完了又会回到第一条」）。按「哪一格哪一套」记住滑到哪儿，挂回来时放回去。
    //   竖屏记的是第几条（格高可能变），横屏记像素。
    const posKey = (page && (page.kind === "mine" || page.kind === "favs") ? page.kind : tab + "|" + feed) + "|" + skin;
    const keepPos = (el, unit) => {
      if (!el || el.__posKept) return;
      el.__posKept = true;
      const at = posRef.current[posKey] || 0;
      if (at) requestAnimationFrame(() => { el.scrollTop = unit ? at * unit : at; });
    };
    const feedView = (vids, empty) => h("div", { "data-wk": "shuafeed", ref: el => { feedRef.current = el; keepPos(el, paneH); },
      onScroll: e => { posRef.current[posKey] = Math.round(e.currentTarget.scrollTop / (paneH || 1)); }, className: "flex-1 min-h-0", style: { overflowY: "auto", scrollSnapType: "y mandatory", background: BLACK } },
      vids.length ? vids.map(v => h(VideoPane, { key: v.id, v, height: paneH, charOf,
        onLike: () => like(v), onFave: () => fave(v),
        onComments: () => { setSheet(v.id); sawCandid(v); },
        onShare: props.onShare ? () => setPage({ kind: "share", id: v.id, back: page }) : null,
        onAuthor: v.by === "char" ? () => setPage({ kind: "acct", charId: v.charId, back: page }) : null,
        onDel: () => del(v),
        onSame: v.by !== "me" ? () => setPage({ kind: "post", same: v }) : null,
        onDraw: props.canDraw ? () => draw(v) : null, onEditDraw: props.canDraw ? () => editDraw(v) : null, drawing: drawing === v.id })) : empty);
    const gridView = (vids, empty) => h("div", { "data-wk": "shuagrid", ref: el => keepPos(el, 0), onScroll: e => { posRef.current[posKey] = e.currentTarget.scrollTop; }, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 8px 14px", background: B.bg } },
      vids.length ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, vids.map(v => h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id, back: page }) }))) : empty);
    const emptyFeed = h("div", { "data-wk": "shuaempty", style: { height: "100%", minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 30px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: P.dim, textAlign: "center", lineHeight: 1.6 } }, feed === "follow" ? "你关注的人还没发过视频" : feed === "rec" ? "推荐里是路人博主，点刷新 → 刷几条路人的" : feed === "city" && cities.length ? "「" + cityNow + "」还没刷过，点右上角「刷新」" : "还什么都没有"),
      h("button", { "data-wk": "shuarefreshbtn", onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-70", style: { minHeight: 42, padding: "0 22px", borderRadius: 999, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "刷一刷"));

    // 「我」那一格点进收藏：同一个竖着刷的样子，只放收藏的
    // 从消息点进来的那一条：竖着刷那套就整屏放这一条（评论、点赞照常），横着看那套直接进播放页
    const openNote = n => {
      save(Object.assign({}, dbRef.current, { notes: arr(dbRef.current.notes).map(x => x.id === n.id ? Object.assign({}, x, { unread: false }) : x) }));
      const v = arr(dbRef.current.videos).find(x => x.id === n.vid);
      if (!v) { toast("那条视频已经不在了"); return; }
      setPage(vidSkin(v) === "b" ? { kind: "bdetail", id: v.id } : { kind: "one", id: v.id });
    };
    if (page && page.kind === "one") { const ov = arr(db.videos).find(x => x.id === page.id);
      return withSheet(h("div", { "data-wk": "shuaone", className: "h-full flex flex-col", style: { background: BLACK } },
        h(Head, { zh: "视频", bg: "transparent", ink: INK, onBack: () => page.fromChat && window.__goScreen ? window.__goScreen("thread") : setPage(page.back || null) }),
        ov ? feedView([ov], null) : null)); }
    if (page && page.kind === "favs") return withSheet(h("div", { "data-wk": "shuafavs", className: "h-full flex flex-col", style: { background: P.bg } },
      h(Head, { zh: "我的收藏", bg: "transparent", ink: P.ink, onBack: () => setPage(null) }),
      feedView(page.folder && page.folder !== "all" ? favAll.filter(v => page.folder === "none" ? !arr(db.folders).some(f => f.id === v.folder) : v.folder === page.folder) : favAll, null)));
    // 「我」那一格点进自己的作品
    if (page && page.kind === "mine") return withSheet(h("div", { "data-wk": "shuamine", className: "h-full flex flex-col", style: { background: P.bg } },
      h(Head, { zh: "我的作品", bg: "transparent", ink: P.ink, onBack: () => setPage(null) }),
      skin === "b" ? gridView(mine, null) : feedView(mine, null)));

    const feedTabs = (ink, dim, bar) => [["follow", "关注"], ["rec", "推荐"]].concat(cities.length ? [["city", "同城"]] : []).map(f => h("button", { "data-wk": "shuafeedtab", "data-on": feed === f[0] ? "1" : "0", key: f[0], onClick: () => setFeed(f[0]), className: "active:opacity-60 flex flex-col items-center", style: { minHeight: 36, whiteSpace: "nowrap", flexShrink: 0 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))", color: feed === f[0] ? ink : dim, fontWeight: feed === f[0] ? 700 : 400, textShadow: skin === "v" ? "0 1px 3px rgba(0,0,0,.5)" : "none" } }, f[1]),
      h("span", { style: { width: 18, height: 2.5, borderRadius: 2, marginTop: 4, background: feed === f[0] ? bar : "transparent" } })));
    // 让 TA 给情侣号起名、写简介：走TA自己那份完整上下文（人设、记忆、你俩的梗），一次调用
    const nameCp = async id => {
      const c = charOf(id); if (!c || !props.probeAs) return;
      const a = (dbRef.current.cps || {})[id];
      setBusy("cpname:" + id);
      try {
        const d = await props.probeAs(c, "【这一轮发生在「" + APP_NAME + "」】" + (a ? "你和 " + uName + " 共用的情侣号现在叫「" + a.handle + "」" + (a.bio ? "，主页简介是「" + a.bio + "」" : "，还没写简介") + "。她请你来重新起名、写简介——想留着原来的名字也行。" : "你和 " + uName + " 要开一个两个人共用的情侣号，她请你来起名、写主页简介。")
          + "\n照你这个人、你俩现在的关系、你们之间的梗来起：handle 是号名（16 个字以内），bio 是主页简介（一两句，60 个字以内，粉丝点进来看到的那句）。", '{"handle":"","bio":""}');
        const handle = S(d && d.handle).slice(0, 20), bio = S(d && d.bio).slice(0, 80);
        if (!handle && !bio) { toast("TA 想了想，没起出来"); return; }
        const base = a || { followers: 0, ts: Date.now() };
        save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: Object.assign({}, base, handle ? { handle } : {}, bio ? { bio } : {}, { namedBy: c.id }) }),
          me: a ? dbRef.current.me : Object.assign({}, dbRef.current.me, { using: "cp:" + id }) }));
        toast(c.name + " 起好了：「" + (handle || base.handle) + "」");
      } catch (e) { toast("没起出来：" + ((e && e.message) || "")); }
      finally { setBusy(b => b === "cpname:" + id ? null : b); }
    };
    // 她自己改了号名／简介：记一笔「是她改的」，TA下回往这个号发东西时知道，聊天里也可能提（号的掌控权）
    const setCp = (id, patch) => {
      const a = (dbRef.current.cps || {})[id] || {};
      const changed = Object.keys(patch).filter(k => S(patch[k]) !== S(a[k]));
      if (!changed.length) return;
      save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: Object.assign({}, a, patch, { lastEdit: { by: "me", ts: Date.now() } }) }) }));
      if (props.remember) props.remember([id], uName + " 把你俩在「" + APP_NAME + "」的情侣号" + changed.map(k => (k === "handle" ? "名字从「" + (a.handle || "") + "」改成了「" + patch.handle + "」" : "简介改成了「" + patch.bio + "」")).join("，") + "。");
    };
    const cpCard = id => {
      const c = charOf(id); if (!c) return null;
      const a = cps[id], on = cpId === id, naming = busy === "cpname:" + id, editing = cpEdit === id;
      const meAv = { name: uName, avatarImage: profile && profile.avatarImage };
      const btn = (label, fn, primary, dis) => h("button", { "data-wk": "block", onClick: fn, disabled: !!dis, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 34, padding: "0 12px", borderRadius: 999, background: primary ? P.accent : "transparent", border: primary ? "none" : "1px solid " + P.line, color: primary ? "#fff" : P.ink, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, label);
      const inp = (key, val, ph, onSave, max) => h("input", { "data-wk": "input", key, defaultValue: val, placeholder: ph, onBlur: e => onSave(e.target.value.trim().slice(0, max)),
        className: "w-full outline-none", style: { marginTop: 6, minHeight: 36, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 10px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } });
      return h("div", { "data-wk": "shuacprow", "data-on": on ? "1" : "0", key: id, style: { marginTop: 8, padding: "12px 14px", borderRadius: 16, border: (a ? "1px solid " : "1px dashed ") + (on ? P.accent : P.line), background: on ? "linear-gradient(120deg,rgba(254,44,85,.16),rgba(122,60,255,.12))" : P.field } },
        h("div", { className: "flex items-center", style: { gap: 12 } },
          h("div", { style: { position: "relative", width: 58, height: 40, flexShrink: 0 } },
            h("div", { style: { position: "absolute", left: 0, top: 0, borderRadius: 99, border: "2px solid " + P.bg } }, h(Avatar, { character: meAv, size: 36 })),
            h("div", { style: { position: "absolute", left: 20, top: 0, borderRadius: 99, border: "2px solid " + P.bg } }, h(Avatar, { character: c, size: 36 }))),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { "data-wk": "shuacpname", style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a ? a.handle : "和 " + (c.remark || c.name) + " 的情侣号"),
            h("div", { "data-wk": "shuacpbio", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim, marginTop: 2, lineHeight: 1.45 } },
              a ? (a.bio || "还没有简介") + " · " + fmtN((((((db.me && db.me.statsOv) || {})["cp:" + id]) || {}).fans) != null ? db.me.statsOv["cp:" + id].fans : (a.followers || 0)) + " 粉丝" + (on ? " · 正在用" : "") : "还没开"))),
        editing && a ? h("div", { style: { marginTop: 6 } },
          inp("cpn_" + id, a.handle, "号名", v => v && setCp(id, { handle: v }), 20),
          inp("cpb_" + id, a.bio || "", "主页简介（一两句）", v => setCp(id, { bio: v }), 80)) : null,
        h("div", { className: "flex flex-wrap", style: { gap: 8, marginTop: 10 } },
          a ? btn(on ? "切回大号" : "切过去", () => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { using: on ? "main" : "cp:" + id }) })), true)
            : btn("开一个", () => save(Object.assign({}, dbRef.current, { cps: Object.assign({}, dbRef.current.cps, { [id]: { handle: (S(dbRef.current.me && dbRef.current.me.handle) || uName) + "和" + c.name, followers: 0, ts: Date.now() } }), me: Object.assign({}, dbRef.current.me, { using: "cp:" + id }) })), true),
          props.probeAs ? btn(naming ? "TA 在想…" : a ? "让 TA 重新起" : "让 TA 起名开号", () => nameCp(id), false, naming) : null,
          a ? btn(editing ? "改好了" : "自己改", () => setCpEdit(editing ? "" : id), false) : null));
    };
    let body;
    if (tab === "home" && skin === "v") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { position: "relative", background: BLACK } },
      // 顶上那两个字：关注 / 推荐，浮在画面上
      h("div", { "data-wk": "head", className: "flex items-center justify-center", style: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3, paddingTop: safeTop(8), paddingBottom: 6, gap: 26 } },
        props.onBack ? h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50", style: { position: "absolute", left: 10, bottom: 2, width: 40, height: 40, color: INK } }, h(IArrow, { size: 20, color: INK })) : null,
        // ⚠️这一列要限宽：不限的话城市那一排撑得比屏幕还宽，横着根本滑不动（她 2026-10-08：「同城横向滑动不了卡死了」）
        h("div", { className: "flex flex-col items-center", style: { maxWidth: "calc(100% - 120px)", minWidth: 0 } }, h("div", { className: "flex items-center", style: { gap: 26 } }, feedTabs(INK, DIM, INK)), feed === "city" ? h("div", { className: "flex items-center", style: { gap: 10, overflowX: "auto", maxWidth: "100%", padding: "4px 12px 6px", whiteSpace: "nowrap", touchAction: "pan-x", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" } },
          cities.map(c => h("button", { "data-wk": "shuacity", "data-on": c === cityNow ? "1" : "0", key: c, onClick: () => setCityPick(c), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: c === cityNow ? RED : INK, fontWeight: c === cityNow ? 700 : 400, minHeight: 28, textShadow: "0 1px 3px rgba(0,0,0,.6)" } }, c))) : hotStrip(INK, DIM, "transparent")),
        // 同城那一格，右上角「刷新」就是刷这座城（她 2026-10-07：「刷新一下这座城的跟刷新是不是重复了」）
        h("button", { "data-wk": "shuasearchbtn", "aria-label": "搜索", onClick: askSearch, disabled: busy === "npc", className: "active:opacity-60", style: { position: "absolute", right: 62, top: safeTop(10), minHeight: 32, minWidth: 32, padding: "0 8px", borderRadius: 999, background: "rgba(0,0,0,.28)", color: INK, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, busy === "npc" ? "…" : "🔍"),
        h("button", { "data-wk": "shuarefreshbtn", onClick: () => feed === "city" && cities.length ? genNpc(cityNow) : setPage({ kind: "refresh" }), disabled: busy === "npc", className: "active:opacity-60", style: { position: "absolute", right: 12, top: safeTop(10), minHeight: 32, padding: "0 10px", borderRadius: 999, background: "rgba(0,0,0,.28)", color: INK, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, busy === "npc" && feed === "city" ? "刷着…" : "刷新")),
      feedView(list, emptyFeed));
    else if (tab === "home") body = h("div", { className: "flex-1 min-h-0 flex flex-col", style: { background: B.bg } },
      // 横屏那套的顶栏：白底，左边返回、中间关注推荐、右边刷新——不浮在画面上
      h("div", { "data-wk": "head", className: "shrink-0 flex items-center justify-center", style: { position: "relative", background: B.card, paddingTop: safeTop(6), paddingBottom: 4, gap: 26, borderBottom: "1px solid " + B.line } },
        props.onBack ? h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50", style: { position: "absolute", left: 8, bottom: 0, width: 40, height: 40 } }, h(IArrow, { size: 20, color: B.ink })) : null,
        h("div", { className: "flex flex-col items-center", style: { maxWidth: "70%" } }, h("div", { className: "flex items-center", style: { gap: 26 } }, feedTabs(B.ink, B.dim, B.accent)), hotStrip(B.ink, B.dim, "transparent")),
        h("button", { "data-wk": "shuasearchbtn", "aria-label": "搜索", onClick: askSearch, disabled: busy === "npc", className: "active:opacity-60", style: { position: "absolute", right: 62, top: safeTop(8), minHeight: 32, minWidth: 32, padding: "0 8px", borderRadius: 999, background: B.bg, color: B.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, busy === "npc" ? "…" : "🔍"),
        h("button", { "data-wk": "shuarefreshbtn", onClick: () => setPage({ kind: "refresh" }), className: "active:opacity-60", style: { position: "absolute", right: 10, top: safeTop(8), minHeight: 32, padding: "0 12px", borderRadius: 999, background: B.bg, color: B.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "刷新")),
      gridView(list, emptyFeed));
    // ⚠️直播间里面是 h-full：外面这一格只给 flex-1 的话，Safari 里 h-full 量不出高度，直播间按内容往下长，
    //   底下的礼物面板和输入栏就被压到底栏「首页／直播／收藏」下面去了（她 2026-10-11：「点礼物然后点不了了因为被推下去了」）。
    //   套一层绝对定位铺满这一格，高度就是确定的。
    else if (tab === "live") body = h("div", { "data-wk": "shualive", className: "flex-1 min-h-0", style: { position: "relative" } }, h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" } },
      window.LiveApp ? h(window.LiveApp, Object.assign({}, props.live, { key: "live_" + liveStart + "_" + skin, embedded: true, startView: liveStart || "home",
        // 直播切片（她 2026-10-08）：下播后路人剪的那条落进推荐流，竖着刷那套
        onClip: c => addVideos([mkVideo({ scene: c.scene, caption: c.caption, tags: c.tags, who: "self" }, { by: "npc", author: S(c.author).slice(0, 20), likes: 0, comments: [], skin: "v", clipOf: c.charId || null })]),
        // 直播那一格也穿这套皮（直播间本身是黑的演播台，两套都不动）
        pal: skin === "b" ? { bg: B.bg, bg2: "#fff", ink: B.ink, sub: B.dim, fog: B.dim, line: B.line, accent: B.accent, tint: B.accent }
          : { bg: BLACK, bg2: "#1b1b21", ink: INK, sub: DIM, fog: DIM, line: LINE, accent: RED, tint: RED } })) : null));
    // 收藏那一格（她 2026-10-07：「消息现在也没用吧，不如改成收藏放那里，可以自创文件夹」）
    else if (tab === "fav") body = (function () {
      const folders = arr(db.folders);
      const inF = folder === "all" ? favAll : folder === "none" ? favAll.filter(v => !v.folder || !folders.some(f => f.id === v.folder)) : favAll.filter(v => v.folder === folder);
      const onInk = skin === "b" ? B.card : INK;
      const unsorted = favAll.filter(v => !v.folder || !folders.some(f => f.id === v.folder)).length;
      const chip = (k, label, n) => h(FolderTab, { key: k, name: label, count: n, on: folder === k, onClick: () => setFolder(k), P, onInk });
      const newFolder = () => { const name = S(fName).trim(); if (!name) return; setFName(null); const id = uid("fd"); save(Object.assign({}, dbRef.current, { folders: arr(dbRef.current.folders).concat([{ id, name }]) })); setFolder(id); };
      const delFolder = f => { const go = () => { save(Object.assign({}, dbRef.current, { folders: arr(dbRef.current.folders).filter(x => x.id !== f.id), videos: dbRef.current.videos.map(v => v.folder === f.id ? Object.assign({}, v, { folder: "" }) : v) })); setFolder("all"); };
        const ask = "不要文件夹「" + f.name + "」了？";
        requestAppConfirm(ask, "里面的视频还在收藏里，只是不再分到这一格。", go, "删掉"); };
      const cur = folders.find(f => f.id === folder);
      return h("div", { "data-wk": "shuafavpage", className: "flex-1 min-h-0 flex flex-col", style: { background: P.bg } },
        h(Head, { zh: "收藏", bg: "transparent", ink: P.ink, right: cur ? h("button", { onClick: () => delFolder(cur), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, minHeight: 40 } }, "删这个文件夹") : null }),
        h("div", { "data-wk": "shuafolderbar", className: "shrink-0 flex items-end", style: { gap: 10, overflowX: "auto", padding: "2px 14px 12px", whiteSpace: "nowrap" } },
          chip("all", "全部", favAll.length), folders.map(f => chip(f.id, f.name, favAll.filter(v => v.folder === f.id).length)), folders.length ? chip("none", "没分的", unsorted) : null,
          fName === null ? h(FolderTab, { name: "＋ 新建", dashed: true, onClick: () => setFName(""), P, onInk })
            : h("span", { className: "shrink-0 flex items-center", style: { gap: 6 } },
              h("input", { "data-wk": "shuafolderinput", autoFocus: true, value: fName, onChange: e => setFName(e.target.value), onKeyDown: e => { if (e.key === "Enter") newFolder(); }, placeholder: "叫什么", style: { width: 96, minHeight: 36, padding: "0 10px", borderRadius: 8, border: "1px solid " + P.line, background: "transparent", color: P.ink, fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" } }),
              h("button", { "data-wk": "shuafolderok", onClick: newFolder, className: "active:opacity-60", style: { minHeight: 32, padding: "0 10px", color: P.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "建"),
              h("button", { onClick: () => setFName(null), className: "active:opacity-60", style: { minHeight: 32, padding: "0 6px", color: P.dim, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "算了"))),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "0 10px 16px" } },
          folders.length && inF.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim, padding: "0 4px 8px" } }, "长按一条视频，挑它放进哪个文件夹") : null,
          inF.length ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, inF.map(v => h("div", { "data-wk": "shuafavitem", key: v.id, className: "flex flex-col", style: { gap: 6 },
            // 长按（电脑上右键）一条，底下冒出一排文件夹点一下就放进去——不用系统那个下拉框
            onPointerDown: () => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => { pressRef.current = "fired"; setPicking(v.id); }, 450); },
            onPointerUp: () => { if (pressRef.current !== "fired") clearTimeout(pressRef.current); },
            onPointerLeave: () => { if (pressRef.current !== "fired") clearTimeout(pressRef.current); },
            onClickCapture: e => { if (pressRef.current === "fired") { pressRef.current = null; e.stopPropagation(); e.preventDefault(); } },
            onContextMenu: e => { e.preventDefault(); setPicking(v.id); } },
            skin === "b" ? h(BCard, { v, onOpen: () => setPage({ kind: "bdetail", id: v.id }) })
              : h("button", { "data-wk": "shuatile", onClick: () => setPage({ kind: "favs", folder }), className: "active:opacity-80", style: { position: "relative", aspectRatio: "3 / 4", overflow: "hidden", background: coverBg(v), textAlign: "left", padding: 8, borderRadius: 6, WebkitTouchCallout: "none", userSelect: "none" } },
                !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(255,255,255,.88)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.scene || v.caption) : null,
                h("div", { style: { position: "absolute", left: 8, bottom: 6, right: 8, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: INK, textShadow: "0 1px 2px rgba(0,0,0,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "@" + v.author)),
            (function () { const f = folders.find(x => x.id === v.folder); return f && folder === "all" ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim } }, "在「" + f.name + "」") : null; })(),
            picking === v.id ? h("div", { className: "flex flex-wrap items-end", style: { gap: 8 } },
              folders.length ? folders.map(f => h(FolderTab, { key: f.id, small: true, name: f.name, on: v.folder === f.id, P, onInk, onClick: () => { patchV(v.id, x => Object.assign({}, x, { folder: x.folder === f.id ? "" : f.id })); setPicking(null); } }))
                : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim } }, "先在上面建个文件夹"),
              h("button", { onClick: () => setPicking(null), className: "active:opacity-60", style: { minHeight: 30, padding: "0 6px", color: P.dim, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "收起")) : null))) :
            h("div", { "data-wk": "shuaempty", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.dim, textAlign: "center", padding: "50px 20px", lineHeight: 1.6 } }, favAll.length ? "这个文件夹还是空的。在「全部」里长按一条视频，就能把它放进来" : "还没收藏过，刷到喜欢的点星星")));
    })();
    else if (tab === "msg") body = h("div", { "data-wk": "shuamsgpage", className: "flex-1 min-h-0 flex flex-col", style: { background: P.bg } },
      h(Head, { zh: "消息", bg: "transparent", ink: P.ink, onBack: () => setTab("me"), right: unread ? h("button", { onClick: () => save(Object.assign({}, dbRef.current, { notes: dbRef.current.notes.map(n => Object.assign({}, n, { unread: false })) })), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, minHeight: 40 } }, "全部已读") : null }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4" },
        arr(db.notes).length ? arr(db.notes).map(n => { const nv = n.vid ? arr(db.videos).find(x => x.id === n.vid) : null;
          return h(n.vid ? "button" : "div", { "data-wk": "shuanote", "data-on": n.unread ? "1" : "0", key: n.id, onClick: n.vid ? () => openNote(n) : undefined, className: n.vid ? "w-full text-left active:opacity-70" : undefined, style: { display: "block", padding: "12px 0", borderBottom: "1px solid " + P.line } },
          h("div", { "data-wk": "shuanotetext", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: n.unread ? P.ink : P.dim, lineHeight: 1.55 } }, (n.unread ? "● " : "") + n.text),
          // 是哪一条：标题／文案／画面的头几个字，点进去就是那条
          n.vid ? h("div", { "data-wk": "shuanotevid", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim, marginTop: 4, padding: "5px 8px", borderRadius: 6, background: P.line, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            nv ? "▶ " + S(nv.title || nv.caption || nv.scene).slice(0, 40) + " ›" : "那条视频已经不在了") : null,
          h("div", { "data-wk": "shuanotetime", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: P.dim, marginTop: 3 } }, new Date(n.ts).toLocaleString())); }) :
          h("div", { "data-wk": "shuaempty", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.dim, textAlign: "center", padding: "50px 0" } }, "还没有人找你")));
    else body = h("div", { "data-wk": "shuamepage", className: "flex-1 min-h-0 flex flex-col", style: { background: skin === "b" ? "linear-gradient(180deg,#ffe4ec 0," + B.bg + " 220px)" : "linear-gradient(180deg,#2a1d33 0,#0b0b0e 260px)" } },
      h(Head, { zh: myName, bg: "transparent", ink: P.ink, right: h("button", { onClick: () => setTab("msg"), style: { position: "relative", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.ink, minHeight: 40, padding: "0 4px" } }, "消息",
        unread ? h("span", { style: { position: "absolute", top: 4, right: -10, minWidth: 16, height: 16, borderRadius: 99, background: P.accent, color: "#fff", fontSize: "calc(10px * var(--app-fs, 1))", lineHeight: "16px", textAlign: "center", padding: "0 4px" } }, unread > 99 ? "99+" : unread) : null) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 20 } },
        h("div", { "data-wk": "shuaprofilehead", className: "flex items-center", style: { gap: 14, marginTop: 6 } },
          h(Avatar, { character: { name: maskUse ? maskName : uName, avatarImage: (maskUse && (maskList.find(m => m.id === maskUse) || {}).avatarImage) || (profile && profile.avatarImage) }, size: 70 }),
          h("div", { className: "flex", style: { gap: 20 } },
            // 获赞、粉丝能自己改（群里 2026-10-22 许愿）：点一下填个数，按号分开记（大号／小号／情侣号各一份）；清空就回到算出来的那个
            (() => {
              const acctKey = onCp ? "cp:" + cpId : onAlt ? "alt" : "main";
              const ov = ((db.me && db.me.statsOv) || {})[acctKey] || {};
              const calcLikes = mine.reduce((n, v) => n + (Number(v.likes) || 0), 0), calcFans = onCp ? (cps[cpId].followers || 0) : onAlt ? 0 : characters.length;
              const edit = (k, zh, cur) => typeof requestAppPrompt === "function" && requestAppPrompt("改" + zh, "填你想显示的" + zh + "数，只改这里显示的数字。清空就回到 app 自己算的那个。", ov[k] != null ? String(ov[k]) : "", v => {
                const t = String(v == null ? "" : v).replace(/[,，\s]/g, "");
                const m = /^(\d+(?:\.\d+)?)(万|w|W)?$/.exec(t);
                const all = Object.assign({}, (dbRef.current.me && dbRef.current.me.statsOv) || {}), mine2 = Object.assign({}, all[acctKey] || {});
                if (!t) delete mine2[k]; else if (m) mine2[k] = Math.round(Number(m[1]) * (m[2] ? 10000 : 1)); else return;
                all[acctKey] = mine2;
                save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { statsOv: all }) }));
              }, "改好了");
              return [[mine.length, "作品", null], [ov.likes != null ? ov.likes : calcLikes, "获赞", "likes"], [ov.fans != null ? ov.fans : calcFans, "粉丝", "fans"]].map(x => h(x[2] ? "button" : "div", { key: x[1], "data-wk": "shuastat", "data-part": x[2] || "works",
                  onClick: x[2] ? () => edit(x[2], x[1], x[0]) : undefined, className: x[2] ? "text-left active:opacity-70" : undefined, style: x[2] ? { background: "transparent", border: "none", padding: 0 } : undefined },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: P.ink } }, fmtN(x[0])),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim } }, x[1] + (x[2] ? " ✎" : ""))));
            })())),
        h("input", { "data-wk": "shuahandle", key: "h_" + skin, defaultValue: S(db.me && db.me.handle), placeholder: "账号名（默认用你的名字）", onBlur: e => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { handle: e.target.value.trim().slice(0, 20) }) })),
          className: "w-full outline-none", style: { marginTop: 14, minHeight: 38, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 8 } },
          h("input", { "data-wk": "shuahandle", "data-part": "alt", key: "alt_" + skin, defaultValue: altName, placeholder: "小号叫什么（不填就没有小号）", onBlur: e => { const v = e.target.value.trim().slice(0, 20); save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { altHandle: v, using: v ? (dbRef.current.me || {}).using : "main" }) })); },
            className: "flex-1 outline-none", style: { minHeight: 38, borderRadius: 10, border: "1px solid " + P.line, background: P.field, color: P.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
          altName ? h("button", { onClick: () => save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { using: onAlt ? "main" : "alt" }) })), className: "active:opacity-70 shrink-0",
            style: { minHeight: 38, padding: "0 12px", borderRadius: 10, background: P.accent, color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, onAlt ? "切回大号" : "切到小号") : null),
        // 用哪张面具发（跟论坛同一套）
        !onAlt && !onCp && maskList.length > 1 ? h("div", { "data-wk": "shuamaskrow", className: "flex flex-wrap items-center", style: { gap: 6, marginTop: 10 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: P.dim } }, "用哪张面具发："),
          maskList.map(m => { const on = maskUse === m.id;
            return h("button", { key: m.id || "main", "data-wk": "shuamask", "data-on": on ? "1" : "0", onClick: () => { save(Object.assign({}, dbRef.current, { me: Object.assign({}, dbRef.current.me, { mask: m.id }) })); toast("现在用「" + m.name + "」发；只有跟这张面具聊的人认得出是你"); },
              className: "active:opacity-70", style: { minHeight: 30, padding: "0 11px", borderRadius: 10, border: "1px solid " + (on ? P.accent : P.line), background: on ? P.accent : "transparent", color: on ? "#fff" : P.dim, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, m.name); })) : null,
        // 情侣号（她 2026-10-15：「列表看起来不好看换个ui，让他可以选情侣号名字和主页简介」）：
        //   在一起的那几位各一张卡——两只头像叠在一起、号名、简介、粉丝；能切过去，能自己改，也能「让 TA 起」。
        togetherIds.length ? h("div", { style: { marginTop: 16 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, marginBottom: 8 } }, "情侣号"),
          togetherIds.map(id => cpCard(id))) : null,
        onCp ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim, marginTop: 6, lineHeight: 1.5 } }, "现在用的是情侣号「" + cps[cpId].handle + "」：发的视频是你俩的，画面默认你俩一起，" + (charOf(cpId) || {}).name + " 也会在自己号的评论区接。作品里也有 TA 发在这个号上的。") : null,
        onCp && props.probeAs ? h("button", { "data-wk": "shuacpchalbtn", disabled: !!busy, onClick: () => setPage({ kind: "cpchal" }), className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 10, minHeight: 42, borderRadius: 12, background: "linear-gradient(120deg,#fe2c55,#7a3cff)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "玩一个情侣挑战") : null,
        // 平时TA发视频只有三回里一回落在情侣号上；想看就点这颗，专门发一条到这儿（一次调用）
        onCp ? h("button", { "data-wk": "shuacppost", disabled: !!busy, onClick: () => genChars([cpId], true), className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 8, minHeight: 38, borderRadius: 10, border: "1px solid " + P.accent, color: P.accent, background: "transparent", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
          busy === "chars" ? "在拍…" : "让 " + (charOf(cpId) || {}).name + " 往这个号发一条") : null,
        onAlt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: P.dim, marginTop: 6, lineHeight: 1.5 } }, "现在用的是小号「" + altName + "」：发的视频不会叫认识你的人来看，评 TA 的视频 TA 也不知道是你。") : null,
        // 首页样子：跟论坛「首页排版」同一个位置、同一个道理——两套视频，各刷各的
        h("div", { "data-wk": "shuaskinrow", className: "flex items-center justify-between", style: { marginTop: 14, padding: "10px 12px", borderRadius: 12, background: P.field, border: "1px solid " + P.line } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.ink } }, "首页样子"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: P.dim, marginTop: 2 } }, "两种是两套视频，切过去刷的是另一套")),
          h("div", { className: "flex", style: { borderRadius: 999, overflow: "hidden", border: "1px solid " + P.line } },
            [["v", "竖着刷"], ["b", "横着看"]].map(o => h("button", { "data-wk": "shuaskin", "data-on": skin === o[0] ? "1" : "0", key: o[0], onClick: () => { save(Object.assign({}, dbRef.current, { skin: o[0] })); setFeed("rec"); }, className: "active:opacity-60",
              style: { minHeight: 32, padding: "0 14px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", background: skin === o[0] ? P.accent : "transparent", color: skin === o[0] ? "#fff" : P.dim } }, o[1])))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: P.dim, margin: "20px 0 8px" } }, "作品"),
        mine.length ? h("div", { "data-wk": "shuaworks", style: { display: "grid", gridTemplateColumns: skin === "b" ? "1fr 1fr" : "repeat(3,1fr)", gap: skin === "b" ? 8 : 3 } }, mine.map(v => skin === "b"
          ? h(BCard, { key: v.id, v, onOpen: () => setPage({ kind: "bdetail", id: v.id }) })
          : h("button", { "data-wk": "shuatile", key: v.id, onClick: () => setPage({ kind: "mine" }), className: "active:opacity-80", style: { position: "relative", aspectRatio: "3 / 4", overflow: "hidden", background: coverBg(v), textAlign: "left", padding: 6 } },
            !imgOf(v) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.caption || v.scene) : null,
            h("div", { style: { position: "absolute", left: 6, bottom: 4, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: INK, textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, "赞 " + fmtN(v.likes))))) :
          h("div", { "data-wk": "shuaempty", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: P.dim, textAlign: "center", padding: "30px 0" } }, "还没发过，点底栏中间的 ＋"),
        null));

    // 底栏：真的短视频 app 就是这么分的——中间那颗是「拍」，不是一个普通 tab
    const tabBtn = (k, label) => h("button", { "data-wk": "shuatab", "data-on": tab === k ? "1" : "0", key: k, onClick: () => { setTab(k); if (k !== "live") setLiveStart(""); }, className: "flex-1 active:opacity-60 flex flex-col items-center justify-center", style: { minHeight: 48, position: "relative" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: tab === k ? (skin === "b" ? P.accent : P.ink) : P.dim, fontWeight: tab === k ? 700 : 400 } }, label),
      k === "me" && unread ? h("span", { style: { position: "absolute", top: 8, right: "22%", minWidth: 16, height: 16, borderRadius: 99, background: P.accent, color: "#fff", fontSize: "calc(10px * var(--app-fs, 1))", lineHeight: "16px", textAlign: "center", padding: "0 4px" } }, unread > 99 ? "99+" : unread) : null);
    const barBg = skin === "b" ? B.card : BLACK;
    return h("div", { "data-wk": "shuapage", className: "h-full flex flex-col", style: { background: barBg, position: "relative" } },
      body,
      sheetLayer(),
      h("div", { "data-wk": "shuatabbar", className: "shrink-0 flex items-center", style: { background: barBg, borderTop: "1px solid " + P.line, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4)" } },
        tabBtn("home", "首页"), tabBtn("live", "直播"),
        h("button", { "data-wk": "shuapostfab", onClick: () => setPage({ kind: "post" }), "aria-label": "发一条", className: "active:opacity-70 flex items-center justify-center", style: { flex: 1, minHeight: 48 } },
          skin === "b"
            ? h("span", { style: { width: 40, height: 30, borderRadius: 10, background: B.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", lineHeight: "30px", textAlign: "center" } }, "+")
            : h("span", { style: { width: 42, height: 28, borderRadius: 8, background: "linear-gradient(90deg,#25f4ee 0 4px,#fff 4px calc(100% - 4px),#fe2c55 calc(100% - 4px))", color: BLACK, fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", lineHeight: "28px", textAlign: "center" } }, "+")),
        tabBtn("fav", "收藏"), tabBtn("me", "我")));
  }
  // 点聊天里那张视频卡 → 打开片刻、直接停在那一条（群友 2026-10-08：「能点到原视频里吗，不然都不知道是哪个视频了」）
  let pendingPage = null;
  window.ShuaApp = ShuaApp;
})();
