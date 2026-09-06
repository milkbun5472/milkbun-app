// ============================================================
// 地方（dwell）—— 他住的地方 + 他常去的地方
// 一个地方 = 一句氛围 + 4~5 个【区域】，每个区域里几件东西。
//   · 区域→物品两层，不是一堆孤立的点：一件东西属于哪一块地方，本身就是信息
//   · 常去的地方【不另外生成】：行程每天都在出具体地点，攒几天自然浮出来（零 API）
//   · 数据存 localStorage x_dwell，随云同步
// ============================================================
(function () {
  const ACCENT = "#5a6a7a";
  const K = "x_dwell";
  const CAP_PLACES = 8;          // 一个人最多留几个地方
  const CAP_ZONES = 6;
  const CAP_ITEMS = 6;

  function loadAll() { const d = loadJSON(K, null); return (d && typeof d === "object") ? d : {}; }
  function saveAll(d) { return saveJSON(K, d); }
  function placesOf(charId) { const a = loadAll()[charId]; return Array.isArray(a && a.places) ? a.places : []; }
  function uid(p) { return (p || "d") + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  function savePlace(charId, place) {
    const all = loadAll();
    const cur = Array.isArray(all[charId] && all[charId].places) ? all[charId].places.slice() : [];
    const i = cur.findIndex(function (p) { return p.id === place.id; });
    if (i >= 0) cur[i] = place; else cur.unshift(place);
    all[charId] = { places: cur.slice(0, CAP_PLACES) };
    return saveAll(all) ? all[charId].places : null;
  }
  function dropPlace(charId, id) {
    const all = loadAll();
    const cur = (all[charId] && all[charId].places) || [];
    all[charId] = { places: cur.filter(function (p) { return p.id !== id; }) };
    return saveAll(all) ? all[charId].places : null;
  }

  // ── 常去的地方：从行程里长出来，不另外调模型 ──────────────
  // ⚠️别再让模型编一份地点表：行程每天都在写具体地点，另编一份必然打架
  // （行程说他在书房，地点表说他常泡茶楼）。这里只是把已经发生过的数一数。
  function frequentPlaces(charId, schedules, days) {
    try {
      // ⚠️行程一天是 { load, estTime, seqs:[{ time, title, location, type }] }
      // ——地点在 seqs[].location。写成 rows[].place 会一条都数不出来，
      // 而且是【静默的】：页面上只是「没有常去的地方」，看不出是读错了字段。
      const byDay = (schedules || {})[charId] || {};
      const keys = Object.keys(byDay).sort().slice(-(days || 14));
      const tally = {};
      keys.forEach(function (k) {
        const seqs = (byDay[k] && byDay[k].seqs) || [];
        (Array.isArray(seqs) ? seqs : []).forEach(function (r) {
          const p = String((r && r.location) || "").trim();
          if (!p || p.length > 14) return;
          if (!tally[p]) tally[p] = { name: p, n: 0, days: {} };
          tally[p].n++;
          tally[p].days[k] = 1;
        });
      });
      Object.keys(tally).forEach(function (k) { tally[k].days = Object.keys(tally[k].days).length; });
      return Object.keys(tally).map(function (k) { return tally[k]; })
        .filter(function (x) { return x.n >= 2; })          // 只去过一次的不算「常去」
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    } catch (e) { return []; }
  }

  // ── 生成：一个地方一次调用 ──────────────────────────────
  // 提示词只给【判据】，不给内容示范（施工规则/prompt-no-content-samples.md）。
  // 判据压到一条：每一件都要能反过来说出他这个人的一件事。
  function placeSpec(char, hintName, known) {
    const nm = char.name;
    const which = hintName
      ? "这次写的是【" + hintName + "】——他行程里常出现的那个地方。"
      : "这次写他现在住的地方。";
    return {
      maxTokens: 12000,
      instruction: "推演「" + nm + "」的一处地方。" + which
        + "\n\n【一句氛围】进门第一感觉：气味、光线、声音，一句话，别写成风景描写。"
        + "\n\n【分 4~5 个区域】区域＝他真的会分开使用的那几块地方，按他的身份、处境、这地方有多大来分——"
        + "住得局促的人只有两三块，宽敞的人才分得开。区域名用他自己的叫法。"
        + "\n\n【每个区域 3 件东西】name 是他自己怎么称呼它；note 一句话写清楚它什么样、怎么来的、为什么在这儿；"
        + "thought 是他自己的想法，第一人称。"
        + "\n\n【唯一的判据】每一件都要能反过来说出他这个人的一件事——"
        + "他反复做什么、在意什么、什么事他一直没弄完、跟他生活里的谁有关。"
        + "**换个角色照样成立的就是写坏了**，说不出他哪一点的，别写进来。"
        + "\n\n【这是他一个人过日子的地方】写的是他自己的日子：他的活计、他的旧事、"
        + "他身边和家里的人、他自己的毛病和讲究。绝大多数东西跟用户没关系。"
        + "用户至多出现在一两件里，而且得是他私底下的心思，不是摆出来给用户看的。"
        + (known ? knownBlock(known) : ""),
      schemaHint: "{\"name\":\"这地方的叫法\",\"en\":\"英文短名，两三个词\",\"ambient\":\"一句氛围\","
        + "\"zones\":[{\"name\":\"区域名\",\"en\":\"英文短名\",\"items\":[{\"name\":\"东西的叫法\",\"note\":\"一句：什么样/怎么来的/为什么在这儿\",\"thought\":\"他自己的想法，第一人称\"}]}]}"
    };
  }
  // 上一份原样发回去：不发的话每刷一次就是另一个屋子
  function knownBlock(p) {
    const lines = [];
    (p.zones || []).forEach(function (z) {
      lines.push("· " + z.name + "：" + (z.items || []).map(function (x) { return x.name; }).join("、"));
    });
    if (!lines.length) return "";
    return "\n\n【上一次这地方是这样】\n" + lines.join("\n")
      + "\n**默认原样照抄回来**——一个人住的地方不会每次看都换一套。"
      + "真变了才改（搬动、添置、用完了、他最近在忙的事变了），一次别改太多。";
  }
  // ── 出图：画这个地方，画面里【没有人】────────────────────
  // 画什么全部从这份地方数据里长出来：那一句氛围定光线冷暖，几个区域定画面里有哪几块。
  async function genArt(place, char) {
    const seen = (place.zones || []).slice(0, 4).map(function (z) {
      return z.name + "（" + (z.items || []).slice(0, 3).map(function (x) { return x.name; }).join("、") + "）";
    }).join("；");
    const prompt = "一幅【室内场景插画】：画的是一个人住的地方或常去的地方，"
      + "**画面里没有人、没有人影、没有正脸**。\n"
      + "【这是什么地方】" + (place.name || "") + ((char && char.name) ? "——" + char.name + "的地方" : "") + "。\n"
      + (place.ambient ? "【进门第一感觉·最重要】" + place.ambient
        + "。光线冷暖、亮暗、空还是满、整洁还是乱，全部服务于这一句，画面读起来必须就是这种感觉。\n" : "")
      + (seen ? "【画面里要看得见这几块】" + seen + "。\n" : "")
      + "【硬性要求】不出现文字、不出现人物、不加边框；是一个真住得进去的空间，有生活痕迹，"
      + "不是样板间也不是效果图；安静、克制；画面必须是可公开展示的。";
    const out = await generateSelfieImage(prompt, null);
    if (!out || !out.blob) throw new Error("图没出来");
    const durl = await blobToDataUrl(out.blob);
    return typeof imgToVault === "function" ? await imgToVault(durl) : durl;
  }
  function normalize(d, hintName, prev) {
    if (!d || typeof d !== "object") return null;
    const zones = (Array.isArray(d.zones) ? d.zones : []).filter(function (z) { return z && z.name; })
      .slice(0, CAP_ZONES).map(function (z) {
        return {
          name: String(z.name).slice(0, 16),
          en: String(z.en || "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22),
          items: (Array.isArray(z.items) ? z.items : []).filter(function (x) { return x && x.name; })
            .slice(0, CAP_ITEMS).map(function (x) {
              return { name: String(x.name).slice(0, 20), note: String(x.note || "").slice(0, 90), thought: String(x.thought || "").slice(0, 160) };
            })
        };
      }).filter(function (z) { return z.items.length; });
    if (!zones.length) return null;
    return {
      id: (prev && prev.id) || uid("pl"),
      name: String(d.name || hintName || "他住的地方").slice(0, 16),
      en: String(d.en || "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24),
      ambient: String(d.ambient || "").slice(0, 120),
      // 图原样留着：重新看一遍只该换文字。出图慢又贵，不该为了换几句话把画也重刷一遍
      img: (prev && prev.img) || "",
      fromSched: !!hintName,
      zones: zones,
      ts: Date.now()
    };
  }

  // ============================================================
  // UI
  // ============================================================
  // 生成时带不带图（她按次付钱，出图是另一次调用）：默认带，右上角随时关，关了以后还能单独补
  const CFG_K = "x_dwellCfg";
  function loadCfg() { const d = loadJSON(CFG_K, null); return { withImg: !(d && d.withImg === false) }; }
  function saveCfg(c) { saveJSON(CFG_K, { withImg: !!c.withImg }); return loadCfg(); }

  // 去处在现实里是【串门】：你去他常待的地方，他不在，你一个人转着看。
  // 数据是 地点→区域→物件 三层，三层各自照现实里那件事的样子长：
  //   · 一处地方 = 你站在那儿看见的一整屏画面。点一下图就是【真全屏】，什么都不压在上面。
  //   · 几块区域 = 他把东西摆在哪儿。区域名本来就是方位（窗下那张长案／靠墙的那口旧柜），
  //     所以每一块画成【一条台面】，东西一样样摆在这条线上——不是分类瓷砖，也不是设置项列表。
  //   · 一件东西 = 你把它拿起来，然后听见他心里那句。那句话是这一页唯一的主角。
  //
  // ⚠️v59.82 那版把这里做成了「场所观察档案」：场所观察档案／空间索引／区域 01／
  //   现场视图／物件观察卡／外观与来路。那套话【原样搬进房产 app、勘察 app、库存 app 都成立】，
  //   按 tabs-not-plain-pills.md 的判据就是写坏了；更糟的是它把他的家说成了证物。
  //   v59.84 加回一屏氛围是治标：形状和用词还是档案的。所以这一版换的是【那个东西】，不是摆放。
  //
  // ⚠️v59.86 还欠着两件（她 2026-09-01：「这些页面没有图片背景了嘤，就我还是想要能直接
  //   从图片里点击进去看，但是不要照片上挂悬浮胶囊＋连线＋幽灵英文」）：
  //   ① 内页丢了图片底衬。这条 no-half-sheet.md 里早写着——「上一层如果有图，就把那张图
  //      糊开压暗当底衬」——v59.82 把它删了，换成一张干净的纸。进了屋反而看不见屋了。
  //   ② 进去的入口不在图上。串门是【看见那个角落，就走过去】，不是先离开这张图再点目录。
  //   所以现在：图是每一层的地皮，区域名压在图的下缘（就是照片自己那条说明），
  //   不挂胶囊、不连线、不摆幽灵英文；一层层进去，图跟着糊开压暗，人始终没离开这处地方。
  const FIELD_PAPER = "#eeeae1";
  const FIELD_INK = "#263038";
  const FIELD_SUB = "#687178";
  const FIELD_LINE = "rgba(38,48,56,.18)";
  // 压在图上的那一套：字浅、面透，让底下那张图一直看得见
  const OVER_INK = "#f4f1e9";
  const OVER_SUB = "rgba(244,241,233,.62)";
  const OVER_LINE = "rgba(255,255,255,.22)";
  const OVER_CARD = "rgba(255,255,255,.075)";
  const OVER_SCRIM = "rgba(9,12,14,.44)";

  function DwellApp(props) {
    const t = useTheme();
    const chars = (props.characters || []).filter(function (c) { return c && !c.npc; });
    const [view, setView] = useState("door");     // door → who → places → place
    const [opening, setOpening] = useState(false);
    const [selId, setSelId] = useState("");
    const char = chars.find(function (c) { return c.id === selId; }) || null;
    const [places, setPlaces] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [zoneIdx, setZoneIdx] = useState(-1);
    const [item, setItem] = useState(null);
    const [drawing, setDrawing] = useState(false);
    const [shot, setShot] = useState("");   // 正在全屏看的那张图（她 2026-09-01：v59.82 把全屏观看整个弄没了）
    const [cfg, setCfg] = useState(loadCfg);
    useEffect(function () { setPlaces(selId ? placesOf(selId) : []); setOpenId(null); setZoneIdx(-1); }, [selId]);

    const busy = props.busyId;
    const open = places.find(function (p) { return p.id === openId; }) || null;
    const zone = open && zoneIdx >= 0 ? (open.zones || [])[zoneIdx] : null;

    async function draw(place) {
      if (!(typeof imgApiReady === "function" && imgApiReady())) { props.toast && props.toast("请先到设置配置图像 API"); return null; }
      if (drawing) return null;
      setDrawing(true);
      try {
        const img = await genArt(place, char);
        const list = savePlace(char.id, Object.assign({}, place, { img: img }));
        if (!list) { props.toast && props.toast("图片出来了，但地点没保存成功，请重试"); return null; }
        setPlaces(list);
        return img;
      } catch (e) {
        props.toast && props.toast("图没出来：" + (e.message || "再试一次"));
        return null;
      } finally { setDrawing(false); }
    }
    async function gen(hintName, prev) {
      if (!props.onGen || !char) return;
      const before = new Set(places.map(function (p) { return p.id; }));
      const list = await props.onGen(char, hintName, prev);
      if (!list) return;
      setPlaces(list);
      // 刚写出来的是哪一个：重写就是原来那条，新写就是列表里多出来的那条
      const made = prev ? list.find(function (p) { return p.id === prev.id; })
        : list.find(function (p) { return !before.has(p.id); });
      if (!made) return;
      setOpenId(made.id); setZoneIdx(-1); setView("place");
      if (cfg.withImg) await draw(made);
    }
    function del(id) {
      requestAppConfirm("删掉这个地方？", "下次可以重新生成。", () => { const next = dropPlace(char.id, id); if (!next) return props.toast && props.toast("这次没删成功，原地点还在"); setPlaces(next); setOpenId(null); setView("places"); }, "删除");
    }
    function back() {
      // 全屏看图时先退出图，别一下把整页退掉
      if (shot) { setShot(""); }
      else if (item) { setItem(null); }
      else if (zone) { setZoneIdx(-1); }
      else if (view === "place") { setOpenId(null); setZoneIdx(-1); setView("places"); }
      else if (view === "places") { setSelId(""); setView("who"); }
      else if (view === "who") { setOpening(false); setView("door"); }
      else props.onBack && props.onBack();
    }
    const topBar = function (title, sub, right) {
      return h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: back, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center px-1" },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, title),
          sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, sub) : null),
        h("div", { className: "flex items-center justify-end", style: { gap: 10, minWidth: 40 } }, right || null));
    };

    // 区域页和物件页仍是【整页】，不是半窗。顶栏和正文沿用移动端统一骨架。
    // 顶栏也压在图上：内页不再是一张与上一层无关的白纸，所以顶栏不能再自带底色
    const overBar = function (title, sub) {
      return h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10), background: "linear-gradient(180deg,rgba(8,11,13,.86),rgba(8,11,13,.28))" } },
        h("button", { onClick: back, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: OVER_INK })),
        h("div", { className: "flex-1 min-w-0 text-center px-1" },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: OVER_INK, lineHeight: 1.15 } }, title),
          sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, marginTop: 1 } }, sub) : null),
        h("div", { style: { width: 40, height: 40, flexShrink: 0 } }));
    };
    const srcOf = function (p) { return p && p.img ? (typeof resolveImg === "function" ? resolveImg(p.img) : p.img) : ""; };
    // 真·全屏看图（她 2026-09-01：「去掉了全屏观看」）。
    // 全屏就该是【只有图】：没有渐变、没有标题、没有统计条，点一下就退出来。
    // portal 到 body——外面那几层有 transform，fixed 会锚到它们身上而不是屏幕。
    const fullShot = (shot && typeof ReactDOM !== "undefined") ? ReactDOM.createPortal(
      h("div", { onClick: function () { setShot(""); }, style: { position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" } },
        h("img", { src: shot, alt: "", style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, textAlign: "center", bottom: "calc(env(safe-area-inset-bottom) + 18px)", fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.5)" } }, "点一下退出")),
      document.body) : null;
    // 底衬：上一层那张图糊开压暗铺满整页（no-half-sheet.md 明写的那一条）。
    // 它不是装饰——进了区域、进了物件，人还得看得见自己在哪儿。没图就是一整块暗底加细网格。
    const backdrop = function (p) {
      const src = srcOf(p);
      return h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, overflow: "hidden", background: "#0d1114" } },
        src
          ? h("img", { src: src, alt: "", style: { position: "absolute", inset: -30, width: "calc(100% + 60px)", height: "calc(100% + 60px)", objectFit: "cover", filter: "blur(22px) brightness(.72) saturate(.95)" } })
          : h("div", { style: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "34px 34px" } }),
        h("div", { style: { position: "absolute", inset: 0, background: OVER_SCRIM } }));
    };
    // 区域页顶上那条：这处地方【没糊过】的样子，点它看全屏
    const placePhoto = function (p, height) {
      const src = srcOf(p);
      return h("button", { onClick: function () { if (src) setShot(src); }, className: "w-full block text-left active:opacity-90", style: { position: "relative", height: height || 210, overflow: "hidden", background: "rgba(255,255,255,.05)", borderBottom: "1px solid " + OVER_LINE } },
        src
          ? h("img", { src: src, alt: p.name || "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
          : h("div", { className: "h-full flex items-center justify-center", style: { backgroundImage: "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize: "24px 24px" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: OVER_SUB, border: "1px solid " + OVER_LINE, padding: "8px 11px", borderRadius: 6 } }, "还没画过这儿")),
        src ? h("div", { style: { position: "absolute", left: 12, bottom: 12, fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "rgba(9,12,14,.68)", padding: "5px 8px", borderRadius: 4 } }, "点开看全屏") : null);
    };
    // 一处地方的第一屏＝你站在那儿看见的画面。
    // ⚠️进去的入口就在【这张图上】（她 2026-09-01 要的），但不是照片上挂胶囊＋连线＋幽灵英文——
    //   那套东西还得替每一块编一个假坐标，连线才有得指。这里换成照片自己那条说明：
    //   区域名压在图的下缘，一条一行、上面一道发丝线，看向哪儿就点哪一行。
    const placeHero = function (p, zs) {
      const src = srcOf(p);
      return h("section", { style: { position: "relative", minHeight: "calc(100dvh - env(safe-area-inset-top) - 58px)", overflow: "hidden", color: OVER_INK } },
        h("button", { onClick: function () { if (src) setShot(src); }, "aria-label": src ? "看全屏" : "还没画过这儿", className: "block active:opacity-95", style: { position: "absolute", inset: 0, width: "100%", padding: 0, border: "none", background: "none" } },
          src
            ? h("img", { src: src, alt: p.name || "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" } })
            : h("div", { style: { position: "absolute", inset: 0, backgroundColor: "#171c20", backgroundImage: "linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)", backgroundSize: "34px 34px" } }),
          h("div", { style: { position: "absolute", inset: 0, background: src
            ? "linear-gradient(180deg,rgba(5,8,10,.16) 0%,rgba(5,8,10,.06) 28%,rgba(5,8,10,.68) 100%)"
            : "radial-gradient(circle at 72% 24%,rgba(97,120,134,.28),transparent 36%),linear-gradient(180deg,rgba(9,12,14,.08),rgba(9,12,14,.7))" } }),
          src ? h("div", { style: { position: "absolute", right: 16, top: 16, fontFamily: F_BODY, fontSize: 10, color: "rgba(244,241,233,.72)", background: "rgba(9,12,14,.42)", border: "1px solid rgba(255,255,255,.22)", padding: "5px 9px", borderRadius: 999 } }, "点开看全屏") : null),
        // 底下这一叠压在图上，但要能点，所以摆在那个铺满的按钮【外面】
        h("div", { style: { position: "relative", pointerEvents: "none", minHeight: "calc(100dvh - env(safe-area-inset-top) - 58px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 21px calc(env(safe-area-inset-bottom) + 22px)" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 31, lineHeight: 1.28, textShadow: "0 2px 20px rgba(0,0,0,.42)" } }, p.name),
          p.ambient ? h("div", { style: { maxWidth: 560, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.82, color: "rgba(244,241,233,.84)", marginTop: 12, textShadow: "0 1px 12px rgba(0,0,0,.55)" } }, p.ambient) : null,
          zs.length
            ? h("div", { style: { pointerEvents: "auto", marginTop: 18 } },
                zs.map(function (z, i) {
                  return h("button", { key: i, onClick: function () { setZoneIdx(i); }, className: "w-full text-left flex items-baseline active:opacity-60",
                    style: { gap: 10, minHeight: 42, padding: "10px 0 9px", borderTop: "1px solid " + OVER_LINE, background: "none" } },
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.4, color: OVER_INK, textShadow: "0 1px 10px rgba(0,0,0,.6)", minWidth: 0 } }, z.name),
                    h("span", { style: { flex: 1 } }),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, whiteSpace: "nowrap" } }, (z.items || []).length ? (z.items || []).length + " 样" : "空着"));
                }))
            : h("div", { style: { marginTop: 18, paddingTop: 12, borderTop: "1px solid " + OVER_LINE, fontFamily: F_BODY, fontSize: 11, color: OVER_SUB } },
                (char ? char.name : "他") + "这儿还什么都没摆。")));
    };
    // ── 一条台面：东西一样样摆在上面 ─────────────────────────
    // 区域名本来就是方位（窗下那张长案／靠墙的那口旧柜／门边挂衣服的那根钉），
    // 说的是【他把东西放在哪儿】。所以它长成台面：东西压在线上、线底下一道影子。
    // 不是两列瓷砖（分类），也不是带 › 的设置项列表。
    // ⚠️东西的名字要【全都看得见】：一块区域最多六样，名字直接摆出来，
    //   别缩成「3 件」再让人点进去猜（no-half-sheet.md 里那句「只够干列三个名字」是同一个病）。
    // ⚠️一行放不下就分层，【每一层各有自己那条台面】。用 flex-wrap 让它自己折，
    //   线只会落在最后一折下面，上面那折的东西就悬空了——那就不是摆在台面上了。
    //   每行 flex:1 1 0：一行两样各占一半，末行只剩一样就自己占满，末层不会缺半截。
    // ⚠️只剩【区域页】在用它了（地点页那一段 v60.03 撤掉，只留图）。
    //   原来还收 onName / onZone 两个回调给地点页点进区域用——那一段没了，这两个也删掉。
    const surface = function (z, i, opt) {
      const o = opt || {};
      const items = (z.items || []);
      const per = o.big ? 1 : 2;
      const rows = [];
      for (var r = 0; r < items.length; r += per) rows.push(items.slice(r, r + per));
      // 台面压在图上，所以它是【亮的一条】，底下压一道暗影——反过来（暗线亮影）在图上就看不见了
      const ledge = h("div", { style: { height: 3, background: "rgba(244,241,233,.82)", borderRadius: 1, boxShadow: "0 7px 12px -6px rgba(0,0,0,.75)" } });
      return h("div", { key: i, style: { marginTop: i ? 30 : 0 } },
        h("div", { className: "w-full text-left flex items-baseline", style: { gap: 9 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: o.big ? 24 : 17, lineHeight: 1.35, color: OVER_INK, minWidth: 0 } }, z.name),
          h("span", { style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, whiteSpace: "nowrap" } }, items.length ? "摆着 " + items.length + " 样" : "空着")),
        rows.map(function (row, ri) {
          return h("div", { key: ri, style: { marginTop: ri ? 14 : 11 } },
            h("div", { className: "flex", style: { alignItems: "flex-end", gap: 7 } },
              row.map(function (x, j) {
                return h("button", { key: j, onClick: function () { setItem(x); }, className: "text-left active:opacity-70",
                  style: { flex: "1 1 0", minWidth: 0, minHeight: 44, background: OVER_CARD, border: "1px solid " + OVER_LINE, borderBottom: "none", borderRadius: "6px 6px 0 0", padding: o.big ? "13px 14px 14px" : "10px 11px 12px", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" } },
                  h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: o.big ? 16.5 : 13.5, lineHeight: 1.45, color: OVER_INK } }, x.name),
                  (o.big && x.note) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: OVER_SUB, marginTop: 5 } }, x.note) : null,
                  (o.big && x.thought) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: "rgba(244,241,233,.9)", marginTop: 7 } }, "他心里有句话没说 ›") : null);
              })),
            ledge);
        }),
        items.length ? null : ledge);
    };

    // ── 一件东西：你把它拿起来，然后听见他心里那句 ──────────────
    // ⚠️这一页只有一样东西是别处没有的：他没说出口的那句。
    //   它得跟这一页的地皮【是相反的材质】才一眼分得开——地皮是那处地方糊开的图，
    //   所以那句话是压在图上的一张纸。看得见的写在图上，心里那句写在纸上。
    if (view === "place" && open && item) return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK } },
      backdrop(open),
      h("div", { className: "relative flex flex-col h-full" },
        overBar(zone ? zone.name : open.name, open.name),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, marginTop: 24 } }, (zone ? zone.name : open.name) + "上摆着的"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, lineHeight: 1.35, color: OVER_INK, marginTop: 8, textShadow: "0 1px 14px rgba(0,0,0,.5)" } }, item.name),
          item.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.9, color: "rgba(244,241,233,.78)", marginTop: 12 } }, item.note) : null,
          item.thought ? h("div", { style: { position: "relative", marginTop: 26, background: FIELD_PAPER, color: FIELD_INK, borderRadius: 4, padding: "26px 20px 20px", overflow: "hidden", boxShadow: "0 16px 34px rgba(0,0,0,.42)" } },
            h("span", { "aria-hidden": "true", style: { position: "absolute", left: 13, top: 2, fontFamily: F_DISPLAY, fontSize: 62, lineHeight: 1, color: FIELD_INK, opacity: .12, pointerEvents: "none" } }, "\u201c"),
            h("div", { style: { position: "relative", fontFamily: "'Noto Serif SC',serif", fontSize: 17, lineHeight: 2 } }, item.thought),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: FIELD_SUB, marginTop: 16, textAlign: "right" } }, "—— " + (char ? char.name : "他") + " 没说出口"))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.9, color: OVER_SUB, marginTop: 24, paddingTop: 16, borderTop: "1px solid " + OVER_LINE } }, "这样东西他没往心里去。"))),
      fullShot);

    // ── 一块区域：还是那条台面，只是走到跟前了 ────────────────
    // 跟上一页同一个形状（同一条台面、同样几样东西），只是每样摊开写着说明——
    // 这才是「走近了看」。换成另一种排版就成了另一个页面，人会以为自己换了个地方。
    // 底下仍是这处地方那张图：进了屋不该看不见屋。
    if (view === "place" && open && zone) return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK } },
      backdrop(open),
      h("div", { className: "relative flex flex-col h-full" },
        overBar(open.name, char ? char.name : ""),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" } },
          placePhoto(open, 116),
          h("div", { className: "px-5", style: { paddingTop: 22 } },
            surface(zone, 0, { big: true }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: OVER_SUB, marginTop: 16, lineHeight: 1.8 } },
              (zone.items || []).length ? "点一样，看他心里怎么说它。" : "这一块他什么都没放。")))),
      fullShot);

    // ── 门：推开才进去 ─────────────────────────────────────
    if (view === "door" || !chars.length) return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      topBar("去处"),
      h("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center px-8" },
        h("button", {
          onClick: function () { if (!chars.length) return; setOpening(true); setTimeout(function () { setView("who"); }, 560); },
          className: "active:opacity-90", style: { perspective: 900, background: "none", border: "none" }
        },
          h("div", { style: { position: "relative", width: 168, height: 258 } },
            // 门开了以后透出来的光
            h("div", { style: { position: "absolute", inset: 0, borderRadius: "84px 84px 6px 6px", background: "linear-gradient(180deg," + ACCENT + "22, #f6efe288)", boxShadow: opening ? "0 0 60px 12px rgba(246,239,226,.34)" : "none", transition: "box-shadow .5s ease" } }),
            // 门扇：从左边那条边转开
            h("div", { style: { position: "absolute", inset: 0, borderRadius: "84px 84px 6px 6px", border: "1.5px solid " + t.line, background: t.bg2,
              transformOrigin: "left center", transform: opening ? "rotateY(-72deg)" : "rotateY(0deg)", transition: "transform .56s cubic-bezier(.34,.68,.3,1)", boxShadow: "0 18px 44px rgba(0,0,0,.16)" } },
              h("div", { style: { position: "absolute", inset: 14, borderRadius: "72px 72px 3px 3px", border: "1px solid " + t.line, opacity: .8 } }),
              h("div", { style: { position: "absolute", right: 15, top: "52%", width: 9, height: 9, borderRadius: 999, background: ACCENT, opacity: .75 } })))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 26, letterSpacing: ".08em" } },
          chars.length ? "推开看看" : "还没有角色")));

    // ── 推开之后：想见谁 ──────────────────────────────────
    if (view === "who") return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      topBar("去处"),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: t.ink, textAlign: "center", margin: "18px 0 4px" } }, "想见谁"),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".22em", color: t.fog, textAlign: "center", marginBottom: 26 } }, "WHO"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", rowGap: 22, columnGap: 14, justifyItems: "center" } },
          chars.map(function (c) {
            const n = placesOf(c.id).length;
            return h("button", { key: c.id, onClick: function () { setSelId(c.id); setView("places"); }, className: "active:opacity-70 flex flex-col items-center" },
              h(Avatar, { character: c, size: 68, radius: 999 }),
              h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginTop: 8, maxWidth: 92 } }, c.remark || c.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, n ? n + " 处" : "还没去过"));
          }))));

    // ── 一处地方：就是这张图 ────────────────────────────────
    // 图是这一整页的地皮，不是顶上一张插图。区域名压在图的下缘，从图里直接点进去。
    // ⚠️她 2026-09-01：「住处这块下面那一堆可以不要了，反正别的那些也可以从上面进去，就留图吧」。
    //   原来图底下还铺着一整段台面（每块区域一条，摆着那儿的东西）——那是同一批入口的第二份，
    //   而且它把图挤成了「顶上一张插图」。入口图上已经有了，第二份就只是占地方。
    //   台面这个形状留着，它在【区域页】还是主角（走近了看那一块）。这里只留图。
    if (view === "place" && open) {
      const zs = (open.zones || []).slice(0, 6);
      return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK } },
        backdrop(open),
        h("div", { className: "relative flex flex-col h-full" },
          overBar("去处", char ? char.name : ""),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" } },
            placeHero(open, zs),
            // 第一屏的底比底衬暗一档，直接接会拉出一条横线像坏了。这一段顶上补一道压暗，
            // 一百来像素里化开，翻下去是「图糊了」，不是「换了一页」。
            h("div", { className: "px-5", style: { paddingTop: 30, backgroundImage: "linear-gradient(180deg,rgba(5,8,10,.3) 0,rgba(5,8,10,0) 116px)" } },
              h("div", { className: "grid grid-cols-2", style: { gap: 9 } },
                h("button", { onClick: function () { gen(open.fromSched ? open.name : null, open); }, disabled: !!busy || drawing, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 44, borderRadius: 8, background: OVER_INK, color: "#1b2126", fontFamily: F_BODY, fontSize: 12 } }, busy ? "正在再看一遍…" : "再去看一遍"),
                h("button", { onClick: function () { draw(open); }, disabled: drawing || !!busy, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 44, borderRadius: 8, border: "1px solid " + OVER_LINE, background: OVER_CARD, color: OVER_INK, fontFamily: F_BODY, fontSize: 12 } }, drawing ? "正在画这儿…" : (open.img ? "重画这儿的样子" : "画一张这儿的样子"))),
              h("button", { onClick: function () { del(open.id); }, className: "w-full active:opacity-60", style: { padding: "14px 0 4px", fontFamily: F_BODY, fontSize: 11, color: "#e0a49c" } }, "不留这个地方了")))),
        fullShot);
    }

    // ── 某个人的地点列表 ──────────────────────────────────
    const freq = char ? frequentPlaces(char.id, props.schedules, 14) : [];
    const made = new Set(places.map(function (p) { return p.name; }));
    const todo = freq.filter(function (f) { return !made.has(f.name); });
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      topBar(char ? (char.remark || char.name) : "去处", null,
        // 生成的时候要不要顺带出图：她按次付钱，这是第二次调用，所以放在明面上随时能关
        h("button", { onClick: function () { setCfg(saveCfg({ withImg: !cfg.withImg })); }, className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: 11, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap",
            color: cfg.withImg ? t.bg2 : t.sub, background: cfg.withImg ? t.ink : "transparent", border: "1px solid " + (cfg.withImg ? t.ink : t.line) } },
          cfg.withImg ? "出图 开" : "出图 关")),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        busy ? h(Spinner, { label: "正在看看 " + (char ? char.name : "") + " 的地方…（这一步会调一次模型" + (cfg.withImg ? "，出图再一次" : "") + "）" }) : null,
        !places.length && !busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.fog, padding: "10px 0 18px" } },
          "还没看过他的地方。生成一次会写出几块区域，每块里几件东西。") : null,
        places.map(function (p) {
          return h("button", { key: p.id, onClick: function () { setOpenId(p.id); setZoneIdx(-1); setView("place"); }, className: "w-full text-left active:opacity-80 mb-2.5",
            style: { border: "1px solid " + t.line, borderRadius: 13, overflow: "hidden", background: t.bg2 } },
            // 有图就露一条窄的，让列表也看得出这处长什么样
            p.img ? h("div", { style: { height: 92, overflow: "hidden" } },
              h("img", { src: (typeof resolveImg === "function" ? resolveImg(p.img) : p.img), alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })) : null,
            h("div", { style: { padding: "12px 14px" } },
              h("div", { className: "flex items-baseline", style: { gap: 8 } },
                h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, minWidth: 0 } }, p.name),
                p.fromSched ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: ACCENT, border: "1px solid " + ACCENT + "66", borderRadius: 5, padding: "1px 5px", flexShrink: 0 } }, "常去") : null,
                h("span", { style: { flex: 1 } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, whiteSpace: "nowrap", flexShrink: 0 } }, (p.zones || []).length + " 块 · " + (p.zones || []).reduce(function (n, z) { return n + (z.items || []).length; }, 0) + " 件")),
              p.ambient ? h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginTop: 5 } }, p.ambient) : null));
        }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 0 8px" } }, "还可以看看"),
        !places.some(function (p) { return !p.fromSched; }) ? h("button", {
          onClick: function () { gen(null, null); }, disabled: !!busy, className: "w-full text-left active:opacity-70 mb-2",
          style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.ink }
        }, "他住的地方") : null,
        todo.map(function (f) {
          return h("button", { key: f.name, onClick: function () { gen(f.name, null); }, disabled: !!busy,
            className: "w-full text-left active:opacity-70 mb-2",
            style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, f.name),
            h("span", { style: { flex: 1 } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "行程里去过 " + f.days + " 天"));
        }),
        !todo.length && places.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } },
          "行程里还没攒出常去的地方——同一个地点去过两天以上才会出现在这里。") : null));
  }

  window.DwellApp = DwellApp;
  window.Dwell = { genArt: genArt,
    loadAll: loadAll, placesOf: placesOf, savePlace: savePlace, dropPlace: dropPlace,
    frequentPlaces: frequentPlaces, placeSpec: placeSpec, normalize: normalize,
    loadCfg: loadCfg, saveCfg: saveCfg,
    CAP_PLACES: CAP_PLACES
  };
})();
