// 一起听 · 广场与歌评（她 2026-10-17 转群友：「音乐分享广场，NPC、char 们分享歌曲感受，类似网易云」）
//   广场：一帖一首歌 + 发帖人的话 + 评论；她能发帖、评论、回谁，也能把一帖转给TA。
//   歌评：每首歌一页（按网易云 id 记），刷过的留着——听 A 刷了一批，跳去 B，过几天回到 A 还在。
//   熟面孔是论坛那批人（FORUM_NPC_REGISTRY 的 music 那一栏）；跟她的碰面账就是论坛那一份，三个 app 互通。
//   ⚠️这儿只放【写给模型的话】【数据的形状】和【聊天里那张卡】；打枪、存档在 app.js，界面在 screens.js。
(function () {
  const S = x => String(x == null ? "" : x).trim();
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  const KEEP_POSTS = 60, KEEP_TALK = 120;
  // 一首歌在歌评里的门牌：网易云 id 优先（同一首歌从哪儿点进来都是同一页），本地歌用它自己的 id
  const songKey = song => song ? (song.neteaseId ? "ne:" + song.neteaseId : song.id ? "id:" + song.id : "") : "";
  const songLine = song => "《" + S(song && song.title) + "》" + (song && song.artist ? "（" + S(song.artist) + "）" : "");

  // 活人感：给判据不给样例（施工规则/prompt-no-content-samples、bans-make-it-dumber）
  const LIVE = "【像真有人在听歌、在刷评论区】"
    + "判定一：把名字遮住，读的人也能从说话方式分出这是几个不同的人——长短、口气、在意的东西、用词各不一样，不许几个人共用一种腔调。"
    + "判定二：每一条都落在这个人自己身上的一件具体的事（此刻在哪、手边在干嘛、想起的某个人某个地方），而不是一句放到哪首歌底下都成立的感慨。"
    + "判定三：评论区是随手写的——多数很短，有的只有几个字，有人接梗、有人跑题、有人较真、有人只是路过；只有少数人会写长。"
    + "别复述歌名歌手、别总结这首歌讲了什么、别替别人下结论。歌要是你不熟，就只说听的那一下的感受，别编它的创作背景。"
    + "\n【网易云评论区的样子】路人的网名照网易云用户真会起的那样起：长短、字体风格、中英混杂、带不带符号各不一样，一眼看去不像同一个人批量起的，也别用「路人甲」「网友A」这种占位名。"
    + "每条带一个赞数 likes：多数是个位数或零，少数说中了大家心事的几百上千——赞多赞少由这条写得戳不戳人决定，不是按顺序给。";
  // 熟人（她的角色）：在这儿发言的就是他本人，用他自己的名字，说话照他平时那样
  const castBlock = cast => (cast || []).length ? "\n\n【你认识的这几位也在用这个 app】\n"
    + cast.map(c => "· " + S(c.name) + "（id：" + c.id + "）\n" + (c.brief ? S(c.brief) : S(c.persona || "（没写人设）").slice(0, 600))).join("\n\n")
    + "\n他们在这儿发言用的就是自己的名字。听什么、怎么说都得是他本人：照人设、口味、此刻在过的日子和心事来（最近跟她聊过的事可以是由头，但这是公开的地方，私聊里的事他不会摊开说）。他们不知道这儿谁是谁、谁跟她什么关系，除非下面写明了。" : "";
  const regsBlock = o => (window.ShuaKit && window.ShuaKit.regularsBlock && o.regs) ? window.ShuaKit.regularsBlock(o.regs, o.pairs || [], o.me || "她", "听歌、写歌评") : "";
  const ITEM_SCHEMA = "{\"by\":\"熟人填他的 id；熟面孔、路人填 npc\",\"name\":\"名字或网名（熟面孔照抄上面的网名）\",\"text\":\"说的话\",\"to\":\"回的是谁——照抄那个人的名字，不是回人就留空\",\"tone\":\"熟面孔才填：warm 或 spar，其余留空\",\"likes\":\"赞数，整数\"}";

  // 刷一批广场帖子
  function feedSystem(o) {
    return AC() + CB() + "【场景】一起听 app 里的「广场」：大家分享最近在听的歌和听歌时的感受，像网易云的动态和评论区。写一批新帖子。"
      + castBlock(o.cast) + regsBlock(o) + "\n\n" + LIVE
      + "\n\n【要求】一共 8 帖，熟人最多占一半，熟面孔两三帖，其余是路人网友。每帖分享一首【真实存在、在网易云能搜到】的歌（华语、欧美、日韩都行，别编歌），配上发帖人自己的话。"
      + "每帖底下 2–6 条评论，可以是路人、熟面孔，也可以是熟人，互相接话也行。帖子本身也带 likes。"
      + (o.avoid && o.avoid.length ? "\n广场上最近已经有人发过这些，别再发：" + o.avoid.join("、") : "")
      + "\n\n只输出 JSON：{\"posts\":[{\"by\":\"熟人填他的 id；熟面孔、路人填 npc\",\"name\":\"发帖人\",\"title\":\"歌名\",\"artist\":\"歌手\",\"text\":\"发帖人自己的话\",\"likes\":\"赞数\",\"comments\":[" + ITEM_SCHEMA + "]}]}";
  }
  // 一个评论区再刷一批：一首歌的歌评页、广场上某一帖底下，都走这一段（o.where 说清是哪儿）。
  //   o.partner＝此刻跟她一起听这首的那位：一定在里面
  function songSystem(o) {
    return AC() + CB() + "【场景】" + (o.where || ("一起听 app 里《" + S(o.song.title) + "》" + (o.song.artist ? "（" + S(o.song.artist) + "）" : "") + "这首歌的评论区，像网易云的歌评。"))
      + castBlock(o.cast) + regsBlock(o)
      + (o.partner ? "\n\n【此刻跟她一起听这首的是「" + S(o.partner.name) + "」】这一批里一定有他写的一条（by 填他的 id）。他是一边跟她听着一边写的：写的是这一刻他自己听到、想到的，用他平时的口气；评论区是公开的，他会顾及别人看得见。" : "")
      + (o.transcript ? "\n\n【这首歌底下已经有的评论】\n" + o.transcript + "\n写新的，别把上面的意思换个说法再说一遍；想接谁的话就在 to 里写他的名字。" : "")
      + "\n\n" + LIVE
      + "\n\n写 " + (o.n || "12-18") + " 条，熟面孔两三条，其余多是路人；有的另起一条，有的回这串里谁（to 写他的名字）。只输出 JSON：{\"items\":[" + ITEM_SCHEMA + "]}";
  }
  // 她说了一句（发帖、评论、回谁）之后那一串，一枪写完
  function replySystem(o) {
    return AC() + CB() + "【场景】" + o.where + "\n\n【这一串的现场】\n" + (o.transcript || "（还没人说话）")
      + castBlock(o.cast) + regsBlock(o)
      + "\n\n「" + S(o.me) + "」刚说了：「" + S(o.text) + "」" + (o.to ? "（回的是「" + S(o.to) + "」）" : "") + "。写接在后面的 " + (o.n || "5-8") + " 条。"
      + (o.must ? "\n第一条必须是「" + S(o.must.name) + "」回她的（by 填 " + o.must.id + "）——就是他本人，跟她平时怎么说话，这儿还是那个样子，只是记得这是公开的地方。" : "")
      + "\n其余是刷到这里的人，不认识这串里任何人、不知道谁跟谁什么关系；也可以有人不回她、自己说自己的。"
      + (o.switchBy ? "\n\n「" + S(o.switchBy) + "」正陪她听着这首。他要是真想换一首（嫌这首不合适、她叫他换、或者他想放别的），就在 JSON 最外层加 \"songSwitch\"：填要放的那首歌名，跳下一首填「下一首」、回上一首填「上一首」；不换就别写这一栏，别动不动就切。" : "")
      + "\n\n" + LIVE + "\n\n只输出 JSON：{\"items\":[" + ITEM_SCHEMA + "]" + (o.switchBy ? "，想换歌时再加 \"songSwitch\":\"歌名\"" : "") + "}";
  }
  // 这一串摊成给模型看的现场
  const transcriptOf = (items, max) => (items || []).slice(-(max || 24)).map(x => "· " + S(x.name) + (x.to ? " 回 " + S(x.to) : "") + "：" + S(x.text).slice(0, 120)).join("\n");

  // ── 转给TA：聊天里那张卡 ─────────────────────────────────────────
  // 只转一首歌时传 { song }（没有 id/name）：卡上就是这首歌，不写「谁说了什么」
  const shareSnap = post => ({ id: post.id || null, name: S(post.name), text: S(post.text).slice(0, 300), song: post.song ? { title: S(post.song.title), artist: S(post.song.artist), cover: post.song.cover || null, neteaseId: post.song.neteaseId || "" } : null });
  const shareText = snap => snap.id ? "[她从一起听的广场转来一帖] " + snap.name + " 分享了" + songLine(snap.song) + (snap.text ? "：「" + snap.text + "」" : "")
    : "[她从一起听转来一首歌] " + songLine(snap.song);
  // 聊天里那张卡：上半截是这首歌的封套（封面糊开当底，左边一张清楚的封面），下半截是谁说了什么
  function ListenShareCard({ m, isU }) {
    const h = React.createElement, t = (typeof useTheme === "function" ? useTheme() : {}) || {};
    const FB = typeof F_BODY !== "undefined" ? F_BODY : "inherit", FD = typeof F_DISPLAY !== "undefined" ? F_DISPLAY : FB;
    const p = m.listenPost || {}, sg = p.song || {};
    return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
      h("div", { "data-wk": "card", "data-kind": "listenshare", style: { width: 248, borderRadius: 16, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 4px 14px rgba(40,30,20,.08)" } },
        h("div", { style: { position: "relative", height: 96, overflow: "hidden", background: "#2b2622" } },
          sg.cover ? h("div", { "aria-hidden": "true", style: { position: "absolute", inset: -24, background: "center/cover no-repeat url(" + sg.cover + ")", filter: "blur(16px)", opacity: .7 } }) : null,
          h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.1))" } }),
          sg.cover ? h("img", { src: sg.cover, alt: "", style: { position: "absolute", left: 14, top: 16, width: 62, height: 62, borderRadius: 8, objectFit: "cover", boxShadow: "0 3px 10px rgba(0,0,0,.35)" } }) : null,
          h("div", { style: { position: "absolute", left: 90, right: 12, top: 22, color: "#fff" } },
            h("div", { style: { fontFamily: FD, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, S(sg.title) || "一首歌"),
            h("div", { style: { fontFamily: FB, fontSize: "calc(11px * var(--app-fs, 1))", opacity: .8, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, S(sg.artist)))),
        h("div", { style: { padding: "10px 13px 11px" } },
          p.text ? h("div", { style: { fontFamily: FB, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: t.ink, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, "「" + p.text + "」") : null,
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 7, letterSpacing: 1 } },
            h("span", null, p.id ? "—— " + (p.name || "") : ""), h("span", null, p.id ? "一起听 · 广场" : "一起听")))));
  }
  window.ListenShareCard = ListenShareCard;
  window.ListenSquare = { KEEP_POSTS, KEEP_TALK, songKey, songLine, feedSystem, songSystem, replySystem, transcriptOf, shareSnap, shareText, LIVE };
})();
