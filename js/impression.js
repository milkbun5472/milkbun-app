// ============================================================
// 月度印象（impression）—— 每个月，每个角色眼里的「你」长什么样
// 一张剪影 + 三个关键词 + 一句他亲口说的话。按角色收进珍藏册，漏掉的月份可以补。
// 素材=当月和这个角色之间真实发生的事；底子=「Ta 眼里」(x_gaze) 已经攒下的长期印象。
// 剪影不需要锁脸(看不见五官)，所以完全不碰参考照那套，也就不吃合照那些审核麻烦。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect;
  const K = "x_impressions";
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} };
  const uid = () => "im_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 图标：一轮月亮 + 一道侧影
  window.GImpression = p => h(Svg, p,
    h("path", { d: "M12 3a9 9 0 100 18 9 9 0 000-18z" }),
    h("path", { d: "M15.5 20.4c-1.6-1-2.2-2.6-2.2-4.3 0-2.1 1.2-3 1.2-4.6 0-1.5-1.2-2.4-2.6-2.4-1.7 0-2.9 1.2-3.4 2.6" }));

  // ---- 月份工具 ----
  const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const monthLabel = k => { const [y, m] = String(k).split("-"); return y + " 年 " + Number(m) + " 月"; };
  const monthRange = k => {
    const [y, m] = String(k).split("-").map(Number);
    return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() - 1 };
  };
  const prevMonths = n => {
    const out = [], now = new Date();
    for (let i = 0; i < n; i++) out.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1).getTime()));
    return out;
  };

  // ---- 当月素材：单聊 + 单人线下 + 互通群里他说的话 ----
  function monthMaterial(charId, charName, monthKey, uName) {
    const { start, end } = monthRange(monthKey);
    const inWin = ts => ts != null && ts >= start && ts <= end;
    const rows = [];
    const clean = m => {
      if (!m || m.recalled || m.role === "system" || m.kind === "ooc" || m.kind === "silence") return "";
      return String(m.content || "").replace(/\s+/g, " ").trim();
    };
    (JSON.parse(localStorage.getItem("x_chat:" + charId) || "[]") || []).forEach(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : charName, text: t });
    });
    (JSON.parse(localStorage.getItem("x_offline:" + charId) || "[]") || []).forEach(s => ((s && s.msgs) || []).forEach(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : m.role === "narration" ? "【场景】" : charName, text: t });
    }));
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }
  // 他自己说过的话：拿来当声纹样本，quote 才不会写成通用文艺腔
  const ownLines = (rows, charName) => rows.filter(r => r.who === charName && r.text.length >= 6 && r.text.length <= 60)
    .map(r => r.text).slice(-12);
  const toText = (rows, budget) => {
    let s = rows.map(r => r.who + "：" + r.text).join("\n");
    return s.length > budget ? "……（略去较早部分）\n" + s.slice(s.length - budget) : s;
  };

  // ---- 生成 ----
  const TAG_RULE = "三个关键词：每个 2~5 个字，是【他眼里的她此刻是什么样的人】，不是事件流水。"
    + "三个之间要有层次（一个偏气质、一个偏状态、一个偏他自己的私心），别三个同义词堆一起。";

  async function genText(active, char, profile, monthKey, rows, gazeText) {
    const uName = (profile && profile.name) || "她";
    const lines = ownLines(rows, char.name);
    const sys = (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "")
      + (typeof CHARCARD_RULE !== "undefined" ? CHARCARD_RULE + "\n\n" : "")
      + "你就是「" + char.name + "」本人。现在回望这一个月，写下【" + uName + " 在你眼里是什么样子】。\n"
      + "【你的人设】\n" + String(char.persona || char.name).slice(0, 1600)
      + (gazeText ? "\n\n【你心里对 " + uName + " 已有的长期印象（底子，别推翻，只在它上面往前长一点）】\n" + gazeText : "")
      + (lines.length ? "\n\n【你这个月真的说过的话 · 声纹最高优先】\n" + lines.map((x, i) => (i + 1) + ". " + x).join("\n")
        + "\n这些是你的原话，用来校准词汇、句长、口癖、攻击性与礼貌度。下面写的东西必须是同一个人说的，遮住名字也该认得出。" : "")
      + "\n\n【这个月你和 " + uName + " 之间真实发生的事】\n" + (toText(rows, 5200) || "（这个月几乎没有来往。）")
      + "\n\n【要写四样东西】\n"
      + "① title：给这个月的她起一个短称呼（≤8 字），像一句私下的叫法，不是称号也不是标签。\n"
      + "② tags：" + TAG_RULE + "\n"
      + "③ quote：一句到两句，**你亲口说的**、关于她的话。可以文艺、可以有意象，但**必须是你会说的话**——"
      + "别写成通用抒情散文，也别写成人物介绍。用「她」称呼她，不要直呼名字。≤60 字。\n"
      + "④ silhouette：一句【画面描述】，用来画她的剪影。只写：轮廓姿态（侧脸/回头/低头/站着/坐着…）、"
      + "身边有什么意象（月亮、雨、书页、猫、灯、雾…）、以及整体色调冷暖。**不许写五官、不许写表情**——剪影是看不见脸的。"
      + "意象要从这个月真实发生的事里长出来，别凭空堆砌。\n"
      + "\n【输出】只输出 JSON，不要代码块：\n"
      + '{"title":"","tags":["","",""],"quote":"","silhouette":""}';
    const raw = await callAI(active, sys, [{ role: "user", content: "开始写这个月的印象。" }], { maxTokens: 2000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const tags = (Array.isArray(d.tags) ? d.tags : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 3);
    const quote = String(d.quote || "").trim();
    if (!quote || !tags.length) throw new Error("这个月的印象没写全，再试一次");
    return { title: String(d.title || "").trim(), tags, quote, silhouette: String(d.silhouette || "").trim() };
  }

  // 剪影图：艺术插画，不是照片。刻意不给参考照——看不见脸，给了只会让它去画五官。
  async function genArt(desc, profile) {
    const look = String((profile && profile.appearance) || "").slice(0, 120);
    const prompt = "一幅【剪影艺术插画】：画面主体是一个人的纯黑剪影，**完全看不见五官、没有脸部细节**，"
      + "只有轮廓与发丝的形状。水墨与水彩晕染的质感，大量留白，像杂志内页的一幅意象插画。\n"
      + "【画面】" + (desc || "一个人的侧影，身后是一轮月亮，冷色调。") + "\n"
      + (look ? "【轮廓参考·只取发型长度与身形，不画五官】" + look + "\n" : "")
      + "【硬性要求】不出现文字、不出现边框、不画成头像或证件照；构图竖幅；整体安静、克制、有留白；"
      + "画面必须是可公开展示的：衣着完整，不露骨。";
    const out = await generateSelfieImage(prompt, null);
    if (!out || !out.blob) throw new Error("剪影没出来");
    const durl = await blobToDataUrl(out.blob);
    return typeof imgToVault === "function" ? await imgToVault(durl) : durl;
  }

  window.Impression = { load, save, monthKeyOf, monthLabel, monthRange, prevMonths, monthMaterial, genText, genArt, uid };
})();

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
    const [busy, setBusy] = useState("");
    const put = fn => setBook(p => { const n = fn(p); M.save(n); return n; });
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
    const listOf = id => (book[id] || []).slice().sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));

    const S = {
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg },
      btn: on => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.accent : t.line), background: on ? t.accent : "transparent", color: on ? "#fff" : t.ink, fontFamily: F_BODY, fontSize: 12 })
    };
    const header = (title, right) => h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + t.line } },
      h("button", { onClick: back, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
      h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, title), right || null);
    function back() {
      if (cardId) return setCardId(null);
      if (curChar) return setCurChar(null);
      props.onBack();
    }

    // ---- 生成一个月 ----
    async function make(charId, monthKey, opts) {
      const char = (props.characters || []).find(c => c.id === charId);
      if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const rows = M.monthMaterial(charId, char.name, monthKey, uName);
      if (rows.length < 6) { if (!(opts && opts.quiet)) props.toast(M.monthLabel(monthKey) + " 几乎没有来往，写不出印象"); return false; }
      setBusy(charId + monthKey);
      try {
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        const d = await M.genText(props.active, char, props.profile, monthKey, rows, gazeText);
        let img = null;
        // 图出不来不算失败：字才是主体，剪影可以之后单独补
        try { if (typeof imgApiReady === "function" && imgApiReady()) img = await M.genArt(d.silhouette, props.profile); }
        catch (e) { props.toast("字写好了，剪影没出来：" + (e.message || "稍后可单独重出")); }
        const entry = { id: M.uid(), monthKey, title: d.title, tags: d.tags, quote: d.quote, silhouette: d.silhouette, img, ts: Date.now() };
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
        const img = await M.genArt(entry.silhouette, props.profile);
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id ? Object.assign({}, x, { img }) : x) }));
      } catch (e) { props.toast("剪影没出来：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 补齐：最近 12 个月里有素材、却还没写过的，一月一月补（失败即停，已写好的都留着）
    async function backfill(charId) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      const have = new Set((book[charId] || []).map(x => x.monthKey));
      const want = M.prevMonths(12).filter(k => !have.has(k))
        .filter(k => M.monthMaterial(charId, char.name, k, uName).length >= 6);
      if (!want.length) return props.toast("最近一年没有漏掉的");
      if (!confirm("补齐 " + want.length + " 个月？会一个月一个月写，中途失败前面的都保留。")) return;
      want.reverse();
      let done = 0;
      for (const k of want) {
        const ok = await make(charId, k, { quiet: true });
        if (!ok) { props.toast("补到 " + M.monthLabel(k) + " 时停下了，已写好 " + done + " 个"); return; }
        done++; props.toast("已补 " + done + "/" + want.length, 1200);
      }
      props.toast("补齐了 " + done + " 个月");
    }

    // ---- 单张卡片 ----
    if (cardId && curChar) {
      const e = listOf(curChar).find(x => x.id === cardId);
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      if (!e) { setCardId(null); return null; }
      return h("div", { style: S.wrap }, header(M.monthLabel(e.monthKey)),
        h("div", { style: { flex: 1, overflowY: "auto", padding: "18px 18px 40px" } },
          h("div", { style: { borderRadius: 16, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,.10)" } },
            h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4", background: t.bg } },
              e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: 20 } }, "还没有剪影"),
              // 三个关键词浮在图上，像原图那样错落挂着
              h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
                (e.tags || []).slice(0, 3).map((tag, i) => h("div", {
                  key: i,
                  style: { position: "absolute", top: [18, 46, 74][i] + "%", [i === 1 ? "left" : "right"]: "6%",
                    background: "rgba(28,25,22,.72)", color: "#f3ece0", padding: "5px 12px", borderRadius: 999,
                    fontFamily: F_BODY, fontSize: 12.5, letterSpacing: ".04em", backdropFilter: "blur(2px)" } }, tag)))),
            h("div", { style: { padding: "18px 18px 22px" } },
              e.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, textAlign: "center", marginBottom: 12 } }, "{ " + e.title + " }") : null,
              h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15, lineHeight: 2, color: t.ink, textAlign: "center" } }, "“" + e.quote + "”"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, textAlign: "right", marginTop: 14 } }, "—— " + (c.name || "TA") + " 眼里的 " + uName))),
          h("div", { style: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" } },
            e.img ? h("button", { onClick: () => saveToAlbum(e.img), style: S.btn(false) }, "保存到相册") : null,
            h("button", { onClick: () => redrawArt(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在画…" : (e.img ? "重出剪影" : "补一张剪影")),
            h("button", { onClick: () => { if (!confirm("删掉这个月的印象？")) return; put(p => Object.assign({}, p, { [curChar]: (p[curChar] || []).filter(x => x.id !== e.id) })); setCardId(null); }, style: Object.assign({}, S.btn(false), { color: "#a4442e" }) }, "删除"))));
    }

    // ---- 某个角色的珍藏册 ----
    if (curChar) {
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      const mine = listOf(curChar);
      const thisMonth = M.monthKeyOf(Date.now());
      const hasThis = mine.some(x => x.monthKey === thisMonth);
      return h("div", { style: S.wrap },
        header((c.name || "?") + " 眼里的 " + uName,
          h("button", { onClick: () => backfill(curChar), disabled: !!busy, style: S.btn(false) }, "补齐")),
        h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 34px" } },
          h("button", { onClick: () => make(curChar, thisMonth), disabled: !!busy,
            style: { width: "100%", padding: "12px 0", borderRadius: 14, border: "1px dashed " + t.line, background: "transparent", color: t.ink, fontFamily: F_BODY, fontSize: 13, marginBottom: 14 } },
            busy ? "在写…" : (hasThis ? "重写本月印象" : "写本月的印象")),
          mine.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } },
            mine.map(e => h("div", { key: e.id, onClick: () => setCardId(e.id), style: { width: "calc((100% - 10px) / 2)" } },
              h("div", { style: { width: "100%", aspectRatio: "3 / 4", borderRadius: 12, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, position: "relative" } },
                e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : null,
                h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 10px 8px", background: "linear-gradient(transparent, rgba(20,18,16,.78))", color: "#f3ece0", fontFamily: F_BODY, fontSize: 11 } },
                  (e.tags || []).slice(0, 2).join(" · "))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 5 } }, M.monthLabel(e.monthKey)),
              e.title ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.title) : null)))
            : h("div", { style: { textAlign: "center", marginTop: 60, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有印象。", h("br"), "写一个月看看，或者点右上角补齐。")));
    }

    // ---- 头像墙 ----
    return h("div", { style: S.wrap }, header("月度印象"),
      h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 34px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
          "每个月，每个人眼里的你长得都不一样。一张剪影、三个词、一句他亲口说的话。"),
        (props.characters || []).length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } },
          (props.characters || []).map(c => {
            const n = (book[c.id] || []).length;
            const cover = listOf(c.id).find(x => x.img);
            return h("div", { key: c.id, onClick: () => setCurChar(c.id), style: { width: "calc((100% - 20px) / 3)", textAlign: "center" } },
              h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line } },
                cover ? h("img", { src: imgSrc(cover.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .5 } }) : null,
                h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
                  avatarOf(c, 48))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, n ? n + " 个月" : "还没有"));
          }))
          : h("div", { style: { textAlign: "center", marginTop: 70, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有角色。")));
  }
  window.ImpressionApp = ImpressionApp;
})();
