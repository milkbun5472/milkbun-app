// ============================================================
// 同人文（fanfic）—— Phase 1
// feed / 批量生成 / 追更 / 书评 + RP(穿进同人文) 最小 stub。
// 数据走 localStorage（x_fanfic_tabs / x_fanfic_fics / x_fanfic_cps），
//   全部 x_ 前缀，自动跟随现有 saves 整包云同步。
// 生成管线：system(反八股 + 角色卡准则 + 亲密反模板 + 同人文反陈词滥调)
//   + 选中 CP 角色卡 + 当前 tab 世界观(world book) + 生成指令，
//   一次批量出 N 篇；共用 parseJSONLoose 容错，业务保留自动重试（不动全局 callAI）。
// ============================================================
(function () {
  // 数据、提示词、作者名片这一半住在 js/fanfic-core.js（开机加载，window.Fanfic 也在那儿），这儿只取不另写
  const { useState, FANFIC_ANTI_CLICHE, STYLE_FIDELITY_TAIL, FANFIC_ORGANIC_FORM, loadRead, markRead, K_SHARED_STYLES, FIC_TOKEN_MAX, FIC_PAPERS, FIC_PAPER_DEFAULT, ficPaper, PaperSwatch, ficPaperFor, ficPaperTheme, MIN_CHARS_MAX, minCharsFor, clampPerFic, loadCfg, saveCfg, labStylePresets, allStylePresets, styleTextForIds, activeStyleText, STYLE_LAB_AXES, STYLE_LAB_RECIPE, buildStyleLabPrompt, loadMe, saveMe, meProfile, loadAuthors, authorName, findAuthor, loadTabs, saveTabs, loadFics, saveFics, loadCPs, saveCPs, uid, exportFanficAudit, protectedFic, chatMaterialFor, stanceFor, loadCircle, circleFeud, rpAuthorName, ficHeat, ficHash, ficPenName, ficWords, cpLabel, ficMeProfile, cpChars, ficPenId, cnIndex, useEffect, setFicMe } = window.FanficCore;


  // ============================================================
  // UI
  // ============================================================
  function fmtNum(n) { return n >= 10000 ? (n / 10000).toFixed(1) + "w" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  // ---- AO3 那套标签分色（她 2026-08-29：「可以参考 ao3 的页面」）----------
  // AO3 最认得出的三样：左边的分级色条、成堆的分色标签、底下那行统计数字。
  // 标签按【它在提醒你什么】分色，不是随便配色：
  //   预警＝要不要做好心理准备 · 糖＝放心看 · 结构＝这篇是什么写法 · 其余中性
  const FIC_TAG_KINDS = [
    [/BE|be预警|虐|刀|慎入|预警|黑化|病娇|死亡|失忆|悲|致郁/i, "warn"],
    [/HE|he|甜|糖|治愈|日常|温馨|轻松|沙雕|团圆/i, "sweet"],
    [/IF线|AU|au|穿越|穿书|重生|架空|书信体|第一人称|群像|年下|年上|先婚|abo|ABO|无限流/i, "form"]
  ];
  function ficTagKind(tag) {
    const s = String(tag || "");
    for (const [re, k] of FIC_TAG_KINDS) if (re.test(s)) return k;
    return "plain";
  }
  // 深卡上那三档要提亮：#a4342c 这种压在 t.ink 底上几乎读不出来
  function ficTagStyle(kind, t, onDark) {
    const c = onDark
      ? { warn: "#e8907e", sweet: "#a8c47e", form: "#93b4d6" }
      : { warn: "#a4342c", sweet: "#5d7a3f", form: "#4a6484" };
    const wrap = function (hex, a1, a2) { return { color: hex, background: hexA(hex, onDark ? .14 : a1), border: "1px solid " + hexA(hex, onDark ? .34 : a2) }; };
    if (kind === "warn") return wrap(c.warn, .09, .22);
    if (kind === "sweet") return wrap(c.sweet, .10, .24);
    if (kind === "form") return wrap(c.form, .09, .22);
    return { color: onDark ? "rgba(255,255,255,.5)" : t.fog, background: "transparent", border: "1px solid " + (onDark ? "rgba(255,255,255,.2)" : t.line) };
  }
  function hexA(hex, a) { return "rgba(" + skinRGB(hex).join(",") + "," + a + ")"; }
  // CP 里有没有「我」——这是这个 app 和 AO3 不一样的地方：
  // 书架上有一半的文是写你们俩的，那一半该一眼看得出来。
  function ficHasMe(f) { return ((f && f.cp) || []).indexOf("me") >= 0; }
  // CP 下拉里的选项：真人角色在前，配角归到「配角」一组并标上是谁身边的人。
  // 不分组的话一长串名字里认不出哪个是配角、属于谁。
  // 那两个下拉的样子只写在这一处（她 2026-09-11：「选 cp 那两条太长了超出屏幕了」）。
  // ⚠️病根是 select 的固有宽度按【最长的那个选项】算——「老板娘（阿凛身边）」这种一进去，
  //   两个下拉加起来就比屏幕宽。flex:1 挡不住它：flex 元素的 min-width 默认是 auto，
  //   不许它缩到内容以下。**minWidth:0 才是那道闸。**
  // ⚠️同一行下拉库里有三处（生成弹窗、加笔那一页、磕 CP 管理），
  //   所以样式收在这儿——各写各的，就是改一处漏两处。
  function cpSelectStyle(t, radius, bg) {
    return { flex: 1, minWidth: 0, maxWidth: "100%", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
      padding: "7px 10px", borderRadius: radius || 10, background: bg || t.bg2, color: t.ink, border: "1px solid " + t.line };
  }
  function cpOptions(characters, userName) {
    const all = characters || [];
    const live = all.filter(function (c) { return c && !c.npc; });
    const npcs = all.filter(function (c) { return c && c.npc; });
    const one = function (c, suffix) { return h("option", { key: c.id, value: c.id, "data-wk": "ficpaperswatchone" }, c.name + (suffix || "")); };
    const out = [h("option", { key: "_orig", value: "" }, "原创角色"),
      h("option", { key: "_me", value: "me" }, "我（" + (userName || "我") + "）")];
    live.forEach(function (c) { out.push(one(c)); });
    if (npcs.length) {
      out.push(h("optgroup", { key: "_npc", label: "配角" }, npcs.map(function (c) {
        const owner = live.find(function (x) { return String(x.id) === String(c.ownerId); });
        return one(c, owner ? "（" + owner.name + "身边）" : "");
      })));
    }
    return out;
  }
  // ── 几个人一起写（她 2026-09-11：「除了 cp 还可以写群像，有好几个人同时写进来」）──
  // ⚠️这不是「再来一个 CP 选择器」：**点的先后就是顺序**——两个人时那个顺序就是左右位，
  //   三个人以上是群像，左右位一个字都不发。所以行上要把顺序显出来，
  //   不然她点完了也不知道自己点出的是「女左男右」还是反过来。
  // ⚠️形状照名册那一页的署名行来（墨点 + 名字），不是一排勾选框：
  //   这个 app 里「挑人」已经有长相了，再发明一种就是两处各长各的。
  const CAST_MAX = 6;
  const GROUP_WAYS = ["友情向", "亲情向", "修罗场", "无 CP"];
  function CastPicker(props) {
    const t = props.t, cast = props.value || [];
    const all = props.characters || [];
    const list = [{ id: "me", name: (props.userName || "我") + "（我）" }]
      .concat(all.filter(function (c) { return c && !c.npc; }))
      .concat(all.filter(function (c) { return c && c.npc; }).map(function (c) { return { id: c.id, name: c.name, npc: true }; }));
    return h("div", { "data-wk": "ficcastpicker" }, list.map(function (c) {
      const at = cast.indexOf(c.id), on = at >= 0;
      const mark = cast.length === 2 ? (at === 0 ? "左位" : "右位") : String(at + 1);
      return h("button", { key: c.id, className: "w-full text-left active:opacity-70",
        onClick: function () { props.onChange(on ? cast.filter(function (x) { return x !== c.id; }) : (cast.length >= CAST_MAX ? cast : cast.concat([c.id]))); },
        style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficcastpicker", "data-part": "r2", "data-on": on ? "1" : "0" },
        h("span", { style: { width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          c.name + (c.npc ? "（配角）" : "")),
        on ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, mark) : null);
    }));
  }
  // 那一向挂成一枚标签：这是同人站，选「向」本来就是给这篇文挂 tag
  //   （不是一排药丸——选中那枚上墨、带一个钩，形状和没选的不一样）
  function WayTag(props) {
    const t = props.t, on = props.on;
    const st = ficTagStyle(ficTagKind(props.tag), t, false);
    return h("button", { onClick: props.onClick, className: "active:opacity-70",
      style: { minHeight: 40, padding: "0 13px", display: "flex", alignItems: "center", gap: 5,
        fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 3,
        color: on ? (t.bg2 || t.bg) : st.color, background: on ? st.color : st.background,
        border: on ? "1px solid " + st.color : st.border, fontWeight: on ? 600 : 400 }, "data-wk": "ficwaytag", "data-on": on ? "1" : "0" },
      on ? h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))" } }, "✓") : null, props.tag);
  }
  // 这一篇里谁一次都没露面。⚠️规则只降概率，这一道是【看得见】：
  //   两位主角的文，其中一位的名字在两三千字里出现 0 次，那基本就是被顶掉了
  //   （她 2026-09-11：「皇帝是一点没出场」）。
  // ⚠️不另存一栏：现算。存了之后续写、改文，那个数就对不回来了。
  function absentLeads(fic, characters, userName) {
    const cp = (fic && Array.isArray(fic.cp)) ? fic.cp : [];
    if (cp.length < 2) return [];
    const body = ((fic.chapters || []).map(function (c) { return (c && c.content) || ""; }).join("\n") || fic.body || "");
    if (String(body).length < 200) return [];          // 还没正文，别乱报
    return cpChars(cp, characters || [], null)
      .map(function (c) { return c && (c.isMe ? (userName || "我") : c.name); })
      .filter(function (nm) { return nm && String(body).indexOf(nm) < 0; });
  }

  // ---------- feed 卡片（AO3 那套信息架构）----------
  // 她 2026-08-29：「参考 ao3 的页面再加点我们之间的设计」。
  // AO3 的作品卡最认得出的是三样：左边一道分级色条、成堆的分色标签、
  // 底下那行 Words · Chapters · Kudos。原先这张卡里标题/CP/作者/摘要/标签
  // 一律差不多大小，一眼扫过去分不出主次。
  // 「我们之间的设计」＝那道色条标的不是分级，是【这篇里有没有我】。
  // 同人图：图在图库（img_fic_ 开头），读出来挂上；点一下放大，放大页能存到手机
  function FicImg(props) {
    const [u, setU] = useState("");
    useEffect(function () {
      let alive = true, obj = null;
      if (props.k && typeof idbImgGet === "function") idbImgGet(props.k).then(function (b) { if (alive && b && b.size) { obj = URL.createObjectURL(b); setU(obj); } }).catch(function () {});
      return function () { alive = false; if (obj) URL.revokeObjectURL(obj); };
    }, [props.k]);
    if (!u) return null;
    return h("img", { src: u, alt: "", onClick: props.onClick ? function (e) { e.stopPropagation(); props.onClick(props.k); } : undefined,
      style: Object.assign({ display: "block", width: "100%" }, props.style || {}) });
  }
  function FicArtView(props) {
    if (!props.k) return null;
    const save = async function (e) {
      e.stopPropagation();
      try {
        const b = await idbImgGet(props.k);
        const via = await saveFile(new File([b], "fanfic-" + Date.now() + ".png", { type: b.type || "image/png" }));
        props.toast && props.toast(via === "cancel" ? "取消了，没存" : via === "share" ? "在分享面板里选「存储图像」" : "已经存下来了");
      } catch (er) { props.toast && props.toast("没存成，再试一次"); }
    };
    return h("div", { "data-wk": "ficartpage", "data-part": "ficartview", onClick: props.onClose, className: "fixed inset-0 z-50 flex flex-col items-center justify-center", style: { background: "rgba(0,0,0,.88)", gap: 14, padding: 16 } },
      h(FicImg, { k: props.k, style: { maxWidth: "94%", maxHeight: "74vh", width: "auto", borderRadius: 6 } }),
      h("button", { onClick: save, className: "active:opacity-70", style: { padding: "11px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.45)", background: "rgba(255,255,255,.14)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "保存这张"));
  }
  function FicTag(props) {
    const t = useTheme();
    const st = ficTagStyle(ficTagKind(props.tag), t, !!props.onDark);
    return h(props.onClick ? "button" : "span", {
      onClick: props.onClick ? function (e) { e.stopPropagation(); props.onClick(props.tag); } : undefined,
      className: props.onClick ? "active:opacity-60" : "",
      style: Object.assign({ fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", borderRadius: 4, padding: "1.5px 7px", whiteSpace: "nowrap" }, st)
    }, props.tag);
  }
  // ---------- feed 里的一篇：翻开这一版之后的【目录条目】----------
  // 她 2026-09-03：「每一篇文显示的样式也改改吧，现在还是一个个框」。
  // 原来是一张张圆角描边卡（深浅交替）——框是任何 app 都有的容器，
  // 而且上面那排书脊已经把这一版做成「抽出来翻开的一本」了，
  // 翻开一本书，底下不该是一叠卡片，该是这一本的【目录页】。
  // 所以每一篇就是目录里的一行：编号 → 篇名 → 一路点过去的引导点 → 字数（页码那一格）。
  // 没有底色、没有描边，靠版面本身分行；条目之间只有一道发丝线。
  // 「我们之间的设计」＝页边那道朱线：这一篇里有我，才用红笔标出来。
  function FicCard(props) {
    const t = useTheme();
    const f = props.fic, characters = props.characters;
    const heat = f.stats || ficHeat(f.id);
    const chCount = (f.chapters || []).length;
    const mine = f.source === "user";
    const hasMe = ficHasMe(f);
    const author = f.author || (mine ? (props.userName || "我") : ficPenName(f.id));
    const words = ficWords(f);
    // 序号仍然【由它此刻排在第几位算出来】，不存在文章上：
    // 删一篇、筛个标签、搜一下，下面那篇顶上来序号就自动重排。
    const idx = Number(props.index) || 0;
    const isLead = idx === 0 && !props.noLead;
    const no = String(idx + 1).padStart(2, "0");
    // 长按调顺序（群里 2026-10-18：「同人文那里可不可以加一个修改文章顺序」）：按住半秒弹挪位置那一层；
    //   长按过了这一下不算点开
    const pressRef = React.useRef({ timer: 0, fired: false });
    const pressProps = props.onReorder ? {
      onPointerDown: function () { const pr = pressRef.current; pr.fired = false; clearTimeout(pr.timer); pr.timer = setTimeout(function () { pr.fired = true; props.onReorder(); }, 520); },
      onPointerUp: function () { clearTimeout(pressRef.current.timer); },
      onPointerLeave: function () { clearTimeout(pressRef.current.timer); },
      onPointerMove: function (e) { if (Math.abs(e.movementY || 0) + Math.abs(e.movementX || 0) > 3) clearTimeout(pressRef.current.timer); },
      onContextMenu: function (e) { e.preventDefault(); }
    } : {};
    const openOrNot = function (e) { if (pressRef.current.fired) { pressRef.current.fired = false; return; } props.onOpen && props.onOpen(e); };
    const summary = (((f.chapters || [])[0] || {}).content || f.body || "").slice(0, 110);
    // 出过本就摆本子封面，没出本有头图就摆头图
    const thumb = (f.book && f.book.cover) || (f.art && f.art.head) || "";
    const dot = function (txt, key) { return h("span", { key: key, style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog }, "data-wk": "ficficcarddot" }, txt); };
    // 目录页的引导点：篇名之后一路点到右边那格字数。这是目录独有的东西，
    // 换个 app 就不成立——别处的列表右边不是页码。
    const leader = h("span", { style: { flex: 1, minWidth: 14, alignSelf: "flex-end", marginBottom: 5, borderBottom: "1px dotted " + t.line } });
    const pageNo = h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, whiteSpace: "nowrap", paddingLeft: 7 } }, fmtNum(words) + " 字");
    const tagRow = function (mt) {
      return (f.tags || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: mt } },
        (f.tags || []).slice(0, 5).map(function (tag, i) { return h(FicTag, { key: i, tag: tag, onClick: props.onTag }); })) : null;
    };
    const statRow = function (mt) {
      return h("div", { className: "flex items-center flex-wrap", style: { gap: 8, marginTop: mt }, "data-wk": "ficficcardstatrow" },
        dot(chCount + " 章", "c"),
        h("span", {
          onClick: function (e) { e.stopPropagation(); props.onLike && props.onLike(); },
          className: "active:opacity-60 flex items-center gap-1",
          style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: f.liked ? t.accent : t.fog }, "data-wk": "ficficcardtap", "data-part": "1"
        }, h(IHeart, { size: 11, color: f.liked ? t.accent : t.fog, filled: f.liked }), fmtNum(heat.kudos + (f.liked ? 1 : 0))),
        (f.reviews || []).length ? dot("评 " + (f.reviews || []).length, "r") : null,
        h("span", { style: { flex: 1 } }),
        props.readAt ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.accent } }, props.readAt) : null,
        f.onShelf ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent } }, "★") : null,
        // 单篇删除（她 2026-09-20：「为啥清空不了，能不能搞个强制单个删除」）。
        // 「清空」只清没被留下的那些，所以她那一版【一篇都清不掉】——全是追过/赞过/收藏的。
        // 这一颗不问保护不保护，但每一篇都二次确认，自己写的那句说得更重。
        // ⚠️摆在这一排末尾是安全的：这一排是 flex-wrap，挤了就换行，不会像论坛那排一样被顶出屏幕
        //   （那一排是 nowrap + space-between，v71.76 就是那么把 ✕ 顶到屏幕外的）。
        props.onDelete ? h("span", {
          onClick: function (e) { e.stopPropagation(); props.onDelete(); },
          role: "button", title: "删掉这一篇", className: "active:opacity-50",
          style: { flexShrink: 0, marginLeft: 2, padding: "0 5px", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: "18px", color: t.fog }, "data-wk": "ficficcardtap", "data-part": "2"
        }, "✕") : null);
    };
    // ⚠️v61.19：目录行是对的，但它【平在纸上】（她 2026-09-03：「还是一块平的」）。
    // 一篇同人文在现实里是一本【订起来的薄册子】，所以每一篇就照薄册子来画：
    // 左边一道装订边＋两枚订书钉、册子底下压着两三层错开的纸、一道自己的影。
    // 不是回到「一个个框」——它没有描边、没有圆角框，边是纸叠出来的。
    const paper = skinShade(t.bg2, skinIsDark(t.bg) ? 0.06 : 0.5);
    const under = skinShade(t.bg2, skinIsDark(t.bg) ? -0.2 : -0.06);
    // 一叠：本体的影 + 底下错开的几层纸 + 一道极淡的纸边。
    // 卷首那本更厚（多压一层、影更沉）——摊在最上面的那一本本来就该有分量。
    const stack = "0 0 0 1px " + hexA(t.ink, .07)
      + ", 2px 3px 0 -1px " + under + ", 4px 6px 0 -2px " + under
      + (isLead ? ", 6px 9px 0 -3px " + under + ", 0 11px 14px -8px " + hexA(t.ink, .42)
                : ", 0 7px 10px -7px " + hexA(t.ink, .35));
    // 书口：右边那条切齐的纸白。一册纸摞起来切开就是这个样子——
    // 极细的明暗条纹，越往里越密（不是一条渐变色带）。
    const foreEdge = h("div", {
      style: {
        position: "absolute", right: 0, top: 3, bottom: 3, width: isLead ? 7 : 5,
        borderRadius: "0 2px 2px 0",
        background: "repeating-linear-gradient(90deg," + hexA(t.ink, .13) + " 0 .5px," + hexA(t.ink, 0) + " .5px 2px)",
        boxShadow: "inset 1px 0 0 " + hexA(t.ink, .06)
      }
    });
    // 装订边：靠左那一条压深的纸 + 两枚订书钉（同人本就是这么订起来的）
    const staple = function (top) {
      return h("div", { key: "s" + top, style: { position: "absolute", left: 8, top: top, width: 2, height: 9, borderRadius: 1, background: hexA(t.ink, .42) }, "data-wk": "ficficcardstaple" });
    };
    const binding = h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 19, background: "linear-gradient(90deg," + hexA(t.ink, .11) + "," + hexA(t.ink, .02) + ")" } });
    // 「写我们的」那几篇：从册子上口垂下来的一根红书签带
    const ribbon = hasMe ? h("div", {
      style: {
        position: "absolute", right: 15, top: -3, width: 8, height: 21, background: t.accent,
        clipPath: "polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)"
      }
    }) : null;

    // 卷首：这一页最上面那一本，摊开着——所以它更厚（影更沉）、字更大。
    if (isLead) return h("button", {
      ...pressProps, onClick: openOrNot, className: "w-full text-left active:translate-y-px relative",
      style: {
        background: paper, borderRadius: 2, boxShadow: stack,
        padding: "14px 20px 13px 30px", marginBottom: 16
      }, "data-wk": "ficficcardstaple", "data-part": "r2"
    },
      binding, staple("28%"), staple("62%"), foreEdge, ribbon,
      h("div", { className: "flex items-center", style: { gap: 8, paddingBottom: 8, marginBottom: 9, borderBottom: "1px solid " + hexA(t.ink, .12) } },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(8.5px * var(--app-fs, 1))", fontWeight: 700, letterSpacing: "0.2em", color: t.fog } }, props.leadLabel || "圈子里最上面那一篇"),
        h("span", { style: { flex: 1 } }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: hasMe ? t.accent : t.fog } }, no)),
      thumb ? h("div", { style: { margin: "0 0 10px", borderRadius: 2, overflow: "hidden", height: 150 } }, h(FicImg, { k: thumb, style: { height: 150, objectFit: "cover" } })) : null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", lineHeight: 1.18, color: t.ink, fontWeight: 500 } }, f.title),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 5 } },
        "by " + author + "　·　",
        h("span", { style: { color: t.accent } }, cpLabel(f.cp, characters, props.userName)),
        "　·　" + fmtNum(words) + " 字"),
      h("div", { className: "line-clamp-3", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, marginTop: 8 } }, summary),
      tagRow(10), statRow(9));

    return h("button", {
      ...pressProps, onClick: openOrNot, className: "w-full text-left active:translate-y-px relative flex",
      style: {
        background: paper, borderRadius: 2, boxShadow: stack,
        gap: 9, padding: "11px 17px 11px 26px", marginBottom: 13
      }, "data-wk": "ficficcardstaple", "data-part": "r3"
    },
      binding, staple("26%"), staple("64%"), foreEdge, ribbon,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.6, color: hasMe ? t.accent : t.fog, width: 20, flexShrink: 0 } }, no),
      h("div", { className: "min-w-0", style: { flex: 1 } },
        // 封面上那一行：篇名 …………… 字数（目录里页码的位置）
        h("div", { className: "flex items-baseline", style: { gap: 0 } },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.35, color: t.ink, fontWeight: 500, maxWidth: "76%" } }, f.title),
          leader, pageNo),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } },
          // ⚠️子节点要传数组，不能拿 + 去拼——元素被字符串拼接就成了 [object Object]
          "by " + author + "　·　",
          h("span", { style: { color: t.accent } }, cpLabel(f.cp, characters, props.userName)),
          mine ? h("span", { style: { color: t.accent } }, "　·　我写的") : null),
        h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.6, marginTop: 5 } }, summary),
        tagRow(7), statRow(7)),
      thumb ? h("div", { style: { width: 46, height: 64, flexShrink: 0, alignSelf: "center", borderRadius: 2, overflow: "hidden", boxShadow: "0 2px 5px " + hexA(t.ink, .25) } },
        h(FicImg, { k: thumb, style: { height: 64, objectFit: "cover" } })) : null);
  }

  // ---------- 掀开封面：点进一篇时的翻页 ----------
  // 列表上那一篇是一本订好的册子，点进去就该是【把封面掀开】，不是换一个屏幕。
  // 绕左边书脊那条边转进来（transform-origin:left），带一道从中缝扫过去的高光。
  // ⚠️开了「减少动态效果」的人一律不放（无障碍设置，别硬演）。
  function FicMotionStyles() {
    return h("style", { "data-wk": "ficficmotionstyles" },
      "@keyframes ficOpenBook{0%{opacity:.35;transform:perspective(1400px) rotateY(-72deg)}"
      + "62%{opacity:1}100%{opacity:1;transform:perspective(1400px) rotateY(0)}}"
      + "@keyframes ficOpenGlare{0%{opacity:.5}100%{opacity:0}}"
      + ".fic-open-book{height:100%;transform-origin:left center;backface-visibility:hidden;"
      + "animation:ficOpenBook .46s cubic-bezier(.22,.71,.2,1) both}"
      + ".fic-open-book::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:60;"
      + "background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(0,0,0,0) 42%);"
      + "animation:ficOpenGlare .46s ease-out both}"
      + "@media(prefers-reduced-motion:reduce){.fic-open-book,.fic-open-book::after{animation:none!important}}");
  }

  // ---------- 世界观分版：书架上那一排书脊（施工规则/tabs-not-plain-pills.md）----------
  // 原来是一排圆角药丸——任何 app 都能用的那一种，等于没设计。
  // 这个 app 现实里是【一架子同人本】：一版就是一本，所以分版就长成书脊。
  //
  // ⚠️v61.12：只把药丸换成竖排的字还不够（她 2026-09-03：「现在还是很简约风，
  // 没有书架的感觉」）——书脊之所以是书脊，靠的是【布面有颜色、上下两道烫金压线、
  // 每本高矮不齐、底下压着一块搁板】。少了这几样它就只是竖着写字的方块。
  // 所以这一版把这几样都画出来：布色由版名算（同一版永远同一色）、深浅由主题算，
  // 字色从布色本身推（深布浅字/浅布深字），不写死黑白。
  function shadeRGB(rgb, k) {
    return rgb.map(function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); });
  }
  function rgbStr(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : a) + ")"; }
  function rgbLum(c) { return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000; }
  // 一本书的布面：颜色从版名算出来，深浅从主题的 accent/ink 派生——
  // 换主题整架子跟着换，但同一版永远还是那个色（她认色找版）。
  function ficSpineTone(name, t) {
    const seed = ficHash("spine:" + String(name || ""));
    const base = skinRGB((seed >>> 4) % 3 === 0 ? t.ink : t.accent);
    const cloth = shadeRGB(base, [-0.45, -0.3, -0.16, 0.04, 0.17, 0.29][seed % 6]);
    const dark = rgbLum(cloth) < 128;
    return {
      cloth: cloth,
      // 书名：从布色本身推，保证同一块布上永远读得出（不写死黑白）
      ink: rgbStr(shadeRGB(cloth, dark ? 0.84 : -0.7)),
      // 烫金压线：布色提亮/压深一档
      foil: rgbStr(shadeRGB(cloth, dark ? 0.5 : -0.34), 0.75),
      // 高矮不齐：一架子书本来就不是切齐的
      lift: [0, -5, 3, -2, 6, -3][(seed >>> 7) % 6]
    };
  }
  function TabBar(props) {
    const t = useTheme();
    const SPINE_H = 66, OFF_H = 52;
    const rule = function (pos, color) {
      return h("div", { style: Object.assign({ position: "absolute", left: 3, right: 3, height: 1, background: color }, pos), "data-wk": "fictabbarrule" });
    };
    return h("div", { className: "shrink-0 px-5 pb-2", style: { overflowX: "auto", WebkitOverflowScrolling: "touch" }, "data-wk": "fictabbarrule", "data-part": "r2" },
      h("div", { style: { width: "max-content", minWidth: "100%" } },
        h("div", { style: { display: "flex", flexWrap: "nowrap", alignItems: "flex-end", gap: 3, paddingTop: 8 } },
          props.tabs.map(function (tab) {
            const on = tab.id === props.activeId;
            const sp = ficSpineTone(tab.name, t);
            return h("button", {
              key: tab.id,
              onClick: function () { if (on && !tab.seed) props.onEdit(tab); else props.onPick(tab.id); },
              onDoubleClick: function () { if (!tab.seed) props.onEdit(tab); },
              title: tab.name,
              className: "shrink-0 active:translate-y-px relative flex items-center justify-center",
              style: {
                // 选中＝被抽出来翻开的那一本：满高、纸色、压到搁板前面去
                height: on ? SPINE_H : OFF_H + sp.lift, width: on ? 36 : 29,
                marginBottom: on ? -7 : 0, zIndex: on ? 3 : 1,
                borderRadius: "4px 4px 0 0", overflow: "hidden", padding: "9px 0",
                background: on ? t.bg : rgbStr(sp.cloth),
                // 布面的光：左右两道暗、中间提一点，才像一个圆的书脊而不是一块色板
                backgroundImage: on ? "none"
                  : "linear-gradient(90deg,rgba(0,0,0,.22),rgba(255,255,255,.10) 34%,rgba(255,255,255,.04) 62%,rgba(0,0,0,.20))",
                border: on ? "1px solid " + t.line : "none",
                borderBottom: on ? "none" : undefined,
                boxShadow: on ? "0 3px 10px rgba(0,0,0,.20)" : "inset -1px 0 0 rgba(0,0,0,.16)",
                color: on ? t.ink : sp.ink,
                fontFamily: F_DISPLAY, fontSize: on ? 13 : 12.5, fontWeight: on ? 600 : 500,
                writingMode: "vertical-rl", textOrientation: "upright",
                letterSpacing: "0.05em", lineHeight: 1, whiteSpace: "nowrap"
              }, "data-wk": "fictabbar", "data-on": on ? "1" : "0"
            },
              // 上下两道烫金压线——书脊上那两条，认书脊全靠它
              rule({ top: 5 }, on ? t.line : sp.foil),
              rule({ bottom: on ? 7 : 5 }, on ? t.line : sp.foil),
              h("span", { style: { position: "relative" } },
                String(tab.name || "").slice(0, on ? 4 : 3), (on && !tab.seed) ? "✎" : ""));
          }),
          // 架子上还空着的那一格
          h("button", {
            onClick: props.onAdd, className: "shrink-0 active:opacity-60 flex items-center justify-center",
            "aria-label": "新建世界观",
            style: {
              height: OFF_H - 6, width: 29, borderRadius: "4px 4px 0 0", marginLeft: 4,
              border: "1px dashed " + t.line, borderBottom: "none",
              color: t.fog, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", background: "transparent"
            }, "data-wk": "fictabbarbtn", "data-part": "新建世界观"
          }, "+"),
          h("div", { style: { flex: 1, minWidth: 10 } })),
        // 搁板：一排书立在它上面，板面朝上收一道暗（书压出来的影），板底一道厚边
        h("div", {
          style: {
            height: 7, borderRadius: 2,
            background: "linear-gradient(180deg," + hexA(t.ink, .26) + "," + hexA(t.ink, .13) + ")",
            boxShadow: "inset 0 2px 3px rgba(0,0,0,.22), 0 2px 5px " + hexA(t.ink, .16)
          }
        })));
  }

  // ---------- 生成配置弹窗（齿轮）----------
  function GenSheet(props) {
    const t = useTheme();
    const cfg0 = loadCfg();
    const styles = allStylePresets(cfg0);
    const [n, setN] = useState(3);
    const [briefs, setBriefs] = useState([]);   // 每篇点的梗，没填＝自由发挥
    const authors = loadAuthors();
    const [byId, setById] = useState("");      // 点名让谁写；空＝随缘
    function setBrief(i, v) { setBriefs(function (prev) { const a = prev.slice(); a[i] = v; return a; }); }
    const [sel, setSel] = useState([]); // 选中的 CP preset id 或角色 id（这里存最终 cp 数组）
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const [styleIds, setStyleIds] = useState(cfg0.activeStyleIds || []); // 本次生效的文风（默认=上次选的）
    const [includeMe, setIncludeMe] = useState(false); // 俩角色 CP 时：带上「我」写成 A×我×B
    // 这一篇「我」用哪张面具（她 2026-10-17）：空＝跟着那位角色认的那张
    const [meMask, setMeMask] = useState("");
    const [noCP, setNoCP] = useState(false);
    const [oneShot, setOneShot] = useState(false);   // 写成完结短篇：一篇写完，不当连载开头   // 无 CP：挑的人都在，默认不写感情线
    const allMasks = (function () { try { return (loadJSON("x_masks", []) || []).filter(function (m) { return m && m.id; }); } catch (e) { return []; } })();
    // 群像：点进去的那几个人（点的先后＝顺序），和这几个人之间是什么关系
    const [cast, setCast] = useState([]);
    const [way, setWay] = useState("");
    function toggleStyle(id) { setStyleIds(function (prev) { return prev.indexOf(id) >= 0 ? prev.filter(function (x) { return x !== id; }) : prev.concat([id]); }); }
    const cps = props.cps, characters = props.characters;
    // 最终 cp：优先用手动选（pickA/pickB，可为角色/我/原创空），否则用点选的 preset
    function chosenCP() {
      if (cast.length >= 2) return cast;           // 两个＝CP（点的先后就是左右位），三个以上＝群像
      const manual = [pickA, pickB].filter(function (x) { return x; });
      if (manual.length) return manual;
      return sel;
    }
    const isGroup = chosenCP().length >= 3;
    // 挑人的三条路互斥：不清掉另外两条，界面上会同时亮着两处而只有一处算数
    function pickCast(next) { setSel([]); setPickA(""); setPickB(""); setCast(next); }
    // 两个都是角色（都不是「我」/原创）时才给「带上我」开关
    function twoRealChars() { const cc = chosenCP(); return cc.length === 2 && cc.every(function (x) { return x && x !== "me"; }); }
    // ── 四格收放（v64.63）──────────────────────────────────────────────
    const [secOpen, setSecOpen] = useState("n");   // 一次只开一格，默认开第一格
    const briefN = briefs.slice(0, n).filter(function (x) { return String(x || "").trim(); }).length;
    function cpSummary() {
      const cc = chosenCP();
      if (!cc.length) return "还没挑";
      return cpLabel(cc, characters, props.userName)
        + (isGroup && way.trim() ? " · " + way.trim() : "")
        + (!isGroup && twoRealChars() && includeMe ? " · 带上我" : "");
    }
    function styleSummary() {
      if (!styleIds.length) return "不限";
      const names = styles.filter(function (x) { return styleIds.indexOf(x.id) >= 0; }).map(function (x) { return x.name; });
      return names.length <= 2 ? names.join("、") : names.slice(0, 2).join("、") + " 等 " + names.length + " 种";
    }
    function authorSummary() {
      if (!byId) return "随缘";
      const a = authors.filter(function (x) { return x.id === byId; })[0];
      return (a && a.name) || "随缘";
    }
    // ⚠️标题栏那一行【自带摘要】：收起来也看得见这一格现在是什么。
    //   只写个名字的话，等于把设置藏起来了——那比原来那根长条还难用。
    // ⚠️body 收成 rest：这四格里有三格是好几段并排的，写成单个 body 参数
    //   只会渲染第一段——第一版就是这么漏掉滑杆和每篇的梗那几个框的。
    function sec(id, title, summary) {
      const body = Array.prototype.slice.call(arguments, 3);
      const on = secOpen === id;
      return h("div", { key: id, style: { borderRadius: 14, border: "1px solid " + (on ? t.ink : t.line), background: t.bg2, marginBottom: 8, overflow: "hidden" }, "data-wk": "ficgensheetsec", "data-on": on ? "1" : "0" },
        h("button", { onClick: function () { setSecOpen(on ? "" : id); }, className: "w-full text-left active:opacity-70",
          style: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 13px", background: "transparent", border: "none" }, "data-wk": "ficgensheetbtn", "data-part": "1", "data-on": on ? "1" : "0" },
          h("span", { style: { flex: 1, minWidth: 0 } },
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, title),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, summary)),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, on ? "收起 ▾" : "展开 ▸")),
        on ? h.apply(null, [ "div", { style: { padding: "2px 13px 13px" } } ].concat(body)) : null);
    }
    // ⚠️整页，不是半窗（施工规则/no-half-sheet.md）。
    //   这一层要填的是四格设置，压根不需要同时看见底下那一屏 feed；
    //   而半窗的代价是固定的——不管里面装多少，先扣掉一半屏幕。
    //   （v64.63 之前它是半窗，一屏装不下、也看不出自己填到哪儿了。）
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }), "data-wk": "ficgensheet" },
      h(Head, { bg: "transparent", zh: "生成配置", sub: "【" + props.tab.name + "】世界观 × 选中 CP × 篇数 → 往本版 feed 出文", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pt-1 pb-4" },

        // ── 分成四格收起来（v64.63，她 2026-09-06：「生成新文是不是也很长很乱，
        //    你做个和装饰一样的分类收放来填吧」）──────────────────────────
        // 原来六段东西直接摞成一长条，一屏装不下、也看不出自己填到哪儿了。
        // 照贴纸编辑器那个形状：一行一格、一次只展开一格（secOpen === id）。
        // ⚠️**每一格的标题上写着这一格现在是什么**——不然收起来之后
        //   等于把设置藏起来了，比长条还难用。
        sec("n", "写几篇 · 每篇写什么", n + " 篇 · " + (briefN ? briefN + " 篇写了梗" : "都自由发挥"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, marginBottom: 8 } }, "生成篇数　" + n + " 篇"),
          h("input", { type: "range", min: 1, max: 8, value: n, onChange: function (e) { setN(Number(e.target.value)); }, className: "w-full mb-4", "data-wk": "ficgensheetinput", "data-part": "1" }),
          h("button", { "data-wk": "ficoneshot", "data-on": oneShot ? "1" : "0", onClick: function () { setOneShot(function (v) { return !v; }); }, className: "w-full active:opacity-80",
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: oneShot ? "rgba(0,0,0,0.04)" : t.bg2, border: "1px solid " + (oneShot ? t.ink : t.line), borderRadius: 12, marginBottom: 14 } },
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, oneShot ? "写成完结短篇" : "写成连载开头"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, oneShot ? "照下面写的剧情一篇写完，有头有尾，不留悬念" : "点一下改成完结短篇：给一段剧情，一篇写完")),
            h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (oneShot ? t.ink : t.line), background: oneShot ? t.ink : "transparent", color: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(13px * var(--app-fs, 1))" } }, oneShot ? "✓" : "")),

          // 每篇一个框：想好了就写，没写的那篇自由发挥。
          // ⚠️框数跟着篇数走，但 briefs 不随之截断——她把篇数调小再调回来，
          // 之前写的那几条还在（改成截断的话，手一滑就白写了）。
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, marginBottom: 2 } }, "每篇想看什么（可留空）"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 8, lineHeight: 1.5 } }, "留空的那篇自由发挥；写了的会当成那一篇的地基，不是结尾提一句"),
          h("div", { className: "mb-6", style: { display: "flex", flexDirection: "column", gap: 6 } },
            Array.from({ length: n }, function (_, i) {
              return h("div", { key: i, className: "flex items-start", style: { gap: 8 }, "data-wk": "ficgensheet", "data-part": "r2" },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, paddingTop: 8, width: 26, flexShrink: 0 } }, "第" + (i + 1)),
                h("textarea", {
                  value: briefs[i] || "", onChange: function (e) { setBrief(i, e.target.value); },
                  rows: 1, placeholder: "自由发挥",
                  style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.55, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "6px 10px", outline: "none", resize: "vertical" }, "data-wk": "ficgensheettext", "data-part": "自由发挥"
                }));
            })),
        ),
        sec("cp", "谁和谁", cpSummary(),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, marginBottom: 8 } }, "选择预设好的 CP，或本次手动设置一对"),
          // 从 CP 预设名单里选
          cps.length ? h("div", { className: "flex flex-wrap gap-2 mb-3" },
            cps.map(function (cp) {
              const on = JSON.stringify(chosenCP()) === JSON.stringify(cp.cp);
              return h("button", {
                key: cp.id, onClick: function () { setPickA(""); setPickB(""); setCast([]); setSel(on ? [] : cp.cp); },
                style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) }, "data-wk": "ficgensheet", "data-part": "r3", "data-on": on ? "1" : "0"
              }, cp.label || cpLabel(cp.cp, characters, props.userName));
            })
          ) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 10 } }, "还没有 CP 预设，可在「我的」页添加，或下面本次手动设置一对："),

          // 本次手动设置一对（不进预设）：原创 / 我（面具人设）/ 角色
          h("div", { className: "flex items-center gap-2 mb-2" },
            h("select", { value: pickA, onChange: function (e) { setSel([]); setCast([]); setPickA(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2), "data-wk": "ficgensheetselect", "data-part": "1" },
              cpOptions(characters, props.userName)),
            h("span", { style: { fontFamily: F_BODY, color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setSel([]); setCast([]); setPickB(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2), "data-wk": "ficgensheetselect", "data-part": "2" },
              cpOptions(characters, props.userName))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "选「我」时按面具人设来写，没填则自由发挥"),
          (allMasks.length > 1 && ((chosenCP() || []).indexOf("me") >= 0 || (!isGroup && twoRealChars() && includeMe))) ? h("div", { "data-wk": "ficmemask", className: "flex items-center gap-2", style: { marginBottom: 10 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, flexShrink: 0 } }, "这篇的「我」用"),
            h("select", { value: meMask, onChange: function (e) { setMeMask(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2) },
              h("option", { value: "" }, "跟着他认的那张"),
              allMasks.map(function (m) { return h("option", { key: m.id, value: m.id }, m.name || "未命名面具"); }))) : null,

          // 俩角色 CP：带不带上「我」（否则默认只写他俩，即便设定里写了 TA 是我男朋友也不把我带进去）
          (chosenCP().length && !isGroup) ? h("button", { "data-wk": "ficnocp", "data-on": noCP ? "1" : "0", onClick: function () { setNoCP(function (v) { return !v; }); }, className: "w-full active:opacity-80",
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: noCP ? "rgba(0,0,0,0.04)" : t.bg2, border: "1px solid " + (noCP ? t.ink : t.line), borderRadius: 12, marginTop: 4, marginBottom: 10 } },
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, noCP ? "无 CP：只写他们的故事" : "写成 CP"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, noCP ? "挑的人都在（挑了「我」也有你），默认不写感情线" : "点一下改成无 CP：不写感情线")),
            h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (noCP ? t.ink : t.line), background: noCP ? t.ink : "transparent", color: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(13px * var(--app-fs, 1))" } }, noCP ? "✓" : "")) : null,
          (!isGroup && !noCP && twoRealChars()) ? h("button", { onClick: function () { setIncludeMe(function (v) { return !v; }); }, className: "w-full active:opacity-80",
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: includeMe ? "rgba(0,0,0,0.04)" : t.bg2, border: "1px solid " + (includeMe ? t.ink : t.line), borderRadius: 12, marginTop: 4, marginBottom: 14 }, "data-wk": "ficgensheetbtn", "data-part": "2" },
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, includeMe ? "带上我（他俩 × 我 的三人）" : "只写他俩的 CP"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, includeMe ? "把「我」作为第三方写进文里" : "只聚焦这两个角色，就算设定写了 TA 是我男朋友也不把我带进去")),
            h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (includeMe ? t.ink : t.line), background: includeMe ? t.ink : "transparent", color: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(13px * var(--app-fs, 1))" } }, includeMe ? "✓" : "")) : null,

          // ── 几个人一起（她 2026-09-11）────────────────────────────
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, letterSpacing: ".16em", margin: "16px 0 2px" } }, "或者几个人一起"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 4, lineHeight: 1.6 } },
            "点的先后就是顺序：点两个＝这一对（先点的是左位），点三个以上＝群像，不分左右位。最多 " + CAST_MAX + " 个。"),
          h(CastPicker, { t: t, characters: characters, userName: props.userName, value: cast, onChange: pickCast }),
          // 三个人以上才问「这几个人什么关系」——两个人那是 CP，不是向
          isGroup ? h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 7 } }, "这几个人之间是什么关系"),
            h("div", { className: "flex flex-wrap", style: { gap: 7 } },
              GROUP_WAYS.map(function (w) {
                return h(WayTag, { key: w, t: t, tag: w, on: way.trim() === w, onClick: function () { setWay(way.trim() === w ? "" : w); } });
              })),
            // ⚠️那四个是她随口想得到的，「还有啥别的类型的想不到了」——所以这一格永远开着
            h("input", { value: way, onChange: function (e) { setWay(e.target.value.slice(0, 120)); },
              placeholder: "或者自己写：同门、一个乐队、互相看不顺眼的同事…",
              className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "9px 0 8px", marginTop: 10,
                background: "transparent", color: t.ink, border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficgensheetinput", "data-part": "或者自己写：同门、一个乐" }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } },
              "空着就让她自己定一种。不是每个人都要出场——谁是重心交给写的人。")) : null,
        ),
        sec("style", "什么味道", styleSummary(),
          // 本次文风（在「我的·生成设置」里建，这里按需勾选，可多选，不选=不限）
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, marginBottom: 8 } }, "文风（本次生效，可多选，不选＝不限）"),
          styles.length ? h("div", { className: "flex flex-wrap gap-2 mb-6" },
            styles.map(function (s) {
              const on = styleIds.indexOf(s.id) >= 0;
              return h("button", { key: s.id, onClick: function () { toggleStyle(s.id); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) }, "data-wk": "ficgensheet", "data-part": "r4", "data-on": on ? "1" : "0" }, s.label);
            })
          ) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 18 } }, "还没有文风预设，去「我的 → 生成设置」新建或导入，之后每次在这里勾选。"),
        ),
        sec("by", "谁来写", authorSummary(),
          // 谁来写这一批（她 2026-09-04）。不选＝随缘：模型自己起笔名，事后也会收进作者库。
          // ⚠️不是一排药丸：署名表上的一行行名字，选中那行左边落一个墨点、名字加重。
          authors.length ? h("div", { style: { marginBottom: 14 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".14em", color: t.fog, marginBottom: 6 } }, "让谁来写"),
            [{ id: "", name: "随缘（谁写都行）", style: "模型自己起个笔名，写完收进作者库" }].concat(authors).map(function (a) {
              const on = (byId || "") === a.id;
              return h("button", { key: a.id || "_any", onClick: function () { setById(a.id); }, className: "w-full text-left active:opacity-70",
                style: { display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 2px", background: "transparent", border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficgensheet", "data-part": "r5" },
                h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
                h("span", { style: { minWidth: 0 } },
                  h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, a.name),
                  a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 1, lineHeight: 1.5 } }, a.style) : null));
            })) : null,
        ),

        ),
      // 页脚固定在底下：四格再怎么展开，「确定生成」永远在手边（底部只吃 0.4 条
      // 安全区，跟主聊天输入栏同一把尺子——mobile-ui-layout.md §2）
      h("div", { className: "shrink-0 flex items-center gap-3 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        h("button", { onClick: function () { setN(3); setSel([]); setPickA(""); setPickB(""); setIncludeMe(false); setBriefs([]); setById(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.sub, padding: "10px 18px", borderRadius: 12, border: "1px solid " + t.line }, "data-wk": "ficgensheetbtn", "data-part": "3" }, "重置"),
        h("button", { onClick: function () { props.onConfirm(n, chosenCP(), styleIds, !isGroup && twoRealChars() && includeMe, briefs.slice(0, n), authors.filter(function (a) { return a.id === byId; })[0] || null, isGroup ? way.trim() : "", meMask, noCP && !isGroup && chosenCP().length > 0, oneShot); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "11px", borderRadius: 12 }, "data-wk": "ficgensheetbtn", "data-part": "4" }, "确定生成")));
  }

  // ---------- 新建/编辑自定义世界观 tab ----------
  function TabSheet(props) {
    const t = useTheme();
    const editing = props.tab;
    const [name, setName] = useState(editing ? editing.name : "");
    const [desc, setDesc] = useState(editing ? editing.desc : "");
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose, "data-wk": "fictabsheet" },
      // 掀起来那块该是同一张纸——父页铺的就是 pageSkin("paper")，退回平色就等于
      // 从纸上掀起一块塑料板（no-half-sheet.md 的 skin 那一节）
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: pageSkin("paper", t, { strength: .6, corner: false }), "data-wk": "fictabsheettap", "data-part": "1" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: t.ink, marginBottom: 14 } }, editing ? "编辑世界观" : "新世界观"),
        h("input", { "data-wk": "input", value: name, onChange: function (e) { setName(e.target.value); }, placeholder: "世界观名（如『民国』『星际』）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "10px 12px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "fictabsheetinput", "data-part": "世界观名（如『民国』『星" }),
        h("textarea", { "data-wk": "textarea", value: desc, onChange: function (e) { setDesc(e.target.value); }, placeholder: "世界观描述（= 生成时的设定层 / world book，越具体越好：背景、基调、这个世界的规则）", rows: 5, className: "w-full outline-none mb-4 resize-none", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, padding: "10px 12px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "fictabsheettext", "data-part": "世界观描述（= 生成时的" }),
        h("div", { className: "flex items-center gap-3" },
          editing && !editing.seed ? h("button", { onClick: function () { props.onDelete(editing.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.accent, padding: "10px 16px", borderRadius: 12, border: "1px solid " + t.line }, "data-wk": "fictabsheetbtn", "data-part": "1" }, "删除") : null,
          h("button", { onClick: function () { if (name.trim()) props.onSave(editing ? editing.id : null, name.trim(), desc.trim()); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "11px", borderRadius: 12 }, "data-wk": "fictabsheetbtn", "data-part": "2" }, "保存"))));
  }

  // 作者署名 badge
  function authorTag(t) { return h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", color: t.bg2, background: t.tint, borderRadius: 5, padding: "0px 5px", marginLeft: 5 }, "data-wk": "fictabsheetauthortag" }, "作者"); }

  // ---------- 阅读页（含追更 + 书评）----------
  function Reader(props) {
    // 这一篇自己的纸：篇上写了用篇的，没写用默认那张（props.paper 由 FanficApp 算好传下来，
    // 它同时也是套在外层 Provider 上的那一张——两处必须是同一张，否则头上那个色块跟正文对不上）。
    const t = useTheme();
    const _paper = props.paper || ficPaper(loadCfg());
    const [paperOpen, setPaperOpen] = useState(false);
    const f = props.fic;
    const [busy, setBusy] = useState("");         // 内联小操作（发书评/回复）
    const chapterTaskKey = "fanfic:chapter:" + f.id;
    const [busyChap, setBusyChap] = useState(function () { return !!(window.BackgroundGeneration && window.BackgroundGeneration.state(chapterTaskKey).busy); }); // 追更（离开阅读页仍继续）
    // 改这一章：写完了也能回头改字（她 2026-10-16 群里许愿）。哪一章在改、改成什么，只活在这一页。
    const [editIdx, setEditIdx] = useState(-1), [editTxt, setEditTxt] = useState("");
    // 改这一篇的 CP：点「改」摆出所有人，按点的先后排左右位；存下以后续写照新的写
    const [cpEdit, setCpEdit] = useState(null);
    const [busyMore, setBusyMore] = useState(false); // 「让TA接着写」那一枪：她按了才发
    const [busyBack, setBusyBack] = useState(false); // 「去请她回来」那一枪
    const [fileIdx, setFileIdx] = useState(-1);      // 正在挑「拿给谁看」的那一章
    const [filedNote, setFiledNote] = useState("");  // 刚落进哪儿，给她一句回执
    const [busyRev, setBusyRev] = useState(false);   // 刷书评（可与追更并行）
    const [myWrite, setMyWrite] = useState(false);  // 她自己写下一章（v64.63）
    const [myChap, setMyChap] = useState("");
    const [ghostOpen, setGhostOpen] = useState(false); // 请枪手：先挑人（v64.64）
    const [ghostId, setGhostId] = useState("");        // 空＝照原样，这篇原来那位太太接着写
    const [replyTo, setReplyTo] = useState(null); // review id
    const [replyText, setReplyText] = useState("");
    const [newComment, setNewComment] = useState("");
    const [fwdOpen, setFwdOpen] = useState(false);
    const [busyArt, setBusyArt] = useState("");   // 正在画哪一样：head / fanart / book
    const [artView, setArtView] = useState(null); // 放大看的那一张
    // 打开时回到上次读到的那一章（v58.02）
    const [chapIdx, setChapIdx] = useState(function () {
      const r = loadRead()[props.fic && props.fic.id];
      const n = (props.fic && props.fic.chapters || []).length;
      return r && r.chap > 0 && r.chap < n ? r.chap : 0;
    });
    // 房间里那张卡直接翻到这一章（她 2026-09-12 要的那个快捷键）。
    // ⚠️用完就还回去：不还的话她往后翻一章、组件一重画又被拽回来。
    useEffect(function () {
      if (props.startChap == null || props.startChap === "") return;
      const c = Number(props.startChap);
      if (!Number.isInteger(c) || c < 0) return;
      const n = ((props.fic && props.fic.chapters) || []).length;
      if (n) setChapIdx(Math.max(0, Math.min(n - 1, c)));
      props.onStartChapUsed && props.onStartChapUsed();
    }, [props.startChap]);
    const swipeRef = React.useRef({ x: 0, y: 0 });
    // 翻到/生成新章后跳到该章开头（别落在中间，省得往回翻）
    const chapRef = React.useRef(null);
    // 一键到底、目录（群友 2026-10-17「希望这里可以有一个一键到达底部」「要是有目录和删除这本章就更好了」）
    const [tocOpen, setTocOpen] = useState(false);
    const firstChap = React.useRef(true);
    React.useEffect(function () {
      if (firstChap.current) { firstChap.current = false; return; }
      if (chapRef.current) chapRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }, [chapIdx]);
    React.useEffect(function () {
      if (!window.BackgroundGeneration) return;
      return window.BackgroundGeneration.subscribe(chapterTaskKey, function (s) {
        setBusyChap(!!s.busy);
        if (s.status === "done" && s.result && Number.isInteger(s.result.chapterIndex)) setChapIdx(s.result.chapterIndex);
      });
    }, [chapterTaskKey]);
    const chars = cpChars(f.cp, props.characters, props.profile, f.meMask);
    const storyLore = function (extra) {
      const ids = chars.filter(function (c) { return c && !c.isMe && c.id; }).map(function (c) { return c.id; });
      return props.worldbookFor ? props.worldbookFor(ids, [f.title, props.tab && props.tab.name, extra || ""].filter(Boolean).join("\n")) : props.worldbook;
    };
    function goChap(to) { const chs = f.chapters || []; if (to >= 0 && to < chs.length) { setChapIdx(to); markRead(f.id, to); } }
    // 进来就算读过一次——不然只看了第一章的文永远不会留下记录
    useEffect(function () { markRead(f.id, chapIdx); }, [f.id]);
    const authorName = f.author || (f.source === "user" ? (props.userName || "我") : ficPenName(f.id));

    function genOpts() { const cfg = window.Fanfic.loadCfg(); return { style: window.Fanfic.activeStyleText(cfg), perFic: cfg.perFic, minChars: cfg.minChars, chatMaterial: window.Fanfic.chatMaterialFor(chars) }; }
    // 字数地板：界面上提示的、提示词里发的、写完数的是同一个数（minCharsFor 只此一份）
    const minChars = window.Fanfic.minCharsFor(window.Fanfic.loadCfg());

    // by＝她点名请的那位枪手；不传＝照原样，genNextChapter 自己去名册里找这篇原来那位太太。
    async function addChapter(by, want, hard) {
      if (busyChap) return;
      const newIdx = (f.chapters || []).length; // 新章的索引
      const K = window.Fanfic;
      const heat = K.heatNow(f, Date.now());
      const ownCard = K.findAuthor(f.author);
      // ⚠️掷在这儿，不在提示词里：抢没抢笔、撂不撂挑子是【代码】说了算，
      //   模型只负责她开口说什么（跟电台「今天哪个频率有台」同一条道理）。
      // ⚠️这儿用 Math.random 是对的：这不是「世界是否存在」那种要长期稳定的事，
      //   是这一次的一掷；用种子的话她重点一次会得到同一个结果，那才怪。
      const ownNm = String(f.author || "").trim();
      const byChar = (by && by.char) || null;                 // 她自己的人接了这一章
      const byNmRaw = byChar ? "" : String((by && by.name) || "").trim();
      // ④在这儿接进③：请了一位跟她有过节的枪手，热度涨得更凶
      const feud = !!(byNmRaw && ownNm && K.circleFeud(ownNm, byNmRaw));
      const sameCP = !!(byNmRaw && ownNm && K.sameCPWith(ownNm, byNmRaw, K.loadFics(), props.allChars || chars, props.userName));
      // 抢笔只发生在【太太】之间：她自己的人接手，原作者照样说话，但抢不回来
      // 请的是对家：她自己也可以不接、或者接了不好好写。⚠️拒绝那一次【连枪都不打】。
      const gStance = byChar ? "" : K.ghostStance(feud, by, Math.random());
      if (gStance === "refuse") {
        K.circlePush({ a: byNmRaw, b: ownNm, kind: "turnDown", title: f.title });
        props.toast && props.toast("「" + byNmRaw + "」不接这篇——她跟「" + ownNm + "」有过节");
        return;
      }
      const grabbed = !!by && !byChar && !!ownCard && Math.random() < K.grabChance(heat);
      // 撂挑子先预告：这一章的 authorNote 里她会把「我不写了」说出来，
      // 下次她再点原作者就被挡住——有铺垫、有台词，而且不多花一枪。
      const quitting = !f.authorQuit && (!!by || grabbed) && Math.random() < K.refuseChance(grabbed ? heat : K.heatAfter(f, "ghost", { by: by, hardWant: hard, feud: feud }));
      const run = async function () {
        const ch = await K.genNextChapter(props.active, f, props.tab, chars, props.userName, storyLore("续章"),
          Object.assign(genOpts(), {
            author: byChar ? null : (by || null), want: want || "", hardWant: !!hard,
            grabbed: grabbed, quitting: quitting, sameCP: sameCP, lazy: gStance === "lazy",
            byChar: byChar,
            charRel: byChar && props.relOf ? props.relOf(byChar.id) : null,
            writerAxes: byChar ? K.rollWriterAxes(byChar.id, f.id, (f.chapters || []).length) : null,
            nameOf: function (id) { const c = (props.allChars || chars || []).filter(function (x) { return x && x.id === id; })[0]; return c ? (c.remark || c.name) : "那个人"; }
          }));
        // 请了别人代笔就把名字记在这一章上：翻到这一章时看得见是谁写的。
        // ⚠️记在【章】上不是记在【篇】上——这篇的作者没变，只是这一章的笔换了人。
        // ⚠️这里不能用外面那个 authorName()——Reader 里有个同名的 const 把它挡住了
        const byNm = grabbed ? "" : (byChar ? (byChar.remark || byChar.name) : String((by && by.name) || "").trim());
        if (byNm && byNm !== String(f.author || "").trim()) ch.byAuthor = byNm;
        if (byChar) ch.byCharId = byChar.id;
        if (grabbed) ch.grabbed = true;
        const note = String(ch.authorNote || "").trim();
        props.onUpdate(f.id, function (fic) {
          fic.chapters = (fic.chapters || []).concat([ch]);
          // 设定卡只增不改 + 伏笔盒收支：合并的规矩只写在 applyChapterMeta 那一处
          const meta = window.Fanfic.applyChapterMeta(fic, ch);
          fic.bible = meta.bible; fic.seeds = meta.seeds;
          if (want && want.trim()) fic.lastWant = want.trim().slice(0, 600);
          // 热度：抢回来自己写＝她出手了，热度往下走；请了枪手才往上加
          Object.assign(fic, window.Fanfic.heatFields(fic, { grabbed: grabbed, by: by, hardWant: hard, feud: feud }));
          // 她那句话挂在【这一章】上：章末显示，书评区不重复
          if (note) fic.reviews = (fic.reviews || []).concat([{
            id: uid("rv"), author: String(fic.author || "").trim() || "原作者", isAuthor: true,
            content: note, chapterIdx: newIdx, replies: []
          }]);
          if (quitting) { fic.authorQuit = true; fic.quitSay = note; }
          fic.updatedAt = Date.now(); return fic;
        });
        // ④ 圈子流水：只有【真发生过一件事】才记一笔，不生成日常
        if (ownNm && byNmRaw && !byChar) {
          if (grabbed) K.circlePush({ a: ownNm, b: byNmRaw, kind: "grab", title: f.title });
          else K.circlePush({ a: byNmRaw, b: ownNm, kind: "ghost", title: f.title });
        }
        if (quitting && ownNm) K.circlePush({ a: ownNm, b: byNmRaw, kind: "quit", title: f.title, say: note });
        props.toast && props.toast(grabbed ? "「" + String(f.author || "原作者") + "」把笔抢回去自己写了" : "已更新一章");
        // item 8：新章推给曾被转发看过这篇的角色（不麻烦的轻量版）
        if (props.onChapterShared && (f.sharedTo || []).length) props.onChapterShared(f, ch, newIdx + 1);
        return { chapterIndex: newIdx, chapter: ch };
      };
      props.toast && props.toast("追更已放到后台，可以先离开阅读页");
      if (!window.BackgroundGeneration) {
        setBusyChap(true);
        try { await run(); setChapIdx(newIdx); } catch (e) { props.toast && props.toast(String(e.message || e)); }
        setBusyChap(false); return;
      }
      try { await window.BackgroundGeneration.start(chapterTaskKey, { label: "追更生成中" }, run); }
      catch (e) { props.toast && props.toast(String(e.message || e)); }
    }
    // 去请她回来：撂挑子之后唯一那条路。⚠️成不成【这儿掷】，模型只写她怎么回。
    async function askAuthorBack() {
      if (busyBack) return;
      setBusyBack(true);
      try {
        const K = window.Fanfic;
        const ok = Math.random() < K.backChance(K.heatNow(f, Date.now()));
        const r = await K.genAuthorBack(props.active, f, props.tab, chars, props.userName, storyLore("续章"), genOpts(), ok);
        props.onUpdate(f.id, function (fic) {
          fic.reviews = (fic.reviews || []).concat([{ id: uid("rv"), author: String(fic.author || "").trim() || "原作者", isAuthor: true, content: r.say, replies: [] }]);
          if (r.ok) { fic.authorQuit = false; fic.quitSay = ""; fic.authorHeat = Math.max(0, window.Fanfic.heatNow(fic, Date.now()) - 25); fic.heatTs = Date.now(); }
          fic.updatedAt = Date.now(); return fic;
        });
        const own2 = String(f.author || "").trim();
        if (own2) K.circlePush({ a: own2, b: "", kind: r.ok ? "back" : "refuse", title: f.title, say: r.say });
        props.toast && props.toast(r.ok ? "她答应回来写了" : "她还是没答应");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyBack(false);
    }
    // 「让TA接着写」：她按了才发的那第二枪。接着写不是重写——
    // 重写是掷骰子（可能更短），接着写必然变长，还顺带救回被截断的那种。
    async function moreChapter(i) {
      if (busyMore) return;
      setBusyMore(true);
      try {
        const writerId = ((f.chapters || [])[i] || {}).byCharId;
        const byChar = (props.allChars || props.characters || []).find(c => c.id === writerId);
        const add = await window.Fanfic.genChapterMore(props.active, f, props.tab, chars, props.userName, storyLore("续章"),
          Object.assign(genOpts(), { byChar: byChar || null, charRel: byChar && props.relOf ? props.relOf(byChar.id) : null,
            nameOf: id => { const c = (props.allChars || props.characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : "那个人"; } }), i);
        props.onUpdate(f.id, function (fic) {
          const chs = (fic.chapters || []).slice();
          const cur = chs[i]; if (!cur) return fic;
          chs[i] = Object.assign({}, cur, { content: String(cur.content || "").trim() + "\n\n" + add.add, endHook: add.endHook || cur.endHook });
          fic.chapters = chs;
          const meta = window.Fanfic.applyChapterMeta(fic, add);
          fic.bible = meta.bible; fic.seeds = meta.seeds;
          fic.updatedAt = Date.now(); return fic;
        });
        props.toast && props.toast("接上去了");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyMore(false);
    }
    // 她自己写的那一章：跟枪手写的走【同一条落地路】（onUpdate + chapters.concat），
    // 所以翻页、阅读进度、分享给角色那几处一个字都不用改。
    // ⚠️endHook 留空：那是给续写用的锚点，她写的时候没这一栏——
    //   genNextChapter 拿到空的会自己写成「（无锚点）」，不会崩。
    // 改这一章：只换这一章的字，谁写的、章末留言、锚点都不动——后面续写照样接得上。
    // 删掉一章：后面的往前挪；挂在那一章上的原作者留言、画的图一起跟着挪（删掉那章的留言一起删）
    function deleteChapter(i) {
      const n = (f.chapters || []).length;
      if (n <= 1) { props.toast && props.toast("只剩这一章了，删不了；不要这篇就在书架上删整篇"); return; }
      const ok = function () {
        props.onUpdate(f.id, function (fic) {
          fic.chapters = (fic.chapters || []).filter(function (_, k) { return k !== i; });
          fic.reviews = (fic.reviews || []).filter(function (r) { return !(r && r.chapterIdx === i); }).map(function (r) {
            if (!r) return r;
            const o = Object.assign({}, r);
            if (o.chapterIdx != null && o.chapterIdx > i) o.chapterIdx -= 1;
            if (o.artChap != null) { if (o.artChap === i) delete o.artChap; else if (o.artChap > i) o.artChap -= 1; }
            return o;
          });
          fic.updatedAt = Date.now(); return fic;
        });
        const to = Math.max(0, Math.min(i, n - 2));
        setChapIdx(to); markRead(f.id, to); setEditIdx(-1);
        props.toast && props.toast("删掉了第 " + (i + 1) + " 章");
      };
      requestAppConfirm("删掉第 " + (i + 1) + " 章？", "这一章的正文和挂在它底下的留言一起删掉，后面的章节号往前挪一位。删了找不回来。", ok, "删掉");
    }
    function saveEditChapter(i) {
      const txt = editTxt.trim();
      if (!txt) { props.toast && props.toast("一章不能是空的"); return; }
      props.onUpdate(f.id, function (fic) {
        const chs = (fic.chapters || []).slice();
        if (!chs[i]) return fic;
        chs[i] = Object.assign({}, chs[i], { content: txt, edited: true });
        fic.chapters = chs; fic.updatedAt = Date.now(); return fic;
      });
      setEditIdx(-1); setEditTxt("");
      props.toast && props.toast("改好了");
    }
    function saveMyChapter() {
      const txt = myChap.trim();
      if (!txt) { props.toast && props.toast("还没写呢"); return; }
      const newIdx = (f.chapters || []).length;
      props.onUpdate(f.id, function (fic) {
        fic.chapters = (fic.chapters || []).concat([{ content: txt, endHook: "", byMe: true }]);
        fic.updatedAt = Date.now(); return fic;
      });
      setMyChap(""); setMyWrite(false); setChapIdx(newIdx);
      props.toast && props.toast("接上去了");
    }
    async function loadReviews() {
      if (busyRev) return;
      setBusyRev(true);
      try {
        const rv = await window.Fanfic.genReviews(props.active, f, props.tab, storyLore("书评"), props.characters, props.userName, props.ficRegulars ? props.ficRegulars() : null);
        props.onUpdate(f.id, function (fic) { fic.reviews = (fic.reviews || []).concat(rv); return fic; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyRev(false);
    }
    // 我发一条顶层书评 → 生成 NPC（含作者）回复挂它下面
    // 同人图（她 2026-10-16）：头图、约画手产粮、出本。都是点了才画。
    async function drawArt(kind) {
      if (busyArt) return;
      if (!props.onFicImage) return;
      if (!props.active) { props.toast && props.toast("先在设置里配一条写文的线路"); return; }
      setBusyArt(kind);
      try {
        const cpText = cpLabel(f.cp, props.characters, props.userName);
        const painters = (f.reviews || []).filter(function (r) { return r && r.art; }).map(function (r) { return r.author; }).join("、");
        const d = await window.Fanfic.genFicArtBrief(props.active, f, kind, kind === "fanart" ? chapIdx : null, cpText, painters);
        if (kind === "book") {
          const cover = await props.onFicImage({ kind: "cover", cp: f.cp, scene: d.scene,
            poster: { title: f.title, tagline: String(d.tagline || "").slice(0, 24), genre: d.genre, mood: d.mood, credit: "by " + authorName } });
          if (!cover) return;
          const mark = await props.onFicImage({ kind: "bookmark", cp: f.cp, scene: d.scene });
          props.onUpdate(f.id, function (x) { x.book = { cover: cover, mark: mark || "", ts: Date.now() }; return x; });
          props.toast && props.toast("本子出好了，在点赞那一排底下");
        } else if (kind === "head") {
          const k = await props.onFicImage({ kind: "head", cp: f.cp, scene: d.scene });
          if (k) props.onUpdate(f.id, function (x) { x.art = Object.assign({}, x.art || {}, { head: k }); return x; });
        } else {
          const name = String(d.name || "").trim().slice(0, 12) || "路过的画手";
          const k = await props.onFicImage({ kind: "fanart", cp: f.cp, scene: d.scene, style: String(d.style || "").trim() });
          if (k) props.onUpdate(f.id, function (x) {
            x.reviews = (x.reviews || []).concat([{ id: uid("rv"), author: name, painter: true, art: k, artChap: chapIdx,
              content: String(d.say || "").trim() || "看完这一章没忍住，画了。", replies: [] }]);
            return x;
          });
        }
      } catch (e) { props.toast && props.toast("没画成：" + String((e && e.message) || e)); }
      finally { setBusyArt(""); }
    }
    async function postComment() {
      const txt = newComment.trim(); if (!txt) return;
      const rvId = uid("rv");
      props.onUpdate(f.id, function (fic) { fic.reviews = (fic.reviews || []).concat([{ id: rvId, author: props.userName || "我", me: true, content: txt, replies: [] }]); return fic; });
      setNewComment("");
      if (!props.active) return;
      setBusy("myrev");
      try {
        const reps = await window.Fanfic.genReplyToUser(props.active, f, props.tab, txt, "");
        if (reps.length) props.onUpdate(f.id, function (fic) { (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat(reps); }); return fic; });
        else props.toast && props.toast("读者们暂时没接话，点这条书评可再催一次");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy("");
    }
    // 我回复某条书评 → 也生成 NPC（含作者）回复
    async function sendReply(rvId) {
      const txt = replyText.trim(); if (!txt) return;
      const rv = (f.reviews || []).find(function (r) { return r.id === rvId; }) || {};
      const ctx = "「" + rv.author + "」：" + rv.content + (rv.replies || []).map(function (x) { return "\n「" + x.author + "」：" + x.content; }).join("");
      props.onUpdate(f.id, function (fic) {
        (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat([{ id: uid("rp"), author: props.userName || "我", content: txt, me: true }]); });
        return fic;
      });
      setReplyText(""); setReplyTo(null);
      if (!props.active) return;
      setBusy("myrep");
      try {
        const reps = await window.Fanfic.genReplyToUser(props.active, f, props.tab, txt, ctx);
        if (reps.length) props.onUpdate(f.id, function (fic) { (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat(reps); }); return fic; });
        else props.toast && props.toast("没人接话，稍后再试一次");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy("");
    }

    const _heat = f.stats || ficHeat(f.id);
    const _words = ficWords(f);
    const _hasMe = ficHasMe(f);
    // AO3 的 work header：标题 by 作者 / 关系 / 一整块标签 / 底下那行统计。
    // 原先这里是 Head 那块 30px 大标题「阅读」，标题本身反而排在下面（v58.02）。
    const metaRow = function (label, node) {
      return h("div", { className: "flex", style: { gap: 9, marginTop: 6 }, "data-wk": "ficreadermetarow" },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: "0.14em", color: t.fog, width: 58, flexShrink: 0, paddingTop: 3 } }, label),
        h("div", { className: "flex-1 min-w-0" }, node));
    };
    // 阅读页的皮肤压到六成：这一页要读几千字，纹理不能跟正文抢。
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { strength: .6 }), "data-wk": "ficreadermetarow", "data-part": "r2" },
      // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）：手写那条身上一个挂点都没有，
      // 「同人文」这一页的主题 CSS 因此抓不到顶栏。纸底铺在外壳上，所以 bg 传 transparent。
      h(Head, { zh: f.title, sub: props.tab.name, onBack: props.onBack, bg: "transparent", noLine: true,
        right: h("div", { className: "flex items-center justify-end shrink-0", style: { gap: 10 } },
          // 换这一篇的纸。⚠️只改这一篇，别的篇和默认那张都不动。
          h("button", { onClick: function () { setPaperOpen(true); }, className: "active:opacity-60", "aria-label": "换书页",
            style: { width: 20, height: 20, borderRadius: 5, background: _paper.bg, border: "1.5px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center" }, "data-wk": "ficreaderbtn", "data-part": "换书页" },
            h("span", { style: { width: 8, height: 1.5, background: _paper.ink, borderRadius: 1 } })),
          h("button", { onClick: function () { props.onToggleShelf(f.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: f.onShelf ? t.accent : t.fog }, "data-wk": "ficreaderbtn", "data-part": "2" }, f.onShelf ? "★" : "☆")) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { className: "flex items-start", style: { gap: 9 } },
          h("div", { style: { width: 3.5, alignSelf: "stretch", borderRadius: 2, background: _hasMe ? t.accent : t.line, marginTop: 5 } }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(23px * var(--app-fs, 1))", lineHeight: 1.28, color: t.ink, fontWeight: 500 } }, f.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "by " + authorName))),
        // 头图：有就挂在篇名底下，点开能放大、能存；没有就一颗小键
        (f.art && f.art.head) ? h("div", { style: { margin: "12px 0 2px", borderRadius: 6, overflow: "hidden" } },
          h(FicImg, { k: f.art.head, onClick: setArtView })) : null,
        props.onFicImage ? h("button", { onClick: function () { drawArt("head"); }, disabled: !!busyArt, className: "active:opacity-60",
          style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: busyArt === "head" ? t.fog : t.sub, background: "transparent", border: "1px dashed " + t.line, borderRadius: 999, padding: "5px 12px" }, "data-wk": "ficreaderbtn", "data-part": "head" },
          busyArt === "head" ? "在画头图…" : (f.art && f.art.head) ? "重画头图（花一次生图）" : "配个头图（花一次生图）") : null,
        metaRow((f.cp || []).length >= 3 ? "这几个" : "这一对",
          h("div", null,
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent } },
              cpLabel(f.cp, props.characters, props.userName) + (f.noCP ? " · 无CP" : String(f.groupWay || "").trim() ? " · " + String(f.groupWay).trim() : "")),
            cpEdit ? null : h("button", { onClick: function () { setCpEdit((f.cp || []).slice()); }, className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, background: "transparent", border: "none", padding: "0 10px", minHeight: 40 }, "data-wk": "ficreaderbtn", "data-part": "15" }, "改"),
            cpEdit ? h("div", { style: { marginTop: 6 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6, lineHeight: 1.6 } }, "按点的先后排：先点的是左位。一个不点＝原创向。存下以后，接下来的章照新的写，写好的不动。"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                [{ id: "me", name: props.userName || "我" }].concat((props.characters || []).filter(function (c) { return c && !c.npc; })).map(function (c) {
                  const at = cpEdit.indexOf(c.id);
                  return h("button", { key: c.id, onClick: function () { setCpEdit(at >= 0 ? cpEdit.filter(function (x) { return x !== c.id; }) : cpEdit.concat([c.id])); }, className: "active:opacity-60",
                    style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", minHeight: 40, padding: "0 12px", borderRadius: 999, border: "1px solid " + (at >= 0 ? t.accent : t.line), color: at >= 0 ? t.accent : t.sub, background: "transparent" }, "data-wk": "ficreaderbtn", "data-part": "16" },
                    (at >= 0 ? (at + 1) + " · " : "") + (c.remark || c.name));
                })),
              h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
                h("button", { onClick: function () { setCpEdit(null); }, className: "active:opacity-70", style: { minHeight: 40, padding: "0 14px", borderRadius: 12, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficreaderbtn", "data-part": "17" }, "不改了"),
                h("button", { onClick: function () { const next = cpEdit.slice(); props.onUpdate(f.id, function (fic) { fic.cp = next; fic.updatedAt = Date.now(); return fic; }); setCpEdit(null); props.toast && props.toast("CP 改好了"); }, className: "flex-1 active:opacity-80", style: { minHeight: 40, borderRadius: 12, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" }, "data-wk": "ficreaderbtn", "data-part": "18" }, "存下"))) : null,
            (function () {
              const gone = absentLeads(f, props.characters, props.userName);
              return gone.length ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a8392f", marginTop: 3, lineHeight: 1.6 } },
                "⚠️「" + gone.join("」「") + "」从头到尾没出现过——这一篇多半被写跑了") : null;
            })())),
        (f.tags || []).length ? metaRow("标签", h("div", { className: "flex flex-wrap", style: { gap: 5 } },
          (f.tags || []).map(function (tag, i) { return h(FicTag, { key: i, tag: tag }); }))) : null,
        metaRow("数目", h("div", { className: "flex flex-wrap", style: { gap: 9, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, paddingTop: 1 } },
          h("span", null, fmtNum(_words) + " 字"),
          h("span", null, (f.chapters || []).length + " 章"),
          h("span", null, "♡ " + fmtNum(_heat.kudos + (f.liked ? 1 : 0))),
          h("span", null, "评 " + ((f.reviews || []).length)))),
        h("div", { style: { height: 1, background: t.line, margin: "14px 0 4px" } }),
        // 点赞 / 转发
        h("div", { className: "flex items-center gap-4 mb-5" },
          h("button", { onClick: function () { props.onLike(f.id); }, className: "active:opacity-60 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: f.liked ? t.accent : t.sub }, "data-wk": "ficreaderbtn", "data-part": "3" },
            h(IHeart, { size: 16, color: f.liked ? t.accent : t.sub, filled: f.liked }), f.liked ? "已赞" : "点赞"),
          h("button", { onClick: function () { setFwdOpen(true); }, className: "active:opacity-60 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficreaderbtn", "data-part": "4" },
            h(IRepeat, { size: 16, color: t.sub }), "转发"),
          // 出本：本子封面＋一张无料书签，两次生图
          props.onFicImage ? h("button", { onClick: function () { drawArt("book"); }, disabled: !!busyArt, className: "active:opacity-60 flex items-center gap-1.5",
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: busyArt === "book" ? t.fog : t.sub }, "data-wk": "ficreaderbtn", "data-part": "book" },
            busyArt === "book" ? "在印本子…" : f.book ? "再出一版本子" : "出本") : null,
          h("button", { onClick: function () {
            // 滚到这一页的最底下（续写、书评都在那儿）：往上找真正在滚的那一层
            let el = chapRef.current; while (el && !(el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, className: "active:opacity-60",
            style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficreaderbtn", "data-part": "tobottom" }, "↓ 到底")),
        f.book ? h("div", { className: "flex", style: { gap: 10, alignItems: "flex-end", margin: "-6px 0 20px" } },
          h("div", { style: { width: "58%", borderRadius: 3, overflow: "hidden", boxShadow: "0 6px 14px -6px " + hexA(t.ink, .45) } }, h(FicImg, { k: f.book.cover, onClick: setArtView })),
          f.book.mark ? h("div", { style: { width: "22%", borderRadius: 3, overflow: "hidden", boxShadow: "0 4px 10px -5px " + hexA(t.ink, .4) } }, h(FicImg, { k: f.book.mark, onClick: setArtView, style: { aspectRatio: "1 / 3", objectFit: "cover" } })) : null,
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.fog } }, "本子封面", f.book.mark ? h("br") : null, f.book.mark ? "＋无料书签" : null)) : null,
        // 章节（翻页，不再一路下滑；顶部+底部箭头 + 左右滑动）
        (function () {
          const chs = f.chapters || [];
          const idx = Math.min(Math.max(0, chapIdx), Math.max(0, chs.length - 1));
          const ch = chs[idx] || {};
          const btn = function (label, to, disabled) { return h("button", { onClick: function () { goChap(to); }, disabled: disabled, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: disabled ? t.line : t.sub, padding: "2px 4px" }, "data-wk": "ficreaderbtn", "data-part": "r5" }, label); };
          const pager = function (top) { return chs.length > 1 ? h("div", { className: "flex items-center justify-between " + (top ? "mb-4 pb-2" : "mt-5 pt-3"), style: (top ? { borderBottom: "1px solid " + t.line } : { borderTop: "1px solid " + t.line }) },
            btn("‹ 上一章", idx - 1, idx <= 0),
            h("button", { onClick: function () { setTocOpen(true); }, className: "active:opacity-60", "data-wk": "ficreaderbtn", "data-part": "toc", style: { background: "transparent", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, textAlign: "center", lineHeight: 1.35 } },
              h("span", { style: { display: "block" } }, "第 " + (idx + 1) + " / " + chs.length + " 章 ▾"),
              // 这一章的笔在谁手上：她自己写的、或请了谁代笔。原作者自己写的那几章不标
              // （每一章都写一遍「by 某某」＝等于没标）。
              (ch.byMe || ch.byAuthor || ch.grabbed) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: ch.grabbed ? t.tint : t.fog, opacity: ch.grabbed ? 1 : .8 } },
                ch.grabbed ? "「" + (f.author || "原作者") + "」抢回去自己写的" : (ch.byMe ? "你写的" : ch.byAuthor + " 代笔")) : null),
            btn("下一章 ›", idx + 1, idx >= chs.length - 1)) : null; };
          return h("div", {
            ref: chapRef,
            className: "mb-6",
            style: { scrollMarginTop: 8 },
            // 翻页手势必须「横向显著大于纵向」：之前只看 dx，下滑读文时手指稍斜就被当成翻上一章，
            // 一路卡回第一章还跳章首（她报的 bug 根因）
            onTouchStart: function (e) { swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
            onTouchEnd: function (e) { const s = swipeRef.current || { x: 0, y: 0 }; const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y; if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return; if (dx < 0) goChap(idx + 1); else goChap(idx - 1); }, "data-wk": "ficreaderpager"
          },
            pager(true),
            // 正文按【读小说】排：字大一档、行距松开、段与段之间留白。
            // AO3 是不缩进＋段间距那一派，中文长文这样读着最不累（v58.02）。
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 2.05, color: t.ink, letterSpacing: "0.01em" } },
              editIdx === idx ? h("div", null,
                h("textarea", { "data-wk": "textarea", value: editTxt, onChange: function (e) { setEditTxt(e.target.value); },
                  className: "w-full outline-none", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, padding: "13px 14px", borderRadius: 12,
                    background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 320, resize: "vertical" }, "data-wk": "ficreadertext", "data-part": "改这一章" }),
                h("div", { className: "flex", style: { gap: 8, marginTop: 9 } },
                  h("button", { onClick: function () { setEditIdx(-1); setEditTxt(""); }, className: "active:opacity-70",
                    style: { minHeight: 44, padding: "0 16px", borderRadius: 12, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficreaderbtn", "data-part": "12" }, "不改了"),
                  h("button", { onClick: function () { saveEditChapter(idx); }, className: "flex-1 active:opacity-80",
                    style: { minHeight: 44, borderRadius: 12, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" }, "data-wk": "ficreaderbtn", "data-part": "13" }, "改好了"))) :
              String(ch.content || "").split(/\n\s*\n|\n/).filter(function (x) { return x.trim(); }).map(function (para, pi) {
                return h("p", { key: pi, style: { margin: "0 0 1.05em" } }, para.trim());
              })),
            ((ch.cot || ch.cotRequested) && typeof CotReveal === "function") ? h(CotReveal, { cot: ch.cot, requested: ch.cotRequested }) : null,
            // 原作者看完这一章在底下留的那句话。挂在【这一章】上，所以它出现在这儿，
            // 不是混在书评区里（书评区那边只渲染不带 chapterIdx 的——一份数据，两处各管各的）。
            (function () {
              const notes = (f.reviews || []).filter(function (r) { return r && r.chapterIdx === idx; });
              if (!notes.length) return null;
              return h("div", { style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid " + t.line }, "data-wk": "ficreader", "data-part": "r2" },
                notes.map(function (r) {
                  return h("div", { key: r.id, style: { marginBottom: 6 }, "data-wk": "ficreader", "data-part": "r3" },
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint, marginBottom: 3 } }, r.author, authorTag(t)),
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: t.sub } }, r.content));
                }));
            })(),
            // 记进房间 / 拿给TA看。⚠️**不自动发生**：她按一下才有
            //（自动往主线记忆库写那一版是错的，撤掉了）。这一步一分钱不花。
            h("div", { style: { marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
              h("button", { onClick: function () { setFileIdx(idx); }, className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 34 }, "data-wk": "ficreaderbtn", "data-part": "6" },
                ch.byCharId ? "记进房间" : "拿给TA看"),
              editIdx !== idx ? h("button", { onClick: function () { setEditIdx(idx); setEditTxt(String(ch.content || "")); }, className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 40 }, "data-wk": "ficreaderbtn", "data-part": "14" },
                "改这一章") : null,
              editIdx !== idx && chs.length > 1 ? h("button", { onClick: function () { deleteChapter(idx); }, className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#b4463a", background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 40 }, "data-wk": "ficreaderbtn", "data-part": "delchap" },
                "删掉这一章") : null,
              filedNote ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, filedNote) : null),
            // 偷懒的那一章不许悄无声息地落盘（她 2026-09-11）。
            // ⚠️只留一行字 + 一颗键，**绝不自动再打一枪**——她定的：任何东西都不接受一次发两遍。
            (function () {
              const miss = window.Fanfic.shortBy(ch.content, minChars);
              if (!miss) return null;
              return h("div", { style: { marginTop: 14, paddingTop: 10, borderTop: "1px dashed " + t.line, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, "data-wk": "ficreader", "data-part": "r4" },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6 } },
                  "这章只有 " + window.Fanfic.countChars(ch.content) + " 字，你要的是 " + minChars + " 字"),
                h("button", { onClick: function () { moreChapter(idx); }, disabled: busyMore, className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: busyMore ? t.fog : t.accent, background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 34 }, "data-wk": "ficreaderbtn", "data-part": "7" },
                  busyMore ? "接着写…" : "让TA接着写"));
            })(),
            pager(false),
            // 目录：点「第 N / M 章」弹出来，点哪章跳哪章
            tocOpen ? h("div", { onClick: function () { setTocOpen(false); }, style: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.32)", display: "flex", alignItems: "flex-end" } },
              h("div", { onClick: function (e) { e.stopPropagation(); }, "data-wk": "ficreader", "data-part": "toc", style: { width: "100%", maxHeight: "70vh", overflowY: "auto", background: t.bg, borderRadius: "18px 18px 0 0", padding: "16px 18px calc(env(safe-area-inset-bottom) + 18px)" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "目录 · " + chs.length + " 章"),
                chs.map(function (c, k) {
                  const by = c.grabbed ? (f.author || "原作者") + " 抢回去写的" : c.byMe ? "你写的" : c.byAuthor ? c.byAuthor + " 代笔" : "";
                  const first = String(c.content || "").replace(/\s+/g, " ").trim().slice(0, 34);
                  return h("button", { key: k, onClick: function () { setTocOpen(false); goChap(k); }, className: "w-full text-left active:opacity-60",
                    style: { display: "block", padding: "10px 2px", borderTop: k ? "1px solid " + t.line : "none", background: "transparent" } },
                    h("div", { className: "flex items-baseline", style: { gap: 8 } },
                      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: k === idx ? t.accent : t.ink } }, "第 " + (k + 1) + " 章"),
                      by ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, by) : null,
                      k === idx ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent } }, "在读") : null),
                    first ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, first + "…") : null);
                }))) : null);
        })(),

        // 续写：两个入口（v64.63，她 2026-09-06：「我写了的为啥只能追更！
        // 应该换成两个入口一个是我续写一个是请枪手再让模型继续」）。
        // ⚠️原来这里只有一颗「追更」＝只能让模型写。她自己写的文，凭什么下一章轮不到她。
        myWrite ? h("div", { style: { marginBottom: 32 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginBottom: 7 } }, "第 " + ((f.chapters || []).length + 1) + " 章 · 你自己写"),
          h("textarea", { "data-wk": "textarea", value: myChap, onChange: function (e) { setMyChap(e.target.value); }, placeholder: "接着往下写…",
            className: "w-full outline-none", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, padding: "13px 14px", borderRadius: 12,
              background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 260, resize: "vertical" }, "data-wk": "ficreadertext", "data-part": "接着往下写…" }),
          h("div", { className: "flex", style: { gap: 8, marginTop: 9 } },
            h("button", { onClick: function () { setMyWrite(false); setMyChap(""); }, className: "active:opacity-70",
              style: { minHeight: 44, padding: "0 16px", borderRadius: 12, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficreaderbtn", "data-part": "8" }, "算了"),
            h("button", { onClick: saveMyChapter, className: "flex-1 active:opacity-80",
              style: { minHeight: 44, borderRadius: 12, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" }, "data-wk": "ficreaderbtn", "data-part": "9" }, "写好了，接上去"))) : null,
        !myWrite ? h("div", { className: "flex", style: { gap: 8, marginBottom: 32 } },
          h("button", { onClick: function () { setMyWrite(true); }, className: "flex-1 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, minHeight: 46, borderRadius: 12, border: "1px solid " + t.ink, background: "transparent" }, "data-wk": "ficreaderbtn", "data-part": "10" },
            "我来写下一章"),
          h("button", { onClick: function () { setGhostOpen(true); }, disabled: busyChap, className: "flex-1 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.sub, minHeight: 46, borderRadius: 12, border: "1px dashed " + t.line, background: "transparent", opacity: busyChap ? 0.5 : 1 }, "data-wk": "ficreaderbtn", "data-part": "11" },
            busyChap ? "枪手写着呢…" : "请枪手接着写")) : null,

        // 书评区
        h("div", { className: "flex items-center justify-between mb-3", style: { gap: 10 } },
          // ⚠️数的是【这儿显示的】那些：挂在某一章上的留言在那一章底下，不在这儿——
          //   把它也数进来，就会出现「书评 · 2」底下只有一条的怪事
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink } }, "书评 · " + (f.reviews || []).filter(function (r) { return r && r.chapterIdx == null; }).length),
          h("button", { onClick: loadReviews, disabled: busyRev, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficreaderbtn", "data-part": "12" }, busyRev ? "召唤读者中…" : "刷出书评"),
          // 约一张图：圈里一位画手读完这一章画一张，带着图交到书评区（花一次生图）
          props.onFicImage ? h("button", { onClick: function () { drawArt("fanart"); }, disabled: !!busyArt, className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: busyArt === "fanart" ? t.fog : t.accent, marginLeft: "auto" }, "data-wk": "ficreaderbtn", "data-part": "fanart" },
            busyArt === "fanart" ? "画手在画…" : "约一张图") : null),
        // 我直接写书评
        h("div", { className: "flex items-center gap-2 mb-4" },
          h("input", { "data-wk": "input", value: newComment, onChange: function (e) { setNewComment(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") postComment(); }, placeholder: "写条书评…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "8px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficreaderinput", "data-part": "写条书评…" }),
          h("button", { onClick: postComment, disabled: busy === "myrev", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent, padding: "0 4px" }, "data-wk": "ficreaderbtn", "data-part": "13" }, busy === "myrev" ? "…" : "发表")),
        (function () {
          // ⚠️这颗按钮只此一份：楼主那一行和楼中楼那一行都是它。
          //   各写一份的结果就是「楼主点得进、回复里点不进」——同一件事写在两处的老毛病。
          // 论坛那批熟面孔换了读书 id 来评：名字后面挂个小标，跟片刻同一个样子（2026-10-26）
          const ficRegTag = function (r) { return r && r.reg ? h("span", { "data-wk": "ficregtag", style: { marginLeft: 4, padding: "0 4px", borderRadius: 4, fontSize: "calc(9.5px * var(--app-fs, 1))", border: "1px solid " + t.line, color: t.fog } }, "熟面孔") : null; };
          const penName = function (r, size) {
            return (r.pen && props.onOpenAuthor)
              ? h("button", { onClick: function () { props.onOpenAuthor(r.pen); }, className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: size, color: "inherit", background: "transparent", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }, "data-wk": "ficreaderbtn", "data-part": "14" }, r.author)
              : r.author;
          };
          const rs = (f.reviews || []).filter(function (r) { return r && r.chapterIdx == null; }); return rs.length ? rs.map(function (r) {
          return h("div", { key: r.id, className: "mb-3 pb-3", style: { borderBottom: "1px solid " + t.line }, "data-wk": "ficreader", "data-part": "r5" },
            // 名册里那几位：名字点得进她的主页（路人读者没有主页，照旧是死的）
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: r.me ? t.accent : (r.isAuthor ? t.tint : t.fog), marginBottom: 3 } },
              penName(r, 12),
              r.isAuthor ? authorTag(t) : null, ficRegTag(r)),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: t.ink } }, r.content),
            r.art ? h("div", { style: { marginTop: 8, width: "72%", borderRadius: 4, overflow: "hidden" } }, h(FicImg, { k: r.art, onClick: setArtView })) : null,
            r.art && r.artChap != null ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "画的是第 " + (r.artChap + 1) + " 章") : null,
            (r.replies || []).map(function (rp) {
              return h("div", { key: rp.id, className: "mt-2 ml-3 pl-3", style: { borderLeft: "2px solid " + t.line }, "data-wk": "ficreader", "data-part": "r6" },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: rp.me ? t.accent : (rp.isAuthor ? t.tint : t.fog) } }, penName(rp, 11.5), ficRegTag(rp), "：", rp.isAuthor ? authorTag(t) : null),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub } }, rp.content));
            }),
            replyTo === r.id
              ? h("div", { className: "flex items-center gap-2 mt-2" },
                  h("input", { "data-wk": "input", value: replyText, autoFocus: true, onChange: function (e) { setReplyText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendReply(r.id); }, placeholder: "回复…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 10px", borderRadius: 8, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficreaderinput", "data-part": "回复…" }),
                  h("button", { onClick: function () { sendReply(r.id); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficreaderbtn", "data-part": "15" }, "发送"))
              : h("button", { onClick: function () { setReplyTo(r.id); setReplyText(""); }, className: "mt-1.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog }, "data-wk": "ficreaderbtn", "data-part": "16" }, "回复"));
        }) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "8px 0" } }, "还没有书评，写一条或点「刷出书评」召唤一批读者。"); })()),
      artView ? h(FicArtView, { k: artView, toast: props.toast, onClose: function () { setArtView(null); } }) : null,
      // 只给这一篇换纸（她 2026-08-30：「每一篇可以单独设置」）
      paperOpen ? h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: function () { setPaperOpen(false); }, "data-wk": "ficreadertap", "data-part": "1" },
        h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "72vh", overflowY: "auto" }, "data-wk": "ficreadertap", "data-part": "2" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink } }, "这一篇的书页"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "4px 0 14px", lineHeight: 1.5 } },
            "只换《" + f.title + "》这一篇；别的篇和默认那张都不动。"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
            FIC_PAPERS.map(function (pp) {
              return h(PaperSwatch, {
                key: pp.id, paper: pp, on: _paper.id === pp.id,
                onPick: function () { props.onSetPaper && props.onSetPaper(pp.id); setPaperOpen(false); }
              });
            })),
          // 跟着默认走＝把这一篇的单独设置撤掉，不是再选一张
          f.paper ? h("button", {
            onClick: function () { props.onSetPaper && props.onSetPaper(""); setPaperOpen(false); },
            className: "w-full active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "12px 0 2px" }, "data-wk": "ficreaderbtn", "data-part": "17"
          }, "跟着默认书页走") : null)) : null,
      fwdOpen ? h(FwdSheet, { characters: props.fwdChars || props.characters, groups: props.groups, onClose: function () { setFwdOpen(false); },
        onPickChar: function (c) { setFwdOpen(false); props.onForwardToChat && props.onForwardToChat(f, c); },
        onPickGroup: function (g) { setFwdOpen(false); props.onForwardToGroup && props.onForwardToGroup(f, g); } }) : null,
      fileIdx >= 0 ? h(FilePage, {
        fic: f, chapIdx: fileIdx,
        chars: (props.fwdChars || props.characters || []).filter(function (c) { return c && !c.npc; }),
        defaultCharId: ((f.chapters || [])[fileIdx] || {}).byCharId || "",
        // 房↔文那根线（v67.66）：那颗「只记一笔」要写清楚这一笔落在哪儿
        ficRoomOf: props.ficRoomOf,
        onClose: function () { setFileIdx(-1); },
        onFile: function (c, noteOnly, roomPick) {
          if (!c) return;
          const i = fileIdx;
          const ch2 = (f.chapters || [])[i] || {};
          const mine = ch2.byCharId === c.id;
          const nm = c.remark || c.name;
          if (noteOnly) {
            // v67.66：这一笔落在【这一篇发生的那间房】；没进过房的照旧进记忆库。
            // 回执照实说落在哪儿——「记了一笔」三个字在两种落点下都成立，等于什么都没说。
            const rn = props.onNoteChapter && props.onNoteChapter(c.id, window.Fanfic.chapterNote(f, i, nm, mine, props.userName), f.id);
            const wh = rn && rn.where;
            setFiledNote(wh === "room" ? "记进了「" + (rn.roomName || "那间房") + "」——只在那儿算数"
              : wh === "gone" ? "这一篇挂着的那间房已经不在了，没处记"
              : "记了一笔");
          } else {
            // 卡上要露的那几样（她 2026-09-11：「把我转发给TA的也做成卡吧」）——
            // 跟转发那张同一套字段，所以共用同一张卡
            const r = props.onFileChapter && props.onFileChapter(c.id, window.Fanfic.chapterCard(f, i, nm, mine, props.userName), roomPick,
              { ficId: f.id, ficTitle: f.title, author: f.author || "",
                cpText: cpLabel(f.cp, props.characters, props.userName),
                note: "第 " + (i + 1) + " 章 · " + (mine ? "TA写的" : "拿给你看"),
                // ⚠️这儿的那一章叫 ch2（ch 在这个闭包里压根不存在）——
                //   写成 ch.content 就是当场抛异常，按钮看着像死的（她 2026-09-11 报）。
                excerpt: String(ch2.content || "").trim().slice(0, 90) });
            setFiledNote(r ? "放进了「" + r.roomName + "」" : "没能放进去");
          }
          setFileIdx(-1);
        }
      }) : null,
      ghostOpen ? h(GhostPage, { fic: f, pickedId: ghostId, backBusy: busyBack, onAskBack: askAuthorBack,
        chars: (props.fwdChars || props.characters || []).filter(function (c) { return c && !c.npc; }), relOf: props.relOf,
        onPick: function (id) { setGhostId(id); },
        onClose: function () { setGhostOpen(false); },
        onGo: function (by, want, hard) { setGhostOpen(false); addChapter(by, want, hard); } }) : null);
  }

  // ---------- 请谁接着写（v64.64，她 2026-09-06：「请枪手可以选择已有的作者吧，也可以不选」）
  // 整页，不是半窗（no-half-sheet.md）：一位太太一行两句，作者库能攒到几十位，
  // 半窗一掀就只剩三四行——「拿不准就用整页」。
  function GhostPage(props) {
    const t = useTheme();
    const f = props.fic;
    const authors = loadAuthors();
    const own = String(f.author || "").trim();
    // 点单：她想看的剧情走向（她 2026-09-11）。两档由她自己选，不按作者身份分权——
    // 分权的乐趣在于不确定，而不确定只有在她自愿的时候才是乐趣。
    const [want, setWant] = useState("");
    const [hard, setHard] = useState(false);
    const lastWant = String(f.lastWant || "").trim();
    // 「照原样」那一行：名册里认得这篇的太太就写她的名字——她自己的连载本来就该她接着写。
    const ownCard = findAuthor(own);
    const quit = !!f.authorQuit;
    const head = { id: "", quit: quit,
      name: quit ? "「" + own + "」这篇不写了" : (ownCard ? "照原样：「" + own + "」自己接着写" : (own ? "照原样：「" + own + "」接着写" : "随缘（谁接都行）")),
      // ⚠️这一行写她【真正的路数】，不是一句「会带进这一章」的空话——
      //   旁边那两位列的都是自己的路数，这一行摆句解说词就成了另一种东西。
      style: quit ? (String(f.quitSay || "").slice(0, 80) || "她撂挑子了，这一章只能另请人接")
        : (ownCard ? (ownCard.style || "她的路数、雷点都会带进这一章") : (own ? "名册里还没有这位太太的卡，只按前情往下写" : "模型自己接，不钉笔名")),
      sore: quit ? "" : (ownCard ? ownCard.sore : "") };
    // ④：跟这篇原作者有过节的，在她名下标一行小字——请谁接手这件事就有了分量
    const circle = loadCircle();
    // ⚠️没 id 的太太（早期存档、或从别处导进来的）会跟「照原样」那一行撞上同一个 key
    //   （两边都落成 "_own"）：React 拿它俩当同一格，翻到「你的人」那一叠之后，
    //   「照原样」那行还赖在名单顶上；点她也等于点了「照原样」，最后接笔的是原作者。
    //   笔名在库里本来就是唯一的（upsertAuthor 按笔名去重），拿它兜个 id 就够。
    const penRows = authors.filter(function (a) { return authorName(a) !== own; }).map(function (a) {
      return Object.assign({}, a, { id: a.id || ("au:" + authorName(a)) },
        own ? { feud: circleFeud(own, authorName(a), circle) } : {});
    });
    // 第三类笔：她自己的人。⚠️这一行的 style 写的是【TA跟这篇文什么关系】，
    //   不是一句「TA会按人设写」的空话——那正是旁边两组都在说的那种实话。
    const charRows = (props.chars || []).map(function (c) {
      const st = stanceFor(c, f, (props.relOf && props.relOf(c.id)) || {});
      const zh = { self_user: characterText(c, "这篇写的就是他和你"), self_other: characterText(c, "这篇把他跟别人配了"),
        jealous: characterText(c, "你在里面，他不在"), tied: characterText(c, "他跟里面那位有关系"), outsider: characterText(c, "跟他没关系，纯帮忙") };
      return { id: "char:" + c.id, name: (c.remark || c.name) + "（你的人）", style: zh[st.kind] || "", char: c };
    });
    // ⚠️分两叠（她 2026-09-11：「请枪手写能不能把作者和角色分成两个 tab」）。
    //   ⚠️不是一排药丸（tabs-not-plain-pills.md）：这一页是【找人代笔的委托单】，
    //   委托单分栏靠的是「你翻到哪一页」——所以做成两张纸的页签：
    //   翻开的那张满高、纸色、直接长进底下的名单里；压在后面那张矮一截、暗着。
    //   选中态不只靠色：高度、字重、跟底下那张纸连不连着，三样一起变。
    const [pane, setPane] = useState("pen");
    const rows = pane === "pen" ? [head].concat(penRows) : charRows;
    const picked = rows.filter(function (a) { return (a.id || "") === (props.pickedId || ""); })[0] || rows[0] || head;
    const pageTab = function (key, label, n) {
      const on = pane === key;
      return h("button", { key: key, onClick: function () { setPane(key); props.onPick(""); }, className: "active:opacity-70",
        style: { flex: 1, minHeight: 44, padding: on ? "11px 6px 13px" : "14px 6px 10px",
          border: "1px solid " + t.line, borderBottom: on ? "none" : "1px solid " + t.line,
          borderRadius: "10px 10px 0 0", background: on ? t.bg : "transparent", marginBottom: on ? -1 : 3,
          fontFamily: F_BODY, fontSize: on ? 13 : 12, fontWeight: on ? 600 : 400, color: on ? t.ink : t.fog,
          position: "relative", zIndex: on ? 2 : 1 }, "data-wk": "ficghostpage", "data-on": on ? "1" : "0" },
        label + (n ? " · " + n : ""));
    };
    const ghostPicked = !!picked.id;
    // ⚠️这两格不是一排药丸（施工规则/tabs-not-plain-pills.md）：这一页是【给太太的稿约单】，
    //   所以它长成单子上那两行勾选项——方框、打勾、底下一道格线。换个 app 就不成立了。
    const optRow = function (on, title, note, onPick) {
      return h("button", { onClick: onPick, className: "w-full text-left active:opacity-70",
        style: { display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px dashed " + t.line }, "data-wk": "ficghostpageoptrow" },
        h("span", { style: { width: 14, height: 14, marginTop: 3, flexShrink: 0, borderRadius: 2, border: "1px solid " + (on ? t.ink : t.line), display: "flex", alignItems: "center", justifyContent: "center" } },
          on ? h(ICheck, { size: 10, color: t.ink }) : null),
        h("span", { style: { minWidth: 0 } },
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, title),
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.55 } }, note)));
    };
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }), "data-wk": "ficghostpageoptrow", "data-part": "r2" },
      h(Head, { bg: "transparent", zh: "请谁接着写", sub: "《" + f.title + "》第 " + ((f.chapters || []).length + 1) + " 章", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-4" },
        h("div", { style: { display: "flex", gap: 6, marginTop: 8, alignItems: "flex-end" } },
          pageTab("pen", "圈里的太太", penRows.length), pageTab("char", "你的人", charRows.length)),
        h("div", { style: { border: "1px solid " + t.line, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "2px 10px 6px" } },
        // ⚠️不是一排药丸：署名表上的一行行名字，选中那行左边落一个墨点、名字加重
        //   （tabs-not-plain-pills.md：换个 app 就不成立的形状才算长出来了）
        rows.map(function (a) {
          const on = (a.id || "") === (picked.id || "");
          return h("button", { key: a.id || "_own", disabled: !!a.quit, onClick: function () { props.onPick(a.id || ""); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line, opacity: a.quit ? .55 : 1 }, "data-wk": "ficghostpage", "data-part": "r2" },
            h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 7, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, a.name),
              a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.55 } }, a.style) : null,
              (on && a.sore) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.55 } }, "护着：" + a.sore) : null,
              a.feud ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.tint, marginTop: 3 } }, "她跟「" + own + "」有过节") : null));
        }),
        rows.length ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, padding: "10px 2px", lineHeight: 1.7 } },
          pane === "pen" ? "作者库还空着。出一批文、或去「作者」那一页请几位太太进来，之后就能点名让谁接。"
            : "还没有角色。角色接的那一章，原作者照样会在底下说话——但她抢不回去。")),
        // 能翻脸就得能和好：不然作者库单向枯竭，攒三十位太太最后一个都不肯写
        quit ? h("button", { onClick: props.onAskBack, disabled: !!props.backBusy, className: "w-full active:opacity-70",
          style: { marginTop: 12, minHeight: 44, borderRadius: 12, border: "1px dashed " + t.line, background: "transparent",
            fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: props.backBusy ? t.fog : t.accent }, "data-wk": "ficghostpagebtn", "data-part": "askback" },
          props.backBusy ? "去问她…" : "去请「" + own + "」回来") : null,

        // ── 点单 ──
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, margin: "22px 0 4px" } }, "这一章你想看什么"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 8, lineHeight: 1.6 } },
          "空着就让她自己写。"),
        h("textarea", { "data-wk": "textarea", value: want, onChange: function (e) { setWant(e.target.value); }, placeholder: "想看的走向、想让谁出场、想在哪儿收…",
          className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, padding: "11px 12px", borderRadius: 10,
            background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 84, resize: "vertical" }, "data-wk": "ficghostpagetext", "data-part": "想看的走向、想让谁出场、" }),
        (lastWant && !want.trim()) ? h("button", { onClick: function () { setWant(lastWant); }, className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent, background: "transparent", border: "none", padding: "7px 2px", minHeight: 34, textAlign: "left" }, "data-wk": "ficghostpagebtn", "data-part": "2" },
          "填回上次那条：" + lastWant.slice(0, 22) + (lastWant.length > 22 ? "…" : "")) : null,
        want.trim() ? h("div", { style: { marginTop: 6 } },
          optRow(!hard, "许个愿", ghostPicked
            ? "当读者的呼声递过去。她是被请来接这篇的，多半会顺着走，但不必当命令。"
            : "当读者的呼声递过去。这是她自己的连载——听不听、怎么听，按她的脾气来。",
            function () { setHard(false); }),
          optRow(hard, "就这么写", "点单。这件事这一章里真的要发生，不许挪到下一章、不许一句带过。",
            function () { setHard(true); })) : null),
      h("div", { className: "shrink-0 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        h("button", { onClick: function () { if (!picked.quit) props.onGo(picked.id ? picked : null, want.trim(), hard); },
          disabled: !!picked.quit, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: picked.quit ? t.line : t.ink, minHeight: 46, borderRadius: 12, border: "none" }, "data-wk": "ficghostpagebtn", "data-part": "3" },
          picked.quit ? "得先请她回来，或者另找一位" : (picked.id ? "就请「" + picked.name + "」写" : "开始写"))));
  }

  // ---------- 拿给谁看 / 记进哪间房（v66.79，她 2026-09-11）----------
  // 整页，不是半窗（no-half-sheet.md）：角色能有几十个，半窗一掀只剩三四行。
  function FilePage(props) {
    const t = useTheme();
    const f = props.fic, idx = props.chapIdx;
    const ch = (f.chapters || [])[idx] || {};
    const rows = props.chars || [];
    const [pick, setPick] = useState(props.defaultCharId || (rows[0] && rows[0].id) || "");
    const picked = rows.filter(function (c) { return c.id === pick; })[0] || null;
    // ⚠️她 2026-09-11：「现在只能默认进已有的房间而不能另开，如果我有好几个房间就选不了了」。
    //   原来这儿只算出【最近动过的那一间】，她连看都看不见，更别说挑。
    const roomsOf = function (cid) {
      const K = (typeof window !== "undefined" && window.ChatRooms) || null;
      if (!K || !cid) return [];
      return K.list(cid).filter(function (r) { return r && !r.main && r.actions && r.actions.fanfic; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    };
    const myRooms = roomsOf(pick);
    // "" ＝ 用最近动过的那一间（和以前一样）；"__new" ＝ 另开一间
    const [roomId, setRoomId] = useState("");
    const [newName, setNewName] = useState("一起写");
    // 换个人就把房间的选择清掉：那是另一个人的房间
    const pickChar = function (id2) { setPick(id2); setRoomId(""); };
    const roomTarget = function () {
      if (roomId === "__new") return { id: "", name: String(newName || "").trim().slice(0, 20) || "一起写" };
      return { id: roomId, name: "" };
    };
    const mine = !!(ch.byCharId && picked && ch.byCharId === picked.id);
    // 这一篇在TA那儿发生在哪间房（v67.66）：按钮上要写清楚这一笔会落在哪儿，
    // 不能还写着「不进房间」——那已经不是它做的事了。
    const noteRoom = (props.ficRoomOf && picked) ? props.ficRoomOf(picked.id, f.id) : null;
    const btn = function (label, primary, onClick) {
      return h("button", { onClick: onClick, disabled: !picked, className: "w-full active:opacity-80",
        style: { fontFamily: F_BODY, fontSize: primary ? 14 : 13, minHeight: primary ? 46 : 42, borderRadius: 12, marginTop: primary ? 0 : 8,
          border: primary ? "none" : "1px solid " + t.line, background: primary ? t.ink : "transparent", color: primary ? t.bg2 : t.sub }, "data-wk": "ficfilepagebtn" }, label);
    };
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }), "data-wk": "ficfilepagebtn", "data-part": "r2" },
      h(Head, { bg: "transparent", zh: "拿给谁看", sub: "《" + f.title + "》第 " + (idx + 1) + " 章", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-4" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.75, margin: "2px 0 10px" } },
          "落进去的是一张卡：这件事发生过、开头两百字。全文还在同人文里。",
          // ⚠️她 2026-09-11 问：「那我要TA接写了很多章的只能一章一章发给TA嘛」——
          //   不用，可界面上从来没说过这件事，她只能照着上面那句「开头两百字」猜。
          // ⚠️界面上的字不许写 markdown：**这样**会原样显示出来（踩过两次）
          h("br"), "放一张就够：这一篇的地基、设定卡、还埋着的伏笔、每一章结束在哪儿、"
          + characterText(picked, "上一章的结尾，都会跟着进他手里——写了多少章都一样，不用一章一章发。"),
          h("br"), characterText(picked, "这一步不花钱——喂给他只是放进他的上下文，让他开口才要。")),
        rows.map(function (c) {
          const on = c.id === pick;
          return h("button", { key: c.id, onClick: function () { pickChar(c.id); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficfilepage" },
            h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 7, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } },
                (c.remark || c.name) + (ch.byCharId === c.id ? characterText(c, "（这一章就是他写的）") : "")),
              on ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.55 } },
                myRooms.length ? characterText(c, "他有 ") + myRooms.length + " 间开了「一起写」的房" : characterText(c, "他还没有开「一起写」的房，底下可以给他开一间")) : null));
        }),
        rows.length ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 14, lineHeight: 1.7 } }, "还没有角色。"),

        // ── 放进哪一间（她 2026-09-11）────────────────────────────────
        // ⚠️形状照上面那份名单来（墨点＋名字），不另发明一种：同一页上两处挑东西，
        //   长得不一样就是两套规矩。
        picked ? h("div", { style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, letterSpacing: ".16em", marginBottom: 2 } }, "放进哪一间"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6, lineHeight: 1.6 } },
            "只列开了「一起写」的那几间。别的房间要放，先去那间房的设置里把「一起写」打开。"),
          [{ id: "", name: myRooms.length ? "最近动过的那一间（" + myRooms[0].name + "）" : characterText(picked, "给他开一间「一起写」"), note: "" }]
            .concat(myRooms.map(function (r) { return { id: r.id, name: r.name, note: "" }; }))
            .concat([{ id: "__new", name: "另开一间", note: "" }])
            .map(function (o) {
              const on = roomId === o.id;
              return h("button", { key: o.id || "_auto", onClick: function () { setRoomId(o.id); }, className: "w-full text-left active:opacity-70",
                style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficfilepage", "data-part": "r2" },
                h("span", { style: { width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
                h("span", { style: { minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.name));
            }),
          roomId === "__new" ? h("input", { value: newName, autoFocus: true, onChange: function (e) { setNewName(e.target.value); },
            placeholder: "这间房叫什么", className: "w-full outline-none",
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "9px 0 8px", marginTop: 8, background: "transparent",
              color: t.ink, border: "none", borderBottom: "1px solid " + t.line }, "data-wk": "ficfilepageinput", "data-part": "这间房叫什么" }) : null) : null),
      h("div", { className: "shrink-0 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        btn(mine ? characterText(picked, "记进他那间房") : characterText(picked, "拿给他看"), true, function () { props.onFile(picked, false, roomTarget()); }),
        btn(noteRoom ? "只记一笔（记在「" + noteRoom.name + "」里）" : "只记一笔（进你的记忆库）",
          false, function () { props.onFile(picked, true); })));
  }

  // ---------- 转发选人 sheet ----------
  function FwdSheet(props) {
    const t = useTheme();
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose, "data-wk": "ficfwdsheet" },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "70vh", overflowY: "auto" }, "data-wk": "ficfwdsheettap", "data-part": "1" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, marginBottom: 14 } }, "转发给…"),
        // ⚠️只列真人角色：配角（npc）能被写进 CP，但没有自己的聊天窗口，转不过去。
        // 现在传进来的本来就是真人那份，这道滤是把规则留在本地——
        // 不必指望三个文件外的调用方永远记得传对。
        (props.characters || []).filter(function (c) { return c && !c.npc; }).map(function (c) {
          return h("button", { key: c.id, onClick: function () { props.onPickChar(c); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60", "data-wk": "ficfwdsheet", "data-part": "r2" },
            h(Avatar, { character: c, size: 34 }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, c.remark || c.name));
        }),
        (props.groups || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "10px 0 4px" } }, "群聊") : null,
        (props.groups || []).map(function (g) {
          return h("button", { key: g.id, onClick: function () { props.onPickGroup(g); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60", "data-wk": "ficfwdsheet", "data-part": "r3" },
            h("div", { style: { width: 34, height: 34, borderRadius: 10, background: t.line, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub } }, "群"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, g.name));
        })));
  }

  // ---------- 发布（我手写发文）----------
  function Publish(props) {
    const t = useTheme();
    const [title, setTitle] = useState("");
    const [tags, setTags] = useState("");
    const [body, setBody] = useState("");
    const [cp, setCp] = useState([]);
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const [tabId, setTabId] = useState(props.tabs[0] && props.tabs[0].id);
    const characters = props.characters;
    function finalCP() { return [pickA, pickB].filter(function (x) { return x; }); }
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficpublishfinalcp" },
      h(Head, { bg: "transparent", zh: "发布同人文", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 flex flex-col px-6 pb-8" },
        // 上面这一截固定不动（shrink-0），下面正文那格才吃得到剩下的高度
        h("div", { className: "shrink-0" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginBottom: 8 } }, "发到世界观"),
          h("select", { value: tabId, onChange: function (e) { setTabId(e.target.value); }, className: "w-full mb-4", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficpublishselect", "data-part": "1" },
            props.tabs.map(function (tb) { return h("option", { key: tb.id, value: tb.id, "data-wk": "ficpublish" }, tb.name); })),
          h("input", { "data-wk": "input", value: title, onChange: function (e) { setTitle(e.target.value); }, placeholder: "标题", className: "w-full outline-none mb-3", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficpublishinput", "data-part": "标题" }),
          h("div", { className: "flex items-center gap-2 mb-3" },
            h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2), "data-wk": "ficpublishselect", "data-part": "2" },
              cpOptions(characters, props.userName)),
            h("span", { style: { color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2), "data-wk": "ficpublishselect", "data-part": "3" },
              cpOptions(characters, props.userName))),
          h("input", { "data-wk": "input", value: tags, onChange: function (e) { setTags(e.target.value); }, placeholder: "标签，用空格或逗号分隔（如 HE 破镜重圆）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficpublishinput", "data-part": "标签，用空格或逗号分隔（" })
        ),
        // ⚠️正文那格【撑满剩下的整页】（v64.63，她 2026-09-06：「正文部分太小了」）。
        //   原来是写死的 rows:12 + resize-none：上面五个字段占掉大半屏，
        //   真正要写字的地方只剩十来行，还不许拉。
        //   现在外壳是 h-full flex flex-col、上面那截 shrink-0、这一格 flex-1 min-h-0，
        //   屏幕多高它就有多高（跟主聊天正文区同一套层级，mobile-ui-layout §3）。
        h("textarea", { "data-wk": "textarea", value: body, onChange: function (e) { setBody(e.target.value); }, placeholder: "正文…", className: "w-full outline-none flex-1 min-h-0", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.9, padding: "13px 14px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 200, resize: "none" }, "data-wk": "ficpublishtext", "data-part": "正文…" }),
        h("button", { onClick: function () {
          if (!title.trim() || !body.trim()) { props.toast && props.toast("标题和正文都要填"); return; }
          props.onPublish(tabId, title.trim(), finalCP(), tags.split(/[\s,，、]+/).filter(Boolean), body.trim());
        }, className: "w-full active:opacity-80 shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "13px", borderRadius: 12, marginTop: 10 }, "data-wk": "ficpublishbtn", "data-part": "1" }, "发布")));
  }

  // ---------- 我的页 hub（作者主页 + 我发布的 + CP管理 + 设置）----------
  function Mine(props) {
    const t = useTheme();
    const [sub, setSub] = useState(null); // null | "published" | "cp" | "settings"
    const [meEdit, setMeEdit] = useState(false);
    const me = props.me;
    const mine = (props.fics || []).filter(function (f) { return f.source === "user"; });
    // 热度 = 手动值优先；否则按我发布篇目的赞+评+章 汇总
    const derivedHeat = mine.reduce(function (s, f) { return s + ((f.stats && f.stats.kudos) || 0) + (f.liked ? 1 : 0) + (f.reviews || []).length * 5 + (f.chapters || []).length; }, 0);
    const heat = me.heat > 0 ? me.heat : derivedHeat;

    if (sub === "published") return h(MinePublished, { fics: mine, characters: props.characters, userName: props.userName, onBack: function () { setSub(null); }, onOpen: props.onOpenFic, onDelete: props.onDeleteFic });
    if (sub === "cp") return h(MineCP, { cps: props.cps, characters: props.characters, userName: props.userName, toast: props.toast, onBack: function () { setSub(null); }, onAddCP: props.onAddCP, onDelCP: props.onDelCP });
    if (sub === "settings") return h(MineSettings, { active: props.active, toast: props.toast, onPaper: props.onPaper, onBack: function () { setSub(null); } });

    const row = function (label, desc, onClick) {
      return h("button", { "data-wk": "block", onClick: onClick, className: "w-full flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2.5 active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line }, "data-wk": "ficminerow" },
        h("div", { className: "text-left" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, label),
          desc ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } }, desc) : null),
        h(IChevR, { size: 16, color: t.fog }));
    };
    const stat = function (num, lab) {
      return h("div", { className: "text-center", "data-wk": "ficminestat" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: t.ink } }, fmtNum(num)),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } }, lab));
    };
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficminestat", "data-part": "r2" },
      h(Head, { bg: "transparent", zh: "我的", onBack: props.onBack, right: h("button", { onClick: function () { setMeEdit(true); }, className: "active:opacity-60", "data-wk": "ficminebtn", "data-part": "1" }, h(IPencil, { size: 17, color: t.ink })) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        // 作者主页卡：背景图 + 头像 + 昵称 + id + 简介 + 三个统计
        h("div", { className: "rounded-2xl overflow-hidden mb-5", style: { border: "1px solid " + t.line } },
          h("div", { style: { height: 92, background: me.bg ? "center/cover no-repeat url(\"" + me.bg + "\")" : "linear-gradient(120deg," + t.tint + "," + t.ink + ")" } }),
          h("div", { className: "px-4 pb-4", style: { background: t.bg2, marginTop: -28 } },
            h(Avatar, { character: { name: me.name, avatarImage: me.avatar, color: t.tint }, size: 56, radius: 16 }),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: t.ink, marginTop: 8 } }, me.name),
            me.handle ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "@" + me.handle) : null,
            me.bio ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, marginTop: 6, lineHeight: 1.5 } }, me.bio) : null,
            h("div", { className: "flex items-center gap-6 mt-3 pt-3", style: { borderTop: "1px solid " + t.line } },
              stat(heat, "热度"), stat(me.fans || 0, "粉丝"), stat(me.following || 0, "关注")))),

        // ＋ 从底栏中间挪进来了（她 2026-09-04：中间那一枚让给加笔）
        row("自己写一篇", "写完就发在这个圈子里", function () { props.onWrite && props.onWrite(); }),
        row("我发布的", mine.length + " 篇 · 随时回看/追更", function () { setSub("published"); }),
        row("磕 CP 管理", (props.cps || []).length + " 对预设 · 增删改", function () { setSub("cp"); }),
        row("生成设置", "预设文风 · 篇幅", function () { setSub("settings"); })),
      meEdit ? h(MeEditSheet, { me: me, onClose: function () { setMeEdit(false); }, onSave: function (m) { props.onSaveMe(m); setMeEdit(false); } }) : null);
  }

  // 我发布的（列表 → 点开进 Reader）
  function MinePublished(props) {
    const t = useTheme();
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficminepublished" },
      h(Head, { bg: "transparent", zh: "我发布的", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8" },
        props.fics.length ? props.fics.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).map(function (f, i) {
          // 「我发布的」不摆头条：这一页每一篇都是她自己写的，挑一篇出来当头条没有意义
          // 删这一篇走卡片上那同一颗 ✕（v72.14）。
            // ⚠️v64.63 这一页自己长了一颗删除键＋自己那份确认；
            //   2026-09-20 feed 那边也要能删了，同一个形状就有了两处——
            //   照 施工规则/one-public-mechanism：抽成一处，**旧的那处也搬过来**，
            //   不许只开公共的、把旧的留在原地（那是最坏的一种：从此两处各改各的）。
          return h(FicCard, { key: f.id, fic: f, index: i, noLead: true, characters: props.characters, userName: props.userName,
            onOpen: function () { props.onOpen(f.id); }, onLike: function () {},
            onDelete: props.onDelete ? function () { props.onDelete(f); } : null });
        }) : h(Empty, { text: "还没发布过", sub: "在上一页点「自己写一篇」，写完就会出现在这里" })));
  }

  // CP 预设管理（独立页）
  function MineCP(props) {
    const t = useTheme();
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [label, setLabel] = useState("");
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const characters = props.characters, cps = props.cps;
    function reset() { setAdding(false); setEditId(null); setLabel(""); setPickA(""); setPickB(""); }
    function open(cp) { setEditId(cp ? cp.id : null); setLabel(cp ? cp.label : ""); setPickA(cp ? (cp.cp[0] || "") : ""); setPickB(cp ? (cp.cp[1] || "") : ""); setAdding(true); }
    function save() {
      const cp = [pickA, pickB].filter(function (x) { return x; });
      if (!cp.length) { props.toast && props.toast("至少选一个（我 / 角色）"); return; }
      const obj = { id: editId || uid("cp"), label: label.trim() || cpLabel(cp, characters, props.userName), cp: cp };
      if (editId) { props.onDelCP(editId); }
      props.onAddCP(obj); reset();
    }
    const picks = cpOptions(characters, props.userName);
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficminecp" },
      h(Head, { bg: "transparent", zh: "磕 CP 管理", onBack: props.onBack, right: h("button", { onClick: function () { adding ? reset() : open(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficminecpbtn", "data-part": "1" }, adding ? "取消" : "＋ 加 CP") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        adding ? h("div", { "data-wk": "block", className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("input", { "data-wk": "input", value: label, onChange: function (e) { setLabel(e.target.value); }, placeholder: "备注名（可空，默认用名字）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminecpinput", "data-part": "备注名（可空，默认用名字" }),
          h("div", { className: "flex items-center gap-2 mb-3" },
            h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: cpSelectStyle(t, 8, t.bg), "data-wk": "ficminecpselect", "data-part": "1" }, picks),
            h("span", { style: { color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: cpSelectStyle(t, 8, t.bg), "data-wk": "ficminecpselect", "data-part": "2" }, picks)),
          h("button", { "data-wk": "block", onClick: save, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "9px", borderRadius: 10 }, "data-wk": "ficminecpbtn", "data-part": "2" }, editId ? "保存修改" : "保存 CP")) : null,
        cps.length ? cps.map(function (cp) {
          return h("div", { "data-wk": "block", key: cp.id, className: "flex items-center justify-between rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line }, "data-wk": "ficminecp", "data-part": "r2" },
            h("button", { onClick: function () { open(cp); }, className: "text-left flex-1 active:opacity-60", "data-wk": "ficminecpbtn", "data-part": "3" },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, cp.label),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, cpLabel(cp.cp, characters, props.userName))),
            h("button", { onClick: function () { setEditId(cp.id); open(cp); }, className: "active:opacity-60 mr-3", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub }, "data-wk": "ficminecpbtn", "data-part": "4" }, "编辑"),
            h("button", { onClick: function () { props.onDelCP(cp.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficminecpbtn", "data-part": "5" }, "删除"));
        }) : h(Empty, { text: "还没有 CP 预设", sub: "加几对，生成时一键选" })));
  }

  // 生成设置（独立页）：多文风预设可多选切换 + 篇幅
  function MineSettings(props) {
    const t = useTheme();
    const [cfg, setCfg] = useState(window.Fanfic.loadCfg());
    const [sharedStyles, setSharedStyles] = useState(function () { return loadJSON(K_SHARED_STYLES, []) || []; });
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [label, setLabel] = useState(""), [text, setText] = useState("");
    const [labOpen, setLabOpen] = useState(false);
    const [labName, setLabName] = useState("贴身叙事 · 留白呼吸");
    const [labSource, setLabSource] = useState("");
    const [labAxes, setLabAxes] = useState([]);
    const [labNotes, setLabNotes] = useState("");
    const [labSamples, setLabSamples] = useState(["", "", ""]);
    const [labScene, setLabScene] = useState("");
    const [labTesting, setLabTesting] = useState(false);
    const [labAB, setLabAB] = useState(null);
    // A/B 那两枪挂在后台生成上：走开再回来，写好的两份照样摆出来
    const LAB_BG = window.BackgroundGeneration, LAB_KEY = "fanfic:styleLabAB";
    const labTask = LAB_BG ? LAB_BG.useTask(LAB_KEY,
      r => { setLabAB(r); setLabTesting(false); },
      err => { setLabTesting(false); props.toast ? props.toast("A/B 生成失败：" + String(err)) : alert(String(err)); }) : null;
    useEffect(function () { if (labTask && labTask.busy) setLabTesting(true); }, [labTask && labTask.busy]);
    function patch(p) { const n = Object.assign({}, cfg, p); setCfg(n); window.Fanfic.saveCfg(n); }
    function addStyle() {
      if (!text.trim()) { props.toast && props.toast("文风内容不能为空"); return; }
      const s = { id: uid("st"), label: label.trim() || "文风" + ((cfg.styles || []).length + 1), text: text.trim() };
      patch({ styles: (cfg.styles || []).concat([s]), activeStyleIds: (cfg.activeStyleIds || []).concat([s.id]) });
      setAdding(false); setLabel(""); setText("");
    }
    function toggle(id) {
      const on = (cfg.activeStyleIds || []).indexOf(id) >= 0;
      patch({ activeStyleIds: on ? cfg.activeStyleIds.filter(function (x) { return x !== id; }) : (cfg.activeStyleIds || []).concat([id]) });
    }
    function del(id) { patch({ styles: (cfg.styles || []).filter(function (s) { return s.id !== id; }), activeStyleIds: (cfg.activeStyleIds || []).filter(function (x) { return x !== id; }) }); }
    function toggleLabAxis(id) {
      setLabAxes(labAxes.indexOf(id) >= 0 ? labAxes.filter(function (x) { return x !== id; }) : labAxes.concat([id]));
    }
    function useCloseNarrativeRecipe() {
      setLabName("贴身叙事 · 留白呼吸");
      setLabAxes(STYLE_LAB_RECIPE.slice());
      setLabNotes("场景的温度来自人物当下会注意什么，而不是叙述者替人物分析。允许朴素句子、重复、停顿和不体面的念头；对白之后不急着解释，回忆进入后必须落回眼前的人或物。");
    }
    function saveLabStyle() {
      const prompt = buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples);
      if (!labAxes.length && !labNotes.trim() && !labSamples.some(function (s) { return s.trim(); })) {
        props.toast && props.toast("先选一些文风骨架，或贴一段短样例"); return;
      }
      const s = { id: uid("st"), label: labName.trim() || "文风实验", text: prompt, kind: "style-lab", sourceNote: labSource.trim(), createdAt: Date.now() };
      // 实验稿默认不启用，防止“保存一下”立刻改变下一篇成文。
      patch({ styles: (cfg.styles || []).concat([s]) });
      setLabOpen(false);
      props.toast && props.toast("已保存文风实验 · 默认未启用，勾选后才生效");
    }
    async function testLabStyle() {
      if (!props.active) { props.toast && props.toast("先在 API 设置里选一个可用模型"); return; }
      if (!labScene.trim()) { props.toast && props.toast("先写一个想测试的场景"); return; }
      const style = buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples);
      const task = "把下面场景写成 350～550 字的小说片段。只写正文，不起标题，不解释写法。必须让现场发生变化，并停在一个尚有余波的具体动作上。\n\n【场景】\n" + labScene.trim();
      setLabTesting(true); setLabAB(null);
      // 两枪交给后台生成跑（2026-10-01「离开这页就白跑」）：走开再回来，A/B 两份照样摆着
      const run = async () => {
        // 两边使用完全相同的场景与篇幅；唯一变量是实验文风。
        // 思考型模型会把内部思考也计入 maxTokens；1400 曾导致正文只剩几十字。
        // 与正式长文一样给足（v59.96 起是 14000，见 施工规则/max-tokens-floor.md）；
        // 她按次计费，在这里省预算省不到钱，只会换来一次写半截再重来。
        const base = await callAI(props.active, FANFIC_ORGANIC_FORM + "\n\n" + FANFIC_ANTI_CLICHE, [{ role: "user", content: task }], { maxTokens: 14000, timeout: 300000 });
        const styled = await callAI(props.active, FANFIC_ORGANIC_FORM + "\n\n【本次实验文风】\n" + style + "\n\n" + STYLE_FIDELITY_TAIL, [{ role: "user", content: task }], { maxTokens: 14000, timeout: 300000 });
        const cleanBase = String(base || "").trim(), cleanStyled = String(styled || "").trim();
        return { base: cleanBase, styled: cleanStyled, baseShort: cleanBase.length < 280, styledShort: cleanStyled.length < 280 };
      };
      if (LAB_BG) { LAB_BG.start(LAB_KEY, { label: "正在生成两份…" }, run).catch(() => {}); return; }
      try { setLabAB(await run()); }
      catch (e) { props.toast ? props.toast("A/B 生成失败：" + String(e.message || e)) : alert(String(e.message || e)); }
      setLabTesting(false);
    }
    function importStyleFile() {
      const inp = document.createElement("input");
      inp.type = "file"; if (ANY_FILE) inp.accept = ANY_FILE;   // 安卓那边不写这个属性（见 core.js ANY_FILE）
      inp.onchange = async function () {
        const file = inp.files && inp.files[0]; if (!file) return;
        setImporting(true);
        try {
          const reader = window.readWritingStyleDocument;
          if (typeof reader !== "function") throw new Error("文风解析器尚未加载，请刷新后再试");
          const prompt = await reader(file);
          const base = String(file.name || "导入文风").replace(/\.(docx|txt|md)$/i, "");
          const key = "style_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          const item = { key: key, name: base || "导入文风", prompt: prompt, source: "local-file", importedAt: Date.now() };
          const next = sharedStyles.concat([item]);
          setSharedStyles(next); saveJSON(K_SHARED_STYLES, next);
          patch({ activeStyleIds: (cfg.activeStyleIds || []).concat(["shared:" + key]) });
          props.toast && props.toast("已导入「" + item.name + "」，只保存在本机文风库");
        } catch (e) { props.toast ? props.toast(String(e.message || e)) : alert(String(e.message || e)); }
        setImporting(false);
      };
      inp.click();
    }
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficminesettings" },
      h(Head, { bg: "transparent", zh: "生成设置", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { className: "flex items-center justify-between mb-2" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink } }, "预设文风"),
          h("div", { className: "flex items-center gap-3" },
            h("button", { onClick: importStyleFile, disabled: importing, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent, opacity: importing ? 0.5 : 1 }, "data-wk": "ficminesettingsbtn", "data-part": "1" }, importing ? "解析中…" : "导入文件"),
            h("button", { onClick: function () { setAdding(!adding); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficminesettingsbtn", "data-part": "2" }, adding ? "取消" : "＋ 新建"))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 10 } }, "版块只管世界背景；文风在这里单独选择。可导入 DOCX / TXT / MD，和线下共用同一份本地文风库，不上传原文件。"),
        h("div", { "data-wk": "block", className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("button", { onClick: function () { setLabOpen(!labOpen); }, className: "w-full flex items-center justify-between text-left active:opacity-70", "data-wk": "ficminesettingsbtn", "data-part": "3" },
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: t.ink } }, "文风实验室"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.8px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "拆骨架 · 放短样例 · 预览后保存")),
            h("span", { style: { color: t.accent, fontSize: "calc(13px * var(--app-fs, 1))" } }, labOpen ? "收起" : "打开")),
          labOpen ? h("div", { style: { marginTop: 13 } },
            h("button", { onClick: useCloseNarrativeRecipe, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent, border: "1px solid " + t.accent, borderRadius: 999, padding: "6px 10px", marginBottom: 11 }, "data-wk": "ficminesettingsbtn", "data-part": "4" }, "一键填入 · 贴身叙事骨架"),
            h("input", { "data-wk": "input", value: labName, onChange: function (e) { setLabName(e.target.value); }, placeholder: "给这套实验取名", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "8px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettingsinput", "data-part": "给这套实验取名" }),
            h("input", { "data-wk": "input", value: labSource, onChange: function (e) { setLabSource(e.target.value); }, placeholder: "来源备注（作者 / 链接 / 自己的样稿，可留空）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", padding: "8px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettingsinput", "data-part": "来源备注（作者 / 链接" }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 7 } }, "选择真正想借的骨架"),
            h("div", { className: "flex flex-wrap gap-2 mb-3" }, STYLE_LAB_AXES.map(function (a) {
              const on = labAxes.indexOf(a.id) >= 0;
              return h("button", { key: a.id, onClick: function () { toggleLabAxis(a.id); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: on ? t.bg2 : t.sub, background: on ? t.ink : t.bg, border: "1px solid " + (on ? t.ink : t.line), borderRadius: 999, padding: "6px 9px" }, "data-wk": "ficminesettings", "data-part": "r2", "data-on": on ? "1" : "0" }, a.label);
            })),
            h("textarea", { "data-wk": "textarea", value: labNotes, onChange: function (e) { setLabNotes(e.target.value); }, rows: 3, placeholder: "额外说明：例如少写全知判断、允许人物想错、对白别太完整……", className: "w-full outline-none resize-y mb-3", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettingstext", "data-part": "额外说明：例如少写全知判" }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 3 } }, "短样例（可选，1～3 段）"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginBottom: 8 } }, "只贴你有权使用的短段落。系统会明确要求借句法、不借人名情节和原句。"),
            labSamples.map(function (sample, i) {
              return h("textarea", { "data-wk": "textarea", key: i, value: sample, onChange: function (e) { const next = labSamples.slice(); next[i] = e.target.value; setLabSamples(next); }, rows: 3, maxLength: 1600, placeholder: "样例 " + (i + 1) + (i ? "（可留空）" : ""), className: "w-full outline-none resize-y mb-2", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettings", "data-part": "r3" });
            }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, margin: "10px 0 6px" } }, "同场景 A/B 试写"),
            h("textarea", { "data-wk": "textarea", value: labScene, onChange: function (e) { setLabScene(e.target.value); }, rows: 3, placeholder: "例如：分别多年后在医院走廊重逢，其中一人先认出了对方，却装作没有。", className: "w-full outline-none resize-y mb-2", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettingstext", "data-part": "例如：分别多年后在医院走" }),
            h("button", { "data-wk": "block", onClick: testLabStyle, disabled: labTesting, className: "w-full active:opacity-75", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent, background: "transparent", border: "1px solid " + t.accent, padding: "9px", borderRadius: 10, opacity: labTesting ? 0.5 : 1, marginBottom: 9 }, "data-wk": "ficminesettingsbtn", "data-part": "5" }, labTesting ? "正在生成两份…" : "试写 A/B（会调用模型 2 次）"),
            labAB ? h("div", { className: "grid grid-cols-1 gap-2 mb-3" },
              [["A · 不带文风", labAB.base], ["B · 实验文风", labAB.styled]].map(function (it) {
                return h("div", { "data-wk": "block", key: it[0], style: { background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: 10 }, "data-wk": "ficminesettings", "data-part": "r4" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: it[0][0] === "B" ? t.accent : t.fog, marginBottom: 5 } }, it[0]),
                  h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: t.ink, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" } }, it[1] || "（模型返回为空）"),
                  (it[0][0] === "A" ? labAB.baseShort : labAB.styledShort) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent, marginTop: 7 } }, "⚠ 正文不足 280 字，上游可能提前停止；这份不适合拿来比较，请重试。") : null);
              })) : null,
            h("details", { style: { marginTop: 5, marginBottom: 10 } },
              h("summary", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.accent, cursor: "pointer" } }, "预览最终提示词"),
              h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.65, whiteSpace: "pre-wrap", color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 9, padding: 10, marginTop: 7, maxHeight: 260, overflowY: "auto" } }, buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples))),
            h("button", { "data-wk": "block", onClick: saveLabStyle, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "10px", borderRadius: 10 }, "data-wk": "ficminesettingsbtn", "data-part": "6" }, "保存实验稿（暂不启用）")) : null),
        adding ? h("div", { "data-wk": "block", className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("input", { "data-wk": "input", value: label, onChange: function (e) { setLabel(e.target.value); }, placeholder: "文风名（如 冷冽白描 / 治愈慢热 / 港风）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficminesettingsinput", "data-part": "文风名（如 冷冽白描 /" }),
          h("textarea", { "data-wk": "textarea", value: text, onChange: function (e) { setText(e.target.value); }, rows: 7, placeholder: "文风描述，越具体越好，想写多长写多长（无字数限制）：多用短句白描、冷色调意象、情绪藏在动作里、少直白抒情、禁用某些词……", className: "w-full outline-none resize-y mb-3", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, padding: "9px 11px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line, minHeight: 120 }, "data-wk": "ficminesettingstext", "data-part": "文风描述，越具体越好，想" }),
          h("button", { "data-wk": "block", onClick: addStyle, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "9px", borderRadius: 10 }, "data-wk": "ficminesettingsbtn", "data-part": "7" }, "保存文风")) : null,
        (cfg.styles || []).length ? (cfg.styles || []).map(function (s) {
          return h("div", { "data-wk": "block", key: s.id, className: "rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line }, "data-wk": "ficminesettings", "data-part": "r5" },
            h("div", { className: "flex items-center justify-between" },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, s.label),
              h("button", { onClick: function () { del(s.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficminesettingsbtn", "data-part": "8" }, "删除")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, s.text));
        }) : (adding ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginBottom: 8 } }, "还没有文风预设。")),

        (function () {
          const labs = labStylePresets();
          if (!labs.length) return null;
          return h("div", { style: { marginTop: 14 }, "data-wk": "ficminesettings", "data-part": "r6" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 7 } }, "文风预设台 · 线下／小剧场／同人文共用"),
            labs.map(function (s) {
              const on = (cfg.activeStyleIds || []).indexOf(s.id) >= 0;
              return h("button", { key: s.id, onClick: function () { toggle(s.id); }, className: "w-full text-left rounded-xl px-4 py-3 mb-2 active:opacity-75", style: { background: on ? t.bg2 : "transparent", border: "1px solid " + (on ? t.accent : t.line) }, "data-wk": "ficminesettings", "data-part": "r7", "data-on": on ? "1" : "0" },
                h("div", { className: "flex items-center justify-between" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, s.label),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: on ? t.accent : t.fog } }, on ? "本次默认启用" : "点按启用")),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, String(s.text || "").slice(0, 180) + (String(s.text || "").length > 180 ? "…" : "")));
            }));
        })(),

        sharedStyles.length ? h("div", { style: { marginTop: 14 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 7 } }, "共享本地文风 · 线下与同人文都可用"),
          sharedStyles.map(function (s) {
            const id = "shared:" + s.key, on = (cfg.activeStyleIds || []).indexOf(id) >= 0;
            return h("button", { key: s.key, onClick: function () { toggle(id); }, className: "w-full text-left rounded-xl px-4 py-3 mb-2 active:opacity-75", style: { background: on ? t.bg2 : "transparent", border: "1px solid " + (on ? t.accent : t.line) }, "data-wk": "ficminesettings", "data-part": "r8", "data-on": on ? "1" : "0" },
              h("div", { className: "flex items-center justify-between" },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, s.name || "共享文风"),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: on ? t.accent : t.fog } }, on ? "本次默认启用" : "点按启用")),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, String(s.prompt || "").slice(0, 180) + (String(s.prompt || "").length > 180 ? "…" : "")));
          })) : null,

        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, margin: "18px 0 8px" } }, "篇幅"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginBottom: 6 } }, "每篇 / 每章约多少 token（越高越长、越有剧情）"),
        // 直接填数字，不再是 2000–8000 那把滑杆。只在存的时候夹一下范围，
        // 中间允许是空串——不然打字打到一半就被回填成 500。
        h("input", {
          type: "number", inputMode: "numeric", min: 500, max: FIC_TOKEN_MAX, step: 100,
          value: cfg.perFic == null ? "" : cfg.perFic,
          onChange: function (e) { patch({ perFic: e.target.value === "" ? "" : Number(e.target.value) }); },
          onBlur: function (e) { patch({ perFic: clampPerFic(e.target.value) }); },
          style: { width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px", outline: "none" }, "data-wk": "ficminesettingsinput", "data-part": "4"
        }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.5 } },
          "范围 500–" + FIC_TOKEN_MAX + "。设太高的话，一次请求会很久，也更容易撞上模型自己的上限或超时。"),

        // 她 2026-09-11：「弄一个设置最低 token 要求，免得模型偷懒」。
        // ⚠️说人话＝【字数】：上面那一栏是 token 目标，两件事。
        //   API 上没有 min_tokens（max_tokens 是天花板、没有地板），所以这个数
        //   只能落成两件事：发进提示词 + 写完自己数一遍。数出来短了只提示，不自动补。
        h(window.WordFloorSection, { value: cfg.minChars || 0,
          onChange: function (v) { patch({ minChars: v }); },
          title: "每章最少写多少字",
          // 兜底不一样：同人文没填＝按上面那个 token 折算（线下是「不限」）
          hint: "约 " + minCharsFor(cfg) + " 字",
          note: "留空＝按上面那个 token 折算。这个数会发进提示词、写完再数一遍；短了只提示，不会自动补写。",
          max: MIN_CHARS_MAX }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.5 } },
          "这个数会写进提示词，写完还会数一遍。没写够也不会自动再打一枪——"
          + "只在那一章底下留一行字和一颗「让TA接着写」，按不按你说了算。"),

        // ── 书页 ──
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, margin: "22px 0 3px" } }, "默认书页"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 9, lineHeight: 1.5 } },
          "换纸连墨一起换：深夜那两张是浅字深底，关灯读不刺眼。这里定的是【默认】那张——"
          + "翻开某一篇之后，点右上角那个小色块可以单独给那一篇换。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
          FIC_PAPERS.map(function (pp) {
            return h(PaperSwatch, {
              key: pp.id, paper: pp, on: (cfg.paper || FIC_PAPER_DEFAULT) === pp.id,
              onPick: function () { patch({ paper: pp.id }); props.onPaper && props.onPaper(pp.id); }
            });
          }))));
  }

  // 作者主页资料编辑
  function MeEditSheet(props) {
    const t = useTheme();
    const [m, setM] = useState(Object.assign({}, props.me));
    function set(k, v) { const o = {}; o[k] = v; setM(Object.assign({}, m, o)); }
    function pickImg(key) {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () { const f = inp.files[0]; if (!f) return; resizeImageFile(f, key === "bg" ? 1080 : 480, 0.82).then(function (d) { set(key, d); }); };
      inp.click();
    }
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose, "data-wk": "ficmeeditsheet" },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "86vh", overflowY: "auto" }, "data-wk": "ficmeeditsheettap", "data-part": "1" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, marginBottom: 14 } }, "编辑作者主页"),
        h("div", { className: "flex items-center gap-4 mb-4" },
          h("button", { onClick: function () { pickImg("avatar"); }, className: "active:opacity-70", "data-wk": "ficmeeditsheetbtn", "data-part": "1" }, h(Avatar, { character: { name: m.name, avatarImage: m.avatar, color: t.tint }, size: 56, radius: 16 })),
          h("button", { onClick: function () { pickImg("bg"); }, className: "flex-1 active:opacity-70", style: { height: 56, borderRadius: 12, background: m.bg ? "center/cover no-repeat url(\"" + m.bg + "\")" : t.bg2, border: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog }, "data-wk": "ficmeeditsheetbtn", "data-part": "2" }, m.bg ? "换背景图" : "＋ 背景图")),
        h("input", { "data-wk": "input", value: m.name, onChange: function (e) { set("name", e.target.value); }, placeholder: "昵称", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficmeeditsheetinput", "data-part": "昵称" }),
        h("input", { "data-wk": "input", value: m.handle, onChange: function (e) { set("handle", e.target.value.replace(/^@/, "")); }, placeholder: "id（@handle，不带 @）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficmeeditsheetinput", "data-part": "id（@handle，不" }),
        h("textarea", { "data-wk": "textarea", value: m.bio, onChange: function (e) { set("bio", e.target.value); }, rows: 2, placeholder: "个人简介 / 太太的一句话", className: "w-full outline-none resize-none mb-2", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.5, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficmeeditsheettext", "data-part": "个人简介 / 太太的一句" }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 } },
          [["heat", "热度"], ["fans", "粉丝"], ["following", "关注"]].map(function (fld) {
            return h("div", { key: fld[0], "data-wk": "ficmeeditsheet", "data-part": "r2" },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 3 } }, fld[1]),
              h("input", { "data-wk": "input", type: "number", value: m[fld[0]] || 0, onChange: function (e) { set(fld[0], Number(e.target.value) || 0); }, className: "outline-none", style: { width: "100%", minWidth: 0, boxSizing: "border-box", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "8px 9px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line }, "data-wk": "ficmeeditsheetinput", "data-part": "3" }));
          })),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 14, marginTop: -6 } }, "热度留 0 则按你发布的篇目自动统计"),
        h("button", { onClick: function () { props.onSave(m); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12 }, "data-wk": "ficmeeditsheetbtn", "data-part": "3" }, "保存")));
  }

  // ---------- 穿书（互动叙事 RP）----------
  function RPApp(props) {
    const t = useTheme();
    const [view, setView] = useState("list"); // list | pick | thread
    const [sessions, setSessions] = useState(function () { return window.Fanfic.loadRP(); });
    const [openId, setOpenId] = useState(null);
    // 从作者主页点「加笔」带着一篇进来：直接开一局进去读，别让她再翻一遍列表
    useEffect(function () {
      if (!props.startFicId) return;
      const f = (props.fics || []).filter(function (x) { return x.id === props.startFicId; })[0];
      props.onStartUsed && props.onStartUsed();
      if (f) startSession(f);
    }, [props.startFicId]);
    function persist(list) { setSessions(list); window.Fanfic.saveRP(list); }
    // 开一局：不再有选身份、选记忆、选落点那一屏
    // （她 2026-09-05：「去掉那个选身份和记忆，就直接进去改文」）。
    // ⚠️不再落 mode：加笔没有「穿成谁」这回事了（她 2026-09-11），动笔的人就是她自己。
    function startSession(fic) {
      const cfg = window.Fanfic.loadCfg();
      const sess = { id: uid("rp"), ficId: fic.id, ficTitle: fic.title, tabId: fic.tabId, cp: fic.cp,
        authorCard: window.Fanfic.rpAuthorCardOf(fic),
        style: window.Fanfic.activeStyleText(cfg), transcript: [],
        // 加笔从【原文的哪一段】开始读。⚠️只存下标，不存原文：存一份就有两份，
        //   而且每一局都复制一遍全文。voided ＝ 被改掉／被她也不要了的那几段。
        paraIdx: 0, voided: [],
        createdAt: Date.now(), updatedAt: Date.now() };
      persist([sess].concat(window.Fanfic.loadRP()));
      setOpenId(sess.id); setView("thread");
    }
    function charsOf(fic) { return cpChars((fic && fic.cp) || [], props.characters, props.profile, fic && fic.meMask); }

    // 会话
    if (view === "thread") {
      const sess = sessions.find(function (s) { return s.id === openId; });
      if (!sess) { setView("list"); return null; }
      return h(RPThread, {
        session: sess, fic: (props.fics || []).find(function (f) { return f.id === sess.ficId; }),
        tab: (props.tabs || []).find(function (x) { return x.id === sess.tabId; }) || { name: "", desc: "" },
        active: props.active, characters: props.characters, profile: props.profile, userName: props.userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast, onShelveFic: props.onShelveFic, onExtendFic: props.onExtendFic,
        onBack: function () { setSessions(window.Fanfic.loadRP()); setOpenId(null); setView("list"); },
        onUpdate: function (fn) { const list = window.Fanfic.loadRP().map(function (s) { return s.id === sess.id ? fn(Object.assign({}, s)) : s; }); persist(list); }
      });
    }

    // 选文
    // ⚠️这一屏原来只列【收藏进书架】的（shelf），而作者主页上每一篇都有「加笔」按钮，
    //   点了直接就开局——同一件事两套门槛，她 2026-09-07 撞上的就是这个。
    //   门槛本来也不该在这儿：`protectedFic` 是【清理闸】（这篇文留不留），
    //   借它当加笔的准入条件是拿另一层的规矩当自己的规矩。真正要防的「开着局
    //   原文被清掉」已经由 protectedFic 认加笔会话解决了，所以这儿一律放行。
    if (view === "pick") {
      const pickable = (props.fics || []).slice().sort(function (a, b) {
        // 收藏／自己写的排前面（多半就是想加笔的那几篇），其余按新旧
        const pa = window.Fanfic.protectedFic(a) ? 1 : 0, pb = window.Fanfic.protectedFic(b) ? 1 : 0;
        return pb - pa || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      return h("div", { className: "h-full flex flex-col", "data-wk": "ficrpapp" },
        h(Head, { bg: "transparent", zh: "挑一篇下笔", sub: "在她写好的文上动笔", onBack: function () { setView("list"); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
          pickable.length ? pickable.map(function (f) {
            return h("button", { key: f.id, onClick: function () { startSession(f); }, className: "w-full text-left active:opacity-80 rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line }, "data-wk": "ficrpapp", "data-part": "r2" },
              h("div", { className: "flex items-center", style: { gap: 6 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.title),
                f.onShelf ? h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog } }, "在书架") : null),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.accent } }, cpLabel(f.cp, props.characters, props.userName) + " · " + rpAuthorName(f)));
          }) : h(Empty, { text: "还没有文", sub: "先去 feed 生成几篇" })));
    }

    // 存档列表
    const sorted = sessions.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficrpapp", "data-part": "r3" },
      h(Head, { bg: "transparent", zh: "加笔", sub: "在别人写好的文上动笔", onBack: props.onBack, right: h("button", { onClick: function () { setView("pick"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficrpappbtn", "data-part": "1" }, "＋ 新一篇") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        // 她 2026-09-07：「加笔里灰字的解释太啰嗦了」。原来这儿是一整段说明书
        // （怎么动手＋作者会怎么反应＋原稿剩余是什么＋收尾去哪儿），全在进门口挡着。
        // 那几件事在里面都看得见，不用在门口先讲一遍。
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, marginBottom: 14 } }, "点住原文里的一句，从那句起就归你写；作者在旁边接招。"),
        sorted.length ? sorted.map(function (s) {
          return h("div", { "data-wk": "block", key: s.id, className: "flex items-center rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line }, "data-wk": "ficrpapp", "data-part": "r4" },
            h("button", { onClick: function () { setOpenId(s.id); setView("thread"); }, className: "text-left flex-1 active:opacity-70", "data-wk": "ficrpappbtn", "data-part": "2" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, s.ficTitle),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } }, [window.Fanfic.rpKnowLabel(s.know), ((s.transcript || []).filter(function (e) { return e.who === "me"; }).length) + " 步"].filter(Boolean).join(" · ")),
              (function () {
                const bs = s.beats || [], br = bs.filter(function (b) { return b.state === "broken"; }).length, kp = bs.filter(function (b) { return b.state === "kept" || b.state === "bent"; }).length;
                if (!bs.length) return null;
                return h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: br ? t.accent : t.fog, marginTop: 2 }, "data-wk": "ficrpapp", "data-part": "r5" },
                  s.done ? (br ? "已定稿 · 改了 " + br + " 处" : "已定稿 · 一页也没改")
                    : (br ? "拦下 " + br + " 页" : "还没拦下任何一页") + " · 发生了 " + kp + " 页 · 还剩 " + (bs.length - br - kp) + " 页没走到");
              })()),
            h("button", { onClick: function () { const list = window.Fanfic.loadRP().filter(function (x) { return x.id !== s.id; }); persist(list); }, className: "active:opacity-60 ml-2", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficrpappbtn", "data-part": "3" }, "删除"));
        }) : h(Empty, { text: "还没在谁的文上动过笔", sub: "点右上「＋ 新一篇」开始" })));
  }

  // 书脊：这一版书被你改成什么样，一眼看得见
  // ⚠️不是一排药丸也不是一排 tab（施工规则/tabs-not-plain-pills.md）：
  // 它在现实里就是【一本书的脊背】——两端的堵头、中间那根装订线、压在线上的几枚页签。
  // 照原样走过去的那一页在脊上是一枚实心墨点，被拦下的那一页是一道划开的口子。
  // 状态不只靠颜色分：实心 / 空心虚线 / 划一道，形状各不相同（色弱和阳光下只剩形状可依）。
  function RPSpine(props) {
    const t = props.t, bs = props.beats || [];
    if (!bs.length) return null;
    const cap = function (k) { return h("div", { key: k, style: { width: 3, height: 20, borderRadius: 1, background: t.ink, opacity: 0.5, marginTop: 2, flexShrink: 0 }, "data-wk": "ficrpspinecap" }); };
    return h("div", { style: { padding: "2px 2px 6px" }, "data-wk": "ficrpspinecap", "data-part": "r2" },
      h("div", { className: "flex items-start", style: { position: "relative" } },
        h("div", { style: { position: "absolute", left: 4, right: 4, top: 11, height: 1, background: t.line } }),
        cap("l"),
        h("div", { className: "flex-1 flex" }, bs.map(function (bt) {
          const st = bt.state || "pending", on = props.sel === bt.id, lit = st !== "pending";
          return h("button", { key: bt.id, onClick: function () { props.onPick(on ? null : bt.id); }, className: "flex-1 flex flex-col items-center active:opacity-60", style: { minWidth: 0, padding: "0 2px 2px", background: "transparent" }, "data-wk": "ficrpspine", "data-on": on ? "1" : "0" },
            h("div", { style: { position: "relative", width: 15, height: 15, marginTop: 4, borderRadius: 999, boxSizing: "border-box",
                border: "1px " + (st === "pending" ? "dashed " + t.fog : "solid " + (st === "broken" ? t.accent : t.ink)),
                background: (st === "kept" || st === "bent") ? t.ink : t.bg, boxShadow: "0 0 0 3px " + t.bg } },
              st === "broken" ? h("div", { style: { position: "absolute", left: -3, right: -3, top: 6, height: 1.5, background: t.accent, transform: "rotate(-40deg)" } }) : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", lineHeight: 1.35, marginTop: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: st === "broken" ? t.accent : (st === "kept" || st === "bent") ? t.sub : t.fog,
                textDecoration: st === "broken" ? "line-through" : "none",
                fontWeight: on ? 700 : 400 } }, (lit || props.spoiler) ? bt.label : "？"));
        })),
        cap("r")));
  }

  // 穿书会话（互动叙事）
  function RPThread(props) {
    const t = useTheme();
    const s = props.session;
    const trans = s.transcript || [];
    const beats = s.beats || [];
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [writing, setWriting] = useState(false); // 展开"写行动"输入
    const [reveal, setReveal] = useState(99);       // 最后一段叙事已显示的段落数（初次进来全显）
    const [sel, setSel] = useState(null);           // 书脊上点开的那一页
    const [cut, setCut] = useState(null);           // 点住的那一句：{i, sentence, rest}
    // 这篇文的原稿。⚠️只在这儿算一次，不进存档：还没读到的部分一个字都不存。
    const paras = window.Fanfic.rpParas(props.fic);
    const leftPct = window.Fanfic.rpLeftPct(s, paras);
    const moreSrc = Number.isFinite(s.paraIdx) ? s.paraIdx < paras.length : false;
    const taRef = React.useRef(null);
    function autoGrow() { if (typeof fitTextarea === "function") fitTextarea(taRef.current, 130); }   // 公共那一份（施工规则/typing-hot-path.md）
    // 原篇被删时 props.fic 没了，退回存档自己记着的那份 cp——不然这一局的人全空了，
    // 身份锚点那句话认不出「文里那位就是她」，玩家会被写成另一个人
    const cpc = cpChars((props.fic && props.fic.cp) || s.cp || [], props.characters, props.profile, props.fic && props.fic.meMask);
    const storyLore = function (extra) {
      const ids = cpc.filter(function (c) { return c && !c.isMe && c.id; }).map(function (c) { return c.id; });
      const recent = (s.transcript || []).slice(-8).map(function (x) { return x.text || ""; }).join("\n");
      return props.worldbookFor ? props.worldbookFor(ids, [props.fic && props.fic.title, props.tab && props.tab.name, recent, extra || ""].filter(Boolean).join("\n")) : props.worldbook;
    };
    const perFic = (window.Fanfic.loadCfg().perFic) || 3000;
    const rtp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 幕文朗读（懒合成，读前800字，重听免费）
    // 用哪个音色读幕文：优先非「我」的主角、且配了音色的那个
    const narVoice = cpc.find(function (c) { return c && !c.isMe && c.voiceId; }) || cpc.find(function (c) { return c && c.voiceId; }) || null;
    // ⚠️找【最后一段叙事】，不是最后一条：批注和结算过的页都排在叙事后面，
    // 拿 trans.length-1 会判成「上一拍不是叙事」，逐段展开和「轮到我了」两处一起失灵。
    let lastNarIdx = -1;
    for (let i = trans.length - 1; i >= 0; i--) { if (trans[i].who === "nar") { lastNarIdx = i; break; } }
    const prevNar = React.useRef(-1);
    React.useEffect(function () {
      if (lastNarIdx !== prevNar.current) { if (prevNar.current >= 0) setReveal(1); prevNar.current = lastNarIdx; }
    }, [lastNarIdx]);

    // 一拍回来了：正文、（可能的）页边批注、走没走到骨架的某一页、偏离度
    function applyTurn(r) {
      props.onUpdate(function (ss) {
        const add = [{ who: "nar", text: r.text, cot: r.cot || null, cotRequested: !!r.cotRequested }];
        if (r.pull) add.push({ who: "pull", text: r.pull });
        if (r.note) add.push({ who: "note", text: r.note });
        ss.transcript = (ss.transcript || []).concat(add);
        if (Number.isFinite(r.dev)) ss.dev = r.dev;
        const hit = r.hit && (ss.beats || []).find(function (bt) { return bt.id === r.hit && (bt.state || "pending") === "pending"; });
        ss.pendingHit = hit ? hit.id : null;
        ss.updatedAt = Date.now();
        return ss;
      });
    }
    // 每隔几拍才让作者在页边说一句：每一拍都说就成了旁白，说了等于没说
    // 她 2026-09-04：「我每改一段就会有作者过来试图把剧情接回来然后再批注」——
    // 所以每一拍都有。原来是每三拍一次（怕成旁白），现在批注跟在【她伸的那一手】后面，
    // 是那一手的落款，不再是凭空冒出来的一句点评。
    function wantNote() { return true; }

    // ⚠️开场分两步，顺序不许换（她 2026-09-05「直接进去改文」之后这条才露出来）：
    //   ① 原文第一段【立刻】摆上——它是她本来就写好的字，一分钱不花，也不该等模型；
    //   ② 骨架那一枪再慢慢去抽。
    // 原来两件事绑在同一个 onUpdate 里：那一枪失败（没配 API、超时、余额）＝整页空白，
    // 一个字都读不到，而这个玩法的全部内容就是那些字。
    async function start() {
      if (!props.fic) return;
      props.onUpdate(function (ss) {
        if ((ss.transcript || []).length) return ss;
        // 开场就是【原文的第一段】——引擎不写开场（v62.50）
        const i0 = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
        ss.transcript = paras[i0] ? [{ who: "src", i: i0, text: paras[i0] }] : [];
        ss.paraIdx = i0 + (paras[i0] ? 1 : 0);
        // 作者是谁从【名册】里读（开局时已经落进 session）——这儿只在老存档缺这一栏时补一次。
        //   ⚠️不许覆盖：覆盖了就把她的脾气冲掉了。
        ss.authorCard = ss.authorCard || window.Fanfic.rpAuthorCardOf(props.fic) || null;
        if (!Number.isFinite(ss.dev)) ss.dev = 0;
        ss.updatedAt = Date.now(); return ss;
      });
      if (!props.active) return;   // 没配 API 也照样读得下去，只是没有骨架
      setBusy(true);
      try {
        // ⚠️开场前不再先打一枪定身份：动笔的人就是她自己，没有身份要定（她按次计费，
        //   那一枪本来也只为「天降」那个已经删掉的玩法存在）。
        const r = await window.Fanfic.genRPStart(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore("故事开场"), perFic);
        props.onUpdate(function (ss) { ss.beats = r.beats || []; ss.updatedAt = Date.now(); return ss; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }
    // ⚠️骨架那一枪失败过的局（beats 压根没落下来）再打开时要补一次——
    //   解析不出来时存的是空数组，那是「这一局没有骨架」，不该反复重抽。
    React.useEffect(function () { if (trans.length === 0 || !s.beats) start(); }, []);

    // 往下读一段原文（一分钱不花：这几段是她本来就写好的字）
    function readOn() {
      props.onUpdate(function (ss) {
        const i = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
        if (!paras[i]) return ss;
        ss.transcript = (ss.transcript || []).concat([{ who: "src", i: i, text: paras[i] }]);
        ss.paraIdx = i + 1; ss.updatedAt = Date.now();
        return ss;
      });
    }
    // 从原文的某一句起动笔：那一段【从这句往后】作废，你写你做了什么，
    // 引擎把后面改掉；她再伸手把故事往回接（或者跟你一起推远）。
    async function send(cutFrom) {
      const act = input.trim(); if (!act || busy) return;
      setInput(""); setWriting(false); setCut(null); setBusy(true);
      const note = wantNote();
      const cut = cutFrom || null;
      props.onUpdate(function (ss) {
        ss.transcript = (ss.transcript || []).concat([{ who: "me", text: act, from: cut ? cut.sentence : "" }]);
        if (cut) ss.voided = (ss.voided || []).concat([cut.i]).filter(function (x, k, a) { return a.indexOf(x) === k; });
        ss.updatedAt = Date.now(); return ss;
      });
      try {
        const nextPara = cut && paras[(Number.isFinite(s.paraIdx) ? s.paraIdx : 0)] || "";
        const r = await window.Fanfic.genRPTurn(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore(act), act, perFic,
          { wantNote: note, cut: cut ? { sentence: cut.sentence, rest: cut.rest, next: nextPara } : null });
        applyTurn(r);
        // 她跟着一起把故事推远时，会连后面几段原文也不要了
        if (r.voidAhead > 0) props.onUpdate(function (ss) {
          const from = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
          const more = [];
          for (let k = 0; k < r.voidAhead && paras[from + k]; k++) more.push(from + k);
          ss.voided = (ss.voided || []).concat(more);
          ss.paraIdx = from + more.length; ss.updatedAt = Date.now();
          return ss;
        });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 走到原著这一页的当口上了：照原样发生，还是花掉这一页把它拦下来
    // mode：true＝照原样，false＝拦下，"bend"＝顺着改（事成，但按她改出来的局面变个样子）
    async function resolve(bt, mode) {
      if (busy) return;
      setBusy(true);
      const keep = !!mode, bend = mode === "bend";
      const entry = { who: "page", beat: bt.id, label: bt.label, page: bt.page, keep: keep, bend: bend };
      const beats2 = (s.beats || []).map(function (x) { return x.id === bt.id ? Object.assign({}, x, { state: bend ? "bent" : keep ? "kept" : "broken" }) : x; });
      props.onUpdate(function (ss) {
        ss.beats = beats2; ss.pendingHit = null;
        ss.transcript = (ss.transcript || []).concat([entry]); ss.updatedAt = Date.now(); return ss;
      });
      // ⚠️传下去的必须是【已经带上这一页】的那份：props.session 这时还是旧的，
      // 用它组 messages 的话，模型收不到「我把这一页拦下了」那一句。
      const sess2 = Object.assign({}, s, { beats: beats2, pendingHit: null, transcript: (s.transcript || []).concat([entry]) });
      try {
        const r = await window.Fanfic.genRPTurn(props.active, sess2, props.fic, props.tab, cpc, props.userName, storyLore(bt.label), null, perFic, { resolve: { beat: bt, keep: keep, bend: bend }, wantNote: true });
        applyTurn(r);
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 她写的到头了：让她自己接着写下去（她 2026-09-05：「如果没写完的同人文改到底
    // 可以让她先继续写下去然后我们再继续改」）。
    // ⚠️两条线在这儿分岔，界线不许糊：
    //   · 她续的那一章是【她的字】→ 追加进原篇，谁再开一局都读得到；
    //   · 你改出来的那些是【你的字】→ 只留在这一版里，绝不回灌原文。
    //     回灌了的话，下一局你就是在改自己写的东西，「在别人写好的文上动笔」这个前提就没了。
    // ⚠️续写只吃【原文】，不吃这一局的 transcript：她那本书跟你这一版是平行的。
    //   把你这局的走向喂进去，别的局打开原文会读到你这儿发生的事——串场。
    //   genNextChapter 本来就只读 fic，所以直接用它，不另写一份（一层写在两处的老病）。
    // ⚠️只往【末尾】追加，绝不动前面的段落：voided / paraIdx 存的都是段落下标，
    //   在中间插一段会把正在玩的每一局都错位。
    async function writeOn() {
      if (busy || !props.fic) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!props.onExtendFic) { props.toast && props.toast("这一处没接上，先别点"); return; }
      setBusy(true);
      try {
        const ch = await window.Fanfic.genNextChapter(props.active, props.fic, props.tab, cpc, props.userName, storyLore("续章"), { perFic: perFic, style: (props.fic && props.fic.style) || "" });
        props.onExtendFic(props.fic.id, ch);
        props.toast && props.toast(authorName + "又写下去了一章，接着读吧");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 收尾：写最后一段 + 作者的判词，然后把这一版当成一篇文放回书架
    async function finish() {
      if (busy) return;
      setBusy(true);
      try {
        const r = await window.Fanfic.genRPEnding(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore("收束"), perFic);
        let done = null;
        props.onUpdate(function (ss) {
          ss.transcript = (ss.transcript || []).concat([{ who: "nar", text: r.text }].concat(r.verdict ? [{ who: "note", text: r.verdict, last: true }] : []));
          ss.done = true; ss.verdict = r.verdict || ""; ss.pendingHit = null; ss.updatedAt = Date.now();
          done = ss; return ss;
        });
        if (props.onShelveFic && done) {
          const f = window.Fanfic.rpToFic(done, props.fic, r.verdict || "", r.reviews);
          props.onShelveFic(f);
          props.toast && props.toast((r.reviews || []).length
            ? "这一版放回书架了，底下已经有 " + r.reviews.length + " 条在说话"
            : "这一版放回书架了：" + f.title);
        }
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    const lastParas = lastNarIdx >= 0 ? trans[lastNarIdx].text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    const moreToReveal = lastNarIdx >= 0 && reveal < lastParas.length;
    // v62.50：读原文的时候也轮得到我——加笔的入口就是【点住原文里的一句】。
    //   开局第一条是原文（who:"src"），lastNarIdx 还是 -1，用老条件的话按钮永远不出现。
    const canAct = !busy && trans.length > 0 && !moreToReveal && !s.done;
    const hitBeat = s.pendingHit ? beats.find(function (bt) { return bt.id === s.pendingHit; }) : null;
    const spoiler = s.know === "spoiler";
    const selBeat = sel ? beats.find(function (bt) { return bt.id === sel; }) : null;
    const brokenN = beats.filter(function (bt) { return bt.state === "broken"; }).length;
    const authorName = window.Fanfic.rpAuthorName(props.fic);

    // 一段【原文】：她写的字。浅一档、行距更宽、可以逐句点。
    // ⚠️和你改出来的那些字必须一眼分得开——不能只靠颜色（色弱和阳光下只剩形状可依）：
    //   原文左边留白、字浅、行距宽；你的那些字顶格、墨色、行距正常。
    function srcPara(e, key) {
      const dead = (s.voided || []).indexOf(e.i) >= 0;
      const sentences = window.Fanfic.rpSentences(e.text);
      const last = !dead && e.i === (Number.isFinite(s.paraIdx) ? s.paraIdx - 1 : -1);
      return h("p", { key: key, style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 2.15, color: dead ? t.fog : t.sub,
          margin: "0 0 16px", paddingLeft: 12, borderLeft: "1px solid " + (dead ? "transparent" : t.line),
          textDecoration: dead ? "line-through" : "none", opacity: dead ? .55 : 1 }, "data-wk": "ficrpthreadsrcpara" },
        sentences.map(function (sn, j) {
          // 只有【还没读过头】的那一段能下笔：往回改早就翻过去的段落会把整条时间线拧乱
          if (dead || !last || s.done || busy) return h("span", { key: j, "data-wk": "ficrpthread" }, sn);
          const on = cut && cut.i === e.i && cut.sentence === sn;
          return h("span", { key: j, onClick: function () { setCut(on ? null : { i: e.i, sentence: sn, rest: sentences.slice(j + 1).join("") }); setWriting(!on); },
            style: { cursor: "pointer", borderBottom: on ? "2px solid " + t.accent : "1px dotted " + hexA(t.ink, .28), background: on ? hexA(t.accent, .12) : "transparent", color: on ? t.ink : "inherit" }, "data-wk": "ficrpthread", "data-part": "r2", "data-on": on ? "1" : "0" }, sn);
        }));
    }
    // 一段叙事正文
    function para(txt, key) { return h("p", { key: key, style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.95, color: t.ink, whiteSpace: "pre-wrap", margin: "0 0 14px" }, "data-wk": "ficrpthreadpara" }, txt); }

    return h("div", { className: "h-full flex flex-col", "data-wk": "ficrpthreadpara", "data-part": "r2" },
      // ⚠️v61.27：这里原来自己写了一条紧凑标题栏，因为当时 Head 还是「30px 大标题」。
      //   Head 已经改成紧凑栏了（components.js），这一份就撤掉——
      //   同一层东西不许有两个实现，不然下次只会改到其中一处。
      //   「收尾」放右侧那个等宽操作位；这一步不可逆，所以照旧要点两下。
      h(Head, { bg: "transparent",
        zh: s.ficTitle || "加笔中",
        // ⚠️空的那几栏不许拼进去：新局没有落点，硬拼会留下一条「原创的那位 · 」的尾巴
        // ⚠️空的那几栏不许拼进去：硬拼会留下一条「 · 」的尾巴
        sub: [window.Fanfic.rpKnowLabel(s.know), "原稿还剩 " + window.Fanfic.rpLeftPct(s, paras) + "%"].filter(Boolean).join(" · "),
        onBack: props.onBack,
        right: (props.fic && !s.done && trans.length >= 4)
          ? h("button", { onClick: function () { requestAppConfirm("现在收尾定稿？", "写完收束和作者的判词，这一版放回书架；这一步不可逆。", function () { finish(); }, "收尾", null, { danger: false }); }, className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.15, padding: "2px 0" }, "data-wk": "ficrpthreadbtn", "data-part": "1" }, "收尾")
          : null
      }),
      !props.fic ? h("div", { className: "flex-1 flex items-center justify-center px-8 text-center", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "原篇已不在（可能取消了收藏被清理），此存档无法继续。") :
      // ⚠️这一层原来写着 background: t.bg，把外壳那张纸皮整个盖掉了
      // （审美审计 2026-09-04 点名；mobile-ui-layout §3.5：底纹铺在最外那层外壳上，
      //   中间这些层一律透明）。
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-7 pb-8" },
        h("div", { style: { height: 8 } }),
        // 原稿剩余：偏离度不再是一个抽象数字，是【这篇文还剩几成是她写的】
        paras.length ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "2px 2px 8px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".14em", color: t.fog, whiteSpace: "nowrap" } }, "原稿剩余"),
          h("span", { style: { flex: 1, height: 3, background: t.line, position: "relative" } },
            h("span", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: leftPct + "%", background: t.ink, opacity: .7 } })),
          h("span", { style: { fontFamily: "monospace", fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog } }, leftPct + "%")) : null,
        // 她此刻站在哪一步：改得越远她越往前站，但【永远不会走开】
        // （她 2026-09-05：「后果不能他们弃坑不写，就是看他们批注才有意思」）。
        // ⚠️不是一颗填色的药丸：它是压在原稿那条线下面的一行落款小字，带一支笔尖。
        (paras.length && !s.done) ? h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "0 2px 10px" } },
          h("span", { style: { fontSize: "calc(10px * var(--app-fs, 1))", color: t.accent } }, "✍"),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.sub } }, authorName),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "此刻"),
          h("span", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.accent, borderBottom: "1px solid " + hexA(t.accent, .45), paddingBottom: 1 } },
            window.Fanfic.rpDevBand(s.dev).tag)) : null,
        // 书脊：原著后面本来会发生的那几页，走过一页在脊上就落一个记号
        h(RPSpine, { t: t, beats: beats, spoiler: spoiler, sel: sel, onPick: setSel }),
        selBeat ? h("div", { "data-wk": "block", className: "mb-3", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px 10px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: "0.14em", color: t.fog, marginBottom: 3 } },
            selBeat.state === "broken" ? "这一页被你拦下了" : selBeat.state === "bent" ? "这一页顺着你改过的发生了" : selBeat.state === "kept" ? "这一页照原样发生了" : spoiler ? "原著后面写着" : "还没翻到这一页"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: selBeat.state === "broken" ? t.fog : t.sub, textDecoration: selBeat.state === "broken" ? "line-through" : "none" } },
            (selBeat.state !== "pending" || spoiler) ? selBeat.page : "你是空手进来的——走到跟前才知道这一页写的是什么。")) : null,
        // 正文（叙事段落 + 我写进去的行动 + 结算掉的页 + 作者的页边批注）
        trans.map(function (e, i) {
          if (e.who === "src") return srcPara(e, i);
          if (e.who === "me") return h("div", { key: i, className: "my-5", style: { borderLeft: "2px solid " + t.accent, paddingLeft: 12 }, "data-wk": "ficrpthread", "data-part": "r3" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: "0.14em", color: t.accent, marginBottom: 3 } },
              e.from ? "✒ 从「" + String(e.from).slice(0, 12) + "…」这句起，你写下" : "✒ 你写下"),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.85, color: t.accent, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" } }, e.text));
          if (e.who === "page") return h("div", { key: i, className: "my-4 flex items-center gap-2", "data-wk": "ficrpthread", "data-part": "r4" },
            h("div", { style: { flex: 1, height: 1, background: e.keep ? t.line : t.accent, opacity: e.keep ? 1 : 0.5 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: "0.08em", color: e.keep ? t.fog : t.accent, whiteSpace: "nowrap" } },
              e.bend ? "原著这一页「" + e.label + "」顺着改过的发生" : e.keep ? "原著这一页「" + e.label + "」照原样发生" : "原著这一页「" + e.label + "」被你拦下"),
            h("div", { style: { flex: 1, height: 1, background: e.keep ? t.line : t.accent, opacity: e.keep ? 1 : 0.5 } }));
          // 作者伸的那一手：它已经发生在正文里了，这一条只是把它【指出来】——
          // 所以不是气泡也不是段落，是压在正文和批注之间的一行细字，带一道从右边伸过来的横线
          if (e.who === "pull") {
            if (i > lastNarIdx && moreToReveal) return null;
            return h("div", { key: i, className: "flex items-center gap-2 my-3", "data-wk": "ficrpthread", "data-part": "r5" },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent, whiteSpace: "nowrap" } }, "✍ " + authorName + " 伸手：" + e.text),
              h("div", { style: { flex: 1, height: 1, background: t.accent, opacity: .35 } }));
          }
          if (e.who === "note") {
            // 作者趴在稿子边上写的一句：不是正文，所以歪着、挤在页边、字比正文小
            if (i > lastNarIdx && moreToReveal) return null;   // 那一拍还没读完，别提前剧透她的反应
            return h("div", { key: i, className: "flex justify-end my-4", "data-wk": "ficrpthread", "data-part": "r6" },
              h("div", { style: { maxWidth: "80%", transform: "rotate(-1.1deg)", borderLeft: "2px solid " + t.fog, paddingLeft: 9, paddingRight: 2 } },
                h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: t.sub, whiteSpace: "pre-wrap" } }, e.text),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.fog, marginTop: 3, textAlign: "right" } }, "—— " + authorName + (e.last ? " · 看完这一版" : " · 写在页边"))));
          }
          const paras = e.text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean);
          const showN = (i === lastNarIdx) ? Math.min(reveal, paras.length) : paras.length;
          const fullyShown = showN >= paras.length;
          // 只念台词：抠出这拍里引号内的对白，纯旁白就不出 ▶
          const say = typeof extractSpeech === "function" ? extractSpeech(e.text) : e.text;
          return h("div", { key: i, "data-wk": "ficrpthread", "data-part": "r7" },
            (showN ? paras.slice(0, showN) : [e.text]).map(function (p, j) { return para(p, j); }),
            // 这一拍的创作小稿（读完这一拍才出现，否则等于提前剧透这一段要写什么）
            (fullyShown && (e.cot || e.cotRequested) && typeof CotReveal === "function")
              ? h(CotReveal, { cot: e.cot, requested: e.cotRequested }) : null,
            (fullyShown && say && rtp && narVoice && typeof TtsDot === "function") ? h("div", { style: { marginTop: -6, marginBottom: 12 } },
              h(TtsDot, { k: "rp" + i, text: say, spk: narVoice, tp: rtp })) : null);
        }),
        busy ? h(Spinner, { label: trans.length ? "剧情推进中…" : "开场中…" }) : null,
        // 逐段展开
        moreToReveal ? h("button", { onClick: function () { setReveal(reveal + 1); }, className: "w-full active:opacity-60 mt-1 mb-2", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "10px" }, "data-wk": "ficrpthreadbtn", "data-part": "2" }, "▾ 显示下一段（" + reveal + "/" + lastParas.length + "）") : null,
        // 往下读一段她写的字（一分钱不花：这几段本来就在那儿）
        (!s.done && !busy && !moreToReveal && moreSrc) ? h("button", { onClick: readOn, className: "w-full active:opacity-60 mt-1 mb-3",
          style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, padding: "11px", border: "1px dashed " + t.line, borderRadius: 10, background: "transparent" }, "data-wk": "ficrpthreadbtn", "data-part": "3" },
          "▾ 接着读她写的（还剩 " + (paras.length - s.paraIdx) + " 段）") : null,
        (!s.done && !moreSrc && paras.length) ? h("div", { className: "text-center", style: { padding: "6px 0 12px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "—— 她写的到这儿就没了 ——"),
          // 没写完的文：让她自己往下写一章，写完你接着改
          (!busy && props.onExtendFic) ? h("button", { onClick: writeOn, className: "active:opacity-60 mt-2",
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.accent, padding: "9px 16px", border: "1px solid " + hexA(t.accent, .5), borderRadius: 999, background: "transparent" }, "data-wk": "ficrpthreadbtn", "data-part": "4" },
            "催她写下去（她再写一章，你接着改）") : null) : null,
        s.done ? h("div", { className: "text-center py-6", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8 } },
          "—— 这一版到此为止 ——", h("br"), brokenN ? "这本书被你改了 " + brokenN + " 处，已经放回书架" : "你一页也没改，这一版已经放回书架") : null),
      // 底部：走到原著某一页的当口 → 先决定它发不发生；否则读完了才出现"写下你的行动"
      props.fic && hitBeat && !busy && !moreToReveal
        // 从原著里撕下来的一页：上沿是虚的（撕口），下沿才是圆的
        ? h("div", { "data-wk": "block", className: "shrink-0 mx-4 mb-3 mt-1", style: { background: t.bg2, border: "1px solid " + t.line, borderTop: "2px dashed " + t.fog, borderRadius: "2px 2px 12px 12px", padding: "12px 14px 13px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: "0.16em", color: t.fog, marginBottom: 5 } }, "原著这一页本来写的是"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, marginBottom: 4 } }, hitBeat.label),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: t.sub, marginBottom: 11 } }, hitBeat.page),
            h("div", { className: "flex gap-2" },
              h("button", { onClick: function () { resolve(hitBeat, true); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "10px 4px", borderRadius: 10, minHeight: 40 }, "data-wk": "ficrpthreadbtn", "data-part": "5" }, "照原样发生"),
              // 第三条路（她 2026-09-27）：事还是成，但顺着她改出来的局面变个样子
              h("button", { onClick: function () { resolve(hitBeat, "bend"); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "1px solid " + t.ink, padding: "10px 4px", borderRadius: 10, minHeight: 40 }, "data-wk": "ficrpthreadbtn", "data-part": "6" }, "顺着改"),
              h("button", { onClick: function () { resolve(hitBeat, false); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.accent, background: "transparent", border: "1px solid " + t.accent, padding: "10px", borderRadius: 10 }, "data-wk": "ficrpthreadbtn", "data-part": "7" }, "拦下")))
        : props.fic && canAct ? h("div", { className: "shrink-0" },
          writing
            ? h("div", { className: "px-4 py-3", style: { background: t.bg2, borderTop: "1px solid " + t.line } },
              cut ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent, marginBottom: 6, lineHeight: 1.5 } },
                "从「" + String(cut.sentence).slice(0, 18) + (String(cut.sentence).length > 18 ? "…" : "") + "」这一句起，往后她写的就作废了")
                : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "没点句子＝接着往下写，她写的那些留着"),
              h("div", { className: "flex items-end gap-2" },
                h("span", { style: { color: t.accent, fontSize: "calc(16px * var(--app-fs, 1))", paddingBottom: 5 } }, "✒"),
                h("textarea", { "data-wk": "textarea", ref: taRef, value: input, autoFocus: true, rows: 1, onChange: function (e) { setInput(e.target.value); autoGrow(); }, onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(cut); } }, placeholder: "写下你的行动 / 说的话…（Enter 发送，Shift+Enter 换行）", className: "flex-1 outline-none resize-none", style: { minWidth: 0, fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.ink, background: "transparent", borderBottom: "1px solid " + t.line, padding: "4px 2px", maxHeight: 130, overflowY: "auto", wordBreak: "break-word" }, "data-wk": "ficrpthreadtext", "data-part": "写下你的行动 / 说的话" }),
                h("button", { onClick: function () { send(cut); }, disabled: !input.trim(), className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0", style: { width: 38, height: 38, borderRadius: 999, background: t.accent }, "data-wk": "ficrpthreadbtn", "data-part": "8" }, h(ISend, { size: 15, color: "#fff" }))))
            : h("button", { onClick: function () { setWriting(true); }, className: "w-full active:opacity-70 px-4 mb-1 mt-1", style: { background: "transparent" }, "data-wk": "ficrpthreadbtn", "data-part": "9" },
                h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12, textAlign: "center" } },
                  moreSrc ? "✒ 点住上面那一句，从那儿动笔" : "✒ 写下你的行动")),
          // 收尾挪到顶栏右侧那个等宽位了（这一步不可逆，所以照旧要点两下）
          null)
        : null);
  }

  // ---------- 作者榜 ----------
  // 这个圈子里固定的那几位太太。⚠️不是「一排卡片」：作者榜在现实里是
  // 【一份署名表】——名字靠左立着，右边跟着她的产出。所以这一页长成一张表，
  // 不是网格（tabs-not-plain-pills.md 的同一条判据：换个 app 还成立就是没设计）。
  // 热度那一道朱笔：名册那一页和她的主页共用这一个（别各画各的）。
  // ⚠️给的是【条 + 话 + 数】三样：光一条看不出烫到哪儿了，光一个数她得自己去记 45／70。
  function heatMark(v, t, tail) {
    const b = window.Fanfic.heatBand(v);
    const red = "#a8392f";
    const on = b.key !== "calm";
    return h("span", { className: "flex items-center", style: { gap: 6, marginTop: 5 }, "data-wk": "ficrpthreadheatmark" },
      h("span", { style: { width: 44, height: 3, background: t.line, flexShrink: 0, overflow: "hidden" } },
        h("span", { style: { display: "block", height: "100%", width: Math.max(3, b.v) + "%", background: on ? red : t.fog } })),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: on ? red : t.fog } }, b.zh),
      h("span", { style: { fontFamily: "monospace", fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog } }, b.v),
      tail ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, tail) : null);
  }
  function AuthorsPage(props) {
    const t = useTheme();
    const [list, setList] = useState(function () { return window.Fanfic.loadAuthors(); });
    const [open, setOpen] = useState(null);   // 打开的那位
    const [busy, setBusy] = useState(false);
    // 从别处点名进来（书评区点了某位太太的名字）：翻到她那一条
    useEffect(function () {
      const nm = String(props.startName || "").trim();
      if (!nm) return;
      const hit = window.Fanfic.loadAuthors().filter(function (a) { return String(a.name || "").trim() === nm; })[0];
      props.onStartUsed && props.onStartUsed();
      if (hit) setOpen(hit.id);
    }, [props.startName]);
    // 她 2026-09-11：「请作者的时候能不能给一个写想要什么类型或者文风还有磕啥 cp 的」。
    // ⚠️不另开一层：这是「一行字 + 一颗键」，开半窗反而更重（no-half-sheet.md 的判据）。
    //   记在本地：她多半想连着请几批同一个方向的人。
    // ⚠️同一天她又说：「那个框能不能放进请人里面，点击请人打开输入再生成」——
    //   原来它常年杵在名册顶上，而她十次里有九次是直接翻名册的。
    //   所以改成【点了「请人」才掀开】：不是新开一层（那才要按整页办），
    //   是那颗键自己底下长出来的一张稿约条。
    const [asking, setAsking] = useState(false);
    const [want, setWant] = useState(function () { try { return localStorage.getItem("x_ficAuthorWant") || ""; } catch (e) { return ""; } });
    const setWantSaved = function (v) { setWant(v); try { localStorage.setItem("x_ficAuthorWant", String(v || "").slice(0, 300)); } catch (e) {} };
    const fics = props.fics || [];
    function refresh() { setList(window.Fanfic.loadAuthors()); }
    async function invite() {
      if (busy) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      setBusy(true);
      try {
        const got = await window.Fanfic.genAuthors(props.active, 4, props.tabs, props.characters, props.userName, window.Fanfic.loadAuthors(), want);
        refresh(); setAsking(false);
        props.toast && props.toast("来了 " + got.length + " 位：" + got.map(function (a) { return a.name; }).join("、"));
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }
    const cur = open ? list.filter(function (a) { return a.id === open; })[0] : null;
    if (cur) return h(AuthorHome, { author: cur, fics: fics, characters: props.characters, userName: props.userName,
      onBack: function () { setOpen(null); refresh(); }, onOpenFic: props.onOpenFic, onAddOn: props.onAddOn,
      onDelete: function (nm) {
        window.Fanfic.removeAuthor(nm);
        setOpen(null); refresh();
        props.toast && props.toast("「" + nm + "」已请出名册（她的文留着）");
      } });
    // 一行一位：左边名字立着，右边是她的产出
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficauthorspage" },
      h(Head, { bg: "transparent", zh: "作者", sub: list.length ? list.length + " 位常驻" : "这个圈子还没人", onBack: props.onBack,
        right: h("button", { onClick: function () { if (!busy) setAsking(!asking); }, disabled: busy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: busy ? t.fog : t.accent }, "data-wk": "ficauthorspagebtn", "data-part": "1" },
          busy ? "请人中…" : (asking ? "算了" : "＋ 请人")) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, padding: "10px 2px 8px" } },
          "她们是这个圈子的常驻——清空版块只清文，人留着。生成同人文时可以点名让某一位来写。"),
        // 点了「请人」才掀开的那张稿约条：一行眉标 + 一格空白 + 一颗键。
        asking ? h("div", { style: { border: "1px dashed " + t.line, padding: "11px 12px 12px", marginBottom: 14, background: "transparent" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, letterSpacing: ".16em", marginBottom: 7 } }, "想请什么样的"),
          h("textarea", { "data-wk": "textarea", value: want, onChange: function (e) { setWantSaved(e.target.value); }, rows: 3, autoFocus: true,
            placeholder: "写什么类型、什么文风、磕哪对…空着就随缘",
            className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, padding: "8px 0 10px",
              background: "transparent", color: t.ink, border: "none", borderBottom: "1px solid " + t.line, resize: "vertical" }, "data-wk": "ficauthorspagetext", "data-part": "写什么类型、什么文风、磕" }),
          h("button", { onClick: invite, disabled: busy, className: "w-full active:opacity-75",
            style: { marginTop: 12, minHeight: 44, border: "none", background: t.ink, color: t.bg2,
              fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".08em" }, "data-wk": "ficauthorspagebtn", "data-part": "2" }, busy ? "去问了…" : "请 4 位进来")) : null,
        list.length ? list.map(function (a, i) {
          const mine = window.Fanfic.authorFics(a.name, fics);
          const cps = window.Fanfic.authorCPStats(a.name, fics, props.characters, props.userName);
          return h("button", { key: a.id, onClick: function () { setOpen(a.id); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 2px", borderTop: i ? "1px solid " + t.line : "none", background: "transparent", border: "none" }, "data-wk": "ficauthorspage", "data-part": "r2" },
            // 名次：署名表上的序号，用等宽的老式数字
            h("span", { style: { fontFamily: "monospace", fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, width: 20, flexShrink: 0, paddingTop: 3 } }, String(i + 1).padStart(2, "0")),
            h("span", { style: { flex: 1, minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, a.name),
              a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginTop: 2, lineHeight: 1.55 } }, a.style) : null,
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } },
                mine.length + " 篇" + (cps.length ? " · 最常写 " + cps[0].label + "（" + cps[0].n + "）" : " · 还没写")),
              // 还没写过的那几位没有热度可言——热度是按篇记的，没篇就没有
              mine.length ? heatMark(window.Fanfic.authorHeatOf(a.name, fics).heat, t) : null),
            h(IChevR, { size: 15, color: t.fog, style: { marginTop: 4, flexShrink: 0 } }));
        }) : h(Empty, { text: "这个圈子还没有常驻作者", sub: "点右上「＋ 请人」请几位进来；生成同人文时也会自动把新笔名收进来" })));
  }
  // ⚠️这一页不是「一张个人资料卡」——那种东西换到任何 app 里都成立（她 2026-09-05：
  //   「页面还是无聊」）。它是**她那本个人志的扉页 + 目录**：
  //   上半页是扉页（双线框、落款闲章、手写的一句），下半页是目录（卷号 + 引点线 + 字数）。
  function AuthorHome(props) {
    const t = useTheme();
    const a = props.author;
    const mine = window.Fanfic.authorFics(a.name, props.fics).slice().sort(function (x, y) { return (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0); });
    const cps = window.Fanfic.authorCPStats(a.name, props.fics, props.characters, props.userName);
    const st = window.Fanfic.authorStats(a.name, props.fics);
    const [ask, setAsk] = useState(false);
    const stat = function (k, v) {
      return h("span", { key: k, className: "flex items-baseline", style: { gap: 3, whiteSpace: "nowrap" }, "data-wk": "ficauthorhomestat" },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, k),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, fmtNum(v)));
    };
    const sec = function (zh) {
      return h("div", { className: "flex items-center", style: { gap: 8, margin: "20px 0 9px" }, "data-wk": "ficauthorhomesec" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, letterSpacing: ".22em", whiteSpace: "nowrap" } }, zh),
        h("span", { style: { flex: 1, height: 1, background: t.line } }));
    };
    return h("div", { className: "h-full flex flex-col", "data-wk": "ficauthorhomesec", "data-part": "r2" },
      h(Head, { bg: "transparent", zh: a.name, sub: st.works + " 篇", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        // ── 扉页：双线框 + 头像 + 笔名 + 落款闲章 ──
        h("div", { style: { marginTop: 12, padding: "16px 15px 14px", border: "1px solid " + t.line, boxShadow: "inset 0 0 0 3px " + (t.bg2 || t.bg) + ", inset 0 0 0 4px " + t.line, background: t.bg2 || t.bg } },
          h("div", { className: "flex items-start", style: { gap: 12 } },
            window.Fanfic.authorFace(a.name, 52),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, letterSpacing: ".04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a.name),
              h("div", { style: { fontFamily: "monospace", fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 3 } }, "@" + ficPenId(a.name))),
            window.Fanfic.authorSeal(a.name, 34)),
          a.bio ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.9, color: t.ink, marginTop: 12, paddingTop: 11, borderTop: "1px solid " + t.line } }, a.bio) : null,
          // 那一行数：小字排成一行，不是五个并排的大数字（那是社交 app 的长相）
          h("div", { className: "flex", style: { gap: 13, marginTop: 11, flexWrap: "wrap" } },
            stat("作品", st.works), stat("字", st.words), stat("被喜欢", st.kudos), stat("粉丝", st.fans), stat("关注", st.following))),
        // ⚠️扉页底下这一块是【她自己挂在个人页上的签名】，不是第三人称的介绍
        //   （她 2026-09-11：「里面那一块应该是她自己的签名而不是第三人称描述」）。
        //   老存档里的太太没有这一栏——那就不画这一块，不拿路数去顶（顶上去就又是第三人称）。
        a.sign ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.85, color: t.sub, marginTop: 13, borderLeft: "2px solid " + t.line, paddingLeft: 11 } }, a.sign) : null,
        // 路数挪到这儿来，跟「碰不得」「你动她的文」排成一列：这三样都是【关于她的】，
        // 签名那一块是【她自己说的】，两种东西不该长成一个样子。
        a.style ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 13 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.sub, border: "1px solid " + t.line, borderRadius: 2, padding: "1px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "她的文"),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub } }, a.style)) : null,
        a.sore ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 9 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", background: "#a8392f", borderRadius: 2, padding: "1.5px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "碰不得"),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog } }, a.sore)) : null,
        // 有人改她的文时她是哪一路——加笔那边整场就跟着这一句走，所以这儿要看得见
        a.temper ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 7 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.bg, background: t.ink, borderRadius: 2, padding: "1.5px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "你动她的文"),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog } }, a.temper)) : null,
        // 热度：名册那一页只看得见数，看不见是为哪一篇气的——这儿把那一篇也写上
        (function () {
          const hb = window.Fanfic.authorHeatOf(a.name, props.fics);
          return hb.n ? heatMark(hb.heat, t, hb.fic ? "《" + hb.fic.title + "》" : "") : null;
        })(),
        // ── 写了谁：正字计数 ──
        cps.length ? h("div", null, sec("写了谁"),
          cps.map(function (c) {
            return h("div", { key: c.key, className: "flex items-center", style: { gap: 9, marginBottom: 7 }, "data-wk": "ficauthorhome" },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, width: 92, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.label),
              window.Fanfic.zhengTally(c.n, t.ink, 17),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, c.n + " 篇"));
          })) : null,
        // ── 目录：卷号 + 引点线 + 字数（书里的目录就长这样）──
        sec("目 录"),
        mine.length ? mine.map(function (f, ix) {
          const hh = f.stats || ficHeat(f.id);
          const w = ficWords(f);   // ⚠️同上：章节那一栏叫 content
          return h("div", { key: f.id, style: { padding: "9px 0 10px", borderBottom: "1px dotted " + t.line }, "data-wk": "ficauthorhome", "data-part": "r2" },
            h("div", { className: "flex items-baseline", style: { gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, width: 20, flexShrink: 0, textAlign: "center" } }, cnIndex(ix + 1)),
              h("button", { onClick: function () { props.onOpenFic && props.onOpenFic(f.id); }, className: "text-left active:opacity-70", style: { minWidth: 0, background: "transparent", border: "none", padding: 0, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, "data-wk": "ficauthorhomebtn", "data-part": "1" }, f.title),
              h("span", { style: { flex: 1, minWidth: 12, borderBottom: "1px dotted " + t.line, transform: "translateY(-3px)" } }),
              h("span", { style: { fontFamily: "monospace", fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, fmtNum(w))),
            h("div", { className: "flex items-center", style: { gap: 6, marginTop: 5, paddingLeft: 28, flexWrap: "wrap" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, cpLabel(f.cp, props.characters, props.userName) + " · " + (f.chapters || []).length + " 章 · ♡ " + fmtNum(hh.kudos)),
              (f.tags || []).slice(0, 3).map(function (tg, k) {
                return h("span", { key: k, style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.sub, border: "1px solid " + t.line, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }, "data-wk": "ficauthorhome", "data-part": "r3" }, tg);
              }),
              h("span", { style: { flex: 1 } }),
              h("button", { onClick: function () { props.onAddOn && props.onAddOn(f.id); }, className: "shrink-0 active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent, border: "1px solid " + t.accent, borderRadius: 999, padding: "3px 10px" }, "data-wk": "ficauthorhomebtn", "data-part": "2" }, "加笔")));
        }) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "她还没在这儿写过——生成同人文时点名让她写一批。"),
        // ── 请她离开（她 2026-09-05 要的）──
        props.onDelete ? h("div", { style: { marginTop: 26 } },
          ask
            ? h("div", { style: { border: "1px solid " + t.line, borderRadius: 10, padding: "12px 13px", background: t.bg2 || t.bg } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.75, color: t.ink } },
                "把「" + a.name + "」从名册里请走？"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog, marginTop: 5 } },
                mine.length ? "她写过的 " + mine.length + " 篇文【留着】，只是往后不再点得到她了。" : "她还没写过文，删掉不影响任何东西。"),
              h("div", { className: "flex", style: { gap: 9, marginTop: 12 } },
                h("button", { onClick: function () { setAsk(false); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 0", background: "transparent" }, "data-wk": "ficauthorhomebtn", "data-part": "3" }, "算了"),
                h("button", { onClick: function () { props.onDelete(a.name); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#fff", background: "#a8392f", border: "1px solid #a8392f", borderRadius: 10, padding: "9px 0" }, "data-wk": "ficauthorhomebtn", "data-part": "4" }, "请走")))
            : h("button", { onClick: function () { setAsk(true); }, className: "w-full active:opacity-65", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a8392f", border: "1px solid rgba(168,57,47,.4)", borderRadius: 10, padding: "11px 0", background: "transparent" }, "data-wk": "ficauthorhomebtn", "data-part": "5" }, "把这位请出名册")) : null));
  }

  // ---------- 底 nav ----------
  function BottomNav(props) {
    const t = useTheme();
    const items = [
      // 她 2026-09-04：「中间那个加号（自己写文）移到我的里面，把加笔移到中间，
      // 原来的地方放作者榜」。中间那一枚是这个 app 的主动作——现在主动作是加笔。
      { key: "feed", label: "首页", G: IHome }, { key: "shelf", label: "书架", G: IShelf },
      { key: "rp", label: "加笔", center: true }, { key: "authors", label: "作者", G: IAuthors }, { key: "mine", label: "我的", G: GUser }
    ];
    // ⚠️底栏只吃 0.4 条底部安全区（COMPOSER_PAD_BOTTOM，engine.js）——
    // 和主聊天输入栏、购物底栏同一把尺子。这里原来吃的是【整条】
    // env(safe-area-inset-bottom)，在刘海机上比别处高出一截，
    // 正是 施工规则/mobile-ui-layout.md §2 点名不许干的事。
    // 图标 21 / 字号 10 / gap-0.5 也一并对齐购物那条底栏。
    return h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + t.line, background: t.bg, paddingBottom: COMPOSER_PAD_BOTTOM }, "data-wk": "ficbottomnav" },
      items.map(function (it) {
        const on = props.view === it.key;
        if (it.center) return h("button", { key: it.key, onClick: function () { props.onNav(it.key); }, className: "flex-1 py-2 flex items-center justify-center", "data-wk": "ficbottomnav", "data-part": "r2" },
          h("div", { className: "flex items-center justify-center", style: { width: 36, height: 36, borderRadius: 999, background: on ? t.accent : t.ink } }, h(IQuill, { size: 19, color: t.bg2 })));
        return h("button", { key: it.key, onClick: function () { props.onNav(it.key); }, className: "flex-1 py-2 flex flex-col items-center gap-0.5 active:opacity-60", style: { color: on ? t.ink : t.fog }, "data-wk": "ficbottomnav", "data-part": "r3", "data-on": on ? "1" : "0" },
          h(it.G, { size: 21, color: on ? t.ink : t.fog }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", fontWeight: on ? 600 : 400 } }, it.label));
      }));
  }

  // ============================================================
  // 主组件
  // ============================================================
  function FanficApp(props) {
    const appTheme = useTheme();
    // 她选的那张纸。⚠️用 state 存一份：在设置里换纸之后要立刻重绘，
    // 光读 loadCfg() 不会触发渲染。
    const [paperId, setPaperId] = useState(function () { return (loadCfg() || {}).paper || FIC_PAPER_DEFAULT; });
    const t = ficPaperTheme(appTheme, ficPaper({ paper: paperId }));
    setFicMe(props.meOf, props.profile);   // 「我」用哪张面具：交给 fanfic-core.js 那边存着（那两样住在它那儿）
    const [tabs, setTabs] = useState(loadTabs);
    const [fics, setFics] = useState(loadFics);
    const [cps, setCps] = useState(loadCPs);
    const [me, setMe] = useState(function () { return meProfile(loadMe(), props.profile); });
    const [activeTab, setActiveTab] = useState(tabs[0] && tabs[0].id);
    const [view, setView] = useState(() => (typeof takeOpenSub === "function" && takeOpenSub("fanfic", ["feed", "shelf", "publish", "rp", "authors", "mine"])) || "feed"); // feed / shelf / publish / rp / authors / mine
    const [rpStart, setRpStart] = useState(null); // 从作者主页点「加笔」带过来的那一篇
    const [openId, setOpenId] = useState(null);
    // ── 从房间里那张「TA写好了」直接翻到这一章（她 2026-09-12：
    //    「从房间到同人文有点慢，能不能搞个快捷键可以写了新章直接跳转过去」）
    // ⚠️只带【一次】：用完就还回去（onOpenUsed），否则她翻到别的篇、
    //   一 setState 又被拽回这一章。
    const [jumpChap, setJumpChap] = useState(null);
    useEffect(function () {
      const j = props.openFic;
      if (!j || !j.ficId) return;
      const f = (loadFics() || []).filter(function (x) { return x && x.id === j.ficId; })[0];
      if (f) { setFics(loadFics()); setView("feed"); setOpenId(f.id); setJumpChap(Number(j.chap) >= 0 ? Number(j.chap) : null); }
      else if (props.toast) props.toast("那一篇找不到了");
      props.onOpenFicUsed && props.onOpenFicUsed();
    }, [props.openFic]);
    const [gearOpen, setGearOpen] = useState(false);
    const [ficOrder, setFicOrder] = useState(function () { return loadJSON("x_ficOrder", {}) || {}; });
    const [moving, setMoving] = useState(null); // 长按的那一篇 {id,title,i,n}
    const [tabSheet, setTabSheet] = useState(null); // null | {} (new) | tabObj (edit)
    // 点标签只看这个标签的（AO3 上最常用的那一下）
    const [tagFilter, setTagFilter] = useState("");
    const [q, setQ] = useState("");            // 搜一下：标题／笔名／CP 里的人／标签／开头
    const [meOnly, setMeOnly] = useState(false); // 只看写我的
    // 读到哪儿了。关掉阅读页时重取一次，卡片上的「读到 3/8 章」才跟得上
    const [readMap, setReadMap] = useState(loadRead);
    const FANFIC_BATCH_TASK = "fanfic:batch";
    const [busy, setBusy] = useState(function () { return !!(window.BackgroundGeneration && window.BackgroundGeneration.state(FANFIC_BATCH_TASK).busy); });
    const [genProg, setGenProg] = useState(function () { return window.BackgroundGeneration ? window.BackgroundGeneration.state(FANFIC_BATCH_TASK).progress : null; });

    useEffect(function () {
      if (!window.BackgroundGeneration) return;
      return window.BackgroundGeneration.subscribe(FANFIC_BATCH_TASK, function (s) {
        setBusy(!!s.busy);
        setGenProg(s.progress || null);
        if (s.status === "done") setFics(loadFics());
      });
    }, []);

    const userName = (props.profile && props.profile.name) || "我";
    const characters = props.characters || [];          // 真人角色：转发选人用这份
    // cast＝含配角的全量：CP 选择、CP 名字解析、CP 预设都得看得见配角。
    // 老调用方没给 allChars 时退回 characters，行为和以前一样。
    const cast = props.allChars || characters;
    // 从书评区点进某位太太的主页：带一个笔名过去，那一页自己翻到她那一条
    const [authorStart, setAuthorStart] = useState("");
    const curTab = tabs.find(function (x) { return x.id === activeTab; }) || tabs[0];

    function persistFics(next) { if (saveFics(next)) { setFics(next); return true; } props.toast && props.toast("这次没保存成功，原文章还在"); return false; }
    function updateFic(id, fn) {
      const next = loadFics().map(function (f) { return f.id === id ? fn(Object.assign({}, f)) : f; });
      persistFics(next);
    }
    // 单篇删除（v64.63，她 2026-09-06：「要每一篇文可以单独删除」）。
    // ⚠️只从存档里拿掉这一篇，别动别的；删完不弹 toast——列表当场少一行，
    //   那比一句话更清楚（确认框已经问过一次了）。
    function toggleShelf(id) {
      updateFic(id, function (f) { f.onShelf = !f.onShelf; return f; });
      props.toast && props.toast("已" + (loadFics().find(function (f) { return f.id === id; }).onShelf ? "收藏" : "取消收藏"));
    }

    // 点赞（切换）
    function likeFic(id) { updateFic(id, function (f) { f.liked = !f.liked; return f; }); }
    function saveMeFn(m) { setMe(m); saveMe(m); props.toast && props.toast("已保存"); }
    // 转发：记录 sharedTo（item 8：新章推给这些角色）并调 app.js 真正 push
    function fwdChat(fic, ch) { updateFic(fic.id, function (f) { const s = f.sharedTo || []; if (s.indexOf(ch.id) < 0) s.push(ch.id); f.sharedTo = s; return f; }); props.onForwardToChat && props.onForwardToChat(fic, ch); }
    function fwdGroup(fic, g) { props.onForwardToGroup && props.onForwardToGroup(fic, g); }
    // 追更后通知曾被分享的角色读新章
    function chapterShared(fic, ch, chapNo) { props.onNotifyChapter && props.onNotifyChapter(fic, ch, chapNo, fic.sharedTo || []); }

    // 生成
    async function doGen(n, cp, styleIds, includeMe, briefs, byAuthor, groupWay, meMask, noCP, oneShot) {
      // ⚠️**用 cast 不是 characters**（她 2026-09-11 那三篇的病根就在这一行）：
      //   characters 是【真人角色】那一份，不含配角；cast 才是含配角的全量。
      //   挑人那一格用的是 cast（所以她挑得到「萧成烨」），可这一枪用的是 characters，
      //   于是配角出身的那一位在 cpChars 里【解析不出来、被 filter(Boolean) 悄悄丢掉】，
      //   两个人的 CP 变成一个人 —— cpBlock 就掉进「A × 原创对象」那一支，
      //   提示词上明明白白写着「另一方是一个由你设定的原创角色」。
      //   模型照做了：那只精怪、那个沈清和，都是这么来的。少掉的那一位从来没进过提示词。
      //   （一层写在两处、第二处没跟上：picker 升级成 cast 时，这一枪没跟着升。）
      const missing = (cp || []).filter(function (tok) {
        return tok && tok !== "me" && !cast.some(function (c) { return c && c.id === tok; });
      });
      // ⚠️再加一道明的：解析不出来就别开枪。悄悄少一位＝花了钱拿回一篇写跑的文，
      //   而她要翻开才知道。
      if (missing.length) {
        props.toast && props.toast("这一对里有 " + missing.length + " 位找不到了（多半是被删了），先去「谁和谁」重挑一下");
        return;
      }
      setGearOpen(false);
      props.toast && props.toast("已放到后台生成（" + n + " 篇），可以先去别的页面");
      const run = async function (updateProgress) {
        const chars = cpChars(cp, cast, props.profile, meMask);
        const routedWorldbook = props.worldbookFor ? props.worldbookFor((cp || []).filter(function (id) { return id && id !== "me"; }), [curTab.name, curTab.desc, (briefs || []).join("\n")].filter(Boolean).join("\n")) : props.worldbook;
        const cfg = loadCfg();
        // 本次勾选的文风（GenSheet 传来）→ 用它，并记住当默认；没传就退回上次的
        let styleText;
        let selectedStyleIds;
        if (Array.isArray(styleIds)) {
          saveCfg(Object.assign({}, cfg, { activeStyleIds: styleIds }));
          styleText = styleTextForIds(cfg, styleIds);
          selectedStyleIds = styleIds.slice();
        } else {
          styleText = activeStyleText(cfg);
          selectedStyleIds = (cfg.activeStyleIds || []).slice();
        }
        const selectedStyleLabels = allStylePresets(cfg).filter(function (s) { return selectedStyleIds.indexOf(s.id) >= 0; }).map(function (s) { return s.label || "未命名文风"; });
        // 推荐(mixed)版：把其它世界观当池子供每篇随机取
        const worldPool = curTab.mixed ? tabs.filter(function (x) { return !x.mixed; }) : null;
        const briefList = Array.isArray(briefs) ? briefs : [];
        const opts = { style: styleText, perFic: cfg.perFic, minChars: cfg.minChars, chatMaterial: chatMaterialFor(chars), worldPool: worldPool,
          briefs: briefList, author: byAuthor || null,
          includeMe: !!includeMe && !noCP, meName: (props.profile && props.profile.name) || userName || "我",
          mePersona: ((ficMeProfile(cp, props.profile, meMask) || {}).persona) || "", meAppearance: ((ficMeProfile(cp, props.profile, meMask) || {}).appearance) || "",
          groupWay: String(groupWay || "").trim(), noCP: !!noCP, oneShot: !!oneShot };
        // 超长文风（如金鱼灯）若一口气索要多篇，Supabase 代理要等整份 JSON 写完才回，
        // 很容易先撞上云端长请求时限。保留文风全文、不压字数，改为一篇一交：
        // 每篇完成立刻落库；中途失败也不赔掉已经写好的篇目。普通文风仍是一批一次调用。
        const LONG_STYLE_CHARS = 6000;
        const oneByOne = n > 1 && String(styleText || "").length >= LONG_STYLE_CHARS;
        const made = [];
        function records(arr, offset) {
          const now = Date.now();
          return arr.map(function (x, i) {
          return {
            // ⚠️那一向要落在【这篇文】上：续写第七章、加笔穿进去，读的都是这一栏
            id: uid("fic"), tabId: curTab.id, cp: cp || [], withMe: !!includeMe && !noCP, noCP: !!noCP, oneShot: !!oneShot, meMask: meMask || "", groupWay: String(groupWay || "").trim(), title: x.title, author: x.author, tags: oneShot ? ["完结"].concat((x.tags || []).filter(function (g) { return g !== "完结"; })) : x.tags, premise: x.premise || "",
            chapters: [{ content: x.body, endHook: x.endHook, cot: x.cot || null, cotRequested: !!x.cotRequested }], source: "npc", onShelf: false, sharedTo: [],
            generationStyleIds: selectedStyleIds.slice(), generationStyleLabels: selectedStyleLabels.slice(),
            stats: ficHeat(x.title + now + i + offset), reviews: [], createdAt: now - i - offset, updatedAt: now - i - offset
          };
          });
        }
        if (oneByOne) {
          for (let i = 0; i < n; i++) {
            updateProgress && updateProgress({ done: i, total: n }, "长文风分篇生成");
            // ⚠️分篇那条支路也得把这一篇的梗带上，否则长文风下点的梗静默失效
            const arr = await window.Fanfic.genBatch(props.active, curTab, chars, 1, userName, routedWorldbook,
              Object.assign({}, opts, { briefs: [briefList[i] || ""] }));
            const part = records(arr, i);
            made.push.apply(made, part);
            if (part.length) saveFics(part.concat(loadFics()));
            updateProgress && updateProgress({ done: i + 1, total: n }, "长文风分篇生成");
          }
        } else {
          const arr = await window.Fanfic.genBatch(props.active, curTab, chars, n, userName, routedWorldbook, opts);
          made.push.apply(made, records(arr, 0));
          saveFics(made.concat(loadFics()));
        }
        props.toast && props.toast("已生成 " + made.length + " 篇");
        return made;
      };
      if (!window.BackgroundGeneration) {
        setBusy(true);
        try { await run(); setFics(loadFics()); } catch (e) { props.toast && props.toast(String(e.message || e)); }
        setBusy(false); return;
      }
      try { await window.BackgroundGeneration.start(FANFIC_BATCH_TASK, { label: "同人文生成中" }, run); }
      catch (e) { props.toast && props.toast(String(e.message || e)); }
    }

    // 清空本版里没被留下的那些。
    // ⚠️这个按钮以前叫「刷新」，摆在齿轮旁边——但它【只删不生成】，
    // 生成在齿轮里。手一滑，点过赞、追到一半的文一次全没，还没有二次确认。
    // 现在：叫它本来的名字，删之前先说清楚要删几篇、留几篇。
    function clearTab() {
      const here = loadFics().filter(function (f) { return f.tabId === curTab.id; });
      const doomed = here.filter(function (f) { return !protectedFic(f); });
      if (!doomed.length) { props.toast && props.toast("本版没有可清的：剩下的都是收藏／自己写的／点过赞／在追的。要删某一篇，点那一篇右下角的 ✕"); return; }
      const kept = here.length - doomed.length;
      requestAppConfirm("清空【" + curTab.name + "】里的 " + doomed.length + " 篇？",
        (kept ? "另外 " + kept + " 篇会留下（收藏／自己写的／点过赞／在追的）。\n" : "") + "清完这一版是空的，要新的文请点齿轮生成。",
        function () { if (persistFics(loadFics().filter(function (f) { return f.tabId !== curTab.id || protectedFic(f); }))) props.toast && props.toast("已清空 " + doomed.length + " 篇"); }, "清空");
    }

    // 删掉某一篇（她 2026-09-20：「为啥清空不了，能不能搞个强制单个删除」）。
    // ⚠️它跟「清空」是两条不同的路，不是同一条的两个尺度：
    //   清空＝把这一版里【没被留下的】扫掉，保护是它的本分；
    //   这一颗＝她指着某一篇说「就删这个」，保护不该拦她——拦了就等于这篇永远删不掉。
    //   所以这儿不看 protectedFic，只在问那一句时把「它为什么被留着」说出来。
    function removeFic(f) {
      if (!f) return;
      const chN = (f.chapters || []).length;
      const why = f.source === "user" ? ((chN > 1 ? "连同 " + chN + " 章一起没了。" : "") + "这是你自己写的——删了回不来（别处没有副本）。")
        : f.onShelf ? "这篇在你书架上收着。"
        : f.liked ? "这篇你点过赞。"
        : (loadRead()[f.id] && loadRead()[f.id].chap > 0) ? "这篇你正在追。"
        : "删了之后这一版会少一篇，点齿轮能生成新的。";
      requestAppConfirm("删掉《" + (f.title || "这一篇") + "》？", why + "楼里的书评也会一起删掉。",
        function () {
          if (persistFics(loadFics().filter(function (x) { return String(x.id) !== String(f.id); }))) {
            if (String(openId) === String(f.id)) setOpenId(null);
            props.toast && props.toast("删掉了");
          }
        }, "删掉");
    }

    // 发布（onShelf=false → 留在 feed + 我发布的；source=user 刷新受保护不会被清）
    function publish(tabId, title, cp, tags, body) {
      const now = Date.now();
      const fic = { id: uid("fic"), tabId: tabId, cp: cp || [], title: title, author: me.name || userName, tags: tags, chapters: [{ content: body, endHook: "" }], source: "user", onShelf: false, sharedTo: [], stats: ficHeat(title + now), reviews: [], createdAt: now, updatedAt: now };
      persistFics([fic].concat(loadFics()));
      setActiveTab(tabId); setView("feed");
      props.toast && props.toast("已发布");
    }

    // tab 增删改
    function saveTab(id, name, desc) {
      let next;
      if (id) next = tabs.map(function (tb) { return tb.id === id ? Object.assign({}, tb, { name: name, desc: desc }) : tb; });
      else { const nt = { id: uid("tab"), name: name, desc: desc }; next = tabs.concat([nt]); }
      setTabs(next); saveTabs(next); setTabSheet(null);
      if (!id) props.toast && props.toast("已添加世界观");
    }
    function delTab(id) {
      const next = tabs.filter(function (tb) { return tb.id !== id; });
      setTabs(next); saveTabs(next); setTabSheet(null);
      if (activeTab === id) setActiveTab(next[0] && next[0].id);
    }

    function addCP(cp) { const next = cps.concat([cp]); setCps(next); saveCPs(next); }
    function delCP(id) { const next = cps.filter(function (c) { return c.id !== id; }); setCps(next); saveCPs(next); }

    // ---- 阅读页 ----
    // ⚠️所有 return 都得包在这一层里。阅读页这一支是提前 return 的，
    // 忘了包的话它就绕过了纸的主题——选了深夜，列表黑了、翻开还是米黄（实测踩到）。
    const onPaper = function (node) { return h(ThemeContext.Provider, { value: t }, node); };
    if (openId) {
      const f = fics.find(function (x) { return x.id === openId; });
      if (!f) { setOpenId(null); return null; }
      const ftab = tabs.find(function (x) { return x.id === f.tabId; }) || curTab;
      // ⚠️这一篇用【它自己那张纸】，不是列表那张：外层 Provider 和传给 Reader 的
      // 必须是同一张，否则头上那个小色块跟正文对不上。
      const fPaper = ficPaperFor(f, { paper: paperId });
      return h(ThemeContext.Provider, { value: ficPaperTheme(appTheme, fPaper) },
        h(FicMotionStyles, null),
        // ⚠️key 用这一篇的 id：换一篇就重挂一次，封面才会再掀一遍
        h("div", { key: f.id, className: "fic-open-book relative" }, h(Reader, {
        paper: fPaper,
        onSetPaper: function (pid) { updateFic(f.id, function (x) { x.paper = pid; return x; }); },
        fic: f, tab: ftab, active: props.active, characters: cast, fwdChars: characters, profile: props.profile,
        startChap: jumpChap, onStartChapUsed: function () { setJumpChap(null); },
        onOpenAuthor: function (nm) { setOpenId(null); setAuthorStart(nm); setView("authors"); },
        groups: props.groups || [], userName: userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        // 关阅读页时把进度重取一遍，卡片上那句「读到 3/8 章」才跟得上
        onBack: function () { setOpenId(null); setReadMap(loadRead()); },
        onUpdate: updateFic, onToggleShelf: toggleShelf, onLike: likeFic,
        onForwardToChat: fwdChat, onForwardToGroup: fwdGroup, onChapterShared: chapterShared,
        // 让角色来写：TA跟她、跟 CP 另一方是什么关系，由 app 那头算好递进来
        relOf: props.relOf, onFileChapter: props.onFileChapter, onNoteChapter: props.onNoteChapter, allChars: props.allChars,
        onFicImage: props.onFicImage, ficRegulars: props.ficRegulars
      })));
    }

    // ---- 各子页 ----
    let inner, moveSheet = null;
    if (view === "publish") {
      inner = h(Publish, { tabs: tabs, characters: cast, userName: userName, toast: props.toast, onBack: function () { setView("feed"); }, onPublish: publish });
    } else if (view === "mine") {
      inner = h(Mine, { characters: cast, cps: cps, userName: userName, me: me, fics: fics, profile: props.profile, active: props.active, toast: props.toast,
        onPaper: setPaperId,
        onBack: function () { setView("feed"); }, onAddCP: addCP, onDelCP: delCP, onWrite: function () { setView("publish"); },
        onOpenFic: function (id) { setOpenId(id); }, onSaveMe: saveMeFn, onDeleteFic: removeFic });
    } else if (view === "rp") {
      inner = h(RPApp, { fics: fics, tabs: tabs, characters: cast, profile: props.profile, userName: userName, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast, onBack: function () { setView("feed"); }, startFicId: rpStart, onStartUsed: function () { setRpStart(null); },
        // ⚠️这两条原来【一条都没传】：收尾那段代码写着 if (props.onShelveFic)，
        //   一路声明、一路转发、最后没人给——于是「这一版放回书架」从上线起一次都没发生过，
        //   而且不报任何错（施工规则/four-surfaces-same-context.md v55.95 那个形状：
        //   声明了但没人引用，比压根没写更坏，看代码以为已经在发了）。
        onShelveFic: function (f) { persistFics([f].concat(loadFics())); },
        // 她续的那一章追加进【原篇】：只往末尾加，前面的段落一个下标都不许动
        onExtendFic: function (id, ch) { updateFic(id, function (f) { f.chapters = (f.chapters || []).concat([ch]); f.updatedAt = Date.now(); return f; }); } });
    } else if (view === "authors") {
      inner = h(AuthorsPage, { fics: fics, tabs: tabs, characters: cast, userName: userName, active: props.active, toast: props.toast,
        startName: authorStart, onStartUsed: function () { setAuthorStart(""); },
        onBack: function () { setView("feed"); },
        onOpenFic: function (id) { setOpenId(id); },
        // 从作者主页直接加笔：把这一篇递给加笔那一屏，省得再去列表里找
        onAddOn: function (id) { setRpStart(id); setView("rp"); } });
    } else {
      // feed / shelf。item 5：收藏(onShelf)的从 feed 移除、只在书架出现
      // 搜的时候连 CP 里那几个人的名字一起搜——「按 CP 找」用的就是这条：
      // 打「裴照川」出来的是所有写TA的，不用先建一个 CP 预设。
      const kw = q.trim().toLowerCase();
      const hay = function (f) {
        const cpNames = (f.cp || []).map(function (id) {
          if (id === "me") return userName + " 我";
          // ⚠️同上：按 CP 找的时候也得看得见配角，不然写配角的那几篇搜不出来
          const c = cast.find(function (x) { return x.id === id; });
          return c ? (c.name + " " + (c.remark || "")) : "";
        }).join(" ");
        return [f.title, f.author || ficPenName(f.id), cpNames, (f.tags || []).join(" "),
          (((f.chapters || [])[0] || {}).content || f.body || "").slice(0, 120)].join(" ").toLowerCase();
      };
      const list = fics.filter(function (f) {
        if (tagFilter && (f.tags || []).indexOf(tagFilter) < 0) return false;
        if (meOnly && !ficHasMe(f)) return false;
        if (kw && hay(f).indexOf(kw) < 0) return false;
        // 搜的时候跨版搜：她记得有那么一篇，但多半不记得它在哪一版
        if (view === "shelf") return f.onShelf === true;
        if (kw) return !f.onShelf;
        return f.tabId === (curTab && curTab.id) && !f.onShelf;
      }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      // 她自己排过的顺序（x_ficOrder：{ 板块id 或 "shelf": [篇id…] }）。排过的照她排的；
      //   没排进去的（新写的）照旧按时间摆在最上面
      const orderKey = view === "shelf" ? "shelf" : (curTab && curTab.id) || "";
      const canReorder = (view === "shelf" || view === "feed") && !kw && !tagFilter && !meOnly && !!orderKey;
      if (orderKey && !kw) {
        const ord = (ficOrder[orderKey] || []);
        const pos = {}; ord.forEach(function (id, i) { pos[id] = i; });
        const fresh = list.filter(function (f) { return pos[f.id] == null; });
        const placed = list.filter(function (f) { return pos[f.id] != null; }).sort(function (a, b) { return pos[a.id] - pos[b.id]; });
        list.splice(0, list.length, ...fresh.concat(placed));
      }
      const moveFic = function (id, how) {
        const ids = list.map(function (f) { return f.id; });
        const i = ids.indexOf(id); if (i < 0) return;
        ids.splice(i, 1);
        const j = how === "top" ? 0 : how === "up" ? Math.max(0, i - 1) : Math.min(ids.length, i + 1);
        ids.splice(j, 0, id);
        const n = Object.assign({}, ficOrder, { [orderKey]: ids });
        setFicOrder(n); saveJSON("x_ficOrder", n);
      };
      if (moving) {
        const mi = list.findIndex(function (f) { return f.id === moving.id; });
        const btn = function (label, how, off, part) { return h("button", { key: how, "data-wk": "ficmovebtn", "data-part": part, disabled: off,
          onClick: function () { moveFic(moving.id, how); setMoving(null); },
          className: "w-full active:opacity-60 disabled:opacity-35", style: { padding: "13px 0", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "none", borderTop: "1px solid " + t.line } }, label); };
        moveSheet = h("div", { "data-wk": "ficmove", onClick: function () { setMoving(null); }, style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
          h("div", { onClick: function (e) { e.stopPropagation(); }, style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, padding: "0 2px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "挪「" + (moving.title || "这一篇") + "」 · 现在第 " + (mi + 1) + " 篇"),
            btn("移到最上面", "top", mi <= 0, "top"), btn("往上挪一格", "up", mi <= 0, "up"), btn("往下挪一格", "down", mi < 0 || mi >= list.length - 1, "down"),
            h("button", { onClick: function () { setMoving(null); }, className: "w-full active:opacity-60", style: { padding: "13px 0", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog, background: "transparent", border: "none", borderTop: "1px solid " + t.line } }, "取消")));
      }
      inner = h("div", { className: "flex-1 min-h-0 flex flex-col" },
        // 紧凑标题栏（施工规则/mobile-ui-layout.md §1）：原先那块 30px 大标题
        // ＋「FANFIC」副标，一屏先被吃掉五分之一，正文卡片只剩两张半。
        h(Head, { zh: view === "shelf" ? "书架" : "同人文",
          sub: view === "shelf" ? "收进来的那些" : "别人都在写什么",
          onBack: props.onBack, bg: "transparent", noLine: true,
          right: h("div", { className: "flex items-center justify-end", style: { gap: 10 } },
            view === "shelf" ? h("button", { onClick: function () { const n = exportFanficAudit(tabs, loadFics(), loadCfg()); props.toast && props.toast("已导出 " + n + " 篇同人文诊断稿"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficpagebtn", "data-part": "1" }, "导出")
              : view === "feed" ? h(React.Fragment, null,
                  h("button", { onClick: clearTab, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog }, "data-wk": "ficpagebtn", "data-part": "2" }, "清空"),
                  h("button", { onClick: function () { setGearOpen(true); }, disabled: busy, className: "active:opacity-60", title: "生成配置", "data-wk": "ficpagebtn", "data-part": "3" }, h(GConfig, { size: 19, color: t.ink })))
              : null) }),
        view === "feed" ? h(TabBar, {
          tabs: tabs, activeId: activeTab, onPick: setActiveTab,
          onAdd: function () { setTabSheet({}); }, onEdit: function (tb) { setTabSheet(tb); }
        }) : null,
        // 搜一下 + 只看写我的。搜的时候跨版搜，因为她多半不记得那篇在哪一版。
        h("div", { className: "px-5 pb-2 flex items-center", style: { gap: 8 } },
          h("input", {
            value: q, onChange: function (e) { setQ(e.target.value); },
            placeholder: "搜标题、笔名、CP 里的人、标签…",
            style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", outline: "none" }, "data-wk": "ficpageinput", "data-part": "搜标题、笔名、CP 里的"
          }),
          q ? h("button", { onClick: function () { setQ(""); }, className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficpagebtn", "data-part": "4" }, "清除") : null,
          h("button", {
            onClick: function () { setMeOnly(function (v) { return !v; }); }, className: "active:opacity-70 shrink-0",
            style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "5px 11px", borderRadius: 999, background: meOnly ? t.accent : "transparent", color: meOnly ? t.bg2 : t.sub, border: "1px solid " + (meOnly ? t.accent : t.line) }, "data-wk": "ficpagebtn", "data-part": "5"
          }, "有我")),
        // 正在按标签筛：得看得见、且随手能取消，不然点进去就出不来了
        tagFilter ? h("div", { className: "px-5 pb-2 flex items-center", style: { gap: 8 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "只看"),
          h(FicTag, { tag: tagFilter }),
          h("button", { onClick: function () { setTagFilter(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent }, "data-wk": "ficpagebtn", "data-part": "6" }, "取消")) : null,
        q ? h("div", { className: "px-5 pb-2" },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "跨版搜「" + q.trim() + "」· " + list.length + " 篇")) : null,
        // 板块简介收进固定高度的滚动框（简介写长后曾占掉三分之一屏挡文）：默认露两三行，框内下滑看全部
        view === "feed" && curTab && curTab.desc ? h("div", { className: "px-5 pb-2" },
          h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55, whiteSpace: "pre-line", maxHeight: 62, overflowY: "auto", WebkitOverflowScrolling: "touch", background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 10px" } }, curTab.desc)) : null,
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-6" },
          busy ? h(Spinner, { label: genProg && genProg.total ? ("后台生成中 " + genProg.done + "/" + genProg.total + "…可以离开本页") : "后台生成中…可以离开本页，回来会自动接上" }) : null,
          list.length ? list.map(function (f, i) {
            const rd = readMap[f.id];
            const chN = (f.chapters || []).length;
            return h(FicCard, {
              key: f.id, fic: f, characters: cast, userName: userName,
              // ⚠️位置传【当前这一屏的下标】，不是它在库里的位置：
              // 删一篇、筛个标签、搜一下，下面那篇顶上来就该自动变色、序号跟着重排。
              index: i, leadLabel: view === "shelf" ? "架上这一本" : "圈子里最上面那一篇",
              readAt: rd ? (chN > 1 && rd.chap > 0 ? "读到 " + (rd.chap + 1) + "/" + chN : "读过") : "",
              onTag: function (tag) { setTagFilter(tag === tagFilter ? "" : tag); },
              onOpen: function () { setOpenId(f.id); }, onLike: function () { likeFic(f.id); },
              onDelete: function () { removeFic(f); },
              onReorder: canReorder ? function () { setMoving({ id: f.id, title: f.title, i: i, n: list.length }); } : null });
          }) : (busy ? null : h(Empty, { text: view === "shelf" ? "书架空空" : "本版还没有同人文", sub: view === "shelf" ? "收藏或发布的篇目会留在这里追更" : "点右上角齿轮生成，或在「我的 → 自己写一篇」里自己写" }))));
    }

    // 发布/我的/rp 是全屏子页（自带返回箭头回 feed），不叠底 nav；feed/shelf 才显示底 nav
    const showNav = view === "feed" || view === "shelf";
    // 页面皮肤：纸纹＋光＋角上的弧。⚠️页底那个特大词【去掉了】（她 2026-08-30 点名）——
    // 这一处是在读书，一整页压着个 FANFIC 太吵；别处还留着。
    // 整个 App 套上她选的那张纸：卡片、标签、深浅交替全都读 useTheme()，
    // 换张纸自动跟着走，一个组件都不用改。
    return onPaper(
      h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { corner: true }), "data-wk": "ficpage" },   // 外层挂点：同人文首页那层纸（她 2026-10-18 群里「背景改不了」）
      inner,
      showNav ? h(BottomNav, { view: view, onNav: function (k) { setView(k); } }) : null,
      // 挪位置那一层：长按一篇弹出来
      moving && moveSheet ? moveSheet : null,
      gearOpen ? h(GenSheet, { tab: curTab, cps: cps, characters: cast, userName: userName, onClose: function () { setGearOpen(false); }, onConfirm: doGen }) : null,
      tabSheet ? h(TabSheet, { tab: tabSheet.id ? tabSheet : null, onClose: function () { setTabSheet(null); }, onSave: saveTab, onDelete: delTab }) : null));
  }

  window.FanficApp = FanficApp;

})();
