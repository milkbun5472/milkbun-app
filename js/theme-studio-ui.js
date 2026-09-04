(function (g) {
  "use strict";
  function ThemeStudioConfig({ toast, theme, wallpaper, onSaveTheme, onSaveWallpaper }) {
    const t = useTheme(), studio = g.ThemeStudio;
    const [draft, setDraft] = useState(() => studio.load());
    const [pendingBase, setPendingBase] = useState(null), [pendingWallpaper, setPendingWallpaper] = useState(undefined);
    const [section, setSection] = useState("icons"), [page, setPage] = useState("home"), [previewing, setPreviewing] = useState(false);
    const iconFile = useRef(null), importFile = useRef(null), previewTimer = useRef(0), [pickKey, setPickKey] = useState("cast");
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
    const chooseIcon = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const ref = await imgToVault(await resizeImageFile(f, 512, .9)); patchDraft({ icons: { ...draft.icons, [pickKey]: ref } }); toast("图标已放入草稿，点预览看看"); }
      catch (err) { toast("图标读取失败：" + (err.message || err)); }
    };
    const clearIcon = key => { const icons = { ...draft.icons }; delete icons[key]; patchDraft({ icons }); };
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
    const tab = (id, title, sub) => h("button", { onClick: () => setSection(id), className: "active:opacity-70", style: { padding: "14px 10px", borderRadius: 16, textAlign: "left", background: section === id ? t.ink : t.bg2, color: section === id ? t.bg2 : t.ink, border: "1px solid " + t.line } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14 } }, title), h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, opacity: .65, marginTop: 4 } }, sub));
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
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, marginBottom: 10 } }, "点 App 选择图片。素材进入现有图片保险箱；没换的继续使用原图标。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } }, studio.appIconList().map(([key,label]) => { const ref = draft.icons[key], src = ref ? resolveImg(ref) : ""; return h("div", { key, style: { padding: 9, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } }, h("button", { onClick: () => { setPickKey(key); iconFile.current.click(); }, className: "w-full flex items-center gap-3 active:opacity-70", style: { textAlign: "left" } }, src ? h("img", { src, style: { width: 40, height: 40, borderRadius: 11, objectFit: "cover" } }) : h("div", { style: { width: 40, height: 40, borderRadius: 11, background: t.bg, display: "grid", placeItems: "center", color: t.fog } }, "+"), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, label)), ref ? h("button", { onClick: () => clearIcon(key), style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, marginTop: 5 } }, "恢复原图标") : null); })),
        h("input", { ref: iconFile, type: "file", accept: "image/*", onChange: chooseIcon, style: { display: "none" } })),
      section === "css" && h("div", null,
        h("select", { value: page, onChange: e => setPage(e.target.value), style: { width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, marginBottom: 10 } }, studio.PAGES.map(([k,l]) => h("option", { key: k, value: k }, l))),
        h("textarea", { value: css, onChange: e => setCSS(e.target.value), placeholder: ".message-bubble {\n  border-radius: 18px;\n}", style: { width: "100%", minHeight: 230, resize: "vertical", padding: 12, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.65 } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: 8 } }, page === "all" ? "全 App CSS 风险较高，也必须先预览。" : "选择器会自动加当前页面前缀，不会串到别处；远程 @import 和脚本式 CSS 会被拒绝。"),
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
                    let nm = ""; try { nm = window.prompt("给这一套起个名字（12 字内）", "预设 " + (i + 1)) || ""; } catch (_) { nm = "预设 " + (i + 1); }
                    if (nm === "") return;                    // 取消就什么都不做
                    setSlots(studio.saveSlot(page, i, nm, cur)); toast("存好了：" + nm);
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
