// js/codex.js — 攻略：这台手机的说明书。纯静态内容，零 API 零常驻。
// 入口：主屏名片右下角那颗 ❓。以后每加一个功能，往 DB 里补一条即可（cat 分组）。
//
// ⚠️两条写法上的规矩：
// 1. b 用「一句话点题 + \n· 分点」，别糊成一大段；渲染处 whiteSpace:pre-wrap 让换行生效。
// 2. 说【在哪儿点】和【它到底会怎样】，不要写产品宣传语——她来查这一页，
//    多半是「这东西在哪」或者「点了会发生什么」，不是想被介绍一遍。
// 这一页现实里是什么？就是它自己写着的那句——【随机器附赠的那本说明书】。
// 所以底是那种薄纸：极淡的横纹、纸边压暗，左上角两枚订书钉。
// 跟库里已有的分得开：世界书是活页夹（左边一列装订孔），剪贴簿是牛皮，这本是订起来的。
// ⚠️深色/自定义主题下 t.ink 未必是六位色号，拼透明度后缀会拼出废值、整层静默消失。
function manualSkin(t) {
  if (!/^#[0-9a-f]{6}$/i.test(String(t.ink || ""))) return { background: t.bg };
  const k = t.ink, L = [];
  // 左上角两枚订书钉：一枚一段短斜线，斜着钉进去的那种
  // ⚠️钉在【顶栏底下】，不是顶栏那一行：钉在 top 30px 上会跟返回键叠在一起
  //   （v63.45 浏览器里看出来的）。说明书的订书钉本来也在封面标题下面那一截。
  [["left 15px top 104px", "-24deg"], ["left 15px top 126px", "-24deg"]].forEach(([pos]) => {
    L.push("linear-gradient(-24deg," + k + "00 0 3px," + k + "46 3px 12px," + k + "00 12px)"
      + " no-repeat " + pos + "/16px 7px");
  });
  L.push("repeating-linear-gradient(180deg," + k + "00 0 25px," + k + "06 25px 26px)");
  L.push("radial-gradient(130% 92% at 50% 46%," + k + "00 58%," + k + "12 100%)");
  L.push(t.bg);
  return { background: L.join(",") };
}
(function () {
  // 攻略原来自己另存了一份 53 条的说明（DB），跟秋秋那份手册是同一件事写了两遍——
  // 改一处漏一处，而且它按【话题】切：聊天一个 app 被拆成七条摆在一起，桌面拆成五条，
  // 她 2026-09-05 点名的就是这个（「有些同一个页面的都分开两条了」）。
  // 现在数据只剩 assistant-manual.js 那一份，这一页按【app】把它归堆：
  // 一个 app 一行，点开是整页——那一页名下所有词条全摊开（no-half-sheet：这是详情，整页）。
  const MAN = () => (typeof window !== "undefined" && window.AssistantManual) || null;
  const no2 = n => String(n + 1).padStart(2, "0");

  function CodexApp(props) {
    const t = useTheme();
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(null);       // 打开的是哪个 app
    const M = MAN();
    if (!M) return h("div", { className: "h-full flex flex-col", style: manualSkin(t) },
      h(Head, { zh: "攻略", sub: "这台手机的说明书", bg: "transparent", onBack: props.onBack }),
      h("div", { style: { padding: "40px 24px", fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", lineHeight: 1.9 } },
        "说明书没加载出来。\n退出去再进一次。"));

    const qq = q.trim().toLowerCase();
    const hitApp = a => {
      if (!qq) return true;
      if (a.zh.toLowerCase().indexOf(qq) >= 0) return true;
      return M.appEntries(a.id).some(e =>
        (e.zh + e.what + (e.how || "") + (e.more || []).join("") + (e.kw || []).join(" ")).toLowerCase().indexOf(qq) >= 0);
    };
    const apps = M.APPS.filter(hitApp);
    const cats = M.APP_CATS.filter(c => apps.some(a => a.cat === c));

    // ── 某一个 app 的整页 ─────────────────────────────────────────
    if (open) {
      const app = M.APPS.find(a => a.id === open);
      const list = app ? M.appEntries(app.id) : [];
      const sec = (e, i) => h("div", { key: e.id, style: { marginTop: i ? 22 : 14 } },
        h("div", { className: "flex items-baseline", style: { gap: 9 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11, color: t.fog, width: 22, flexShrink: 0 } }, no2(i)),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, e.zh)),
        h("div", { style: { height: 1, background: t.ink, opacity: .13, margin: "7px 0 0 22px" } }),
        h("div", { style: { paddingLeft: 22 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "9px 0 6px" } }, "在哪儿：" + e.where),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.95, color: t.ink } }, e.what),
          e.how ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.95, color: t.sub, marginTop: 7 } }, e.how) : null,
          (e.more || []).length ? h("div", { style: { marginTop: 9 } }, e.more.map((m, j) =>
            h("div", { key: j, className: "flex", style: { gap: 7, marginTop: 5 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, flexShrink: 0 } }, "·"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: t.sub } }, m)))) : null));
      return h("div", { className: "h-full flex flex-col", style: manualSkin(t) },
        h(Head, { zh: (app && app.zh) || "攻略", sub: app ? app.cat + " · 共 " + list.length + " 节" : "", bg: "transparent", onBack: () => setOpen(null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12", style: { WebkitOverflowScrolling: "touch" } },
          list.map(sec),
          h("button", {
            onClick: () => props.onAskAssistant && props.onAskAssistant(),
            className: "w-full text-left active:opacity-80",
            style: { display: "flex", alignItems: "center", gap: 10, marginTop: 26, padding: "12px 13px", borderRadius: 14,
              background: hexA(t.accent, .10), border: "1px solid " + hexA(t.accent, .26) }
          },
            h("span", { className: "flex items-center justify-center", style: { width: 30, height: 30, borderRadius: 999, background: hexA(t.accent, .16), flexShrink: 0 } },
              h(window.GAssist || GDuty, { size: 16, color: t.accent })),
            h("span", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.6 } },
              "这一页还有不明白的，直接问秋秋"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: t.accent, flexShrink: 0 } }, "›"))));
    }

    // ── 目录：一章一章，一个 app 一行 ───────────────────────────────
    const row = (a, ci, i) => {
      const first = M.appEntries(a.id)[0];
      const n = M.appEntries(a.id).length;
      return h("div", { key: a.id },
        h("button", {
          onClick: () => setOpen(a.id), className: "w-full text-left active:opacity-70",
          style: { display: "flex", alignItems: "baseline", gap: 10, padding: "11px 2px 11px 0", width: "100%", minHeight: 44 }
        },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11, color: t.fog, width: 30, flexShrink: 0 } }, no2(ci) + "." + no2(i)),
          h("span", { className: "flex-1 min-w-0" },
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } },
              a.zh, n > 1 ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: 7 } }, n + " 节") : null),
            first ? h("span", { className: "truncate", style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3 } },
              M.teaser(first)) : null),
          h("span", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 1, color: t.line, flexShrink: 0 } }, "›")),
        h("div", { style: { height: 1, background: t.line, opacity: .7 } }));
    };

    return h("div", { className: "h-full flex flex-col", style: manualSkin(t) },
      h(Head, { zh: "攻略", sub: "这台手机的说明书", bg: "transparent", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10", style: { WebkitOverflowScrolling: "touch" } },
        // 最上面这一条：不会就问秋秋（她 2026-09-04 点名）。点得进去，不是一句摆设。
        h("button", {
          onClick: () => props.onAskAssistant && props.onAskAssistant(),
          className: "w-full text-left active:opacity-80",
          style: {
            display: "flex", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 16,
            padding: "13px 14px", borderRadius: 16,
            background: "linear-gradient(135deg," + hexA(t.accent, .16) + "," + hexA(t.accent, .05) + ")",
            border: "1px solid " + hexA(t.accent, .28)
          }
        },
          h("span", { className: "flex items-center justify-center", style: { width: 34, height: 34, borderRadius: 999, background: hexA(t.accent, .18), flexShrink: 0 } },
            h(window.GAssist || GDuty, { size: 18, color: t.accent })),
          h("span", { className: "flex-1 min-w-0" },
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, "这儿没写的，问秋秋"),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 2, lineHeight: 1.5 } },
              "找不到东西、看不懂哪个按钮，跟它说一声")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: t.accent, flexShrink: 0 } }, "›")),

        h("input", {
          value: q, onChange: e => setQ(e.target.value),
          placeholder: "搜功能：自拍 / 备份 / 组件 / 加笔 / 抽卡…",
          style: { width: "100%", outline: "none", padding: "10px 13px", borderRadius: 12, marginBottom: 6,
            background: t.bg2, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 13 }
        }),

        apps.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", marginTop: 40, lineHeight: 1.9, whiteSpace: "pre-wrap" } },
              "没搜到这个词。\n换个说法，或者上去问秋秋。")
          : cats.map((cat, ci) => {
              const items = apps.filter(a => a.cat === cat);
              return h("div", { key: cat, style: { marginTop: 18 } },
                // 章头：大号章节数 + 章名，底下一条实一条虚——像说明书的分章页
                h("div", { className: "flex items-baseline", style: { gap: 9 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, lineHeight: 1, color: hexA(t.ink, .18) } }, no2(ci)),
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, letterSpacing: ".08em" } }, cat),
                  h("span", { style: { flex: 1 } }),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, items.length + " 个")),
                h("div", { style: { height: 2, background: t.ink, opacity: .16, marginTop: 6 } }),
                h("div", { style: { height: 1, borderTop: "1px dashed " + t.line, marginBottom: 2 } }),
                items.map((a, i) => row(a, ci, i)));
            })));
  }
  window.CodexApp = CodexApp;
})();
