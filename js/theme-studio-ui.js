(function (g) {
  "use strict";
  // 「挑不开文件？把 JSON 贴进来」——手机上挑不开文件时那条永远死不了的路
  // （照表情包「贴上去」那个先例）。主题工作台和聊天气泡那一页共用这一份：
  // 各画一份的话，哪天改了提示语或者加了一道校验，只会改在其中一处。
  function ThemePackPasteBox({ onText, open: openZh, ph }) {
    const t = useTheme();
    const [pasting, setPasting] = useState(false), [text, setText] = useState("");
    if (!pasting) return h("button", { onClick: () => setPasting(true), className: "w-full py-2.5 active:opacity-70",
      style: { minHeight: 40, borderRadius: 12, border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 11.5 } },
      openZh || "挑不开文件？把主题包 JSON 贴进来");
    return h("div", null,
      h("textarea", { value: text, onChange: e => setText(e.target.value), placeholder: ph || "把导出的那份 .json 整个贴在这儿", rows: 5, className: "w-full outline-none",
        style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 11px" } }),
      h("div", { className: "flex gap-2", style: { marginTop: 8 } },
        h("button", { onClick: async () => { if (!text.trim()) return; if (await onText(text)) { setText(""); setPasting(false); } },
          className: "flex-1 py-2.5 active:opacity-70", style: { minHeight: 40, borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, "贴上去"),
        h("button", { onClick: () => { setPasting(false); setText(""); }, className: "px-4 py-2.5 active:opacity-60",
          style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "取消")));
  }
  g.ThemePackPasteBox = ThemePackPasteBox;
  // 预览台跳出去再回来时，落回她刚才那一栏、那一页（v65.00）。
  // ⚠️不进存档：它只是「上一秒在哪儿」，关掉 app 就该忘掉。
  let lastSpot = null;
  function ThemeStudioConfig({ toast, theme, wallpaper, onSaveTheme, onSaveWallpaper }) {
    const t = useTheme(), studio = g.ThemeStudio;
    // ⚠️正在预览时读【屏幕上生效的那份】，不是存档里那份：预览台会带她跳到真页面上
    //   看一眼，工作台是重新挂载的——照旧 load() 的话，她刚写的 CSS 当场没了（v65.00）。
    const [draft, setDraft] = useState(() => (studio.isPreviewing() && studio.current) ? studio.current() : studio.load());
    const [pendingBase, setPendingBase] = useState(null), [pendingWallpaper, setPendingWallpaper] = useState(undefined);
    // 导进来的那一包先摊在这儿，勾了哪几样才合进草稿（她 2026-09-20：不是全有全无）
    const [incoming, setIncoming] = useState(null), [pendingBubble, setPendingBubble] = useState(null);
    const [pick, setPick] = useState(() => studio.cleanPick(null));
    // 导出也要能只挑一样（她 2026-09-22：「没有单独导入导出某一种美化的选项，
    // 比如只导入 app 图标 或者只导入背景」）。默认整套，取消勾的那几样不进包。
    const [xPick, setXPick] = useState(() => studio.cleanPick(null));
    const [section, setSection] = useState(() => (lastSpot && lastSpot.section) || "icons"), [page, setPage] = useState(() => (lastSpot && lastSpot.page) || "home"), [previewing, setPreviewing] = useState(() => studio.isPreviewing());
    useEffect(() => { lastSpot = null; }, []);
    const iconFile = useRef(null), iconFiles = useRef(null), cssImageFile = useRef(null), cssEditor = useRef(null), importFile = useRef(null), previewTimer = useRef(0), [pickKey, setPickKey] = useState("cast");
    // ⚠️卸载时【不许】撤销预览（v61.05，她 2026-09-03：「预览 30 秒也没用，退出界面就没了」）：
    //   「先预览 30 秒」的用处本来就是【退出这一页、到处走走看看】。原来这儿一卸载就
    //   cancelPreview()，等于按下去只在这一屏有效，一走就没——这个按钮的意义整个没了。
    //   30 秒到点自动撤销由 ThemeStudio.preview 自己那个计时器负责（它不随界面走），
    //   这儿只清掉本地那个「按钮还亮着」的计时器。
    useEffect(() => () => { clearTimeout(previewTimer.current); }, []);
    const patchDraft = p => setDraft(d => studio.normalize({ ...d, ...p }));
    const preview = () => { try { studio.preview(draft); clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewing(false), 30050); setPreviewing(true); toast("已临时预览；30 秒后自动撤销"); } catch (e) { toast("不能预览：" + e.message); } };
    const commit = () => { try { clearTimeout(previewTimer.current); setDraft(studio.commit(draft)); if (pendingBase && onSaveTheme) onSaveTheme(pendingBase); if (typeof pendingWallpaper === "string" && onSaveWallpaper) onSaveWallpaper(pendingWallpaper); if (pendingBubble && typeof writeBubbleSkin === "function") writeBubbleSkin(pendingBubble); setPendingBase(null); setPendingWallpaper(undefined); setPendingBubble(null); setIncoming(null); setPreviewing(false); toast("主题已正式应用"); } catch (e) { toast("不能应用：" + e.message); } };
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
      if (!studio.PACK_KEYS.some(k => xPick[k])) { toast("至少挑一样再导出"); return; }
      try { const text = await studio.exportPackage({ profile: draft, baseTheme: theme, wallpaper,
          bubbleSkin: typeof bubbleSkinSnapshot === "function" ? bubbleSkinSnapshot() : null, pick: xPick });
        const via = await window.saveTextFile("lisa-theme-" + new Date().toISOString().slice(0,10) + ".json", text, "application/json");
        toast(via === "cancel" ? "导出取消了" : via === "share" ? "主题包已交给分享面板（含真实图标素材），在里面选「存储到文件」" : "主题包已导出（含真实图标素材）"); }
      catch (e) { toast("导出失败：" + e.message); }
    };
    // 装包那一份文本 → 预览。文件选一份、或者直接贴一份，两条路都走这里
    // （她 2026-09-20：「导入主题包是死的按钮按不动」——手机上挑不开文件的时候，
    //   贴一份 JSON 是那条永远死不了的路）。
    // 勾了哪几样，就把那几样从包里合到【她现在这份】上——没勾的原样留着。
    // ⚠️一定是合到当前那份上，不是拿包整个顶掉：她自己调了半天的别处不该被一份包抹平。
    const mergePick = (pack, sel) => {
      const cur = studio.normalize(studio.load()), inc = pack.profile;
      return Object.assign({}, cur, {
        name: inc.name || cur.name,
        globalCSS: sel.css ? inc.globalCSS : cur.globalCSS,
        pageCSS: sel.css ? inc.pageCSS : cur.pageCSS,
        pageTokens: sel.css ? inc.pageTokens : cur.pageTokens,
        // 每页的大小跟着「页面/全局 CSS」那一格走：它跟配色、CSS 一样是「这一页长什么样」
        pageZoom: sel.css ? inc.pageZoom : cur.pageZoom,
        icons: sel.icons ? inc.icons : cur.icons,
        iconPack: sel.icons ? inc.iconPack : cur.iconPack,
        iconBare: sel.icons ? inc.iconBare : cur.iconBare,
        fonts: sel.fonts ? inc.fonts : cur.fonts,
        customFonts: sel.fonts ? inc.customFonts : cur.customFonts
      });
    };
    const livePick = (pack, sel) => {
      const next = mergePick(pack, sel);
      setDraft(next);
      setPendingBase(sel.base ? (pack.baseTheme || null) : null);
      setPendingWallpaper(sel.wall && typeof pack.wallpaper === "string" ? pack.wallpaper : undefined);
      setPendingBubble(sel.bubble ? (pack.bubbleSkin || null) : null);
      try { studio.preview(next); clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewing(false), 30050); setPreviewing(true); } catch (_) {}
    };
    const applyPack = async text => {
      try {
        const pack = await studio.importPackage(text);
        // ⚠️只勾这份包【真的带了】的那几样。全勾是错的：单挑一样导出的包
        //   （只有图标的那种）里，CSS 那一格是空的，勾着它就把她现在的 CSS 抹平了。
        const sel = {}; studio.packParts(pack).forEach(x => { sel[x.key] = x.has; });
        setIncoming(pack); setPick(sel); livePick(pack, sel);
        toast("已导入并临时预览；下面可以挑要哪几样，确认后才落盘");
        return true;
      } catch (err) { toast("导入失败：" + (err.message || err)); return false; }
    };
    const togglePick = k => { const sel = Object.assign({}, pick, { [k]: !pick[k] }); setPick(sel); if (incoming) livePick(incoming, sel); };
    // 「挑哪几样」那一排：导出和导入共用这一份（方块、禁用态、「这份包里没有」都只画在这儿）。
    // parts 来自 studio.packParts()，名字和有没有都是它说了算。
    const partRows = (parts, sel, onToggle, missZh) => parts.map(x =>
      h("button", { key: x.key, onClick: () => x.has && onToggle(x.key), disabled: !x.has,
        className: "w-full flex items-center active:opacity-70 disabled:opacity-40",
        style: { gap: 9, minHeight: 40, textAlign: "left" } },
        h("span", { style: { flexShrink: 0, width: 17, height: 17, borderRadius: 5, border: "1px solid " + (x.has && sel[x.key] ? t.ink : t.line), background: x.has && sel[x.key] ? t.ink : "transparent", color: t.bg2, fontSize: 11, lineHeight: "16px", textAlign: "center" } }, x.has && sel[x.key] ? "✓" : ""),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: x.has ? t.ink : t.fog } }, x.zh + (x.has ? "" : missZh))));
    const importTheme = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      let text = "";
      try { text = await f.text(); } catch (err) { toast("这份文件读不出来：" + (err.message || err)); return; }
      await applyPack(text);
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
    // ── 字体（v71.03，她 2026-09-18 转小红书里读者问「怎么换字体」）──────────
    // 全 App 的字体只有正文和标题两支，都在 core.js 里写成了 CSS 变量，
    // 所以这一栏改的就是那两个变量本身——没有一处界面代码认识「字体」这件事。
    // ⚠️名单问 FontChoice 要，这儿不另抄（one-public-mechanism）。
    // 画法：每一支【用它自己的字写自己的名字】，一张字样卡。
    // 不是一排药丸——药丸搬到哪个 app 都成立，一张写着自己名字的字样卡只有这一处成立。
    const FC = g.FontChoice;
    const customFonts = draft.customFonts || [];
    const faces = FC ? FC.facesWith(customFonts) : [];
    // 进这一栏就把名单里的字体全拉下来，否则字样卡上全是同一支字、等于没得看。
    // 她自己传的那几支也要：文件那一路得先有 @font-face 才画得出字样。
    useEffect(() => {
      if (section !== "fonts" || !FC) return;
      try { faces.forEach(f => FC.ensure({ body: f.key }, customFonts)); } catch (_) {}
      try {
        let st = document.getElementById("lisa-font-specimen");
        if (!st) { st = document.createElement("style"); st.id = "lisa-font-specimen"; document.head.appendChild(st); }
        st.textContent = FC.faceBlocks(customFonts, g.resolveImg);
      } catch (_) {}
    }, [section, JSON.stringify(customFonts)]);
    // 她 2026-09-18：「能不能搞一个可以上传自定义字体的，不知道一般这是啥格式？」
    // 两条路都给：文件进保险箱（断网也在，但中文字体动辄十几兆），链接不占地方（但断网就没有）。
    const fontFile = useRef(null);
    const newId = () => Math.random().toString(36).slice(2, 10);
    const putCustom = e => patchDraft({ customFonts: [...customFonts, e].slice(0, (FC && FC.CUSTOM_MAX) || 8) });
    const chooseFontFile = async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (!f) return;
      const ext = ((String(f.name).match(/\.[^.]+$/) || [""])[0] || "").toLowerCase();
      if (((FC && FC.FILE_EXT) || []).indexOf(ext) < 0) { toast("只认 woff2 / woff / ttf / otf 这四种"); return; }
      if (f.size > 30 * 1024 * 1024) { toast("这份有 " + Math.round(f.size / 1048576) + "M，太大了；找个 woff2 的版本"); return; }
      try {
        const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
        const ref = await imgToVault(dataUrl);
        if (String(ref).indexOf("iv_") !== 0) { toast("存不进保险箱，没加上"); return; }
        const name = String(f.name).replace(/\.[^.]+$/, "");
        putCustom({ id: newId(), kind: "file", name, ref });
        toast("加好了：" + name + "，在下面挑它");
      } catch (err) { toast("读不出来：" + (err.message || err)); }
    };
    const addFontLink = () => {
      requestAppPrompt("贴一条字体链接", "要的是一条 https 开头的 CSS 链接（Google Fonts、中文网字计划那种「引入代码」里的那条）。", "", href => {
        href = String(href || "").trim();
        if (!/^https:\/\//.test(href)) { toast("得是 https:// 开头的链接"); return; }
        requestAppPrompt("这支字叫什么", "填 CSS 里 font-family 写的那个名字，一个字都不能差（大小写也算）。", "", fam => {
          const family = FC ? FC.safeFamily(fam) : String(fam || "").trim();
          if (!family) { toast("没填名字，没加上"); return; }
          putCustom({ id: newId(), kind: "link", name: family, family, href });
          toast("加好了：" + family + "，在下面挑它");
        }, "加上去", { maxLength: 40 });
      }, "下一步", { maxLength: 400 });
    };
    // 删一支：挑中的正好是它的话，那一头要跟着落回默认（不然变量指着一个没有的字族）
    const dropCustom = c => {
      const key = "u:" + c.id, fonts = { ...(draft.fonts || {}) };
      if (fonts.body === key) fonts.body = "";
      if (fonts.display === key) fonts.display = "";
      patchDraft({ customFonts: customFonts.filter(x => x.id !== c.id), fonts });
      toast("删掉了：" + c.name);
    };
    const fontCard = (kind, f) => {
      const on = String((draft.fonts || {})[kind] || "") === f.key;
      return h("button", { key: f.key || "_default", onClick: () => patchDraft({ fonts: { ...(draft.fonts || {}), [kind]: f.key } }),
        className: "active:opacity-70", "aria-pressed": on ? "true" : "false",
        style: { textAlign: "left", padding: "11px 12px", borderRadius: 10,
          border: "1px solid " + (on ? t.ink : t.line),
          background: on ? t.bg2 : "rgba(127,127,127,.05)",
          boxShadow: on ? "0 5px 14px -9px rgba(0,0,0,.6)" : "none" } },
        h("div", { style: { fontFamily: f.stack || (kind === "display" ? "'Fraunces',serif" : "'Archivo','Noto Serif SC',system-ui,sans-serif"), fontSize: 19, color: t.ink, lineHeight: 1.35 } }, f.zh),
        h("div", { style: { fontFamily: f.stack || "'Archivo','Noto Serif SC',system-ui,sans-serif", fontSize: 11.5, color: t.sub, marginTop: 5, lineHeight: 1.5 } }, "今天也想你 · 0123"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 5 } }, f.hint));
    };
    const [slots, setSlots] = useState(() => studio.pageSlots(page));
    useEffect(() => { setSlots(studio.pageSlots(page)); }, [page]);
    const css = page === "all" ? draft.globalCSS || "" : (draft.pageCSS[page] || "");
    const setCSS = v => page === "all" ? patchDraft({ globalCSS: v }) : patchDraft({ pageCSS: { ...draft.pageCSS, [page]: v } });
    const chooseCssImage = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const ref = await imgToVault(await resizeImageFile(f, 1600, .92));
        const token = 'url("' + ref + '")', el = cssEditor.current;
        const a = el && Number.isFinite(el.selectionStart) ? el.selectionStart : css.length;
        const b = el && Number.isFinite(el.selectionEnd) ? el.selectionEnd : a;
        setCSS(css.slice(0, a) + token + css.slice(b));
        requestAnimationFrame(() => { if (cssEditor.current) { cssEditor.current.focus(); cssEditor.current.setSelectionRange(a + token.length, a + token.length); } });
        toast("图片已进保险箱，引用写进编辑框了");
      } catch (err) { toast("图片读取失败：" + (err.message || err)); }
    };
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
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, marginBottom: 14 } }, tab("icons","图标","逐个替换"), tab("fonts","字体","全 App 换"), tab("css","页面 CSS","限定页面"), tab("package","主题包","带图搬家")),
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
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } }, studio.appIconList().map(([key,label]) => { const ref = draft.icons[key], packSrc = studio.packIconSrc(draft.iconPack, key), src = ref ? resolveImg(ref) : packSrc; return h("div", { key, style: { padding: 9, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } }, h("button", { onClick: () => { setPickKey(key); iconFile.current && iconFile.current.click(); }, className: "w-full flex items-center gap-3 active:opacity-70", style: { textAlign: "left" } }, src ? h("img", { src, style: { width: 40, height: 40, borderRadius: 11, objectFit: draft.iconBare ? "contain" : "cover" } }) : h("div", { style: { width: 40, height: 40, borderRadius: 11, background: t.bg, display: "grid", placeItems: "center", color: t.fog } }, "+"), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, label)), ref ? h("button", { onClick: () => clearIcon(key), style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, marginTop: 5 } }, packSrc ? "退回整套里那张" : "恢复原图标") : null); })),
        h("input", { ref: iconFile, type: "file", accept: "image/*", onChange: chooseIcon, style: { display: "none" } }),
        h("input", { ref: iconFiles, type: "file", accept: "image/*", multiple: true, onChange: chooseIcons, style: { display: "none" } })),
      section === "css" && h("div", null,
        h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 10 } },
          h("select", { value: page, onChange: e => setPage(e.target.value), style: { flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY } }, studio.PAGES.map(([k,l]) => h("option", { key: k, value: k }, l))),
          h("button", { onClick: peek, disabled: page === "all", className: "shrink-0 active:opacity-70 disabled:opacity-35",
            style: { minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid " + t.ink, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12.5, whiteSpace: "nowrap" } }, "去这一页看看")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6, color: t.fog, marginTop: -4, marginBottom: 10 } },
          page === "all" ? "「全 App」不是某一页——挑一页再点右边那颗。" : "点右边那颗直接跳到这一页看真的样子，底下会浮一条「回去改」送你回来。"),
        // ── 这一页多大（v72.32，她 2026-09-20：「做拉条选大小」）──────────
        // ⚠️它放大的是整页（字、头像、间距一起按比例变），不是只有字——
        //   原因写在 theme-studio.js 的 cleanZoom 上面：这个 App 的字号全是内联 px，
        //   样式表压不过它；zoom 是唯一能按比例压住内联 px 的那一个。
        // 「全 App」这一档也能调：它是底数，某一页再单独调就盖过它。
        (function () {
          const z = ((draft.pageZoom || {})[page]) || 1;
          const setZ = v => {
            const one = Object.assign({}, draft.pageZoom || {});
            const n = Math.round(Number(v) * 100) / 100;
            if (n === 1) delete one[page]; else one[page] = n;
            patchDraft({ pageZoom: one });
          };
          return h("div", { style: { marginBottom: 14, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", background: t.bg2 } },
            h("div", { className: "flex items-baseline", style: { gap: 8, marginBottom: 6 } },
              h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } },
                page === "all" ? "全 App 多大" : "这一页多大"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: z === 1 ? t.fog : t.ink } }, Math.round(z * 100) + "%"),
              z !== 1 ? h("button", { onClick: () => setZ(1), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, padding: "2px 6px" } }, "还原") : null),
            h("input", {
              type: "range", value: z, min: studio.ZOOM_MIN || 0.8, max: studio.ZOOM_MAX || 1.4, step: 0.05,
              onChange: e => setZ(e.target.value),
              className: "w-full", style: { accentColor: t.ink, height: 28 }
            }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.7, marginTop: 4 } },
              "整页一起按比例放大：字、头像、间距都跟着走，版面不会乱。"
              + (page === "all" ? "这是底数，某一页再单独调就盖过它。" : "没调过的页面跟着「全 App」那一档。")
              + "点下面「先预览 30 秒」看真的样子。"));
        })(),
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
                  // 色圈全 App 只有 components.js 的 ColorDot 那一颗（施工规则/one-public-mechanism.md）
                  h(ColorDot, { value: val, onChange: v => put(k, v), label: tk[1], size: 24 }),
                  h("span", { style: { minWidth: 0, flex: 1 } },
                    h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: t.ink } }, tk[1]),
                    h("span", { style: { display: "block", fontFamily: "monospace", fontSize: 9.5, color: t.fog } }, on ? val : "跟随全局")),
                  on ? h("button", { onClick: e => { e.preventDefault(); put(k, ""); }, className: "shrink-0 active:opacity-70",
                    style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "还原") : null);
              })));
        })(),
        h("textarea", { ref: cssEditor, value: css, onChange: e => setCSS(e.target.value), placeholder: ".message-bubble {\n  border-radius: 18px;\n}", style: { width: "100%", minHeight: 230, resize: "vertical", padding: 12, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.65 } }),
        h("div", { className: "flex items-center justify-between", style: { gap: 10, marginTop: 8 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.55, color: t.fog } }, "光标放到 background-image 后面，再选一张图；这里只存保险箱门牌，导出主题包会把原图一起带走。"),
          h("button", { onClick: () => cssImageFile.current && cssImageFile.current.click(), className: "shrink-0 active:opacity-70", style: { minHeight: 40, padding: "7px 11px", borderRadius: 10, border: "1px solid " + t.ink, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 11.5 } }, "插入图库图片"),
          h("input", { ref: cssImageFile, type: "file", accept: "image/*", onChange: chooseCssImage, style: { display: "none" } })),
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
          // ⚠️她 2026-09-11：「现在只能 5 套，改成可以自定义再加吧，然后可以 ❌ 删除」。
          //   所以这儿不再摆五个固定格子（空格也占着位置），而是【存了几套就摆几个】，
          //   末尾永远跟着一颗「＋ 存成新的一套」。
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } },
            "你自己存的（点一下读回编辑框，× 删掉）：" + (slots.length ? slots.length + " 套" : "还没存过")),
          h("div", { className: "flex flex-wrap", style: { gap: 7 } },
            slots.map((sl, i) => h("div", { key: i, className: "flex items-center", style: { gap: 4, minHeight: 40, padding: "6px 8px 6px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2 } },
              h("button", { onClick: () => { setCSS(sl.css); toast("读出「" + sl.name + "」"); },
                className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, sl.name),
              h("button", {
                onClick: () => requestAppConfirm("删掉「" + sl.name + "」？", "这一套 CSS 就没了；正用着的主题不受影响。",
                  () => { setSlots(studio.clearSlot(page, i)); toast("删掉了"); }, "删掉"),
                "aria-label": "删掉这一套", className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "0 3px" } }, "×"))).concat([
            h("button", { key: "add", onClick: () => {
                const cur = page === "all" ? (draft.globalCSS || "") : (draft.pageCSS[page] || "");
                if (!cur.trim()) { toast("编辑框还是空的，先写点东西再存"); return; }
                if (slots.length >= studio.SLOT_MAX) { toast("这一页已经存了 " + studio.SLOT_MAX + " 套，先删掉几套"); return; }
                // ⚠️不许用 window.prompt：PWA 里它会被系统吞掉，而且【不抛异常、直接返回 null】
                //   （她 2026-09-06：「可以放 5 套预设那个按钮也是摆设」）。
                requestAppPrompt("给这一套起个名字", "存成新的一套；同名不会互相盖。", "预设 " + (slots.length + 1),
                  function (nm) {
                    nm = String(nm || "").trim().slice(0, 12);
                    if (!nm) { toast("没起名字，没存"); return; }
                    setSlots(studio.addSlot(page, nm, cur)); toast("存好了：" + nm);
                  }, "存进去", { maxLength: 12 });
              }, className: "active:opacity-70",
              style: { minHeight: 40, padding: "6px 13px", borderRadius: 10, border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 12.5 } }, "＋ 存成新的一套")])))),
      section === "fonts" && h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.75, marginBottom: 12 } },
          "换的是整个 App 的字，聊天、日记、查手机全都跟着变。挑完先预览看看，再点正式应用。"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 7 } }, "正文"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 18 } },
          faces.map(f => fontCard("body", f))),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 7 } }, "标题"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, marginBottom: 7 } }, "页眉、栏目名、按钮上那些大一号的字。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 12 } },
          faces.map(f => fontCard("display", f))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7, marginBottom: 18 } },
          "写着「自带」的那几支用手机里本来就有的字，断网也在；其余几支第一次用要联网下载一下。"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 7 } }, "自己加的字"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.75, marginBottom: 9 } },
          "传文件：woff2 / woff / ttf / otf 都行，woff2 最小，中文字体优先找它。传进来就存在这台机器上，断网也在，导出主题包会一起打包。",
          h("br"), "贴链接：中文网字计划、Google Fonts 那种「引入代码」里的 CSS 链接。不占地方、按用到的字下载所以快，但断网就没有。"),
        h("div", { className: "flex gap-2", style: { marginBottom: 10 } },
          h("button", { onClick: () => fontFile.current && fontFile.current.click(), className: "flex-1 py-3",
            style: { borderRadius: 11, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12.5 } }, "传字体文件"),
          h("button", { onClick: addFontLink, className: "flex-1 py-3",
            style: { borderRadius: 11, border: "1px dashed " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, "贴一条链接")),
        h("input", { ref: fontFile, type: "file", accept: ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf", onChange: chooseFontFile, style: { display: "none" } }),
        customFonts.length
          ? h("div", { style: { display: "grid", gap: 6, marginBottom: 10 } },
              customFonts.map(c => h("div", { key: c.id, className: "flex items-center",
                style: { gap: 8, padding: "8px 10px", borderRadius: 9, border: "1px solid " + t.line } },
                h("div", { className: "flex-1 min-w-0" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, c.kind === "file" ? "文件 · 存在这台机器上" : "链接 · 要联网")),
                h("button", { onClick: () => dropCustom(c), className: "active:opacity-70", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.fog, padding: "4px 8px" } }, "删掉"))))
          : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.7 } },
          "最多 " + ((FC && FC.CUSTOM_MAX) || 8) + " 支。加完的字会出现在上面那两栏里，跟内置的一起挑。",
          h("br"), "⚠️字体是有版权的东西，商用字体别往外发主题包。")),
      section === "package" && h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.75, marginBottom: 12 } }, "导出会把真实图标图片一起装包。导入只进入预览，不会静默覆盖现用主题。"),
        // 只导出一样（她 2026-09-22：「比如只导入 app 图标 或者只导入背景」）。
        // 跟导入那头共用同一份名单和同一排方块——这儿是【发】，那儿是【收】。
        h("div", { style: { marginBottom: 12, padding: "11px 12px", borderRadius: 12, border: "1px dashed " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, marginBottom: 8 } }, "这次导出带上哪几样："),
          partRows(studio.packParts({ profile: draft, baseTheme: theme, wallpaper: wallpaper,
            bubbleSkin: typeof bubbleSkinSnapshot === "function" ? bubbleSkinSnapshot() : null }),
            xPick, k => setXPick(p => Object.assign({}, p, { [k]: !p[k] })), "（你还没弄过）")),
        h("div", { className: "flex gap-2" },
          h("button", { onClick: exportTheme, className: "flex-1 py-3", style: { borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY } }, "导出主题包"),
          // ⚠️这一颗以前是 `importFile.current.click()`——没有那一道 `&&`。
          //   ref 还没挂上的那一下点下去就是抛在事件回调里的 TypeError：
          //   页面不报错、什么也不发生，看上去就是「死的按钮」（她 2026-09-20 报的就是这个）。
          //   全库别处的文件口子（图标、字体、页面 CSS、备份恢复）都写着那一道 &&，只有这一颗漏了。
          // ⚠️accept 的写法也跟着别处统一成 MIME 在前：iOS 上第一个 token 是它认不出的扩展名时，
          //   文件选择器可能整个弹不出来。备份恢复那一处（能用的那一处）就是 MIME 在前。
          h("button", { onClick: () => importFile.current && importFile.current.click(), className: "flex-1 py-3", style: { borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "导入主题包")),
        h("input", { ref: importFile, type: "file", accept: "application/json,.json", className: "hidden", onChange: importTheme }),
        // 导进来之后：这包里带了什么、要哪几样（她 2026-09-20：「不是全有全无」）。
        // 勾一下就立刻改预览，所以她是【看着】挑的，不是盲选完再按确认。
        incoming ? h("div", { style: { marginTop: 12, padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, marginBottom: 8 } },
            "这份包里带了这些，勾掉的不会动你现在的："),
          partRows(studio.packParts(incoming), pick, togglePick, "（这份包里没有）"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.7, marginTop: 6 } },
            "现在看到的是预览。点下面「正式应用」才真的落盘；基础配色、壁纸、气泡也一样。")) : null,
        // 贴一份：手机上挑不开文件的时候，这条路永远死不了（照表情包「贴上去」那个先例）
        h("div", { style: { marginTop: 12 } }, h(ThemePackPasteBox, { onText: applyPack }))),
      h("div", { style: { position: "sticky", bottom: 8, zIndex: 5, display: "flex", gap: 7, marginTop: 18, padding: 8, borderRadius: 16, background: "rgba(248,245,238,.92)", backdropFilter: "blur(18px)", border: "1px solid " + t.line, boxShadow: "0 8px 28px rgba(30,25,20,.12)" } }, h("button", { onClick: preview, className: "flex-1 py-3", style: { borderRadius: 11, border: "1px solid " + t.ink, fontFamily: F_BODY, color: t.ink } }, "先预览 30 秒"), previewing ? h("button", { onClick: cancel, className: "py-3 px-3", style: { color: t.accent, fontFamily: F_BODY } }, "撤销") : null, h("button", { onClick: commit, className: "flex-1 py-3", style: { borderRadius: 11, background: t.ink, color: t.bg2, fontFamily: F_BODY } }, "正式应用")));
  }
  g.ThemeStudioConfig = ThemeStudioConfig;
})(window);
