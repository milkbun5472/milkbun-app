(function (g) {
  "use strict";
  function ThemeStudioConfig({ toast, theme, wallpaper, onSaveTheme, onSaveWallpaper }) {
    const t = useTheme(), studio = g.ThemeStudio;
    const [draft, setDraft] = useState(() => studio.load());
    const [pendingBase, setPendingBase] = useState(null), [pendingWallpaper, setPendingWallpaper] = useState(undefined);
    const [section, setSection] = useState("icons"), [page, setPage] = useState("home"), [previewing, setPreviewing] = useState(false);
    const iconFile = useRef(null), importFile = useRef(null), previewTimer = useRef(0), [pickKey, setPickKey] = useState("cast");
    useEffect(() => () => { clearTimeout(previewTimer.current); if (studio.isPreviewing()) studio.cancelPreview(); }, []);
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
      try { const text = await studio.exportPackage({ profile: draft, baseTheme: theme, wallpaper }); const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "lisa-theme-" + new Date().toISOString().slice(0,10) + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("主题包已导出（含真实图标素材）"); }
      catch (e) { toast("导出失败：" + e.message); }
    };
    const importTheme = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const pack = await studio.importPackage(await f.text()); setDraft(pack.profile); setPendingBase(pack.baseTheme || null); setPendingWallpaper(pack.wallpaper); studio.preview(pack.profile); clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewing(false), 30050); setPreviewing(true); toast("已导入并临时预览；基础颜色与壁纸只会在确认后落盘"); }
      catch (err) { toast("导入失败：" + (err.message || err)); }
    };
    const tab = (id, title, sub) => h("button", { onClick: () => setSection(id), className: "active:opacity-70", style: { padding: "14px 10px", borderRadius: 16, textAlign: "left", background: section === id ? t.ink : t.bg2, color: section === id ? t.bg2 : t.ink, border: "1px solid " + t.line } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14 } }, title), h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, opacity: .65, marginTop: 4 } }, sub));
    const css = page === "all" ? draft.globalCSS || "" : (draft.pageCSS[page] || "");
    const setCSS = v => page === "all" ? patchDraft({ globalCSS: v }) : patchDraft({ pageCSS: { ...draft.pageCSS, [page]: v } });
    return h("div", null,
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginBottom: 14 } }, tab("icons","图标","逐个替换"), tab("css","页面 CSS","限定页面"), tab("package","主题包","带图搬家")),
      section === "icons" && h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, marginBottom: 10 } }, "点 App 选择图片。素材进入现有图片保险箱；没换的继续使用原图标。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } }, studio.APP_ICONS.map(([key,label]) => { const ref = draft.icons[key], src = ref ? resolveImg(ref) : ""; return h("div", { key, style: { padding: 9, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } }, h("button", { onClick: () => { setPickKey(key); iconFile.current.click(); }, className: "w-full flex items-center gap-3 active:opacity-70", style: { textAlign: "left" } }, src ? h("img", { src, style: { width: 40, height: 40, borderRadius: 11, objectFit: "cover" } }) : h("div", { style: { width: 40, height: 40, borderRadius: 11, background: t.bg, display: "grid", placeItems: "center", color: t.fog } }, "+"), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, label)), ref ? h("button", { onClick: () => clearIcon(key), style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, marginTop: 5 } }, "恢复原图标") : null); })),
        h("input", { ref: iconFile, type: "file", accept: "image/*", onChange: chooseIcon, style: { display: "none" } })),
      section === "css" && h("div", null,
        h("select", { value: page, onChange: e => setPage(e.target.value), style: { width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, marginBottom: 10 } }, studio.PAGES.map(([k,l]) => h("option", { key: k, value: k }, l))),
        h("textarea", { value: css, onChange: e => setCSS(e.target.value), placeholder: ".message-bubble {\n  border-radius: 18px;\n}", style: { width: "100%", minHeight: 230, resize: "vertical", padding: 12, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.65 } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: 8 } }, page === "all" ? "全 App CSS 风险较高，也必须先预览。" : "选择器会自动加当前页面前缀，不会串到别处；远程 @import 和脚本式 CSS 会被拒绝。")),
      section === "package" && h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.75, marginBottom: 12 } }, "导出会把真实图标图片一起装包。导入只进入预览，不会静默覆盖现用主题。"),
        h("div", { className: "flex gap-2" }, h("button", { onClick: exportTheme, className: "flex-1 py-3", style: { borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY } }, "导出主题包"), h("button", { onClick: () => importFile.current.click(), className: "flex-1 py-3", style: { borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "导入主题包")), h("input", { ref: importFile, type: "file", accept: ".json,application/json", onChange: importTheme, style: { display: "none" } })),
      h("div", { style: { position: "sticky", bottom: 8, zIndex: 5, display: "flex", gap: 7, marginTop: 18, padding: 8, borderRadius: 16, background: "rgba(248,245,238,.92)", backdropFilter: "blur(18px)", border: "1px solid " + t.line, boxShadow: "0 8px 28px rgba(30,25,20,.12)" } }, h("button", { onClick: preview, className: "flex-1 py-3", style: { borderRadius: 11, border: "1px solid " + t.ink, fontFamily: F_BODY, color: t.ink } }, "先预览 30 秒"), previewing ? h("button", { onClick: cancel, className: "py-3 px-3", style: { color: t.accent, fontFamily: F_BODY } }, "撤销") : null, h("button", { onClick: commit, className: "flex-1 py-3", style: { borderRadius: 11, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "正式应用")));
  }
  g.ThemeStudioConfig = ThemeStudioConfig;
})(window);
