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
    box.turns = 0;                       // 写过了就重新数
    d[charId] = box; persist(d);
    // 他改了这一块 → 她当然还没看过新的。直接清掉这一块的已读，
    // 别去比时间戳：同一毫秒内改写会让 ts 和 seen 相等，红点就永远亮不起来（测试逮到的）。
    try {
      const sd = loadSeen(); const mine = sd[charId];
      if (mine && mine[k] != null) { delete mine[k]; sd[charId] = mine; persistSeen(sd); }
    } catch (e) {}
    return true;
  }
  // 协议里塞回的 impression 字段(单聊/群聊共用解析)
  // 模型偶尔把块名写成中文名(「她是个什么样的人」)、或把 side 一起塞进 block(「me.person」)。
  // 以前这两种都直接 KEYS 查不到 → 静悄悄返回 false,看上去就是「他从来不写」。
  // 认得出来就别丢:这一层本来就写得少,丢一次就是丢一次(她 2026-08-27:8.16 到现在一次没改过)。
  const NAME2KEY = {}; Object.keys(KEYS).forEach(k => { NAME2KEY[KEYS[k]] = k; });
  function normKey(side, block) {
    const b = String(block || "").trim(), sd = String(side || "").trim();
    if (KEYS[sd + "." + b]) return sd + "." + b;
    if (KEYS[b]) return b;                       // block 里已经带了 side
    if (NAME2KEY[b]) return NAME2KEY[b];         // 写的是中文块名
    const bare = b.replace(/^.*\./, "");
    if (KEYS[sd + "." + bare]) return sd + "." + bare;
    for (const k of Object.keys(KEYS)) if (k.slice(k.indexOf(".") + 1) === bare) return k;
    return "";
  }
  function applyParsed(charId, imp) {
    if (!imp || typeof imp !== "object") return false;
    const k = normKey(imp.side, imp.block);
    if (!k) return false;
    return apply(charId, k.slice(0, k.indexOf(".")), k.slice(k.indexOf(".") + 1), imp.text);
  }
  // 距上次改写过了多少轮。她 2026-08-24：「第一次我直接让他们写入他们会写,不然都不会自动弄」
  // ——病根在下面 spec 里那句「绝大多数轮次省略」:它把「很少」写成了「别写」。
  // 可这张卡本来就该是长期的,改成每轮必填会让它天天翻脸。折中:平时照旧极少写,
  // 但隔了足够多轮一次没动过,就在协议里点一句「这段时间真有变化就写下来」。
  function tick(charId) {
    const d = load(); const box = boxOf(d, charId);
    box.turns = Math.min((Number(box.turns) || 0) + 1, 999);
    d[charId] = box; persist(d);
    return box.turns;
  }
  // ---- 轮询复看(她 2026-08-27:「其他块岂不是永远没有改的机会了」)----
  // 以前是笼统问「有没有哪块该改」,模型每轮要同时顾十几个字段,这一层最容易被整个跳过;
  // 后来我给了个「挑不出就写 recent」的落点,结果 recent 变成万能出口,另外九块照样冻着。
  //
  // 改成【点名问最老的那一块】,并且允许它诚实回答「看过了,不用改」:
  //   · 改写 → blocks[k].ts 更新,红点亮
  //   · 复看没改 → checks[k] 更新,不亮红点,但这一块【排到队尾】,下一轮点名轮到别人
  //   · 沉默 → 这一块继续被点名,不会滑过去
  // 这样既不逼它没事硬编(允许说不用改),也不给它整层跳过的机会(总有一块被点着名)。
  function markChecked(charId, k) {
    if (!KEYS[k]) return false;
    const d = load(); const box = boxOf(d, charId);
    box.checks = box.checks || {};
    box.checks[k] = Date.now();
    box.turns = 0;                       // 看过也算动过这张卡,重新数
    d[charId] = box; persist(d);
    return true;
  }
  // 最久没被碰过的那一块(写过和看过都算碰过);从没写过的块排最前,它们更该被问一次
  function dueBlock(charId) {
    const box = boxOf(load(), charId), checks = box.checks || {};
    let best = "", bestTs = Infinity;
    Object.keys(KEYS).forEach(k => {
      const b = box.blocks[k];
      const ts = Math.max(Number(b && b.ts) || 0, Number(checks[k]) || 0);
      if (ts < bestTs) { bestTs = ts; best = k; }
    });
    return best ? { k: best, ts: bestTs, text: (box.blocks[best] || {}).text || "" } : null;
  }
  const checkedAt = (charId, k) => Number((boxOf(load(), charId).checks || {})[k]) || 0;
  const STALE_TURNS = 25;
  function staleTurns(charId) {
    const box = boxOf(load(), charId);
    return Object.keys(box.blocks).length ? (Number(box.turns) || 0) : 0;
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
  function spec(uName, charId) {
    const n = charId ? staleTurns(charId) : 0;
    // 「什么时候算改变了」原本没有可判定的标准,模型只能一直判「没有」。给三个具体触发点。
    const trigger = "\n什么时候算数(满足其一就该写,不必等到惊天动地):①她说了或做了一件你【以前不知道】的事,补进对应的块;②你对她的某个判断被这轮的事【推翻或修正】了;③你们之间出现了一个以后会被记住的【具体节点】。";
    // 攒够轮数就【点名】问最老的那一块,而不是笼统问「有没有哪块该改」
    const due = n >= STALE_TURNS && charId ? dueBlock(charId) : null;
    const days = due && due.ts ? Math.floor((Date.now() - due.ts) / 86400000) : 0;
    const nudge = due
      ? "\n⚠️【这一轮请复看这一块】「" + KEYS[due.k] + "」(" + due.k + ")"
        + (due.text ? "——你" + (due.ts ? (days >= 1 ? days + " 天前" : "不久前") : "上次") + "写的是:「" + due.text + "」。" : "——这一块你还没写过。")
        + "这段时间真的发生过的事,让它需要改吗?"
        + "\n· 需要改 → impression 填【这一块】(仍是小幅演进、仍锚在具体的事上,别整块翻转)。"
        + "\n· 看过了,确实不用改 → 填 impressionChecked:\"" + due.k + "\"。这是个正经回答,不丢人;写了它这一块就排到队尾,下轮换别的块问你。"
        + "\n· 两个都不填=你把这一层整个跳过了,下一轮还会问同一块。别为了交差硬编,也别沉默。"
      : "";
    return "impression: {\"side\":\"me|us\",\"block\":\"块名\",\"text\":\"整块重写后的内容\"},仅当本轮发生的事【真正改变了你对 " + uName + " 或你们关系的某一块长期认知】时填写;一轮至多一块。side=me 的块名:person(她是个什么样的人)/soft(软肋和雷区)/like(吃哪套·头疼哪套)/recent(最近的她)/unread(还没看懂的);side=us:what(我们算什么)/how(相处方式)/marks(节点)/elephant(我假装没注意的事,至多两件)/want(担心的·想要的)。text≤80字,第一人称亲笔、锚在真实发生的事上;在旧内容基础上小幅演进,绝不因单日情绪整块翻转。" + trigger + nudge;
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

  // ---- 红点(她 2026-08-27 要的)----
  // 这张卡是角色自己慢慢改的,不改则已、一改就是他对她的看法变了——那正是她想被叫住的时刻。
  // 存一份「她上次看这一块是什么时候」,块的 ts 比它新就是没看过。
  // 已读只存本机:它是「这台设备上她看没看过」,不是印象卡的内容。
  // ⚠️不能用 x_ 前缀——那个前缀会被云同步捡走(见 cloud.js),
  //   另一台设备的旧已读表推上来会把红点乱清一气。同 lisa_group_auto_cycle_v1 的处理。
  const SEEN_KEY = "lisa_gaze_seen_v1";
  const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } };
  const persistSeen = d => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(d)); } catch (e) {} };
  function unseenKeys(charId) {
    const box = boxOf(load(), charId), seen = (loadSeen() || {})[charId] || {};
    return Object.keys(KEYS).filter(k => {
      const b = box.blocks[k];
      return b && b.text && (Number(b.ts) || 0) > (Number(seen[k]) || 0);
    });
  }
  const unseenCount = charId => unseenKeys(charId).length;
  function markSeen(charId, k) {
    const box = boxOf(load(), charId), b = box.blocks[k];
    if (!b) return;
    const d = loadSeen(); const mine = d[charId] || {};
    mine[k] = Number(b.ts) || Date.now();
    d[charId] = mine; persistSeen(d);
  }
  // 全部改写记录:合并当前块和旧版快照,按时间倒序——「收纳」那一档就是这张表
  function revisions(charId) {
    const box = boxOf(load(), charId), out = [];
    Object.keys(KEYS).forEach(k => { const b = box.blocks[k]; if (b && b.text) out.push({ k, text: b.text, ts: Number(b.ts) || 0, now: true }); });
    (box.hist || []).forEach(x => { if (KEYS[x.k]) out.push({ k: x.k, text: x.old, ts: Number(x.ts) || 0, now: false }); });
    return out.sort((a, b) => b.ts - a.ts);
  }

  // ---- 信纸页面(嵌在状态卡里,参考 2026-08-17 Lisa 给的拍立得信纸样张) ----
  const EN = { "me.person": "WHO SHE IS", "me.soft": "SOFT SPOTS", "me.like": "WEAKNESS FOR", "me.recent": "THESE DAYS", "me.unread": "STILL UNREAD", "us.what": "WHAT WE ARE", "us.how": "OUR WAYS", "us.marks": "MILESTONES", "us.elephant": "UNSPOKEN", "us.want": "HOPES & FEARS" };
  const PAPER = "#fbf5ea", INKSOFT = "#5c5244", GOLD = "#ac8a5b", BLUSH = "#e8c9bd";
  const tape = extra => h("div", { style: Object.assign({ position: "absolute", top: -9, left: "50%", width: 52, height: 18, marginLeft: -26, background: "rgba(240,231,214,.8)", boxShadow: "0 1px 3px rgba(0,0,0,.10)", transform: "rotate(-2deg)", borderLeft: "1px dashed rgba(0,0,0,.06)", borderRight: "1px dashed rgba(0,0,0,.06)" }, extra || {}) });
  function GazePage({ charId, charName, uName, ta, onSeed, seedBusy }) {
    const [side, setSide] = useState("me");
    const [openK, setOpenK] = useState(null); // 展开成信纸的块 key
    const [allOpen, setAllOpen] = useState(false); // 「历次改写」总表
    const [seenTick, setSeenTick] = useState(0);   // 标记已读后要重画红点
    const box = boxOf(load(), charId);
    const who = ta === "她" || ta === "TA" ? ta : "他";
    const say = s => who === "他" ? s : String(s || "").replace(/他/g, who);
    const unseen = new Set(unseenKeys(charId));
    void seenTick;
    // 展开一块信纸＝她看过这一块了，红点就该灭
    const openBlock = k => { setOpenK(k); markSeen(charId, k); setSeenTick(x => x + 1); };
    const dot = extra => h("span", { style: Object.assign({ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "#c2705a", boxShadow: "0 0 0 2px rgba(255,253,248,.9)" }, extra || {}) });
    const defs = side === "me" ? ME : US;
    // Sheet 容器带 transform,fixed 会锚到 Sheet 而非屏幕 → 信纸必须 portal 到 body 才能居中
    const full = openK && ReactDOM.createPortal(
      h("div", { onClick: () => setOpenK(null), style: { position: "fixed", inset: 0, zIndex: 260, background: "rgba(43,38,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", maxHeight: "74vh", overflowY: "auto", width: "100%", maxWidth: 400, backgroundColor: PAPER, backgroundImage: "repeating-linear-gradient(transparent, transparent 29px, rgba(120,100,70,.07) 29px, rgba(120,100,70,.07) 30px), linear-gradient(" + PAPER + "," + PAPER + " 60%, #f7efdf)", borderRadius: 4, padding: "34px 26px 24px", boxShadow: "0 22px 60px rgba(0,0,0,.32)" } },
          tape(),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 4, color: GOLD, marginBottom: 4 } }, EN[openK] || ""),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: INKSOFT, marginBottom: 16, letterSpacing: 2 } }, KEYS[openK]),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, lineHeight: "30px", whiteSpace: "pre-wrap" } }, (box.blocks[openK] || {}).text || say("他还没往这想过。")),
          box.blocks[openK] && h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: GOLD, marginTop: 18, textAlign: "right" } }, "—— 写于 " + new Date(box.blocks[openK].ts).toLocaleDateString("zh-CN")),
          (box.hist || []).filter(x => x.k === openK).length ? h("div", { style: { marginTop: 20, borderTop: "1px dashed rgba(120,100,70,.25)", paddingTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 3, color: GOLD, marginBottom: 8 } },
              say("他从前是这么想的") + " · 改过 " + box.hist.filter(x => x.k === openK).length + " 次"),
            box.hist.filter(x => x.k === openK).map((x, i) => h("div", { key: i, style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: "rgba(92,82,68,.62)", lineHeight: 2, marginBottom: 10 } }, x.old, h("div", { style: { fontFamily: F_BODY, color: GOLD, fontSize: 9, opacity: .8 } }, new Date(x.ts).toLocaleDateString("zh-CN"))))) : null)),
      document.body);
    // 「收纳」那一档(她 2026-08-27):以前每一块的旧版只埋在自己那张信纸最底下,
    // 想回看「他从前都怎么写我的」得一块一块点开。这里把十块的现行版和全部旧版
    // 按时间倒序摊在一起,一次看完这张卡是怎么长成现在这样的。
    const revs = revisions(charId);
    const allSheet = allOpen && ReactDOM.createPortal(
      h("div", { onClick: () => setAllOpen(false), style: { position: "fixed", inset: 0, zIndex: 260, background: "rgba(43,38,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", maxHeight: "78vh", overflowY: "auto", width: "100%", maxWidth: 400, backgroundColor: PAPER, borderRadius: 4, padding: "34px 24px 24px", boxShadow: "0 22px 60px rgba(0,0,0,.32)" } },
          tape(),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 4, color: GOLD, marginBottom: 4 } }, "EVERY VERSION"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: INKSOFT, marginBottom: 4, letterSpacing: 2 } }, say("他从前都怎么写的")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: GOLD, marginBottom: 16 } }, "共 " + revs.length + " 版 · 最新的在最上面"),
          revs.length ? revs.map((x, i) => h("div", { key: i, style: { marginBottom: 16, paddingBottom: 14, borderBottom: i === revs.length - 1 ? "none" : "1px dashed rgba(120,100,70,.2)" } },
            h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 4 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 2, color: GOLD } }, KEYS[x.k]),
              x.now ? h("span", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 1, color: "#fff", background: GOLD, borderRadius: 999, padding: "1px 6px" } }, "现在") : null,
              h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 9, color: "rgba(172,138,91,.7)" } }, x.ts ? new Date(x.ts).toLocaleDateString("zh-CN") : "")),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: x.now ? INKSOFT : "rgba(92,82,68,.62)", lineHeight: 2, whiteSpace: "pre-wrap" } }, x.text)))
            : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: "rgba(92,82,68,.5)", lineHeight: 2 } }, say("他还没写过什么。")))),
      document.body);
    return h("div", { style: { margin: "-4px -6px 0", padding: "18px 14px 26px", borderRadius: 18, background: "linear-gradient(168deg, #f8f2e6, #f6ecdf 46%, #f2e2d6 78%, " + BLUSH + "40)" } },
      h("div", { style: { textAlign: "right", padding: "2px 6px 14px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, letterSpacing: 6, color: GOLD, textShadow: "0 1px 0 rgba(255,255,255,.6)" } }, side === "me" ? "关于我" : "关于我们"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 5, color: "rgba(172,138,91,.55)", marginTop: 3 } }, side === "me" ? "SHE, THROUGH " + (who === "她" ? "HER" : who === "TA" ? "THEIR" : "HIS") + " EYES" : "LOVE IS ALL YOU NEED")),
      h("div", { style: { display: "flex", gap: 10, marginBottom: 16 } },
        [["me", "关于我"], ["us", "关于我们"]].map(([k, label]) => h("button", { key: k, onClick: () => setSide(k), style: { position: "relative", flex: 1, padding: "8px 0", fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 3, borderRadius: 999, border: "1px solid " + (side === k ? GOLD : "rgba(172,138,91,.35)"), color: side === k ? "#fff" : GOLD, background: side === k ? GOLD : "rgba(255,255,255,.45)" } },
          label,
          [...unseen].some(x => x.indexOf(k + ".") === 0) ? dot({ position: "absolute", top: 6, right: 12 }) : null))),
      !hasAny(charId) ? h("div", { style: { textAlign: "center", padding: "30px 10px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: INKSOFT, lineHeight: 2.2, marginBottom: 16 } }, "这里还是空的。", h("br"), "让 " + charName + " 第一次把心里的这些写下来?"),
        onSeed ? h("button", { onClick: onSeed, disabled: seedBusy, style: { padding: "10px 26px", borderRadius: 999, fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 2, border: "none", background: GOLD, color: "#fff", boxShadow: "0 4px 14px rgba(172,138,91,.4)" } }, seedBusy ? say("他在想…") : say("让他写写看")) : null) : null,
      defs.map(([k, name], i) => { const fk = side + "." + k; const b = box.blocks[fk];
        return h("div", { key: fk, onClick: () => openBlock(fk), style: { position: "relative", background: "#fffdf8", borderRadius: 3, padding: "16px 15px 13px", margin: (i ? "18px" : "10px") + " " + (i % 2 ? "4px 0 0 14px" : "14px 0 0 4px"), cursor: "pointer", transform: "rotate(" + (i % 2 ? 0.9 : -0.9) + "deg)", boxShadow: "0 5px 16px rgba(96,78,52,.13)" } },
          tape({ transform: "rotate(" + (i % 2 ? 2 : -2) + "deg)" }),
          unseen.has(fk) ? dot({ position: "absolute", top: 9, right: 10 }) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 3.5, color: GOLD, marginBottom: 3 } }, EN[fk] || ""),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, letterSpacing: 1.5, marginBottom: 6 } }, name),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: b ? "rgba(92,82,68,.85)" : "rgba(92,82,68,.4)", lineHeight: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } }, b ? b.text : say("他还没往这想过。")),
          (function () {
            // 复看过、但没改 → 明说一句。「没改」是他真的又想了一遍的结果,不是这一块被忘了。
            var ck = (box.checks || {})[fk] || 0;
            if (!ck || ck <= ((b && b.ts) || 0)) return null;
            var dd = Math.floor((Date.now() - ck) / 86400000);
            return h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 1, color: "rgba(172,138,91,.55)", marginTop: 5 } },
              (dd >= 1 ? dd + " 天前" : "今天") + "又想了一遍 · 没改");
          })(),
          b ? h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 2, color: "rgba(172,138,91,.6)", marginTop: 6, textAlign: "right" } }, "展开信纸 ›") : null); }),
      revs.length ? h("button", { onClick: () => setAllOpen(true), style: { display: "block", width: "100%", marginTop: 22, padding: "10px 0", borderRadius: 999, border: "1px dashed rgba(172,138,91,.5)", background: "rgba(255,255,255,.45)", fontFamily: F_DISPLAY, fontSize: 12.5, letterSpacing: 2, color: GOLD } },
        say("他从前都怎么写的") + " · 共 " + revs.length + " 版") : null,
      full, allSheet);
  }
  window.Gaze = { ME, US, KEYS, apply, applyParsed, normKey, text, spec, seedSpec, seed, hasAny, tick, staleTurns, STALE_TURNS, unseenKeys, unseenCount, markSeen, revisions, markChecked, dueBlock, checkedAt };
  window.GazePage = GazePage;
})();
