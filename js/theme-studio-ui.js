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
    const esc = v => String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const previewPage = section === "icons" || page === "all" ? "home" : page;
    const iconImg = key => { const ref = draft.icons[key]; return ref ? '<img src="' + esc(resolveImg(ref)) + '" alt="">' : '<span>' + ({ chat:"✉",forum:"☷",games:"◇",diary:"▤",tarot:"✦",study:"⌁",fanfic:"⌘",config:"⚙" }[key] || "○") + '</span>'; };
    const previewBody = (() => {
      if (previewPage === "thread" || previewPage === "gthread") return '<header><b>' + (previewPage === "thread" ? "沈屿白" : "三个人的小群") + '</b><small>刚刚</small></header><main class="chat"><div class="message-bubble them">我刚才想到一件事。</div><div class="message-bubble me">讲给我听听。</div><div class="message-bubble them">等见面再说，文字里会漏掉一半。</div></main><footer>发一条消息……</footer>';
      if (previewPage === "messages") return '<header><b>朋友圈</b><small>Moments</small></header><main><article><b>沈屿白</b><p>傍晚的风把没说完的话吹回来了一点。</p><small>刚刚 · ♡ 3</small></article><article><b>顾暮</b><p>今天勉强算顺利。</p></article></main>';
      if (previewPage === "forum") return '<header><b>论坛</b><small>Forum</small></header><main><article><small>夜间闲聊</small><h3>你们会记住朋友随口说的小事吗？</h3><p>有些话当时没接住，后来却一直记得。</p></article><article><small>3 条回复</small><h3>今天吃到了很好吃的东西</h3></article></main>';
      if (previewPage === "fanfic" || previewPage === "trpg") return '<header><b>' + (previewPage === "trpg" ? "跑团" : "同人文") + '</b><small>Preview</small></header><main><article><h3>第一章 · 风从旧城来</h3><p>门缝里的光慢慢移过地板。谁都没有先开口，远处的钟却响了第二遍。</p><p>他抬眼看你，像是终于等到了答案。</p></article></main>';
      if (previewPage === "games") return '<header><b>小游戏</b><small>Games</small></header><main class="icons"><i>' + iconImg("games") + '<b>UNO</b></i><i><span>♠</span><b>斗地主</b></i><i><span>?</span><b>谁是卧底</b></i></main>';
      if (previewPage === "config") return '<header><b>设置</b><small>Config</small></header><main><article><h3>外观与壁纸</h3><p>颜色、字体和主屏背景　›</p></article><article><h3>主题工作台</h3><p>图标、页面 CSS 与预览　›</p></article></main>';
      return '<header><b>Lisa\'s phone</b><small>今天也在这里</small></header><main class="icons"><i>' + iconImg("chat") + '<b>消息</b></i><i>' + iconImg("forum") + '<b>论坛</b></i><i>' + iconImg("study") + '<b>一起学</b></i><i>' + iconImg("fanfic") + '<b>同人文</b></i><i>' + iconImg("tarot") + '<b>塔罗</b></i><i>' + iconImg("games") + '<b>小游戏</b></i></main>';
    })();
    const previewCSS = (() => { try { return studio.compile(draft).replace(/<\/style/gi,"<\\/style"); } catch (_) { return ""; } })();
    const previewDoc = '<!doctype html><html data-lisa-screen="' + esc(previewPage) + '"><head><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:' + esc(t.bg) + ';color:' + esc(t.ink) + ';font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}body{padding:18px}header{display:flex;align-items:end;justify-content:space-between;padding:4px 2px 16px;border-bottom:1px solid ' + esc(t.line) + '}header b{font-size:24px}small{color:' + esc(t.fog) + ';font-size:10px}main{padding-top:16px}.icons{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 10px}.icons i{display:grid;place-items:center;gap:6px;font-style:normal;font-size:10px}.icons i>span,.icons i>img{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:rgba(255,255,255,.65);box-shadow:0 5px 14px rgba(0,0,0,.08);object-fit:cover;font-size:22px}.icons b{font-weight:500}article{padding:14px;margin-bottom:10px;border:1px solid ' + esc(t.line) + ';border-radius:16px;background:rgba(255,255,255,.42)}article h3{margin:5px 0 9px;font-size:15px}article p{margin:5px 0;line-height:1.65;font-size:12px}.chat{display:flex;flex-direction:column;gap:11px}.message-bubble{max-width:78%;padding:11px 13px;border-radius:17px;background:#fff;font-size:12px;line-height:1.55}.message-bubble.me{align-self:flex-end;background:#f5b9c5}.message-bubble.them{align-self:flex-start;background:#b8d5ee}footer{position:absolute;left:18px;right:18px;bottom:16px;border:1px solid ' + esc(t.line) + ';border-radius:999px;padding:11px 14px;color:' + esc(t.fog) + ';font-size:11px}</style><style>' + previewCSS + '</style></head><body>' + previewBody + '</body></html>';
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
      h("div", { style: { marginTop: 16, padding: 10, borderRadius: 18, border: "1px solid " + t.line, background: t.bg2 } },
        h("div", { className: "flex items-center justify-between", style: { padding: "2px 3px 9px" } }, h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "应用前预览"), h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 3 } }, "草稿实时显示在这里，不会改动正在使用的主题")), h("span", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog } }, studio.PAGES.find(x => x[0] === previewPage)?.[1] || "主屏")),
        h("div", { style: { width: "min(100%,310px)", margin: "0 auto", padding: 7, borderRadius: 27, background: "#201f1d", boxShadow: "0 9px 24px rgba(25,20,16,.18)" } }, h("iframe", { title: "主题样式预览", sandbox: "", srcDoc: previewDoc, style: { display: "block", width: "100%", height: 380, border: 0, borderRadius: 21, background: t.bg } }))),
      h("div", { style: { position: "sticky", bottom: 8, zIndex: 5, display: "flex", gap: 7, marginTop: 18, padding: 8, borderRadius: 16, background: "rgba(248,245,238,.92)", backdropFilter: "blur(18px)", border: "1px solid " + t.line, boxShadow: "0 8px 28px rgba(30,25,20,.12)" } }, h("button", { onClick: preview, className: "flex-1 py-3", style: { borderRadius: 11, border: "1px solid " + t.ink, fontFamily: F_BODY, color: t.ink } }, "先预览 30 秒"), previewing ? h("button", { onClick: cancel, className: "py-3 px-3", style: { color: t.accent, fontFamily: F_BODY } }, "撤销") : null, h("button", { onClick: commit, className: "flex-1 py-3", style: { borderRadius: 11, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "正式应用")));
  }
  g.ThemeStudioConfig = ThemeStudioConfig;
})(window);
