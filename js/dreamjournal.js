// ============================================================
// 解梦馆（dream journal）v1 —— 收录【她的真梦】，角色按人设解梦
// 方向 2026-07-17 她拍板（对话里定的四条铁则）：
//   ①残渣也是梦：只记得颜色/情绪/一个画面都能记、都能解；「没梦」也是记录
//   ②十秒采集：语音优先（复用 Ears 听写），睁眼含糊嘟囔即可，不用打字不用清醒
//   ③解梦=角色人设的舞台：谁解都行，各按各的腔调；禁止心理诊断腔
//   ④无梦日反向营业的口子留给 D 模块自发梦（他讲他的梦），本文件不做
// 存储：x_dreamlog（数组，最新在前；纯文本量小，随 saves 云同步）
// 成本：零常驻、零自动调用——只有她点「找TA解」才走一次 apiFor(charId) 专线
// ============================================================
(function () {
  "use strict";
  const useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;

  const K_LOG = "x_dreamlog";
  const loadLog = () => loadJSON(K_LOG, []);
  const saveLog = list => saveJSON(K_LOG, list);
  const uid = () => "dm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  // ⚠️别再用 emoji 当标签（她 2026-09-03 在情侣空间报过「有些有 emoji 有些还是一个方框」）：
  //   彩色 emoji 和别处的中文标签不是一套，某些字还会渲染成豆腐块。
  const KIND = { dream: ["完整的梦", "#8a7a9c"], fragment: ["残渣", "#7d8a9a"], none: ["没梦", "#9a9082"] };

  // ---- 词频仪表：反复出现的母题（复用 engine 的 memTokens，只取二元组，去日期类噪声）----
  function motifTop(entries, topN) {
    const cnt = new Map();
    entries.filter(e => e.kind !== "none" && e.text).forEach(e => {
      const seen = new Set(); // 同一条梦里重复词只记一次（防一条梦刷爆词频）
      memTokens(e.text).forEach(tk => {
        if (tk.length < 2 || /^[0-9]+$/.test(tk)) return;
        if (!seen.has(tk)) { seen.add(tk); cnt.set(tk, (cnt.get(tk) || 0) + 1); }
      });
    });
    return [...cnt.entries()].filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, topN || 10);
  }

  // ---- 解梦 prompt（v61.47 重接）----
  // 她 2026-09-03 问：「人设心情最近聊天防八股那些有全部喂进去吗」——**一条都没有**。
  // 原来这一处自己拼 sys：人设截到 400 字、没有心情、没有好感、没有最近聊天、
  // 反八股一条都没发。那正是 v55.87「群里的王爷变霸总」的病根形状
  //（人设只剩一个标签，空白由训练先验补上——解梦这种题材，先验就是心理测试小作文）。
  //
  // 改法照匿名信箱那次（v61.37）：走 runProbe({voice:true})，
  // buildBundle 那一整份就是白得的（人设全文/心情/好感/印象卡/记忆/反陈词滥调/
  // 居高临下/三件套/亲密反模板/内容边界），站位也从「分析师」换成「他本人在说话」。
  // 剩下三条只能靠调用点 push 的，在这儿补上——理由和匿名箱一模一样：
  //   · 回声禁令：她讲完一个梦，最顺手的开口就是把她的话原样复述一遍再问「你梦见了X？」
  //   · 语域跟场面走：睡醒了跟人讲梦，跟正经聊天不是一个分寸
  //   · 读懂这句话在做什么：她有时候只是想说说，不是来要一个解释
  function interpretInstruction(char, entry, priorMotifs, uName) {
    const motifTxt = priorMotifs && priorMotifs.length
      ? "\n· 她的梦里近来反复出现：" + priorMotifs.map(x => x[0] + "×" + x[1]).join("、") + "。若和本梦有关可以点一句，无关就别硬扯。"
      : "";
    return (uName || "她") + "刚把自己昨晚的梦（或梦的残渣）讲给你听，请你按你自己的性格给她解梦。\n"
      + "【馆规】\n"
      + "· 残渣也能解：哪怕只有一种颜色、一种情绪，也从那一点出发编织意义；素材少就少说，别脑补她没讲的情节。\n"
      + "· 用你自己的方式解：可以玄学、可以科学、可以胡说八道地可爱，但必须像你会说的话。\n"
      + "· 禁止心理诊断腔：不许出现『焦虑症』『创伤』『建议就医』这类词，你是她的人不是她的医生。\n"
      + "· 篇幅 120~250 字。"
      + motifTxt
      + "\n· 【梦签】另给一句短的『今日梦签』（十来个字），是你写给她的，不是通用吉利话——"
      + "换个角色说出来就不成立才算写对了。"
      + (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n\n" + ECHO_QUESTION_BAN : "")
      + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n\n" + REGISTER_FOLLOWS_SCENE : "")
      + (window.ReplyPacing ? "\n\n" + window.ReplyPacing.reading() : "")
      + "\n\n【这是刚睡醒的人在讲梦】她可能还迷糊、讲得颠三倒四、或者只想说说而已。"
      + "不是每次都得给她一个解释——顺着你自己的性子来。";
  }

  // ---- 语音听写（复用 Ears；没有 Ears/不支持=纯手打，不报错）----
  function DictateButton({ onText, toast }) {
    const t = useTheme();
    const [rec, setRec] = useState(false);
    const sessRef = useRef(null);
    useEffect(() => () => { if (sessRef.current) sessRef.current.cancel().catch(() => {}); }, []);
    if (!(window.Ears && window.isSecureContext)) return null;
    const toggle = async () => {
      if (rec) {
        const s = sessRef.current; sessRef.current = null; setRec(false);
        try { const r = await s.stop(); if (r && r.transcript) onText(r.transcript); } catch (e) { toast && toast(e.message || "没听清，再试一次"); }
        return;
      }
      try {
        sessRef.current = await window.Ears.start({ lang: "zh-CN", ownerKey: "dreamlog", onTranscript: onText, onSpeechError: () => {} });
        setRec(true);
      } catch (e) { toast && toast(e.message || "麦克风没开起来"); }
    };
    return h("button", { onClick: toggle, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, padding: "6px 12px", borderRadius: 999, border: "1px solid " + (rec ? "#9f5149" : t.line), color: rec ? "#9f5149" : t.sub, background: t.bg2 } }, rec ? "说完了" : "懒得打字");
  }

  // ---- D 步骤 2：TA们的梦 · 懒生成 prompt（拍板：后台池模型；梦≠记忆；剧情主权）----
  function dreamGenSys(char, row, excerpts, reality) {
    const r = reality || {};
    // ⚠️人设别再截到 300 字（v61.47）：只剩一个标签的话，空白由训练先验补上，
    //   梦就长成「谁都能做的那种梦」。反八股这两条也一起给上。
    return (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "")
      + (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "")
      + "你是「" + char.name + "」。人设：" + String(char.persona || "").slice(0, 6000) + "\n\n" +
      "你昨晚睡着后做了一场梦。下面是入梦材料——你昨天真实经历的对话片段和情绪状态。请把它们揉成一场【你的梦】。\n" +
      "【当日对话片段】\n" + (excerpts.length ? excerpts.map(x => "· " + x).join("\n") : "（昨天没什么对话，梦从情绪里长出来）") + "\n" +
      "【情绪残渣】" + (row.peaks || []).map(p => p.axis + "=" + p.value).join("、") + (row.relationActiveAxes && row.relationActiveAxes.length ? "｜关系张力：" + row.relationActiveAxes.join("、") : "") + "\n\n" +
      "【现实关系边界】" + (r.relationship || "现实中没有已确认的恋人关系") + "\n" +
      "【人名铁律】梦里允许具名的人只有：" + (r.allowedNames || "无") + "。其他人物一律写成『一个人』『看不清的人』，不得创造名字。\n\n" +
      "【梦的规则】\n" +
      "· 梦逻辑：允许扭曲、拼贴、时空错乱，白天的细节可以变形出现（雨伞变成船、对话发生在不存在的房间）；不要写成白天的复述。\n" +
      "· 第一人称，你在梦里。120~220 字。\n" +
      "· 只允许出现材料与你人设记忆里已有的人和事，绝不虚构新人名。\n" +
      "· 你和她的关系在梦里不得比现实更进一步：可以渴望、暧昧、欲言又止，但不得出现现实中未发生的关系事实（表白/婚礼/恋人称谓——除非现实已如此）。\n" +
      "· 语言像梦：具体的画面感，不解释不升华，禁止『这个梦说明』式的自我分析。\n\n" +
      "只输出 JSON（不要代码块包裹）：{\"narrative\":\"梦叙事\",\"motifs\":[\"母题≤4个,每个≤6字\"],\"tone\":\"一两个字的情绪底色\",\"wakeLine\":\"醒来后如果向她提起,你会说的一句话(口语,≤40字,以『我梦到』开头)\"}";
  }
  function parseDreamJSON(raw) {
    let s = String(raw || "").replace(/```json|```/g, "").trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { const o = JSON.parse(s.slice(a, b + 1)); return o && o.narrative ? o : null; } catch (e) { return null; }
  }

  // ---- 主组件 ----
  function DreamJournalApp(props) {
    const t = useTheme();
    const [log, setLog] = useState(loadLog);
    const [text, setText] = useState("");
    const [busyId, setBusyId] = useState(null);   // 正在解梦的 entry id
    const [pickFor, setPickFor] = useState(null); // 给哪条梦挑解梦人
    const [openMotif, setOpenMotif] = useState(false);
    // 展开的是哪一条（一次只开一条）：一条梦加上三个人的解法能有一屏那么长，
    // 全摊着的话翻半天才见到下一条（她 2026-09-04 报的）。
    const [openId, setOpenId] = useState(null);
    const [view, setView] = useState("hers");     // hers=她的梦 | theirs=TA们的梦
    const [theirs, setTheirs] = useState([]);
    const [genBusy, setGenBusy] = useState(null); // 正在生成的 dream key
    const chars = props.characters || [];
    const commit = next => { if (saveLog(next)) setLog(next); else props.toast && props.toast("这次没保存成功，原梦还在"); };
    const nameOf = id => { const c = chars.find(x => x.id === id); return c ? (c.remark || c.name) : "？"; };
    const loadTheirs = async () => { if (window.DreamLoop) setTheirs(await window.DreamLoop.listDreams(60)); };
    useEffect(() => { loadTheirs(); }, []);

    // 懒生成：点开「未醒的梦」才真正花一次调用（材料引用就地还原成片段，正文不入库）
    const generate = async (row) => {
      const taskKey = "dreamjournal:generate:" + row.key;
      const bg = window.BackgroundGeneration;
      if (genBusy && genBusy !== row.key) return;
      const char = chars.find(c => c.id === row.charId);
      if (!char) { props.toast && props.toast("角色不在了，这场梦无主"); return; }
      setGenBusy(row.key);
      try {
        const run = async () => {
          const p = props.bgApi || (props.apiFor ? props.apiFor(char.id) : null);
          if (!p) throw new Error("没有可用的 API 线路");
          const msgs = loadJSON("x_chat:" + row.charId, []) || [];
          const refs = new Map((row.materialRefs || []).filter(r => r.kind === "chat").map(r => [String(r.refId), r]));
          const excerpts = [];
          msgs.forEach((m, i) => {
            const mid = m.id || m.turnId || (String(m.ts || 0) + ":" + i);
            const ref = refs.get(String(mid));
            if (ref && m.content && window.DreamLoopCore && window.DreamLoopCore.refMatches(ref, m.content) && excerpts.length < 12) excerpts.push(String(m.content).slice(0, 80));
          });
          const cp = props.couples && props.couples[char.id];
          const relationship = cp && cp.status === "together" ? "你和她现实中已正式在一起，可以使用现实已有的恋人称谓" : cp && cp.status === "pending" ? "你向她表达过关系意愿，但现实中尚未确认成为恋人" : "你和她现实中没有已确认的恋人关系";
          const allowedNames = [char.name, char.remark, props.profile && props.profile.name].filter(Boolean).map(String).filter((x, i, a) => a.indexOf(x) === i).join("、") || "无";
          const raw = await callAI(p, dreamGenSys(char, row, excerpts, { relationship, allowedNames }), [{ role: "user", content: "开始做梦。" }], { maxTokens: 14400 });
          const gen = parseDreamJSON(raw);
          if (!gen) throw new Error("梦没成形，再试一次");
          await window.DreamLoop.saveGenerated(row.key, gen);
          return gen;
        };
        if (bg) await bg.start(taskKey, { label: nameOf(row.charId) + "的梦正在成形…" }, run); else await run();
        await loadTheirs();
      } catch (e) { props.toast && props.toast("生成失败：" + (e.message || e)); }
      finally { setGenBusy(null); }
    };

    const addEntry = kind => {
      const v = text.trim();
      if (kind !== "none" && !v) { props.toast && props.toast("先说点什么——一个画面、一种颜色都行"); return; }
      const entry = { id: uid(), ts: Date.now(), day: dayKey(Date.now()), kind: kind, text: kind === "none" ? "" : v, interpretations: [] };
      commit([entry, ...loadLog()]); // 审查修：以盘上为准合并，防云同步 pull 后被旧 state 覆盖
      setText("");
      props.toast && props.toast(kind === "none" ? "记下了：今晚无梦，睡得像块干净的硬盘" : "梦收进馆了");
    };

    const interpret = async (entry, char) => {
      const taskKey = "dreamjournal:interpret:" + entry.id + ":" + char.id;
      const bg = window.BackgroundGeneration;
      if (busyId && busyId !== entry.id) return;
      setPickFor(null);
      setBusyId(entry.id);
      try {
        const run = async () => {
          const p = props.apiFor ? props.apiFor(char.id) : null;
          if (!p) throw new Error("没有可用的 API 线路");
          const motifs = motifTop(loadLog().filter(e => e.id !== entry.id), 5);
          const body = entry.kind === "none" ? "（她说昨晚没做梦，或者什么都不记得了。）" : entry.text;
          const uName = (props.profile && props.profile.name) || "她";
          const ctx = props.ctxFor ? props.ctxFor(char) : null;
          let clean = "", sign = "";
          if (ctx && typeof runProbe === "function") {
            const d = await runProbe(p, ctx, {
              voice: true,
              instruction: interpretInstruction(char, entry, motifs, uName)
                + "\n\n【她讲的梦】\n" + body,
              schemaHint: "{\"text\":\"解梦正文\",\"sign\":\"今日梦签（一句短的，可空）\"}",
              maxTokens: 14400
            });
            clean = String((d && d.text) || "").trim();
            sign = String((d && d.sign) || "").trim();
          } else {
            // 没拿到 ctx（老调用方）也别整个坏掉：退回原来那条直发的路
            const raw = await callAI(p, interpretInstruction(char, entry, motifs, uName),
              [{ role: "user", content: "【她的梦】\n" + body }], { maxTokens: 14400 });
            clean = String(raw || "").trim();
          }
          if (!clean) throw new Error("解梦人走神了，再试一次");
          const next = loadLog().map(e => e.id === entry.id ? { ...e, interpretations: [...(e.interpretations || []), { charId: char.id, name: char.remark || char.name, text: clean, sign: sign, ts: Date.now() }] } : e);
          saveLog(next);
          return clean;
        };
        if (bg) await bg.start(taskKey, { label: (char.remark || char.name) + "正在解梦…" }, run); else await run();
        setLog(loadLog());
      } catch (e) { props.toast && props.toast("解梦失败：" + (e.message || e)); }
      finally { setBusyId(null); }
    };

    // 她读过谁的梦：只留一行梗概和情绪底色，ctxFor 会挑它塞进那个人的上下文。
    // ⚠️梦不是记忆：这儿不写记忆库、不发消息、不动好感——只是让今天的语气带上一点余味。
    const markDreamSeen = d => {
      if (!d || d.status !== "generated" || !d.charId) return;
      try {
        const all = loadJSON("x_dreamSeen", {}) || {};
        const line = String(d.narrative || "").replace(/\s+/g, " ").split(/[。！？]/).filter(Boolean)[0] || "";
        all[d.charId] = { line: line.slice(0, 120), tone: String(d.tone || "").slice(0, 8), ts: Date.now() };
        saveJSON("x_dreamSeen", all);
      } catch (e) {}
    };

    const motifs = motifTop(log, 10);
    const dreamDays = new Set(log.filter(e => e.kind !== "none").map(e => e.day)).size;
    const totalDays = new Set(log.map(e => e.day)).size;
    const byDay = [];
    log.forEach(e => { const g = byDay.find(x => x.day === e.day); if (g) g.items.push(e); else byDay.push({ day: e.day, items: [e] }); });

    // ── 装修（v61.49，她 2026-09-04：「再把界面装修一下吧」）──
    // 判据照旧：这套形状搬到别的功能上还成立吗？成立就是做坏了。
    // 解梦馆里的东西都是【夜里的】：所以整页是夜色纸，梦是压在夜色上的一张张浅纸条。
    // ⚠️底纹铺在最外面那个外壳上、顶栏透明（mobile-ui-layout.md §3.5）——
    //   铺在滚动区上的话，顶栏那一条还是平色，顶上横着一道没盖住的带子。
    const NIGHT = "#20233250";
    const nightBg = {
      background: "#1e2130",
      backgroundImage:
        // 几粒星尘：位置写死（随机的话每次重画都在动）
        "radial-gradient(1.2px 1.2px at 12% 14%, rgba(255,255,255,.5), transparent 60%),"
        + "radial-gradient(1px 1px at 78% 9%, rgba(255,255,255,.38), transparent 60%),"
        + "radial-gradient(1.4px 1.4px at 34% 32%, rgba(255,255,255,.3), transparent 60%),"
        + "radial-gradient(1px 1px at 88% 46%, rgba(255,255,255,.32), transparent 60%),"
        + "radial-gradient(1.1px 1.1px at 22% 68%, rgba(255,255,255,.26), transparent 60%),"
        + "radial-gradient(1px 1px at 64% 84%, rgba(255,255,255,.3), transparent 60%),"
        // 月亮那侧的一团淡光
        + "radial-gradient(70% 42% at 82% -6%, rgba(154,150,200,.30), transparent 70%),"
        + "linear-gradient(168deg,#232739,#1b1e2b 62%,#171a26)"
    };
    // 夜色上的字色（不跟主题走：这一页自己带底，跟着主题变会瞎）
    const NINK = "#efe9e0", NSUB = "rgba(239,233,224,.72)", NFOG = "rgba(239,233,224,.45)", NLINE = "rgba(239,233,224,.16)";
    // 梦＝压在夜色上的一张浅纸条
    const paperCard = (extra) => Object.assign({ background: "#f4efe4", borderRadius: 3,
      boxShadow: "0 8px 20px rgba(8,10,20,.42)", padding: "12px 14px", marginBottom: 10 }, extra || {});
    // 分栏＝这本梦簿书口上伸出来的三条布书签（不是一排药丸，tabs-not-plain-pills.md）
    const ribbon = (k, label) => {
      const on = view === k;
      return h("button", { key: k, onClick: () => { setView(k); if (k === "theirs") loadTheirs(); },
        className: "active:opacity-80", style: { flex: 1, minWidth: 0, position: "relative", paddingTop: 0,
          height: on ? 46 : 36, transition: "height .16s ease", background: "transparent", border: "none" } },
        // 带子本身：从页顶垂下来，选中的那条更长、更实，末端剪成燕尾
        h("div", { style: { position: "absolute", left: 6, right: 6, top: 0, bottom: 0,
          background: on ? "linear-gradient(#8d84b8,#6f6796)" : "rgba(239,233,224,.20)",
          clipPath: "polygon(0 0,100% 0,100% 100%,50% calc(100% - 7px),0 100%)",
          boxShadow: on ? "0 5px 12px rgba(10,10,25,.4)" : "none" } }),
        h("span", { style: { position: "relative", fontFamily: F_BODY, fontSize: 12,
          color: on ? "#fff" : NSUB, lineHeight: (on ? 40 : 30) + "px" } }, label));
    };
    return h("div", { className: "h-full flex flex-col", style: nightBg },
      h(Head, { zh: "解梦馆", sub: log.length + " 个夜晚", bg: "transparent", ink: NINK, onBack: props.onBack,
        // ⚠️「母题」这个词她看不懂（2026-09-04：「我都不知道母题是干啥的点了没动静」），
        //   改成说清它是什么：反复梦见的那些东西。
        right: motifs.length ? h("button", { onClick: () => { setView("hers"); setOpenMotif(!openMotif); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "反复梦见") : null }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-10" },
        // 分栏：她的梦 | TA们的梦（D 线步骤2）
        h("div", { className: "flex", style: { gap: 2, marginBottom: 14, alignItems: "flex-start" } },
          [["hers", "她的梦"], ["signs", "梦签"], ["theirs", "TA们的梦" + (theirs.filter(d => d.status === "queued").length ? " ·" + theirs.filter(d => d.status === "queued").length : "")]].map(([k, label]) => ribbon(k, label))),

        // ── 梦签册（她 2026-09-04 选的）──
        // 一张张撕下来的签，挂成一叠。每张记着是谁、为哪个梦写的。
        view === "signs" ? (function () {
          const signs = [];
          log.forEach(e => (e.interpretations || []).forEach(it => {
            if (it && it.sign) signs.push({ sign: it.sign, name: it.name, day: e.day, dream: e.text || "" });
          }));
          if (!signs.length) return h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NSUB, textAlign: "center", padding: "34px 0", lineHeight: 1.9 } },
            "还没有签。", h("br"), "找人解一次梦，他会在最后给你写一句。");
          return h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NSUB, lineHeight: 1.7, marginBottom: 12 } },
              "解梦的人在末尾写给你的那一句。攒着看，比一条一条翻回去有意思。"),
            signs.map((x, i) => h("div", { key: i, style: { position: "relative", background: "#f4efe4",
              border: "none", borderRadius: 3, padding: "13px 14px 12px", marginBottom: 10,
              transform: "rotate(" + [-0.8, 0.6, -0.4, 0.9][i % 4] + "deg)", boxShadow: "0 4px 12px rgba(60,50,70,.08)" } },
              // 签头上那个小孔和挂绳
              h("div", { "aria-hidden": "true", style: { position: "absolute", left: 13, top: 8, width: 5, height: 5,
                borderRadius: 999, background: t.line } }),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, color: "#2c2822", lineHeight: 1.5, paddingLeft: 12 } }, "「" + x.sign + "」"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8b8276", marginTop: 7, paddingLeft: 12 } },
                x.name + " · " + x.day + (x.dream ? "　为「" + x.dream.replace(/\s+/g, " ").slice(0, 14) + "…」写的" : "")))));
        })() :
        view === "theirs" ? h(React.Fragment, null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NSUB, lineHeight: 1.7, marginBottom: 10 } }, "TA们睡着时把白天揉成的梦。写着「未醒的梦」的还没成形，点一下才写出来（此刻才花钱）；平静的夜没有梦，那也是真的。梦永远只是梦，不会进记忆。"),
          !theirs.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NSUB, textAlign: "center", padding: "30px 0", lineHeight: 1.8 } }, "还没有排队的梦。", h("br"), "今晚他们睡着 90 分钟后，第一批就来。") : null,
          (() => { const byNight = []; theirs.forEach(d => { const g = byNight.find(x => x.night === d.nightKey); if (g) g.items.push(d); else byNight.push({ night: d.nightKey, items: [d] }); }); return byNight.map(g => h("div", { key: g.night, style: { marginBottom: 14 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NFOG, marginBottom: 7 } }, g.night + " 夜"),
            g.items.map((d, di) => h("div", { key: d.key, style: paperCard({ marginBottom: 9, transform: "rotate(" + [0.4, -0.5, 0.3][di % 3] + "deg)" }) },
              h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: "#2c2822" } }, nameOf(d.charId)),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8b8276" } }, d.status === "queued" ? "未醒的梦" : d.status === "no_dream" ? "无梦之夜" : (d.tone || "有梦"))),
              d.status === "queued" ? h("button", { onClick: () => generate(d), disabled: !!genBusy, className: "w-full py-2 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12 } }, genBusy === d.key ? "梦正在成形…" : "轻轻推醒这场梦") : null,
              d.status === "no_dream" ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, ({ calm_night: "那晚心里太平静，一夜无梦。", no_material: "那天没说上什么话，梦没有材料。" })[d.reason] || "一夜无梦。") : null,
              d.status === "generated" ? h(React.Fragment, null,
                h("div", { style: Object.assign({ fontFamily: F_BODY, fontSize: 13, color: "#2c2822", lineHeight: 1.8, whiteSpace: "pre-wrap" },
                  openId === d.key ? null : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }, d.narrative),
                // 展开＝她真的读了这场梦（她 2026-09-04：「看了他们的梦之后发给他们进上下文
                // 记得这件事，但是不要做卡片就只是轻轻地让他带着这段梦境的感受和我相处」）。
                // ⚠️不弹卡片、不发消息、不写记忆——只在 x_dreamSeen 留一行，
                //   由 ctxFor 挑成一句轻的塞进他的上下文，三天自己过期。
                h("button", { onClick: () => { const on = openId === d.key; setOpenId(on ? null : d.key); if (!on) markDreamSeen(d); },
                  className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#6f6796", marginTop: 6 } },
                  openId === d.key ? "合上" : "展开这场梦"),
                (d.motifs || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, d.motifs.map(m => h("span", { key: m, style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, padding: "1px 8px", borderRadius: 999 } }, m))) : null,
                d.wakeLine ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 8, borderTop: "1px dashed " + t.line, paddingTop: 6 } }, "醒来他大概会说：「" + d.wakeLine + "」") : null) : null)))); })()
        ) : h(React.Fragment, null,

        // 母题仪表（潜意识词频）
        openMotif && motifs.length ? h("div", { style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 12px", marginBottom: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } }, "你的潜意识常客（出现≥2次）· 记梦率 " + dreamDays + "/" + totalDays + " 天"),
          h("div", { className: "flex flex-wrap", style: { gap: 6 } }, motifs.map(([w, n]) => h("span", { key: w, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, padding: "2px 9px", borderRadius: 999 } }, w + " ×" + n)))) : null,

        // 今日采集卡
        h("div", { style: paperCard({ marginBottom: 16, padding: "13px 14px 14px" }) },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
            h(Eyebrow, null, "刚醒？趁没蒸发"),
            h(DictateButton, { onText: v => setText(x => (x ? x + " " : "") + v), toast: props.toast })),
          h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 3, placeholder: "梦到什么都行——一个画面、一种颜色、一句醒来还记得的话。残渣也是梦。", className: "w-full outline-none p-3 rounded-lg", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: "#2c2822", background: "rgba(255,255,255,.55)", border: "1px solid rgba(120,100,70,.2)", resize: "none" } }),
          h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            h("button", { onClick: () => addEntry("dream"), className: "flex-1 py-2 active:opacity-70", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, "记完整的梦"),
            h("button", { onClick: () => addEntry("fragment"), className: "flex-1 py-2 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12.5 } }, "只有残渣"),
            h("button", { onClick: () => addEntry("none"), className: "py-2 px-3 active:opacity-70", style: { borderRadius: 8, border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 12.5 } }, "没梦"))),

        // 历史（按天分组）
        byDay.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NSUB, textAlign: "center", padding: "30px 0", lineHeight: 1.8 } }, "馆里还空着。", h("br"), "明早睁眼第一件事：来这儿嘟囔十秒。") : null,
        byDay.map(g => h("div", { key: g.day, style: { marginBottom: 14 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NFOG, marginBottom: 7, letterSpacing: ".04em" } }, g.day),
          g.items.map((e, ei) => h("div", { key: e.id, style: paperCard({ marginBottom: 9, transform: "rotate(" + [-0.5, 0.4, -0.3][ei % 3] + "deg)" }) },
            h("div", { className: "flex items-center justify-between", style: { marginBottom: e.text ? 6 : 0 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#fff", background: (KIND[e.kind] || KIND.dream)[1], padding: "1px 8px", borderRadius: 999 } }, (KIND[e.kind] || KIND.dream)[0]),
              h("div", { className: "flex", style: { gap: 10 } },
                h("button", { onClick: () => setPickFor(pickFor === e.id ? null : e.id), disabled: !!busyId, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, busyId === e.id ? "解梦中…" : "找TA解"),
                h("button", { onClick: () => requestAppConfirm("删掉这条梦？", "解读也会一起消失。", () => commit(loadLog().filter(x => x.id !== e.id)), "删除"), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "删"))),
            // 正文：收起来时只露两行（她 2026-09-04：「一条很容易变很长翻好久才到下一条」）
            e.text ? h("div", { style: Object.assign({ fontFamily: F_BODY, fontSize: 13, color: "#2c2822", lineHeight: 1.75, whiteSpace: "pre-wrap" },
              openId === e.id ? null : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }, e.text) : null,
            // 展开/收起：解法有几条也写在这一行上，收着的时候看得出这条底下还有东西
            (e.text && e.text.length > 40) || (e.interpretations || []).length
              ? h("button", { onClick: () => setOpenId(openId === e.id ? null : e.id), className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: 11.5, color: "#6f6796", marginTop: 6 } },
                  openId === e.id ? "收起" : ((e.interpretations || []).length ? "展开 · " + e.interpretations.length + " 个人解过" : "展开"))
              : null,
            pickFor === e.id ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, chars.map(c =>
              h("button", { key: c.id, onClick: () => interpret(e, c), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 11px", borderRadius: 999, border: "1px solid " + t.line, color: t.ink, background: t.bg2 } }, c.remark || c.name))) : null,
            openId === e.id ? (e.interpretations || []).map((it, i) => h("div", { key: i, style: { marginTop: 9, background: "rgba(111,103,150,.10)", borderRadius: 2, padding: "9px 11px", borderLeft: "3px solid #6f6796" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#7b7286", marginBottom: 4 } }, it.name + " 的解法"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#2c2822", lineHeight: 1.75, whiteSpace: "pre-wrap" } }, it.text),
              // 梦签：单独一行，像从解梦正文里撕下来的那一条（v61.47 起单独一个字段；
              // 旧记录没有这一栏，不显示就是了）
              it.sign ? h("div", { style: { marginTop: 9, paddingTop: 8, borderTop: "1px dashed rgba(111,103,150,.35)",
                fontFamily: F_DISPLAY, fontSize: 13.5, color: "#5d5588", letterSpacing: ".02em" } }, "「" + it.sign + "」") : null)) : null))))),
      )
    );
  }

  // 主屏图标：月亮抱着一本摊开的书（和「梦境」app 的图标区分开）
  window.GDreamBook = function (props) {
    const size = (props && props.size) || 34, color = (props && props.color) || "#1b1a17";
    return h("svg", { width: size, height: size, viewBox: "0 0 48 48", fill: "none" },
      h("path", { d: "M31 7a13 13 0 1 0 10 20 15 15 0 1 1-10-20z", stroke: color, strokeWidth: 2.6, strokeLinejoin: "round" }),
      h("path", { d: "M10 32c4-2 8-2 12 0 4-2 8-2 12 0", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" }),
      h("path", { d: "M10 32v7c4-2 8-2 12 0 4-2 8-2 12 0v-7", stroke: color, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" }),
      h("path", { d: "M22 32v7", stroke: color, strokeWidth: 2, strokeLinecap: "round" }));
  };

  window.DreamJournalApp = DreamJournalApp;
})();
