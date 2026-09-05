// ============================================================
// 最近的消息 · 主屏组件「字条夹」（她 2026-09-05 点的）
//
// 她给的参考图是 iOS 那个 UPDATES 卡片（头像＋名字＋一行字，一摞圆角卡）。
// 那个形状换到任何一个 app 里都成立，所以照抄就是写坏了（tabs-not-plain-pills 那条判据）。
// 这个 app 里「刚来的消息」在现实里是什么东西？是**别人捎来的字条**——
// 所以它长成一只木夹：上头一根压条把一沓纸条夹住，纸条一张压着一张往下叠，
// 还没看的那几张往外探出一截、边上按一个朱砂点。手指能真的把这一沓翻上翻下。
//
// 点一张 → 直接进那个人的聊天框（onOpenChat(id, type)，由 app.js 接到 setScreen("thread")）。
//
// 另一半：ChatThread 顶上那个返回键（UnreadBack）——在 A 的聊天框里时，
// 它变成一个圈，圈里是**别处**还剩多少条没看。数字是「除了这一间之外」的，
// 所以在 A 里看到的永远不包含 A 自己。
// ============================================================
(function () {
  const h = React.createElement;

  // 纸条按 id 定一个固定的小角度和一档纸色——同一个人每次进来都是同一张纸，
  // 不用随机数（随机数会让它每次重绘都抖一下）。
  function seedOf(id) {
    let n = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 9973;
    return n;
  }

  function excerpt(m) {
    if (!m) return "";
    if (m.recalled) return "撤回了一条";
    const kind = m.kind || m.type;
    if (m.content && String(m.content).trim()) return String(m.content).trim().replace(/\s+/g, " ");
    if (kind === "image" || m.img) return "［图片］";
    if (kind === "voice") return "［语音］";
    if (kind === "redpacket") return "［红包］";
    if (kind === "transfer") return "［转账］";
    return "";
  }

  function whenLabel(ts, now) {
    if (!ts) return "";
    const d = new Date(ts), n = new Date(now || Date.now());
    const two = x => (x < 10 ? "0" : "") + x;
    const clock = d.getHours() + ":" + two(d.getMinutes());
    const sameDay = d.toDateString() === n.toDateString();
    if (sameDay) return clock;
    const y = new Date(n.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return "昨天";
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  // 把角色和群合成一列「还没看的」，按最后一条时间倒序。
  // 没有任何消息的不进来，看过的也不进来——这一沓答的是「有什么在等你」。
  function recentRows(p) {
    const chats = p.chats || {}, gchats = p.groupChats || {}, un = p.unreadMap || {};
    const rows = [];
    (p.characters || []).forEach(function (c) {
      const ms = (chats[c.id] || []).filter(function (m) { return !m.recalled || m.content; });
      const last = ms[ms.length - 1];
      if (!last) return;
      rows.push({ id: c.id, type: "char", char: c, name: c.remark || c.name, last: last, ts: last.ts || 0, unread: un[c.id] || 0 });
    });
    (p.groups || []).forEach(function (g) {
      const ms = gchats[g.id] || [];
      const last = ms[ms.length - 1];
      if (!last) return;
      rows.push({ id: g.id, type: "group", group: g, name: g.name || "群聊", last: last, ts: last.ts || 0, unread: un[g.id] || 0 });
    });
    rows.sort(function (a, b) { return b.ts - a.ts; });
    // ⚠️只夹【还没看的】（她 2026-09-05：「现在显示全部的消息，我要只有未读的」）。
    //   夹子答的是「有什么在等你」，不是「你跟谁说过话」——后者是聊天列表那一页的活。
    //   看过的一张都不留：一进那个聊天框 clearUnread 就把它摘下来了。
    return rows.filter(function (r) { return (r.unread || 0) > 0; });
  }

  // 空着的时候要说对话：一条都没说过 vs 说过但都看完了，是两件事。
  // 全说成「夹子上还空着」的话，她每天看完消息都会以为这个组件坏了。
  function everSpoke(p) {
    const chats = p.chats || {}, gchats = p.groupChats || {};
    return Object.keys(chats).some(function (k) { return (chats[k] || []).length; })
      || Object.keys(gchats).some(function (k) { return (gchats[k] || []).length; });
  }

  // 压条：整只夹子的脸面。标题和「还剩几条没看」都写在这一条上——
  // ⚠️v63.08 之前它们写在夹板上，而夹板是半透明的：铺了照片壁纸就整个消失
  //（她 2026-09-05 截图：只剩三张白纸飘在树林上）。字要待在自己有底的东西上。
  // 压在强调色上的那几个字该是浅的还是深的，按【那个颜色本身有多亮】算。
  // ⚠️不许写死：写死 #fff 遇上浅色强调就白底白字，写死 t.bg2 遇上深色强调就黑底黑字。
  //   认不出来的颜色（渐变、rgba）一律当深色处理——退回白字最不容易出事。
  function inkOn(c) {
    var m = /^#([0-9a-fA-F]{6})$/.exec(String(c || ""));
    if (!m) return "#fff";
    var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#241f1b" : "#fff";
  }
  function clampBar(t, ink, onWall, title, unread, accent) {
    // ⚠️v63.70：这一条原来是【整块墨色】，压在她那张暖色壁纸上就是一道黑框
    //   （她 2026-09-05：「这个黑框能不能改改，不是很百搭」）。
    //   黑是当初为了「字要待在自己有底的东西上」加的；可 v63.08 之后夹板本身
    //   已经是不透明的纸色了——字早就有底，那块黑是多余的一层。
    //   现在压条走【主题自己的颜色】：亮主题是浅的、深主题是深的，字一律 t.ink，
    //   跟哪张壁纸都不打架。它还是一只夹子，靠的是【形状】——
    //   上圆下方、底下一道墨色的唇线、两颗铆钉、以及压条底下那道影。
    var fg = t.ink || "#3a3430";
    return h("div", {
      className: "shrink-0 flex items-center",
      style: {
        height: 28, borderRadius: "13px 13px 3px 3px", padding: "0 10px", gap: 6,
        background: "linear-gradient(180deg," + skinAlpha(ink, "0f") + " 0%," + skinAlpha(ink, "06") + " 55%," + skinAlpha(ink, "14") + " 100%)",
        borderBottom: "1px solid " + skinAlpha(ink, "2a"),
        boxShadow: "inset 0 1px 0 " + skinAlpha(t.bg2 || "#fff", "aa")
      }
    },
      // 铆钉：一点点金属色（比墨浅、比纸深），不抢字
      h("span", { style: { width: 4.5, height: 4.5, borderRadius: 999, background: skinAlpha(ink, "55"), flexShrink: 0 } }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, color: fg, letterSpacing: ".06em", whiteSpace: "nowrap" } }, title),
      h("span", { style: { flex: 1 } }),
      unread ? h("span", {
        style: { fontFamily: F_BODY, fontSize: 10, color: inkOn(accent), background: accent, borderRadius: 999, padding: "1.5px 7px", whiteSpace: "nowrap" }
      }, unread + " 条没看") : null,
      h("span", { style: { width: 4.5, height: 4.5, borderRadius: 999, background: skinAlpha(ink, "55"), flexShrink: 0, marginLeft: 6 } }));
  }

  function RecentWidget(props) {
    const t = useTheme();
    const rows = recentRows(props);
    const editMode = !!props.editMode;
    const ink = /^#[0-9a-fA-F]{6}$/.test(String(t.ink || "")) ? t.ink : "#3a3430";
    const paper = t.bg2 || t.bg;
    const totalUn = rows.reduce(function (a, r) { return a + (r.unread || 0); }, 0);
    const onWall = typeof useOnWallpaper === "function" ? useOnWallpaper() : false;
    // 那一抹红跟着主题的强调色走（她换主题时它也跟着换）；主题没给就退回朱砂
    const accent = t.accent || "#b04a3f";

    const slip = function (r, i) {
      const s = seedOf(r.id);
      const tilt = ((s % 5) - 2) * 0.35;               // -0.7° ~ 0.7°：手插进去的时候本来就不会正
      const un = r.unread || 0;
      const mine = r.last && (r.last.role === "me" || r.last.from === "me");
      return h("button", {
        key: r.id,
        onClick: function () { if (!editMode && props.onOpenChat) props.onOpenChat(r.id, r.type); },
        className: "block w-full text-left active:opacity-80",
        style: {
          background: paper,
          // 夹上的全是没看的（v63.68 起），所以「看过的那一档」的浅样式整个删掉，
          // 不留在原地写一句「这一支用不到」
          border: "1px solid " + skinAlpha(ink, "2e"),
          borderLeft: "3px solid " + accent,
          borderRadius: 4,
          padding: "6px 9px 7px",
          marginTop: i === 0 ? 0 : -3,               // 一张压着一张，像插在夹子里
          marginRight: 5,
          transform: "rotate(" + tilt + "deg)",
          boxShadow: "0 1px 3px " + skinAlpha(ink, "14"),
          position: "relative", zIndex: 40 - i
        }
      },
        h("div", { className: "flex items-baseline gap-1.5" },
          h("span", {
            style: {
              fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink,
              fontWeight: 600, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: "58%"
            }
          }, r.name),
          r.type === "group" ? h("span", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog } }, "群") : null,
          h("span", { style: { flex: 1 } }),
          // 时刻和条数都要：只剩条数的话，「这是刚来的还是昨天的」就看不出来了
          h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginRight: 4, whiteSpace: "nowrap" } }, whenLabel(r.ts, props.now)),
          h("span", {
            style: {
              fontFamily: F_BODY, fontSize: 9.5, color: inkOn(accent), background: accent,
              borderRadius: 999, padding: "1px 5px", lineHeight: 1.35
            }
          }, un > 99 ? "99+" : un)),
        h("div", {
          style: {
            fontFamily: F_BODY, fontSize: 11, lineHeight: 1.5, color: t.sub,
            marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
          }
        }, (mine ? "我：" : "") + (excerpt(r.last) || "…")));
    };

    return h("div", {
      className: "w-full h-full flex flex-col",
      style: {
        minHeight: 0, borderRadius: 16, overflow: "hidden", boxSizing: "border-box",
        // ⚠️夹板必须【自己有底】：原来是 ink 4% 的一层薄色，铺了照片壁纸就整个不见了。
        //   底色走主题的纸色（不是写死的白），铺壁纸时再压一层磨砂顶住花底子。
        background: paper,
        backgroundImage: "linear-gradient(180deg," + skinAlpha(ink, "10") + "," + skinAlpha(ink, "06") + ")",
        border: "1px solid " + skinAlpha(ink, onWall ? "2a" : "1c"),
        boxShadow: onWall ? "0 10px 26px rgba(30,26,22,.28)" : "0 6px 16px rgba(30,26,22,.12)"
      }
    },
      clampBar(t, ink, onWall, "捎来的字条", totalUn, accent),
      // 压条底下压着一道影：纸是【插进夹子里】的，不是摆在下面的
      h("div", { className: "shrink-0", style: { height: 5, marginBottom: -5, background: "linear-gradient(180deg," + skinAlpha(ink, "24") + ",transparent)", position: "relative", zIndex: 50 } }),
      h("div", {
        className: "flex-1 min-h-0",
        style: { overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "7px 8px 8px", touchAction: editMode ? "none" : "pan-y" }
      },
        rows.length
          ? rows.map(slip)
          : h("div", {
              style: {
                background: paper, border: "1px dashed " + skinAlpha(ink, "22"), borderRadius: 4,
                padding: "12px 10px", fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.75
              }
            }, everSpoke(props) ? "都看完了。" : "夹子上还空着。跟谁说过话，字条就会夹上来。")));
  }

  // ── 聊天框顶上那个返回键 ────────────────────────────────
  // 在 A 的聊天框里时：别处还有没看的 → 返回键变成一个圈，圈里写还剩几条；
  // 一条都没有 → 还是原来那支箭。数字不含 A 自己（人已经在这间屋里了）。
  function UnreadBack(props) {
    const t = useTheme();
    const n = Math.max(0, props.count || 0);
    if (!n) return h("button", { onClick: props.onBack, className: "active:opacity-50", style: { padding: "9px 6px" , marginLeft: -6 }, "aria-label": "返回" },
      h(IArrow, { size: 19, color: t.ink, wk: "headink" }));
    const txt = n > 99 ? "99+" : String(n);
    return h("button", {
      onClick: props.onBack,
      className: "active:opacity-50 flex items-center",
      style: { gap: 2, marginLeft: -6, padding: "9px 5px 9px 3px" },   // 连 padding 算够 40px 高，别缩成一颗小圈
      "aria-label": "返回，别处还有 " + n + " 条未读"
    },
      h(IArrow, { size: 15, color: t.ink, wk: "headink" }),
      h("span", {
        style: {
          minWidth: 22, height: 22, padding: "0 5px", borderRadius: 999,
          border: "1.5px solid " + (t.accent || "#b04a3f"),
          color: t.accent || "#b04a3f", background: "transparent",
          fontFamily: F_BODY, fontSize: txt.length > 2 ? 9.5 : 11,
          display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box"
        }
      }, txt));
  }

  window.RecentWidget = { Widget: RecentWidget, UnreadBack: UnreadBack, recentRows: recentRows, whenLabel: whenLabel };
})();
