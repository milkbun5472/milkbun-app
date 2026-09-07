(function (g) {
  "use strict";
  // 预览台跳出去再回来时，落回她刚才那一栏、那一页（v65.00）。
  // ⚠️不进存档：它只是「上一秒在哪儿」，关掉 app 就该忘掉。
  let lastSpot = null;
  function ThemeStudioConfig({ toast, theme, wallpaper, onSaveTheme, onSaveWallpaper }) {
    const t = useTheme(), studio = g.ThemeStudio;
    // ⚠️正在预览时读【屏幕上生效的那份】，不是存档里那份：预览台会带她跳到真页面上
    //   看一眼，工作台是重新挂载的——照旧 load() 的话，她刚写的 CSS 当场没了（v65.00）。
    const [draft, setDraft] = useState(() => (studio.isPreviewing() && studio.current) ? studio.current() : studio.load());
    const [pendingBase, setPendingBase] = useState(null), [pendingWallpaper, setPendingWallpaper] = useState(undefined);
    const [section, setSection] = useState(() => (lastSpot && lastSpot.section) || "icons"), [page, setPage] = useState(() => (lastSpot && lastSpot.page) || "home"), [previewing, setPreviewing] = useState(() => studio.isPreviewing());
    useEffect(() => { lastSpot = null; }, []);
    const iconFile = useRef(null), iconFiles = useRef(null), importFile = useRef(null), previewTimer = useRef(0), [pickKey, setPickKey] = useState("cast");
    // ⚠️卸载时【不许】撤销预览（v61.05，她 2026-09-03：「预览 30 秒也没用，退出界面就没了」）：
    //   「先预览 30 秒」的用处本来就是【退出这一页、到处走走看看】。原来这儿一卸载就
    //   cancelPreview()，等于按下去只在这一屏有效，一走就没——这个按钮的意义整个没了。
    //   30 秒到点自动撤销由 ThemeStudio.preview 自己那个计时器负责（它不随界面走），
    //   这儿只清掉本地那个「按钮还亮着」的计时器。
    useEffect(() => () => { clearTimeout(previewTimer.current); }, []);
    const patchDraft = p => setDraft(d => studio.normalize({ ...d, ...p }));
    const preview = () => { try { studio.preview(draft); clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewing(false), 30050); setPreviewing(true); toast("已临时预览；30 秒后自动撤销"); } catch (e) { toast("不能预览：" + e.message); } };
    const commit = () => { try { clearTimeout(previewTimer.current); setDraft(studio.commit(draft)); if (pendingBase && onSaveTheme) onSaveTheme(pendingBase); if (typeof pendingWallpaper === "string" && onSaveWallpaper) onSaveWallpaper(pendingWallpaper); setPendingBase(null); setPendingWallpaper(undefined); setPreviewing(false); toast("主题已正式应用"); } catch (e) { toast("不能应用：" + e.message); } };
    const cancel = () => { clearTimeout(previewTimer.current); studio.cancelPreview(); setPreviewing(false); toast("已撤销预览"); };
    // ── 预览台（v65.00）：去这一页看看 ───────────────────────────────
    // 她 2026-09-06：「设置页里也没有预览台，要跑出去看效果也很麻烦」。
    // ⚠️不再自己画一份预览。v62.02 删掉的那版 iframe 假预览跟真页面共享的只有挂点名字，
    //   底色、层级、字体、组件全是另写的——预览里对的东西上机不对，比没有预览更坏
    //   （修过两轮还是对不上）。只有真页面才是诚实的预览，所以这一颗是【把她送过去】。
    // 那一路给 5 分钟而不是 30 秒：她是走过去看一圈，30 秒不够；
    // 撤销的口子不靠计时器兜——屏幕底下一直浮着那条「回去改」。
    const PEEK_MS = 300000;
    const peek = () => {
      const go = typeof window !== "undefined" && window.__goScreen;
      const bar = typeof window !== "undefined" && window.__themePeekOpen;
      if (typeof go !== "function" || typeof bar !== "function") { toast("预览台还没准备好，请再点一次"); return; }
      let why = "";
      try { studio.preview(draft, PEEK_MS); } catch (e) { toast("不能预览：" + e.message); return; }
      why = go(page);
      if (why) { studio.cancelPreview(); toast(why); return; }
      clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => setPreviewing(false), PEEK_MS + 50);
      setPreviewing(true);
      lastSpot = { section: "css", page: page };
      bar({ page: page, zh: pageZh(page) });
    };
    const pageZh = k => { const row = (studio.PAGES || []).find(x => x[0] === k); return row ? String(row[1]).replace(/（.*$/, "") : k; };
    const chooseIcon = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const ref = await imgToVault(await resizeImageFile(f, 512, .9)); patchDraft({ icons: { ...draft.icons, [pickKey]: ref } }); toast("图标已放入草稿，点预览看看"); }
      catch (err) { toast("图标读取失败：" + (err.message || err)); }
    };
    const clearIcon = key => { const icons = { ...draft.icons }; delete icons[key]; patchDraft({ icons }); };
    // 一次多张（v62.42）：按文件名对 App。去掉扩展名之后，等于 appKey（cast）或等于中文名（人格档案馆）都认；
    // 认不出的整批报出来，一个都不悄悄丢。
    const chooseIcons = async e => {
      const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return;
      const byName = {}; studio.appIconList().forEach(([k, zh]) => { byName[k.toLowerCase()] = k; byName[zh] = k; });
      const icons = { ...draft.icons }, hit = [], miss = [];
      for (const f of files) {
        const stem = String(f.name || "").replace(/\.[a-z0-9]+$/i, "").trim();
        const key = byName[stem] || byName[stem.toLowerCase()];
        if (!key) { miss.push(stem); continue; }
        try { icons[key] = await imgToVault(await resizeImageFile(f, 512, .9)); hit.push(key); }
        catch (err) { miss.push(stem + "（读不出）"); }
      }
      if (hit.length) patchDraft({ icons });
      toast((hit.length ? "对上了 " + hit.length + " 张，已放入草稿，点预览看看" : "一张都没对上") + (miss.length ? "；认不出：" + miss.join("、") : ""));
    };
    const exportTheme = async () => {
      // 存文件走 engine.js 的 saveTextFile：iOS PWA 里 <a download> 点了什么都不会发生
      try { const text = await studio.exportPackage({ profile: draft, baseTheme: theme, wallpaper });
        const via = await window.saveTextFile("lisa-theme-" + new Date().toISOString().slice(0,10) + ".json", text, "application/json");
        toast(via === "cancel" ? "导出取消了" : via === "share" ? "主题包已交给分享面板（含真实图标素材），在里面选「存储到文件」" : "主题包已导出（含真实图标素材）"); }
      catch (e) { toast("导出失败：" + e.message); }
    };
    const importTheme = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const pack = await studio.importPackage(await f.text()); setDraft(pack.profile); setPendingBase(pack.baseTheme || null); setPendingWallpaper(pack.wallpaper); studio.preview(pack.profile); clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewing(false), 30050); setPreviewing(true); toast("已导入并临时预览；基础颜色与壁纸只会在确认后落盘"); }
      catch (err) { toast("导入失败：" + (err.message || err)); }
    };
    // ── 三栏＝工坊里三个抽屉的抽屉面（v62.68）─────────────────────────
    // 审美审计 2026-09-04：这三格是圆角 16 的填色卡，只靠底色区分选中——
    // 换个 app 照样成立（tabs-not-plain-pills）。
    // 主题工坊现实里是【一间工坊】，工坊分门别类靠的是一排抽屉：
    // 拉开的那一个往外探出来、亮着、投影更重；没拉开的缩在里面、暗一档。
    // 每个抽屉面上都有一根横的拉手（程序画的一道细杠），那是抽屉最认得出的记号。
    // ⚠️选中态同时变【位置、底色、阴影、拉手颜色】，不只靠色差。
    const tab = (id, title, sub) => {
      const on = section === id;
      return h("button", { onClick: () => setSection(id), className: "active:opacity-70",
        "aria-pressed": on ? "true" : "false",
        style: {
          position: "relative", minHeight: 40, padding: "16px 10px 13px", textAlign: "left",
          transform: on ? "translateY(-3px)" : "none",
          background: on ? t.bg2 : "rgba(127,127,127,.07)",
          color: on ? t.ink : t.sub,
          border: "1px solid " + t.line,
          borderRadius: "3px 3px 5px 5px",
          boxShadow: on ? "0 6px 12px -8px rgba(0,0,0,.55)" : "inset 0 2px 5px -4px rgba(0,0,0,.5)"
        }
      },
        // 拉手：抽屉面正中那一道横杠
        h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: 6, marginLeft: -13, width: 26, height: 3, borderRadius: 3, background: on ? t.tint : t.line } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14 } }, title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, opacity: .65, marginTop: 4 } }, sub));
    };
    const [slots, setSlots] = useState(() => studio.pageSlots(page));
    useEffect(() => { setSlots(studio.pageSlots(page)); }, [page]);
    const css = page === "all" ? draft.globalCSS || "" : (draft.pageCSS[page] || "");
    const setCSS = v => page === "all" ? patchDraft({ globalCSS: v }) : patchDraft({ pageCSS: { ...draft.pageCSS, [page]: v } });
    // ⚠️这个跟预览无关，别跟着一起删：身上挂着气泡皮肤时，那张 style 带 !important
    //   又排在主题 CSS 后面，直接灌内置 CSS 会像是一个字都没生效（v61.05 她要的顺序）。
    const clearSkin = () => { try { if (typeof applyBubblePreset === "function") applyBubblePreset("default"); localStorage.setItem("x_bubbleSkinPreset", ""); } catch (_) {} };
    // ⚠️「应用前预览」那一整块（含 esc / iconImg / previewBody / previewDoc）v62.02 删掉了。
    //   她 2026-09-04：「这个页面下面的应用前预览也根本没有，删了吧」。
    //   那是一个 iframe 里自己搭的一套假页面——它跟真页面共享的只有挂点名字，
    //   底色、层级、字体、组件全都是另写的。修过两轮（v61.03 补挂点、v61.05 补铺满），
    //   还是对不上：预览里对的东西上机不对，比没有预览更坏（她照着它调）。
    //   真正管用的是旁边那颗「先预览 30 秒」——它改的是【真 app 本身】。
    return h("div", null,
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginBottom: 14 } }, tab("icons","图标","逐个替换"), tab("css","页面 CSS","限定页面"), tab("package","主题包","带图搬家")),
      section === "icons" && h("div", null,
        // ── 整套换（v62.42）：仓库自带的几套，点一下整套换掉；她单独换过的那几张不动 ──
        // 每一套画成【一张贴纸纸】：三张缩略贴在纸上、纸角翘一点；选中的那张纸压在最上面（墨色边、不翘角）。
        // 不是一排药丸——药丸搬到哪个 app 都成立，一张贴纸纸只有换图标这一处成立。
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, marginBottom: 8 } }, "整套换：点一张贴纸纸整套换掉。你自己单独换过的 App 不受影响。"),
        h("div", { className: "flex flex-wrap", style: { gap: 10, marginBottom: 14 } },
          [["", "出厂线稿", 0]].concat(studio.packList()).map(([pk, name, n]) => {
            const on = (draft.iconPack || "") === pk;
            const peek = pk ? (studio.ICON_PACKS[pk].keys || []).slice(0, 3).map(k => studio.packIconSrc(pk, k)) : [];
            return h("button", { key: pk || "__none", onClick: () => patchDraft({ iconPack: pk, iconBare: pk ? !!studio.ICON_PACKS[pk].bare : false }), className: "active:opacity-80",
              style: { position: "relative", minHeight: 40, padding: "9px 12px 8px", borderRadius: 6, background: t.bg2, color: t.ink, textAlign: "left",
                border: "1px solid " + (on ? t.ink : t.line), boxShadow: on ? "0 3px 10px rgba(30,28,24,.16)" : "0 1px 3px rgba(30,28,24,.08)",
                transform: on ? "none" : "rotate(-1.2deg)" } },
              h("div", { className: "flex items-center", style: { gap: 5, marginBottom: 5, minHeight: 22 } },
                peek.length ? peek.map((src, i) => h("img", { key: i, src, alt: "", style: { width: 22, height: 22, borderRadius: 6, objectFit: "contain" } }))
                  : h("div", { style: { width: 22, height: 22, borderRadius: 6, border: "1px dashed " + t.line, display: "grid", placeItems: "center", color: t.fog, fontSize: 12 } }, pk ? "…" : "◌")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, name),
              pk ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 1 } }, n + " / " + studio.appIconList().length + " 张") : null,
              on ? h("span", { style: { position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: 999, background: t.ink, color: t.bg2, fontSize: 10, display: "grid", placeItems: "center" } }, "✓") : null);
          })),
        // ── 图标自带底（她 2026-09-04 要的那个开关）：图里已经画了玻璃方块的，别再套一层 ──
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 14, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px" } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "图标自带底，不套玻璃"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.4 } }, "图里已经画了方块和圆角的，开了它主屏就不再垫那块玻璃；线稿图标不受影响")),
          h("button", { onClick: () => patchDraft({ iconBare: !draft.iconBare }), className: "shrink-0 active:opacity-70", "aria-pressed": draft.iconBare ? "true" : "false",
            style: { width: 44, height: 26, borderRadius: 999, background: draft.iconBare ? t.ink : t.line, position: "relative", transition: "background .15s" } },
            h("div", { style: { position: "absolute", top: 3, left: draft.iconBare ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: t.bg2, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" } }))),
        // ── 一次多张：按文件名对上 App（文件叫 cast.png 或 人格档案馆.png 都认）──
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 10 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, flex: 1 } }, "点 App 选择图片。素材进入现有图片保险箱；没换的继续使用原图标。"),
          h("button", { onClick: () => iconFiles.current && iconFiles.current.click(), className: "shrink-0 active:opacity-70", style: { minHeight: 40, padding: "8px 12px", borderRadius: 10, border: "1px solid " + t.ink, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12 } }, "一次选多张")),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } }, studio.appIconList().map(([key,label]) => { const ref = draft.icons[key], packSrc = studio.packIconSrc(draft.iconPack, key), src = ref ? resolveImg(ref) : packSrc; return h("div", { key, style: { padding: 9, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } }, h("button", { onClick: () => { setPickKey(key); iconFile.current.click(); }, className: "w-full flex items-center gap-3 active:opacity-70", style: { textAlign: "left" } }, src ? h("img", { src, style: { width: 40, height: 40, borderRadius: 11, objectFit: draft.iconBare ? "contain" : "cover" } }) : h("div", { style: { width: 40, height: 40, borderRadius: 11, background: t.bg, display: "grid", placeItems: "center", color: t.fog } }, "+"), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, label)), ref ? h("button", { onClick: () => clearIcon(key), style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, marginTop: 5 } }, packSrc ? "退回整套里那张" : "恢复原图标") : null); })),
        h("input", { ref: iconFile, type: "file", accept: "image/*", onChange: chooseIcon, style: { display: "none" } }),
        h("input", { ref: iconFiles, type: "file", accept: "image/*", multiple: true, onChange: chooseIcons, style: { display: "none" } })),
      section === "css" && h("div", null,
        h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 10 } },
          h("select", { value: page, onChange: e => setPage(e.target.value), style: { flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY } }, studio.PAGES.map(([k,l]) => h("option", { key: k, value: k }, l))),
          h("button", { onClick: peek, disabled: page === "all", className: "shrink-0 active:opacity-70 disabled:opacity-35",
            style: { minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid " + t.ink, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12.5, whiteSpace: "nowrap" } }, "去这一页看看")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: -4, marginBottom: 10 } },
          page === "all" ? "「全 App」不是某一页——挑一页再点右边那颗。" : "点右边那颗直接跳到这一页看真的样子，底下会浮一条「回去改」送你回来。"),
        // ── 这一页单独换几支色（v65.06）────────────────────────────────
        // 挂点只挂得住共用组件，而各页正文里的卡片、按钮、列表都是自己内联写的——
        // 一页一页去挂挂不完。但它们的颜色全从同一份 token 里取，所以给这一页
        // 单独换几支色，那一页所有东西一起跟着变，一个挂点都不需要。
        page !== "all" && (function () {
          // ⚠️自己写死一套配色的那几页：这儿要说明白「改了也不会变」，别让她白改一遍
          //   （她 2026-09-07：「我让秋秋改梦境变白还是没有变化」）。名单只有 ThemeStudio 那一份。
          const own = (studio.OWN_PALETTE || {})[page];
          if (own) return h("div", { style: { marginBottom: 14, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", background: "rgba(194,90,74,.07)" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 3 } }, "这一页换不了色"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.7, color: t.fog } },
              "它的颜色不是从主题里取的（" + own + "），所以在这儿换几支色一点变化都不会有。"
              + "要让它能换，得先把这一页接到主题上——那是一次施工。上面的页面 CSS 照旧能改它的顶栏、半窗这些共用件。"));
          const cur = (draft.pageTokens || {})[page] || {};
          const put = (k, v) => {
            const one = { ...cur }; if (v) one[k] = v; else delete one[k];
            const all = { ...(draft.pageTokens || {}) };
            if (Object.keys(one).length) all[page] = one; else delete all[page];
            patchDraft({ pageTokens: all });
          };
          const hexish = v => /^#[0-9a-f]{6}$/i.test(String(v || "")) ? v : "#ffffff";
          return h("div", { style: { marginBottom: 14, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", background: t.bg2 } },
            h("div", { className: "flex items-center justify-between", style: { marginBottom: 3 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "这一页单独换几支色"),
              Object.keys(cur).length ? h("button", { onClick: () => { const all = { ...(draft.pageTokens || {}) }; delete all[page]; patchDraft({ pageTokens: all }); },
                className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "全部还原") : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginBottom: 9 } },
              "这一页的卡片、按钮、列表都是从这几支色里取的颜色。想整页换个调子，改这儿比写 CSS 管用——CSS 抓不住那些没挂点的东西，这个不用挂点。"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 } },
              (studio.TOKENS || []).map(function (tk) {
                const k = tk[0], on = !!cur[k], val = on ? cur[k] : (t[k] || "#ffffff");
                return h("label", { key: k, className: "flex items-center", style: { gap: 8, minHeight: 44, padding: "6px 9px", borderRadius: 11,
                    border: "1px solid " + (on ? t.ink : t.line), background: t.bg } },
                  h("span", { style: { width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: val, border: "1px solid " + t.line, position: "relative", overflow: "hidden" } },
                    h("input", { type: "color", value: hexish(val), onChange: e => put(k, e.target.value),
                      style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: "none", padding: 0 } })),
                  h("span", { style: { minWidth: 0, flex: 1 } },
                    h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: t.ink } }, tk[1]),
                    h("span", { style: { display: "block", fontFamily: "monospace", fontSize: 9.5, color: t.fog } }, on ? val : "跟随全局")),
                  on ? h("button", { onClick: e => { e.preventDefault(); put(k, ""); }, className: "shrink-0 active:opacity-70",
                    style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "还原") : null);
              })));
        })(),
        h("textarea", { value: css, onChange: e => setCSS(e.target.value), placeholder: ".message-bubble {\n  border-radius: 18px;\n}", style: { width: "100%", minHeight: 230, resize: "vertical", padding: 12, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.65 } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: 8 } }, page === "all" ? "全 App CSS 风险较高，也必须先预览。" : "选择器会自动加当前页面前缀，不会串到别处；远程 @import 和脚本式 CSS 会被拒绝。"),
        // ── 这一页抓得住的挂点（v65.05）────────────────────────────────
        // 她在这儿手写 CSS，界面上却从没说过【能抓住什么】——只能猜类名，
        // 而这个 App 没有语义 class，猜出来的一条都不生效（跟秋秋当初栽的是同一处）。
        // ⚠️名单只有 ThemeStudio 那一份（WK_COMMON + WK_SCOPED），这儿不另抄。
        (function () {
          const common = studio.WK_COMMON || [];
          const grp = (studio.WK_SCOPED || []).filter(function (g) { return (g.pages || []).indexOf(page) >= 0; })[0];
          const rows = [["每一页都有", common]].concat(grp ? [["这一页专有（" + grp.zh + "）", grp.hooks]] : []);
          const put = function (nm) {
            setCSS((css.trim() ? css.replace(/\s*$/, "") + "\n\n" : "") + '[data-wk="' + nm + '"] {\n  \n}');
          };
          return h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7, lineHeight: 1.65 } },
              "这一页抓得住的挂点（点一下写进上面的编辑框）。样式几乎全是内联写死的，"
              + "所以每一条声明都要带 !important，不带等于没写。"),
            rows.map(function (row) {
              return h("div", { key: row[0], style: { marginBottom: 8 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4 } }, row[0]),
                h("div", { className: "flex flex-wrap", style: { gap: 6 } },
                  (row[1] || []).map(function (hk) {
                    return h("button", { key: hk[0], onClick: function () { put(hk[0]); }, className: "active:opacity-70",
                      style: { minHeight: 40, padding: "6px 10px", borderRadius: 10, border: "1px dashed " + t.line, background: t.bg2, textAlign: "left" } },
                      h("div", { style: { fontFamily: "monospace", fontSize: 11, color: t.ink } }, hk[0]),
                      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 1 } }, hk[1]));
                  })));
            }),
            !grp && page !== "all" ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog } },
              "这一页只有上面这几个通用的。正文里的卡片、按钮、列表还没挂钩子——底色、字色、顶栏、半窗、空状态改得动，单独改某一张卡片改不动。") : null);
        })(),
        // ── 内置预设 + 这一页自己的 5 个槽位（v61.05，她 2026-09-03 要的）──
        // ⚠️内置是【拷贝】进编辑框的，不是引用：内置改了，她手上那份不会跟着变。
        //   她 2026-09-03 就是这么撞上的——挂点全补好了，她那份 CSS 还是旧选择器，
        //   界面上什么都没说，所以看着像「你做的一个没生效」。现在明说。
        (() => {
          const st = studio.cssStale ? studio.cssStale(css) : null;
          return st ? h("div", { style: { marginTop: 10, borderRadius: 12, padding: "10px 12px", background: "rgba(194,90,74,0.09)", border: "1px solid rgba(194,90,74,0.28)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.ink } },
              "「" + st.name + "」有更新（v" + st.from + " → v" + st.to + "）。上面这段是旧的，点下面那颗按钮重新灌一次才吃得到。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: 4 } },
              "⚠️重新灌会盖掉你在这段里改过的东西——想留就先存进下面的槽位。")) : null;
        })(),
        (studio.CSS_BUILTINS[page] || []).length ? h("div", { style: { marginTop: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } }, "内置（点一下灌进上面的编辑框，再改成你要的）"),
          h("div", { className: "flex flex-wrap", style: { gap: 7 } },
            studio.CSS_BUILTINS[page].map(([nm, code]) => h("button", { key: nm, onClick: () => { setCSS(code); clearSkin(); toast("「" + nm + "」已灌进编辑框，先预览看看"); },
              className: "active:opacity-70", style: { minHeight: 40, padding: "8px 13px", borderRadius: 10, border: "1px solid " + t.ink, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12.5 } }, nm)))) : null,
        h("div", { style: { marginTop: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } }, "这一页可以存 " + studio.SLOT_MAX + " 套：点空格＝把现在这段存进去；点存过的＝读出来"),
          h("div", { className: "flex flex-wrap", style: { gap: 7 } },
            Array.from({ length: studio.SLOT_MAX }).map((_, i) => {
              const sl = slots[i];
              return h("div", { key: i, className: "flex items-center", style: { gap: 4, minHeight: 40, padding: "6px 8px 6px 11px", borderRadius: 10, border: "1px solid " + t.line, background: sl ? t.bg2 : "transparent" } },
                h("button", { onClick: () => {
                    if (sl) { setCSS(sl.css); toast("读出「" + sl.name + "」"); return; }
                    const cur = page === "all" ? (draft.globalCSS || "") : (draft.pageCSS[page] || "");
                    if (!cur.trim()) { toast("编辑框还是空的，先写点东西再存"); return; }
                    // ⚠️不许用 window.prompt：PWA 里它会被系统吞掉，而且【不抛异常、
                    //   直接返回 null】——所以原来那个 try/catch 一次都没走到，
                    //   走的是「空字符串 → return」，按钮按下去什么都不发生
                    //   （她 2026-09-06：「可以放 5 套预设那个按钮也是摆设」）。
                    requestAppPrompt("给这一套起个名字", "存进第 " + (i + 1) + " 格；重名会盖掉那一格。", "预设 " + (i + 1),
                      function (nm) {
                        nm = String(nm || "").trim().slice(0, 12);
                        if (!nm) { toast("没起名字，没存"); return; }
                        setSlots(studio.saveSlot(page, i, nm, cur)); toast("存好了：" + nm);
                      }, "存进去", { maxLength: 12 });
                  }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: sl ? t.ink : t.fog } },
                  sl ? (i + 1) + " " + sl.name : (i + 1) + " 空"),
                sl ? h("button", { onClick: () => setSlots(studio.clearSlot(page, i)), "aria-label": "清掉这一套", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "0 3px" } }, "×") : null);
            })))),
      section === "package" && h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.75, marginBottom: 12 } }, "导出会把真实图标图片一起装包。导入只进入预览，不会静默覆盖现用主题。"),
        h("div", { className: "flex gap-2" }, h("button", { onClick: exportTheme, className: "flex-1 py-3", style: { borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY } }, "导出主题包"), h("button", { onClick: () => importFile.current.click(), className: "flex-1 py-3", style: { borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "导入主题包")), h("input", { ref: importFile, type: "file", accept: ".json,application/json", onChange: importTheme, style: { display: "none" } })),
      h("div", { style: { position: "sticky", bottom: 8, zIndex: 5, display: "flex", gap: 7, marginTop: 18, padding: 8, borderRadius: 16, background: "rgba(248,245,238,.92)", backdropFilter: "blur(18px)", border: "1px solid " + t.line, boxShadow: "0 8px 28px rgba(30,25,20,.12)" } }, h("button", { onClick: preview, className: "flex-1 py-3", style: { borderRadius: 11, border: "1px solid " + t.ink, fontFamily: F_BODY, color: t.ink } }, "先预览 30 秒"), previewing ? h("button", { onClick: cancel, className: "py-3 px-3", style: { color: t.accent, fontFamily: F_BODY } }, "撤销") : null, h("button", { onClick: commit, className: "flex-1 py-3", style: { borderRadius: 11, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "正式应用")));
  }
  g.ThemeStudioConfig = ThemeStudioConfig;
})(window);
