// ============================================================
// 梦境（dream）—— 进入角色的梦，不是聊天框
// · 这场梦属于某个角色、为 Ta 而做，顺着 Ta 内心的渴望/执念/恐惧铺展
// · 我（user）是闯进梦里的客人，不能自由行动，只能在 char 给的选项里选
// · 每幕 3 个选项：2 个是这场梦所期待/顺应的，1 个是 char 内心抗拒的
//   —— 字面上分不出哪个是哪个；选到「抗拒」项 → 梦先挣扎一幕（v63.04），再选一次：
//      安抚对了 → 直面（第四种结局）；错了 → 梦碎、被惊醒踢出梦境。一场梦只给一次挣扎
//   —— 一直没选到抗拒，剧情就一直往深处走下去，够深了再顺一步 → 抵达梦核
// · 合龙（v62.99）：解梦馆里 Ta 昨晚真做的梦可以推门进来，材料是 Ta 昨天真过的一天（sessionFromLoop）
// · 带东西出来（v63.05）：抵达或直面时，梦里会落一样东西在你手里；「带出梦去」进她的物品，
//   Ta 见了会莫名眼熟（不知道它来自自己的梦，永远不说破）——她握着一个 Ta 自己都不知道的秘密
// · 熟不熟（v63.08）：好感/印象卡/记忆攒出档位，越熟逆鳞那条路越露破绽（familiarityTier）
// · 碎掉的梦会回来（v63.09）：从真梦进来、半路碎的，隔 2~7 晚 Ta 会再做一次；进去从碎之前接着做，选项重给（recur）
// · 可同时开很多场梦；发起时可递 3 个关键词，让 char 把它们编进梦里
// 存 localStorage x_dream_saves（随云同步）；模型走全局 callAI + ANTI_CLICHE。
// 记忆不互通：只把最近聊天当语气参考，梦醒后什么都不写回记忆库。
// ============================================================
(function () {
  const ACCENT = "#6a5b86";      // 梦的主色（雾紫）——填色用它
  // ── 夜（v62.62 审美审计点名）─────────────────────────────────────
  // 审计原话：这三页「米白 + 圆角卡 + 徽标，没有一样属于梦」，而且是「最可惜的一处」——
  // core.js 里 SKIN_PATS.night（星点）现成摆着，一直没人用。
  // 梦不发生在米白的纸上。这三页整个进夜色：底是 pageSkin("night")，
  // 字、线、卡全部换成夜里那一套。
  // ⚠️不重写结构，只把取色的那个 t 换掉（跟 v62.61 歌单同一个手法）——
  //   幕、选项、回档、结局块本来的排布是对的，动它们纯属把好东西改坏。
  const DREAM_NIGHT = "#161a24";
  const NIGHT = {
    bg: DREAM_NIGHT, bg2: "rgba(232,230,240,.055)", ink: "#e8e6f0",
    sub: "rgba(232,230,240,.70)", fog: "rgba(232,230,240,.42)",
    line: "rgba(232,230,240,.14)", tint: "#a99ac9", accent: "#a99ac9"
  };
  // 雾紫在夜里做【字】太暗，读不出来；做【填色】正好。所以分成两支：
  // ACCENT 只用来填按钮和药丸，ACC_LIT 用来写字和画线。
  const ACC_LIT = "#a99ac9";
  const GOOD_LIT = "#7fc0a0";    // 抵达（原 #4f8a6a 在夜里发黑）
  const BAD_LIT = "#d98a8a";     // 梦碎（原 #a24a4a 同理）
  const dreamPage = () => (typeof pageSkin === "function")
    // strength 压到 .55：满强度时那两层星点是【等距的点阵】，看着像织物纹理不像夜空，
    // 而且 17px / 29px 两层还会打出摩尔纹。压下去之后它退成「远处有几点光」。
    ? pageSkin("night", NIGHT, { base: DREAM_NIGHT, tint: "169,154,201", corner: true, strength: .55 })
    : { background: DREAM_NIGHT };
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");
  // 反八股那一整套（去人机味／角色卡准则／线下叙事准则／叙事反陈词滥调／语气年龄锚）。
  // v61.48 之前这儿只有 AC+NAC 两条——梦是连续叙事正文，该吃的是 narrativeCore 那一份，
  // 跟穿书、小剧场同一套（施工规则/four-surfaces-same-context.md）。
  // ⚠️禁烟这一层：narrativeCore 里已经带了（v63.100 挪进去的），所以这儿不再单push一遍。
  //   但 narrativeCore 不在的那条兜底路（AC()+NAC()）拿不到，得自己补上——
  //   兜底路少一层规矩，就是「换个入口就什么都没有」那个形状。
  const CORE = () => (typeof narrativeCore === "function" ? narrativeCore({ intimate: true }) + "\n\n"
    : AC() + NAC() + (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : ""))
    + (typeof CONDESCENDING_TONE_BAN !== "undefined" ? CONDESCENDING_TONE_BAN + "\n\n" : "");
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function loadSaves() { return loadJSON("x_dream_saves", []); }
  function saveSaves(list) { return saveJSON("x_dream_saves", list); }

  // 角色最近聊天抓一小段，仅当语气/近况参考（梦醒后不写回）
  // ⚠️取材的过滤条件必须和别处一致（engine.js 那句「所有角色视角的取材都用它过滤」）：
  // 撤回的那句角色本来就不该记得，被上下文开关排除的那些也是。原来这里只挡了 OOC。
  // ⚠️还要【先过滤再取尾】：先 slice 的话，一段撤回的能把真正有用的几句挤没。
  function recentChatSnippet(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs
      .filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant") && !isOocMsg(m)
        && !m.recalled && (typeof contextAllowsMessage !== "function" || contextAllowsMessage(m)))
      .slice(-12)
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 80))
      .join("\n");
  }

  // 已发生的梦（喂续写用）：每幕叙事 + 我当时选了什么
  function transcript(session, uName) {
    const lines = [];
    (session.scenes || []).forEach((sc, i) => {
      lines.push("〔第" + (i + 1) + "幕〕" + String(sc.text || "").replace(/\s+/g, " "));
      if (sc.chosen != null && sc.options && sc.options[sc.chosen]) {
        lines.push("（" + uName + "选择了：" + sc.options[sc.chosen].text + "）");
      }
    });
    return lines.join("\n").slice(-4000);
  }

  // 校验/归一模型给的选项：确保是 3 个、恰好 1 个 resist（抗拒），其余 accord；再打乱顺序
  function normOptions(raw) {
    let opts = (Array.isArray(raw) ? raw : [])
      .map(o => ({ text: String((o && o.text) || "").trim(), kind: (o && o.kind) === "resist" ? "resist" : "accord" }))
      .filter(o => o.text);
    if (opts.length < 3) return null;
    opts = opts.slice(0, 3);
    const resists = opts.filter(o => o.kind === "resist");
    if (resists.length === 0) opts[opts.length - 1].kind = "resist";          // 一个都没标 → 最后一个当抗拒
    else if (resists.length > 1) {                                            // 标多了 → 只留第一个抗拒
      let kept = false;
      opts = opts.map(o => o.kind === "resist" ? (kept ? { text: o.text, kind: "accord" } : (kept = true, o)) : o);
    }
    return shuffle(opts);
  }

  // ── 熟不熟（v63.08，玩法④）──────────────────────────────────────────
  // 逆鳞在字面上分不出来，等于掷骰子。现在：你对 Ta 越熟，逆鳞那条路越露破绽。
  // 「熟」不是一个数值，是你们真攒出来的东西：好感、印象卡厚不厚、记忆库里有多少条是 Ta 知道的。
  //   0 生：三条路一模一样，只能凭心；
  //   1 熟：抗拒项的措辞里留一处轻微的不对劲（一个 Ta 不会用的词、一个不像 Ta 的小动作）；
  //   2 很熟：那条路走起来明显不像 Ta 的梦会给的，细读认得出来。
  // 档位在进梦时定下，写进存档；这场梦里不变。
  function familiarityTier(f) {
    f = f || {};
    const aff = Number(f.affinity); let score = 0;
    if (isFinite(aff) && aff >= 50) score++;
    if (isFinite(aff) && aff >= 75) score++;
    if (Number(f.gazeLen) >= 150) score++;
    if (Number(f.memCount) >= 15) score++;
    return score >= 3 ? 2 : score >= 1 ? 1 : 0;
  }
  const FAMILIAR_LINE = ["你对 Ta 还生——三条路一模一样，只能凭心。", "你和 Ta 熟了些——有一条的措辞不太像 Ta，细读。", "你很懂 Ta——走起来不像 Ta 的那条，你认得出来。"];
  function familiarityRule(tier, nm) {
    if (tier >= 2) return "【客人很懂 " + nm + "】抗拒项要留【一处明显些】的破绽：那条路走起来不像 " + nm + " 的梦会给的——口吻、物件、场合里有一样是错的，细读能认出来；另外两条必须都像 " + nm + "。破绽只许一处，别解释、别加重。";
    if (tier >= 1) return "【客人和 " + nm + " 已经熟了些】抗拒项的措辞里留【一处轻微】的不对劲——一个 " + nm + " 不会用的词、一个不像 " + nm + " 会顺手做的小动作——熟人能觉出来，生人看不出来。只此一处，别解释、别加重。";
    return "";
  }
  // stage: open 入梦 / rise 渐深 / deep 临近梦核；canFinal 允许模型标可收束；forceFinal 本幕必须逼到梦核边缘
  function sceneRules(cotT, opts) {
    opts = opts || {};
    const nm = opts.charName || "做梦人";
    const stage = opts.stage || "open";
    const stageLine = stage === "open"
      ? "· 【这一幕的位置：入梦】把梦的门推开、把客人放进去，先立起一个【具体、抓得住】的场景（有地点、有在场的人或物、有正在发生的事），一眼看得出这是「" + nm + "」的梦。"
      : stage === "deep"
      ? "· 【这一幕的位置：临近梦核】梦该收拢了：朝这场梦真正围着转的那个东西（" + nm + " 心里最深的渴望，或最怕、最不愿面对的真相）逼近，让它快浮出水面——别再横向铺无关的新枝节。"
      : "· 【这一幕的位置：渐深】让上一幕的场景/人/意象【变形、复现或被推翻升级】，把情绪与张力往上顶一档、推出新的情节转折，别平移、别复读上一幕。";
    const finalLine = opts.forceFinal
      ? "\n· 【这场梦已经够深了】这一幕写成「就差最后一步就能抵达梦核」的临界感，并把 final 设为 true。"
      : opts.canFinal
      ? "\n· 若你判断梦已经走到了它核心的边缘、再顺一步就该抵达并揭开那个最深的东西，就把 final 设为 true（否则 false）——抵达与否交给客人下一次选择。"
      : "";
    return "\n\n【怎么写这一幕】\n" +
      stageLine + "\n" +
      "· 用第二人称『你』，130~280 字。氛围要像梦：细节鲜明却哪里不对劲、逻辑会打滑、情绪被放大——但【必须有具体发生的情节】（场景＋对象＋动作/对话/事件），不能是纯情绪、纯意识流的漂浮描写。梦可以怪诞，但始终要有抓得住的东西在推进，别越写越虚。\n" +
      "· 【角色色彩·硬要求】这一幕的场景、出现的人、反复的意象，都要从「" + nm + "」自己的人设、Ta 和你的关系、Ta 的近况里长出来，是【只有 Ta 会做的梦】——把人物、地点、心结换成别人就不成立。绝不写放之四海皆准的通用梦意象堆砌。\n" +
      "· 然后给『你』三个可做的回应/行动：其中【两个】顺着这场梦、能让它继续往下走；【剩一个】戳到 " + nm + " 内心抗拒、不愿被打破的东西，一旦选中梦就碎。三个字面上都像合理选择，别露出哪个安全哪个危险、别用语气暗示；抗拒项是「看着无害、却恰好碰了逆鳞」。" +
      (familiarityRule(opts.familiarity || 0, nm) ? "\n· " + familiarityRule(opts.familiarity || 0, nm) : "") +
      finalLine +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "\n【输出】只输出 JSON：{\"scene\":\"梦境叙事\"," + ((opts.canFinal || opts.forceFinal) ? "\"final\":true或false," : "") + "\"options\":[{\"text\":\"…\",\"kind\":\"accord\"},{\"text\":\"…\",\"kind\":\"accord\"},{\"text\":\"…\",\"kind\":\"resist\"}]}。别加解释。";
  }

  // 合龙（v62.99）：这场梦是 Ta 昨晚在梦回路里真做的，材料不是她递的三个关键词，
  // 是 Ta 昨天真过过的一天。梦回路已经把材料攒好了（引用+情绪残渣+关系张力），
  // 这儿只是把它端给织梦的模型。要是解梦馆里已经把那场梦的叙事生成过了，
  // 那段就是底稿——这场梦得从它长出来，意象、地点、人都沿用，可以变形，不能另起炉灶。
  function loopMaterialBlock(session) {
    const m = session.material; if (!m) return "";
    let s = "\n\n【这场梦不是编的：是「" + session.charName + "」昨晚（" + (session.nightKey || "") + " 夜）真做的梦】\n" +
      "· 昨天真实发生过的对话片段：\n" + ((m.excerpts || []).length ? m.excerpts.map(x => "  - " + x).join("\n") : "  （昨天没说上什么话，梦从情绪里长出来）") + "\n" +
      "· 睡前的情绪残渣：" + ((m.peaks || []).map(p => p.axis + "=" + p.value).join("、") || "（平）") +
      ((m.axes || []).length ? "｜关系张力：" + m.axes.join("、") : "") + "\n" +
      ((m.motifs || []).length ? "· 这场梦的母题：" + m.motifs.join("、") + (m.tone ? "（底色：" + m.tone + "）" : "") + "\n" : "") +
      (m.narrative ? "· Ta 醒来还记得的那段（第一人称，是这场梦的底稿——这场梦要从它长出来，意象、地点、人都沿用，可以变形、可以更深，不能另起炉灶）：\n" + String(m.narrative).slice(0, 1200) + "\n" : "") +
      "· 【现实关系边界】" + (m.relationship || "现实中没有已确认的恋人关系") + "\n" +
      "· 【人名铁律】梦里允许具名的人只有：" + (m.allowedNames || "无") + "。其他人物一律写成『一个人』『看不清的人』，不得创造名字。";
    const r = session.recur;
    if (r) s += "\n\n【这场梦 Ta 不是第一次做】" + (r.firstNight ? r.firstNight + " 夜" : "上次") + "做到第 " + r.brokenAt + " 幕，在「" + r.wrongText + "」那一步碎了" +
      (r.whyWrong ? "（" + r.whyWrong + "）" : "") + "。这几天你们又聊过——材料在上面。梦回到碎之前的地方接着做，" +
      "但 Ta 心里的重量已经变了：接下来这一幕的三条路要重新给，逆鳞可以挪位置、可以变形、可以不再是上次那件事，别照搬上次；上次碎在哪儿，Ta 的潜意识记得，会绕着走一点。";
    return s;
  }
  // 把梦回路里的一行做成梦境 app 的一场戏
  function sessionFromLoop(row, props) {
    const c = (props.characters || []).find(x => x.id === row.charId); if (!c) return null;
    const uName = (props.profile && props.profile.name) || "我";
    const cp = props.couples && props.couples[c.id];
    const relationship = cp && cp.status === "together" ? "Ta 和你现实中已正式在一起，可以使用现实已有的恋人称谓"
      : cp && cp.status === "pending" ? "Ta 向你表达过关系意愿，但现实中尚未确认成为恋人"
      : "Ta 和你现实中没有已确认的恋人关系：梦里可以渴望、暧昧、欲言又止，但不得出现现实中未发生的关系事实";
    const allowedNames = [c.name, c.remark, props.profile && props.profile.name].filter(Boolean).map(String).filter((x, i, a) => a.indexOf(x) === i).join("、") || "无";
    // 回来的梦（v63.09）：找到上次碎掉的那场，从碎之前那一幕接着做——碎的那一幕整个丢掉，重新给选项
    let recur = null, carried = [];
    if (row.recurOf) {
      const orig = loadSaves().find(x => x.loopKey === row.recurOf && x.status === "broken");
      if (orig) {
        const sc = orig.scenes || [];
        let cut = sc.findIndex(x => x && x.chosen != null && x.options && x.options[x.chosen] && x.options[x.chosen].kind === "resist");
        if (cut < 0) cut = Math.max(0, sc.length - 1);
        carried = sc.slice(0, cut).map(x => Object.assign({}, x));
        recur = { origId: orig.id, brokenAt: cut + 1, wrongText: orig.wrongText || "", whyWrong: orig.whyWrong || "", firstNight: orig.nightKey || "" };
      }
    }
    return {
      id: "dm_" + Date.now(),
      loopKey: row.key, nightKey: row.nightKey, fromLoop: true,
      recur: recur,
      charId: c.id, charName: c.name, charPersona: c.persona || "",
      moodLine: (function () { const m = props.moodOf ? props.moodOf(c.id) : ""; return m ? String(m) : ""; })(),
      affLine: (function () { const a2 = props.affinityLineOf ? props.affinityLineOf(c.id) : ""; return a2 ? String(a2) : ""; })(),
      gazeText: (function () { try { return (window.Gaze && window.Gaze.text) ? String(window.Gaze.text(c.id, uName) || "").slice(0, 700) : ""; } catch (e) { return ""; } })(),
      keywords: [], guests: [], injectChat: true,
      familiarity: familiarityTier(props.familiarityOf ? props.familiarityOf(c.id) : null),
      voiceRef: recentChatSnippet(c.id, uName, c.name),
      material: {
        excerpts: (window.DreamLoop && window.DreamLoop.excerptsFor) ? window.DreamLoop.excerptsFor(row, 12) : [],
        peaks: row.peaks || [], axes: row.relationActiveAxes || [],
        motifs: row.motifs || [], tone: row.tone || "", narrative: row.narrative || "", wakeLine: row.wakeLine || "",
        relationship, allowedNames
      },
      scenes: carried, status: "dreaming", ending: "",
      createdTs: Date.now(), lastTs: Date.now()
    };
  }
  // 梦结束了，把结果记回梦回路，并决定 Ta 早上讲不讲（x_dreamSeen 的 mode，由 ctxFor 读）：
  //   抵达 → tell：Ta 会主动跟她提一句这个梦；梦碎 → vague：只说「做了个乱七八糟的梦」；
  //   自己醒 → seen：跟她在解梦馆翻过一遍一样，不主动提。
  // ⚠️梦≠记忆：这儿不写记忆库、不动好感心情，只留一行三天过期的余味。
  function settleLoopDream(session, outcome) {
    if (!session || !session.loopKey) return;
    try { if (window.DreamLoop && window.DreamLoop.markEntered) window.DreamLoop.markEntered(session.loopKey, { sessionId: session.id, outcome }); } catch (e) {}
    try {
      const all = loadJSON("x_dreamSeen", {}) || {};
      const m = session.material || {};
      const line = (outcome === "fulfilled" || outcome === "faced") ? (session.dreamCore || m.wakeLine || m.narrative || "").replace(/\s+/g, " ").slice(0, 120)
        : (m.wakeLine || m.narrative || "").replace(/\s+/g, " ").slice(0, 120);
      all[session.charId] = { line, tone: String(m.tone || "").slice(0, 8), ts: Date.now(),
        mode: (outcome === "fulfilled" || outcome === "faced") ? "tell" : outcome === "broken" ? "vague" : "seen" };
      saveJSON("x_dreamSeen", all);
    } catch (e) {}
  }

  function charBlock(session) {
    // ⚠️人设不许再截到 900 字（v61.48，她 2026-09-04：「保证解梦和做梦都喂 bundle 进去吧」）。
    //   梦是从这个人心里长出来的东西——人设只剩一个标签时，空白由训练先验补上，
    //   梦就长成「谁都会做的那种梦」（v55.87 王爷变霸总的同一个形状）。
    // ⚠️心情和好感也要给：这场梦顺着 Ta【此刻】的状态铺，不是顺着一份静态设定。
    //   梦仍旧是平行沙盒——【读】主线状态，【写】一律不回（醒来什么都不留），
    //   这跟闭群那条规矩是同一条界线。
    let s = "【做这场梦的人是「" + session.charName + "」】\n· 人设：" + (session.charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 6000) +
      (session.moodLine ? "\n· 此刻心情：" + session.moodLine : "") +
      (session.affLine ? "\n· " + session.affLine : "") +
      (session.gazeText ? "\n\n【Ta 眼里的你（只读，别在梦里复述这张卡）】\n" + session.gazeText : "") +
      (session.voiceRef ? "\n\n【Ta 近期的语气 / 近况，仅作参考】\n" + session.voiceRef : "");
    const guests = (session.guests || []).filter(g => g && g.name);
    if (guests.length) {
      s += "\n\n【这场梦里还会出现这些人（" + session.charName + " 梦见的其他角色）】\n" +
        "他们要作为真正的角色进入梦境，不是背景板。梦怎么呈现他们——样子、态度、在梦里对你或对 " + session.charName + " 做什么——都要顺着「" + session.charName + "」此刻对他们的真实感觉长出来（爱慕会美化、忌惮会扭曲、愧疚会纠缠、思念会朦胧、憎恶会狰狞）。";
      guests.forEach((g, i) => {
        s += "\n\n" + (i + 1) + ".「" + g.name + "」\n· 人设：" + (g.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 500);
        if (g.relText) s += "\n· " + session.charName + " 此刻对 Ta 的看法/关系：" + g.relText;
        else s += "\n· （没有设定 " + session.charName + " 和 Ta 认识）——请你读两人的人设，合理判断此刻 " + session.charName + " 会怎么看待、怎么感觉 Ta，再据此把 Ta 编进梦里，别生硬。";
        if (g.voiceRef) s += "\n· Ta 近期的语气 / 近况（仅参考）：\n" + g.voiceRef;
      });
    }
    s += loopMaterialBlock(session);
    return s;
  }

  // ---- 模型：编织第一幕 ----
  async function weaveFirst(active, session, worldbook, uName) {
    const kw = (session.keywords || []).filter(Boolean);
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在为「" + session.charName + "」编织一场梦。这场梦属于 Ta、为 Ta 而做——梦境顺着 Ta 内心最深的渴望、执念与恐惧铺展。" +
      uName + " 是闯进这场梦的客人，无法自由行动，只能在你给出的选项里选择怎么回应。\n\n" +
      charBlock(session) +
      (worldbook && worldbook.trim() ? (typeof WORLDBOOK_RULE !== "undefined" ? "\n\n" + WORLDBOOK_RULE : "") + "\n\n【世界书】\n" + worldbook.trim() : "") +
      (kw.length ? "\n\n【" + uName + "递来的关键词，把它们自然编进这场梦】" + kw.join("、") : "") +
      "\n\n这是开场第一幕：把梦的门推开，让 " + uName + " 落进 " + session.charName + " 的梦里。" +
      (session.material ? "这场梦 Ta 昨晚真的做过（材料在上面）——门推开之后落进去的，得是【那场梦】：同一个地方、同一些人、同一股情绪，只是这回她也在里面。" : "") +
      sceneRules(cotT, { stage: "open", charName: session.charName, familiarity: session.familiarity || 0 });
    const raw = await callAI(active, sys, [{ role: "user", content: "开始做梦。" }], { maxTokens: 12000 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    const opts = normOptions(p.options);
    if (!p.scene || !opts) throw new Error("梦没成形，重试");
    return { text: String(p.scene).trim(), options: opts, chosen: null, cot: sp.cot };
  }

  // ---- 模型：顺着选择往下做（续写下一幕） ----
  // 阶段随已走幕数推进：3 幕后模型可标 final、5 幕后强制逼近梦核 → 梦有弧线、不无限飘
  async function weaveNext(active, session, worldbook, uName) {
    const done = (session.scenes || []).length;
    const canFinal = done >= 3;
    const forceFinal = done >= 5;
    const stage = (canFinal || forceFinal) ? "deep" : "rise";
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在继续为「" + session.charName + "」编织同一场梦。" + uName + " 是闯梦的客人，刚在上一幕做了选择，且这个选择是这场梦所接纳的——梦没有碎，顺着做梦人的心愿往更深处走。\n\n" +
      charBlock(session) +
      (worldbook && worldbook.trim() ? (typeof WORLDBOOK_RULE !== "undefined" ? "\n\n" + WORLDBOOK_RULE : "") + "\n\n【世界书】\n" + worldbook.trim() : "") +
      "\n\n【梦到目前为止】\n" + transcript(session, uName) +
      "\n\n接着上一幕 " + uName + " 的选择往下写新的一幕：推进新情节、让梦更贴近 " + session.charName + " 藏着的东西，别原地打转、别复读上一幕。" +
      sceneRules(cotT, { stage: stage, canFinal: canFinal && !forceFinal, forceFinal: forceFinal, charName: session.charName, familiarity: session.familiarity || 0 });
    const raw = await callAI(active, sys, [{ role: "user", content: "继续做梦。" }], { maxTokens: 12000 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    const opts = normOptions(p.options);
    if (!p.scene || !opts) throw new Error("梦没接上，重试");
    return { text: String(p.scene).trim(), options: opts, chosen: null, cot: sp.cot, final: forceFinal || !!p.final };
  }

  // ---- 带东西出来（v63.05）：结局那一次调用顺手多要一样东西，不另花一次 ----
  // 它得是【能拿在手里的小东西】：一片叶子、一把没齿的钥匙、一张写了半句话的纸——不是一句话、不是一种感觉。
  // 名字 ≤8 字；note 是它在梦里是什么（≤40 字），带出去之后她自己看。
  const KEEPSAKE_ASK = "\n③ 这场梦收束时，有一样东西落在了『你』手里，醒来还攥着（keepsake）：一件【具体、小、能拿在手里】的东西，" +
    "是这场梦里出现过的、或从梦核那件事上掉下来的一片——不是一句话、不是一种感觉、不是抽象的意象。name ≤8 字；note 一句（≤40 字）说它在梦里是什么。\n";
  const normKeepsake = raw => {
    const name = String(raw && raw.name || "").replace(/\s+/g, " ").trim().slice(0, 12);
    if (!name) return null;
    return { name, note: String(raw && raw.note || "").replace(/\s+/g, " ").trim().slice(0, 60), taken: false };
  };
  // ---- 模型：抵达梦核（一路选对、够深了、再顺一步 → 圆满收束，第三种结局） ----
  async function weaveEnding(active, session, worldbook, uName, chosenText) {
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在收束「" + session.charName + "」的这场梦——这次不是梦碎。" + uName + " 一路都选对了，梦没有崩，反而顺着做梦人的心一直走到了它的核心。" + uName + " 刚选择了「" + chosenText + "」，这一步把梦带到了它真正围着转的那个东西面前。\n\n" +
      charBlock(session) +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      "\n\n【梦到目前为止】\n" + transcript(session, uName) +
      "\n\n① 写抵达梦核的这一幕（arrive，160~320字，第二人称『你』）：让整场梦收束到它最深处那个【具体的渴望/执念/恐惧】上——把它揭开，让它成真、或让 " + session.charName + " 终于直面它。这是全梦的情绪高点，顺着这一路走来的基调与 Ta 的人设去写：可以温柔、可以酸楚、可以释然、可以惊心，但要有具体的画面和落点，不是抽象升华、不是空转的意识流。最后梦【温和地、走完了地】合上——不是被赶出去，是抵达终点后自然醒来。\n" +
      "② 再抽离出来，点破这场梦到底关于什么（core，40~90字，旁白口吻）：这场梦一路在绕的，其实是 " + session.charName + " 心里的什么。具体、贴人设，别空泛。" +
      KEEPSAKE_ASK +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "【输出】只输出 JSON：{\"arrive\":\"抵达梦核的叙事\",\"core\":\"这场梦其实是关于什么\",\"keepsake\":{\"name\":\"东西的名字\",\"note\":\"它在梦里是什么\"}}。别加别的。";
    const raw = await callAI(active, sys, [{ role: "user", content: "抵达梦核。" }], { maxTokens: 11500 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    return { arrive: String(p.arrive || sp.clean || "梦走到了最深处，然后温柔地合上。你缓缓醒来，胸口还留着余温。").trim(), core: String(p.core || "").trim(), keepsake: normKeepsake(p.keepsake), cot: sp.cot };
  }

  // ---- 模型：挣扎（v63.04，玩法③）——踩到逆鳞不立刻碎，梦先变质一幕，给一次安抚的机会 ----
  // 原来逆鳞在字面上分不出来，踩到即碎，等于掷骰子，玩家什么都学不到。
  // 现在：踩到 → 梦变质、Ta 的潜意识在挣扎 → 你再选一次怎么回应。三条里【一条】合 Ta 心意（face），
  // 选中它梦不碎，Ta 直面了那个东西（第四种结局）；另外两条（shatter）才碎。一场梦只给一次。
  function normStruggleOptions(raw) {
    let opts = (Array.isArray(raw) ? raw : [])
      .map(o => ({ text: String((o && o.text) || "").trim(), kind: (o && o.kind) === "face" ? "face" : "shatter" }))
      .filter(o => o.text);
    if (opts.length < 3) return null;
    opts = opts.slice(0, 3);
    const faces = opts.filter(o => o.kind === "face");
    if (faces.length === 0) opts[0].kind = "face";
    else if (faces.length > 1) { let kept = false; opts = opts.map(o => o.kind === "face" ? (kept ? { text: o.text, kind: "shatter" } : (kept = true, o)) : o); }
    return shuffle(opts);
  }
  async function weaveStruggle(active, session, worldbook, uName, resistText) {
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在继续为「" + session.charName + "」编织同一场梦。" + uName + " 刚做了一个选择——「" + resistText + "」——它恰好触到了 " + session.charName + " 内心最抗拒、不愿被戳破的东西。" +
      "但梦没有立刻碎：它在挣扎。\n\n" +
      charBlock(session) +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      "\n\n【梦到目前为止】\n" + transcript(session, uName) +
      "\n\n【怎么写这一幕】\n" +
      "· 写梦变质的这一幕（120~220 字，第二人称『你』）：从那个选择的瞬间起，场景怎么扭曲、光怎么变、" + session.charName + " 在梦里怎么反应——退缩、僵住、翻脸、把门关上、把你推开，或者反过来死死抓住什么。这是 Ta 的潜意识在护着那个东西。别写崩塌，写【挣扎】：梦还在，只是绷到了极限。\n" +
      "· 然后给『你』三个可做的回应：其中【一个】是 " + session.charName + " 此刻真正需要的——不是顺着 Ta、也不是硬戳，而是让 Ta 能站在那个东西面前不逃开的那种回应（kind:\"face\"）；" +
      "【另外两个】看着体贴或合理，实际上会让 Ta 彻底关上门（kind:\"shatter\"）。三个字面上都像好选择，别露馅。哪一个是 face，得从 Ta 的人设、Ta 和你的关系、Ta 此刻的心结里长出来——换个人就不成立。\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "\n【输出】只输出 JSON：{\"scene\":\"梦挣扎的叙事\",\"options\":[{\"text\":\"…\",\"kind\":\"face\"},{\"text\":\"…\",\"kind\":\"shatter\"},{\"text\":\"…\",\"kind\":\"shatter\"}]}。别加别的。";
    const raw = await callAI(active, sys, [{ role: "user", content: "梦在挣扎。" }], { maxTokens: 12000 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    const opts = normStruggleOptions(p.options);
    if (!p.scene || !opts) throw new Error("梦没撑住，重试");
    return { text: String(p.scene).trim(), options: opts, chosen: null, cot: sp.cot, struggle: true, resistText };
  }
  // ---- 模型：直面（第四种结局）——挣扎那一幕选对了，Ta 站在了那个东西面前 ----
  async function weaveFace(active, session, worldbook, uName, chosenText, resistText) {
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在收束「" + session.charName + "」的这场梦——这次既不是梦碎，也不是顺着梦走到底。" + uName + " 先前触到了 " + session.charName + " 最抗拒的东西（「" + resistText + "」），梦挣扎了一幕，" +
      uName + " 随后选择了「" + chosenText + "」——这一步让 " + session.charName + " 没有逃开，站在了那个东西面前。\n\n" +
      charBlock(session) +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      "\n\n【梦到目前为止】\n" + transcript(session, uName) +
      "\n\n① 写直面的这一幕（face，160~320字，第二人称『你』）：梦不再扭曲，但也没有变得轻松——" + session.charName + " 在梦里第一次正眼看那个 Ta 一直绕开的东西，你在旁边。写 Ta 怎么看它、怎么呼吸、说了什么或什么都没说；梦怎么安静下来、怎么合上。别写成和解或治愈，写【看见】。\n" +
      "② 再抽离出来，点破被直面的到底是什么（core，40~90字，旁白口吻）：Ta 一直绕开的是 Ta 心里的什么，这一步为什么算数。具体、贴人设，别空泛。" +
      KEEPSAKE_ASK +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "【输出】只输出 JSON：{\"face\":\"直面的叙事\",\"core\":\"被直面的是什么\",\"keepsake\":{\"name\":\"东西的名字\",\"note\":\"它在梦里是什么\"}}。别加别的。";
    const raw = await callAI(active, sys, [{ role: "user", content: "直面。" }], { maxTokens: 11500 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    return { face: String(p.face || sp.clean || "梦安静下来了。Ta 没有逃开，你也没有。你慢慢醒来，手心还是热的。").trim(), core: String(p.core || "").trim(), keepsake: normKeepsake(p.keepsake), cot: sp.cot };
  }

  // ---- 模型：梦碎（选到抗拒项） ----
  async function weaveShatter(active, session, worldbook, uName, resistText) {
    const cotT = (typeof cotThink === "function") ? cotThink({ char: session.charName, user: uName }, "dream") : "";
    const sys = CORE() +
      "你在收束「" + session.charName + "」的这场梦。" + uName + " 刚做了一个选择——「" + resistText + "」——它恰好触到了 " + session.charName + " 内心最抗拒、不愿被戳破的东西。梦承受不住，开始碎裂。\n\n" +
      charBlock(session) +
      "\n\n【梦到破碎前】\n" + transcript(session, uName) +
      "\n\n① 写梦碎的这一幕（collapse，120~240字，第二人称『你』）：从那个选择的瞬间起，梦境如何变质、扭曲、崩塌；" + session.charName + " 的潜意识如何反应（退缩、失控、痛楚或愤怒，看人设）；最后 " + uName + " 被逐出梦、猛地惊醒。\n" +
      "② 再抽离出来，说清这个选择为什么是错的（why，40~90字，跳出梦、用旁白口吻）：「" + resistText + "」触到了 " + session.charName + " 的什么逆鳞/软肋/不愿面对的真相，为什么在 Ta 的梦里这条路走不通。要具体贴人设，别空泛。\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "【输出】只输出 JSON：{\"collapse\":\"梦碎叙事\",\"why\":\"为什么这个选择戳破了梦\"}。别加别的。";
    const raw = await callAI(active, sys, [{ role: "user", content: "梦碎。" }], { maxTokens: 11000 });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const p = extractJSON(sp.clean) || {};
    return { collapse: String(p.collapse || sp.clean || "梦在你眼前碎成光斑，你猛地醒来。").trim(), why: String(p.why || "").trim(), cot: sp.cot };
  }

  // ============================================================
  // 主组件
  // ============================================================
  function Dream(props) {
    const t = NIGHT;
    const [saves, setSaves] = useState(loadSaves);
    const [view, setView] = useState("home"); // "home" | "setup" | <sessionId>
    const lpTimer = useRef(null), lpFired = useRef(false);

    const persist = list => { if (saveSaves(list)) { setSaves(list); return true; } props.toast && props.toast("这次没保存成功，原梦境还在"); return false; };
    const patchSession = (id, patch) => {
      const list = loadSaves().map(s => s.id === id ? Object.assign({}, s, patch, { lastTs: Date.now() }) : s);
      persist(list);
      // 合龙：从梦回路进来的梦，结局一落就记回去（只在 status 真变成结局那一下）
      if (patch && (patch.status === "fulfilled" || patch.status === "faced" || patch.status === "broken" || patch.status === "left")) {
        const sess = list.find(s => s.id === id); if (sess && sess.loopKey) settleLoopDream(sess, patch.status);
      }
    };
    // ── 他昨晚做的梦（v62.99 合龙）──────────────────────────────
    // 梦回路每晚给角色真做一场梦（材料是他昨天真过过的一天），一直只能在解梦馆里读。
    // 这儿把还没进过的那几场列出来，点一下就是一场戏——不用递关键词，料是现成的。
    const [loopRows, setLoopRows] = useState([]);
    const loadLoop = () => { try { if (window.DreamLoop && window.DreamLoop.listDreams) window.DreamLoop.listDreams(40).then(rows => setLoopRows(Array.isArray(rows) ? rows : [])); } catch (e) {} };
    useEffect(() => { if (view === "home") loadLoop(); }, [view]);
    const enteredKeys = new Set(saves.map(s => s.loopKey).filter(Boolean));
    const loopOpen = loopRows.filter(r => r && (r.status === "queued" || r.status === "generated") && !enteredKeys.has(r.key) && !(r.entered && r.entered.outcome)
      && (props.characters || []).some(c => c.id === r.charId)).slice(0, 8);
    const enterLoop = row => {
      const has = loadSaves().find(s => s.loopKey === row.key);
      if (has) { setView(has.id); return; }
      const session = sessionFromLoop(row, props);
      if (!session) { props.toast && props.toast("角色不在了，这场梦无主"); return; }
      persist([session].concat(loadSaves())); setView(session.id);
    };
    // 从解梦馆那颗「推门进这场梦」跳过来：App 把那场梦的 key 递进来，用完就还
    useEffect(() => {
      if (!props.enterLoopKey || !window.DreamLoop || !window.DreamLoop.listDreams) return;
      let alive = true;
      window.DreamLoop.listDreams(80).then(rows => {
        if (!alive) return;
        const row = (rows || []).find(r => r && r.key === props.enterLoopKey);
        if (row) enterLoop(row); else props.toast && props.toast("那场梦找不到了");
        props.onEnterConsumed && props.onEnterConsumed();
      });
      return () => { alive = false; };
    }, [props.enterLoopKey]);
    const delSession = id => requestAppConfirm("忘掉这场梦？", "删除后不能恢复。", () => { if (persist(loadSaves().filter(s => s.id !== id)) && view === id) setView("home"); }, "删除");

    const startLP = id => { lpFired.current = false; lpTimer.current = setTimeout(() => { lpFired.current = true; delSession(id); }, 550); };
    const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };

    if (view === "setup") {
      return h(Setup, {
        characters: props.characters, profile: props.profile, rels: props.rels, toast: props.toast,
        onCancel: () => setView("home"),
        onCreate: session => { persist([session].concat(loadSaves())); setView(session.id); }
      });
    }
    if (view !== "home") {
      const s = saves.find(x => x.id === view);
      if (!s) { setView("home"); return null; }
      return h(DreamView, {
        // ⚠️characters 必须递进去：幕文旁边那颗朗读点要拿角色的音色（v63.99 她报「一进梦页面就崩」）。
        //   这一层写在两处：一处用、一处传，传的那处没跟上——用的时候是 undefined.find()，整页当场白。
        session: s, characters: props.characters, active: props.active, profile: props.profile, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        onBack: () => { setSaves(loadSaves()); setView("home"); },
        onKeepsake: props.onKeepsake,
        onPatch: patch => patchSession(s.id, patch)
      });
    }

    // 落地页
    return h("div", { className: "h-full flex flex-col", style: dreamPage() },
      h(Head, { zh: "梦境", onBack: props.onBack, bg: "transparent", ink: NIGHT.ink }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        // 「编织一场梦」＝推开一扇门。上圆下方的那个轮廓就是门洞，
        // 虚线圆角按钮是任何 app 的「新建」，跟梦没有关系。
        h("button", {
          onClick: () => { if (!props.characters.length) { props.toast && props.toast("先去『人格档案馆』建个角色"); return; } setView("setup"); },
          className: "w-full active:opacity-70",
          // ⚠️门要【高于宽】才是门；铺满一整行的那个上圆下方，看着是桥洞不是门。
          style: {
            display: "block", width: 150, maxWidth: "56%", margin: "6px auto 30px",
            padding: "116px 0 26px",
            fontFamily: F_BODY, fontSize: 13.5, letterSpacing: ".08em", color: ACC_LIT,
            borderRadius: "75px 75px 3px 3px",
            border: "1px solid rgba(169,154,201,.38)",
            background: "radial-gradient(110% 62% at 50% 108%, rgba(169,154,201,.20), transparent 72%)"
          }
        }, "推开一扇门"),
        // 他昨晚做的梦：一列还没推开的门
        loopOpen.length ? h("div", { style: { marginBottom: 26 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: ACC_LIT, marginBottom: 10 } }, "他昨晚真做的梦 · 还没进过"),
          loopOpen.map(r => { const c = (props.characters || []).find(x => x.id === r.charId) || {};
            return h("button", { key: r.key, onClick: () => enterLoop(r), className: "w-full active:opacity-70 flex items-center",
              style: { gap: 12, padding: "10px 4px", textAlign: "left", borderBottom: "1px solid " + t.line } },
              typeof Avatar === "function" ? h(Avatar, { character: c, size: 34, radius: 999 }) : null,
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, (c.name || "？") + " · " + String(r.nightKey || "").slice(5).replace("-", "/") + " 夜"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  r.recurOf ? "又做了一次 · 上次碎在半路" : r.status === "generated" ? ((r.motifs || []).join(" · ") || r.tone || "有梦") : "未醒的梦 · 材料已经攒好")),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: ACC_LIT, flexShrink: 0 } }, "推门 ›")); })) : null,
        saves.length === 0
          ? h("div", { style: { textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, paddingTop: 40, whiteSpace: "pre-line" } }, "还没有梦。\n挑一个人，递三个关键词，\n看你能在 Ta 的梦里走多深。")
          : h("div", null,
            saves.slice().sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0)).map((s, si) => {
              const broken = s.status === "broken", left = s.status === "left", done = s.status === "fulfilled", faced = s.status === "faced";
              const mark = broken ? { txt: "已碎", c: BAD_LIT } : done ? { txt: "抵达", c: GOOD_LIT } : faced ? { txt: "直面", c: GOOD_LIT } : left ? { txt: "已醒", c: t.fog } : { txt: "梦中", c: ACC_LIT };
              return h("div", {
                key: s.id,
                onClick: () => { if (lpFired.current) { lpFired.current = false; return; } setView(s.id); },
                onContextMenu: e => { e.preventDefault(); delSession(s.id); },
                onTouchStart: () => startLP(s.id), onTouchEnd: cancelLP, onTouchMove: cancelLP, onTouchCancel: cancelLP,
                onMouseDown: () => startLP(s.id), onMouseUp: cancelLP, onMouseLeave: cancelLP,
                className: "active:opacity-70",
                // ⚠️不给框。梦没有边——一条会在两头淡掉的地平线就够把两场梦分开，
                //   圆角 13 的卡是通用列表项，摆在夜里也还是通用列表项。
                style: { cursor: "pointer", padding: "17px 2px 18px", borderTop: si ? "1px solid transparent" : "none",
                  backgroundImage: si ? "linear-gradient(90deg,transparent,rgba(232,230,240,.20) 22%,rgba(232,230,240,.20) 78%,transparent)" : "none",
                  backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "0 0" }
              },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
                  // 徽标换成一颗点 + 两个字：色块 badge 是标签组件，星点才是这一页的话
                  h("span", { "aria-hidden": "true", style: { width: 5, height: 5, borderRadius: 999, background: mark.c, boxShadow: "0 0 7px " + mark.c } }),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: mark.c } }, mark.txt),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "第 " + ((s.scenes || []).length || 1) + " 幕")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.35, color: t.ink, marginBottom: 5 } }, s.charName + " 的梦" + (s.recur ? "（" + String(s.nightKey || "").slice(5).replace("-", "/") + " 夜又做了一次）" : s.fromLoop ? "（" + String(s.nightKey || "").slice(5).replace("-", "/") + " 夜真做的）" : "")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  s.fromLoop ? (((s.material || {}).motifs || []).join(" · ") || "从他昨天真过的一天里长出来的") : ((s.keywords || []).filter(Boolean).join(" · ") || "（没给关键词，任梦自由生长）"))
              );
            })),
        saves.length > 0 ? h("div", { style: { marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "长按可忘掉这场梦") : null
      ));
  }

  // ============================================================
  // 发起设置：选 1 个角色 + 3 个关键词
  // ============================================================
  function Setup(props) {
    const t = NIGHT;
    const [charId, setCharId] = useState("");
    const [guestIds, setGuestIds] = useState([]);       // 客串角色（最多 2）
    const [injectChat, setInjectChat] = useState(true); // 是否注入最近聊天记录
    const [kw, setKw] = useState(["", "", ""]);
    const [starting, setStarting] = useState(false);

    // 选做梦人：若把某人设成做梦人，就从客串里剔除
    const pickDreamer = id => { setCharId(prev => prev === id ? "" : id); setGuestIds(prev => prev.filter(x => x !== id)); };
    const toggleGuest = id => setGuestIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) { props.toast && props.toast("最多带 2 个客串角色"); return prev; }
      return prev.concat(id);
    });

    const start = async () => {
      if (!charId) { props.toast && props.toast("先挑一个人，进 Ta 的梦"); return; }
      setStarting(true);
      try {
        const c = (props.characters || []).find(x => x.id === charId);
        const uName = (props.profile && props.profile.name) || "我";
        const rels = props.rels || {};
        const guests = guestIds.map(gid => {
          const g = (props.characters || []).find(x => x.id === gid);
          if (!g) return null;
          const r = rels[c.id + "->" + g.id];                 // 做梦人对客串的看法（有向）
          const relText = r && r.label ? (r.label + (r.note ? "（" + r.note + "）" : "")) : "";
          return { id: g.id, name: g.name, persona: g.persona || "", relText: relText, voiceRef: injectChat ? recentChatSnippet(g.id, uName, g.name) : "" };
        }).filter(Boolean);
        const session = {
          id: "dm_" + Date.now(),
          charId: c.id, charName: c.name, charPersona: c.persona || "",
          // 此刻的状态：从 App 传进来的那份上下文里取（拿不到就留空，别整个坏掉）
          moodLine: (function () { const m = props.moodOf ? props.moodOf(c.id) : ""; return m ? String(m) : ""; })(),
          affLine: (function () { const a2 = props.affinityLineOf ? props.affinityLineOf(c.id) : ""; return a2 ? String(a2) : ""; })(),
          gazeText: (function () { try { return (window.Gaze && window.Gaze.text) ? String(window.Gaze.text(c.id, uName) || "").slice(0, 700) : ""; } catch (e) { return ""; } })(),
          keywords: kw.map(x => x.trim()).filter(Boolean),
          familiarity: familiarityTier(props.familiarityOf ? props.familiarityOf(c.id) : null),
          guests: guests, injectChat: injectChat,
          voiceRef: injectChat ? recentChatSnippet(c.id, uName, c.name) : "",
          scenes: [], status: "dreaming", ending: "",
          createdTs: Date.now(), lastTs: Date.now()
        };
        props.onCreate(session); // 第一幕在 DreamView 首次进入时生成
      } catch (e) { props.toast && props.toast("没能进梦：" + (e.message || "重试")); setStarting(false); }
    };

    const label = { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 8, letterSpacing: .3 };

    return h("div", { className: "h-full flex flex-col", style: dreamPage() },
      h(Head, { zh: "编织一场梦", onBack: props.onCancel, bg: "transparent", ink: NIGHT.ink }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        h("div", { style: label }, "进谁的梦"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 } },
          (props.characters || []).map(c => {
            const on = charId === c.id;
            return h("button", { key: c.id, onClick: () => pickDreamer(c.id), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line), borderRadius: 999, padding: "8px 15px" } }, c.name);
          })),
        // 客串角色：选了做梦人才出现；梦里会带上这些人（含做梦人对 Ta 的看法）
        charId ? h("div", { style: label }, "梦里还会梦见谁（选 0~2 个，可不选）") : null,
        charId ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 } },
          (props.characters || []).filter(c => c.id !== charId).map(c => {
            const on = guestIds.includes(c.id);
            return h("button", { key: c.id, onClick: () => toggleGuest(c.id), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? "#8478a0" : t.bg2, border: "1px solid " + (on ? "#8478a0" : t.line), borderRadius: 999, padding: "8px 15px" } }, c.name);
          })) : null,
        // 注入最近聊天记录开关
        h("label", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, marginBottom: 22, cursor: "pointer" } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "注入最近的聊天记录"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "把 Ta" + (guestIds.length ? "和客串角色" : "") + "最近的聊天当语气/近况参考，梦更贴近当下")),
          h("input", { type: "checkbox", checked: injectChat, onChange: e => setInjectChat(e.target.checked), style: { width: 20, height: 20, flexShrink: 0, accentColor: ACCENT } })),
        h("div", { style: label }, "递三个关键词（可留空，让梦自由生长）"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 9, marginBottom: 8 } },
          [0, 1, 2].map(i => h("input", {
            key: i, value: kw[i], onChange: e => setKw(prev => { const n = prev.slice(); n[i] = e.target.value; return n; }),
            placeholder: "关键词 " + (i + 1),
            style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none" }
          }))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7, marginBottom: 4 } },
          "梦是 Ta 的，你只是闯进来的客人。每一幕都有三条路，其中一条踩在 Ta 的逆鳞上。踩到了梦会先挣扎一幕，只给你一次机会安抚它；安抚对了 Ta 会直面那个东西，错了梦就碎，把你惊醒赶出去。")
      ),
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom))", background: "linear-gradient(to top," + t.bg + " 78%,transparent)" } },
        h("button", { onClick: start, disabled: starting, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: starting ? t.fog : ACCENT, borderRadius: 12, padding: "13px 0" } },
          starting ? "推开梦的门…" : "进入梦境")));
  }

  // ============================================================
  // 梦境正文
  // ============================================================
  // 梦里落在你手里的那件东西（v63.05）：抵达 / 直面两种结局底下都有；「带出梦去」进她的物品
  function KeepsakeCard(props) {
    const t = NIGHT, k = props.keepsake; if (!k || !k.name) return null;
    return h("div", { style: { marginTop: 14, padding: "12px 14px", borderRadius: 12, border: "1px dashed rgba(169,154,201,.45)", background: "rgba(169,154,201,.07)" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: ACC_LIT, marginBottom: 6 } }, "醒来手里攥着"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, k.name),
      k.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.sub, marginTop: 3 } }, k.note) : null,
      k.taken
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 8 } }, "已经带出来了，在你的物品里。Ta 见了会眼熟，但不知道它从哪儿来。")
        : h("button", { onClick: props.onKeep, className: "active:opacity-70",
            style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12.5, color: t.bg, background: ACC_LIT, borderRadius: 10, padding: "7px 14px" } }, "带出梦去"));
  }

  function DreamView(props) {
    const t = NIGHT;
    const s = props.session;
    // 带出梦去：进她的物品，标着从谁的梦里来；梦这边记一笔「已带出」
    const keep = () => {
      const k = s.keepsake; if (!k || !k.name || k.taken) return;
      const item = { id: "iv_dream_" + Date.now(), name: k.name, fromCharId: null, dreamCharId: s.charId, dreamNote: k.note || "", source: "dream", addedTs: Date.now() };
      props.onKeepsake && props.onKeepsake(item);
      props.onPatch({ keepsake: Object.assign({}, k, { taken: true, itemId: item.id }) });
      props.toast && props.toast("带出来了：" + k.name);
    };
    const [busy, setBusy] = useState(false);
    const [phaseMsg, setPhaseMsg] = useState("");
    const feedRef = useRef(null);
    const dtp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 幕文朗读（懒合成）
    const kicked = useRef(false); // 防重复触发首幕生成

    const scenes = s.scenes || [];
    const cur = scenes.length ? scenes[scenes.length - 1] : null;
    const dreaming = s.status === "dreaming";
    const awaitingPick = dreaming && cur && cur.chosen == null;
    const scopedWorldbook = function (extra) {
      const ids = [s.charId].concat((s.guests || []).map(function (g) { return g.id; })).filter(Boolean);
      const text = (s.keywords || []).concat([extra || ""]).filter(Boolean).join("\n");
      return props.worldbookFor ? props.worldbookFor(ids, text) : props.worldbook;
    };

    useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [scenes.length, busy, phaseMsg, s.status]);

    // 首次进入且还没有第一幕 → 生成开场
    useEffect(() => {
      if (dreaming && scenes.length === 0 && !kicked.current) {
        kicked.current = true;
        genFirst();
      } else if (dreaming && s.recur && scenes.length && scenes[scenes.length - 1].chosen != null && !kicked.current) {
        // 回来的梦（v63.09）：带着碎之前那几幕进来，进门就接着往下织，不用她再按一次
        kicked.current = true;
        retryNext();
      }
    }, []); // eslint-disable-line

    async function genFirst() {
      setBusy(true); setPhaseMsg("梦正在成形…");
      try {
        const first = await weaveFirst(props.active, s, scopedWorldbook("梦境开场"), uName());
        props.onPatch({ scenes: [first] });
      } catch (e) { props.toast && props.toast(e.message || "重试"); }
      setBusy(false); setPhaseMsg("");
    }

    function uName() { return (props.profile && props.profile.name) || "我"; }

    async function pick(idx) {
      if (busy || !awaitingPick) return;
      const chosen = cur.options[idx];
      // 记下选择
      const marked = scenes.slice();
      marked[marked.length - 1] = Object.assign({}, cur, { chosen: idx });
      const sess2 = Object.assign({}, s, { scenes: marked });

      // 挣扎那一幕的回应（v63.04）：选对了 → 直面（第四种结局）；选错 → 碎
      if (cur.struggle) {
        const resistText = cur.resistText || s.struggleFor || "";
        if (chosen.kind === "face") {
          setBusy(true); setPhaseMsg("Ta 没有逃开…");
          try {
            const r = await weaveFace(props.active, sess2, scopedWorldbook(chosen.text), uName(), chosen.text, resistText);
            props.onPatch({ scenes: marked, status: "faced", ending: r.face, dreamCore: r.core, keepsake: r.keepsake || null, endCot: r.cot || null, wrongText: resistText });
          } catch (e) {
            props.onPatch({ scenes: marked, status: "faced", ending: "梦安静下来了。Ta 没有逃开，你也没有。你慢慢醒来，手心还是热的。", dreamCore: "", wrongText: resistText });
          }
          setBusy(false); setPhaseMsg(""); return;
        }
        setBusy(true); setPhaseMsg("门关上了…");
        try {
          const r = await weaveShatter(props.active, sess2, scopedWorldbook(chosen.text), uName(), chosen.text);
          props.onPatch({ scenes: marked, status: "broken", ending: r.collapse, whyWrong: r.why, wrongText: chosen.text, endCot: r.cot || null });
        } catch (e) {
          props.onPatch({ scenes: marked, status: "broken", ending: "梦在你眼前碎成光斑，你猛地醒来，心还在跳。", whyWrong: "", wrongText: chosen.text });
        }
        setBusy(false); setPhaseMsg(""); return;
      }
      if (chosen.kind === "resist") {
        // 第一次踩到逆鳞：不碎，梦先挣扎一幕，给一次安抚的机会（一场梦只给一次）
        if (!s.struggled) {
          setBusy(true); setPhaseMsg("有什么绷紧了…");
          try {
            const st = await weaveStruggle(props.active, sess2, scopedWorldbook(chosen.text), uName(), chosen.text);
            props.onPatch({ scenes: marked.concat([st]), struggled: true, struggleFor: chosen.text });
            setBusy(false); setPhaseMsg(""); return;
          } catch (e) { /* 挣扎没织出来：退回原来的路，直接碎 */ }
        }
        // 梦碎
        setBusy(true); setPhaseMsg("有什么裂开了…");
        try {
          const r = await weaveShatter(props.active, sess2, scopedWorldbook(chosen.text), uName(), chosen.text);
          props.onPatch({ scenes: marked, status: "broken", ending: r.collapse, whyWrong: r.why, wrongText: chosen.text, endCot: r.cot || null });
        } catch (e) {
          props.onPatch({ scenes: marked, status: "broken", ending: "梦在你眼前碎成光斑，你猛地醒来，心还在跳。", whyWrong: "", wrongText: chosen.text });
        }
        setBusy(false); setPhaseMsg("");
        return;
      }
      // 顺应且这一幕已到梦核边缘（final）→ 抵达梦核，圆满收束（第三种结局）
      if (cur.final) {
        setBusy(true); setPhaseMsg("梦走到了最深处…");
        try {
          const r = await weaveEnding(props.active, sess2, scopedWorldbook(chosen.text), uName(), chosen.text);
          props.onPatch({ scenes: marked, status: "fulfilled", ending: r.arrive, dreamCore: r.core, keepsake: r.keepsake || null, endCot: r.cot || null });
        } catch (e) {
          props.onPatch({ scenes: marked, status: "fulfilled", ending: "梦走到了最深处，然后温柔地合上。你缓缓醒来，胸口还留着余温。", dreamCore: "" });
        }
        setBusy(false); setPhaseMsg(""); return;
      }
      // 顺应 → 续写下一幕
      setBusy(true); setPhaseMsg("梦在往深处走…");
      try {
        const next = await weaveNext(props.active, sess2, scopedWorldbook(chosen.text), uName());
        props.onPatch({ scenes: marked.concat([next]) });
      } catch (e) {
        // 续写失败：把选择保留，让用户重试
        props.onPatch({ scenes: marked });
        props.toast && props.toast(e.message || "梦卡住了，再试一次");
      }
      setBusy(false); setPhaseMsg("");
    }

    async function retryNext() {
      if (busy) return;
      setBusy(true); setPhaseMsg("梦在往深处走…");
      try {
        const next = await weaveNext(props.active, s, scopedWorldbook("继续梦境"), uName());
        props.onPatch({ scenes: scenes.concat([next]) });
      } catch (e) { props.toast && props.toast(e.message || "再试一次"); }
      setBusy(false); setPhaseMsg("");
    }

    // ⚠️不许用 window.confirm：PWA / iOS 独立窗口里它会被系统吞掉，直接返回 false
    //   且【不抛异常】，于是「醒来」按下去什么都不发生（components.js requestAppConfirm）。
    const wakeUp = () => requestAppConfirm("主动醒来，离开这场梦？", "", () => props.onPatch({ status: "left" }), "醒来");

    // 回档：退回到第 k 幕的决策点，清掉这之后的所有进展 + 结局，重新选
    const rewindTo = k => {
      if (busy) return;
      const later = scenes.length - 1 - k;
      const tail = later > 0 ? "这之后的 " + later + " 幕会被抹去。" : "";
      requestAppConfirm("回到第 " + (k + 1) + " 幕重新选？", tail, () => rewindToNow(k), "回到那一幕");
    };
    const rewindToNow = k => {
      const kept = scenes.slice(0, k + 1).map((sc, i) => i === k ? Object.assign({}, sc, { chosen: null }) : sc);
      // 挣扎那一幕要是被抹掉了，那一次机会就还回来；还留着就仍然算用过
      const stillStruggling = kept.some(sc => sc && sc.struggle);
      // 已经带出去的东西不收回（它已经在她物品里了），没带的随梦一起抹掉
      props.onPatch({ scenes: kept, status: "dreaming", ending: "", whyWrong: "", wrongText: "", dreamCore: "", keepsake: (s.keepsake && s.keepsake.taken) ? s.keepsake : null, struggled: stillStruggling, struggleFor: stillStruggling ? s.struggleFor : "" });
    };

    // 上一幕已选好、但还没有下一幕（续写失败留下的中间态）
    const needRetry = dreaming && cur && cur.chosen != null;

    const wakeBtn = dreaming ? h("button", { onClick: wakeUp, className: "active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "醒来") : null;

    // 底部控制区（正常流式布局，不再 absolute 浮盖——否则最后一幕会被盖住刷不到底）
    const controls = dreaming ? h("div", { className: "shrink-0 px-5", style: { paddingTop: 8, paddingBottom: "calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid " + t.line, background: t.bg } },
      busy
        ? h("div", { className: "w-full", style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, color: t.sub, textAlign: "center", padding: "13px 0", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12 } }, phaseMsg || "…")
        : awaitingPick
          ? h("div", { style: { display: "flex", flexDirection: "column", gap: 9 } },
            cur.options.map((op, i) => h("button", {
              key: i, onClick: () => pick(i), className: "w-full active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, textAlign: "left", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "13px 15px" }
            }, op.text)),
            // 熟不熟（v63.08）：告诉她这场梦里破绽有没有、有多明显；挣扎那一幕不适用（那三条是另一套）
            cur.struggle ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", paddingTop: 2 } }, FAMILIAR_LINE[Math.max(0, Math.min(2, s.familiarity || 0))]))
          : needRetry
            ? h("button", { onClick: retryNext, className: "w-full active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "13px 0" } }, "↻ 梦卡住了，继续做梦")
            : null) : null;

    return h("div", { className: "h-full flex flex-col", style: dreamPage() },
      h(Head, { zh: s.charName + " 的梦", onBack: props.onBack, right: wakeBtn, bg: "transparent", ink: NIGHT.ink }),
      // 梦境流（flex-1 撑满剩余高度，底部控制区是同级 shrink-0，滚动能到底不被盖）
      h("div", { ref: feedRef, className: "flex-1 overflow-y-auto px-5", style: { paddingBottom: 24 } },
        s.recur ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.fog, marginBottom: 14, paddingBottom: 10, borderBottom: "1px dashed " + t.line } },
          "这场梦 Ta 又做了一次。上次做到第 " + s.recur.brokenAt + " 幕，在「" + s.recur.wrongText + "」那一步碎了。前面几幕还是那样，从碎的地方接着走——路已经不是上次的路。") : null,
        scenes.map((sc, i) => {
          const decided = sc.chosen != null && sc.options && sc.options[sc.chosen];
          return h("div", { key: i, style: { marginBottom: 22 } },
            h("div", { style: { display: "flex", alignItems: "center", marginBottom: 8 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: sc.struggle ? BAD_LIT : t.fog } }, sc.struggle ? "第 " + (i + 1) + " 幕 · 梦在挣扎" : "第 " + (i + 1) + " 幕"),
              (dtp && typeof TtsDot === "function") ? h(TtsDot, { k: "dr" + i, text: sc.text, spk: (props.characters || []).find(c => c.id === s.charId), tp: dtp }) : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap" } }, sc.text),
            (sc.cot && typeof CotReveal === "function") ? h(CotReveal, { cot: sc.cot }) : null,
            // 已做出的选择回显 + 回档
            decided
              ? h("div", { style: { marginTop: 12, paddingLeft: 12, borderLeft: "2px solid " + ACC_LIT },
                  onClick: () => rewindTo(i) },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: ACC_LIT } }, "你选择了：" + sc.options[sc.chosen].text),
                h("button", { onClick: e => { e.stopPropagation(); rewindTo(i); }, className: "active:opacity-60",
                  style: { marginTop: 4, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "↩ 从这里重选"))
              : null);
        }),
        // 抵达梦核（圆满收束）结局
        s.status === "fulfilled"
          ? h("div", { style: { marginTop: 4, marginBottom: 20 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: GOOD_LIT, marginBottom: 8 } }, "梦　核"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap" } }, s.ending),
            (s.endCot && typeof CotReveal === "function") ? h(CotReveal, { cot: s.endCot }) : null,
            s.dreamCore
              ? h("div", { style: { marginTop: 14, padding: "12px 14px", background: "rgba(127,192,160,0.10)", border: "1px solid rgba(127,192,160,0.30)", borderRadius: 12 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: GOOD_LIT, marginBottom: 6 } }, "这场梦其实是关于"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.ink } }, s.dreamCore))
              : null,
            h(KeepsakeCard, { keepsake: s.keepsake, onKeep: keep }),
            h("div", { style: { marginTop: 16, textAlign: "center", fontFamily: F_DISPLAY, fontSize: 14, fontStyle: "italic", color: t.fog } }, "你走到了梦的尽头，它温柔地合上。"),
            scenes.length ? h("button", { onClick: () => rewindTo(scenes.length - 1), className: "w-full active:opacity-80",
              style: { marginTop: 16, fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "12px 0" } }, "↩ 回到刚才的决策点，走另一条路") : null)
          // 直面（第四种结局，v63.04）：挣扎那一幕选对了
          : s.status === "faced"
          ? h("div", { style: { marginTop: 4, marginBottom: 20 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: GOOD_LIT, marginBottom: 8 } }, "直　面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap" } }, s.ending),
            (s.endCot && typeof CotReveal === "function") ? h(CotReveal, { cot: s.endCot }) : null,
            s.dreamCore
              ? h("div", { style: { marginTop: 14, padding: "12px 14px", background: "rgba(127,192,160,0.10)", border: "1px solid rgba(127,192,160,0.30)", borderRadius: 12 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: GOOD_LIT, marginBottom: 6 } }, "Ta 一直绕开的是"),
                s.wrongText ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 6, fontStyle: "italic" } }, "踩到它的那一步：「" + s.wrongText + "」") : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.ink } }, s.dreamCore))
              : null,
            h(KeepsakeCard, { keepsake: s.keepsake, onKeep: keep }),
            h("div", { style: { marginTop: 16, textAlign: "center", fontFamily: F_DISPLAY, fontSize: 14, fontStyle: "italic", color: t.fog } }, "你没有退开，也没有把它戳破。它被看见了。"),
            scenes.length ? h("button", { onClick: () => rewindTo(scenes.length - 1), className: "w-full active:opacity-80",
              style: { marginTop: 16, fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "12px 0" } }, "↩ 回到刚才的决策点，走另一条路") : null)
          // 梦碎 / 醒来 结局
          : s.status === "broken"
          ? h("div", { style: { marginTop: 4, marginBottom: 20 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: BAD_LIT, marginBottom: 8 } }, "梦　碎"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap" } }, s.ending),
            (s.endCot && typeof CotReveal === "function") ? h(CotReveal, { cot: s.endCot }) : null,
            // 为什么这个选项是错的
            s.whyWrong
              ? h("div", { style: { marginTop: 14, padding: "12px 14px", background: "rgba(217,138,138,0.10)", border: "1px solid rgba(217,138,138,0.30)", borderRadius: 12 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: BAD_LIT, marginBottom: 6 } }, "为什么这条路走不通"),
                s.wrongText ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 6, fontStyle: "italic" } }, "「" + s.wrongText + "」") : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.ink } }, s.whyWrong))
              : null,
            h("div", { style: { marginTop: 16, textAlign: "center", fontFamily: F_DISPLAY, fontSize: 14, fontStyle: "italic", color: t.fog } }, "你被赶出了这场梦。"),
            // 梦碎后回到那个决策点重来
            scenes.length ? h("button", { onClick: () => rewindTo(scenes.length - 1), className: "w-full active:opacity-80",
              style: { marginTop: 16, fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "12px 0" } }, "↩ 回到刚才的决策点重选") : null)
          : s.status === "left"
            ? h("div", { style: { marginTop: 8, marginBottom: 24, textAlign: "center" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, fontStyle: "italic", color: t.fog, marginBottom: 14 } }, "你选择了醒来，梦轻轻合上。"),
              scenes.length ? h("button", { onClick: () => rewindTo(scenes.length - 1), className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 12.5, color: ACCENT } }, "↩ 回到最后的决策点重进梦") : null)
            : null),
      controls);
  }

  window.Dream = Dream;
  // 给测试用的口子（v62.99 合龙那两把纯函数）：不走界面也能验材料块和结算
  Dream.sessionFromLoop = sessionFromLoop; Dream.settleLoopDream = settleLoopDream; Dream.loopMaterialBlock = loopMaterialBlock; Dream.normStruggleOptions = normStruggleOptions; Dream.normKeepsake = normKeepsake; Dream.familiarityTier = familiarityTier; Dream.familiarityRule = familiarityRule;
})();
