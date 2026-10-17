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
    + "别复述歌名歌手、别总结这首歌讲了什么、别替别人下结论。歌要是你不熟，就只说听的那一下的感受，别编它的创作背景。";
  // 熟人（她的角色）：在这儿发言的就是他本人，用他自己的名字，说话照他平时那样
  const castBlock = cast => (cast || []).length ? "\n\n【你认识的这几位也在用这个 app】\n"
    + cast.map(c => "· " + S(c.name) + "（id：" + c.id + "）\n" + S(c.persona || "（没写人设）").slice(0, 600)).join("\n")
    + "\n他们在这儿发言用的就是自己的名字。听什么、怎么说都得是他本人：照人设、口味、此刻的心事来。他们不知道这儿谁是谁、谁跟她什么关系，除非下面写明了。" : "";
  const regsBlock = o => (window.ShuaKit && window.ShuaKit.regularsBlock && o.regs) ? window.ShuaKit.regularsBlock(o.regs, o.pairs || [], o.me || "她", "听歌、写歌评") : "";
  const ITEM_SCHEMA = "{\"by\":\"熟人填他的 id；熟面孔、路人填 npc\",\"name\":\"名字或网名（熟面孔照抄上面的网名）\",\"text\":\"说的话\",\"to\":\"回的是谁——照抄那个人的名字，不是回人就留空\",\"tone\":\"熟面孔才填：warm 或 spar，其余留空\"}";

  // 刷一批广场帖子
  function feedSystem(o) {
    return AC() + CB() + "【场景】一起听 app 里的「广场」：大家分享最近在听的歌和听歌时的感受，像网易云的动态和评论区。写一批新帖子。"
      + castBlock(o.cast) + regsBlock(o) + "\n\n" + LIVE
      + "\n\n【要求】一共 8 帖，熟人最多占一半，熟面孔两三帖，其余是路人网友（网名、年纪、口味自己起，各不相同）。每帖分享一首【真实存在、在网易云能搜到】的歌（华语、欧美、日韩都行，别编歌），配上发帖人自己的话。"
      + "每帖底下 0–3 条评论，可以是路人、熟面孔，也可以是熟人，互相接话也行。"
      + (o.avoid && o.avoid.length ? "\n广场上最近已经有人发过这些，别再发：" + o.avoid.join("、") : "")
      + "\n\n只输出 JSON：{\"posts\":[{\"by\":\"熟人填他的 id；熟面孔、路人填 npc\",\"name\":\"发帖人\",\"title\":\"歌名\",\"artist\":\"歌手\",\"text\":\"发帖人自己的话\",\"comments\":[" + ITEM_SCHEMA + "]}]}";
  }
  // 一首歌底下刷一批歌评。o.partner＝此刻跟她一起听这首的那位：一定在里面
  function songSystem(o) {
    return AC() + CB() + "【场景】一起听 app 里《" + S(o.song.title) + "》" + (o.song.artist ? "（" + S(o.song.artist) + "）" : "") + "这首歌的评论区，像网易云的歌评。"
      + castBlock(o.cast) + regsBlock(o)
      + (o.partner ? "\n\n【此刻跟她一起听这首的是「" + S(o.partner.name) + "」】这一批里一定有他写的一条（by 填他的 id）。他是一边跟她听着一边写的：写的是这一刻他自己听到、想到的，用他平时的口气；评论区是公开的，他会顾及别人看得见。" : "")
      + (o.transcript ? "\n\n【这首歌底下已经有的评论】\n" + o.transcript + "\n写新的，别把上面的意思换个说法再说一遍；想接谁的话就在 to 里写他的名字。" : "")
      + "\n\n" + LIVE
      + "\n\n写 " + (o.n || 8) + " 条，熟面孔两三条，其余多是路人。只输出 JSON：{\"items\":[" + ITEM_SCHEMA + "]}";
  }
  // 她说了一句（发帖、评论、回谁）之后那一串，一枪写完
  function replySystem(o) {
    return AC() + CB() + "【场景】" + o.where + "\n\n【这一串的现场】\n" + (o.transcript || "（还没人说话）")
      + castBlock(o.cast) + regsBlock(o)
      + "\n\n「" + S(o.me) + "」刚说了：「" + S(o.text) + "」" + (o.to ? "（回的是「" + S(o.to) + "」）" : "") + "。写接在后面的 " + (o.n || 4) + " 条。"
      + (o.must ? "\n第一条必须是「" + S(o.must.name) + "」回她的（by 填 " + o.must.id + "）——就是他本人，跟她平时怎么说话，这儿还是那个样子，只是记得这是公开的地方。" : "")
      + "\n其余是刷到这里的人，不认识这串里任何人、不知道谁跟谁什么关系；也可以有人不回她、自己说自己的。"
      + "\n\n" + LIVE + "\n\n只输出 JSON：{\"items\":[" + ITEM_SCHEMA + "]}";
  }
  // 这一串摊成给模型看的现场
  const transcriptOf = (items, max) => (items || []).slice(-(max || 24)).map(x => "· " + S(x.name) + (x.to ? " 回 " + S(x.to) : "") + "：" + S(x.text).slice(0, 120)).join("\n");

  // ── 转给TA：聊天里那张卡 ─────────────────────────────────────────
  const shareSnap = post => ({ id: post.id, name: S(post.name), text: S(post.text).slice(0, 300), song: post.song ? { title: S(post.song.title), artist: S(post.song.artist), cover: post.song.cover || null, neteaseId: post.song.neteaseId || "" } : null });
  const shareText = snap => "[她从一起听的广场转来一帖] " + snap.name + " 分享了" + songLine(snap.song) + (snap.text ? "：「" + snap.text + "」" : "");
  function ListenShareCard({ m, isU }) {
    const h = React.createElement, t = (typeof useTheme === "function" ? useTheme() : {}) || {};
    const p = m.listenPost || {}, sg = p.song || {};
    return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
      h("div", { "data-wk": "card", style: { width: 242, borderRadius: 14, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line } },
        h("div", { style: { padding: "11px 13px" } },
          h("div", { style: { fontFamily: typeof F_BODY !== "undefined" ? F_BODY : "inherit", fontSize: 10, letterSpacing: 2, color: t.fog } }, "一起听 · 广场"),
          h("div", { style: { display: "flex", gap: 9, alignItems: "center", marginTop: 7 } },
            sg.cover ? h("img", { src: sg.cover, alt: "", style: { width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 } }) : null,
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, S(sg.title)),
              h("div", { style: { fontSize: 11, color: t.fog } }, S(sg.artist)))),
          p.text ? h("div", { style: { fontSize: 12, lineHeight: 1.6, color: t.sub, marginTop: 7 } }, p.name + "：" + p.text) : null)));
  }
  window.ListenShareCard = ListenShareCard;
  window.ListenSquare = { KEEP_POSTS, KEEP_TALK, songKey, songLine, feedSystem, songSystem, replySystem, transcriptOf, shareSnap, shareText, LIVE };
})();
