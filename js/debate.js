// ============================================================
// 擂台（debate）—— 一个搭起来的台子，不是聊天框
// ⚠️v59.90 从「辩论」改名为「擂台」：这里一半的局是【随便吵】（谁先把对方逗笑、
//   谁把话题带跑偏），那压根不是辩论；而且「辩论」是个通用类目词，换个 app 照样成立。
//   叫「擂台」才是这个东西本身：上台、台下起哄、最后判个胜负。存档键仍是 x_debate_saves，不动她的旧存档。
// · 自定义题目 + 选 1~3 个角色（1 人=和你 1v1，2~3 人=一台子人一起吵）
// · 讲道理（维持人设认真论辩）⇄ 随便吵（允许按人设跑题发散）
// · 立场按人设自动站队；我 1v1 可选边/随机先手，多人一定最后发言
// · 一轮 = 所有角色各发言一次 + 我（最后）+ 场下观众 7~10 条弹幕
// · 观众 = 没上场的自建角色 + 随机路人，能互相 cue、点评某角色整体表现
// · 随时自动存档，从落地页重回；结束后系统判定胜负+判词，角色各自发表感言
// · 记忆不互通：可注入最近聊天当语气参考，但结束后什么都不写回记忆库
// 存 localStorage x_debate_saves（随云同步）；模型走全局 callAI + ANTI_CLICHE。
// ============================================================
(function () {
  const SIDE_COLORS = ["#c25a4a", "#3f6d8c", "#5a7a52", "#8a6d3b"];
  const ME_COLOR = "#6d5a78";
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  // ⚠️为什么一律给足（她 2026-09-01 点名放开）：思考型模型的【思考预算是从 maxTokens 里扣的】。
  // 给紧了，它想完就没配额写正文——要么直接空返回，要么写一半停在半句。
  // 而她是按【次】计费、输出不另外收钱：省这几千 token 一分钱省不到，
  // 换来的是一次空返回、再重来一次，反而多花一次调用。仓库铁律：≥8000（.claude/rules/max-tokens-floor.md），能写多少就给多少。
  const TOK = { stance: 8000 };
  // ⚠️人设不许再按固定字数砍（four-surfaces-same-context.md §4）。
  //   v55.87 群里的王爷变霸总，病因就是人设只剩 200 字——只剩「一个古代王爷」这一个标签，
  //   空白由训练先验补上，那就是网文霸总。擂台是【一次同时扮几个人】，最容易犯同一个病：
  //   原来分立场砍到 400 字、上台发言砍到 500 字、赛后感言砍到 120 字。
  //   照群聊那套按在场人数分预算（每人封顶 6000、总预算 30000、地板 1500），别再拍脑袋定一个数。
  const personaFor = (persona, n) => (typeof groupPersonaBudget === "function" && typeof groupPersonaText === "function")
    ? groupPersonaText(persona, groupPersonaBudget(n))
    : String(persona || "（暂无设定）").slice(0, 6000);

  function loadSaves() { return loadJSON("x_debate_saves", []); }
  function saveSaves(list) { return saveJSON("x_debate_saves", list); }

  // 把角色最近的聊天抓一小段，仅当语气/近况参考（结束后不写回）
  // ⚠️取材的过滤条件必须和别处一致（engine.js 那句「所有角色视角的取材都用它过滤」）：
  //   撤回的那句角色本来就不该记得，被上下文开关排除的那些也是。
  //   原来这里只挡了 OOC，撤回的和排除的照样喂——一层写在十几处，这一处没跟上。
  //   ⚠️还要【先过滤再取尾 12 条】：先 slice 的话，一段撤回的能把真正有用的几句挤没。
  function recentChatSnippet(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs
      .filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant") && !isOocMsg(m)
        && !m.recalled && (typeof contextAllowsMessage !== "function" || contextAllowsMessage(m)))
      .slice(-12)
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 400))
      .join("\n");
  }

  // 全场实录（喂判定用），带回合与立场
  function fullTranscript(session, uName) {
    const lines = [];
    (session.rounds || []).forEach((r, ri2) => {
      lines.push("〔第" + (ri2 + 1) + "轮〕");
      (r.turns || []).forEach(tn => { if (!tn.skipped) lines.push(tn.name + "（" + (tn.stance || "—") + "）：" + tn.text); });
    });
    return lines.join("\n").slice(-24000);
  }
  // 已完成的前几轮实录（喂本轮批量生成用；当前这轮我刚发的言另作 myText 传，不含在内）
  function prevTranscript(session) {
    const rs = (session.rounds || []).slice(0, -1);
    const take = rs.slice(-3);
    const lines = [];
    take.forEach((r, k) => {
      lines.push("〔第" + (rs.length - take.length + k + 1) + "轮〕");
      (r.turns || []).forEach(tn => { if (!tn.skipped) lines.push(tn.name + "：" + tn.text); });
    });
    return lines.join("\n").slice(-12000);
  }

  // ---- 模型：按人设给每个角色分配立场 + 给我几个可选立场 ----
  async function assignStances(active, worldbook, topic, chars, isFree) {
    const roster = chars.map((c, i) => "角色" + (i + 1) + "「" + c.name + "」的人设：" + personaFor(c.persona, chars.length)).join("\n\n");
    const sys = AC() +
      "下面有一道辩题和几个人物。请【严格根据每个人的人设】判断 Ta 在这道题上最可能真心站的立场——性格、经历、价值观决定态度，别随便分正反。\n\n" +
      "【辩题】" + topic +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim().slice(0, 6000) : "") +
      "\n\n" + roster +
      "\n\n【输出】只输出 JSON：{\"stances\":[{\"name\":\"角色名\",\"stance\":\"一句话概括Ta的立场\"}],\"myOptions\":[\"我方可选立场1\",\"我方可选立场2\"]}。" +
      "stances 每个角色一条；myOptions 给我 2~3 个可选立场（要包含和场上主要立场对立的那一个），短。别加解释。";
    const raw = await callAI(active, sys, [{ role: "user", content: "分配立场。" }], { maxTokens: TOK.stance });
    const p = extractJSON(raw) || {};
    const out = {};
    const list = Array.isArray(p.stances) ? p.stances : [];
    list.forEach(s => { if (s && s.name) out[String(s.name).trim()] = String(s.stance || "").trim(); });
    // ⚠️名字对不上就按顺序兜底。模型给名字加书名号、多个空格、写成「角色1」都很常见，
    //   而这里一旦对不上，【所有人】的立场都会变成「自行把握」——整场辩论就没有立场了。
    //   下面 genRound 早就有这一手（hit 找不到就取 rawTurns[i]），只有这一处漏了。
    chars.forEach(function (c, i) {
      if (out[c.name]) return;
      const byIdx = list[i];
      const txt = byIdx ? String(byIdx.stance || "").trim() : "";
      if (txt) out[c.name] = txt;
    });
    const myOpts = (Array.isArray(p.myOptions) ? p.myOptions : []).map(x => String(x).trim()).filter(Boolean);
    return { byName: out, myOptions: myOpts.length ? myOpts : ["支持", "反对"] };
  }

  // ---- 模型：一轮一次调用 —— 同时生成【所有角色发言(按序)】+【场下观众弹幕】 ----
  //   我(用户)本轮已先发言，这里让台上角色依次接话、彼此也能对线，再刷观众席。
  //   按次计费 → 一轮一发省钱；输出免费 + 思考型模型 → maxTokens 给足，避免长发言被截断。
  //   为防「一次扮太多变笨」：每个角色单独成块列清人设/立场，强命令保持各自独立口吻、别串味别雷同。
  async function genRound(active, meta, uName, worldbook, o) {
    const casual = meta.mode === "free";
    const chars = o.chars; // 按发言顺序
    const rosterBlocks = chars.map(function (c, i) {
      return "【第" + (i + 1) + "位 · " + c.name + "】\n· 立场：" + (c.stance || "自行把握") + "\n· 人设：" + personaFor(String(c.persona || "").replace(/\s+/g, " "), chars.length) +
        (c.injection ? "\n· （Ta 和 " + uName + " 最近的聊天，仅用来拿捏关系/近况/语气，别照搬别复述）\n" + c.injection : "");
    }).join("\n\n");
    const benchBlock = (o.bench || []).map(function (c) { return "· " + c.name + "（" + String(c.persona || "").replace(/\s+/g, " ").slice(0, 400) + "）"; }).join("\n");
    const sys = AC() +
      "这是一场辩论。你要在这一次里【同时扮演台上这几个角色，按给定顺序依次发言】，然后再生成场下观众席的弹幕。\n" +
      "⚠最重要：每个角色是不同的人，必须各自保持独立的立场、口吻、脾气、用词习惯——想象他们在抢麦互怼，别把他们写成一个腔调、别串味、别互相客气到失真。后发言的人要能接住前面的人和 " + uName + " 刚说的话。\n\n" +
      "【辩题】" + meta.topic +
      (casual
        ? "\n【放飞模式】各角色不必死守辩论规矩：可顺着自己性格跑题、抬杠、翻旧账、拿场上某人开玩笑、突然感性或耍无赖、把话题往自己在意处带——只要像 Ta 这个人。但别彻底离题。"
        : "\n【认真辩论】各角色维持人设的同时认真论辩：亮论点给理由，针对 " + uName + " 和彼此的话正面反驳或追问，讲逻辑也讲立场底气。别人身攻击、别空喊口号。") +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim().slice(0, 6000) : "") +
      "\n\n【台上角色（就按这个顺序发言）】\n" + rosterBlocks +
      "\n\n【" + uName + "（你们的对手，本轮已先开口）刚说】\n" + (o.myText ? o.myText : "（" + uName + " 这一轮跳过没说话，你们自己往下推进/开场）") +
      (o.transcript ? "\n\n【前几轮实录】\n" + o.transcript : "") +
      (benchBlock ? "\n\n【观众里有这些熟人（认识台上的人，弹幕要带各自偏袒/私人恩怨，用本名署名、贴人设）】\n" + benchBlock : "") +
      "\n\n【本次任务】\n" +
      "1）让上面每个角色各发一段言（顺序同上，共 " + chars.length + " 段），充分展开别水，2~6 句，口语带脾气，可点名回应某人。\n" +
      "2）再生成正好 " + o.count + " 条观众弹幕：有人揪某句吐槽/叫好，有人 @别的观众 接话吵起来，有人跳出本轮点评台上某人【整体表现】；熟人用本名带立场，其余起有网感的昵称，每条一句话短而毒。\n\n" +
      "【输出】只输出 JSON：{\"turns\":[{\"name\":\"角色名\",\"say\":\"发言\",\"at\":\"主要回应谁(没有留空)\"}],\"crowd\":[{\"name\":\"昵称或熟人本名\",\"text\":\"弹幕\",\"known\":true或false}]}。turns 顺序同上、每个角色一条；crowd 正好 " + o.count + " 条。别加旁白别 markdown。";
    // 台上几个人各说一大段 + 台下十条弹幕，是全场最长的一次输出：底给厚，人多再往上加
    const budget = Math.min(32000, 12000 + chars.length * 3000 + o.count * 300);
    const raw = await callAI(active, sys, [{ role: "user", content: "开始：先按序各角色发言，再刷 " + o.count + " 条观众弹幕。" }], { maxTokens: budget });
    const p = extractJSON(raw) || {};
    const rawTurns = Array.isArray(p.turns) ? p.turns : [];
    // 回填到角色（先按名字匹配，匹配不上就按顺序兜底）
    const turns = chars.map(function (c, i) {
      let hit = rawTurns.find(function (x) { return x && x.name && String(x.name).trim() === c.name; });
      if (!hit) hit = rawTurns[i];
      const text = hit && hit.say ? String(hit.say).trim() : (hit && hit.text ? String(hit.text).trim() : "……");
      return { name: c.name, id: c.id, stance: c.stance, color: c.color, text: text || "……", at: hit && hit.at ? String(hit.at).trim() : "" };
    });
    let crowd = Array.isArray(p.crowd) ? p.crowd : [];
    crowd = crowd.map(function (c) { return { name: String((c && c.name) || "路人").trim().slice(0, 16), text: String((c && c.text) || "").trim(), known: !!(c && c.known) }; }).filter(function (c) { return c.text; }).slice(0, o.count);
    return { turns: turns, crowd: crowd };
  }

  // ---- 模型：结束结算 —— 一次调用出【胜负判定 + 各角色赛后感言】（省一次 API；玩家不生成感言）----
  async function genResult(active, session, uName) {
    const chars = session.parts.filter(p => p.kind === "char");
    const charRoster = chars.map(c => "「" + c.name + "」（立场：" + (c.stance || "—") + "；人设：" + personaFor(String(c.persona || "").replace(/\s+/g, " "), chars.length) + "）").join("\n");
    const sys = AC() +
      "你是这场辩论的裁判兼主持。辩题：「" + session.topic + "」。参赛各方及立场：" + session.parts.map(p => p.name + "（" + (p.stance || "—") + "）").join("；") + "。\n" +
      (session.mode === "free"
        ? "本场是放飞局，胜负标准就按这一条来评：「" + (session.winCond || "谁整体最出彩谁赢") + "」，别用常规辩论对错来评。"
        : "按正规辩论评判：论点是否成立、论据是否扎实、有没有有效反驳对方、逻辑与说服力、临场应对，看谁整体更胜一筹。") +
      "\n\n【全程实录】\n" + fullTranscript(session, uName) +
      "\n\n【要一次做四件事】\n" +
      "1) crux：这一场他们【真正】在吵的是什么。⚠不是把辩题复述一遍——是把两边话里那个没说破的分歧点点出来（常见形状：两边其实在用两把不同的尺子；或者两边都默认了一个根本不成立的前提）。1~2 句。\n" +
      "2) best：全场最狠的那一句。从上面实录里【逐字照抄】某个人真的说过的一句（quote，不许改写、不许自己造），写清是谁说的（name）、狠在哪（why，一句）。可以是输的那一方说的。\n" +
      "3) 判出唯一胜者（可以是台上任何一方，包括玩家「" + uName + "」）+ 写判词：具体点到谁的哪些发言、对着评判标准说，别和稀泥。\n" +
      "4) 然后台上【每个角色】各发一句赛后感言，完全按各自人设反应赢/输（得意/谦逊/意犹未尽/不服/找补/摆烂…别一个腔调）。⚠只给下面这些角色写，【绝对不要】给玩家「" + uName + "」写感言。\n\n【台上角色】\n" + charRoster +
      "\n\n【输出】只输出 JSON：{\"crux\":\"他们其实在吵的那件事\",\"best\":{\"name\":\"说这句的人\",\"quote\":\"逐字照抄的原句\",\"why\":\"狠在哪，一句\"},\"winner\":\"胜者名字\",\"reason\":\"判词2~4句\",\"closings\":[{\"name\":\"角色名\",\"text\":\"感言1~3句\"}]}。closings 只含上面这些角色、每人一条。";
    // 判词 + 每个人一段感言一次出，别写一半被截断
    const raw = await callAI(active, sys, [{ role: "user", content: "先说他们真正在吵什么、挑出全场最狠那一句，再宣布结果，最后让各角色各说一句赛后感言（别写玩家的）。" }], { maxTokens: Math.min(24000, 10000 + chars.length * 1500) });
    const p = extractJSON(raw) || {};
    const charNames = chars.map(c => c.name);
    const raws = (Array.isArray(p.closings) ? p.closings : [])
      .map(c => ({ name: String((c && c.name) || "").trim(), text: String((c && c.text) || "").trim() }))
      .filter(c => c.text && c.name !== uName);
    let closings = raws.filter(c => charNames.indexOf(c.name) >= 0);
    // ⚠️同上：名字对不上就整条丢掉，结果是「赛后感言」那一栏整个空着，看起来像模型没答。
    //   条数对得上就按顺序认人——这比丢光强。
    if (!closings.length && raws.length === chars.length) closings = raws.map((c, i) => ({ name: chars[i].name, text: c.text }));
    // ⚠️best.quote 必须是台上真说过的话。模型很爱「引用」一句自己顺手改写过的——
    //   那就成了裁判替选手编台词。逐字对不上就整块丢掉，宁可不显示，也不显示一句没人说过的话。
    const said = (session.rounds || []).reduce(function (acc, r) {
      (r.turns || []).forEach(function (tn) { if (!tn.skipped && tn.text) acc.push(String(tn.text)); });
      return acc;
    }, []);
    const b = p.best && typeof p.best === "object" ? p.best : null;
    const bq = b ? String(b.quote || "").trim() : "";
    const best = (bq && said.some(function (x) { return x.indexOf(bq) >= 0; }))
      ? { name: String(b.name || "").trim(), quote: bq, why: String(b.why || "").trim() } : null;
    return {
      crux: String(p.crux || "").trim(),
      best: best,
      winner: String(p.winner || "").trim() || "平局",
      reason: String(p.reason || raw || "").trim(),
      closings: closings
    };
  }

  // ============================================================
  // 顶层：落地页（存档列表 + 发起）
  // ============================================================
  function Debate(props) {
    const t = useTheme();
    const [saves, setSaves] = useState(loadSaves);
    const [view, setView] = useState("home"); // "home" | "setup" | <sessionId>
    const persist = list => { if (saveSaves(list)) { setSaves(list); return true; } props.toast && props.toast("这次没保存成功，原存档还在"); return false; };
    const patchSession = (id, patch) => {
      const list = loadSaves().map(s => s.id === id ? Object.assign({}, s, typeof patch === "function" ? patch(s) : patch) : s);
      persist(list);
    };
    const delSession = id => requestAppConfirm("删掉这一场？", "删除后不能恢复。", () => { if (persist(loadSaves().filter(s => s.id !== id)) && view === id) setView("home"); }, "删除");
    // 长按删除（onContextMenu 在手机上不触发，得自己起计时器）
    const lpTimer = useRef(null), lpFired = useRef(false);
    const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
    const startLP = id => { lpFired.current = false; cancelLP(); lpTimer.current = setTimeout(() => { lpFired.current = true; delSession(id); }, 500); };

    if (view === "setup") {
      return h(Setup, {
        active: props.active, characters: props.characters, profile: props.profile, worldbook: props.worldbook, toast: props.toast,
        onCancel: () => setView("home"),
        onCreate: session => { persist([session].concat(loadSaves())); setView(session.id); }
      });
    }
    if (view !== "home") {
      const s = saves.find(x => x.id === view);
      if (!s) { setView("home"); return null; }
      return h(Arena, {
        session: s, active: props.active, characters: props.characters, groups: props.groups, profile: props.profile, worldbook: props.worldbook, toast: props.toast,
        onShareToChat: props.onShareToChat, onShareToGroup: props.onShareToGroup,
        onBack: () => { setSaves(loadSaves()); setView("home"); },
        onPatch: patch => patchSession(s.id, patch)
      });
    }

    // 落地页：每一场是一张【场次单】——左边一条模式色的边条，
    // 判完的那场右上角盖一枚胜者印章（歪着盖的那种，不是又一个圆角徽章）。
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "擂台", en: "Arena", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        h("button", {
          onClick: () => { if (!props.characters.length) { props.toast && props.toast("先去『人格档案馆』建个角色"); return; } setView("setup"); },
          className: "w-full py-3 mb-5 active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 14, borderRadius: 11, border: "1px dashed " + t.line, color: t.sub, background: t.bg2 }
        }, "＋ 摆一场擂台"),
        saves.length === 0
          ? h("div", { style: { textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, paddingTop: 40, whiteSpace: "pre-line" } }, "台子还空着。\n出个题、拉一两个人上台，\n讲道理或者随便吵都行。")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
            saves.slice().sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0)).map(s => {
              const names = s.parts.filter(p => p.kind === "char").map(p => p.name).join("  ·  ");
              const ended = s.status === "ended";
              const modeInk = s.mode === "free" ? "#8a6d3b" : t.tint;
              return h("div", {
                key: s.id,
                onClick: () => { if (lpFired.current) { lpFired.current = false; return; } setView(s.id); },
                onContextMenu: e => { e.preventDefault(); delSession(s.id); },
                onTouchStart: () => startLP(s.id), onTouchEnd: cancelLP, onTouchMove: cancelLP, onTouchCancel: cancelLP,
                onMouseDown: () => startLP(s.id), onMouseUp: cancelLP, onMouseLeave: cancelLP,
                className: "active:opacity-70",
                style: { position: "relative", background: t.bg2, border: "1px solid " + t.line, borderLeft: "4px solid " + modeInk, borderRadius: "4px 13px 13px 4px", padding: "13px 15px 14px", cursor: "pointer", overflow: "hidden" }
              },
                h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 2, color: modeInk, marginBottom: 5 } }, s.mode === "free" ? "随便吵" : "讲道理"),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.35, color: t.ink, marginBottom: 6, paddingRight: ended ? 74 : 0 } }, s.topic),
                h("div", { className: "flex items-baseline", style: { gap: 8 } },
                  h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, minWidth: 0 } }, names),
                  h("span", { style: { flex: 1 } }),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, whiteSpace: "nowrap" } },
                    ended ? "共 " + ((s.rounds || []).length || 1) + " 回合" : "第 " + ((s.rounds || []).length || 1) + " 回合进行中")),
                // 判完的那一场：歪着盖上去的一枚章
                (ended && s.verdict) ? h("div", { style: { position: "absolute", right: 8, top: 12, transform: "rotate(-9deg)", border: "1.5px solid " + t.accent, color: t.accent, borderRadius: 5, padding: "3px 7px 4px", textAlign: "center", opacity: .88, maxWidth: 82 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 2 } }, "胜"),
                  h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 12, lineHeight: 1.2, marginTop: 1 } }, s.verdict.winner)) : null
              );
            })),
        saves.length > 0 ? h("div", { style: { marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "长按可删除存档") : null
      ));
  }

  // ============================================================
  // 发起设置
  // ============================================================
  function Setup(props) {
    const t = useTheme();
    const [topic, setTopic] = useState("");
    const [picked, setPicked] = useState([]); // charId[]
    const [mode, setMode] = useState("serious"); // serious | free
    const [winCond, setWinCond] = useState("");
    const [inject, setInject] = useState(false);
    const [starting, setStarting] = useState(false);

    const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : (p.length >= 3 ? (props.toast && props.toast("台上最多站 3 个"), p) : p.concat(id)));

    const start = async () => {
      if (!topic.trim()) { props.toast && props.toast("先写要吵的那件事"); return; }
      if (!picked.length) { props.toast && props.toast("至少拉 1 个人上台"); return; }
      setStarting(true);
      try {
        const chars = picked.map(id => props.characters.find(c => c.id === id)).filter(Boolean);
        const uName = (props.profile && props.profile.name) || "我";
        const assigned = await assignStances(props.active, props.worldbook, topic.trim(), chars, mode === "free");
        // 参赛者结构（含我）
        const parts = chars.map((c, i) => ({
          kind: "char", id: c.id, name: c.name, persona: c.persona || "",
          stance: assigned.byName[c.name] || "自行把握", color: SIDE_COLORS[i % SIDE_COLORS.length],
          injection: inject ? recentChatSnippet(c.id, uName, c.name) : ""
        }));
        const me = { kind: "me", id: "__me__", name: uName, stance: "", color: ME_COLOR };
        // 我固定每轮第一个发言；角色发言顺序：多人=乱序，1v1=就那一个。parts 里我排最前（台上榜也我在先）
        const order = shuffle(chars).map(c => ({ kind: "char", id: c.id }));
        const session = {
          id: "db_" + Date.now(), topic: topic.trim(), mode: mode,
          winCond: mode === "free" ? (winCond.trim() || "") : "",
          parts: [me].concat(parts), order: order, myOptions: assigned.myOptions, mySet: false,
          rounds: [{ turns: [], audience: [], myDone: false, gen: false }],
          status: "ongoing", verdict: null, closings: [], createdTs: Date.now(), lastTs: Date.now()
        };
        props.onCreate(session);
      } catch (e) { props.toast && props.toast("开场失败：" + (e.message || "重试")); setStarting(false); }
    };

    const field = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none" };
    const label = { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 8, letterSpacing: .3 };

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "摆台子", en: "New", onBack: props.onCancel }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        // 题目
        h("div", { style: label }, "今天台上吵什么"),
        h("textarea", { value: topic, onChange: e => setTopic(e.target.value), placeholder: "例：该不该为爱情放弃事业 / 咖啡还是茶 / 先有鸡还是先有蛋…", rows: 2, style: Object.assign({}, field, { resize: "none", marginBottom: 20 }) }),
        // 选角色
        h("div", { style: label }, "上台的人（选 1 个＝和你 1v1；2~3 个＝一台子人一起吵）"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 } },
          props.characters.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "还没有角色") :
            props.characters.map(c => {
              const on = picked.includes(c.id);
              return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70",
                style: { display: "flex", alignItems: "center", gap: 6, padding: "6px 11px 6px 6px", borderRadius: 999, border: "1.5px solid " + (on ? t.accent : t.line), background: on ? t.accent + "18" : t.bg2 } },
                h(Avatar, { character: c, size: 22, radius: 999 }),
                h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: on ? t.accent : t.ink, fontWeight: on ? 700 : 400 } }, c.name));
            })),
        // 模式
        h("div", { style: label }, "模式"),
        h("div", { style: { display: "flex", gap: 8, marginBottom: mode === "free" ? 14 : 20 } },
          [["serious", "讲道理", "维持人设，正经论辩"], ["free", "随便吵", "允许按人设跑题发散"]].map(m =>
            h("button", { key: m[0], onClick: () => setMode(m[0]), className: "active:opacity-70 flex-1",
              style: { textAlign: "left", padding: "11px 13px", borderRadius: 11, border: "1.5px solid " + (mode === m[0] ? t.accent : t.line), background: mode === m[0] ? t.accent + "12" : t.bg2 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700, color: mode === m[0] ? t.accent : t.ink } }, m[1]),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, m[2])))),
        // 放飞：获胜条件（可自定；留空则结算时系统临场定，不额外花 API）
        mode === "free" ? h("div", { style: { marginBottom: 20 } },
          h("div", { style: label }, "怎么算赢（可自定，留空＝收台时临场定）"),
          h("textarea", { value: winCond, onChange: e => setWinCond(e.target.value), placeholder: "例：谁先把对方逗笑 / 谁成功把话题带跑偏…（不填也行，结算时系统会定标准）", rows: 2, style: Object.assign({}, field, { resize: "none" }) })) : null,
        // 注入聊天
        h("button", { onClick: () => setInject(v => !v), className: "active:opacity-70",
          style: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, marginBottom: 4 } },
          h("div", { style: { width: 38, height: 22, borderRadius: 999, background: inject ? t.accent : t.line, position: "relative", transition: "background .15s", flexShrink: 0 } },
            h("div", { style: { width: 18, height: 18, borderRadius: 999, background: "#fff", position: "absolute", top: 2, left: inject ? 18 : 2, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" } })),
          h("div", { style: { textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "注入你俩最近的聊天"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, "只当语气/近况参考，下了台什么都不写回记忆"))),
      ),
      // 底部开始
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 20px calc(12px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + t.bg + " 70%,transparent)" } },
        h("button", { onClick: start, disabled: starting, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: starting ? t.fog : t.accent, borderRadius: 13, padding: "13px 0" } },
          starting ? "正在给各人排立场…" : "上台")));
  }

  // ============================================================
  // 擂台
  // ============================================================
  function Arena(props) {
    const t = useTheme();
    const s = props.session;
    const uName = (props.profile && props.profile.name) || "我";
    // 我在擂台上的头像：用真实资料卡头像，没有再退回底色首字
    const meAv = { name: uName, avatarImage: props.profile && props.profile.avatarImage, avatarEmoji: props.profile && props.profile.avatarEmoji, color: (props.profile && props.profile.color) || ME_COLOR };
    const [busy, setBusy] = useState(false);
    const [phaseMsg, setPhaseMsg] = useState("");
    const [draft, setDraft] = useState("");
    const [sideDraft, setSideDraft] = useState(null); // 自定义立场的就地输入（原生 prompt 同样会被 PWA 吞掉）
    const [shareOpen, setShareOpen] = useState(false); // 把这一场发给谁
    const feedRef = useRef(null);
    const dtp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 发言朗读（懒合成）
    const curRound = () => (s.rounds[s.rounds.length - 1] || { turns: [], audience: [] });

    useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [s.rounds, busy, phaseMsg]);

    // 保存补丁：始终基于最新 session 做，避免闭包过期
    const patch = obj => props.onPatch(prev => Object.assign({}, prev, typeof obj === "function" ? obj(prev) : obj, { lastTs: Date.now() }));

    // 每轮阶段：我先发言(myDone) → 一次批量生成全部角色+观众(gen) → 下一轮
    const roundMyDone = r => !!(r && (r.myDone || (r.turns || []).some(x => x.who === "me")));
    const roundGen = r => !!(r && (r.gen || (r.audience && r.audience.length) || (r.turns || []).some(x => x.who === "char")));
    const cr = curRound();
    const myTurnNow = s.mySet && !roundMyDone(cr);   // 该我(固定先手)发言
    const needGen = roundMyDone(cr) && !roundGen(cr); // 我说完/跳过了，等这一次批量生成（失败可重试）
    const roundDone = roundMyDone(cr) && roundGen(cr);
    const roundNo = s.rounds.length;

    // 一次调用批量生成【全部角色发言(按序) + 观众弹幕】
    const runGen = async (myText, skip) => {
      if (busy) return;   // 连点两下＝白花两次钱（她按次计费）
      setBusy(true); setPhaseMsg("台上依次接话、台下开始起哄…");
      try {
        const charParts = s.parts.filter(p => p.kind === "char");
        const onIds = charParts.map(c => c.id);
        const bench = props.characters.filter(c => !onIds.includes(c.id)).slice(0, 6).map(c => ({ name: c.name, persona: c.persona || "" }));
        const orderedChars = (s.order || []).map(o => charParts.find(c => c.id === o.id)).filter(Boolean);
        const count = ri(7, 10);
        const r = await genRound(props.active, { mode: s.mode, topic: s.topic }, uName, props.worldbook, {
          chars: orderedChars.map(c => ({ name: c.name, id: c.id, persona: c.persona, stance: c.stance, color: c.color, injection: c.injection })),
          myText: skip ? "" : myText, transcript: prevTranscript(s), bench: bench, count: count
        });
        patch(prev => {
          const rounds = prev.rounds.slice();
          const last = Object.assign({}, rounds[rounds.length - 1]);
          last.turns = last.turns.concat(r.turns.map(tn => ({ who: "char", id: tn.id, name: tn.name, stance: tn.stance, color: tn.color, text: tn.text, at: tn.at })));
          last.audience = r.crowd;
          last.gen = true;
          rounds[rounds.length - 1] = last;
          return { rounds: rounds };
        });
      } catch (e) { props.toast && props.toast("生成失败：" + (e.message || "重试")); }
      setBusy(false); setPhaseMsg("");
    };

    // 我先发言（或跳过）→ 立刻触发本轮批量生成
    const submitRound = async skip => {
      if (busy) return;
      const myText = skip ? "" : draft.trim();
      if (!skip && !myText) { props.toast && props.toast("说点什么，或者这轮不说"); return; }
      const mePart = s.parts.find(p => p.kind === "me");
      patch(prev => {
        const rounds = prev.rounds.slice();
        const last = Object.assign({}, rounds[rounds.length - 1]);
        last.turns = last.turns.concat([{ who: "me", id: "__me__", name: uName, stance: mePart.stance, color: ME_COLOR, skipped: skip, text: skip ? "（跳过了这一回合）" : myText }]);
        last.myDone = true;
        rounds[rounds.length - 1] = last;
        return { rounds: rounds };
      });
      setDraft("");
      await runGen(myText, skip);
    };

    // 生成失败后的重试：找回本轮我说的话再跑一次
    const retryGen = () => { const t2 = (cr.turns || []).find(x => x.who === "me"); runGen(t2 && !t2.skipped ? t2.text : "", !!(t2 && t2.skipped)); };

    const nextRound = () => patch(prev => ({ rounds: (prev.rounds || []).concat([{ turns: [], audience: [], myDone: false, gen: false }]) }));

    // 我的立场未定 → 先选边
    const setMySide = st => patch(prev => {
      const parts = prev.parts.map(p => p.kind === "me" ? Object.assign({}, p, { stance: st }) : p);
      return { parts: parts, mySet: true };
    });

    // 结束判定
    // ⚠️不许用原生 confirm：iOS/PWA 里她勾一次「不再显示」就永久吞掉，
    //   这颗键从此按下去毫无反应（app.js 那层 requestAppConfirm 就是为这个立的）。
    const endDebate = () => requestAppConfirm("收台，判胜负？", "判完这一场就结束了，不能再往下吵。", runEnd, "收台");
    const runEnd = async () => {
      if (busy) return;
      setBusy(true); setPhaseMsg("裁判合议、选手准备感言…");
      try {
        // 判定 + 各角色感言合并成一次调用（省一次 API）
        const r = await genResult(props.active, s, uName);
        patch({ status: "ended", verdict: { winner: r.winner, reason: r.reason, crux: r.crux, best: r.best }, closings: r.closings });
      } catch (e) { props.toast && props.toast("判定失败：" + (e.message || "重试")); }
      setBusy(false); setPhaseMsg("");
    };

    // ---------- 渲染：结束态 ----------
    const ended = s.status === "ended";

    // ── 台子 ────────────────────────────────────────────────
    // 这个 app 在现实里是【一个搭起来的擂台】：台上几个人各站一边，脚下同一块台面；
    // 每人的立场牌挂在台前那道台裙上；台下黑压压一片人在起哄；台子上方吊着记分牌。
    // ⚠️判据（tabs-not-plain-pills.md）：一排头像＋一列左边带色条的卡片＋一个深色评论区，
    //   原样搬进任何一个 app 都成立——那就是没设计。下面每一样都得是【擂台才有的东西】。
    const HEAD_H = 50;   // 头像+名字这一段的高度：台面那条线正好从这里横过去
    const stage = h("div", { style: { background: t.bg2, borderBottom: "1px solid " + t.line, paddingTop: 9 } },
      // 台上方那条横幅：今天要吵的这件事。底边中间收一个尖口，是布幡不是标题栏
      h("div", { style: { margin: "0 18px 9px", padding: "6px 12px 10px", background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.3, textAlign: "center", clipPath: "polygon(0 0,100% 0,100% 100%,50% calc(100% - 7px),0 100%)" } }, s.topic),
      h("div", { style: { position: "relative", padding: "0 10px 10px" } },
        // 台裙：台面线以下这一片是台前，立场牌就挂在这上面
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, top: HEAD_H, bottom: 0, background: "linear-gradient(180deg,rgba(38,34,28,.13),rgba(38,34,28,.03))", borderTop: "3px solid " + t.ink, boxShadow: "0 5px 9px -6px rgba(38,34,28,.85)" } }),
        h("div", { className: "flex justify-center items-start", style: { position: "relative", gap: 6 } },
          s.parts.map(function (p) {
            return h("div", { key: p.kind === "me" ? "me" : p.id, style: { width: 98, display: "flex", flexDirection: "column", alignItems: "center" } },
              h("div", { style: { height: HEAD_H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" } },
                p.kind === "char"
                  ? h(Avatar, { character: props.characters.find(function (c) { return c.id === p.id; }) || { name: p.name }, size: 29, radius: 999 })
                  : h(Avatar, { character: meAv, size: 29, radius: 999 }),
                h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.ink, marginTop: 3, maxWidth: 96 } }, p.kind === "me" ? uName : p.name)),
              // 挂绳：牌子是【挂在台前】的，不是浮在那儿的
              h("div", { "aria-hidden": "true", style: { width: 1, height: 7, background: p.color, opacity: .7 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 9, lineHeight: 1.35, color: "#fff", background: p.color, borderRadius: 3, padding: "4px 6px 5px", width: "100%", textAlign: "center", wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", boxShadow: "0 2px 5px rgba(38,34,28,.28)" } },
                p.stance || (p.kind === "me" ? "还没选边" : "—")));
          }))));

    // ── 发言：台上那个人面前那块名牌，话写在牌子后面 ──────────
    // 不是聊天气泡，也不是左边一条色边的通用卡片。
    // ⚠️卡片里【不许再套一层 maxHeight 滚动】：一页里嵌一个 300px 的小滚动区，
    //   在手机上会跟整页抢手势（mobile-ui-layout §3 只允许一个主滚动容器）。长就让它长。
    const turnCard = function (tn, k) {
      if (tn.skipped) return h("div", { key: k, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "5px 0 11px" } }, "—— " + tn.name + " 没接这一句 ——");
      const av = tn.who === "char" ? (props.characters.find(function (c) { return c.id === tn.id; }) || { name: tn.name }) : meAv;
      return h("div", { key: k, style: { marginBottom: 13 } },
        h("div", { className: "flex items-center", style: { gap: 6 } },
          h("span", { className: "flex items-center", style: { gap: 5, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12, fontWeight: 700, padding: "5px 10px 4px", borderRadius: "5px 5px 0 0", borderBottom: "3px solid " + tn.color } },
            h(Avatar, { character: av, size: 15, radius: 999 }), tn.name),
          tn.at ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "冲着 " + tn.at) : null,
          (tn.who === "char" && dtp && typeof TtsDot === "function") ? h(TtsDot, { k: "dbt" + k, text: tn.text, spk: props.characters.find(function (c) { return c.id === tn.id; }), tp: dtp }) : null),
        h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderTop: "1px solid " + tn.color + "55", borderRadius: "0 11px 11px 11px", padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: t.ink, whiteSpace: "pre-wrap" } }, tn.text));
    };

    // ── 台下：一片黑压压的后脑勺，喊声从不同位置冒出来 ────────
    // 不是一份「@某某：某某」的名单。缩进按条错开（用下标定死，不随机——重画时不许跳）。
    const CROWD_IN = [0, 15, 30, 8, 22, 0, 34, 12, 26, 4];
    const audienceBlock = function (crowd, k) {
      return h("div", { key: "aud" + k, style: { position: "relative", background: "#1e1d1b", borderRadius: 12, padding: "20px 13px 14px", margin: "2px 0 15px", overflow: "hidden" } },
        // 顶上那一排后脑勺：台下坐着一片人
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, top: 0, height: 11, backgroundImage: "radial-gradient(circle at 9px 12px, rgba(255,255,255,.085) 8px, transparent 8.5px)", backgroundSize: "22px 11px" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 3, color: "#6f6a5f", marginBottom: 9 } }, "台 下 · " + crowd.length + " 个人在喊"),
        crowd.map(function (c, i) {
          return h("div", { key: i, style: { marginLeft: CROWD_IN[i % CROWD_IN.length], fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: "#ece8df", marginBottom: 4 } },
            h("span", { style: { color: c.known ? "#e8a598" : "#8fb0c9", fontWeight: 600 } }, c.name + "："), c.text);
        }));
    };

    // ── 把这一场发给谁 ──────────────────────────────────────
    // 她 2026-09-01：「既然这个是可以多人的，那就群和单聊都可以分享吧」。
    // 用居中框不用半窗：半窗上面糊着的那半屏是上一层，看着像没加载完（no-half-sheet.md）。
    const hasSomething = (s.rounds || []).some(function (r) { return (r.turns || []).some(function (x) { return x && !x.skipped && x.text; }); });
    const sharePanel = shareOpen && typeof CenterCard === "function" ? h(CenterCard, { onClose: function () { setShareOpen(false); }, maxWidth: 360 },
      h("div", { className: "shrink-0", style: { padding: "15px 17px 11px", borderBottom: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "把这一场发给谁"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3 } },
          ended ? "题目、台上说的话、判词一起发过去" : "还没收台，发过去的是到这一回合为止的")),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 12px 16px" } },
        (props.characters || []).filter(function (c) { return c && !c.npc; }).map(function (c) {
          return h("button", { key: c.id, onClick: function () { setShareOpen(false); props.onShareToChat && props.onShareToChat(s, c); },
            className: "w-full flex items-center gap-3 active:opacity-60", style: { padding: "9px 5px", minHeight: 46 } },
            h(Avatar, { character: c, size: 32, radius: 999 }),
            h("span", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, c.remark || c.name));
        }),
        (props.groups || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 2, color: t.fog, margin: "12px 5px 4px" } }, "群 聊") : null,
        (props.groups || []).map(function (g) {
          return h("button", { key: g.id, onClick: function () { setShareOpen(false); props.onShareToGroup && props.onShareToGroup(s, g); },
            className: "w-full flex items-center gap-3 active:opacity-60", style: { padding: "9px 5px", minHeight: 46 } },
            h("div", { style: { width: 32, height: 32, borderRadius: 10, background: t.line, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 11, color: t.sub, flexShrink: 0 } }, String((g.memberIds || []).length || "群")),
            h("span", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, g.name));
        }),
        (!(props.characters || []).filter(function (c) { return c && !c.npc; }).length && !(props.groups || []).length)
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "18px 5px", textAlign: "center" } }, "还没有可以发过去的人") : null)) : null;

    return h("div", { className: "h-full flex flex-col" },
      // 头
      h("div", { className: "shrink-0", style: { background: t.bg } },
        // ⚠️顶栏自己吃刘海（mobile-ui-layout.md §1：顶栏自己吃 safe-area-inset-top，用公共 safeTop(px)）。
        //   这一条原来只写了 pt-4＝16px，在刘海屏上根本让不开——返回键和右边那两颗牌
        //   直接压在时钟和电量上（她 2026-09-01 截图：「这个返回键又太上了」）。
        //   ⚠️返回键还要有 40×40 的可点区：一个 19px 的图标点不着（§1 那套紧凑标题栏的标尺）。
        h("div", { className: "flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
          h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
          h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
            hasSomething ? h("button", { onClick: function () { setShareOpen(true); }, className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 11, minHeight: 26, color: t.sub, border: "1px solid " + t.line, borderRadius: 7, padding: "3px 9px" } }, "分享") : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 1, fontWeight: 700, color: "#fff", background: s.mode === "free" ? "#8a6d3b" : t.tint, padding: "3px 9px", borderRadius: 4 } }, s.mode === "free" ? "随便吵" : "讲道理"),
            !ended ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "第 " + roundNo + " 回合") : h("span", { style: { fontFamily: F_BODY, fontSize: 11, fontWeight: 700, color: "#fff", background: t.accent, padding: "2px 9px", borderRadius: 7 } }, "已收台"))),
        stage),
      // 正文
      h("div", { ref: feedRef, className: "flex-1 overflow-y-auto px-4 pt-3", style: { paddingBottom: ended ? 24 : 150 } },
        (s.rounds || []).map((r, ri2) => h("div", { key: ri2 },
          // 回合牌：擂台边上挂的那块数字牌，不是一条 ── 标题 ── 分割线
          h("div", { style: { display: "flex", justifyContent: "center", margin: "8px 0 12px" } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, letterSpacing: 2, color: t.sub, border: "1px solid " + t.line, borderTop: "3px solid " + t.ink, borderRadius: "0 0 4px 4px", padding: "4px 13px 5px", background: t.bg2 } }, "第 " + (ri2 + 1) + " 回合")),
          (r.turns || []).map(turnCard),
          (r.audience && r.audience.length) ? audienceBlock(r.audience, ri2) : null)),
        busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "10px 0" } }, phaseMsg || "…") : null,
        // 结束态：判定 + 感言
        ended && s.verdict ? h("div", { style: { marginTop: 26, position: "relative" } },
          // 记分牌：吊在台子上方那块牌。两根吊绳往上接出去，牌子才是「吊着的」
          h("div", { "aria-hidden": "true", style: { position: "absolute", left: "26%", top: -18, width: 1, height: 18, background: t.line } }),
          h("div", { "aria-hidden": "true", style: { position: "absolute", right: "26%", top: -18, width: 1, height: 18, background: t.line } }),
          h("div", { style: { background: "#1e1d1b", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, padding: "15px 17px 16px", marginBottom: 20, boxShadow: "0 12px 26px rgba(0,0,0,.3)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 3, color: "#6f6a5f" } }, "判 了"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1.25, color: "#f0c67a", margin: "6px 0 10px" } }, s.verdict.winner),
            h("div", { style: { height: 1, background: "rgba(255,255,255,.13)", marginBottom: 10 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: "#d8d3c8", whiteSpace: "pre-wrap" } }, s.verdict.reason),
            // 「他们其实在吵的是」：只写「谁赢了」的话，这一场吵完什么都没留下。
            // 这一栏才是她看完会记住的东西——把两边话里那个没说破的分歧点点出来。
            s.verdict.crux ? h("div", { style: { marginTop: 15, paddingTop: 13, borderTop: "1px dashed rgba(255,255,255,.16)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 3, color: "#6f6a5f", marginBottom: 7 } }, "他们其实在吵的是"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: "#d8d3c8" } }, s.verdict.crux)) : null,
            // 「最狠的那一句」：从实录里逐字挑出来的原句（对不上就整块不显示，见 genResult）。
            // 引号压在左边，跟上面那两段一眼分得开——它是【谁说过的话】，不是裁判的话。
            (s.verdict.best && s.verdict.best.quote) ? h("div", { style: { position: "relative", marginTop: 15, paddingTop: 13, borderTop: "1px dashed rgba(255,255,255,.16)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 3, color: "#6f6a5f", marginBottom: 9 } }, "最狠的那一句"),
              h("div", { style: { borderLeft: "2px solid #f0c67a", paddingLeft: 11, fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.9, color: "#f4f1e9" } }, s.verdict.best.quote),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8d877a", marginTop: 8 } },
                "—— " + (s.verdict.best.name || "台上") + (s.verdict.best.why ? "　" + s.verdict.best.why : ""))) : null),
          (s.closings && s.closings.some(c => c.name !== uName)) ? h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 3, color: t.fog, marginBottom: 11 } }, "下 台 之 后"),
            s.closings.filter(c => c.name !== uName).map((c, i) => {
              const cp = s.parts.find(p => p.name === c.name && p.kind === "char");
              return h("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 10 } },
                cp ? h(Avatar, { character: props.characters.find(x => x.id === cp.id) || { name: c.name }, size: 26, radius: 999 }) : h("div", { style: { width: 26 } }),
                h("div", { style: { flex: 1 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: cp ? cp.color : t.ink, marginBottom: 2 } }, c.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink } }, c.text)));
            })) : null) : null),
      // 底部操作
      ended ? null : h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 16px calc(10px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + t.bg + " 78%,transparent)" } },
        busy
          ? h("button", { disabled: true, className: "w-full", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.fog, borderRadius: 11, padding: "12px 0" } }, phaseMsg || "生成中…")
          // 我的立场未定 → 先选边
          : !s.mySet ? (sideDraft !== null
            // ⚠️自定义立场原来走 window.prompt——和 confirm 一样会被 iOS/PWA 永久吞掉，
            //   吞掉之后这颗键按下去毫无反应。改成就地输入。
            ? h("div", { style: { display: "flex", gap: 8 } },
              h("input", { value: sideDraft, autoFocus: true, onChange: e => setSideDraft(e.target.value),
                onKeyDown: e => { if (e.key === "Enter" && sideDraft.trim()) setMySide(sideDraft.trim()); },
                placeholder: "你要站的那一边…",
                style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "10px 12px", outline: "none" } }),
              h("button", { onClick: () => setSideDraft(null), className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "10px 13px" } }, "取消"),
              h("button", { onClick: () => { if (sideDraft.trim()) setMySide(sideDraft.trim()); }, className: "active:opacity-80",
                style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700, color: "#fff", background: ME_COLOR, borderRadius: 11, padding: "10px 15px" } }, "站这边"))
            : h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8, textAlign: "center" } }, "你站哪边？（你每回合第一个开口）"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" } },
                (s.myOptions || ["支持", "反对"]).map((op, i) => h("button", { key: i, onClick: () => setMySide(op), className: "active:opacity-70",
                  style: { fontFamily: F_BODY, fontSize: 12.5, minHeight: 40, color: "#fff", background: ME_COLOR, borderRadius: 999, padding: "8px 15px" } }, op)),
                h("button", { onClick: () => setSideDraft(""), className: "active:opacity-70",
                  style: { fontFamily: F_BODY, fontSize: 12.5, minHeight: 40, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "8px 15px" } }, "自己写一个"))))
          // 我先发言（含跳过）
          : myTurnNow ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            h("textarea", { value: draft, onChange: e => setDraft(e.target.value), placeholder: roundNo === 1 ? "你先开口，把话头抛出去…" : "轮到你先说，接着吵…", rows: 2,
              style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px", resize: "none", outline: "none" } }),
            h("div", { style: { display: "flex", gap: 8 } },
              h("button", { onClick: () => submitRound(true), className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "10px 16px" } }, "这轮不说"),
              h("button", { onClick: () => submitRound(false), className: "flex-1 active:opacity-80",
                style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: ME_COLOR, borderRadius: 11, padding: "10px 0" } }, "说完，看他们接")))
          // 生成失败兜底：重试
          : needGen ? h("div", { style: { display: "flex", gap: 8 } },
            h("button", { onClick: endDebate, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: t.accent, background: t.bg2, border: "1px solid " + t.accent, borderRadius: 11, padding: "11px 14px" } }, "收台判胜负"),
            h("button", { onClick: retryGen, className: "flex-1 active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 11, padding: "11px 0" } }, "↻ 台上没接上，再来一次"))
          // 本轮已完成 → 结束 / 下一轮
          : h("div", { style: { display: "flex", gap: 8 } },
            h("button", { onClick: endDebate, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: t.accent, background: t.bg2, border: "1px solid " + t.accent, borderRadius: 11, padding: "11px 14px" } }, "收台判胜负"),
            h("button", { onClick: nextRound, className: "flex-1 active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 11, padding: "11px 0" } }, "下一回合 →"))),
      sharePanel);
  }

  window.Debate = Debate;
})();
