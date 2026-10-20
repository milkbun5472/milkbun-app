// 月度印象页面那半（2026-10-18 瘦身第九批）：开机那半在 js/impression-core.js（这一段只读 window.Impression）。

// ============================================================
// 界面：头像墙 → 某个角色的珍藏册 → 单张卡片
// ============================================================
(function () {
  const useState = React.useState;
  const M = window.Impression;

  function ImpressionApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "我";
    const [book, setBook] = useState(() => M.load());
    const [curChar, setCurChar] = useState(null);
    const [cardId, setCardId] = useState(null);
    // 翻过来的是哪一张（按卡 id 记，不是一个裸 boolean：换一张卡就自动翻回正面）
    const [flipId, setFlipId] = useState(null);
    const [busy, setBusy] = useState("");
    const backfillLock = React.useRef(false);
    const [backfillState, setBackfillState] = useState(null); // { charId, phase: scan|confirm|run }
    // 云端归档缓存：{ charId: {"c:xx":[...], "g:yy":[...]} }。一个角色只拉一次，
    // 后面写印象、补齐、看素材条数全用这一份——别每次都去云上拉一遍大数组。
    const [archs, setArchs] = useState({});
    const [arching, setArching] = useState(false);
    const archOf = id => archs[id] || null;
    // ⚠️这本册子有【两个写手】：这一页，和 app.js 里那条自动出卡（它直接 M.load/M.save，
    //   压根不经过这个 state）。拿 state 当底合并，就会把对方刚写进去的那张原样抹掉——
    //   她 2026-09-13 报的「八月被重写了一遍，图和字两次都不一样」就是这么来的：
    //   自动那条先写了八月，补齐这条手里那份 book 还是没有八月的旧账，于是又写了一遍。
    //   所以合并一律以【存档现读的那一份】为底，state 只用来画界面。
    // ⚠️存档不写在 setBook 的 updater 里（2026-10-01「离开这页就白跑」）：页面关了 React 就不跑它，
    //   出卡回来时她已经走开，那张就存不上。现读、改完、直接写回，页面还在才 setBook。
    const put = fn => {
      const n = fn(M.load() || bookRef.current);
      if (!M.save(n)) { props.toast("这次没保存成功，原印象还在"); return; }
      bookRef.current = n;
      setBook(n);
    };
    // ⚠️补齐是一个 await 接一个 await 的长循环，而这中间 book 这个 state 在闭包里【不会变】。
    //   她 2026-09-13 报「补齐两个月，七月出来的时候等于把八月又写了一遍」：
    //   写存档那一步本来就是按月份合并的（不会真盖掉），可【喂给模型的那份料】用的是
    //   循环开始时的旧 book——七月压根不知道八月已经写完了，于是「往期不许重复」里没有它，
    //   两张自然撞成一张。所以取料一律走 ref，不许再读闭包里那份。
    const bookRef = React.useRef(book);
    bookRef.current = book;
    // 要拿去写、去喂模型、去判断"这个月写过没有"的那一份，一律现读存档：
    // 闭包里那份在一个 await 接一个 await 的长循环里不会变，别的写手写的东西它也看不见。
    const liveBook = () => M.load() || bookRef.current || {};
    // 这一趟出不出剪影（她 2026-09-13 要的）。只管【这一趟】，不写进设置：
    // 补齐十二个月就是十二张图，贵且慢，而字才是主体——不出图的那几张随时能单独补。
    // ⚠️用 ref 读：补齐是个长循环，闭包里那份 state 在循环跑起来之后就不会再变了。
    const [withArt, setWithArt] = useState(true);
    const artRef = React.useRef(withArt); artRef.current = withArt;
    // ⚠️imgSrc 不是全局的：它是 theater.js 自己内部声明的（js/theater.js 里那份）。
    // 照抄用法却没带上定义，一进这个页面就 ReferenceError、整个 App 白屏（她 2026-08-20 撞到）。
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    // 头像与存相册照小剧场那套自己实现——components 里那两个不是全局的，拿不到
    const avatarOf = (c, size) => (c && c.avatarImage)
      ? h("img", { src: imgSrc(c.avatarImage), style: { width: size, height: size, borderRadius: 999, objectFit: "cover", display: "block" } })
      : h("div", { style: { width: size, height: size, borderRadius: 999, background: (c && c.color) || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(size / 2.4), color: "#fff" } }, String((c && c.name) || "?").slice(0, 1));
    const saveToAlbum = async ref => {
      try {
        let blob = null;
        if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function") blob = await imgVaultFetchBlob(ref);
        if (!blob) blob = await (await fetch(imgSrc(ref))).blob();
        const file = new File([blob], "impression_" + Date.now() + ".png", { type: blob.type || "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
      } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); }
    };
    const listOf = id => M.sortEntries(book[id]);

    // ---- 相册那套零件（v61.18，她 2026-09-03：「首页和进去角色页面都还是很普通」）----
    // 判据照旧：这套形状搬到别的功能上还成立吗？不成立才对。
    // 月度印象在现实里是【一本按月贴的剪影相册】——所以列表不是网格，是相册内页：
    // 深色卡纸台面上贴着一张张相纸，四角用相角压住，每张微微歪一点（人手贴的从来不齐），
    // 底下手写月份。空的那格是还没贴上去的相角位，不是一个虚线按钮。
    const MOUNT = pageColor("impression", "bg", "rgba(28,24,20,.90)");          // 卡纸台面（相册内页那块深色底）
    const PAPER = pageColor("impression", "bg2", "#f3ece0");                     // 相纸白边
    // 每张歪的角度由序号定死：随机的话每次重画都在动，像页面在抖
    const tilt = i => [-1.6, 1.1, -0.7, 1.8, -1.2, .6][i % 6];
    // 相角：压在相片四角上的那个三角形纸角。⚠️别用「转 45 度的方块」——那样四个角
    //   会从相纸外面支出去，看着是四颗黑菱形，不是相角。用 clipPath 切出真三角，
    //   而且贴在【相片里面】的角上，才是相角压住照片的样子。
    const CLIP = { tl: "polygon(0 0,100% 0,0 100%)", tr: "polygon(100% 0,100% 100%,0 0)",
      bl: "polygon(0 0,0 100%,100% 100%)", br: "polygon(100% 0,100% 100%,0 100%)" };
    const corner = (pos, size) => {
      const st = { position: "absolute", width: size, height: size, clipPath: CLIP[pos],
        background: "linear-gradient(135deg,rgba(58,49,39,.95),rgba(30,25,20,.86))", pointerEvents: "none" };
      st[pos[0] === "t" ? "top" : "bottom"] = 0;
      st[pos[1] === "l" ? "left" : "right"] = 0;
      return h("div", { key: pos, style: st });
    };
    const corners = size => ["tl", "tr", "bl", "br"].map(x => corner(x, size));
    // 一张贴在卡纸上的相纸
    const plate = (opts, inner) => h("div", { "data-wk": "impplate", style: Object.assign({ position: "relative", background: PAPER,
      padding: opts.edge == null ? 6 : opts.edge, boxShadow: "0 7px 18px rgba(0,0,0,.38)",
      transform: "rotate(" + (opts.deg || 0) + "deg)" }, opts.style || {}) },
      h("div", { style: { position: "relative", width: "100%", aspectRatio: opts.ratio || "3 / 4",
        overflow: "hidden", background: pageColor("impression", "bg2", "rgba(20,17,14,.30)") } }, inner, corners(opts.corner || 18)));
    // 相册内页：深色卡纸 + 一点点纸纹（两道极淡的斜光，不是纯色块）
    // 底已经由 S.wrap 一路铺到顶了，这儿只管留白
    const pageStyle = { flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 15px 40px" };
    const handLabel = { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", color: pageColor("impression", "ink", "rgba(243,236,224,.92)"),
      letterSpacing: ".04em" };
    const footNote = { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.45)"), lineHeight: 1.85 };

    const S = {
      // ⚠️台面要一直铺到最顶上（她 2026-09-03：「这背景没延伸到顶部啊」）：
      //   原来只有正文那块是卡纸，顶栏还留在主题米白上，看着像相册上面压了一条白边。
      //   相册就是一整块台面，顶栏只是浮在它上面的一行字。
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column",
        background: MOUNT + " linear-gradient(146deg,rgba(255,255,255,.055),transparent 42%,rgba(0,0,0,.16))",
        backgroundBlendMode: "overlay" },
      btn: on => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.accent : "rgba(243,236,224,.34)"),
        background: on ? t.accent : "transparent", color: on ? "#fff" : pageColor("impression", "ink", "rgba(243,236,224,.9)"), fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" })
    };
    // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）。v65.14 换过来：
    // 手写那条身上一个 data-wk 挂点都没有，「月度印象」这一页的主题 CSS 抓不到顶栏；
    // 返回键原来是一个 19px 的「←」字符，可点区只有那几个像素，Head 里是 46×34。
    // 夜色底是这一页自己的，所以字色和分隔线照旧从这儿传进去。
    const header = (title, right) => h(Head, { zh: title, onBack: back, right: right,
      ink: pageColor("impression", "ink", "rgba(243,236,224,.95)"), lineInk: pageColor("impression", "line", "rgba(243,236,224,.13)"), bg: "transparent" });
    function back() {
      if (cardId) return setCardId(null);
      if (curChar) return setCurChar(null);
      props.onBack();
    }

    // 拉这个角色的云端归档（本人单聊 + TA在的互通群）。拉不到就退回只用本地，
    // 但要说出来——否则又变成"聊了一整月却说没有"那种查不下去的沉默。
    async function ensureArch(charId) {
      if (archs[charId]) return archs[charId];
      if (!(window.Cloud && window.Cloud.ready && window.Cloud.ready())) return null;
      setArching(true);
      const box = await M.archiveFor(charId, props.groups, id => window.Cloud.chatArchiveGet(id));
      setArchs(p => Object.assign({}, p, { [charId]: box }));
      setArching(false);
      return box;
    }
    // ---- 生成一个月 ----
    async function make(charId, monthKey, opts) {
      const char = (props.characters || []).find(c => c.id === charId);
      if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      if (!M.isWritable(monthKey)) { props.toast(M.monthLabel(monthKey) + " 还没过完，等下个月 1 号 0 点再写"); return false; }
      const arch = await ensureArch(charId);
      const rows = M.monthMaterial(charId, char.name, monthKey, uName, props.groups, arch);
      if (rows.length < 6) {
        // 报出实际条数：以前只说"几乎没有来往"，她明明聊了很多也不知道是哪一步没数到
        if (!(opts && opts.quiet)) props.toast(M.monthLabel(monthKey) + " 只找到 " + rows.length + " 条你俩的往来（单聊+单人线下+互通群），写不出印象");
        return false;
      }
      setBusy(charId + monthKey);
      try {
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        const d = await M.genText(props.active, char, props.profile, monthKey, rows, gazeText, M.genOpts(liveBook(), charId, monthKey, 0));
        let img = null;
        // 图出不来不算失败：字才是主体，剪影可以之后单独补
        try { if (artRef.current && typeof imgApiReady === "function" && imgApiReady()) img = await M.genArt(d.silhouette, props.profile, { tags: d.tags, title: d.title }); }
        catch (e) { props.toast("字写好了，剪影没出来：" + (e.message || "稍后可单独重出")); }
        const entry = M.entryOf(d, monthKey, img, 0);
        put(p => Object.assign({}, p, { [charId]: [entry].concat((p[charId] || []).filter(x => x.monthKey !== monthKey)) }));
        return true;
      } catch (e) { props.toast("生成失败：" + (e.message || "重试")); return false; }
      finally { setBusy(""); }
    }
    // 只重出剪影，字不动
    async function redrawArt(charId, entry) {
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setBusy(charId + entry.monthKey);
      try {
        const img = await M.genArt(entry.silhouette, props.profile, { tags: entry.tags, title: entry.title });
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id ? Object.assign({}, x, { img }) : x) }));
      } catch (e) { props.toast("剪影没出来：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 只重写文案，剪影原样留着——出图慢又贵，不该为了换一句话把画也重刷一遍（她 2026-08-20 提）
    async function rewriteText(charId, entry) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(charId + entry.monthKey);
      try {
        const rows = M.monthMaterial(charId, char.name, entry.monthKey, uName, props.groups, await ensureArch(charId));
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        // turn+1 = 换一面骰子：不换的话「只重写文案」会拿到同一个写法，等于原地打转
        const turn = Number(entry.turn || 0) + 1;
        // 自己上一版单独作为 last 传进去（不是混进 past 末尾——那样会被 slice 切掉）
        const d = await M.genText(props.active, char, props.profile, entry.monthKey, rows, gazeText,
          M.genOpts(liveBook(), charId, entry.monthKey, turn, entry));
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id
          ? Object.assign({}, x, M.entryOf(d, entry.monthKey, x.img, turn), { id: x.id, ts: x.ts }) : x) }));
        props.toast("换了个写法，剪影没动");
      } catch (e) { props.toast("重写失败：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 只补背面那三格（老卡是在加这三格之前贴上去的）。
    // ⚠️不另开一条提示词：还是走 genText 那一枪，只把 moment/shift/him 三格取回来写进去，
    //   正面的 title/tags/quote/silhouette 和剪影一个字不动（出图贵，别为三行字白刷一次）。
    async function writeBack(charId, entry) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(charId + entry.monthKey);
      try {
        const rows = M.monthMaterial(charId, char.name, entry.monthKey, uName, props.groups, await ensureArch(charId));
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        const d = await M.genText(props.active, char, props.profile, entry.monthKey, rows, gazeText,
          M.genOpts(liveBook(), charId, entry.monthKey, Number(entry.turn || 0)));
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id
          ? Object.assign({}, x, { moment: d.moment, shift: d.shift, him: d.him, firstShift: d.firstShift }) : x) }));
        props.toast("背面写好了，正面没动");
      } catch (e) { props.toast("背面没写成：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 补齐：最近 12 个月里有素材、却还没写过的，一月一月补（失败即停，已写好的都留着）
    async function backfill(charId) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (busy || backfillLock.current) return props.toast("正在统计或补齐，别重复点");
      if (!props.active) return props.toast("请先配置线下 API");
      // 从第一下点击就上锁、立刻给回音。原来要先拉完云归档才弹确认，几秒空白里每点一下
      // 都会另开一条异步扫描，最后连续冒出好几个确认框。
      backfillLock.current = true;
      setBackfillState({ charId, phase: "scan" });
      props.toast("正在统计可以补齐的月份…");
      const releaseBackfill = () => { backfillLock.current = false; setBackfillState(null); };
      let want = [];
      // 整段包起来：以前任何一步抛出去，外面没人接，表现就是"点了没反应"
      try {
        const arch = await ensureArch(charId);              // 先把云端归档拉齐，再判断哪些月有素材
        const have = new Set((liveBook()[charId] || []).map(x => x.monthKey));
        const all = M.prevMonths(12);                       // 已经过完的 12 个月
        const missing = all.filter(k => !have.has(k));
        want = missing.filter(k => M.monthMaterial(charId, char.name, k, uName, props.groups, arch).length >= 6);
        if (!want.length) {
          // 分清三种"没得补"，别一律一句话打发
          releaseBackfill();
          return props.toast(!missing.length ? "最近一年每个月都写过了"
            : "漏掉的那 " + missing.length + " 个月几乎没有来往，写不出印象");
        }
      } catch (e) { releaseBackfill(); return props.toast("翻旧账的时候出错了：" + (e.message || "未知")); }
      // iOS/PWA 可以永久屏蔽系统 confirm；被屏蔽后它只返回 false，按钮就像完全没点到。
      // 用全 App 自己画的确认层，而且把真正补齐动作放进确认回调——点“开始补齐”后才逐月写。
      setBackfillState({ charId, phase: "confirm" });
      const opened = requestAppConfirm("补齐 " + want.length + " 个月？",
        (artRef.current ? "每个月连剪影一起出（慢，也费图额）。" : "这一趟只写字，不出剪影；剪影以后在每张卡上单独补。")
          + "会一个月一个月写，中途失败前面的都保留。", async () => {
        setBackfillState({ charId, phase: "run" });
        try {
          want.reverse();
          let done = 0;
          for (const k of want) {
            // 这个月已经有卡了就跳过：可能是这一轮刚写的，也可能是自动出卡那条写的
            if ((liveBook()[charId] || []).some(x => x.monthKey === k)) { done++; continue; }
            const ok = await make(charId, k, { quiet: true });
            if (!ok) { props.toast("补到 " + M.monthLabel(k) + " 时停下了，已写好 " + done + " 个"); return; }
            done++; props.toast("已补 " + done + "/" + want.length, 1200);
          }
          props.toast("补齐了 " + done + " 个月");
        } finally { releaseBackfill(); }
      }, "开始补齐", releaseBackfill);
      if (!opened) releaseBackfill();
    }

    // ---- 单张卡片 ----
    if (cardId && curChar) {
      const e = listOf(curChar).find(x => x.id === cardId);
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      if (!e) { setCardId(null); return null; }
      // 编号＝这本册子里的第几张（按月份从旧到新，跟珍藏册那页铺的顺序一致）
      const idxOf = listOf(curChar).findIndex(x => x.id === e.id);
      const flipped = flipId === e.id;
      // 背面那三段：跟上个月比变了哪儿 / 那一天 / 他自己。三段问的是三件事，
      // 所以它们才不在正面跟 quote 挤——正面是"她是什么样"，背面是"这个月发生在你俩之间的"。
      const backRows = [
        [e.firstShift ? "在这之前" : "变了哪儿", e.shift],
        ["那天", e.moment],
        ["他自己", e.him]
      ].filter(x => String(x[1] || "").trim());
      const hasBack = backRows.length > 0;
      const penHead = { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".22em", textIndent: ".22em",
        color: pageColor("impression", "fog", "rgba(120,100,72,.62)"), marginBottom: 7 };
      const penText = { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 2,
        color: pageColor("impression", "ink", "rgba(43,36,28,.9)") };
      // 相片的背面：没有图，只有铅笔字。纸纹比正面更旧一点（背面本来就是压在册子里那一面）
      // ⚠️backface-visibility 只管【看不看得见】，不保证【点不点得着】：Safari/iOS 里
      //   压在上面那一面即使已经转到背后，照样会把点击吃掉——她 2026-09-13 报「补写按钮点不了」
      //   就是这个。所以两面各自显式开关 pointerEvents，不靠引擎的隐藏行为。
      const backFace = h("div", { "data-wk": "impback", style: { position: "absolute", inset: 0, background: PAPER,
        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(1px)",
        pointerEvents: flipped ? "auto" : "none",
        // ⚠️别把"翻过去看见的是背面"全押在 backface-visibility 上：iOS 上它失灵，
        //   她 2026-09-13 截图里看到的就是【正面的镜像】。所以两面各自再用 visibility
        //   显式切一次，延迟半个动画时长（翻到侧面看不见的那一刻）才换人。
        visibility: flipped ? "visible" : "hidden", transition: "visibility 0s linear .21s",
        backgroundImage: "radial-gradient(90% 70% at 15% 8%,rgba(146,116,72,.17),transparent 62%),"
          + "radial-gradient(90% 70% at 88% 94%,rgba(146,116,72,.15),transparent 60%)",
        boxShadow: "0 16px 40px rgba(0,0,0,.42)", padding: "34px 26px 26px", overflowY: "auto" } },
        h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(12.5px * var(--app-fs, 1))", letterSpacing: ".04em",
          color: pageColor("impression", "fog", "rgba(120,100,72,.68)"), marginBottom: 22 } },
          M.monthLabel(e.monthKey) + "　背面"),
        hasBack
          ? backRows.map((r, i) => h("div", { "data-wk": "impbackrow", key: i, style: { marginBottom: 24 } },
              h("div", { style: penHead }, "〔" + r[0] + "〕"),
              h("div", { style: penText }, r[1])))
          : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 2,
              color: pageColor("impression", "fog", "rgba(120,100,72,.7)") } },
              "这张是早先贴的，背面还空着。",
              h("br"),
              "翻回正面，点下面那个「补写背面」。"),
        hasBack ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", textAlign: "right", marginTop: 4,
          color: pageColor("impression", "ink", "rgba(94,79,58,.75)") } }, "—— " + (c.name || "TA")) : null);
      return h("div", { "data-wk": "impdetail", style: S.wrap }, header(M.monthLabel(e.monthKey)),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 18px 40px" } },
          // 这一张是【从册子上取下来的那张相纸】（v61.26，她 2026-09-03：「点进卡里面还是白的，
          // 卡片要不要也做点装饰」）。原来是一块 t.bg2 的白圆角——白得像个弹窗，
          // 跟外面那本相册不是一件东西。现在：相纸本身泛旧（四角压暖压深，不是纯白）、
          // 上边斜贴一条胶带、下半张白边上有铅笔写的编号和月份。
          // 点一下【整张相纸翻过去】（v67.89，她 2026-09-13：「四个格子在说同一句话」）。
          // ⚠️不用淡入淡出：淡入淡出搬到别的功能上照样成立，翻相片不行——
          //   背面本来就是相片写字的地方，这个形状是它自己长出来的。
          h("div", { style: { perspective: 1400, marginTop: 12 } },
          h("div", { "data-wk": "impflip", "data-on": flipped ? "1" : "0", onClick: () => setFlipId(flipped ? null : e.id),
            style: { position: "relative", transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", cursor: "pointer",
              transition: "transform .42s cubic-bezier(.25,.85,.3,1)", willChange: "transform",
              transform: "rotate(-.5deg)" + (flipped ? " rotateY(180deg)" : "") } },
          backFace,
          h("div", { "data-wk": "impfront", style: { position: "relative", background: PAPER, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            pointerEvents: flipped ? "none" : "auto", transform: "translateZ(1px)",
            visibility: flipped ? "hidden" : "visible", transition: "visibility 0s linear .21s",
            backgroundImage: "radial-gradient(120% 90% at 50% 0,rgba(255,255,255,.55),transparent 55%),"
              + "radial-gradient(80% 60% at 8% 100%,rgba(146,116,72,.16),transparent 60%),"
              + "radial-gradient(80% 60% at 96% 6%,rgba(146,116,72,.13),transparent 62%)",
            padding: 9, boxShadow: "0 16px 40px rgba(0,0,0,.42)" } },
            // 胶带：斜贴在上边缘，压住相纸和台面的交界——这就是它在册子上的贴法
            h("div", { style: { position: "absolute", top: -13, left: "50%", width: 104, height: 26,
              transform: "translateX(-58%) rotate(-3.4deg)", background: pageColor("impression", "bg2", "rgba(226,214,186,.62)"),
              borderLeft: "1px dashed rgba(255,255,255,.5)", borderRight: "1px dashed rgba(255,255,255,.5)",
              boxShadow: "0 2px 6px rgba(0,0,0,.22)", pointerEvents: "none" } }),
            h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4", background: pageColor("impression", "bg2", "rgba(20,17,14,.24)") } },
              e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.6)"), textAlign: "center", padding: 20 } }, "还没有剪影"),
              // 这张也压四个相角，和珍藏册那一页是同一本册子里的东西（v61.22）
              corners(22),
              // 三个关键词照「初形象生成」那套挂：白点＋细线＋金边小签，点朝画面里侧
              h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
                (e.tags || []).slice(0, 3).map((tag, i) => {
                  const onLeft = i === 1;
                  const dot = h("div", { "data-wk": "block", key: "d", style: { width: 9, height: 9, borderRadius: 999, background: "#fff", boxShadow: "0 0 0 7px rgba(255,255,255,.26)", flexShrink: 0 } });
                  const line = h("div", { key: "l", style: { width: 20, height: 1, background: pageColor("impression", "bg2", "rgba(255,255,255,.85)"), flexShrink: 0 } });
                  const chip = h("div", { "data-wk": "imptag", key: "c", style: { background: pageColor("impression", "bg2", "rgba(97,84,56,.86)"), border: "1px solid rgba(246,239,226,.55)",
                    color: pageColor("impression", "ink", "#f6efe2"), padding: "5px 13px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
                    letterSpacing: ".06em", whiteSpace: "nowrap", backdropFilter: "blur(2px)" } }, tag);
                  return h("div", { key: i, style: { position: "absolute", top: [24, 49, 74][i] + "%", [onLeft ? "left" : "right"]: "5%",
                    display: "flex", alignItems: "center", gap: 7 } },
                    onLeft ? [chip, line, dot] : [dot, line, chip]);
                }))),
            h("div", { "data-wk": "impcaption", style: { padding: "16px 12px 14px", position: "relative" } },
              // 相纸下半张那道白边：左边铅笔写的编号和月份，右边这一册的名字
              // ⚠️两边都得 nowrap：这一行是相纸下沿【铅笔写的一行小字】，
              // 断成两行就不是一行小字了（她 2026-09-03 截图：右边那句折成了两行）。
              // 窄机上宁可字距收窄，也不许换行——所以右边这句字号和字距都压了一档。
              h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
                paddingBottom: 11, marginBottom: 13, borderBottom: "1px solid rgba(120,100,72,.20)" } },
                h("div", { "data-wk": "impcardname", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13px * var(--app-fs, 1))", color: pageColor("impression", "ink", "rgba(64,54,42,.86)"), letterSpacing: ".04em", whiteSpace: "nowrap", flexShrink: 0 } },
                  "No. " + String(idxOf + 1).padStart(2, "0") + "　" + M.monthLabel(e.monthKey)),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".22em", color: pageColor("impression", "fog", "rgba(120,100,72,.55)"), textIndent: ".22em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" } }, hasBack ? (e.firstShift ? "在这之前 →" : "印象变了哪儿 →") : "背面还空着 →")),
              e.title ? h("div", { "data-wk": "impcardtitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: pageColor("impression", "ink", "rgba(43,36,28,.95)"), textAlign: "center", marginBottom: 14, letterSpacing: ".06em" } }, "{ " + e.title + " }") : null,
              h("div", { style: { position: "relative", padding: "2px 14px" } },
                h("div", { style: { fontFamily: "Georgia,'Noto Serif SC',serif", fontSize: "calc(36px * var(--app-fs, 1))", lineHeight: 1, color: pageColor("impression", "fog", "rgba(120,100,72,.5)") } }, "“"),
                h("div", { "data-wk": "impquote", style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 2.1, color: pageColor("impression", "ink", "rgba(43,36,28,.95)"), textAlign: "center", padding: "0 6px" } }, e.quote),
                h("div", { style: { fontFamily: "Georgia,'Noto Serif SC',serif", fontSize: "calc(36px * var(--app-fs, 1))", lineHeight: 1, color: pageColor("impression", "fog", "rgba(120,100,72,.5)"), textAlign: "right" } }, "”")),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: pageColor("impression", "ink", "rgba(94,79,58,.8)"), textAlign: "right", marginTop: 10 } }, "—— " + (c.name || "TA") + " 眼里的 " + uName))))),
          h("div", { "data-wk": "impactions", style: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" } },
            e.img ? h("button", { "data-wk": "impbtn", "data-part": "save", onClick: () => saveToAlbum(e.img), style: S.btn(false) }, "保存到相册") : null,
            h("button", { "data-wk": "impbtn", "data-part": "rewrite", onClick: () => rewriteText(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在写…" : "只重写文案"),
            h("button", { "data-wk": "impbtn", "data-part": "redraw", onClick: () => redrawArt(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在画…" : (e.img ? "只重出剪影" : "补一张剪影")),
            // ⚠️这个按钮原来长在背面上（v67.89/67.90 跟 iOS 的 3D 命中测试较劲了两版，
            //   她两次都点不着）。动作本来就和上面两个同族——都是"只重来其中一块"——
            //   那就该待在同一排：不翻面也点得着，也不用赌哪一面在吃点击。
            h("button", { "data-wk": "impbtn", "data-part": "writeback", onClick: () => writeBack(curChar, e), disabled: !!busy, style: S.btn(false) },
              busy ? "在写…" : (hasBack ? "重写背面" : "补写背面")),
            h("button", { "data-wk": "impbtn", "data-part": "del", onClick: () => requestAppConfirm("删掉这个月的印象？", "删除后不能恢复。", () => { const next = Object.assign({}, book, { [curChar]: (book[curChar] || []).filter(x => x.id !== e.id) }); if (!M.save(next)) return props.toast("这次没删成功，原印象还在"); setBook(next); setCardId(null); }, "删除"), style: Object.assign({}, S.btn(false), { color: "#a4442e" }) }, "删除"))));
    }

    // ---- 某个角色的珍藏册：一本按月贴的相册 ----
    if (curChar) {
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      // 一进来就把云端归档拉好：不然那行素材统计报的是本地窗口的数，等于继续误导
      if (!archs[curChar] && !arching) ensureArch(curChar);
      const mine = listOf(curChar);
      // 能写的是【上个月】：本月还在过，写不出"这个月你是什么样"
      const openMonth = M.latestWritable();
      const hasThis = mine.some(x => x.monthKey === openMonth);
      const openAt = new Date(M.nextOpenAt());
      // 空相角位：这个月还没贴上去的那一格。它长得就是「一张相片该在的地方」，
      // 不是一个虚线按钮——按钮换个功能照样成立，这一格不行。
      // 已经贴上去的月份不再多摆一个空位——那张相片就在这一页上，摆两次等于自己骗自己。
      const emptySlot = hasThis ? null : h("div", { "data-wk": "impemptyslot", onClick: () => make(curChar, openMonth),
        style: { position: "relative", width: "calc((100% - 26px) / 2)", cursor: "pointer" } },
        h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4",
          border: "1px dashed rgba(243,236,224,.30)", display: "flex", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 12, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.8,
          color: pageColor("impression", "fog", "rgba(243,236,224,.62)") } },
          busy ? "在写…" : "贴上 " + M.monthLabel(openMonth) + "的那一张" + (withArt ? "" : "（只写字）"),
          corners(15)),
        h("div", { style: Object.assign({}, handLabel, { marginTop: 8, color: pageColor("impression", "fog", "rgba(243,236,224,.55)") }) },
          M.monthLabel(openMonth)));
      return h("div", { "data-wk": "impcharpage", style: S.wrap },
        header((c.name || "?") + " 眼里的 " + uName,
          h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
          h("button", { "data-wk": "impbtn", "data-part": "withart", "data-on": withArt ? "1" : "0", onClick: () => setWithArt(v => !v), style: S.btn(withArt) },
            withArt ? "带剪影" : "只写字"),
          h("button", { "data-wk": "impbtn", "data-part": "backfill", onClick: () => backfill(curChar), disabled: !!busy || !!backfillState, style: S.btn(false) },
            backfillState && backfillState.charId === curChar
              ? (backfillState.phase === "scan" ? "统计中…" : backfillState.phase === "confirm" ? "待确认…" : "补齐中…") : "补齐"))),
        h("div", { style: pageStyle },
          h("div", { "data-wk": "impgrid", style: { display: "flex", flexWrap: "wrap", gap: "26px 26px", alignItems: "flex-start" } },
            mine.map((e, i) => h("div", { "data-wk": "impmonth", key: e.id, onClick: () => setCardId(e.id),
              style: { width: "calc((100% - 26px) / 2)" } },
              plate({ deg: tilt(i), corner: 15 },
                e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                  : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.55)") } }, "只有字")),
              h("div", { "data-wk": "impmonthlabel", style: Object.assign({}, handLabel, { marginTop: 9 }) }, M.monthLabel(e.monthKey)),
              // 三个词写成相片底下那行铅笔小字，不是一排药丸
              h("div", { "data-wk": "impmonthsub", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.55)"), marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                (e.tags || []).slice(0, 3).join(" · ") || e.title || ""))),
            emptySlot),
          // 页脚：本月为什么还不能写 + 素材数，压在页面最底下，像相册页边上的铅笔注记
          h("div", { "data-wk": "impfoot", style: { marginTop: 26, paddingTop: 14, borderTop: "1px solid rgba(243,236,224,.14)" } },
            h("div", { style: footNote },
              "本月还在过，写不出这个月你是什么样。" + (openAt.getMonth() + 1) + " 月 1 日 0 点开写。"),
            (function () {
              if (arching && !archs[curChar]) return h("div", { style: footNote }, "正在拉云端归档…");
              let b = null;
              try { b = M.materialBreakdown(curChar, c.name, openMonth, uName, props.groups, archOf(curChar)); } catch (e) { return null; }
              const cloudOk = !!archs[curChar];
              return h("div", { style: footNote },
                M.monthLabel(openMonth) + "素材：单聊+线下 " + b.direct + " 条 · 群 " + b.group + " 条",
                h("br"),
                "（记录共 " + b.chatAll + " 条：本地 " + b.local + " · 云端归档 " + b.cloud + "）",
                cloudOk ? null : h("span", null, h("br"), "⚠️云端归档没拉到，只数了本地那 " + b.local + " 条——旧消息都在云上"));
            })(),
            mine.length ? null : h("div", { style: Object.assign({}, footNote, { marginTop: 6 }) },
              "这本还是空的。写一个月看看，或者点右上角补齐。"))));
    }

    // ---- 头像墙：一摞一摞的相片，谁的厚就是谁攒得多 ----
    return h("div", { "data-wk": "imppage", style: S.wrap }, header("月度印象"),
      h("div", { style: pageStyle },
        h("div", { "data-wk": "impintro", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.62)"), lineHeight: 1.9, marginBottom: 20 } },
          "每个月，每个人眼里的你长得都不一样。", h("br"), "一张剪影、三个词、一句TA亲口说的话。"),
        (props.characters || []).length ? h("div", { "data-wk": "impchars", style: { display: "flex", flexWrap: "wrap", gap: "30px 22px", alignItems: "flex-start" } },
          (props.characters || []).map((c, i) => {
            const n = (book[c.id] || []).length;
            // 珍藏册正文从旧到新铺；封面仍取最近那张，不能因为展示顺序改了就倒回最老月份。
            const cover = listOf(c.id).slice().reverse().find(x => x.img);
            // 叠得多厚＝攒了几个月。这一层不是装饰：它把「n 个月」这件事画了出来，
            // 所以底下那行不必再重复报数，只写名字和月份数就够。
            const depth = Math.min(3, n);
            const back = [];
            for (let k = depth; k >= 1; k--) back.push(h("div", { key: k, style: { position: "absolute",
              inset: 0, background: PAPER, opacity: .5 + .15 * (depth - k), borderRadius: 1,
              transform: "rotate(" + (k % 2 ? -1 : 1) * (2.4 + k * 2.2) + "deg) translateY(" + (k * 2.5) + "px)",
              boxShadow: "0 4px 12px rgba(0,0,0,.3)" } }));
            return h("div", { "data-wk": "impchar", key: c.id, onClick: () => setCurChar(c.id),
              style: { width: "calc((100% - 44px) / 3)", textAlign: "center" } },
              h("div", { style: { position: "relative" } },
                back,
                plate({ deg: tilt(i), corner: 13, ratio: "1 / 1" },
                  cover ? h("img", { src: imgSrc(cover.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .55 } }) : null,
                  h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
                    avatarOf(c, 44)))),
              h("div", { "data-wk": "impcharname", style: Object.assign({}, handLabel, { marginTop: 10, fontSize: "calc(12px * var(--app-fs, 1))", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }) }, c.name),
              h("div", { "data-wk": "impcharsub", style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.5)"), marginTop: 1 } },
                n ? n + " 个月" : "还没有"));
          }))
          : h("div", { "data-wk": "impempty", style: { textAlign: "center", marginTop: 70, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: pageColor("impression", "fog", "rgba(243,236,224,.6)") } }, "还没有角色。")));
  }
  window.ImpressionApp = ImpressionApp;
})();
