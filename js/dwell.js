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
  function saveAll(d) { saveJSON(K, d); }
  function placesOf(charId) { const a = loadAll()[charId]; return Array.isArray(a && a.places) ? a.places : []; }
  function uid(p) { return (p || "d") + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  function savePlace(charId, place) {
    const all = loadAll();
    const cur = Array.isArray(all[charId] && all[charId].places) ? all[charId].places.slice() : [];
    const i = cur.findIndex(function (p) { return p.id === place.id; });
    if (i >= 0) cur[i] = place; else cur.unshift(place);
    all[charId] = { places: cur.slice(0, CAP_PLACES) };
    saveAll(all);
    return all[charId].places;
  }
  function dropPlace(charId, id) {
    const all = loadAll();
    const cur = (all[charId] && all[charId].places) || [];
    all[charId] = { places: cur.filter(function (p) { return p.id !== id; }) };
    saveAll(all);
    return all[charId].places;
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
  // 提示词只给【判据】，不给内容示范（.claude/rules/prompt-no-content-samples.md）。
  // 判据压到一条：每一件都要能反过来说出他这个人的一件事。
  function placeSpec(char, hintName, known) {
    const nm = char.name;
    const which = hintName
      ? "这次写的是【" + hintName + "】——他行程里常出现的那个地方。"
      : "这次写他现在住的地方。";
    return {
      maxTokens: 4000,
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

  // 细线小签的落点：均匀铺开、左右交错。
  // ⚠️它指的是【哪一块区域】，不是画面里某个具体位置——模型画完不会告诉我们东西落在哪一格，
  // 位置算得再花哨也是假的。所以规则简单、诚实：从上到下依次排开。
  // 只铺在 16%~72% 这一段：上面要让开顶栏，下面要让开那一句氛围——
  // 铺满整屏的话最后一根线会压在氛围那行字上（实测第一版就压上了）
  function pinTop(i, n) { return n <= 1 ? 42 : Math.round(16 + i * (56 / (n - 1))); }

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
      if (!window.confirm("删掉这个地方？下次可以重新生成。")) return;
      setPlaces(dropPlace(char.id, id)); setOpenId(null); setView("places");
    }
    function back() {
      if (item) { setItem(null); }
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

    // 区域页和物件页都是【整页】，不是从底下掀起来的半窗——
    // 半窗把内容压在下半屏、上面那半还糊着一层背景，字大一点就摆不下（见 .claude/rules/no-half-sheet.md）。
    // 底衬用这处地方的图糊开压暗：既接得上全屏那一页，又不抢正文。
    const backdrop = function (p) {
      return p && p.img
        ? h("div", { style: { position: "absolute", inset: 0, overflow: "hidden" } },
            h("img", { src: (typeof resolveImg === "function" ? resolveImg(p.img) : p.img), alt: "",
              // 糊开之后边缘会透出底色，得往外多铺一圈。⚠️用 transform:scale 撑，不能用 width:116%——
              // 全局有一条 img{max-width:100%}，把宽度按回 100%，右边就空出一条（实测量出来差 31px）
              style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.18)", filter: "blur(22px) saturate(.8)" } }),
            h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(16,17,20,.70),rgba(16,17,20,.93))" } }))
        : h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 50% 12%, #262b33, #14161a 72%)" } });
    };
    const darkBar = function (title, sub, right) {
      return h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: back, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#fff" })),
        h("div", { className: "flex-1 min-w-0 text-center px-1" },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#fff", lineHeight: 1.15 } }, title),
          sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.6)", marginTop: 1 } }, sub) : null),
        h("div", { className: "flex items-center justify-end", style: { gap: 12, minWidth: 40 } }, right || null));
    };

    // ── 一件东西：整页，他的想法是这一页的主角 ─────────────────
    if (view === "place" && open && item) return h("div", { className: "h-full flex flex-col relative", style: { background: "#14161a" } },
      backdrop(open),
      h("div", { className: "relative flex flex-col h-full" },
        darkBar(zone ? zone.name : open.name, open.name),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".22em", color: "rgba(255,255,255,.42)", marginTop: 18 } }, "ONE THING"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1.35, color: "#fff", marginTop: 8 } }, item.name),
          item.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.9, color: "rgba(255,255,255,.76)", marginTop: 14 } }, item.note) : null,
          item.thought ? h("div", { style: { marginTop: 26, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.16)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".12em", color: "rgba(255,255,255,.48)", marginBottom: 12 } }, (char ? char.name : "他") + " 的想法"),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 16, lineHeight: 2.05, color: "#fff" } }, item.thought)) : null)));

    // ── 一块区域：整页列这一块里的东西 ────────────────────────
    if (view === "place" && open && zone) return h("div", { className: "h-full flex flex-col relative", style: { background: "#14161a" } },
      backdrop(open),
      h("div", { className: "relative flex flex-col h-full" },
        darkBar(open.name, char ? char.name : ""),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".22em", color: "rgba(255,255,255,.42)", marginTop: 18 } }, (zone.en || "ZONE").toUpperCase()),
          h("div", { className: "flex items-baseline", style: { gap: 10, marginTop: 8, marginBottom: 20 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1.3, color: "#fff", minWidth: 0 } }, zone.name),
            h("span", { style: { flex: 1 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.5)", whiteSpace: "nowrap" } }, (zone.items || []).length + " 件")),
          (zone.items || []).map(function (x, j) {
            return h("button", { key: j, onClick: function () { setItem(x); },
              className: "w-full text-left active:opacity-70",
              style: { display: "block", padding: "15px 0", borderTop: "1px solid rgba(255,255,255,.14)" } },
              h("div", { className: "flex items-baseline", style: { gap: 11 } },
                h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: "rgba(255,255,255,.4)", width: 20, flexShrink: 0 } }, String(j + 1).padStart(2, "0")),
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: "#fff", lineHeight: 1.4 } }, x.name)),
              x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: "rgba(255,255,255,.6)", marginTop: 5, paddingLeft: 31 } }, x.note) : null);
          }))));

    // ── 门：推开才进去 ─────────────────────────────────────
    if (view === "door" || !chars.length) return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      topBar("去处", "PLACES"),
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
      topBar("去处", "PLACES"),
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

    // ── 全屏的一处地方：图铺满，细线直接挂在上面 ───────────────
    if (view === "place" && open) {
      const zs = (open.zones || []).slice(0, 6);
      return h("div", { className: "h-full relative", style: { background: "#14161a", overflow: "hidden" } },
        open.img
          ? h("img", { src: (typeof resolveImg === "function" ? resolveImg(open.img) : open.img), alt: open.name,
              style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
          // 没出图的时候不是坏了，是「还没画」：一整块暗底 + 这地方的英文名，细线照样能用
          : h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 50% 18%, #2a2f37, #14161a 70%)", display: "flex", alignItems: "center", justifyContent: "center" } },
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 34, letterSpacing: ".24em", color: "rgba(255,255,255,.09)", textAlign: "center", padding: "0 24px", lineHeight: 1.35 } }, (open.en || "PLACE").toUpperCase())),
        // 上下压两层渐变，白字才读得清
        h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 190, background: "linear-gradient(180deg,rgba(0,0,0,.55),transparent)", pointerEvents: "none" } }),
        h("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "linear-gradient(0deg,rgba(0,0,0,.72),transparent)", pointerEvents: "none" } }),
        // 顶栏
        h("div", { className: "absolute left-0 right-0 flex items-center px-4", style: { top: 0, paddingTop: safeTop(10) } },
          h("button", { onClick: back, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#fff" })),
          h("div", { className: "flex-1 min-w-0 text-center px-1" },
            h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#fff", lineHeight: 1.15 } }, open.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.62)", marginTop: 1 } }, char ? char.name : "")),
          h("div", { className: "flex items-center justify-end", style: { gap: 12, minWidth: 56 } },
            h("button", { onClick: function () { gen(open.fromSched ? open.name : null, open); }, disabled: !!busy || drawing, "aria-label": "重新看一遍", className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 17, color: "#fff" })),
            h("button", { onClick: function () { del(open.id); }, "aria-label": "删掉", className: "active:opacity-50" }, h(ITrash, { size: 16, color: "rgba(255,255,255,.72)" })))),
        // 细线小签：一根指一块，点了翻到那一块
        h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
          zs.map(function (z, i) {
            const onLeft = i % 2 === 1;
            const dot = h("div", { key: "d", style: { width: 9, height: 9, borderRadius: 999, background: "#fff", boxShadow: "0 0 0 6px rgba(255,255,255,.22)", flexShrink: 0 } });
            const line = h("div", { key: "l", style: { width: 26, height: 1, background: "rgba(255,255,255,.9)", flexShrink: 0 } });
            const chip = h("button", { key: "c", onClick: function () { setZoneIdx(i); }, className: "active:opacity-70",
              style: { pointerEvents: "auto", maxWidth: 190, background: "rgba(20,22,26,.58)", border: "1px solid rgba(255,255,255,.42)",
                color: "#fff", padding: "6px 13px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" } }, z.name);
            return h("div", { key: i, style: Object.assign({ position: "absolute", top: pinTop(i, zs.length) + "%", display: "flex", alignItems: "center", gap: 7 },
              onLeft ? { left: "5%" } : { right: "5%" }) }, onLeft ? [chip, line, dot] : [dot, line, chip]);
          })),
        // 底下只留那一句氛围——区域名已经挂在图上了，下面再列一遍是重复
        h("div", { className: "absolute left-0 right-0 px-6", style: { bottom: 0, paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" } },
          open.ambient ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,.92)", textShadow: "0 1px 10px rgba(0,0,0,.5)" } }, open.ambient) : null,
          h("button", { onClick: function () { draw(open); }, disabled: drawing || !!busy,
            className: "active:opacity-60 disabled:opacity-50",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,.66)", marginTop: 12 } },
            drawing ? "在画…（这一步会调一次图像 API）" : (open.img ? "重画一张" : "补一张图"))),
        busy ? h("div", { className: "absolute inset-0 flex items-center justify-center", style: { background: "rgba(0,0,0,.45)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#fff" } }, "正在重新看一遍…")) : null);
    }

    // ── 某个人的地点列表 ──────────────────────────────────
    const freq = char ? frequentPlaces(char.id, props.schedules, 14) : [];
    const made = new Set(places.map(function (p) { return p.name; }));
    const todo = freq.filter(function (f) { return !made.has(f.name); });
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      topBar(char ? (char.remark || char.name) : "去处", "PLACES",
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
    loadCfg: loadCfg, saveCfg: saveCfg, pinTop: pinTop,
    CAP_PLACES: CAP_PLACES
  };
})();
