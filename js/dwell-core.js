// 同居的开机那半（2026-10-18 瘦身第九批，从 js/dwell.js 拆出来）：聊天里约会的地方（DatePlaces）、聊天里TA家的样子（Dwell），这些开机就要。
//   同居整页在 js/dwell.js，点进去才加载（js/lazy-mods.js）。测试会 require 这份，所以递过去的那一包挂在 window，没有 window 时挂 globalThis。
// ============================================================
// 地方（dwell）—— TA住的地方 + TA常去的地方
// 一个地方 = 一句氛围 + 4~5 个【区域】，每个区域里几件东西。
//   · 区域→物品两层，不是一堆孤立的点：一件东西属于哪一块地方，本身就是信息
//   · 常去的地方【不另外生成】：行程每天都在出具体地点，攒几天自然浮出来（零 API）
//   · 数据存 localStorage x_dwell，随云同步
// ============================================================
(function () {
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
  window.Dwell = { genArt: genArt,
    loadAll: loadAll, placesOf: placesOf, savePlace: savePlace, dropPlace: dropPlace,
    frequentPlaces: frequentPlaces, placeSpec: placeSpec, normalize: normalize,
    loadCfg: loadCfg, saveCfg: saveCfg,
    CAP_PLACES: CAP_PLACES
  };

  // 页面那半要用的，原样递过去
  (typeof window !== "undefined" ? window : globalThis).DwellCore = { K, placesOf, DatePlaces, savePlace, dropPlace, frequentPlaces, genArt, loadCfg, saveCfg };
})();
