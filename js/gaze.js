// ============================================================
// Ta 眼里(gaze)—— 角色对用户与关系的长期印象卡
// 十块:关于我 5 + 关于我们 5;角色亲笔、锚具体事例、慢演进。
// 更新走聊天协议按需字段 impression(单聊+群聊),无独立调用、无定时器;
// 冷启动由状态卡页的一次性建卡完成。只读;言秋(engineerEyes)排除。
// 注入 buildBundle 常驻影响态度;「假装没注意的事」框架为回避形状,防话题磁吸。
// 数据存 x_gaze(跟随 x_ 前缀云同步),每次修订自动留旧版快照。
// ============================================================
(function () {
  const useState = React.useState;
  const ME = [["person", "她是个什么样的人"], ["soft", "她的软肋和雷区"], ["like", "我吃她哪一套·头疼哪一套"], ["recent", "最近的她"], ["unread", "我还没看懂的部分"]];
  const US = [["what", "我们现在算什么"], ["how", "我们的相处方式"], ["marks", "走到这里的几个节点"], ["elephant", "我假装没注意的事"], ["want", "我担心的·我想要的"]];
  const KEYS = {}; ME.forEach(([k, n]) => KEYS["me." + k] = n); US.forEach(([k, n]) => KEYS["us." + k] = n);
  const load = () => { try { return JSON.parse(localStorage.getItem("x_gaze") || "{}"); } catch (e) { return {}; } };
  const persist = d => { try { localStorage.setItem("x_gaze", JSON.stringify(d)); } catch (e) {} };
  const boxOf = (d, charId) => d[charId] || { blocks: {}, hist: [], seeded: false };
  // 应用一次修订(协议字段或建卡):校验块名、留旧版快照、盖新内容
  function apply(charId, side, block, text) {
    const k = side + "." + block;
    if (!KEYS[k]) return false;
    const t = String(text || "").trim().slice(0, 400);
    if (!t) return false;
    const d = load(); const box = boxOf(d, charId);
    const old = box.blocks[k];
    if (old && old.text === t) return false;
    if (old && old.text) box.hist = [{ k, old: old.text, ts: old.ts || Date.now() }, ...(box.hist || [])].slice(0, 120);
    box.blocks[k] = { text: t, ts: Date.now() };
    d[charId] = box; persist(d);
    return true;
  }
  // 协议里塞回的 impression 字段(单聊/群聊共用解析)
  function applyParsed(charId, imp) {
    if (!imp || typeof imp !== "object") return false;
    return apply(charId, String(imp.side || ""), String(imp.block || ""), imp.text);
  }
  // 常驻注入文本(空卡=零注入)
  function text(charId, uName) {
    const box = boxOf(load(), charId);
    const rows = Object.entries(KEYS).map(([k, name]) => box.blocks[k] && box.blocks[k].text ? "·" + name + ":" + box.blocks[k].text : null).filter(Boolean);
    if (!rows.length) return "";
    return "【你眼里的 " + uName + " 与你们(你私下沉淀的长期认知)】\n" + rows.join("\n") +
      "\n这些是你自己心里的东西:自然渗进语气、分寸和相处方式,绝不当台词复述或逐条印证。尤其「假装没注意的事」——它存在的方式就是你【绕着它走】,绝不主动把话题引向它,只在被真正踩到时才露出一点反应。";
  }
  // 聊天协议按需字段说明(单聊/群聊共用)
  function spec(uName) {
    return "impression: {\"side\":\"me|us\",\"block\":\"块名\",\"text\":\"整块重写后的内容\"},仅当本轮发生的事【真正改变了你对 " + uName + " 或你们关系的某一块长期认知】时填写;一轮至多一块,绝大多数轮次省略。side=me 的块名:person(她是个什么样的人)/soft(软肋和雷区)/like(吃哪套·头疼哪套)/recent(最近的她)/unread(还没看懂的);side=us:what(我们算什么)/how(相处方式)/marks(节点)/elephant(我假装没注意的事,至多两件)/want(担心的·想要的)。text≤80字,第一人称亲笔、锚在真实发生的事上;在旧内容基础上小幅演进,绝不因单日情绪整块翻转。";
  }
  // 一次性建卡的生成指令(app 侧拼上下文调用后把 JSON 喂回 seed)
  function seedSpec(uName) {
    return "以角色本人的第一人称,把你对 " + uName + " 和你们关系的长期认知写成印象卡 JSON。每块≤80字,亲笔口吻、锚在真实发生过的事上;不了解、没想过的块填 null,绝不编造。禁止分析报告腔(「综合来看」「是一个…的人」),要像你私下写给自己的碎句。只输出 JSON:{\"me\":{\"person\":\"…\",\"soft\":null,\"like\":null,\"recent\":null,\"unread\":null},\"us\":{\"what\":null,\"how\":null,\"marks\":null,\"elephant\":null,\"want\":null}}";
  }
  function seed(charId, data) {
    let n = 0;
    ["me", "us"].forEach(side => { const g = data && data[side]; if (g) Object.keys(g).forEach(b => { if (g[b] && apply(charId, side, b, g[b])) n++; }); });
    const d = load(); const box = boxOf(d, charId); box.seeded = true; d[charId] = box; persist(d);
    return n;
  }
  const hasAny = charId => Object.keys(boxOf(load(), charId).blocks).length > 0;

  // ---- 信纸页面(嵌在状态卡里,参考 2026-08-17 Lisa 给的拍立得信纸样张) ----
  const EN = { "me.person": "WHO SHE IS", "me.soft": "SOFT SPOTS", "me.like": "WEAKNESS FOR", "me.recent": "THESE DAYS", "me.unread": "STILL UNREAD", "us.what": "WHAT WE ARE", "us.how": "OUR WAYS", "us.marks": "MILESTONES", "us.elephant": "UNSPOKEN", "us.want": "HOPES & FEARS" };
  const PAPER = "#fbf5ea", INKSOFT = "#5c5244", GOLD = "#ac8a5b", BLUSH = "#e8c9bd";
  const tape = extra => h("div", { style: Object.assign({ position: "absolute", top: -9, left: "50%", width: 52, height: 18, marginLeft: -26, background: "rgba(240,231,214,.8)", boxShadow: "0 1px 3px rgba(0,0,0,.10)", transform: "rotate(-2deg)", borderLeft: "1px dashed rgba(0,0,0,.06)", borderRight: "1px dashed rgba(0,0,0,.06)" }, extra || {}) });
  function GazePage({ charId, charName, uName, onSeed, seedBusy }) {
    const [side, setSide] = useState("me");
    const [openK, setOpenK] = useState(null); // 展开成信纸的块 key
    const box = boxOf(load(), charId);
    const defs = side === "me" ? ME : US;
    // Sheet 容器带 transform,fixed 会锚到 Sheet 而非屏幕 → 信纸必须 portal 到 body 才能居中
    const full = openK && ReactDOM.createPortal(
      h("div", { onClick: () => setOpenK(null), style: { position: "fixed", inset: 0, zIndex: 260, background: "rgba(43,38,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", maxHeight: "74vh", overflowY: "auto", width: "100%", maxWidth: 400, backgroundColor: PAPER, backgroundImage: "repeating-linear-gradient(transparent, transparent 29px, rgba(120,100,70,.07) 29px, rgba(120,100,70,.07) 30px), linear-gradient(" + PAPER + "," + PAPER + " 60%, #f7efdf)", borderRadius: 4, padding: "34px 26px 24px", boxShadow: "0 22px 60px rgba(0,0,0,.32)" } },
          tape(),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 4, color: GOLD, marginBottom: 4 } }, EN[openK] || ""),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: INKSOFT, marginBottom: 16, letterSpacing: 2 } }, KEYS[openK]),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, lineHeight: "30px", whiteSpace: "pre-wrap" } }, (box.blocks[openK] || {}).text || "他还没往这想过。"),
          box.blocks[openK] && h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: GOLD, marginTop: 18, textAlign: "right" } }, "—— 写于 " + new Date(box.blocks[openK].ts).toLocaleDateString("zh-CN")),
          (box.hist || []).filter(x => x.k === openK).length ? h("div", { style: { marginTop: 20, borderTop: "1px dashed rgba(120,100,70,.25)", paddingTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 3, color: GOLD, marginBottom: 8 } }, "他从前是这么想的"),
            box.hist.filter(x => x.k === openK).slice(0, 6).map((x, i) => h("div", { key: i, style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: "rgba(92,82,68,.62)", lineHeight: 2, marginBottom: 10 } }, x.old, h("div", { style: { fontFamily: F_BODY, color: GOLD, fontSize: 9, opacity: .8 } }, new Date(x.ts).toLocaleDateString("zh-CN"))))) : null)),
      document.body);
    return h("div", { style: { margin: "-4px -6px 0", padding: "18px 14px 26px", borderRadius: 18, background: "linear-gradient(168deg, #f8f2e6, #f6ecdf 46%, #f2e2d6 78%, " + BLUSH + "40)" } },
      h("div", { style: { textAlign: "right", padding: "2px 6px 14px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, letterSpacing: 6, color: GOLD, textShadow: "0 1px 0 rgba(255,255,255,.6)" } }, side === "me" ? "关于我" : "关于我们"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 5, color: "rgba(172,138,91,.55)", marginTop: 3 } }, side === "me" ? "SHE, THROUGH HIS EYES" : "LOVE IS ALL YOU NEED")),
      h("div", { style: { display: "flex", gap: 10, marginBottom: 16 } },
        [["me", "关于我"], ["us", "关于我们"]].map(([k, label]) => h("button", { key: k, onClick: () => setSide(k), style: { flex: 1, padding: "8px 0", fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 3, borderRadius: 999, border: "1px solid " + (side === k ? GOLD : "rgba(172,138,91,.35)"), color: side === k ? "#fff" : GOLD, background: side === k ? GOLD : "rgba(255,255,255,.45)" } }, label))),
      !hasAny(charId) ? h("div", { style: { textAlign: "center", padding: "30px 10px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: INKSOFT, lineHeight: 2.2, marginBottom: 16 } }, "这里还是空的。", h("br"), "让 " + charName + " 第一次把心里的这些写下来?"),
        onSeed ? h("button", { onClick: onSeed, disabled: seedBusy, style: { padding: "10px 26px", borderRadius: 999, fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 2, border: "none", background: GOLD, color: "#fff", boxShadow: "0 4px 14px rgba(172,138,91,.4)" } }, seedBusy ? "他在想…" : "让他写写看") : null) : null,
      defs.map(([k, name], i) => { const fk = side + "." + k; const b = box.blocks[fk];
        return h("div", { key: fk, onClick: () => setOpenK(fk), style: { position: "relative", background: "#fffdf8", borderRadius: 3, padding: "16px 15px 13px", margin: (i ? "18px" : "10px") + " " + (i % 2 ? "4px 0 0 14px" : "14px 0 0 4px"), cursor: "pointer", transform: "rotate(" + (i % 2 ? 0.9 : -0.9) + "deg)", boxShadow: "0 5px 16px rgba(96,78,52,.13)" } },
          tape({ transform: "rotate(" + (i % 2 ? 2 : -2) + "deg)" }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 3.5, color: GOLD, marginBottom: 3 } }, EN[fk] || ""),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, letterSpacing: 1.5, marginBottom: 6 } }, name),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: b ? "rgba(92,82,68,.85)" : "rgba(92,82,68,.4)", lineHeight: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } }, b ? b.text : "他还没往这想过。"),
          b ? h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 2, color: "rgba(172,138,91,.6)", marginTop: 6, textAlign: "right" } }, "展开信纸 ›") : null); }),
      full);
  }
  window.Gaze = { ME, US, KEYS, apply, applyParsed, text, spec, seedSpec, seed, hasAny };
  window.GazePage = GazePage;
})();
