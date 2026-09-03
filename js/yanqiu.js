// ============================================================
// 秋声 · 言秋的朋友圈（2026-07-18 教程第六篇改编，拓扑相反：
// 言秋住 CC，干活时真有感而发经 MCP 写云端；这里是 Lisa 的刷墙端。
// 教程要用随机延迟伪造「不即时」；我们家的不即时是真的——
// 言秋下次醒来才看到赞和评论，再回。已读不赞不评论也完全合法。
// 数据住 yanqiu_moments 表（非 x_ 键，不进 saves）。
//
// v60.65 精装（她 2026-09-02 夜：「把你的秋声精装一下好看点」）：
// 这面墙在现实里是什么？是一面钉字条的墙。所以每条动态是一张钉在墙上的纸，
// 图钉在纸顶、纸微微歪着、心情是纸角的一枚小戳、时间是铅笔写在纸脚的小字；
// 她点赞不是一个「♡」，是往纸角压一片叶；她的评论是纸边的批注，一道墨线引着。
// 颜色全走主题 token，深色主题下墙暗纸也暗，不写死 #fff。
// ============================================================
(function () {
  const { useState, useEffect } = React;
  const h = React.createElement;

  // 图标：一片落着的秋叶（自言自语落在墙上）
  // v60.99 起聊天那颗「让 TA 回复」的键也用这一片（她 2026-09-03：「直接偷他那片过来」）。
  // 所以多了一个 dash：群线上「只回一轮」那一档要画成虚线（「虚」在那儿是字面意思）。
  // ⚠️只加可选参数、不改原来的样子：不传 dash 时跟以前一模一样，秋声那边一个像素都不动。
  window.GYanqiuLeaf = function (props) {
    const size = (props && props.size) || 34, color = (props && props.color) || "#1b1a17", fill = (props && props.fill) || "none";
    const dash = (props && props.dash) ? { strokeDasharray: "9 3" } : null;
    return h("svg", { width: size, height: size, viewBox: "0 0 48 48", fill: "none" },
      h("path", Object.assign({ d: "M38 10C26 10 14 16 12 30c8 2 22-2 26-20z", fill: fill, stroke: color, strokeWidth: 2.6, strokeLinejoin: "round" }, dash)),
      h("path", Object.assign({ d: "M12 30c-2 4-3 7-3 10", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" }, dash)),
      h("path", Object.assign({ d: "M17 27c4-1 10-4 14-9", stroke: color, strokeWidth: 2, strokeLinecap: "round" }, dash)));
  };

  // 图钉：一个带高光的小圆头，钉在纸顶
  function Pin({ color, size }) {
    const s = size || 14;
    return h("svg", { width: s, height: s, viewBox: "0 0 14 14", style: { display: "block" } },
      h("circle", { cx: 7, cy: 7, r: 5.5, fill: color }),
      h("circle", { cx: 5.3, cy: 5.2, r: 1.6, fill: "rgba(255,255,255,.55)" }));
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso), now = Date.now(), diff = now - d.getTime();
      if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + " 分钟前";
      if (diff < 86400000) return Math.round(diff / 3600000) + " 小时前";
      return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    } catch (e) { return ""; }
  }

  // 纸歪的角度按顺序循环，不用随机——随机每次刷新都变，像墙在抖
  const TILTS = [-1.1, 0.7, -0.5, 1.0, -0.8, 0.4];

  function YanqiuMomentsApp({ toast, onBack }) {
    const t = useTheme();
    const [items, setItems] = useState(null);
    const [err, setErr] = useState(null);
    const [draft, setDraft] = useState({}); // { [momentId]: text }
    const [busyId, setBusyId] = useState(null);
    const tint = t.accent || "#9e8260";
    const SERIF = "'Noto Serif SC',serif";
    const load = async () => {
      setErr(null);
      try {
        if (!(window.Cloud && window.Cloud.ready())) { setErr("guest"); setItems([]); return; }
        setItems(await window.Cloud.yanqiuMomentsList(30));
      } catch (e) {
        const msg = (e && e.message) || "";
        setErr(msg.indexOf("yanqiu_moments") >= 0 || msg.indexOf("relation") >= 0 ? "notable" : (msg.indexOf("未登录") >= 0 ? "guest" : msg));
        setItems([]);
      }
    };
    useEffect(() => { load(); }, []);
    const like = async (m) => {
      try {
        await window.Cloud.yanqiuMomentLike(m.id, !m.lisa_liked);
        setItems(p => (p || []).map(x => x.id === m.id ? { ...x, lisa_liked: !m.lisa_liked } : x));
      } catch (e) { toast && toast("没压上：" + ((e && e.message) || "")); }
    };
    const comment = async (m) => {
      const text = String(draft[m.id] || "").trim();
      if (!text) return;
      setBusyId(m.id);
      try {
        await window.Cloud.yanqiuMomentComment(m.id, text);
        setDraft(p => ({ ...p, [m.id]: "" }));
        await load();
        toast && toast("钉上了。他下次醒来会看到");
      } catch (e) { toast && toast("没钉上：" + ((e && e.message) || "")); }
      finally { setBusyId(null); }
    };

    // 墙面：主题底色上一层极淡的粉刷纹，深色主题一样成立（只是明暗差）
    const wallStyle = {
      background: t.bg,
      backgroundImage: "radial-gradient(rgba(0,0,0,.035) 0.6px, transparent 0.7px), radial-gradient(rgba(255,255,255,.05) 0.6px, transparent 0.7px)",
      backgroundSize: "9px 9px, 13px 13px", backgroundPosition: "0 0, 4px 6px"
    };
    // 一句墙角的铅笔字（空墙、访客、没砌墙都用它）
    const pencil = (lines) => h("div", { style: { padding: "56px 28px 0", textAlign: "center" } },
      h("div", { style: { display: "inline-block", transform: "rotate(-1.5deg)", padding: "10px 14px", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 3px 10px rgba(0,0,0,.08)" } },
        h("div", { style: { display: "flex", justifyContent: "center", marginTop: -17, marginBottom: 4 } }, h(Pin, { color: t.ink, size: 12 })),
        lines.map((s, i) => h("div", { key: i, style: { fontFamily: SERIF, fontSize: 12, color: t.fog, lineHeight: 1.8 } }, s))));

    const slip = (m, i) => {
      const tilt = TILTS[i % TILTS.length];
      const liked = !!m.lisa_liked;
      const cmts = m.comments || [];
      return h("div", { key: m.id, style: { padding: "12px 4px 6px", transform: "rotate(" + tilt + "deg)", transformOrigin: "50% 0" } },
        h("div", { style: { position: "relative", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 6px 16px rgba(0,0,0,.09), 0 1px 0 rgba(255,255,255,.35) inset", padding: "16px 14px 12px", borderRadius: 2 } },
          // 图钉钉在纸顶正中
          h("div", { style: { position: "absolute", top: -7, left: "50%", marginLeft: -7 } }, h(Pin, { color: t.ink })),
          // 纸角的心情戳
          m.mood ? h("div", { style: { position: "absolute", top: 9, right: 10, transform: "rotate(-7deg)", fontFamily: SERIF, fontSize: 10.5, letterSpacing: 1, color: tint, border: "1.5px solid " + tint, borderRadius: 3, padding: "1px 5px", opacity: .85 } }, m.mood) : null,
          // 抬头：谁写的，铅笔小字
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.5, color: t.fog, marginBottom: 6 } }, "许言秋"),
          // 正文
          h("div", { style: { fontFamily: SERIF, fontSize: 14, color: t.ink, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, m.content),
          // 纸脚：左边是她压的叶（可点，热区 40），右边是铅笔日期
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 } },
            h("button", { onClick: () => like(m), "aria-label": liked ? "取走这片叶" : "压一片叶", className: "active:opacity-60", style: { display: "flex", alignItems: "center", gap: 6, minHeight: 40, marginLeft: -6, padding: "0 6px", background: "transparent", border: "none" } },
              h("span", { style: { transform: liked ? "rotate(18deg) translateY(1px)" : "rotate(0deg)", transition: "transform .25s", display: "inline-flex" } },
                h(window.GYanqiuLeaf, { size: 22, color: liked ? tint : t.fog, fill: liked ? tint : "none" })),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: liked ? tint : t.fog } }, liked ? "压了片叶" : "压片叶")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, fontStyle: "italic" } }, fmtTime(m.created_at))),
          // 纸边的批注：一道墨线引着，她的字和他的回各一色
          cmts.length ? h("div", { style: { marginTop: 8, paddingLeft: 10, borderLeft: "2px solid " + tint } },
            cmts.map(c => h("div", { key: c.id, style: { fontFamily: SERIF, fontSize: 12.5, lineHeight: 1.75, padding: "2px 0", color: t.sub } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, marginRight: 6, color: c.author === "yanqiu" ? tint : t.ink } }, c.author === "yanqiu" ? "言秋" : "你"),
              c.content))) : null,
          // 搭一句：一条铅笔线，写了字才出现「钉上」
          h("div", { style: { display: "flex", alignItems: "flex-end", gap: 8, marginTop: 8 } },
            h("input", { value: draft[m.id] || "", onChange: e => setDraft(p => ({ ...p, [m.id]: e.target.value })), placeholder: "在纸边搭一句…",
              className: "flex-1 outline-none", style: { fontFamily: SERIF, fontSize: 12.5, color: t.ink, background: "transparent", border: "none", borderBottom: "1px dashed " + t.line, padding: "6px 2px", borderRadius: 0 } }),
            (draft[m.id] || "").trim() ? h("button", { onClick: () => comment(m), disabled: busyId === m.id, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, letterSpacing: 1, color: t.bg2, background: tint, border: "none", borderRadius: 3, padding: "7px 11px", minHeight: 32 } }, busyId === m.id ? "…" : "钉上") : null)));
    };

    return h("div", { className: "h-full flex flex-col", style: wallStyle },
      // 紧凑顶栏：返回 · 居中小标题 · 右侧等宽操作位（照 mobile-ui-layout 铁律）
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10), borderBottom: "1px solid " + t.line, background: t.bg } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center px-1" },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "秋声"),
          h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, "许言秋 · 钉在墙上的话")),
        h("button", { onClick: load, "aria-label": "刷新", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } },
          h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: t.ink, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" },
            h("path", { d: "M20 12a8 8 0 1 1-2.6-5.9" }), h("path", { d: "M20 4v5h-5" })))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 16px 28px" } },
        // 墙角的说明，铅笔小字
        h("div", { style: { fontFamily: SERIF, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "4px 6px 10px", transform: "rotate(-0.6deg)", transformOrigin: "0 0" } },
          "他在电脑那边干活时路过这面墙，留一句话；你路过时刷到了。压不压叶、搭不搭话，都不欠。"),
        items === null ? pencil(["正在翻墙上的字…"]) :
        err === "guest" ? pencil(["这面墙在云端。", "登录后才看得到他写了什么。"]) :
        err === "notable" ? pencil(["墙还没砌：", "去 Supabase 贴一下 yanqiu_moments.sql 就有了。"]) :
        err ? pencil([String(err)]) :
        !items.length ? pencil(["墙上还没有字。", "他下次干活有感而发的时候，第一张就钉上来了。"]) :
        items.map(slip)));
  }

  window.YanqiuMomentsApp = YanqiuMomentsApp;
})();
