// ============================================================
// 地方（dwell）—— TA住的地方 + TA常去的地方
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

  // 她和【这个人】的城市（她 2026-10-02：「怎么大家共用一个我们的城市啊，王爷的地点也跑来这里了」）：
  //   每个人各一份，x_datePlacesBy = { charId: [{ id, name, note, by }] }。
  //   去处点开能「自己去转转」或「约TA在这儿见」，约会券、旅行、聊天里的邀约挑地方也读【那个人的】这一份。
  //   旧版共用的 x_datePlaces 不删：开机时按「谁钉的／跟谁去过／约过谁」认领，认不出的留在 unclaimed，
  //   钉地方时能一键捡回来——不替她猜，也不丢。
  const DP_KEY = "x_datePlacesBy";
  const dpAll = function () { try { const o = JSON.parse(localStorage.getItem(DP_KEY) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  const DatePlaces = {
    list: function (cid) { if (!cid) return []; const a = dpAll()[cid]; return Array.isArray(a) ? a : []; },
    save: function (a, cid) { if (!cid) return a; const o = dpAll(); o[cid] = (a || []).slice(0, 30); try { localStorage.setItem(DP_KEY, JSON.stringify(o)); } catch (e) {} return o[cid]; },
    add: function (name, note, by, cid) { const a = DatePlaces.list(cid).slice(); a.push({ id: "dp_" + Date.now(), name: String(name).slice(0, 24), note: String(note || "").slice(0, 60), by: by || "" }); return DatePlaces.save(a, cid); },
    // 去过几次：x_dateVisits = { 地名: [{ charId, ts, line }] }，见面散场时记（app.js endOffline）；只数跟这个人去的
    visits: function (name, cid) { try { const v = JSON.parse(localStorage.getItem("x_dateVisits") || "{}") || {}; const a = Array.isArray(v[name]) ? v[name] : []; return cid ? a.filter(function (x) { return x && x.charId === cid; }) : a; } catch (e) { return []; } },
    remove: function (id, cid) { return DatePlaces.save(DatePlaces.list(cid).filter(function (x) { return x.id !== id; }), cid); },
    // 给模型的一行：约会券、旅行、TA开的线下挑地方时可以从这里挑
    hint: function (cid) { const a = DatePlaces.list(cid); return a.length ? "她在你们俩的城市里钉过这些可以约会的地方（挑地方时可以优先从这里挑，也可以不挑）：" + a.map(function (x) { return "「" + x.name + "」" + (x.note ? "（" + x.note + "）" : ""); }).join("") + "。" : ""; },
    // 旧版共用那份里还没认领的
    unclaimed: function () { try { const a = JSON.parse(localStorage.getItem("x_datePlaces") || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
    dropUnclaimed: function (name) { try { localStorage.setItem("x_datePlaces", JSON.stringify(DatePlaces.unclaimed().filter(function (x) { return x.name !== name; }))); } catch (e) {} },
    // 认领：ownersOf(地名) 返回跟这地方有过来往的人的 id（app 那头翻邀约卡）；by、去过记录在这儿自己看
    migrate: function (ownersOf) {
      const old = DatePlaces.unclaimed();
      if (!old.length) return;
      const left = [];
      old.forEach(function (p) {
        const ids = {};
        if (p.by) ids[p.by] = 1;
        DatePlaces.visits(p.name).forEach(function (v) { if (v && v.charId) ids[v.charId] = 1; });
        (ownersOf ? ownersOf(p.name) || [] : []).forEach(function (id) { if (id) ids[id] = 1; });
        const keys = Object.keys(ids);
        if (!keys.length) { left.push(p); return; }
        keys.forEach(function (cid) { if (!DatePlaces.list(cid).some(function (x) { return x.name === p.name; })) DatePlaces.save(DatePlaces.list(cid).concat([p]), cid); });
      });
      try { localStorage.setItem("x_datePlaces", JSON.stringify(left)); } catch (e) {}
    }
  };
  window.DatePlaces = DatePlaces;
  // 地图上的落点：按名字算一个固定位置，钉上去以后不乱跳
  function pinPos(name, i) {
    let h = 7; for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0;
    return { x: 12 + (h % 76), y: 14 + ((h >>> 8) % 64) + (i % 2) * 4 };
  }
  // 城市小地图：几条街、钉着她的那些地方。点一个钉弹出两个去法
  function CityMap(props) {
    const t = props.t, places = props.places, sel = props.sel;
    return h("div", { style: { position: "relative", height: 210, borderRadius: 14, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2 }, "data-wk": "dwellcitymap" },
      h("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", style: { position: "absolute", inset: 0, width: "100%", height: "100%" } },
        [18, 42, 67, 88].map(function (y, i) { return h("path", { key: "h" + i, d: "M0 " + y + " C30 " + (y - 4) + " 60 " + (y + 5) + " 100 " + (y - 2), stroke: t.line, strokeWidth: i % 2 ? 1.6 : 2.6, fill: "none", "data-wk": "dwellcitymap", "data-part": "r2" }); }),
        [22, 51, 79].map(function (x, i) { return h("path", { key: "v" + i, d: "M" + x + " 0 C" + (x + 4) + " 40 " + (x - 5) + " 70 " + (x + 2) + " 100", stroke: t.line, strokeWidth: i === 1 ? 2.6 : 1.6, fill: "none", "data-wk": "dwellcitymap", "data-part": "r3" }); }),
        h("ellipse", { cx: 66, cy: 30, rx: 9, ry: 6, fill: t.line, opacity: .5 })),
      places.map(function (p, i) {
        const q = pinPos(p.name, i), on = sel && sel.id === p.id;
        const n = DatePlaces.visits(p.name, props.charId).length, here = props.hereId === p.id, his = p.by && props.charId && p.by === props.charId;
        return h("button", { key: p.id, onClick: function () { props.onPick(on ? null : p); }, className: "active:opacity-70",
          style: { position: "absolute", left: q.x + "%", top: q.y + "%", transform: "translate(-50%,-100%)", display: "flex", flexDirection: "column", alignItems: "center" }, "data-wk": "dwellcitymap", "data-part": "r4", "data-on": on ? "1" : "0" },
          // 他在这儿：钉上面冒一个小头像；他钉的：名字前一颗心；去过几次：名字后几颗星
          here && props.avatar ? h("span", { style: { marginBottom: 2, borderRadius: 999, boxShadow: "0 0 0 2px " + t.bg2, animation: "wkpop .4s ease both" } }, props.avatar) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: on ? t.bg2 : t.ink, background: on ? t.ink : t.bg, border: "1px solid " + (his ? ACCENT : t.line), borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" } },
            (his ? "♡ " : "") + p.name + (n ? " ★" + n : "")),
          h("span", { style: { width: 8, height: 8, borderRadius: 999, background: here ? "#d9776b" : ACCENT, marginTop: 2, boxShadow: "0 0 0 3px " + t.bg2 } }));
      }),
      !places.length ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7 } },
        "还没钉地方。点下面「钉一个地方」，把你们会去的咖啡店、书店、那家面馆钉上来。") : null);
  }
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
  // （行程说TA在书房，地点表说TA常泡茶楼）。这里只是把已经发生过的数一数。
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
  // 判据压到一条：每一件都要能反过来说出TA这个人的一件事。
  function placeSpec(char, hintName, known) {
    const nm = char.name;
    const which = hintName
      ? "这次写的是【" + hintName + characterText(char, "】——他会去、会在那儿待上一阵的一个地方（可能是他行程里常去的，也可能是地图上的某处，或者被随口点到的一个角落）。")
      : characterText(char, "这次写他现在住的地方。");
    return {
      maxTokens: 12000,
      instruction: "推演「" + nm + "」的一处地方。" + which
        + "\n\n【一句氛围】进门第一感觉：气味、光线、声音，一句话，别写成风景描写。"
        + characterText(char, "\n\n【分 4~5 个区域】区域＝他真的会分开使用的那几块地方，按他的身份、处境、这地方有多大来分——")
        + characterText(char, "住得局促的人只有两三块，宽敞的人才分得开。区域名用他自己的叫法。")
        + characterText(char, "\n\n【每个区域 3 件东西】name 是他自己怎么称呼它；note 一句话写清楚它什么样、怎么来的、为什么在这儿；")
        + characterText(char, "thought 是他自己的想法，第一人称。")
        + characterText(char, "\n\n【唯一的判据】每一件都要能反过来说出他这个人的一件事——")
        + characterText(char, "他反复做什么、在意什么、什么事他一直没弄完、跟他生活里的谁有关。")
        + characterText(char, "**换个角色照样成立的就是写坏了**，说不出他哪一点的，别写进来。")
        + characterText(char, "\n\n【这是他一个人过日子的地方】写的是他自己的日子：他的活计、他的旧事、")
        + characterText(char, "他身边和家里的人、他自己的毛病和讲究。绝大多数东西跟用户没关系。")
        + characterText(char, "用户至多出现在一两件里，而且得是他私底下的心思，不是摆出来给用户看的。")
        + (known ? knownBlock(known) : ""),
      schemaHint: "{\"name\":\"这地方的叫法\",\"en\":\"英文短名，两三个词\",\"ambient\":\"一句氛围\","
        + characterText(char, "\"zones\":[{\"name\":\"区域名\",\"en\":\"英文短名\",\"items\":[{\"name\":\"东西的叫法\",\"note\":\"一句：什么样/怎么来的/为什么在这儿\",\"thought\":\"他自己的想法，第一人称\"}]}]}")
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
      + "真变了才改（搬动、添置、用完了、TA最近在忙的事变了），一次别改太多。";
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
      name: String(d.name || hintName || "TA住的地方").slice(0, 16),
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

  // 去处在现实里是【串门】：你去TA常待的地方，TA不在，你一个人转着看。
  // 数据是 地点→区域→物件 三层，三层各自照现实里那件事的样子长：
  //   · 一处地方 = 你站在那儿看见的一整屏画面。点一下图就是【真全屏】，什么都不压在上面。
  //   · 几块区域 = TA把东西摆在哪儿。区域名本来就是方位（窗下那张长案／靠墙的那口旧柜），
  //     所以每一块画成【一条台面】，东西一样样摆在这条线上——不是分类瓷砖，也不是设置项列表。
  //   · 一件东西 = 你把它拿起来，然后听见TA心里那句。那句话是这一页唯一的主角。
  //
  // ⚠️v59.82 那版把这里做成了「场所观察档案」：场所观察档案／空间索引／区域 01／
  //   现场视图／物件观察卡／外观与来路。那套话【原样搬进房产 app、勘察 app、库存 app 都成立】，
  //   按 tabs-not-plain-pills.md 的判据就是写坏了；更糟的是它把TA的家说成了证物。
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

  // 「那天」收纳册（她 2026-10-03）：一张张「那天」排成两列，点一下翻到背面看那场的总结，再点开看完整经过。
  //   只收约过的（她定的：没走邀约的线下不收）。正面跟聊天里那张「那天」长一个样。
  function DateAlbumCard({ t, e, flipped, onFlip, onRead }) {
    const m = e.m;
    const face = { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: t.bg2, border: "1px solid " + t.line,
      borderRadius: 12, padding: "14px 12px 12px", display: "flex", flexDirection: "column", boxShadow: "0 4px 12px rgba(0,0,0,.06)" };
    const sum = String((e.session && e.session.summary) || "").trim();
    return h("div", { onClick: onFlip, role: "button", "data-wk": "card", className: "active:opacity-90", style: { position: "relative", height: 196, perspective: 900, cursor: "pointer" } },
      h("div", { style: { position: "absolute", inset: 0, transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.3,.7,.3,1)", transform: flipped ? "rotateY(180deg)" : "none" } },
        // 藏起来的那一面不接点按：不然点到的可能是背面那颗按钮
        // 正面就是聊天里那张「那天」，原样借来（fill＝填满这一格）
        h("div", { style: { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", pointerEvents: flipped ? "none" : "auto" } },
          typeof DateMemoryCard === "function" ? h(DateMemoryCard, { m: m, character: { name: e.who }, fill: true }) : null),
        h("div", { style: Object.assign({}, face, { transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none" }) },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 6 } }, "那天的经过"),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: t.ink, wordBreak: "break-word" } },
            sum || (e.session ? "这一场没留下总结。" : "这一场的线下记录已经不在了。")),
          e.session ? h("button", { onClick: function (ev) { ev.stopPropagation(); onRead(e); }, className: "active:opacity-60",
            style: { marginTop: 8, alignSelf: "flex-end", fontFamily: F_BODY, fontSize: 11.5, color: t.tint, minHeight: 28 }, "data-wk": "dwelldatealbumcardbtn", "data-part": "1" }, "看完整经过 →") : null)));
  }
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
    const [dates, setDates] = useState([]);
    const [dateSel, setDateSel] = useState(null);
    const [albumFlip, setAlbumFlip] = useState(null);   // 翻到背面的那一张
    const [albumRead, setAlbumRead] = useState(null);   // 正在看完整经过的那一场
    // 换一个人，就是换一座城：地点表跟着这个人走
    useEffect(function () { setDates(DatePlaces.list(char && char.id)); setDateSel(null); }, [char && char.id]);
    // 「我们的城市」看哪张图（她 2026-10-02 转群友：切换现实/架空）：手绘＝原来那张钉点图；
    //   现实、架空直接用好友地图那两张，不另画。记住上次看的是哪张。
    const [mapKind, setMapKind] = useState(function () { try { return localStorage.getItem("x_cityMapKind") || "draw"; } catch (e) { return "draw"; } });
    const pickMapKind = function (k) { setMapKind(k); try { localStorage.setItem("x_cityMapKind", k); } catch (e) {} };
    const [pinPick, setPinPick] = useState(false);
    const [compose, setCompose] = useState(null);   // 约TA之前那一小框：挑日子钟点、写一句话（她 2026-10-02）   // 钉一个地方：先从下面现成的里挑，挑不到再自己写（她 2026-10-02）
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
      else if (view === "room") { setView("place"); }
      else if (view === "place") { setOpenId(null); setZoneIdx(-1); setView("places"); }
      else if (view === "places") { setSelId(""); setView("who"); }
      else if (view === "who") { setOpening(false); setView("door"); }
      else props.onBack && props.onBack();
    }
    // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1：「那条紧凑栏就是 Head，别再自己写一条」）。
    // ⚠️v65.14 才换过来。手写那条身上【一个 data-wk 挂点都没有】，于是给「去处」写的
    //   主题 CSS 抓不到顶栏——她 2026-09-06 在文风台撞见的是同一个病。
    // bg 透明：底纹铺在外壳上，顶栏透上来（同 §3.5）；这一条本来就没有分隔线，所以 noLine。
    const topBar = function (title, sub, right) {
      return h(Head, { zh: title, sub: sub, onBack: back, right: right, bg: "transparent", noLine: true });
    };

    // 区域页和物件页仍是【整页】，不是半窗。顶栏和正文沿用移动端统一骨架。
    // 顶栏也压在图上：内页不再是一张与上一层无关的白纸，所以顶栏不能再自带底色
    // 压在图上的那一条也走 Head：字色和那层压暗的渐变照旧从这儿传进去
    //（Head 的 ink / subInk / bg 就是为这种页开的口子）。
    const overBar = function (title, sub) {
      return h(Head, { zh: title, sub: sub, onBack: back, ink: OVER_INK, subInk: OVER_SUB, noLine: true,
        bg: "linear-gradient(180deg,rgba(8,11,13,.86),rgba(8,11,13,.28))" });
    };
    const srcOf = function (p) { return p && p.img ? (typeof resolveImg === "function" ? resolveImg(p.img) : p.img) : ""; };
    // 真·全屏看图（她 2026-09-01：「去掉了全屏观看」）。
    // 全屏就该是【只有图】：没有渐变、没有标题、没有统计条，点一下就退出来。
    // portal 到 body——外面那几层有 transform，fixed 会锚到它们身上而不是屏幕。
    const fullShot = (shot && typeof ReactDOM !== "undefined") ? ReactDOM.createPortal(
      h("div", { onClick: function () { setShot(""); }, style: { position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }, "data-wk": "dwellpagetap", "data-part": "1" },
        h("img", { src: shot, alt: "", style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, textAlign: "center", bottom: "calc(env(safe-area-inset-bottom) + 18px)", fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.5)" } }, "点一下退出")),
      document.body) : null;
    // 底衬：上一层那张图糊开压暗铺满整页（no-half-sheet.md 明写的那一条）。
    // 它不是装饰——进了区域、进了物件，人还得看得见自己在哪儿。没图就是一整块暗底加细网格。
    const backdrop = function (p) {
      const src = srcOf(p);
      return h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, overflow: "hidden", background: "#0d1114" }, "data-wk": "dwellbackdrop" },
        src
          ? h("img", { src: src, alt: "", style: { position: "absolute", inset: -30, width: "calc(100% + 60px)", height: "calc(100% + 60px)", objectFit: "cover", filter: "blur(22px) brightness(.72) saturate(.95)" } })
          : h("div", { style: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "34px 34px" } }),
        h("div", { style: { position: "absolute", inset: 0, background: OVER_SCRIM } }));
    };
    // 区域页顶上那条：这处地方【没糊过】的样子，点它看全屏
    const placePhoto = function (p, height) {
      const src = srcOf(p);
      return h("button", { onClick: function () { if (src) setShot(src); }, className: "w-full block text-left active:opacity-90", style: { position: "relative", height: height || 210, overflow: "hidden", background: "rgba(255,255,255,.05)", borderBottom: "1px solid " + OVER_LINE }, "data-wk": "dwellpage" },
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
      return h("section", { style: { position: "relative", minHeight: "calc(100dvh - env(safe-area-inset-top) - 58px)", overflow: "hidden", color: OVER_INK }, "data-wk": "dwellplacehero" },
        h("button", { onClick: function () { if (src) setShot(src); }, "aria-label": src ? "看全屏" : "还没画过这儿", className: "block active:opacity-95", style: { position: "absolute", inset: 0, width: "100%", padding: 0, border: "none", background: "none" }, "data-wk": "dwellpagebtn", "data-part": "1" },
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
                    style: { gap: 10, minHeight: 42, padding: "10px 0 9px", borderTop: "1px solid " + OVER_LINE, background: "none" }, "data-wk": "dwellpage", "data-part": "r2" },
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.4, color: OVER_INK, textShadow: "0 1px 10px rgba(0,0,0,.6)", minWidth: 0 } }, z.name),
                    h("span", { style: { flex: 1 } }),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, whiteSpace: "nowrap" } }, (z.items || []).length ? (z.items || []).length + " 样" : "空着"));
                }))
            : h("div", { style: { marginTop: 18, paddingTop: 12, borderTop: "1px solid " + OVER_LINE, fontFamily: F_BODY, fontSize: 11, color: OVER_SUB } },
                (char ? char.name : characterText(char, "他")) + "这儿还什么都没摆。")));
    };
    // ── 一条台面：东西一样样摆在上面 ─────────────────────────
    // 区域名本来就是方位（窗下那张长案／靠墙的那口旧柜／门边挂衣服的那根钉），
    // 说的是【TA把东西放在哪儿】。所以它长成台面：东西压在线上、线底下一道影子。
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
      return h("div", { key: i, style: { marginTop: i ? 30 : 0 }, "data-wk": "dwellsurface" },
        h("div", { className: "w-full text-left flex items-baseline", style: { gap: 9 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: o.big ? 24 : 17, lineHeight: 1.35, color: OVER_INK, minWidth: 0 } }, z.name),
          h("span", { style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: OVER_SUB, whiteSpace: "nowrap" } }, items.length ? "摆着 " + items.length + " 样" : "空着")),
        rows.map(function (row, ri) {
          return h("div", { key: ri, style: { marginTop: ri ? 14 : 11 }, "data-wk": "dwellpage", "data-part": "r3" },
            h("div", { className: "flex", style: { alignItems: "flex-end", gap: 7 } },
              row.map(function (x, j) {
                return h("button", { key: j, onClick: function () { setItem(x); }, className: "text-left active:opacity-70",
                  style: { flex: "1 1 0", minWidth: 0, minHeight: 44, background: OVER_CARD, border: "1px solid " + OVER_LINE, borderBottom: "none", borderRadius: "6px 6px 0 0", padding: o.big ? "13px 14px 14px" : "10px 11px 12px", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }, "data-wk": "dwellpage", "data-part": "r4" },
                  h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: o.big ? 16.5 : 13.5, lineHeight: 1.45, color: OVER_INK } }, x.name),
                  (o.big && x.note) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: OVER_SUB, marginTop: 5 } }, x.note) : null,
                  (o.big && x.thought) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: "rgba(244,241,233,.9)", marginTop: 7 } }, characterText(char, "他心里有句话没说 ›")) : null);
              })),
            ledge);
        }),
        items.length ? null : ledge);
    };

    // ── 一件东西：你把它拿起来，然后听见TA心里那句 ──────────────
    // ⚠️这一页只有一样东西是别处没有的：TA没说出口的那句。
    //   它得跟这一页的地皮【是相反的材质】才一眼分得开——地皮是那处地方糊开的图，
    //   所以那句话是压在图上的一张纸。看得见的写在图上，心里那句写在纸上。
    if (view === "place" && open && item) return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK }, "data-wk": "dwellpage", "data-part": "r5" },
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
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: FIELD_SUB, marginTop: 16, textAlign: "right" } }, "—— " + (char ? char.name : characterText(char, "他")) + " 没说出口"))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.9, color: OVER_SUB, marginTop: 24, paddingTop: 16, borderTop: "1px solid " + OVER_LINE } }, characterText(char, "这样东西他没往心里去。")))),
      fullShot);

    // ── 一块区域：还是那条台面，只是走到跟前了 ────────────────
    // 跟上一页同一个形状（同一条台面、同样几样东西），只是每样摊开写着说明——
    // 这才是「走近了看」。换成另一种排版就成了另一个页面，人会以为自己换了个地方。
    // 底下仍是这处地方那张图：进了屋不该看不见屋。
    if (view === "place" && open && zone) return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK }, "data-wk": "dwellpage", "data-part": "r6" },
      backdrop(open),
      h("div", { className: "relative flex flex-col h-full" },
        overBar(open.name, char ? char.name : ""),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" } },
          placePhoto(open, 116),
          h("div", { className: "px-5", style: { paddingTop: 22 } },
            surface(zone, 0, { big: true }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: OVER_SUB, marginTop: 16, lineHeight: 1.8 } },
              (zone.items || []).length ? characterText(char, "点一样，看他心里怎么说它。") : characterText(char, "这一块他什么都没放。"))))),
      fullShot);

    // ── 门：推开才进去 ─────────────────────────────────────
    if (view === "door" || !chars.length) return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }), "data-wk": "dwellpage", "data-part": "r7" },
      topBar("去处"),
      h("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center px-8" },
        h("button", {
          onClick: function () { if (!chars.length) return; setOpening(true); setTimeout(function () { setView("who"); }, 560); },
          className: "active:opacity-90", style: { perspective: 900, background: "none", border: "none" }, "data-wk": "dwellpagebtn", "data-part": "2"
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
    if (view === "who") return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }), "data-wk": "dwellpage", "data-part": "r8" },
      topBar("去处"),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: t.ink, textAlign: "center", margin: "18px 0 4px" } }, "想见谁"),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".22em", color: t.fog, textAlign: "center", marginBottom: 26 } }, "WHO"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", rowGap: 22, columnGap: 14, justifyItems: "center" } },
          chars.map(function (c) {
            const n = placesOf(c.id).length;
            return h("button", { key: c.id, onClick: function () { setSelId(c.id); setView("places"); }, className: "active:opacity-70 flex flex-col items-center", "data-wk": "dwellpage", "data-part": "r9" },
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
    // ── 走进去看看（v68.71，她 2026-09-15 要的那间能拖着看的屋子）──────────
    // ⚠️零调用：屋里摆的就是这一页上这几块区域里的东西，一件不多一件不少。
    //   点一件弹出来的那两句，也是去处生成时本来就写好的 note 和 thought。
    if (view === "room" && open && window.RoomView) {
      return h(window.RoomView, { place: open, char: char, onBack: function () { setView("place"); } });
    }
    if (view === "place" && open) {
      const zs = (open.zones || []).slice(0, 6);
      return h("div", { className: "h-full flex flex-col relative", style: { color: OVER_INK }, "data-wk": "dwellpage", "data-part": "r10" },
        backdrop(open),
        h("div", { className: "relative flex flex-col h-full" },
          overBar("去处", char ? char.name : ""),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" } },
            placeHero(open, zs),
            // 第一屏的底比底衬暗一档，直接接会拉出一条横线像坏了。这一段顶上补一道压暗，
            // 一百来像素里化开，翻下去是「图糊了」，不是「换了一页」。
            h("div", { className: "px-5", style: { paddingTop: 30, backgroundImage: "linear-gradient(180deg,rgba(5,8,10,.3) 0,rgba(5,8,10,0) 116px)" } },
              // 「走进去」是这一页的头一件事，所以它单独一行、在那两颗上面。
              // ⚠️还没有区域／东西的时候不给：进去是一间空屋子，按了等于没反应
              //（「按了没反应的按钮比没有按钮更糟」）。
              (open.zones || []).some(function (z) { return (z.items || []).length; }) && window.RoomView
                ? h("button", { onClick: function () { setView("room"); }, className: "w-full active:opacity-70",
                    style: { minHeight: 46, borderRadius: 10, marginBottom: 9, background: OVER_INK, color: "#1b2126",
                      fontFamily: F_DISPLAY, fontSize: 14 }, "data-wk": "dwellpagebtn", "data-part": "3" }, "走进去看看") : null,
              h("div", { className: "grid grid-cols-2", style: { gap: 9 } },
                h("button", { onClick: function () { gen(open.fromSched ? open.name : null, open); }, disabled: !!busy || drawing, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 44, borderRadius: 8, background: OVER_INK, color: "#1b2126", fontFamily: F_BODY, fontSize: 12 }, "data-wk": "dwellpagebtn", "data-part": "4" }, busy ? "正在再看一遍…" : "再去看一遍"),
                h("button", { onClick: function () { draw(open); }, disabled: drawing || !!busy, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 44, borderRadius: 8, border: "1px solid " + OVER_LINE, background: OVER_CARD, color: OVER_INK, fontFamily: F_BODY, fontSize: 12 }, "data-wk": "dwellpagebtn", "data-part": "5" }, drawing ? "正在画这儿…" : (open.img ? "重画这儿的样子" : "画一张这儿的样子"))),
              h("button", { onClick: function () { del(open.id); }, className: "w-full active:opacity-60", style: { padding: "14px 0 4px", fontFamily: F_BODY, fontSize: 11, color: "#e0a49c" }, "data-wk": "dwellpagebtn", "data-part": "6" }, "不留这个地方了")))),
        fullShot);
    }

    // ── 某个人的地点列表 ──────────────────────────────────
    const freq = char ? frequentPlaces(char.id, props.schedules, 14) : [];
    const made = new Set(places.map(function (p) { return p.name; }));
    const todo = freq.filter(function (f) { return !made.has(f.name); });
    // 地图上的地方（群友 2026-10-01：「为什么外出只能去对方家里，不能去城市自定义的角落」）：
    //   TA钉在哪个架空世界里，那张图上的地点都能去看看（不调模型，名字现读 x_worlds）；
    //   再留一格「自己写一个地方」——现实城市、图上没有的角落，写个名字就去。
    let mapPlaces = [];
    try {
      const worlds = JSON.parse(localStorage.getItem("x_worlds") || "[]");
      const realm = char && window.MapKit && window.MapKit.charRealm ? window.MapKit.charRealm(char, worlds) : null;
      if (realm && realm.kind === "world") {
        const seen = new Set();
        ((realm.world && realm.world.regions) || []).forEach(function (r) {
          ((r && r.nodes) || []).forEach(function (n) {
            const nm = String((n && n.name) || "").trim();
            if (nm && !seen.has(nm) && !made.has(nm) && !todo.some(function (f) { return f.name === nm; })) { seen.add(nm); mapPlaces.push({ name: nm, region: String((r && r.name) || ""), home: nm === realm.node }); }
          });
        });
      }
    } catch (e) { mapPlaces = []; }
    // 他此刻在哪：照他今天的行程，取最近一段已经开始的那条地点，跟钉着的地方对一对（名字互相包含就算）
    let nowLoc = "", herePin = null;
    try {
      const byDay = ((props.schedules || {})[char && char.id] || {}), keys = Object.keys(byDay).sort();
      const seqs = keys.length ? ((byDay[keys[keys.length - 1]] || {}).seqs || []) : [];
      const d = new Date(), nowM = d.getHours() * 60 + d.getMinutes();
      seqs.forEach(function (r) { const m = /^(\d{1,2}):(\d{2})/.exec(String((r && r.time) || "")); if (m && +m[1] * 60 + +m[2] <= nowM) nowLoc = String(r.location || "").trim(); });
      if (nowLoc) herePin = dates.find(function (x) { return x.name && (nowLoc.indexOf(x.name) >= 0 || x.name.indexOf(nowLoc) >= 0); }) || null;
    } catch (e) {}
    const askPlace = function () {
      requestAppPrompt("去哪儿看看", characterText(char, "写一个地方的名字：店、街角、他常待的某处都行。会照他的样子把那儿写出来。"), "", function (v) {
        const nm = String(v || "").trim().slice(0, 24); if (nm) gen(nm, null);
      }, "去看看");
    };
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { word: "PLACES" }), "data-wk": "dwellpage", "data-part": "r11" },
      topBar(char ? (char.remark || char.name) : "去处", null,
        // 生成的时候要不要顺带出图：她按次付钱，这是第二次调用，所以放在明面上随时能关
        h("button", { onClick: function () { setCfg(saveCfg({ withImg: !cfg.withImg })); }, className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: 11, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap",
            color: cfg.withImg ? t.bg2 : t.sub, background: cfg.withImg ? t.ink : "transparent", border: "1px solid " + (cfg.withImg ? t.ink : t.line) }, "data-wk": "dwellpagebtn", "data-part": "7" },
          cfg.withImg ? "出图 开" : "出图 关")),
      // 看完整经过：就是线下那个往期记录页，原样借来，盖一层在去处上面
      albumRead && albumRead.session && typeof OfflineSessionReader === "function" ? h("div", { style: { position: "fixed", inset: 0, zIndex: 160 } },
        h(OfflineSessionReader, { session: albumRead.session, sessions: albumRead.sessions || [], t: t, profile: props.profile || {},
          char: albumRead.char || (albumRead.group ? null : char), fmtStamp: typeof fmtStamp === "function" ? fmtStamp : function (x) { return new Date(x).toLocaleString(); },
          members: albumRead.group ? (props.characters || []).filter(function (c) { return (albumRead.group.memberIds || []).indexOf(c.id) >= 0; }) : undefined,
          onClose: function () { setAlbumRead(null); } })) : null,
      compose && typeof DateComposeDialog === "function" ? h(DateComposeDialog, { place: compose, who: char ? (char.remark || char.name) : "TA",
        onCancel: function () { setCompose(null); },
        onSend: function (v) { const p = compose; setCompose(null); props.onDate && props.onDate(char, p, v); } }) : null,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        // 我们的城市：她钉的约会地点。点一个：自己去转转（照旧串门，TA不在）／约TA在这儿见（开一场见面）
        h("div", { style: { display: "flex", alignItems: "center", margin: "4px 0 8px" } },
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "我们的城市"),
          h("div", { style: { display: "flex", border: "1px solid " + t.line, borderRadius: 999, overflow: "hidden" } },
            [["draw", "手绘"], ["real", "现实"], ["story", "架空"]].map(function (x) {
              const on = mapKind === x[0];
              return h("button", { key: x[0], onClick: function () { pickMapKind(x[0]); }, className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 11px", minHeight: 28, color: on ? t.bg2 : t.sub, background: on ? t.ink : "transparent" }, "data-wk": "dwellpage", "data-part": "r12", "data-on": on ? "1" : "0" }, x[1]);
            }))),
        (function () {
          const K = window.MapKit;
          if (mapKind === "real" && K && K.MapWidget && char) return h(K.MapWidget, { characters: [char], status: props.mapStatus, userGeo: props.userGeo, worlds: props.worlds, onOpen: props.onOpenMap });
          if (mapKind === "story" && K && K.WorldMapEmbed && char) {
            const r = K.charRealm ? K.charRealm(char, props.worlds || []) : null;
            if (r && r.kind === "world") return h("div", { style: { height: 440, display: "flex", flexDirection: "column", border: "1px solid " + t.line, borderRadius: 12, overflow: "hidden", background: t.bg2 }, "data-wk": "dwellpage", "data-part": "r13" },
              h(K.WorldMapEmbed, { world: r.world, characters: [char], status: props.mapStatus, me: props.profile, ops: props.worldOps }));
            return h("div", { style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "18px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.8, textAlign: "center" }, "data-wk": "dwellpage", "data-part": "r14" },
              characterText(char, "他还没住进哪个架空世界。去「好友地图 · 架空」开一个世界、把他钉进去，这里就能看那张图。"));
          }
          return h(CityMap, { t: t, places: dates, sel: dateSel, onPick: setDateSel, charId: char && char.id, hereId: herePin ? herePin.id : null,
            avatar: char && typeof Avatar === "function" ? h(Avatar, { character: char, size: 22, radius: 11 }) : null });
        })(),
        herePin ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 6 } }, characterText(char, "他这会儿就在「") + herePin.name + "」" + (nowLoc && nowLoc !== herePin.name ? "（" + nowLoc + "）" : "") + "——现在去转转，说不定会碰上") : null,
        dateSel ? h("div", { style: { marginTop: 10, border: "1px solid " + t.line, borderRadius: 12, padding: "12px 13px", background: t.bg2 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, dateSel.name),
          dateSel.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, (dateSel.by ? characterText(char, "他钉的：") : "") + dateSel.note) : null,
          (function () { const vs = DatePlaces.visits(dateSel.name, char && char.id); if (!vs.length) return null; const last = vs[vs.length - 1], d = new Date(last.ts);
            return h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 5, lineHeight: 1.6 }, "data-wk": "dwellpage", "data-part": "r15" }, "★ 一起来过 " + vs.length + " 次 · 上次 " + (d.getMonth() + 1) + "月" + d.getDate() + "日" + (last.line ? "：" + last.line : "")); })(),
          h("div", { className: "grid grid-cols-2", style: { gap: 8, marginTop: 10 } },
            h("button", { onClick: function () {
                const p = dateSel; setDateSel(null);
                // 他正好在那儿：七成会撞上，直接开一场没约的见面；没撞上就照旧自己转转
                if (herePin && herePin.id === p.id && props.onMeet && Math.random() < 0.7) { props.onMeet(char, p); return; }
                gen(p.name, null);
              }, disabled: !!busy, className: "active:opacity-70 disabled:opacity-40",
              style: { minHeight: 42, borderRadius: 10, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13, color: t.ink }, "data-wk": "dwellpagebtn", "data-part": "8" }, "自己去转转"),
            h("button", { onClick: function () { const p = dateSel; setDateSel(null); setCompose(p); }, className: "active:opacity-80",
              style: { minHeight: 42, borderRadius: 10, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 }, "data-wk": "dwellpagebtn", "data-part": "9" }, "约" + (char ? (char.remark || char.name) : "TA") + "在这儿见")),
          h("button", { onClick: function () { const id = dateSel.id; requestAppConfirm("把「" + dateSel.name + "」从地图上拿掉？", "只是拿掉这个钉，去过的记录不动。", function () { setDates(DatePlaces.remove(id, char && char.id)); setDateSel(null); }); },
            className: "w-full active:opacity-60", style: { paddingTop: 10, fontFamily: F_BODY, fontSize: 11, color: t.fog }, "data-wk": "dwellpagebtn", "data-part": "10" }, "拿掉这个钉")) : null,
        h("button", { onClick: function () { setPinPick(function (v) { return !v; }); }, className: "w-full text-left active:opacity-70", style: { marginTop: 10, marginBottom: pinPick ? 8 : 18, border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.sub }, "data-wk": "dwellpagebtn", "data-part": "11" }, pinPick ? "收起" : "＋ 钉一个地方"),
        pinPick ? (function () {
          const pinned = new Set(dates.map(function (x) { return x.name; }));
          const seen = new Set();
          // 旧版大家共用那份里没认出是谁的，排最前面——她点一下就归到这个人名下
          const cands = [].concat(DatePlaces.unclaimed().map(function (p) { return p.name; }), places.map(function (p) { return p.name; }), todo.map(function (f) { return f.name; }), mapPlaces.map(function (m) { return m.name; }))
            .filter(function (n) { n = String(n || "").trim(); if (!n || pinned.has(n) || seen.has(n)) return false; seen.add(n); return true; });
          const writeOwn = function () {
            requestAppPrompt("钉一个地方", "店名或地名：咖啡店、书店、常去的那家面馆……", "", function (v) {
              const nm = String(v || "").trim(); if (!nm) return;
              // 先钉上；再问一句备注（取消也不丢这个钉）
              const list = DatePlaces.add(nm, "", "", char && char.id), id = list[list.length - 1].id; setDates(list);
              setTimeout(function () { requestAppPrompt("这地方怎么样（可空）", "一句就行：在哪儿、什么样、你们为什么去。", "", function (note) {
                const n = String(note || "").trim(); if (!n) return;
                setDates(DatePlaces.save(DatePlaces.list(char && char.id).map(function (x) { return x.id === id ? Object.assign({}, x, { note: n.slice(0, 60) }) : x; }), char && char.id));
              }, "好了"); }, 350);
            }, "下一步");
          };
          return h("div", { style: { marginBottom: 18 }, "data-wk": "dwellpage", "data-part": "r16" },
            cands.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } }, "从下面现成的里挑一个钉上：") : null,
            cands.length ? h("div", { className: "flex flex-wrap", style: { gap: 6 } }, cands.slice(0, 30).map(function (n) {
              return h("button", { key: n, onClick: function () { const u = DatePlaces.unclaimed().find(function (x) { return x.name === n; }); setDates(DatePlaces.add(n, u ? u.note : "", u ? u.by : "", char && char.id)); DatePlaces.dropUnclaimed(n); setPinPick(false); }, className: "active:opacity-70",
                style: { minHeight: 38, padding: "6px 12px", borderRadius: 999, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg2 }, "data-wk": "dwellpage", "data-part": "r17" }, n);
            })) : null,
            h("button", { onClick: function () { setPinPick(false); writeOwn(); }, className: "w-full text-left active:opacity-70",
              style: { marginTop: 10, border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.sub }, "data-wk": "dwellpagebtn", "data-part": "12" }, "自己写一个"));
        })() : null,
        (function () {
          const album = char && props.dateAlbumFor ? props.dateAlbumFor(char.id) : [];
          if (!album.length) return null;
          return h("div", { style: { marginBottom: 22 }, "data-wk": "dwellpage", "data-part": "r18" },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "0 0 8px" } }, "那天 · " + album.length + " 次"),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
              album.map(function (e) { return h(DateAlbumCard, { key: e.key, t: t, e: e, flipped: albumFlip === e.key,
                onFlip: function () { setAlbumFlip(albumFlip === e.key ? null : e.key); }, onRead: setAlbumRead }); })));
        })(),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "0 0 8px" } }, characterText(char, "他的地方")),
        busy ? h(Spinner, { label: "正在看看 " + (char ? char.name : "") + " 的地方…（这一步会调一次模型" + (cfg.withImg ? "，出图再一次" : "") + "）" }) : null,
        !places.length && !busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.fog, padding: "10px 0 18px" } },
          characterText(char, "还没看过他的地方。生成一次会写出几块区域，每块里几件东西。")) : null,
        places.map(function (p) {
          return h("button", { key: p.id, onClick: function () { setOpenId(p.id); setZoneIdx(-1); setView("place"); }, className: "w-full text-left active:opacity-80 mb-2.5",
            style: { border: "1px solid " + t.line, borderRadius: 13, overflow: "hidden", background: t.bg2 }, "data-wk": "dwellpage", "data-part": "r19" },
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
          style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.ink }, "data-wk": "dwellpagebtn", "data-part": "13"
        }, characterText(char, "他住的地方")) : null,
        todo.map(function (f) {
          return h("button", { key: f.name, onClick: function () { gen(f.name, null); }, disabled: !!busy,
            className: "w-full text-left active:opacity-70 mb-2",
            style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8 }, "data-wk": "dwellpage", "data-part": "r20" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, f.name),
            h("span", { style: { flex: 1 } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "行程里去过 " + f.days + " 天"));
        }),
        !todo.length && places.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } },
          "行程里还没攒出常去的地方——同一个地点去过两天以上才会出现在这里。") : null,
        mapPlaces.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 0 8px" } }, "地图上的地方") : null,
        mapPlaces.length ? h("div", { className: "flex flex-wrap", style: { gap: 6 } }, mapPlaces.slice(0, 24).map(function (m) {
          return h("button", { key: m.name, onClick: function () { gen(m.name, null); }, disabled: !!busy, className: "active:opacity-70",
            style: { minHeight: 40, padding: "6px 12px", borderRadius: 999, border: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: "transparent" }, "data-wk": "dwellpage", "data-part": "r21" },
            m.name + (m.home ? " · 他在这儿" : ""));
        })) : null,
        h("button", { onClick: askPlace, disabled: !!busy, className: "w-full text-left active:opacity-70",
          style: { marginTop: 14, border: "1px dashed " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.sub }, "data-wk": "dwellpagebtn", "data-part": "14" }, "＋ 自己写一个地方")));
  }

  window.DwellApp = DwellApp;
  window.Dwell = { genArt: genArt,
    loadAll: loadAll, placesOf: placesOf, savePlace: savePlace, dropPlace: dropPlace,
    frequentPlaces: frequentPlaces, placeSpec: placeSpec, normalize: normalize,
    loadCfg: loadCfg, saveCfg: saveCfg,
    CAP_PLACES: CAP_PLACES
  };
})();
