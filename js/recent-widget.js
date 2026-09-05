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

  // 把角色和群合成一列「刚来的」，按最后一条时间倒序。没有任何消息的不进来——
  // 这一沓答的是「刚来了什么」，不是「我认识谁」。
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
    return rows;
  }

  // 压条：整只夹子的脸面。标题和「还剩几条没看」都写在这一条上——
  // ⚠️v63.08 之前它们写在夹板上，而夹板是半透明的：铺了照片壁纸就整个消失
  //（她 2026-09-05 截图：只剩三张白纸飘在树林上）。字要待在自己有底的东西上。
  function clampBar(t, ink, onWall, title, unread) {
    // ⚠️压条是【墨色】的，所以上面的字一律用 t.bg，绝不写死 #fff——
    //   深色主题里 ink 是浅的，白字压上去就是白底白字（tabs-not-plain-pills 那条踩过）。
    var fg = t.bg || "#fff";
    return h("div", {
      className: "shrink-0 flex items-center",
      style: {
        height: 30, borderRadius: "13px 13px 4px 4px", padding: "0 10px", gap: 6,
        background: "linear-gradient(180deg," + skinAlpha(ink, "ff") + " 0%," + skinAlpha(ink, "e0") + " 62%," + skinAlpha(ink, "f2") + " 100%)",
        boxShadow: "inset 0 1px 0 " + skinAlpha(fg, "30") + ", 0 2px 6px rgba(30,26,22,.28)"
      }
    },
      h("span", { style: { width: 5, height: 5, borderRadius: 999, background: skinAlpha(fg, "88"), flexShrink: 0 } }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, color: fg, letterSpacing: ".06em", whiteSpace: "nowrap" } }, title),
      h("span", { style: { flex: 1 } }),
      unread ? h("span", {
        style: { fontFamily: F_BODY, fontSize: 10, color: "#fff", background: "#b8483c", borderRadius: 999, padding: "1.5px 7px", whiteSpace: "nowrap" }
      }, unread + " 条没看") : null,
      h("span", { style: { width: 5, height: 5, borderRadius: 999, background: skinAlpha(fg, "88"), flexShrink: 0, marginLeft: 6 } }));
  }

  function RecentWidget(props) {
    const t = useTheme();
    const rows = recentRows(props);
    const editMode = !!props.editMode;
    const ink = /^#[0-9a-fA-F]{6}$/.test(String(t.ink || "")) ? t.ink : "#3a3430";
    const paper = t.bg2 || t.bg;
    const totalUn = rows.reduce(function (a, r) { return a + (r.unread || 0); }, 0);
    const onWall = typeof useOnWallpaper === "function" ? useOnWallpaper() : false;

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
          border: "1px solid " + skinAlpha(ink, un ? "2e" : "18"),
          borderLeft: "3px solid " + (un ? "#b04a3f" : skinAlpha(ink, "1c")),
          borderRadius: 4,
          padding: "6px 9px 7px",
          marginTop: i === 0 ? 0 : -3,               // 一张压着一张，像插在夹子里
          marginLeft: un ? 0 : 5,                     // 没看的那几张往外探出一截
          marginRight: un ? 5 : 0,
          transform: "rotate(" + tilt + "deg)",
          boxShadow: "0 1px 3px " + skinAlpha(ink, "14"),
          position: "relative", zIndex: 40 - i
        }
      },
        h("div", { className: "flex items-baseline gap-1.5" },
          h("span", {
            style: {
              fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink,
              fontWeight: un ? 600 : 400, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: "58%"
            }
          }, r.name),
          r.type === "group" ? h("span", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog } }, "群") : null,
          h("span", { style: { flex: 1 } }),
          un ? h("span", {
            style: {
              fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "#b04a3f",
              borderRadius: 999, padding: "1px 5px", lineHeight: 1.35
            }
          }, un > 99 ? "99+" : un) : h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog } }, whenLabel(r.ts, props.now))),
        h("div", {
          style: {
            fontFamily: F_BODY, fontSize: 11, lineHeight: 1.5, color: un ? t.sub : t.fog,
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
      clampBar(t, ink, onWall, "捎来的字条", totalUn),
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
            }, "夹子上还空着。跟谁说过话，字条就会夹上来。")));
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
