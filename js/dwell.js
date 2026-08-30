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
  function DwellApp(props) {
    const t = useTheme();
    const chars = (props.characters || []).filter(function (c) { return c && !c.npc; });
    const [selId, setSelId] = useState(function () { return (chars[0] || {}).id || ""; });
    const char = chars.find(function (c) { return c.id === selId; }) || chars[0] || null;
    const [places, setPlaces] = useState(function () { return char ? placesOf(char.id) : []; });
    const [openId, setOpenId] = useState(null);
    const [zoneIdx, setZoneIdx] = useState(-1);
    const [item, setItem] = useState(null);
    const [drawing, setDrawing] = useState(false);
    useEffect(function () { setPlaces(char ? placesOf(char.id) : []); setOpenId(null); setZoneIdx(-1); }, [selId]);
    if (!char) return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      h(Head, { zh: "去处", en: "Places", onBack: props.onBack }),
      h(Empty, { text: "还没有角色" }));

    const busy = props.busyId;
    const freq = frequentPlaces(char.id, props.schedules, 14);
    // 已经生成过的那几个地方，按名字认；行程里常去、但还没写过的排在后面当入口
    const made = new Set(places.map(function (p) { return p.name; }));
    const todo = freq.filter(function (f) { return !made.has(f.name); });

    async function gen(hintName, prev) {
      if (props.onGen) { const list = await props.onGen(char, hintName, prev); if (list) setPlaces(list); }
    }
    async function draw(place) {
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast && props.toast("请先到设置配置图像 API");
      if (drawing) return;
      setDrawing(true);
      try {
        const img = await genArt(place, char);
        setPlaces(savePlace(char.id, Object.assign({}, place, { img: img })));
      } catch (e) {
        props.toast && props.toast("图没出来：" + (e.message || "再试一次"));
      } finally { setDrawing(false); }
    }
    function del(id) {
      if (!window.confirm("删掉这个地方？下次可以重新生成。")) return;
      setPlaces(dropPlace(char.id, id)); setOpenId(null);
    }

    const open = places.find(function (p) { return p.id === openId; }) || null;
    const zone = open && zoneIdx >= 0 ? (open.zones || [])[zoneIdx] : null;

    // ── 一个地方的详情 ──
    if (open) return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: open.en || "PLACE" }) },
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: function () { setOpenId(null); }, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, open.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, char.name)),
        h("div", { className: "flex items-center justify-end", style: { gap: 8, minWidth: 56 } },
          h("button", { onClick: function () { gen(open.fromSched ? open.name : null, open); }, disabled: !!busy, "aria-label": "重新看一遍", className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 17, color: t.ink })),
          h("button", { onClick: function () { del(open.id); }, "aria-label": "删掉", className: "active:opacity-50" }, h(ITrash, { size: 16, color: t.fog })))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        // ── 这个地方长什么样 ──
        // 细线指的是【区域】，不是画面里某个具体位置：模型画完不会告诉我们东西落在哪一格，
        // 假装指得准就是骗人。所以位置固定、左右交错，点小签＝翻到那一块。
        h("div", { style: { position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 14, overflow: "hidden",
          border: "1px solid " + t.line, background: t.bg2, margin: "6px 0 12px" } },
          open.img
            ? h("img", { src: (typeof resolveImg === "function" ? resolveImg(open.img) : open.img), alt: open.name,
                style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
            : h("button", { onClick: function () { draw(open); }, disabled: drawing,
                className: "absolute inset-0 flex items-center justify-center active:opacity-70 disabled:opacity-60",
                style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } },
                drawing ? "在画…（这一步会调一次图像 API）" : "画一张这里的样子"),
          open.img ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
            (open.zones || []).slice(0, 4).map(function (z, i) {
              const onLeft = i % 2 === 1;
              const dot = h("div", { key: "d", style: { width: 8, height: 8, borderRadius: 999, background: "#fff", boxShadow: "0 0 0 6px rgba(255,255,255,.24)", flexShrink: 0 } });
              const line = h("div", { key: "l", style: { width: 18, height: 1, background: "rgba(255,255,255,.85)", flexShrink: 0 } });
              const chip = h("button", { key: "c", onClick: function () { setZoneIdx(i); },
                className: "active:opacity-70",
                style: { pointerEvents: "auto", background: "rgba(30,34,40,.62)", border: "1px solid rgba(255,255,255,.45)",
                  color: "#fff", padding: "4px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: 11.5,
                  whiteSpace: "nowrap", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" } }, z.name);
              return h("div", { key: i, style: Object.assign({ position: "absolute", top: [17, 39, 61, 82][i] + "%",
                display: "flex", alignItems: "center", gap: 6 }, onLeft ? { left: "5%" } : { right: "5%" }) },
                onLeft ? [chip, line, dot] : [dot, line, chip]);
            })) : null),
        open.img ? h("button", { onClick: function () { draw(open); }, disabled: drawing,
          className: "active:opacity-60 disabled:opacity-50",
          style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 12 } },
          drawing ? "在重画…" : "重画一张") : null,
        // 一句氛围：进门第一感觉
        open.ambient ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: t.sub, padding: "8px 0 4px", borderLeft: "2px solid " + ACCENT + "55", paddingLeft: 11, margin: "6px 0 16px" } }, open.ambient) : null,
        (open.zones || []).map(function (z, i) {
          return h("button", {
            key: i, onClick: function () { setZoneIdx(i); },
            className: "w-full text-left active:opacity-80 mb-2.5",
            style: Object.assign({ border: "1px solid " + t.line, borderRadius: 13, padding: "12px 14px" },
              pageSkin("paper", t, { base: t.bg2, corner: false, strength: .35 }))
          },
            h("div", { className: "flex items-baseline", style: { gap: 8 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, z.name),
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.16em", color: t.fog } }, (z.en || "").toUpperCase()),
              h("span", { style: { flex: 1 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, (z.items || []).length + " 件")),
            // 这一块里都有什么，先露一行名字——不点进去也知道值不值得点
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 5 } },
              (z.items || []).map(function (x) { return x.name; }).join(" · ")));
        })),
      // 区域里那几件东西
      zone ? h(Sheet, { onClose: function () { setZoneIdx(-1); setItem(null); }, tall: true },
        h("div", { className: "flex items-baseline", style: { gap: 8, marginBottom: 4 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, zone.name),
          h("span", { style: { flex: 1 } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, (zone.items || []).length + " 件")),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.18em", color: t.fog, marginBottom: 14 } }, (zone.en || "").toUpperCase()),
        (zone.items || []).map(function (x, j) {
          return h("button", {
            key: j, onClick: function () { setItem(x); },
            className: "w-full text-left active:opacity-70",
            style: { display: "block", padding: "12px 0", borderTop: j ? "1px solid " + t.line : "none" }
          },
            h("div", { className: "flex items-baseline", style: { gap: 9 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11, color: t.fog, width: 18, flexShrink: 0 } }, String(j + 1).padStart(2, "0")),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, x.name)),
            x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: t.sub, marginTop: 4, paddingLeft: 27 } }, x.note) : null);
        })) : null,
      // 一件东西：他自己的想法在这一层，不摊在列表上
      item ? h(Sheet, { onClose: function () { setItem(null); } },
        h(Eyebrow, { style: { marginBottom: 8 } }, item.name),
        item.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.75, color: t.sub } }, item.note) : null,
        item.thought ? h("div", { style: { marginTop: 14, paddingTop: 13, borderTop: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.1em", color: t.fog, marginBottom: 6 } }, char.name + " 的想法"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.ink } }, item.thought)) : null) : null);

    // ── 地方列表 ──
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }) },
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "去处"),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.18em", color: t.fog, marginTop: 2 } }, "PLACES")),
        h("div", { style: { width: 40 } })),
      // 换个人
      h("div", { className: "shrink-0 flex px-5 pb-3", style: { gap: 7, overflowX: "auto" } },
        chars.map(function (c) {
          const on = c.id === selId;
          return h("button", { key: c.id, onClick: function () { setSelId(c.id); }, className: "shrink-0 active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.ink : t.line) } }, c.remark || c.name);
        })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        busy ? h(Spinner, { label: "正在看看 " + char.name + " 的地方…（这一步会调一次模型）" }) : null,
        !places.length && !busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.fog, padding: "10px 0 18px" } },
          "还没看过他住的地方。生成一次会写出几个区域，每块里几件东西。") : null,
        places.map(function (p) {
          return h("button", { key: p.id, onClick: function () { setOpenId(p.id); }, className: "w-full text-left active:opacity-80 mb-2.5",
            style: Object.assign({ border: "1px solid " + t.line, borderRadius: 13, padding: "13px 14px" },
              pageSkin("paper", t, { base: t.bg2, corner: false, strength: .35 })) },
            h("div", { className: "flex items-baseline", style: { gap: 8 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, p.name),
              p.fromSched ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: ACCENT, border: "1px solid " + ACCENT + "66", borderRadius: 5, padding: "1px 5px" } }, "常去") : null,
              h("span", { style: { flex: 1 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, (p.zones || []).length + " 块 · " + (p.zones || []).reduce(function (n, z) { return n + (z.items || []).length; }, 0) + " 件")),
            p.ambient ? h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginTop: 5 } }, p.ambient) : null);
        }),
        // 还没写过的：住的地方 + 行程里常去的那几个
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
            // 「常去」不是编的：这是行程里真的去过几天
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "行程里去过 " + f.days + " 天"));
        }),
        !todo.length && places.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } },
          "行程里还没攒出常去的地方——同一个地点去过两天以上才会出现在这里。") : null));
  }

  window.DwellApp = DwellApp;
  window.Dwell = { genArt: genArt,
    loadAll: loadAll, placesOf: placesOf, savePlace: savePlace, dropPlace: dropPlace,
    frequentPlaces: frequentPlaces, placeSpec: placeSpec, normalize: normalize,
    CAP_PLACES: CAP_PLACES
  };
})();
