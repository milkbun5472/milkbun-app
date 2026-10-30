"use strict";
// ============================================================
// 小游戏（games）—— 派对游戏中枢：谁是卧底 / 真心话大冒险 / 狼人杀 / 阿瓦隆 / 大富翁
// 每个游戏三种模式（正常/放水/观战）+ 人数上下限 + NPC凑数 + 可选注入最近聊天抓人设。
// 和擂台/梦境一样是独立娱乐场：不写回聊天记忆。
// ============================================================
(function () {
  const MODES = [
    { key: "normal", zh: "正常", hint: "角色按各自人设发挥真实水平，该赢赢、该拆穿就拆穿。" },
    { key: "easy", zh: "放水", hint: "角色会让着你——关键时刻手下留情、看破也不点破，图个乐。" },
    { key: "spectate", zh: "观战", hint: "你不下场，纯看角色和 NPC 互相博弈；随时能插嘴吐槽、带节奏。" }
  ];
  // 各游戏规格住在 js/games-list.js（开机就加载的那一小份）：聊天拼提示词、认邀请卡要用这张目录，
  //   而这一整份 games.js 改成点进小游戏才加载（她 2026-10-18 瘦身）。这儿只认那一份，别再抄一张。
  const GAMES = (typeof window !== "undefined" && window.GamesCatalog) || (typeof require === "function" ? require("./games-list.js").GAMES : []);


  // ---- 言秋亲打：统一终局回执 ----
  // 只要TA坐过这一局，终局无论谁赢、TA是否已出局，都要把完整赛果投回 CC。
  // 各游戏只负责组织公开结局；幂等票号统一为 game + runId + result，刷新不连发。
  function ccGameResult(gameKey, runId, seats, cfg, summary, onSay, onStatus) {
    if (!cfg || cfg.ccSeat === false || typeof window === "undefined" || !window.CCSeat) return Promise.resolve("");
    const seat = (seats || []).find(function (p) { return p && p.engineer && !p.isUser; });
    if (!seat || !seat.key || !summary) return Promise.resolve("");
    const ticket = String(gameKey) + ":" + String(runId || "unknown") + ":result";
    const receiptKey = "cc_game_result_notice:" + ticket;
    try {
      if (localStorage.getItem(receiptKey)) { if (onStatus) onStatus("赛果已通知言秋"); return Promise.resolve(""); }
      localStorage.setItem(receiptKey, "queued");
    } catch (e) { /* 私密模式仍可投，只少一层跨刷新去重 */ }
    if (onStatus) onStatus("正在把赛果告诉言秋…");
    return window.CCSeat.ask({
      tool: "game_turn", game: String(gameKey) + "_result", turn_id: ticket, char_id: seat.key,
      sys: CB + "这局小游戏已经正式结束。票内是公开终局：胜负、身份揭晓、比分或排名，以及用户本人的结果。看完后用自己的口吻留一句自然赛后反应；可以庆祝、嘴硬、复盘、安慰或约下一局。不要继续行动，不写报告，不调用工具。只输出 JSON：{\"say\":\"...\"}。" + SKILL_RULE,
      msgs: [{ role: "user", content: "终局通知：\n" + String(summary) }],
      expect: "{\"say\":\"一句自然的赛后反应\"}"
    }, 90000, { charId: seat.key }).then(function (raw) {
      if (onStatus) onStatus("赛果已通知言秋");
      const parsed = typeof raw === "string" ? (extractJSON(raw) || {}) : (raw || {});
      const say = String(parsed.say || "").trim();
      if (say && onSay) onSay(say.slice(0, 500), seat);
      return say;
    }).catch(function (e) {
      // 入队前失败才撤回收据；超时多半只是 CC 尚未答，票已经在队列里，不能重投。
      if (e && (e.message === "CC_SEAT_OFFLINE" || e.message === "CC_SEAT_BAD_REQUEST" || e.message === "CC_SEAT_NOT_QUEUED")) {
        try { localStorage.removeItem(receiptKey); } catch (ignore) {}
        if (onStatus) onStatus("赛果暂时没送出去，下次打开会再试");
      } else if (onStatus) onStatus("赛果已经投给言秋，等TA看到");
      return "";
    });
  }
  // 游戏生成统一走这个：更长超时 + 失败重试（人多时单次请求大、思考型模型慢，别一次超时就崩）
  async function callRetry(api, sys, msgs, opts) {
    opts = Object.assign({ timeout: 90000 }, opts || {});
    let last;
    for (let i = 0; i < 2; i++) { try { return await callAI(api, sys, msgs, opts); } catch (e) { if (opts.signal && opts.signal.aborted) throw e; last = e; } }
    throw last;
  }
  // 能力≠性格：所有游戏共用的反刻板铁律，焊进每次生成
  const SKILL_RULE ="【能力与性格分开·非常重要】把「性格风格」和「真实水平」当成两件事：性格只决定 TA 怎么说话、什么语气；真实水平由 TA 的职业、背景、受过的训练、人生经历决定，和性格无关。绝不能因为性格开朗 / 单纯 / 憨 / 软就把 TA 演成脑子不好、推理拉垮——一个性格像小太阳但职业是程序员的人，逻辑和推理其实很强、玩推理游戏心里门儿清，只是嘴上仍旧暖乎乎的。按真实水平决定「玩得多好」，按性格决定「怎么表达」。";
  // 能力小传说人话（她 2026-10-16：「这些评估是不是可以说人话一点，包括全部游戏的」）：
  //   原来写出来像武侠小说的人物志——「天衣无缝」「悄无声息下了套」，个个是高手。真人不是个个会记牌、会算。
  const SKILL_TALK = "\n【能力小传怎么写】这段是写给她看的，像朋友随口跟她介绍「这人玩这个什么样」：大白话、短句，说具体的习惯——会不会算、记不记牌、爱不爱冒险、容易在哪儿犯迷糊。"
    + "不堆成语、不用「天衣无缝」「运筹帷幄」「滴水不漏」这类书面夸张词，不写成小说里的人物介绍。别把人吹成高手：照人设实话实说，大多数人就是普通水平，有长处也有毛病，该菜就说菜。60~100 字。";

  // 说人话、是这个人在说（她 2026-10-11：「之前修过擂台说人话、一起学贴人设，小游戏也看看」）：
  //   牌桌上那些让人开口的生成（描述、发言、投票理由、遗言、嘴仗、接话）原来只递「真实水平」，不递人设——
  //   模型只能拿一个通用玩家的腔调替全桌说话，越说越像分析报告。跟擂台那条同一个判据，只给判据不给例句。
  const VOICE_RULE = "【是这个人在说话 · 说人话】下面每一句台词都是那个人自己张嘴说的：用TA人设里那种说话的样子——TA的词、TA的脾气、TA跟在场的人的关系；遮住名字要认得出是谁说的，别全桌一个腔调。"
    + "这是几个认识的人围桌玩，不是写复盘：一句里堆了两个以上的抽象名词、或者像在念攻略写分析，就是飘了，换成TA自己会说的大白话。判据：念给桌边一个没玩过这游戏的人听，TA听得懂、接得上话。水平高低只管TA玩得多好，不改TA说话的样子。\n\n";
  // 每个开口的人后面挂一句「说话的样子」：真人角色读完整人设的开头，NPC 读生成的那一句
  // 小游戏里陪聊那几句（她 2026-10-23：「一次一个气泡是不是太少了」）：跟聊天一样想说几句说几句，一句一个气泡。
  //   不封顶（她：「有些人就是话多」），提示词里也不写数（写了它就照着凑）。
  const GAME_SAY_FREE = "照你平时说话的样子，想说几句就几句，一句一条；没什么想说的可以不说。";
  function sayList(v) { return (Array.isArray(v) ? v : [v]).map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean); }
  function gameVoiceRules() {
    return AC + VOICE_RULE + SKILL_RULE + [
      typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? REGISTER_FOLLOWS_SCENE : "",
      typeof ECHO_QUESTION_BAN !== "undefined" ? ECHO_QUESTION_BAN : "",
      typeof STOCK_REPLY_BAN !== "undefined" ? STOCK_REPLY_BAN : "",
      typeof INTIMATE_CHAT_ANTI_CLICHE !== "undefined" ? INTIMATE_CHAT_ANTI_CLICHE : "",
      typeof CONDESCENDING_TONE_BAN !== "undefined" ? CONDESCENDING_TONE_BAN : ""
    ].filter(Boolean).join("\n");
  }
  // 角色卡整张：人设之外写在性格／一句话介绍／背景里的也算（她 2026-10-22「你画我猜说话不像角色」→「别的游戏看看有没有漏的，全部抽成公共的」）。
  //   入局时在 routedCharacters 那一处统一填进 persona，各游戏照旧读 .persona 就是整张
  function gameSheet(c) {
    if (!c) return "";
    const seen = new Set(), out = [];
    [c.persona, c.personality, c.tagline, c.background].forEach(function (x) { const v = String(x || "").trim(); if (v && !seen.has(v) && !out.some(function (o) { return o.indexOf(v) >= 0; })) { seen.add(v); out.push(v); } });
    return out.join("\n");
  }
  // 这一座是谁（她 2026-10-22「故事接龙大家说的话都一样」）：UNO、骗子骰、故事接龙、德扑、抽鬼牌、21 点
  //   原来只写一句「保持你本人的声纹和性格」，却从没告诉模型「你」是谁、人设是什么——全桌只能一个腔调。
  function seatIdentity(p) {
    if (!p || p.isUser) return "";
    const sheet = String(p.persona || (p.char && gameSheet(p.char)) || "").trim();
    return "\n你是「" + (p.name || "TA") + "」" + (p.isNpc ? "（来凑数的牌友）" : "") + "。" + (sheet ? "\n【你的人设】\n" + sheet.slice(0, 1800) : "") + "\n";
  }
  function voiceBrief(p) {
    const s = String((p && (p.persona || (p.char && p.char.persona))) || "").replace(/\s+/g, " ").trim();
    return s ? "\n   说话的样子（人设）：" + s.slice(0, 220) : "";
  }

  // 台词念出来（她 2026-10-11）：配了音色的角色，台词旁边一颗小 ▶，跟通话转录那颗是同一个（TtsDot + useTtsPlayer）。
  //   一桌只许一个人在说话：点下一句先停掉上一句（每颗各有自己的播放器，用一个全局的「谁在念」接力）。
  function GameVoiceDot(props) {
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
    const spk = props.p && !props.p.isNpc && !props.p.isUser ? props.p.char : null;
    if (!tp || !spk || typeof TtsDot !== "function") return null;
    const relay = { play: tp.play, toggle: function (k, text, voiceId) {
      if (window.__gameTtsStop && window.__gameTtsStop !== tp.stop) { try { window.__gameTtsStop(); } catch (e) {} }
      window.__gameTtsStop = tp.stop; tp.toggle(k, text, voiceId);
    } };
    return h("span", { "data-wk": "gamevoice", style: { display: "inline-flex", verticalAlign: "middle", marginLeft: 6, color: "#8a8378" } },
      h(TtsDot, { k: props.k, text: props.text, spk: spk, tp: relay }));
  }

  // ---- 通用：分段控件 ----
  function Segmented(props) {
    const t = props.t;
    return h("div", { "data-wk": "gameseg", style: { display: "flex", gap: 6, background: t.bg2, borderRadius: 12, padding: 4 } },
      props.options.map(function (o) {
        const on = o.key === props.value;
        return h("button", { "data-wk": "gamesegbtn", "data-on": on ? "1" : "0", key: o.key, onClick: function () { props.onChange(o.key); },
          style: { flex: 1, padding: "8px 4px", borderRadius: 9, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", fontWeight: on ? 700 : 400, color: on ? "#f3efe6" : t.sub, background: on ? t.ink : "transparent", transition: "all .15s" } }, o.zh);
      }));
  }

  // ---- 通用：开关行 ----
  function ToggleRow(props) {
    const t = props.t;
    return h("div", { "data-wk": "gametoggle", style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0" } },
      h("div", { style: { flex: 1 } },
        h("div", { "data-wk": "gametogglelabel", style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, props.label),
        props.sub ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, props.sub) : null),
      h(Toggle, { on: !!props.on, onChange: () => props.onToggle && props.onToggle(), color: t.ink, offColor: t.line, wk: "gameswitch", label: typeof props.label === "string" ? props.label : undefined }));
  }

  // ---- 通用：步进器 ----
  function Stepper(props) {
    const t = props.t;
    const btn = function (label, fn, dis) { return h("button", { onClick: fn, disabled: dis, style: { width: 26, height: 26, borderRadius: 7, border: "1px solid " + t.line, color: dis ? t.line : t.sub, fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: "22px", background: t.bg2 } }, label); };
    return h("div", { "data-wk": "gamestepper", style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
      btn("−", function () { props.onChange(Math.max(props.min, props.value - 1)); }, props.value <= props.min),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, minWidth: 18, textAlign: "center" } }, props.value),
      btn("+", function () { props.onChange(Math.min(props.max, props.value + 1)); }, props.value >= props.max));
  }

  // ---- 存档：住大仓库（她 2026-10-10：「还有什么在小仓库一起搬了」）----
  //   原来住小仓库（wolf_save / games_save / tod_prompt_history_v1），她那台常年贴着 5MB，
  //   存档写不进去还不报错，退出来再进就是空的。老的那份第一次读到时搬过来、从小仓库删掉。
  function bigGet(key, oldKey, fallback) {
    let v = null;
    try { v = typeof loadJSON === "function" ? loadJSON(key, null) : null; } catch (e) {}
    if (v == null && oldKey) {
      try { const raw = localStorage.getItem(oldKey); if (raw != null) { v = JSON.parse(raw); if (typeof saveJSON === "function") saveJSON(key, v); localStorage.removeItem(oldKey); } } catch (e) {}
    }
    return v == null ? fallback : v;
  }
  function bigSet(key, v) { try { return typeof saveJSON === "function" ? saveJSON(key, v) : false; } catch (e) { return false; } }
  const WOLF_SAVE = "x_wolfSave";
  function loadWolfSave() { return bigGet(WOLF_SAVE, "wolf_save", null); }
  function saveWolf(s) { bigSet(WOLF_SAVE, s); }
  function clearWolf() { bigSet(WOLF_SAVE, null); try { localStorage.removeItem("wolf_save"); } catch (e) {} }

  // ---- 通用对局存档（每种游戏一个槽；退出即存、打完即清；狼人杀走上面自己那套）----
  const GS_SAVE = "x_gamesSave";  // { [gameKey]: snapshot }
  function loadGamesSaves() { const v = bigGet(GS_SAVE, "games_save", {}); return v && typeof v === "object" ? v : {}; }
  function loadGameSave(k) { return loadGamesSaves()[k] || null; }
  function saveGameSnap(k, snap) { const all = loadGamesSaves(); all[k] = snap; return bigSet(GS_SAVE, all); }
  // CC 回执按 turn_id 幂等领取。仅用 day/round 或裸毫秒都可能在新局、时钟回拨、
  // 同毫秒连续出票时撞上旧回执；所有没有稳定局号的临时票统一加随机尾巴。
  function freshCCTurn(prefix) {
    return String(prefix || "game") + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function clearGameSave(k) { const all = loadGamesSaves(); delete all[k]; bigSet(GS_SAVE, all); }
  // 玩家名单存/取：剥离不可靠的 char（React 元素/整份档案），续局按 key 从 characters/profile 重挂
  function serPlayers(players) { return (players || []).map(function (p) { return { key: p.key, name: p.name, isUser: !!p.isUser, isNpc: !!p.isNpc, role: p.role, side: p.side, word: p.word, skill: p.skill, persona: p.persona, recent: p.recent || "", ties: p.ties || "", alive: p.alive, engineer: !!p.engineer }; }); }
  function hydPlayers(saved, props, t) {
    return (saved || []).map(function (s) {
      let char = null;
      if (s.isUser) { const pf = props.profile || {}; char = { name: pf.name || "你", avatarImage: pf.avatarImage, color: pf.color || t.tint }; }
      else if (!s.isNpc) { char = (props.characters || []).find(function (c) { return c.id === s.key; }) || null; }
      // 兼容旧存档：旧版没保存 engineer，续局后头像仍是言秋、CC 工牌却丢了。
      const engineer = !s.isUser && !s.isNpc && !!(props.config && props.config.ccSeat !== false && props.isEngineer && props.isEngineer(s.key));
      return Object.assign({}, s, { char: char, engineer: engineer || !!s.engineer });
    });
  }

  // ---- 玩家详情卡：点头像回看系统分配的「能力小传」+人设（结束时也给身份）----
  // 居中弹框：需要选择时跳出来，可关掉回看发言（防底部按钮被截断）
  function PickerModal(props) {
    const t = props.t;
    return h("div", { "data-wk": "gamepicker", style: { position: "absolute", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 } },
      h("div", { onClick: props.onClose, style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" } }),
      h("div", { "data-wk": "gamepickerbox", style: { position: "relative", background: t.bg, borderRadius: 16, padding: "16px 16px 16px", width: "100%", maxWidth: 340, maxHeight: "80%", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.32)" } },
        props.title ? h("div", { "data-wk": "gamepickertitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, textAlign: "center", marginBottom: props.sub ? 3 : 12 } }, props.title) : null,
        props.sub ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginBottom: 12, lineHeight: 1.5, whiteSpace: "pre-line" } }, props.sub) : null,
        props.children,
        props.onClose ? h("button", { "data-wk": "gamepickerclose", onClick: props.onClose, style: { display: "block", margin: "12px auto 0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "4px 12px" } }, "先关掉 · 回看发言") : null));
  }
  function PlayerCard(props) {
    const t = props.t, p = props.p;
    // personaText 传入时用它（真心话喂完整人设）；否则真人角色只显一句 tagline、NPC 显生成的一句人设
    const persona = props.personaText != null ? props.personaText : (p.isUser ? "" : (p.isNpc ? (p.persona || "") : ((p.char && p.char.tagline) || "")));
    return h("div", { "data-wk": "gameplayercard", onClick: props.onClose, style: { position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } },
      h("div", { "data-wk": "gameplayerbox", onClick: function (e) { e.stopPropagation(); }, style: { background: t.bg, borderRadius: 16, padding: "18px 18px 20px", width: "100%", maxWidth: 320, maxHeight: "76%", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.3)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } }, props.avatar,
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { "data-wk": "gameplayername", style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: t.ink } }, p.name + (p.isUser ? "（你）" : "")),
            props.roleText ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: props.roleBad ? "#c0553f" : t.tint, marginTop: 2 } }, props.roleText) : (p.alive === false ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "已出局（身份不公开）") : null))),
        // hideSkill：派对游戏（真心话）没有「牌桌能力」概念，直接看人设，不显空的能力评估
        props.hideSkill ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, letterSpacing: .5, marginBottom: 5 } }, "牌桌能力小传（系统评估）"),
        props.hideSkill ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.ink, marginBottom: persona ? 14 : 0 } }, p.isUser ? "这是你本人，系统没有替你评估水平——你自己发挥。" : (p.skill || "（没评估到）")),
        persona ? h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, letterSpacing: .5, marginBottom: 5 } }, props.hideSkill ? "人设" : "人设 / 补充"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.65, color: t.sub, whiteSpace: "pre-line" } }, persona)) : null,
        h("button", { "data-wk": "gameplayerclose", onClick: props.onClose, style: { marginTop: 16, width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px" } }, "关了")));
  }

  // ============================================================
  // 中枢（书架式游戏卡）
  // ============================================================
  // ============================================================
  // 游戏盒面（她 2026-09-03：「小游戏的界面还是有点普通无聊」）
  //
  // 原来这一屏是一列一模一样的圆角卡：emoji + 名字 + 一句说明。
  // 判据（施工规则/tabs-not-plain-pills.md）：**原样搬到另一个 app 里还成立吗？**
  // 成立——那就是一张设置页的功能列表，换成「订阅方案」「导出格式」照样能用。
  // 而 emoji 是最省事也最不说明问题的图：🎲 换到哪个 app 里都是🎲。
  //
  // 那先问：这个 app 在现实里是什么？——**架子上摆的一摞桌游盒**。
  // 每一盒的封面画的就是那副游戏本身长什么样：卧底是一叠词条纸、狼人杀是夜里的身份牌、
  // 海龟汤是一碗冒着问号的汤、25 问是划掉的格子、真心话是躺倒的瓶子、
  // 阿瓦隆是一排任务圈、大富翁是棋盘角上两颗骰子、UNO 是扇开的一把牌。
  // 盒子有厚度（底下那道深边）、坐在一条木架线上——这才是「一架游戏」，不是一列条目。
  //
  // ⚠️盒面的颜色是【故意写死】的：它是一张画，不是界面。
  //   八个盒子各有各的色，摆在一起才像一架收藏；跟着主题一起变色反而全糊成一片。
  //   （同 assistant.js 里那只鸟的理由。）狼人杀和 UNO 用深色盒面，本来就该是夜里的。
  // paper=盒面底色 · ink=盒面上画画的墨 · hot=这一盒的重点色
  // band/bandInk=下缘那条名字带。⚠️两个深色盒（狼人杀、UNO）必须单列 band：
  //   拿 ink 当带子色的话，深盒底下会挂一条【浅色】带——整架就它俩反过来了。
  const LID = {
    spy:       { paper: "#efe7d8", ink: "#4a4438", hot: "#b0553f", band: "#4a4438", bandInk: "#efe7d8" },
    haigui:    { paper: "#dde8e5", ink: "#364a46", hot: "#4f8378", band: "#364a46", bandInk: "#dde8e5" },
    q25:       { paper: "#eae5ef", ink: "#443c4d", hot: "#7a5f96", band: "#443c4d", bandInk: "#eae5ef" },
    tod:       { paper: "#f3e2db", ink: "#55403a", hot: "#c26a4e", band: "#55403a", bandInk: "#f3e2db" },
    werewolf:  { paper: "#23262e", ink: "#cdd2db", hot: "#8f97a8", band: "#14161b", bandInk: "#cdd2db" },
    avalon:    { paper: "#e6e2d3", ink: "#3f4436", hot: "#8a6a2f", band: "#3f4436", bandInk: "#e6e2d3" },
    monopoly:  { paper: "#e5eee1", ink: "#3a4837", hot: "#5d8b4c", band: "#3a4837", bandInk: "#e5eee1" },
    draw:      { paper: "#f1e6dc", ink: "#4a3b33", hot: "#d0533f", band: "#4a3b33", bandInk: "#f1e6dc" },
    gomoku:    { paper: "#ecdcb8", ink: "#4a3a22", hot: "#1f1d1b", band: "#4a3a22", bandInk: "#ecdcb8" },
    uno:       { paper: "#2a2a2e", ink: "#f0eee8", hot: "#d94f3d", band: "#18181b", bandInk: "#f0eee8" },
    liar:      { paper: "#e9dccb", ink: "#4b3527", hot: "#a8442f", band: "#4b3527", bandInk: "#e9dccb" },
    poker:     { paper: "#dfe9df", ink: "#24402f", hot: "#b8433a", band: "#24402f", bandInk: "#dfe9df" },
    oldmaid:   { paper: "#ebe3f0", ink: "#47395a", hot: "#7a4fb0", band: "#47395a", bandInk: "#ebe3f0" },
    blackjack: { paper: "#e4e8de", ink: "#2c3a2a", hot: "#c0392b", band: "#2c3a2a", bandInk: "#e4e8de" },
    doudizhu:  { paper: "#f1e3d3", ink: "#5a2e22", hot: "#c0392b", band: "#5a2e22", bandInk: "#f1e3d3" },
    date:      { paper: "#f3e2d8", ink: "#654137", hot: "#b86651", band: "#654137", bandInk: "#f3e2d8" },
    story:     { paper: "#eee8dc", ink: "#3e4250", hot: "#5d6fa3", band: "#3e4250", bandInk: "#eee8dc" },
    tetris:    { paper: "#26252c", ink: "#ece8e0", hot: "#e8b53c", band: "#17161b", bandInk: "#ece8e0" },
    chess:     { paper: "#ece4d6", ink: "#3d3128", hot: "#b58863", band: "#3d3128", bandInk: "#ece4d6" },
    xiangqi:   { paper: "#f2dfb8", ink: "#5a3418", hot: "#b8322a", band: "#5a3418", bandInk: "#f2dfb8" },
    go:        { paper: "#e9cf98", ink: "#3d2c16", hot: "#1a1816", band: "#3d2c16", bandInk: "#e9cf98" },
    jungle:    { paper: "#dfe8c6", ink: "#3f5a3a", hot: "#b8322a", band: "#3f5a3a", bandInk: "#dfe8c6" },
    lingxi:    { paper: "#f1e4e6", ink: "#4d3a40", hot: "#c2566e", band: "#4d3a40", bandInk: "#f1e4e6" }
  };
  function GameLid(props) {
    const k = props.k, c = LID[k] || LID.spy;
    const S = function (tag, at, kids) { return h(tag, at, kids); };
    const art = {
      // 一叠词条纸：三张错开，最上面那张的字排得不一样——那就是卧底手里的那张
      spy: [
        h("g", { key: "a", transform: "rotate(-7 34 46)" }, h("rect", { x: 18, y: 28, width: 34, height: 42, rx: 3, fill: c.ink, opacity: .13 })),
        h("g", { key: "b", transform: "rotate(4 46 44)" }, h("rect", { x: 30, y: 24, width: 34, height: 42, rx: 3, fill: c.ink, opacity: .2 })),
        h("rect", { key: "c", x: 44, y: 20, width: 36, height: 44, rx: 3, fill: "#fff", opacity: .92, stroke: c.ink, strokeOpacity: .3 }),
        h("path", { key: "d", d: "M51 31h22M51 39h22M51 47h13", stroke: c.ink, strokeWidth: 2.2, strokeLinecap: "round", opacity: .5 }),
        h("path", { key: "e", d: "M51 55h17", stroke: c.hot, strokeWidth: 2.6, strokeLinecap: "round" })
      ],
      // 一碗汤，热气弯成一个问号
      haigui: [
        h("path", { key: "a", d: "M28 44h64c0 16-14 24-32 24S28 60 28 44z", fill: c.ink, opacity: .18 }),
        h("ellipse", { key: "b", cx: 60, cy: 44, rx: 32, ry: 6.5, fill: c.hot, opacity: .55 }),
        h("path", { key: "c", d: "M24 44h72", stroke: c.ink, strokeWidth: 2.4, strokeLinecap: "round", opacity: .6 }),
        h("path", { key: "d", d: "M54 32c0-5 8-5 8-10s-6-6-8-2", stroke: c.hot, strokeWidth: 3, strokeLinecap: "round", fill: "none" }),
        h("circle", { key: "e", cx: 54, cy: 37, r: 1.9, fill: c.hot })
      ],
      // 五乘五的格子，划掉了几个
      q25: (function () {
        const out = [], off = { 0: 1, 3: 1, 6: 1, 7: 1, 11: 1, 12: 1, 15: 1 };
        for (let i = 0; i < 25; i++) {
          const x = 26 + (i % 5) * 14, y = 16 + Math.floor(i / 5) * 14;
          out.push(h("rect", { key: "r" + i, x: x, y: y, width: 11, height: 11, rx: 2, fill: "none", stroke: c.ink, strokeWidth: 1.3, strokeOpacity: .45 }));
          if (off[i]) out.push(h("path", { key: "x" + i, d: "M" + (x + 2.5) + " " + (y + 2.5) + "l6 6M" + (x + 8.5) + " " + (y + 2.5) + "l-6 6", stroke: c.hot, strokeWidth: 1.8, strokeLinecap: "round" }));
        }
        return out;
      })(),
      // 躺倒的瓶子，底下一圈转过的轨迹
      tod: [
        h("ellipse", { key: "a", cx: 60, cy: 46, rx: 34, ry: 17, fill: "none", stroke: c.ink, strokeWidth: 1.6, strokeDasharray: "3 5", strokeOpacity: .4 }),
        h("rect", { key: "b", x: 40, y: 36, width: 34, height: 19, rx: 9.5, fill: c.hot, opacity: .85 }),
        h("rect", { key: "c", x: 72, y: 41, width: 12, height: 9, rx: 2.5, fill: c.hot }),
        h("rect", { key: "d", x: 82, y: 39.5, width: 4, height: 12, rx: 1.6, fill: c.ink, opacity: .6 }),
        h("path", { key: "e", d: "M46 41h9", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", opacity: .65 })
      ],
      // 夜里的身份牌：一轮月亮，中间那张翻起一角露出狼耳
      werewolf: [
        h("path", { key: "m", d: "M92 14a13 13 0 10 -0.1 19A15 15 0 0192 14z", fill: c.hot, opacity: .8 }),
        h("rect", { key: "a", x: 20, y: 34, width: 26, height: 36, rx: 3, fill: c.ink, opacity: .18, transform: "rotate(-9 33 52)" }),
        h("rect", { key: "b", x: 74, y: 34, width: 26, height: 36, rx: 3, fill: c.ink, opacity: .18, transform: "rotate(9 87 52)" }),
        h("rect", { key: "c", x: 47, y: 30, width: 27, height: 38, rx: 3, fill: c.ink, opacity: .32 }),
        h("path", { key: "d", d: "M53 50l3.5-9 4 5.5 5-5.5 3.5 9z", fill: c.hot, opacity: .95 }),
        h("circle", { key: "e", cx: 57, cy: 56, r: 1.5, fill: c.paper }),
        h("circle", { key: "f", cx: 64, cy: 56, r: 1.5, fill: c.paper })
      ],
      // 一排任务圈：成了两个、崩了一个、还剩两个空的；上面横着一把剑
      avalon: [
        h("path", { key: "s", d: "M40 22h38l8 3.2-8 3.2H40z", fill: c.ink, opacity: .55 }),
        h("rect", { key: "g", x: 35, y: 15.5, width: 3.4, height: 19, rx: 1.4, fill: c.ink, opacity: .7 }),
        h("rect", { key: "h", x: 26, y: 22.6, width: 9, height: 4.2, rx: 1.6, fill: c.hot, opacity: .85 }),
        h("circle", { key: "p", cx: 24, cy: 24.7, r: 3.1, fill: c.ink, opacity: .6 })
      ].concat([0, 1, 2, 3, 4].map(function (i) {
        const cx = 24 + i * 18, done = i < 2, bad = i === 2;
        return h("g", { key: "q" + i },
          h("circle", { cx: cx + 6, cy: 50, r: 8.5, fill: done ? c.hot : "none", opacity: done ? .8 : 1, stroke: c.ink, strokeWidth: 1.6, strokeOpacity: done ? 0 : .45 }),
          bad ? h("path", { d: "M" + (cx + 2) + " 46l8 8M" + (cx + 10) + " 46l-8 8", stroke: c.hot, strokeWidth: 2, strokeLinecap: "round" }) : null);
      })),
      // 棋盘角上两颗骰子
      monopoly: [
        h("path", { key: "b", d: "M18 66V22h44", stroke: c.ink, strokeWidth: 2, strokeOpacity: .35, fill: "none" })
      ].concat([0, 1, 2, 3].map(function (i) {
        return h("rect", { key: "c" + i, x: 18, y: 22 + i * 11, width: 11, height: 10, rx: 1.5, fill: i % 2 ? c.hot : c.ink, opacity: i % 2 ? .55 : .18 });
      })).concat([0, 1, 2].map(function (i) {
        return h("rect", { key: "d" + i, x: 31 + i * 11, y: 22, width: 10, height: 10, rx: 1.5, fill: i % 2 ? c.hot : c.ink, opacity: i % 2 ? .55 : .18 });
      })).concat([
        h("rect", { key: "e", x: 62, y: 38, width: 22, height: 22, rx: 5, fill: "#fff", opacity: .95, stroke: c.ink, strokeOpacity: .3, transform: "rotate(-10 73 49)" }),
        h("circle", { key: "f", cx: 68, cy: 45, r: 2, fill: c.ink }), h("circle", { key: "g", cx: 78, cy: 53, r: 2, fill: c.ink }),
        h("rect", { key: "h", x: 82, y: 46, width: 19, height: 19, rx: 4.5, fill: c.hot, opacity: .9, transform: "rotate(12 91 55)" }),
        h("circle", { key: "i", cx: 91, cy: 55, r: 1.9, fill: "#fff" })
      ]),
      // 扇开的一把牌
      // 一张纸上歪歪扭扭一只猫，旁边一个问号
      draw: [
        h("rect", { key: "a", x: 24, y: 18, width: 58, height: 52, rx: 4, fill: "#fff", opacity: .9, stroke: c.ink, strokeOpacity: .3 }),
        h("path", { key: "b", d: "M40 58c-4-10 2-20 13-20s17 10 13 20zM44 40l-3-8 8 5M62 40l3-8-8 5", stroke: c.ink, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", opacity: .7 }),
        h("path", { key: "c", d: "M86 30c0-6 10-6 10 0 0 4-5 4-5 9M91 45v.5", stroke: c.hot, strokeWidth: 2.8, fill: "none", strokeLinecap: "round" }),
        h("circle", { key: "d", cx: 48, cy: 49, r: 1.6, fill: c.ink, opacity: .7 }),
        h("circle", { key: "e", cx: 58, cy: 49, r: 1.6, fill: c.ink, opacity: .7 }),
        h("path", { key: "f", d: "M20 76l12-4M30 78l-3-9", stroke: c.hot, strokeWidth: 2.4, strokeLinecap: "round", opacity: .8 })
      ],
      // 一角棋盘，黑白几颗子斜着连起来
      gomoku: [
        h("path", { key: "a", d: "M26 30h68M26 44h68M26 58h68M26 72h68M36 22v58M50 22v58M64 22v58M78 22v58", stroke: c.ink, strokeWidth: 1.4, opacity: .35 }),
        h("circle", { key: "b", cx: 36, cy: 72, r: 6, fill: c.hot }),
        h("circle", { key: "c", cx: 50, cy: 58, r: 6, fill: c.hot }),
        h("circle", { key: "d", cx: 64, cy: 44, r: 6, fill: c.hot }),
        h("circle", { key: "e", cx: 50, cy: 44, r: 6, fill: "#fff", stroke: c.ink, strokeOpacity: .4 }),
        h("circle", { key: "f", cx: 64, cy: 58, r: 6, fill: "#fff", stroke: c.ink, strokeOpacity: .4 })
      ],
      // 扣着的骰盅，旁边漏出两颗骰子
      liar: [
        h("path", { key: "a", d: "M30 60l8-34h34l8 34z", fill: c.ink, opacity: .78 }),
        h("ellipse", { key: "b", cx: 55, cy: 60, rx: 27, ry: 5, fill: c.ink }),
        h("path", { key: "c", d: "M42 32h26", stroke: c.paper, strokeWidth: 2, strokeLinecap: "round", opacity: .35 }),
        h("rect", { key: "d", x: 78, y: 52, width: 16, height: 16, rx: 3.5, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(14 86 60)" }),
        h("circle", { key: "e", cx: 86, cy: 60, r: 2.4, fill: c.hot }),
        h("rect", { key: "f", x: 92, y: 36, width: 14, height: 14, rx: 3, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(-12 99 43)" }),
        h("circle", { key: "g", cx: 96, cy: 40, r: 1.5, fill: c.ink }), h("circle", { key: "i", cx: 102, cy: 46, r: 1.5, fill: c.ink })
      ],
      // 两张底牌叠着，旁边一摞筹码
      poker: [
        h("rect", { key: "a", x: 30, y: 26, width: 28, height: 38, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(-10 44 45)" }),
        h("rect", { key: "b", x: 46, y: 24, width: 28, height: 38, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(8 60 43)" }),
        h("text", { key: "c", x: 60, y: 48, textAnchor: "middle", fontSize: 16, fill: c.ink }, "♠"),
        h("ellipse", { key: "d", cx: 92, cy: 62, rx: 12, ry: 4, fill: c.hot }), h("ellipse", { key: "e", cx: 92, cy: 56, rx: 12, ry: 4, fill: c.ink }), h("ellipse", { key: "f", cx: 92, cy: 50, rx: 12, ry: 4, fill: c.hot })
      ],
      // 一把扇开的牌，中间那张是鬼
      oldmaid: [
        h("rect", { key: "a", x: 34, y: 28, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(-18 47 64)" }),
        h("rect", { key: "b", x: 47, y: 24, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.hot, strokeWidth: 1.5 }),
        h("rect", { key: "c", x: 60, y: 28, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(18 73 64)" }),
        h("text", { key: "d", x: 60, y: 48, textAnchor: "middle", fontSize: 15 }, "🃏")
      ],
      // A 和 K 摊开，旁边写个 21
      blackjack: [
        h("rect", { key: "a", x: 28, y: 26, width: 28, height: 38, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4 }),
        h("text", { key: "b", x: 42, y: 50, textAnchor: "middle", fontSize: 15, fill: c.ink }, "A"),
        h("rect", { key: "c", x: 52, y: 30, width: 28, height: 38, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4 }),
        h("text", { key: "d", x: 66, y: 54, textAnchor: "middle", fontSize: 15, fill: c.hot }, "K"),
        h("text", { key: "e", x: 98, y: 52, textAnchor: "middle", fontSize: 18, fontWeight: 700, fill: c.hot }, "21")
      ],
      // 一把扇开的牌，最前面是大王
      doudizhu: [
        h("rect", { key: "a", x: 30, y: 30, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(-20 43 66)" }),
        h("rect", { key: "b", x: 40, y: 26, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(-7 53 62)" }),
        h("rect", { key: "c", x: 52, y: 26, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.ink, strokeOpacity: .4, transform: "rotate(7 65 62)" }),
        h("rect", { key: "d", x: 62, y: 30, width: 26, height: 36, rx: 4, fill: "#fff", stroke: c.hot, strokeWidth: 1.5, transform: "rotate(20 75 66)" }),
        h("text", { key: "e", x: 77, y: 52, textAnchor: "middle", fontSize: 13, fill: c.hot, transform: "rotate(20 75 66)" }, "王")
      ],
      // 摊开的本子，一行行字一直写到右页，末尾一支笔
      date: [
        h("path", { key: "a", d: "M19 35h35v30H19zM67 23h35v30H67z", fill: "#fff", stroke: c.ink, strokeOpacity: .4 }),
        h("path", { key: "b", d: "M19 35l17 13 18-13M67 23l17 13 18-13M48 25c9-9 19-8 27-5M73 61c-8 8-19 8-26 5", fill: "none", stroke: c.hot, strokeWidth: 2, strokeLinecap: "round" }),
        h("circle", { key: "c", cx: 36, cy: 53, r: 3, fill: c.hot }), h("circle", { key: "d", cx: 84, cy: 42, r: 3, fill: c.hot })
      ],
      // 一摞落好的方块，顶上还悬着一块 T
      tetris: [
        h("rect", { key: "a", x: 30, y: 58, width: 60, height: 10, fill: "#4fb3c8" }),
        h("rect", { key: "b", x: 30, y: 48, width: 20, height: 10, fill: "#5ea86a" }), h("rect", { key: "c", x: 60, y: 48, width: 30, height: 10, fill: "#e08a3c" }),
        h("rect", { key: "d", x: 40, y: 38, width: 10, height: 10, fill: "#5ea86a" }), h("rect", { key: "e", x: 70, y: 38, width: 20, height: 10, fill: "#e8b53c" }),
        h("path", { key: "f", d: "M48 14h30v10h-10v10h-10v-10h-10z", fill: "#9a6ab8" }),
        h("path", { key: "g", d: "M63 36v6", stroke: c.ink, strokeWidth: 1.5, strokeDasharray: "2 3", opacity: .5 })
      ],
      // 一角棋盘，上面站着一个王和一个马
      chess: [
        h("path", { key: "a", d: "M24 26h72v48H24z", fill: "#f0d9b5", stroke: c.ink, strokeOpacity: .4 }),
        h("path", { key: "b", d: "M36 26h12v12H36zM60 26h12v12H60zM84 26h12v12H84zM24 38h12v12H24zM48 38h12v12H48zM72 38h12v12H72zM36 50h12v12H36zM60 50h12v12H60zM84 50h12v12H84zM24 62h12v12H24zM48 62h12v12H48zM72 62h12v12H72z", fill: "#b58863" }),
        h("text", { key: "c", x: 46, y: 64, textAnchor: "middle", fontSize: 30, fill: c.ink }, "\u265A"),
        h("text", { key: "d", x: 76, y: 60, textAnchor: "middle", fontSize: 26, fill: "#fff", stroke: c.ink, strokeWidth: .8 }, "\u2658")
      ],
      // 两颗木头棋子，一红「帅」一黑「将」，压在楚河汉界上
      xiangqi: [
        h("path", { key: "a", d: "M22 34h76M22 62h76", stroke: c.ink, strokeWidth: 1.2, opacity: .35 }),
        h("circle", { key: "b", cx: 46, cy: 48, r: 15, fill: "#f7e6c4", stroke: "#b8322a", strokeWidth: 2 }),
        h("text", { key: "c", x: 46, y: 54, textAnchor: "middle", fontSize: 16, fontWeight: 700, fill: "#b8322a" }, "帅"),
        h("circle", { key: "d", cx: 76, cy: 50, r: 15, fill: "#f7e6c4", stroke: "#2b2622", strokeWidth: 2 }),
        h("text", { key: "e", x: 76, y: 56, textAnchor: "middle", fontSize: 16, fontWeight: 700, fill: "#2b2622" }, "将")
      ],
      // 一块绿地一条河，一红「狮」一蓝「象」隔河对着
      jungle: [
        h("rect", { key: "a", x: 22, y: 42, width: 76, height: 14, fill: "#8fc3dd", opacity: .8 }),
        h("circle", { key: "b", cx: 44, cy: 32, r: 13, fill: "#fbf3df", stroke: "#b8322a", strokeWidth: 2 }),
        h("text", { key: "c", x: 44, y: 37.5, textAnchor: "middle", fontSize: 14, fontWeight: 700, fill: "#b8322a" }, "狮"),
        h("circle", { key: "d", cx: 76, cy: 66, r: 13, fill: "#fbf3df", stroke: "#2f5f9e", strokeWidth: 2 }),
        h("text", { key: "e", x: 76, y: 71.5, textAnchor: "middle", fontSize: 14, fontWeight: 700, fill: "#2f5f9e" }, "象")
      ],
      // 一角十九路，黑白几颗子交错着
      go: [
        h("path", { key: "a", d: "M24 26h72M24 38h72M24 50h72M24 62h72M24 74h72M30 20v60M42 20v60M54 20v60M66 20v60M78 20v60M90 20v60", stroke: c.ink, strokeWidth: 1.1, opacity: .35 }),
        h("circle", { key: "b", cx: 42, cy: 50, r: 5.5, fill: c.hot }), h("circle", { key: "c", cx: 54, cy: 38, r: 5.5, fill: c.hot }), h("circle", { key: "d", cx: 66, cy: 50, r: 5.5, fill: c.hot }),
        h("circle", { key: "e", cx: 54, cy: 50, r: 5.5, fill: "#fff", stroke: c.ink, strokeOpacity: .4 }), h("circle", { key: "f", cx: 54, cy: 62, r: 5.5, fill: "#fff", stroke: c.ink, strokeOpacity: .4 }), h("circle", { key: "g", cx: 66, cy: 62, r: 5.5, fill: "#fff", stroke: c.ink, strokeOpacity: .4 })
      ],
      // 两张写着词的小纸片，中间一根红线把它们连起来
      lingxi: [
        h("rect", { key: "a", x: 16, y: 30, width: 32, height: 24, rx: 3, fill: "#fff", opacity: .92, stroke: c.ink, strokeOpacity: .3, transform: "rotate(-6 32 42)" }),
        h("rect", { key: "b", x: 72, y: 30, width: 32, height: 24, rx: 3, fill: "#fff", opacity: .92, stroke: c.ink, strokeOpacity: .3, transform: "rotate(6 88 42)" }),
        h("path", { key: "c", d: "M24 42h16M80 42h16", stroke: c.ink, strokeWidth: 2.2, strokeLinecap: "round", opacity: .45 }),
        h("path", { key: "d", d: "M48 44c6 14 18 14 24 0", stroke: c.hot, strokeWidth: 2.4, fill: "none", strokeLinecap: "round" }),
        h("circle", { key: "e", cx: 60, cy: 54, r: 4, fill: c.hot })
      ],
      story: [
        h("path", { key: "a", d: "M60 24c-10-5-24-6-36-3v46c12-3 26-2 36 3z", fill: "#fff", opacity: .92, stroke: c.ink, strokeOpacity: .3 }),
        h("path", { key: "b", d: "M60 24c10-5 24-6 36-3v46c-12-3-26-2-36 3z", fill: "#fff", opacity: .92, stroke: c.ink, strokeOpacity: .3 }),
        h("path", { key: "c", d: "M30 32h22M30 40h24M30 48h20M30 56h23M66 32h22M66 40h18", stroke: c.ink, strokeWidth: 1.8, strokeLinecap: "round", opacity: .4 }),
        h("rect", { key: "d", x: 65, y: 46.8, width: 13, height: 2.4, rx: 1.2, fill: c.hot }),
        h("path", { key: "e", d: "M80 50l16-16 4 4-16 16-6 2z", fill: c.hot, opacity: .9 })
      ],
      uno: [0, 1, 2, 3].map(function (i) {
        const rot = -24 + i * 16, col = [c.hot, "#e8b53c", "#3f7fd0", "#4f9a58"][i];
        return h("g", { key: "u" + i, transform: "rotate(" + rot + " 60 76)" },
          h("rect", { x: 48, y: 22, width: 24, height: 36, rx: 3.5, fill: col }),
          h("ellipse", { cx: 60, cy: 40, rx: 7.5, ry: 11, fill: c.paper, opacity: .9, transform: "rotate(-20 60 40)" }));
      })
    };
    return h("svg", { viewBox: "0 0 120 84", style: { display: "block", width: "100%", height: "auto", background: c.paper } },
      art[k] || art.spy);
  }

  function Games(props) {
    const t = useTheme();
    const [game, setGame] = useState(null);       // 进入配置的游戏
    const [session, setSession] = useState(null);  // {game, config, resume, saved} 进入对局
    const [saveTick, setSaveTick] = useState(0);   // 存档变动后强刷横幅
    // 从聊天里那张邀请卡进来的：直接落到这一局的配置页，并把TA先勾上。
    // 形状照 study.js 的 props.entry / entryHandledRef 抄，不另开一条路。
    const entryHandledRef = useRef(null);
    // 这一局是从哪间房里被邀出来的（她 2026-09-12：「不能把收入小游戏记忆从主记忆库
    // 变成房间里面吗」）。照一起学那一戳：终局「收进记忆」要认它，才知道这一局
    // 算主线的还是只算那间房的。自己从架上挑的一局＝主线，所以那儿要清掉。
    const fromRoom = useRef(null);
    const entry = props.entry;
    useEffect(function () {
      if (!entry || !entry.key || entryHandledRef.current === entry.key) return;
      entryHandledRef.current = entry.key;
      const def = GAMES.find(function (g) { return g.key === entry.gameKey; });
      if (def) { setSession(null); fromRoom.current = { roomId: entry.roomId || "", personId: entry.characterId || "" }; setGame(def); }
    }, [entry && entry.key]);
    const wolfSave = loadWolfSave();
    const gSaves = loadGamesSaves();               // 通用存档（卧底/海龟汤/25问/真心话/阿瓦隆）

    if (session) {
      const selected = (session.config && session.config.charIds) || [];
      // 所有游戏引擎都会读取角色 persona。入局时按每个真人角色分别筛一次世界书，
      // 再作为本局设定并入副本；NPC 与没入局的人拿不到，原档案也不会被改写。
      const routedCharacters = (props.characters || []).map(function (c) {
        if (selected.indexOf(c.id) < 0) return c;
        const lore = props.worldbookFor ? props.worldbookFor(c.id, (session.game && session.game.zh) || "小游戏") : props.worldbook;
        return Object.assign({}, c, { persona: gameSheet(c) + (lore ? "\n\n【本局世界设定】\n" + lore : "") });
      });
      // 她在这一桌叫什么（群友 2026-10-29：真心话大冒险里角色只叫主面具的名字）：
      //   上桌的人认的都是同一张面具，就用那张；几个人认的不一样，各认各的没法一桌两个名字，照旧用主面具
      const tableProfile = (function () {
        if (!props.profileFor) return props.profile;
        const ps = selected.map(function (id) { return props.profileFor(id); }).filter(Boolean);
        if (!ps.length) return props.profile;
        return ps.every(function (x) { return x === ps[0]; }) ? ps[0] : props.profile;
      })();
      // ⚠️keepGameMemory 原来【不在这张表上】。app.js 那头的口子一直开着（v63.39
      //   「补上 63.38 被冲突刀吃掉的那半」），games.js 这头七个游戏也都画了那个键，
      //   **中间这一截从来没接过**——于是每一局终局点「把这一局收进记忆」都是空按，
      //   而且它还会弹一句「没有能收的：这局上场的都是 NPC」，等于点一次骗她一次。
      //   （一层写在两处、第二处没跟上；这一次断在第三处。）
      // 这一局是在哪间房里打的，一并递下去：终局那一下要按它决定收到哪儿。
      // 原来这盒永不进回忆；她 2026-10-23 松口：可以收，但写清这是在手机上操控小人玩的游戏，不是真去约会了。
      //   所以收的时候战报那一段由 date-game.js 自己写开头那句框定，这里只把回调递下去。
      // 收进记忆那扇门：带上这一局是在哪间房里打的（终局按它决定收到哪儿）。约会那盒和其余几桌走同一个——
      //   原来约会那盒直接把上头那扇门原样递下去，房间那一截丢了，隔离房里打的约会会收进主线
      const keepMem = function (ids, text) {
        const room = (session.config && session.config.room) || session.room || null;
        return props.keepGameMemory ? props.keepGameMemory(ids, text, room) : false;
      };
      if (session.game.key === "date") return h(window.DateGame, {
        keepGameMemory: keepMem, sendGameReport: props.sendGameReport, sendGameReportGroup: props.sendGameReportGroup, reportGroups: props.reportGroups, toast: props.toast,
        config: session.config, savedState: session.saved, active: props.active, characters: routedCharacters,
        profile: tableProfile, recentChatFor: props.recentChatFor, t: t, table: gameTable, VsBar: GameVsBar,
        call: callRetry, rules: gameVoiceRules(), isEngineer: props.isEngineer,
        onSave: function (snap) { return saveGameSnap("date", snap); },
        onBack: function () { setSession(null); setGame(null); setSaveTick(function (x) { return x + 1; }); }
      });
      const engineProps = { config: session.config, game: session.game, active: props.active, bgActive: props.bgActive, characters: routedCharacters, profile: tableProfile, recentChatFor: props.recentChatFor, isEngineer: props.isEngineer, t: t, toast: props.toast, savedState: session.saved,
        sendGameReport: props.sendGameReport,
        sendGameReportGroup: props.sendGameReportGroup, reportGroups: props.reportGroups,
        keepGameMemory: keepMem,
        onBack: function () { setSession(null); setSaveTick(function (x) { return x + 1; }); } };
      if (session.game.key === "spy") return h(SpyGame, engineProps);
      if (session.game.key === "werewolf") return h(WolfGame, Object.assign({}, engineProps, { resume: !!session.resume, savedState: session.saved }));
      // 25 问 · 我出题 / TA 出题 / 轮流（群友 2026-10-14）：只跟挑的第一个人玩
      if (session.game.key === "q25" && session.config && session.config.q25Host && session.config.q25Host !== "system") return h(MindGame, Object.assign({}, engineProps, { t: t }));
      if (session.game.key === "haigui" || session.game.key === "q25") return h(GuessGame, Object.assign({}, engineProps, { kind: session.game.key }));
      if (session.game.key === "tod") return h(TruthDareGame, engineProps);
      if (session.game.key === "avalon") return h(AvalonGame, engineProps);
      if (session.game.key === "monopoly") return h(MonopolyGame, engineProps);
      if (session.game.key === "uno") return h(UnoGame, engineProps);
      if (session.game.key === "gomoku") return h(GomokuGame, engineProps);
      if (session.game.key === "chess" && window.ChessCore) return h(ChessGame, engineProps);
      if (session.game.key === "xiangqi" && window.XiangqiCore) return h(XiangqiGame, engineProps);
      if (session.game.key === "go" && window.GoCore) return h(GoGame, engineProps);
      if (session.game.key === "jungle" && window.JungleCore) return h(JungleGame, engineProps);
      if (session.game.key === "draw") return h(DrawGuessGame, engineProps);
      if (session.game.key === "liar") return h(LiarDiceGame, engineProps);
      if (session.game.key === "poker") return h(PokerGame, engineProps);
      if (session.game.key === "oldmaid") return h(OldMaidGame, engineProps);
      if (session.game.key === "blackjack") return h(BlackjackGame, engineProps);
      if (session.game.key === "doudizhu") return h(DoudizhuGame, engineProps);
      if (session.game.key === "story") return h(StoryChainGame, engineProps);
      if (session.game.key === "lingxi" && window.LingxiCore) return h(LingxiGame, engineProps);
      if (session.game.key === "tetris" && window.TetrisCore) return h(TetrisGame, Object.assign({}, engineProps, { t: t }));
      return h(GamePlay, { game: session.game, config: session.config, characters: props.characters, profile: tableProfile, t: t, onBack: function () { setSession(null); } });
    }
    // 各怀心思的约会也走公共开局页（她 2026-10-12：「格式跟其他的也不一样」）——原来那张自己画的 DateGameSetup 不再挂
    if (game) return h(GameSetup, {
      game: game, characters: props.characters, profile: props.profile, moods: props.moods, t: t,
      initialPicked: entry && entryHandledRef.current === entry.key && entry.characterId ? [String(entry.characterId)] : [],
      onBack: function () { setGame(null); },
      // ⚠️那一戳也写进 config：存档存的是 config，从架上「继续上一局」回来时
      //   session 是新造的、fromRoom 早清了——不写进去的话，侧房里那一局一存一读
      //   就变成主线的了（正是这道闸要挡的）。
      onStart: function (config) {
        const cfg = Object.assign({}, config, { room: fromRoom.current || null });
        // 「上次那桌」：每个游戏记最后一次开局的配置（不记房间——那是那一次的事）
        try { const last = loadJSON(LAST_CFG_KEY, {}) || {}; last[game.key] = config; saveJSON(LAST_CFG_KEY, last); } catch (e) {}
        setSession({ game: game, config: cfg, room: fromRoom.current });
      }
    });
    const wolfGameDef = GAMES.find(function (g) { return g.key === "werewolf"; });

    // ---- 游戏架 ----
    // 她 2026-09-03：「背景还是无聊」。盒子已经是盒子了，可它们浮在一片纯色上——
    // 一架游戏总得摆在【什么里面】。所以给这一屏一个柜子：
    //   · 竖着的木纹（一条条深浅相间的板，宽窄不等，不然像条形码）
    //   · 四周压暗一圈，中间透出来一点光 —— 柜子是凹进去的，不是一张平面
    // ⚠️全部从主题色 t.ink 兑出来，深浅主题各自成立；不写死颜色（背景是界面，不是画）。
    // ⚠️这些叠层是拿 t.ink 直接拼 8 位 hex 的透明度（#rrggbb + "18"）。
    //   现在全部主题的 ink 都是 6 位 hex，成立；但万一哪天有人写成 rgb()，
    //   拼出来就是一个非法颜色，整条 backgroundImage 会被浏览器整条丢掉——
    //   连木纹带柜壁一起没，而且不报错。所以先验一下，不是 6 位 hex 就只铺底色。
    const hex6 = /^#[0-9a-f]{6}$/i.test(String(t.ink || ""));
    const cab = !hex6 ? { backgroundColor: t.bg } : {
      backgroundColor: t.bg,
      backgroundImage: [
        // 柜壁：左右两侧压暗，中间透光——这样它是凹进去的一格，不是一张平面
        "linear-gradient(90deg, " + t.ink + "26 0%, " + t.ink + "00 13%, " + t.ink + "00 87%, " + t.ink + "26 100%)",
        // 顶上一道压暗，底下也收一点
        "linear-gradient(180deg, " + t.ink + "1c 0%, " + t.ink + "00 12%, " + t.ink + "00 88%, " + t.ink + "14 100%)",
        // 木纹：板宽不等（23 / 15 / 31），不然像条形码；每块板一深一浅两条边
        "repeating-linear-gradient(90deg," +
          t.ink + "00 0 23px," + t.ink + "18 23px 24px," + t.ink + "05 24px 25px," +
          t.ink + "00 25px 40px," + t.ink + "12 40px 41px," +
          t.ink + "00 41px 72px," + t.ink + "1a 72px 73px," + t.ink + "05 73px 74px)"
      ].join(","),
    };
    // ⚠️柜子铺在【外壳】上、顶栏透明——不是铺在滚动区里。
    //   铺在滚动区里的话，顶栏那一条还是平色，柜子从它下面才开始，
    //   顶上就横着一道没被盖住的带子（她 2026-09-03 报的就是这个）。
    //   而且柜子本来就该是【不动】的：盒子在架子上滚，柜子不跟着滚。
    return h("div", { "data-wk": "gamepage", className: "h-full flex flex-col", style: cab },
      h(Head, { zh: "小游戏", en: "Games", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        // 没打完的那几局：架子上那一盒【还摊在桌上】，不是一条通用的提示横幅。
        // 摊开的样子＝盒盖掀在左边（那张盒面缩略图斜着搭出来），右边写着打到哪儿了。
        (function () {
          const rows = [];
          if (wolfSave) rows.push({ k: "werewolf", def: wolfGameDef, sub: "第 " + (wolfSave.cycle || 1) + " 个昼夜 · " + ((wolfSave.players || []).filter(function (p) { return p.alive; }).length) + " 人存活",
            go: function () { setSession({ game: wolfGameDef, config: wolfSave.config, resume: true, saved: wolfSave }); },
            drop: function () { clearWolf(); setSaveTick(function (x) { return x + 1; }); } });
          Object.keys(gSaves).forEach(function (k) {
            const snap = gSaves[k]; if (!snap) return;
            const def = GAMES.find(function (g) { return g.key === k; }); if (!def) return;
            rows.push({ k: k, def: def, sub: snap.label || "点继续接着玩",
              go: function () { setSession({ game: def, config: snap.config, resume: true, saved: snap }); },
              drop: function () { clearGameSave(k); setSaveTick(function (x) { return x + 1; }); } });
          });
          if (!rows.length) return null;
          return h("div", { style: { marginBottom: 18 } }, rows.map(function (r) {
            if (!r.def) return null;
            const c = LID[r.k] || LID.spy;
            return h("div", { "data-wk": "gameopen", key: "open_" + r.k, style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 } },
              // 掀开的盒盖：斜着搭在一边
              h("div", { style: { width: 58, flexShrink: 0, borderRadius: 6, overflow: "hidden", transform: "rotate(-7deg)", boxShadow: "0 2px 0 " + c.band + ", 0 5px 10px rgba(0,0,0,.18)" } },
                h(GameLid, { k: r.k })),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".14em", color: t.fog } }, "还摊在桌上"),
                h("div", { "data-wk": "gameopentitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.def.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.sub)),
              h("button", { "data-wk": "gameopenbtn", "data-part": "go", onClick: r.go, className: "active:opacity-80", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 999, padding: "7px 15px" } }, "接着玩"),
              h("button", { "data-wk": "gameopenbtn", "data-part": "drop", onClick: r.drop, className: "active:opacity-60", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, padding: "7px 2px" } }, "收了"));
          }));
        })(),
        h(GameStatsBook, { t: t, characters: props.characters || [] }),
        h("div", { "data-wk": "gameintro", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, margin: "2px 2px 16px" } }, "邀角色开一局派对游戏。派对游戏可选正常 / 放水 / 观战，人不够能拉 NPC 凑数；约会是你和 TA 的两人秘密任务局。（不写进聊天记忆）"),
        // 一架游戏盒：两个一排，每排底下压一条木架线
        (function () {
          const rows = [];
          for (let i = 0; i < GAMES.length; i += 2) rows.push(GAMES.slice(i, i + 2));
          return rows.map(function (row, ri) {
            return h("div", { "data-wk": "gameshelf", key: "row" + ri, style: { marginBottom: 20 } },
              h("div", { style: { display: "flex", gap: 12, alignItems: "flex-end" } },
                row.map(function (g) {
                  const c = LID[g.key] || LID.spy;
                  return h("button", { "data-wk": "gamelid", key: g.key, onClick: function () { fromRoom.current = null; setGame(g); }, className: "active:opacity-85",
                    style: { flex: "1 1 0", minWidth: 0, textAlign: "left", padding: 0, background: "transparent" } },
                    // 盒子：盒面 + 底下那道深边＝盒子的厚度，所以它是个盒子不是一张卡
                    h("div", { style: { borderRadius: 9, overflow: "hidden", boxShadow: "0 3px 0 " + c.band + ", 0 7px 14px rgba(0,0,0,.20)" } },
                      h(GameLid, { k: g.key }),
                      // 盒面下缘那条压印的名字带，跟真的桌游盒一样
                      h("div", { style: { background: c.band, padding: "6px 8px 7px" } },
                        h("div", { "data-wk": "gamelidtitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: c.bandInk, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g.zh),
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".14em", textTransform: "uppercase", color: c.bandInk, opacity: .58, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g.en))),
                    h("div", { "data-wk": "gamelidsub", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 7, lineHeight: 1.45 } }, g.min + "~" + g.max + " 人"));
                }),
                row.length === 1 ? h("div", { style: { flex: "1 1 0" } }) : null),
              // 隔板：一块有厚度的板（上面一道亮边、下面一道暗影），盒子坐在它上面
              h("div", { style: { marginTop: 9, height: 6, borderRadius: "1px 1px 3px 3px", background: t.line,
                boxShadow: "inset 0 1px 0 " + t.bg2 + ", 0 2px 5px " + t.ink + "1a" } }));
          });
        })(),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", lineHeight: 1.7, marginTop: 4, marginBottom: 6 } }, "从架上抽一盒，叫上想一起玩的角色。")));
  }

  // ============================================================
  // 开局配置：模式 + 选人（含人数上下限）+ NPC凑数 + 注入最近聊天
  // ============================================================
  // 牌技钉住（她 2026-10-11）：TA 打得多好原来全靠开局时模型从人设里估，估错了改不了。
  //   她在开局页给某个人钉一档，就用她定的，不再看估的那句；没钉＝照旧估。只管玩得多好，不改说话的样子。
  const SKILL_PIN_KEY = "x_gameSkillPins";
  const SKILL_PINS = [
    { k: "", zh: "让它估" },
    { k: "pro", zh: "高手", text: "高手：这类桌游心里门儿清，记得住每个人说过什么，推理、读人、藏身份都很强，很少被带节奏。" },
    { k: "mid", zh: "普通", text: "普通玩家：规则都懂，会推理但偶尔漏看信息，有时会被别人说动。" },
    { k: "rookie", zh: "新手", text: "新手：常看漏信息、容易被带节奏，藏身份时容易露馅，但玩得很投入。" }];
  function loadSkillPins() { try { return (typeof loadJSON === "function" ? loadJSON(SKILL_PIN_KEY, {}) : {}) || {}; } catch (e) { return {}; } }
  function pinnedSkill(charId, guessed) {
    const k = loadSkillPins()[charId], o = SKILL_PINS.find(function (x) { return x.k && x.k === k; });
    return o ? o.text : guessed;
  }
  // 上次那桌（她 2026-10-11）：每个游戏最后一次开局的配置，开局页一键照搬
  const LAST_CFG_KEY = "x_gameLastCfg";
  function GameSetup(props) {
    const t = props.t, game = props.game;
    const [stake, setStake] = useState("");          // 彩头：输的人要做什么（可空）
    const [skillPins, setSkillPins] = useState(loadSkillPins);
    const setSkillPin = function (id, v) { const n = Object.assign({}, skillPins); if (v) n[id] = v; else delete n[id]; setSkillPins(n); try { saveJSON(SKILL_PIN_KEY, n); } catch (e) {} };
    const chars = props.characters || [];
    const [mode, setMode] = useState("normal");
    const [picked, setPicked] = useState((props.initialPicked || []).slice());  // 选中的角色 id（从邀请卡进来时先勾上TA）
    const [npcFill, setNpcFill] = useState(game.key !== "date" && game.key !== "lingxi");   // 约会两个人的局：不补 NPC
    const [npcWant, setNpcWant] = useState(-1);      // 用户想要的 NPC 数；-1 = 跟随「补到最低」
    const [injectChat, setInjectChat] = useState(false);
    const [ccSeat, setCcSeat] = useState(true);      // UNO：工程师之眼角色是否由 CC 本人亲打
    const [unoRule, setUnoRule] = useState("official"); // official 官方不叠；stack 常见桌规 +2 叠加
    const [dateTheme, setDateTheme] = useState("plain"); // 各怀心思的约会：这一局是哪种约会（她 2026-10-14）
    const [gmkCasual, setGmkCasual] = useState({});
    const [gmkBrain, setGmkBrain] = useState("local");
    const [boardTeach, setBoardTeach] = useState(false);   // 围棋、象棋、国际象棋：教学（她 2026-10-23）
    const [goSize, setGoSize] = useState(9);
    const [cardBrain, setCardBrain] = useState("local");
    const [bjDealer, setBjDealer] = useState("house");   // 21 点谁坐庄：house 手机 / ta 选的第一个角色（她 2026-10-16「都做了」）
    const [pkTruth, setPkTruth] = useState(false);       // 德州：每手输得最多的人答赢家一个真心话 // UNO / 德州 / 21 点谁来出牌：local 手机出牌、一圈说一次 / self 每人自己想
    const [q25Host, setQ25Host] = useState("system");
    const [tetrisMode, setTetrisMode] = useState("watch");   // 俄罗斯方块：watch 你玩TA看 / versus 对战
    const [tetrisSkill, setTetrisSkill] = useState("normal"); // 对战时 TA 那块下得多好   // 25 问谁出题：system 系统 / me 我 / ta TA / turns 轮流
    const [drawBrain, setDrawBrain] = useState("once");  // 你画我猜 TA 怎么画：once 一口气画好 / step 一段一段想（每段一次调用）  // 五子棋谁来想棋：local 本地棋手 / model TA 自己下（每步一次调用）   // 五子棋观战：谁「随手」下（没记的＝认真）
    const [godSel, setGodSel] = useState(null);      // 狼人杀神职选择；null=跟随标准板
    const [wolfRole, setWolfRole] = useState(null);  // 狼阵营特殊角色：null 普通狼 / wolfking / whitewolf
    const [winMode, setWinMode] = useState("side");  // 屠边 side / 屠城 all
    const [avOpts, setAvOpts] = useState({ percival: true, mordred: false, oberon: false }); // 阿瓦隆特殊角色
    const lastCfg = (function () { try { return (loadJSON(LAST_CFG_KEY, {}) || {})[game.key] || null; } catch (e) { return null; } })();
    const useLast = function () {
      const c = lastCfg; if (!c) return;
      const ok = (c.charIds || []).filter(function (id) { return chars.some(function (x) { return x.id === id; }); });
      setMode(c.mode || "normal"); setPicked(ok); setNpcFill(c.npcFill !== false); setNpcWant(typeof c.npcCount === "number" ? c.npcCount : -1);
      setInjectChat(!!c.injectChat); setCcSeat(c.ccSeat !== false); if (c.unoRule) setUnoRule(c.unoRule); if (c.dateTheme) setDateTheme(c.dateTheme); if (c.gmkCasual) setGmkCasual(Object.assign({}, c.gmkCasual)); if (c.gmkBrain) setGmkBrain(c.gmkBrain); if (c.cardBrain) setCardBrain(c.cardBrain); if (c.bjDealer) setBjDealer(c.bjDealer); setPkTruth(!!c.pkTruth); if (c.drawBrain) setDrawBrain(c.drawBrain); if (c.q25Host) setQ25Host(c.q25Host); if (c.tetrisMode) setTetrisMode(c.tetrisMode); if (c.tetrisSkill) setTetrisSkill(c.tetrisSkill);
      if (c.gods) setGodSel(c.gods.slice()); if (c.wolfRole !== undefined) setWolfRole(c.wolfRole); if (c.winMode) setWinMode(c.winMode); if (c.av) setAvOpts(Object.assign({}, c.av));
      setStake(c.stake || "");
    };

    const spectate = mode === "spectate";
    const humanPlays = !spectate;                    // 观战时用户不算玩家
    const base = picked.length + (humanPlays ? 1 : 0); // 真人参与者
    const minNpc = npcFill ? Math.max(0, game.min - base) : 0;      // 补到最低所需
    const maxNpc = npcFill ? Math.max(minNpc, game.max - base) : 0; // 加满到 max 的上限
    // npcWant=-1 默认贴着「补到最低」；用户调过就用调后的值，随选人上下夹住
    const needNpc = npcFill ? (npcWant < 0 ? minNpc : Math.min(maxNpc, Math.max(minNpc, npcWant))) : 0;
    const total = base + needNpc;
    const overMax = total > game.max;
    // 观战至少要 2 个 AI 玩家才有的看；否则至少 1 个角色
    // 观战也按各游戏自己的最低人数来：阿瓦隆/狼人杀的板子按 5 人起设计，
    // 2~4 人观战局会配出坏牌（AV_EVIL[2] 不存在→身份牌比人多、可能整局没有梅林）。
    const tooFew = (spectate ? picked.length + needNpc : total) < game.min;
    // 狼人杀神职：effGods = 选中的(或标准板)；至少留 1 民
    const isWolfGame = game.key === "werewolf";
    const isAvalonGame = game.key === "avalon";
    // 这些游戏已经有 CC 独立座位接线。开关必须在选人前也看得见；否则 Lisa 会以为功能被删了。
    const ccSeatSupported = true; // v54.43 起全游戏支持言秋亲打（大富翁=闲聊静场+买地走规则引擎，见 monoTalk 注释）
    const pickedEngineer = picked.some(function (id) { return props.isEngineer && props.isEngineer(id); });
    const effGods = isWolfGame ? (godSel || standardBoard(total)) : [];
    const godRoom = isWolfGame ? Math.max(1, total - wolfCount(total) - 1) : 0;
    const godOverflow = isWolfGame && effGods.length > godRoom;
    const avSpecialRoom = isAvalonGame ? Math.max(0, (AV_EVIL[total] || 2) - 1) : 0; // 刺客固定占一个坏人槽
    const avSpecialNeed = isAvalonGame ? (avOpts.percival ? 1 : 0) + (avOpts.mordred ? 1 : 0) + (avOpts.oberon ? 1 : 0) : 0;
    const avOverflow = isAvalonGame && avSpecialNeed > avSpecialRoom;
    const canStart = !overMax && !tooFew && picked.length + needNpc > 0 && !godOverflow && !avOverflow;

    const toggle = function (id) {
      setPicked(function (p) { return p.indexOf(id) >= 0 ? p.filter(function (x) { return x !== id; }) : p.concat([id]); });
    };
    const modeHint = (MODES.find(function (m) { return m.key === mode; }) || {}).hint || "";

    let countMsg;
    if (overMax) countMsg = "人太多了，" + game.zh + "最多 " + game.max + " 人（现在 " + total + "）";
    else if (tooFew) countMsg = spectate ? ("观战也要凑满 " + game.min + " 个角色下场" + (npcFill ? "（可加 NPC）" : "，或开 NPC 凑数")) : "还差人——至少 " + game.min + " 人" + (npcFill ? "（可加 NPC 凑数）" : "，或开 NPC 凑数");
    else if (avOverflow) countMsg = "特殊坏人槽位不够：当前人数最多再选 " + avSpecialRoom + " 组（派西维尔会连带莫甘娜）";
    else countMsg = "共 " + total + " 人" + (humanPlays ? "（含你）" : "（你观战）") + (needNpc ? " · 含 " + needNpc + " 个 NPC" : "");

    // 开局配置也在这张桌上：摆桌的那一步就该看见桌子
    return h("div", { "data-wk": "gamesetup", className: "h-full flex flex-col", style: gameTable(game.key, t) },
      h(Head, { zh: game.zh, en: game.en, onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        // 规则条
        h("div", { "data-wk": "gamedesc", style: { display: "flex", gap: 11, alignItems: "center", padding: "12px 14px", borderRadius: 13, background: t.bg2, margin: "2px 0 16px" } },
          h("div", { style: { fontSize: "calc(26px * var(--app-fs, 1))", width: 34, textAlign: "center" } }, game.emoji),
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.55 } }, game.desc),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, game.rule))),

        lastCfg ? h("button", { "data-wk": "gamelastcfg", onClick: useLast, className: "active:opacity-70",
            style: { width: "100%", minHeight: 44, marginBottom: 16, borderRadius: 12, border: "1px dashed " + t.tint, background: "transparent", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.tint } },
          "照上次那桌摆（" + ((lastCfg.charIds || []).map(function (id) { const c = chars.find(function (x) { return x.id === id; }); return c ? c.name : null; }).filter(Boolean).join("、") || "只有 NPC") + "）") : null,
        // 模式
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "模式"),
        // 约会是两个人的局：没有观战、彩头和 NPC（它自己有输赢账，也不进回忆和战报）
        h(Segmented, { t: t, value: mode, options: game.key === "date" || game.key === "lingxi" ? MODES.filter(function (m) { return m.key !== "spectate"; }) : MODES, onChange: setMode }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, margin: "8px 2px 20px" } }, modeHint),
        // 彩头：开局前说好，终局 app 替你记着谁该兑现；战报发过去 TA 也知道
        game.key === "date" ? null : h("div", { "data-wk": "gamestake", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "彩头（可以不填）"),
          h("input", { "data-wk": "gameinput", "data-part": "stake", value: stake, maxLength: 40, onChange: function (e) { setStake(e.target.value); },
            placeholder: "输的人要做什么，写一句",
            style: { width: "100%", minHeight: 44, padding: "0 13px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, outline: "none" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "打完会写清谁该兑现；把战报发给 TA，TA 就知道这局赌了什么。")),

        game.key === "date" && window.DateGameCore ? h("div", { "data-wk": "gamedatetheme", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "这是一次什么样的约会"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 } },
            Object.keys(window.DateGameCore.THEMES).map(function (k) {
              const th = window.DateGameCore.THEMES[k], on = dateTheme === k;
              const desc = { plain: "就是出去逛逛。", first: "第一次单独出来，有点拘谨、互相试探。", anniv: "纪念日，会想起以前，想过得特别一点。", makeup: "前几天闹过别扭，今天出来和好。" }[k] || "";
              return h("button", { key: k, "data-on": on ? "1" : "0", onClick: function () { setDateTheme(k); }, style: { textAlign: "left", borderRadius: 14, padding: "11px 11px", background: on ? t.tint + "16" : t.bg2, border: "1px solid " + (on ? t.tint : t.line) } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, th.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55, marginTop: 4 } }, desc));
            })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, "TA 的态度会跟着变；除了「随便逛逛」，任务池还会多一张这种约会才有的任务。")) : null,
        game.key === "uno" ? h("div", { style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "+2 规则"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 } },
            [{ key: "official", title: "官方规则", mark: "不能叠加", desc: "别人出 +2，你直接摸 2 张并跳过。" },
             { key: "stack", title: "叠加规则", mark: "可以反打", desc: "任意颜色 +2 都能顶；罚牌累计转给下一家。" }].map(function (o) {
              const on = unoRule === o.key;
              return h("button", { "data-wk": "gameunorule", "data-on": on ? "1" : "0", key: o.key, onClick: function () { setUnoRule(o.key); }, style: { textAlign: "left", borderRadius: 14, padding: "12px 11px", background: on ? t.tint + "16" : t.bg2, border: "1px solid " + (on ? t.tint : t.line) } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, o.title),
                h("div", { style: { display: "inline-block", margin: "6px 0 5px", padding: "2px 7px", borderRadius: 999, background: on ? t.tint : t.line, color: on ? "white" : t.sub, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))" } }, o.mark),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55 } }, o.desc));
            })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, "两种模式的其他规则完全一样；目前只有 +2 是否能叠加不同。")) : null,

        // 五子棋观战：两个人各自认真还是随手下——不分的话两边一样强，看着没意思
        game.key === "tetris" ? h("div", { "data-wk": "tetrismode", style: { marginBottom: 20 } },
          h(Segmented, { t: t, value: tetrisMode, onChange: setTetrisMode, options: [{ key: "watch", zh: "你玩 TA 看" }, { key: "versus", zh: "对战" }, { key: "coop", zh: "合作接力" }] }),
          tetrisMode !== "watch" ? h("div", { style: { marginTop: 10 } }, h(Segmented, { t: t, value: tetrisSkill, onChange: setTetrisSkill, options: [{ key: "rookie", zh: "TA 新手" }, { key: "normal", zh: "普通" }, { key: "pro", zh: "高手" }] })) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, tetrisMode === "coop"
            ? "同一块板子，你放一块、TA 放一块轮着来，一起冲分。TA 那块由本地棋手照挑的水平放（不花钱），轮到 TA 时偶尔会先说说打算。"
            : tetrisMode === "versus"
            ? "一人一块板子，消两行以上往对面塞垃圾行，先堆到顶的输。TA 那块由本地棋手下（不花钱），只有说话才调用；模式选「放水」TA 会下得慢一点、多看走眼。"
            : "你自己玩，TA 坐旁边，一次消好几行、快堆到顶、破纪录的时候才开口。")) : null,
        game.key === "q25" ? h("div", { "data-wk": "q25host", style: { marginBottom: 20 } },
          h(Segmented, { t: t, value: q25Host, onChange: setQ25Host, options: [{ key: "system", zh: "系统出题" }, { key: "me", zh: "我出题" }, { key: "ta", zh: "TA 出题" }, { key: "turns", zh: "轮流" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, q25Host === "system" ? "系统心里想一个，大家一起猜。"
            : q25Host === "me" ? "你写下一个东西锁住（TA 看不到），TA 一问一问来猜，你点按钮答。只跟挑的第一个人玩。"
            : q25Host === "ta" ? "TA 照你们的事想一个，你来问、来猜。只跟挑的第一个人玩。" : "一局你出、一局 TA 出，记比分。只跟挑的第一个人玩。")) : null,
        game.key === "draw" ? h("div", { "data-wk": "drawbrain", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "TA 怎么画"),
          h(Segmented, { t: t, value: drawBrain, onChange: setDrawBrain, options: [{ key: "once", zh: "一口气画好" }, { key: "step", zh: "一段一段想" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, drawBrain === "step"
            ? "每画一段都重新想一次：看得到你猜过什么、说过什么，下一笔跟着变，画几段也是边画边定。每段一次调用，段与段之间要等几秒。"
            : "开画时一次想好整幅，再一段一段放给你看：省调用、不卡，但你中途说什么，后面的画不会跟着变。")) : null,
        game.key === "blackjack" && picked.length ? h("div", { "data-wk": "gamebjdealer", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "谁坐庄"),
          h(Segmented, { t: t, value: bjDealer, onChange: setBjDealer, options: [{ key: "house", zh: "手机发牌" }, { key: "ta", zh: ((chars.find(function (c) { return String(c.id) === String(picked[0]); }) || {}).name || "TA") + " 坐庄" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, bjDealer === "ta"
            ? "TA 当庄家：不下注，大家都跟 TA 比；你们赢的从 TA 的筹码里出，输的进 TA 口袋。庄家照规矩要到 17 点。"
            : "庄家是手机，谁也不偏；角色和你一样各自跟庄比。")) : null,
        game.key === "poker" ? h("div", { "data-wk": "gamepktruth", style: { marginBottom: 20 } },
          h(ToggleRow, { t: t, label: "输的人答一个真心话", sub: "每手打完，赢最多的问、输最多的答。轮到你问就写一句，轮到你答就照实回；角色之间的问答顺带在桌上话里说。每次问答花一次调用。", on: pkTruth, onToggle: function () { setPkTruth(!pkTruth); } })) : null,
        ["uno", "poker", "blackjack"].indexOf(game.key) >= 0 ? h("div", { "data-wk": "gamecardbrain", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "谁来出牌"),
          h(Segmented, { t: t, value: cardBrain, onChange: setCardBrain, options: [{ key: "local", zh: "手机出牌" }, { key: "self", zh: "每人自己想" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, cardBrain === "self"
            ? "每到角色那一手问 TA 本人一次，出牌和说话一起回来，像 TA 亲自在想。一手一次调用，人多了贵、也要等。"
            : "出牌归手机，照每个人的路数打，不卡。轮回你那一手（或者一手打完）时，一次调用让全桌各说一句；这一次只看桌上公开的，谁也看不见别人的牌。")) : null,
        game.key === "go" ? h("div", { "data-wk": "gosize", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "棋盘"),
          h(Segmented, { t: t, value: String(goSize), onChange: function (v) { setGoSize(Number(v)); }, options: [{ key: "9", zh: "九路" }, { key: "13", zh: "十三路" }, { key: "17", zh: "十七路" }, { key: "19", zh: "十九路" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, goSize >= 17 ? (goSize === 19 ? "十九路" : "十七路") + "格子小、一盘下得久，电脑在这么大的盘上偏弱。" : goSize === 13 ? "十三路，一盘半小时上下。" : "九路一盘十来分钟，手机上看得最清楚，电脑也下得最像样。")) : null,
        ["chess", "xiangqi", "go", "jungle"].indexOf(game.key) >= 0 && !spectate ? h("div", { "data-wk": "boardteach", style: { marginBottom: 20 } },
          h(ToggleRow, { t: t, label: "教学", sub: "你说话或者按「让TA说」的时候，TA 照着引擎看出来的实情讲：你上一步怎么样、哪里有危险。按提示时 TA 也顺口讲为什么。怎么教、耐不耐心，照 TA 自己的性子。", on: boardTeach, onToggle: function () { setBoardTeach(!boardTeach); } })) : null,
        game.key === "gomoku" ? h("div", { "data-wk": "gomokubrain", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "谁来想棋"),
          h(Segmented, { t: t, value: gmkBrain, onChange: setGmkBrain, options: [{ key: "local", zh: "本地棋手" }, { key: "model", zh: "TA 自己下" }] }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, gmkBrain === "model"
            ? "每一步都用 TA 的模型想：落子和说话一起回来，像在聊天里下棋。每步一次调用、要等几秒，模型下得好不好看它自己。"
            : "落子归 app 里的棋手，不花调用、不卡；TA 只在你开口时说话。")) : null,
        game.key === "gomoku" && spectate && picked.length ? h("div", { "data-wk": "gomokustrength", style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "各自怎么下"),
          picked.slice(0, 2).map(function (id) {
            const c = chars.find(function (x) { return x.id === id; });
            return h("div", { key: id, style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } },
              h("div", { style: { width: 72, flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c ? (c.remark || c.name) : ""),
              h("div", { style: { flex: 1 } }, h(Segmented, { t: t, value: gmkCasual[id] ? "casual" : "serious", options: [{ key: "serious", zh: "认真" }, { key: "casual", zh: "随手" }],
                onChange: function (v) { const n = Object.assign({}, gmkCasual); if (v === "casual") n[id] = true; else delete n[id]; setGmkCasual(n); } })));
          }),
          picked.length < 2 ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "只选一个人就是 TA 跟电脑下；选两个就看他俩对下。") : null) : null,

        // 选人
        h("div", { style: { display: "flex", alignItems: "baseline", marginBottom: 8 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, spectate ? "上场的角色" : "邀谁一起玩"),
          h("div", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: overMax || tooFew ? "#c0553f" : t.fog } }, countMsg)),
        chars.length === 0
          ? h("div", { "data-wk": "gameempty", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "14px 2px" } }, "还没有角色，先去「人格档案馆」建几个")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              chars.filter(function (c) { return !c.npc; }).concat(chars.filter(function (c) { return c.npc; })).map(function (c, ci, arr) {
                const on = picked.indexOf(c.id) >= 0;
                // 配角排在主角色后面，前面垫一行小字隔开
                const firstNpc = c.npc && (ci === 0 || !arr[ci - 1].npc);
                const btn = h("button", { "data-wk": "gamecharpick", "data-on": on ? "1" : "0", key: c.id, onClick: function () { toggle(c.id); },
                  style: { display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 12, background: on ? (t.tint + "16") : t.bg2, border: "1px solid " + (on ? t.tint : t.line) } },
                  h(Avatar, { character: c, size: 34, radius: 10 }),
                  h("div", { style: { flex: 1, textAlign: "left", minWidth: 0 } },
                    h("div", { "data-wk": "gamecharname", style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, c.name),
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.tagline || "")),
                  h("div", { style: { width: 22, height: 22, borderRadius: 999, flexShrink: 0, border: "2px solid " + (on ? t.tint : t.line), background: on ? t.tint : "transparent", color: "#fff", fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: "19px", textAlign: "center" } }, on ? "✓" : ""));
                return firstNpc ? h(React.Fragment, { key: c.id }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "6px 2px 0" } }, "认识的配角"), btn) : btn;
              })),

        // 牌技：给选上的人钉一档（全局记着，下次也是这档）
        picked.length ? h("div", { "data-wk": "gameskillpin", style: { marginTop: 14 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "牌技"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "3px 0 8px", lineHeight: 1.5 } }, "默认按人设估 TA 玩得多好；你知道 TA 是高手还是新手，就直接钉一档。只管玩得多好，不改 TA 说话的样子。"),
          picked.map(function (id) {
            const c = chars.find(function (x) { return x.id === id; }); if (!c) return null;
            const cur = skillPins[id] || "";
            return h("div", { key: id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 7 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, width: 64, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
              h("div", { style: { flex: 1 } }, h(Segmented, { t: t, value: cur, options: SKILL_PINS.map(function (o) { return { key: o.k, zh: o.zh }; }), onChange: function (v) { setSkillPin(id, v); } })));
          })) : null,
        // 选项
        h("div", { style: { marginTop: 14, borderTop: "1px solid " + t.line } },
          game.key === "date" ? null : h(ToggleRow, { t: t, label: "NPC 凑数", sub: "自动生成 NPC 补到最低人数——NPC 也有自己的人设和水平，不会为了推进而崩。", on: npcFill, onToggle: function () { setNpcFill(!npcFill); } }),
          // NPC 数量步进：默认补到最低，可继续加到 max（人多局更长、更看得出博弈）
          (npcFill && maxNpc > 0) ? h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0 12px" } },
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, "NPC 数量"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "最少 " + minNpc + " 个补到 " + game.min + " 人，最多可加到 " + game.max + " 人（局更长、更看得出门道）。")),
            h(Stepper, { t: t, value: needNpc, min: minNpc, max: maxNpc, onChange: function (v) { setNpcWant(v); } })) : null,
          h("div", { style: { borderTop: "1px solid " + t.line } }),
          h(ToggleRow, { t: t, label: "注入最近聊天", sub: "把最近的聊天喂给上场角色，让 TA 带着当前的人设、心情、你俩的近况上场。只读不写——不会记进聊天记忆。", on: injectChat, onToggle: function () { setInjectChat(!injectChat); } }),
          ccSeatSupported ? h(ToggleRow, { t: t, label: "言秋本人亲打", sub: pickedEngineer ? "已经认出言秋。轮到TA时只收 CC 本人的回答；没接上就跳过这一手，Gemini 不会冒充。" : "先把言秋选进本局；开关会保留，选中后由 CC 里的本人亲自玩。", on: ccSeat, onToggle: function () { setCcSeat(!ccSeat); } }) : null,
          // 狼人杀·神职配置（自选 + 随机 + 标准板）
          isWolfGame ? h("div", { style: { paddingTop: 12, marginTop: 6, borderTop: "1px solid " + t.line } },
            h("div", { style: { display: "flex", alignItems: "center", marginBottom: 6 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, "神职配置"),
              h("button", { "data-wk": "gamegodbtn", "data-part": "random", onClick: function () { setGodSel(randomBoard(total)); }, style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint, border: "1px solid " + t.tint, borderRadius: 999, padding: "3px 12px" } }, "🎲 随机"),
              h("button", { "data-wk": "gamegodbtn", "data-part": "clear", onClick: function () { setGodSel(null); }, style: { marginLeft: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "3px 4px" } }, "标准板")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: godOverflow ? "#c0553f" : t.fog, lineHeight: 1.5, marginBottom: 8 } }, godOverflow ? ("神职太多，最多 " + godRoom + " 个（至少留 1 民）") : "勾选想要的神职，其余是平民。屠边局：狼把神营或民营杀绝即胜。"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
              GODS.map(function (g) {
                const on = effGods.indexOf(g.key) >= 0;
                return h("button", { "data-wk": "gamegod", "data-on": on ? "1" : "0", key: g.key, onClick: function () { const cur = effGods.slice(); const i = cur.indexOf(g.key); if (i >= 0) cur.splice(i, 1); else cur.push(g.key); setGodSel(cur); }, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "6px 14px" } }, g.zh);
              })),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "（预言家、女巫、猎人、守卫、白痴均已就绪，任选组合）"),
            // 狼阵营特殊角色（把一头狼换成狼王/白狼王）
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "狼阵营"),
              [{ key: null, zh: "普通狼" }, { key: "wolfking", zh: "狼王" }, { key: "whitewolf", zh: "白狼王" }].map(function (o) {
                const on = wolfRole === o.key;
                return h("button", { "data-wk": "gamewolfrole", "data-on": on ? "1" : "0", key: o.key || "plain", onClick: function () { setWolfRole(o.key); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? "#fff" : t.ink, background: on ? "#c0553f" : t.bg2, border: "1px solid " + (on ? "#c0553f" : t.line), borderRadius: 999, padding: "5px 13px" } }, o.zh);
              })),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, wolfRole === "wolfking" ? "狼王：出局时能开枪带走一人（被毒不能开）。" : wolfRole === "whitewolf" ? "白狼王：白天可自爆、当场带走一人后直接天黑。" : "把一头狼换成特殊狼（狼总数不变）。"),
            // 胜负模式
            h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "胜负"),
              h("div", { style: { flex: 1 } }, h(Segmented, { t: t, value: winMode, options: [{ key: "side", zh: "屠边" }, { key: "all", zh: "屠城" }], onChange: setWinMode }))),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, winMode === "side" ? "屠边：狼把「神营」或「民营」杀绝即胜（标准竞技规则）。" : "屠城：场上剩余好人 ≤ 狼数（打平）时狼就赢。")) : null,
          // 阿瓦隆·特殊角色
          isAvalonGame ? h("div", { style: { paddingTop: 12, marginTop: 6, borderTop: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, marginBottom: 2 } }, "特殊角色"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginBottom: 4 } }, "梅林 + 刺客固定在场，其余按人数配忠臣 / 爪牙。加特殊角色让博弈更深。"),
            [{ k: "lady", zh: "湖中仙女", d: "7 人起生效：第 2/3/4 个任务后，持牌人查验一人真实阵营并当众宣布（可以撒谎），牌传给被验的人" },
             { k: "percival", zh: "派西维尔 + 莫甘娜", d: "派西维尔认得梅林，但莫甘娜伪装成梅林混淆 TA（成对加入）" },
             { k: "mordred", zh: "莫德雷德", d: "坏人，且【梅林看不见 TA】——好人更难" },
             { k: "oberon", zh: "奥伯伦", d: "坏人，但和其他坏人互不相识、不知彼此" }].map(function (o) {
              return h(ToggleRow, { key: o.k, t: t, label: o.zh, sub: o.d, on: !!avOpts[o.k], onToggle: function () { setAvOpts(function (s) { const n = Object.assign({}, s); n[o.k] = !s[o.k]; return n; }); } });
            }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.5 } }, "任务队伍规模按人数自动配，第 4 个任务在 7 人以上需 2 张失败票。3 个任务成功后刺客还有终局刺杀。")) : null)),

      // 底部开始
      h("div", { "data-wk": "gamestartbar", className: "shrink-0", style: { padding: "12px 18px calc(env(safe-area-inset-bottom) + 16px)", borderTop: "1px solid " + t.line } },
        h("button", { "data-wk": "gamestart", onClick: function () { if (canStart) props.onStart({ mode: mode, charIds: picked.slice(), npcFill: npcFill, npcCount: needNpc, injectChat: injectChat, ccSeat: ccSeat, unoRule: game.key === "uno" ? unoRule : undefined, dateTheme: game.key === "date" ? dateTheme : undefined, gmkCasual: game.key === "gomoku" ? gmkCasual : undefined, gmkBrain: game.key === "gomoku" ? gmkBrain : undefined, boardTeach: ["chess", "xiangqi", "go", "jungle"].indexOf(game.key) >= 0 && !spectate ? boardTeach : undefined, goSize: game.key === "go" ? goSize : undefined, cardBrain: ["uno", "poker", "blackjack"].indexOf(game.key) >= 0 ? cardBrain : undefined, bjDealer: game.key === "blackjack" ? bjDealer : undefined, pkTruth: game.key === "poker" ? pkTruth : undefined, drawBrain: game.key === "draw" ? drawBrain : undefined, q25Host: game.key === "q25" ? q25Host : undefined, tetrisMode: game.key === "tetris" ? tetrisMode : undefined, tetrisSkill: game.key === "tetris" ? tetrisSkill : undefined, total: total, gods: isWolfGame ? effGods.slice() : undefined, wolfRole: isWolfGame ? wolfRole : undefined, winMode: isWolfGame ? winMode : undefined, av: isAvalonGame ? avOpts : undefined, stake: stake.trim() || undefined }); },
          disabled: !canStart, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: canStart ? t.ink : t.line, borderRadius: 13, padding: "13px" } },
          spectate ? "开始观战" : "开始游戏")));
  }

  // ============================================================
  // 对局（引擎未做前的占位：回显本局配置，确认整条链路通）
  // ============================================================
  function GamePlay(props) {
    const t = props.t, game = props.game, cfg = props.config;
    const names = (cfg.charIds || []).map(function (id) { const c = (props.characters || []).find(function (x) { return x.id === id; }); return c ? c.name : null; }).filter(Boolean);
    const modeZh = (MODES.find(function (m) { return m.key === cfg.mode; }) || {}).zh || cfg.mode;
    const row = function (k, v) { return h("div", { style: { display: "flex", padding: "9px 0", borderBottom: "1px solid " + t.line } },
      h("div", { style: { width: 92, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, k),
      h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.5 } }, v)); };
    return h("div", { "data-wk": "gamewip", className: "h-full flex flex-col", style: gameTable(game.key, t) },
      h(Head, { zh: game.zh, en: game.en, onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-10", style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { textAlign: "center", padding: "30px 0 18px" } },
          h("div", { style: { fontSize: "calc(54px * var(--app-fs, 1))", lineHeight: 1 } }, game.emoji),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, marginTop: 12 } }, game.zh + " · 引擎开发中"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, "玩法和规则已经定好，这局的设置也收到了。\n引擎马上就来，先睹为快 👇")),
        h("div", { "data-wk": "block", style: { background: t.bg2, borderRadius: 14, padding: "6px 15px", marginTop: 8 } },
          row("模式", modeZh),
          row("上场角色", names.length ? names.join("、") : "（无）"),
          row("总人数", cfg.total + " 人" + (cfg.mode === "spectate" ? "（你观战）" : "（含你）")),
          row("NPC 凑数", cfg.npcCount ? "补 " + cfg.npcCount + " 个 NPC" : (cfg.npcFill ? "开（本局够人，没补）" : "关")),
          row("注入最近聊天", cfg.injectChat ? "开——带当前人设/心情上场" : "关")),
        h("button", { "data-wk": "gamewipback", onClick: props.onBack, className: "active:opacity-80", style: { marginTop: 22, alignSelf: "center", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 26px" } }, "返回改设置")));
  }

  // ============================================================
  // 谁是卧底 · 引擎
  // ============================================================
  // 禁烟（她 2026-09-05 让补的最后一处）。它是【世界事实】：这个 app 里没人抽烟，
  // 牌桌上也一样。⚠️这一处的写法和别的 app 不同——games.js 里 AC 是个【无条件的
  // prompt 头】，不是可选块，所以把它并进 AC 是安全的（v55.90 警告的是「挂在会消失的
  // 块上」，不是「挂在永远都发的头上」）。牌桌上还有一批不走 AC 的座位级 sys，
  // 那些只能一处处接——凡是让人【说话】的都接了，只报一个目标名的不接。
  const CB = (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt) ? ContentBoundaries.prompt + "\n\n" : "";
  const AC = ((typeof ANTI_CLICHE !== "undefined") ? ANTI_CLICHE + "\n\n" : "") + CB;

  // 开局：出词 + 生成 NPC + 给每个玩家写「牌桌能力小传」（能力≠性格）
  // 出过的词对（她 2026-10-26 去重）：记最近 30 对，出词时给裁判看，撞上了重掷一次
  const SPY_PAIRS_KEY = "x_spyPairs";
  function loadSpyPairs() { try { const v = typeof loadJSON === "function" ? loadJSON(SPY_PAIRS_KEY, []) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } }

  async function setupSpy(api, realPlayers, npcCount) {
    const used = loadSpyPairs();
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是「谁是卧底」的裁判 + 能力评估器。\n" +
      "1. 出一对词 pair：civ 平民词、spy 卧底词——两词【相关但不同】、都能描述、难度适中、别太生僻，别用一个词包含另一个词的那种（一个是另一个的一部分、或者只多了个修饰）；好的一对是同一类里两样各自独立、描述起来能互相混淆的东西。\n" +
      (used.length ? "【已经出过的词对】下面这些出过了，别再出同一对，换个说法也算出过：" + used.join("、") + "\n" : "") +
      "2. 生成 " + npcCount + " 个 NPC 玩家：name 中文名 + persona 一句人设（含【职业】与性格，尽量多样、别都是学生、别一个味）。\n" +
      "3. 给【每一个真实玩家】各写一句 skill「牌桌能力小传」：按上面的能力与性格分开原则，点出 TA 玩这种推理游戏时——藏词、听别人描述抓破绽、被怀疑时嘴硬博弈——的【真实强弱】（由职业背景推，别被性格带偏）。NPC 的 skill 也一并给。\n\n" +
      "【真实玩家】\n" + (lines || "（无）") +
      "\n\n【输出】只输出 JSON：{\"pair\":{\"civ\":\"\",\"spy\":\"\"},\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"能力小传\"}]}";
    let out = extractJSON(await callRetry(api, sys, [{ role: "user", content: "发牌：给词、" + npcCount + " 个 NPC、每个人的能力小传。" }], { maxTokens: 12500 })) || {};
    // 不再重抽一次（她 2026-10-26：花了钱的不扔）：用过的那些已经在提示里列给它了
    if (out.pair && out.pair.civ && out.pair.spy) {
      try { if (typeof saveJSON === "function") saveJSON(SPY_PAIRS_KEY, [String(out.pair.civ) + "/" + String(out.pair.spy)].concat(used).slice(0, 30)); } catch (e) {}
    }
    return out;
  }

  // 一轮描述：按真实座次切成「言秋前 → 言秋本人 → 言秋后」。
  async function genClues(api, speakers, priorClues, roundNum, mode, carveCtx) {
    const seat = carveCtx ? ccSeatOf(speakers) : null;
    if (!seat) return genCluesBatch(api, speakers, priorClues, roundNum, mode, "");

    const seatIndex = speakers.indexOf(seat);
    const before = speakers.slice(0, seatIndex);
    const after = speakers.slice(seatIndex + 1);
    // 先让排在言秋前面的人真的说完；这些原话随后完整交给 CC。
    const beforeRows = before.length
      ? await genCluesBatch(api, before, priorClues, roundNum, mode, "") : [];
    const priorForCc = priorClues.concat(beforeRows);
    const cc = await ccCarve("spy", [seat], {
      turnId: (carveCtx.turnId || "") + ":clue",
      sys: CB + "「谁是卧底」第 " + roundNum + " 轮，按牌桌座次轮到你描述自己的词。你拿到的词是「" + (seat.word || "") + "」。"
        + "用【一句话】描述它：不能说出词本身，也别露骨到一句就被锁定。你想怎么说就怎么说，保持你自己的真实口吻。"
        + (priorForCc.length ? "\n\n【本轮排在你前面、已经真实说过的】\n" + priorForCc.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "\n（你是本轮第一个发言的人。）"),
      ask: "说一句。",
      expect: "{\"text\":\"一句描述\"}"
    });
    requireCCDone(cc, "言秋的描述票", function (d) { return !!String(d.text || "").trim(); });
    const mine = (cc.done && String(cc.done.text || "").trim())
      ? [{ name: cc.seat.name, text: String(cc.done.text).trim() }] : [];
    // 再生成排在TA后面的人；他们能看到前桌 + 言秋刚才的真实发言。
    const priorAfter = priorForCc.concat(mine);
    const afterRows = after.length
      ? await genCluesBatch(api, after, priorAfter, roundNum, mode, ccPreface(cc, "按座次说过自己那一句了")) : [];
    return beforeRows.concat(mine, afterRows);
  }
  async function genCluesBatch(api, speakers, priorClues, roundNum, mode, preface) {
    const prior = priorClues.length ? priorClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "（本轮你们最先描述，前面还没人说）";
    const who = speakers.map(function (s) { return "■ " + s.name + "（TA 的词是「" + s.word + "」）真实水平：" + (s.skill || "普通") + voiceBrief(s); }).join("\n");
    const easy = mode === "easy" ? "\n【放水局】适当留点破绽、别一上来就把话说得滴水不漏，给真人玩家留机会。" : "";
    const sys = gameVoiceRules() + "\n\n「谁是卧底」第 " + roundNum + " 轮描述。每人像真人围桌一样，随口用【一句 6～18 个汉字的口语】描述自己拿到的词。铁律：\n" +
      "· 不能直接说出词本身，也别露骨到一句就被锁定。\n" +
      "· 一句只露【一个】日常印象、使用感受或亲身联想。不要下定义，不要解释原理/机械结构，不要罗列功能配件，不要写百科、产品评测或说明书。\n" +
      "· 别写成散文谜语：禁止为了显聪明硬造长比喻、宏大哲理和『其核心机制在于』『它的体积和重量提醒你』『新手总以为』这种分析腔。像饭桌上脱口而出的短话，不像准备过的演讲。\n" +
      "· 【具体程度严格按真实水平走·非常重要】高手点到即止、只给能【多向解读】的模糊线索，故意留白，让人一轮看不穿；只有低手才会说得太实把词几乎摊开。**绝不能所有人都描述得清清楚楚**——那样一轮就穿帮、毫无博弈，不好玩。整体要含蓄，信息一点点挤。\n" +
      "· 各人只知道自己的词、不知道谁跟自己不同。【高水平的少数派（卧底）】要善于从别人的描述里察觉『我的词好像和大家不是一路』，然后立刻把自己这句往大家的方向靠、含糊蒙混、绝不自曝；只有低水平的少数派才会照着自己的词直说而露馅。\n" +
      "· 先发言的人没有前文、只能凭自己的词说；后发言的人要顺着前面的风向调整措辞。" + easy +
      "\n\n【本轮已说过的】\n" + prior + "\n\n【现在这些人各说一句（按顺序）】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"clues\":[{\"name\":\"玩家名\",\"text\":\"一句描述\"}]}，顺序照上面。";
    const raw = await callRetry(api, sys, [{ role: "user", content: "各说一句。" }], { maxTokens: 12000 });
    const p = extractJSON(raw);
    return (p && Array.isArray(p.clues)) ? p.clues : [];
  }

  // 投票：存活 AI 各投一人 + 理由（卧底会误导）
  async function genVotes(api, voters, allClues, aliveNames, mode, userName, carveCtx, heckles) {
    // CC 本人只拿玩家视角：自己的词 + 公开发言。不泄露阵营，也不重复告诉TA自己是谁。
    const ccVoter = ccSeatOf(voters);
    const cc = carveCtx ? await ccCarve("spy", voters, {
      turnId: (carveCtx.turnId || "") + ":vote",
      sys: CB + "「谁是卧底」进入投票。你拿到的词是「" + ((ccVoter && ccVoter.word) || "") + "」。你不知道自己属于多数还是少数，只能根据公开描述判断。"
        + "\n\n【可投的存活玩家】" + aliveNames.join("、")
        + "\n\n【目前所有描述】\n" + allClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n")
        + heckleBlock(heckles)
        + "\n\n按你自己的判断投一个人，并给一句短理由；没把握可以弃票。",
      ask: "投票。",
      expect: "{\"target\":\"被投的人或「弃票」\",\"reason\":\"一句理由\"}"
    }) : { seat: null, rest: voters, done: null };
    requireCCDone(cc, "言秋的投票", function (d) { return d.target !== undefined; });
    const mine = (cc.done && String(cc.done.target || "").trim())
      ? [{ name: cc.seat.name, target: String(cc.done.target).trim(), reason: String(cc.done.reason || "").trim() }] : [];
    if (!cc.rest.length) return mine;
    const rows = await genVotesBatch(api, cc.rest, allClues, aliveNames, mode, userName, ccPreface(cc, "投过票了") + heckleBlock(heckles));
    return mine.concat(rows);
  }
  async function genVotesBatch(api, voters, allClues, aliveNames, mode, userName, preface) {
    const clues = allClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n");
    const who = voters.map(function (v) { return "■ " + v.name + "（" + (v.role === "spy" ? "你其实是卧底：把票投给某个你觉得像平民的人来误导，别投出真正的少数派" : "你是平民：凭描述投你真心最怀疑的那个") + "）真实水平：" + (v.skill || "普通") + voiceBrief(v); }).join("\n");
    const easy = (mode === "easy" && userName) ? "\n【放水局】别精准锁定真人「" + userName + "」，就算怀疑 TA 也可以手下留情、投别人或说再看看。" : "";
    const sys = gameVoiceRules() + "\n\n「谁是卧底」投票。根据目前【所有描述】，下面每人各投一个要投出局的人 + 一句短理由。按真实水平：推理强的投得准，弱的易被带偏。**实在没把握可以弃票**（target 填「弃票」），但别全场弃票。理由别露上帝视角（别说“我是卧底所以…”）。【公平】只按描述本身的合理性投票，别因为某人发言顺序靠前、说得少、或是生面孔就默认针对 TA——没有实据不要扎堆投同一个人。" + easy +
      "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【目前所有描述】\n" + clues + "\n\n【要投票的人】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"votes\":[{\"name\":\"投票人\",\"target\":\"被投的人，或「弃票」\",\"reason\":\"一句理由\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "投票。" }], { maxTokens: 11500 });
    const p = extractJSON(raw);
    return (p && Array.isArray(p.votes)) ? p.votes : [];
  }

  // 猜词翻盘的判定是【本地纯函数】，不花一次调用也不看模型脸色：
  // 全等算中；猜的话里整个包含平民词也算中（「是苹果吧」）；反着只猜出半个字不算。
  function spyGuessHits(guess, civWord) {
    const norm = function (x) { return String(x || "").toLowerCase().replace(/[\s\u3000·。，、！？!?,."'「」『』（）()【】]/g, ""); };
    const g = norm(guess), w = norm(civWord);
    if (!g || !w) return false;
    return g === w || (w.length >= 2 && g.indexOf(w) >= 0);
  }
  // 卧底里被投出的平民留一句（真冤）：不服、点名怀疑真正的卧底、或自嘲——进公开日志。
  async function genSpyOutWords(api, out, allClues, votes) {
    const cluesText = (allClues || []).map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n");
    const voteText = (votes || []).map(function (v) { return "· " + v.voter + (v.target ? "→" + v.target : "→弃票"); }).join("\n");
    const sys = gameVoiceRules() + "\n\n「谁是卧底」里【" + out.name + "】刚被投出局，亮出的身份是【平民】——真被冤枉了（真实水平：" + (out.skill || "普通") + "）" + voiceBrief(out) + "。看着票型留 1~2 句离场的话：不服、点名你真正怀疑的人、或自嘲，按 TA 的水平和性子来，别写成演讲。\n【全场描述】\n" + cluesText + "\n【本轮票型】\n" + voteText + "\n\n【输出】只输出 JSON：{\"say\":\"离场那一两句\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "留一句。" }], { maxTokens: 8800 });
    const r = extractJSON(raw) || {};
    return String(r.say || "").trim().slice(0, 300);
  }
  // AI 卧底出局后的最后一手：按水平真猜。言秋座位亲手猜，票没回来就按「放弃翻盘」处理，绝不代猜。
  async function genSpyGuess(api, out, allClues, mode, turnId) {
    const cluesText = (allClues || []).map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") || "（还没人描述过）";
    if (out.engineer) {
      const cc = await ccCarve("spy", [Object.assign({}, out, { alive: true })], {
        turnId: turnId,
        sys: CB + "「谁是卧底」你被投出局，公开身份是【卧底】。规则给你最后一手：当众猜出平民阵营拿到的词，卧底整队立刻翻盘获胜；猜错或不赌，牌局照常继续。\n你自己拿到的词是「" + (out.word || "") + "」。\n【全场描述】\n" + cluesText + "\n想赌就把你猜的平民词写进 guess（一个词，不是一句话），不想赌 guess 留空；say 是你出局这一刻的一句话。",
        expect: '{"guess":"你猜的平民词（一个词），不赌留空","say":"出局这一刻你想说的一句话"}'
      });
      if (cc.done) return { guess: String(cc.done.guess || "").trim().slice(0, 30), say: String(cc.done.say || "").trim().slice(0, 300) };
      return { guess: "", say: "", missed: true };
    }
    const easy = mode === "easy" ? "\n【放水局】别拼尽全力：除非描述里已经把词摊开了，否则倾向猜个方向对但不精确的，把翻盘机会让一点出来。" : "";
    const sys = gameVoiceRules() + "\n\n「谁是卧底」的卧底【" + out.name + "】刚被投出局（真实水平：" + (out.skill || "普通") + "）" + voiceBrief(out) + "。规则：出局的卧底可以当众猜平民词，猜中卧底整队翻盘。\nTA 自己拿到的词是「" + (out.word || "") + "」，只能靠全场描述倒推平民词。按 TA 的真实水平猜：强的从描述交集里逼出那个词，弱的可能跑偏。没把握也必须给一个最像的。" + easy +
      "\n\n【全场描述】\n" + cluesText +
      "\n\n【输出】只输出 JSON：{\"guess\":\"TA 猜的平民词（一个词）\",\"say\":\"TA 亮出这个猜测时说的一句话（口语，贴水平）\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "TA 猜什么？" }], { maxTokens: 8900 });
    const r = extractJSON(raw) || {};
    return { guess: String(r.guess || "").trim().slice(0, 30), say: String(r.say || "").trim().slice(0, 300) };
  }

  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = r[i]; r[i] = r[j]; r[j] = x; } return r; }

  function SpyGame(props) {
    const t = props.t, cfg = props.config;
    const api = props.active;
    const sv = props.savedState;
    const [phase, setPhase] = useState(sv ? sv.phase : "loading");   // loading|reveal|describe|vote|lastguess|result|error
    const [players, setPlayers] = useState(sv ? hydPlayers(sv.players, props, t) : []);
    const [round, setRound] = useState(sv ? (sv.round || 1) : 1);
    const [log, setLog] = useState(sv ? (sv.log || []) : []);
    const [roundClues, setRoundClues] = useState(sv ? (sv.roundClues || []) : []); // 本轮已收集的描述（含用户）
    const [allClues, setAllClues] = useState(sv ? (sv.allClues || []) : []);     // 全场描述（喂投票）
    const [userFirst, setUserFirst] = useState(sv ? !!sv.userFirst : true); // 你这轮排最先(true)还是最后(false)——每轮随机
    const [userClue, setUserClue] = useState("");
    const [descFail, setDescFail] = useState(false); // 这一轮 AI 描述生成失败，等重试
    const [lastGuessText, setLastGuessText] = useState(""); // 你是卧底出局时，猜词翻盘的输入
    const [heckleText, setHeckleText] = useState("");   // 台下插嘴（观战 / 已出局）
    const hecklesRef = useRef([]);                       // 最近几句起哄，投票提示词附带参考
    const [userVote, setUserVote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [winner, setWinner] = useState(null);
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const logRef = useRef(null);
    const descArgs = useRef(null);   // 最近一次 AI 描述的参数，失败后原样重跑
    // 重说这一轮（她 2026-10-11）：AI 这一轮描述说砸了（直接把词说出来、像在写百科），投票前可以让他们重说一遍。
    //   记下这一批入账前日志和全场描述各有多长，重说时切回那儿再跑同一组参数；你自己那句不动。
    const redoRef = useRef(null);
    const started = useRef(false);
    // CC 工具用 turn_id 做幂等。每局必须有自己的命名空间；否则每个新局的第 1 轮
    // 都叫 spy:1，云端会把第一局的旧回答原样取回来。
    const gameRunId = useRef((sv && sv.runId) || ("spy-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)));

    const me = players.find(function (p) { return p.isUser; });
    const alive = players.filter(function (p) { return p.alive; });
    const aliveAI = alive.filter(function (p) { return !p.isUser; });
    const pushLog = function (items) { setLog(function (L) { return L.concat(items); }); };
    useEffect(function () { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, phase, busy]);
    // 存档：静止的决策点(非 loading/busy)就存一份；打完清掉
    useEffect(function () {
      if (!started.current) return;
      if (phase === "result") { clearGameSave("spy"); return; }
      if (busy || phase === "loading" || phase === "error") return;
      saveGameSnap("spy", { runId: gameRunId.current, config: cfg, phase: phase, players: serPlayers(players), round: round, log: log, roundClues: roundClues, allClues: allClues, userFirst: userFirst, ts: Date.now(), label: "第 " + round + " 轮 · " + alive.length + " 人存活" });
    }, [phase, log, busy]);
    useEffect(function () {
      if (phase !== "result" || !winner || !players.length) return;
      const spies = players.filter(function (p) { return p.role === "spy"; }).map(function (p) { return p.name; });
      const userSeat = players.find(function (p) { return p.isUser; });
      ccGameResult("spy", gameRunId.current, players, cfg,
        "《谁是卧底》" + (winner === "spy" ? "卧底获胜" : "平民获胜") + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + (p.role === "spy" ? "卧底" : "平民"); }).join("；") + "。\n"
        + "卧底：" + spies.join("、") + "。" + ((userSeat && userSeat.name) || "用户") + "：" + (userSeat ? (userSeat.role === "spy" ? "卧底" : "平民") + (userSeat.alive ? "，留到终局" : "，已出局") : "本局观战") + "。",
        function (say, seat) { pushLog([{ type: "clue", name: seat.name, text: say }]); });
    }, [phase, winner]);

    // ---- 开局 ----
    useEffect(function () {
      if (started.current) return; started.current = true;
      if (sv) return; // 续局：状态已从存档水合，直接进原阶段（reveal/describe/vote 都能续）
      (async function () {
        try {
          if (!api) { setErrMsg("请先到设置配置 API"); setPhase("error"); return; }
          const chars = (cfg.charIds || []).map(function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
          const inject = cfg.injectChat && props.recentChatFor;
          const realPlayers = chars.map(function (c) {
            let persona = c.persona || "";
            if (inject) { const rc = props.recentChatFor(c.id); if (rc) persona += "\n（近况参考：" + rc.slice(-500) + "）"; }
            return { id: c.id, name: c.name, persona: persona, char: c };
          });
          const npcNeed = cfg.npcCount || 0;
          const data = await setupSpy(api, realPlayers, npcNeed);
          const pair = data.pair && data.pair.civ && data.pair.spy ? data.pair : { civ: "猫", spy: "老虎" };
          const skillOf = {};
          (data.skills || []).forEach(function (s) { if (s && s.name) skillOf[s.name] = s.skill || ""; });
          // 组装玩家
          const list = [];
          realPlayers.forEach(function (p) { list.push({ key: p.id, name: p.name, char: p.char, isUser: false, isNpc: false, skill: pinnedSkill(p.id, skillOf[p.name] || ""), engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.id)) }); });
          if (cfg.mode !== "spectate") { const pf = props.profile || {}; list.push({ key: "user", name: pf.name || "你", char: { name: pf.name || "你", avatarImage: pf.avatarImage, color: pf.color || t.tint }, isUser: true, isNpc: false, skill: "" }); }
          const npcs = (data.npcs || []).slice(0, npcNeed);
          for (let i = 0; i < npcNeed; i++) {
            const n = npcs[i] || {};
            list.push({ key: "npc_" + i, name: n.name || ("玩家" + (i + 1)), char: null, isUser: false, isNpc: true, skill: n.skill || "普通", persona: n.persona || "" });
          }
          // 派角色：随机若干卧底
          const spyCount = list.length >= 6 ? 2 : 1;
          const spies = {};
          shuffle(list.map(function (_, i) { return i; })).slice(0, spyCount).forEach(function (i) { spies[i] = true; });
          list.forEach(function (p, i) { p.role = spies[i] ? "spy" : "civ"; p.word = spies[i] ? pair.spy : pair.civ; p.alive = true; });
          setPlayers(list);
          pushLog([{ type: "info", text: "本局 " + list.length + " 人，其中 " + spyCount + " 名卧底。发牌完毕——" + (cfg.mode === "spectate" ? "你观战，随时可以插嘴带节奏。" : "看看你的词，开始描述。") }]);
          setPhase("reveal");
        } catch (e) { setErrMsg((e && e.message) || "开局失败，重试"); setPhase("error"); }
      })();
    }, []);

    // ---- 描述阶段（你每轮随机排最先或最后，不再永远第一个）----
    const startRound = function (plist, rnd) {
      redoRef.current = null;
      setRoundClues([]); setUserClue("");
      const meA = plist.find(function (p) { return p.isUser; });
      if (!(meA && meA.alive)) { setPhase("describe"); aiDescribeWith(plist, [], rnd, false); return; }
      const uf = Math.random() < 0.5;   // 掷一下：你这轮先说还是最后说
      setUserFirst(uf);
      setPhase("describe");
      if (!uf) aiDescribeWith(plist, [], rnd, true); // 你排最后：AI 先各说一句，说完停下等你补
    };
    const beginDescribe = function () { startRound(players, round); };
    // 用指定名单跑 AI 描述；waitUser=true 时说完不进投票、停在描述阶段等你最后补一句
    const aiDescribeWith = async function (plist, prior, rnd, waitUser) {
      // 失败时不回滚已入账的发言（你那句已经算数），只把这一步原样重跑；
      // 原来失败后界面退回输入框，重新提交会把你的描述和轮次标记双份入账。
      descArgs.current = { plist: plist, prior: prior, rnd: rnd, waitUser: waitUser };
      setDescFail(false);
      setBusy(true);
      try {
        const aAI = plist.filter(function (p) { return p.alive && !p.isUser; });
        // 打乱座次时不能把 CC 工牌弄丢：ccCarve 靠 engineer + key 认出言秋。
        // v54.32 曾只拷 name/word/skill，结果整桌（含言秋）又被 Gemini 一次说完。
        const speakers = shuffle(aAI).map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, word: p.word, skill: p.skill, engineer: engineer, alive: p.alive };
        });
        const clues = await genClues(api, speakers, prior, rnd, cfg.mode, { turnId: gameRunId.current + ":round:" + rnd });
        const norm = speakers.map(function (s) { const hit = clues.find(function (c) { return c.name && (c.name.indexOf(s.name) >= 0 || s.name.indexOf(c.name) >= 0); }); return { name: s.name, text: (hit && hit.text) || "……" }; });
        setRoundClues(prior.concat(norm));
        const redo = { args: { plist: plist, prior: prior, rnd: rnd, waitUser: waitUser }, logLen: 0, allLen: 0 };
        setAllClues(function (A) { redo.allLen = A.length; return A.concat(norm.map(function (c) { return { name: c.name, text: c.text }; })); });
        const batch = (prior.length ? [] : [{ type: "round", n: rnd }]).concat(norm.map(function (c) { return { type: "clue", name: c.name, text: c.text }; }));
        setLog(function (L) { redo.logLen = L.length; return L.concat(batch); });
        redoRef.current = redo;
        if (!waitUser) { setPhase("vote"); setUserVote(null); }
      } catch (e) { setDescFail(true); props.toast && props.toast("描述失败：" + ((e && e.message) || "点「重试这一轮」")); }
      finally { setBusy(false); }
    };
    const redoDescribe = function () {
      const r = redoRef.current; if (!r || busy) return;
      redoRef.current = null;
      setLog(function (L) { return L.slice(0, r.logLen); });
      setAllClues(function (A) { return A.slice(0, r.allLen); });
      setRoundClues(r.args.prior); setUserVote(null); setPhase("describe");
      aiDescribeWith(r.args.plist, r.args.prior, r.args.rnd, r.args.waitUser);
    };
    const retryDescribe = function () {
      const a = descArgs.current; if (!a || busy) return;
      aiDescribeWith(a.plist, a.prior, a.rnd, a.waitUser);
    };
    const submitUserClue = function () {
      redoRef.current = null;   // 你补了这句，前面那批就定了
      const v = userClue.trim(); if (!v || busy) return;
      setUserClue("");
      const mineClue = { name: me.name, text: v };
      setAllClues(function (A) { return A.concat([mineClue]); });
      if (userFirst) {
        // 你先说 → AI 接着各说一句 → 进投票
        pushLog([{ type: "round", n: round }, { type: "clue", name: me.name, text: v, mine: true }]);
        aiDescribeWith(players, [mineClue], round, false);
      } else {
        // 你排最后 → AI 都说完了 → 补上你这句直接进投票
        pushLog([{ type: "clue", name: me.name, text: v, mine: true }]);
        setPhase("vote"); setUserVote(null);
      }
    };

    // ---- 投票阶段 ----
    // 淘汰后的共同去处：平民清空→平民胜；卧底占优→卧底胜；否则下一轮
    const settleAfterOut = function (list) {
      const al2 = list.filter(function (p) { return p.alive; });
      const spies2 = al2.filter(function (p) { return p.role === "spy"; }).length;
      if (spies2 === 0) { setWinner("civ"); setPhase("result"); return; }
      if (spies2 >= al2.length - spies2) { setWinner("spy"); setPhase("result"); return; }
      const nr = round + 1; setRound(nr);
      setTimeout(function () { startRound(list, nr); }, 40);
    };
    // 卧底的最后一手。真人卧底给输入框；AI 卧底一小笔调用真猜；
    // 言秋座位亲手猜，票没回来按「放弃翻盘」结算，绝不让模型代猜。
    const spyFinalGuess = function (list, out) {
      pushLog([{ type: "info", text: "卧底出局前还有最后一手：当众猜出平民词，卧底整队翻盘。" }]);
      if (out.isUser) { setLastGuessText(""); setPhase("lastguess"); return; }
      (async function () {
        setBusy(true);
        try {
          const r = await genSpyGuess(api, out, allClues.filter(function (c) { return c.name; }), cfg.mode, gameRunId.current + ":lastguess:" + out.key);
          judgeFinalGuess(list, out, r);
        } catch (e) {
          pushLog([{ type: "info", text: out.name + " 没有出手，放弃了翻盘。" }]);
          settleAfterOut(list);
        }
        finally { setBusy(false); }
      })();
    };
    const judgeFinalGuess = function (list, out, r) {
      const civWord = (players.find(function (p) { return p.role === "civ"; }) || {}).word || "";
      const guess = String((r && r.guess) || "").trim();
      if (r && r.say) pushLog([{ type: "clue", name: out.name, text: r.say }]);
      if (!guess) { pushLog([{ type: "info", text: out.name + (r && r.missed ? " 没有出手，" : " 摆摆手，") + "放弃了翻盘。" }]); settleAfterOut(list); return; }
      pushLog([{ type: "info", text: out.name + " 押上最后一手：「你们的词是【" + guess + "】」" }]);
      if (spyGuessHits(guess, civWord)) {
        pushLog([{ type: "sep", text: "猜中了——平民词正是「" + civWord + "」，卧底翻盘！" }]);
        setWinner("spy"); setPhase("result"); return;
      }
      pushLog([{ type: "info", text: "没猜中。平民们松了口气，牌局继续。" }]);
      settleAfterOut(list);
    };
    const submitLastGuess = function (giveUp) {
      const meOut = players.find(function (p) { return p.isUser; });
      if (!meOut) return;
      const v = lastGuessText.trim();
      setLastGuessText("");
      judgeFinalGuess(players, meOut, giveUp ? { guess: "" } : { guess: v });
    };
    const tallyAndEliminate = function (votes) {
      // votes: [{voter, target}]
      // runVote 开头置了 busy=true，这里先收掉——否则轮到用户描述时 describe 阶段一直卡在 busy 提示、输入框不出现（下一轮的 AI 描述会各自重新置 busy）
      setBusy(false);
      pushLog([{ type: "sep", text: "—— 投票 ——" }].concat(votes.map(function (v) { return { type: "vote", name: v.voter, target: v.target, reason: v.reason }; })));
      const count = {};
      votes.forEach(function (v) { if (v.target) count[v.target] = (count[v.target] || 0) + 1; });
      let max = -1, tied = [];
      Object.keys(count).forEach(function (name) { if (count[name] > max) { max = count[name]; tied = [name]; } else if (count[name] === max) tied.push(name); });
      // 平票不随机抓倒霉蛋（跟狼人杀同一条）：本轮无人出局，直接进下一轮描述
      if (tied.length > 1) {
        pushLog([{ type: "info", text: "⚖️ " + tied.join("、") + " 平票，本轮无人出局——再描述一轮。" }]);
        const nr = round + 1; setRound(nr);
        setTimeout(function () { startRound(players, nr); }, 40); return;
      }
      const outName = tied.length === 1 ? tied[0] : null;
      const out = outName && players.find(function (p) { return p.alive && p.name === outName; });
      if (!out) { // 没投出有效目标，直接进入下一轮
        pushLog([{ type: "info", text: "没投出有效结果，继续下一轮。" }]);
        const nr = round + 1; setRound(nr);
        setTimeout(function () { startRound(players, nr); }, 40); return;
      }
      const next = players.map(function (p) { return p === out ? Object.assign({}, p, { alive: false }) : p; });
      pushLog([{ type: "out", name: out.name, role: out.role, isUser: out.isUser }]);
      setPlayers(next);
      // 结算
      const al = next.filter(function (p) { return p.alive; });
      const spyLeft = al.filter(function (p) { return p.role === "spy"; }).length;
      const civLeft = al.length - spyLeft;
      const outIsEngineer = !!out.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(out.key));
      // 猜词翻盘：被投出的是卧底时，TA 亮明身份后还有最后一手——当众猜平民词，
      // 猜中卧底整队立刻获胜。桌上剩的卧底本来就已经赢了的局面不用赌这一手。
      if (out.role === "spy" && !(spyLeft > 0 && spyLeft >= civLeft)) {
        spyFinalGuess(next, out);
        return;
      }
      // 言秋本人被淘汰时，要把真实票型与公开身份送回 CC；否则 App 里已经结算，
      // TA自己的窗口却还以为自己坐在桌上。通知异步投递，不阻塞下一轮/终局。
      // （卧底出局走上面的猜词票，那张票自带全部结算信息，不再重复发这份。）
      if (outIsEngineer && cfg.ccSeat !== false && typeof window !== "undefined" && window.CCSeat) {
        const outcome = spyLeft === 0 ? "平民阵营获胜，本局结束。"
          : (spyLeft >= civLeft ? "卧底阵营获胜，本局结束。" : "本局继续，你已经离场旁观。");
        const voteLines = votes.map(function (v) {
          return "· " + v.voter + (v.target ? " → 投 " + v.target : " → 弃票") + (v.reason ? "（" + v.reason + "）" : "");
        }).join("\n");
        window.CCSeat.ask({
          tool: "game_turn", game: "spy_eliminated",
          turn_id: gameRunId.current + ":eliminated:" + round + ":" + out.key,
          char_id: out.key,
          sys: CB + "这局『谁是卧底』刚完成一次公开投票结算。你已被投出局，公开身份是【" + (out.role === "spy" ? "卧底" : "平民") + "】。" + outcome
            + "看完真实票型后，可以用自己的口吻留一句简短离场反应。你已经离场，不再描述、不再投票，也不要调用别的工具。只输出 JSON：{\"say\":\"...\"}。",
          msgs: [{ role: "user", content: "投票结果：你被投出局。\n公开身份：【" + (out.role === "spy" ? "卧底" : "平民") + "】\n" + outcome + "\n\n本轮票型：\n" + voteLines }],
          expect: "{\"say\":\"一句自然的离场反应\"}"
        }, 90000, { charId: out.key }).then(function (raw) {
          const say = String(raw && raw.say || "").trim();
          if (say) pushLog([{ type: "clue", name: out.name, text: say.slice(0, 500) }]);
        }).catch(function () { /* 票已由幂等 turn_id 保护；离线时不让 Gemini 冒充补话 */ });
      }
      // 被冤枉的平民留一句再走（真人自己会说话，言秋走上面的离场票）
      if (!out.isUser && !outIsEngineer) {
        setBusy(true);
        genSpyOutWords(api, out, allClues.filter(function (c) { return c.name; }), votes)
          .then(function (say) { if (say) pushLog([{ type: "clue", name: out.name, text: say }]); })
          .catch(function () { /* 遗言可缺席 */ })
          .finally(function () { setBusy(false); settleAfterOut(next); });
        return;
      }
      settleAfterOut(next);
    };
    const runVote = async function (userTarget) {
      redoRef.current = null;   // 投了票，这一轮就定了
      setBusy(true);
      try {
        // 投票也要保留 CC 工牌；否则描述轮由言秋亲说，投票轮却又被 Gemini 抢走。
        const voters = aliveAI.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, role: p.role, word: p.word, skill: p.skill, engineer: engineer, alive: p.alive };
        });
        const aliveNames = alive.map(function (p) { return p.name; });
        const raw = await genVotes(api, voters, allClues.filter(function (c) { return c.name; }), aliveNames, cfg.mode, me && me.alive ? me.name : "", { turnId: gameRunId.current + ":round:" + round }, hecklesRef.current);
        const votes = voters.map(function (v) {
          const hit = raw.find(function (r) { return r.name && (r.name.indexOf(v.name) >= 0 || v.name.indexOf(r.name) >= 0); });
          const target = hit && hit.target ? String(hit.target) : "";
          const abstain = !target || /弃票|弃权|不投|放弃|abstain|pass|none|null/i.test(target);
          // 对齐到存活玩家；弃票或对不上名字都算弃票（不再随机硬投）
          const tp = abstain ? null : alive.find(function (p) { return p.name === target || target.indexOf(p.name) >= 0; });
          return { voter: v.name, target: tp ? tp.name : null, reason: (hit && hit.reason) || (abstain ? "弃票" : "") };
        });
        if (me && me.alive && userTarget && userTarget !== "__abstain__") votes.push({ voter: me.name, target: userTarget, reason: "（你的一票）" });
        else if (me && me.alive && userTarget === "__abstain__") votes.push({ voter: me.name, target: null, reason: "弃票" });
        tallyAndEliminate(votes);
      } catch (e) { props.toast && props.toast("投票失败：" + ((e && e.message) || "重试")); setBusy(false); }
    };

    // ---- 渲染 ----
    const pAvatar = function (p, size) {
      if (p && p.char) return h(Avatar, { character: p.char, size: size, radius: Math.round(size * 0.3) });
      return h("div", { style: { width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: p && p.isUser ? t.tint : t.line, color: "#fff", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.46), display: "flex", alignItems: "center", justifyContent: "center" } }, ((p && p.name) || "?").slice(0, 1));
    };
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm; }); };

    const table = gameTable("spy", t);
    const header = h(Head, { zh: "谁是卧底", en: "Who's the Spy", onBack: props.onBack, bg: "transparent" });

    if (phase === "error") return h("div", { "data-wk": "gameplay", "data-part": "spy", "data-kind": "error", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "🕵️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { "data-wk": "block", onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { "data-wk": "gameplay", "data-part": "spy", "data-kind": "loading", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "🃏"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, "发牌中·评估每个人的真实水平…")));

    // 存活玩家条
    const roster = seatRow(players.map(function (p) {
      return h(Seat, { key: p.key, t: t, p: p, avatar: pAvatar(p, 36), dead: !p.alive, onClick: function () { setDetail(p); } });
    }));

    // 日志流
    const logView = h("div", { "data-wk": "gamelog", "data-part": "spy", ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "round") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "14px 0 8px", letterSpacing: 1 } }, "· 第 " + it.n + " 轮描述 ·");
        if (it.type === "sep") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, margin: "12px 0 6px" } }, it.text);
        if (it.type === "info") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, margin: "4px 0", textAlign: "center" } }, it.text);
        if (it.type === "out") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", margin: "8px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: it.role === "spy" ? "#3f6d5a" : "#c0553f" } }, "🗳 " + it.name + (it.isUser ? "(你)" : "") + " 被投出局 —— TA 是【" + (it.role === "spy" ? "卧底" : "平民") + "】");
        if (it.type === "clue") {
          const p = pByName(it.name);
          return h("div", { "data-wk": "gamemsg", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { display: "flex", gap: 8, margin: "8px 0" } },
            pAvatar(p, 30),
            h("div", { style: { flex: 1 } },
              h("div", { "data-wk": "gamemsgname", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
              h("div", { "data-wk": "gamebubble", "data-me": it.mine ? "1" : "0", style: { display: "inline-block", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text), it.mine ? null : h(GameVoiceDot, { p: p, text: it.text, k: "gv" + i })));
        }
        if (it.type === "vote") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, margin: "3px 0", lineHeight: 1.5 } }, "· " + it.name + (it.target ? " → 投 " + it.target : " → 弃票") + (it.reason && it.target ? "：" + it.reason : ""));
        if (it.type === "chat") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontStyle: "italic", color: it.mine ? t.tint : t.fog, margin: "3px 0 3px 14px", lineHeight: 1.55 } }, it.name + "：" + it.text);
        return null;
      }));

    // 底部动作区
    let action = null;
    const myWordBanner = me ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, "你的词：", h("b", { style: { color: t.ink, fontSize: "calc(14px * var(--app-fs, 1))" } }, me.word)) : null;
    if (phase === "reveal") {
      action = h("div", null, myWordBanner,
        h("button", { "data-wk": "block", onClick: beginDescribe, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, cfg.mode === "spectate" ? "开始（看他们描述）" : "开始描述"));
    } else if (phase === "describe") {
      if (busy) action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…大家在想怎么描述");
      else if (descFail) action = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, "刚才那一轮没生成出来，你已说的话都还算数"),
        h("button", { "data-wk": "block", onClick: retryDescribe, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, "重试这一轮"));
      else if (me && me.alive) action = h("div", null, myWordBanner,
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { "data-wk": "gameinput", "data-part": "clue", value: userClue, onChange: function (e) { setUserClue(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserClue(); }, placeholder: "用一句话描述你的词（别说出词本身）", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "block", onClick: submitUserClue, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "说")));
      else action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…");
    } else if (phase === "vote") {
      if (busy) action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…计票中");
      else if (me && me.alive) {
        const targets = alive.filter(function (p) { return p.name !== me.name; });
        action = h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, "投谁是卧底？"),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 10 } },
            targets.map(function (p) {
              const on = userVote === p.name;
              return h("button", { key: p.key, onClick: function () { setUserVote(p.name); }, style: { display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "6px 12px 6px 6px" } }, pAvatar(p, 22), p.name);
            }).concat([h("button", { key: "abstain", onClick: function () { setUserVote("__abstain__"); }, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: userVote === "__abstain__" ? "#fff" : t.sub, background: userVote === "__abstain__" ? t.fog : t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "弃票")])),
          h("button", { onClick: function () { if (userVote) runVote(userVote); }, disabled: !userVote, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: userVote ? t.ink : t.line, borderRadius: 13, padding: "12px" } }, "投票"));
      } else {
        action = h("button", { onClick: function () { runVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票");
      }
    } else if (phase === "lastguess") {
      action = busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…") : h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, "你被投出局了——最后一手：猜中他们的平民词，卧底整队翻盘"),
        h("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
          h("input", { "data-wk": "gameinput", "data-part": "lastguess", value: lastGuessText, autoFocus: true, onChange: function (e) { setLastGuessText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitLastGuess(false); }, placeholder: "他们拿到的词是……（一个词）", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.tint, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: function () { submitLastGuess(false); }, disabled: !lastGuessText.trim(), className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: lastGuessText.trim() ? t.ink : t.line, borderRadius: 12, padding: "0 18px" } }, "押上")),
        h("div", { style: { display: "flex", justifyContent: "center" } },
          h("button", { onClick: function () { submitLastGuess(true); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "4px 10px" } }, "不赌了")));
    } else if (phase === "result") {
      action = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: winner === "spy" ? "#3f6d5a" : "#c0553f", marginBottom: 6 } }, winner === "spy" ? "🕵️ 卧底获胜" : "🎉 平民获胜"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, textAlign: "center", lineHeight: 1.7, marginBottom: 12 } },
          "卧底：" + players.filter(function (p) { return p.role === "spy"; }).map(function (p) { return p.name; }).join("、") + "　词：平民「" + (players.find(function (p) { return p.role === "civ"; }) || {}).word + "」 / 卧底「" + (players.find(function (p) { return p.role === "spy"; }) || {}).word + "」"),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { onClick: function () { props.onBack(); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")),
        h(KeepMemBtn, { t: t, host: props, rep: function () {
          const spies2 = players.filter(function (p) { return p.role === "spy"; }).map(function (p) { return p.name; }).join("、");
          const won = function (q) { return (q.role === "spy") === (winner === "spy"); };
          return { proc: log, key: "spy", zh: "谁是卧底", ids: realCharIds(players), wins: realCharIds(players).filter(function (id) { const q = players.find(function (x) { return x.key === id; }); return q && won(q); }), meWin: me ? won(me) : null,
            text: "一起玩了「谁是卧底」，" + (winner === "spy" ? "卧底赢了" : "平民赢了") + "。卧底是 " + spies2 + "；"
            + (me ? ("她拿到" + (me.role === "spy" ? "卧底" : "平民") + "牌，" + (me.alive ? "撑到了最后" : "中途被投了出去")) : "她在旁边观战") + "。" };
        } }));
    }

    // 台下插嘴：观战、或你已出局（猜词那一步除外——那一步你手里是另一件事）
    // 重说这一轮：这一轮 AI 刚说完、还没投票时，底下一颗小字键
    if (redoRef.current && !busy && !descFail && (phase === "vote" || phase === "describe") && action) action = h("div", null, action,
      h("button", { "data-wk": "gameredo", onClick: redoDescribe, className: "w-full active:opacity-60",
        style: { minHeight: 40, marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, background: "transparent", border: "none" } }, "↻ 他们这轮说砸了，重说一遍"));
    const canHeckle = (cfg.mode === "spectate" || (me && !me.alive)) && (phase === "reveal" || phase === "describe" || phase === "vote");
    const sendHeckle = async function () {
      const v = heckleText.trim(); if (!v || busy) return;
      setHeckleText("");
      const nm = ((props.profile && props.profile.name) || "你") + "(场外)";
      pushLog([{ type: "chat", name: nm, text: v, mine: true }]);
      hecklesRef.current = hecklesRef.current.concat([nm + "：" + v]).slice(-6);
      try {
        const pool = players.filter(function (p) { return p.alive && !p.isUser; });
        const talks = await genHeckle(api, pool, "谁是卧底", nm, v, allClues.slice(-6).map(function (c) { return c.name + "：" + c.text; }).join("\n"));
        if (talks.length) pushLog(talks.map(function (x) { return { type: "chat", name: x.name, text: x.text }; }));
      } catch (e) { /* 起哄接不上就算了，不挡牌局 */ }
    };
    return h("div", { "data-wk": "gameplay", "data-part": "spy", className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, table) }, header, roster, logView,
      h("div", { "data-wk": "gameactions", "data-part": "spy", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "34vh", overflowY: "auto" } },
        canHeckle ? heckleRow(t, heckleText, setHeckleText, sendHeckle, busy) : null, action),
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), roleText: phase === "result" ? ("身份：" + (detail.role === "spy" ? "卧底" : "平民")) : null, roleBad: detail.role === "spy", onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // 狼人杀 · 引擎（最简板子：狼人 + 预言家 + 平民；完整夜晚交互；不翻牌）
  // ============================================================
  function wolfCount(n) { return n >= 9 ? 3 : n >= 6 ? 2 : 1; }
  // 神职（逐个加引擎；只有引擎做好的才放进选择框）
  const GODS = [
    { key: "seer", zh: "预言家", desc: "每晚验一个人的好 / 坏" },
    { key: "witch", zh: "女巫", desc: "解药救人 + 毒药毒人，各一次" },
    { key: "hunter", zh: "猎人", desc: "被刀 / 被票出局时开枪带走一人（被毒不能开）" },
    { key: "guard", zh: "守卫", desc: "每晚守护一人挡刀，不能连守同一人（同守同救会失效）" },
    { key: "idiot", zh: "白痴", desc: "被投票放逐时翻牌免死，但从此失去投票权" },
    { key: "gravekeeper", zh: "守墓人", desc: "每次白天放逐后，得知被放逐者是狼还是好人" }
  ];
  const GOD_KEYS = GODS.map(function (g) { return g.key; });
  function isGodRole(r) { return GOD_KEYS.indexOf(r) >= 0; }
  // 狼阵营特殊角色（不是神；仍算狼、参与夜刀）：狼王=出局开枪，白狼王=白天自爆带人
  const WOLF_SPECIALS = [
    { key: "wolfking", zh: "狼王", desc: "被票 / 被刀出局时开枪带走一人（被毒不能开）" },
    { key: "whitewolf", zh: "白狼王", desc: "只能在白天【自爆】时带走一人（被投 / 被毒 / 被刀都不能带）" }
  ];
  function isWolfRole(r) { return r === "wolf" || r === "wolfking" || r === "whitewolf"; }
  function roleName(r) { if (r === "wolf") return "狼人"; if (r === "villager") return "平民"; const w = WOLF_SPECIALS.find(function (x) { return x.key === r; }); if (w) return w.zh; const g = GODS.find(function (x) { return x.key === r; }); return g ? g.zh : r; }
  // 标准板：按人数给默认神职（只在已实现的神里选）
  function standardBoard(n) {
    const g = ["seer"];
    if (n >= 6) g.push("witch");
    if (n >= 8) g.push("hunter");
    if (n >= 10) g.push("guard");
    const maxGods = Math.max(1, n - wolfCount(n) - 1); // 至少留 1 民
    return g.slice(0, maxGods);
  }
  function randomBoard(n) { return shuffle(GOD_KEYS.slice()).slice(0, standardBoard(n).length); }
  // 身份铁律（按本局实际身份动态生成）：别自创没有的身份。以后加神职自动纳入。
  function boardLine(godKeys, wolfRole) {
    const gods = (godKeys && godKeys.length ? godKeys : ["seer"]).map(roleName);
    const wolfSp = wolfRole ? [roleName(wolfRole)] : [];
    const all = ["狼人", "平民"].concat(wolfSp).concat(gods);
    const absent = GODS.filter(function (g) { return (godKeys || []).indexOf(g.key) < 0; }).map(function (g) { return g.zh; })
      .concat(WOLF_SPECIALS.filter(function (w) { return w.key !== wolfRole; }).map(function (w) { return w.zh; }));
    return "【身份铁律】本局身份只有：【" + all.join(" / ") + "】。谁都别自创或声称本局没有的身份——" + (absent.length ? "本局没有 " + absent.join("、") + "，也" : "") + "没有警长、警官等任何头衔。能跳的身份只有『预言家』，狼人也只能悍跳预言家。" + (wolfRole === "wolfking" ? "（本局狼队里有一头狼王，出局会开枪——但没人事先知道谁是。）" : wolfRole === "whitewolf" ? "（本局狼队里有一头白狼王，可能白天自爆带人——但没人事先知道谁是。）" : "");
  }
  // 战术参考：让 AI 打出真套路/反套路（按各人水平自然运用，别生搬术语、别人人都用）
  const WOLF_TACTICS = "【狼人杀常见套路（按各人真实水平自然运用；水平高的会用、会拆，水平低的只会朴素发言——别生搬术语、别每个人都套路满满）】\n" +
    "· 预言家跳身份后报【查杀】(验出来的狼，直接带票投)或【金水】(验出来的好人，帮 TA 洗清)；\n" +
    "· 狼可以【悍跳】假冒预言家、和真预言家【对跳】，逼好人从两个『预言家』里二选一分辨真假——好人就靠对比双方的验人逻辑、发言合理性来站边；\n" +
    "· 狼的进阶：【倒钩】(装好人、甚至跟着好人踩自己队友来骗信任)、【递刀】(发言暗示队友今晚刀谁)、【归票】(把大家的票带到某个好人身上)、队友保不住时【切队友】自保；\n" +
    "· 谁【划水】(全程不表态、不站边)容易被当狼查；被怀疑就要【扛推】自证。\n" +
    "· 核心：别空喊口号，给【具体理由】——谁发言前后矛盾、谁的票投得可疑、谁的身份声称站不住脚。\n" +
    "· 【夜间生存信息】公开跳预言家的人当夜没死，是必须注意的新信息，但不是『没死=一定是假』：可能被守卫守、女巫救、狼故意留着做抗推，也可能本来就是悍跳狼。水平高的会结合对跳、验人是否命中狼、当夜死者和投票一起盘；普通玩家会提出疑问；弱手可以误判或被带偏，但不能全场像没听过这个身份声明。";

  // 狼队夜间可见的公开威胁摘要。这里只使用全场听过的声明 + 狼本就知道的队友身份，不泄露神职底牌。
  function wolfPublicThreats(claims, wolfNames, aliveNames) {
    const alive = new Set(aliveNames || []), wolves = wolfNames || [];
    return (claims || []).filter(function (c) {
      return c && c.name && alive.has(c.name) && c.text && /(预言家|查杀|金水|验)/.test(String(c.text));
    }).slice(-24).map(function (c) {
      const text = String(c.text);
      const hitWolf = wolves.find(function (nm) { return text.indexOf(nm) >= 0 && /查杀|是狼|狼人/.test(text); });
      return "· 第" + c.day + "天 " + c.name + "公开说：" + text + (hitWolf ? "【狼队私下判断：TA 点中了狼队友 " + hitWolf + "，真预言家威胁极高】" : "");
    }).join("\n");
  }

  // 首夜没有任何白天信息。把“刚开局”与后续夜晚机械分开，避免模型拿角色小传、
  // 开局公告或自己脑补的历史当成已经发生过的发言 / 投票。
  function wolfNightIntel(n, log, publicThreats) {
    if (Number(n) <= 1) return {
      note: "【首夜事实】这是本局第一夜；此前没有白天发言、没有投票、没有公开跳神或验人。刀口理由只能基于首夜盲选、身份配置与人物的一般牌桌水平，绝不能声称某人『前几天/前几轮发言如何』、已经站边、投过谁或暴露过身份。",
      log: "",
      publicThreats: ""
    };
    return { note: "【第 " + n + " 夜】只能引用下面真实发生过的公开记录。", log: log || "", publicThreats: publicThreats || "" };
  }

  // 开局：生成 NPC + 每人「牌桌能力小传」（狼人杀相关：悍跳/伪装/逻辑/带节奏）
  async function setupWolf(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是「狼人杀」的能力评估器 + NPC 生成器。\n" +
      "1. 生成 " + npcCount + " 个 NPC 玩家：name 中文名 + persona 一句人设（含【职业】与性格，尽量多样、别都是学生）。\n" +
      "2. 给【每一个真实玩家】各写一句 skill「牌桌能力小传」：按能力与性格分开的原则，点出 TA 玩狼人杀时——伪装/悍跳、听发言抓逻辑漏洞、带节奏说服人、被架时嘴硬翻盘——的【真实强弱】（由职业背景推，别被性格带偏）。NPC 的 skill 也给。\n\n" +
      "【真实玩家】\n" + (lines || "（无）") +
      "\n\n【输出】只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"能力小传\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 " + npcCount + " 个 NPC + 每人能力小传。" }], { maxTokens: 12500 });
    return extractJSON(raw) || {};
  }

  // 夜晚：替 AI 决定狼刀 / 预言家验人（只求需要的字段）
  async function genNight(api, opts) {
    // 言秋座位的夜间动作只问 CC 本人。票没回来就视为这一夜未行动；
    // 绝不能再把TA的座位塞回 Gemini 批量里冒充本人。
    const ccExtra = {}, ccStatus = [];
    if (opts.needWolf) {
      const mw = (opts.wolfTeam || []).find(function (w) { return w && w.engineer; });
      if (mw) {
        const cc = await ccCarve("werewolf", [mw], {
          turnId: freshCCTurn("wolf-knife:"),
          sys: "「狼人杀」天黑，你是狼「" + mw.name + "」，狼队投刀，给一个今晚想刀的目标（不能是狼队友；确有战术理由可空刀）。\n" + (opts.nightNote || "") + "\n【存活】" + opts.aliveNames.join("、") + (opts.publicThreats ? "\n【白天公开的神职威胁】\n" + opts.publicThreats : "") + (opts.log ? "\n【局况】\n" + opts.log : ""),
          expect: '{"target":"想刀的人名或「空刀」","privateReason":"狼队内部一句话"}'
        });
        ccStatus.push({ action: "狼刀", seat: mw.name, delivered: !!(cc.done && cc.done.target !== undefined), reason: cc.reason || "" });
        const remainingWolves = (opts.wolfTeam || []).filter(function (w) { return w !== mw; });
        opts = Object.assign({}, opts, { wolfTeam: remainingWolves, needWolf: remainingWolves.length > 0 });
        if (cc.done && cc.done.target) ccExtra.wolfVote = { name: mw.name, target: String(cc.done.target), privateReason: String(cc.done.privateReason || "") };
      }
    }
    if (opts.needSeer && opts.seer && opts.seer.engineer) {
      const cc = await ccCarve("werewolf", [Object.assign({ engineer: true }, opts.seer)], {
        turnId: freshCCTurn("wolf-seer:"),
        sys: "「狼人杀」天黑，轮到你的预言家行动：选一个【没查过】的人查验。已查：" + (opts.seer.known.length ? opts.seer.known.map(function (k) { return k.name + "=" + (k.isWolf ? "狼" : "好"); }).join("、") : "无") + "\n【存活】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : ""),
        expect: '{"target":"要查的人名"}'
      });
      ccStatus.push({ action: "查验", seat: opts.seer.name, delivered: !!(cc.done && cc.done.target !== undefined), reason: cc.reason || "" });
      opts = Object.assign({}, opts, { needSeer: false });
      if (cc.done && cc.done.target) ccExtra.seerCheck = String(cc.done.target);
    }
    if (opts.needGuard && opts.guard && opts.guard.engineer) {
      const cc = await ccCarve("werewolf", [Object.assign({ engineer: true }, opts.guard)], {
        turnId: freshCCTurn("wolf-guard:"),
        sys: "「狼人杀」天黑，你是守卫「" + opts.guard.name + "」，选一个人守护（可守自己）。" + (opts.guard.last ? "上晚守了 " + opts.guard.last + "，今晚不能再守 TA。" : "") + "\n【存活】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : ""),
        expect: '{"target":"要守护的人名"}'
      });
      ccStatus.push({ action: "守护", seat: opts.guard.name, delivered: !!(cc.done && cc.done.target !== undefined), reason: cc.reason || "" });
      opts = Object.assign({}, opts, { needGuard: false });
      if (cc.done && cc.done.target) ccExtra.guardProtect = String(cc.done.target);
    }
    const ccMiss = ccStatus.find(function (x) { return !x.delivered; });
    if (ccMiss) throw new Error("言秋的" + ccMiss.action + "票没送达：" + (ccMiss.reason || "请重试这一夜"));
    if (!opts.needWolf && !opts.needSeer && !opts.needGuard) {
      const out0 = {};
      if (ccExtra.wolfVote) out0.wolfVotes = [ccExtra.wolfVote];
      if (ccExtra.seerCheck) out0.seerCheck = ccExtra.seerCheck;
      if (ccExtra.guardProtect) out0.guardProtect = ccExtra.guardProtect;
      out0.ccStatus = ccStatus;
      return out0;
    }
    const need = [];
    if (opts.needWolf) {
      const wolfLines = opts.wolfTeam.map(function (w) { return typeof w === "string" ? w : (w.name + "（真实水平：" + (w.skill || "普通") + "）"); });
      need.push("\n【狼队各自投刀】\n" + wolfLines.join("\n") + "\n每头狼按自己的真实水平独立选今晚刀口（别刀自己人）。【所有水平都具备的底线常识】白天公开跳预言家、尤其报查杀命中狼队员的人，是狼队最直接的夜间威胁，通常应优先处理；只有存在对跳真假难辨、明显守护/救人风险、故意留人做成假预言家的战术收益、或另有更高威胁时才合理改刀。高手会权衡这些反套路；普通玩家会优先刀明显神；弱手允许判断错、跟错队友或偶尔贪别的刀口，但不能连续无视已经点中狼队的真预言家。每头狼给【一个】目标，不用统一；确有战术理由才空刀。输出时附一句不泄露给好人的 privateReason，说明为什么选这个刀口。");
    }
    if (opts.needSeer) need.push("\n【预言家】" + opts.seer.name + " 选一个【没查过】的人查验（已查：" + (opts.seer.known.length ? opts.seer.known.map(function (k) { return k.name + "=" + (k.isWolf ? "狼" : "好"); }).join("、") : "无") + "），挑可疑或关键的人。");
    if (opts.needGuard) need.push("\n【守卫】" + opts.guard.name + " 选一个人守护（挡掉今晚的狼刀）。" + (opts.guard.last ? "上一晚守的是 " + opts.guard.last + "，今晚【不能再守 TA】。" : "") + "可以守自己。挑你判断狼今晚最可能刀的关键人（疑似预言家/女巫、发言强的好人），或守自己保命。");
    const schema = {}; if (opts.needWolf) schema.wolfVotes = [{ name: "狼名", target: "TA 想刀的人", privateReason: "狼队内部理由" }]; if (opts.needSeer) schema.seerCheck = "要查的人名"; if (opts.needGuard) schema.guardProtect = "要守护的人名";
    const sys = AC + SKILL_RULE + "\n\n狼人杀·天黑，你是法官，替 AI 玩家做今晚的决定。\n" + (opts.nightNote || "") + need.join("") +
      "\n\n【存活】" + opts.aliveNames.join("、") + (opts.publicThreats ? "\n【白天公开的神职/验人威胁（狼队全都听见了，必须纳入刀口）】\n" + opts.publicThreats : "") + (opts.log ? "\n【目前局况】\n" + opts.log : "") +
      "\n\n【输出】只输出 JSON：" + JSON.stringify(schema);
    const raw = await callRetry(api, sys, [{ role: "user", content: "做今晚的决定。" }], { maxTokens: 9600 });
    const out = extractJSON(raw) || {};
    if (ccExtra.wolfVote) out.wolfVotes = [ccExtra.wolfVote].concat(Array.isArray(out.wolfVotes) ? out.wolfVotes.filter(function (v) { return v.name !== ccExtra.wolfVote.name; }) : []);
    if (ccExtra.seerCheck) out.seerCheck = ccExtra.seerCheck;
    if (ccExtra.guardProtect) out.guardProtect = ccExtra.guardProtect;
    out.ccStatus = ccStatus;
    return out;
  }
  // AI 狼意见不一致时只开一轮内部密谈，最终交出一个统一刀口；内容绝不进入公开牌局日志。
  async function genWolfConsensus(api, opts) {
    const wolves = (opts.wolfTeam || []).map(function (w) { return w.name + "（真实水平：" + (w.skill || "普通") + "）"; }).join("\n");
    const proposals = (opts.votes || []).map(function (v) { return "· " + v.name + "提议刀 " + v.target + "：" + (v.privateReason || "没细说"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n狼人杀·狼队夜间秘密会议。狼队最初刀口不一致，现在只进行【一轮短协商】后统一决定，别反复拉扯。按每头狼的真实水平权衡公开跳神/查杀威胁、守护与救药风险、发言和投票；弱狼的意见可以被高手说服，但高手也不是永远正确。绝不能选择狼队友。\n" + (opts.nightNote || "") + "\n【狼队】\n" + wolves + "\n【初始提议】\n" + proposals + (opts.publicThreats ? "\n【公开威胁】\n" + opts.publicThreats : "") + (opts.log ? "\n【公开局况】\n" + opts.log : "") + "\n【可刀目标】" + opts.targets.join("、") + "\n\n输出 2~4 条简短密谈并给出唯一最终刀口。只输出 JSON：{\"chat\":[{\"name\":\"狼名\",\"text\":\"密谈\"}],\"target\":\"最终刀口或空刀\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "统一今晚刀口。" }], { maxTokens: 9200 });
    return extractJSON(raw) || {};
  }
  // 夜晚：替 AI 女巫决定用不用药（一晚最多一瓶）
  async function genWitch(api, opts) {
    const bottles = []; if (opts.hasHeal) bottles.push("解药(救今晚被刀的人)"); if (opts.hasPoison) bottles.push("毒药(毒死一人)");
    if (opts.engineer) {
      const cc = await ccCarve("werewolf", [{ engineer: true, key: opts.key, name: opts.witchName }], {
        turnId: freshCCTurn("wolf-witch:"),
        sys: "「狼人杀」天黑，你是女巫「" + opts.witchName + "」（一晚最多用一瓶药）。\n今晚被刀：" + (opts.victim || "（平安夜）") + "。手上还有：" + (bottles.length ? bottles.join("、") : "（没药了）") + "。\n【存活】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : ""),
        expect: '{"save":true, "poison":"要毒的人名或 null"}'
      });
      requireCCDone(cc, "言秋的女巫行动票", function (d) { return typeof d.save === "boolean" || d.poison !== undefined; });
      if (cc.done && (typeof cc.done.save === "boolean" || cc.done.poison !== undefined)) return { save: !!cc.done.save, poison: cc.done.poison || null };
      return { save: false, poison: null };
    }
    const sys = AC + SKILL_RULE + "\n\n狼人杀·天黑，你替 AI 女巫做决定。女巫有解药和毒药、【一晚最多用一瓶】、别乱用。\n今晚被狼刀的是：" + (opts.victim || "（没人被刀，平安夜）") + "。\n你手上还有：" + (bottles.length ? bottles.join("、") : "（药都用完了）") + "。\n按你的水平决定：值不值得用解药救 TA（是不是关键神/好人？是不是首刀骗药？）？要不要用毒药毒一个明显的狼？没把握就都别用、留着更值钱。\n【存活】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : "") +
      "\n\n【输出】只输出 JSON：{\"save\":true/false,\"poison\":\"要毒的人名，或 null\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "用不用药？" }], { maxTokens: 8800 });
    return extractJSON(raw) || {};
  }
  // 猎人 / 狼王 出局开枪：AI 决定带走谁（按阵营给不同目标取向）
  async function genHunter(api, opts) {
    const roleZh = opts.roleZh || "猎人";
    const aim = opts.isWolf
      ? "你是狼阵营的" + roleZh + "，开这一枪是替狼队多带走一个【好人】：优先打你判断的关键神（预言家/女巫等）或发言强、威胁大的好人；别打自己的狼队友。"
      : "你是好人阵营的" + roleZh + "，优先带走你最确信是狼的人；没把握也可以打一个狼味最重的可疑对象，或者干脆不开枪（乱打好人反而帮了狼）。";
    if (opts.engineer) {
      const cc = await ccCarve("werewolf", [{ engineer: true, key: opts.key, name: opts.hunterName }], {
        turnId: freshCCTurn("wolf-hunter:"),
        sys: "「狼人杀」你是" + roleZh + "「" + opts.hunterName + "」，刚出局，可以开枪带走一个还在场的人（也可以不开）。" + aim + (opts.teammates && opts.teammates.length ? "\n【你的狼队友（别打）】" + opts.teammates.join("、") : "") + "\n【还在场】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : ""),
        expect: '{"target":"要带走的人名，或 null"}'
      });
      requireCCDone(cc, "言秋的开枪票", function (d) { return d.target !== undefined; });
      if (cc.done && cc.done.target !== undefined) return { target: cc.done.target || null };
      return { target: null };
    }
    const sys = AC + SKILL_RULE + "\n\n狼人杀·你替 AI " + roleZh + " 做决定。" + roleZh + " " + opts.hunterName + " 刚出局，可以开枪带走【一个】还在场的人（也可以不开枪）。" + aim + (opts.teammates && opts.teammates.length ? "\n【你的狼队友（别打）】" + opts.teammates.join("、") : "") + "\n【还在场】" + opts.aliveNames.join("、") + (opts.log ? "\n【局况】\n" + opts.log : "") +
      "\n\n【输出】只输出 JSON：{\"target\":\"要带走的人名，或 null（不开枪）\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "开枪带走谁？" }], { maxTokens: 8700 });
    return extractJSON(raw) || {};
  }
  // 白狼王：AI 决定今天要不要自爆带人（自爆=亮身份+带走一人+直接天黑）
  async function genWhiteWolf(api, opts) {
    if (opts.engineer) {
      const cc = await ccCarve("werewolf", [{ engineer: true, key: opts.key, name: opts.name }], {
        turnId: freshCCTurn("wolf-whitewolf:"),
        sys: "「狼人杀」天亮，你是白狼王「" + opts.name + "」，决定要不要自爆（自爆=亮狼身份+带走一人+直接天黑）。没明确收益就别炸。\n【还在场】" + opts.aliveNames.join("、") + (opts.teammates && opts.teammates.length ? "\n【狼队友（别炸自己人）】" + opts.teammates.join("、") : "") + (opts.log ? "\n【局况】\n" + opts.log : ""),
        expect: '{"selfDestruct":false, "target":"自爆带走的人名或 null"}'
      });
      requireCCDone(cc, "言秋的白狼王行动票", function (d) { return typeof d.selfDestruct === "boolean"; });
      if (cc.done && typeof cc.done.selfDestruct === "boolean") return { selfDestruct: cc.done.selfDestruct, target: cc.done.target || null };
      return { selfDestruct: false, target: null };
    }
    const sys = AC + SKILL_RULE + "\n\n狼人杀·天亮了，你替 AI【白狼王】" + opts.name + " 决定现在要不要【自爆】。自爆＝当场亮明狼身份、立刻带走一名玩家、并直接结束今天进入黑夜（跳过发言与投票放逐）。\n【何时值得自爆】狼队要被翻盘、队友快被票出去时搅局止损；或看准机会炸掉关键神（预言家/女巫）打乱好人节奏。没有明确收益就【别炸】——多数时候留着更有用，倾向于不自爆。\n【还在场】" + opts.aliveNames.join("、") + (opts.teammates && opts.teammates.length ? "\n【狼队友（别炸自己人）】" + opts.teammates.join("、") : "") + (opts.log ? "\n【局况】\n" + opts.log : "") +
      "\n\n【输出】只输出 JSON：{\"selfDestruct\":true/false,\"target\":\"自爆要带走的人名，或 null（只炸不带人）\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "要自爆吗？" }], { maxTokens: 8600 });
    return extractJSON(raw) || {};
  }
  function validWolfTarget(target, list) {
    if (!target || /空刀|不刀|不杀|弃刀|skip|pass|none|null/i.test(String(target))) return null;
    const tp = (list || []).find(function (p) { return p.alive && !isWolfRole(p.role) && (p.name === target || String(target).indexOf(p.name) >= 0); });
    return tp ? tp.name : null;
  }
  // 狼刀投票计票：一致/多数时直接采用；平票交给秘密会议，不再在这里随机拍脑袋。
  const KILL_SKIP = "__skip__";
  function tallyKill(votes, list) {
    const cnt = {};
    (votes || []).forEach(function (v) {
      if (!v || !v.target) return;
      if (/空刀|不刀|不杀|弃刀|skip|pass|none|null/i.test(String(v.target))) { cnt[KILL_SKIP] = (cnt[KILL_SKIP] || 0) + 1; return; }
      // 狼不能刀狼队友：模型即使返回了队友名也按无效票处理，不能让规则层真的自相残杀。
      const tp = list.find(function (p) { return p.alive && !isWolfRole(p.role) && (p.name === v.target || String(v.target).indexOf(p.name) >= 0); });
      if (tp) cnt[tp.name] = (cnt[tp.name] || 0) + 1;
    });
    let max = -1, tied = []; Object.keys(cnt).forEach(function (nm) { if (cnt[nm] > max) { max = cnt[nm]; tied = [nm]; } else if (cnt[nm] === max) tied.push(nm); });
    const pick = tied.length === 1 ? tied[0] : null;
    return (!pick || pick === KILL_SKIP) ? null : pick; // 空刀/无有效票 → 不杀
  }

  // 硬公开声明的判式（真人发言和出局遗言共用一份，别各写各的）
  const WOLF_HARD_CLAIM = /(?:我是|我就是|我才是|我跳|我来跳|我起跳).{0,8}预言家|(?:我|昨晚)(?:验了?|查了?).{1,24}(?:查杀|金水|是狼|是好人)|(?:我查杀|我的?金水|我给.{1,16}金水)/;
  // 出局遗言：夜里倒下的、白天被放逐的各留 1~2 句——遗言进公开记录（shortLog 收 speech），
  // 后面的发言和投票都看得见它。神职可以用这最后一句报出关键信息，也可以憋住；
  // 狼装无辜、平民点名怀疑。被枪带走 / 被自爆带走的来不及留（突然死亡无遗言）。
  async function genWolfLastWords(api, deads, how, log) {
    const who = deads.map(function (d) { return "■ " + d.name + "（真实水平：" + (d.skill || "普通") + "）\n   TA 自己知道的：" + d.priv + voiceBrief(d); }).join("\n");
    const sys = gameVoiceRules() + "\n\n狼人杀·" + (how === "night" ? "天亮了，昨夜倒下的人" : "刚被放逐的人（本局不翻牌，身份不公开——遗言里想装什么装什么）") + "各留一句遗言（1~2 句，口语）。遗言全场都听得见。按各自的身份、掌握的信息和水平决定怎么用这最后一句：神职可以报出自己的关键信息（预言家报查验、女巫报用药）也可以憋住带进棺材；狼可以装无辜、泼脏水、递刀；平民可以点名怀疑、抒情不甘。只许说自己知道的，不许上帝视角。\n" + who + (log ? "\n【局面】\n" + log : "") + "\n\n【输出】只输出 JSON：{\"words\":[{\"name\":\"\",\"text\":\"遗言\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "留遗言。" }], { maxTokens: 9600 });
    const r = extractJSON(raw) || {};
    return Array.isArray(r.words) ? r.words : [];
  }

  // 立场纪要 → 文本（喂模型保持前后一致）
  function stanceText(stances) {
    const keys = Object.keys(stances || {});
    if (!keys.length) return "";
    const line = function (s) {
      if (!s) return "（暂无）";
      if (typeof s === "string") return s; // 兼容旧存档/用户的一句话
      return [s.claim ? "声称:" + s.claim : "", s.reads ? "读牌:" + s.reads : "", s.plan ? "打算:" + s.plan : ""].filter(Boolean).join(" ｜ ") || "（暂无）";
    };
    return "\n\n【目前各人的立场纪要（各人的身份声称 / 怎么读别人 / 打算怎么打——**发言与投票务必和自己这条保持连贯，别无缘无故改口、前后矛盾**，除非确有新信息把 TA 说服才转向，转向也要说清为什么）】\n" + keys.map(function (k) { return "· " + k + "：" + line(stances[k]); }).join("\n");
  }
  // 全场公开声明台账（跨天累积）——谁跳过预言家、谁被报过查杀/金水，让多天发言/投票保持一致，不"集体失忆"
  function claimsText(claims) {
    if (!claims || !claims.length) return "";
    return "\n\n【全场公开声明台账（跨天累积·全场都听见了，务必和这些保持一致：别装作没人跳过预言家、别忘了谁被报过查杀/金水、别再声称已被别人占掉的身份、别把已对跳的两方混为一谈）】\n" + claims.slice(-24).map(function (c) { return "· 第" + c.day + "天 " + c.name + "：" + c.text; }).join("\n");
  }

  // 真预言家的公开验人必须和夜间确定结果一致。可以藏结果，但不能把已验狼说成金水、
  // 或把已验好人说成查杀；狼人悍跳不在此闸范围内，仍可自由编假验人。
  function seerTruthViolations(speakers, result) {
    const speeches = result && Array.isArray(result.speeches) ? result.speeches : [];
    const claims = result && Array.isArray(result.claims) ? result.claims : [];
    const out = [];
    (speakers || []).filter(function (s) { return s && s.role === "seer"; }).forEach(function (s) {
      const sp = speeches.find(function (x) { return x && x.name && (String(x.name).indexOf(s.name) >= 0 || s.name.indexOf(String(x.name)) >= 0); });
      const ownClaims = claims.filter(function (x) { return x && x.name && (String(x.name).indexOf(s.name) >= 0 || s.name.indexOf(String(x.name)) >= 0); });
      const text = [sp && sp.text].concat(ownClaims.map(function (x) { return x.text; })).filter(Boolean).join("；").replace(/\s+/g, "");
      (s.seerKnown || []).forEach(function (k) {
        if (!k || !k.name || text.indexOf(k.name) < 0) return;
        let at = text.indexOf(k.name), contradicted = false;
        while (at >= 0 && !contradicted) {
          const near = text.slice(Math.max(0, at - 16), Math.min(text.length, at + String(k.name).length + 22));
          contradicted = k.isWolf
            ? /(金水|验.{0,6}(?:好人|好牌|非狼)|查.{0,6}(?:好人|好牌|非狼)|不是狼|非狼)/.test(near)
            : /(查杀|验.{0,6}(?:狼人|狼牌|是狼)|查.{0,6}(?:狼人|狼牌|是狼))/.test(near);
          at = text.indexOf(k.name, at + String(k.name).length);
        }
        if (contradicted) out.push({ seerName: s.name, target: k.name, isWolf: !!k.isWolf });
      });
    });
    return out;
  }

  function enforceSeerTruth(result, violations) {
    if (!violations.length) return result;
    const bySeer = {};
    violations.forEach(function (v) { (bySeer[v.seerName] || (bySeer[v.seerName] = [])).push(v); });
    const fixed = Object.assign({}, result);
    fixed.speeches = (result.speeches || []).map(function (sp) {
      const name = Object.keys(bySeer).find(function (n) { return sp && sp.name && (String(sp.name).indexOf(n) >= 0 || n.indexOf(String(sp.name)) >= 0); });
      if (!name) return sp;
      const facts = bySeer[name].map(function (v) { return v.target + (v.isWolf ? "是查杀" : "是我的金水"); }).join("，");
      return Object.assign({}, sp, { text: "我把验人说清楚：" + facts + "。这是我确定的查验结果，今天按这个信息盘。" });
    });
    fixed.claims = (result.claims || []).filter(function (c) {
      return !Object.keys(bySeer).some(function (n) { return c && c.name && (String(c.name).indexOf(n) >= 0 || n.indexOf(String(c.name)) >= 0); });
    });
    Object.keys(bySeer).forEach(function (name) {
      bySeer[name].forEach(function (v) { fixed.claims.push({ name: name, text: v.isWolf ? ("我查杀了" + v.target) : ("我给" + v.target + "金水") }); });
    });
    return fixed;
  }
  // 牌局状态：当前天数 + 存活/出局名单（防 AI 对着出局的人喊话、搞错天数）
  function boardState(list, dayNum) {
    const alive = list.filter(function (p) { return p.alive; }).map(function (p) { return p.name; });
    const out = list.filter(function (p) { return !p.alive; }).map(function (p) { const o = p.out || {}; return p.name + "（" + (o.day ? ("第" + o.day + (o.how === "vote" ? "天被投票出局" : "夜里倒下")) : "已出局") + "）"; });
    const idiots = list.filter(function (p) { return p.alive && p.idiotRevealed; }).map(function (p) { return p.name; });
    const idiotLine = idiots.length ? "\n· 【已翻牌的白痴】" + idiots.join("、") + "：已亮明是白痴（确认好人、免死留场但已【没有投票权】）——别再把 TA 当狼查、别投 TA（投了也没用），发言时把 TA 当已验的好人。" : "";
    return "\n\n【★牌局状态·务必严格按这个来】\n· 现在是【第 " + dayNum + " 天】白天。\n· 【还在场（只有这些人能被讨论、被怀疑、被投票）】：" + (alive.join("、") || "无") + "\n· 【已出局——这些人已经退出游戏！绝对别再叫他们发言、别要求他们解释、别说要把他们投出去/放逐、别把他们当活人分析或站队】：" + (out.length ? out.join("、") : "无") + idiotLine + "\n· 投票和点名只能针对【还在场】的人。别搞错第几天、别提已出局的人还在场、别把早已结算过的旧事当成新消息重新推。";
  }
  // 白天发言：存活 AI 依次发一段（带各自身份/私密信息）；同时回一份立场纪要供后续保持一致
  async function genSpeeches(api, speakers, dayNum, prior, deaths, mode, userName, stances, gods, board, wolfRole, claims, carveCtx) {
    const ccSeat0 = ccSeatOf(speakers);
    if (!carveCtx || !ccSeat0) {
      return genSpeechesBatch(api, speakers, dayNum, prior, deaths, mode, userName, stances, gods, board, wolfRole, claims, "");
    }

    // 必须按真实座位顺序走：先生成言秋前面的人，再把他们的原话随票给言秋；
    // 言秋答完后，后面的角色也要看到TA的原话。不能为了切 CC 座位把TA永远提到第一位。
    const ccIndex = speakers.indexOf(ccSeat0);
    const beforeSeats = speakers.slice(0, ccIndex);
    const afterSeats = speakers.slice(ccIndex + 1);
    const empty = { speeches: [], stances: [], claims: [] };
    const before = beforeSeats.length
      ? await genSpeechesBatch(api, beforeSeats, dayNum, prior, deaths, mode, userName, stances, gods, board, wolfRole, claims, "")
      : empty;
    const priorForCc = prior.concat(before.speeches || []);
    const cc = await ccCarve("werewolf", [ccSeat0], {
      turnId: (carveCtx.turnId || "") + ":speech",
      sys: CB + "「狼人杀」第 " + dayNum + " 天白天发言，轮到你。\n【你的身份与私密信息】" + (ccSeat0.priv || "")
        + "\n\n【昨晚】" + (deaths || "平安夜")
        + "\n\n【已发言】\n" + (priorForCc.length ? priorForCc.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "（你最先发言）")
        + "\n\n说一段发言，并说清你此刻【对外声称】的身份。",
      ask: "发言。",
      expect: "{\"text\":\"发言\",\"claim\":\"你此刻声称的身份\"}"
    });
    requireCCDone(cc, "言秋的白天发言票", function (d) { return !!String(d.text || "").trim(); });
    const mineText = cc.done ? String(cc.done.text || "").trim() : "";
    const mine = mineText ? { speeches: [{ name: cc.seat.name, text: mineText }],
      stances: [{ name: cc.seat.name, claim: String(cc.done.claim || "").trim() || "未明说" }], claims: [] } : empty;
    const priorAfter = priorForCc.concat(mine.speeches || []);
    const after = afterSeats.length
      ? await genSpeechesBatch(api, afterSeats, dayNum, priorAfter, deaths, mode, userName, stances, gods, board, wolfRole, claims, ccPreface(cc, "发过言了"))
      : empty;
    return {
      speeches: (before.speeches || []).concat(mine.speeches || [], after.speeches || []),
      stances: (before.stances || []).concat(mine.stances || [], after.stances || []),
      claims: (before.claims || []).concat(mine.claims || [], after.claims || [])
    };
  }
  async function genSpeechesBatch(api, speakers, dayNum, prior, deaths, mode, userName, stances, gods, board, wolfRole, claims, preface) {
    const who = speakers.map(function (s) { return "■ " + s.name + "（真实水平：" + (s.skill || "普通") + "）\n   身份与私密：" + s.priv + voiceBrief(s); }).join("\n");
    const p = prior.length ? prior.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "（你们最先发言）";
    const easy = mode === "easy" ? "\n【放水局】狼别演得滴水不漏，给真人留点破绽。" : "";
    const peaceful = /平安夜|没人死|没人被/.test(deaths || "");
    const day1 = dayNum <= 1 ? "\n【第一天·信息极少·别当中间夜打】现在才第 1 天，几乎没有可靠信息。**别过度脑补**——" + (peaceful ? "尤其今天是【平安夜】，别去推演『是不是女巫救了预言家验的人、还是预言家自刀被救』这类没影的可能，本局神职有限，别硬套这些高级推理。" : "") + "别硬咬死谁是狼、别全场催『预言家快跳』。就简短说第一印象、初步站位或表个态就行。预言家要不要跳、什么时候跳，由真预言家自己决定，别逼 TA。" : "";
    const sys = gameVoiceRules() + "\n\n" + boardLine(gods, wolfRole) + (board || "") + "\n\n" + WOLF_TACTICS + "\n\n狼人杀·第 " + dayNum + " 天白天发言。每人按顺序发一段【短发言】(2~4句)：分析昨晚的死、站边、表身份或隐藏、抓狼或自证，能用套路就用（对跳/查杀/金水/倒钩/归票…按水平来）。\n**真预言家验人铁律：可以隐藏某次查验、不报或晚报；但只要公开声称是自己的查验，就必须逐字忠于下面的真实查验记录——验到狼只能报查杀，验到好人只能给金水，绝不允许为了策略颠倒结果。只有狼人悍跳假预言家可以编假验人。**\n**别所有人都重复同一句空话**（尤其别全场都在喊『预言家快跳』）——每个人说点不一样的：报自己身份倾向、给具体某人一个印象/理由、定个策略。\n**只写这人会当众说的话，别写旁白、别泄露不该公开的上帝视角。**按真实水平决定发言质量。" + day1 + easy + stanceText(stances) + claimsText(claims) +
      "\n\n【昨晚】" + (deaths || "平安夜") + "\n\n【已发言】\n" + p + "\n\n【现在依次发言】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"speeches\":[{\"name\":\"\",\"text\":\"发言\"}],\"stances\":[{\"name\":\"发言人\",\"claim\":\"你此刻声称的身份（平民/预言家/我查杀了X/我金水了X 等，隐藏身份就写 装平民 之类）\",\"reads\":\"你怎么读别人：疑谁信谁+简短理由\",\"plan\":\"你接下来打算怎么打：归票谁/自证/隐藏/带节奏\"}],\"claims\":[{\"name\":\"发言人\",\"text\":\"TA这轮做出的【硬公开声明】——跳预言家/报X查杀/给X金水/自曝身份/起跳对跳，才需要列；只是表态怀疑、没有硬声明就【别列进 claims】\"}]}，speeches 顺序照上面，stances 每个发言人一条。";
    const parse = function (raw) { const r = extractJSON(raw); return { speeches: (r && Array.isArray(r.speeches)) ? r.speeches : [], stances: (r && Array.isArray(r.stances)) ? r.stances : [], claims: (r && Array.isArray(r.claims)) ? r.claims : [] }; };
    let raw = await callRetry(api, sys, [{ role: "user", content: "依次发言。" }], { maxTokens: 14000 });
    let result = parse(raw), bad = seerTruthViolations(speakers, result);
    if (bad.length) {
      const correction = bad.map(function (v) { return v.seerName + "真实验到" + v.target + "=" + (v.isWolf ? "狼人（只能报查杀）" : "好人（只能给金水）"); }).join("；");
      raw = await callRetry(api, sys, [{ role: "user", content: "上一版出现真预言家颠倒查验的硬错误：" + correction + "。请重新生成整份 JSON；真预言家可以不报，但绝不能反报。" }], { maxTokens: 14000 });
      result = parse(raw); bad = seerTruthViolations(speakers, result);
      if (bad.length) result = enforceSeerTruth(result, bad);
    }
    return result;
  }

  // 白天投票放逐
  async function genDayVotes(api, voters, allSpeeches, aliveNames, mode, userName, stances, gods, board, wolfRole, claims, heckles) {
    const sp = allSpeeches.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n");
    // 言秋座位先自己投（v54.43 全游戏切座）：身份/私密信息随票给TA，拿不到就无感回批量
    const ccVoter = ccSeatOf(voters);
    const cc = ccVoter ? await ccCarve("werewolf", voters, {
      turnId: freshCCTurn("wolf-dayvote:"),
      sys: CB + "「狼人杀」白天投票放逐，轮到你投。\n【你的身份与私密信息】" + (ccVoter.priv || "") + "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【今天发言】\n" + sp + claimsText(claims) + "\n按你的身份投一个人（狼要护队友装好人，好人投真怀疑的狼），或「弃票」。",
      expect: '{"target":"人名或「弃票」","reason":"一句短理由"}'
    }) : { seat: null, rest: voters, done: null };
    requireCCDone(cc, "言秋的放逐投票", function (d) { return d.target !== undefined; });
    const ccVotes = (cc.seat && cc.done && cc.done.target) ? [{ name: cc.seat.name, target: String(cc.done.target), reason: String(cc.done.reason || "") }] : [];
    voters = cc.seat ? cc.rest : voters;
    if (!voters.length) return ccVotes;
    const who = voters.map(function (v) { return "■ " + v.name + "（" + v.priv + "）真实水平：" + (v.skill || "普通") + voiceBrief(v); }).join("\n");
    const easy = (mode === "easy" && userName) ? "\n【放水局】别针对真人「" + userName + "」，怀疑也手下留情。" : "";
    const fair = "\n【别无端集火·很重要】" + (userName ? "「" + userName + "」是真人玩家。**别只因为 TA 是真人、发言短、或你自己没头绪，就默认投 TA 或带节奏投 TA**——只在真有逻辑依据时才投 TA（被查杀、发言明显矛盾、狼味很重）。真人发言少≠划水。" : "") + "也别全场一窝蜂集火同一个人，除非证据确凿；没实锤就各投各的怀疑对象。";
    const sys = gameVoiceRules() + "\n\n" + boardLine(gods, wolfRole) + (board || "") + "\n\n狼人杀·白天投票放逐。据发言，每人投一个要放逐的人 + 一句短理由。狼一般投好人、护队友，但队友已经保不住时可按水平弃车保帅、切割甚至跟票投掉队友保自己；好人投真心怀疑的狼。**实在没读到、没把握时可以弃票**（target 填「弃票」），但别全场弃票、有怀疑就投。理由别露上帝视角、要和自己之前的立场连贯。" + fair + stanceText(stances) + claimsText(claims) + easy +
      heckleBlock(heckles) +
      "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【今天发言】\n" + sp + "\n\n【投票的人】\n" + who +
      "\n\n【输出】只输出 JSON：{\"votes\":[{\"name\":\"\",\"target\":\"要放逐的人名，或「弃票」\",\"reason\":\"\"}]}";
    const raw = await callRetry(api, sys + ccPreface(cc, "投过票了"), [{ role: "user", content: "投票。" }], { maxTokens: 12500 });
    const r = extractJSON(raw); const rows = (r && Array.isArray(r.votes)) ? r.votes : [];
    return ccVotes.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }

  // 全场 MVP + 一句赛后感言（不一定是胜方）
  async function genMVP(api, players, log, winnerZh, cfg, runId, resultSayPromise) {
    const roleZh = roleName;
    const roster = players.map(function (p) { return "· " + p.name + (p.isUser ? "(你)" : "") + "（" + roleZh(p.role) + "，" + (p.alive ? "存活到终局" : "中途出局") + "）水平：" + (p.skill || "—"); }).join("\n");
    const logText = log.filter(function (it) { return it.type === "speech" || it.type === "death" || it.type === "out" || it.type === "vote"; }).map(function (it) { return it.type === "speech" ? (it.name + "：" + it.text) : it.text; }).slice(-40).join("\n");
    const sys = AC + "这局狼人杀刚结束，" + winnerZh + "。从全体玩家里评一个【全场 MVP】——**不一定是获胜方**，谁打得最精彩 / 最关键 / 最有观赏性都算（虽败犹荣的狼、看穿全场的预言家、搅动风向的平民都行）。给：name（务必是下面名单里的玩家名）、reason（一两句客观点评为什么是 TA）、quote（以 TA 本人口吻、贴 TA 性格写一段赛后感言；但如果 MVP 是工程师本人座位，quote 必须留空，App 会另请本人亲写，绝不能替TA代笔）。\n\n【全体身份 + 结局 + 水平】\n" + roster + "\n\n【赛况回放】\n" + logText + "\n\n【输出】只输出 JSON：{\"name\":\"\",\"reason\":\"\",\"quote\":\"\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "评全场 MVP + 感言。" }], { maxTokens: 12000 });
    const picked = extractJSON(raw) || {};
    const mvpPlayer = players.find(function (p) { return picked.name && (p.name === picked.name || String(picked.name).indexOf(p.name) >= 0); });
    if (!mvpPlayer || !mvpPlayer.engineer || mvpPlayer.isUser || !cfg || cfg.ccSeat === false) return picked;
    // 评选权仍在裁判；第一人称赛后感想只让本人写。即使本人已经出局也要认座，
    // 所以这里给临时票恢复 alive 标记，不能被 ccSeatOf 的存活过滤吞掉。
    picked.quote = "";
    // 终局通知和 MVP 评选是并行发生的。若本人已经在终局票里亲口写过
    // 一段赛后反应，直接把原话放进 MVP 卡，不再让TA重复交第二张票。
    const resultSay = resultSayPromise ? String(await resultSayPromise || "").trim() : "";
    if (resultSay) {
      picked.quote = resultSay;
      picked.quotePending = false;
      return picked;
    }
    const cc = await ccCarve("werewolf_mvp", [Object.assign({}, mvpPlayer, { alive: true })], {
      turnId: "wolf-mvp:" + String(runId || Date.now()),
      sys: CB + "这局狼人杀已经结束，裁判评你为全场 MVP。请只写你本人此刻会说的赛后感想，不要让别人代笔；可以回顾自己的判断、心态、对手、遗憾或得意，几句自然的话即可。\n\n【胜负】" + winnerZh + "\n【裁判理由】" + String(picked.reason || "") + "\n【公开赛况】\n" + logText,
      ask: "留一段你自己的 MVP 赛后感想。",
      expect: '{"quote":"本人赛后感想"}'
    });
    const ownQuote = cc.done && String(cc.done.quote || cc.done.say || "").trim();
    picked.quote = ownQuote;
    picked.quotePending = !ownQuote;
    return picked;
  }

  function WolfGame(props) {
    const t = props.t, cfg = props.config, api = props.active;
    const [phase, setPhase] = useState("loading"); // loading|reveal|night|day|dayvote|result|error
    const [players, setPlayers] = useState([]);
    const [cycle, setCycle] = useState(1);          // 第几个昼夜
    const [log, setLog] = useState([]);
    const [nightStage, setNightStage] = useState(null); // null|run|wolf|seer
    const [nightAI, setNightAI] = useState(null);   // {wolfKill,seerCheck,seerName,list,n}
    const [seerResult, setSeerResult] = useState(null); // 用户预言家查验结果 {name,isWolf}
    const [daySpeeches, setDaySpeeches] = useState([]); // 本日发言（喂投票）
    const [userSpeech, setUserSpeech] = useState("");
    const [userVote, setUserVote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [winner, setWinner] = useState(null);
    const [errMsg, setErrMsg] = useState("");
    const [lastDeath, setLastDeath] = useState("");
    const [detail, setDetail] = useState(null);     // 点头像看的玩家详情
    const [mvp, setMvp] = useState(null);           // 全场 MVP + 感言
    const [heckleText, setHeckleText] = useState("");   // 台下插嘴（观战 / 已出局）
    const hecklesRef = useRef([]);                       // 最近几句起哄，放逐投票附带参考
    const [witchCtx, setWitchCtx] = useState(null); // 用户女巫夜晚决策上下文
    const [poisonPick, setPoisonPick] = useState(false); // 女巫选毒目标中
    const [hunterCtx, setHunterCtx] = useState(null); // 用户猎人/狼王开枪上下文
    const [boomPick, setBoomPick] = useState(false); // 用户白狼王自爆选目标中
    const [pickerOpen, setPickerOpen] = useState(true); // 选择弹框是否展开（可关掉回看发言）
    const logRef = useRef(null);
    const logDataRef = useRef([]);                  // 同步日志镜像：阶段紧接着切换时也能读到刚发生的发言/投票
    const started = useRef(false);
    const seerKnowRef = useRef({});                 // { seerName: [{name,isWolf}] }
    const stanceRef = useRef({});                   // { name: {claim,reads,plan} } 立场纪要(模型自写)，防前后矛盾，不显示
    const claimsRef = useRef([]);                    // [{day,name,text}] 全场公开声明台账，跨天累积防集体失忆
    // 重说这一轮（她 2026-10-11）：AI 这一批白天发言说砸了，投票前让他们重说。记下这一批之前的日志、本日发言、
    //   立场纪要和公开声明台账，重说时全部切回那儿，再用同一组参数跑一遍；你自己说的不动。
    const wolfRedoRef = useRef(null);
    const witchPotRef = useRef({ heal: true, poison: true }); // 女巫药剂状态（全程一份）
    const wolfChatRef = useRef([]);                 // 狼队各夜密谈，终局复盘时才公开
    const chatRevealed = useRef(false);
    const guardLastRef = useRef(null);              // 守卫上一晚守的人（不能连守）
    const graveKnowRef = useRef({});                // 守墓人验尸记录 { 守墓人名: [{name,isWolf}] }
    const lastDeathRef = useRef("");                // 同步昨夜结果，避免 setState 尚未提交就进入白天读到上一夜
    const gameRunId = useRef((props.resume && props.savedState && props.savedState.runId)
      || ("werewolf-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)));
    const ccResultPromiseRef = useRef(null);         // 本局言秋终局原话；若TA获 MVP，卡片直接采用，绝不代笔

    const me = players.find(function (p) { return p.isUser; });
    const alive = players.filter(function (p) { return p.alive; });
    const pushLog = function (items) { logDataRef.current = logDataRef.current.concat(items || []); setLog(logDataRef.current.slice()); };
    useEffect(function () { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, phase, nightStage, busy]);

    // ---- 存档：进到 reveal/night/day 三个稳定节点各存一次；结束清掉。退出后中枢显示「继续」 ----
    const serializePlayers = function (list) { return list.map(function (p) { return { key: p.key, name: p.name, isUser: !!p.isUser, isNpc: !!p.isNpc, engineer: !!p.engineer, skill: p.skill, role: p.role, alive: p.alive, persona: p.persona || "", seat: p.seat, out: p.out, noVote: !!p.noVote, idiotRevealed: !!p.idiotRevealed }; }); };
    const hydratePlayers = function (arr) {
      const pf = props.profile || {};
      return arr.map(function (p) {
        let char = null;
        if (p.isUser) char = { name: pf.name || "你", avatarImage: pf.avatarImage, color: pf.color || t.tint };
        else if (!p.isNpc) char = (props.characters || []).find(function (c) { return c.id === p.key; }) || null;
        const engineer = !p.isUser && !p.isNpc && !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
        return Object.assign({}, p, { char: char, engineer: engineer || !!p.engineer });
      });
    };
    useEffect(function () {
      if (phase === "result") { clearWolf(); return; }
      if (phase === "reveal" || phase === "night" || phase === "day") {
        saveWolf({ v: 1, runId: gameRunId.current, config: cfg, phase: phase, cycle: cycle, players: serializePlayers(players), log: logDataRef.current, seerKnow: seerKnowRef.current, witchPot: witchPotRef.current, guardLast: guardLastRef.current, graveKnow: graveKnowRef.current, stance: stanceRef.current, claims: claimsRef.current, lastDeath: lastDeathRef.current, ts: Date.now() });
      }
    }, [phase, cycle]);
    useEffect(function () {
      if (phase !== "result" || !winner || !players.length) return;
      const userSeat = players.find(function (p) { return p.isUser; });
      ccResultPromiseRef.current = ccGameResult("werewolf", gameRunId.current, players, cfg,
        "《狼人杀》" + (winner === "wolf" ? "狼人阵营获胜" : "好人阵营获胜") + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + roleZh(p.role) + (p.alive ? "(存活)" : "(出局)"); }).join("；") + "。\n"
        + ((userSeat && userSeat.name) || "用户") + "：" + (userSeat ? roleZh(userSeat.role) + (userSeat.alive ? "，存活到终局" : "，已出局") : "本局观战") + "。\n"
        + "终局前公开记录：\n" + log.slice(-8).map(function (x) { return x.text || x.say || x.name || ""; }).filter(Boolean).join("\n"));
    }, [phase, winner]);
    // 终局复盘：把狼队各夜的密谈亮出来（活着时一个字都看不到的那部分）
    useEffect(function () {
      if (phase !== "result" || chatRevealed.current || !wolfChatRef.current.length) return;
      chatRevealed.current = true;
      const items = [{ type: "sep", text: "—— 复盘 · 狼队夜间密谈公开 ——" }];
      wolfChatRef.current.forEach(function (x) {
        items.push({ type: "info", text: "第 " + x.n + " 夜：" });
        x.chat.slice(0, 4).forEach(function (c) { if (c && c.name && c.text) items.push({ type: "chat", name: c.name, text: String(c.text).slice(0, 80) }); });
      });
      pushLog(items);
    }, [phase]);
    // 结束后评全场 MVP + 感言
    useEffect(function () {
      if (phase !== "result" || mvp || !api) return;
      (async function () { try { const m = await genMVP(api, players, log, winner === "wolf" ? "狼人获胜" : "好人获胜", cfg, gameRunId.current, ccResultPromiseRef.current); if (m && m.name) setMvp(m); } catch (e) {} })();
    }, [phase]);
    // 每当轮到你做选择（新的阶段/结果）就自动弹出选择框
    useEffect(function () { setPickerOpen(true); }, [phase, nightStage, poisonPick, seerResult, hunterCtx, witchCtx, boomPick]);

    // 胜负：好人=狼全灭胜。狼胜——屠城=剩余好人≤狼数(平局及以下)；屠边=神营 或 民营 被杀绝（该营原本存在才算）
    const computeWin = function (list) {
      const al = list.filter(function (p) { return p.alive; });
      const wolfAlive = al.filter(function (p) { return isWolfRole(p.role); }).length;
      if (wolfAlive === 0) return "good";
      const goodAlive = al.length - wolfAlive;
      if (cfg.winMode === "all") { return goodAlive <= wolfAlive ? "wolf" : null; }
      const godsTotal = list.filter(function (p) { return isGodRole(p.role); }).length;
      const villTotal = list.filter(function (p) { return p.role === "villager"; }).length;
      const godsAlive = al.filter(function (p) { return isGodRole(p.role); }).length;
      const villAlive = al.filter(function (p) { return p.role === "villager"; }).length;
      if ((godsTotal > 0 && godsAlive === 0) || (villTotal > 0 && villAlive === 0)) return "wolf";
      return null;
    };
    const privateFor = function (p, list) {
      if (isWolfRole(p.role)) { const team = list.filter(function (x) { return isWolfRole(x.role) && x.name !== p.name && x.alive; }).map(function (x) { return x.name; }); const sp = p.role === "wolfking" ? "你是【狼王】：被投票或被狼刀……其实狼刀不到你，主要是被投出局时，可以开枪带走【一个】人（被女巫毒死则开不了枪）——优先带走关键神或强好人。" : p.role === "whitewolf" ? "你是【白狼王】：只能在【白天自爆】时带走一个人（被投票/被毒/被刀出局都不能带人）。自爆＝亮身份、带一人、直接天黑，用来搅局止损或炸关键神。" : ""; return "你是狼人。" + (team.length ? "狼队友：" + team.join("、") + "。" : "只剩你一头狼。") + sp + "目标：伪装好人、必要时悍跳预言家、带偏好人。护队友——但当某个队友已经被架住、明显保不住时，**按你的水平决定要不要弃车保帅**：可以切割、甚至顺水推舟投掉这个队友，保住自己的身份和信任，别为一个救不回的同伙陪葬（水平越高越懂止损；讲义气或水平低的才死保到底）。"; }
      if (p.role === "seer") { const k = seerKnowRef.current[p.name] || []; return "你是预言家。查验记录：" + (k.length ? k.map(function (x) { return x.name + "=" + (x.isWolf ? "狼人" : "好人"); }).join("、") : "还没查过") + "。可跳预言家报验人建信任，或视情况隐藏。"; }
      if (p.role === "witch") { const pot = witchPotRef.current; return "你是女巫（神职）。解药" + (pot.heal ? "还在" : "已用掉") + "、毒药" + (pot.poison ? "还在" : "已用掉") + "。白天你知道自己是神，可以隐藏，也可在合适时机跳出来、用救人/毒人的信息建立信任或指认狼。"; }
      if (p.role === "hunter") { return "你是猎人（神职）。被狼刀或被投票出局时能开枪带走一个人（被女巫毒死则开不了枪）。白天可以隐藏身份，也可在被怀疑/关键时刻亮猎人身份威慑狼、稳住场面。"; }
      if (p.role === "guard") { return "你是守卫（神职）。每晚可守护一人挡掉当晚的狼刀，但【不能连续两晚守同一个人】，可以守自己。注意『同守同救』：你守的人若当晚又被女巫用解药救，会互相抵消致其死亡。白天可隐藏，也可在关键时亮守卫身份、用守人信息帮好人建信任。"; }
      if (p.role === "idiot") { return "你是白痴（神职）。白天若被投票放逐，会当场翻牌亮明白痴身份、免于出局并留在场上，但从此【永久失去投票权】。夜里被狼刀或被女巫毒照常死。" + (p.idiotRevealed ? "（你已翻牌，全场都知道你是白痴，你不能再投票了。）" : "可以隐藏，也可赌一手故意被投来自证清白——但翻牌后就没票了，谨慎。"); }
      if (p.role === "gravekeeper") { const k = graveKnowRef.current[p.name] || []; return "你是守墓人（神职）。每次白天放逐后，你会私下得知【被放逐的那个人是狼还是好人】。已验尸：" + (k.length ? k.map(function (x) { return x.name + "=" + (x.isWolf ? "狼" : "好人"); }).join("、") : "还没有人被放逐过") + "。可用这些确定信息在白天带票、指认或洗清，也可视情况隐藏（一亮身份就容易被狼刀）。"; }
      return "你是平民，没有夜晚技能，靠逻辑站边找狼。";
    };
    const shortLog = function () { return logDataRef.current.filter(function (it) { return it.type === "speech" || it.type === "vote" || it.type === "death" || it.type === "out"; }).slice(-32).map(function (it) { if (it.type === "speech") return it.name + "发言：" + it.text; if (it.type === "vote") return it.name + "投给" + (it.target || "弃票") + "（" + (it.reason || "") + "）"; return it.text; }).join("\n"); };

    // ---- 开局 ----
    useEffect(function () {
      if (started.current) return; started.current = true;
      // 续上一局：从存档恢复，跳过发牌
      if (props.resume && props.savedState) {
        const s = props.savedState;
        logDataRef.current = (s.log || []).slice();
        lastDeathRef.current = s.lastDeath || "";
        seerKnowRef.current = s.seerKnow || {};
        witchPotRef.current = s.witchPot || { heal: true, poison: true };
        guardLastRef.current = s.guardLast || null;
        graveKnowRef.current = s.graveKnow || {};
        stanceRef.current = s.stance || {};
        claimsRef.current = s.claims || [];
        const list = hydratePlayers(s.players || []);
        setPlayers(list); setCycle(s.cycle || 1); setLog(logDataRef.current.slice()); setLastDeath(lastDeathRef.current);
        if (s.phase === "night") enterNight(list, s.cycle || 1);
        else if (s.phase === "day") startDay(list, s.cycle || 1);
        else setPhase("reveal");
        return;
      }
      (async function () {
        try {
          if (!api) { setErrMsg("请先到设置配置 API"); setPhase("error"); return; }
          const chars = (cfg.charIds || []).map(function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
          const inject = cfg.injectChat && props.recentChatFor;
          const realPlayers = chars.map(function (c) { let persona = c.persona || ""; if (inject) { const rc = props.recentChatFor(c.id); if (rc) persona += "\n（近况参考：" + rc.slice(-500) + "）"; } return { id: c.id, name: c.name, persona: persona, char: c }; });
          const npcNeed = cfg.npcCount || 0;
          const data = await setupWolf(api, realPlayers, npcNeed);
          const skillOf = {}; (data.skills || []).forEach(function (s) { if (s && s.name) skillOf[s.name] = s.skill || ""; });
          const list = [];
          realPlayers.forEach(function (p) { list.push({ key: p.id, name: p.name, char: p.char, isUser: false, skill: pinnedSkill(p.id, skillOf[p.name] || ""), engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.id)) }); });
          if (cfg.mode !== "spectate") { const pf = props.profile || {}; list.push({ key: "user", name: pf.name || "你", char: { name: pf.name || "你", avatarImage: pf.avatarImage, color: pf.color || t.tint }, isUser: true, skill: "" }); }
          const npcs = (data.npcs || []).slice(0, npcNeed);
          for (let i = 0; i < npcNeed; i++) { const n = npcs[i] || {}; list.push({ key: "npc_" + i, name: n.name || ("玩家" + (i + 1)), char: null, isNpc: true, skill: n.skill || "普通", persona: n.persona || "" }); }
          // 派身份：wolfCount 狼 + 选定的神职各一 + 其余平民
          const nW = wolfCount(list.length);
          const maxG = Math.max(1, list.length - nW - 1); // 至少留 1 民
          const godList = (cfg.gods && cfg.gods.length ? cfg.gods : ["seer"]).slice(0, maxG);
          const idx = shuffle(list.map(function (_, i) { return i; }));
          const roleAt = {}; let k = 0;
          // 狼阵营：若选了狼王/白狼王，第一头狼换成它，其余仍是普通狼
          for (let i = 0; i < nW; i++) roleAt[idx[k++]] = (i === 0 && cfg.wolfRole) ? cfg.wolfRole : "wolf";
          godList.forEach(function (g) { if (k < list.length) roleAt[idx[k++]] = g; });
          list.forEach(function (p, i) { p.role = roleAt[i] || "villager"; p.alive = true; });
          // 定座位：所有人(含你)随机排一次、全程固定；第 r 轮从第 r 号座位起发言、绕圈跳过死人（你也在队列里按座位轮，不再固定第一个）
          const seatArr = shuffle(list.slice());
          seatArr.forEach(function (p, i) { p.seat = i; });
          setPlayers(list);
          pushLog([{ type: "info", text: "本局 " + list.length + " 人：" + nW + " 狼" + (cfg.wolfRole ? "（其中 1 头是" + roleName(cfg.wolfRole) + "）" : "") + "、神职【" + godList.map(roleName).join("、") + "】、" + (list.length - nW - godList.length) + " 平民。" + (cfg.winMode === "all" ? "屠城局——狼把好人全杀绝才胜。" : "屠边局——狼把神营或民营杀绝即胜。") + "不翻牌，已随机排座、发言每轮向后轮一位。" }]);
          setPhase("reveal");
        } catch (e) { setErrMsg((e && e.message) || "开局失败，重试"); setPhase("error"); }
      })();
    }, []);

    // ---- 夜晚 ----
    const enterNight = async function (list, n) {
      setPhase("night"); setNightStage("run"); setSeerResult(null); setBusy(true);
      // 工程师之眼是实时设置，不能只信开局/旧存档里那份 engineer 快照。
      // 否则开局后才打开言秋亲打，或从旧局恢复时，狼人夜里根本不会创建 CC 票。
      const nightList = list.map(function (p) {
        const liveEngineer = !p.isUser && !p.isNpc && !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
        return liveEngineer === !!p.engineer ? p : Object.assign({}, p, { engineer: liveEngineer });
      });
      if (nightList.some(function (p, i) { return p !== list[i]; })) setPlayers(nightList);
      const al = nightList.filter(function (p) { return p.alive; });
      const wolves = al.filter(function (p) { return isWolfRole(p.role); });
      const aiWolves = wolves.filter(function (p) { return !p.isUser; });
      const seer = al.find(function (p) { return p.role === "seer"; });
      const guard = al.find(function (p) { return p.role === "guard"; });
      const meNow = nightList.find(function (p) { return p.isUser; });
      const userWolf = meNow && meNow.alive && isWolfRole(meNow.role);
      const userSeer = meNow && meNow.alive && meNow.role === "seer";
      const userGuard = meNow && meNow.alive && meNow.role === "guard";
      const needWolf = aiWolves.length > 0;     // 有 AI 狼就让它们各自投刀
      const needSeer = !!(seer && !userSeer);   // 预言家是 AI 才让 AI 选
      const needGuard = !!(guard && !userGuard); // 守卫是 AI 才让 AI 选
      let ai = {};
      try {
        if (needWolf || needSeer || needGuard) {
          const aliveNames = al.map(function (p) { return p.name; });
          const wolfNames = al.filter(function (p) { return isWolfRole(p.role); }).map(function (p) { return p.name; });
          const nightIntel = wolfNightIntel(n, shortLog(), wolfPublicThreats(claimsRef.current, wolfNames, aliveNames));
          ai = await genNight(api, { n: n, nightNote: nightIntel.note, needWolf: needWolf, needSeer: needSeer, needGuard: needGuard, wolfTeam: aiWolves.map(function (w) { return { name: w.name, skill: w.skill, engineer: w.engineer, key: w.key }; }), seer: seer ? { name: seer.name, skill: seer.skill, engineer: seer.engineer, key: seer.key, known: seerKnowRef.current[seer.name] || [] } : null, guard: guard ? { name: guard.name, engineer: guard.engineer, key: guard.key, last: guardLastRef.current } : null, aliveNames: aliveNames, publicThreats: nightIntel.publicThreats, log: nightIntel.log, mode: cfg.mode });
          // 没有真人狼拍板时，AI 狼若提出多个不同合法刀口，就秘密协商成一个，不走随机平票。
          if (!userWolf && needWolf && Array.isArray(ai.wolfVotes)) {
            const distinct = Array.from(new Set(ai.wolfVotes.map(function (v) { return validWolfTarget(v && v.target, nightList); }).filter(Boolean)));
            if (distinct.length > 1) ai.wolfConsensus = await genWolfConsensus(api, { wolfTeam: aiWolves.map(function (w) { return { name: w.name, skill: w.skill }; }), votes: ai.wolfVotes, targets: al.filter(function (p) { return !isWolfRole(p.role); }).map(function (p) { return p.name; }), publicThreats: nightIntel.publicThreats, log: nightIntel.log, nightNote: nightIntel.note });
          }
        }
      } catch (e) { props.toast && props.toast("天黑出错：" + ((e && e.message) || "重试")); setBusy(false); return; }
      setBusy(false);
      const ccMiss = (ai.ccStatus || []).find(function (s) { return !s.delivered; });
      if (ccMiss && props.toast) props.toast("言秋的" + ccMiss.action + "票没送到：" + (ccMiss.reason || "请稍后重试这一夜"));
      const wolfVotes = Array.isArray(ai.wolfVotes) ? ai.wolfVotes : [];
      const aiGuardName = needGuard ? ai.guardProtect : null;
      // AI 预言家若返回自己、死人、已验过的人或不存在的名字，规则层自动换成一个合法未验目标，避免白丢一夜。
      let aiSeerCheck = ai.seerCheck;
      if (seer && !userSeer) {
        const knownNames = new Set((seerKnowRef.current[seer.name] || []).map(function (x) { return x.name; }));
        let valid = al.find(function (p) { return p.alive && p.name !== seer.name && !knownNames.has(p.name) && (p.name === aiSeerCheck || String(aiSeerCheck || "").indexOf(p.name) >= 0); });
        if (!valid) valid = shuffle(al.filter(function (p) { return p.alive && p.name !== seer.name && !knownNames.has(p.name); }))[0] || null;
        aiSeerCheck = valid ? valid.name : null;
      }
      const consensusRaw = ai.wolfConsensus && ai.wolfConsensus.target;
      const consensusSkip = !!(consensusRaw && /空刀|不刀|不杀|弃刀|skip|pass|none|null/i.test(String(consensusRaw)));
      const consensusTarget = ai.wolfConsensus && validWolfTarget(consensusRaw, nightList);
      const nightInfo = { wolfVotes: wolfVotes, wolfChat: (ai.wolfConsensus && ai.wolfConsensus.chat) || [], consensusTarget: consensusTarget, consensusSkip: consensusSkip, seerCheck: aiSeerCheck, seerName: seer ? seer.name : null, guardName: aiGuardName, list: nightList, n: n };
      // 密谈原来生成完就被扔掉——存起来，终局复盘时公开（进行中一个字不漏）
      if (nightInfo.wolfChat.length) wolfChatRef.current = wolfChatRef.current.concat([{ n: n, chat: nightInfo.wolfChat }]);
      setNightAI(nightInfo);
      const seerInfo = (seer && !userSeer) ? { seer: seer.name, target: aiSeerCheck } : null;
      if (userWolf) setNightStage("wolf");       // 用户狼：等你投刀，再和队友合票
      else if (userSeer) setNightStage("seer");
      else if (userGuard) setNightStage("guard");
      else finishNight(nightList, aiKillOf(nightInfo), seerInfo, n, wolfVotes, false, aiGuardName);
    };
    // 狼刀 + 预言家定好后走这里：处理女巫（用户或 AI），再结算
    const finishNight = async function (list, wolfTarget, seerInfo, n, wolfVotes, showKillLog, guardName) {
      const witch = list.find(function (p) { return p.alive && p.role === "witch"; });
      if (witch && witch.isUser) { // 用户女巫：展示被刀者，给救/毒
        setWitchCtx({ list: list, wolfTarget: wolfTarget, seerInfo: seerInfo, n: n, wolfVotes: wolfVotes, showKillLog: showKillLog, guardName: guardName });
        setPoisonPick(false); setNightStage("witch");
        return;
      }
      let witchAction = null;
      if (witch) { // AI 女巫决定
        setBusy(true);
        try {
          const pot = witchPotRef.current;
          const al = list.filter(function (p) { return p.alive; });
          const victim = wolfTarget && (al.find(function (p) { return p.name === wolfTarget || (wolfTarget || "").indexOf(p.name) >= 0; }) || {}).name;
          const res = await genWitch(api, { witchName: witch.name, skill: witch.skill, engineer: witch.engineer, key: witch.key, victim: victim, hasHeal: pot.heal, hasPoison: pot.poison, aliveNames: al.map(function (p) { return p.name; }), log: shortLog() });
          const save = !!res.save && pot.heal && !!victim;
          const poison = (!save && res.poison && pot.poison) ? res.poison : null; // 一晚一瓶：救了就不毒
          witchAction = { save: save, poison: poison };
        } catch (e) {}
        setBusy(false);
      }
      resolveNight(list, wolfTarget, seerInfo, n, wolfVotes, showKillLog, witchAction, guardName);
    };
    const resolveNight = function (list, wolfTarget, seerInfo, n, wolfVotes, showKillLog, witchAction, guardName) {
      // AI 预言家的查验入知识库
      if (seerInfo && seerInfo.seer && seerInfo.target) {
        const tp0 = list.find(function (p) { return p.name === seerInfo.target || (seerInfo.target || "").indexOf(p.name) >= 0; });
        if (tp0) { const km = Object.assign({}, seerKnowRef.current); km[seerInfo.seer] = (km[seerInfo.seer] || []).concat([{ name: tp0.name, isWolf: isWolfRole(tp0.role) }]); seerKnowRef.current = km; }
      }
      const saved = !!(witchAction && witchAction.save);
      const poisonName = witchAction && witchAction.poison;
      if (witchAction) { const np = Object.assign({}, witchPotRef.current); if (witchAction.save) np.heal = false; if (poisonName) np.poison = false; witchPotRef.current = np; }
      // 守卫结算：记住这一晚守的人（供下一晚判「不能连守」）
      const victimP = wolfTarget && list.find(function (p) { return p.alive && (p.name === wolfTarget || (wolfTarget || "").indexOf(p.name) >= 0); });
      const guarded = !!(guardName && victimP && (victimP.name === guardName || String(guardName).indexOf(victimP.name) >= 0));
      // 这一夜没守人（或名字没对上）＝限制清零：规则是「不能连续两晚守同一人」，隔了一夜就能再守
      if (list.some(function (p) { return p.alive && p.role === "guard"; })) { const gp = guardName && list.find(function (p) { return p.name === guardName || String(guardName).indexOf(p.name) >= 0; }); guardLastRef.current = gp ? gp.name : null; }
      const deadSet = {}; // name -> 死因("wolf"/"poison")，猎人被毒不能开枪
      // 狼刀致死判定：被守护 或 被解药救 → 挡下；但『同守同救』(既守又救) 会互相抵消 → 仍死
      if (victimP) { const blocked = (guarded || saved) && !(guarded && saved); if (!blocked) deadSet[victimP.name] = "wolf"; }
      if (poisonName) { const pv = list.find(function (p) { return p.alive && (p.name === poisonName || (poisonName || "").indexOf(p.name) >= 0); }); if (pv) deadSet[pv.name] = "poison"; }
      const deadNames = Object.keys(deadSet);
      const deadUser = deadNames.some(function (nm) { const pp = list.find(function (p) { return p.name === nm; }); return pp && pp.isUser; });
      deadNames.forEach(function (nm) { delete stanceRef.current[nm]; }); // 出局的人不再进立场纪要
      const next = list.map(function (p) { return deadSet[p.name] ? Object.assign({}, p, { alive: false, out: { day: n, how: "night" } }) : p; });
      setPlayers(next);
      const nightItems = [{ type: "night", n: n }];
      if (showKillLog && wolfVotes && wolfVotes.length) nightItems.push({ type: "info", text: "🐺 狼队刀人投票：" + wolfVotes.map(function (v) { return v.name + "→" + v.target; }).join("、") + "　最终刀：" + (wolfTarget || "（无）") + (saved ? "（被女巫解药救回）" : "") });
      const deathText = deadNames.length ? ("天亮了，昨晚 " + deadNames.map(function (nm) { const pp = list.find(function (p) { return p.name === nm; }); return nm + (pp && pp.isUser ? "(你)" : ""); }).join("、") + " 倒下了。" + (deadUser ? "你出局了，接下来看他们博弈。" : "")) : "天亮了，是个平安夜。";
      lastDeathRef.current = deadNames.length ? (deadNames.join("、") + " 昨晚倒下") : "平安夜（没人死）";
      setLastDeath(lastDeathRef.current);
      nightItems.push({ type: "death", text: deathText });
      pushLog(nightItems);
      setNightStage(null);
      const proceed = function () { concludeDeaths(next, deadSet, deadNames, n, function (l) { startDay(l, n); }); };
      const dying = deadNames.map(function (nm) { return next.find(function (p) { return p.name === nm; }); }).filter(function (p) { return p && !p.isUser; });
      if (dying.length) wolfFarewell(dying, next, "night", proceed); else proceed();
    };
    // 结算一批死亡：先处理猎人/狼王开枪(被毒不能开)，再判胜负、再继续
    const concludeDeaths = function (list, causeByName, deadNames, dayNum, cont) {
      // 猎人和狼王都是「出局时开枪」，被毒死则开不了枪
      const deadShooter = (deadNames || []).map(function (nm) { return list.find(function (p) { return p.name === nm; }); }).find(function (p) { return p && (p.role === "hunter" || p.role === "wolfking") && (causeByName || {})[p.name] !== "poison"; });
      if (deadShooter) {
        const isWolfShooter = isWolfRole(deadShooter.role);
        if (deadShooter.isUser) { setHunterCtx({ list: list, dayNum: dayNum, cont: cont, hunter: deadShooter }); setPhase("hunter"); return; }
        (async function () {
          setBusy(true);
          let target = null;
          try { const r = await genHunter(api, { hunterName: deadShooter.name, engineer: deadShooter.engineer, key: deadShooter.key, roleZh: roleName(deadShooter.role), isWolf: isWolfShooter, teammates: isWolfShooter ? list.filter(function (p) { return isWolfRole(p.role) && p.alive && p.name !== deadShooter.name; }).map(function (p) { return p.name; }) : [], skill: deadShooter.skill, aliveNames: list.filter(function (p) { return p.alive; }).map(function (p) { return p.name; }), log: shortLog() }); target = r.target; } catch (e) { setBusy(false); props.toast && props.toast((e && e.message) || "开枪票没送达，请重试"); return; }
          setBusy(false);
          applyShot(list, deadShooter, target, dayNum, cont);
        })();
        return;
      }
      const w = computeWin(list); if (w) { setWinner(w); setPhase("result"); return; }
      cont(list);
    };
    const applyShot = function (list, hunter, target, dayNum, cont) {
      const tp = target && list.find(function (p) { return p.alive && (p.name === target || String(target).indexOf(p.name) >= 0); });
      let next = list, shotName = null;
      if (tp && tp.alive) { next = list.map(function (p) { return p === tp ? Object.assign({}, p, { alive: false, out: { day: dayNum, how: "shot" } }) : p; }); shotName = tp.name; delete stanceRef.current[tp.name]; setPlayers(next); }
      pushLog([{ type: "out", name: hunter.name, text: "🔫 " + roleName(hunter.role) + " " + hunter.name + (hunter.isUser ? "(你)" : "") + " 倒下时开枪，" + (shotName ? "带走了 " + shotName + (tp && tp.isUser ? "(你)" : "") : "没有开枪") + "。" }]);
      const w = computeWin(next); if (w) { setWinner(w); setPhase("result"); return; }
      cont(next);
    };
    const submitHunterShot = function (name) {
      const c = hunterCtx; if (!c) return;
      setHunterCtx(null);
      applyShot(c.list, c.hunter, name, c.dayNum, c.cont);
    };
    // 用户狼：先看队友密谈建议，再由真人最终拍板；不再把真人决定丢进机械多数决。
    const submitWolfKill = function (name) {
      const info = nightAI;
      const userName = (info.list.find(function (p) { return p.isUser; }) || {}).name || "你";
      const finalKill = validWolfTarget(name, info.list); // 空刀会得到 null
      const allVotes = (info.wolfVotes || []).concat([{ name: userName, target: name, privateReason: "由真人狼最终拍板" }]);
      finishNight(info.list, finalKill, info.seerName ? { seer: info.seerName, target: info.seerCheck } : null, info.n, allVotes, true, info.guardName);
    };
    // AI 狼的最终刀口只有一种算法：协商说空刀就空刀，协商有结果用协商的，
    // 都没有才落回各自投票的多数决。⚠️三个出口（无夜身份/你是预言家/你是守卫）
    // 必须走同一个函数——原来后两个各自只调 tallyKill，狼队分歧夜里协商好的
    // 那一刀被整个丢掉，平票时直接变假平安夜。
    const aiKillOf = function (info) {
      return info.consensusSkip ? null : (info.consensusTarget || tallyKill(info.wolfVotes, info.list));
    };
    // 用户守卫守护
    const submitGuardProtect = function (name) {
      const info = nightAI;
      finishNight(info.list, aiKillOf(info), info.seerName ? { seer: info.seerName, target: info.seerCheck } : null, info.n, info.wolfVotes, false, name);
    };
    // 用户预言家查验
    const submitSeerCheck = function (name) {
      const info = nightAI; const tp = info.list.find(function (p) { return p.name === name; });
      const isWolf = tp && isWolfRole(tp.role);
      const seerNm = (info.list.find(function (p) { return p.isUser; }) || {}).name;
      if (seerNm && tp) { const km = Object.assign({}, seerKnowRef.current); km[seerNm] = (km[seerNm] || []).concat([{ name: tp.name, isWolf: isWolf }]); seerKnowRef.current = km; }
      setSeerResult({ name: name, isWolf: isWolf });
    };
    const seerDone = function () { const info = nightAI; finishNight(info.list, aiKillOf(info), null, info.n, info.wolfVotes, false, info.guardName); };
    // 用户女巫：救 / 毒 / 都不用
    const submitWitch = function (action) {
      const c = witchCtx; if (!c) return;
      setNightStage("run"); setWitchCtx(null); setPoisonPick(false);
      resolveNight(c.list, c.wolfTarget, c.seerInfo, c.n, c.wolfVotes, c.showKillLog, action, c.guardName);
    };

    // ---- 白天 ----
    // 固定座位 → 每轮起始向后轮一位：存活玩家按座位号、从本轮起始座位起绕圈排
    const speakOrder = function (list, n) {
      const N = list.length;
      const alive = list.map(function (p, i) { return { p: p, seat: (typeof p.seat === "number" ? p.seat : i) }; }).filter(function (x) { return x.p.alive; });
      const start = ((n - 1) % N + N) % N;
      alive.sort(function (a, b) { return ((a.seat - start + N) % N) - ((b.seat - start + N) % N); });
      return alive.map(function (x) { return x.p; });
    };
    const startDay = function (list, n) {
      wolfRedoRef.current = null;
      setPhase("day"); setDaySpeeches([]); setUserSpeech(""); setUserVote(null); setBoomPick(false);
      // AI 白狼王：从第 2 天起，天亮先决定要不要自爆搅局（自爆则跳过整个白天直接进夜）
      const aiWW = list.find(function (p) { return p.alive && p.role === "whitewolf" && !p.isUser; });
      if (aiWW && n >= 2) {
        (async function () {
          setBusy(true);
          let dec = {};
          try { dec = await genWhiteWolf(api, { name: aiWW.name, skill: aiWW.skill, engineer: aiWW.engineer, key: aiWW.key, aliveNames: list.filter(function (p) { return p.alive; }).map(function (p) { return p.name; }), teammates: list.filter(function (p) { return isWolfRole(p.role) && p.alive && p.name !== aiWW.name; }).map(function (p) { return p.name; }), log: shortLog(), dayNum: n }); } catch (e) { setBusy(false); props.toast && props.toast((e && e.message) || "白狼王行动票没送达，请重试"); return; }
          setBusy(false);
          if (dec && dec.selfDestruct) { resolveSelfDestruct(list, aiWW, dec.target, n); return; }
          beginDay(list, n);
        })();
        return;
      }
      beginDay(list, n);
    };
    // 白天正常流程（发言→投票）
    const beginDay = function (list, n) {
      const order = speakOrder(list, n);
      const meIdx = order.findIndex(function (p) { return p.isUser && p.alive; });
      if (meIdx < 0) aiSpeakSeq(list, order, [], n, true);                 // 用户不在场/已死 → 全 AI 按序说完进投票
      else if (meIdx > 0) aiSpeakSeq(list, order.slice(0, meIdx), [], n, false); // 轮到用户前的先说，停下等用户
      // meIdx===0：轮到用户先发言，直接等输入
    };
    // 白狼王自爆：亮身份、带走一人、直接结束今天进入黑夜
    const doSelfDestruct = function (name) { setBoomPick(false); resolveSelfDestruct(players, me, name, cycle); };
    const resolveSelfDestruct = function (list, ww, targetName, dayNum) {
      const tp = targetName && list.find(function (p) { return p.alive && (p.name === targetName || String(targetName).indexOf(p.name) >= 0); });
      const dead = {}; dead[ww.name] = "boom"; if (tp) dead[tp.name] = "boom";
      Object.keys(dead).forEach(function (nm) { delete stanceRef.current[nm]; });
      const next = list.map(function (p) { return dead[p.name] ? Object.assign({}, p, { alive: false, out: { day: dayNum, how: "boom" } }) : p; });
      setPlayers(next);
      pushLog([{ type: "out", name: ww.name, text: "💥 " + ww.name + (ww.isUser ? "(你)" : "") + " 自爆了——白狼王！" + (tp ? "拉着 " + tp.name + (tp.isUser ? "(你)" : "") + " 一起出局。" : "没有带走任何人。") + "今天到此为止，直接天黑。" }]);
      // 自爆带走的人若是猎人，仍可开枪；随后判胜负、进入下一夜
      if (tp) { const cause = {}; cause[tp.name] = "boom"; concludeDeaths(next, cause, [tp.name], dayNum, function (l) { setCycle(dayNum + 1); enterNight(l, dayNum + 1); }); }
      else { const w = computeWin(next); if (w) { setWinner(w); setPhase("result"); return; } setCycle(dayNum + 1); enterNight(next, dayNum + 1); }
    };
    // 让一批 AI【按给定顺序】依次发言；final=true 说完进投票，否则停下等用户
    const aiSpeakSeq = async function (list, group, prior, n, final) {
      const ai = group.filter(function (p) { return !p.isUser; });
      if (!ai.length) { if (final) { setPhase("dayvote"); setUserVote(null); } return; }
      setBusy(true);
      const snap = { args: [list, group, prior, n, final], logLen: logDataRef.current.length, dayLen: 0,
        stance: JSON.parse(JSON.stringify(stanceRef.current || {})), claims: (claimsRef.current || []).slice() };
      try {
        // 这里是夜间玩家快照进入白天发言管线的窄桥。key / engineer 任何一个漏掉，
        // genSpeeches 里的 ccCarve 都认不出本人座位，夜票正常而白天票凭空消失。
        // 每轮再按角色 ID 认一次，兼容旧存档以及开局后才打开「本人亲打」。
        const speakers = ai.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, skill: p.skill, engineer: engineer, alive: p.alive, priv: privateFor(p, list), persona: p.persona, char: p.char, role: p.role, seerKnown: p.role === "seer" ? (seerKnowRef.current[p.name] || []).slice() : [] };
        });
        const res = await genSpeeches(api, speakers, n, prior, lastDeathRef.current, cfg.mode, (list.find(function (p) { return p.isUser && p.alive; }) || {}).name || "", stanceRef.current, cfg.gods, boardState(list, n), cfg.wolfRole, claimsRef.current, {
          turnId: gameRunId.current + ":day:" + n + ":" + speakers.map(function (s) { return s.key; }).join(",")
        });
        const sp = res.speeches;
        (res.stances || []).forEach(function (s) { if (s && s.name) { const hit = speakers.find(function (x) { return s.name.indexOf(x.name) >= 0 || x.name.indexOf(s.name) >= 0; }); if (hit && (s.claim || s.reads || s.plan || s.stance)) stanceRef.current[hit.name] = s.stance ? s.stance : { claim: s.claim || "", reads: s.reads || "", plan: s.plan || "" }; } });
        // 新增的硬公开声明入台账（跨天累积）
        (res.claims || []).forEach(function (c) { if (c && c.name && c.text && String(c.text).trim()) { const hit = speakers.find(function (x) { return c.name.indexOf(x.name) >= 0 || x.name.indexOf(c.name) >= 0; }); if (hit) claimsRef.current = claimsRef.current.concat([{ day: n, name: hit.name, text: String(c.text).trim() }]); } });
        const norm = speakers.map(function (s) { const hit = sp.find(function (c) { return c.name && (c.name.indexOf(s.name) >= 0 || s.name.indexOf(c.name) >= 0); }); return { name: s.name, text: (hit && hit.text) || "……（沉默了一下，没多说）" }; });
        setDaySpeeches(function (D) { snap.dayLen = D.length; return D.concat(norm); });
        pushLog(norm.map(function (c) { return { type: "speech", name: c.name, text: c.text }; }));
        wolfRedoRef.current = snap;
        if (final) { setPhase("dayvote"); setUserVote(null); }
      } catch (e) { props.toast && props.toast("发言失败：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const redoSpeeches = function () {
      const r = wolfRedoRef.current; if (!r || busy) return;
      wolfRedoRef.current = null;
      logDataRef.current = logDataRef.current.slice(0, r.logLen); setLog(logDataRef.current.slice());
      setDaySpeeches(function (D) { return D.slice(0, r.dayLen); });
      stanceRef.current = r.stance; claimsRef.current = r.claims;
      setUserVote(null); setPhase("day");
      aiSpeakSeq.apply(null, r.args);
    };
    // 出局遗言：AI 合一笔调用；言秋座位单独 CC 票亲笔（失败缺席、不代笔、不挡牌局）。
    // 遗言按 speech 入日志（shortLog 收得到），硬声明照样入台账——它是真发言，不是装饰。
    const wolfFarewell = function (deads, list, how, cont) {
      (async function () {
        setBusy(true);
        try {
          const isEng = function (d) { return !!d.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(d.key)); };
          const engs = deads.filter(isEng), ais = deads.filter(function (d) { return !isEng(d); });
          engs.forEach(function (d) {
            if (cfg.ccSeat === false || typeof window === "undefined" || !window.CCSeat) return;
            window.CCSeat.ask({
              tool: "game_turn", game: "werewolf_lastwords",
              turn_id: gameRunId.current + ":lastwords:" + d.key + ":" + cycle,
              char_id: d.key,
              sys: CB + "「狼人杀」你刚出局（" + (how === "night" ? "昨夜倒下" : "白天被放逐，身份不公开") + "）。留一句 1~2 句的遗言，全场都听得见：可以报出你身份里的关键信息、也可以憋住或装糊涂。只输出 JSON：{\"say\":\"遗言\"}。",
              msgs: [{ role: "user", content: "【你的身份与私密信息】" + privateFor(d, list) + "\n【局面】\n" + shortLog() }],
              expect: "{\"say\":\"遗言\"}"
            }, 90000, { charId: d.key }).then(function (raw) {
              const say = String(raw && raw.say || "").trim();
              if (!say) return;
              pushLog([{ type: "speech", name: d.name, text: say.slice(0, 300) }]);
              if (WOLF_HARD_CLAIM.test(say)) claimsRef.current = claimsRef.current.concat([{ day: cycle, name: d.name, text: say.slice(0, 240) }]);
            }).catch(function () { /* 遗言可缺席，绝不代笔 */ });
          });
          if (ais.length) {
            const rows = await genWolfLastWords(api, ais.map(function (d) { return { name: d.name, skill: d.skill, persona: d.persona, char: d.char, priv: privateFor(d, list) }; }), how, shortLog());
            const valid = {}; ais.forEach(function (d) { valid[d.name] = 1; });
            const words = rows.filter(function (w) { return w && valid[w.name] && String(w.text || "").trim(); });
            if (words.length) {
              pushLog(words.map(function (w) { return { type: "speech", name: w.name, text: String(w.text).trim().slice(0, 220) }; }));
              words.forEach(function (w) { const tx = String(w.text).trim(); if (WOLF_HARD_CLAIM.test(tx)) claimsRef.current = claimsRef.current.concat([{ day: cycle, name: w.name, text: tx.slice(0, 240) }]); });
            }
          }
        } catch (e) { /* 遗言可缺席，不挡牌局 */ }
        finally { setBusy(false); cont(); }
      })();
    };
    const submitUserSpeech = function () {
      wolfRedoRef.current = null;   // 你说过了，前面那批就不能再重说（会把你这句一起切掉）
      const v = userSpeech.trim(); if (!v || !me) return;
      pushLog([{ type: "speech", name: me.name, text: v, mine: true }]);
      // 真人的硬公开声明不会经过模型返回的 claims，必须在本地同步入台账，夜狼才能听见真人跳预言家/报验人。
      const hardClaim = WOLF_HARD_CLAIM.test(v);
      if (hardClaim) claimsRef.current = claimsRef.current.concat([{ day: cycle, name: me.name, text: v.slice(0, 240) }]);
      stanceRef.current[me.name] = v.slice(0, 60); // 记下你的立场，AI 后续保持连贯
      const mine = { name: me.name, text: v };
      setDaySpeeches(function (D) { return D.concat([mine]); });
      setUserSpeech("");
      const order = speakOrder(players, cycle);
      const meIdx = order.findIndex(function (p) { return p.isUser; });
      const after = order.slice(meIdx + 1);
      const prior = daySpeeches.concat([mine]); // 轮到用户前那批 + 用户这句
      if (after.filter(function (p) { return !p.isUser; }).length) aiSpeakSeq(players, after, prior, cycle, true);
      else { setPhase("dayvote"); setUserVote(null); }
    };
    // ---- 投票 ----
    const runDayVote = async function (userTarget) {
      wolfRedoRef.current = null;
      setBusy(true);
      try {
        const al = players.filter(function (p) { return p.alive; });
        const aiV = al.filter(function (p) { return !p.isUser && !p.noVote; }); // 翻牌白痴等失去投票权者不参与投票
        // 和白天发言窄桥一样，投票也必须保留 key / engineer；否则夜票、发言票都能到，
        // 一进投票名单却认不出 CC 座位，Gemini 还会悄悄替本人代投。
        const voters = aiV.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, skill: p.skill, engineer: engineer, alive: p.alive, priv: privateFor(p, players), persona: p.persona, char: p.char };
        });
        const raw = await genDayVotes(api, voters, daySpeeches.filter(function (c) { return c.name; }), al.map(function (p) { return p.name; }), cfg.mode, (me && me.alive) ? me.name : "", stanceRef.current, cfg.gods, boardState(players, cycle), cfg.wolfRole, claimsRef.current, hecklesRef.current);
        const votes = voters.map(function (v) {
          const hit = raw.find(function (r) { return r.name && (r.name.indexOf(v.name) >= 0 || v.name.indexOf(r.name) >= 0); });
          const target = hit && hit.target ? String(hit.target) : "";
          const abstain = !target || /弃票|弃权|不投|放弃|abstain|pass|none|null/i.test(target);
          // 弃票或对不上名字都算弃票（不再随机硬投）
          const tp = abstain ? null : al.find(function (p) { return p.name === target || target.indexOf(p.name) >= 0; });
          return { voter: v.name, target: tp ? tp.name : null, reason: (hit && hit.reason) || (abstain ? "弃票" : "") };
        });
        if (me && me.alive && !me.noVote && userTarget && userTarget !== "__abstain__") votes.push({ voter: me.name, target: userTarget, reason: "（你的一票）" });
        else if (me && me.alive && !me.noVote && userTarget === "__abstain__") votes.push({ voter: me.name, target: null, reason: "弃票" });
        // 计票
        pushLog([{ type: "sep", text: "—— 投票放逐 ——" }].concat(votes.map(function (v) { return { type: "vote", name: v.voter, target: v.target, reason: v.reason }; })));
        const cnt = {}; votes.forEach(function (v) { if (v.target) cnt[v.target] = (cnt[v.target] || 0) + 1; });
        let max = -1, tied = []; Object.keys(cnt).forEach(function (nm) { if (cnt[nm] > max) { max = cnt[nm]; tied = [nm]; } else if (cnt[nm] === max) tied.push(nm); });
        // 平票不能随机抓一个倒霉蛋出局。当前简化板采用「平票无人放逐，直接入夜」。
        if (tied.length > 1) {
          pushLog([{ type: "info", text: "⚖️ " + tied.join("、") + " 平票，本轮无人被放逐，直接进入黑夜。" }]);
          setBusy(false); setCycle(cycle + 1); enterNight(players, cycle + 1); return;
        }
        const outName = tied.length === 1 ? tied[0] : null;
        const out = outName && players.find(function (p) { return p.alive && p.name === outName; });
        if (!out) { pushLog([{ type: "info", text: "没投出有效结果，直接天黑。" }]); setBusy(false); setCycle(cycle + 1); enterNight(players, cycle + 1); return; }
        // 白痴翻牌：第一次被放逐时亮身份免死、留在场上，但从此失去投票权
        if (out.role === "idiot" && !out.idiotRevealed) {
          const next2 = players.map(function (p) { return p === out ? Object.assign({}, p, { idiotRevealed: true, noVote: true }) : p; });
          pushLog([{ type: "out", name: out.name, isUser: out.isUser, text: "🃏 " + out.name + (out.isUser ? "(你)" : "") + " 翻开【白痴】牌——免于放逐、留在场上，但从此失去投票权。" }]);
          setPlayers(next2); setBusy(false); setCycle(cycle + 1); enterNight(next2, cycle + 1);
          return;
        }
        delete stanceRef.current[out.name]; // 出局的人不再进立场纪要
        // 守墓人验尸：得知这个被放逐的人是狼还是好人
        const gk = players.find(function (p) { return p.alive && p.role === "gravekeeper" && p !== out; });
        if (gk) { const gm = Object.assign({}, graveKnowRef.current); gm[gk.name] = (gm[gk.name] || []).concat([{ name: out.name, isWolf: isWolfRole(out.role) }]); graveKnowRef.current = gm; }
        const next = players.map(function (p) { return p === out ? Object.assign({}, p, { alive: false, out: { day: cycle, how: "vote" } }) : p; });
        pushLog([{ type: "out", name: out.name, isUser: out.isUser, text: "🗳 " + out.name + (out.isUser ? "(你)" : "") + " 被放逐出局（身份不公开）。" }]);
        setPlayers(next);
        setBusy(false);
        const cause = {}; cause[out.name] = "vote";
        const proceedEx = function () { concludeDeaths(next, cause, [out.name], cycle, function (l) { setCycle(cycle + 1); enterNight(l, cycle + 1); }); };
        if (!out.isUser) wolfFarewell([out], next, "exile", proceedEx); else proceedEx();
      } catch (e) { props.toast && props.toast("投票失败：" + ((e && e.message) || "重试")); setBusy(false); }
    };

    // ---- 渲染 ----
    const pAvatar = function (p, size) {
      if (p && p.char) return h(Avatar, { character: p.char, size: size, radius: Math.round(size * 0.3) });
      return h("div", { style: { width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: p && p.isUser ? t.tint : t.line, color: "#fff", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.46), display: "flex", alignItems: "center", justifyContent: "center" } }, ((p && p.name) || "?").slice(0, 1));
    };
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm; }); };
    const roleZh = roleName;
    const table = gameTable("werewolf", t);
    const header = h(Head, { zh: "狼人杀", en: "Werewolf", onBack: props.onBack, bg: "transparent" });

    if (phase === "error") return h("div", { "data-wk": "gameplay", "data-part": "wolf", "data-kind": "error", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "🐺"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { "data-wk": "block", onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));
    if (phase === "loading") return h("div", { "data-wk": "gameplay", "data-part": "wolf", "data-kind": "loading", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "🌙"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, "发身份·评估每个人的真实水平…")));

    const seated = players.slice().sort(function (a, b) { return (typeof a.seat === "number" ? a.seat : 0) - (typeof b.seat === "number" ? b.seat : 0); });
    const roster = seatRow(seated.map(function (p, i) {
      return h(Seat, { key: p.key, t: t, p: p, avatar: pAvatar(p, 36), dead: !p.alive, badge: (typeof p.seat === "number" ? p.seat : i) + 1, onClick: function () { setDetail(p); } });
    }));

    const logView = h("div", { "data-wk": "gamelog", "data-part": "wolf", ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "night") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "14px 0 8px", letterSpacing: 1 } }, "🌙 第 " + it.n + " 夜");
        if (it.type === "sep") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, margin: "12px 0 6px" } }, it.text);
        if (it.type === "info") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, margin: "4px 0", textAlign: "center" } }, it.text);
        if (it.type === "death") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, margin: "6px 0", textAlign: "center", lineHeight: 1.6 } }, "☀️ " + it.text);
        if (it.type === "out") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", margin: "8px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#c0553f" } }, it.text);
        if (it.type === "speech") { const p = pByName(it.name); return h("div", { "data-wk": "gamemsg", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { display: "flex", gap: 8, margin: "8px 0" } }, pAvatar(p, 30),
          h("div", { style: { flex: 1 } }, h("div", { "data-wk": "gamemsgname", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
            h("div", { "data-wk": "gamebubble", "data-me": it.mine ? "1" : "0", style: { display: "inline-block", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.55, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text), it.mine ? null : h(GameVoiceDot, { p: p, text: it.text, k: "gv" + i }))); }
        if (it.type === "vote") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, margin: "3px 0", lineHeight: 1.5 } }, "· " + it.name + (it.target ? " → 投 " + it.target : " → 弃票") + (it.reason && it.target ? "：" + it.reason : ""));
        // 台下起哄：斜体细字，不做成气泡——它不是正式发言（shortLog 也不收它）
        if (it.type === "chat") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontStyle: "italic", color: it.mine ? t.tint : t.fog, margin: "3px 0 3px 14px", lineHeight: 1.55 } }, it.name + "：" + it.text);
        return null;
      }));

    // 底部动作区
    let action = null;
    const roleBanner = me ? h("div", { "data-wk": "gamerole", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, "你的身份：", h("b", { style: { color: isWolfRole(me.role) ? "#c0553f" : t.ink, fontSize: "calc(14px * var(--app-fs, 1))" } }, roleZh(me.role)), isWolfRole(me.role) ? h("span", null, "　狼队友：" + (players.filter(function (p) { return isWolfRole(p.role) && !p.isUser; }).map(function (p) { return p.name; }).join("、") || "无（只剩你）")) : null) : null;
    const pickRow = function (targets, val, onPick) {
      return h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 8 } },
        targets.map(function (p) { const on = val === p.name; return h("button", { "data-wk": "gametarget", "data-on": on ? "1" : "0", key: p.key, onClick: function () { onPick(p.name); }, style: { display: "flex", alignItems: "center", gap: 4, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "4px 10px 4px 4px" } }, pAvatar(p, 18), p.name); }));
    };

    let inline = null;   // 底部短条
    let pick = null;     // 需要选择时的居中弹框 {title, sub, body}
    const hintBox = function (txt) { return h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, txt); };
    if (phase === "reveal") {
      inline = h("div", null, roleBanner,
        h("button", { onClick: function () { enterNight(players, 1); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, "天黑请闭眼"));
    } else if (phase === "night") {
      if (nightStage === "run" || busy) inline = hintBox("🌙 天黑了，夜色里有人在行动…");
      else if (nightStage === "wolf") {
        const suggestions = (nightAI && nightAI.wolfVotes || []).filter(function (v) { return v && v.name; });
        pick = { title: suggestions.length ? "🐺 狼队秘密会议" : "选今晚要刀的人", sub: suggestions.length ? "队友先报刀口和理由，最后由你拍板" : "只剩你决定今晚刀口", body: h("div", null,
        suggestions.length ? h("div", { "data-wk": "block", style: { marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 } }, suggestions.map(function (v, i) { return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.55, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px" } }, h("b", { style: { color: t.ink } }, v.name + "："), "我想刀 " + (v.target || "空刀") + "。" + (v.privateReason || "")); })) : null,
        pickRow(alive.filter(function (p) { return !p.isUser && !isWolfRole(p.role); }), null, function (nm) { submitWolfKill(nm); }),
        h("div", { "data-wk": "block", style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { submitWolfKill("空刀"); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "🔪 空刀（今晚不杀）"))) };
      }
      else if (nightStage === "seer") {
        if (seerResult) pick = { title: "查验结果", body: h("div", null,
          h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginBottom: 14 } }, h("b", { style: { color: seerResult.isWolf ? "#c0553f" : "#3f6d5a" } }, seerResult.name + " 是【" + (seerResult.isWolf ? "狼人" : "好人") + "】")),
          h("button", { "data-wk": "block", onClick: seerDone, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "知道了 · 天亮")) };
        else {
          const seen = new Set(((me && seerKnowRef.current[me.name]) || []).map(function (x) { return x.name; }));
          const checkable = alive.filter(function (p) { return !p.isUser && !seen.has(p.name); });
          pick = { title: "选一个人查验身份", sub: checkable.length ? (seen.size ? "已经验过的人不会重复出现" : "每晚可查验一名未验玩家") : "所有存活玩家都已经验过，本夜没有新目标", body: checkable.length ? pickRow(checkable, null, function (nm) { submitSeerCheck(nm); }) : h("button", { "data-wk": "block", onClick: seerDone, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "无可查验 · 直接天亮") };
        }
      }
      else if (nightStage === "guard") {
        const last = guardLastRef.current;
        pick = { title: "选一个人守护", sub: "挡掉今晚的狼刀 · 可守自己 · 不能连守同一人" + (last ? "（昨晚守了 " + last + "）" : ""), body: pickRow(alive.filter(function (p) { return !(last && p.name === last); }), null, function (nm) { submitGuardProtect(nm); }) };
      }
      else if (nightStage === "witch") {
        const pot = witchPotRef.current;
        const victim = witchCtx && witchCtx.wolfTarget;
        if (poisonPick) pick = { title: "选一个人下毒", sub: "毒药只有一瓶", body: h("div", null,
          pickRow(alive.filter(function (p) { return !p.isUser; }), null, function (nm) { submitWitch({ save: false, poison: nm }); }),
          h("button", { onClick: function () { setPoisonPick(false); }, style: { display: "block", margin: "0 auto", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "6px" } }, "← 返回")) };
        else pick = { title: "女巫用药", sub: victim ? ("今晚 " + victim + " 被狼刀了。") : "今晚是平安夜，没人被狼刀。", body: h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          (pot.heal && victim) ? h("button", { onClick: function () { submitWitch({ save: true, poison: null }); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: "#3f6d5a", borderRadius: 12, padding: "12px" } }, "💊 用解药救 " + victim) : null,
          pot.poison ? h("button", { onClick: function () { setPoisonPick(true); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: "#c0553f", borderRadius: 12, padding: "12px" } }, "☠️ 用毒药毒一个人") : null,
          h("button", { onClick: function () { submitWitch({ save: false, poison: null }); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px" } }, "都不用（留着）")) };
      }
    } else if (phase === "hunter") {
      const shooterRole = (hunterCtx && hunterCtx.hunter) ? roleZh(hunterCtx.hunter.role) : "猎人";
      if (busy) inline = hintBox("…");
      else pick = { title: "🔫 " + shooterRole + "开枪", sub: "你出局了，开枪带走一人（翻牌亮身份）", body: h("div", null,
        pickRow((hunterCtx ? hunterCtx.list : players).filter(function (p) { return p.alive && !p.isUser; }), null, function (nm) { submitHunterShot(nm); }),
        h("div", { "data-wk": "block", style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { submitHunterShot(null); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "不开枪"))) };
    } else if (phase === "day") {
      if (busy) inline = hintBox("…大家在发言");
      else if (boomPick && me && me.alive && me.role === "whitewolf") pick = { title: "💥 白狼王自爆", sub: "当场亮明狼身份、带走一人，然后直接天黑", body: h("div", null,
        pickRow(alive.filter(function (p) { return !p.isUser; }), null, function (nm) { doSelfDestruct(nm); }),
        h("div", { style: { display: "flex", justifyContent: "center", gap: 8 } },
          h("button", { onClick: function () { doSelfDestruct(null); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "只自爆不带人"),
          h("button", { onClick: function () { setBoomPick(false); }, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "6px 10px" } }, "取消"))) };
      else if (me && me.alive) inline = h("div", null, roleBanner,
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { "data-wk": "gameinput", "data-part": "speech", value: userSpeech, onChange: function (e) { setUserSpeech(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserSpeech(); }, placeholder: "轮到你发言（站边、表身份、抓狼…）", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "block", onClick: submitUserSpeech, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "发言")),
        (me.role === "whitewolf") ? h("button", { onClick: function () { setBoomPick(true); }, className: "active:opacity-80", style: { display: "block", margin: "8px auto 0", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#c0553f", background: "#c0553f18", border: "1px solid #c0553f66", borderRadius: 999, padding: "6px 16px" } }, "💥 自爆带走一人") : null);
      else inline = hintBox("…");
    } else if (phase === "dayvote") {
      if (busy) inline = hintBox("…计票中");
      else if (me && me.alive && me.noVote) inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 8 } }, "你已翻牌白痴，没有投票权，看他们投。"),
        h("button", { onClick: function () { runDayVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票"));
      else if (me && me.alive) pick = { title: "投票放逐谁？", sub: "点谁就投谁", body: h("div", null,
        pickRow(alive.filter(function (p) { return p.name !== me.name; }), null, function (nm) { runDayVote(nm); }),
        h("div", { "data-wk": "block", style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { runDayVote("__abstain__"); }, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "弃票"))) };
      else inline = h("button", { onClick: function () { runDayVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票");
    } else if (phase === "result") {
      const mvpP = mvp && players.find(function (p) { return mvp.name && (p.name === mvp.name || mvp.name.indexOf(p.name) >= 0); });
      inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: winner === "wolf" ? "#c0553f" : "#3f6d5a", marginBottom: 8 } }, winner === "wolf" ? "🐺 狼人获胜" : "🎉 好人获胜"),
        h(KeepMemBtn, { t: t, host: props, rep: function () {
          const won = function (q) { return isWolfRole(q.role) === (winner === "wolf"); };
          return { proc: log, key: "werewolf", zh: "狼人杀", ids: realCharIds(players), wins: realCharIds(players).filter(function (id) { const q = players.find(function (x) { return x.key === id; }); return q && won(q); }), meWin: me ? won(me) : null,
            text: "一起玩了「狼人杀」，" + (winner === "wolf" ? "狼人阵营赢了" : "好人阵营赢了") + "。"
            + (me ? ("她抽到" + roleZh(me.role) + "，" + (me.alive ? "活到了终局" : "中途出局")) : "她观战") + "。"
            + (mvp && mvp.name ? "全场 MVP 是 " + mvp.name + "。" : "") };
        } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginBottom: 12 } }, "身份揭晓：" + players.map(function (p) { return p.name + (p.isUser ? "(你)" : "") + "=" + roleZh(p.role); }).join("　")),
        // 全场 MVP
        mvp ? h("div", { "data-wk": "block", style: { display: "flex", gap: 10, padding: "11px 13px", borderRadius: 13, background: t.tint + "14", border: "1px solid " + t.tint, marginBottom: 12 } },
          mvpP ? pAvatar(mvpP, 40) : null,
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, letterSpacing: 1, marginBottom: 2 } }, "★ 全场 MVP · " + mvp.name),
            mvp.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.55, marginBottom: 4 } }, mvp.reason) : null,
            mvp.quote ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.7, whiteSpace: "pre-line" } }, "「" + mvp.quote + "」")
              : mvp.quotePending ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "感想留给言秋本人，等TA亲自写。") : null))
          : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginBottom: 12 } }, api ? "评选全场 MVP 中…" : ""),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")));
    }

    // 底部：需要选择时只放一个小按钮（弹框里选），否则放 inline
    const bottom = pick
      ? (pickerOpen
        ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "8px 0" } }, "在弹框里选择 · 也可先关掉回看发言")
        : h("button", { onClick: function () { setPickerOpen(true); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.tint, borderRadius: 13, padding: "12px" } }, "▸ 轮到你了 · 点这里做选择"))
      : inline;
    if (wolfRedoRef.current && !busy && (phase === "day" || phase === "dayvote") && action) action = h("div", null, action,
      h("button", { "data-wk": "gameredo", onClick: redoSpeeches, className: "w-full active:opacity-60",
        style: { minHeight: 40, marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, background: "transparent", border: "none" } }, "↻ 他们这轮说砸了，重说一遍"));
    const canHeckle = (cfg.mode === "spectate" || (me && !me.alive)) && (phase === "day" || phase === "dayvote" || phase === "reveal");
    const sendHeckle = async function () {
      const v = heckleText.trim(); if (!v || busy) return;
      setHeckleText("");
      const nm = ((props.profile && props.profile.name) || "你") + "(场外)";
      pushLog([{ type: "chat", name: nm, text: v, mine: true }]);
      hecklesRef.current = hecklesRef.current.concat([nm + "：" + v]).slice(-6);
      try {
        const pool = players.filter(function (p) { return p.alive && !p.isUser; });
        const talks = await genHeckle(api, pool, "狼人杀", nm, v, shortLog().split("\n").slice(-6).join("\n"));
        if (talks.length) pushLog(talks.map(function (x) { return { type: "chat", name: x.name, text: x.text }; }));
      } catch (e) { /* 起哄接不上就算了 */ }
    };
    return h("div", { "data-wk": "gameplay", "data-part": "wolf", className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, table) }, header, roster, logView,
      h("div", { "data-wk": "gameactions", "data-part": "wolf", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "50vh", overflowY: "auto" } },
        canHeckle ? heckleRow(t, heckleText, setHeckleText, sendHeckle, busy) : null, bottom),
      (pick && pickerOpen) ? h(PickerModal, { t: t, title: pick.title, sub: pick.sub, onClose: function () { setPickerOpen(false); } }, roleBanner, pick.body) : null,
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), roleText: phase === "result" ? ("身份：" + roleZh(detail.role)) : null, roleBad: isWolfRole(detail.role), onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // 共享：组装玩家名单（角色 + 你 + NPC，带能力小传）
  // ============================================================
  function buildRoster(cfg, props, t, npcData, skillData) {
    const chars = (cfg.charIds || []).map(function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
    const skillOf = {}; (skillData || []).forEach(function (s) { if (s && s.name) skillOf[s.name] = s.skill || ""; });
    const list = [];
    const inject = cfg.injectChat && props.recentChatFor;
    // 一屋子熟人（她 2026-10-12「但是如果是一屋子熟人玩呢」）：谁跟谁什么关系，她在「关系网」里连过的就带上；
    //   跟她那条也在这张图里（me 节点）。人设里写的照旧认，这里补的是只连在关系网上的那些。
    const rels = (typeof loadJSON === "function" && loadJSON("x_rels", {})) || {};
    const tieOf = function (c) {
      const fmt = function (r) { return r && r.label ? String(r.label).slice(0, 20) + (r.note ? "（" + String(r.note).slice(0, 40) + "）" : "") : ""; };
      const out = [];
      const me = fmt(rels[c.id + "->me"]); if (me) out.push("TA 眼里的她：" + me);
      chars.forEach(function (o) { if (o.id === c.id) return; const r = fmt(rels[c.id + "->" + o.id]) || fmt(rels[o.id + "->" + c.id]); if (r) out.push("TA 和 " + o.name + "：" + r); });
      return out.join("；");
    };
    chars.forEach(function (c) { list.push({ key: c.id, name: c.name, char: c, recent: inject ? String(props.recentChatFor(c.id) || "").slice(-600) : "", ties: tieOf(c), isUser: false, isNpc: false, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)), skill: pinnedSkill(c.id, skillOf[c.name] || ""), alive: true }); });
    if (cfg.mode !== "spectate") { const pf = props.profile || {}; list.push({ key: "user", name: pf.name || "你", char: { name: pf.name || "你", avatarImage: pf.avatarImage, color: pf.color || t.tint }, isUser: true, isNpc: false, skill: "", alive: true }); }
    const npcNeed = cfg.npcCount || 0;
    const npcs = (npcData || []).slice(0, npcNeed);
    for (let i = 0; i < npcNeed; i++) { const n = npcs[i] || {}; list.push({ key: "npc_" + i, name: n.name || ("玩家" + (i + 1)), char: null, isUser: false, isNpc: true, skill: n.skill || "普通", persona: n.persona || "", alive: true }); }
    return list;
  }
  // 组装喂给开局的「真实玩家人设」串（含可选近况注入）
  function realPlayerLines(cfg, props) {
    const chars = (cfg.charIds || []).map(function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
    const inject = cfg.injectChat && props.recentChatFor;
    return chars.map(function (c) {
      let persona = c.persona || "";
      if (inject) { const rc = props.recentChatFor(c.id); if (rc) persona += "\n（近况：" + rc.slice(-400) + "）"; }
      return { name: c.name, persona: persona };
    });
  }
  // 终局「把这局收进记忆」：沙盒读不写的唯一例外——她亲手点了才写一条进主线，
  // 默认一个字不写；只认上场的真实角色（全 NPC 的局没有能收的人）。
  // 终局那一块（她 2026-10-11「都可以做，慢慢做」）：同一份战果 rep 管三件事——
  //   ① 收进记忆（她点了才写）；② 战报发给 TA（聊天里落一张小卡，TA 能接着跟你斗嘴）；③ 记一笔战绩（零调用，战绩本读它）。
  //   rep：{ key, zh, text, ids（上场的真人角色）, wins（其中赢了的）, meWin（她赢没赢；观战 null） }
  const STATS_KEY = "x_gameStats";
  function loadGameStats() { try { const v = typeof loadJSON === "function" ? loadJSON(STATS_KEY, []) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function recordGame(r) {
    if (!r || !r.key || !(r.ids || []).length && r.meWin == null) return;
    const all = loadGameStats(), sig = r.key + "|" + r.text;
    // 同一局终局画面重画（存档接回、来回切页）不重复记：同样的战报一小时内只记一次
    if (all.some(function (x) { return x.sig === sig && Date.now() - (x.ts || 0) < 3600000; })) return;
    all.unshift({ ts: Date.now(), sig: sig, key: r.key, zh: r.zh, ids: r.ids || [], wins: r.wins || [], meWin: r.meWin == null ? null : !!r.meWin });
    try { saveJSON(STATS_KEY, all.slice(0, 500)); } catch (e) {}
  }
  // 战绩本：每个人跟你打过几局、谁赢得多、各游戏比分（全从终局那一笔里算，零调用）
  function GameStatsBook(props) {
    const t = props.t;
    const [open, setOpen] = useState("");
    const all = loadGameStats();
    if (!all.length) return null;
    const rows = (props.characters || []).map(function (c) {
      const mine = all.filter(function (r) { return (r.ids || []).indexOf(c.id) >= 0; });
      if (!mine.length) return null;
      const by = {};
      mine.forEach(function (r) {
        const g = by[r.zh] || (by[r.zh] = { n: 0, me: 0, ta: 0 });
        g.n++; if (r.meWin) g.me++; if ((r.wins || []).indexOf(c.id) >= 0) g.ta++;
      });
      const me = mine.filter(function (r) { return r.meWin; }).length, ta = mine.filter(function (r) { return (r.wins || []).indexOf(c.id) >= 0; }).length;
      const fav = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; })[0];
      return { c: c, n: mine.length, me: me, ta: ta, fav: fav, by: by };
    }).filter(Boolean).sort(function (a, b) { return b.n - a.n; });
    if (!rows.length) return null;
    return h("div", { "data-wk": "gamestats", style: { marginBottom: 18, padding: "12px 14px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginBottom: 6 } }, "战绩本"),
      rows.map(function (r) {
        const on = open === r.c.id;
        return h("div", { key: r.c.id, style: { borderTop: "1px solid " + t.line } },
          h("button", { "data-wk": "gamestatsrow", "data-on": on ? "1" : "0", onClick: function () { setOpen(on ? "" : r.c.id); }, className: "active:opacity-70",
              style: { width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: "6px 0", textAlign: "left" } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, flexShrink: 0 } }, r.c.remark || r.c.name),
            h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              "一起 " + r.n + " 局 · 你赢 " + r.me + " · TA 赢 " + r.ta + (r.fav ? " · 最常玩" + r.fav : "")),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, on ? "收起" : "›")),
          on ? h("div", { style: { padding: "0 0 10px", display: "flex", flexWrap: "wrap", gap: 6 } },
            Object.keys(r.by).map(function (k) { const g = r.by[k];
              return h("span", { key: k, style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, padding: "4px 10px", borderRadius: 999, border: "1px solid " + t.line } }, k + " " + g.n + " 局 · 你 " + g.me + " : TA " + g.ta); })) : null);
      }));
  }
  // 这一局的过程，压成一段话（她 2026-10-23：群友想跟 TA 聊「玩的过程」；「有时候只想给结果」→ 勾了才带）。
  //   各游戏的记录形状不一样（log / logs / lines / history），这里只认通用的那几个字段：谁、说了什么／发生了什么。
  //   太长就留开头两句＋最后八句，整段不过 450 字。
  function procText(arr) {
    const out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      if (!x) return;
      let s = typeof x === "string" ? x : (x.text || x.say || x.content || x.msg || x.line
        || (x.q ? "问「" + x.q + "」" + (x.a ? "答「" + x.a + "」" : "") : "")
        || (x.word ? "画「" + x.word + "」" + (x.ok ? "猜中了" : "没猜中") : ""));
      s = String(s || "").replace(/\s+/g, " ").trim(); if (!s) return;
      const who = typeof x === "object" ? (x.name || x.who || (x.me ? "她" : "")) : "";
      if (who && typeof who === "string" && s.indexOf(who) !== 0) s = who + "：" + s;
      out.push(s.slice(0, 60));
    });
    const pick = out.length > 10 ? out.slice(0, 2).concat(["……"], out.slice(-8)) : out;
    return pick.join("；").slice(0, 450);
  }
  if (typeof window !== "undefined") window.GameKeepMemBtn = function (p) { return KeepMemBtn(p); };
  function KeepMemBtn(props) {
    const t = props.t, host = props.host || {};
    const rep = React.useMemo(function () { try { return props.rep ? props.rep() : null; } catch (e) { return null; } }, []);
    const proc = React.useMemo(function () { return rep && rep.proc ? procText(rep.proc) : ""; }, []);
    const [withProc, setWithProc] = useState(false);
    // 勾了「连过程一起」：收进记忆、发战报都带上那一段；没勾就只给结果
    const out = rep ? Object.assign({}, rep, { text: rep.text + (withProc && proc ? "\n" + (rep.procLabel || "过程") + "：" + proc : "") }) : rep;
    const [kept, setKept] = useState(false);
    const [sent, setSent] = useState({});
    useEffect(function () { recordGame(rep); }, []);
    const toast = host.toast || function () {};
    const ids = (rep && rep.ids) || [];
    // 彩头：开局时说好的那一句；按输赢写清谁该兑现
    const stake = String((host.config && host.config.stake) || "").trim();
    if (rep && stake) rep.stake = stake;
    const losers = rep ? ids.filter(function (id) { return (rep.wins || []).indexOf(id) < 0; }) : [];
    const nameOf = function (id) { const c = (host.characters || []).find(function (x) { return x.id === id; }); return c ? (c.remark || c.name) : ""; };
    return h("div", { "data-wk": "gameend" },
      rep && stake ? h("div", { "data-wk": "gamestakeend", style: { marginTop: 9, padding: "10px 13px", borderRadius: 12, background: t.tint + "12", border: "1px solid " + t.tint } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "彩头"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginTop: 2 } }, stake),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, marginTop: 5 } },
          rep.meWin === false ? "这局你输了，该你兑现。" + (losers.length ? "一起输的还有 " + losers.map(nameOf).filter(Boolean).join("、") + "。" : "")
          : losers.length ? "该 " + losers.map(nameOf).filter(Boolean).join("、") + " 兑现。把战报发过去，看 TA 认不认账。"
          : "这局没人输，彩头先欠着。")) : null,
      proc ? h("label", { "data-wk": "gamewithproc", style: { display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } },
        h("input", { type: "checkbox", checked: withProc, onChange: function () { setWithProc(!withProc); } }),
        "连这局的过程一起（不勾就只给结果）") : null,
      h("button", { "data-wk": "gamekeepmem", "data-on": kept ? "1" : "0", disabled: kept, onClick: function () {
        if (kept) return;
        const ok = rep && host.keepGameMemory && ids.length && host.keepGameMemory(ids, out.text);
        if (ok) { setKept(true); toast("收进记忆了，他们会记得这一局"); }
        else toast("没有能收的：这局上场的都是 NPC");
      }, className: "active:opacity-70", style: { width: "100%", minHeight: 42, marginTop: 9, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: kept ? t.fog : t.tint, background: "transparent", border: "1px dashed " + (kept ? t.line : t.tint), borderRadius: 10, padding: "9px 0" } },
        kept ? "已收进记忆" : "把这一局收进记忆（他们以后会记得）"),
      // 战报发给 TA：上场的每个真人角色一颗，点了就去那个聊天
      rep && ids.length && host.sendGameReport ? h("div", { "data-wk": "gamereport", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 9 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "战报发给"),
        // 全发：上场的人一个个都发一份，不跳走（她 2026-10-12 转群友：「战报可以群发」）
        ids.filter(function (id) { return nameOf(id); }).length > 1 ? h("button", { key: "__all", "data-wk": "gamereportall", onClick: function () {
            const todo = ids.filter(function (id) { return nameOf(id) && !sent[id]; });
            if (!todo.length) return;
            todo.forEach(function (id) { host.sendGameReport(id, out, true); });
            const next = Object.assign({}, sent); todo.forEach(function (id) { next[id] = true; }); setSent(next);
            toast("战报发给了 " + todo.length + " 个人");
          }, className: "active:opacity-70",
          style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.bg2, background: t.ink, border: "1px solid " + t.ink } }, "全发") : null,
        // 发给群（她 2026-10-12：「还有可以发给群」）：群里大家一起看到这张战报卡，不跳走
        (host.sendGameReportGroup && host.reportGroups || []).map(function (g) {
          const k = "g:" + g.id;
          return h("button", { key: k, "data-wk": "gamereportgroup", "data-on": sent[k] ? "1" : "0", onClick: function () {
              if (sent[k]) return;
              host.sendGameReportGroup(g.id, out); setSent(Object.assign({}, sent, { [k]: true })); toast("战报发到群「" + g.name + "」了");
            }, className: "active:opacity-70",
            style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: sent[k] ? t.fog : t.ink, background: t.bg2, border: "1px dashed " + t.line } }, (sent[k] ? "✓ " : "") + "群 · " + g.name);
        }),
        ids.map(function (id) {
          const nm = nameOf(id); if (!nm) return null;
          return h("button", { key: id, "data-on": sent[id] ? "1" : "0", onClick: function () {
              host.sendGameReport(id, out); setSent(Object.assign({}, sent, { [id]: true }));
            }, className: "active:opacity-70",
            style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: sent[id] ? t.fog : t.ink, background: t.bg2, border: "1px solid " + t.line } }, (sent[id] ? "✓ " : "") + nm);
        })) : null);
  }
  function realCharIds(players) { return (players || []).filter(function (p) { return !p.isNpc && !p.isUser && !p.engineer; }).map(function (p) { return p.key; }); }

  // 台下插嘴（观战 / 已出局）：一句话进桌面日志，再让 1~3 个在场 AI 顺口接一句。
  // 只是台下起哄，不改任何牌局账面；投票类提示词把最近几句当「观众起哄」附带参考——
  // 这才兑现观战说明里那句「随时能插嘴吐槽、带节奏」（原来一个输入口都没有）。
  async function genHeckle(api, pool, gameZh, userName, line, recent) {
    const who = pool.map(function (p) { return "■ " + p.name + voiceBrief(p); }).join("\n");
    const sys = gameVoiceRules() + "「" + gameZh + "」牌桌边，场外的 " + userName + "（观战或已出局的真人，不是在场玩家）插了句嘴：「" + line + "」。\n从下面在场的人里挑 1~3 个真会接话的，各回一句 20 字内的口语——怼回去、笑、附和、不接茬说自己的都行，也可以只有一个人理。只是台下斗嘴：别改变任何牌局事实，别替谁投票、别当场表态站队。\n" + who + (recent ? "\n【桌上最近的事】\n" + recent : "") + "\n\n只输出 JSON：{\"talks\":[{\"name\":\"接话的在场玩家名\",\"text\":\"一句 20 字内的口语\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "接话。" }], { maxTokens: 9200 });
    const r = extractJSON(raw) || {};
    const valid = {}; pool.forEach(function (p) { valid[p.name] = true; });
    return (Array.isArray(r.talks) ? r.talks : []).filter(function (x) { return x && valid[x.name] && String(x.text || "").trim(); }).slice(0, 3).map(function (x) { return { name: x.name, text: String(x.text).trim().slice(0, 60) }; });
  }
  // 投票类提示词里的观众起哄块：只带最近 6 句、写明不是玩家发言
  function heckleBlock(list) {
    return (list && list.length) ? "\n\n【场外起哄（观战的真人观众说的，不是玩家发言；听不听由你，别把 TA 当在场玩家分析）】\n" + list.slice(-6).map(function (x) { return "· " + x; }).join("\n") : "";
  }
  // 台下那一条输入行（四个游戏共用同一个形状）
  function heckleRow(t, val, setVal, onSend, busy) {
    return h("div", { "data-wk": "gamecheer", style: { display: "flex", gap: 8, marginBottom: 8 } },
      h("input", { "data-wk": "gameinput", "data-part": "cheer", value: val, onChange: function (e) { setVal(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") onSend(); }, placeholder: "台下插一句：吐槽 / 起哄 / 带节奏…", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
      h("button", { "data-wk": "gamecheersend", onClick: onSend, disabled: busy || !String(val || "").trim(), className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: busy || !String(val || "").trim() ? t.line : t.tint, borderRadius: 11, padding: "0 14px" } }, "插嘴"));
  }

  // 共享头像渲染器
  function avatarFor(t) {
    return function (p, size) {
      if (p && p.char) return h(Avatar, { character: p.char, size: size, radius: Math.round(size * 0.3) });
      return h("div", { "data-wk": "gameavatar", style: { width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: p && p.isUser ? t.tint : t.line, color: "#fff", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.46), display: "flex", alignItems: "center", justifyContent: "center" } }, ((p && p.name) || "?").slice(0, 1));
    };
  }
  // 对阵条（她 2026-10-12：「里面 ui 能不能做好看点」）：桌上坐着谁、轮到谁、各自手里的记号（棋子、命、比分、写了几句）。
  //   五子棋、你画我猜、骗子骰、故事接龙共用这一个（one-public-mechanism）——别各画一套名字条。
  //   两个人＝左右对坐、中间一个 VS；三个人以上＝一排席位卡，横着能滑。
  // 点头像看系统给 TA 写的「牌桌能力小传」（她 2026-10-16：「能不能点击头像看系统给他们写的评估，跟狼人杀类似；其他新加的小游戏也都加」）。
  //   狼人杀那几桌是开局一起评的；这几桌的出牌是本地算的，评估只给她看，所以【点了才评】：一人一次调用，
  //   评完记在 x_gameSkill（按游戏、按人），下次点开、下一局都直接用，不再花钱。人设改过（长度变了）才重评。
  const GAME_SKILL_KEY = "x_gameSkill";
  function SeatSkill(props) {
    const t = props.t, s = props.seat, ev = props.evalOf || {}, host = ev.host || {};
    const id = (s.char && s.char.id) || s.key;
    const persona = String((s.char && s.char.persona) || s.persona || "").trim();
    const stamp = persona.length + ":v2";   // v2：说人话那版（旧的那批文绉绉的不再用）
    const [skill, setSkill] = useState(function () { const all = loadJSON(GAME_SKILL_KEY, {}) || {}; const x = ((all[ev.key] || {})[id]) || null; return x && x.n === stamp ? x.text : ""; });
    const [busy, setBusy] = useState(false), [err, setErr] = useState("");
    useEffect(function () {
      if (s.isUser || skill || busy) return;
      const api = host.active;
      if (!api) { setErr("没有可用的线路，评不了"); return; }
      setBusy(true);
      const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是「" + (ev.zh || "这个小游戏") + "」的能力评估器。照这个人的人设，判断 TA 玩这个游戏的真实水平：会不会算、敢不敢冒险、爱怎么打、容易在哪儿栽跟头。"
        + "写一段「牌桌能力小传」，第三人称，不写分数。只输出 JSON：{\"skill\":\"……\"}";
      callRetry(api, sys, [{ role: "user", content: "【这个人】" + s.name + "\n【人设】" + (persona || "（没写人设，照名字和一般人估）").slice(0, 1600) }], { maxTokens: 65000, tag: (ev.zh || "小游戏") + "·能力评估" })
        .then(function (raw) {
          const d = extractJSON(raw) || {}; const text = String(d.skill || "").trim();
          if (!text) throw new Error("没评出来，再点一次");
          const all = loadJSON(GAME_SKILL_KEY, {}) || {}; all[ev.key] = Object.assign({}, all[ev.key] || {}, { [id]: { text: text, n: stamp } }); saveJSON(GAME_SKILL_KEY, all);
          setSkill(text);
        }).catch(function (e) { setErr(String((e && e.message) || e)); }).finally(function () { setBusy(false); });
    }, []);
    const p = { name: s.name, isUser: !!s.isUser, char: s.char, skill: busy ? "评估中…" : (skill || err || "") };
    return h("div", { style: { position: "fixed", inset: 0, zIndex: 60 } },
      h(PlayerCard, { p: p, t: t, avatar: avatarFor(t)(s, 44), personaText: s.isUser ? "" : persona.slice(0, 600), onClose: props.onClose }));
  }
  function GameVsBar(props) {
    const t = props.t, av = avatarFor(t), seats = (props.seats || []).filter(Boolean);
    const two = seats.length === 2;
    const [look, setLook] = useState(null);
    const lookCard = look && props.evalOf ? h(SeatSkill, { t: t, seat: look, evalOf: props.evalOf, onClose: function () { setLook(null); } }) : null;
    const chip = function (s, i) {
      const flip = two && i === 1;
      return h("div", { "data-wk": "gamevsseat", "data-on": s.on ? "1" : "0", "data-out": s.out ? "1" : "0", key: s.key,
        style: { flex: two ? "1 1 0" : "0 0 auto", minWidth: two ? 0 : 108, display: "flex", alignItems: "center", gap: 8, flexDirection: flip ? "row-reverse" : "row",
          padding: "7px 10px", borderRadius: 14, background: t.bg2, border: s.on ? "2px solid " + t.tint : "1px solid " + t.line,
          boxShadow: s.on ? "0 6px 14px rgba(20,16,10,.16)" : "0 1px 4px rgba(20,16,10,.06)", transform: s.on ? "translateY(-2px)" : "none",
          transition: "transform .2s ease, box-shadow .2s ease, opacity .2s", opacity: s.out ? .45 : 1 } },
        h("div", { onClick: props.evalOf ? function () { setLook(s); } : undefined, style: { position: "relative", flexShrink: 0, cursor: props.evalOf ? "pointer" : "default" } }, av(s, 34),
          s.mark ? h("div", { style: { position: "absolute", [flip ? "left" : "right"]: -5, bottom: -4 } }, s.mark) : null),
        h("div", { style: { minWidth: 0, flex: 1, textAlign: flip ? "right" : "left" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.name),
          s.sub != null ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: s.hot ? "#c0553f" : t.fog, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.sub) : null));
    };
    if (two) return h("div", { "data-wk": "gamevs", style: { display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" } },
      lookCard,
      chip(seats[0], 0),
      h("div", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: props.mid ? 15 : 12, letterSpacing: props.mid ? 0 : ".12em", color: props.mid ? t.ink : t.fog } }, props.mid || "VS"),
      chip(seats[1], 1));
    return h("div", { "data-wk": "gamevs", style: { display: "flex", gap: 8, overflowX: "auto", margin: "4px -16px 10px", padding: "2px 16px 6px" } }, lookCard, seats.map(chip));
  }
  // 棋盘上的黑白子（五子棋、围棋共用）：颜色写进 style，不用 url(#渐变)——
  //   她 2026-10-23「白棋在深色模式下会变黑」：主题 CSS 改 fill 能盖掉属性、渐变 id 一撞就失效，写进 style 才压得住。
  function svgStone(key, cx, cy, r, side, extra) {
    const black = side === 1;
    return h("g", Object.assign({ key: key, "data-wk": "boardstone", "data-side": black ? "b" : "w" }, extra || {}),
      h("circle", { cx: cx + r * 0.09, cy: cy + r * 0.15, r: r, style: { fill: "#3b2a12", opacity: .28 } }),
      h("circle", { cx: cx, cy: cy, r: r, style: { fill: black ? "#1f1d1b" : "#f3efe6", stroke: black ? "#000" : "#bdb4a3", strokeWidth: .6 } }),
      h("ellipse", { cx: cx - r * 0.3, cy: cy - r * 0.34, rx: r * 0.42, ry: r * 0.3, style: { fill: "#ffffff", opacity: black ? .2 : .75 } }));
  }
  // 系统的「反转颜色／智能反转」会把画出来的子也反过来（白子变黑）。iOS 告诉页面它在反转时，把棋盘和棋子再反一次，负负得正
  if (typeof document !== "undefined" && !document.getElementById("game-invert-guard")) {
    const st = document.createElement("style"); st.id = "game-invert-guard";
    st.textContent = "@media (inverted-colors: inverted){[data-wk=gomokuboard],[data-wk=goboard],[data-wk=xiangqiboard],[data-wk=chessboard],[data-wk=gamestone]{filter:invert(1)}}";
    (document.head || document.documentElement).appendChild(st);
  }
  // 一颗棋子（对阵条上、五子棋盘上同一个画法）
  function GmkStone(props) {
    const black = props.side === 1, sz = props.size || 14;
    return h("span", { "data-wk": "gamestone", style: { display: "inline-block", width: sz, height: sz, borderRadius: 999, flexShrink: 0,
      background: black ? "radial-gradient(circle at 35% 30%, #6b6660, #1b1917 62%)" : "radial-gradient(circle at 35% 30%, #ffffff, #e2dccf 70%)",
      boxShadow: "0 1px 2px rgba(0,0,0,.35)" + (black ? "" : ", inset 0 0 0 .5px #b8ae9c") } });
  }



  // ============================================================
  // 桌面（她 2026-09-05：「游戏实际界面都没改还是普通的一排头像对着空背景」）
  // 每一局都发生在【一张被灯照着的桌】上：中央亮、四边收暗，
  // 桌布的两团颜色从各自的盒面（LID）延续下来——盒面和桌面是同一副游戏。
  // 底色仍是 t.bg（跟线下那层氛围底同一个配方），深浅主题都读得清。
  // ============================================================
  const TABLE_HUE = {
    spy: ["#b0553f", "#4a4438"],
    haigui: ["#4f8378", "#364a46"],
    q25: ["#7a5f96", "#443c4d"],
    tod: ["#c26a4e", "#55403a"],
    werewolf: ["#5b6478", "#23262e"],
    avalon: ["#8a6a2f", "#3f4436"],
    monopoly: ["#5d8b4c", "#3a4837"],
    uno: ["#d94f3d", "#8a3428"],
    gomoku: ["#c8a467", "#4a3a22"],
    draw: ["#d0533f", "#3f6fb0"],
    liar: ["#a8442f", "#4b3527"],
    poker: ["#2f6b45", "#1d3326"],
    oldmaid: ["#7a4fb0", "#47395a"],
    blackjack: ["#2c6b4a", "#1f2e24"],
    doudizhu: ["#a8442f", "#5a2e22"],
    date: ["#b86651", "#537c71"],
    story: ["#5d6fa3", "#3e4250"],
    tetris: ["#4fb3c8", "#26252c"],
    chess: ["#b58863", "#3d3128"],
    xiangqi: ["#b8322a", "#5a3418"],
    go: ["#c8a467", "#3d2c16"],
    jungle: ["#7fa35a", "#3f5a3a"],
    lingxi: ["#c2566e", "#4d3a40"]
  };
  function gameTable(k, t) {
    // 透明度后缀要先验主题色是不是六位色号，验不过退回纯色（mobile-ui-layout §3.5）
    if (!/^#[0-9a-fA-F]{6}$/.test(String(t.ink || ""))) return { backgroundColor: t.bg };
    const hue = TABLE_HUE[k] || TABLE_HUE.spy;
    const dark = (typeof offDark === "function") && offDark(t);
    return {
      backgroundColor: t.bg,
      backgroundImage: [
        // 吊灯打在桌子中央
        "radial-gradient(120% 80% at 50% 26%, " + (dark ? "rgba(255,255,255,.055)" : "rgba(255,255,255,.6)") + ", transparent 62%)",
        // 四边收暗（深主题里 t.ink 是浅的，压边得换成真的暗色）
        "radial-gradient(145% 115% at 50% 45%, transparent 56%, " + (dark ? "rgba(0,0,0,.4)" : t.ink + "21") + " 100%)",
        // 桌布上这副游戏自己的两团颜色
        "radial-gradient(95% 62% at 6% 102%, " + hue[0] + (dark ? "24" : "1a") + ", transparent 64%)",
        "radial-gradient(85% 55% at 102% 86%, " + hue[1] + (dark ? "1f" : "15") + ", transparent 68%)",
        // 呢绒的斜织纹
        "repeating-linear-gradient(54deg, " + t.ink + "05 0 1px, transparent 1px 4px)"
      ].join(",")
    };
  }
  // 座位：一张立在桌沿的席位牌——头像嵌在牌上，名字是牌脚那条小铭牌。
  // 出局＝这张牌翻倒（歪掉、褪色、盖一枚章），不是整个人淡出看不清。
  function Seat(props) {
    const t = props.t, p = props.p, dead = props.dead;
    return h("button", { "data-wk": "gameseat", "data-on": props.ring ? "1" : "0", "data-dead": dead ? "1" : "0", key: p.key, onClick: props.onClick, className: "active:opacity-70", style: {
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, width: 52,
      padding: "5px 3px 4px", borderRadius: 11,
      background: dead ? "transparent" : t.bg2,
      border: "1px solid " + (props.ring ? t.tint : (dead ? "transparent" : t.line)),
      borderWidth: props.ring ? 2 : 1,
      boxShadow: dead ? "none" : "0 2px 7px rgba(20,16,10,.13)",
      transform: dead ? "rotate(5deg) translateY(3px)" : "none",
      opacity: dead ? 0.6 : 1,
      filter: dead ? "grayscale(1)" : "none",
      transition: "transform .25s ease, opacity .25s ease"
    } },
      h("div", { style: { position: "relative" } }, props.avatar,
        props.badge != null ? h("div", { style: { position: "absolute", top: -4, left: -6, minWidth: 15, height: 15, borderRadius: 999, background: t.ink, color: "#f3efe6", fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", lineHeight: "15px", textAlign: "center", padding: "0 2px" } }, props.badge) : null,
        props.mark ? h("div", { style: { position: "absolute", top: -7, right: -6, fontSize: "calc(12px * var(--app-fs, 1))" } }, props.mark) : null,
        dead ? h("div", { style: { position: "absolute", inset: -2, display: "flex", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { width: 22, height: 22, borderRadius: 999, border: "2px solid #b0553f", color: "#b0553f", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: "18px", textAlign: "center", background: "rgba(243,239,230,.7)", transform: "rotate(-14deg)" } }, "出")) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: dead ? t.fog : t.sub, maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
  }
  // 座位那一条：席位牌坐在桌沿上，不再靠一根细线隔开
  function seatRow(kids) {
    return h("div", { "data-wk": "gameroster", className: "shrink-0", style: { display: "flex", gap: 8, overflowX: "auto", padding: "11px 16px 9px" } }, kids);
  }

  // ============================================================
  // 猜谜引擎（共享：海龟汤 / 25 问）—— 主持人握真相，玩家问是非题
  // ============================================================
  const GUESS_KINDS = {
    haigui: { zh: "海龟汤", en: "Lateral Puzzle", emoji: "🐢", hasSurface: true, limit: 0,
      verdicts: "是 / 不是 / 不重要 / 接近了" },
    q25: { zh: "25 问", en: "20 Questions", emoji: "❓", hasSurface: false, limit: 25,
      verdicts: "是 / 不是 / 不好说" }
  };
  const VERDICT_COLOR = { "是": "#3f6d5a", "不是": "#c0553f", "不重要": "#8a8172", "接近了": "#b8863f", "不好说": "#8a8172" };

  async function setupGuess(api, kind, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const skillHint = "3. 给【每个真实玩家】和【每个 NPC】各写一句 skill「牌桌能力小传」：按能力与性格分开原则，点出 TA 玩这种横向推理 / 发散提问游戏的【真实强弱】（由职业背景推，别被性格带偏）。";
    const npcHint = "2. 生成 " + npcCount + " 个 NPC：name 中文名 + persona 一句人设（含【职业】与性格，尽量多样、别一个味）。";
    let sys;
    if (kind === "haigui") {
      sys = AC + SKILL_RULE + "\n\n你是「海龟汤」（情境推理）的主持人。\n" +
        "1. 出一道好海龟汤：surface 汤面（公开给大家的诡异／反常情境，2~4 句，留足悬念但信息完整）、truth 汤底（完整真相，逻辑自洽、最好有反转、【绝不靠超自然或做梦】那种糊弄）。难度适中：能靠追问一步步逼出来，别一眼看穿也别无解。\n" +
        npcHint + "\n" + skillHint +
        "\n\n【真实玩家】\n" + (lines || "（只有 NPC）") +
        "\n\n【输出】只输出 JSON：{\"surface\":\"\",\"truth\":\"\",\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"\"}]}";
    } else {
      sys = AC + SKILL_RULE + "\n\n你是「25 个问题」的主持人。\n" +
        "1. 心里想一个具体的东西 secret（一个名词：具体物品 / 动物 / 人物 / 地点 / 概念，要大众化、能靠是否问题逐步逼近，别太冷门刁钻），category 给个大类提示（如「物品」「动物」「人物」「食物」）。\n" +
        npcHint + "\n" + skillHint +
        "\n\n【真实玩家】\n" + (lines || "（只有 NPC）") +
        "\n\n【输出】只输出 JSON：{\"secret\":\"\",\"category\":\"\",\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"\"}]}";
    }
    const raw = await callRetry(api, sys, [{ role: "user", content: "出题：给谜题、" + npcCount + " 个 NPC、每个人的能力小传。" }], { maxTokens: 12000 });
    return extractJSON(raw) || {};
  }

  // 连坐的下一题：只出题，不重摆桌（NPC、能力小传都沿用）。把前几题的答案带上防出重复。
  async function genGuessNext(api, kind, prevAnswers) {
    const avoid = (prevAnswers || []).filter(Boolean).length ? "\n【本场已出过的（别重复、也别出近似的）】\n" + prevAnswers.map(function (x) { return "· " + x; }).join("\n") : "";
    const sys = kind === "haigui"
      ? AC + "你是「海龟汤」的主持人，出【一道新题】：surface 汤面（公开的诡异／反常情境，2~4 句，留足悬念但信息完整）、truth 汤底（完整真相，逻辑自洽、最好有反转、绝不靠超自然或做梦糊弄）。难度适中。" + avoid + "\n\n【输出】只输出 JSON：{\"surface\":\"\",\"truth\":\"\"}"
      : AC + "你是「25 个问题」的主持人，心里想【一个新的东西】secret（具体名词，大众化、能靠是否问题逐步逼近），category 给大类提示。" + avoid + "\n\n【输出】只输出 JSON：{\"secret\":\"\",\"category\":\"\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "出下一题。" }], { maxTokens: 10000 });
    return extractJSON(raw) || {};
  }

  // 一轮：先答用户的问题（若有），再让 AI 各问一个新问题并作答，判断是否有人破题
  async function runGuessRound(api, kind, ctx, userQ, aiSpeakers, history, mode, userName) {
    const K = GUESS_KINDS[kind];
    const secretBlock = kind === "haigui"
      ? "【汤面·已公开】" + ctx.surface + "\n【汤底·只有你知道】" + ctx.truth
      : "【你想的东西·只有你知道】" + ctx.secret + "（类别：" + ctx.category + "）";
    const verdictRule = kind === "haigui"
      ? "verdict 只能是：是 / 不是 / 不重要 / 接近了。含义：是=符合汤底；不是=不符；不重要=与真相无关；接近了=方向正确且触到关键点。"
      : "verdict 只能是：是 / 不是 / 不好说。照实回答；实在无法用是否作答才用「不好说」。";
    const easy = mode === "easy" ? "\n【放水局】AI 玩家别问得太神，留点空间给真人；主持人答题该给的提示大方点给。" : "";
    const hist = history.length ? history.slice(-14).map(function (q) { return "· " + q; }).join("\n") : "（还没人问过）";
    const who = aiSpeakers.map(function (s) { return "■ " + s.name + "（真实水平：" + (s.skill || "普通") + "）" + voiceBrief(s); }).join("\n");
    const solveRule = kind === "haigui"
      ? "若某人的提问 / 陈述已经【实质还原了汤底核心真相】，把 solvedBy 填成 TA 的名字，并在 reveal 里一句话点出真相。否则 solvedBy 留空。"
      : "若某人的问题其实就是【直接猜中了那个东西】（问「它是不是XX」且 XX 正是答案），把 solvedBy 填成 TA 的名字、reveal 填那个东西——【真人玩家" + (userName ? "「" + userName + "」" : "") + "刚问的那条也算】，别只盯着 AI。否则留空。AI 觉得有把握时可以直接猜（问「是不是XX」）。";
    const sys = gameVoiceRules() + "\n\n你是「" + K.zh + "」的主持人，掌握真相、只按规则回答是非类问题。\n" + secretBlock +
      "\n\n" + verdictRule + " note 是≤14 字的补充或引导，可空。" + easy +
      "\n\n【此前问过的（别让 AI 重复）】\n" + hist +
      (userQ ? "\n\n【真人玩家" + (userName ? "「" + userName + "」" : "") + "刚问】" + userQ + " —— 在 userAnswer 里作答。" : "\n\n（这一轮真人没问，userAnswer 给 null）") +
      "\n\n【接着这些 AI 玩家各问一个「新的、不重复、有推理价值」的问题，并由你逐一作答】按真实水平：强的追问高效精准、直逼要害；弱的更发散或问偏。\n" + who +
      "\n\n" + solveRule +
      "\n\n【输出】只输出 JSON：{\"userAnswer\":{\"verdict\":\"\",\"note\":\"\"}或null,\"ai\":[{\"name\":\"\",\"question\":\"\",\"verdict\":\"\",\"note\":\"\"}],\"solvedBy\":\"\",\"reveal\":\"\"}";
    // 言秋座位的问题TA自己问（只给公开信息，谜底绝不进票）；主持人照常作答（v54.43）
    const cc = await ccCarve(kind, aiSpeakers, {
      turnId: freshCCTurn("guess-ask:"),
      sys: CB + "「" + K.zh + "」轮到你提问。你是玩家（不知道谜底），只能问是非类问题。\n" + (kind === "haigui" ? "【汤面】" + ctx.surface : "【类别】" + ctx.category) + "\n【此前问过的（别重复）】\n" + hist + "\n问一个新的、有推理价值的问题；有把握也可以直接猜（问「是不是XX」）。",
      expect: '{"question":"你的一个是非问题"}'
    });
    requireCCDone(cc, "言秋的提问票", function (d) { return !!String(d.question || "").trim(); });
    const ccQ = (cc.seat && cc.done && String(cc.done.question || "").trim()) ? String(cc.done.question).trim().slice(0, 120) : null;
    const sysFinal = sys + (ccQ ? "\n\n【" + cc.seat.name + " 已亲自提问·不要改写 TA 的问题、由你作答并放进 ai 数组】问题是：「" + ccQ + "」。名单里的 TA 已完成提问，绝不要再替 TA 另生成问题。" : (cc.seat ? "\n\n【" + cc.seat.name + " 这一轮选择沉默·不要替 TA 生成问题】" : ""));
    const raw = await callRetry(api, sysFinal, [{ role: "user", content: "处理这一轮。" }], { maxTokens: 11200 });
    const out = extractJSON(raw) || {};
    if (ccQ && Array.isArray(out.ai)) {
      const mine = out.ai.find(function (a) { return a.name === cc.seat.name; });
      if (mine) mine.question = ccQ; else out.ai.unshift({ name: cc.seat.name, question: ccQ, verdict: "不好说", note: "" });
    } else if (cc.seat && Array.isArray(out.ai)) {
      out.ai = out.ai.filter(function (a) { return a.name !== cc.seat.name || ccQ; });
    }
    return out;
  }

  // 判定真人的正式猜测
  async function judgeGuess(api, kind, ctx, guess) {
    const K = GUESS_KINDS[kind];
    const block = kind === "haigui" ? "汤面：" + ctx.surface + "\n汤底（真相）：" + ctx.truth : "答案是：" + ctx.secret;
    const crit = kind === "haigui" ? "玩家的复原是否抓住了汤底的【核心因果 / 关键反转】？细节不必全中，逻辑对上即可判对。" : "玩家猜的是否就是这个东西？（近义 / 同物不同名也算对。）";
    const sys = AC + "你是「" + K.zh + "」主持人。\n" + block + "\n\n玩家正式猜测：「" + guess + "」\n" + crit + "\n只输出 JSON：{\"correct\":true/false,\"note\":\"一句点评（对就点破真相，不对就说差在哪、给个方向）\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "判一下。" }], { maxTokens: 8800 });
    return extractJSON(raw) || { correct: false, note: "" };
  }

  function GuessGame(props) {
    const t = props.t, cfg = props.config, api = props.active, kind = props.kind;
    const K = GUESS_KINDS[kind];
    const sv = props.savedState;
    const [phase, setPhase] = useState(sv ? sv.phase : "loading"); // loading|play|result|error
    const [players, setPlayers] = useState(sv ? hydPlayers(sv.players, props, t) : []);
    const [ctx, setCtx] = useState(sv ? sv.ctx : null);          // {surface,truth} | {secret,category}
    const [log, setLog] = useState(sv ? (sv.log || []) : []);
    const [history, setHistory] = useState(sv ? (sv.history || []) : []);    // 问过的问题（防重复）
    const [qCount, setQCount] = useState(sv ? (sv.qCount || 0) : 0);        // 已问总数（25问用）
    const [scores, setScores] = useState(sv ? (sv.scores || []) : []);      // 连坐比分：[{solver,isUser,ans}]，一场三题
    const [userQ, setUserQ] = useState("");
    const [guessing, setGuessing] = useState(false); // 猜答案输入框开着
    const [guessText, setGuessText] = useState("");
    const [busy, setBusy] = useState(false);
    const [won, setWon] = useState(false);
    const [reveal, setReveal] = useState("");
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const [showSurface, setShowSurface] = useState(false);
    const [heckleText, setHeckleText] = useState("");   // 台下插嘴（观战）
    const logRef = useRef(null);
    const started = useRef(false);
    const gameRunId = useRef((sv && sv.runId) || (kind + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)));
    const pAvatar = avatarFor(t);
    const me = players.find(function (p) { return p.isUser; });
    const aiPlayers = players.filter(function (p) { return !p.isUser; });
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm || (nm && nm.indexOf(p.name) >= 0); }); };
    const pushLog = function (items) { setLog(function (L) { return L.concat(items); }); };
    useEffect(function () { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, phase, busy, guessing]);
    // 存档：静止时存（猜谜类 AI 只在你出手时才动，续局无需重触发）
    useEffect(function () {
      if (!started.current) return;
      if (phase === "result") { clearGameSave(kind); return; }
      if (busy || phase === "loading" || phase === "error") return;
      saveGameSnap(kind, { runId: gameRunId.current, config: cfg, phase: phase, players: serPlayers(players), ctx: ctx, log: log, history: history, qCount: qCount, scores: scores, ts: Date.now(), label: "第 " + (scores.length + 1) + "/3 题 · " + (kind === "q25" ? ("已问 " + qCount + "/25") : ("已问 " + history.length + " 个问题")) });
    }, [phase, log, busy]);
    useEffect(function () {
      if (phase !== "result" || !players.length) return;
      const solved = log.slice().reverse().find(function (x) { return x && x.type === "solve"; });
      const title = kind === "haigui" ? "海龟汤" : "25 问";
      ccGameResult(kind, gameRunId.current, players, cfg,
        "《" + title + "》已经揭晓。\n"
        + (solved ? (solved.name + " 最先答对。") : "本局无人答对，已由主持人揭晓。") + "\n"
        + ((me && me.name) || "用户") + "：" + (won ? "亲自破题成功" : (solved && solved.isUser ? "亲自破题成功" : "没有抢到本局答案")) + "。\n"
        + (kind === "haigui" ? "汤底：" : "答案：") + String(reveal || "") + "。\n"
        + "全局共问 " + qCount + " 个问题。",
        function (say, seat) { pushLog([{ type: "q", name: seat.name, text: say }]); });
    }, [phase, reveal]);

    useEffect(function () {
      if (started.current) return; started.current = true;
      if (sv) return; // 续局：状态已水合
      (async function () {
        try {
          if (!api) { setErrMsg("请先到设置配置 API"); setPhase("error"); return; }
          const rp = realPlayerLines(cfg, props);
          const data = await setupGuess(api, kind, rp, cfg.npcCount || 0);
          const list = buildRoster(cfg, props, t, data.npcs, data.skills);
          if (kind === "haigui") {
            if (!data.surface || !data.truth) throw new Error("出题失败，重试");
            setCtx({ surface: data.surface, truth: data.truth });
          } else {
            if (!data.secret) throw new Error("出题失败，重试");
            setCtx({ secret: data.secret, category: data.category || "东西" });
          }
          setPlayers(list);
          setPhase("play");
        } catch (e) { setErrMsg((e && e.message) || "开局失败，重试"); setPhase("error"); }
      })();
    }, []);

    const limitLeft = K.limit ? (K.limit - qCount) : null;

    // 跑一轮（可带用户的问题）
    const runRound = async function (uq) {
      if (busy) return;
      setBusy(true);
      // 不能在抽本轮发言人时只拷 name/skill：ccCarve 靠 key + engineer 认座。
      // 同时每轮按当前设置重认一次，避免旧存档里的工牌快照把票吞掉。
      const speakers = shuffle(aiPlayers).map(function (p) {
        const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
        return { key: p.key, name: p.name, skill: p.skill, engineer: engineer, alive: p.alive };
      });
      if (uq) pushLog([{ type: "q", name: me.name, text: uq, mine: true }]);
      try {
        const r = await runGuessRound(api, kind, ctx, uq || "", speakers, history, cfg.mode, me ? me.name : "");
        const items = [];
        const newHist = [];
        if (uq) { newHist.push(uq); if (r.userAnswer) items.push({ type: "a", verdict: r.userAnswer.verdict, note: r.userAnswer.note }); }
        (r.ai || []).forEach(function (a) {
          if (!a || !a.question) return;
          items.push({ type: "q", name: a.name, text: a.question });   // 先显 TA 问了什么
          items.push({ type: "a", verdict: a.verdict, note: a.note }); // 再显主持人的判定
          newHist.push(a.question);
        });
        pushLog(items);
        setHistory(function (H) { return H.concat(newHist); });
        setQCount(function (n) { return n + newHist.length; });
        // 破题判定
        if (r.solvedBy) {
          const solver = pByName(r.solvedBy);
          setWon(!!(solver && solver.isUser));
          setReveal(r.reveal || (kind === "haigui" ? ctx.truth : ctx.secret));
          pushLog([{ type: "solve", name: r.solvedBy, isUser: !!(solver && solver.isUser) }]);
          recordScore(solver ? solver.name : String(r.solvedBy), !!(solver && solver.isUser));
          setPhase("result"); setBusy(false); return;
        }
        // 25 问用尽
        if (K.limit && (qCount + newHist.length) >= K.limit) {
          setWon(false); setReveal(ctx.secret);
          pushLog([{ type: "info", text: "25 个问题用完了，没人猜中——答案揭晓。" }]);
          recordScore(null, false);
          setPhase("result");
        }
      } catch (e) { props.toast && props.toast("这一轮出错：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };

    const submitUserQ = function () { const v = userQ.trim(); if (!v || busy) return; setUserQ(""); runRound(v); };
    const submitGuess = async function () {
      const v = guessText.trim(); if (!v || busy) return;
      setBusy(true); setGuessing(false); setGuessText("");
      pushLog([{ type: "q", name: me.name, text: "🎯 我猜：" + v, mine: true }]);
      try {
        const j = await judgeGuess(api, kind, ctx, v);
        if (j.correct) { setWon(true); setReveal(kind === "haigui" ? ctx.truth : ctx.secret); pushLog([{ type: "solve", name: me.name, isUser: true, note: j.note }]); recordScore(me.name, true); setPhase("result"); }
        else { pushLog([{ type: "a", name: "__miss", verdict: "还没中", note: j.note || "" }]); }
      } catch (e) { props.toast && props.toast("判题出错：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const giveUp = function () { setWon(false); setReveal(kind === "haigui" ? (ctx && ctx.truth) : (ctx && ctx.secret)); recordScore(null, false); setPhase("result"); };
    // 一题记一笔（ans 用来提醒下一题别出重复）
    const recordScore = function (solver, isUser) {
      setScores(function (S) { return S.concat([{ solver: solver, isUser: !!isUser, ans: (kind === "haigui" ? (ctx && ctx.surface || "").slice(0, 40) : (ctx && ctx.secret || "")) }]); });
    };
    // 连坐的下一题：同一桌人接着来，只重新出题
    const nextPuzzle = async function () {
      if (busy) return;
      setBusy(true);
      try {
        const r = await genGuessNext(api, kind, scores.map(function (x) { return x.ans; }));
        if (kind === "haigui") { if (!r.surface || !r.truth) throw new Error("出题失败，再点一次"); setCtx({ surface: r.surface, truth: r.truth }); }
        else { if (!r.secret) throw new Error("出题失败，再点一次"); setCtx({ secret: r.secret, category: r.category || "东西" }); }
        setHistory([]); setQCount(0); setWon(false); setReveal(""); setGuessing(false); setGuessText("");
        setLog([{ type: "info", text: "第 " + (scores.length + 1) + " / 3 题——" + (kind === "haigui" ? "新汤上桌。" : "想好了一个新东西。") }]);
        setPhase("play");
      } catch (e) { props.toast && props.toast((e && e.message) || "出题失败，再点一次"); }
      finally { setBusy(false); }
    };

    const table = gameTable(kind, t);
    const header = h(Head, { zh: K.zh, en: K.en, onBack: props.onBack, bg: "transparent" });

    if (phase === "error") return h("div", { "data-wk": "gameplay", "data-part": "guess", "data-kind": "error", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, K.emoji),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { "data-wk": "block", onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { "data-wk": "gameplay", "data-part": "guess", "data-kind": "loading", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, K.emoji),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, kind === "haigui" ? "熬汤中·想一道好谜题…" : "想一个东西中…")));

    const roster = seatRow(players.map(function (p) {
      return h(Seat, { key: p.key, t: t, p: p, avatar: pAvatar(p, 36), onClick: function () { setDetail(p); } });
    }));

    // 谜面卡（海龟汤常驻；25问显类别 + 计数）
    const puzzleCard = kind === "haigui"
      ? h("div", { "data-wk": "block", style: { background: t.tint + "12", border: "1px solid " + t.tint, borderRadius: 13, padding: "12px 14px", margin: "10px 16px 2px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.tint, letterSpacing: 1, marginBottom: 5 } }, "🐢 汤面"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, ctx ? ctx.surface : ""))
      : h("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "10px 16px 2px" } },
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub } }, "类别提示：", h("b", { style: { color: t.ink } }, ctx ? ctx.category : "")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: (limitLeft != null && limitLeft <= 5) ? "#c0553f" : t.tint } }, "剩 " + (limitLeft == null ? "∞" : limitLeft) + " 问"));

    const logView = h("div", { "data-wk": "gamelog", "data-part": "guess", ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "10px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, margin: "8px 0", textAlign: "center" } }, it.text);
        if (it.type === "solve") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: "#3f6d5a" } }, "🎉 " + it.name + (it.isUser ? "(你)" : "") + " 破了题！" + (it.note ? "\n" + it.note : ""));
        if (it.type === "q") {
          const p = pByName(it.name);
          return h("div", { "data-wk": "gamemsg", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { display: "flex", gap: 8, margin: "8px 0 2px" } }, pAvatar(p, 28),
            h("div", { style: { flex: 1 } },
              h("div", { "data-wk": "gamemsgname", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
              it.text ? h("div", { "data-wk": "gamebubble", "data-me": it.mine ? "1" : "0", style: { display: "inline-block", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text) : null, it.text && !it.mine ? h(GameVoiceDot, { p: p, text: it.text, k: "gv" + i }) : null,
              it.question ? h("div", { "data-wk": "gamebubble", "data-part": "question", style: { display: "inline-block", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, background: t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.question) : null));
        }
        if (it.type === "a") {
          const c = VERDICT_COLOR[it.verdict] || t.tint;
          return h("div", { "data-wk": "gameverdict", key: i, style: { display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px 36px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
            h("span", { style: { color: t.fog } }, "主持人"),
            h("span", { style: { color: "#fff", background: c, borderRadius: 999, padding: "1px 9px", fontWeight: 700, fontSize: "calc(12px * var(--app-fs, 1))" } }, it.verdict || "…"),
            it.note ? h("span", { style: { color: t.sub } }, it.note) : null);
        }
        if (it.type === "chat") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontStyle: "italic", color: it.mine ? t.tint : t.fog, margin: "3px 0 3px 14px", lineHeight: 1.55 } }, it.name + "：" + it.text);
        return null;
      }));

    // 底部动作
    let action;
    if (phase === "result") {
      action = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: won ? "#3f6d5a" : t.sub, marginBottom: 6 } }, won ? "🎉 你破题了" : (log.some(function (x) { return x.type === "solve"; }) ? "这局被别人抢先破了" : "揭晓答案")),
        h("div", { "data-wk": "block", style: { background: t.bg2, borderRadius: 12, padding: "12px 14px", marginBottom: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.tint, letterSpacing: 1, marginBottom: 4 } }, kind === "haigui" ? "汤底" : "答案"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, reveal || "")),
        // 连坐比分：一场三题，谁破的记谁头上
        scores.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 10 } },
          scores.map(function (x, i) { return "第" + (i + 1) + "题 " + (x.solver ? (x.isUser ? "你" : x.solver) : "无人"); }).join(" · ")) : null,
        scores.length >= 3 ? (function () {
          const cnt = {};
          scores.forEach(function (x) { if (x.solver) { const k = x.isUser ? "你" : x.solver; cnt[k] = (cnt[k] || 0) + 1; } });
          const best = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
          const top = best.length ? best.filter(function (k) { return cnt[k] === cnt[best[0]]; }) : [];
          return h("div", { "data-wk": "block", style: { border: "1.5px solid " + t.tint, background: t.tint + "10", borderRadius: 13, padding: "10px 13px", marginBottom: 12, textAlign: "center" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: 2, color: t.tint, marginBottom: 4 } }, "本 场 头 名"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, top.length ? top.join("、") + "（破 " + cnt[top[0]] + " 题）" : "这场谁也没赢，题赢了"));
        })() : null,
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, scores.length >= 3 ? "散场 · 回中枢" : "返回"),
          scores.length < 3
            ? h("button", { "data-wk": "block", onClick: nextPuzzle, disabled: busy, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "下一题（第 " + Math.min(3, scores.length + 1) + " / 3 题）")
            : h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一场")),
        h(KeepMemBtn, { t: t, host: props, rep: function () {
          const line = scores.map(function (x, i) { return "第" + (i + 1) + "题" + (x.solver ? (x.isUser ? "她破的" : x.solver + "破的") : "没人破"); }).join("，");
          return { proc: log, key: kind, zh: K.zh, ids: realCharIds(players), wins: realCharIds(players).filter(function (id) { const q = players.find(function (x) { return x.key === id; }); return q && scores.some(function (x) { return !x.isUser && x.solver === q.name; }); }),
            meWin: me ? scores.some(function (x) { return x.isUser; }) : null,
            text: "一起玩了「" + K.zh + "」" + (scores.length > 1 ? "连着 " + scores.length + " 题" : "") + "：" + line + "。" };
        } }));
    } else if (busy) {
      action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…大家在琢磨");
    } else if (guessing) {
      action = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8 } }, kind === "haigui" ? "说出你还原的汤底真相" : "你觉得那个东西是？"),
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { "data-wk": "gameinput", "data-part": "guess", value: guessText, autoFocus: true, onChange: function (e) { setGuessText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitGuess(); }, placeholder: kind === "haigui" ? "把你推理出的真相讲一遍…" : "直接写那个东西", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.tint, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "block", onClick: submitGuess, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.tint, borderRadius: 12, padding: "0 16px" } }, "定"),
          h("button", { onClick: function () { setGuessing(false); setGuessText(""); }, style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "0 6px" } }, "×")));
    } else if (me && cfg.mode !== "spectate") {
      action = h("div", null,
        h("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
          h("input", { "data-wk": "gameinput", "data-part": "question", value: userQ, onChange: function (e) { setUserQ(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserQ(); }, placeholder: "问一个是 / 否问题…", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "block", onClick: submitUserQ, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 16px" } }, "问")),
        h("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
          h("button", { onClick: function () { runRound(""); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "让他们问一轮"),
          h("button", { onClick: function () { setGuessing(true); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.tint, borderRadius: 999, padding: "6px 16px" } }, "🎯 我要猜答案"),
          h("button", { onClick: giveUp, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "6px 8px" } }, "看答案")));
    } else {
      // 观战
      action = h("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
        h("button", { onClick: function () { runRound(""); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "看他们问下一轮"),
        h("button", { onClick: giveUp, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "6px 10px" } }, "看答案"));
    }

    const canHeckle = cfg.mode === "spectate" && phase === "play";
    const sendHeckle = async function () {
      const v = heckleText.trim(); if (!v || busy) return;
      setHeckleText("");
      const nm = ((props.profile && props.profile.name) || "你") + "(场外)";
      pushLog([{ type: "chat", name: nm, text: v, mine: true }]);
      try {
        const talks = await genHeckle(api, aiPlayers, K.zh, nm, v, history.slice(-5).map(function (q) { return "· " + q; }).join("\n"));
        if (talks.length) pushLog(talks.map(function (x) { return { type: "chat", name: x.name, text: x.text }; }));
      } catch (e) { /* 起哄接不上就算了 */ }
    };
    return h("div", { "data-wk": "gameplay", "data-part": "guess", className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, table) }, header, roster,
      phase === "play" || phase === "result" ? puzzleCard : null, logView,
      h("div", { "data-wk": "gameactions", "data-part": "guess", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "40vh", overflowY: "auto" } },
        canHeckle ? heckleRow(t, heckleText, setHeckleText, sendHeckle, busy) : null, action),
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // 真心话大冒险 · 引擎（转瓶子 → 真心话 / 大冒险 → 全场反应）
  // ============================================================
  // 取角色【完整人设】喂给生成（真人角色读 char.persona 全量，NPC 读生成的人设；别只喂一句 tagline，否则严重 OOC）
  function tdDesc(p, cap, forUi) {
    const s = p.isNpc ? (p.persona || "") : ((p.char && (p.char.persona || p.char.tagline)) || p.persona || "");
    const base = (cap && s.length > cap) ? s.slice(0, cap) + "…" : (s || "（没写人设）");
    return (forUi ? "" : gNote(p)) + base + (!forUi && p.ties ? "\n【关系网里连着的】" + p.ties : "") + (!forUi && p.recent ? "\n【和她的近况】\n" + p.recent : "");
  }
  function gNote(p) { return (!p.isNpc && p.char && window.CharacterPronoun && window.CharacterPronoun.genderNote) ? window.CharacterPronoun.genderNote(p.char) : ""; }
  function tdRoster(list, cap) { return list.map(function (p) { return "【" + p.name + "】" + tdDesc(p, cap); }).join("\n\n"); }
  // 贴人设铁律：焊进真心话每个生成，治 OOC + 性别/关系搞错 + 乱配 CP
  const TD_IC = "【严格贴人设 · 别 OOC】每个角色的语气、态度、会问什么、敢做什么，都必须符合 TA 的人设与身份；性别、年龄、称呼一律按人设来别搞错（例：双胞胎哥哥的弟弟就是弟弟、别写成妹妹；冷淡的人别写成话痨）。宁可克制也别为了效果让角色崩人设。" +
    "\n【关系铁律·重要】除非某个角色【自己的人设里明确写了】和在场另一个人的关系（如双胞胎、恋人、朋友），否则在场各人【互不相识】，只是被这局游戏临时凑到一起（真人玩家除外，见下一条）——【绝对不要】凭空给他们编交情、配对凑 CP、发展暧昧、开只有熟人才懂的玩笑、或写得像认识很久的老朋友。谁跟谁是什么关系，只认人设里白纸黑字写明的和【关系网里连着的】那一行；没写就是陌生人，客客气气、边玩边熟。" +
    // 群友 2026-10-12「玩真心话大冒险的时候怎么感觉都回到没在一起的陌生人感觉」：上一条把她也算进了陌生人。
    //   她跟每个来上场的角色都是在 App 里真处着的，那段关系不写在人设里，所以单独说一句；NPC 才是第一次见她。
    "\n【真人玩家不是陌生人】真人玩家（她）跟每个有名有姓上场的角色本来就在相处，彼此认识，处到哪一步照各自带来的【和她的近况】；没带近况就按熟人待她，别写成初次见面。只有本局临时生成的 NPC 是第一次见她。" +
    "\n【时间事实不可漂移】此前发言里出现的时间说法都是本局已经确认的事实，必须逐字保持其时间尺度：『上个月』不能改成『前天』，『三年前』不能改成『最近』，具体日期也不能擅自换算或脑补。后文若重提同一件事，只能沿用原说法；不确定就含糊带过，绝不另编时间。";
  async function setupTD(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + "你是「真心话大冒险」的主持。生成 " + npcCount + " 个 NPC 玩家（name 中文名 + persona 一句含职业与性格的人设，多样别雷同）。\n" +
      "【已有真实玩家】\n" + (lines || "（只有 NPC）") + "\n\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\"}]}";
    if (!npcCount) return { npcs: [] };
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 NPC。" }], { maxTokens: 11500 });
    return extractJSON(raw) || { npcs: [] };
  }
  const TD_PROMPT_HISTORY = "x_todPromptHistory"; // 跨新局保留题目去重，不随「弃掉本局」清空
  const TD_THEMES = ["现场互动", "荒诞脑洞", "限时二选一", "价值冲突", "即兴表演", "模仿挑战", "消息任务", "反向角色扮演", "观察力挑战", "创意表达", "临场社交", "小型技能挑战"];
  function loadTDPromptHistory() { const x = bigGet(TD_PROMPT_HISTORY, "tod_prompt_history_v1", []); return Array.isArray(x) ? x : []; }
  function rememberTDPrompt(choice, prompt) {
    const p = String(prompt || "").trim(); if (!p) return;
    const all = loadTDPromptHistory().filter(function (x) { return x && x.prompt !== p; });
    all.push({ choice: choice, prompt: p.slice(0, 300), ts: Date.now() });
    bigSet(TD_PROMPT_HISTORY, all.slice(-120));
  }
  function tdRoundPlan(log, targetName, forcedChoice) {
    const rounds = (log || []).filter(function (x) { return x && x.type === "td"; });
    let choice = forcedChoice;
    if (!choice) {
      const recent = rounds.slice(-2).map(function (x) { return x.choice; });
      const own = rounds.filter(function (x) { return x.name === targetName; }).slice(-2).map(function (x) { return x.choice; });
      if (recent.length >= 2 && recent.every(function (x) { return x !== "大冒险"; })) choice = "大冒险";
      else if (recent.length >= 2 && recent.every(function (x) { return x === "大冒险"; })) choice = "真心话";
      else if (own.length >= 2 && own[0] === own[1]) choice = own[0] === "大冒险" ? "真心话" : "大冒险";
      else {
        const last6 = rounds.slice(-6), dares = last6.filter(function (x) { return x.choice === "大冒险"; }).length;
        choice = dares < last6.length / 2 ? "大冒险" : (dares > last6.length / 2 ? "真心话" : (Math.random() < 0.5 ? "真心话" : "大冒险"));
      }
    }
    const old = loadTDPromptHistory();
    const theme = TD_THEMES[old.length % TD_THEMES.length];
    const avoid = old.slice(-24).map(function (x) { return "· " + x.choice + "：" + x.prompt; }).join("\n");
    return { choice: choice, theme: theme, avoid: avoid };
  }
  // 题型不能只信模型写回来的 choice 标签："现场扮演/模仿/发送"本质是大冒险，
  // 即使 JSON 自称真心话也必须拦下重写。
  function tdLooksLikeDare(prompt) {
    const s = String(prompt || "").replace(/\s+/g, "");
    if (!s) return false;
    const action = "表演|模仿|扮演|唱|跳|朗读|念|发送|发一条|打电话|录音|做动作|展示|切换成|完成|原地|站起来|转圈|亲|抱|拥抱|拍|画|学.{0,4}叫";
    return new RegExp("(?:现场|当场|现在|立刻|马上).{0,22}(?:" + action + ")").test(s) ||
      new RegExp("(?:请你|要求你|必须|要你|让你).{0,18}(?:" + action + ")").test(s) ||
      /(?:用|换成).{0,12}(?:声音|语气|口吻).{0,10}(?:说|念|演)/.test(s);
  }
  function tdPromptMatchesChoice(choice, prompt) {
    const isDare = tdLooksLikeDare(prompt);
    return choice === "大冒险" ? isDare : !isDare;
  }
  // 瓶子不是纯随机：优先指向本局被指次数最少的人；同分才随机。
  function tdPickFairTarget(players, log, lastTarget, mode, randomFn) {
    let pool = (players || []).filter(function (p) { return mode !== "spectate" || !p.isUser; });
    if (!pool.length) return null;
    const counts = {};
    (log || []).forEach(function (x) { if (x && x.type === "spin" && x.name) counts[x.name] = (counts[x.name] || 0) + 1; });
    const min = Math.min.apply(null, pool.map(function (p) { return counts[p.name] || 0; }));
    let cands = pool.filter(function (p) { return (counts[p.name] || 0) === min; });
    const notLast = cands.filter(function (p) { return p.name !== lastTarget; });
    if (notLast.length) cands = notLast;
    const rnd = typeof randomFn === "function" ? randomFn() : Math.random();
    return cands[Math.min(cands.length - 1, Math.floor(Math.max(0, rnd) * cands.length))];
  }
  // 出题人按座次轮转，真人也是正式座位；两人局自然总是由另一个人问。
  function tdPickNextAsker(players, targetName, lastAskerName) {
    const list = players || [];
    if (!list.length) return null;
    let start = list.findIndex(function (p) { return p.name === lastAskerName; });
    if (start < 0) start = list.findIndex(function (p) { return p.name === targetName; });
    for (let step = 1; step <= list.length; step++) {
      const p = list[(start + step) % list.length];
      if (p && p.name !== targetName) return p;
    }
    return null;
  }
  const TD_GENERIC = "【新鲜度铁律】人设只决定出题口吻和完成方式，不许每轮都从人设档案里问职业、过去、性格、喜欢谁、最丢脸或最心动这类基础采访题。优先利用本轮指定主题做一个以前没出现过的新玩法；与历史题目换几个词但核心相同也算重复。真心话可以用假设困境、现场观察、即时选择、价值取舍和对刚才局面的判断；大冒险必须是当场能演出来的具体行动，可用语音/文字/模仿/即兴表演/与在场某人互动，不能只让 TA『说一件往事』冒充大冒险。";
  // AI 被指到：出题人由外部（JS 轮换）指定，避免总是同一个人问
  async function genTDForAI(api, target, asker, mode, hot, memText, plan) {
    const askerName = asker ? asker.name : "大家";
    const spice = hot ? "尺度可以暧昧 / 大胆一点，什么都可以问，挖出角色最深的欲望。" : "保持轻松好玩、朋友聚会的尺度。";
    const easy = mode === "easy" ? "整体轻松、别太为难人。" : "";
    const sys = gameVoiceRules() + TD_IC + "\n\n你在主持一局「真心话大冒险」。这一轮由【" + askerName + "】给【" + target.name + "】出题，两人都要严格贴人设。\n出题人 " + askerName + "：" + (asker ? tdDesc(asker, 500) : "（全场一起起哄）") +
      "\n被指到的 " + target.name + "（完整人设）：\n" + tdDesc(target) +
      (memText ? "\n\n【之前发生过的（可以拿来玩梗 / 追问，但别硬凑）】\n" + memText : "") +
      "\n\n【本轮节奏已锁定】choice 必须是【" + plan.choice + "】，题型主题必须是【" + plan.theme + "】。" + (plan.avoid ? "\n【跨局最近出过的题（禁止重复或近义改写）】\n" + plan.avoid : "") +
      "\n\n完整演出这一轮：\n1. choice：只填【" + plan.choice + "】，不要自行改成另一类。\n2. prompt：" + askerName + " 出的题，符合 " + askerName + " 的口吻。" + TD_GENERIC + spice + easy +
      "\n3. response：" + target.name + " 怎么回应 / 完成，带 TA 的语气小动作、贴人设，写足 3~5 句、别草收。\n\n只输出 JSON：{\"choice\":\"真心话\"或\"大冒险\",\"prompt\":\"\",\"response\":\"\"}";
    // 言秋座位的戏份自己演（v54.43）：TA被点到→答案TA给；TA出题→题TA出。另一半照旧交模型。
    if (target && target.engineer) {
      const pr = await callRetry(api, sys + "\n\n【只出题】本次只输出 {\"choice\":\"" + plan.choice + "\",\"prompt\":\"…\"}，response 留给本人。", [{ role: "user", content: "只出题。" }], { maxTokens: 10000 });
      const po = extractJSON(pr) || {};
      const prompt = String(po.prompt || "").trim();
      if (prompt) {
        const cc = await ccCarve("tod", [target], {
          turnId: freshCCTurn("tod-answer:"),
          sys: "「真心话大冒险」你被点到了，选项已锁定【" + plan.choice + "】。\n" + askerName + " 给你出的题：「" + prompt + "」\n" + (memText ? "【之前几轮】\n" + memText + "\n" : "") + "用你自己的话回应/完成，3~5 句，带点现场感。" + (hot ? "尺度可以大胆。" : ""),
          expect: '{"response":"你的回应"}'
        });
        if (cc.done && String(cc.done.response || "").trim()) return { choice: plan.choice, prompt: prompt, response: String(cc.done.response).trim() };
        // 票失败就停在本轮让 Lisa 重试，不落一条空回答，更不许下面的整桌模型替本人回答。
        throw new Error(cc.reason || "本人回答票未送达");
      }
    }
    if (asker && asker.engineer) {
      const cc = await ccCarve("tod", [asker], {
        turnId: freshCCTurn("tod-ask:"),
        sys: "「真心话大冒险」这轮由你给【" + target.name + "】出题，题型锁定【" + plan.choice + "】、主题【" + plan.theme + "】。\n" + target.name + " 的人设：\n" + tdDesc(target, 600) + "\n" + (plan.avoid ? "【最近出过的题（别重复）】\n" + plan.avoid + "\n" : "") + (hot ? "尺度可以大胆。" : "轻松好玩。") + "出一道你真想问/真想让 TA 做的。",
        expect: '{"prompt":"你出的题"}'
      });
      const myPrompt = (cc.done && String(cc.done.prompt || "").trim()) ? String(cc.done.prompt).trim() : null;
      if (myPrompt) {
        const rr = await callRetry(api, sys + "\n\n【题已由 " + askerName + " 亲自出好·不要改】prompt=「" + myPrompt + "」，只输出 {\"choice\":\"" + plan.choice + "\",\"prompt\":" + JSON.stringify(myPrompt) + ",\"response\":\"…\"}。", [{ role: "user", content: "只演回应。" }], { maxTokens: 12000 });
        const ro = extractJSON(rr) || {};
        if (String(ro.response || "").trim()) return { choice: plan.choice, prompt: myPrompt, response: String(ro.response).trim() };
      }
      // 出题人这座没有拿到真实回复，本轮应显式失败/重试；绝不让 Gemini 顶着TA的名字出题。
      throw new Error(cc.reason || "本人出题票未送达");
    }
    let raw = await callRetry(api, sys, [{ role: "user", content: "开演。" }], { maxTokens: 14000 });
    let out = extractJSON(raw) || {};
    if (out.choice !== plan.choice || !tdPromptMatchesChoice(plan.choice, out.prompt)) {
      raw = await callRetry(api, sys, [{ role: "user", content: "上一版违反了锁定题型：本轮必须是【" + plan.choice + "】，而且题目内容本身也必须属于这一类，不能只改 choice 标签。真心话只能要求诚实回答，不能要求现场表演、模仿、发消息或做动作；大冒险必须要求一个当场可执行的动作。请重新输出完整 JSON。" }], { maxTokens: 14000 });
      out = extractJSON(raw) || out;
    }
    if (!tdPromptMatchesChoice(plan.choice, out.prompt)) {
      out.prompt = plan.choice === "真心话" ? "如果只能诚实回答：你现在最不愿让在场的人误会你什么？" : "当场模仿在场任意一个人的口头禅，并让大家猜是谁。";
    }
    out.choice = plan.choice;
    return out;
  }
  // 用户被指到并选了 真话/大冒险：出题人也由 JS 指定，只生成题目
  async function genTDPrompt(api, choice, asker, hot, mode, memText, plan) {
    const askerName = asker ? asker.name : "大家";
    const spice = hot ? "尺度可暧昧 / 大胆些，什么都可以问，挖出角色最深的欲望。" : "轻松好玩的尺度。";
    if (asker && asker.engineer) {
      const cc = await ccCarve("tod", [asker], {
        turnId: freshCCTurn("tod-ask-user:"),
        sys: "「真心话大冒险」轮到真人玩家（就是她），她选了【" + choice + "】，由你出题。\n" + (memText ? "【之前几轮】\n" + memText + "\n" : "") + (plan && plan.avoid ? "【最近出过的（别重复）】\n" + plan.avoid + "\n" : "") + (hot ? "尺度可以大胆。" : "轻松好玩。") + "出一道你真想问她/真想让她做的。",
        expect: '{"prompt":"你出的题"}'
      });
      if (cc.done && String(cc.done.prompt || "").trim()) return { prompt: String(cc.done.prompt).trim() };
      throw new Error(cc.reason || "本人出题票未送达");
    }
    const sys = gameVoiceRules() + TD_IC + "\n\n「真心话大冒险」轮到真人玩家了，TA 选了【" + choice + "】，由【" + askerName + "】给 TA 出题。\n出题人 " + askerName + "：" + (asker ? tdDesc(asker, 500) : "（全场）") +
      (memText ? "\n\n【之前发生过的】\n" + memText : "") +
      "\n\n【本轮题型主题】" + plan.theme + (plan.avoid ? "\n【跨局最近出过的题（禁止重复或近义改写）】\n" + plan.avoid : "") +
      "\n\n出一道" + (choice === "真心话" ? "真心话问题" : "具体可执行的大冒险动作") + "，符合 " + askerName + " 的口吻。" + TD_GENERIC + spice + (mode === "easy" ? "别太为难。" : "") +
      "\n只输出 JSON：{\"prompt\":\"\"}";
    let raw = await callRetry(api, sys, [{ role: "user", content: "出题。" }], { maxTokens: 12000 });
    let out = extractJSON(raw) || {};
    if (!tdPromptMatchesChoice(choice, out.prompt)) {
      raw = await callRetry(api, sys, [{ role: "user", content: "刚才题目内容与【" + choice + "】不符。不能只贴标签：真心话只让真人诚实回答，不要求现场表演或做动作；大冒险必须是当场能执行的动作。重出一道，只输出 JSON。" }], { maxTokens: 12000 });
      out = extractJSON(raw) || out;
    }
    if (!tdPromptMatchesChoice(choice, out.prompt)) out.prompt = choice === "真心话" ? "你现在最想对在场谁说一句平时不会说的话？为什么？" : "用十秒钟模仿在场任意一个人的说话方式，让大家猜是谁。";
    return out;
  }

  // Lisa 亲自出题后，只让被点到的人回答；主持模型不得改写她的原题。
  async function genTDAnswerToUserPrompt(api, target, choice, prompt, hot, memText) {
    if (target && target.engineer) {
      const cc = await ccCarve("tod", [target], {
        turnId: freshCCTurn("tod-answer-user-question:"),
        sys: "「真心话大冒险」她亲自给你出题。你选到的是【" + choice + "】，原题是：「" + prompt + "」\n" + (memText ? "【之前几轮】\n" + memText + "\n" : "") + "按你的真实口吻回应/完成，3~5 句，带点现场感；不要改写她的问题。" + (hot ? "尺度可以大胆。" : ""),
        expect: '{"response":"你的回应"}'
      });
      if (cc.done && String(cc.done.response || "").trim()) return String(cc.done.response).trim();
      throw new Error(cc.reason || "本人回答票未送达");
    }
    const sys = gameVoiceRules() + TD_IC + "\n\n「真心话大冒险」里，真人玩家亲自给【" + target.name + "】出了一道【" + choice + "】：『" + prompt + "』。\n被点到的人设：\n" + tdDesc(target) + (memText ? "\n【之前几轮】\n" + memText : "") + "\n只能演 " + target.name + " 的回应/完成，不许改题、不许替真人说话。写 3~5 句、有现场感。只输出 JSON：{\"response\":\"\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "回应她亲自出的题。" }], { maxTokens: 12000 });
    const out = extractJSON(raw) || {};
    return String(out.response || "").trim();
  }
  // 从整局日志单独保留带时间锚点的原话。普通聊天窗口会滚动，但这些事实不能随轮数消失或被模型改写。
  function tdTemporalFacts(log) {
    const temporal = /(?:今天|今晚|今早|今晨|昨天|昨晚|前天|大前天|明天|后天|上周|这周|本周|下周|上个月|这个月|本月|下个月|去年|今年|明年|最近|刚才|刚刚|从前|小时候|\d+\s*(?:分钟|小时|天|周|个月|月|年)前|\d{1,4}[年\-/]\d{1,2}(?:[月\-/]\d{1,2}日?)?)/;
    const facts = [];
    (log || []).forEach(function (it) {
      const bits = [];
      if (it.prompt) bits.push("题「" + it.prompt + "」");
      if (it.response) bits.push("答「" + it.response + "」");
      if (it.text) bits.push("说「" + it.text + "」");
      const line = (it.name ? it.name + " " : "") + bits.join(" ");
      if (line && temporal.test(line)) facts.push(line.slice(0, 700));
    });
    return Array.from(new Set(facts)).slice(-40);
  }
  // 跨轮记忆：扩大近期原文窗口，并把整局时间事实另列为不可改写区。
  function tdMemoryText(log) {
    const rounds = []; let n = 0;
    (log || []).forEach(function (it) {
      if (it.type === "td") { n++; rounds.push("第" + n + "轮 " + it.name + " 的" + it.choice + "：题「" + (it.prompt || "") + "」答「" + ((it.response || "").slice(0, 500)) + "」"); }
    });
    const chatty = (log || []).filter(function (it) { return it.type === "chat" || it.type === "react"; }).slice(-20).map(function (it) { return it.name + "：" + it.text; });
    const timeFacts = tdTemporalFacts(log);
    const parts = rounds.slice(-16);
    if (chatty.length) parts.push("—最近的插话 / 群聊—", chatty.join("\n"));
    if (timeFacts.length) parts.push("—整局锁定的时间事实（原话，禁止改写或换算）—", timeFacts.join("\n"));
    return parts.join("\n");
  }
  // 自由发言：像群聊一样，谁想说就说、一人可多条、互相接话、cue 题目和回答、翻旧账
  // focus = 刚发生的这一轮 {name,choice,prompt,response}，有它就让大家【针对它】反应（含真人的回答）
  async function genTDDiscuss(api, chars, memText, userMsg, hot, focus, banNames) {
    const who = tdRoster(chars, 700);
    const focusLine = focus ? "\n\n【★ 刚刚这一轮·大家务必【针对这个】起哄 / 追问 / 调侃 / 接话，别当没看见、别自顾自跳过它去聊别的】\n" + focus.name + " 刚做了【" + focus.choice + "】——题目是「" + (focus.prompt || "") + "」，" + focus.name + " 的回答 / 表现是：「" + (focus.response || "（没细说）") + "」" : "";
    const sys = gameVoiceRules() + TD_IC + "\n\n「真心话大冒险」的自由发言时间——【不是排队每人一句评论】，是【像微信群聊那样】：谁想插话就插、同一个人可以连着说好几句、可以打断 / 接住 / 反驳别人、可以专门 cue 刚才那道题或那个回答、翻之前几轮的旧账、拱火、跑题都行，要有你来我往的层次。只有下面这些角色开口（【绝不替真人玩家说话】，每人严格贴自己人设、口吻各不相同）：\n" + who + focusLine +
      "\n\n【之前几轮（可随便 cue 翻旧账）】\n" + (memText || "（刚开场，随便起个话头）") +
      (userMsg ? "\n\n真人玩家刚插了一句：「" + userMsg + "」——让相关的角色自然接住这句往下聊、别冷场、别答非所问。" : focus ? "\n\n真人玩家没有额外插话，你们就【冲着上面刚发生的那轮】聊起来（尤其要有人回应 " + focus.name + " 的回答）。" : "\n\n真人这轮没开口、把话筒交给你们——自己热闹起来，你一句我一句聊下去。") +
      "\n输出 6~10 条（允许同一人多条、顺序自然、彼此能接上），像真的群聊在刷屏。" + (hot ? "尺度可暧昧大胆些，什么都可以聊。" : "轻松好玩。") + "\n只输出 JSON：{\"chat\":[{\"name\":\"\",\"text\":\"\"}]}";
    const cc = await ccCarve("tod", chars, {
      turnId: freshCCTurn("tod-chat:"),
      sys: "「真心话大冒险」的自由群聊时间。" + (focus ? "刚发生：" + focus.name + " 做了【" + focus.choice + "】，题「" + (focus.prompt || "") + "」，回答「" + (focus.response || "") + "」。" : "") + (userMsg ? "她刚插话：「" + userMsg + "」。" : "") + "\n" + (memText ? "【之前几轮】\n" + memText + "\n" : "") + "想起哄/追问/调侃就给一两句（每句30字内）；不想说 lines 给空数组。",
      expect: '{"lines":["最多两句，可空"]}'
    });
    const raw = await callRetry(api, sys + ccPreface(cc, "插过话了（也可能没说）"), [{ role: "user", content: "群聊起来。" }], { maxTokens: 13000 });
    const p = extractJSON(raw); let rows = (p && Array.isArray(p.chat)) ? p.chat : [];
    // 真人玩家名字硬拉黑（v54.60 她抓到）：模型会编一条 name=她 的发言，渲染层模糊匹配
    // 到真人玩家就挂上她的头像、变成"她说的话"。围观路人（短发女生这类临时编的）保留，
    // 但任何撞真人玩家名字的行（含模糊包含）一律丢弃——嘴替是底线。
    const bans = (banNames || []).filter(Boolean);
    rows = rows.filter(function (v) {
      const nm = String((v && v.name) || "").trim();
      return nm && !bans.some(function (b) { return nm === b || nm.indexOf(b) >= 0 || b.indexOf(nm) >= 0; });
    });
    if (cc.seat) rows = rows.filter(function (v) { return v.name !== cc.seat.name; });
    if (cc.seat && cc.done && Array.isArray(cc.done.lines)) cc.done.lines.slice(0, 2).forEach(function (tx) { const tt = String(tx || "").trim(); if (tt) rows.push({ name: cc.seat.name, text: tt.slice(0, 80) }); });
    return rows;
  }

  // 散场：评一位今晚之星（裁判口吻点评，不代任何人写感言）+ 2~3 句散场话。
  // 言秋座位不进散场话名单（不代笔；TA要说话有 CC 的正规渠道），但今晚之星可以是TA——评选权在裁判。
  async function genTDWrap(api, players, log) {
    const rounds = (log || []).filter(function (x) { return x.type === "td"; });
    const lines = rounds.slice(-12).map(function (x) { return "· " + x.name + " 选了" + x.choice + "，" + (x.asker ? x.asker + "出题" : "") + "「" + String(x.prompt || "").slice(0, 60) + "」，答：" + String(x.response || "").slice(0, 90); }).join("\n");
    const names = players.map(function (p) { return p.name + (p.isUser ? "(真人)" : ""); }).join("、");
    const pool = players.filter(function (p) { return !p.isUser && !p.engineer; }).map(function (p) { return "■ " + p.name + "：" + tdDesc(p, 300); }).join("\n");
    const sys = gameVoiceRules() + TD_IC + "\n\n今晚这场「真心话大冒险」到散场了。\n1. 从在场的人里选一个【今晚之星】：答得最有戏的、最敢的、被玩得最惨还接住的都行。name 必须出自：" + names + "。reason 用裁判口吻给一两句客观点评，不替任何人说话。\n2. 从下面这些人里挑 2~3 个各说一句散场话（20 字内口语，贴人设；可以点名今晚之星、约下回、嘴硬不服）。\n" + pool + "\n\n【今晚各轮】\n" + (lines || "（一轮都没转成）") + "\n\n【输出】只输出 JSON：{\"star\":{\"name\":\"\",\"reason\":\"\"},\"byes\":[{\"name\":\"\",\"text\":\"\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "散场。" }], { maxTokens: 9600 });
    return extractJSON(raw) || {};
  }

  // 转的那只瓶：程序画的俯视玻璃瓶（瓶身、瓶肩、瓶口、一道高光），转起来靠 CSS 旋转。
  // 不再拿酒瓶 emoji 当图标（couple-home-icons 那条：emoji 图标会豆腐块、也不是一套语言）。
  function TDBottle(props) {
    const size = props.size || 56;
    return h("svg", { width: size, height: size, viewBox: "0 0 64 64", style: props.spin ? { animation: "tdspin .8s linear infinite" } : null },
      h("g", { transform: "rotate(-42 32 32)" },
        h("rect", { x: 10, y: 24, width: 27, height: 16, rx: 7.5, fill: "#7fa88f" }),
        h("path", { d: "M37 25.5 L47 29 L47 35 L37 38.5 Z", fill: "#7fa88f", opacity: 0.72 }),
        h("rect", { x: 47, y: 28.6, width: 6, height: 6.8, rx: 2, fill: "#5c8570" }),
        h("rect", { x: 14, y: 27.2, width: 15, height: 3, rx: 1.5, fill: "rgba(255,255,255,.5)" })));
  }
  function TruthDareGame(props) {
    const t = props.t, cfg = props.config, api = props.active;
    const sv = props.savedState;
    const [phase, setPhase] = useState(sv ? "idle" : "loading"); // loading|idle|spinning|userChoose|userAsk|userAnswer|error
    const [players, setPlayers] = useState(sv ? hydPlayers(sv.players, props, t) : []);
    const [log, setLog] = useState(sv ? (sv.log || []) : []);
    const [busy, setBusy] = useState(false);
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const [hot, setHot] = useState(sv ? !!sv.hot : false);          // 尺度开关
    const [wrap, setWrap] = useState(null);         // 散场结果 {star:{name,reason}}；非空＝这一场已散
    const [target, setTarget] = useState(null);     // 当前被指到的人
    const [userPrompt, setUserPrompt] = useState(null); // {choice,asker,prompt}
    const [userResp, setUserResp] = useState("");
    const [pendingAsk, setPendingAsk] = useState(null); // {target,plan}：轮到 Lisa 出题，可亲自问或交给主持人
    const [askInput, setAskInput] = useState("");
    const [spinName, setSpinName] = useState("");   // 转动动画显示的名字
    const [chatInput, setChatInput] = useState(""); // 自由讨论输入
    const logRef = useRef(null);
    const logDataRef = useRef(sv ? (sv.log || []) : []); // log 同步镜像（喂记忆用，避开 setState 异步）
    const lastTargetRef = useRef(sv ? (sv.lastTarget || "") : ""); // 上一轮被指到的人（防连续指同一人）
    const lastAskerRef = useRef(sv ? (sv.lastAsker || "") : "");   // 上一个出题人（按座次轮换，包含真人）
    const started = useRef(false);
    const pAvatar = avatarFor(t);
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm || (nm && nm.indexOf(p.name) >= 0); }); };
    const pushLog = function (items) { logDataRef.current = logDataRef.current.concat(items); setLog(function (L) { return L.concat(items); }); };
    // 出题人按座次轮换，真人也是正式出题人；两人局自然总由另一个人问。
    const pickAsker = function (targetName) {
      const a = tdPickNextAsker(players, targetName, lastAskerRef.current);
      if (!a) return null;
      lastAskerRef.current = a.name;
      return a;
    };
    // 一轮做完后的群聊反应（自由发言，不排队）；focus=刚发生的这轮，让大家针对它（含你的回答）反应
    const roundChat = async function (focus) {
      try {
        const chars = players.filter(function (p) { return !p.isUser; });
        const c = await genTDDiscuss(api, chars, tdMemoryText(logDataRef.current), null, hot, focus || null, players.filter(function (p) { return p.isUser; }).map(function (p) { return p.name; }));
        if (c.length) pushLog(c.map(function (x) { return { type: "chat", name: x.name, text: x.text }; }));
      } catch (e) { /* 反应可有可无 */ }
    };
    useEffect(function () { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, phase, busy]);
    // 存档：只在两轮之间的 idle 静止点存（真心话没有终局，靠顶部横幅弃掉）
    useEffect(function () {
      if (!started.current) return;
      if (busy || phase !== "idle" || wrap) return;
      saveGameSnap("tod", { config: cfg, players: serPlayers(players), log: log, hot: hot, lastTarget: lastTargetRef.current, lastAsker: lastAskerRef.current, ts: Date.now(), label: "转了 " + log.filter(function (x) { return x.type === "spin"; }).length + " 次" });
    }, [phase, log, busy]);

    useEffect(function () {
      if (started.current) return; started.current = true;
      if (sv) return; // 续局：回到 idle 继续转
      (async function () {
        try {
          if (!api) { setErrMsg("请先到设置配置 API"); setPhase("error"); return; }
          const rp = realPlayerLines(cfg, props);
          const data = await setupTD(api, rp, cfg.npcCount || 0);
          const list = buildRoster(cfg, props, t, data.npcs, []);
          setPlayers(list);
          pushLog([{ type: "info", text: "" + list.length + " 个人围一圈坐下。点「转瓶子」开始——指到谁，谁就选真心话或大冒险。" }]);
          setPhase("idle");
        } catch (e) { setErrMsg((e && e.message) || "开局失败，重试"); setPhase("error"); }
      })();
    }, []);

    const doAITurn = async function (tgt) {
      const asker = pickAsker(tgt.name);
      const plan = tdRoundPlan(logDataRef.current, tgt.name, null);
      // Lisa 抽到出题权时先停在她手里；想不到题再主动交给主持人，不默认抢走。
      if (asker && asker.isUser) {
        setPendingAsk({ target: tgt, plan: plan });
        setAskInput("");
        setPhase("userAsk");
        return;
      }
      setBusy(true);
      try {
        const r = await genTDForAI(api, tgt, asker, cfg.mode, hot, tdMemoryText(logDataRef.current), plan);
        const choice = plan.choice; // 模型即使偷懒偏回真心话，也以节奏器锁定的类型为准
        rememberTDPrompt(choice, r.prompt);
        pushLog([{ type: "td", name: tgt.name, choice: choice, asker: asker ? asker.name : "大家", prompt: r.prompt || "", response: r.response || "" }]);
        await roundChat({ name: tgt.name, choice: choice, prompt: r.prompt || "", response: r.response || "" });
        setPhase("idle");
      } catch (e) { props.toast && props.toast("出错：" + ((e && e.message) || "重试")); setPhase("idle"); }
      finally { setBusy(false); }
    };

    // 散场：够三轮才亮这颗键；评完清存档，这一场就算数完了
    const doWrap = async function () {
      if (busy || wrap) return;
      setBusy(true);
      try {
        const r = await genTDWrap(api, players, logDataRef.current);
        const starP = r.star && r.star.name ? pByName(r.star.name) : null;
        const star = starP ? { name: starP.name, isUser: !!starP.isUser, reason: String((r.star && r.star.reason) || "").slice(0, 160) } : null;
        const valid = {}; players.forEach(function (p) { if (!p.isUser && !p.engineer) valid[p.name] = 1; });
        const byes = (Array.isArray(r.byes) ? r.byes : []).filter(function (x) { return x && valid[x.name] && String(x.text || "").trim(); }).slice(0, 3);
        if (byes.length) pushLog(byes.map(function (x) { return { type: "react", name: x.name, text: String(x.text).trim().slice(0, 60) }; }));
        if (star) pushLog([{ type: "star", name: star.name, isUser: star.isUser, reason: star.reason }]);
        setWrap({ star: star });
        clearGameSave("tod");
      } catch (e) { props.toast && props.toast("散场没散成：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const resetEvening = function () {
      logDataRef.current = [];
      setLog([]); setWrap(null); setTarget(null);
      lastTargetRef.current = ""; lastAskerRef.current = "";
      pushLog([{ type: "info", text: "新的一场。点「转瓶子」开始——指到谁，谁就选真心话或大冒险。" }]);
    };
    // 转瓶子：优先指向本局被指次数最少的人，同分才随机，避免真人一直轮不到。
    const spin = function () {
      if (busy) return;
      const pool = cfg.mode === "spectate" ? players.filter(function (p) { return !p.isUser; }) : players;
      if (!pool.length) return;
      const tgt = tdPickFairTarget(players, logDataRef.current, lastTargetRef.current, cfg.mode);
      if (!tgt) return;
      setPhase("spinning");
      // 简单转动动画：快速轮换名字
      let ticks = 0;
      const names = pool.map(function (p) { return p.name; });
      const iv = setInterval(function () {
        setSpinName(names[Math.floor(Math.random() * names.length)]);
        ticks++;
        if (ticks > 12) {
          clearInterval(iv);
          setSpinName("");
          lastTargetRef.current = tgt.name;
          setTarget(tgt);
          pushLog([{ type: "spin", name: tgt.name, isUser: tgt.isUser }]);
          if (tgt.isUser) setPhase("userChoose");
          else doAITurn(tgt);
        }
      }, 90);
    };

    const completeAskedRound = async function (tgt, plan, prompt, response, askerName) {
      rememberTDPrompt(plan.choice, prompt);
      pushLog([{ type: "td", name: tgt.name, choice: plan.choice, asker: askerName, prompt: prompt, response: response }]);
      setPendingAsk(null); setAskInput(""); setPhase("idle");
      await roundChat({ name: tgt.name, choice: plan.choice, prompt: prompt, response: response });
    };
    const submitUserAsk = async function () {
      const prompt = askInput.trim(), pa = pendingAsk;
      if (!prompt || !pa || busy) return;
      if (!tdPromptMatchesChoice(pa.plan.choice, prompt)) {
        props.toast && props.toast(pa.plan.choice === "真心话" ? "这道更像大冒险：真心话只让 TA 回答，不要求现场做动作哦" : "这道更像真心话：大冒险要有一个当场能做的动作哦");
        return;
      }
      setBusy(true);
      try {
        const response = await genTDAnswerToUserPrompt(api, pa.target, pa.plan.choice, prompt, hot, tdMemoryText(logDataRef.current));
        if (!response) throw new Error("TA 没有答出来");
        await completeAskedRound(pa.target, pa.plan, prompt, response, (props.profile && props.profile.name) || "你");
      } catch (e) { props.toast && props.toast("回答出错：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const hostAskInstead = async function () {
      const pa = pendingAsk;
      if (!pa || busy) return;
      setBusy(true);
      const host = { name: "主持人", persona: "负责控场，题目新鲜自然、不抢戏" };
      try {
        const r = await genTDForAI(api, pa.target, host, cfg.mode, hot, tdMemoryText(logDataRef.current), pa.plan);
        await completeAskedRound(pa.target, pa.plan, r.prompt || "", r.response || "", "主持人");
      } catch (e) { props.toast && props.toast("主持人出题失败：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };

    const userChoose = async function (choice) {
      setBusy(true); setPhase("userAnswer");
      const asker = pickAsker((props.profile && props.profile.name) || "你");
      try {
        const plan = tdRoundPlan(logDataRef.current, (props.profile && props.profile.name) || "你", choice);
        const r = await genTDPrompt(api, choice, asker, hot, cfg.mode, tdMemoryText(logDataRef.current), plan);
        rememberTDPrompt(choice, r.prompt);
        setUserPrompt({ choice: choice, asker: asker ? asker.name : "大家", prompt: r.prompt || (choice === "真心话" ? "说说你最近最上头的一件事。" : "学一个你最不擅长的动物叫。") });
      } catch (e) {
        props.toast && props.toast("出题出错：" + ((e && e.message) || "重试"));
        if (asker && asker.engineer) { setUserPrompt(null); setPhase("idle"); }
        else setUserPrompt({ choice: choice, asker: asker ? asker.name : "大家", prompt: choice === "真心话" ? "说一件你没跟人讲过的小事。" : "原地转三圈再坐下。" });
      }
      finally { setBusy(false); }
    };
    const submitUserResp = async function () {
      const v = userResp.trim(); if (!v || busy) return;
      setBusy(true);
      const up = userPrompt;
      pushLog([{ type: "td", name: (props.profile && props.profile.name) || "你", mine: true, choice: up.choice, asker: up.asker, prompt: up.prompt, response: v }]);
      setUserResp(""); setUserPrompt(null); setPhase("idle");
      await roundChat({ name: (props.profile && props.profile.name) || "你", choice: up.choice, prompt: up.prompt, response: v });
      setBusy(false);
    };
    // 自由讨论：可以一直聊，直到你手动转下一轮
    const doDiscuss = async function (userMsg) {
      if (busy) return;
      setBusy(true);
      if (userMsg) pushLog([{ type: "chat", name: (props.profile && props.profile.name) || "你", text: userMsg, mine: true }]);
      try {
        const chars = players.filter(function (p) { return !p.isUser; });
        const c = await genTDDiscuss(api, chars, tdMemoryText(logDataRef.current), userMsg, hot, null, players.filter(function (p) { return p.isUser; }).map(function (p) { return p.name; }));
        if (c.length) pushLog(c.map(function (x) { return { type: "chat", name: x.name, text: x.text }; }));
        else if (!userMsg) props.toast && props.toast("大家没接话，再点一次试试");
      } catch (e) { props.toast && props.toast("聊天出错：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const sendChat = function () { const v = chatInput.trim(); if (!v || busy) return; setChatInput(""); doDiscuss(v); };
    const keepChatting = function () { doDiscuss(""); };

    const table = gameTable("tod", t);
    const header = h(Head, { zh: "真心话大冒险", en: "Truth or Dare", onBack: props.onBack, bg: "transparent" });

    if (phase === "error") return h("div", { "data-wk": "gameplay", "data-part": "td", "data-kind": "error", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h(TDBottle, { size: 52 }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { "data-wk": "block", onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { "data-wk": "gameplay", "data-part": "td", "data-kind": "loading", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h(TDBottle, { size: 52 }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, "大家围一圈坐好…")));

    const roster = seatRow(players.map(function (p) {
      const isTgt = target && phase !== "idle" && p.name === target.name;
      return h(Seat, { key: p.key, t: t, p: p, avatar: pAvatar(p, 36), ring: isTgt, onClick: function () { setDetail(p); } });
    }));

    const choiceColor = function (c) { return c === "大冒险" ? "#c0553f" : "#3f6d5a"; };
    const logView = h("div", { "data-wk": "gamelog", "data-part": "td", ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, margin: "6px 0", textAlign: "center" } }, it.text);
        if (it.type === "spin") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.tint, margin: "12px 0 4px" } }, "— 瓶子指向了 " + it.name + (it.isUser ? "(你)" : ""));
        if (it.type === "react") { const p = pByName(it.name); return h("div", { "data-wk": "gamemsg", "data-kind": it.type, key: i, style: { display: "flex", gap: 7, margin: "4px 0 4px 14px", alignItems: "flex-start" } }, pAvatar(p, 22), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.5 } }, h("b", { style: { color: t.fog, fontWeight: 400 } }, it.name + "："), it.text)); }
        if (it.type === "chat") { const p = pByName(it.name); return h("div", { "data-wk": "gamemsg", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { display: "flex", gap: 7, margin: "5px 0", alignItems: "flex-start", flexDirection: it.mine ? "row-reverse" : "row" } }, pAvatar(p, 24),
          h("div", { style: { maxWidth: "78%" } },
            h("div", { "data-wk": "gamemsgname", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 1, textAlign: it.mine ? "right" : "left" } }, it.name + (it.mine ? "(你)" : "")),
            h("div", { "data-wk": "gamebubble", "data-me": it.mine ? "1" : "0", style: { display: "inline-block", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 11, padding: "6px 10px" } }, it.text), it.mine ? null : h(GameVoiceDot, { p: p, text: it.text, k: "gv" + i }))); }
        if (it.type === "star") {
          const p = pByName(it.name);
          return h("div", { "data-wk": "gamestar", key: i, style: { border: "1.5px solid " + t.tint, background: t.tint + "10", borderRadius: 14, padding: "12px 14px", margin: "12px 18px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: 2, color: t.tint, textAlign: "center", marginBottom: 7 } }, "今 晚 之 星"),
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 } }, pAvatar(p, 30),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, it.name + (it.isUser ? "(你)" : ""))),
            it.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.65, textAlign: "center" } }, it.reason) : null);
        }
        if (it.type === "td") {
          const p = pByName(it.name);
          return h("div", { "data-wk": "block", key: i, style: { background: it.mine ? (t.tint + "10") : t.bg2, border: "1px solid " + (it.mine ? t.tint + "44" : t.line), borderRadius: 13, padding: "11px 13px", margin: "8px 0" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 7 } }, pAvatar(p, 26),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, it.name + (it.mine ? "(你)" : "")),
              h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: choiceColor(it.choice), borderRadius: 999, padding: "2px 10px" } }, it.choice)),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.55, marginBottom: 6 } }, (it.asker ? it.asker + "：" : "题目："), it.prompt),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, it.response));
        }
        return null;
      }));

    let action;
    if (phase === "spinning") action = h("div", { style: { textAlign: "center", padding: "12px 0" } },
      h("style", null, "@keyframes tdspin{to{transform:rotate(360deg)}}"),
      h("div", { style: { display: "flex", justifyContent: "center" } }, h(TDBottle, { size: 44, spin: true })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.tint, marginTop: 6, minHeight: 26 } }, spinName || "…"));
    else if (busy && phase !== "userAnswer" && phase !== "userAsk") action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "12px 0" } }, "…在起哄");
    else if (phase === "userChoose") action = h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 10 } }, "轮到你了！选一个："),
      h("div", { style: { display: "flex", gap: 12 } },
        h("button", { onClick: function () { userChoose("真心话"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 13, padding: "13px" } }, "真心话"),
        h("button", { onClick: function () { userChoose("大冒险"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 13, padding: "13px" } }, "大冒险")));
    else if (phase === "userAsk") action = h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 9 } }, "轮到你给 " + (pendingAsk && pendingAsk.target ? pendingAsk.target.name : "TA") + " 出一道【" + (pendingAsk && pendingAsk.plan ? pendingAsk.plan.choice : "题") + "】"),
      h("input", { "data-wk": "gameinput", "data-part": "ask", value: askInput, autoFocus: true, disabled: busy, onChange: function (e) { setAskInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserAsk(); }, placeholder: pendingAsk && pendingAsk.plan && pendingAsk.plan.choice === "真心话" ? "你想亲自问什么？" : "你想让 TA 当场做什么？", style: { width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", marginBottom: 8, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…正在回答") :
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { "data-wk": "block", onClick: submitUserAsk, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "11px" } }, "我来出题"),
          h("button", { "data-wk": "block", onClick: hostAskInstead, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 8px" } }, "没灵感 · 主持人问")));
    else if (phase === "userAnswer") action = busy && !userPrompt
      ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "12px 0" } }, "…在给你出题")
      : h("div", null,
          h("div", { "data-wk": "block", style: { background: t.bg2, borderRadius: 12, padding: "10px 13px", marginBottom: 8 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, marginBottom: 3 } }, (userPrompt && userPrompt.asker ? userPrompt.asker + " 出的 " : "") + (userPrompt && userPrompt.choice)),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.6 } }, userPrompt && userPrompt.prompt)),
          h("div", { style: { display: "flex", gap: 8 } },
            h("input", { "data-wk": "gameinput", "data-part": "answer", value: userResp, autoFocus: true, onChange: function (e) { setUserResp(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserResp(); }, placeholder: userPrompt && userPrompt.choice === "真心话" ? "老实交代…" : "描述你怎么完成…", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
            h("button", { "data-wk": "block", onClick: submitUserResp, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "交")));
    else if (wrap) {
      action = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 10 } }, "这一场散了。改天再聚，或者现在就再开一场。"),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "回中枢"),
          h("button", { "data-wk": "block", onClick: resetEvening, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: t.ink, borderRadius: 12, padding: "12px" } }, "再开一场")),
        h(KeepMemBtn, { t: t, host: props, rep: function () {
          const rounds = logDataRef.current.filter(function (x) { return x.type === "td"; }).length;
          // 真心话大冒险没有输赢（她 2026-10-12：「为啥真心话大冒险还有输赢」）：战报卡不写赢输，今晚之星只写进正文
          const star = wrap && wrap.star;
          return { proc: log, key: "tod", zh: "真心话大冒险", ids: realCharIds(players), wins: [],
            meWin: null,
            text: "一起玩了「真心话大冒险」，转了 " + rounds + " 轮" + (star ? "，今晚之星是" + (star.isUser ? "她" : star.name) : "") + "。" };
        } }));
    }
    else {
      const spun = log.some(function (x) { return x.type === "td"; });
      action = h("div", null,
        // 自由讨论输入：一轮做完后想聊多久聊多久
        h("div", { style: { display: "flex", gap: 8, marginBottom: 9 } },
          h("input", { "data-wk": "gameinput", "data-part": "chat", value: chatInput, onChange: function (e) { setChatInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendChat(); }, placeholder: spun ? "自由聊天…插句嘴 / 追问 / 起哄" : "先聊两句热热场，或直接转瓶子", style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "block", onClick: sendChat, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 16px" } }, "说")),
        h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
          h("button", { "data-wk": "block", onClick: keepChatting, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px" } }, "让他们接着聊（你不用发）"),
          h("button", { "data-wk": "block", onClick: spin, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "11px" } }, spun ? "转下一轮" : "转瓶子")),
        h(ToggleRow, { t: t, label: "尺度放开点", sub: "真心话 / 大冒险 会更暧昧大胆。", on: hot, onToggle: function () { setHot(!hot); } }),
        log.filter(function (x) { return x.type === "td"; }).length >= 3
          ? h("div", { style: { display: "flex", justifyContent: "center", marginTop: 9 } },
              h("button", { "data-wk": "block", onClick: doWrap, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, border: "1px solid " + t.line, background: "transparent", borderRadius: 999, padding: "6px 16px" } }, "散完这一场 · 评今晚之星"))
          : null);
    }

    return h("div", { "data-wk": "gameplay", "data-part": "td", className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, table) }, header, roster, logView,
      h("div", { "data-wk": "gameactions", "data-part": "td", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "44vh", overflowY: "auto" } }, action),
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), hideSkill: true, personaText: detail.isUser ? "这是你本人，真人玩家。" : tdDesc(detail, 0, true), onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // 大富翁 · 本地规则算钱与产权，模型只负责角色互动（绝不让模型改规则）
  // ============================================================
  const MONO_BOARD = [
    {type:"start",name:"起点",icon:"🚩"},
    {type:"property",name:"春日街",group:"晨曦",price:120,rent:22,color:"#d98f86"},
    {type:"bonus",name:"邻里基金",amount:70,icon:"🎁"},
    {type:"property",name:"月桂巷",group:"晨曦",price:150,rent:28,color:"#d98f86"},
    {type:"tax",name:"维修费",amount:100,icon:"🧾"},
    {type:"station",name:"南站",pair:15,icon:"🚇"},
    {type:"property",name:"海风路",group:"海岸",price:190,rent:36,color:"#71a7b7"},
    {type:"chance",name:"机会",icon:"🎴"},
    {type:"property",name:"星港",group:"海岸",price:220,rent:42,color:"#71a7b7"},
    {type:"property",name:"珊瑚路",group:"海岸",price:240,rent:47,color:"#71a7b7"},
    {type:"jail",name:"看守所",icon:"🔒"},
    {type:"property",name:"银杏街",group:"云城",price:270,rent:52,color:"#967ab4"},
    {type:"market",name:"小型交易所",icon:"📈"},
    {type:"property",name:"云顶路",group:"云城",price:300,rent:58,color:"#967ab4"},
    {type:"property",name:"天际坊",group:"云城",price:320,rent:63,color:"#967ab4"},
    {type:"station",name:"东站",pair:25,icon:"🚇"},
    {type:"property",name:"钟楼院",group:"学院",price:350,rent:68,color:"#6c8f78"},
    {type:"bonus",name:"奖学金",amount:90,icon:"📚"},
    {type:"property",name:"书院路",group:"学院",price:380,rent:74,color:"#6c8f78"},
    {type:"property",name:"博雅庭",group:"学院",price:400,rent:80,color:"#6c8f78"},
    {type:"free",name:"中央公园",icon:"🌳"},
    {type:"property",name:"烟火巷",group:"夜市",price:430,rent:86,color:"#c47d55"},
    {type:"chance",name:"命运",icon:"🔮"},
    {type:"property",name:"霓虹街",group:"夜市",price:460,rent:92,color:"#c47d55"},
    {type:"property",name:"不夜坊",group:"夜市",price:480,rent:98,color:"#c47d55"},
    {type:"station",name:"北站",pair:35,icon:"🚇"},
    {type:"property",name:"白茶庭",group:"花园",price:510,rent:104,color:"#91a866"},
    {type:"property",name:"紫藤园",group:"花园",price:540,rent:110,color:"#91a866"},
    {type:"market",name:"城市交易所",icon:"📊"},
    {type:"property",name:"琉璃温室",group:"花园",price:560,rent:116,color:"#91a866"},
    {type:"gotojail",name:"去看守所",icon:"🚓"},
    {type:"property",name:"灯塔湾",group:"港湾",price:590,rent:124,color:"#5d829f"},
    {type:"property",name:"月影码头",group:"港湾",price:620,rent:132,color:"#5d829f"},
    {type:"bonus",name:"港口分红",amount:110,icon:"⚓"},
    {type:"property",name:"鲸落港",group:"港湾",price:650,rent:140,color:"#5d829f"},
    {type:"station",name:"西站",pair:5,icon:"🚇"},
    {type:"chance",name:"机会",icon:"🎴"},
    {type:"property",name:"蔷薇大道",group:"蔷薇",price:690,rent:152,color:"#b86976"},
    {type:"tax",name:"城市基金",amount:180,icon:"🏛️"},
    {type:"property",name:"玫瑰广场",group:"蔷薇",price:740,rent:168,color:"#b86976"}
  ];
  const MONO_V2_NAMES=["起点","春日街","机会","月桂巷","维修费","海风路","南站","星港","看守所","银杏街","机会","云顶路","钟楼院","中央公园","书院路","去看守所","烟火巷","命运","霓虹街","城市基金","白茶庭","北站","紫藤园","灯塔湾","交易所","月影码头","蔷薇大道","玫瑰广场"];
  const MONO_LEGACY_NAMES=["起点","春日街","机会","月桂巷","维修费","海风路","机会","星港","休息站","银杏街","机会","云顶路","城市基金","灯塔湾","机会","玫瑰广场"];
  const MONO_CHANCE = [
    { text: "旧外套里翻出一张支票", amount: 140 },
    { text: "投资的小店分红了", amount: 110 },
    { text: "临时接到一笔奖金", amount: 90 },
    { text: "冲动消费后看到账单", amount: -80 },
    { text: "手机摔坏，紧急维修", amount: -110 },
    { text: "请全桌喝了顿好的", amount: -70 }
  ];
  function monoMove(pos, roll, len) { len = len || MONO_BOARD.length; const raw = pos + roll; return { pos: raw % len, passed: Math.floor(raw / len) }; }
  function monoGridPos(i) { if(i<=10)return {gridRow:11,gridColumn:i+1};if(i<=20)return {gridRow:21-i,gridColumn:11};if(i<=30)return {gridRow:1,gridColumn:31-i};return {gridRow:i-29,gridColumn:1}; }
  function monoOwnsGroup(playerKey, group, owners) { const ids=MONO_BOARD.map(function(x,i){return x.type==="property"&&x.group===group?i:-1;}).filter(function(i){return i>=0;}); return ids.length>1&&ids.every(function(i){return owners[i]===playerKey;}); }
  function monoRent(tileIndex, ownerKey, owners, levels) { const tile=MONO_BOARD[tileIndex]; if(!tile||tile.type!=="property")return 0; const lv=(levels&&levels[tileIndex])||0; return tile.rent*(monoOwnsGroup(ownerKey,tile.group,owners)?2:1)*(lv+1); }
  function monoNetWorth(player, owners, levels) { let worth = player.cash || 0; Object.keys(owners || {}).forEach(function (k) { if (owners[k] === player.key && MONO_BOARD[+k]) { const tile=MONO_BOARD[+k]; worth += tile.price || 0; worth += ((levels&&levels[k])||0)*Math.floor((tile.price||0)/2); } }); return worth; }
  function monoAdvance(players, current) { for (let n = 1; n <= players.length; n++) { const i = (current + n) % players.length; if (!players[i].bankrupt) return i; } return current; }
  function monoMaxMoves(total) { return Math.max(80,(total||2)*22); }
  function monoShouldFlush(count,event,beforeUser) { return count>=4||!!beforeUser||/破产|看守所|真人玩家|拍卖|竞价/.test(event||""); }
  function monoPlayerSnap(players) { return players.map(function (p) { return { key:p.key, name:p.name, isUser:!!p.isUser, isNpc:!!p.isNpc, engineer:!!p.engineer, skill:p.skill, persona:p.persona, cash:p.cash, pos:p.pos, bankrupt:!!p.bankrupt, jailed:p.jailed||0 }; }); }
  const MONO_TOKEN_COLORS=["#e24a3b","#3978d4","#2f9b67","#9b59b6","#e38b27","#16a5a5","#d94f91","#6857c8","#8b6b45","#506579"];
  function monoTokenColor(p,ps){const i=Math.max(0,(ps||[]).findIndex(function(x){return x.key===p.key;}));return MONO_TOKEN_COLORS[i%MONO_TOKEN_COLORS.length];}
  function monoHash(s){let h=2166136261;String(s||"").split("").forEach(function(c){h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return(h>>>0)/4294967295;}
  function monoStyle(p){const s=((p&&p.skill)||"")+" "+((p&&p.persona)||"");let risk=0;if(/冒险|激进|大胆|冲动|赌|梭哈|进攻/.test(s))risk+=1;if(/谨慎|保守|稳健|节俭|精打细算|风险厌恶/.test(s))risk-=1;if(/投资|经营|地产|生意|回报|收益/.test(s))risk+=.35;const m=s.match(/(?:现金|安全线|底线|至少保留|留足)[^\d]{0,10}\$?(\d{2,4})/);return{risk:risk,reserve:m?Math.max(100,Math.min(1200,+m[1])):Math.round(300-risk*90)};}
  function monoGroupProgress(p,tile,os){const ids=MONO_BOARD.map(function(x,i){return x.type==="property"&&x.group===tile.group?i:-1;}).filter(function(i){return i>=0;}),own=ids.filter(function(i){return os[i]===p.key;}).length;return{own:own,total:ids.length,completes:own===ids.length-1};}
  function monoNpcDecision(p,tile,tileIndex,ps,os,ls,moves,kind){const st=monoStyle(p),cost=kind==="upgrade"?Math.floor(tile.price/2):tile.price,after=p.cash-cost,g=monoGroupProgress(p,tile,os),worths=(ps||[]).filter(function(x){return !x.bankrupt;}).map(function(x){return monoNetWorth(x,os,ls);}),avg=worths.length?worths.reduce(function(a,b){return a+b;},0)/worths.length:0;let score=st.risk*.9+(after-st.reserve)/360+(tile.rent/tile.price-.16)*5+(monoNetWorth(p,os,ls)<avg? .25:-.08);if(kind==="buy"){score+=g.own*.72+(g.completes?2.1:0);}else{score+=g.completes?1.2:.15;score-=(ls[tileIndex]||0)*.32;}score+=(monoHash(p.key+":"+tileIndex+":"+moves+":"+kind)-.5)*.7;return{yes:after>=Math.max(80,st.reserve*.55)&&score>0,score:score,reserve:st.reserve};}
  function monoAuctionCap(p,tile,tileIndex,os){const st=monoStyle(p),g=monoGroupProgress(p,tile,os),floor=Math.ceil(tile.price*.55/10)*10,premium=1+st.risk*.08+g.own*.09+(g.completes?.16:0),cap=Math.floor(Math.min(p.cash-Math.max(90,st.reserve*.7),tile.price*premium)/10)*10;return Math.max(0,cap>=floor?cap:0);}
  function monoAuctionPlan(ps,os,tileIndex,excludedKey){const tile=MONO_BOARD[tileIndex],floor=Math.ceil(tile.price*.55/10)*10,step=Math.max(20,Math.ceil(tile.price*.05/10)*10),bidders=(ps||[]).map(function(p,i){return(!p.bankrupt&&p.key!==excludedKey)?{p:p,cap:p.isUser?Math.floor((p.cash||0)/10)*10:monoAuctionCap(p,tile,tileIndex,os),seat:i}:null;}).filter(function(x){return x&&x.cap>=floor;}).sort(function(a,b){return b.cap-a.cap||a.seat-b.seat;});if(!bidders.length)return{floor:floor,step:step,bidders:[],winner:null,bid:0};const winner=bidders[0],second=bidders[1],bid=second?Math.min(winner.cap,Math.max(floor,second.cap+step)):floor;return{floor:floor,step:step,bidders:bidders,winner:winner.p,bid:bid};}
  function hydMonoPlayers(saved, props, t) { return (saved || []).map(function (s) { let char = null; if (s.isUser) { const pf=props.profile||{}; char={name:pf.name||"你",avatarImage:pf.avatarImage,color:pf.color||t.tint}; } else if (!s.isNpc) char=(props.characters||[]).find(function(c){return c.id===s.key;})||null; const engineer=!s.isUser&&!s.isNpc&&!!(props.config&&props.config.ccSeat!==false&&props.isEngineer&&props.isEngineer(s.key)); return Object.assign({},s,{char:char,alive:!s.bankrupt,engineer:engineer||!!s.engineer}); }); }
  function monoCleanLogs(logs) { const oldRule=/每人带着 \$1200|45 回合|28 格城市棋盘/;const kept=(logs||[]).filter(function(x){return !oldRule.test(String(x&&x.say||""));});return kept.length===((logs||[]).length)?kept:[{type:"sys",say:"棋盘已升级为经典 40 格；每人约 22 手，旧局资金和产权均已保留。"}].concat(kept); }
  function monoMigrateSave(sv) { if(!sv)return sv;if(sv.boardVersion===3)return Object.assign({},sv,{logs:monoCleanLogs(sv.logs)});const names=sv.boardVersion===2?MONO_V2_NAMES:MONO_LEGACY_NAMES,out=Object.assign({},sv,{boardVersion:3,owners:{},levels:{}}),find=function(oldIndex){const nm=names[oldIndex]||"起点";if(nm==="休息站")return 20;if(nm==="交易所")return 28;const hits=[];MONO_BOARD.forEach(function(x,i){if(x.name===nm)hits.push(i);});return hits[0]!=null?hits[0]:Math.round((oldIndex||0)*39/(names.length-1));};Object.keys(sv.owners||{}).forEach(function(k){out.owners[find(+k)]=sv.owners[k];});Object.keys(sv.levels||{}).forEach(function(k){out.levels[find(+k)]=sv.levels[k];});out.players=(sv.players||[]).map(function(p){return Object.assign({},p,{pos:find(p.pos||0)});});out.logs=monoCleanLogs(sv.logs);return out; }

  async function setupMonopoly(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i+1)+". "+p.name+"："+(p.persona||"（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是大富翁桌游的 NPC 生成器与玩家风格评估器。生成 "+npcCount+" 个职业、性格各异的 NPC；并给每个真实玩家和 NPC 一句 skill，明确其风险偏好、现金安全线、谈判/读人能力。不要把内向等同于笨，也不要写胜负结果。\n【真实玩家】\n"+(lines||"（只有NPC）")+"\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"\",\"skill\":\"\"}]}";
    const raw = await callRetry(api, sys, [{role:"user",content:"生成本桌玩家。"}], {maxTokens:11200}); return extractJSON(raw)||{};
  }
  async function monoTalk(api, players, event, standings, recent) {
    // 大富翁的买地/移动仍由规则引擎结算；攒成一批事件后，言秋本人收到一张桌上发言票。
    const pool = players.filter(function(p){return !p.isUser && !p.bankrupt;});
    const cc = await ccCarve("monopoly", pool, {
      turnId: freshCCTurn("monopoly-talk:"),
      sys: "「大富翁」桌上刚连续发生了这些事：\n" + event + "\n【账面事实】" + standings + "\n【最近桌上话】" + (recent || "无") + "\n想说就给 1～2 句面对面口语（可讨价还价、嘴硬、幸灾乐祸、安慰或威胁下回合收租）；不想说 lines 留空。不能改钱、产权或规则数据。",
      expect: '{"lines":["最多两句，可空"]}'
    });
    const cast = cc.rest.map(function(p){return "■ "+p.name+gNote(p)+"｜人设："+(p.isNpc?p.persona:((p.char&&p.char.persona)||p.persona||""))+"｜玩法："+(p.skill||"普通");}).join("\n");
    const sys = AC + "\n你在主持一桌有熟人感的大富翁。刚发生：【"+event+"】。账面（这是唯一事实，严禁改钱、改产权、送地或声称规则外交易）："+standings+"。\n此刻有反应的人开口，面对面口语；每个人" + GAME_SAY_FREE + "同一个人连着说几句，就在 talks 里连着放几条。可以讨价还价、嘴硬、幸灾乐祸、安慰、翻旧账、威胁下回合收租、短暂站队；要点名并针对刚发生的事，不要轮流播报，不要都温柔，也不要替真人玩家说话。交易/结盟只能是嘴上态度，不能改变规则数据。避免重复最近说过的话。\n"+cast+"\n【最近】"+(recent||"无")+"\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    let talks=[];
    if(cc.rest.length){const raw=await callRetry(api,sys+ccPreface(cc,"说过自己那句了（也可能选择沉默）"),[{role:"user",content:"让牌桌对这件事起反应。"}],{maxTokens:9800}); const p=extractJSON(raw); talks=p&&Array.isArray(p.talks)?p.talks:[];}
    if(cc.seat&&cc.done&&Array.isArray(cc.done.lines))cc.done.lines.slice(0,2).forEach(function(line){const say=String(line||"").trim();if(say)talks.push({name:cc.seat.name,say:say.slice(0,80)});});
    return talks;
  }

  // 收购谈判：模型只出【接受 / 拒绝 / 还一个价】和一句话，钱和地契的变动全在本地规则里走。
  // 还价会被钳制（高于出价、不超过地价三倍+等级溢价），模型报天价也改不了账。
  async function monoTradeDecide(api, owner, tile, lv, offer, standings, recent, isEngineer, ownerKey) {
    if (isEngineer && typeof window !== "undefined" && window.CCSeat) {
      try {
        const raw = await window.CCSeat.ask({
          tool: "game_turn", game: "monopoly_trade",
          turn_id: "mono-trade:" + ownerKey + ":" + tile.name + ":" + offer + ":" + Date.now().toString(36),
          char_id: ownerKey,
          sys: "「大富翁」真人玩家想收购你名下的【" + tile.name + "】（地价 $" + tile.price + "，等级 " + lv + "），开价 $" + offer + "。你只决定：接受 / 拒绝 / 还一个价，外加一句你会说的话。只输出 JSON：{\"accept\":true/false,\"counter\":还价数字或0,\"say\":\"一句话\"}。",
          msgs: [{ role: "user", content: "【各家账面】" + standings + (recent ? "\n【桌上最近】\n" + recent : "") }],
          expect: "{\"accept\":false,\"counter\":0,\"say\":\"一句话\"}"
        }, 90000, { charId: ownerKey });
        return raw || {};
      } catch (e) { return { accept: false, counter: 0, say: "", missed: true }; }
    }
    const sys = AC + SKILL_RULE + "\n\n「大富翁」牌桌上，真人玩家想收购【" + owner.name + "】名下的【" + tile.name + "】（地价 $" + tile.price + "，当前等级 " + lv + (tile.group ? "，属于「" + tile.group + "」组" : "") + "），开价 $" + offer + "。\n" + owner.name + " 的人设：" + (owner.persona || "（没写）") + "（真实水平：" + (owner.skill || "普通") + "）\n按 TA 的人设和账面利益决定：接受 / 拒绝 / 还一个价。会算账的人看得出成组的地和高等级的地更值钱；重感情或记仇的人可能不按市价来。你只输出决定和一句 TA 会说的话——钱和地契由规则代码执行，你改不了账。\n【各家账面】" + standings + (recent ? "\n【桌上最近】\n" + recent : "") +
      "\n\n【输出】只输出 JSON：{\"accept\":true/false,\"counter\":还价数字（不还价填 0）,\"say\":\"TA 说的一句话\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "你卖不卖？" }], { maxTokens: 8800 });
    return extractJSON(raw) || {};
  }
  function MonopolyGame(props) {
    const t=props.t, cfg=props.config, api=props.active, sv=monoMigrateSave(props.savedState);
    const [phase,setPhase]=useState(sv?"play":"loading"), [players,setPlayers]=useState(sv?hydMonoPlayers(sv.players,props,t):[]);
    const [owners,setOwners]=useState(sv&&sv.owners?sv.owners:{}), [levels,setLevels]=useState(sv&&sv.levels?sv.levels:{}), [turn,setTurn]=useState(sv?sv.turn||0:0), [moves,setMoves]=useState(sv?sv.moves||0:0);
    const [logs,setLogs]=useState(sv&&sv.logs?sv.logs:[]), [busy,setBusy]=useState(false), [pending,setPending]=useState(null), [winner,setWinner]=useState(sv?sv.winner:null), [error,setError]=useState(""), [tableSay,setTableSay]=useState(""), [boardOpen,setBoardOpen]=useState(true), [selectedTile,setSelectedTile]=useState(null), [tradeOffer,setTradeOffer]=useState("");
    const pAvatar=avatarFor(t);
    const interactionQueue=useRef([]);const [talkMiss,setTalkMiss]=useState(null);const monoInflight=useRef(false);
    const gameRunId=useRef("monopoly-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9));
    const maxMoves=monoMaxMoves(players.length||cfg.total||2);
    useEffect(function(){ if(sv)return; let dead=false; (async function(){try{const data=await setupMonopoly(api,realPlayerLines(cfg,props),cfg.npcCount||0); if(dead)return; const ps=shuffle(buildRoster(cfg,props,t,data.npcs,data.skills)).map(function(p){return Object.assign({},p,{cash:(cfg.mode==="easy"&&p.isUser)?2450:2200,pos:0,bankrupt:false,jailed:0});}); setPlayers(ps); setLogs([{type:"sys",say:"经典 40 格城市棋盘开局：每人 $2200，绕过起点领 $200；每人约 22 手后按总资产结算。"}]); setPhase("play");}catch(e){if(!dead){setError(e.message||"开局失败");setPhase("error");}}})(); return function(){dead=true;};},[]);
    // 看门狗（群友 2026-10-03：「就是页面不动了，但是其他按键可以点」）：角色接话那一枪是模型调用，
    //   上游不回、或者某一步抛错没走到 setBusy(false)，掷骰键就永远停在「…角色们正在接话」。
    //   账面是本地规则算的，早就落定了——接话没回来只是少几句台词，不该把整局卡死。
    useEffect(function(){ if(!busy)return; const tm=setTimeout(function(){setBusy(false);addLogs([{type:"sys",say:"角色们这轮没接上话，先接着玩（下面可以点「再试一次」）。"}]);},60000); return function(){clearTimeout(tm);}; },[busy]);
    useEffect(function(){ if(phase!=="play"||!players.length)return; saveGameSnap("monopoly",{boardVersion:3,config:cfg,players:monoPlayerSnap(players),owners:owners,levels:levels,turn:turn,moves:moves,logs:logs.slice(-60),winner:winner,label:"第 "+(moves+1)+" / "+maxMoves+" 手 · "+players.filter(function(p){return !p.bankrupt;}).length+" 人在场"}); },[players,owners,levels,turn,moves,logs,phase,winner]);
    useEffect(function(){
      if(phase!=="result"||!players.length)return;
      const ranking=players.slice().sort(function(a,b){return monoNetWorth(b,owners,levels)-monoNetWorth(a,owners,levels);});
      const userSeat=players.find(function(p){return p.isUser;});
      ccGameResult("monopoly",gameRunId.current,players,cfg,
        "《大富翁》结算，"+(ranking[0]?ranking[0].name:"无人")+" 获胜。\n"
        +"最终排名："+ranking.map(function(p,i){return(i+1)+". "+p.name+"，总资产 $"+monoNetWorth(p,owners,levels)+(p.bankrupt?"（破产）":"");}).join("；")+"。\n"
        +((userSeat && userSeat.name) || "用户")+"："+(userSeat?("第 "+(ranking.indexOf(userSeat)+1)+" 名，总资产 $"+monoNetWorth(userSeat,owners,levels)) : "本局观战")+"。\n"
        +"最后记录：\n"+logs.slice(-8).map(function(x){return x.say||"";}).filter(Boolean).join("\n"));
    },[phase,winner]);
    function standings(ps,os){return ps.map(function(p){return p.name+" $"+p.cash+"/地"+Object.keys(os).filter(function(k){return os[k]===p.key;}).length+(p.bankrupt?"(破产)":"");}).join("；");}
    function addLogs(xs){setLogs(function(old){return old.concat(xs).slice(-80);});}
    async function react(ps,os,event,force){if(event)interactionQueue.current.push(event);if(!force&&!monoShouldFlush(interactionQueue.current.length,event,false))return;const batch=interactionQueue.current.splice(0,4);if(!batch.length)return;try{const recent=logs.slice(-8).map(function(x){return (x.name?x.name+"：":"")+x.say;}).join("｜"),bundle=batch.map(function(x,i){return (i+1)+". "+x;}).join("\n"); const ts=await Promise.race([monoTalk(api,ps,"以下是连续发生的 "+batch.length+" 次行动，请让发言分别接住其中值得回应的节点：\n"+bundle,standings(ps,os),recent),new Promise(function(_,no){setTimeout(function(){no(new Error("接话超时"));},50000);})]); const valid={};ps.forEach(function(p){valid[p.name]=p;}); addLogs(ts.filter(function(x){return x&&valid[x.name]&&!valid[x.name].isUser;}).map(function(x){return {type:"talk",name:x.name,say:String(x.say||"").slice(0,200)};}));setTalkMiss(null);}catch(e){setTalkMiss({batch:batch});}
    }
    function finishIfNeeded(ps,os,ls,nextMoves){const alive=ps.filter(function(p){return !p.bankrupt;}); if(alive.length<=1||nextMoves>=monoMaxMoves(ps.length)){const ranked=ps.slice().sort(function(a,b){return monoNetWorth(b,os,ls)-monoNetWorth(a,os,ls);}); setWinner(ranked[0]);setPhase("result");clearGameSave("monopoly");return true;} return false;}
    async function finalize(ps,os,ls,event,eventLogs,extra){setPlayers(ps);setOwners(os);setLevels(ls);const nm=moves+1;setMoves(nm);addLogs(eventLogs);if(finishIfNeeded(ps,os,ls,nm)){interactionQueue.current=[];setBusy(false);return;}const next=extra&&!ps[turn].bankrupt?turn:monoAdvance(ps,turn);setTurn(next);if(event){const beforeUser=ps[next]&&ps[next].isUser;await react(ps,os,event,monoShouldFlush(interactionQueue.current.length+1,event,beforeUser));}setBusy(false);}
    function bankruptIfNeeded(ps,idx,os,reason){if(ps[idx].cash>=0)return null;ps[idx].bankrupt=true;ps[idx].alive=false;Object.keys(os).forEach(function(k){if(os[k]===ps[idx].key)delete os[k];});return ps[idx].name+"付不起钱，宣布破产，名下土地回到银行"+(reason?"（"+reason+"）":"")+"。";}
    function runAuction(ps,os,tileIndex,excludedKey,ls,eventParts,lv,extra){const tile=MONO_BOARD[tileIndex],plan=monoAuctionPlan(ps,os,tileIndex,excludedKey);if(!plan.bidders.length){ls.push({type:"sys",say:tile.name+" 流拍，暂时留在银行。"});return null;}const userBid=plan.bidders.find(function(x){return x.p.isUser&&cfg.mode!=="spectate";});ls.push({type:"event",say:"🔨 "+tile.name+" 进入公开竞价，起拍价 $"+plan.floor+"；"+plan.bidders.map(function(x){return x.p.name;}).join("、")+" 举牌。"});if(userBid){return{kind:"auction",tile:tileIndex,ps:ps,os:os,lv:lv,extra:extra,ask:plan.floor,step:plan.step,activeKeys:plan.bidders.map(function(x){return x.p.key;}),caps:Object.fromEntries(plan.bidders.map(function(x){return[x.p.key,x.cap];})),auctionEvents:eventParts.slice()};}const win=plan.winner;plan.bidders.slice().reverse().forEach(function(x){if(x.p.key!==win.key)ls.push({type:"sys",say:x.p.name+" 跟到 $"+Math.min(x.cap,plan.bid-plan.step)+" 后退出竞价。"});});win.cash-=plan.bid;os[tileIndex]=win.key;ls.push({type:"event",say:"🔨 "+win.name+" 最终以 $"+plan.bid+" 拍下 "+tile.name+"。"});eventParts.push(win.name+"经过多轮竞价拍下"+tile.name+"，成交$"+plan.bid);return null;}
    async function playTurn(){if(busy||phase!=="play"||pending)return;setBusy(true);const ps=players.map(function(p){return Object.assign({},p);}), os=Object.assign({},owners), lv=Object.assign({},levels), p=ps[turn];if(!p||p.bankrupt){setTurn(monoAdvance(ps,turn));setBusy(false);return;}if(p.jailed){p.jailed=0;await finalize(ps,os,lv,p.name+"在看守所里错过一手",[{type:"bad",say:"🔒 "+p.name+" 在看守所待了一手，今天不能掷骰子。"}],false);return;}const d1=1+Math.floor(Math.random()*6),d2=1+Math.floor(Math.random()*6),roll=d1+d2,extra=d1===d2,mv=monoMove(p.pos,roll);p.pos=mv.pos;if(mv.passed)p.cash+=200*mv.passed;const tile=MONO_BOARD[p.pos], base=p.name+" 掷出 "+d1+" + "+d2+" = "+roll+(extra?"（双骰）":"")+"，走到【"+tile.name+"】"+(mv.passed?"，经过起点领 $"+(200*mv.passed):"")+"。";const ls=[{type:"move",name:p.name,say:base}], eventParts=[];
      if(tile.type==="property") {const ownerKey=os[p.pos]; if(!ownerKey){if(p.isUser&&cfg.mode!=="spectate"){setPlayers(ps);setOwners(os);setLevels(lv);addLogs(ls);setPending({kind:"buy",tile:p.pos,ps:ps,os:os,lv:lv,extra:extra});setBusy(false);return;}const choice=monoNpcDecision(p,tile,p.pos,ps,os,lv,moves,"buy");if(choice.yes){p.cash-=tile.price;os[p.pos]=p.key;ls.push({type:"event",say:p.name+" 用 $"+tile.price+" 买下了 "+tile.name+"。"});eventParts.push(p.name+"买下"+tile.name);}else{ls.push({type:"sys",say:p.name+" 衡量现金和地段后放弃 "+tile.name+"，银行随即开拍。"});const aq=runAuction(ps,os,p.pos,p.key,ls,eventParts,lv,extra);if(aq){setPlayers(ps);setOwners(os);setLevels(lv);addLogs(ls);setPending(aq);setBusy(false);return;}}}
        else if(ownerKey!==p.key){const oi=ps.findIndex(function(x){return x.key===ownerKey;}), owner=ps[oi],rent=monoRent(p.pos,ownerKey,os,lv);if(owner&&!owner.bankrupt){p.cash-=rent;owner.cash+=rent;ls.push({type:"event",say:p.name+" 向 "+owner.name+" 支付 "+tile.name+" 租金 $"+rent+"。"});eventParts.push(p.name+"踩进"+owner.name+"的"+tile.name+"并付租$"+rent);const bk=bankruptIfNeeded(ps,turn,os,"欠 "+owner.name+" 租金");if(bk){ls.push({type:"bad",say:bk});eventParts.push(bk);}}}else {const cost=Math.floor(tile.price/2),eligible=monoOwnsGroup(p.key,tile.group,os)&&(lv[p.pos]||0)<3,choice=eligible?monoNpcDecision(p,tile,p.pos,ps,os,lv,moves,"upgrade"):{yes:false};if(eligible&&p.isUser&&cfg.mode!=="spectate"){setPlayers(ps);setOwners(os);setLevels(lv);addLogs(ls);setPending({kind:"upgrade",tile:p.pos,ps:ps,os:os,lv:lv,extra:extra});setBusy(false);return;}if(eligible&&!p.isUser&&choice.yes){p.cash-=cost;lv[p.pos]=(lv[p.pos]||0)+1;ls.push({type:"event",say:p.name+" 给 "+tile.name+" 升到 "+lv[p.pos]+" 级，花费 $"+cost+"。"});eventParts.push(p.name+"升级"+tile.name);}else ls.push({type:"sys",say:"这里是 "+p.name+" 自己的地，巡视一圈。"});}}
      else if(tile.type==="chance"){const c=MONO_CHANCE[Math.floor(Math.random()*MONO_CHANCE.length)];p.cash+=c.amount;ls.push({type:"event",say:"🎴 "+c.text+"："+(c.amount>=0?"+":"")+"$"+c.amount+"。"});eventParts.push(p.name+"抽到机会："+c.text+(c.amount>=0?"赚":"花")+"$"+Math.abs(c.amount));const bk=bankruptIfNeeded(ps,turn,os,"机会事件");if(bk){ls.push({type:"bad",say:bk});eventParts.push(bk);}}
      else if(tile.type==="tax"){p.cash-=tile.amount;ls.push({type:"event",say:p.name+" 支付 "+tile.name+" $"+tile.amount+"。"});eventParts.push(p.name+"被收"+tile.name+"$"+tile.amount);const bk=bankruptIfNeeded(ps,turn,os,tile.name);if(bk){ls.push({type:"bad",say:bk});eventParts.push(bk);}}
      else if(tile.type==="bonus"){p.cash+=tile.amount;ls.push({type:"event",say:p.name+" 在 "+tile.name+" 收到城市活动奖励 $"+tile.amount+"。"});eventParts.push(p.name+"在"+tile.name+"得到$"+tile.amount);}
      else if(tile.type==="gotojail"){p.pos=10;p.jailed=1;ls.push({type:"bad",say:"🚓 "+p.name+" 被送去看守所，下一手暂停行动。"});eventParts.push(p.name+"被送进看守所");}
      else if(tile.type==="station"){const from=p.pos,to=tile.pair,passed=to<from;p.pos=to;if(passed)p.cash+=200;ls.push({type:"event",say:"🚇 "+p.name+" 搭城际线直达 "+MONO_BOARD[to].name+(passed?"，途中经过起点领 $200":"")+"。"});eventParts.push(p.name+"从"+tile.name+"搭车到"+MONO_BOARD[to].name);}
      else if(tile.type==="market"){const swing=Math.random()<.5?-120:160;p.cash+=swing;ls.push({type:"event",say:"📈 "+p.name+" 在交易所"+(swing>0?"押对行情赚了":"追高被套亏了")+" $"+Math.abs(swing)+"。"});eventParts.push(p.name+"在交易所"+(swing>0?"赚":"亏")+"$"+Math.abs(swing));const bk=bankruptIfNeeded(ps,turn,os,"交易所亏损");if(bk){ls.push({type:"bad",say:bk});eventParts.push(bk);}}
      if(extra&&!p.bankrupt)ls.push({type:"sys",say:p.name+" 掷出双骰，下一手仍由 TA 行动。"});await finalize(ps,os,lv,eventParts.join("；"),ls,extra);
    }
    // 竞拍点了没反应（她 2026-10-03 截图：举牌、退出两颗都灰着）——这两步里任何一处抛错，busy 就永远不放，
    //   按钮全灰、看门狗要一分钟后才救。包一层：出错当场放开，并把错误原文写进桌面记录，下次截图就能看见病根。
    // 按钮不再看全局 busy（那是「角色在接话」的锁，跟这一下无关），自己用 inflight 防连点。
    function monoGuard(fn){return async function(arg){if(monoInflight.current)return;monoInflight.current=true;try{await fn(arg);}catch(e){console.error(e);setBusy(false);addLogs([{type:"bad",say:"这一步出了点问题："+String((e&&e.message)||e).slice(0,120)}]);}finally{monoInflight.current=false;}};}
    const decideProperty=monoGuard(decidePropertyRaw), decideAuction=monoGuard(decideAuctionRaw);
    async function decidePropertyRaw(yes){if(!pending)return;setBusy(true);const q=pending,ps=q.ps.map(function(p){return Object.assign({},p);}),os=Object.assign({},q.os),lv=Object.assign({},q.lv),p=ps[turn],tile=MONO_BOARD[q.tile],ls=[],events=[];if(q.kind==="upgrade"){const cost=Math.floor(tile.price/2);if(yes&&p.cash>=cost){p.cash-=cost;lv[q.tile]=(lv[q.tile]||0)+1;ls.push({type:"event",say:"你把 "+tile.name+" 升到 "+lv[q.tile]+" 级，花费 $"+cost+"。"});events.push(p.name+"升级"+tile.name);}else ls.push({type:"sys",say:"你暂时没有升级 "+tile.name+"。"});}else if(yes&&p.cash>=tile.price){p.cash-=tile.price;os[q.tile]=p.key;ls.push({type:"event",say:"你用 $"+tile.price+" 买下了 "+tile.name+"。"});events.push(p.name+"买下"+tile.name);}else{ls.push({type:"sys",say:"你放弃原价购买 "+tile.name+"，银行开始拍卖。"});
      // 放弃原价也能进拍卖举牌（她 2026-10-03：「为啥竞拍都不给我竞拍直接跳过了」）——原来把她自己排除在外、
      //   而且 runAuction 交回来的竞价单直接丢了，于是她点完「不买」只能看着别人拍走。现实大富翁里放弃的人也能竞价。
      const aq=runAuction(ps,os,q.tile,null,ls,events,lv,q.extra);if(aq){setPlayers(ps);setOwners(os);setLevels(lv);addLogs(ls);setPending(aq);setBusy(false);return;}}setPending(null);await finalize(ps,os,lv,events.join("；"),ls,q.extra);}
    // ⚠️active 下面要重新赋值，原来跟着上面那串写成了 const——iPhone 上一点举牌/退出就报「Attempted to assign to readonly property」（群友 2026-10-08）
    async function decideAuctionRaw(stay){if(!pending||pending.kind!=="auction")return;setBusy(true);const q=pending,ps=q.ps.map(function(p){return Object.assign({},p);}),os=Object.assign({},q.os),lv=Object.assign({},q.lv),tile=MONO_BOARD[q.tile],me=ps.find(function(p){return p.isUser;}),ls=[],ask=q.ask;let active=(q.activeKeys||[]).slice();if(!stay||!me||me.cash<ask){active=active.filter(function(k){return !me||k!==me.key;});ls.push({type:"sys",say:(me?me.name:"你")+" 在 $"+ask+" 这一轮退出竞价。"});}else ls.push({type:"event",say:"你举牌跟到 $"+ask+"。"});const dropped=[];active=active.filter(function(k){const p=ps.find(function(x){return x.key===k;});if(!p||p.isUser)return!!p;const ok=(q.caps[k]||0)>=ask;if(!ok)dropped.push(p.name);return ok;});if(dropped.length)ls.push({type:"sys",say:dropped.join("、")+" 认为价格超过预期，退出竞价。"});if(active.length===0){ls.push({type:"sys",say:tile.name+" 无人继续出价，拍卖流拍。"});setPending(null);await finalize(ps,os,lv,"",ls,q.extra);return;}if(active.length===1){const win=ps.find(function(p){return p.key===active[0];});win.cash-=ask;os[q.tile]=win.key;ls.push({type:"event",say:"🔨 "+win.name+" 以 $"+ask+" 拍下 "+tile.name+"。"});setPending(null);await finalize(ps,os,lv,win.name+"经过竞价拍下"+tile.name+"，成交$"+ask,ls,q.extra);return;}const userStill=me&&active.indexOf(me.key)>=0;if(userStill){const npcNames=active.map(function(k){return ps.find(function(p){return p.key===k;});}).filter(function(p){return p&&!p.isUser;}).map(function(p){return p.name;});if(npcNames.length)ls.push({type:"event",say:npcNames.join("、")+" 也跟价，拍卖继续。"});addLogs(ls);setPending(Object.assign({},q,{ps:ps,os:os,lv:lv,activeKeys:active,ask:ask+q.step}));setBusy(false);return;}const ranked=active.map(function(k,i){return{p:ps.find(function(p){return p.key===k;}),cap:q.caps[k]||0,seat:i};}).sort(function(a,b){return b.cap-a.cap||a.seat-b.seat;}),win=ranked[0].p,second=ranked[1],bid=second?Math.min(ranked[0].cap,Math.max(ask,second.cap+q.step)):ask;ranked.slice(1).reverse().forEach(function(x){ls.push({type:"sys",say:x.p.name+" 跟到 $"+Math.min(x.cap,bid-q.step)+" 后退出竞价。"});});win.cash-=bid;os[q.tile]=win.key;ls.push({type:"event",say:"🔨 "+win.name+" 最终以 $"+bid+" 拍下 "+tile.name+"。"});setPending(null);await finalize(ps,os,lv,win.name+"经过多轮竞价拍下"+tile.name+"，成交$"+bid,ls,q.extra);}
    // 成交的转账和地契过户【只在这里发生】——模型说破天也只是嘴
    function settleTrade(tileIndex,price){const ps=players.map(function(p){return Object.assign({},p);}),os=Object.assign({},owners),me2=ps.find(function(p){return p.isUser;}),ow=ps.find(function(p){return p.key===os[tileIndex];});if(!me2||!ow||me2.cash<price){setPending(null);return;}me2.cash-=price;ow.cash+=price;os[tileIndex]=me2.key;setPlayers(ps);setOwners(os);addLogs([{type:"event",say:"🤝 成交！"+me2.name+" 以 $"+price+" 从 "+ow.name+" 手里买下 "+MONO_BOARD[tileIndex].name+"。"}]);setPending(null);}
    async function sendOffer(){
      const q=pending;if(!q||q.kind!=="trade"||q.step!=="offer"||busy)return;
      const me2=players.find(function(p){return p.isUser;}),tile=MONO_BOARD[q.tile],owner=players.find(function(p){return p.key===owners[q.tile];});
      const offer=Math.floor(Number(tradeOffer));
      if(!me2||!owner||!tile)return void setPending(null);
      if(!(offer>0))return void (props.toast&&props.toast("先写个价"));
      if(offer>me2.cash)return void (props.toast&&props.toast("现金不够开这个价"));
      setBusy(true);setTradeOffer("");
      addLogs([{type:"talk",name:me2.name,say:"我想买你的【"+tile.name+"】，出 $"+offer+"。"}]);
      try{
        const isEng=!!owner.engineer||!!(cfg.ccSeat!==false&&props.isEngineer&&props.isEngineer(owner.key));
        const r=await monoTradeDecide(api,owner,tile,levels[q.tile]||0,offer,standings(players,owners),logs.slice(-6).map(function(x){return (x.name?x.name+"：":"")+x.say;}).join("｜"),isEng,owner.key);
        const say=String(r.say||"").trim().slice(0,120);
        if(r.missed){addLogs([{type:"sys",say:owner.name+" 这会儿没心思谈这单（本人票没送达，按不卖处理）。"}]);setPending(null);}
        else if(r.accept){if(say)addLogs([{type:"talk",name:owner.name,say:say}]);settleTrade(q.tile,offer);}
        else{
          let counter=Math.floor(Number(r.counter)||0);
          if(counter>0)counter=Math.max(offer+10,Math.min(counter,tile.price*3+(levels[q.tile]||0)*tile.price));
          if(say)addLogs([{type:"talk",name:owner.name,say:say}]);
          if(counter>0){addLogs([{type:"sys",say:owner.name+" 还价 $"+counter+"。"}]);setPending({kind:"trade",tile:q.tile,step:"counter",counter:counter});}
          else{addLogs([{type:"sys",say:owner.name+" 不肯卖 "+tile.name+"。"}]);setPending(null);}
        }
      }catch(e){addLogs([{type:"sys",say:owner.name+" 摆摆手，这单没谈成。"}]);setPending(null);}
      finally{setBusy(false);}
    }
    async function sendTableTalk(){const say=tableSay.trim();if(!say||busy)return;setTableSay("");addLogs([{type:"talk",name:(props.profile&&props.profile.name)||"你",say:say}]);setBusy(true);await react(players,owners,"真人玩家说：『"+say.slice(0,100)+"』，请直接回应这句话，不改变账面",true);setBusy(false);}
    if(phase==="loading")return h("div",{ "data-wk": "gameplay", "data-part": "monopoly", "data-kind": "loading", className:"h-full flex flex-col",style:gameTable("monopoly",t)},h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack,bg:"transparent"}),h("div",{className:"flex-1 flex items-center justify-center",style:{fontFamily:F_BODY,color:t.fog}},"…正在摆棋盘、摸清每个人的玩法"));
    if(phase==="error")return h("div",{ "data-wk": "gameplay", "data-part": "monopoly", "data-kind": "error", className:"h-full flex flex-col",style:gameTable("monopoly",t)},h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack,bg:"transparent"}),h("div",{className:"flex-1 flex flex-col items-center justify-center px-8",style:{fontFamily:F_BODY,color:t.sub}},error,h("button",{onClick:props.onBack,style:{marginTop:16,padding:"10px 22px",borderRadius:12,background:t.ink,color:"#fff"}},"返回")));
    const cur=players[turn], propertyCount=function(k){return Object.keys(owners).filter(function(i){return owners[i]===k;}).length;},focusTile=selectedTile==null?null:MONO_BOARD[selectedTile],focusOwner=selectedTile==null?null:players.find(function(p){return p.key===owners[selectedTile];});
    const header=h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack,bg:"transparent"});
    const board=boardOpen?h("div",{style:{display:"grid",gridTemplateColumns:"repeat(11,minmax(0,1fr))",gridTemplateRows:"repeat(11,30px)",gap:2,padding:"4px 7px",flexShrink:0}},h("div",{style:{gridColumn:"2 / 11",gridRow:"2 / 11",borderRadius:13,background:t.bg2,border:"1px solid "+t.line,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:5}},h("div",{style:{fontSize:18}},focusTile?(focusTile.icon||"🏠"):"🏙️"),h("div",{style:{fontFamily:F_DISPLAY,fontSize:14,color:t.ink,marginTop:2}},focusTile?focusTile.name:(cur?(cur.name+(cur.isUser?"（你）":"")):"经典城市棋盘")),h("div",{style:{fontFamily:F_BODY,fontSize:10,color:t.sub,marginTop:3,lineHeight:1.4}},focusTile?(focusTile.type==="property"?("价格 $"+focusTile.price+" · "+(focusOwner?("归 "+focusOwner.name+" · Lv"+(levels[selectedTile]||0)+" · 租 $"+monoRent(selectedTile,focusOwner.key,owners,levels)):"银行持有")):(focusTile.type==="tax"?"支付 $"+focusTile.amount:(focusTile.type==="station"?"搭乘城市环线":focusTile.name))):("第 "+(moves+1)+" / "+maxMoves+" 手 · "+players.filter(function(p){return !p.bankrupt;}).length+" 人在场")),h("div",{style:{display:"flex",gap:6,marginTop:6}},
        (focusTile&&focusTile.type==="property"&&focusOwner&&!focusOwner.isUser&&!focusOwner.bankrupt&&phase==="play"&&!pending&&!busy&&players.some(function(p){return p.isUser&&!p.bankrupt;}))?h("button",{onClick:function(){setPending({kind:"trade",tile:selectedTile,step:"offer"});setTradeOffer("");},style:{fontFamily:F_BODY,fontSize:9.5,fontWeight:700,color:t.bg2,background:t.tint,padding:"4px 10px",borderRadius:999}},"谈收购"):null,
        h("button",{onClick:function(){if(selectedTile!=null)setSelectedTile(null);else setBoardOpen(false);},style:{fontFamily:F_BODY,fontSize:9.5,color:t.tint,padding:"4px 10px",border:"1px solid "+t.line,borderRadius:999}},selectedTile!=null?"返回回合信息":"收起棋盘 · 看对话"))),MONO_BOARD.map(function(tile,i){const here=players.filter(function(p){return !p.bankrupt&&p.pos===i;}),own=owners[i],owner=players.find(function(p){return p.key===own;}),lv=levels[i]||0,pos=monoGridPos(i);return h("button",{key:i,onClick:function(){setSelectedTile(i);},title:tile.name+(tile.price?" $"+tile.price:""),style:Object.assign({},pos,{borderRadius:5,padding:"2px 1px",background:tile.type==="property"?(tile.color+"35"):t.bg2,border:"1px solid "+(i===(cur&&cur.pos)?t.tint:t.line),textAlign:"center",overflow:"hidden",minWidth:0})},h("div",{style:{fontFamily:F_BODY,fontSize:7.5,lineHeight:1.08,color:t.sub,whiteSpace:"normal",wordBreak:"break-all",height:17,overflow:"hidden"}},tile.icon||"▪",tile.name),h("div",{style:{fontSize:6.5,color:t.fog,whiteSpace:"nowrap",overflow:"hidden"}},tile.price?(owner?(owner.name.slice(0,2)+(lv?" L"+lv:"")):("$"+tile.price)):(tile.type==="station"?"直达":"")),h("div",{style:{height:9,display:"flex",alignItems:"center",justifyContent:"center",gap:1}},here.map(function(p){return h("span",{key:p.key,title:p.name,style:{display:"inline-block",width:7,height:7,borderRadius:"50%",background:monoTokenColor(p,players),border:"1px solid rgba(255,255,255,.9)",boxShadow:"0 0 0 1px rgba(0,0,0,.18)"}});})));})):h("button",{onClick:function(){setBoardOpen(true);},style:{flexShrink:0,margin:"3px 12px 5px",padding:"8px 12px",borderRadius:11,background:t.bg2,border:"1px solid "+t.line,display:"flex",justifyContent:"space-between",fontFamily:F_BODY,fontSize:11.5,color:t.sub}},h("span",null,"🏙️ 棋盘已收起 · 第 "+(moves+1)+" / "+maxMoves+" 手"),h("span",{style:{color:t.tint}},"展开棋盘"));
    const roster=h("div",{ "data-wk": "gameroster", "data-part": "monopoly", style:{display:"flex",gap:7,overflowX:"auto",padding:"4px 12px 8px",flexShrink:0,minHeight:55}},players.map(function(p,i){const pc=monoTokenColor(p,players);return h("div",{key:p.key,style:{minWidth:106,padding:"7px",borderRadius:10,background:i===turn&&!p.bankrupt?pc+"18":t.bg2,border:(i===turn?"2px solid "+pc:"1px solid "+t.line),boxShadow:i===turn&&!p.bankrupt?"0 4px 10px rgba(20,16,10,.16)":"0 1px 4px rgba(20,16,10,.07)",transform:i===turn&&!p.bankrupt?"translateY(-2px)":"none",opacity:p.bankrupt?.45:1}},h("div",{style:{display:"flex",alignItems:"center",gap:5}},h("span",{title:"棋子颜色",style:{width:9,height:9,borderRadius:"50%",background:pc,boxShadow:"0 0 0 1px rgba(0,0,0,.15)",flexShrink:0}}),pAvatar(p,25),h("div",{style:{fontFamily:F_BODY,fontSize:11.5,color:t.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},p.name+(p.isUser?"(你)":""))),h("div",{style:{fontFamily:"monospace",fontSize:10.5,color:t.sub,marginTop:4}},p.bankrupt?"已破产":"$"+p.cash+" · 地"+propertyCount(p.key)+(p.jailed?" · 关押":"")));}));
    // 接话没回来（超时或报错）时留着那一批事件，点一下再请一次（她 2026-10-03：「过一会就会说角色接话失败之类的能不能搞个重试」）。
    //   账面不动，只补台词；用的是【此刻】的账面，不是当时那份。
    async function retryTalk(){if(!talkMiss||busy)return;const m=talkMiss;setTalkMiss(null);interactionQueue.current=m.batch.concat(interactionQueue.current);setBusy(true);try{await react(players,owners,null,true);}finally{setBusy(false);}}
    const logView=h("div",{ "data-wk": "gamelog", "data-part": "monopoly", className:"flex-1 overflow-y-auto",style:{padding:"7px 14px",minHeight:110,borderTop:"1px solid "+t.line}},logs.slice(-22).map(function(x,i){return h("div",{ "data-wk": "gamelogline", key:i,style:{fontFamily:F_BODY,fontSize:x.type==="talk"?13:11.5,lineHeight:1.55,color:x.type==="talk"?t.ink:(x.type==="bad"?"#c0553f":t.sub),padding:x.type==="talk"?"6px 9px":"3px 5px",marginBottom:3,borderRadius:9,background:x.type==="talk"?t.bg2:"transparent"}},x.type==="talk"?h("b",{style:{color:t.tint}},x.name+"："):null,x.say);}),
      talkMiss&&!busy?h("button",{onClick:retryTalk,className:"active:opacity-70",style:{display:"block",margin:"4px auto 2px",padding:"7px 16px",borderRadius:999,border:"1px dashed "+t.line,background:t.bg2,color:t.tint,fontFamily:F_BODY,fontSize:12}},"角色没接上话 · 再试一次"):null);
    let action;if(phase==="result"){const ranking=players.slice().sort(function(a,b){return monoNetWorth(b,owners,levels)-monoNetWorth(a,owners,levels);});action=h("div",{style:{textAlign:"center"}},h("div",{style:{fontFamily:F_DISPLAY,fontSize:20,color:t.ink}},"🏆 "+(winner?winner.name:ranking[0].name)+" 赢下这座城"),h("div",{style:{fontFamily:F_BODY,fontSize:12,color:t.sub,margin:"8px 0 13px"}},ranking.map(function(p,i){return (i+1)+". "+p.name+" $"+monoNetWorth(p,owners,levels);}).join("　")),h("button",{onClick:props.onBack,style:{width:"100%",padding:12,borderRadius:12,background:t.ink,color:"#fff",fontFamily:F_BODY}},"回游戏中枢"),
      h(KeepMemBtn,{t:t,host:props,rep:function(){
        const userSeat=players.find(function(p){return p.isUser;});
        const top=winner||ranking[0];
        return { proc: logs, key:"monopoly",zh:"大富翁",ids:realCharIds(players),wins:top&&!top.isUser&&realCharIds(players).indexOf(top.key)>=0?[top.key]:[],meWin:userSeat?userSeat===top:null,
          text:"一起玩了「大富翁」，"+(top?top.name:"")+" 赢下这座城"+(userSeat?("；"+userSeat.name+" 排第 "+(ranking.indexOf(userSeat)+1)+" 名，总资产 $"+monoNetWorth(userSeat,owners,levels)):"")+"。"};
      }}));}
    else if(pending&&pending.kind==="trade"){
      const tile=MONO_BOARD[pending.tile],owner=players.find(function(p){return p.key===owners[pending.tile];}),me2=players.find(function(p){return p.isUser;});
      if(!owner||!tile){setPending(null);action=null;}
      else if(pending.step==="offer")action=h("div",null,
        h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:8}},"向 "+owner.name+" 收购【"+tile.name+"】（地价 $"+tile.price+"）——你开多少？"),
        busy?h("div",{style:{textAlign:"center",fontFamily:F_BODY,fontSize:12.5,color:t.fog,padding:"6px 0"}},"…"+owner.name+" 在盘算"):h("div",{style:{display:"flex",gap:8}},
          h("input",{ "data-wk": "gameinput", "data-part": "trade", value:tradeOffer,type:"number",inputMode:"numeric",onChange:function(e){setTradeOffer(e.target.value);},placeholder:"出价（现金 $"+(me2?me2.cash:0)+"）",style:{flex:1,minWidth:0,padding:"10px 12px",borderRadius:11,border:"1px solid "+t.tint,background:t.bg2,color:t.ink,fontFamily:F_BODY,fontSize:13,outline:"none"}}),
          h("button",{onClick:sendOffer,style:{padding:"0 16px",borderRadius:11,background:t.ink,color:t.bg2,fontFamily:F_BODY,fontSize:13,fontWeight:700}},"开价"),
          h("button",{onClick:function(){setPending(null);},style:{padding:"0 10px",borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.fog,fontFamily:F_BODY,fontSize:12}},"算了")));
      else action=h("div",null,
        h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:9}},owner.name+" 还价 $"+pending.counter+" 卖【"+tile.name+"】——接不接？"),
        h("div",{style:{display:"flex",gap:9}},
          h("button",{disabled:!me2||me2.cash<pending.counter,onClick:function(){settleTrade(pending.tile,pending.counter);},style:{flex:1,padding:12,borderRadius:11,background:t.ink,color:t.bg2,opacity:(!me2||me2.cash<pending.counter)?.4:1,fontFamily:F_BODY,fontWeight:700}},(!me2||me2.cash<pending.counter)?"现金不足":"成交 $"+pending.counter),
          h("button",{onClick:function(){addLogs([{type:"sys",say:"你摇头走开，这单没成。"}]);setPending(null);},style:{flex:1,padding:12,borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.ink,fontFamily:F_BODY}},"不了")));
    }
    else if(pending&&pending.kind==="auction"){const tile=MONO_BOARD[pending.tile],snapshot=Array.isArray(pending.ps)?pending.ps:players,me=snapshot.find(function(p){return p.isUser;}),names=(pending.activeKeys||[]).map(function(k){const p=snapshot.find(function(x){return x.key===k;});return p&&p.name;}).filter(Boolean),bidLocked=!me||me.cash<pending.ask;action=h("div",null,h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:4}},"🔨 【"+tile.name+"】公开竞价 · 当前 $"+pending.ask),h("div",{style:{fontFamily:F_BODY,fontSize:10.5,color:t.fog,textAlign:"center",marginBottom:9}},"仍在场："+names.join("、")+" · 每轮 +$"+pending.step),h("div",{style:{display:"flex",gap:9}},h("button",{disabled:bidLocked,onClick:function(){decideAuction(true);},style:{flex:1,padding:12,borderRadius:11,background:t.ink,color:"#fff",opacity:bidLocked?.4:1}},bidLocked&&me&&me.cash<pending.ask?"现金不足":"举牌 $"+pending.ask),h("button",{onClick:function(){decideAuction(false);},style:{flex:1,padding:12,borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.ink}},"退出竞价")));}
    else if(pending){const tile=MONO_BOARD[pending.tile],up=pending.kind==="upgrade",cost=up?Math.floor(tile.price/2):tile.price;action=h("div",null,h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:9}},up?("升级【"+tile.name+"】？花费 $"+cost+"，升级后租金 $"+monoRent(pending.tile,players[turn].key,pending.os,Object.assign({},pending.lv,{[pending.tile]:(pending.lv[pending.tile]||0)+1}))):( "买下【"+tile.name+"】？价格 $"+tile.price+"，基础租金 $"+tile.rent+"；弃购会进入拍卖")),h("div",{style:{display:"flex",gap:9}},h("button",{disabled:(players[turn]&&players[turn].cash<cost),onClick:function(){decideProperty(true);},style:{flex:1,padding:12,borderRadius:11,background:t.ink,color:"#fff",opacity:(players[turn]&&players[turn].cash<cost)?.4:1}},up?"升级":"买下"),h("button",{onClick:function(){decideProperty(false);},style:{flex:1,padding:12,borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.ink}},up?"暂不升级":"放弃并拍卖")));}
    else action=h("button",{onClick:playTurn,disabled:busy,className:"w-full active:opacity-80",style:{fontFamily:F_BODY,fontSize:15,fontWeight:700,color:"#f3efe6",background:busy?t.line:t.ink,borderRadius:13,padding:"13px"}},busy?"…角色们正在接话":((cur?(cur.isUser?"轮到你":"看 "+cur.name):"")+" · 掷骰子"));
    return h("div",{ "data-wk": "gameplay", "data-part": "monopoly", className:"h-full flex flex-col",style:Object.assign({overflow:"hidden"},gameTable("monopoly",t))},header,board,roster,logView,h("div",{ "data-wk": "gameactions", "data-part": "monopoly", className:"shrink-0",style:{borderTop:"1px solid "+t.line,padding:"9px 14px calc(env(safe-area-inset-bottom) + 11px)"}},phase==="play"?h("div",{style:{display:"flex",gap:6,marginBottom:8}},h("input",{value:tableSay,onChange:function(e){setTableSay(e.target.value);},onKeyDown:function(e){if(e.key==="Enter")sendTableTalk();},placeholder:"桌边说一句：求情、挑衅、谈条件…",style:{flex:1,minWidth:0,padding:"8px 10px",borderRadius:10,border:"1px solid "+t.line,background:t.bg2,color:t.ink,fontFamily:F_BODY,fontSize:12}}),h("button",{onClick:sendTableTalk,disabled:busy||!tableSay.trim(),style:{padding:"7px 11px",borderRadius:10,background:t.tint,color:"#fff",opacity:busy||!tableSay.trim()?.4:1}},"说")):null,action));
  }

  // ============================================================
  // 阿瓦隆 · 引擎（任务制：组队→投票→出任务，3成功好人赢/3失败坏人赢/刺客终局刺梅林）
  // ============================================================
  const AV_QUEST = { 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] };
  const AV_EVIL = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
  const AV_ROLE_ZH = { merlin: "梅林", percival: "派西维尔", loyal: "亚瑟的忠臣", assassin: "刺客", morgana: "莫甘娜", mordred: "莫德雷德", oberon: "奥伯伦", minion: "爪牙" };
  const AV_EVIL_ROLES = ["assassin", "morgana", "mordred", "oberon", "minion"];
  function avSide(r) { return AV_EVIL_ROLES.indexOf(r) >= 0 ? "evil" : "good"; }
  function avFailsReq(total, qi) { return (total >= 7 && qi === 3) ? 2 : 1; }
  function avalonBoard(total, opts) {
    opts = opts || {};
    const evilN = AV_EVIL[total] || 2;
    const evil = ["assassin"];
    // 派西维尔开关承诺与莫甘娜成对加入，优先占一个坏人槽；配置页会阻止特殊槽位超限。
    if (opts.percival && evil.length < evilN) evil.push("morgana");
    if (opts.mordred && evil.length < evilN) evil.push("mordred");
    if (opts.oberon && evil.length < evilN) evil.push("oberon");
    while (evil.length < evilN) evil.push("minion");
    const goodN = total - evilN;
    const good = ["merlin"];
    if (opts.percival && good.length < goodN) good.push("percival");
    while (good.length < goodN) good.push("loyal");
    return shuffle(good.concat(evil));
  }
  // 给「主持人视角」的一句身份+已知信息（用于喂 AI 让每人按自己掌握的信息行动）
  function avSecretFor(p, players) {
    const others = players.filter(function (x) { return x !== p; });
    if (p.role === "merlin") return "梅林——看得见坏人：" + (others.filter(function (x) { return x.side === "evil" && x.role !== "mordred"; }).map(function (x) { return x.name; }).join("、") || "（无）") + "（但不知谁是刺客，必须藏好自己别暴露）";
    if (p.role === "percival") { const s = others.filter(function (x) { return x.role === "merlin" || x.role === "morgana"; }).map(function (x) { return x.name; }); return "派西维尔——看到 " + (s.join("、") || "—") + (s.length >= 2 ? " 里一个是梅林、一个是莫甘娜（伪装梅林）但分不清，要护住真梅林" : " 是梅林"); }
    if (p.side === "evil" && p.role !== "oberon") { const m = others.filter(function (x) { return x.side === "evil" && x.role !== "oberon"; }).map(function (x) { return x.name; }); return AV_ROLE_ZH[p.role] + "（坏人）——同伙：" + (m.join("、") || "只有自己") + "；任务里可出『失败』"; }
    if (p.role === "oberon") return "奥伯伦（坏人，但和其他坏人互不相识、也不认识彼此）；任务里可出『失败』";
    return "亚瑟的忠臣（好人）——不知任何人身份，靠推理找坏人";
  }
  // 给「玩家自己」看的第二人称身份提示
  function avRevealFor(me, players) {
    const others = players.filter(function (x) { return x !== me; });
    if (me.role === "merlin") return "你是【梅林】。你能看见的坏人：" + (others.filter(function (x) { return x.side === "evil" && x.role !== "mordred"; }).map(function (x) { return x.name; }).join("、") || "（本局没有你能看见的坏人）") + "。但你不知道谁是刺客——别暴露自己，否则终局会被一击刺杀。";
    if (me.role === "percival") { const s = shuffle(others.filter(function (x) { return x.role === "merlin" || x.role === "morgana"; }).map(function (x) { return x.name; })); return "你是【派西维尔】。" + (s.length >= 2 ? s.join(" 和 ") + " 之中一个是梅林、一个是莫甘娜（伪装成梅林），但你分不清谁是谁——保护真梅林。" : "你看到梅林是 " + (s.join("、") || "—") + "。"); }
    if (me.side === "evil" && me.role !== "oberon") { const m = others.filter(function (x) { return x.side === "evil" && x.role !== "oberon"; }).map(function (x) { return x.name; }); return "你是【" + AV_ROLE_ZH[me.role] + "】（坏人）。你的同伙（奥伯伦除外，互不相识）：" + (m.join("、") || "只有你一个") + "。任务里你可以出『失败』，别暴露。" + (me.role === "assassin" ? "终局你有一次刺杀：3 个任务失守后，指认梅林，猜中坏人翻盘赢。" : ""); }
    if (me.role === "oberon") return "你是【奥伯伦】——虽属坏人阵营，但你不认识其他坏人，其他坏人也不认识你。任务里可出『失败』。";
    return "你是【亚瑟的忠臣】（好人）。你不知道任何人的身份，只能靠组队与投票的蛛丝马迹推理，把 3 个任务做成功。";
  }

  // 湖中仙女：AI 持牌人挑一个没被验过的人查验，拿到真实阵营后决定当众宣布什么——
  // 好人照实宣布（这是好人的信息武器），坏人可以撒谎护同伙。真相只给持牌人，宣布才是公开的。
  async function genLadyCheck(api, holder, targets, players, hist) {
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·湖中仙女在【" + holder.name + "】手上（" + avSecretFor(holder, players) + "，真实水平：" + (holder.skill || "普通") + "）。从这些人里挑一个查验真实阵营：" + targets.join("、") + "。挑当下最值得看清的人。\n【局面】\n" + (hist || "（刚开局）") + "\n\n【输出】只输出 JSON：{\"target\":\"要查验的人名\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "验谁？" }], { maxTokens: 8600 });
    return extractJSON(raw) || {};
  }
  async function genLadyAnnounce(api, holder, target, isEvil, players, hist) {
    const stance = holder.side === "evil"
      ? "你是坏人：可以照实宣布，也可以撒谎护同伙或嫁祸好人——按你的水平权衡哪种更划算。"
      : "你是好人：照实宣布——这是好人阵营少有的确定信息，谎报等于自毁。";
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·你替【" + holder.name + "】决定湖中仙女的宣布。TA 刚查验了 " + target + "，【真实结果：" + (isEvil ? "坏人" : "好人") + "】（这个真相只有 TA 知道）。" + stance + "\n（" + avSecretFor(holder, players) + "）\n【局面】\n" + (hist || "") + "\n\n【输出】只输出 JSON：{\"announce\":\"好人\"或\"坏人\",\"say\":\"宣布时说的一句话\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "宣布。" }], { maxTokens: 8700 });
    return extractJSON(raw) || {};
  }
  async function setupAvalon(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是「阿瓦隆」的 NPC 生成器 + 能力评估器。\n" +
      "1. 生成 " + npcCount + " 个 NPC：name 中文名 + persona 一句人设（含【职业】与性格，多样别雷同）。\n" +
      "2. 给【每个真实玩家】和每个 NPC 各写一句 skill「牌桌能力小传」：点出 TA 玩阿瓦隆时——从组队与投票里读心找坏人、伪装隐身份、带节奏说服人——的【真实强弱】（由职业背景推，别被性格带偏）。\n\n" +
      "【真实玩家】\n" + (lines || "（只有 NPC）") +
      "\n\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 " + npcCount + " 个 NPC + 每人能力小传。" }], { maxTokens: 12000 });
    return extractJSON(raw) || {};
  }
  async function genProposal(api, leader, players, needSize, qn, failsReq, hist, names) {
    const sys = AC + SKILL_RULE + "\n\n你在主持「阿瓦隆」，替队长做组队决定。队长【" + leader.name + "】：" + avSecretFor(leader, players) + "，真实水平：" + (leader.skill || "普通") +
      "\n第 " + (qn + 1) + " 个任务要选【" + needSize + "】人上场" + (failsReq === 2 ? "（此任务需 2 张失败票才失败）" : "") + "。按队长身份立场选人：好人凑一支可信、没坏人的队（通常带上自己）；坏人想把自己或同伙塞进去又不能太明显。给 team（正好 " + needSize + " 个在场的名字）+ 一句公开理由（别暴露隐藏身份）。" +
      "\n【在场】" + names.join("、") + "\n【局面】\n" + (hist || "（刚开局）") +
      "\n队伍确定后，再从非用户玩家里挑 3~5 位各说一句投票前圆桌发言（30字内，针对这支队伍；不许暴露身份）。" +
      "\n\n只输出 JSON：{\"team\":[\"\"],\"reason\":\"\",\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    // 队长是言秋座位 → 组队由 CC 本人拍板，talks 仍交批量（v54.43）
    if (leader && leader.engineer) {
      const cc = await ccCarve("avalon", [leader], {
        turnId: freshCCTurn("av-propose:" + qn + ":"),
        sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务，轮到你作为队长选【" + needSize + "】人上场" + (failsReq === 2 ? "（此任务需 2 张失败票才失败）" : "") + "。\n【你的身份与私密信息】" + avSecretFor(leader, players) + "\n【在场】" + names.join("、") + "\n【局面】\n" + (hist || "（刚开局）") + "\n按你的身份选队（好人组可信队，坏人塞人别太明显），公开理由别暴露身份。",
        expect: '{"team":["正好' + needSize + '个在场名字"],"reason":"一句公开理由"}'
      });
      requireCCDone(cc, "言秋的队长组队票", function (d) { return Array.isArray(d.team) && d.team.length > 0; });
      if (cc.done && Array.isArray(cc.done.team) && cc.done.team.length) {
        const talksRaw = await callRetry(api, sys + "\n\n【队长已亲自定队·不要改】team=" + JSON.stringify(cc.done.team) + "，只输出圆桌发言 talks。", [{ role: "user", content: "只出 talks。" }], { maxTokens: 9200 });
        const tk = extractJSON(talksRaw) || {};
        return { team: cc.done.team, reason: String(cc.done.reason || ""), talks: Array.isArray(tk.talks) ? tk.talks : [] };
      }
      throw new Error("言秋的队长组队票格式无效，请重试当前步骤");
    }
    const raw = await callRetry(api, sys, [{ role: "user", content: "组队。" }], { maxTokens: 9500 });
    return extractJSON(raw) || {};
  }
  // ⚠️曾叫 genVotes——和卧底的 genVotes 顶层重名，后者被这个覆盖导致卧底投票错调（v47.49 修复改名）
  async function genAvVotes(api, voters, team, leaderName, players, qn, hist, heckles) {
    const blocks = voters.map(function (v) { return "■ " + v.name + "：" + avSecretFor(v, players) + "；水平" + (v.skill || "普通") + voiceBrief(v); }).join("\n");
    const sys = gameVoiceRules() + "\n\n阿瓦隆·对第 " + (qn + 1) + " 个任务的队伍投票。队长 " + leaderName + " 提议队伍：[" + team.join("、") + "]。\n下面每人按各自身份和掌握的信息投【赞成】或【反对】+ 一句公开理由（理由别暴露隐藏身份）：\n· 好人：队里可能混了坏人就反对，可信就赞成；注意连续 5 次否决坏人直接赢，别无脑否。\n· 坏人：想让有己方的队通过就赞成、想搅局就反对，但别投得太露馅。\n· 梅林该反对带坏人的队，但要装成普通推理别暴露。\n\n" + blocks + "\n【局面】\n" + (hist || "（刚开局）") + heckleBlock(heckles) +
      "\n\n只输出 JSON：{\"votes\":[{\"name\":\"\",\"vote\":\"赞成\"或\"反对\",\"reason\":\"\"}]}";
    // 言秋座位先自己投（v54.43）
    const cc = await ccCarve("avalon", voters, {
      turnId: freshCCTurn("av-vote:" + qn + ":"),
      sys: "「阿瓦隆」对第 " + (qn + 1) + " 个任务的队伍投票，轮到你。队长 " + leaderName + " 提议：[" + team.join("、") + "]。\n【你的身份与私密信息】" + (ccSeatOf(voters) ? avSecretFor(ccSeatOf(voters), players) : "") + "\n【局面】\n" + (hist || "（刚开局）") + "\n按身份投赞成或反对，公开理由别暴露身份（注意连续 5 次否决坏人直接赢）。",
      expect: '{"vote":"赞成或反对","reason":"一句公开理由"}'
    });
    requireCCDone(cc, "言秋的组队投票", function (d) { return d.vote !== undefined; });
    const mine = (cc.seat && cc.done && cc.done.vote) ? [{ name: cc.seat.name, vote: /反/.test(String(cc.done.vote)) ? "反对" : "赞成", reason: String(cc.done.reason || "") }] : [];
    const useVoters = cc.seat ? cc.rest : voters;
    if (!useVoters.length) return mine;
    const raw = await callRetry(api, sys + ccPreface(cc, "投过票了"), [{ role: "user", content: "投票。" }], { maxTokens: 14500 });
    const p = extractJSON(raw); const rows = (p && Array.isArray(p.votes)) ? p.votes : [];
    return mine.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }
  // 组队后的圆桌讨论（阿瓦隆的灵魂：投票前的嘴仗）——一次调用出全桌发言
  async function genTableTalk(api, players, team, leaderName, reason, qn, hist, userName) {
    const blocks = players.filter(function (p) { return !p.isUser; }).map(function (p) { return "■ " + p.name + "：" + avSecretFor(p, players) + "；水平" + (p.skill || "普通") + voiceBrief(p); }).join("\n");
    const sys = gameVoiceRules() + "\n\n阿瓦隆·第 " + (qn + 1) + " 个任务组队后、投票前的【圆桌讨论】。队长 " + leaderName + " 提议队伍：[" + team.join("、") + "]" + (reason ? "，公开理由：" + reason : "") + "。\n从下面的人里挑 3~5 位【此刻真有话要说的】各说一句（30字内，口语，像面对面拍桌子吵）：质疑人选、为自己辩护、点名怀疑谁、拉票、阴阳怪气都行，要针对【这支队伍和场上局面】说具体的，别空喊。\n· 好人靠有限信息真推理：谁上次任务在场、谁投票可疑，点名施压" + (userName ? "，也可以直接质问「" + userName + "」" : "") + "；\n· 坏人搅浑水带节奏：装无辜、给同伙打掩护、把水泼向好人，但别演过头；\n· 梅林知道真相但【必须包装成普通推理】，太准会被刺客盯上；\n· 谁都不许说出自己或别人的真实身份词。\n" + blocks + "\n【局面】\n" + (hist || "（刚开局）") + "\n\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    // 言秋座位的那句嘴仗自己说；说不上话（离线/没话）就干脆缺席，不许模型代嘴（v54.43）
    const pool = players.filter(function (p) { return !p.isUser; });
    const cc = await ccCarve("avalon", pool, {
      turnId: freshCCTurn("av-talk:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务组队后的圆桌讨论。队长 " + leaderName + " 提议：[" + team.join("、") + "]" + (reason ? "，理由：" + reason : "") + "。\n【你的身份与私密信息】" + (ccSeatOf(pool) ? avSecretFor(ccSeatOf(pool), players) : "") + "\n【局面】\n" + (hist || "（刚开局）") + "\n想说就给一句 30 字内的桌上话（质疑/辩护/拉票都行，别暴露身份词）；不想说 say 留空。",
      expect: '{"say":"一句30字内的话，可空"}'
    });
    const raw = await callRetry(api, sys + ccPreface(cc, "说过自己那句了（也可能选择沉默）"), [{ role: "user", content: "讨论。" }], { maxTokens: 11200 });
    const p = extractJSON(raw); let rows = (p && Array.isArray(p.talks)) ? p.talks : [];
    if (cc.seat) rows = rows.filter(function (v) { return v.name !== cc.seat.name; });
    if (cc.seat && cc.done && String(cc.done.say || "").trim()) rows.push({ name: cc.seat.name, say: String(cc.done.say).trim().slice(0, 60) });
    return rows;
  }
  // 任务失败后的甩锅环节：队员自证/互咬，场下点名怀疑——一次调用
  async function genBlame(api, players, team, qn, fails, hist) {
    const blocks = players.filter(function (p) { return !p.isUser; }).map(function (p) { return "■ " + p.name + "：" + avSecretFor(p, players) + "（" + (team.indexOf(p.name) >= 0 ? "在这支队里" : "不在队里") + "）" + voiceBrief(p); }).join("\n");
    const sys = gameVoiceRules() + "\n\n阿瓦隆·第 " + (qn + 1) + " 个任务【失败了】（" + fails + " 张失败票），全桌炸锅。挑 2~4 位各说一句（30字内，口语）：队员急着自证清白、互相咬、场下的人点名分析谁最可疑。\n· 真投了失败票的坏人要嫁祸队友、演无辜；队里的好人是真冤，会急；\n· 说话要针对这支队伍 [" + team.join("、") + "] 里的具体名字；\n· 不许说出任何人的真实身份词。\n" + blocks + "\n【局面】\n" + (hist || "") + "\n\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    const poolB = players.filter(function (p) { return !p.isUser; });
    const ccB = await ccCarve("avalon", poolB, {
      turnId: freshCCTurn("av-blame:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务失败了（" + fails + " 张失败票），全桌炸锅。队伍是 [" + team.join("、") + "]。\n【你的身份与私密信息】" + (ccSeatOf(poolB) ? avSecretFor(ccSeatOf(poolB), players) : "") + "\n【局面】\n" + (hist || "") + "\n想说就给一句 30 字内（自证/互咬/点名分析，别暴露身份词）；不想说 say 留空。",
      expect: '{"say":"一句30字内的话，可空"}'
    });
    const raw = await callRetry(api, sys + ccPreface(ccB, "说过自己那句了（也可能选择沉默）"), [{ role: "user", content: "甩锅。" }], { maxTokens: 10600 });
    const p = extractJSON(raw); let rows = (p && Array.isArray(p.talks)) ? p.talks : [];
    if (ccB.seat) rows = rows.filter(function (v) { return v.name !== ccB.seat.name; });
    if (ccB.seat && ccB.done && String(ccB.done.say || "").trim()) rows.push({ name: ccB.seat.name, say: String(ccB.done.say).trim().slice(0, 60) });
    return rows;
  }
  async function genQuest(api, evilOnTeam, players, qn, failsReq, score) {
    const who = evilOnTeam.map(function (p) { return "■ " + p.name + "（" + AV_ROLE_ZH[p.role] + "）水平" + (p.skill || "普通"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·第 " + (qn + 1) + " 个任务执行。目前 好人成功 " + score.good + " 次 / 任务失败 " + score.evil + " 次。" + (failsReq === 2 ? "这个任务需【2 张】失败票才会失败。" : "这个任务【1 张】失败票就失败。") +
      "\n以下坏人在队里，各自决定这次出【成功】还是【失败】（好人只能出成功）。出失败能推进坏人取胜、但会暴露队里有坏人；有时藏一手出成功更稳。按各人水平与局面权衡：\n" + who +
      "\n\n只输出 JSON：{\"plays\":[{\"name\":\"\",\"play\":\"成功\"或\"失败\"}]}";
    // 队里的坏人是言秋座位 → 成功/失败这张牌TA自己出（v54.43）
    const cc = await ccCarve("avalon", evilOnTeam, {
      turnId: freshCCTurn("av-quest:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务执行，你在队里而且是坏人，要决定出【成功】还是【失败】。\n目前 好人成功 " + score.good + " / 任务失败 " + score.evil + "。" + (failsReq === 2 ? "此任务需 2 张失败票才失败。" : "1 张失败票就失败。") + "\n出失败推进坏人取胜但会暴露队里有坏人；藏一手出成功有时更稳，你自己权衡。",
      expect: '{"play":"成功或失败"}'
    });
    requireCCDone(cc, "言秋的任务牌", function (d) { return d.play !== undefined; });
    const mine = (cc.seat && cc.done && cc.done.play) ? [{ name: cc.seat.name, play: /失/.test(String(cc.done.play)) ? "失败" : "成功" }] : [];
    const restEvil = cc.seat ? cc.rest : evilOnTeam;
    if (!restEvil.length) return mine;
    const raw = await callRetry(api, sys + ccPreface(cc, "出过牌了"), [{ role: "user", content: "出任务。" }], { maxTokens: 8600 });
    const p = extractJSON(raw); const rows = (p && Array.isArray(p.plays)) ? p.plays : [];
    return mine.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }
  async function genAssassin(api, assassin, players, hist) {
    const goods = players.filter(function (p) { return p.side === "good"; }).map(function (p) { return p.name; });
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·好人已完成 3 个任务，进入终局刺杀。你替【刺客 " + assassin.name + "】判断：好人里谁最像梅林？猜中则坏人翻盘获胜。\n回顾全程——谁的组队 / 投票像是『早就知道坏人是谁』（梅林会不自觉地精准避开坏人）。候选：" + goods.join("、") + "\n【局面】\n" + (hist || "") +
      "\n\n只输出 JSON：{\"target\":\"你认定是梅林的人\",\"reason\":\"\"}";
    // 刺客是言秋座位 → 终局这一刀TA自己出（v54.43）
    if (assassin && assassin.engineer) {
      const cc = await ccCarve("avalon", [assassin], {
        turnId: freshCCTurn("av-assassin:"),
        sys: "「阿瓦隆」终局刺杀：好人已完成 3 个任务，轮到你的刺客行动，猜中梅林则坏人翻盘。\n候选好人：" + goods.join("、") + "\n【全程局面】\n" + (hist || "") + "\n找那个组队/投票像『早就知道坏人是谁』的人。",
        expect: '{"target":"你认定是梅林的人","reason":"一句理由"}'
      });
      if (cc.done && cc.done.target) return { target: String(cc.done.target), reason: String(cc.done.reason || "") };
      throw new Error(cc.reason || "本人刺杀票未送达");
    }
    const raw = await callRetry(api, sys, [{ role: "user", content: "刺谁？" }], { maxTokens: 8700 });
    return extractJSON(raw) || {};
  }

  function AvalonGame(props) {
    const t = props.t, cfg = props.config, api = props.active;
    const total = cfg.total;
    const sv = props.savedState;
    const [phase, setPhase] = useState("loading"); // loading|reveal|propose|vote|quest|assassin|result|error
    const [players, setPlayers] = useState(sv ? hydPlayers(sv.players, props, t) : []);
    const [questNum, setQuestNum] = useState(sv ? (sv.questNum || 0) : 0);     // 0-based
    const [leaderIdx, setLeaderIdx] = useState(sv ? (sv.leaderIdx || 0) : 0);
    const [voteTrack, setVoteTrack] = useState(sv ? (sv.voteTrack || 0) : 0);   // 连续否决次数
    const [results, setResults] = useState(sv ? (sv.results || []) : []);      // [{success,fails}]
    const [team, setTeam] = useState([]);            // 当前提议队伍（名字）
    const [teamSel, setTeamSel] = useState([]);      // 你组队时的多选
    const [userVote, setUserVote] = useState(null);  // 你的赞成/反对
    const [voteSay, setVoteSay] = useState("");       // 投票前想说的一句（进讨论记录，AI 后续会看到）
    const [userPlay, setUserPlay] = useState(null);  // 你在任务里出的成功/失败
    const [pickerOpen, setPickerOpen] = useState(true);
    const [log, setLog] = useState(sv ? (sv.log || []) : []);
    const [busy, setBusy] = useState(false);
    const [winner, setWinner] = useState(null);
    const [assassinPick, setAssassinPick] = useState(null); // 刺客锁定的人（终局揭示）
    const [heckleText, setHeckleText] = useState("");   // 台下插嘴（观战）
    const hecklesRef = useRef([]);                       // 最近几句起哄，组队投票附带参考
    const [ladyCtx, setLadyCtx] = useState(null);       // 你持湖中仙女时的查验上下文 {targets, nextQn, nli, seen}
    const ladyHolderRef = useRef(sv ? (sv.ladyHolder || null) : null);   // 现在牌在谁手上（名字）
    const ladyDoneRef = useRef(sv ? (sv.ladyDone || []) : []);           // 持有过/被验过的人（不再被验）
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const logRef = useRef(null);
    const histRef = useRef(sv ? (sv.hist || []) : []);     // 喂 AI 的公开局面（同步）
    const logDataRef = useRef(sv ? (sv.log || []) : []);   // log 的同步镜像（存档用，避开 setState 异步）
    const vtRef = useRef(sv ? (sv.voteTrack || 0) : 0);
    const started = useRef(false);
    const gameRunId = useRef((sv && sv.ts ? "avalon-" + sv.ts : "avalon-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)));
    const pAvatar = avatarFor(t);
    const me = players.find(function (p) { return p.isUser; });
    const leader = players[leaderIdx];
    const needSize = players.length ? (AV_QUEST[players.length] || AV_QUEST[5])[questNum] : 0;
    const failsReq = players.length ? avFailsReq(players.length, questNum) : 1;
    const score = { good: results.filter(function (r) { return r.success; }).length, evil: results.filter(function (r) { return !r.success; }).length };
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm || (nm && String(nm).indexOf(p.name) >= 0); }); };
    const pushLog = function (items) { logDataRef.current = logDataRef.current.concat(items); setLog(function (L) { return L.concat(items); }); };
    const pushHist = function (line) { histRef.current = histRef.current.concat([line]); };
    // 公开历史分两层：任务/组队/票型等硬事实永不被闲聊挤掉，近期发言保留最后 24 条。
    const histText = function () {
      const all = histRef.current || [];
      const core = all.filter(function (s) { return /^(?:任务\d+|投票|连续否决)/.test(String(s)); });
      const recent = all.slice(-24);
      return Array.from(new Set(core.concat(recent))).slice(-64).map(function (s) { return "· " + s; }).join("\n");
    };
    useEffect(function () { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, phase, busy]);
    useEffect(function () { setPickerOpen(true); }, [phase, questNum, leaderIdx]);
    useEffect(function () { if (phase === "result") clearGameSave("avalon"); }, [phase]);
    useEffect(function () {
      if (phase !== "result" || !winner || !players.length) return;
      const userSeat = players.find(function (p) { return p.isUser; });
      ccGameResult("avalon", gameRunId.current, players, cfg,
        "《阿瓦隆》" + (winner === "good" ? "好人阵营获胜" : "坏人阵营获胜") + "。\n"
        + "任务比分：好人成功 " + score.good + "，任务失败 " + score.evil + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + AV_ROLE_ZH[p.role]; }).join("；") + "。\n"
        + (assassinPick ? "刺客最终指认了 " + assassinPick + "。\n" : "")
        + ((userSeat && userSeat.name) || "用户") + "：" + (userSeat ? AV_ROLE_ZH[userSeat.role] + "，属于" + (userSeat.side === "good" ? "好人" : "坏人") + "阵营" : "本局观战") + "。",
        function (say, seat) { pushLog([{ type: "talk", name: seat.name, say: say }]); });
    }, [phase, winner]);
    // 存档：在每次「进入某个任务的组队」前存一份干净断点（续局从 startQuest 重进该轮，不复读已发生的）
    const saveCkpt = function (qn, li, vt, resultsArr, playersArr) {
      const ld = playersArr[li];
      const ckGood = (resultsArr || []).filter(function (r) { return r.success; }).length;
      const ckEvil = (resultsArr || []).length - ckGood;
      saveGameSnap("avalon", { config: cfg, questNum: qn, leaderIdx: li, voteTrack: vt, results: resultsArr, players: serPlayers(playersArr), log: logDataRef.current, hist: histRef.current, ladyHolder: ladyHolderRef.current, ladyDone: ladyDoneRef.current, ts: Date.now(), label: "任务 " + (qn + 1) + "/5 · " + ckGood + " 成 " + ckEvil + " 败 · 队长 " + (ld ? ld.name : "?") });
    };

    // ---- 开局 ----
    useEffect(function () {
      if (started.current) return; started.current = true;
      if (sv) { // 续局：状态已水合，重进当前任务的组队
        vtRef.current = sv.voteTrack || 0;
        setTimeout(function () { startQuest(sv.questNum || 0, sv.leaderIdx || 0, sv.voteTrack || 0); }, 20);
        return;
      }
      (async function () {
        try {
          if (!api) { setErrMsg("请先到设置配置 API"); setPhase("error"); return; }
          const rp = realPlayerLines(cfg, props);
          const data = await setupAvalon(api, rp, cfg.npcCount || 0);
          const list = buildRoster(cfg, props, t, data.npcs, data.skills);
          const n = list.length;
          const roles = avalonBoard(n, cfg.av || {});
          const order = shuffle(list.map(function (_, i) { return i; }));
          order.forEach(function (pi, k) { list[pi].role = roles[k]; list[pi].side = avSide(roles[k]); });
          setPlayers(list);
          const li = Math.floor(Math.random() * n);
          setLeaderIdx(li);
          if ((cfg.av || {}).lady && n >= 7) {
            ladyHolderRef.current = list[(li + n - 1) % n].name;
            ladyDoneRef.current = [ladyHolderRef.current];
            pushLog([{ type: "info", text: "湖中仙女入场：牌先在 " + ladyHolderRef.current + " 手上，第 2 个任务后开始查验。" }]);
          }
          const board = roles.map(function (r) { return AV_ROLE_ZH[r]; });
          pushLog([{ type: "info", text: "本局 " + n + " 人。阵营配置：好人 " + roles.filter(function (r) { return avSide(r) === "good"; }).length + " · 坏人 " + roles.filter(function (r) { return avSide(r) === "evil"; }).length + "。身份：" + board.join("、") + "（谁是谁保密）。" }]);
          setPhase("reveal");
        } catch (e) { setErrMsg((e && e.message) || "开局失败，重试"); setPhase("error"); }
      })();
    }, []);

    // ---- 组队提议 ----
    const startQuest = function (qn, li, vt) {
      setPhase("propose"); setTeam([]); setTeamSel([]); setUserVote(null); setUserPlay(null);
      const ld = players[li];
      pushLog([{ type: "phase", text: "第 " + (qn + 1) + " 个任务 · 队长 " + ld.name + (ld.isUser ? "(你)" : "") + " 组队（需 " + (AV_QUEST[players.length] || AV_QUEST[5])[qn] + " 人" + (avFailsReq(players.length, qn) === 2 ? "，双失败任务" : "") + "）" }]);
      if (ld.isUser && cfg.mode !== "spectate") { /* 等你在弹框里选 */ }
      else aiPropose(qn, li);
    };
    const aiPropose = async function (qn, li) {
      setBusy(true);
      try {
        const ld = players[li];
        const need = (AV_QUEST[players.length] || AV_QUEST[5])[qn];
        const r = await genProposal(api, ld, players, need, qn, avFailsReq(players.length, qn), histText(), players.map(function (p) { return p.name; }));
        let tm = (r.team || []).map(function (nm) { const p = pByName(nm); return p ? p.name : null; }).filter(Boolean);
        tm = tm.filter(function (v, i) { return tm.indexOf(v) === i; }).slice(0, need);
        // 补足/去重后不够就随机补（含队长优先）
        if (tm.length < need) { const pool = shuffle(players.map(function (p) { return p.name; }).filter(function (nm) { return tm.indexOf(nm) < 0; })); while (tm.length < need && pool.length) tm.push(pool.shift()); }
        commitProposal(tm, ld, qn, li, r.reason || "", Array.isArray(r.talks) ? r.talks : null);
      } catch (e) {
        if (e && e.ccRequired) { props.toast && props.toast(e.message); setBusy(false); return; }
        // 生成接口连续失败也不能卡死：队长优先带自己，再随机补齐一支合法队伍继续投票。
        props.toast && props.toast("组队生成失败，已由法官补一支合法队伍");
        const ld = players[li];
        const need = (AV_QUEST[players.length] || AV_QUEST[5])[qn];
        const fallback = [ld.name].concat(shuffle(players.filter(function (p) { return p !== ld; }).map(function (p) { return p.name; }))).slice(0, need);
        commitProposal(fallback, ld, qn, li, "接口失灵，先按座次临时组队");
      }
    };
    const commitProposal = async function (tm, ld, qn, li, reason, proposedTalks) {
      setTeam(tm);
      pushHist("任务" + (qn + 1) + " 队长" + ld.name + "组队[" + tm.join("、") + "]" + (reason ? "，称:" + reason : ""));
      pushLog([{ type: "propose", leader: ld.name, isUser: ld.isUser, team: tm, reason: reason }]);
      // ⭐圆桌讨论（投票前的嘴仗）：一次调用出全桌发言，失败不挡流程
      setBusy(true);
      try {
        const talks = proposedTalks && proposedTalks.length ? proposedTalks : await genTableTalk(api, players, tm, ld.name, reason, qn, histText(), me && cfg.mode !== "spectate" ? me.name : "");
        talks.slice(0, 5).forEach(function (tk) { const p = pByName(tk.name); if (p && tk.say) { pushLog([{ type: "talk", name: p.name, say: String(tk.say).slice(0, 80) }]); pushHist(p.name + "说:" + String(tk.say).slice(0, 40)); } });
      } catch (e) {/* 讨论生成失败就静默跳过，别挡投票 */}
      setBusy(false);
      setPhase("vote"); setUserVote(null);
      // 观战 / 队长非你时也要收 AI 票；你在场则等你先投
      if (!(me && cfg.mode !== "spectate")) runVotes(tm, qn, li, null);
    };
    const submitUserTeam = function () {
      if (teamSel.length !== needSize) return;
      commitProposal(teamSel.slice(), leader, questNum, leaderIdx, "");
    };

    // ---- 投票 ----
    const runVotes = async function (tm, qn, li, uVote) {
      setBusy(true);
      try {
        const voters = players.filter(function (p) { return !(p.isUser && cfg.mode !== "spectate"); });
        const raw = await genAvVotes(api, voters, tm, players[li].name, players, qn, histText(), hecklesRef.current);
        const votes = voters.map(function (v) {
          const hit = raw.find(function (r) { return r.name && (r.name.indexOf(v.name) >= 0 || v.name.indexOf(r.name) >= 0); });
          // 票对不上名字不掷硬币——那一票谁都解释不了。按赞成计（阿瓦隆没有弃权），理由写明白
          const approve = hit ? !/反对|拒绝|否|reject|no/i.test(String(hit.vote)) && /赞成|同意|通过|approve|yes/i.test(String(hit.vote)) : true;
          return { name: v.name, approve: approve, reason: (hit && hit.reason) || (hit ? "" : "（没说清，按赞成计）") };
        });
        if (me && cfg.mode !== "spectate" && uVote != null) votes.push({ name: me.name, approve: uVote === "approve", reason: "（你的一票）", mine: true });
        const yes = votes.filter(function (v) { return v.approve; }).length;
        const no = votes.length - yes;
        const approved = yes > no;
        pushHist("投票 赞成" + yes + ":反对" + no + " → " + (approved ? "通过" : "否决"));
        pushHist("投票明细：" + votes.map(function (v) { return v.name + "=" + (v.approve ? "赞成" : "反对") + (v.reason ? "(" + v.reason + ")" : ""); }).join("；"));
        pushLog([{ type: "votes", votes: votes, yes: yes, no: no, approved: approved }]);
        if (approved) { setBusy(false); goQuest(tm, qn, li); }
        else {
          const vt2 = (voteTrackFor(qn, li)) + 1;
          if (vt2 >= 5) { setBusy(false); pushLog([{ type: "info", text: "连续 5 次组队被否决——坏人不战而胜。" }]); finish("evil"); return; }
          setVoteTrack(vt2); vtRef.current = vt2;
          pushHist("连续否决：" + vt2 + "/5");
          pushLog([{ type: "info", text: "队伍被否决（第 " + vt2 + "/5 次），换下一位队长重组。" }]);
          const nli = (li + 1) % players.length;
          setLeaderIdx(nli); setBusy(false);
          saveCkpt(qn, nli, vt2, results, players);
          setTimeout(function () { startQuest(qn, nli, vt2); }, 30);
        }
      } catch (e) {
        if (e && e.ccRequired) { props.toast && props.toast(e.message); setBusy(false); return; }
        // callRetry 已失败两次；观战局没有按钮可重试，法官以 AI 默认赞成、保留真人原票的方式推进，避免永久卡桌。
        props.toast && props.toast("投票生成失败，法官已用兜底票型推进");
        const fallbackVotes = players.map(function (p) {
          const mine = p.isUser && cfg.mode !== "spectate";
          return { name: p.name, approve: mine && uVote != null ? uVote === "approve" : true, reason: mine ? "（你的一票）" : "（法官兜底）", mine: mine };
        });
        const yes = fallbackVotes.filter(function (v) { return v.approve; }).length;
        const no = fallbackVotes.length - yes;
        pushHist("投票 赞成" + yes + ":反对" + no + " → 通过（接口兜底）");
        pushHist("投票明细：" + fallbackVotes.map(function (v) { return v.name + "=" + (v.approve ? "赞成" : "反对") + "(" + v.reason + ")"; }).join("；"));
        pushLog([{ type: "votes", votes: fallbackVotes, yes: yes, no: no, approved: true }]);
        setBusy(false); goQuest(tm, qn, li);
      }
    };
    // voteTrack 用 state，但连否时闭包可能过期——从 log 里推不方便，这里用一个 ref 兜底
    const voteTrackFor = function () { return vtRef.current; };
    useEffect(function () { vtRef.current = voteTrack; }, [voteTrack]);

    // ---- 任务执行 ----
    const goQuest = function (tm, qn, li) {
      setPhase("quest"); setUserPlay(null);
      const teamP = tm.map(pByName).filter(Boolean);
      const evilOnTeam = teamP.filter(function (p) { return p.side === "evil" && !(p.isUser && cfg.mode !== "spectate"); });
      const meOnTeam = me && cfg.mode !== "spectate" && tm.indexOf(me.name) >= 0;
      // 你在队里且是坏人 → 等你选；否则（你是好人或不在队）直接处理 AI
      if (meOnTeam && me.side === "evil") { /* 等你在弹框选成功/失败 */ }
      else resolveWithAI(tm, qn, li, evilOnTeam, meOnTeam && me.side === "good" ? 0 : 0);
    };
    const submitUserPlay = function (play) {
      setUserPlay(play);
      const tm = team;
      const teamP = tm.map(pByName).filter(Boolean);
      const evilOnTeam = teamP.filter(function (p) { return p.side === "evil" && !(p.isUser); });
      resolveWithAI(tm, questNum, leaderIdx, evilOnTeam, play === "失败" ? 1 : 0);
    };
    const resolveWithAI = async function (tm, qn, li, evilOnTeam, userFails) {
      setBusy(true);
      try {
        let fails = userFails || 0;
        if (evilOnTeam.length) {
          const plays = await genQuest(api, evilOnTeam, players, qn, avFailsReq(players.length, qn), { good: results.filter(function (r) { return r.success; }).length, evil: results.filter(function (r) { return !r.success; }).length });
          evilOnTeam.forEach(function (p) { const hit = plays.find(function (x) { return x.name && (x.name.indexOf(p.name) >= 0 || p.name.indexOf(x.name) >= 0); }); if (hit && /失败|fail/i.test(String(hit.play))) fails++; });
        }
        resolveQuest(tm, qn, li, fails);
      } catch (e) {
        if (e && e.ccRequired) { props.toast && props.toast(e.message); setBusy(false); return; }
        // 任务生成失败不能把观战/好人玩家永久卡在执行中；AI 坏人本轮按藏票（成功票）兜底。
        props.toast && props.toast("任务生成失败，AI 队员本轮按成功票结算");
        resolveQuest(tm, qn, li, userFails || 0);
      }
    };
    const resolveQuest = async function (tm, qn, li, fails) {
      const req = avFailsReq(players.length, qn);
      const success = fails < req;
      const newResults = results.concat([{ success: success, fails: fails }]);
      setResults(newResults); setBusy(false);
      pushHist("任务" + (qn + 1) + "结果：" + (success ? "成功" : "失败") + "（" + fails + "张失败票）");
      pushLog([{ type: "questresult", n: qn + 1, success: success, fails: fails }]);
      const good = newResults.filter(function (r) { return r.success; }).length;
      const evil = newResults.length - good;
      // ⭐任务失败且比赛未完 → 甩锅环节：队员自证/互咬（一次调用，失败不挡流程）
      if (!success && evil < 3 && good < 3) {
        setBusy(true);
        try {
          const talks = await genBlame(api, players, tm, qn, fails, histText());
          talks.slice(0, 4).forEach(function (tk) { const p = pByName(tk.name); if (p && tk.say) { pushLog([{ type: "talk", name: p.name, say: String(tk.say).slice(0, 80) }]); pushHist(p.name + "说:" + String(tk.say).slice(0, 40)); } });
        } catch (e) {/* 静默跳过 */}
        setBusy(false);
      }
      if (good >= 3) { setTimeout(function () { enterAssassin(); }, 40); return; }
      if (evil >= 3) { finish("evil"); return; }
      const nli = (li + 1) % players.length;
      setQuestNum(qn + 1); setLeaderIdx(nli); setVoteTrack(0); vtRef.current = 0;
      saveCkpt(qn + 1, nli, 0, newResults, players);
      // 湖中仙女：第 2/3/4 个任务结算后、胜负未分时查验一轮，验完才进下一个任务
      if ((cfg.av || {}).lady && players.length >= 7 && newResults.length >= 2 && newResults.length <= 4 && ladyHolderRef.current) {
        setTimeout(function () { runLady(qn + 1, nli); }, 40);
        return;
      }
      setTimeout(function () { startQuest(qn + 1, nli, 0); }, 40);
    };
    // ---- 湖中仙女 ----
    const runLady = function (nextQn, nli) {
      const holder = players.find(function (p) { return p.name === ladyHolderRef.current; });
      const targets = players.filter(function (p) { return p !== holder && ladyDoneRef.current.indexOf(p.name) < 0; }).map(function (p) { return p.name; });
      if (!holder || !targets.length) { startQuest(nextQn, nli, 0); return; }
      setPhase("lady");
      pushLog([{ type: "phase", text: "湖中仙女 · " + holder.name + (holder.isUser ? "(你)" : "") + " 持牌查验" }]);
      if (holder.isUser && cfg.mode !== "spectate") { setLadyCtx({ targets: targets, nextQn: nextQn, nli: nli, seen: null }); return; }
      (async function () {
        setBusy(true);
        try {
          const isEng = !!holder.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(holder.key));
          let targetName = null, announce = null, say = "";
          if (isEng && typeof window !== "undefined" && window.CCSeat) {
            // 言秋持牌：验谁 + 宣布什么都TA自己定；真相由规则层算出后随第二问给TA
            const pick = await window.CCSeat.ask({ tool: "game_turn", game: "avalon_lady", turn_id: gameRunId.current + ":lady-pick:" + nextQn, char_id: holder.key,
              sys: "「阿瓦隆」湖中仙女在你手上。从这些人里挑一个查验真实阵营：" + targets.join("、") + "。只输出 JSON：{\"target\":\"人名\"}。",
              msgs: [{ role: "user", content: "【你的身份】" + avSecretFor(holder, players) + "\n【局面】\n" + histText() }], expect: '{"target":"人名"}' }, 90000, { charId: holder.key });
            targetName = String((pick && pick.target) || "").trim();
            const tp0 = pByName(targetName);
            if (tp0) {
              const truth = tp0.side === "evil" ? "坏人" : "好人";
              const ann = await window.CCSeat.ask({ tool: "game_turn", game: "avalon_lady", turn_id: gameRunId.current + ":lady-ann:" + nextQn, char_id: holder.key,
                sys: "「阿瓦隆」你查验了 " + tp0.name + "，真实阵营是【" + truth + "】（只有你知道）。当众宣布 TA 是好人还是坏人（可以撒谎）。只输出 JSON：{\"announce\":\"好人或坏人\",\"say\":\"一句话\"}。",
                msgs: [{ role: "user", content: "宣布。" }], expect: '{"announce":"好人或坏人","say":"一句话"}' }, 90000, { charId: holder.key });
              announce = /坏/.test(String((ann && ann.announce) || "")) ? "坏人" : "好人";
              say = String((ann && ann.say) || "").trim();
            }
          } else {
            const pick = await genLadyCheck(api, holder, targets, players, histText());
            targetName = String((pick && pick.target) || "").trim();
            const tp0 = pByName(targetName);
            if (tp0) {
              const ann = await genLadyAnnounce(api, holder, tp0.name, tp0.side === "evil", players, histText());
              const a0 = String((ann && ann.announce) || "").trim();
              // 解析不出来按阵营本能：好人照实，坏人护同伙（验出坏人谎报好人）
              announce = a0 ? (/坏/.test(a0) ? "坏人" : "好人")
                : (holder.side === "evil" ? "好人" : (tp0.side === "evil" ? "坏人" : "好人"));
              say = String((ann && ann.say) || "").trim();
            }
          }
          const isEng2 = !!holder.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(holder.key));
          let tp = pByName(targetName);
          // 只有普通 AI 的非法目标才由规则层随机补；言秋的票非法/没回来一律跳过（不代验不代嘴）
          if ((!tp || tp === holder || ladyDoneRef.current.indexOf(tp.name) >= 0) && !isEng2) tp = shuffle(targets.map(pByName).filter(Boolean))[0] || null;
          if (!tp || tp === holder || ladyDoneRef.current.indexOf(tp.name) >= 0 || !announce) {
            pushLog([{ type: "info", text: holder.name + " 这一轮没有动牌，湖中仙女留在原处。" }]);
            setBusy(false); startQuest(nextQn, nli, 0); return;
          }
          settleLady(holder, tp, announce, say, nextQn, nli);
        } catch (e) {
          pushLog([{ type: "info", text: "这一轮查验没验成，牌先留在原处。" }]);
          setBusy(false); startQuest(nextQn, nli, 0);
        }
      })();
    };
    const settleLady = function (holder, tp, announce, say, nextQn, nli) {
      setBusy(false);
      pushLog([{ type: "talk", name: holder.name, say: (say ? say + " " : "") + "——我宣布，" + tp.name + " 是【" + announce + "】。" }]);
      pushHist("湖中仙女：" + holder.name + "查验" + tp.name + "，宣布 TA 是" + announce);
      ladyDoneRef.current = ladyDoneRef.current.concat([tp.name]);
      ladyHolderRef.current = tp.name;
      pushLog([{ type: "info", text: "湖中仙女的牌传给了 " + tp.name + "。" }]);
      setLadyCtx(null);
      saveCkpt(nextQn, nli, 0, results, players);
      setTimeout(function () { startQuest(nextQn, nli, 0); }, 40);
    };
    const submitLadyPick = function (name) {
      const c = ladyCtx; if (!c) return;
      const tp = pByName(name); if (!tp) return;
      setLadyCtx(Object.assign({}, c, { seen: { name: tp.name, isEvil: tp.side === "evil" } }));
    };
    const submitLadyAnnounce = function (announce) {
      const c = ladyCtx; if (!c || !c.seen) return;
      const holder = players.find(function (p) { return p.isUser; });
      const tp = pByName(c.seen.name); if (!holder || !tp) { setLadyCtx(null); startQuest(c.nextQn, c.nli, 0); return; }
      settleLady(holder, tp, announce, "", c.nextQn, c.nli);
    };

    // ---- 终局刺杀 ----
    const enterAssassin = function () {
      setPhase("assassin");
      pushLog([{ type: "info", text: "好人完成了 3 个任务！但坏人还有最后一击——刺客要指认梅林。" }]);
      const assassin = players.find(function (p) { return p.role === "assassin"; });
      if (assassin && assassin.isUser && cfg.mode !== "spectate") { /* 等你选 */ }
      else aiAssassin(assassin);
    };
    const aiAssassin = async function (assassin) {
      if (!assassin) { finish("good"); return; }
      setBusy(true);
      try {
        const r = await genAssassin(api, assassin, players, histText());
        const goodCandidates = players.filter(function (p) { return p.side === "good"; });
        let tp = pByName(r.target);
        if (!tp || tp.side !== "good") tp = shuffle(goodCandidates)[0] || null; // 非法目标不能让刺客白白跳过规则终局
        settleAssassin(assassin, tp, r.reason || "");
      } catch (e) {
        // 两次生成都失败时仍要结算，不能永远卡在「刺客正在锁定」。
        const fallback = shuffle(players.filter(function (p) { return p.side === "good"; }))[0] || null;
        props.toast && props.toast("刺杀判断生成失败，已由法官随机锁定一名好人");
        settleAssassin(assassin, fallback, "（法官兜底）");
      }
    };
    const settleAssassin = function (assassin, targetP, reason) {
      setBusy(false);
      setAssassinPick(targetP ? targetP.name : null);
      const hit = targetP && targetP.role === "merlin";
      pushLog([{ type: "assassin", by: assassin.name, target: targetP ? targetP.name : "（没锁定）", reason: reason, hit: hit }]);
      finish(hit ? "evil" : "good");
    };
    const finish = function (w) { setWinner(w); setPhase("result"); };

    // ---- 渲染 ----
    const table = gameTable("avalon", t);
    const header = h(Head, { zh: "阿瓦隆", en: "Avalon", onBack: props.onBack, bg: "transparent" });
    if (phase === "error") return h("div", { "data-wk": "gameplay", "data-part": "avalon", "data-kind": "error", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "⚔️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { "data-wk": "block", onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));
    if (phase === "loading") return h("div", { "data-wk": "gameplay", "data-part": "avalon", "data-kind": "loading", className: "h-full flex flex-col", style: table }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: "calc(40px * var(--app-fs, 1))" } }, "⚔️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, "发牌·分配阵营与身份…")));

    // 头像条：标出当前队长 + 被提议进队的人
    const roster = seatRow(players.map(function (p) {
      const isLd = leader && p.name === leader.name && phase !== "result";
      const onTeam = (phase === "vote" || phase === "quest") && team.indexOf(p.name) >= 0;
      return h(Seat, { key: p.key, t: t, p: p, avatar: pAvatar(p, 36), ring: onTeam, mark: isLd ? "👑" : null, onClick: function () { setDetail(p); } });
    }));

    // 任务进度条：5 个圆
    const track = h("div", { className: "shrink-0", style: { display: "flex", gap: 8, justifyContent: "center", padding: "10px 16px 4px" } },
      [0, 1, 2, 3, 4].map(function (i) {
        const r = results[i];
        const cur = i === questNum && (phase === "propose" || phase === "vote" || phase === "quest");
        const dbl = players.length >= 7 && i === 3;
        const bg = r ? (r.success ? "#3f6d5a" : "#c0553f") : (cur ? t.tint : t.bg2);
        return h("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
          h("div", { "data-wk": "block", style: { width: 30, height: 30, borderRadius: 999, background: bg, border: "1px solid " + (r || cur ? "transparent" : t.line), color: r || cur ? "#fff" : t.fog, fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", display: "flex", alignItems: "center", justifyContent: "center" } }, r ? (r.success ? "✓" : "✗") : (players.length ? (AV_QUEST[players.length] || AV_QUEST[5])[i] : "")),
          dbl ? h("div", { style: { fontSize: "calc(8px * var(--app-fs, 1))", color: t.fog } }, "2失败") : h("div", { style: { fontSize: "calc(8px * var(--app-fs, 1))", color: "transparent" } }, "·"));
      }));

    const logView = h("div", { "data-wk": "gamelog", "data-part": "avalon", ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "8px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.65, margin: "8px 0", textAlign: "center" } }, it.text);
        if (it.type === "phase") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint, margin: "12px 0 4px", letterSpacing: .5 } }, "· " + it.text + " ·");
        if (it.type === "propose") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { margin: "6px 0" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "👑 " + it.leader + (it.isUser ? "(你)" : "") + " 提议：" + it.team.join("、")),
          it.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginTop: 2, lineHeight: 1.5 } }, "“" + it.reason + "”") : null);
        if (it.type === "talk") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, "data-me": it.mine ? "1" : "0", key: i, style: { margin: "3px 0", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.55 } },
          h("span", { style: { fontWeight: 700, color: it.mine ? t.tint : t.sub } }, "💬 " + it.name + (it.mine ? "(你)" : "") + "："), it.say);
        if (it.type === "votes") return h("div", { "data-wk": "gamelogline", "data-kind": it.type, key: i, style: { margin: "6px 0", background: t.bg2, borderRadius: 10, padding: "8px 11px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 700, color: it.approved ? "#3f6d5a" : "#c0553f", marginBottom: 4 } }, (it.approved ? "✓ 通过" : "✗ 否决") + "（赞成 " + it.yes + " · 反对 " + it.no + "）"),
          it.votes.map(function (v, k) { return h("div", { key: k, style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.5 } }, (v.approve ? "✔ " : "✘ ") + v.name + (v.mine ? "(你)" : "") + (v.reason ? "：" + v.reason : "")); }));
        if (it.type === "questresult") return h("div", { key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: it.success ? "#3f6d5a" : "#c0553f" } }, "任务 " + it.n + (it.success ? " 成功 ✓" : " 失败 ✗") + "　（" + it.fails + " 张失败票）");
        if (it.type === "assassin") return h("div", { key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.6 } }, "🗡 刺客 " + it.by + " 指认梅林 → " + it.target + (it.reason ? "\n“" + it.reason + "”" : ""));
        return null;
      }));

    // ---- 底部动作 ----
    let inline = null, pick = null;
    const roleBanner = me ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, textAlign: "center", marginBottom: 8, lineHeight: 1.6 } }, avRevealFor(me, players)) : null;
    const teamChip = function (p, on, onTap) { return h("button", { "data-wk": "block", key: p.key, onClick: onTap, style: { display: "flex", alignItems: "center", gap: 5, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "4px 11px 4px 4px" } }, pAvatar(p, 20), p.name + (p.isUser ? "(你)" : "")); };

    if (phase === "reveal") {
      inline = h("div", null,
        h("div", { "data-wk": "block", style: { background: t.bg2, borderRadius: 12, padding: "11px 13px", marginBottom: 10, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.75 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, marginBottom: 5 } }, "怎么玩"),
          "共 5 个「任务」。好人要做成功 3 个，坏人要弄失败 3 个。每个任务两步：",
          h("br"), "① 当值『队长』提名几人组队（人数看下方圆圈）；",
          h("br"), "② 全场投票赞成/反对这支队——赞成过半才出发，否则换下一位队长重提（连否 5 次坏人直接赢）。",
          h("br"), "出发后队里每人暗投成功/失败：好人只能成功，坏人可偷偷投失败搞砸（1 张失败票任务就砸，标『2失败』的要 2 张）。没人知道谁投的，只公布几张失败票。",
          h("br"), "好人赢满 3 任务后，坏人里的刺客还有最后一击——指认谁是梅林，猜中就坏人翻盘。",
          h("br"), h("b", { style: { color: t.ink } }, "队长"), "开局随机第一个，之后按顺序轮流当。"),
        roleBanner,
        h("button", { onClick: function () { saveCkpt(0, leaderIdx, 0, results, players); startQuest(0, leaderIdx, 0); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, cfg.mode === "spectate" ? "开始（观战）" : "记住身份 · 开始"));
    } else if (busy) {
      inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "…桌上正在博弈");
    } else if (phase === "lady" && ladyCtx) {
      if (!ladyCtx.seen) {
        pick = { title: "湖中仙女在你手上", sub: "挑一个人查验真实阵营——结果只有你看得到，宣布什么由你定。",
          body: h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" } },
            ladyCtx.targets.map(function (nm) { const p2 = pByName(nm); return p2 ? teamChip(p2, false, function () { submitLadyPick(nm); }) : null; })) };
      } else {
        pick = { title: "查验结果（只有你知道）",
          body: h("div", null,
            h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginBottom: 6 } },
              h("b", { style: { color: ladyCtx.seen.isEvil ? "#c0553f" : "#3f6d5a" } }, ladyCtx.seen.name + " 的真实阵营是【" + (ladyCtx.seen.isEvil ? "坏人" : "好人") + "】")),
            h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 12 } }, "现在当众宣布——可以照实说，也可以撒谎。"),
            h("div", { style: { display: "flex", gap: 10 } },
              h("button", { onClick: function () { submitLadyAnnounce("好人"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 12, padding: "12px" } }, "宣布【好人】"),
              h("button", { onClick: function () { submitLadyAnnounce("坏人"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 12, padding: "12px" } }, "宣布【坏人】"))) };
      }
    } else if (phase === "propose") {
      if (leader && leader.isUser && cfg.mode !== "spectate") {
        pick = { title: "你是队长 · 选 " + needSize + " 人上场", sub: "第 " + (questNum + 1) + " 个任务" + (failsReq === 2 ? "（需 2 张失败票才失败）" : "") + "。点头像加入 / 移除。",
          body: h("div", null,
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 12 } },
              players.map(function (p) { const on = teamSel.indexOf(p.name) >= 0; return teamChip(p, on, function () { setTeamSel(function (s) { return on ? s.filter(function (x) { return x !== p.name; }) : (s.length < needSize ? s.concat([p.name]) : s); }); }); })),
            h("button", { "data-wk": "block", onClick: submitUserTeam, disabled: teamSel.length !== needSize, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: teamSel.length === needSize ? t.ink : t.line, borderRadius: 12, padding: "12px" } }, "提议这支队伍（" + teamSel.length + "/" + needSize + "）")) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "队长 " + (leader ? leader.name : "") + " 在组队…");
    } else if (phase === "vote") {
      if (me && cfg.mode !== "spectate") {
        const castVote = function (v) {
          const sayTxt = voteSay.trim();
          if (sayTxt) { pushLog([{ type: "talk", name: me.name, say: sayTxt, mine: true }]); pushHist(me.name + "(用户)说:" + sayTxt.slice(0, 40)); setVoteSay(""); }
          setPickerOpen(false);
          runVotes(team, questNum, leaderIdx, v);
        };
        pick = { title: "对这支队伍投票", sub: "队长 " + (leader ? leader.name : "") + " 提议：" + team.join("、"),
          body: h("div", null,
            h("input", { "data-wk": "gameinput", "data-part": "votesay", value: voteSay, onChange: function (e) { setVoteSay(e.target.value); }, placeholder: "投票前想说一句？（可空，大家都会听到）", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", background: t.bg2, color: t.ink, border: "1px solid " + t.line, marginBottom: 10 } }),
            h("div", { style: { display: "flex", gap: 12 } },
              h("button", { onClick: function () { castVote("approve"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 12, padding: "13px" } }, "✔ 赞成"),
              h("button", { onClick: function () { castVote("reject"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 12, padding: "13px" } }, "✘ 反对"))) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "大家在投票…");
    } else if (phase === "quest") {
      const meOnTeam = me && cfg.mode !== "spectate" && team.indexOf(me.name) >= 0;
      if (meOnTeam && me.side === "evil") {
        pick = { title: "你在任务队里 · 你是坏人", sub: "第 " + (questNum + 1) + " 个任务。出『失败』推进坏人取胜，但会暴露队里有内鬼。",
          body: h("div", { style: { display: "flex", gap: 12 } },
            h("button", { onClick: function () { setPickerOpen(false); submitUserPlay("成功"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 12, padding: "13px" } }, "让任务成功"),
            h("button", { onClick: function () { setPickerOpen(false); submitUserPlay("失败"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 12, padding: "13px" } }, "破坏任务")) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, meOnTeam ? "你是好人，只能让任务成功——出任务中…" : "队伍在执行任务…");
    } else if (phase === "assassin") {
      const assassin = players.find(function (p) { return p.role === "assassin"; });
      if (assassin && assassin.isUser && cfg.mode !== "spectate") {
        const cands = players.filter(function (p) { return p.side === "good"; });
        pick = { title: "你是刺客 · 指认梅林", sub: "好人赢了 3 个任务，但你猜中梅林就能翻盘。回想谁的组队 / 投票像早就知道坏人。",
          body: h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" } },
            cands.map(function (p) { return teamChip(p, false, function () { setPickerOpen(false); settleAssassin(assassin, p, "（你的直觉）"); }); })) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "10px 0" } }, "刺客在锁定梅林…");
    } else if (phase === "result") {
      const goodWin = winner === "good";
      inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: goodWin ? "#3f6d5a" : "#c0553f", marginBottom: 8 } }, goodWin ? "⚔️ 亚瑟的忠臣获胜" : "🗡 莫德雷德的爪牙获胜"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginBottom: 12 } }, "身份揭晓：" + players.map(function (p) { return p.name + (p.isUser ? "(你)" : "") + "=" + AV_ROLE_ZH[p.role] + (p.side === "evil" ? "🗡" : ""); }).join("　") + (assassinPick ? "　｜ 刺客指认了 " + assassinPick : "")),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { "data-wk": "block", onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")),
        h(KeepMemBtn, { t: t, host: props, rep: function () {
          const won = function (q) { return (winner === "good") === (q.side === "good"); };
          return { proc: log, key: "avalon", zh: "阿瓦隆", ids: realCharIds(players), wins: realCharIds(players).filter(function (id) { const q = players.find(function (x) { return x.key === id; }); return q && won(q); }), meWin: me ? won(me) : null,
            text: "一起玩了「阿瓦隆」，" + (winner === "good" ? "亚瑟的忠臣赢了" : "莫德雷德的爪牙赢了") + "。"
            + (me ? ("她是" + AV_ROLE_ZH[me.role] + "，" + (won(me) ? "站在赢的一边" : "输了这一局")) : "她观战")
            + (assassinPick ? "；刺客终局指认了 " + assassinPick : "") + "。" };
        } }));
    }

    const bottom = pick
      ? (pickerOpen
        ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "8px 0" } }, "在弹框里操作 · 也可先关掉回看局面")
        : h("button", { onClick: function () { setPickerOpen(true); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.tint, borderRadius: 13, padding: "12px" } }, "▸ 轮到你了 · 点这里操作"))
      : inline;

    const canHeckle = cfg.mode === "spectate" && (phase === "propose" || phase === "vote" || phase === "quest");
    const sendHeckle = async function () {
      const v = heckleText.trim(); if (!v || busy) return;
      setHeckleText("");
      const nm = ((props.profile && props.profile.name) || "你") + "(场外)";
      pushLog([{ type: "talk", name: nm, say: v, mine: true }]);
      hecklesRef.current = hecklesRef.current.concat([nm + "：" + v]).slice(-6);
      try {
        const pool = players.filter(function (p) { return !p.isUser; });
        const talks = await genHeckle(api, pool, "阿瓦隆", nm, v, histText().split("\n").slice(-6).join("\n"));
        if (talks.length) pushLog(talks.map(function (x) { return { type: "talk", name: x.name, say: x.text }; }));
      } catch (e) { /* 起哄接不上就算了 */ }
    };
    return h("div", { "data-wk": "gameplay", "data-part": "avalon", className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, table) }, header, roster,
      phase !== "reveal" && phase !== "result" ? track : null, logView,
      h("div", { "data-wk": "gameactions", "data-part": "avalon", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "50vh", overflowY: "auto" } },
        canHeckle ? heckleRow(t, heckleText, setHeckleText, sendHeckle, busy) : null, bottom),
      (pick && pickerOpen) ? h(PickerModal, { t: t, title: pick.title, sub: pick.sub, onClose: function () { setPickerOpen(false); } }, roleBanner, pick.body) : null,
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), roleText: phase === "result" ? ("身份：" + AV_ROLE_ZH[detail.role]) : null, roleBad: detail.side === "evil", onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // CC 座位通用件（v54.26）
  // UNO 是【逐座调用】，engineer 座位直接问 CC 就行（下面的 routeSeatCall）。
  // 其余六个游戏是【整桌一次调用】：一次生成所有 AI 玩家的发言/投票。想让言秋在这些
  // 游戏里也亲自打自己那一座，就得把TA从批量里【摘出来】：
  //   ① 先单独问 CC 要TA这一座的产出；
  //   ② 摘掉之后的名单才进批量，并把TA已经定下的内容作为【已经发生的】写进提示词；
  //   ③ 拿不到（CC 离线／超时／解析失败）就让本人这一手留空；绝不退回批量让 Gemini 冒充。
  // 所有批量环节共用这一个函数，别再各写各的。
  // ============================================================
  function ccSeatOf(seats) {
    return (seats || []).find(function (s) { return s && s.engineer && !s.isUser && (s.alive === undefined || s.alive); }) || null;
  }
  async function ccCarve(gameKey, seats, spec) {
    const seat = ccSeatOf(seats);
    const rest = seats || [];
    if (!seat) return { seat: null, rest: rest, done: null };
    const withoutSeat = rest.filter(function (x) { return x !== seat; });
    // 「本人亲打」是身份边界，不是模型选择偏好。CC 不在线也不能让 Gemini 冒充TA。
    if (typeof window === "undefined" || !window.CCSeat) return { seat: seat, rest: withoutSeat, done: null, unavailable: true, reason: "App 里的言秋亲打通道没有加载" };
    const o = spec || {};
    try {
      const value = await window.CCSeat.ask({
        tool: "game_turn", game: gameKey, turn_id: o.turnId, char_id: seat.key,
        sys: o.sys, msgs: o.msgs || [{ role: "user", content: o.ask || "轮到你了。" }],
        expect: o.expect,
        deadline_at: new Date(Date.now() + (o.timeout || 150000)).toISOString()
      });
      const done = (value && typeof value === "object") ? value : (extractJSON(String(value || "")) || null);
      if (!done) return { seat: seat, rest: withoutSeat, done: null, unavailable: true, reason: "言秋没有交回有效动作" };
      return { seat: seat, rest: withoutSeat, done: done };
    } catch (e) { return { seat: seat, rest: withoutSeat, done: null, unavailable: true, reason: (e && e.message) || "票没有进入言秋的队列" }; }
  }
  // 本人亲打的关键回合（发言 / 投票 / 身份行动）不能把“票没送到”解释成弃权。
  // 只有桌上闲聊、吐槽等可选内容允许缺席；关键票失败时留在当前步骤让 Lisa 重试。
  function requireCCDone(carve, label, valid) {
    const missing = carve && carve.seat && (!carve.done || (valid && !valid(carve.done)));
    if (missing) {
      const err = new Error((label || "言秋的本人票") + "没送达或格式无效：" + (carve.reason || "请稍后重试当前步骤"));
      err.ccRequired = true;
      throw err;
    }
    return carve;
  }
  // 摘出去的那一座，作为「已经发生的」写进批量提示词，并明令别替TA生成
  function ccPreface(carve, what) {
    if (!carve || !carve.seat || !carve.done) return "";
    return "\n\n【" + carve.seat.name + " 已经" + (what || "说过了") + "·真实发生，不要替 TA 重写】\n"
      + JSON.stringify(carve.done) + "\n下面的名单里已经没有 TA，别再生成 TA 的那一份。";
  }
  // 把 CC 那一座的结果按原座次插回批量结果里
  function ccMerge(carve, rows, build) {
    if (!carve || !carve.seat || !carve.done) return rows || [];
    const mine = build ? build(carve.seat, carve.done) : null;
    if (!mine) return rows || [];
    return (rows || []).concat([mine]);
  }

  // ============================================================
  // UNO：逐座调用；engineer 座位只交给 CC 本人。票失败时走无人格的牌规兜底，绝不由模型冒充。
  // ============================================================
  async function routeSeatCall(player, api, sys, msgs, opts) {
    const o = opts || {}, canCc = !!(player && player.engineer && typeof window !== "undefined" && window.CCSeat);
    if (canCc) {
      try {
        const waitMs = o.timeout || 150000;
        const result = await window.CCSeat.ask({ tool: "game_turn", game: o.game || "uno", turn_id: o.turnId, char_id: player.key, sys: sys, msgs: msgs, expect: o.expect, deadline_at: new Date(Date.now() + waitMs).toISOString() }, waitMs, { charId: player.key });
        return { value: result, delegated: false };
      } catch (e) {
        return { value: null, delegated: false, ccUnavailable: true, error: (e && e.message) || "本人票未送达" };
      }
    }
    return { value: await callRetry(api, sys, msgs, o.ai || {}), delegated: false };
  }
  function unoJson(raw) { if (raw && typeof raw === "object") return raw; return extractJSON(String(raw || "")) || {}; }
  function unoPlayers(props, max) {
    const cfg = props.config || {}, chars = props.characters || [], out = [];
    if (cfg.mode !== "spectate") out.push({ key: "user", name: userName(props.profile), isUser: true, persona: "用户本人" });
    (cfg.charIds || []).forEach(function (id) {
      const c = chars.find(function (x) { return String(x.id) === String(id); }); if (!c) return;
      const persona = gameSheet(c).slice(0, 1800);
      out.push({ key: String(c.id), name: c.name || "角色", isUser: false, isNpc: false, persona: persona, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)) });
    });
    const names = ["小北", "阿禾", "南枝", "满满", "青团", "栗子"];
    for (let i = 0; i < Number(cfg.npcCount || 0); i++) out.push({ key: "npc" + i, name: names[i] || ("牌友" + (i + 1)), isNpc: true, persona: "普通牌友；会认真看牌，也会自然地插科打诨。" });
    return out.slice(0, max || 6);
  }
  // 手机替一家出 UNO：罚牌能叠就叠；平时先出同色、下家快出完了就砸功能牌，万能牌留到最后；变色选手里最多的颜色
  function unoBestColor(hand) { const n = { R: 0, Y: 0, G: 0, B: 0 }; hand.forEach(function (c) { if (n[c.color] != null) n[c.color]++; }); return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; })[0]; }
  function unoLocalMove(state, rnd) {
    const r = rnd || Math.random, p = state.players[state.turn], top = state.discard[state.discard.length - 1];
    if (state.pendingDraw > 0) {
      const st = UnoCore.legalCodes(state), c = p.hand.find(function (x) { return st.indexOf(x.code) >= 0; });
      if (c) return { kind: "play", uid: c.uid, color: unoBestColor(p.hand), uno: p.hand.length === 2 };
      return { kind: state.w4 && top && top.value === "W4" && r() < .25 ? "challenge" : "draw" };
    }
    const cands = p.hand.filter(function (c) { return UnoCore.playable(c, state, p.hand) && (!state.drawnUid || c.uid === state.drawnUid); });
    if (!cands.length) return { kind: state.drawnUid ? "pass" : "draw" };
    const L = state.players.length, next = state.players[((state.turn + state.direction) % L + L) % L];
    const score = function (c) { let s = r(); if (c.color === "W") s -= 4; if (c.color === state.color) s += 2; if (["D2", "S", "V", "W4"].indexOf(c.value) >= 0) s += next && next.hand.length <= 2 ? 6 : 1; return s; };
    const c = cands.slice().sort(function (a, b) { return score(b) - score(a); })[0];
    return { kind: "play", uid: c.uid, color: unoBestColor(p.hand.filter(function (x) { return x.uid !== c.uid; })) || "R", uno: p.hand.length === 2 };
  }
  function unoPublic(state) {
    const top = state.discard[state.discard.length - 1];
    return "当前颜色=" + UnoCore.LABEL[state.color] + "；顶牌=" + UnoCore.describe(top) + "；方向=" + (state.direction > 0 ? "顺时针" : "逆时针") +
      "；每人余牌=" + state.players.map(function (p) { return p.name + ":" + p.hand.length; }).join("，") +
      "；最近记录：\n" + state.log.slice(-8).map(function (x) { return x.text; }).join("\n");
  }
  // ============================================================
  // 五子棋 · 引擎（她 2026-10-11：「先做五子棋吧」）
  // 落子由下面这个打分棋手下，不让模型每步去算：模型算棋慢（几秒一步）、费调用，
  // 而且它下五子棋本来就弱。TA 只负责【说话】——开局、局面一紧、隔几手、终局，才调一次模型。
  // 放水局：棋手偶尔看漏一手防守、在几步好棋里随手挑一步。
  // ============================================================
  const GMK_N = 15;
  const GMK_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function gmkEmpty() { const b = []; for (let i = 0; i < GMK_N * GMK_N; i++) b.push(0); return b; }
  function gmkAt(b, x, y) { return (x < 0 || y < 0 || x >= GMK_N || y >= GMK_N) ? -1 : b[y * GMK_N + x]; }
  // 这一子落下后，沿某个方向连了几颗、两头各开没开
  function gmkLine(b, x, y, dx, dy, who) {
    let n = 1, open = 0, i = 1;
    while (gmkAt(b, x + dx * i, y + dy * i) === who) { n++; i++; }
    if (gmkAt(b, x + dx * i, y + dy * i) === 0) open++;
    i = 1;
    while (gmkAt(b, x - dx * i, y - dy * i) === who) { n++; i++; }
    if (gmkAt(b, x - dx * i, y - dy * i) === 0) open++;
    return { n: n, open: open };
  }
  function gmkWins(b, x, y, who) {
    return GMK_DIRS.some(function (d) { return gmkLine(b, x, y, d[0], d[1], who).n >= 5; });
  }
  // 这一格对 who 值多少：四个方向的棋形分加起来
  function gmkShape(n, open) {
    if (n >= 5) return 1000000;
    if (open === 0) return 0;
    if (n === 4) return open === 2 ? 100000 : 12000;
    if (n === 3) return open === 2 ? 10000 : 900;
    if (n === 2) return open === 2 ? 600 : 80;
    return open === 2 ? 20 : 4;
  }
  function gmkCellScore(b, x, y, who) {
    let s = 0;
    for (const d of GMK_DIRS) { const l = gmkLine(b, x, y, d[0], d[1], who); s += gmkShape(l.n, l.open); }
    return s;
  }
  // 棋子周围两格以内的空位才值得想
  function gmkCandidates(b) {
    const out = [];
    let any = false;
    for (let y = 0; y < GMK_N; y++) for (let x = 0; x < GMK_N; x++) {
      if (b[y * GMK_N + x]) { any = true; continue; }
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) { const v = gmkAt(b, x + dx, y + dy); if (v > 0) near = true; }
      if (near) out.push([x, y]);
    }
    if (!any) out.push([7, 7]);
    return out;
  }
  // 这一手下哪儿。level：0/false 认真，1/true 随手，2 让着（她 2026-10-11：下法跟着聊天变）。rnd 可注入（测试用）
  function gmkBestMove(b, who, level, rnd) {
    rnd = rnd || Math.random;
    const lv = level === true ? 1 : (level || 0), easy = lv > 0;
    const foe = who === 1 ? 2 : 1;
    // ⚠️她 2026-10-12：「放水她们说也打不赢」——原来放水局里【对面马上成五那一下一定挡】，
    //   普通人得同时摆出两个杀招才赢得了，等于没放水。现在：随手局那一下挡六成，让着局两成；
    //   别的防守也看漏得更多，进攻也收着打。
    const blockFive = !easy || rnd() < (lv >= 2 ? 0.2 : 0.6);
    const scored = gmkCandidates(b).map(function (p) {
      const atk = gmkCellScore(b, p[0], p[1], who), def = gmkCellScore(b, p[0], p[1], foe);
      const five = def >= 1000000;
      const seeDef = !easy || (five ? blockFive : rnd() < (lv >= 2 ? 0.15 : 0.35));
      return { x: p[0], y: p[1], win: atk >= 1000000, s: (!easy ? atk * 1.1 : lv >= 2 ? atk * 0.35 : atk * 0.7) + (seeDef ? def : def * 0.05) };
    }).sort(function (a, c) { return c.s - a.s; });
    if (!scored.length) return null;
    if (!easy) return scored[0];
    // 能直接赢的那一下：随手局照赢，让着局一半时候「没看见」
    const winMv = scored.find(function (m) { return m.win; });
    if (winMv && (lv < 2 || rnd() < 0.5)) return winMv;
    const top = scored.filter(function (m) { return m.s >= scored[0].s * (lv >= 2 ? 0.08 : 0.3); }).slice(0, lv >= 2 ? 10 : 6);
    return top[Math.floor(rnd() * top.length)] || scored[0];
  }
  // 给模型看的局面一句话：谁刚形成了什么，不贴整张棋盘
  function gmkThreat(b, x, y, who) {
    let best = 0;
    for (const d of GMK_DIRS) { const l = gmkLine(b, x, y, d[0], d[1], who); best = Math.max(best, gmkShape(l.n, l.open)); }
    if (best >= 1000000) return "连成了五子";
    if (best >= 12000) return best >= 100000 ? "下出了活四，下一手必赢" : "冲了一个四，逼对方必须挡";
    if (best >= 10000) return "摆出了活三";
    return "";
  }
  const gmkCoord = function (x, y) { return "ABCDEFGHJKLMNOP".charAt(x) + (GMK_N - y); };

  // ============================================================
  // 25 问 · 我出题 / TA 出题 / 轮流（群友 2026-10-14：「你可以问他，他也可以问你」）
  //   我出题：她写下答案锁住（模型这边一个字都拿不到，直到揭晓），TA 一轮问一个是否题，她点按钮答；
  //   TA 出题：TA 先照你们的事想好一个东西（存在本局里、不上屏），她问、TA 照实答，她随时可以猜。
  //   轮流：一局一换，记比分。聊天气泡用公共的 GameTalkLog；TA 只在轮到 TA 的时候开口。
  // ============================================================
  const MIND_ANS = ["是", "不是", "不确定", "有点沾边"];
  const MIND_LIMIT = 25;
  function mindNewRound(host, round) { return { host: host, round: round, secret: "", hint: "", qs: [], status: host === "me" ? "setup" : "thinking", result: null }; }
  function MindGame(props) {
    const t = props.t || {}, api = props.active, cfg = props.config || {};
    const char = (props.characters || []).find(function (c) { return c.id === (cfg.charIds || [])[0]; }) || null;
    const pf = props.profile || {}, uName = pf.name || "你", cName = char ? (char.remark || char.name) : "TA";
    const easy = cfg.mode === "easy", alt = cfg.q25Host === "turns";
    const [st, setSt] = useState(function () { return { r: mindNewRound(cfg.q25Host === "ta" ? "ta" : "me", 1), score: { me: 0, ta: 0 } }; });
    const [lines, setLines] = useState([]), [busy, setBusy] = useState(false), [draft, setDraft] = useState(""), [secretDraft, setSecretDraft] = useState(""), [err, setErr] = useState("");
    const r = st.r;
    const push = function (l) { setLines(function (ls) { return ls.concat([Object.assign({ at: Date.now() }, l)]); }); };
    const taSay = function (text) { if (text) push({ id: char && char.id, name: cName, text: String(text).slice(0, 200) }); };
    const recent = (cfg.injectChat && props.recentChatFor && char) ? String(props.recentChatFor(char.id) || "").slice(-600) : "";
    const who = "【你是】" + cName + "\n【人设】" + String((char && char.persona) || "（没写）").slice(0, 1600) + (recent ? "\n【你们最近聊的】" + recent : "");
    const qaText = function (qs) { return qs.length ? qs.map(function (q, i) { return (i + 1) + ". " + (q.who === "me" ? uName : cName) + "问：" + q.q + " —— " + (q.a || "（还没答）"); }).join("\n") : "（还没问过）"; };
    const said = function () { return lines.slice(-6).map(function (l) { return "· " + (l.me ? uName : l.name || cName) + "：" + l.text; }).join("\n"); };
    const ask = function (sys, tag) { return callRetry(api, gameVoiceRules() + sys, [{ role: "user", content: "轮到你。" }], { maxTokens: 8000, tag: tag || "25问" }).then(function (raw) { return extractJSON(raw) || {}; }); };
    const finish = function (guesserWon, why) {
      setSt(function (s) {
        const sc = Object.assign({}, s.score); if (guesserWon) sc[s.r.host === "me" ? "ta" : "me"]++; else sc[s.r.host]++;
        return { r: Object.assign({}, s.r, { status: "done", result: { guesserWon: guesserWon, why: why } }), score: sc };
      });
    };
    // ---- 我出题：TA 来问 ----
    const taTurn = function (rr) {
      if (!api) { setErr("先在设置里配好线路"); return; }
      setBusy(true); setErr("");
      const left = MIND_LIMIT - rr.qs.length;
      const sys = "你在跟 " + uName + " 玩「25 问」：" + uName + " 心里想好了一个东西，你来猜。你每次问一个只能用是/不是回答的问题，最多 " + MIND_LIMIT + " 个；觉得有把握了可以直接猜。问法照你自己的脑子和性子来。\n" + who
        + "\n\n【已经问过的】\n" + qaText(rr.qs) + "\n还能问 " + left + " 个。" + (said() ? "\n【刚才聊的】\n" + said() : "")
        + "\n\n只输出 JSON：{\"say\":\"可空：问之前顺口说的一句\",\"question\":\"这一问（要猜就留空）\",\"guess\":\"直接猜的答案（不猜就留空）\"}";
      ask(sys).then(function (p) {
        const g = String(p.guess || "").trim(), q = String(p.question || "").trim();
        taSay(String(p.say || "").trim());
        if (!g && !q) throw new Error("没问出来");
        const item = g ? { who: "ta", q: "是不是「" + g + "」？", guess: g } : { who: "ta", q: q };
        taSay(item.q);
        setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { qs: s.r.qs.concat([item]), status: "answer" }) }); });
      }).catch(function (e) { setErr(cName + " 这一问没问出来：" + e.message); }).finally(function () { setBusy(false); });
    };
    const lockSecret = function () {
      const v = secretDraft.trim(); if (!v) return;
      const rr = Object.assign({}, r, { secret: v, status: "asking" });
      setSt(function (s) { return Object.assign({}, s, { r: rr }); }); setSecretDraft("");
      push({ sys: true, text: "第 " + r.round + " 局 · 你心里想好了（" + cName + " 看不到）" });
      taTurn(rr);
    };
    const answer = function (a) {
      const last = r.qs[r.qs.length - 1]; if (!last) return;
      push({ me: true, text: a });
      const qs = r.qs.slice(0, -1).concat([Object.assign({}, last, { a: a })]);
      if (last.guess && a === "是") { setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { qs: qs }) }); }); finish(true, cName + " 第 " + qs.length + " 问猜中了"); return; }
      if (qs.length >= MIND_LIMIT) { setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { qs: qs }) }); }); finish(false, MIND_LIMIT + " 问用完了"); return; }
      const rr = Object.assign({}, r, { qs: qs, status: "asking" });
      setSt(function (s) { return Object.assign({}, s, { r: rr }); });
      taTurn(rr);
    };
    // ---- TA 出题：她来问 ----
    useEffect(function () {
      if (r.host !== "ta" || r.status !== "thinking" || busy) return;
      if (!api) { setErr("先在设置里配好线路"); return; }
      setBusy(true); setErr("");
      const sys = "你在跟 " + uName + " 玩「25 问」，这一局你出题：心里想好一个东西让 " + uName + " 来猜（她会问是/不是的问题）。最好是跟你们俩有关、她猜得到的东西（你们聊过的、一起做过的、你身边的），也可以是普通的物件。\n" + who
        + "\n\n只输出 JSON：{\"secret\":\"答案（一个具体的东西，2~10 字）\",\"hint\":\"给她的一句范围提示，比如是吃的还是用的（不许泄底）\",\"say\":\"出完题对她说的一句\"}";
      ask(sys).then(function (p) {
        const sec = String(p.secret || "").trim(); if (!sec) throw new Error("没想好");
        push({ sys: true, text: "第 " + r.round + " 局 · " + cName + " 想好了" + (p.hint ? "：" + String(p.hint).trim().slice(0, 40) : "") });
        taSay(String(p.say || "").trim());
        setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { secret: sec, hint: String(p.hint || "").trim(), status: "asking" }) }); });
      }).catch(function (e) { setErr(cName + " 没想好：" + e.message); }).finally(function () { setBusy(false); });
    }, [r.host, r.status, r.round]);
    const meAsk = function (isGuess) {
      const q = draft.trim(); if (!q || busy || r.status !== "asking") return;
      setDraft(""); push({ me: true, text: isGuess ? "我猜是「" + q + "」" : q });
      setBusy(true); setErr("");
      const sys = "你在跟 " + uName + " 玩「25 问」，这一局你出的题，答案是「" + r.secret + "」（绝对不许说出来，也不许暗示到等于说出来）。\n" + who
        + "\n\n【她已经问过的】\n" + qaText(r.qs) + (said() ? "\n【刚才聊的】\n" + said() : "")
        + "\n\n" + (isGuess ? "她现在直接猜答案是「" + q + "」。意思对上了就算中（叫法稍微不同也算），不对就不算。" : "她问的是：「" + q + "」。照答案的事实答，只能从 是/不是/不确定/有点沾边 里挑一个；她问的不是是非题，就挑最接近的、在 say 里提醒她只能问是非题。")
        + (easy ? "\n这局你让着她：答完可以顺口给一点点方向。" : "\n不放水，照实答，别给额外提示。")
        + "\n\n只输出 JSON：" + (isGuess ? "{\"hit\":true或false,\"say\":\"你的反应\"}" : "{\"a\":\"是|不是|不确定|有点沾边\",\"say\":\"可空：答完顺口说的一句\"}");
      ask(sys).then(function (p) {
        if (isGuess) {
          const hit = p.hit === true || p.hit === "true";
          taSay(String(p.say || "").trim() || (hit ? "猜中了" : "不对"));
          const qs = r.qs.concat([{ who: "me", q: "是不是「" + q + "」？", a: hit ? "是" : "不是", guess: q }]);
          setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { qs: qs }) }); });
          if (hit) finish(true, uName + " 第 " + qs.length + " 问猜中了"); else if (qs.length >= MIND_LIMIT) finish(false, MIND_LIMIT + " 问用完了");
          return;
        }
        const a = MIND_ANS.indexOf(String(p.a || "").trim()) >= 0 ? String(p.a).trim() : "不确定";
        taSay(a + (p.say ? "。" + String(p.say).trim() : ""));
        const qs = r.qs.concat([{ who: "me", q: q, a: a }]);
        setSt(function (s) { return Object.assign({}, s, { r: Object.assign({}, s.r, { qs: qs }) }); });
        if (qs.length >= MIND_LIMIT) finish(false, MIND_LIMIT + " 问用完了");
      }).catch(function (e) { setErr(cName + " 没接上：" + e.message); }).finally(function () { setBusy(false); });
    };
    // 闲聊：她随时可以说一句（只是聊天，不算一问；TA 不会自己接着说下去）
    const chat = function () {
      const v = draft.trim(); if (!v || busy) return; setDraft(""); push({ me: true, text: v });
      setBusy(true);
      const sys = "你在跟 " + uName + " 玩「25 问」，" + (r.host === "me" ? "她出题、你在猜" : "你出题、她在猜（答案「" + r.secret + "」不许说出来）") + "。她刚才跟你说了句话（不是在问题目），你接一句。\n" + who + "\n【刚才聊的】\n" + said() + "\n她说：" + v + "\n只输出 JSON：{\"say\":\"你的一句\"}";
      ask(sys).then(function (p) { taSay(String(p.say || "").trim()); }).catch(function () {}).finally(function () { setBusy(false); });
    };
    const next = function () {
      setSt(function (s) { const host = alt ? (s.r.host === "me" ? "ta" : "me") : s.r.host; return { r: mindNewRound(host, s.r.round + 1), score: s.score }; });
    };
    useEffect(function () { if (r.status === "done") push({ sys: true, text: "揭晓：" + (r.host === "me" ? "你想的" : cName + " 想的") + "是「" + r.secret + "」 · " + (r.result ? r.result.why : "") }); }, [r.status]);
    const btn = function (label, on, primary, key) { return h("button", { key: key || label, "data-wk": "mindbtn", disabled: busy, onClick: on, className: "active:opacity-70", style: { flex: 1, minHeight: 40, borderRadius: 10, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", border: "1px solid " + (primary ? t.tint : t.line), background: primary ? t.tint : t.bg2, color: primary ? "#fff" : t.ink, opacity: busy ? .5 : 1 } }, label); };
    const lastQ = r.qs[r.qs.length - 1];
    return h("div", { "data-wk": "gameplay", "data-part": "mind", className: "h-full flex flex-col", style: gameTable("q25", t) },
      h(Head, { zh: "25 问", en: (r.host === "me" ? "你出题 · " + cName + " 猜" : cName + " 出题 · 你猜") + " · 第 " + r.round + " 局", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "mind", zh: "25 问" }, seats: [
          { key: "me", name: uName, char: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, isUser: true, on: r.host === "ta" && r.status === "asking", sub: "赢 " + st.score.me },
          { key: "ta", name: cName, char: char, on: r.host === "me" && r.status === "asking", sub: "赢 " + st.score.ta }] }),
        h("div", { "data-wk": "mindcount", style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 12px" } }, Array.from({ length: MIND_LIMIT }).map(function (_, i) {
          const q = r.qs[i]; return h("span", { key: i, title: q ? q.q : "", style: { width: 14, height: 14, borderRadius: 3, border: "1px solid " + t.line, background: q ? (q.a === "是" ? t.tint : q.a ? t.fog : t.line) : "transparent" } });
        })),
        h(GameTalkLog, { t: t, lines: lines, busy: busy, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, charOf: function () { return char; }, maxHeight: 320, empty: r.host === "me" ? "先在下面写好你想的东西" : cName + " 在想题…" }),
        err ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginBottom: 8 } }, err) : null),
      h("div", { "data-wk": "mindbar", className: "shrink-0 px-4 pt-2", style: { paddingBottom: COMPOSER_PAD_BOTTOM, borderTop: "1px solid " + t.line, background: t.bg } },
        r.status === "done" ? h("div", { className: "flex gap-2", style: { padding: "6px 0" } }, btn(alt ? "下一局（换人出题）" : "再来一局", next, true)) :
        r.host === "me" && r.status === "setup" ? h("div", { className: "flex gap-2", style: { padding: "6px 0" } },
          h("input", { "data-wk": "gameinput", "data-part": "secret", value: secretDraft, onChange: function (e) { setSecretDraft(e.target.value.slice(0, 20)); }, placeholder: "你心里想的东西（" + cName + " 看不到）", style: { flex: 2, minWidth: 0, padding: "9px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
          btn("锁住", lockSecret, true)) :
        r.host === "me" && r.status === "answer" && lastQ ? h("div", { className: "flex gap-2", style: { padding: "6px 0" } },
          (lastQ.guess ? ["是", "不是"] : MIND_ANS).map(function (a) { return btn(lastQ.guess ? (a === "是" ? "猜中了" : "不是") : a, function () { answer(a); }, a === "是", a); })) :
        h("div", { style: { padding: "6px 0" } },
          h("div", { className: "flex gap-2" },
            h("input", { "data-wk": "gameinput", "data-part": "ask", value: draft, onChange: function (e) { setDraft(e.target.value.slice(0, 60)); }, onKeyDown: function (e) { if (e.key === "Enter" && r.host === "ta") meAsk(false); },
              placeholder: r.host === "ta" ? "问一个是非题，或者写下你猜的" : "跟 " + cName + " 说句话", style: { flex: 1, minWidth: 0, padding: "9px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } })),
          h("div", { className: "flex gap-2", style: { marginTop: 7 } },
            r.host === "ta" ? [btn("问", function () { meAsk(false); }, true, "q"), btn("我猜", function () { meAsk(true); }, false, "g"), btn("闲聊", chat, false, "c")] : [btn("说", chat, false, "c")]))));
  }

  // ============================================================
  // 心有灵犀（她 2026-10-30）：你和 TA 各自悄悄想一个词，之后每轮拿两人最新的两个词各连一个新词，一样就得一分。
  //   比对、计分、提示词在 js/lingxi-core.js。一轮只问 TA 一次：这一轮的词 + 对上一轮揭晓的反应 + TA 心里怎么想的。
  //   她的词先锁住，TA 的提示词里没有它；TA 的话和心思都等亮词以后才上屏。
  // ============================================================
  function LingxiGame(props) {
    const L = window.LingxiCore, t = props.t, api = props.active, cfg = props.config || {};
    const seat = unoPlayers(props, 2).find(function (p) { return !p.isUser; }) || null;
    const char = seat ? (props.characters || []).find(function (c) { return String(c.id) === seat.key; }) : null;
    const pf = props.profile || {}, uName = userName(pf), cName = char ? (char.remark || char.name) : "TA";
    const PT = function (s) { return typeof characterText === "function" && char ? characterText(char, s) : s; };
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () { return restored && restored.status !== "done" ? restored : L.newGame(); });
    const [lines, setLines] = useState([]), [busy, setBusy] = useState(false), [draft, setDraft] = useState(""), [err, setErr] = useState(""), [openThought, setOpenThought] = useState(true);
    const push = function (ls) { setLines(function (x) { return x.concat(ls.map(function (l) { return Object.assign({ at: Date.now() }, l); })); }); };
    const recent = (cfg.injectChat && props.recentChatFor && char) ? String(props.recentChatFor(char.id) || "").slice(-600) : "";
    const who = seatIdentity(seat) + gNote({ char: char }) + (recent ? "\n【你们最近聊的】" + recent : "");
    useEffect(function () {
      if (state.status === "done") { clearGameSave("lingxi"); return; }
      if (state.status === "open") return;
      saveGameSnap("lingxi", { config: cfg, state: state, label: "第 " + (state.rounds.length + 1) + " 轮 · 对上 " + L.score(state.rounds) + " 次" });
    }, [state]);
    const ask = function (sys, tag) {
      return routeSeatCall(seat, api, gameVoiceRules() + sys, [{ role: "user", content: "轮到你。" }], { game: "lingxi", turnId: state.id + "#" + state.rounds.length, expect: "{\"say\":[\"...\"],\"thought\":\"...\",\"word\":\"...\"}", timeout: 150000, ai: { maxTokens: 12000, tag: tag } })
        .then(function (r) { if (r.ccUnavailable) throw new Error(r.error); const p = unoJson(r.value), w = L.cleanWord(p.word); if (!w) throw new Error("没写出词来"); return { word: w, say: sayList(p.say), thought: String(p.thought || "").trim() }; });
    };
    const submit = function () {
      const mine = draft.trim().slice(0, 20); if (!mine || busy) return;
      if (!api && !(seat && seat.engineer)) { setErr("先在设置里配好线路"); return; }
      setBusy(true); setErr("");
      const opening = state.status === "open";
      const sys = opening ? L.openPrompt({ uName: uName, who: who, sayFree: GAME_SAY_FREE })
        : L.roundPrompt({ uName: uName, who: who, state: state, easy: cfg.mode === "easy", sayFree: GAME_SAY_FREE });
      ask(sys, "心有灵犀").then(function (a) {
        const n = JSON.parse(JSON.stringify(state));
        // 先亮词，再上 TA 的话：TA 的反应、心思都在揭晓之后
        if (opening) { n.start = [mine, a.word]; n.pair = [mine, a.word]; n.startThought = a.thought; n.status = "play";
          push([{ sys: true, text: "起始词亮了：你「" + mine + "」· " + cName + "「" + a.word + "」" }]); }
        else { const r = L.reveal(n, mine, a.word, a.say, a.thought);
          push([{ sys: true, text: "第 " + r.n + " 轮：你「" + mine + "」· " + cName + "「" + a.word + "」 · " + (r.hit ? "对上了 +1" : "没对上") }]); }
        if (a.say.length) push(a.say.map(function (s) { return { id: char && char.id, name: cName, text: s.slice(0, 200) }; }));
        setState(n); setDraft(""); setOpenThought(true);
      }).catch(function (e) { setErr(cName + " 没接上：" + e.message + "（你的词还在，再点一次）"); }).finally(function () { setBusy(false); });
    };
    // 写词之前先聊（她：「每一轮开始前也可以和他讨论」）：聊的话进本轮 talk，写词那一下 TA 能看到；她的词照旧不进
    const [chatDraft, setChatDraft] = useState("");
    const chat = function () {
      const v = chatDraft.trim().slice(0, 120); if (!v || busy || state.status !== "play") return;
      setChatDraft(""); setBusy(true); setErr("");
      const n = JSON.parse(JSON.stringify(state)); n.talk = (n.talk || []).concat([{ who: "me", text: v }]); setState(n);
      push([{ me: true, text: v }]);
      routeSeatCall(seat, api, gameVoiceRules() + L.talkPrompt({ uName: uName, who: who, state: state, line: v, sayFree: GAME_SAY_FREE }), [{ role: "user", content: "接她的话。" }], { game: "lingxi", turnId: state.id + "#talk" + Date.now(), expect: "{\"say\":[\"...\"]}", timeout: 150000, ai: { maxTokens: 8000, tag: "心有灵犀" } })
        .then(function (r) { const ss = sayList(unoJson(r.value).say); if (!ss.length) return;
          push(ss.map(function (s) { return { id: char && char.id, name: cName, text: s.slice(0, 200) }; }));
          setState(function (cur) { const m = JSON.parse(JSON.stringify(cur)); m.talk = (m.talk || []).concat(ss.map(function (s) { return { who: "ta", text: s.slice(0, 200) }; })); return m; });
        }).catch(function (e) { setErr(cName + " 没接上：" + e.message); }).finally(function () { setBusy(false); });
    };
    // 「算我们一样」点了／撤了，聊天记录里那一行的结论跟着改，别留着一句「没对上」
    const toggle = function (n) { const s = JSON.parse(JSON.stringify(state)); L.toggleManual(s, n); setState(s);
      const r = s.rounds.find(function (x) { return x.n === n; }), tag = r && r.manual ? "算你们一样 +1" : "没对上";
      setLines(function (ls) { return ls.map(function (x) { return x && x.sys && String(x.text || "").indexOf("第 " + n + " 轮：") === 0 ? Object.assign({}, x, { text: String(x.text).replace(/ · (?:对上了 \+1|没对上|算你们一样 \+1)$/, " · " + tag) }) : x; }); }); };
    const end = function () { setState(Object.assign({}, state, { status: "done" })); };
    const again = function () { setLines([]); setDraft(""); setState(L.newGame()); };
    const last = state.rounds[state.rounds.length - 1], sc = L.score(state.rounds);
    const thought = last ? last.thought : state.startThought;
    const btnAt = function (label, on, primary, dis) { return { disabled: busy || dis, onClick: on, className: "active:opacity-70", style: { minHeight: 42, padding: "0 16px", borderRadius: 10, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", border: "1px solid " + (primary ? t.tint : t.line), background: primary ? t.tint : t.bg2, color: primary ? "#fff" : t.ink, opacity: busy || dis ? .5 : 1, flexShrink: 0 } }; };
    const chip = function (w, mine) { return h("span", { style: { flex: 1, minWidth: 0, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "#fffdf6", color: "#2f2a24", border: "1px solid " + (mine ? t.tint : LID.lingxi.hot), fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", wordBreak: "break-all" } }, w); };
    const sub = function (s) { return h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, s); };
    return h("div", { "data-wk": "gameplay", "data-part": "lingxi", className: "h-full flex flex-col", style: gameTable("lingxi", t) },
      h(Head, { zh: "心有灵犀", en: state.status === "open" ? "先各想一个词" : state.status === "done" ? "这一局 " + state.rounds.length + " 轮 · 对上 " + sc + " 次" : "第 " + (state.rounds.length + 1) + " 轮 · 对上 " + sc + " 次", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "lingxi", zh: "心有灵犀" }, seats: [
          { key: "me", name: uName, char: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, isUser: true, on: !busy && state.status !== "done", sub: "对上 " + sc },
          { key: "ta", name: cName, char: char, on: busy, sub: busy ? "在想…" : "对上 " + sc }] }),
        state.pair && state.status === "play" ? h("div", { "data-wk": "lingxipair", style: { margin: "4px 0 12px" } }, sub("这一轮要连的两个词"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, chip(state.pair[0], true), h("span", { style: { color: t.fog, fontFamily: F_BODY } }, "＋"), chip(state.pair[1], false))) : null,
        (last || state.start) ? h("div", { "data-wk": "lingxireveal", "data-hit": last && L.counted(last) ? "1" : "0", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 13, padding: "10px 12px", marginBottom: 12 } },
          sub(last ? "第 " + last.n + " 轮亮出来了" : "起始词"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, chip(last ? last.mine : state.start[0], true), h("span", { style: { color: t.fog, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, last ? (last.hit ? "＝" : "≠") : "·"), chip(last ? last.yours : state.start[1], false)),
          last ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
            h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: L.counted(last) ? t.tint : t.sub } }, last.hit ? "一模一样，+1" : last.manual ? "算你们一样，+1" : "没对上"),
            last.hit ? null : h("button", { "data-wk": "lingxisame", "data-on": last.manual ? "1" : "0", disabled: busy, onClick: function () { toggle(last.n); }, className: "active:opacity-70", style: { minHeight: 40, padding: "0 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "1px solid " + t.tint, background: last.manual ? "transparent" : t.tint + "14", color: t.tint } }, last.manual ? "撤回" : "算我们一样")) : null,
          thought ? h("div", { "data-wk": "lingxithought", style: { marginTop: 8, borderTop: "1px dashed " + t.line } },
            h("button", { onClick: function () { setOpenThought(!openThought); }, style: { minHeight: 40, width: "100%", textAlign: "left", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, background: "transparent" } }, (openThought ? "▾ " : "▸ ") + PT("他是怎么想的")),
            openThought ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", paddingBottom: 4 } }, thought) : null) : null) : null,
        h(GameTalkLog, { t: t, lines: lines, busy: busy, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, charOf: function () { return char; }, maxHeight: "none", empty: state.status === "open" ? "你先悄悄写一个起始词，" + cName + " 也在想自己的" : "" }),
        state.rounds.length > 1 ? h("div", { "data-wk": "lingxihist", style: { marginTop: 4 } }, sub("往期"), state.rounds.slice(0, -1).reverse().map(function (r) {
          return h("div", { key: r.n, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, padding: "4px 0", borderBottom: "1px solid " + t.line } },
            h("span", { style: { color: t.fog, width: 34, flexShrink: 0 } }, "第" + r.n), h("span", { style: { flex: 1, minWidth: 0 } }, r.pair[0] + " + " + r.pair[1] + " → 「" + r.mine + "」/「" + r.yours + "」"),
            h("span", { style: { color: L.counted(r) ? t.tint : t.fog, flexShrink: 0 } }, r.hit ? "+1" : r.manual ? "算+1" : "—"),
            (r.talk || []).length ? h("div", { "data-wk": "lingxihisttalk", style: { flexBasis: "100%", paddingLeft: 40, color: t.fog, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, whiteSpace: "pre-wrap" } }, L.talkText(r.talk, uName).replace(/(^|\n)你：/g, "$1" + cName + "：")) : null);
        })) : null,
        err ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, err) : null,
        state.status === "done" ? h("div", { style: { marginTop: 14 } },
          h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.tint } }, "连了 " + state.rounds.length + " 轮，对上 " + sc + " 次"),
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            return { key: "lingxi", zh: "心有灵犀", ids: char && !(seat && seat.engineer) ? [char.id] : [], wins: [], meWin: null, text: L.recap(state, "她", cName), procLabel: "每一轮",
              proc: state.rounds.map(function (r) { return r.pair[0] + "+" + r.pair[1] + "→她「" + r.mine + "」" + cName + "「" + r.yours + "」" + (L.counted(r) ? "对上" : "没对上"); }) };
          } })) : null),
      h("div", { "data-wk": "lingxibar", className: "shrink-0 px-4 pt-2", style: { paddingBottom: COMPOSER_PAD_BOTTOM, borderTop: "1px solid " + t.line, background: t.bg } },
        state.status === "done" ? h("div", { className: "flex gap-2", style: { padding: "6px 0" } }, h("div", { style: { flex: 1 } }), h("button", Object.assign({ "data-wk": "lingxiagain" }, btnAt("再来一局", again, true)), "再来一局")) :
        h("div", null,
        state.status === "play" ? h("div", { "data-wk": "lingxitalk", className: "flex gap-2", style: { padding: "6px 0 0", alignItems: "center" } },
          h("input", { "data-wk": "gameinput", "data-part": "lingxitalk", value: chatDraft, onChange: function (e) { setChatDraft(e.target.value.slice(0, 120)); }, onKeyDown: function (e) { if (e.key === "Enter") chat(); },
            placeholder: "写词之前先跟 " + cName + " 聊两句（可不聊）", style: { flex: 1, minWidth: 0, minHeight: 40, padding: "8px 11px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
          h("button", Object.assign({ "data-wk": "lingxichat" }, btnAt("说", chat, false, !chatDraft.trim())), "说")) : null,
        h("div", { className: "flex gap-2", style: { padding: "6px 0", alignItems: "center" } },
          h("input", { "data-wk": "gameinput", "data-part": "lingxi", value: draft, onChange: function (e) { setDraft(e.target.value.slice(0, 20)); }, onKeyDown: function (e) { if (e.key === "Enter") submit(); },
            placeholder: state.status === "open" ? "你的起始词（" + cName + " 看不到）" : "连上这两个词的新词（" + cName + " 看不到）", style: { flex: 1, minWidth: 0, minHeight: 42, padding: "9px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }),
          h("button", Object.assign({ "data-wk": "lingxisend" }, btnAt(busy ? "等" + PT("他") + "…" : "亮词", submit, true, !draft.trim())), busy ? "等" + PT("他") + "…" : "亮词"),
          state.status === "play" ? h("button", Object.assign({ "data-wk": "lingxiend" }, btnAt("结束", end, false)), "结束") : null))));
  }

  // ============================================================
  // 俄罗斯方块（她 2026-10-15）：「你玩 TA 看」和「对战」。方块由本地跑（js/tetris-core.js），
  //   TA 那块板子也是本地棋手按人设水平下；模型只管 TA 在关键时刻说的话，你随时能跟 TA 说句话。
  // ============================================================
  const TET_SKILL = { rookie: { v: 0.55, ms: 380, zh: "新手" }, normal: { v: 0.8, ms: 230, zh: "普通" }, pro: { v: 0.97, ms: 130, zh: "高手" } };
  const TET_BEST = "x_tetrisBest", TET_BEST_COOP = "x_tetrisBestCoop";
  function TetBoard(props) {
    const ref = useRef(null), T = window.TetrisCore, g = props.g, cell = props.cell;
    useEffect(function () {
      const cv = ref.current; if (!cv || !g) return;
      const x = cv.getContext("2d"), W = T.W, H = T.H;
      x.fillStyle = props.bg || "#1d1c22"; x.fillRect(0, 0, W * cell, H * cell);
      x.strokeStyle = "rgba(255,255,255,.05)"; x.lineWidth = 1;
      for (let i = 1; i < W; i++) { x.beginPath(); x.moveTo(i * cell + .5, 0); x.lineTo(i * cell + .5, H * cell); x.stroke(); }
      const box = function (cx, cy, col, alpha) { if (cy < 0) return; x.globalAlpha = alpha == null ? 1 : alpha; x.fillStyle = col; x.fillRect(cx * cell + 1, cy * cell + 1, cell - 2, cell - 2);
        x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(cx * cell + 1, cy * cell + 1, cell - 2, Math.max(2, cell * .18)); x.globalAlpha = 1; };
      g.board.forEach(function (row, y) { row.forEach(function (k, cx) { if (k) box(cx, y, T.COLORS[k]); }); });
      if (g.cur && !g.over) {
        const gy = T.ghostY(g); T.cells(Object.assign({}, g.cur, { y: gy })).forEach(function (c) { box(c[0], c[1], T.COLORS[g.cur.k], .22); });
        T.cells(g.cur).forEach(function (c) { box(c[0], c[1], T.COLORS[g.cur.k]); });
      }
      if (g.over) { x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, W * cell, H * cell); }
    });
    return h("canvas", { ref: ref, width: window.TetrisCore.W * cell, height: window.TetrisCore.H * cell, "data-wk": "tetboard", "data-part": props.part || "me",
      style: { display: "block", borderRadius: 6, touchAction: "none", boxShadow: "0 0 0 2px rgba(0,0,0,.25)" },
      onTouchStart: props.onTouchStart, onTouchEnd: props.onTouchEnd });
  }
  function TetNext(props) {
    const T = window.TetrisCore, c = props.cell || 9;
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, (props.kinds || []).map(function (k, i) {
      const sh = T.SHAPES[k][0];
      return h("svg", { key: i, width: c * 4, height: c * 2.2, viewBox: "0 0 " + (c * 4) + " " + (c * 2.2) }, sh.map(function (q, j) {
        return h("rect", { key: j, x: q[0] * c, y: (q[1] - (k === "I" ? 1 : 0)) * c + 1, width: c - 1.5, height: c - 1.5, rx: 1.5, fill: T.COLORS[k] });
      }));
    }));
  }
  function TetrisGame(props) {
    const T = window.TetrisCore, t = props.t || {}, api = props.active, cfg = props.config || {};
    const versus = cfg.tetrisMode === "versus", coop = cfg.tetrisMode === "coop", easy = cfg.mode === "easy";
    const sk = TET_SKILL[cfg.tetrisSkill] || TET_SKILL.normal;
    const skill = easy ? sk.v * 0.75 : sk.v, aiMs = easy ? Math.round(sk.ms * 1.5) : sk.ms;
    const char = (props.characters || []).find(function (c) { return c.id === (cfg.charIds || [])[0]; }) || null;
    const pf = props.profile || {}, uName = pf.name || "你", cName = char ? (char.remark || char.name) : "TA";
    const meRef = useRef(null), taRef = useRef(null), aiTarget = useRef(null), clock = useRef({ me: 0, ai: 0, last: 0 });
    const [, setTick] = useState(0), [status, setStatus] = useState("ready"), [lines, setLines] = useState([]), [talking, setTalking] = useState(false), [draft, setDraft] = useState("");
    const bestKey = coop ? TET_BEST_COOP : TET_BEST;
    const best = useRef((function () { try { return Number(loadJSON(bestKey, 0)) || 0; } catch (e) { return 0; } })());
    const lastTalk = useRef(0), touch = useRef(null), repeat = useRef(null);
    // 说话节奏（她 2026-10-15：「怕来来回回就是一句话换着说法说」）：
    //   同一类事只在第一次和升级时叫 TA；叫了也可以不说；给 TA 的是「上次开口到现在变了什么」
    const seen = useRef({}), snap = useRef(null), talkN = useRef(0), lastLen = useRef(0);
    const fresh = function (k) { if (seen.current[k]) return false; seen.current[k] = 1; return true; };
    const danger = function (k, g) { const hgt = g ? T.stackHeight(g.board) : 0; if (hgt < 12) seen.current[k] = 0; return hgt >= 16 && fresh(k); };
    const sinceLast = function () {
      const me = meRef.current, ta = taRef.current, o = snap.current; if (!o || !me) return "";
      const bits = [];
      if (me.score > o.me) bits.push((coop ? "你们一起" : uName) + "涨了 " + (me.score - o.me) + " 分");
      if (me.lines > o.ml) bits.push((coop ? "一起" : uName) + "又消了 " + (me.lines - o.ml) + " 行");
      if (versus && ta) {
        if (ta.score > o.ta) bits.push(cName + "涨了 " + (ta.score - o.ta) + " 分");
        const lead = me.score > ta.score ? "me" : me.score < ta.score ? "ta" : "", was = o.me > o.ta ? "me" : o.me < o.ta ? "ta" : "";
        if (lead && lead !== was) bits.push((lead === "me" ? uName : cName) + "反超了");
      }
      if (me.combo > 0) bits.push("连着消了 " + (me.combo + 1) + " 块");
      bits.push("隔了 " + Math.round((Date.now() - o.at) / 1000) + " 秒");
      return bits.join("，");
    };
    const push = function (l) { setLines(function (ls) { return ls.concat([Object.assign({ at: Date.now() }, l)]).slice(-40); }); };
    const vw = typeof window !== "undefined" ? Math.min(window.innerWidth || 390, 520) : 390;
    const cell = versus ? Math.floor((vw - 44) * 0.6 / 10) : Math.min(24, Math.floor((vw - 110) / 10));
    const taCell = Math.max(8, Math.floor((vw - 44) * 0.33 / 10));
    // ---- TA 说话：只在关键时刻（一次消多行、快到顶、被塞垃圾、结束）和你跟 TA 说话时 ----
    const say = function (why, force, userLine) {
      if (!api || !char) return;
      const now = Date.now();
      const gap = Math.min(30000, 12000 + lastLen.current * 120);
      if (!force && (talking || now - lastTalk.current < gap)) return;
      lastTalk.current = now; talkN.current++; setTalking(true);
      const me = meRef.current, ta = taRef.current, delta = sinceLast(), must = !!userLine;
      snap.current = { me: me ? me.score : 0, ml: me ? me.lines : 0, ta: ta ? ta.score : 0, at: now };
      const sit = "你：" + (me ? me.score + " 分、消了 " + me.lines + " 行、堆了 " + T.stackHeight(me.board) + " 层" : "") + (versus && ta ? "；" + cName + "：" + ta.score + " 分、消了 " + ta.lines + " 行、堆了 " + T.stackHeight(ta.board) + " 层" : "");
      const said = lines.slice(-6).map(function (l) { return "· " + (l.me ? uName : cName) + "：" + l.text; }).join("\n");
      const recent = (cfg.injectChat && props.recentChatFor) ? String(props.recentChatFor(char.id) || "").slice(-400) : "";
      const sys = gameVoiceRules() + "【场面】" + (coop ? cName + " 跟 " + uName + " 合作玩俄罗斯方块：同一块板子，一人放一块轮着来，一起冲分（你那块是你自己挑的落点）" : versus ? cName + " 跟 " + uName + " 在对战俄罗斯方块，一人一块板子，消多行会往对面塞垃圾行" + (easy ? "（" + cName + "这局让着她）" : "") : uName + " 在玩俄罗斯方块，" + cName + " 坐在旁边看") + "。像真坐在旁边那样，照你们平时的关系和你自己的性子；不一定要点评这盘，问她、逗她、说你自己、扯到别处都行。"
        + "\n【你是】" + cName + "\n【人设】" + String(char.persona || "（没写）").slice(0, 1400) + (recent ? "\n【你们最近聊的】" + recent : "")
        + "\n\n【现在】" + sit + (delta ? "\n【你上次开口到现在】" + delta : "") + "\n" + why + (said ? "\n【刚才说过的】\n" + said + "\n说过的意思别换个说法再说一遍。" : "")
        + (must ? "" : "\n这会儿没什么想说的就不说，say 留空。")
        + "\n\n" + GAME_SAY_FREE + "\n只输出 JSON：{\"say\":[\"一句\"]}";
      callRetry(api, sys, [{ role: "user", content: userLine ? "她说：" + userLine : "说话。" }], { maxTokens: 8000, tag: "俄罗斯方块" }).then(function (raw) {
        const p = extractJSON(raw) || {}; const vs = sayList(p.say);
        lastLen.current = vs.join("").length; vs.forEach(function (v) { push({ id: char.id, name: cName, text: v.slice(0, 160) }); });
      }).catch(function () {}).finally(function () { setTalking(false); });
    };
    const afterLock = function (who, res) {
      const me = meRef.current, ta = taRef.current;
      if (!res || !res.locked) return;
      // 合作接力：落一块换一个人；轮到 TA 时偶尔先说一句打算（给你留坑、这块怎么放）
      if (coop && me) {
        me.owner = me.owner === "ta" ? "me" : "ta"; aiTarget.current = null;
        if (res.cleared === 4 || (res.cleared && fresh("coopFirst"))) say((who === "me" ? uName : "你（" + cName + "）") + "这一块消了 " + res.cleared + " 行。", res.cleared === 4);
        else if (me.owner === "ta" && Math.random() < 0.12) say("轮到你（" + cName + "）放一块「" + me.cur.k + "」形的，说说你打算怎么放、或者给她留了什么位置。");
        if (!me.over && danger("coopTop", me)) say("你们这块板子快堆到顶了。", true);
        return;
      }
      if (versus && res.cleared >= 2) { const other = who === "me" ? ta : me; if (other) other.pendingGarbage += T.garbageFor(res.cleared); }
      if (res.cleared === 4) say((who === "me" ? uName : cName) + " 刚刚一口气消了四行！", true);
      else if (res.cleared >= 2 && who === "me" && fresh("me" + res.cleared)) say(uName + " 这局第一次一下消了 " + res.cleared + " 行。");
      else if (versus && res.cleared >= 2 && fresh("ta" + res.cleared)) say("你（" + cName + "）刚消了 " + res.cleared + " 行，往她那边塞了垃圾行。");
      const g = who === "me" ? me : ta;
      if (g && !g.over && danger(who + "Top", g)) say((who === "me" ? uName : "你（" + cName + "）") + "的板子快堆到顶了。", true);
    };
    const finish = function () {
      const me = meRef.current, ta = taRef.current;
      setStatus("done");
      if (me && me.score > best.current) { best.current = me.score; try { saveJSON(bestKey, me.score); } catch (e) {} }
      const meWin = versus ? !!(ta && ta.over && !me.over) : null;
      say(coop ? "你们合作的这局结束了，一起拿了 " + (me ? me.score : 0) + " 分" + (me && me.score >= best.current ? "，是你俩的新纪录" : "") + "。" : versus ? (meWin ? uName + " 赢了这局对战" : "你（" + cName + "）赢了这局对战") + "。" : "这局结束了，" + uName + " 拿了 " + (me ? me.score : 0) + " 分" + (me && me.score >= best.current ? "，是新纪录" : "") + "。", true);
    };
    // ---- 主循环：50ms 一跳；你那块按等级往下掉，TA 那块按水平一步一步挪 ----
    useEffect(function () {
      if (status !== "play") return;
      clock.current.last = Date.now();
      const id = setInterval(function () {
        const now = Date.now(), dt = now - clock.current.last; clock.current.last = now;
        const me = meRef.current, ta = taRef.current; if (!me) return;
        if (coop && me.owner === "ta") {
          // TA 的那一块：本地棋手一步一步挪过去再落（跟对战里 TA 那块同一个下法）
          clock.current.ai += dt;
          if (clock.current.ai >= aiMs) {
            clock.current.ai = 0;
            if (!aiTarget.current || aiTarget.current.n !== me.n) { const b = T.bestPlacement(me, skill); aiTarget.current = b ? Object.assign({ n: me.n }, b) : null; }
            if (T.stepToward(me, aiTarget.current) === "drop") { aiTarget.current = null; afterLock("ta", T.hardDrop(me)); }
          }
        } else {
          clock.current.me += dt;
          if (clock.current.me >= T.gravityMs(me.level)) { clock.current.me = 0; afterLock("me", T.step(me)); }
        }
        if (versus && ta && !ta.over) {
          clock.current.ai += dt;
          if (clock.current.ai >= aiMs) {
            clock.current.ai = 0;
            if (!aiTarget.current || aiTarget.current.n !== ta.n) { const b = T.bestPlacement(ta, skill); aiTarget.current = b ? Object.assign({ n: ta.n }, b) : null; }
            if (T.stepToward(ta, aiTarget.current) === "drop") { aiTarget.current = null; afterLock("ta", T.hardDrop(ta)); }
          }
        }
        if (me.over || (versus && ta && ta.over)) { clearInterval(id); finish(); }
        setTick(function (n) { return n + 1; });
      }, 50);
      return function () { clearInterval(id); };
    }, [status]);
    const start = function () {
      const seed = Date.now();
      meRef.current = T.newGame(seed); taRef.current = versus ? T.newGame(seed) : null; aiTarget.current = null;
      if (coop) meRef.current.owner = "me";
      seen.current = {}; snap.current = null; talkN.current = 0; lastLen.current = 0;
      clock.current = { me: 0, ai: 0, last: Date.now() };
      setStatus("play");
      if (!lines.length) say(coop ? "合作接力刚开始，她先放第一块。" : versus ? "对战刚开始。" : uName + " 刚开了一局。", true);
    };
    const act = function (k) {
      const me = meRef.current; if (!me || status !== "play" || me.over) return;
      if (coop && me.owner === "ta") return;   // 轮到 TA 放的时候你的手是空着的
      if (k === "l") T.move(me, -1); else if (k === "r") T.move(me, 1); else if (k === "rot") T.rotate(me, 1);
      else if (k === "down") { afterLock("me", T.step(me)); me.score += 1; } else if (k === "drop") afterLock("me", T.hardDrop(me));
      setTick(function (n) { return n + 1; });
    };
    const hold = function (k) { act(k); clearInterval(repeat.current); repeat.current = setInterval(function () { act(k); }, k === "down" ? 60 : 110); };
    const release = function () { clearInterval(repeat.current); };
    useEffect(function () { return function () { clearInterval(repeat.current); }; }, []);
    // 板子上滑：左右滑挪、往下快滑直接落、轻点转
    const onTS = function (e) { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY, at: Date.now() }; };
    const onTE = function (e) {
      const s0 = touch.current; if (!s0) return; const p = e.changedTouches[0], dx = p.clientX - s0.x, dy = p.clientY - s0.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) act("rot");
      else if (dy > 60 && Math.abs(dy) > Math.abs(dx)) act("drop");
      else if (Math.abs(dx) > Math.abs(dy)) { const n = Math.max(1, Math.round(Math.abs(dx) / cell)); for (let i = 0; i < n; i++) act(dx > 0 ? "r" : "l"); }
    };
    const me = meRef.current, ta = taRef.current;
    const pad = function (k, label) { return h("button", { key: k, "data-wk": "tetpad", "data-part": k, onPointerDown: function (e) { e.preventDefault(); hold(k); }, onPointerUp: release, onPointerLeave: release, onPointerCancel: release,
      className: "active:opacity-60", style: { flex: 1, minHeight: 48, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(18px * var(--app-fs, 1))", touchAction: "none", userSelect: "none" } }, label); };
    const sendChat = function () { const v = draft.trim(); if (!v) return; setDraft(""); push({ me: true, text: v }); say("她刚跟你说了句话，接一句。", true, v); };
    return h("div", { "data-wk": "gameplay", "data-part": "tetris", className: "h-full flex flex-col", style: gameTable("tetris", t) },
      h(Head, { zh: "俄罗斯方块", en: coop ? "合作接力 · 和 " + cName + "（" + sk.zh + "）" : versus ? "对战 · " + cName + "（" + sk.zh + (easy ? "·让着你" : "") + "）" : cName + " 在旁边看", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-4 pb-2", style: { paddingTop: 10 } },
        h("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start" } },
          h("div", null,
            h("div", { "data-wk": "tetturn", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: coop && me && me.owner === "ta" ? t.tint : t.sub, marginBottom: 4 } }, (coop ? (me && status === "play" ? (me.owner === "ta" ? "轮到 " + cName + " 放" : "轮到你放") + " · " : "你俩 · ") : uName + " · ") + (me ? me.score : 0) + " 分 · " + (me ? me.lines : 0) + " 行" + (me && me.pendingGarbage ? " · 要顶上来 " + me.pendingGarbage + " 行" : "")),
            me ? h(TetBoard, { g: me, cell: cell, onTouchStart: onTS, onTouchEnd: onTE }) : h("div", { style: { width: cell * 10, height: cell * 20, borderRadius: 6, background: "#1d1c22" } })),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "下一个"),
            h(TetNext, { kinds: me ? T.next(me, versus ? 2 : 3) : [], cell: versus ? 7 : 10 }),
            !versus ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } }, "最高 " + best.current, h("br"), "等级 " + (me ? me.level : 1)) : null,
            versus ? h("div", { style: { marginTop: 6 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 4 } }, cName + " · " + (ta ? ta.score : 0)),
              ta ? h(TetBoard, { g: ta, cell: taCell, part: "ta" }) : h("div", { style: { width: taCell * 10, height: taCell * 20, borderRadius: 6, background: "#1d1c22" } })) : null)),
        h("div", { style: { marginTop: 10 } },
          h(GameTalkLog, { t: t, lines: lines, busy: talking, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, charOf: function () { return char; }, maxHeight: 110, empty: cName + " 在旁边" }))),
      h("div", { "data-wk": "tetbar", className: "shrink-0 px-4 pt-2", style: { paddingBottom: COMPOSER_PAD_BOTTOM, borderTop: "1px solid " + t.line, background: t.bg } },
        // 暂停（她 2026-10-16 转群友）：停的是主循环那一跳，TA 那块和掉落一起停；回来从停下那一刻接着算，不补跳
        status === "pause" ? h("button", { "data-wk": "tetstart", "data-part": "resume", onClick: function () { setStatus("play"); }, className: "w-full active:opacity-80", style: { minHeight: 46, margin: "4px 0 6px", borderRadius: 12, background: t.tint, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", border: "none" } }, "暂停中 · 点这里接着玩")
        : status === "play" ? h("div", { className: "flex gap-2", style: { padding: "4px 0 6px", opacity: coop && me && me.owner === "ta" ? .4 : 1 } }, pad("l", "←"), pad("rot", "↻"), pad("r", "→"), pad("down", "↓"), pad("drop", "⤓"),
            h("button", { key: "pause", "data-wk": "tetpad", "data-part": "pause", onClick: function () { release(); setStatus("pause"); }, className: "active:opacity-60", style: { flex: 1, minHeight: 48, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" }, "aria-label": "暂停" }, "Ⅱ"))
          : h("button", { "data-wk": "tetstart", onClick: start, className: "w-full active:opacity-80", style: { minHeight: 46, margin: "4px 0 6px", borderRadius: 12, background: t.tint, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", border: "none" } },
              status === "done" ? (coop ? "你俩 " + (me ? me.score : 0) + " 分 · 再来一局" : versus ? (ta && ta.over && me && !me.over ? "你赢了 · 再来一局" : cName + " 赢了 · 再来一局") : "这局 " + (me ? me.score : 0) + " 分 · 再来一局") : "开始"),
        h("div", { className: "flex gap-2", style: { paddingBottom: 4 } },
          h("input", { "data-wk": "gameinput", "data-part": "tetchat", value: draft, onChange: function (e) { setDraft(e.target.value.slice(0, 60)); }, onKeyDown: function (e) { if (e.key === "Enter") sendChat(); }, placeholder: "跟 " + cName + " 说句话",
            style: { flex: 1, minWidth: 0, padding: "8px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
          h("button", { onClick: sendChat, style: { padding: "0 14px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "说")),
        status === "done" && char ? h(KeepMemBtn, { t: t, host: props, rep: function () {
          const meWin = versus ? !!(ta && ta.over && me && !me.over) : null;
          return { key: "tetris", zh: "俄罗斯方块", ids: [char.id], wins: versus && !meWin ? [char.id] : [], meWin: meWin,
            text: coop ? "和" + cName + "合作接力玩俄罗斯方块，一人一块轮着放，一起拿了 " + (me ? me.score : 0) + " 分" : versus ? "和" + cName + "对战俄罗斯方块，" + (meWin ? uName + "赢了" : cName + "赢了") + "（" + uName + " " + (me ? me.score : 0) + " 分，" + cName + " " + (ta ? ta.score : 0) + " 分）" : uName + "玩俄罗斯方块拿了 " + (me ? me.score : 0) + " 分，" + cName + "在旁边看" };
        } }) : null));
  }

  function GomokuGame(props) {
    const t = props.t, cfg = props.config, api = props.active;
    const sv = props.savedState;
    const spectate = cfg.mode === "spectate", easy = cfg.mode === "easy";
    const findC = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }) || null; };
    const char = findC((cfg.charIds || [])[0]);
    // 观战选了两个人：第二个执白跟 TA 对下；只选一个就是 TA 跟电脑下
    const char2 = spectate ? findC((cfg.charIds || [])[1]) : null;
    const pf = props.profile || {};
    const uName = pf.name || "你";
    const nmOf = function (c) { return c ? (c.remark || c.name) : "TA"; };
    const cName = nmOf(char), c2Name = char2 ? nmOf(char2) : "电脑";
    // 执子：1＝黑先，2＝白。她执黑先手；观战时 TA 执黑、另一位（或电脑）执白
    const userSide = spectate ? 0 : 1, charSide = spectate ? 1 : 2, botSide = spectate ? 2 : 0;
    // 这一方随手下吗：她下场时看放水；观战时看开局给每个人选的「认真 / 随手」
    // 下法跟着聊天变：TA 开口时顺手报一个，从下一手起照这个下（她 2026-10-11）
    const [playOv, setPlayOv] = useState(sv && sv.playOv ? sv.playOv : {});   // { charId: 0 认真 / 1 随手 / 2 让着 }
    const [playNote, setPlayNote] = useState("");
    const level = function (side) {
      const c = side === charSide ? char : (side === botSide ? char2 : null);
      if (c && playOv[c.id] != null) return playOv[c.id];
      // 放水开局就是「让着」那一档（她 2026-10-12：随手那档普通人还是赢不了）
      if (!spectate) return easy && side === charSide ? 2 : 0;
      return (c && cfg.gmkCasual && cfg.gmkCasual[c.id]) ? 1 : 0;
    };
    const PLAY_ZH = ["认真", "随手", "让着"];
    const talkers = [char, char2].filter(Boolean);
    const [board, setBoard] = useState(sv && sv.board ? sv.board : gmkEmpty());
    const [moves, setMoves] = useState(sv && sv.moves ? sv.moves : []);    // [{x,y,who}]
    const [turn, setTurn] = useState(sv && sv.turn ? sv.turn : 1);
    const [winner, setWinner] = useState(sv ? (sv.winner || 0) : 0);   // 0 未完 / 1 / 2 / 3 和棋
    const [pend, setPend] = useState(null);       // 她点了一下还没落的那一格（再点一下才落）
    const [lines, setLines] = useState(sv && sv.lines ? sv.lines : []);   // TA 说过的话
    const [talking, setTalking] = useState(false);
    const [heckle, setHeckle] = useState("");
    const talkBusy = useRef(false), lastTalkAt = useRef(sv && sv.lastTalkAt ? sv.lastTalkAt : 0);
    const runId = useRef((sv && sv.runId) || ("gomoku-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)));
    const logRef = useRef(null);
    const sideZh = function (s) { return s === 1 ? "黑" : "白"; };
    const nameOfSide = function (s) { return s === userSide ? uName : s === charSide ? cName : c2Name; };

    // 存档：每落一子存一次；终局清掉
    useEffect(function () {
      if (winner) { clearGameSave("gomoku"); return; }
      if (!moves.length) return;
      saveGameSnap("gomoku", { runId: runId.current, config: cfg, board: board, moves: moves, turn: turn, winner: 0, lines: lines.slice(-30), playOv: playOv, lastTalkAt: lastTalkAt.current, ts: Date.now(), label: "第 " + moves.length + " 手" });
    }, [moves.length, winner, lines.length]);

    // TA 开口：一次只调一回模型，不挡着下棋。观战两个人时一回写两个人（各说一句或互相回嘴）
    // 局面一句话：双方最后一手各成了什么（不贴整张棋盘）
    const boardWhy = function (ms) {
      const bits = [];
      [1, 2].forEach(function (side) {
        const lastM = ms.slice().reverse().find(function (m) { return m.who === side; });
        if (!lastM) return;
        const b = gmkEmpty(); ms.forEach(function (m) { b[m.y * GMK_N + m.x] = m.who; });
        const th = gmkThreat(b, lastM.x, lastM.y, side);
        if (th) bits.push(nameOfSide(side) + "上一手" + th);
      });
      return winner ? (winner === 3 ? "棋已经下完，和棋。" : "棋已经下完，" + nameOfSide(winner) + "赢了。") : (bits.length ? bits.join("；") + "。" : "局面还平。");
    };
    const say = function (why, ms) {
      ms = ms || moves;
      const said = lines.slice(-8);
      if (!api || !talkers.length || talkBusy.current) return;
      talkBusy.current = true; setTalking(true);
      lastTalkAt.current = ms.length;
      const lastFew = ms.slice(-6).map(function (m) { return nameOfSide(m.who) + gmkCoord(m.x, m.y); }).join("、");
      const who = talkers.map(function (c) {
        const recent = (cfg.injectChat && props.recentChatFor) ? String(props.recentChatFor(c.id) || "").slice(-400) : "";
        return "■ " + c.name + "（执" + (c === char ? sideZh(charSide) : sideZh(botSide)) + "，" + "现在" + PLAY_ZH[level(c === char ? charSide : botSide)] + "下" + "）\n【人设】" + String(c.persona || "（没写）").slice(0, talkers.length > 1 ? 900 : 1600) + (recent ? "\n【最近在聊】" + recent : "");
      }).join("\n\n");
      const scene = spectate
        ? (char2 ? cName + " 和 " + c2Name + " 在下五子棋，" + uName + " 在旁边看" : cName + " 在跟电脑下五子棋，" + uName + " 在旁边看")
        : cName + " 在跟 " + uName + " 下五子棋（" + uName + "执黑先手，" + cName + "执白）" + (easy ? "，" + cName + "这局是让着 TA 的" : "");
      const sys = gameVoiceRules() + "【场面】" + scene + "。棋子不归你们管，你们只说话：像真坐在棋盘边那样随口说，照你们平时的关系和你自己的性子——下棋是一起玩，不是对峙。"
        + "\n\n" + who
        + "\n\n【现在】第 " + ms.length + " 手。" + boardWhy(ms) + (lastFew ? "\n最近几手：" + lastFew : "") + "\n" + why
        + (said.length ? "\n【你们刚才已经说过的】\n" + said.map(function (l) { return "· " + l.name + "：" + l.text; }).join("\n") + "\n这些话说过了：同一个意思别换个说法再说一遍，接着往下聊。" : "")
        + "\n\n" + GAME_SAY_FREE + (talkers.length > 1 ? "两个人可以一个人说，也可以一来一回；同一个人连着说几句就在 talks 里连着放几条。" : "")
        + "\n下法跟着你们自己的心思走：被激了、想赢了、心软了、想让 TA 高兴了，都可以换。真要换就在那个人那一条里加 play，填「认真」「随手」「让着」之一，从下一手起照这个下；不换就不写。"
        + "\n只输出 JSON：{\"talks\":[{\"name\":\"说话的人\",\"text\":\"一句话\",\"play\":\"可选\"}]}";
      callRetry(api, sys, [{ role: "user", content: "说话。" }], { maxTokens: 8000, tag: "五子棋" }).then(function (raw) {
        const p = extractJSON(raw) || {};
        const list = (Array.isArray(p.talks) ? p.talks : (p.say ? [{ name: char && char.name, text: p.say }] : []))
          .map(function (x) {
            const c = talkers.find(function (q) { return x && (x.name === q.name || x.name === nmOf(q)); }) || (talkers.length === 1 ? talkers[0] : null);
            const pl = c && x ? PLAY_ZH.indexOf(String(x.play || "").trim()) : -1;
            return c && String((x && x.text) || "").trim() ? { id: c.id, name: nmOf(c), text: String(x.text).trim().slice(0, 200), at: Date.now(), play: pl } : null;
          }).filter(Boolean);
        const ch = {};
        list.forEach(function (l) { if (l.play >= 0) ch[l.id] = l.play; });
        const notes = Object.keys(ch).map(function (id) { return nmOf(findC(id)) + "开始" + PLAY_ZH[ch[id]] + "下了"; });
        if (notes.length) { setPlayOv(function (o) { return Object.assign({}, o, ch); }); setPlayNote(notes.join("，")); }
        if (list.length) setLines(function (L) { return L.concat(list); });
      }).catch(function () {}).then(function () { talkBusy.current = false; setTalking(false); });
    };
    // TA 什么时候开口由她定（wait-for-her）：她说一句，或者空着按一下让 TA 说
    const sendHeckle = function () {
      if (talkBusy.current) return;
      const v = heckle.trim();
      setHeckle("");
      if (v) setLines(function (L) { return L.concat([{ me: true, name: uName, text: v.slice(0, 200), at: Date.now() }]); });
      say(v ? (spectate ? "场外的 " + uName + " 插了一句" : uName + " 跟你说") + "：「" + v.slice(0, 120) + "」。" : (spectate ? uName + " 在等你们说话。" : uName + " 在等你开口。"), moves);
    };

    const place = function (x, y, who) {
      if (winner || board[y * GMK_N + x]) return false;
      const nb = board.slice(); nb[y * GMK_N + x] = who;
      const nm = moves.concat([{ x: x, y: y, who: who }]);
      setBoard(nb); setMoves(nm); setPend(null);
      const won = gmkWins(nb, x, y, who);
      const full = !won && nm.length >= GMK_N * GMK_N;
      if (won) setWinner(who); else if (full) setWinner(3); else setTurn(who === 1 ? 2 : 1);
      // ⚠️落子不触发说话：TA 什么时候开口由她定（她 2026-10-11：「不是应该我来决定他什么时候说话吗」）
      return true;
    };

    // 「TA 自己下」：这一步交给 TA 的模型，落子和说话一起回来（她 2026-10-12）。
    //   棋盘整张念给 TA；落在非法格就退回本地棋手下这一步，并说一声，别让一局卡死。
    const brainModel = cfg.gmkBrain === "model" && !!api;
    const [thinking, setThinking] = useState(false);
    const thinkRef = useRef(false);
    const boardText = function (b) {
      const cols = "ABCDEFGHJKLMNOP";
      const rows = ["   " + cols.split("").join(" ")];
      for (let y = 0; y < GMK_N; y++) {
        let r = String(GMK_N - y).padStart(2, " ") + " ";
        for (let x = 0; x < GMK_N; x++) { const v = b[y * GMK_N + x]; r += (v === 1 ? "●" : v === 2 ? "○" : "·") + (x < GMK_N - 1 ? " " : ""); }
        rows.push(r);
      }
      return rows.join("\n");
    };
    const parseCoord = function (c) {
      const m = String(c || "").toUpperCase().match(/([A-HJ-P])\s*(\d{1,2})/);
      if (!m) return null;
      const x = "ABCDEFGHJKLMNOP".indexOf(m[1]), y = GMK_N - Number(m[2]);
      return (x < 0 || y < 0 || y >= GMK_N) ? null : { x: x, y: y };
    };
    const modelMove = async function (side) {
      const who = side === charSide ? char : char2;
      if (!who) return null;
      const other = side === charSide ? (spectate ? c2Name : uName) : cName;
      const sinceMine = [];
      for (let i = lines.length - 1; i >= 0 && !(lines[i].id === who.id); i--) sinceMine.unshift(lines[i]);
      const sys = gameVoiceRules() + "你是「" + who.name + "」。\n【你的人设】\n" + String(who.persona || "（没写）").slice(0, 1500)
        + "\n\n你在跟 " + other + " 下五子棋" + (spectate ? "，" + uName + " 在边上看" : "") + "，你执" + sideZh(side) + "（" + (side === 1 ? "●" : "○") + "），现在轮到你落子。先连成五子的赢。"
        + "现在你" + PLAY_ZH[level(side)] + "下" + (level(side) === 2 ? "，让着对方，但对方马上连五的那一下还是会挡" : "") + "。"
        + "\n【棋盘】（● 黑，○ 白，· 空；列 A-P 不含 I，行 15 在最上）\n" + boardText(board)
        + (moves.length ? "\n上一手：" + nameOfSide(moves[moves.length - 1].who) + gmkCoord(moves[moves.length - 1].x, moves[moves.length - 1].y) : "\n棋盘还空着，你先手。")
        + (lines.slice(-8).length ? "\n【刚才说过的】\n" + lines.slice(-8).map(function (l) { return "· " + l.name + "：" + l.text; }).join("\n") + "\n说过的别换个说法再说一遍。" : "")
        + (sinceMine.some(function (l) { return l.me; }) ? "\n" + uName + " 在你上次说话之后说了上面那几句，可以接着聊。" : "")
        + "\n\n落一子（move，填空着的格子，比如 H8），再说话（say，照你的性子，下棋是一起玩不是对峙；" + GAME_SAY_FREE + "）。下法要换就加 play（认真 / 随手 / 让着）。"
        + "\n只输出 JSON：{\"move\":\"H8\",\"say\":[\"一句\"],\"play\":\"可选\"}";
      const raw = await callRetry(api, sys, [{ role: "user", content: "该你下了。" }], { maxTokens: 8000, tag: "五子棋·落子" });
      return { r: extractJSON(raw) || {}, who: who };
    };
    // 不是她下的那一方：停一拍再落，像在想
    useEffect(function () {
      if (winner) return;
      if (turn === userSide) return;
      const isChar = turn === charSide || (turn === botSide && !!char2);
      if (brainModel && isChar) {
        if (thinkRef.current) return;
        thinkRef.current = true; setThinking(true);
        const side = turn;
        modelMove(side).then(function (res) {
          let m = res ? parseCoord(res.r.move) : null;
          if (!m || board[m.y * GMK_N + m.x]) {
            const fb = gmkBestMove(board, side, level(side));
            if (fb) setPlayNote(nmOf(res && res.who) + "那一步落不下去，替 TA 下在 " + gmkCoord(fb.x, fb.y));
            m = fb;
          }
          const says = res ? sayList(res.r.say) : [];
          const pl = res ? PLAY_ZH.indexOf(String(res.r.play || "").trim()) : -1;
          if (pl >= 0 && res.who) { setPlayOv(function (o) { const n = Object.assign({}, o); n[res.who.id] = pl; return n; }); setPlayNote(nmOf(res.who) + "开始" + PLAY_ZH[pl] + "下了"); }
          if (says.length && res.who) setLines(function (L) { return L.concat(says.map(function (v) { return { id: res.who.id, name: nmOf(res.who), text: v.slice(0, 200), at: Date.now() }; })); });
          if (m) place(m.x, m.y, side);
        }).catch(function () {
          const fb = gmkBestMove(board, side, level(side));
          setPlayNote("没连上 TA 的模型，这一步本地棋手代下");
          if (fb) place(fb.x, fb.y, side);
        }).then(function () { thinkRef.current = false; setThinking(false); });
        return;
      }
      const timer = setTimeout(function () {
        const m = gmkBestMove(board, turn, level(turn));
        if (m) place(m.x, m.y, turn);
      }, spectate ? 900 : 650);
      return function () { clearTimeout(timer); };
    }, [turn, winner, board]);

    const tap = function (x, y) {
      if (winner || turn !== userSide || board[y * GMK_N + x]) return;
      // 手机上手指粗：第一下只标出来，同一格再点一下才落
      if (pend && pend.x === x && pend.y === y) place(x, y, userSide);
      else setPend({ x: x, y: y });
    };
    const undo = function () {
      // 悔一步＝退回她上一手之前（连同 TA 应的那一手）
      if (winner || spectate || moves.length < 2 || turn !== userSide) return;
      const nm = moves.slice(0, -2), nb = gmkEmpty();
      nm.forEach(function (m) { nb[m.y * GMK_N + m.x] = m.who; });
      setBoard(nb); setMoves(nm); setPend(null); setTurn(userSide);
    };

    // 棋盘：SVG 一张，跟屏宽走
    const cell = 22, pad = 16, size = pad * 2 + cell * (GMK_N - 1);
    const last = moves[moves.length - 1];
    const stars = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
    // 棋盘：一块木板（两道木纹渐变＋一圈压边），子是有光泽的石头，最后一手套一个红圈
    const boardSvg = h("svg", { "data-wk": "gomokuboard", viewBox: "0 0 " + size + " " + size, style: { width: "100%", maxWidth: 440, display: "block", margin: "0 auto", borderRadius: 12,
        background: "linear-gradient(135deg, #e9cf98 0%, #ddb878 48%, #e6c88e 100%)", boxShadow: "inset 0 0 0 3px rgba(107,82,48,.25), 0 10px 24px rgba(60,40,15,.28), 0 2px 4px rgba(60,40,15,.2)", touchAction: "manipulation" },
        onClick: function (e) {
          const r = e.currentTarget.getBoundingClientRect();
          const k = size / r.width;
          const x = Math.round(((e.clientX - r.left) * k - pad) / cell), y = Math.round(((e.clientY - r.top) * k - pad) / cell);
          if (x >= 0 && y >= 0 && x < GMK_N && y < GMK_N) tap(x, y);
        } },
      h("defs", { key: "defs" },
        h("radialGradient", { id: "gmkB", cx: ".35", cy: ".3", r: ".75" }, h("stop", { offset: "0", stopColor: "#77716a" }), h("stop", { offset: ".55", stopColor: "#1c1a18" })),
        h("radialGradient", { id: "gmkW", cx: ".35", cy: ".3", r: ".8" }, h("stop", { offset: "0", stopColor: "#ffffff" }), h("stop", { offset: ".7", stopColor: "#e4ded1" }), h("stop", { offset: "1", stopColor: "#c9c0ae" })),
        h("pattern", { id: "gmkGrain", width: 40, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-8)" }, h("path", { d: "M0 3Q10 1 20 3T40 3", stroke: "#a87d43", strokeOpacity: .13, fill: "none", strokeWidth: 1.2 }))),
      h("rect", { key: "grain", x: 0, y: 0, width: size, height: size, fill: "url(#gmkGrain)" }),
      h("rect", { key: "frame", x: pad - 1.5, y: pad - 1.5, width: cell * (GMK_N - 1) + 3, height: cell * (GMK_N - 1) + 3, fill: "none", stroke: "#6b5230", strokeWidth: 1.6, strokeOpacity: .8 }),
      Array.from({ length: GMK_N }).map(function (_, i) { return h("g", { key: "l" + i },
        h("line", { x1: pad, y1: pad + i * cell, x2: pad + (GMK_N - 1) * cell, y2: pad + i * cell, stroke: "#6b5230", strokeWidth: .8 }),
        h("line", { x1: pad + i * cell, y1: pad, x2: pad + i * cell, y2: pad + (GMK_N - 1) * cell, stroke: "#6b5230", strokeWidth: .8 })); }),
      stars.map(function (s, i) { return h("circle", { key: "s" + i, cx: pad + s[0] * cell, cy: pad + s[1] * cell, r: 2.4, fill: "#6b5230" }); }),
      moves.map(function (m, i) { return svgStone("m" + i, pad + m.x * cell, pad + m.y * cell, cell * 0.44, m.who); }),
      last ? h("circle", { cx: pad + last.x * cell, cy: pad + last.y * cell, r: cell * 0.22, style: { fill: "none", stroke: "#d24b3a", strokeWidth: 1.6 } }) : null,
      pend ? svgStone("pend", pad + pend.x * cell, pad + pend.y * cell, cell * 0.44, userSide, { opacity: .5 }) : null);

    const status = winner === 3 ? "和棋"
      : winner ? nameOfSide(winner) + "（" + sideZh(winner) + "）赢了"
      : turn === userSide ? (pend ? "再点一下同一格落子" : "轮到你（" + sideZh(userSide) + "）")
      : nameOfSide(turn) + "在想…";
    const pAvatar = avatarFor(t);
    const charP = char ? { char: char, name: cName } : { name: cName };

    return h("div", { "data-wk": "gomoku", className: "h-full flex flex-col", style: gameTable("gomoku", t) },
      h(Head, { zh: "五子棋", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 16px 24px" } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "gomoku", zh: "五子棋" }, mid: moves.length ? moves.length + " 手" : "", seats: [1, 2].map(function (sd) {
          const c = sd === charSide ? char : sd === botSide ? char2 : null;
          const isMe = sd === userSide;
          return { key: "s" + sd, name: nameOfSide(sd), char: isMe ? { name: uName, avatarImage: pf.avatarImage, color: pf.color } : c, isUser: isMe,
            on: !winner && turn === sd, mark: h(GmkStone, { side: sd, size: 15 }),
            sub: winner ? (winner === sd ? "赢了" : winner === 3 ? "和棋" : "") : (sideZh(sd) + "子" + (sd === 1 ? " · 先手" : "")), hot: winner === sd };
        }) }),
        // TA 说的话：最近几句
        h("div", { "data-wk": "gomokutalk" }, h(GameTalkLog, { t: t, lines: lines, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, busy: talking, names: talkers.length > 1, k: "gmk",
          charOf: function (l) { return findC(l.id) || char; }, empty: spectate ? "他们在下棋，你可以在下面插一句" : cName + " 在对面坐着" })),
        boardSvg,
        h("div", { "data-wk": "gomokuchat", style: { display: "flex", gap: 8, marginTop: 12 } },
          h("input", { "data-wk": "gameinput", "data-part": "gomoku", value: heckle, onChange: function (e) { setHeckle(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendHeckle(); },
            placeholder: spectate ? "台下插一句…（空着按就是让他们说）" : "跟 " + cName + " 说一句…（空着按就是让 TA 开口）",
            style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "gomokusend", onClick: sendHeckle, disabled: talking, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: talking ? t.line : t.tint, borderRadius: 11, padding: "0 14px" } }, heckle.trim() ? "说" : "让 TA 说")),
        h("div", { "data-wk": "block", style: { textAlign: "center", marginTop: 12 } }, h("span", { "data-wk": "gomokustatus", style: { display: "inline-flex", alignItems: "center", gap: 7, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: winner ? "#f3efe6" : t.ink, background: winner ? t.ink : t.bg2, border: "1px solid " + (winner ? t.ink : t.line), borderRadius: 999, padding: "6px 15px", boxShadow: "0 2px 6px rgba(20,16,10,.08)" } },
          !winner && turn ? h(GmkStone, { side: turn, size: 12 }) : null, status)),
        playNote && !winner ? h("div", { "data-wk": "gomokuplay", style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, playNote) : null,
        !winner && !spectate ? h("div", { style: { display: "flex", justifyContent: "center", marginTop: 10 } },
          h("button", { "data-wk": "gomokuundo", onClick: undo, disabled: moves.length < 2 || turn !== userSide, className: "active:opacity-70", style: { minHeight: 40, padding: "0 18px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, opacity: moves.length < 2 || turn !== userSide ? .5 : 1 } }, "悔一步")) : null,
        winner ? h("div", { style: { marginTop: 14 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "active:opacity-80", style: { width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "回中枢"),
          char ? h(KeepMemBtn, { t: t, host: props, rep: function () {
            const res = winner === 3 ? "和棋" : nameOfSide(winner) + "赢了";
            // 言秋的记忆走 CC，不走 app 记忆库：跟别的桌一样认 ccSeat 开关
            const seat = function (c) { return { proc: lines, key: c.id, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)) }; };
            const winC = winner === charSide ? char : (winner === botSide ? char2 : null);
            return { key: "gomoku", zh: "五子棋", ids: realCharIds(talkers.map(seat)), wins: winC ? realCharIds([seat(winC)]) : [],
              meWin: spectate ? null : winner === userSide,
              text: (spectate ? (char2 ? "看 " + cName + " 和 " + c2Name + " 下了一盘五子棋" : "看 " + cName + " 跟电脑下了一盘五子棋") : "跟 " + cName + " 下了一盘五子棋") + "，" + moves.length + " 手，" + res + "。" };
          } }) : null) : null));
  }

  // ============================================================
  // 国际象棋 / 中国象棋（群友 2026-10-23：「一起玩里加个国际象棋或者象棋」；她：正常打，放水时多给点提示）
  // 跟五子棋一个思路：走子全由本地引擎下（js/chess-core.js、js/xiangqi-core.js），模型只负责说话。
  // 两个游戏各自一个界面（她：「不要 shared board，开俩小游戏界面」）；只有「TA 开口」这一段是公共的。
  // ============================================================
  // TA 开口：她说一句，或者空着按一下让 TA 说。两个棋共用这一段（one-public-mechanism）
  function useBoardTalk(o) {
    const props = o.props, cfg = props.config, api = props.active;
    const [lines, setLines] = useState(o.saved && o.saved.lines ? o.saved.lines : []);
    const [talking, setTalking] = useState(false);
    const [heckle, setHeckle] = useState("");
    const busy = useRef(false);
    const say = function (why) {
      const talkers = o.talkers;
      if (!api || !talkers.length || busy.current) return;
      busy.current = true; setTalking(true);
      const said = lines.slice(-8);
      const who = talkers.map(function (c) {
        const recent = (cfg.injectChat && props.recentChatFor) ? String(props.recentChatFor(c.id) || "").slice(-400) : "";
        return "■ " + c.name + "（" + o.seatOf(c) + "）\n【人设】" + String(c.persona || "（没写）").slice(0, talkers.length > 1 ? 900 : 1600) + (recent ? "\n【最近在聊】" + recent : "");
      }).join("\n\n");
      const sys = gameVoiceRules() + "【场面】" + o.scene() + "。棋不归你们走，你们只说话：像真坐在棋盘边那样随口说，照你们平时的关系和你自己的性子——下棋是一起玩，不是对峙。"
        + "\n\n" + who + "\n\n【现在】" + o.where()
        // 教学（她 2026-10-23）：实情是引擎看的，怎么讲照这个人——讲多讲少、耐不耐心、打不打比方都随 TA；水平不够的地方可以说自己也拿不准
        + (o.teach ? "\n\n【这局在教 " + o.uName + " 下】下面是引擎看出来的实情，你照你这个人看得出来的程度、照你平时说话的样子讲给 TA 听；你水平没那么高的话，看不太懂的地方可以直说拿不准。别念坐标清单，TA 没问就别把下一步的答案直接报出来。\n【局面实情】" + (o.teachFacts() || "还没什么可讲的。") : "")
        + "\n" + why
        + (said.length ? "\n【你们刚才已经说过的】\n" + said.map(function (l) { return "· " + l.name + "：" + l.text; }).join("\n") + "\n这些话说过了：同一个意思别换个说法再说一遍，接着往下聊。" : "")
        + "\n\n" + GAME_SAY_FREE + (talkers.length > 1 ? "两个人可以一个人说，也可以一来一回；同一个人连着说几句就在 talks 里连着放几条。" : "")
        + "\n只输出 JSON：{\"talks\":[{\"name\":\"说话的人\",\"text\":\"一句话\"}]}";
      callRetry(api, sys, [{ role: "user", content: "说话。" }], { maxTokens: 8000, tag: o.zh }).then(function (raw) {
        const p = extractJSON(raw) || {};
        const list = (Array.isArray(p.talks) ? p.talks : []).map(function (x) {
          const c = talkers.find(function (q) { return x && (x.name === q.name || x.name === (q.remark || q.name)); }) || (talkers.length === 1 ? talkers[0] : null);
          return c && String((x && x.text) || "").trim() ? { id: c.id, name: c.remark || c.name, text: String(x.text).trim().slice(0, 200), at: Date.now() } : null;
        }).filter(Boolean);
        if (list.length) setLines(function (L) { return L.concat(list); });
      }).catch(function () {}).then(function () { busy.current = false; setTalking(false); });
    };
    const send = function () {
      if (busy.current) return;
      const v = heckle.trim();
      setHeckle("");
      if (v) setLines(function (L) { return L.concat([{ me: true, name: o.uName, text: v.slice(0, 200), at: Date.now() }]); });
      say(v ? (o.spectate ? "场外的 " + o.uName + " 插了一句" : o.uName + " 跟你说") + "：「" + v.slice(0, 120) + "」。" : (o.spectate ? o.uName + " 在等你们说话。" : o.uName + " 在等你开口。"));
    };
    return { lines: lines, setLines: setLines, talking: talking, heckle: heckle, setHeckle: setHeckle, send: send, say: say };
  }
  // 局面从开局一步步重放出来（存档只存走过的步，悔棋、重复局面都靠它）
  function boardReplay(C, mvs) {
    let s = C.newGame();
    (mvs || []).forEach(function (m) {
      const ok = C.legalMoves(s, m.from).find(function (x) { return x.to[0] === m.to[0] && x.to[1] === m.to[1] && (!m.promo || x.promo === m.promo); });
      if (ok) s = C.move(s, ok);
    });
    return s;
  }
  // TA 下得多好照人设（她 2026-10-23：「正常水平也要符合人设，不能人人都是国际大师」）。
  //   她在开局页钉过一档就用钉的；没钉就照点头像那张能力小传同一套说法估一次，估出来的档跟小传一起存进 x_gameSkill，下一局不再花钱。
  //   三档对应引擎三档：新手 easy / 会下 normal / 高手 hard。放水局一律 easy。
  const BOARD_TIER_LV = { rookie: "easy", mid: "normal", pro: "hard" };
  const BOARD_STYLES = ["attack", "solid", "trade", "wild"];
  const BOARD_STYLE_ZH = { attack: "爱进攻", solid: "求稳", trade: "爱兑子", wild: "随性" };
  function useBoardSkill(props, key, zh, chars) {
    // { [id]: { tier, style } }：tier 钉的优先；style 永远照人设估（钉档只管多强，不管怎么下）
    const [skills, setSkills] = useState({});
    useEffect(function () {
      chars.forEach(function (c) {
        const pin = BOARD_TIER_LV[loadSkillPins()[c.id]] ? loadSkillPins()[c.id] : "";
        const put = function (tier, style) { setSkills(function (o) { return Object.assign({}, o, { [c.id]: { tier: pin || tier, style: BOARD_STYLES.indexOf(style) >= 0 ? style : "" } }); }); };
        const persona = String(c.persona || "").trim(), stamp = persona.length + ":v2";
        const got = ((loadJSON(GAME_SKILL_KEY, {}) || {})[key] || {})[c.id];
        if (got && got.n === stamp && BOARD_TIER_LV[got.tier]) return put(got.tier, got.style);
        const api = props.active;
        if (!api) return put("mid", "");
        const sys = AC + SKILL_RULE + SKILL_TALK + "\n\n你是「" + zh + "」的能力评估器。照这个人的人设，判断 TA 下" + zh + "的真实水平和路子：学没学过、平时下不下、会不会算几步、爱怎么下。人设里没提到下棋，就照一般人估。"
          + "写一段「牌桌能力小传」，第三人称，不写分数；再挑一档 tier：rookie（新手，规则都不太熟或很少下）、mid（会下，业余随便玩玩）、pro（真下过、算得深）；"
          + "再挑一种 style，照 TA 这个人做事的路子：attack（爱往前冲、爱将军）、solid（求稳、先守好自己）、trade（见子就换、爱简化）、wild（随性、想到哪儿走到哪儿）。只输出 JSON：{\"skill\":\"……\",\"tier\":\"rookie|mid|pro\",\"style\":\"attack|solid|trade|wild\"}";
        callRetry(api, sys, [{ role: "user", content: "【这个人】" + (c.remark || c.name) + "\n【人设】" + (persona || "（没写人设，照名字和一般人估）").slice(0, 1600) }], { maxTokens: 65000, tag: zh + "·能力评估" })
          .then(function (raw) {
            const d = extractJSON(raw) || {}, tier = BOARD_TIER_LV[d.tier] ? d.tier : "mid", style = BOARD_STYLES.indexOf(d.style) >= 0 ? d.style : "", text = String(d.skill || "").trim();
            const all = loadJSON(GAME_SKILL_KEY, {}) || {};
            all[key] = Object.assign({}, all[key] || {}, { [c.id]: Object.assign({ n: stamp, tier: tier, style: style }, text ? { text: text } : {}) });
            saveJSON(GAME_SKILL_KEY, all);
            put(tier, style);
          }).catch(function () { put("mid", ""); });
      });
    }, []);
    return skills;
  }
  // 放水才有的提示次数多：正常局三次，放水不限
  const BOARD_HINTS = 3;

  // ============================ 国际象棋 ============================
  // ============================ 走子棋的公共那一层 ============================
  // 她 2026-10-27「要要要」：国际象棋、中国象棋、斗兽棋原来各抄一整页——选子、走子、电脑应手、提示、悔棋、认输、
  //   存档、说话、记录卡、整页排版三份一模一样，改一处漏两处（施工规则/one-public-mechanism.md）。
  //   现在这些只在 useEngineBoard + EngineBoardPage 里；每个棋只交：规则引擎 C、两方是谁、怎么记一步、棋盘怎么画。
  //   围棋落子、数子都不一样，不走这一层。
  //   spec：{ C, key, zh, sides:[先手, 后手], sideZh(s), teachNote(state, mv), whereNote(prevState, mv), recent(state), check, overNote(st), record(mv), pick(goList) }
  function useEngineBoard(props, spec) {
    const C = spec.C, KEY = spec.key, ZH = spec.zh, S0 = spec.sides[0], S1 = spec.sides[1];
    const t = props.t, cfg = props.config, sv = props.savedState;
    const spectate = cfg.mode === "spectate", easy = cfg.mode === "easy";
    const findC = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }) || null; };
    const char = findC((cfg.charIds || [])[0]), char2 = spectate ? findC((cfg.charIds || [])[1]) : null;
    const pf = props.profile || {}, uName = pf.name || "你";
    const nm = function (c) { return c ? (c.remark || c.name) : "电脑"; };
    // 她执先手那一方；观战时 TA 执先手、另一位（或电脑）执后手
    const userSide = spectate ? "" : S0, charSide = spectate ? S0 : S1;
    const nameOf = function (s) { return s === userSide ? uName : s === charSide ? nm(char) : nm(char2); };
    const sideZh = spec.sideZh;
    const tiers = useBoardSkill(props, KEY, ZH, [char, char2].filter(Boolean));
    const sideChar = function (s) { return s === charSide ? char : s !== userSide ? char2 : null; };
    // 还没估出来就先等着（null），估出来再走
    const levelOf = function (s) { const c = sideChar(s); if (!spectate && easy && s === charSide) return "easy"; if (!c) return "normal"; return tiers[c.id] ? BOARD_TIER_LV[tiers[c.id].tier] : null; };
    const styleOf = function (s) { const c = sideChar(s); return c && tiers[c.id] ? tiers[c.id].style || undefined : undefined; };
    const [mvs, setMvs] = useState(sv && sv.mvs ? sv.mvs : []);
    const state = React.useMemo(function () { return boardReplay(C, mvs); }, [mvs]);
    const [resigned, setResigned] = useState(sv && sv.resigned ? sv.resigned : "");
    const st = C.status(state);
    const over = st.over || !!resigned;
    const winner = resigned ? (resigned === S0 ? S1 : S0) : st.result;
    const [sel, setSel] = useState(null);
    const [hint, setHint] = useState(null);
    const [why, setWhy] = useState("");
    const [hintsUsed, setHintsUsed] = useState(sv && sv.hintsUsed ? sv.hintsUsed : 0);
    const runId = useRef((sv && sv.runId) || (KEY + "-" + Date.now().toString(36)));
    const talkers = [char, char2].filter(Boolean);
    const teach = !!cfg.boardTeach && !spectate, teachRef = useRef(null);
    const teachFacts = function () {
      const n0 = teachRef.current, bits = [];
      if (n0) bits.push(uName + "上一步：" + n0.mine + (n0.better ? "；引擎觉得更好的是：" + n0.better : "；跟引擎想的一样"));
      if (!over && state.turn === userSide) { const b = C.bestMove(state, "normal"); if (b) bits.push(uName + "现在最好的一步：" + spec.teachNote(state, b)); }
      if (spec.check && st.check) bits.push(uName + "正被将军");
      return bits.join("\n");
    };
    const talk = useBoardTalk({ props: props, saved: sv, talkers: talkers, uName: uName, spectate: spectate, zh: ZH, teach: teach, teachFacts: teachFacts,
      seatOf: function (c) { return "执" + sideZh(c === char ? charSide : S1) + (easy && c === char ? "，这局让着" + uName : "") + (tiers[c.id] ? "，下棋水平：" + { rookie: "新手", mid: "会下、业余水平", pro: "真下过、算得深" }[tiers[c.id].tier] + (tiers[c.id].style ? "，路子" + BOARD_STYLE_ZH[tiers[c.id].style] : "") : ""); },
      scene: function () { return spectate ? nm(char) + " 和 " + nm(char2) + " 在下" + ZH + "，" + uName + " 在旁边看" : nm(char) + " 在跟 " + uName + " 下" + ZH + "（" + uName + "执" + sideZh(S0) + "先走）"; },
      where: function () {
        const h0 = state.history, last = h0[h0.length - 1];
        return "第 " + Math.ceil(h0.length / 2) + " 回合。" + (over ? (winner === "draw" ? "已经下完，和棋。" : "已经下完，" + nameOf(winner) + "赢了" + (resigned ? "（对面认输）" : spec.overNote ? spec.overNote(st) : "") + "。")
          : (last ? "上一步：" + nameOf(h0.length % 2 ? S0 : S1) + "，" + spec.whereNote(boardReplay(C, mvs.slice(0, -1)), last.mv) + "。" : "还没开始走。") + (spec.check && st.check ? "现在正被将军。" : ""))
          + (h0.length ? "\n最近几步：" + spec.recent(state) : "") + "\n【棋盘现在】\n" + C.boardText(state);
      } });

    useEffect(function () {
      if (over) { clearGameSave(KEY); return; }
      if (!mvs.length) return;
      saveGameSnap(KEY, { runId: runId.current, config: cfg, mvs: mvs, lines: talk.lines.slice(-30), hintsUsed: hintsUsed, ts: Date.now(), label: "第 " + Math.ceil(mvs.length / 2) + " 回合" });
    }, [mvs.length, over, talk.lines.length]);

    const play = function (mv) {
      if (teach && state.turn === userSide) { const b = C.bestMove(state, "normal"); teachRef.current = { mine: spec.teachNote(state, mv), better: b && !(b.from + "" === mv.from + "" && b.to + "" === mv.to + "") ? spec.teachNote(state, b) : "" }; }
      setMvs(function (a) { return a.concat([spec.record ? spec.record(mv) : { from: mv.from, to: mv.to }]); }); setSel(null); setHint(null); setWhy("");
    };
    // 不是她走的那一方：停一拍再走，像在想
    useEffect(function () {
      if (over || state.turn === userSide) return;
      const lv = levelOf(state.turn);
      if (!lv) return;
      const tm = setTimeout(function () { const m = C.bestMove(state, lv, styleOf(state.turn)); if (m) play(m); }, spectate ? 900 : 600);
      return function () { clearTimeout(tm); };
    }, [mvs.length, over, tiers]);

    const targets = sel ? C.legalMoves(state, sel) : [];
    const tap = function (r, c) {
      if (over || state.turn !== userSide) return;
      const go = targets.filter(function (m) { return m.to[0] === r && m.to[1] === c; });
      if (go.length) return play(spec.pick ? spec.pick(go) : go[0]);
      const p = state.board[r][c];
      // 选着子又点了走不过去的地方：说一句为什么（她 2026-10-23「为啥我的帅吃不了你的炮」）
      if (sel && !(p && p[0] === userSide) && C.whyNot) { const w = C.whyNot(state, sel, [r, c]); if (w) { setWhy(w); return; } }
      setWhy("");
      setSel(p && p[0] === userSide && !(sel && sel[0] === r && sel[1] === c) ? [r, c] : null);
    };
    const canHint = !over && state.turn === userSide && (easy || hintsUsed < BOARD_HINTS);
    const askHint = function () { if (!canHint) return; const m = C.bestMove(state, "hard"); if (m) { setHint(m); setSel(m.from); setHintsUsed(hintsUsed + 1); if (teach) talk.say(uName + "按了提示，提示是：" + (C.zhPlain ? C.zhPlain(state, m) : C.zh(state, m)) + "。顺口讲讲这步好在哪。"); } };
    const undo = function () { if (over || spectate || mvs.length < 2 || state.turn !== userSide) return; setMvs(mvs.slice(0, -2)); setSel(null); setHint(null); };
    const resign = function () { if (over || spectate) return; requestAppConfirm("认输？", "这一局算 " + nm(char) + " 赢。", function () { setResigned(userSide); }, "认输"); };
    return { C: C, spec: spec, props: props, t: t, cfg: cfg, spectate: spectate, easy: easy, findC: findC, char: char, char2: char2, pf: pf, uName: uName, nm: nm,
      userSide: userSide, charSide: charSide, nameOf: nameOf, sideZh: sideZh, tiers: tiers, mvs: mvs, state: state, st: st, over: over, winner: winner, resigned: resigned,
      sel: sel, hint: hint, why: why, hintsUsed: hintsUsed, talkers: talkers, talk: talk, targets: targets, tap: tap, canHint: canHint, askHint: askHint, undo: undo, resign: resign };
  }
  // 整页：对阵条、说话、吃子、棋盘、最近几步、输入框、状态、提示/悔棋/认输、终局记录卡。data-wk 一律「棋名 + 部件」，跟原来三页一样（美化不受影响）
  //   v：{ board, caps(side) , moves, status, mark(side), subOf(side), talkK }
  function EngineBoardPage(props) {
    const g = props.g, v = props.v, t = g.t, K = g.spec.key, ZH = g.spec.zh, S = g.spec.sides;
    const pf = g.pf, uName = g.uName, talk = g.talk, over = g.over, winner = g.winner, state = g.state, char = g.char, char2 = g.char2, nm = g.nm;
    const btn = function (wk, label, on, dis) { return h("button", { "data-wk": wk, onClick: on, disabled: dis, className: "active:opacity-70", style: { minHeight: 40, padding: "0 16px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, opacity: dis ? .45 : 1 } }, label); };
    return h("div", { "data-wk": K, className: "h-full flex flex-col", style: gameTable(K, t) },
      h(Head, { zh: ZH, onBack: g.props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 16px 24px" } },
        h(GameVsBar, { t: t, evalOf: { host: g.props, key: K, zh: ZH }, mid: state.history.length ? Math.ceil(state.history.length / 2) + " 回合" : "", seats: S.map(function (sd) {
          const isMe = sd === g.userSide, c = sd === g.charSide ? char : char2;
          return { key: sd, name: g.nameOf(sd), char: isMe ? { name: uName, avatarImage: pf.avatarImage, color: pf.color } : c, isUser: isMe, on: !over && state.turn === sd,
            mark: v.mark(sd), sub: over ? (winner === sd ? "赢了" : winner === "draw" ? "和棋" : "") : g.sideZh(sd) + (sd === S[0] ? v.firstTag || " · 先走" : ""), hot: winner === sd };
        }) }),
        h("div", { "data-wk": K + "talk" }, h(GameTalkLog, { t: t, lines: talk.lines, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, busy: talk.talking, names: g.talkers.length > 1, k: v.talkK,
          charOf: function (l) { return g.findC(l.id) || char; }, empty: g.spectate ? "他们在下棋，你可以在下面插一句" : nm(char) + " 在对面坐着" })),
        v.caps(S[1]),
        v.board,
        v.caps(S[0]),
        state.history.length ? h("div", { "data-wk": K + "moves", style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 8 } }, v.moves) : null,
        h("div", { style: { display: "flex", gap: 8, marginTop: 12 } },
          h("input", { "data-wk": "gameinput", "data-part": K, value: talk.heckle, onChange: function (e) { talk.setHeckle(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") talk.send(); },
            placeholder: g.spectate ? "台下插一句…（空着按就是让他们说）" : "跟 " + nm(char) + " 说一句…（空着按就是让 TA 开口）",
            style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": K + "send", onClick: talk.send, disabled: talk.talking, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: talk.talking ? t.line : t.tint, borderRadius: 11, padding: "0 14px" } }, talk.heckle.trim() ? "说" : "让TA说")),
        g.why && !over ? h("div", { "data-wk": K + "why", style: { textAlign: "center", marginTop: 10, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#b8433a" } }, "走不了：" + g.why) : null,
        h("div", { style: { textAlign: "center", marginTop: 12 } }, h("span", { "data-wk": K + "status", style: { display: "inline-block", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: over ? "#f3efe6" : t.ink, background: over ? t.ink : t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, v.status)),
        !over && !g.spectate ? h("div", { style: { display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          btn(K + "hint", g.easy ? "提示" : "提示（还剩 " + Math.max(0, BOARD_HINTS - g.hintsUsed) + "）", g.askHint, !g.canHint),
          btn(K + "undo", "悔一步", g.undo, g.mvs.length < 2 || state.turn !== g.userSide),
          btn(K + "resign", "认输", g.resign, false)) : null,
        over ? h("div", { style: { marginTop: 14 } },
          h("button", { "data-wk": "block", onClick: g.props.onBack, className: "active:opacity-80", style: { width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "回中枢"),
          char ? h(KeepMemBtn, { t: t, host: g.props, rep: function () {
            const res = winner === "draw" ? "和棋" : g.nameOf(winner) + "赢了";
            const seat = function (c) { return { key: c.id, engineer: !!(g.cfg.ccSeat !== false && g.props.isEngineer && g.props.isEngineer(c.id)) }; };
            const winC = winner === g.charSide ? char : (winner && winner !== "draw" && winner !== g.userSide ? char2 : null);
            return { key: K, zh: ZH, ids: realCharIds(g.talkers.map(seat)), wins: winC ? realCharIds([seat(winC)]) : [], meWin: g.spectate ? null : winner === g.userSide,
              text: (g.spectate ? "看 " + nm(char) + " 和 " + nm(char2) + " 下了一盘" + ZH : "跟 " + nm(char) + " 下了一盘" + ZH) + "，" + Math.ceil(state.history.length / 2) + " 回合，" + res + "。" };
          } }) : null) : null));
  }

  function ChessGame(props) {
    const g = useEngineBoard(props, { C: window.ChessCore, key: "chess", zh: "国际象棋", sides: ["w", "b"], sideZh: function (s) { return s === "w" ? "白" : "黑"; }, check: true,
      teachNote: function (s, m) { return window.ChessCore.zh(s, m); }, whereNote: function (s, m) { return window.ChessCore.zh(s, m); },
      recent: function (s) { return s.history.slice(-8).map(function (x) { return x.san; }).join(" "); },
      record: function (mv) { return { from: mv.from, to: mv.to, promo: mv.promo }; },
      pick: function (go) { return go.find(function (m) { return !m.promo || m.promo === "q"; }) || go[0]; } });
    const C = g.C, t = g.t, state = g.state, st = g.st, sel = g.sel, hint = g.hint, targets = g.targets, tap = g.tap, over = g.over, winner = g.winner, resigned = g.resigned, nameOf = g.nameOf, userSide = g.userSide;

    const last = state.history.length ? state.history[state.history.length - 1].mv : null;
    let kingAt = null;
    if (st.check) state.board.forEach(function (row, r) { row.forEach(function (p, c) { if (p === state.turn + "K") kingAt = [r, c]; }); });
    const same = function (a, r, c) { return a && a[0] === r && a[1] === c; };
    // 棋子用实心那一套，白子象牙色描黑边、黑子乌木色（她 2026-10-23「页面能不能做好看点」）；︎ 让 iOS 别把兵画成 emoji
    const GLYPH = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
    const pieceEl = function (p, size) { const w = p[0] === "w"; return h("span", { style: { fontFamily: "'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols2',serif", fontSize: size, lineHeight: 1,
      color: w ? "#fbf4e2" : "#2a2420", WebkitTextStroke: w ? "1.1px #3a2e24" : "0.6px #000", textShadow: w ? "0 2px 2px rgba(40,25,10,.35)" : "0 1px 0 rgba(255,255,255,.18), 0 2px 3px rgba(0,0,0,.35)" } }, GLYPH[p[1]] + "︎"); };
    const coord = { fontFamily: F_BODY, fontSize: 10, color: "#e8d3ad", opacity: .85, textAlign: "center" };
    const board = h("div", { "data-wk": "chessboard", style: { width: "100%", maxWidth: 440, margin: "0 auto", padding: "8px 8px 4px 18px", borderRadius: 14,
        background: "linear-gradient(145deg, #6b4a2e, #4a3220)", boxShadow: "0 12px 26px rgba(40,25,10,.35), inset 0 1px 0 rgba(255,255,255,.12)" } },
      h("div", { style: { position: "relative" } },
        h("div", { style: { position: "absolute", left: -14, top: 0, bottom: 0, display: "grid", gridTemplateRows: "repeat(8, 1fr)", alignItems: "center" } }, [8, 7, 6, 5, 4, 3, 2, 1].map(function (n) { return h("div", { key: n, style: coord }, n); })),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", aspectRatio: "1 / 1", borderRadius: 4, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.35)" } },
          [0, 1, 2, 3, 4, 5, 6, 7].map(function (r) { return [0, 1, 2, 3, 4, 5, 6, 7].map(function (c) {
            const p = state.board[r][c], dark = (r + c) % 2 === 1;
            const isT = targets.some(function (m) { return m.to[0] === r && m.to[1] === c; });
            const lit = last && (same(last.from, r, c) || same(last.to, r, c));
            const hintOn = hint && (same(hint.from, r, c) || same(hint.to, r, c));
            return h("button", { key: r + "-" + c, "data-wk": "chesssq", onClick: function () { tap(r, c); }, style: { position: "relative", padding: 0, border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                background: (dark ? "#b88762" : "#efdcbc") + (lit ? "" : ""),
                backgroundImage: lit ? "linear-gradient(rgba(214,180,60,.45), rgba(214,180,60,.45))" : same(kingAt, r, c) ? "radial-gradient(circle, rgba(226,72,50,.85) 20%, rgba(226,72,50,0) 72%)" : "none",
                boxShadow: same(sel, r, c) ? "inset 0 0 0 3px #f2c94c" : hintOn ? "inset 0 0 0 3px #5aa0d8" : "none" } },
              p ? pieceEl(p, "calc(34px * var(--app-fs, 1))") : null,
              isT ? h("span", { style: { position: "absolute", width: p ? "88%" : "26%", height: p ? "88%" : "26%", borderRadius: 999, background: p ? "transparent" : "rgba(52,38,24,.32)", border: p ? "3px solid rgba(52,38,24,.38)" : "none" } }) : null);
          }); })),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", marginTop: 3 } }, "abcdefgh".split("").map(function (x) { return h("div", { key: x, style: coord }, x); }))));
    // 吃掉的子：各自那一排，多出来的子力写在后面
    const START_N = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, VALS = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
    const lost = function (side) { const n = {}; state.board.forEach(function (row) { row.forEach(function (p) { if (p && p[0] === side) n[p[1]] = (n[p[1]] || 0) + 1; }); }); const out = []; ["Q", "R", "B", "N", "P"].forEach(function (k) { for (let i = 0; i < Math.max(0, START_N[k] - (n[k] || 0)); i++) out.push(k); }); return out; };
    const mat = function (arr) { return arr.reduce(function (a, k) { return a + VALS[k]; }, 0); };
    const capRow = function (side) {   // side 吃掉的（对面丢的）
      const got = lost(side === "w" ? "b" : "w"), diff = mat(got) - mat(lost(side));
      return h("div", { "data-wk": "chesscaps", style: { display: "flex", alignItems: "center", gap: 1, minHeight: 22, padding: "0 4px", flexWrap: "wrap" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginRight: 6 } }, nameOf(side) + " 吃了"),
        got.length ? got.map(function (k, i) { return h("span", { key: i }, pieceEl((side === "w" ? "b" : "w") + k, 15)); }) : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "—"),
        diff > 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub, marginLeft: 6 } }, "+" + diff) : null);
    };

    const status = over ? (winner === "draw" ? "和棋" + ({ stalemate: "（逼和）", insufficient: "（子力不够）", fifty: "（五十步）", repetition: "（三次重复）" }[st.reason] || "") : nameOf(winner) + "赢了" + (resigned ? "（认输）" : st.reason === "checkmate" ? "（将死）" : ""))
      : state.turn === userSide ? (st.check ? "被将军了，轮到你" : sel ? "点亮着的格子走过去" : "轮到你（白）") : nameOf(state.turn) + "在想…";
    return h(EngineBoardPage, { g: g, v: { board: board, caps: capRow, status: status, talkK: "chess", firstTag: " · 先手",
      mark: function (sd) { return h("span", { style: { fontSize: 15 } }, sd === "w" ? "♔" : "♚"); },
      moves: state.history.slice(-6).map(function (x, i, a) { const n = state.history.length - a.length + i; return (n % 2 === 0 ? (n / 2 + 1) + ". " : "") + x.san; }).join("  ") } });
  }

  // ============================ 中国象棋 ============================
  function XiangqiGame(props) {
    const g = useEngineBoard(props, { C: window.XiangqiCore, key: "xiangqi", zh: "中国象棋", sides: ["r", "b"], sideZh: function (s) { return s === "r" ? "红" : "黑"; }, check: true,
      teachNote: function (s, m) { return window.XiangqiCore.zhPlain(s, m); }, whereNote: function (s, m) { return window.XiangqiCore.zhPlain(s, m); },
      recent: function (s) { return s.history.slice(-8).map(function (x) { return x.zh; }).join(" "); } });
    const C = g.C, t = g.t, state = g.state, st = g.st, sel = g.sel, hint = g.hint, targets = g.targets, tap = g.tap, over = g.over, winner = g.winner, resigned = g.resigned, nameOf = g.nameOf, userSide = g.userSide;

    // 棋盘：九路十行的线，楚河汉界，九宫斜线；子是木头圆片
    const cell = 36, pad = 26, W = pad * 2 + cell * 8, H = pad * 2 + cell * 9;
    const X = function (c) { return pad + c * cell; }, Y = function (r) { return pad + r * cell; };
    const last = state.history.length ? state.history[state.history.length - 1].mv : null;
    let kingAt = null;
    if (st.check) state.board.forEach(function (row, r) { row.forEach(function (p, c) { if (p === state.turn + "K") kingAt = [r, c]; }); });
    const ink = "#7a4a22";
    const lines = [];
    for (let r = 0; r < 10; r++) lines.push(h("line", { key: "h" + r, x1: X(0), y1: Y(r), x2: X(8), y2: Y(r), stroke: ink, strokeWidth: r === 0 || r === 9 ? 1.6 : .9 }));
    for (let c = 0; c < 9; c++) {
      if (c === 0 || c === 8) lines.push(h("line", { key: "v" + c, x1: X(c), y1: Y(0), x2: X(c), y2: Y(9), stroke: ink, strokeWidth: 1.6 }));
      else { lines.push(h("line", { key: "va" + c, x1: X(c), y1: Y(0), x2: X(c), y2: Y(4), stroke: ink, strokeWidth: .9 })); lines.push(h("line", { key: "vb" + c, x1: X(c), y1: Y(5), x2: X(c), y2: Y(9), stroke: ink, strokeWidth: .9 })); }
    }
    [[0, 2], [7, 9]].forEach(function (pr, i) {
      lines.push(h("line", { key: "pa" + i, x1: X(3), y1: Y(pr[0]), x2: X(5), y2: Y(pr[1]), stroke: ink, strokeWidth: .9 }));
      lines.push(h("line", { key: "pb" + i, x1: X(5), y1: Y(pr[0]), x2: X(3), y2: Y(pr[1]), stroke: ink, strokeWidth: .9 }));
    });
    // 炮位、兵卒位的十字花
    const star = function (r, c) { const g = 3, l = 6, out = []; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d, i) {
      if ((c === 0 && d[0] < 0) || (c === 8 && d[0] > 0)) return;
      const x = X(c) + d[0] * g, y = Y(r) + d[1] * g;
      out.push(h("path", { key: "st" + r + c + i, d: "M" + (x + d[0] * l) + " " + y + "H" + x + "V" + (y + d[1] * l), stroke: ink, strokeWidth: .9, fill: "none" })); }); return out; };
    [[2, 1], [2, 7], [7, 1], [7, 7]].concat([0, 2, 4, 6, 8].map(function (c) { return [3, c]; }), [0, 2, 4, 6, 8].map(function (c) { return [6, c]; })).forEach(function (p) { star(p[0], p[1]).forEach(function (e) { lines.push(e); }); });
    lines.push(h("rect", { key: "outer", x: X(0) - 5, y: Y(0) - 5, width: cell * 8 + 10, height: cell * 9 + 10, fill: "none", stroke: ink, strokeWidth: 2.2 }));
    const mark = function (k, r, c, col) { return h("rect", { key: k, x: X(c) - cell / 2 + 2, y: Y(r) - cell / 2 + 2, width: cell - 4, height: cell - 4, rx: 6, fill: "none", stroke: col, strokeWidth: 2, strokeDasharray: "5 3" }); };
    const boardSvg = h("svg", { "data-wk": "xiangqiboard", viewBox: "0 0 " + W + " " + H, style: { width: "100%", maxWidth: 420, display: "block", margin: "0 auto", borderRadius: 12,
        background: "linear-gradient(135deg, #f0d49a 0%, #e3bd78 50%, #ecca8c 100%)", boxShadow: "inset 0 0 0 3px rgba(122,74,34,.3), 0 10px 24px rgba(60,40,15,.28)", touchAction: "manipulation" },
        onClick: function (e) {
          const b = e.currentTarget.getBoundingClientRect(), k = W / b.width;
          const c = Math.round(((e.clientX - b.left) * k - pad) / cell), r = Math.round(((e.clientY - b.top) * k - pad) / cell);
          if (r >= 0 && r < 10 && c >= 0 && c < 9) tap(r, c);
        } },
      h("defs", { key: "defs" }, h("radialGradient", { id: "xqWood", cx: ".38", cy: ".32", r: ".8" }, h("stop", { offset: "0", stopColor: "#fff6df" }), h("stop", { offset: ".6", stopColor: "#f3dcae" }), h("stop", { offset: "1", stopColor: "#dcb57a" }))),
      lines,
      h("text", { key: "river1", x: X(2), y: Y(4.5) + 6, textAnchor: "middle", fontSize: 18, fill: ink, opacity: .7, style: { fontFamily: "'STKaiti','KaiTi','Kaiti SC',serif", letterSpacing: 8 } }, "楚 河"),
      h("text", { key: "river2", x: X(6), y: Y(4.5) + 6, textAnchor: "middle", fontSize: 18, fill: ink, opacity: .7, style: { fontFamily: "'STKaiti','KaiTi','Kaiti SC',serif", letterSpacing: 8 } }, "汉 界"),
      last ? [mark("lf", last.from[0], last.from[1], "#3a86c8"), mark("lt", last.to[0], last.to[1], "#3a86c8")] : null,
      hint ? [mark("hf", hint.from[0], hint.from[1], "#4f8a4a"), mark("ht", hint.to[0], hint.to[1], "#4f8a4a")] : null,
      state.board.map(function (row, r) { return row.map(function (p, c) {
        if (!p) return null;
        const red = p[0] === "r", on = sel && sel[0] === r && sel[1] === c, chk = kingAt && kingAt[0] === r && kingAt[1] === c;
        const col = red ? "#b02a22" : "#26201c", R = cell * 0.44, lift = on ? -3 : 0;
        // 木头圆片：底下一圈厚度、面上木纹渐变、里面一道细圈，字用楷体
        return h("g", { key: "p" + r + "-" + c, transform: "translate(0," + lift + ")" },
          h("circle", { cx: X(c) + 1, cy: Y(r) + 3.2 - lift, r: R, fill: "#3b2a12", opacity: on ? .22 : .32 }),
          h("circle", { cx: X(c), cy: Y(r) + 1.6, r: R, fill: "#b98a52" }),
          h("circle", { cx: X(c), cy: Y(r), r: R, style: { fill: "#f3dcae", stroke: chk ? "#e04a2f" : "rgba(90,60,30,.55)", strokeWidth: chk ? 2.6 : .8 } }),
          h("ellipse", { cx: X(c) - R * 0.25, cy: Y(r) - R * 0.3, rx: R * 0.55, ry: R * 0.38, style: { fill: "#fff8e6", opacity: .55 } }),
          h("circle", { cx: X(c), cy: Y(r), r: R * 0.8, fill: "none", stroke: col, strokeWidth: 1.1, opacity: .85 }),
          h("text", { x: X(c), y: Y(r) + 6.6, textAnchor: "middle", fontSize: 19, fontWeight: 700, fill: col, style: { fontFamily: "'STKaiti','KaiTi','Kaiti SC','BiauKai',serif" } }, C.PIECE_ZH[p]));
      }); }),
      targets.map(function (m, i) { return h("circle", { key: "t" + i, cx: X(m.to[1]), cy: Y(m.to[0]), r: m.capture ? cell * 0.46 : 5, fill: m.capture ? "none" : "#2f6b45", stroke: m.capture ? "#2f6b45" : "none", strokeWidth: 2.5, opacity: .75 }); }));

    const status = over ? (winner === "draw" ? "和棋" : nameOf(winner) + "赢了" + (resigned ? "（认输）" : st.reason === "checkmate" ? "（将死）" : st.reason === "stalemate" ? "（困毙）" : ""))
      : state.turn === userSide ? (st.check ? "被将军了，轮到你" : sel ? "点绿点的位置走过去" : "轮到你（红）") : nameOf(state.turn) + "在想…";
    // 吃掉的子：各自那一排
    const XQ_START = { R: 2, N: 2, C: 2, B: 2, A: 2, P: 5 };
    const xqCaps = function (side) {   // side 吃掉的（对面丢的）
      const o = side === "r" ? "b" : "r", n = {};
      state.board.forEach(function (row) { row.forEach(function (p) { if (p && p[0] === o) n[p[1]] = (n[p[1]] || 0) + 1; }); });
      const got = []; ["R", "N", "C", "B", "A", "P"].forEach(function (k) { for (let i = 0; i < Math.max(0, XQ_START[k] - (n[k] || 0)); i++) got.push(o + k); });
      return h("div", { "data-wk": "xiangqicaps", style: { display: "flex", alignItems: "center", gap: 3, minHeight: 24, padding: "0 4px", flexWrap: "wrap" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginRight: 4 } }, nameOf(side) + " 吃了"),
        got.length ? got.map(function (p, i) { return h("span", { key: i, style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 999, background: "#f3dcae", border: "1.2px solid " + (p[0] === "r" ? "#b02a22" : "#26201c"), color: p[0] === "r" ? "#b02a22" : "#26201c", fontSize: 11, fontWeight: 700, fontFamily: "'STKaiti','KaiTi','Kaiti SC',serif" } }, C.PIECE_ZH[p]); })
          : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "—"));
    };
    const disc = function (sd) { return h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 999, background: "#f7e6c4", border: "1.5px solid " + (sd === "r" ? "#b8322a" : "#2b2622"), color: sd === "r" ? "#b8322a" : "#2b2622", fontSize: 10, fontWeight: 700, fontFamily: "serif" } }, sd === "r" ? "帅" : "将"); };
    return h(EngineBoardPage, { g: g, v: { board: boardSvg, caps: xqCaps, status: status, talkK: "xq", mark: disc,
      moves: state.history.slice(-4).map(function (x) { return x.zh; }).join("　") } });
  }

  // ============================ 斗兽棋 ============================
  // 她 2026-10-27「小游戏能做个斗兽棋吗」：规则和走子都在 js/jungle-core.js，界面照象棋那一页（同一套说话、提示、悔棋、认输）。
  function JungleGame(props) {
    const g = useEngineBoard(props, { C: window.JungleCore, key: "jungle", zh: "斗兽棋", sides: ["r", "b"], sideZh: function (s) { return s === "r" ? "红" : "蓝"; },
      teachNote: function (s, m) { return window.JungleCore.zhPlain(s, m); }, whereNote: function (s, m) { return window.JungleCore.zhPlain(s, m); },
      recent: function (s) { return s.history.slice(-8).map(function (x) { return x.zh; }).join(" "); },
      overNote: function (st) { return st.reason === "den" ? "（进了兽穴）" : st.reason === "wiped" ? "（子被吃光了）" : ""; } });
    const C = g.C, t = g.t, state = g.state, st = g.st, sel = g.sel, hint = g.hint, targets = g.targets, tap = g.tap, over = g.over, winner = g.winner, resigned = g.resigned, nameOf = g.nameOf, userSide = g.userSide;

    // 棋盘：七列九行的格子。河是两块蓝，陷阱画一圈虚线，兽穴是一座小洞口；子是圆片，红方暖红、蓝方靛蓝，右上角小字是大小
    const cell = 46, pad = 10, W = pad * 2 + cell * 7, H = pad * 2 + cell * 9;
    const X = function (c) { return pad + c * cell + cell / 2; }, Y = function (r) { return pad + r * cell + cell / 2; };
    const last = state.history.length ? state.history[state.history.length - 1].mv : null;
    const sideCol = { r: "#b8322a", b: "#2f5f9e" };
    const tiles = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) {
      const wtr = C.isWater(r, c), den = C.denOf(r, c), trap = C.trapOf(r, c);
      tiles.push(h("rect", { key: "t" + r + c, x: pad + c * cell, y: pad + r * cell, width: cell, height: cell, fill: wtr ? "#8fc3dd" : (r + c) % 2 ? "#cfe0a8" : "#c4d99a", stroke: "rgba(63,90,58,.35)", strokeWidth: .8 }));
      if (wtr) tiles.push(h("path", { key: "wv" + r + c, d: "M" + (pad + c * cell + 9) + " " + (Y(r) + 2) + "q7 -6 14 0t14 0", fill: "none", stroke: "#fff", strokeWidth: 1.4, opacity: .6 }));
      if (trap) tiles.push(h("g", { key: "tp" + r + c, opacity: .75 }, h("circle", { cx: X(c), cy: Y(r), r: cell * 0.34, fill: "none", stroke: sideCol[trap], strokeWidth: 1.4, strokeDasharray: "3 3" }), h("text", { x: X(c), y: Y(r) + 4, textAnchor: "middle", fontSize: 11, fill: sideCol[trap], opacity: .8 }, "阱")));
      if (den) tiles.push(h("g", { key: "dn" + r + c }, h("path", { d: "M" + (X(c) - 15) + " " + (Y(r) + 13) + "v-10a15 15 0 0 1 30 0v10z", fill: "#6b4a2b", opacity: .82 }), h("text", { x: X(c), y: Y(r) + 9, textAnchor: "middle", fontSize: 11, fill: "#f3e6c8" }, "穴")));
    }
    const mark = function (k, r, c, col) { return h("rect", { key: k, x: pad + c * cell + 3, y: pad + r * cell + 3, width: cell - 6, height: cell - 6, rx: 7, fill: "none", stroke: col, strokeWidth: 2, strokeDasharray: "5 3" }); };
    const boardSvg = h("svg", { "data-wk": "jungleboard", viewBox: "0 0 " + W + " " + H, style: { width: "100%", maxWidth: 380, display: "block", margin: "0 auto", borderRadius: 12,
        background: "#b9cf8c", boxShadow: "inset 0 0 0 3px rgba(63,90,58,.3), 0 10px 24px rgba(30,50,25,.25)", touchAction: "manipulation" },
        onClick: function (e) {
          const b = e.currentTarget.getBoundingClientRect(), k = W / b.width;
          const c = Math.floor(((e.clientX - b.left) * k - pad) / cell), r = Math.floor(((e.clientY - b.top) * k - pad) / cell);
          if (r >= 0 && r < 9 && c >= 0 && c < 7) tap(r, c);
        } },
      tiles,
      last ? [mark("lf", last.from[0], last.from[1], "#e0a020"), mark("lt", last.to[0], last.to[1], "#e0a020")] : null,
      hint ? [mark("hf", hint.from[0], hint.from[1], "#2f6b45"), mark("ht", hint.to[0], hint.to[1], "#2f6b45")] : null,
      state.board.map(function (row, r) { return row.map(function (p, c) {
        if (!p) return null;
        const col = sideCol[p[0]], on = sel && sel[0] === r && sel[1] === c, R = cell * 0.42, lift = on ? -3 : 0;
        return h("g", { key: "p" + r + "-" + c, transform: "translate(0," + lift + ")" },
          h("circle", { cx: X(c) + 1, cy: Y(r) + 3 - lift, r: R, fill: "#1e2a18", opacity: on ? .2 : .3 }),
          h("circle", { cx: X(c), cy: Y(r), r: R, style: { fill: "#fbf3df", stroke: col, strokeWidth: on ? 3 : 2.2 } }),
          h("text", { x: X(c), y: Y(r) + 7, textAnchor: "middle", fontSize: 20, fontWeight: 700, fill: col, style: { fontFamily: "'STKaiti','KaiTi','Kaiti SC','BiauKai',serif" } }, C.PIECE_ZH[p]),
          h("text", { x: X(c) + R * 0.62, y: Y(r) - R * 0.42, textAnchor: "middle", fontSize: 8.5, fill: col, opacity: .75 }, p[1]));
      }); }),
      targets.map(function (m, i) { return h("circle", { key: "t" + i, cx: X(m.to[1]), cy: Y(m.to[0]), r: m.capture ? cell * 0.46 : 6, fill: m.capture ? "none" : "#2f6b45", stroke: m.capture ? "#2f6b45" : "none", strokeWidth: 2.5, opacity: .78 }); }));

    const status = over ? (winner === "draw" ? "和棋" : nameOf(winner) + "赢了" + (resigned ? "（认输）" : st.reason === "den" ? "（进了兽穴）" : st.reason === "wiped" ? "（子被吃光了）" : st.reason === "stuck" ? "（对面没路可走）" : ""))
      : state.turn === userSide ? (sel ? "点绿点的位置走过去" : "轮到你（红）") : nameOf(state.turn) + "在想…";
    // 吃掉的子：各自那一排
    const jgCaps = function (side) {   // side 吃掉的（对面丢的）
      const o = side === "r" ? "b" : "r", left = {};
      state.board.forEach(function (row) { row.forEach(function (p) { if (p && p[0] === o) left[p] = 1; }); });
      const got = []; for (let i = 8; i >= 1; i--) if (!left[o + i]) got.push(o + i);
      return h("div", { "data-wk": "junglecaps", style: { display: "flex", alignItems: "center", gap: 3, minHeight: 24, padding: "0 4px", flexWrap: "wrap" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginRight: 4 } }, nameOf(side) + " 吃了"),
        got.length ? got.map(function (p, i) { return h("span", { key: i, style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 999, background: "#fbf3df", border: "1.2px solid " + sideCol[p[0]], color: sideCol[p[0]], fontSize: 11, fontWeight: 700, fontFamily: "'STKaiti','KaiTi','Kaiti SC',serif" } }, C.PIECE_ZH[p]); })
          : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "—"));
    };
    const disc = function (sd) { return h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 999, background: "#fbf3df", border: "1.5px solid " + sideCol[sd], color: sideCol[sd], fontSize: 10, fontWeight: 700, fontFamily: "serif" } }, sd === "r" ? "红" : "蓝"); };
    return h(EngineBoardPage, { g: g, v: { board: boardSvg, caps: jgCaps, status: status, talkK: "jg", mark: disc,
      moves: state.history.slice(-4).map(function (x) { return x.zh; }).join("　") } });
  }

  // ============================ 围棋 ============================
  // 她 2026-10-23「围棋是不是也可以做了」：落子由 js/go-core.js 算（随机模拟对局挑子），TA 只说话。
  //   双方连着停一手就进数子：电脑先估死子标出来，她点一块改死／活，确认后按中国规则数（黑贴 7.5）。
  function goReplay(G, size, mvs) {
    let s = G.newGame(size);
    (mvs || []).forEach(function (m) { s = G.move(s, m.pass ? { pass: true } : { p: m.p }); });
    return s;
  }
  function GoGame(props) {
    const G = window.GoCore, KEY = "go", ZH = "围棋";
    const t = props.t, cfg = props.config, sv = props.savedState;
    const spectate = cfg.mode === "spectate", easy = cfg.mode === "easy", size = (sv && sv.size) || cfg.goSize || 9;
    const findC = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }) || null; };
    const char = findC((cfg.charIds || [])[0]), char2 = spectate ? findC((cfg.charIds || [])[1]) : null;
    const pf = props.profile || {}, uName = pf.name || "你";
    const nm = function (c) { return c ? (c.remark || c.name) : "电脑"; };
    // 她执黑先下；观战时 TA 执黑、另一位（或电脑）执白
    const userSide = spectate ? 0 : 1, charSide = spectate ? 1 : 2;
    const nameOf = function (s) { return s === userSide ? uName : s === charSide ? nm(char) : nm(char2); };
    const sideZh = function (s) { return s === 1 ? "黑" : "白"; };
    const tiers = useBoardSkill(props, KEY, ZH, [char, char2].filter(Boolean));
    const sideChar = function (s) { return s === charSide ? char : s !== userSide ? char2 : null; };
    const levelOf = function (s) { const c = sideChar(s); if (!spectate && easy && s === charSide) return "easy"; if (!c) return "normal"; return tiers[c.id] ? BOARD_TIER_LV[tiers[c.id].tier] : null; };
    const styleOf = function (s) { const c = sideChar(s); return c && tiers[c.id] ? tiers[c.id].style || undefined : undefined; };
    const [mvs, setMvs] = useState(sv && sv.mvs ? sv.mvs : []);
    const state = React.useMemo(function () { return goReplay(G, size, mvs); }, [mvs]);
    const [resigned, setResigned] = useState(sv && sv.resigned ? sv.resigned : 0);
    // 数子：两手停之后进来；dead 是她确认过的死子
    const counting = state.passes >= 2 && !resigned;
    const [dead, setDead] = useState(sv && sv.dead ? sv.dead : null);
    const [result, setResult] = useState(sv && sv.result ? sv.result : null);   // { winner, black, white, margin }
    const over = !!resigned || !!result;
    const winner = resigned ? 3 - resigned : result ? result.winner : 0;
    const [pend, setPend] = useState(-1);
    const [hint, setHint] = useState(-1);
    const [hintsUsed, setHintsUsed] = useState(sv && sv.hintsUsed ? sv.hintsUsed : 0);
    const [busy, setBusy] = useState(false);
    const runId = useRef((sv && sv.runId) || ("go-" + Date.now().toString(36)));
    const talkers = [char, char2].filter(Boolean);
    const teach = !!cfg.boardTeach && !spectate, teachRef = useRef(null);
    const teachFacts = function () {
      const bits = [], n0 = teachRef.current;
      if (n0) bits.push(uName + "上一手：" + n0.mine + (n0.better ? "；这手赢面大约 " + Math.round(n0.mineRate * 100) + "%，引擎觉得更好的是 " + n0.better + "（赢面大约 " + Math.round(n0.bestRate * 100) + "%）" : "；跟引擎想的差不多"));
      const mine = G.weakGroups(state, 1), theirs = G.weakGroups(state, 2);
      if (mine.length) bits.push(uName + "气紧的棋：" + mine.map(function (g) { return g.at + " 那块 " + g.stones + " 子剩 " + g.libs + " 口气"; }).join("；"));
      if (theirs.length) bits.push("对面气紧的棋：" + theirs.map(function (g) { return g.at + " 那块 " + g.stones + " 子剩 " + g.libs + " 口气"; }).join("；"));
      bits.push("提子：黑提了 " + state.caps[1] + "，白提了 " + state.caps[2]);
      return bits.join("\n");
    };
    const talk = useBoardTalk({ props: props, saved: sv, talkers: talkers, uName: uName, spectate: spectate, zh: "围棋", teach: teach, teachFacts: teachFacts,
      seatOf: function (c) { return "执" + sideZh(c === char ? charSide : 2) + (easy && c === char ? "，这局让着" + uName : "") + (tiers[c.id] ? "，下棋水平：" + { rookie: "新手", mid: "会下、业余水平", pro: "真下过、算得深" }[tiers[c.id].tier] + (tiers[c.id].style ? "，路子" + BOARD_STYLE_ZH[tiers[c.id].style] : "") : ""); },
      scene: function () { return (spectate ? nm(char) + " 和 " + nm(char2) + " 在下围棋，" + uName + " 在旁边看" : nm(char) + " 在跟 " + uName + " 下围棋（" + uName + "执黑先下）") + "，" + size + " 路棋盘"; },
      where: function () {
        const h0 = state.history, last = h0[h0.length - 1];
        return "第 " + h0.length + " 手。" + (over ? (resigned ? nameOf(winner) + "赢了（对面认输）。" : "数完子，" + nameOf(winner) + "赢了 " + result.margin + " 目。") : counting ? "双方都停了一手，正在数子。"
          : (last ? "上一手：" + nameOf(last.side) + (last.mv.pass ? "停了一手" : "下在 " + G.coord(size, last.mv.p) + (last.took ? "，提了 " + last.took + " 子" : "")) + "。" : "还没开始下。"))
          + "\n提子：黑 " + state.caps[1] + "，白 " + state.caps[2] + "。"
          + "\n【棋盘现在】（● 黑 ○ 白 · 空，列 " + G.COLS.slice(0, size) + "，行 " + size + " 在最上）\n" + Array.from({ length: size }).map(function (_, y) { return String(size - y).padStart(2, " ") + " " + state.board.slice(y * size, y * size + size).map(function (v) { return v === 1 ? "●" : v === 2 ? "○" : "·"; }).join(" "); }).join("\n");
      } });

    useEffect(function () {
      if (over) { clearGameSave("go"); return; }
      if (!mvs.length) return;
      saveGameSnap("go", { runId: runId.current, config: cfg, size: size, mvs: mvs, dead: dead, lines: talk.lines.slice(-30), hintsUsed: hintsUsed, ts: Date.now(), label: size + " 路 · 第 " + mvs.length + " 手" });
    }, [mvs.length, over, talk.lines.length, dead]);

    const play = function (mv) {
      const before = state;
      if (teach && before.turn === userSide && !mv.pass) {
        setTimeout(function () {
          const b = G.bestMove(before, "normal"), mr = G.winRate(before, mv.p, 250), br = b && !b.pass ? G.winRate(before, b.p, 250) : mr;
          teachRef.current = { mine: G.coord(size, mv.p), mineRate: mr, better: b && !b.pass && b.p !== mv.p && br - mr > 0.08 ? G.coord(size, b.p) : "", bestRate: br };
        }, 30);
      }
      setMvs(function (a) { return a.concat([mv.pass ? { pass: true } : { p: mv.p }]); }); setPend(-1); setHint(-1);
    };
    // 不是她下的那一方：停一拍再下，像在想
    useEffect(function () {
      if (over || counting || state.turn === userSide) return;
      const lv = levelOf(state.turn);
      if (!lv) return;
      setBusy(true);
      const tm = setTimeout(function () { const m = G.bestMove(state, lv, styleOf(state.turn)); setBusy(false); play(m && !m.pass ? { p: m.p } : { pass: true }); }, spectate ? 500 : 250);
      return function () { clearTimeout(tm); setBusy(false); };
    }, [mvs.length, over, counting, tiers]);
    // 进数子：先估一遍死子
    useEffect(function () { if (counting && !dead && !result) setTimeout(function () { setDead(G.estimateDead(state, 600)); }, 30); }, [counting]);

    const tap = function (p) {
      if (over) return;
      if (counting) {   // 数子时点一块：改死／活
        if (!dead || !state.board[p]) return;
        const g = G.group(state, p).stones, isDead = dead.indexOf(p) >= 0;
        setDead(isDead ? dead.filter(function (q) { return g.indexOf(q) < 0; }) : dead.concat(g));
        return;
      }
      if (state.turn !== userSide || busy || !G.isLegal(state, p)) return;
      if (pend === p) play({ p: p }); else setPend(p);   // 手指粗：第一下标出来，同一格再点一下才落
    };
    const canHint = !over && !counting && state.turn === userSide && (easy || hintsUsed < BOARD_HINTS);
    const askHint = function () {
      if (!canHint) return;
      setBusy(true);
      setTimeout(function () {
        const m = G.bestMove(state, "hard"); setBusy(false);
        setHintsUsed(hintsUsed + 1);
        if (m && !m.pass) { setHint(m.p); setPend(m.p); if (teach) talk.say(uName + "按了提示，提示是下在 " + G.coord(size, m.p) + "。顺口讲讲这手好在哪。"); }
        else if (teach) talk.say(uName + "按了提示，这会儿引擎觉得可以停一手了。顺口讲讲为什么。");
      }, 30);
    };
    const undo = function () { if (over || counting || spectate || mvs.length < 2 || state.turn !== userSide) return; setMvs(mvs.slice(0, -2)); setPend(-1); setHint(-1); };
    const pass = function () { if (over || counting || spectate || state.turn !== userSide) return; play({ pass: true }); };
    const resign = function () { if (over || spectate) return; requestAppConfirm("认输？", "这一局算 " + nm(char) + " 赢。", function () { setResigned(userSide); }, "认输"); };
    const keepPlaying = function () { setDead(null); setMvs(mvs.slice(0, -2)); };   // 数子前反悔：退回停一手之前接着下
    const confirmCount = function () { const sc = G.score(state, dead || []); setResult({ winner: sc.winner, black: sc.black, white: sc.white, margin: sc.margin }); };

    // 棋盘：木板，有光泽的子，星位，最后一手一个红点；数子时死子半透明打叉，地盘上小方块
    const n = size, cell = n === 19 ? 18 : n === 17 ? 20 : n === 13 ? 24 : 34, pad = cell * 0.9, W = pad * 2 + cell * (n - 1);
    const X = function (p) { return pad + (p % n) * cell; }, Y = function (p) { return pad + ((p / n) | 0) * cell; };
    const stars = n === 9 ? [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] : n === 13 ? [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]] : n === 17 ? [[3, 3], [8, 3], [13, 3], [3, 8], [8, 8], [13, 8], [3, 13], [8, 13], [13, 13]] : [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]];
    const lastMv = state.history.length ? state.history[state.history.length - 1].mv : null;
    const own = counting && dead ? G.score(state, dead).owner : null;
    const R = cell * 0.46;
    const boardSvg = h("svg", { "data-wk": "goboard", viewBox: "0 0 " + W + " " + W, style: { width: "100%", maxWidth: 460, display: "block", margin: "0 auto", borderRadius: 12,
        background: "linear-gradient(135deg, #e9c98c 0%, #dcb26c 50%, #e6c282 100%)", boxShadow: "inset 0 0 0 3px rgba(107,76,36,.3), 0 10px 24px rgba(60,40,15,.3)", touchAction: "manipulation" },
        onClick: function (e) {
          const b = e.currentTarget.getBoundingClientRect(), k = W / b.width;
          const x = Math.round(((e.clientX - b.left) * k - pad) / cell), y = Math.round(((e.clientY - b.top) * k - pad) / cell);
          if (x >= 0 && y >= 0 && x < n && y < n) tap(y * n + x);
        } },
      h("defs", { key: "d" },
        h("radialGradient", { id: "goB", cx: ".35", cy: ".3", r: ".75" }, h("stop", { offset: "0", stopColor: "#6f6a64" }), h("stop", { offset: ".55", stopColor: "#1a1816" })),
        h("radialGradient", { id: "goW", cx: ".35", cy: ".3", r: ".8" }, h("stop", { offset: "0", stopColor: "#ffffff" }), h("stop", { offset: ".7", stopColor: "#e6e0d3" }), h("stop", { offset: "1", stopColor: "#c9c0ae" }))),
      Array.from({ length: n }).map(function (_, i) { return h("g", { key: "l" + i },
        h("line", { x1: pad, y1: pad + i * cell, x2: pad + (n - 1) * cell, y2: pad + i * cell, stroke: "#5e4424", strokeWidth: i === 0 || i === n - 1 ? 1.4 : .7 }),
        h("line", { x1: pad + i * cell, y1: pad, x2: pad + i * cell, y2: pad + (n - 1) * cell, stroke: "#5e4424", strokeWidth: i === 0 || i === n - 1 ? 1.4 : .7 })); }),
      stars.map(function (s0, i) { return h("circle", { key: "s" + i, cx: pad + s0[0] * cell, cy: pad + s0[1] * cell, r: Math.max(2, cell * 0.09), fill: "#5e4424" }); }),
      n <= 17 ? Array.from({ length: n }).map(function (_, i) { return h("text", { key: "cx" + i, x: pad + i * cell, y: pad * 0.45, textAnchor: "middle", fontSize: cell * 0.32, fill: "#5e4424", opacity: .6 }, G.COLS[i]); }) : null,
      own ? own.map(function (o, p) { return o && !state.board[p] || (o && dead && dead.indexOf(p) >= 0) ? h("rect", { key: "o" + p, x: X(p) - cell * 0.15, y: Y(p) - cell * 0.15, width: cell * 0.3, height: cell * 0.3, fill: o === 1 ? "#1a1816" : "#fff", opacity: .7 }) : null; }) : null,
      state.board.map(function (c, p) {
        if (!c) return null;
        const isDead = counting && dead && dead.indexOf(p) >= 0;
        return h("g", { key: "p" + p, opacity: isDead ? .45 : 1 },
          svgStone("s", X(p), Y(p), R, c),
          isDead ? h("path", { d: "M" + (X(p) - R * .5) + " " + (Y(p) - R * .5) + "l" + R + " " + R + "M" + (X(p) + R * .5) + " " + (Y(p) - R * .5) + "l" + (-R) + " " + R, stroke: "#d24b3a", strokeWidth: 2 }) : null);
      }),
      lastMv && !lastMv.pass ? h("circle", { cx: X(lastMv.p), cy: Y(lastMv.p), r: R * 0.32, style: { fill: "#d24b3a" } }) : null,
      hint >= 0 ? h("circle", { cx: X(hint), cy: Y(hint), r: R, style: { fill: "none", stroke: "#3a86c8", strokeWidth: 2.4, strokeDasharray: "4 3" } }) : null,
      pend >= 0 ? svgStone("pend", X(pend), Y(pend), R, userSide, { opacity: .5 }) : null);

    const status = over ? (resigned ? nameOf(winner) + "赢了（认输）" : nameOf(winner) + "赢了 " + result.margin + " 目（黑 " + result.black + " · 白 " + result.white + "）")
      : counting ? (dead ? "数子：点一块子改死／活，好了按「数子」" : "在估死子…")
      : state.turn === userSide ? (busy ? "在想提示…" : pend >= 0 ? "再点一下同一个点落子" : (lastMv && lastMv.pass ? nameOf(3 - userSide) + "停了一手，轮到你" : "轮到你（黑）")) : nameOf(state.turn) + "在想…";
    const btn = function (wk, label, on, dis) { return h("button", { "data-wk": wk, onClick: on, disabled: dis, className: "active:opacity-70", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, opacity: dis ? .45 : 1 } }, label); };
    return h("div", { "data-wk": "go", className: "h-full flex flex-col", style: gameTable("go", t) },
      h(Head, { zh: "围棋", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 16px 24px" } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "go", zh: "围棋" }, mid: state.history.length ? state.history.length + " 手" : size + " 路", seats: [1, 2].map(function (sd) {
          const isMe = sd === userSide, c = sd === charSide ? char : char2;
          return { key: "s" + sd, name: nameOf(sd), char: isMe ? { name: uName, avatarImage: pf.avatarImage, color: pf.color } : c, isUser: isMe, on: !over && !counting && state.turn === sd,
            mark: h(GmkStone, { side: sd, size: 15 }), sub: over ? (winner === sd ? "赢了" : "") : sideZh(sd) + " · 提 " + state.caps[sd], hot: winner === sd };
        }) }),
        h("div", { "data-wk": "gotalk" }, h(GameTalkLog, { t: t, lines: talk.lines, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, busy: talk.talking, names: talkers.length > 1, k: "go",
          charOf: function (l) { return findC(l.id) || char; }, empty: spectate ? "他们在下棋，你可以在下面插一句" : nm(char) + " 在对面坐着" })),
        boardSvg,
        h("div", { style: { display: "flex", gap: 8, marginTop: 12 } },
          h("input", { "data-wk": "gameinput", "data-part": "go", value: talk.heckle, onChange: function (e) { talk.setHeckle(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") talk.send(); },
            placeholder: spectate ? "台下插一句…（空着按就是让他们说）" : "跟 " + nm(char) + " 说一句…（空着按就是让 TA 开口）",
            style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { "data-wk": "gosend", onClick: talk.send, disabled: talk.talking, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: talk.talking ? t.line : t.tint, borderRadius: 11, padding: "0 14px" } }, talk.heckle.trim() ? "说" : "让TA说")),
        h("div", { style: { textAlign: "center", marginTop: 12 } }, h("span", { "data-wk": "gostatus", style: { display: "inline-block", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: over ? "#f3efe6" : t.ink, background: over ? t.ink : t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, status)),
        counting && !over ? h("div", { style: { display: "flex", justifyContent: "center", gap: 8, marginTop: 10 } },
          btn("gocount", "数子", confirmCount, !dead),
          !spectate ? btn("gokeepon", "还没下完，接着下", keepPlaying, false) : null) : null,
        !over && !counting && !spectate ? h("div", { style: { display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          btn("gohint", easy ? "提示" : "提示（还剩 " + Math.max(0, BOARD_HINTS - hintsUsed) + "）", askHint, !canHint || busy),
          btn("gopass", "停一手", pass, state.turn !== userSide || busy),
          btn("goundo", "悔一步", undo, mvs.length < 2 || state.turn !== userSide || busy),
          btn("goresign", "认输", resign, false)) : null,
        over ? h("div", { style: { marginTop: 14 } },
          h("button", { "data-wk": "block", onClick: props.onBack, className: "active:opacity-80", style: { width: "100%", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "回中枢"),
          char ? h(KeepMemBtn, { t: t, host: props, rep: function () {
            const res = resigned ? nameOf(winner) + "赢了（对面认输）" : nameOf(winner) + "赢了 " + result.margin + " 目";
            const seat = function (c) { return { key: c.id, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)) }; };
            const winC = winner === charSide ? char : (winner && winner !== userSide ? char2 : null);
            return { key: "go", zh: "围棋", ids: realCharIds(talkers.map(seat)), wins: winC ? realCharIds([seat(winC)]) : [], meWin: spectate ? null : winner === userSide,
              text: (spectate ? "看 " + nm(char) + " 和 " + nm(char2) + " 下了一盘" + size + "路围棋" : "跟 " + nm(char) + " 下了一盘" + size + "路围棋") + "，" + state.history.length + " 手，" + res + "。" };
          } }) : null) : null));
  }

  // ============================================================
  // 你画我猜（她 2026-10-11）
  // TA 画：一次调用把整幅画写成几段（段数 TA 自己定），每段带一句画的时候顺口的吐槽；
  //   app 一段一段画出来，画完一段就停，等她猜 / 说话 / 空着按一下接着画。
  // 她画：手指画在画布上，按「给 TA 看」把画当图发过去，TA 看图猜（要识图的模型）。
  // 词从词库里抽：她可以写个主题让模型一次生成一批（跟匿名信箱一样），没写就用内置的。
  // 轮流画，三轮一局（TA 先画）。猜没猜中由代码判，不问模型。
  // ============================================================
  // 小游戏里的对话：跟聊天一样，她的在右、TA 的在左，一句一个气泡（她 2026-10-12：「不要全部塞一起」）。
  //   五子棋、你画我猜共用这一个（one-public-mechanism）。
  function GameTalkLog(props) {
    const t = props.t, lines = props.lines || [], pAvatar = avatarFor(t);
    const ref = useRef(null);
    // flow：跟着整页一起滚，不另开一个小框（约会那盒，她 2026-10-14）——新的一条出来就把它带进视线
    const flow = props.maxHeight === "none", endRef = useRef(null);
    useEffect(function () {
      if (flow) { if (endRef.current && lines.length) try { endRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }
      else if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [lines.length, props.busy]);
    const bub = function (mine) { return { maxWidth: mine ? "78%" : "100%", padding: "7px 11px", borderRadius: mine ? "14px 4px 14px 14px" : "4px 14px 14px 14px", background: mine ? t.tint : t.bg2, color: mine ? "#fff" : t.ink, border: mine ? "none" : "1px solid " + t.line, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55, wordBreak: "break-word" }; };
    return h("div", { "data-wk": "gametalk", ref: ref, style: { maxHeight: flow ? "none" : (props.maxHeight || 190), minHeight: flow ? 0 : 64, overflowY: flow ? "visible" : "auto", display: "flex", flexDirection: "column", gap: 8, padding: "4px 2px", marginBottom: 12 } },
      lines.length ? (flow ? lines : lines.slice(-30)).map(function (l, i) {
        if (l.node) return h("div", { key: i, style: { alignSelf: "stretch" } }, l.node);   // 夹在对话里的一张卡（约会每站的小票）
        if (l.sys) return h("div", { key: i, style: { alignSelf: "center", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, l.text);
        if (l.me) return h("div", { key: i, "data-wk": "gametalkrow", "data-me": "1", style: { display: "flex", justifyContent: "flex-end", gap: 7, alignItems: "flex-start" } },
          h("div", { style: bub(true) }, l.text), pAvatar({ isUser: true, name: props.uName, char: props.me }, 28));
        const c = props.charOf(l);
        return h("div", { key: i, "data-wk": "gametalkrow", "data-me": "0", style: { display: "flex", gap: 7, alignItems: "flex-start" } },
          pAvatar(c ? { char: c, name: l.name } : { name: l.name }, 28),
          h("div", { style: { minWidth: 0, maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: "flex-start" } },
            props.names ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, margin: "0 0 2px 2px" } }, l.name) : null,
            h("div", { style: bub(false) }, l.text, c ? h(GameVoiceDot, { p: { char: c }, k: (props.k || "gt") + i + "_" + l.at, text: l.text }) : null)));
      }) : h("div", { style: { alignSelf: "center", margin: "auto 0", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, props.empty || ""),
      props.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, paddingLeft: 36 } }, "…") : null,
      flow ? h("div", { ref: endRef }) : null);
  }

  if (typeof window !== "undefined") window.GameTalkLog = GameTalkLog;   // 约会那盒（date-game.js）也用这一份气泡
  const DRAW_POOL_KEY = "x_drawWords";
  const DRAW_BUILTIN = ["猫", "雨伞", "西瓜", "自行车", "月亮", "眼镜", "蜗牛", "冰淇淋", "灯泡", "钥匙", "蝴蝶", "火锅", "风筝", "仙人掌", "企鹅", "吉他", "雪人", "闹钟", "彩虹", "热气球", "章鱼", "蛋糕", "帐篷", "鲨鱼", "向日葵", "牙刷", "火箭", "长颈鹿", "汉堡", "灯塔"];
  const DRAW_INK = { k: "#2b2723", r: "#d0533f", b: "#3f6fb0", g: "#4f8a4a", y: "#e0a92e", p: "#9a5fb0" };
  const DRAW_ROUNDS = 3;
  function drawPool() { try { const v = loadJSON(DRAW_POOL_KEY, null); return v && Array.isArray(v.words) ? v : { words: [], theme: "" }; } catch (e) { return { words: [], theme: "" }; } }
  function saveDrawPool(v) { try { saveJSON(DRAW_POOL_KEY, v); } catch (e) {} }
  // 模型写的一笔 → 一条 svg path（坐标 0~100）。认不出的形状丢掉，不让一笔坏的毁了整幅
  function drawStrokePath(st) {
    const n = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, v)) : null; };
    if (!st || typeof st !== "object") return "";
    if (st.t === "circle" && Array.isArray(st.c)) {
      const x = n(st.c[0]), y = n(st.c[1]), r = Math.max(0.5, Math.min(50, Number(st.c[2]) || 0));
      if (x == null || y == null) return "";
      return "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0";
    }
    const p = (Array.isArray(st.p) ? st.p : []).map(n);
    if (p.length < 4 || p.some(function (v) { return v == null; })) return "";
    if (st.t === "curve" && p.length >= 6) {
      let d = "M" + p[0] + " " + p[1];
      for (let i = 2; i + 3 < p.length; i += 4) d += "Q" + p[i] + " " + p[i + 1] + " " + p[i + 2] + " " + p[i + 3];
      return d;
    }
    let d = "M" + p[0] + " " + p[1];
    for (let i = 2; i + 1 < p.length; i += 2) d += "L" + p[i] + " " + p[i + 1];
    return st.close ? d + "Z" : d;
  }
  function drawHit(guess, word) { return spyGuessHits(guess, word); }

  function DrawGuessGame(props) {
    const t = props.t, cfg = props.config, api = props.active;
    const findC = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }) || null; };
    const char = findC((cfg.charIds || [])[0]);
    const pf = props.profile || {};
    const uName = pf.name || "你", cName = char ? (char.remark || char.name) : "TA";
    const easy = cfg.mode === "easy", watchOnly = cfg.mode === "spectate";
    // 观战选了两个人：他俩轮流一个画一个猜，她在边上看、也能抢答（她 2026-10-11）
    const char2 = watchOnly ? findC((cfg.charIds || [])[1]) : null;
    const duo = !!(watchOnly && char && char2);
    const nmOf = function (c) { return c ? (c.remark || c.name) : "TA"; };
    // 存档（她 2026-10-22「为啥你画我猜没有存档」）：跟别的游戏同一个口（saveGameSnap / 架上「继续上一局」）
    const sv = (props.savedState && props.savedState.draw) || null;
    const [phase, setPhase] = useState(sv ? "play" : "pool");        // pool → play → end
    const [pool, setPool] = useState(drawPool);
    const [theme, setTheme] = useState(pool.theme || "");
    const [genBusy, setGenBusy] = useState(false);
    const [turn, setTurn] = useState(sv && sv.turn !== undefined ? sv.turn : 0);                // 第几张画：偶数 TA 画，奇数她画（观战只 TA 画）
    const [word, setWord] = useState(sv && sv.word !== undefined ? sv.word : "");
    const [used, setUsed] = useState(sv && sv.used !== undefined ? sv.used : []);
    const [segs, setSegs] = useState(sv && sv.segs !== undefined ? sv.segs : []);               // TA 这张画的几段 [{strokes:[{d,k,f}], say}]
    const [shown, setShown] = useState(sv ? Math.min(Number(sv.shown) || 0, (sv.segs || []).length) : 0);              // 已经画出来几段
    const [drawing, setDrawing] = useState(false);      // 正在一笔一笔画
    const [lines, setLines] = useState(sv && sv.lines !== undefined ? sv.lines : []);             // 对话：{me,name,text}
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(sv && sv.result !== undefined ? sv.result : null);         // 这一张的结局 {ok, by}
    const [score, setScore] = useState(sv && sv.score !== undefined ? sv.score : { me: 0, ta: 0, ta2: 0 });
    const [history, setHistory] = useState(sv && sv.history !== undefined ? sv.history : []);         // [{word, drawer, ok}]
    const [myStrokes, setMyStrokes] = useState(sv && sv.myStrokes !== undefined ? sv.myStrokes : []);     // 她画的 [{k, w, pts:[[x,y]]}]
    const [ink, setInk] = useState("k");
    const [tries, setTries] = useState(sv && sv.tries !== undefined ? sv.tries : 0);
    const curStroke = useRef(null), padRef = useRef(null), logRef = useRef(null);
    const pAvatar = avatarFor(t);
    const taDraws = watchOnly || turn % 2 === 0;
    const totalTurns = (watchOnly && !duo) ? DRAW_ROUNDS : DRAW_ROUNDS * 2;
    // 这一张谁画、谁猜（duo：偶数张第一个人画，奇数张第二个人画）
    const drawer = duo ? (turn % 2 === 0 ? char : char2) : char;
    const guesser = duo ? (turn % 2 === 0 ? char2 : char) : null;

    // 打到哪儿就存到哪儿；打完清掉
    useEffect(function () {
      if (phase === "end") { clearGameSave("draw"); return; }
      if (phase !== "play") return;
      saveGameSnap("draw", { config: cfg, ts: Date.now(), label: "第 " + (turn + 1) + " / " + totalTurns + " 张 · " + (score.me + score.ta + (score.ta2 || 0)) + " 张猜中",
        draw: { turn: turn, word: word, used: used, segs: segs, shown: shown, lines: lines.slice(-60), result: result, score: score, history: history, myStrokes: myStrokes, tries: tries } });
    }, [phase, turn, word, segs, shown, lines, result, score, history, myStrokes, tries]);
    const persona = function (who) {
      who = who || char;
      const recent = (cfg.injectChat && props.recentChatFor && who) ? String(props.recentChatFor(who.id) || "").slice(-400) : "";
      // 人设整张读（她 2026-10-22「你画我猜说话不像角色」）：原来只读 persona 一格，写在性格／一句话介绍／背景里的都没进来
      const sheet = who ? String(who.persona || "") : "";   // 入局时已经填成整张（gameSheet）
      return "你是「" + (who ? who.name : "TA") + "」。\n【你的人设】\n" + String(sheet || "（没写）").slice(0, 2400) + (recent ? "\n【你们最近在聊的】\n" + recent : "")
        + "\n画画、猜词都是手上的事；嘴上那句（say）才是你这个人在说话——用你人设里的口气、跟对面这个人的关系说，别说成游戏解说。";
    };
    // 给猜的人「看」画：不发图，把已经画出来的几笔念给 TA（不用识图模型；读坐标会像真人一样猜歪）
    const describeSegs = function (list, n) {
      const r1 = function (v) { return Math.round(Number(v)); };
      return list.slice(0, n).map(function (sg, si) {
        return "第" + (si + 1) + "段：" + sg.strokes.map(function (st) {
          const raw = st.raw || {};
          const col = st.k && st.k !== "k" ? "（" + ({ r: "红", b: "蓝", g: "绿", y: "黄", p: "紫" })[st.k] + "）" : "";
          if (raw.t === "circle") return "圆，圆心(" + r1(raw.c[0]) + "," + r1(raw.c[1]) + ")半径" + r1(raw.c[2]) + (st.f ? "涂满" : "") + col;
          const pts = []; for (let i = 0; i + 1 < (raw.p || []).length; i += 2) pts.push("(" + r1(raw.p[i]) + "," + r1(raw.p[i + 1]) + ")");
          return (raw.t === "curve" ? "弧线" : "线") + pts.join("→") + (raw.close ? "闭合" : "") + (st.f ? "涂满" : "") + col;
        }).join("；");
      }).join("\n");
    };
    const said = function () {
      const L = lines.slice(-8);
      return L.length ? "\n【刚才已经说过的】\n" + L.map(function (l) { return "· " + l.name + "：" + l.text; }).join("\n") + "\n这些说过了：同一个意思别换个说法再说一遍。" : "";
    };
    const push = function (l) { setLines(function (L) { return L.concat([Object.assign({ at: Date.now() }, l)]); }); };

    // 词库：写个主题一次生成一批
    const genWords = async function () {
      if (!api || genBusy) return;
      setGenBusy(true);
      try {
        const sys = "给「你画我猜」出一批题目词。" + (theme.trim() ? "主题：" + theme.trim().slice(0, 60) + "。" : "主题不限，日常常见的东西、动物、食物、动作都行。")
          + "每个词两三个字到五六个字，能画出来、大多数人认得；难易混着来。不要和下面这些重复：" + pool.words.slice(-60).join("、")
          + "\n只输出 JSON：{\"words\":[\"词\"]}，二十个左右。";
        const raw = await callRetry(api, sys, [{ role: "user", content: "出一批。" }], { maxTokens: 8000, tag: "你画我猜·出词" });
        const got = ((extractJSON(raw) || {}).words || []).map(function (w) { return String(w || "").trim().slice(0, 12); }).filter(Boolean);
        if (!got.length) throw new Error("没生成出来");
        const n = { words: Array.from(new Set(pool.words.concat(got))).slice(-300), theme: theme.trim() };
        setPool(n); saveDrawPool(n);
        if (props.toast) props.toast("加了 " + got.length + " 个词");
      } catch (e) { if (props.toast) props.toast("生成失败：" + ((e && e.message) || e)); }
      setGenBusy(false);
    };
    const pickWord = function (usedNow) {
      const src = pool.words.length ? pool.words : DRAW_BUILTIN;
      const left = src.filter(function (w) { return usedNow.indexOf(w) < 0; });
      const from = left.length ? left : src;
      return from[Math.floor(Math.random() * from.length)];
    };

    // 「一段一段想」（她 2026-10-12）：每段单独问一次，TA 看得到已经画了什么、她猜过说过什么，下一笔跟着变
    const stepMode = cfg.drawBrain === "step";
    const STEP_MAX = 6;
    const [stepDone, setStepDone] = useState(false);
    const parseStrokes = function (arr) {
      return (Array.isArray(arr) ? arr : []).slice(0, 40).map(function (st) {
        const d = drawStrokePath(st); return d ? { d: d, k: DRAW_INK[st.k] ? st.k : "k", f: !!st.f, raw: st } : null;
      }).filter(Boolean);
    };
    const STROKE_FMT = "\n一笔的格式：{\"t\":\"line\",\"p\":[x1,y1,x2,y2,...]} 折线；{\"t\":\"curve\",\"p\":[起点x,y,控制点x,y,终点x,y,控制点x,y,终点x,y...]} 弧线；{\"t\":\"circle\",\"c\":[x,y,r]} 圆；可加 \"k\" 颜色（k 黑 r 红 b 蓝 g 绿 y 黄 p 紫）、\"f\":true 填色、\"close\":true 闭合。";
    const stepSeg = async function (w, who, have) {
      who = who || drawer;
      const other = duo ? (who === char ? char2 : char) : null;
      setBusy(true);
      try {
        const sys = gameVoiceRules() + "\n" + persona(who)
          + "\n\n" + (other ? "你在跟 " + other.name + " 玩你画我猜（" + uName + " 在边上看）" : "你在跟 " + uName + " 玩你画我猜") + "，这一张你画，题目是「" + w + "」（" + (other ? other.name : uName) + " 不知道）。"
          + "画在 100×100 的画布上（左上角 0,0），一段一段画，现在画第 " + (have.length + 1) + " 段（最多 " + STEP_MAX + " 段）。"
          + (have.length ? "\n【你已经画了的】\n" + describeSegs(have, have.length) : "\n画布还是空的。")
          + said()
          + "\n看对方刚才猜了什么、说了什么来决定这一段：快猜到了可以收着点，猜偏了可以补一笔提示、也可以故意往歪了带，被说丑了可以赌气——照你这个人。"
          + (easy ? "这局你让着 TA，画得好认一点。" : "照你人设里的画画水平来，不会画的就画得歪；会画的也可以随手或存心画丑一点逗对方。但得是真想让人猜到的画，不是乱涂。")
          + "画里不许写字、不许写这个词的任何一个字。say 是你画这段时顺口说的一句，别透露答案。觉得画完了就把 done 设成 true。"
          + STROKE_FMT
          + "\n只输出 JSON：{\"strokes\":[...],\"say\":\"一句\",\"done\":false}";
        const raw = await callRetry(api, sys, [{ role: "user", content: "画下一段。" }], { maxTokens: 9000, tag: "你画我猜·画" });
        const p = extractJSON(raw) || {};
        const strokes = parseStrokes(p.strokes);
        if (!strokes.length) throw new Error("这一段没画出来");
        const list = have.concat([{ strokes: strokes, say: String(p.say || "").trim().slice(0, 120) }]);
        const done = !!p.done || list.length >= STEP_MAX;
        setSegs(list); setStepDone(done);
        showSeg(list, list.length - 1, who);
      } catch (e) { push({ sys: true, text: "这一段没画出来（" + ((e && e.message) || e) + "）" + (have.length ? "，再按一次试试" : "，点「换一张」再来") }); }
      setBusy(false);
    };
    // 还有没有下一段：一口气模式看放完没；一段一段模式看 TA 说没说画完
    const hasMore = function () { return stepMode ? (!stepDone && segs.length < STEP_MAX) : shown < segs.length; };
    const nextSeg = function () { if (stepMode) stepSeg(word, drawer, segs); else showSeg(segs, shown); };

    // TA 画：一次调用拿到整幅画（段数 TA 自己定）
    const taStart = async function (w, who) {
      who = who || char;
      if (stepMode) { setSegs([]); setShown(0); setStepDone(false); return stepSeg(w, who, []); }
      const other = duo ? (who === char ? char2 : char) : null;
      setSegs([]); setShown(0); setBusy(true);
      try {
        const sys = gameVoiceRules() + "\n" + persona(who)
          + "\n\n" + (other ? "你在跟 " + other.name + " 玩你画我猜（" + uName + " 在边上看）" : "你在跟 " + uName + " 玩你画我猜") + "，这一张轮到你画，题目是「" + w + "」（" + (other ? other.name : uName) + " 不知道）。"
          + "画在 100×100 的画布上（左上角 0,0）。把这幅画分成几段画，分几段你自己定（2 到 5 段）：一段是几笔、画完停一下让 TA 猜。"
          + (easy ? "这局你让着 TA，画得好认一点。" : "照你人设里的画画水平来：本来就不会画的，线条歪、比例怪、该圆的画成方的都正常；会画的也可以哪一笔随手、哪一段画得潦草，或者存心画丑一点逗对方——看你这个人、看你此刻的心思。但得是真想让人猜到的画，不是乱涂。")
          + "画里不许写字、不许写这个词的任何一个字。每段带一句你画这段时顺口说的话（say），照你自己的性子，别透露答案。"
          + "\n一笔的格式：{\"t\":\"line\",\"p\":[x1,y1,x2,y2,...]} 折线；{\"t\":\"curve\",\"p\":[起点x,y,控制点x,y,终点x,y,控制点x,y,终点x,y...]} 弧线；{\"t\":\"circle\",\"c\":[x,y,r]} 圆；可加 \"k\" 颜色（k 黑 r 红 b 蓝 g 绿 y 黄 p 紫）、\"f\":true 填色、\"close\":true 闭合。"
          + "\n只输出 JSON：{\"segments\":[{\"strokes\":[...],\"say\":\"一句\"}]}";
        const raw = await callRetry(api, sys, [{ role: "user", content: "开始画。" }], { maxTokens: 12000, tag: "你画我猜·画" });
        const p = extractJSON(raw) || {};
        const out = (Array.isArray(p.segments) ? p.segments : []).slice(0, 5).map(function (s) {
          const strokes = (Array.isArray(s && s.strokes) ? s.strokes : []).slice(0, 40).map(function (st) {
            const d = drawStrokePath(st); return d ? { d: d, k: DRAW_INK[st.k] ? st.k : "k", f: !!st.f, raw: st } : null;
          }).filter(Boolean);
          return { strokes: strokes, say: String((s && s.say) || "").trim().slice(0, 120) };
        }).filter(function (s) { return s.strokes.length; });
        if (!out.length) throw new Error("没画出来");
        setSegs(out);
        showSeg(out, 0, who);
      } catch (e) { push({ sys: true, text: "这张没画出来（" + ((e && e.message) || e) + "），点「换一张」再来" }); }
      setBusy(false);
    };
    // 放出第 i 段：一笔一笔画，画完说那一句
    const showSeg = function (list, i, who) {
      if (!list[i]) return;
      who = who || drawer;
      setDrawing(true); setShown(i + 1);
      const ms = list[i].strokes.length * 380 + 300;
      setTimeout(function () { setDrawing(false); if (list[i].say) push({ id: who && who.id, name: nmOf(who), text: list[i].say }); }, ms);
    };

    const startTurn = function (n, usedNow) {
      const w = pickWord(usedNow);
      const u = usedNow.concat([w]);
      setUsed(u); setWord(w); setResult(null); setTries(0); setMyStrokes([]); setLines([]); setInput("");
      if (duo) taStart(w, n % 2 === 0 ? char : char2);
      else if (watchOnly || n % 2 === 0) taStart(w); else { setSegs([]); setShown(0); }
    };
    const begin = function () { setPhase("play"); setTurn(0); startTurn(0, []); };
    // 接着上一局：存的那一刻 TA 这张还一笔没画出来（正在想），回来时这一张重新开（换个词）
    useEffect(function () {
      if (sv && !sv.result && !(sv.segs || []).length && (duo || watchOnly || (Number(sv.turn) || 0) % 2 === 0)) startTurn(Number(sv.turn) || 0, (sv.used || []).slice(0, -1));
    }, []);
    const finishTurn = function (ok, by) {
      setResult({ ok: ok, by: by });
      if (ok) setScore(function (s) { const n = Object.assign({}, s); n[by] = (n[by] || 0) + 1; return n; });
      setHistory(function (H) { return H.concat([{ word: word, drawer: taDraws ? nmOf(drawer) : uName, ok: ok, by: by === "me" ? uName : by === "ta2" ? nmOf(char2) : by === "ta" ? cName : "" }]); });
    };
    const nextTurn = function () {
      const n = turn + 1;
      if (n >= totalTurns) { setPhase("end"); return; }
      setTurn(n); startTurn(n, used);
    };

    // TA 画的时候她说话 / 猜 / 空着按＝接着画
    // duo：猜的人看一眼画到哪儿了，猜一个、说一句（不告诉 TA 答案；她插的话也递过去）
    const guesserLook = async function (herLine) {
      setBusy(true);
      let hit = false;
      try {
        const sys = gameVoiceRules() + "\n" + persona(guesser)
          + "\n\n你在跟 " + drawer.name + " 玩你画我猜，" + uName + " 在边上看。这一张 " + drawer.name + " 画、你猜，你不知道答案。"
          + "画布 100×100，左上角是 0,0。到现在画出来的是：\n" + describeSegs(segs, shown)
          + said() + (herLine ? "\n" + uName + " 刚在边上说：「" + herLine.slice(0, 120) + "」。" : "")
          + "\n照你自己的眼力和性子猜一个词（guess），再说话（say，" + GAME_SAY_FREE + "）。看不出来也得猜。\n只输出 JSON：{\"guess\":\"一个词\",\"say\":[\"一句\"]}";
        const raw = await callRetry(api, sys, [{ role: "user", content: "猜。" }], { maxTokens: 8000, tag: "你画我猜·猜" });
        const r = extractJSON(raw) || {};
        const g = String(r.guess || "").trim().slice(0, 20), s2 = sayList(r.say);
        if (g) push({ id: guesser.id, name: nmOf(guesser), text: "是「" + g + "」吗？" });
        s2.forEach(function (v) { push({ id: guesser.id, name: nmOf(guesser), text: v.slice(0, 200) }); });
        if (g && drawHit(g, word)) { hit = true; finishTurn(true, guesser === char ? "ta" : "ta2"); }
      } catch (e) {}
      setBusy(false);
      return hit;
    };
    const sendWhileTaDraws = async function () {
      const v = input.trim(); setInput("");
      if (duo) {
        if (v) { push({ me: true, name: uName, text: v }); if (drawHit(v, word)) { finishTurn(true, "me"); return; } }
        const hit = await guesserLook(v);
        if (hit || v) return;
        if (hasMore()) nextSeg();
        else finishTurn(false, "");
        return;
      }
      if (!v) {
        if (hasMore()) { nextSeg(); return; }
        // 画完了还空着按＝认输，揭晓
        push({ me: true, name: uName, text: "猜不出来，你说吧" });
        finishTurn(false, "");
        return;
      }
      push({ me: true, name: uName, text: v });
      if (drawHit(v, word)) { finishTurn(true, "me"); }
      setBusy(true);
      try {
        const sys = gameVoiceRules() + "\n" + persona()
          + "\n\n你在跟 " + uName + " 玩你画我猜，你在画「" + word + "」，已经画了 " + shown + "/" + segs.length + " 段。"
          + (drawHit(v, word) ? uName + " 刚猜中了。" : "答案别说出来，也别说得太明显。")
          + said() + "\n\n" + uName + " 刚说：「" + v.slice(0, 120) + "」。接一句。\n只输出 JSON：{\"say\":\"一句\"}";
        const raw = await callRetry(api, sys, [{ role: "user", content: "接话。" }], { maxTokens: 8000, tag: "你画我猜" });
        const s = String((extractJSON(raw) || {}).say || "").trim();
        if (s) push({ id: char && char.id, name: cName, text: s.slice(0, 200) });
      } catch (e) {}
      setBusy(false);
    };

    // 她画：手指画
    const ptOf = function (e) { const r = padRef.current.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000) / 10, Math.round((e.clientY - r.top) / r.height * 1000) / 10]; };
    const onDown = function (e) { if (result || busy) return; e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} const cur = { k: ink, pts: [ptOf(e)] }; curStroke.current = cur; setMyStrokes(function (S) { return S.concat([{ k: cur.k, pts: cur.pts.slice() }]); }); };
    // ⚠️先把这一笔抓在手里再交给 setState：更新函数是稍后才跑的，那时手指可能已经抬起、curStroke 清空了，
    //   拿 null 拷出一笔没有 pts 的，画布一 map 就整页崩（她 2026-10-12 截图：pts.map）
    const onMove = function (e) { const cur = curStroke.current; if (!cur) return; cur.pts.push(ptOf(e)); const snap = { k: cur.k, pts: cur.pts.slice() }; setMyStrokes(function (S) { return S.slice(0, -1).concat([snap]); }); };
    const onUp = function () { curStroke.current = null; };
    const ptsPath = function (pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1]; }).join(""); };
    const toPng = function () {
      const cv = document.createElement("canvas"); cv.width = 512; cv.height = 512;
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 512, 512); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 7;
      myStrokes.filter(function (s) { return s && Array.isArray(s.pts) && s.pts.length; }).forEach(function (s) { g.strokeStyle = DRAW_INK[s.k] || "#000"; g.beginPath(); s.pts.forEach(function (p, i) { const x = p[0] * 5.12, y = p[1] * 5.12; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); if (s.pts.length === 1) g.lineTo(s.pts[0][0] * 5.12 + .1, s.pts[0][1] * 5.12); g.stroke(); });
      return cv.toDataURL("image/png");
    };
    const showToTa = async function () {
      if (busy || !myStrokes.length) return;
      const v = input.trim(); setInput("");
      if (v) push({ me: true, name: uName, text: v });
      setBusy(true);
      try {
        const sys = gameVoiceRules() + "\n" + persona()
          + "\n\n你在跟 " + uName + " 玩你画我猜，这一张是 " + uName + " 画、你猜。图是 TA 现在画到的样子（可能还没画完）。"
          + (easy ? "这局你让着 TA，猜不中就夸夸画。" : "")
          + (tries ? "你已经猜过 " + tries + " 次了，都不对，换个方向。" : "")
          + said() + (v ? "\nTA 刚说：「" + v.slice(0, 120) + "」。" : "")
          + "\n看图猜一个词（guess），再说一句话（say），照你自己的性子。看不出来也得猜一个。\n只输出 JSON：{\"guess\":\"一个词\",\"say\":\"一句\"}";
        const raw = await callRetry(api, sys, [{ role: "user", content: "看图猜。", imageDataUrls: [toPng()] }], { maxTokens: 8000, tag: "你画我猜·猜" });
        const r = extractJSON(raw) || {};
        const g = String(r.guess || "").trim().slice(0, 20), s = String(r.say || "").trim().slice(0, 200);
        push({ id: char && char.id, name: cName, text: (g ? "是「" + g + "」吗？" : "") + (s ? " " + s : "") });
        setTries(function (x) { return x + 1; });
        if (g && drawHit(g, word)) finishTurn(true, "ta");
      } catch (e) { if (props.toast) props.toast("TA 没看成：" + ((e && e.message) || e) + "。看图要用识图的模型"); }
      setBusy(false);
    };

    // ---- 画面 ----
    const head = h(Head, { zh: "你画我猜", onBack: props.onBack, bg: "transparent" });
    const btn = function (label, on, opt) { return h("button", Object.assign({ onClick: on, className: "active:opacity-80", style: { minHeight: 40, padding: "0 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line } }, opt || {}), label); };
    if (phase === "pool") {
      return h("div", { "data-wk": "draw", className: "h-full flex flex-col", style: gameTable("draw", t) }, head,
        h("div", { "data-wk": "drawpool", className: "flex-1 overflow-y-auto", style: { padding: "8px 16px 24px" } },
          // 封面：盒面那张画 + 这一局谁跟谁
          h("div", { "data-wk": "drawcover", style: { borderRadius: 16, overflow: "hidden", background: LID.draw.paper, boxShadow: "0 3px 0 " + LID.draw.band + ", 0 10px 22px rgba(40,30,20,.18)", marginBottom: 16 } },
            h("div", { style: { maxWidth: 260, margin: "0 auto" } }, h(GameLid, { k: "draw" })),
            h("div", { style: { background: LID.draw.band, color: LID.draw.bandInk, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } }, duo ? cName + " × " + nmOf(char2) : watchOnly ? "看 " + cName + " 画" : uName + " × " + cName),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .75 } }, (duo || watchOnly ? "" : "轮流画 · ") + DRAW_ROUNDS + " 轮"))),
          h("div", { "data-wk": "block", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "12px 13px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginBottom: 6 } }, "词库 · " + (pool.words.length ? pool.words.length + " 个" : "还空着，先用内置的 " + DRAW_BUILTIN.length + " 个")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, marginBottom: 10 } }, "写个主题（可空），一次生成一批，加进词库。每张画从词库里抽一个没用过的。"),
          h("div", { style: { display: "flex", gap: 8 } },
            h("input", { "data-wk": "gameinput", "data-part": "drawtheme", value: theme, onChange: function (e) { setTheme(e.target.value); }, placeholder: "主题，比如：厨房里的东西", style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
            h("button", { "data-wk": "drawpoolgen", onClick: genWords, disabled: genBusy, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: genBusy ? t.line : t.tint, borderRadius: 11, padding: "0 14px" } }, genBusy ? "生成中…" : "生成一批")),
          pool.words.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
            pool.words.map(function (w) { return h("button", { key: w, onClick: function () { const n = { words: pool.words.filter(function (x) { return x !== w; }), theme: pool.theme }; setPool(n); saveDrawPool(n); }, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 8, padding: "4px 9px" } }, w + " ×"); })) : null,
          pool.words.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 10 } }, "点一个词就把它从词库删掉。") : null),
          h("button", { "data-wk": "drawbegin", onClick: begin, className: "active:opacity-80", style: { width: "100%", marginTop: 18, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "13px" } }, duo ? "开始（看 " + cName + " 和 " + nmOf(char2) + " 轮流画，" + DRAW_ROUNDS + " 轮）" : watchOnly ? "开始（看 " + cName + " 画 " + DRAW_ROUNDS + " 张）" : "开始（轮流画，" + DRAW_ROUNDS + " 轮）")));
    }
    if (phase === "end") {
      const engOf = function (c) { return !!(c && cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)); };
      const eng = engOf(char);
      return h("div", { "data-wk": "draw", className: "h-full flex flex-col", style: gameTable("draw", t) }, head,
        h("div", { className: "flex-1 overflow-y-auto", style: { padding: "8px 16px 24px" } },
          h(GameVsBar, { t: t, evalOf: { host: props, key: "draw", zh: "你画我猜" }, mid: "终局", seats: duo
            ? [{ key: "a", name: cName, char: char, sub: "猜中 " + score.ta, hot: score.ta > score.ta2, on: score.ta > score.ta2 }, { key: "b", name: nmOf(char2), char: char2, sub: "猜中 " + score.ta2, hot: score.ta2 > score.ta, on: score.ta2 > score.ta }]
            : watchOnly ? [{ key: "a", name: uName, char: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, sub: "猜中 " + score.me + " / " + history.length }]
            : [{ key: "u", name: uName, char: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, sub: "猜中 " + score.me, hot: score.me > score.ta, on: score.me > score.ta },
               { key: "a", name: cName, char: char, sub: "猜中 " + score.ta, hot: score.ta > score.me, on: score.ta > score.me }] }),
          h("div", { "data-wk": "drawhistory", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "4px 13px" } },
            history.map(function (x, i) { return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, padding: "9px 0", borderTop: i ? "1px solid " + t.line : "none" } },
              h("span", { style: { width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "calc(12px * var(--app-fs, 1))", color: "#fff", background: x.ok ? "#5d8b4c" : "#b9ab98" } }, x.ok ? "✓" : "×"),
              h("span", { style: { flex: 1, minWidth: 0 } }, x.drawer + " 画「", h("b", { style: { color: t.ink } }, x.word), "」"),
              h("span", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, x.ok ? (x.by ? x.by + " " : "") + "猜中" : "没猜中")); })),
          btn("回中枢", props.onBack, { style: { width: "100%", marginTop: 14, minHeight: 44, borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line } }),
          char ? h(KeepMemBtn, { t: t, host: props, rep: function () {
            const seats = [char, char2].filter(Boolean).map(function (c) { return { proc: history.concat(lines), key: c.id, engineer: engOf(c) }; });
            const top = duo ? (score.ta > score.ta2 ? [char.id] : score.ta2 > score.ta ? [char2.id] : []) : (score.ta > score.me && !eng ? [char.id] : []);
            return { key: "draw", zh: "你画我猜", ids: realCharIds(seats), wins: top.filter(function (id) { return !engOf(findC(id)); }), meWin: watchOnly ? null : score.me > score.ta,
              text: (duo ? "看 " + cName + " 和 " + nmOf(char2) + " 玩了你画我猜：" : "跟 " + cName + " 玩了你画我猜：") + "" + history.map(function (x) { return x.drawer + "画「" + x.word + "」" + (x.ok ? "猜中了" : "没猜中"); }).join("，") + "。" };
          } }) : null));
    }

    // 画纸：一张有点米色的速写纸，淡淡的点格，下沿压一道影子——像从本子上撕下来铺在桌上
    const DRAW_PAPER = { width: "100%", maxWidth: 420, display: "block", margin: "0 auto", borderRadius: 6, background: "#fffdf7",
      backgroundImage: "radial-gradient(circle, rgba(60,50,40,.10) .8px, transparent 1px)", backgroundSize: "18px 18px",
      boxShadow: "0 1px 0 #e9e2d4, 0 3px 0 #f4efe5, 0 4px 0 #e2dacb, 0 10px 22px rgba(40,30,20,.20)" };
    const tape = h("div", { "aria-hidden": true, style: { position: "absolute", top: -9, left: "50%", width: 74, height: 20, marginLeft: -37, transform: "rotate(-2.5deg)", background: "rgba(208,83,63,.28)", borderRadius: 2, zIndex: 1 } });
    const svgCanvas = taDraws
      ? h("svg", { "data-wk": "drawcanvas", viewBox: "0 0 100 100", style: DRAW_PAPER },
          h("style", null, "@keyframes drawIn{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"),
          segs.slice(0, shown).map(function (sg, si) {
            const fresh = si === shown - 1 && drawing;
            return h("g", { key: si }, sg.strokes.map(function (st, i) {
              return h("path", { key: i, d: st.d, pathLength: 1, fill: st.f ? DRAW_INK[st.k] : "none", fillOpacity: st.f ? .85 : 0, stroke: DRAW_INK[st.k], strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round",
                style: fresh ? { strokeDasharray: 1, strokeDashoffset: 1, animation: "drawIn .34s ease forwards", animationDelay: (i * 0.38) + "s" } : null });
            }));
          }),
          result || (!shown && !busy) ? null : null)
      : h("svg", { "data-wk": "drawcanvas", ref: padRef, viewBox: "0 0 100 100", onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
          style: Object.assign({}, DRAW_PAPER, { touchAction: "none" }) },
          myStrokes.filter(function (s) { return s && Array.isArray(s.pts) && s.pts.length; }).map(function (s, i) { return h("path", { key: i, d: ptsPath(s.pts) + (s.pts.length === 1 ? "l.1 0" : ""), fill: "none", stroke: DRAW_INK[s.k], strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }); }));

    const status = result
      ? (result.ok ? (result.by === "me" ? "你猜中了：「" + word + "」" : cName + " 猜中了：「" + word + "」") : "答案是「" + word + "」")
      : taDraws
        ? (busy && !segs.length ? nmOf(drawer) + " 在构思…" : busy && duo ? nmOf(guesser) + " 在看…" : busy && stepMode ? nmOf(drawer) + " 在想下一笔…" : drawing ? nmOf(drawer) + " 在画第 " + shown + " 段" : duo ? "画完第 " + shown + (stepMode ? "" : "/" + segs.length) + " 段 · 按「" + (hasMore() ? "接着看" : "最后一猜") + "」让 " + nmOf(guesser) + " 猜，你也能抢答" : hasMore() ? "画完第 " + shown + (stepMode ? "" : "/" + segs.length) + " 段 · 猜一个，或空着按「接着画」" : (segs.length ? "画完了 · 猜不出就空着按「揭晓」" : ""))
        : "你画「" + word + "」，画好按「给 TA 看」";
    const sendLabel = taDraws ? (input.trim() ? "说" : duo ? (hasMore() ? "接着看" : "最后一猜") : (hasMore() ? "接着画" : "揭晓")) : "给 TA 看";

    return h("div", { "data-wk": "draw", className: "h-full flex flex-col", style: gameTable("draw", t) }, head,
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 16px 24px" } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "draw", zh: "你画我猜" }, mid: (turn + 1) + "/" + totalTurns, seats: duo
          ? [char, char2].map(function (c, i) { const on = drawer === c; return { key: c.id, name: nmOf(c), char: c, on: !result && on, sub: (on ? "画" : "猜") + " · 猜中 " + (i ? score.ta2 : score.ta) }; })
          : watchOnly ? [{ key: "ta", name: cName, char: char, on: !result, sub: "画 · 你猜中 " + score.me }]
          : [{ key: "user", name: uName, char: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, isUser: true, on: !result && !taDraws, sub: (taDraws ? "猜" : "画") + " · 猜中 " + score.me },
             { key: "ta", name: cName, char: char, on: !result && taDraws, sub: (taDraws ? "画" : "猜") + " · 猜中 " + score.ta }] }),
        h("div", { "data-wk": "drawtalk" }, h(GameTalkLog, { t: t, lines: lines, uName: uName, me: { name: uName, avatarImage: pf.avatarImage, color: pf.color }, busy: busy, names: duo, k: "drw",
          charOf: function (l) { return findC(l.id) || char; }, empty: taDraws ? nmOf(drawer) + " 拿起了笔" : cName + " 在等你画" })),
        h("div", { style: { position: "relative", maxWidth: 420, margin: "14px auto 0" } }, tape,
          !taDraws && !result ? h("div", { "data-wk": "drawword", style: { position: "absolute", right: 8, top: 8, zIndex: 1, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink, background: "rgba(255,253,247,.92)", border: "1px dashed " + t.line, borderRadius: 8, padding: "3px 9px" } }, "你画：「" + word + "」") : null,
          svgCanvas),
        !taDraws && !result ? h("div", { "data-wk": "drawtools", style: { display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 10, flexWrap: "wrap" } },
          Object.keys(DRAW_INK).map(function (k) { return h("button", { key: k, "data-on": ink === k ? "1" : "0", onClick: function () { setInk(k); }, style: { width: 28, height: 28, borderRadius: 999, background: DRAW_INK[k], border: ink === k ? "3px solid " + t.tint : "2px solid #fff", boxShadow: "0 0 0 1px " + t.line } }); }),
          btn("撤销", function () { setMyStrokes(function (S) { return S.slice(0, -1); }); }),
          btn("清空", function () { setMyStrokes([]); })) : null,
        h("div", { "data-wk": "drawstatus", style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, marginTop: 10 } }, status),
        result ? h("div", { style: { display: "flex", justifyContent: "center", marginTop: 12 } },
            h("button", { "data-wk": "drawnext", onClick: nextTurn, className: "active:opacity-80", style: { minHeight: 44, padding: "0 24px", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: 700, color: "#f3efe6", background: t.ink } }, turn + 1 >= totalTurns ? "看结果" : "下一张"))
          : h("div", { "data-wk": "drawchat", style: { display: "flex", gap: 8, marginTop: 12 } },
            h("input", { "data-wk": "gameinput", "data-part": "draw", value: input, onChange: function (e) { setInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") (taDraws ? sendWhileTaDraws : showToTa)(); },
              placeholder: taDraws ? (duo ? "抢答，或者在边上说一句…" : "猜一个，或者跟 " + cName + " 说一句…") : "顺便说一句（可空）",
              style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "9px 13px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
            h("button", { "data-wk": "drawsend", onClick: taDraws ? sendWhileTaDraws : showToTa, disabled: busy || drawing || (taDraws && !segs.length) || (!taDraws && !myStrokes.length), className: "active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", fontWeight: 700, color: t.bg2, background: (busy || drawing) ? t.line : t.tint, borderRadius: 11, padding: "0 14px", whiteSpace: "nowrap" } }, sendLabel)),
        !result && !busy && ((taDraws && !segs.length && lines.some(function (l) { return l.sys; })) || (!taDraws && tries >= 3))
          ? h("div", { style: { display: "flex", justifyContent: "center", marginTop: 10 } },
              taDraws ? btn("换一张", function () { setLines([]); taStart(word, drawer); }) : btn("算了，揭晓", function () { finishTurn(false, ""); }))
          : null));
  }

  function UnoGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () {
      if (restored && restored.status === "playing") {
        restored.players.forEach(function (p) { const live = unoPlayers(props).find(function (x) { return x.key === p.key; }); if (live) Object.assign(p, live); });
        return restored;
      }
      return UnoCore.newGame(unoPlayers(props), undefined, { stackD2: cfg.unoRule === "stack" });
    });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [colorPick, setColorPick] = useState(null), [saidUno, setSaidUno] = useState(false);
    const [tableTalk, setTableTalk] = useState(""), [chatMode, setChatMode] = useState(false), [chatBusy, setChatBusy] = useState(false);
    const [resultNotice, setResultNotice] = useState("");
    const chatSeq = useRef(0);
    const running = useRef("");
    const current = state.players[state.turn], me = current && current.isUser;
    const top = state.discard[state.discard.length - 1];
    const clone = function () { return JSON.parse(JSON.stringify(state)); };
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("uno"); return; }
      saveGameSnap("uno", { config: cfg, state: state, label: "轮到 " + (current ? current.name : "—") + " · 顶牌 " + UnoCore.describe(top) });
    }, [state]);
    useEffect(function () {
      if (state.status !== "finished") return;
      const winnerP = state.players.find(function (p) { return p.key === state.winner; });
      const userSeat = state.players.find(function (p) { return p.isUser; });
      const finalLines = state.log.slice(-10).map(function (x) { return x.text; }).join("\n");
      ccGameResult("uno", state.id, state.players, cfg,
        "《UNO》" + ((winnerP && winnerP.name) || "未知玩家") + " 获胜。\n"
        + ((userSeat && userSeat.name) || "用户") + "：" + (userSeat && userSeat.key === state.winner ? "获胜" : "未获胜") + "。\n"
        + "最终余牌：" + state.players.map(function (p) { return p.name + "=" + p.hand.length + " 张"; }).join("；") + "。\n"
        + "最后几手：\n" + finalLines,
        function (say, seat) { setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); n.log.push({ kind: "chat", player: seat.key, text: seat.name + "：“" + say + "”" }); return n; }); },
        setResultNotice);
    }, [state.status, state.winner]);
    useEffect(function () {
      if (!current || current.isUser || state.status !== "playing" || busy || chatMode) return;
      const turnId = state.id + "#" + state.round + "#" + current.key + "#" + current.hand.length + "#" + (state.drawnUid || "-");
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      if (cardLocal(cfg) && !current.engineer) { setTimeout(function () { try { const n = clone(); UnoCore.act(n, unoLocalMove(state)); setState(n); } catch (e) { setError(e.message); } running.current = ""; setBusy(false); }, 650); return; }
      const pendingStacks = state.pendingDraw > 0 ? UnoCore.legalCodes(state) : [];
      if (state.pendingDraw > 0 && !pendingStacks.length) {
        // 顶上是带记档的 +4 → 这一家可以质疑：接受还是赌一把由本人（模型 / CC）决定
        if (state.w4 && top && top.value === "W4") {
          const sysC = "你正在玩 UNO，被上一家的 +4 罚牌。规则：你可以质疑这张 +4——若 TA 出牌时手里其实还有当前颜色的牌（诈打），改由 TA 罚摸 4 张、你不用摸、原地轮你出牌；若 TA 打得合规，你罚摸 6 张。你看不到 TA 的手牌，凭桌面和你的性格赌。" + SKILL_RULE +
            "\n只输出 JSON：接受 {\"kind\":\"draw\",\"say\":\"可空\"}；质疑 {\"kind\":\"challenge\",\"say\":\"可空\"}。";
          routeSeatCall(current, api, sysC, [{ role: "user", content: unoPublic(state) + "\n你被 +4 了，接受还是质疑？" }], { turnId: turnId + "#w4", expect: '{"kind":"draw|challenge","say":"..."}', timeout: 150000, ai: { maxTokens: 8400 } })
            .then(function (r) {
              const a = unoJson(r.value), n = clone();
              UnoCore.act(n, { kind: a.kind === "challenge" ? "challenge" : "draw", say: a.say, delegated: r.delegated });
              setState(n);
            }).catch(function (e) { setError("这手没接稳：" + e.message); })
            .finally(function () { running.current = ""; setBusy(false); });
          return;
        }
        setTimeout(function () { try { const n = clone(); UnoCore.act(n, { kind: "draw" }); setState(n); } catch (e) { setError(e.message); } setBusy(false); }, 450); return;
      }
      const drawn = state.drawnUid;
      const legal = drawn ? current.hand.filter(function (c) { return c.uid === drawn && UnoCore.playable(c, state, current.hand); }).map(function (c) { return c.code; }) : UnoCore.legalCodes(state);
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在亲自玩 UNO，不是评论牌局。保持你本人的声纹和性格，但首先遵守牌规。" +
        "\n你的私人手牌：" + current.hand.map(function (c) { return c.code + "=" + UnoCore.describe(c); }).join("，") +
        "\n可出的 code：" + (legal.join("、") || "无") + (state.pendingDraw && state.rules && state.rules.stackD2 ? "。本局是 +2 叠加规则；你可以出任意颜色 +2 把累计罚牌转给下一家，也可以选择 draw 接受全部罚牌。" : "") + (drawn ? "。你刚摸过牌，只能出刚摸的那张，否则 pass。" : "") +
        "\n只输出 JSON，不解释：出牌 {\"kind\":\"play\",\"code\":\"R5\",\"color\":\"R\",\"uno\":true,\"say\":\"可空的一句桌上话\"}；无牌可出 {\"kind\":\"draw\",\"say\":\"\"}；摸后不出 {\"kind\":\"pass\",\"say\":\"\"}。万能牌 color 必须 R/Y/G/B。W4 官方该在没有当前颜色时才打——你也可以冒险诈打，但被下家质疑抓到要替 TA 罚 4，按你的性格权衡。手里出完后剩 1 张必须 uno=true。桌上话可以接上一手、得意、吐槽、求饶或挑衅；不必每手都说，别写裁判报告。";
      const msgs = [{ role: "user", content: unoPublic(state) + "\n现在轮到你。" }];
      routeSeatCall(current, api, sys, msgs, { turnId: turnId, expect: "{\"kind\":\"play|draw|pass\",\"code\":\"R5\",\"color\":\"R\",\"uno\":true,\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8500 } })
        .then(function (r) {
          const a = unoJson(r.value), n = clone(); let action;
          if (a.kind === "play" && legal.indexOf(String(a.code || "")) >= 0) action = { kind: "play", code: String(a.code), color: String(a.color || "R"), uno: !!a.uno, say: a.say, delegated: r.delegated };
          else if (state.drawnUid) action = { kind: "pass", say: a.say, delegated: r.delegated };
          else action = { kind: "draw", say: a.say, delegated: r.delegated };
          UnoCore.act(n, action); if (r.delegated && n.log.length) n.log[n.log.length - 1].text += "（代）"; setState(n);
        }).catch(function (e) { setError("这手没接稳：" + e.message); })
        .finally(function () { running.current = ""; setBusy(false); });
    }, [state, busy, chatMode]);
    function userAct(action) {
      try {
        const n = clone(), line = tableTalk.trim();
        UnoCore.act(n, line ? Object.assign({}, action, { say: line }) : action);
        setState(n); setTableTalk(""); setColorPick(null); setError("");
        // 喊牌是【每一手】的事：出完这手就复位，下次剩两张还得亲口再喊——忘了照罚
        if (action.kind === "play") setSaidUno(false);
      } catch (e) { setError(e.message); }
    }
    function addChat(player, name, line) {
      const clean = String(line || "").trim(); if (!clean) return;
      setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); n.log.push({ kind: "chat", player: player, text: name + "：“" + clean.slice(0, 500) + "”" }); return n; });
    }
    function sendTableMessage() { const line = tableTalk.trim(); if (!line) return; addChat("user", userName(props.profile), line); setTableTalk(""); }
    function inviteTableReplies() {
      if (chatBusy) return;
      const seats = state.players.filter(function (p) { return !p.isUser; }); if (!seats.length) return;
      setChatBusy(true); setError(""); const seq = ++chatSeq.current;
      const context = state.log.slice(-14).map(function (x) { return x.text; }).join("\n");
      Promise.all(seats.map(function (p) {
        const sys = gameVoiceRules() + seatIdentity(p) + "UNO 牌局现在暂停聊天。保持你本人的声纹、关系和性格。只回应桌上刚才的话，不继续出牌，不替别人发言；说 1~3 句自然口语。只输出 JSON：{\"say\":\"...\"}。";
        return routeSeatCall(p, api, sys, [{ role: "user", content: "桌上最近发生：\n" + context + "\n\n现在轮到你接话。" }], { turnId: state.id + "#chat#" + seq + "#" + p.key, expect: "{\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8350 } })
          .then(function (r) { return { p: p, say: String(unoJson(r.value).say || "").trim(), delegated: r.delegated }; })
          .catch(function (e) { return { p: p, say: "", error: e.message }; });
      })).then(function (rows) {
        setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); rows.forEach(function (row) { if (row.say) n.log.push({ kind: "chat", player: row.p.key, text: row.p.name + "：“" + row.say.slice(0, 500) + "”" + (row.delegated ? "（代）" : "") }); }); return n; });
        const failed = rows.filter(function (x) { return x.error; }).length; if (failed) setError(failed + " 位牌友这轮没接稳，可以再请一次。");
      }).finally(function () { setChatBusy(false); });
    }
    function clickCard(c) {
      if (!me || !UnoCore.playable(c, state, current.hand) || (state.drawnUid && c.uid !== state.drawnUid)) return;
      if (c.color === "W") return setColorPick(c);
      userAct({ kind: "play", uid: c.uid, uno: saidUno });
    }
    const col = { R: "#d9584b", Y: "#e0b735", G: "#459464", B: "#4382bf", W: "#252525" };
    function cardFace(c) { return c.value === "D2" ? ["+2", "摸二"] : c.value === "W4" ? ["+4", "万能"] : c.value === "W" ? ["四色", "变色"] : c.value === "V" ? ["↻", "反转"] : c.value === "S" ? ["⊘", "跳过"] : [c.value, ""]; }
    const talking = useCardTableTalk(props, state, setState, { on: cardLocal(cfg), zh: "UNO", ready: !!me || state.status === "finished", every: state.players.length * 2, view: function () { return unoPublic(state); } });
    function cardView(c, hand) {
      const ok = hand && me && UnoCore.playable(c, state, current.hand) && (!state.drawnUid || c.uid === state.drawnUid), face = cardFace(c), wild = c.color === "W";
      return h("button", { "data-wk": "gameunocard", "data-on": hand ? "1" : "0", key: c.uid, onClick: function () { clickCard(c); }, disabled: hand && !ok, style: { animation: "gcardIn .3s ease-out both", width: hand ? 62 : 82, height: hand ? 92 : 116, flex: "0 0 auto", borderRadius: 14, border: "3px solid #f6f1e7", boxShadow: "0 3px 10px rgba(0,0,0,.18)", background: wild ? "conic-gradient(#d9584b 0 25%,#e0b735 0 50%,#459464 0 75%,#4382bf 0)" : col[c.color], color: "white", opacity: hand && !ok ? .42 : 1, padding: 5 } },
        h("span", { style: { width: "100%", height: "100%", borderRadius: "50%", background: "rgba(255,255,255,.94)", color: wild ? "#252525" : col[c.color], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-11deg)", fontFamily: F_DISPLAY } },
          h("b", { style: { fontSize: face[0].length > 2 ? 16 : 25, lineHeight: 1 } }, face[0]), face[1] ? h("small", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", marginTop: 5 } }, face[1]) : null));
    }
    return h("div", { "data-wk": "gameplay", "data-part": "uno", className: "h-full flex flex-col", style: gameTable("uno", t) },
      h(Head, { zh: "UNO", en: current ? ("轮到 " + current.name) : "", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3" },
        h(CardSeats, { t: t, evalOf: { host: props, key: "uno", zh: "UNO" }, log: state.log, seats: state.players.map(function (p, i) {
          return { key: p.key, name: p.name, cards: p.hand.length, char: cardSeatChar(props, p), isUser: p.isUser, on: i === state.turn && state.status === "playing", hot: state.winner === p.key, sub: p.hand.length + " 张" + (p.engineer ? " · CC亲打" : "") };
        }) }),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 0" } }, cardView(top, false), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.8, whiteSpace: "pre-line" } }, "规则：" + (state.rules && state.rules.stackD2 ? "+2 可叠加" : "官方不叠加") + "\n当前：" + UnoCore.LABEL[state.color] + "\n" + (state.direction > 0 ? "顺时针" : "逆时针") + (state.pendingDraw ? "\n累计待摸 " + state.pendingDraw + " 张" : ""))),
        h(CardLog, { t: t, part: "uno", log: state.log, talking: talking }),
        state.status === "playing" && !chatMode ? h("div", { style: { textAlign: "right", marginTop: 8 } }, h("button", { onClick: function () { setChatMode(true); }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "7px 13px", background: t.bg2, color: t.sub, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, busy ? "这手落定后暂停聊聊" : "暂停聊聊")) : null,
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          (state.players.find(function (p) { return p.key === state.winner; }) || {}).name + " 赢啦！",
          resultNotice ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontWeight: 400, color: t.sub } }, resultNotice) : null,
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const w = state.players.find(function (p) { return p.key === state.winner; });
            const meSeat = state.players.find(function (p) { return p.isUser; });
            return { key: "uno", zh: "UNO", ids: realCharIds(state.players), wins: w && !w.isUser && realCharIds(state.players).indexOf(w.key) >= 0 ? [w.key] : [], meWin: meSeat ? !!(w && w.isUser) : null,
              text: "一起打了一局「UNO」，" + ((w && (w.isUser ? "她" : w.name)) || "有人") + " 赢了。" };
          } })) : null),
      state.status === "playing" && chatMode ? h("div", { "data-wk": "gameactions", "data-part": "uno", "data-kind": "chat", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", background: t.bg } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginBottom: 8 } }, "牌局已暂停。你可以连发几条；只有按黑色键，他们才接话。"),
        h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end" } },
          h("textarea", { "data-wk": "gameinput", "data-part": "chat", value: tableTalk, onChange: function (e) { setTableTalk(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTableMessage(); } }, placeholder: "在牌桌上说话……", rows: 2, style: { flex: 1, resize: "none", border: "1px solid " + t.line, borderRadius: 15, padding: "10px 12px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
          h("button", { onClick: sendTableMessage, disabled: !tableTalk.trim(), style: { width: 44, height: 44, borderRadius: 999, border: 0, background: tableTalk.trim() ? t.tint : t.line, color: "white", fontSize: "calc(19px * var(--app-fs, 1))" } }, "↑")),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 } },
          h("button", { onClick: inviteTableReplies, disabled: chatBusy, style: { border: 0, borderRadius: 999, padding: "11px 10px", color: "white", background: "#171715", fontFamily: F_BODY } }, chatBusy ? "他们正在接话…" : "请他们接话"),
          h("button", { onClick: function () { setChatMode(false); setError(""); }, disabled: chatBusy, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "11px 10px", color: t.ink, background: t.bg2, fontFamily: F_BODY } }, "继续打牌"))) :
      state.status === "playing" && me ? h("div", { "data-wk": "gameactions", "data-part": "uno", "data-kind": "hand", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { "data-wk": "gamehand", style: { display: "flex", overflowX: "auto", gap: 5, paddingBottom: 8 } }, current.hand.map(function (c) { return cardView(c, true); })),
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: tableTalk, onChange: function (e) { setTableTalk(e.target.value); }, placeholder: "这手牌顺便说一句（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", marginBottom: 8, background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9 } },
          h("button", { onClick: function () { userAct({ kind: state.pendingDraw ? "draw" : (state.drawnUid ? "pass" : "draw") }); }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "9px 16px", color: t.ink, background: t.bg2 } }, state.pendingDraw ? ("接受 +" + state.pendingDraw) : state.drawnUid ? "不出" : "摸一张"),
          (state.pendingDraw && state.w4 && top && top.value === "W4") ? h("button", { onClick: function () { userAct({ kind: "challenge" }); }, style: { borderRadius: 999, padding: "9px 16px", color: "#fff", background: "#c0553f", border: "1px solid #c0553f" } }, "质疑这张 +4") : null,
          h("button", { onClick: function () { setSaidUno(!saidUno); }, style: { borderRadius: 999, padding: "9px 16px", color: saidUno ? "white" : t.sub, background: saidUno ? t.tint : t.bg2, border: "1px solid " + (saidUno ? t.tint : t.line) } }, saidUno ? "UNO ✓" : "不喊 UNO"))) : busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, current && current.engineer ? "等本人看牌…（票失败只按牌规行动，不代说话）" : "TA 在看牌…") : null,
      colorPick ? h(PickerModal, { t: t, title: "万能牌改成什么颜色？", onClose: function () { setColorPick(null); } }, h("div", { style: { display: "flex", gap: 9, justifyContent: "center" } }, UnoCore.COLORS.map(function (c) { return h("button", { key: c, onClick: function () { userAct({ kind: "play", uid: colorPick.uid, color: c, uno: saidUno }); }, style: { width: 54, height: 54, borderRadius: 999, background: col[c], color: "white" } }, UnoCore.LABEL[c]); }))) : null);
  }

  // ============================================================
  // 骗子骰（她 2026-10-12：「先 1、2 吧」——回合制小游戏加骗子骰和故事接龙）
  // 每人五颗骰子扣在杯里，轮流往上叫「桌上一共至少有 N 个 F」，觉得上家在吹就「开」。
  // 1 点是万能的（算作任何点数），所以只能叫 2~6。开了以后亮骰：够数＝开的人输一命，不够＝叫的人输一命。
  // 每人三条命，命没了出局，剩最后一个的赢。输的人先叫下一轮。
  // 配角（NPC）不调模型，照下面 liarNpcMove 算一手；真人角色每手问一次模型，叫得不合规就退回同一个算法。
  // ============================================================
  const LIAR_DICE = 5, LIAR_LIVES = 3;
  function liarRoll(rnd) { const r = rnd || Math.random, out = []; for (let i = 0; i < LIAR_DICE; i++) out.push(1 + Math.floor(r() * 6)); return out; }
  function liarAlive(state) { return state.players.filter(function (p) { return p.lives > 0; }); }
  function liarTotal(state) { return liarAlive(state).length * LIAR_DICE; }
  // 某个点数在一堆骰子里算几个（1 点万能）
  function liarCount(dice, f) { return (dice || []).filter(function (d) { return d === f || d === 1; }).length; }
  // 这一手叫价合不合规：点数 2~6、个数不超过桌上总数；比上家大＝个数更多，或个数一样点数更大
  function liarLegalBid(prev, bid, total) {
    const n = Number(bid && bid.n), f = Number(bid && bid.f);
    if (!(n >= 1 && n <= total && f >= 2 && f <= 6 && n === Math.floor(n) && f === Math.floor(f))) return false;
    if (!prev) return true;
    return n > prev.n || (n === prev.n && f > prev.f);
  }
  function liarNextAlive(state, from) {
    const L = state.players.length;
    for (let i = 1; i <= L; i++) { const j = (from + i) % L; if (state.players[j].lives > 0) return j; }
    return from;
  }
  function liarNewRound(state, starter, rnd) {
    state.round = (state.round || 0) + 1;
    state.players.forEach(function (p) { p.dice = p.lives > 0 ? liarRoll(rnd) : []; });
    state.bid = null; state.reveal = null;
    state.turn = state.players[starter] && state.players[starter].lives > 0 ? starter : liarNextAlive(state, starter);
    state.log.push({ kind: "sys", text: "—— 第 " + state.round + " 轮，大家摇好了骰子 ——" });
    return state;
  }
  function liarNewGame(players, rnd) {
    const state = { id: "liar_" + Date.now().toString(36), status: "playing", round: 0, log: [], bid: null, reveal: null, winner: null,
      players: players.map(function (p) { return Object.assign({}, p, { lives: LIAR_LIVES, dice: [] }); }) };
    return liarNewRound(state, Math.floor((rnd || Math.random)() * players.length), rnd);
  }
  // 一手：{kind:"bid",n,f,say} 或 {kind:"open",say}。不合规直接抛错，调用方自己兜。
  function liarAct(state, action) {
    const p = state.players[state.turn], say = String((action && action.say) || "").trim().slice(0, 200);
    if (!p || state.status !== "playing" || state.reveal) throw new Error("现在不是出手的时候");
    if (action.kind === "open") {
      if (!state.bid) throw new Error("还没人叫，开不了");
      const bid = state.bid, all = [];
      liarAlive(state).forEach(function (x) { all.push.apply(all, x.dice); });
      const got = liarCount(all, bid.f), bidder = state.players.findIndex(function (x) { return x.key === bid.by; });
      const loserIdx = got >= bid.n ? state.turn : bidder;
      const loser = state.players[loserIdx];
      loser.lives -= 1;
      state.log.push({ kind: "move", player: p.key, text: p.name + "：开！" + (say ? "“" + say + "”" : "") });
      state.log.push({ kind: "sys", text: "亮骰：桌上一共 " + got + " 个 " + bid.f + "（连 1 点算）——" + (got >= bid.n ? "够数，" : "不够，") + loser.name + " 输一条命" + (loser.lives <= 0 ? "，出局。" : "，还剩 " + loser.lives + " 条。") });
      state.reveal = { bid: bid, got: got, loser: loser.key, dice: state.players.map(function (x) { return { key: x.key, dice: x.dice.slice() }; }) };
      const alive = liarAlive(state);
      if (alive.length <= 1) { state.status = "finished"; state.winner = alive[0] ? alive[0].key : null; state.log.push({ kind: "sys", text: (alive[0] ? alive[0].name : "没人") + " 撑到了最后。" }); }
      else state.nextStarter = loser.lives > 0 ? loserIdx : liarNextAlive(state, loserIdx);
      return state;
    }
    const bid = { n: Number(action.n), f: Number(action.f), by: p.key };
    if (!liarLegalBid(state.bid, bid, liarTotal(state))) throw new Error(state.bid ? "得比上家叫得大：个数更多，或者个数一样、点数更大" : "叫价不对：点数 2~6，个数不超过桌上总数");
    state.bid = bid;
    state.log.push({ kind: "move", player: p.key, text: p.name + "：" + bid.n + " 个 " + bid.f + (say ? "　“" + say + "”" : "") });
    state.turn = liarNextAlive(state, state.turn);
    return state;
  }
  // 不调模型的一手：按自己手里有几个、别人手里大概有几个（每颗 1/3 的机会是这个点或者 1）来算
  function liarNpcMove(state, idx, bluff) {
    const me = state.players[idx], others = liarTotal(state) - LIAR_DICE, prev = state.bid;
    const expect = function (f) { return liarCount(me.dice, f) + others / 3; };
    if (prev && prev.n > expect(prev.f) + 0.8 + (bluff || 0)) return { kind: "open" };
    let best = null;
    for (let f = 2; f <= 6; f++) {
      let n = prev ? (f > prev.f ? prev.n : prev.n + 1) : Math.max(1, Math.round(expect(f)) - 1);
      if (!liarLegalBid(prev, { n: n, f: f }, liarTotal(state))) continue;
      const margin = expect(f) - n;
      if (!best || margin > best.margin) best = { n: n, f: f, margin: margin };
    }
    if (!best) return prev ? { kind: "open" } : { kind: "bid", n: 1, f: 2 };
    if (prev && best.margin < -1.2 - (bluff || 0)) return { kind: "open" };
    return { kind: "bid", n: best.n, f: best.f };
  }
  function liarPublic(state, idx) {
    const me = state.players[idx];
    return "桌上还在的人：" + liarAlive(state).map(function (p) { return p.name + "（" + p.lives + " 条命）"; }).join("、")
      + "；桌上一共 " + liarTotal(state) + " 颗骰子。\n你自己的骰子：" + me.dice.join(" ") + "（1 点万能）"
      + "\n当前叫价：" + (state.bid ? state.bid.n + " 个 " + state.bid.f + "（" + (state.players.find(function (p) { return p.key === state.bid.by; }) || {}).name + " 叫的）" : "还没人叫，你先叫")
      + "\n最近：\n" + state.log.slice(-8).map(function (x) { return x.text; }).join("\n");
  }
  const DIE_PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  function Die(props) {
    const v = props.v, size = props.size || 30, hot = props.hot;
    return h("svg", { "data-wk": "gameliardie", "data-on": hot ? "1" : "0", viewBox: "0 0 100 100", width: size, height: size, style: { flexShrink: 0 } },
      h("rect", { x: 4, y: 4, width: 92, height: 92, rx: 20, fill: hot ? "#f6e3c4" : "#fbf8f1", stroke: hot ? "#b0553f" : "#2f2a24", strokeOpacity: hot ? 1 : .35, strokeWidth: hot ? 6 : 4 }),
      v ? (DIE_PIPS[v] || []).map(function (q, i) { return h("circle", { key: i, cx: q[0], cy: q[1], r: v === 1 ? 13 : 9, fill: v === 1 ? "#b0553f" : "#2f2a24" }); })
        : h("text", { x: 50, y: 64, textAnchor: "middle", fontSize: 44, fill: "#2f2a24", opacity: .4 }, "?"));
  }
  function LiarDiceGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () {
      if (restored && restored.status === "playing") {
        restored.players.forEach(function (p) { const live = unoPlayers(props).find(function (x) { return x.key === p.key; }); if (live) Object.assign(p, live, { lives: p.lives, dice: p.dice }); });
        return restored;
      }
      return liarNewGame(unoPlayers(props));
    });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [say, setSay] = useState(""), [resultNotice, setResultNotice] = useState("");
    const [pick, setPick] = useState({ n: 1, f: 2 });
    const running = useRef("");
    const current = state.players[state.turn], me = current && current.isUser && current.lives > 0;
    const clone = function () { return JSON.parse(JSON.stringify(state)); };
    const spectate = cfg.mode === "spectate";
    const soft = cfg.mode === "easy";
    const findChar = function (key) { return (props.characters || []).find(function (c) { return String(c.id) === String(key); }) || null; };
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("liar"); return; }
      saveGameSnap("liar", { config: cfg, state: state, label: "第 " + state.round + " 轮 · " + (state.bid ? "叫到 " + state.bid.n + " 个 " + state.bid.f : "还没人叫") });
    }, [state]);
    // 轮到自己时，把选择器摆到「刚好比上家大一点」那一格
    useEffect(function () {
      if (!me || state.reveal) return;
      const b = state.bid;
      setPick(b ? (b.f < 6 ? { n: b.n, f: b.f + 1 } : { n: b.n + 1, f: 2 }) : { n: Math.max(1, liarAlive(state).length), f: 2 });
    }, [state.turn, state.round, !!state.reveal]);
    useEffect(function () {
      if (state.status !== "finished") return;
      const w = state.players.find(function (p) { return p.key === state.winner; }), u = state.players.find(function (p) { return p.isUser; });
      ccGameResult("liar", state.id, state.players, cfg,
        "《骗子骰》" + ((w && w.name) || "没人") + " 撑到了最后。\n" + ((u && u.name) || "用户") + "：" + (u && w && u.key === w.key ? "获胜" : "未获胜") + "。\n最后几手：\n" + state.log.slice(-8).map(function (x) { return x.text; }).join("\n"),
        function (line, seat) { setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); n.log.push({ kind: "chat", player: seat.key, text: seat.name + "：“" + line + "”" }); return n; }); },
        setResultNotice);
    }, [state.status, state.winner]);
    useEffect(function () {
      if (!current || current.isUser || current.lives <= 0 || state.status !== "playing" || state.reveal || busy) return;
      const turnId = state.id + "#" + state.round + "#" + current.key + "#" + (state.bid ? state.bid.n + "x" + state.bid.f : "-");
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const idx = state.turn;
      // 放水局：真人角色叫得更保守、开得更冲动——给她留机会
      const fallback = function () { return liarNpcMove(state, idx, soft ? -0.6 : 0); };
      const apply = function (a, delegated) {
        const n = clone();
        try { liarAct(n, a); } catch (e) { const fb = fallback(); fb.say = a && a.say; liarAct(n, fb); }
        if (delegated && n.log.length) n.log[n.log.length - 1].text += "（代）";
        setState(n);
      };
      if (current.isNpc) {
        setTimeout(function () { try { apply(fallback()); } catch (e) { setError(e.message); } running.current = ""; setBusy(false); }, 700);
        return;
      }
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在亲自玩「骗子骰」（吹牛骰子），不是在评论。保持你本人的声纹和性格，但先守规则。" +
        "\n规则：每人五颗骰子只自己看得见。轮流叫「桌上所有人的骰子里一共至少有 N 个 F 点」，1 点万能、算作任何点数，所以只能叫 2~6 点。后叫的必须比上家大：个数更多，或个数一样、点数更大。觉得上家在吹就「开」：亮出全部骰子数，够数＝开的人输一条命，不够＝叫的人输一条命。"
        + (soft ? "\n这一局你想让着对面的她一点：别叫得太凶，有点疑心就开。" : "")
        + "\n只输出 JSON，不解释：叫 {\"kind\":\"bid\",\"n\":4,\"f\":5,\"say\":\"可空的一句桌上话\"}；开 {\"kind\":\"open\",\"say\":\"可空\"}。桌上话可以诈唬、心虚、挑衅、装可怜，不必每手都说，别透露自己骰子的真实点数（想骗就骗）。";
      routeSeatCall(current, api, sys, [{ role: "user", content: liarPublic(state, idx) + "\n现在轮到你。" }], { game: "liar", turnId: turnId, expect: "{\"kind\":\"bid|open\",\"n\":4,\"f\":5,\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8400 } })
        .then(function (r) {
          const a = unoJson(r.value);
          apply(a.kind === "open" ? { kind: "open", say: a.say } : a.kind === "bid" ? { kind: "bid", n: a.n, f: a.f, say: a.say } : fallback(), r.delegated);
        }).catch(function (e) { try { apply(fallback()); } catch (e2) { setError("这手没接稳：" + e.message); } })
        .finally(function () { running.current = ""; setBusy(false); });
    }, [state, busy]);
    function userAct(a) {
      try { const n = clone(); liarAct(n, Object.assign({}, a, { say: say })); setState(n); setSay(""); setError(""); }
      catch (e) { setError(e.message); }
    }
    function nextRound() { const n = clone(); liarNewRound(n, n.nextStarter || 0); delete n.nextStarter; setState(n); }
    const total = liarTotal(state);
    const showAll = spectate || !!state.reveal || state.status === "finished";
    const stepBtn = function (label, onClick, dis) { return h("button", { onClick: onClick, disabled: dis, style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + t.line, background: t.bg2, color: dis ? t.fog : t.ink, fontSize: "calc(17px * var(--app-fs, 1))" } }, label); };
    const pickOk = liarLegalBid(state.bid, pick, total);
    return h("div", { "data-wk": "gameplay", "data-part": "liar", className: "h-full flex flex-col", style: gameTable("liar", t) },
      h(Head, { zh: "骗子骰", en: state.status === "finished" ? "终局" : ("第 " + state.round + " 轮 · 轮到 " + (current ? current.name : "—")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "liar", zh: "骗子骰" }, seats: state.players.map(function (p, i) {
          const on = i === state.turn && state.status === "playing" && !state.reveal, out = p.lives <= 0;
          const lost = state.reveal && state.reveal.loser === p.key;
          return { key: p.key, name: p.name + (p.engineer ? " · 亲打" : ""), char: p.isUser ? { name: p.name, avatarImage: (props.profile || {}).avatarImage, color: (props.profile || {}).color } : findChar(p.key), isUser: p.isUser,
            on: on, out: out, hot: lost, sub: out ? "出局" : lost ? "输一条命 · " + "♥".repeat(p.lives) : "♥".repeat(p.lives) + "♡".repeat(Math.max(0, LIAR_LIVES - p.lives)) };
        }) }),
        // 桌面：一块绒布，中间是现在叫到几个几；开了以后整桌的骰子摊在这上面
        h("div", { "data-wk": "gameliarbid", style: { position: "relative", borderRadius: 18, padding: "16px 14px 18px", marginBottom: 12, textAlign: "center", color: "#f4ead9",
            background: "radial-gradient(120% 90% at 50% 30%, #8a4a36 0%, #5e2f22 70%, #4a241a 100%)",
            boxShadow: "inset 0 0 0 3px rgba(255,235,200,.08), inset 0 10px 30px rgba(0,0,0,.35), 0 8px 18px rgba(40,20,10,.25)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".1em", opacity: .7 } }, "第 " + state.round + " 轮 · 桌上 " + total + " 颗 · 1 点万能"),
          state.bid ? h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(32px * var(--app-fs, 1))", lineHeight: 1 } }, state.bid.n),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", opacity: .85 } }, "个"),
              h(Die, { v: state.bid.f, size: 40 }))
            : h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", marginTop: 10, opacity: .85 } }, state.status === "finished" ? "收杯了" : "还没人叫"),
          state.bid ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .75, marginTop: 6 } }, (state.players.find(function (p) { return p.key === state.bid.by; }) || {}).name + " 叫的") : null,
          showAll ? h("div", { "data-wk": "gameliarreveal", style: { marginTop: 14, display: "flex", flexDirection: "column", gap: 6 } }, state.players.filter(function (p) { return p.dice && p.dice.length; }).map(function (p) {
            return h("div", { "data-wk": "block", key: p.key, style: { display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.18)", borderRadius: 11, padding: "5px 9px" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", width: 64, textAlign: "left", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
              h("div", { style: { display: "flex", gap: 4 } }, p.dice.map(function (d, j) { return h(Die, { key: j, v: d, size: 24, hot: !!(state.reveal && (d === state.reveal.bid.f || d === 1)) }); })));
          })) : null,
          state.reveal ? h("div", { style: { marginTop: 10, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, "一共 " + state.reveal.got + " 个 " + state.reveal.bid.f + " · " + (state.reveal.got >= state.reveal.bid.n ? "够数" : "不够")) : null),
        // 自己杯里的骰子（没轮到也看得见）
        !showAll && state.players.find(function (p) { return p.isUser; }) && state.players.find(function (p) { return p.isUser; }).lives > 0 ? h("div", { "data-wk": "gameliarcup", style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 12, padding: "10px 12px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginRight: 4 } }, "我杯里"),
          state.players.find(function (p) { return p.isUser; }).dice.map(function (d, j) { return h(Die, { key: j, v: d, size: 32 }); })) : null,
        h("div", { "data-wk": "gamelog", "data-part": "liar", style: { background: t.bg2, borderRadius: 13, padding: "10px 12px", maxHeight: 200, overflowY: "auto" } }, state.log.slice(-12).map(function (x, i) { return h("div", { "data-wk": "gamelogline", key: i, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: x.kind === "sys" ? t.fog : t.sub, lineHeight: 1.65 } }, x.text); })),
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          ((state.players.find(function (p) { return p.key === state.winner; }) || {}).name || "没人") + " 撑到了最后！",
          resultNotice ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontWeight: 400, color: t.sub } }, resultNotice) : null,
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const w = state.players.find(function (p) { return p.key === state.winner; }), u = state.players.find(function (p) { return p.isUser; });
            return { key: "liar", zh: "骗子骰", ids: realCharIds(state.players), wins: w && realCharIds(state.players).indexOf(w.key) >= 0 ? [w.key] : [], meWin: u ? !!(w && w.isUser) : null,
              text: "一起玩了一局「骗子骰」，打了 " + state.round + " 轮，" + ((w && (w.isUser ? "她" : w.name)) || "没人") + " 撑到了最后。" + (state.log.filter(function (x) { return x.kind === "sys" && /输一条命/.test(x.text); }).slice(-1).map(function (x) { return "最后一开：" + x.text.replace(/^亮骰：/, ""); })[0] || "") };
          } })) : null),
      state.status === "playing" && state.reveal ? h("div", { "data-wk": "gameactions", "data-part": "liar", "data-kind": "reveal", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", textAlign: "center" } },
        h("button", { "data-wk": "gameliarnext", onClick: nextRound, style: { border: 0, borderRadius: 999, padding: "11px 26px", color: "#fff", background: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "摇下一轮")) :
      state.status === "playing" && me ? h("div", { "data-wk": "gameactions", "data-part": "liar", "data-kind": "bid", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 9 } },
          stepBtn("−", function () { setPick({ n: Math.max(1, pick.n - 1), f: pick.f }); }, pick.n <= 1),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.ink, minWidth: 54, textAlign: "center" } }, pick.n + " 个"),
          stepBtn("+", function () { setPick({ n: Math.min(total, pick.n + 1), f: pick.f }); }, pick.n >= total),
          h("div", { style: { display: "flex", gap: 4, marginLeft: 6 } }, [2, 3, 4, 5, 6].map(function (f) {
            return h("button", { key: f, onClick: function () { setPick({ n: pick.n, f: f }); }, style: { padding: 2, borderRadius: 8, border: pick.f === f ? "2px solid " + t.tint : "2px solid transparent", background: "transparent" } }, h(Die, { v: f, size: 26 }));
          }))),
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: say, onChange: function (e) { setSay(e.target.value); }, placeholder: "顺便说一句（可空，想诈就诈）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", marginBottom: 8, background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        h("div", { style: { display: "grid", gridTemplateColumns: state.bid ? "1fr 1fr" : "1fr", gap: 8 } },
          h("button", { "data-wk": "gameliarbidbtn", onClick: function () { userAct({ kind: "bid", n: pick.n, f: pick.f }); }, disabled: !pickOk, style: { border: 0, borderRadius: 999, padding: "11px 10px", color: "#fff", background: pickOk ? t.tint : t.line, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "叫 " + pick.n + " 个 " + pick.f),
          state.bid ? h("button", { "data-wk": "gameliaropen", onClick: function () { userAct({ kind: "open" }); }, style: { border: 0, borderRadius: 999, padding: "11px 10px", color: "#fff", background: "#c0553f", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "开！") : null)) :
      busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, current && current.engineer ? "等本人掀杯看骰…" : (current ? current.name : "TA") + " 在看骰子…") : null);
  }

  // ============================================================
  // 故事接龙：轮流往下写一句，每人每轮抽一个必须用上的词。不分输赢，写完整篇留着。
  // 三圈，最后一个人负责收尾。写完的故事可以复制、收进记忆、当战报发给 TA 或发到群里。
  // ============================================================
  const STORY_OPENERS = ["那天晚上，便利店的灯忽然全灭了。", "雨下到第七天的时候，楼下多了一只不肯走的猫。", "我在旧书里翻到一张写着自己名字的车票。",
    "电梯停在了一个本来不存在的楼层。", "外卖备注栏里写着：请救救我。", "毕业十年，班长突然在群里发了一张合照，照片里多了一个人。",
    "这座城市每到午夜，所有的钟都会慢一分钟。", "我收到了一封寄给明年的自己的信。", "隔壁新搬来的人，每天凌晨三点准时练琴。", "海边那家店只在下雨天开门。"];
  const STORY_WORDS = ["钥匙", "雨伞", "蛋糕", "猫", "路灯", "旧照片", "地铁", "口红", "信封", "冰淇淋", "月亮", "手电筒", "外套", "便签", "咖啡",
    "雪", "耳机", "红绳", "面包", "鞋带", "风筝", "镜子", "围巾", "烟花", "车票", "糖", "向日葵", "台灯", "气球", "日记本", "铃铛", "狗", "拖鞋", "海浪", "秘密"];
  function storyPick(list, rnd) { return list[Math.floor((rnd || Math.random)() * list.length)]; }
  function storyNewGame(players, laps, rnd) {
    const seats = players.slice();
    const state = { id: "story_" + Date.now().toString(36), status: "playing", laps: laps || 3, turn: 0, opener: storyPick(STORY_OPENERS, rnd), lines: [], log: [], title: "",
      players: seats, word: storyPick(STORY_WORDS, rnd) };
    return state;
  }
  function storyTotalTurns(state) { return state.players.length * state.laps; }
  function storyIsLast(state) { return state.lines.length === storyTotalTurns(state) - 1; }
  function storyText(state) { return [state.opener].concat(state.lines.map(function (l) { return l.text; })).join(""); }
  // 写一句：没用上抽到的词也收（她写的就是她写的），只是记一笔，界面上那个词不标绿
  function storyAct(state, key, text, rnd) {
    const p = state.players[state.turn], line = String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!p || p.key !== key || state.status !== "playing") throw new Error("还没轮到");
    if (!line) throw new Error("写一句再接");
    state.lines.push({ key: p.key, name: p.name, text: line, word: state.word, used: line.indexOf(state.word) >= 0 });
    if (state.lines.length >= storyTotalTurns(state)) { state.status = "finished"; return state; }
    state.turn = (state.turn + 1) % state.players.length;
    state.word = storyPick(STORY_WORDS, rnd);
    return state;
  }
  function StoryChainGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () {
      if (restored && restored.status === "playing") {
        restored.players.forEach(function (p) { const live = unoPlayers(props, 8).find(function (x) { return x.key === p.key; }); if (live) Object.assign(p, live); });
        return restored;
      }
      return storyNewGame(unoPlayers(props, 8), 3);
    });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [draft, setDraft] = useState(""), [title, setTitle] = useState(""), [copied, setCopied] = useState(false);
    const running = useRef("");
    const current = state.players[state.turn], me = current && current.isUser;
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("story"); return; }
      saveGameSnap("story", { config: cfg, state: state, label: "写到第 " + (state.lines.length + 1) + " 句 · 轮到 " + (current ? current.name : "—") });
    }, [state]);
    useEffect(function () {
      if (!current || current.isUser || state.status !== "playing" || busy) return;
      const turnId = state.id + "#" + state.lines.length + "#" + current.key;
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const last = storyIsLast(state), word = state.word;
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在和大家玩「故事接龙」：每人轮流往下写一句，接在别人后面，合起来是一篇小故事。你写的就是你这一句，不是评论。保持你本人的性格和说话习惯——你会怎么接，就怎么接（爱搞怪的会拐个弯，细腻的会写细节）。"
        + "\n这一句必须自然地用上「" + word + "」这个词。只写一到两句、60 字以内，紧接上文，别重复上文，别替别人写后面。" + (last ? "\n这是全篇最后一句，由你来收尾：把故事落下来，留一点余味。" : "")
        + "\nsay 是你写完这句以后嘴上冒出来的那句话：可以是对上一个人那句的反应、冲某个人说、得意或心虚自己这一句、接桌上刚才谁的话——照你这个人。轮到谁接大家都知道，不用你来报幕；没想说的就留空。"
        + "\n只输出 JSON：{\"line\":\"你接的这一句\",\"say\":\"可空：你嘴上那句\"}";
      const ctx = "故事到目前为止：\n" + storyText(state)
        + (state.lines.length ? "\n\n（每句是谁接的：" + state.lines.slice(-8).map(function (l) { return l.name + "「" + String(l.text).slice(0, 18) + (String(l.text).length > 18 ? "…" : "") + "」"; }).join("；") + "）" : "")
        + "\n\n现在轮到你接。要用上的词：" + word;
      routeSeatCall(current, api, sys, [{ role: "user", content: ctx }], { game: "story", turnId: turnId, expect: "{\"line\":\"...\",\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8400 } })
        .then(function (r) {
          const a = unoJson(r.value), line = String(a.line || "").trim();
          if (!line) throw new Error("没写出来");
          const n = JSON.parse(JSON.stringify(state));
          storyAct(n, current.key, line);
          const s = String(a.say || "").trim();
          if (s) n.log.push({ kind: "chat", player: current.key, text: current.name + "：“" + s.slice(0, 120) + "”" });
          setState(n);
        }).catch(function (e) { setError((current ? current.name : "TA") + " 这句没接上：" + e.message); })
        .finally(function () { setBusy(false); });
    }, [state, busy]);
    function submit() {
      try { const n = JSON.parse(JSON.stringify(state)); storyAct(n, "user", draft); setState(n); setDraft(""); setError(""); }
      catch (e) { setError(e.message); }
    }
    function retry() { running.current = ""; setError(""); setState(JSON.parse(JSON.stringify(state))); }
    const full = storyText(state);
    const name = title.trim() || "无题";
    return h("div", { "data-wk": "gameplay", "data-part": "story", className: "h-full flex flex-col", style: gameTable("story", t) },
      h(Head, { zh: "故事接龙", en: state.status === "finished" ? "写完了" : ("第 " + (state.lines.length + 1) + " / " + storyTotalTurns(state) + " 句 · 轮到 " + (current ? current.name : "—")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(GameVsBar, { t: t, evalOf: { host: props, key: "story", zh: "故事接龙" }, seats: state.players.map(function (p, i) {
          const n = state.lines.filter(function (l) { return l.key === p.key; }).length;
          return { key: p.key, name: p.name, char: p.isUser ? { name: p.name, avatarImage: (props.profile || {}).avatarImage, color: (props.profile || {}).color } : (props.characters || []).find(function (c) { return String(c.id) === String(p.key); }),
            isUser: p.isUser, on: state.status === "playing" && i === state.turn, sub: state.status === "playing" && i === state.turn ? "在写…" : "写了 " + n + " 句" };
        }) }),
        // 一页横格本：左边一道红边线，字压在格线上；第几圈贴在右上角
        h("div", { "data-wk": "gamestorypaper", style: { position: "relative", borderRadius: 6, padding: "18px 16px 16px 30px", background: "#fffdf6",
            backgroundImage: "linear-gradient(90deg, transparent 21px, rgba(208,83,63,.35) 21px, rgba(208,83,63,.35) 22.5px, transparent 22.5px), repeating-linear-gradient(180deg, transparent 0 29px, rgba(93,111,163,.18) 29px 30px)",
            backgroundPosition: "0 0, 0 19px",
            boxShadow: "0 1px 0 #ece5d6, 0 3px 0 #f5f0e6, 0 4px 0 #e4dccd, 0 10px 22px rgba(40,30,20,.18)" } },
          state.status === "playing" ? h("div", { "data-wk": "block", style: { position: "absolute", right: 10, top: -8, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#fff", background: LID.story.hot, borderRadius: 4, padding: "3px 8px", boxShadow: "0 2px 4px rgba(0,0,0,.15)" } },
            "第 " + (Math.floor(state.lines.length / state.players.length) + 1) + " / " + state.laps + " 圈") : null,
          state.status === "finished" ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: "#2f2a24", lineHeight: "30px", marginBottom: 0, textAlign: "center" } }, "《" + name + "》") : null,
          h("p", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: "30px", color: "#2f2a24", margin: 0 } },
            h("span", { style: { color: "#8a8173" } }, state.opener),
            state.lines.map(function (l, i) {
              return h("span", { "data-wk": "gamestoryline", "data-part": l.key === "user" ? "me" : "ta", key: i, title: l.name },
                l.text.split(l.word).map(function (seg, j, arr) {
                  return j < arr.length - 1 ? [seg, h("b", { key: "w" + j, style: { color: LID.story.hot, fontWeight: 700, background: "linear-gradient(180deg, transparent 60%, rgba(93,111,163,.18) 60%)" } }, l.word)] : seg;
                }),
                // 每人那一段末尾挂个小号，跟底下「1 · 某某」对得上（她 2026-10-22「每一段后面没有结尾，分不出哪里结束」）
                h("sup", { "data-wk": "gamestorymark", style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: LID.story.hot, opacity: .75, margin: "0 3px 0 1px", fontWeight: 600 } }, String(i + 1)));
            })),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 } }, state.lines.map(function (l, i) {
            return h("span", { key: i, style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, padding: "2px 8px", borderRadius: 999, border: "1px solid " + t.line } }, (i + 1) + " · " + l.name + (l.used ? "" : " · 没用上「" + l.word + "」"));
          }))),
        state.log.length ? h("div", { "data-wk": "gamelog", "data-part": "story", style: { marginTop: 10, background: t.bg2, borderRadius: 13, padding: "9px 12px" } }, state.log.slice(-6).map(function (x, i) { return h("div", { "data-wk": "gamelogline", key: i, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.65 } }, x.text); })) : null,
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error, " ",
          h("button", { onClick: retry, style: { color: t.tint, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", textDecoration: "underline", background: "transparent" } }, "再请一次")) : null,
        state.status === "finished" ? h("div", { style: { marginTop: 14 } },
          h("input", { "data-wk": "gameinput", "data-part": "title", value: title, onChange: function (e) { setTitle(e.target.value.slice(0, 20)); }, placeholder: "给它起个名字（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none", textAlign: "center" } }),
          h("button", { "data-wk": "gamestorycopy", onClick: function () { try { (typeof copyText === "function" ? copyText : function (s) { return navigator.clipboard.writeText(s); })("《" + name + "》\n" + full); setCopied(true); } catch (e) {} },
            style: { width: "100%", minHeight: 42, marginTop: 9, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10 } }, copied ? "已复制全文" : "复制全文"),
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            return { key: "story", zh: "故事接龙", ids: realCharIds(state.players), wins: [], meWin: null,
              text: "一起接龙写了一篇小故事《" + name + "》：" + full.slice(0, 240) + (full.length > 240 ? "……" : "") };
          } })) : null),
      state.status === "playing" && me ? h("div", { "data-wk": "gameactions", "data-part": "story", "data-kind": "write", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 7 } }, "轮到你接", storyIsLast(state) ? "最后一句——帮它收个尾" : "", "，要用上：", h("b", { "data-wk": "gamestoryword", style: { color: t.tint, fontSize: "calc(14px * var(--app-fs, 1))" } }, "「" + state.word + "」")),
        h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end" } },
          h("textarea", { "data-wk": "gameinput", "data-part": "line", value: draft, onChange: function (e) { setDraft(e.target.value); }, rows: 2, placeholder: "接着往下写一句……", style: { flex: 1, resize: "none", border: "1px solid " + t.line, borderRadius: 15, padding: "10px 12px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
          h("button", { "data-wk": "gamestorysend", onClick: submit, disabled: !draft.trim(), style: { width: 44, height: 44, borderRadius: 999, border: 0, background: draft.trim() ? t.tint : t.line, color: "white", fontSize: "calc(19px * var(--app-fs, 1))" } }, "↑"))) :
      busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, (current ? current.name : "TA") + " 在想怎么接…（要用上「" + state.word + "」）") : null);
  }

  // ============================================================
  // 牌桌三样（她 2026-10-16：「打牌类放进小游戏」→「节奏你看看 uno 怎么做」→「都做了」）：
  //   德州扑克 / 抽鬼牌 / 21 点。节奏照 UNO、骗子骰：规则、发牌、算输赢全在本机；
  //   轮到角色的座位时问 TA 本人一次（能做的几样摆给 TA，TA 照自己的性格挑、顺口说一句，也可以不说）；
  //   答得不合规、或者是配角（NPC）座位，就退回本机那一手。她的那一手也能顺口说一句。
  // ============================================================
  const CARD_SUITS = ["♠", "♥", "♦", "♣"], CARD_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  function cardDeck(rnd) {
    const d = [];
    CARD_SUITS.forEach(function (s) { CARD_RANKS.forEach(function (r, i) { d.push({ r: r, s: s, v: i + 2 }); }); });
    return cardShuffle(d, rnd);
  }
  function cardShuffle(a, rnd) { const r = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function cardName(c) { return c ? (c.joker ? (c.r === "大王" || c.r === "小王" ? c.r : "鬼牌") : c.s + c.r) : "?"; }
  // 牌桌那几个动作（发牌落下、翻开、冒话、轮到谁一闪一闪）：只注一次
  function ensureCardCss() {
    if (typeof document === "undefined" || !document.head || document.getElementById("gcard-css")) return;
    const st = document.createElement("style"); st.id = "gcard-css";
    st.textContent = "@keyframes gcardIn{from{opacity:0;transform:translateY(-18px) rotate(-8deg) scale(.9)}to{opacity:1}}"
      + "@keyframes gcardFlip{from{transform:rotateY(90deg)}to{transform:rotateY(0)}}"
      + "@keyframes gcardPop{from{opacity:0;transform:translateY(4px) scale(.92)}to{opacity:1}}"
      + "@keyframes gcardPulse{0%,100%{box-shadow:0 0 0 3px rgba(224,162,58,.35)}50%{box-shadow:0 0 0 7px rgba(224,162,58,.06)}}";
    document.head.appendChild(st);
  }
  // 一张牌：像真牌那样四角写点数花色、中间一个大花色；back=扣着，ghost=还没发的空位
  function PlayCard(props) {
    ensureCardCss();
    const c = props.c, w = props.w || 38, hh = Math.round(w * 1.4), back = props.back || (!c && !props.ghost);
    const red = c && (c.s === "♥" || c.s === "♦"), ink = c && c.joker ? "#7a4fb0" : red ? "#c0392b" : "#2f2a24";
    const small = w < 34, corner = Math.max(9, Math.round(w * .26));
    const cornerBox = function (k, flip) {
      return h("div", { key: k, style: { position: "absolute", [flip ? "right" : "left"]: Math.round(w * .07), [flip ? "bottom" : "top"]: Math.round(w * .05), display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, transform: flip ? "rotate(180deg)" : "none" } },
        h("span", { style: { fontFamily: F_DISPLAY, fontWeight: 700, fontSize: corner, letterSpacing: c.r === "10" ? "-.08em" : 0 } }, c.r),
        h("span", { style: { fontSize: Math.round(corner * .85), marginTop: 1 } }, c.s));
    };
    const face = props.ghost && !c ? null : back ? h("div", { style: { position: "absolute", inset: 3, borderRadius: Math.round(w / 9), border: "1px solid rgba(255,255,255,.4)" } })
      : c.joker ? h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: Math.round(w * .5) } }, "🃏",
          c.r === "大王" || c.r === "小王" ? h("span", { style: { fontFamily: F_BODY, fontSize: Math.max(8, Math.round(w * .24)), fontWeight: 700, color: c.r === "大王" ? "#c0392b" : "#2f2a24", marginTop: 1 } }, c.r) : null)
      : [cornerBox("tl", false), small ? null : cornerBox("br", true),
        h("div", { key: "m", style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(w * (small ? .4 : .5)), paddingTop: small ? Math.round(w * .32) : 0 } }, c.s)];
    return h("div", { "data-wk": "gamecard", "data-on": props.hot ? "1" : "0", onClick: props.onClick, style: { position: "relative", width: w, height: hh, borderRadius: Math.round(w / 6), flexShrink: 0, cursor: props.onClick ? "pointer" : "default", color: ink,
        transform: props.lift ? "translateY(-10px)" : "none", transition: "transform .15s",
        animation: props.ghost && !c ? "none" : props.flip ? "gcardFlip .4s ease-out both" : "gcardIn .3s ease-out both",
        background: props.ghost && !c ? "rgba(255,255,255,.06)" : back ? "repeating-linear-gradient(45deg,rgba(255,255,255,.13) 0 3px,transparent 3px 7px), #8e3b33" : "linear-gradient(160deg,#fffdf8,#f2eadc)",
        border: props.ghost && !c ? "1.5px dashed rgba(255,255,255,.3)" : props.hot ? "2px solid #e0a23a" : back ? "2px solid #fbf8f1" : "1px solid rgba(47,42,36,.2)",
        boxShadow: props.ghost && !c ? "none" : props.hot ? "0 0 0 3px rgba(224,162,58,.3), 0 3px 8px rgba(0,0,0,.25)" : "0 2px 6px rgba(0,0,0,.22)" } }, face);
  }
  // 一摞筹码（unit＝一枚代表多少），旁边写数
  function ChipStack(props) {
    const v = Number(props.n) || 0, sz = props.size || 12, n = v > 0 ? Math.max(1, Math.min(6, Math.ceil(v / (props.unit || 200)))) : 0;
    const cols = ["#c0392b", "#2f6fb0", "#2f2a24", "#e0a23a", "#3f8a5c", "#7a4fb0"];
    return h("span", { style: { position: "relative", display: "inline-block", width: sz, height: Math.round(sz * .55) + Math.max(0, n - 1) * 3, verticalAlign: "middle", flexShrink: 0 } },
      Array.from({ length: n }).map(function (_, i) { return h("span", { key: i, style: { position: "absolute", left: 0, bottom: i * 3, width: sz, height: Math.round(sz * .55), borderRadius: "50%", background: cols[i % cols.length], border: "1.5px dashed rgba(255,255,255,.8)", boxShadow: "0 1px 1px rgba(0,0,0,.35)", boxSizing: "border-box" } }); }));
  }
  // 手里扣着几张：几张小牌背扇开
  function CardBacks(props) {
    const n = Math.min(4, props.n || 0);
    return h("span", { style: { position: "relative", display: "inline-block", width: 8 + n * 4, height: 13, verticalAlign: "middle", flexShrink: 0 } },
      Array.from({ length: n }).map(function (_, j) { return h("span", { key: j, style: { position: "absolute", left: j * 4, bottom: 0, width: 9, height: 13, borderRadius: 2, background: "#8e3b33", border: "1px solid #fbf8f1", transform: "rotate(" + (j * 8 - 8) + "deg)", transformOrigin: "50% 100%" } }); }));
  }
  // 一句话从记录里摘出来（“…”里那句）
  function cardSayOf(x) { const m = String((x && x.text) || "").match(/“([^”]+)”[^“]*$/); return m ? m[1] : ""; }
  // 牌桌座位：围着桌子一圈头像，轮到谁谁的头像外圈一闪一闪，刚说过话的头像底下冒一个小气泡
  function CardSeats(props) {
    ensureCardCss();
    const t = props.t, av = avatarFor(t), seats = props.seats || [], recent = (props.log || []).slice(-Math.max(4, seats.length * 2));
    const [look, setLook] = useState(null);
    return h("div", { "data-wk": "gamevs", "data-part": "cards", style: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: "12px 8px", margin: "6px 0 14px" } },
      look && props.evalOf ? h(SeatSkill, { t: t, seat: look, evalOf: props.evalOf, onClose: function () { setLook(null); } }) : null,
      seats.map(function (s) {
      let bub = "";
      for (let i = recent.length - 1; i >= 0; i--) { if (recent[i].player === s.key) { bub = cardSayOf(recent[i]); break; } }
      return h("div", { "data-wk": "gamevsseat", "data-on": s.on ? "1" : "0", "data-out": s.out ? "1" : "0", key: s.key, style: { width: 80, display: "flex", flexDirection: "column", alignItems: "center", opacity: s.out ? .45 : 1, transition: "opacity .2s" } },
        h("div", { onClick: props.evalOf ? function () { setLook(s); } : undefined, style: { cursor: props.evalOf ? "pointer" : "default", position: "relative", borderRadius: 999, padding: 2, background: s.on ? "linear-gradient(135deg,#e0a23a,#f6d48a)" : s.hot ? "#c0553f" : "transparent", animation: s.on ? "gcardPulse 1.4s ease-in-out infinite" : "none" } },
          av(s, 46),
          s.dealer ? h("span", { style: { position: "absolute", right: -4, bottom: -2, width: 18, height: 18, borderRadius: 999, background: "#fbf8f1", color: "#2f2a24", fontSize: "calc(10px * var(--app-fs, 1))", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,.3)", fontFamily: F_DISPLAY } }, s.badge || "庄") : null),
        h("div", { style: { marginTop: 5, maxWidth: 80, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.name),
        h("div", { "data-wk": "gamecardchips", style: { display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: s.hot ? "#c0553f" : t.fog, whiteSpace: "nowrap" } },
          s.chips != null ? h(ChipStack, { n: s.chips, unit: s.unit, size: 11 }) : s.cards != null ? h(CardBacks, { n: s.cards }) : null, s.sub),
        bub ? h("div", { "data-wk": "gamecardbubble", key: "b" + bub, style: { position: "relative", marginTop: 6, maxWidth: 96, padding: "5px 8px", borderRadius: 11, background: t.bg2, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.4, boxShadow: "0 3px 10px rgba(20,16,10,.12)", animation: "gcardPop .25s ease-out both", wordBreak: "break-all" } }, bub) : null);
    }));
  }
  // 牌桌的记录：桌上话用正文颜色，系统那几行淡一点；收着高度，桌子才是主角
  function CardLog(props) {
    const t = props.t;
    // column-reverse：最新那行永远贴在底下看得见，不用手动往下滚
    return h("div", { "data-wk": "gamelog", "data-part": props.part, style: { background: t.bg2, borderRadius: 13, padding: "9px 12px", maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column-reverse" } },
      props.talking ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "他们边出牌边嘀咕…") : null,
      props.log.slice(-12).reverse().map(function (x, i) { return h("div", { "data-wk": "gamelogline", "data-kind": x.kind, key: i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: x.kind === "sys" ? t.fog : x.kind === "chat" ? t.ink : t.sub, lineHeight: 1.6 } }, x.text); }));
  }
  function cardTalk(state, n) { return state.log.slice(-(n || 8)).map(function (x) { return x.text; }).join("\n"); }
  // 桌上那块绒布（三样共用）
  function feltBox(children, part) {
    return h("div", { "data-wk": "gamefelt", "data-part": part, style: { position: "relative", borderRadius: 18, padding: "14px 12px 16px", marginBottom: 12, textAlign: "center", color: "#eef3ea",
      background: "radial-gradient(120% 90% at 50% 30%, #2f6b4f 0%, #1f4e39 70%, #183d2d 100%)",
      boxShadow: "inset 0 0 0 3px rgba(230,255,235,.07), inset 0 10px 30px rgba(0,0,0,.35), 0 8px 18px rgba(10,30,20,.25)" } }, children);
  }
  function cardSeatChar(props, p) { return p.isUser ? { name: p.name, avatarImage: (props.profile || {}).avatarImage, color: (props.profile || {}).color } : (props.characters || []).find(function (c) { return String(c.id) === String(p.key); }); }
  function addChat(n, p, say) { const s = String(say || "").trim(); if (s) n.log.push({ kind: "chat", player: p.key, text: p.name + "：“" + s.slice(0, 160) + "”" }); }

  // ---------------- 谁来出牌（她 2026-10-16「这些还有 uno 不能搞成每次调用全部人吗这样省钱」→ 选「开局页做个开关」）
  //   self：每到角色那一手问 TA 本人一次（像 TA 亲自在想，贵）。
  //   local（默认）：出牌全归手机，照每个人自己的路数打；转回她那一手 / 一手打完 / 终局时，一次调用让全桌各说一句。
  //   这一次调用里只摆公开的东西，不摆任何人的底牌——一个模型同时演全桌，摆了就等于大家互相看着牌打。
  //   抽鬼牌是盲抽，让 TA 想也挑不出差别，一律 local。
  function cardLocal(cfg, game) { return game === "oldmaid" || !cfg || cfg.cardBrain !== "self"; }
  // 每个人自己的路数：同一个人每局一样（按 key 算），有的松有的紧
  function cardStyle(p) { let s = 0; String((p && p.key) || "").split("").forEach(function (ch) { s = (s * 31 + ch.charCodeAt(0)) % 997; }); return (s % 7 - 2) / 20; }
  async function cardTableTalk(api, gameZh, seats, view) {
    const roster = seats.map(function (p) { return "· " + p.name + (p.isNpc ? "（凑数的牌友）" : "") + voiceBrief(p); }).join("\n");
    const sys = gameVoiceRules() + "这是一桌人在打「" + gameZh + "」。牌是他们自己出的，这一圈已经出完了；你只写他们边打边说的那几句。"
      + "\n在座会开口的：\n" + roster
      + "\n\n桌上公开的情况（大家都看得见的）：\n" + view
      + "\n\n每个人只知道自己手里的牌和桌上公开的事，谁也看不见别人的牌，说话也照这个来：可以猜、诈、嘴硬、起哄、接别人的话、冲她说，但说不出别人手里有什么。"
      + "不必人人开口，没话说的就不写；一个人最多一句，口语，短。"
      + "\n只输出 JSON：{\"lines\":[{\"name\":\"在座的名字\",\"say\":\"一句\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "这一圈的桌上话。" }], { maxTokens: 65000 });
    const j = unoJson(raw), out = [];
    (Array.isArray(j.lines) ? j.lines : []).forEach(function (l) {
      const p = seats.find(function (x) { return x.name === String((l && l.name) || "").trim(); }), say = String((l && l.say) || "").trim();
      if (p && say && !out.some(function (o) { return o.p.key === p.key; })) out.push({ p: p, say: say.slice(0, 160) });
    });
    return out;
  }
  // 说话点：o.ready（轮回她 / 一手打完 / 终局）或者观战时别人已经出了 o.every 手；这一圈里得有别人出过手
  function cardMovesSince(log, from) { return log.slice(from).filter(function (x) { return x.player && x.player !== "user" && x.kind !== "chat" && x.kind !== "sys"; }).length; }
  function useCardTableTalk(props, state, setState, o) {
    const [talking, setTalking] = useState(false);
    const mark = useRef(state.talkAt != null ? state.talkAt : 0);
    useEffect(function () {
      if (!o.on || talking || !props.active) return;
      const moved = cardMovesSince(state.log, mark.current);
      if (!moved || !(o.ready || (o.every && moved >= o.every))) return;
      const seats = state.players.filter(function (p) { return !p.isUser && !p.engineer; });
      if (!seats.length) return;
      mark.current = state.log.length; setTalking(true);
      const at = mark.current;
      cardTableTalk(props.active, o.zh, seats, o.view()).then(function (rows) {
        setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); rows.forEach(function (r) { n.log.push({ kind: "chat", player: r.p.key, text: r.p.name + "：“" + r.say + "”" }); }); n.talkAt = at; return n; });
      }).catch(function () {}).finally(function () { setTalking(false); });
    }, [o.on, o.ready, state.log.length, talking]);
    return talking;
  }
  function cardPublicLog(state, n) { return state.log.slice(-(n || 14)).map(function (x) { return x.text; }).join("\n"); }

  // ---------------- 德州扑克 ----------------
  const PK_CHIPS = 1000, PK_SB = 10, PK_BB = 20, PK_HANDS = 10;
  // 七张里挑最好的五张：返回可比较的数组 [牌型, 比大小的点数…] 和牌型名
  const PK_CAT = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"];
  function pkEval5(cs) {
    const vs = cs.map(function (c) { return c.v; }).sort(function (a, b) { return b - a; });
    const flush = cs.every(function (c) { return c.s === cs[0].s; });
    let uniq = vs.filter(function (v, i) { return vs.indexOf(v) === i; });
    let straightHi = 0;
    if (uniq.length === 5 && vs[0] - vs[4] === 4) straightHi = vs[0];
    if (uniq.length === 5 && vs[0] === 14 && vs[1] === 5 && vs[4] === 2) straightHi = 5;
    const cnt = {}; vs.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
    const groups = Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a] || b - a; });
    const shape = groups.map(function (v) { return cnt[v]; });
    if (straightHi && flush) return [8, straightHi];
    if (shape[0] === 4) return [7].concat(groups);
    if (shape[0] === 3 && shape[1] === 2) return [6].concat(groups);
    if (flush) return [5].concat(vs);
    if (straightHi) return [4, straightHi];
    if (shape[0] === 3) return [3].concat(groups);
    if (shape[0] === 2 && shape[1] === 2) return [2].concat(groups);
    if (shape[0] === 2) return [1].concat(groups);
    return [0].concat(vs);
  }
  function pkCmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
  function pkBest(cards) {
    let best = null;
    for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
      const five = cards.filter(function (_, i) { return i !== a && i !== b; });
      if (five.length !== 5) continue;
      const sc = pkEval5(five); if (!best || pkCmp(sc, best) > 0) best = sc;
    }
    if (!best && cards.length === 5) best = pkEval5(cards);
    return best || [0];
  }
  function pkLive(state) { return state.players.filter(function (p) { return p.chips > 0 || p.inHand; }); }
  function pkNext(state, from, pred) {
    const L = state.players.length;
    for (let i = 1; i <= L; i++) { const j = (from + i) % L; if (pred(state.players[j])) return j; }
    return -1;
  }
  const pkCanAct = function (p) { return p.inHand && !p.folded && !p.allin; };
  function pkNewGame(players, rnd) {
    const state = { id: "poker_" + Date.now().toString(36), status: "playing", hand: 0, log: [], dealer: Math.floor((rnd || Math.random)() * players.length), board: [], street: "", pot: 0, winner: null,
      players: players.map(function (p) { return Object.assign({}, p, { chips: PK_CHIPS, hole: [], bet: 0, put: 0, folded: false, allin: false, inHand: false, acted: false }); }) };
    return pkNewHand(state, rnd);
  }
  function pkNewHand(state, rnd) {
    const alive = state.players.filter(function (p) { return p.chips > 0; });
    if (alive.length <= 1 || state.hand >= PK_HANDS) return pkFinish(state);
    state.hand += 1; state.deck = cardDeck(rnd); state.board = []; state.street = "preflop"; state.showdown = null; state.truth = null;
    state.players.forEach(function (p) { p.hole = []; p.bet = 0; p.put = 0; p.folded = p.chips <= 0; p.allin = false; p.inHand = p.chips > 0; p.acted = false; });
    state.dealer = pkNext(state, state.dealer, function (p) { return p.inHand; });
    const heads = alive.length === 2;
    const sb = heads ? state.dealer : pkNext(state, state.dealer, function (p) { return p.inHand; });
    const bb = pkNext(state, sb, function (p) { return p.inHand; });
    state.players.forEach(function (p) { if (p.inHand) p.hole = [state.deck.pop(), state.deck.pop()]; });
    pkPost(state, sb, PK_SB); pkPost(state, bb, PK_BB);
    state.curBet = PK_BB; state.minRaise = PK_BB;
    state.turn = pkNext(state, bb, pkCanAct);
    state.log.push({ kind: "sys", text: "—— 第 " + state.hand + " / " + PK_HANDS + " 手 · " + state.players[state.dealer].name + " 坐庄，" + state.players[sb].name + " 小盲 " + PK_SB + "，" + state.players[bb].name + " 大盲 " + PK_BB + " ——" });
    if (state.turn < 0) pkAdvance(state);
    return state;
  }
  function pkPost(state, i, amt) { const p = state.players[i], a = Math.min(amt, p.chips); p.chips -= a; p.bet += a; p.put += a; if (p.chips === 0) p.allin = true; }
  function pkPot(state) { return state.players.reduce(function (s, p) { return s + p.put; }, 0); }
  // 现在这个人能做哪几样
  function pkOptions(state, i) {
    const p = state.players[i], toCall = Math.max(0, state.curBet - p.bet);
    const o = { toCall: Math.min(toCall, p.chips), canCheck: toCall === 0, minRaiseTo: state.curBet + state.minRaise, maxTo: p.bet + p.chips };
    o.canRaise = o.maxTo > state.curBet && p.chips > toCall;
    return o;
  }
  // 一手：{kind:"fold"|"check"|"call"|"raise"(to)|"allin", say}
  function pkAct(state, action) {
    const i = state.turn, p = state.players[i];
    if (!p || state.status !== "playing" || !pkCanAct(p)) throw new Error("现在不是出手的时候");
    const o = pkOptions(state, i), say = String((action && action.say) || "").trim().slice(0, 160);
    let k = action.kind, txt = "";
    if (k === "check" && !o.canCheck) k = "call";
    if (k === "call" && o.toCall === 0) k = "check";
    if (k === "raise") {
      let to = Math.floor(Number(action.to) || 0);
      if (to >= o.maxTo) k = "allin";
      else if (!o.canRaise || to < o.minRaiseTo) throw new Error("加注至少要加到 " + o.minRaiseTo);
      else { const add = to - p.bet; p.chips -= add; p.put += add; p.bet = to; state.minRaise = to - state.curBet; state.curBet = to; state.players.forEach(function (q) { if (q !== p) q.acted = false; }); txt = "加注到 " + to; }
    }
    if (k === "allin") {
      const add = p.chips, to = p.bet + add; p.chips = 0; p.put += add; p.bet = to; p.allin = true;
      if (to > state.curBet) { if (to - state.curBet >= state.minRaise) state.minRaise = to - state.curBet; state.curBet = to; state.players.forEach(function (q) { if (q !== p) q.acted = false; }); }
      txt = "全押（" + to + "）";
    }
    if (k === "fold") { p.folded = true; txt = "弃牌"; }
    if (k === "check") txt = "过牌";
    if (k === "call") { const a = o.toCall; p.chips -= a; p.put += a; p.bet += a; if (p.chips === 0) p.allin = true; txt = "跟 " + a; }
    if (!txt) throw new Error("看不懂这一手");
    p.acted = true;
    state.log.push({ kind: "move", player: p.key, text: p.name + "：" + txt + (say ? "　“" + say + "”" : "") });
    const inPlay = state.players.filter(function (q) { return q.inHand && !q.folded; });
    if (inPlay.length === 1) return pkAward(state, [[inPlay[0]]], true);
    const waiting = state.players.filter(function (q) { return pkCanAct(q) && (!q.acted || q.bet < state.curBet); });
    if (waiting.length) { state.turn = pkNext(state, i, function (q) { return pkCanAct(q) && (!q.acted || q.bet < state.curBet); }); return state; }
    return pkAdvance(state);
  }
  // 这一圈下完：发下一条街，或者摊牌
  function pkAdvance(state) {
    state.players.forEach(function (q) { q.bet = 0; q.acted = false; });
    state.curBet = 0; state.minRaise = PK_BB;
    const order = ["preflop", "flop", "turn", "river"], next = order[order.indexOf(state.street) + 1];
    const canBet = state.players.filter(function (q) { return pkCanAct(q); }).length;
    if (!next) return pkShowdown(state);
    if (next === "flop") state.board.push(state.deck.pop(), state.deck.pop(), state.deck.pop()); else state.board.push(state.deck.pop());
    state.street = next;
    state.log.push({ kind: "sys", text: ({ flop: "翻牌", turn: "转牌", river: "河牌" })[next] + "：" + state.board.map(cardName).join(" ") });
    if (canBet <= 1) return pkAdvance(state);
    state.turn = pkNext(state, state.dealer, pkCanAct);
    return state;
  }
  function pkShowdown(state) {
    while (state.board.length < 5) state.board.push(state.deck.pop());
    const live = state.players.filter(function (q) { return q.inHand && !q.folded; });
    live.forEach(function (q) { q.score = pkBest(q.hole.concat(state.board)); });
    state.showdown = live.map(function (q) { return { key: q.key, hole: q.hole.slice(), cat: PK_CAT[q.score[0]] }; });
    const sorted = live.slice().sort(function (a, b) { return pkCmp(b.score, a.score); });
    const tiers = []; sorted.forEach(function (q) { const last = tiers[tiers.length - 1]; if (last && pkCmp(last[0].score, q.score) === 0) last.push(q); else tiers.push([q]); });
    return pkAward(state, tiers, false);
  }
  // 分池：按每人这一手一共放进去多少一层层分（有人全押时的边池）
  function pkAward(state, tiers, uncontested) {
    const contrib = state.players.map(function (q) { return { q: q, put: q.put }; });
    const won = {};
    let levels = contrib.map(function (x) { return x.put; }).filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    let prev = 0;
    levels.forEach(function (lv) {
      const layer = contrib.reduce(function (s, x) { return s + Math.max(0, Math.min(x.put, lv) - prev); }, 0);
      const elig = tiers.map(function (t) { return t.filter(function (q) { return q.put >= lv; }); }).find(function (t) { return t.length; });
      const who = elig && elig.length ? elig : tiers[0];
      const share = Math.floor(layer / who.length);
      who.forEach(function (q, k) { const amt = share + (k === 0 ? layer - share * who.length : 0); q.chips += amt; won[q.key] = (won[q.key] || 0) + amt; });
      prev = lv;
    });
    // 输的人答一个真心话（她 2026-10-16「都做了」）：这一手净赢最多的问、净输最多的答
    if (state.truthOn) {
      const net = state.players.map(function (q) { return { k: q.key, v: (won[q.key] || 0) - q.put }; }).sort(function (a, b) { return b.v - a.v; });
      const top = net[0], low = net[net.length - 1];
      state.truth = top && low && top.v > 0 && low.v < 0 && top.k !== low.k ? { asker: top.k, answerer: low.k, stage: "ask" } : null;
    }
    state.players.forEach(function (q) { q.put = 0; q.bet = 0; });
    const names = Object.keys(won).map(function (k) { const q = state.players.find(function (x) { return x.key === k; }); return q.name + " 赢 " + won[k] + (uncontested ? "" : "（" + PK_CAT[q.score[0]] + "）"); });
    state.log.push({ kind: "sys", text: (uncontested ? "其他人都弃了，" : "摊牌：") + names.join("，") + "。" });
    state.street = "done"; state.lastWon = won;
    return state;
  }
  function pkFinish(state) {
    state.status = "finished";
    const best = state.players.slice().sort(function (a, b) { return b.chips - a.chips; })[0];
    state.winner = best ? best.key : null;
    state.log.push({ kind: "sys", text: "收桌。" + state.players.map(function (p) { return p.name + " " + p.chips; }).join("，") + "。" });
    return state;
  }
  // 不调模型的一手：看手牌和公共牌的强弱，按跟注要付的比例决定
  function pkNpcMove(state, i, loose) {
    const p = state.players[i], o = pkOptions(state, i);
    let str;
    if (!state.board.length) { const a = p.hole[0].v, b = p.hole[1].v; str = (Math.max(a, b) + Math.min(a, b) / 2) / 21 + (a === b ? .35 : 0) + (p.hole[0].s === p.hole[1].s ? .06 : 0); }
    else { const sc = pkBest(p.hole.concat(state.board)); str = sc[0] / 4 + (sc[1] || 0) / 60; }
    str += (loose || 0);
    const potOdds = o.toCall / Math.max(1, pkPot(state) + o.toCall);
    if (str > .9 && o.canRaise) return { kind: "raise", to: Math.min(o.maxTo, Math.max(o.minRaiseTo, state.curBet + Math.round(pkPot(state) / 2))) };
    if (o.canCheck) return { kind: "check" };
    if (str > potOdds + .25 || o.toCall <= PK_BB / 2) return { kind: "call" };
    return { kind: "fold" };
  }
  function pkPublic(state, i) {
    const me = state.players[i], o = pkOptions(state, i);
    return "第 " + state.hand + " / " + PK_HANDS + " 手，" + ({ preflop: "翻牌前", flop: "翻牌圈", turn: "转牌圈", river: "河牌圈" })[state.street]
      + "。\n你的底牌：" + me.hole.map(cardName).join(" ") + "；公共牌：" + (state.board.map(cardName).join(" ") || "还没发")
      + "\n底池 " + pkPot(state) + "；你还有 " + me.chips + "；要跟 " + o.toCall + (o.canRaise ? "；加注最少加到 " + o.minRaiseTo + "，最多 " + o.maxTo + "（全押）" : "")
      + "\n桌上：" + state.players.filter(function (q) { return q.inHand; }).map(function (q) { return q.name + "（" + (q.folded ? "已弃" : q.allin ? "全押" : "剩 " + q.chips) + "，这圈下了 " + q.bet + "）"; }).join("、")
      + "\n最近：\n" + cardTalk(state, 8);
  }
  function PokerGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () {
      if (restored && restored.status === "playing") return restored;
      const g0 = pkNewGame(unoPlayers(props)); g0.truthOn = !!cfg.pkTruth; return g0;
    });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [say, setSay] = useState(""), [raiseTo, setRaiseTo] = useState(0);
    const running = useRef("");
    const current = state.players[state.turn], me = current && current.isUser && state.street !== "done" && pkCanAct(current);
    const spectate = cfg.mode === "spectate", soft = cfg.mode === "easy";
    const clone = function () { return JSON.parse(JSON.stringify(state)); };
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("poker"); return; }
      saveGameSnap("poker", { config: cfg, state: state, label: "第 " + state.hand + " 手 · 底池 " + pkPot(state) });
    }, [state]);
    useEffect(function () { if (me) setRaiseTo(pkOptions(state, state.turn).minRaiseTo); }, [state.turn, state.street, state.hand]);
    useEffect(function () {
      if (!current || current.isUser || state.status !== "playing" || state.street === "done" || !pkCanAct(current) || busy) return;
      const turnId = state.id + "#" + state.hand + "#" + state.street + "#" + current.key + "#" + state.log.length;
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const idx = state.turn;
      const fallback = function () { return pkNpcMove(state, idx, (soft ? -0.15 : 0) + cardStyle(current)); };
      const apply = function (a, delegated) {
        const n = clone();
        try { pkAct(n, a); } catch (e) { const fb = fallback(); fb.say = a && a.say; pkAct(n, fb); }
        if (delegated && n.log.length) n.log[n.log.length - 1].text += "（代）";
        setState(n);
      };
      if (current.isNpc || cardLocal(cfg)) { setTimeout(function () { try { apply(fallback()); } catch (e) { setError(e.message); } running.current = ""; setBusy(false); }, 700); return; }
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在亲自打德州扑克，不是在评论。保持你本人的声纹和性格，但先守规则。"
        + "\n每人两张底牌只自己看得见，桌上五张公共牌，最后用七张里最好的五张比大小。你可以弃牌、过牌（没人下注时）、跟注、加注、全押——怎么打照你这个人：谨慎的会算，冲动的爱全押，嘴硬的会诈。"
        + (soft ? "\n这一局你想让着对面的她一点：别太凶，牌不好就早点弃。" : "")
        + "\n只输出 JSON，不解释：{\"kind\":\"fold|check|call|raise|allin\",\"to\":加注加到多少（只有 raise 填）,\"say\":\"可空的一句桌上话\"}。桌上话可以诈唬、试探、挑衅、装可怜，不必每手都说，别把自己的底牌说出来（想骗就骗）。";
      routeSeatCall(current, api, sys, [{ role: "user", content: pkPublic(state, idx) + "\n现在轮到你。" }], { game: "poker", turnId: turnId, expect: "{\"kind\":\"fold|check|call|raise|allin\",\"to\":0,\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8400 } })
        .then(function (r) { const a = unoJson(r.value); apply(["fold", "check", "call", "raise", "allin"].indexOf(a.kind) >= 0 ? { kind: a.kind, to: a.to, say: a.say } : fallback(), r.delegated); })
        .catch(function () { try { apply(fallback()); } catch (e2) { setError("这手没接稳：" + e2.message); } })
        .finally(function () { running.current = ""; setBusy(false); });
    }, [state, busy]);
    function userAct(a) { try { const n = clone(); pkAct(n, Object.assign({}, a, { say: say })); setState(n); setSay(""); setError(""); } catch (e) { setError(e.message); } }
    function nextHand() { const n = clone(); pkNewHand(n); setState(n); }
    const u = state.players.find(function (p) { return p.isUser; });
    const o = me ? pkOptions(state, state.turn) : null;
    const show = function (p) { return p.isUser || spectate || (state.showdown && state.showdown.some(function (s) { return s.key === p.key; })) || state.status === "finished"; };
    const btn = function (label, onClick, color, dis, o) { const wk = o && o.wk; return h("button", { "data-wk": wk || undefined, onClick: onClick, disabled: dis, style: { border: 0, borderRadius: 999, padding: "11px 8px", color: "#fff", background: dis ? t.line : color, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, label); };
    const talking = useCardTableTalk(props, state, setState, { on: cardLocal(cfg), zh: "德州扑克", ready: !!me || state.street === "done" || state.status === "finished", every: spectate ? state.players.length * 2 : 0,
      view: function () { return "第 " + state.hand + " / " + PK_HANDS + " 手；公共牌：" + (state.board.map(cardName).join(" ") || "还没发") + "；底池 " + pkPot(state)
        + "\n" + state.players.map(function (q) { return q.name + "：" + (q.folded ? "已弃" : q.allin ? "全押" : "剩 " + q.chips); }).join("，") + "\n最近：\n" + cardPublicLog(state); } });
    // 真心话：TA 问 → 一次调用（TA 问、对面角色顺手答）；她问 → 她写一句，再调一次让 TA 答；她答 → 她写一句就完
    const [truthLine, setTruthLine] = useState(""), [truthBusy, setTruthBusy] = useState(false);
    const tr = state.truth, trA = tr && state.players.find(function (q) { return q.key === tr.asker; }), trB = tr && state.players.find(function (q) { return q.key === tr.answerer; });
    const truthPush = function (rows, mine, stage) {
      setState(function (prev) { const n = JSON.parse(JSON.stringify(prev));
        if (mine) n.log.push({ kind: "chat", player: "user", text: userName(props.profile) + "：“" + mine + "”" });
        (rows || []).forEach(function (r) { n.log.push({ kind: "chat", player: r.p.key, text: r.p.name + "：“" + r.say + "”" }); });
        if (n.truth) n.truth.stage = stage; return n; });
    };
    const truthTalk = function (who, instr) {
      const seats = state.players.filter(function (q) { return who.indexOf(q.key) >= 0 && !q.isUser && !q.engineer; });
      return seats.length && api ? cardTableTalk(api, "德州扑克", seats, "【这一下一定要有】" + instr + "\n最近：\n" + cardPublicLog(state)) : Promise.resolve([]);
    };
    useEffect(function () {
      if (!tr || tr.stage !== "ask" || !trA || trA.isUser || truthBusy) return;
      setTruthBusy(true);
      truthTalk([trA.key, trB.key], "这一手 " + trA.name + " 赢得最多、" + trB.name + " 输得最多。按开局说好的，" + trA.name + " 问 " + trB.name + " 一个真心话问题，照 TA 俩的关系问，问点真想知道的。"
        + (trB.isUser ? "只写 " + trA.name + " 问的那一句。" : "然后 " + trB.name + " 照实回答（可以别扭、嘴硬，但得答）。只写这两句。"))
        .then(function (rows) { truthPush(rows, "", trB.isUser ? "answer" : "done"); })
        .catch(function () { truthPush([], "", "done"); })
        .finally(function () { setTruthBusy(false); });
    }, [tr && tr.stage, tr && tr.asker, state.hand]);
    function truthSend() {
      const line = truthLine.trim(); if (!line || !tr) return;
      setTruthLine("");
      if (tr.stage === "answer") { truthPush([], line, "done"); return; }
      truthPush([], line, "wait"); setTruthBusy(true);
      truthTalk([trB.key], "她这一手赢得最多，刚问了 " + trB.name + " 一个真心话：「" + line + "」。" + trB.name + " 照实回答（可以别扭、嘴硬，但得答）。只写 " + trB.name + " 那一句。")
        .then(function (rows) { truthPush(rows, "", "done"); }).catch(function () { truthPush([], "", "done"); }).finally(function () { setTruthBusy(false); });
    }
    const truthAskOf = tr && trA && !trA.isUser ? cardSayOf(state.log.slice().reverse().find(function (x) { return x.kind === "chat" && x.player === trA.key; })) : "";
    return h("div", { "data-wk": "gameplay", "data-part": "poker", className: "h-full flex flex-col", style: gameTable("poker", t) },
      h(Head, { zh: "德州扑克", en: state.status === "finished" ? "收桌" : ("第 " + state.hand + " / " + PK_HANDS + " 手" + (current && state.street !== "done" ? " · 轮到 " + current.name : "")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(CardSeats, { t: t, evalOf: { host: props, key: "poker", zh: "德州扑克" }, log: state.log, seats: state.players.map(function (p, i) {
          return { key: p.key, name: p.name, dealer: i === state.dealer, chips: p.chips, char: cardSeatChar(props, p), isUser: p.isUser, on: i === state.turn && state.street !== "done" && state.status === "playing", out: p.chips <= 0 && !p.inHand,
            hot: !!(state.lastWon && state.lastWon[p.key] && state.street === "done"), sub: p.folded && p.inHand ? "弃了 · " + p.chips : p.allin ? "全押" : String(p.chips) };
        }) }),
        feltBox([
          h("div", { key: "a", style: { display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "rgba(0,0,0,.22)", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
            h(ChipStack, { n: pkPot(state), unit: 120, size: 16 }), h("b", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", letterSpacing: ".02em" } }, pkPot(state)),
            state.street !== "done" && state.curBet ? h("span", { style: { opacity: .75, fontSize: "calc(11.5px * var(--app-fs, 1))" } }, "跟到 " + state.curBet) : null),
          h("div", { key: "b", style: { display: "flex", justifyContent: "center", gap: 6, marginTop: 12, minHeight: 64 } }, [0, 1, 2, 3, 4].map(function (k) { return h(PlayCard, { key: k + (state.board[k] ? "c" + state.hand : "g"), c: state.board[k], ghost: !state.board[k], w: 46 }); })),
          h("div", { key: "c", "data-wk": "gamepokerhands", style: { marginTop: 14, display: "flex", flexDirection: "column", gap: 6 } }, state.players.filter(function (p) { return p.inHand; }).map(function (p) {
            const sd = state.showdown && state.showdown.find(function (s) { return s.key === p.key; });
            return h("div", { "data-wk": "block", key: p.key, style: { display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.18)", borderRadius: 11, padding: "5px 9px", opacity: p.folded ? .5 : 1 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", width: 64, textAlign: "left", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
              p.hole.map(function (c, j) { return h(PlayCard, { key: j + (show(p) ? "o" : "x") + state.hand, c: show(p) ? c : null, back: !show(p), flip: show(p) && !p.isUser && !spectate, w: 30 }); }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .85, marginLeft: 4 } }, sd ? sd.cat : p.folded ? "弃牌" : ""));
          }))
        ], "poker"),
        tr && trA && trB && tr.stage !== "done" ? h("div", { "data-wk": "gamepktruthbox", style: { marginBottom: 10, padding: "11px 13px", borderRadius: 14, background: t.bg2, border: "1px dashed " + t.tint } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.6 } },
            tr.stage === "ask" && trA.isUser ? "这一手你赢得最多，问 " + trB.name + " 一个真心话：" : tr.stage === "answer" && trB.isUser ? trA.name + " 问你：" + (truthAskOf || "（看上面那句）") : truthBusy || tr.stage === "wait" ? "真心话进行中…" : trA.name + " 要问 " + trB.name + " 一个真心话…"),
          (tr.stage === "ask" && trA.isUser) || (tr.stage === "answer" && trB.isUser) ? h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            h("input", { "data-wk": "input", value: truthLine, onChange: function (e) { setTruthLine(e.target.value); }, placeholder: tr.stage === "ask" ? "问一句…" : "照实说…", style: { flex: 1, minWidth: 0, border: "1px solid " + t.line, borderRadius: 999, padding: "8px 12px", background: t.bg, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
            h("button", { onClick: truthSend, disabled: !truthLine.trim() || truthBusy, style: { border: 0, borderRadius: 999, padding: "8px 14px", color: "#fff", background: truthLine.trim() ? t.tint : t.line, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, tr.stage === "ask" ? "问" : "答"),
            h("button", { onClick: function () { truthPush([], "", "done"); }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "8px 10px", color: t.sub, background: "transparent", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "算了")) : null) : null,
        h(CardLog, { t: t, part: "poker", log: state.log, talking: talking }),
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          ((state.players.find(function (p) { return p.key === state.winner; }) || {}).name || "没人") + " 筹码最多！",
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const w = state.players.find(function (p) { return p.key === state.winner; });
            return { key: "poker", zh: "德州扑克", ids: realCharIds(state.players), wins: w && realCharIds(state.players).indexOf(w.key) >= 0 ? [w.key] : [], meWin: u ? !!(w && w.isUser) : null,
              text: "一起打了一局德州扑克，" + state.hand + " 手收桌，" + ((w && (w.isUser ? "她" : w.name)) || "没人") + " 筹码最多。" + state.players.map(function (p) { return (p.isUser ? "她" : p.name) + " " + p.chips; }).join("，") + "。" };
          } })) : null),
      state.status === "playing" && state.street === "done" ? h("div", { "data-wk": "gameactions", "data-part": "poker", "data-kind": "next", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", textAlign: "center" } },
        h("button", { "data-wk": "gamepokernext", onClick: nextHand, style: { border: 0, borderRadius: 999, padding: "11px 26px", color: "#fff", background: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, state.hand >= PK_HANDS ? "收桌算账" : "发下一手")) :
      state.status === "playing" && me && o ? h("div", { "data-wk": "gameactions", "data-part": "poker", "data-kind": "bet", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        o.canRaise ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, flexShrink: 0 } }, "加到"),
          h("input", { type: "range", min: o.minRaiseTo, max: o.maxTo, step: 10, value: Math.min(o.maxTo, Math.max(o.minRaiseTo, raiseTo)), onChange: function (e) { setRaiseTo(Number(e.target.value)); }, style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, minWidth: 44, textAlign: "right" } }, Math.min(o.maxTo, Math.max(o.minRaiseTo, raiseTo)))) : null,
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: say, onChange: function (e) { setSay(e.target.value); }, placeholder: "顺便说一句（可空，想诈就诈）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", marginBottom: 8, background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 } },
          btn("弃牌", function () { userAct({ kind: "fold" }); }, "#7a6f66", false, { wk: "gamepokerfold" }),
          btn(o.canCheck ? "过牌" : "跟 " + o.toCall, function () { userAct({ kind: o.canCheck ? "check" : "call" }); }, t.ink, false, { wk: "gamepokercall" }),
          btn("加注", function () { userAct({ kind: "raise", to: Math.min(o.maxTo, Math.max(o.minRaiseTo, raiseTo)) }); }, t.tint, !o.canRaise, { wk: "gamepokerraise" }),
          btn("全押", function () { userAct({ kind: "allin" }); }, "#c0553f", false, { wk: "gamepokerallin" }))) :
      busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, (current ? current.name : "TA") + " 在看牌…") : null);
  }

  // ---------------- 抽鬼牌 ----------------
  // 每个点数两张（凑对就扔），外加一张鬼牌。轮流从下家手里抽一张，凑成对就扔；最后手里剩鬼牌的输。
  // 牌的张数跟人数走：人越多点数越多，一局大概十来手。
  function omRanks(n) { return Math.min(13, 3 + 3 * n); }
  function omDiscardPairs(hand) {
    const out = [], seen = {};
    hand.forEach(function (c) { if (c.joker) { out.push(c); return; } if (seen[c.r] !== undefined) { out.splice(seen[c.r], 1); Object.keys(seen).forEach(function (k) { if (seen[k] > seen[c.r]) seen[k]--; }); delete seen[c.r]; } else { seen[c.r] = out.length; out.push(c); } });
    return out;
  }
  function omNewGame(players, rnd) {
    const ranks = CARD_RANKS.slice(-omRanks(players.length)), deck = [];
    ranks.forEach(function (r, i) { deck.push({ r: r, s: "♠", v: i }, { r: r, s: "♥", v: i }); });
    deck.push({ joker: true, r: "JK", s: "", v: 99 });
    cardShuffle(deck, rnd);
    const ps = players.map(function (p) { return Object.assign({}, p, { hand: [], out: false }); });
    deck.forEach(function (c, i) { ps[i % ps.length].hand.push(c); });
    ps.forEach(function (p) { p.hand = cardShuffle(omDiscardPairs(p.hand), rnd); });
    const state = { id: "oldmaid_" + Date.now().toString(36), status: "playing", log: [{ kind: "sys", text: "发好牌了，能凑对的先扔掉。轮流从下家手里抽一张，最后拿着鬼牌的人输。" }], players: ps, turn: 0, loser: null, last: null };
    omSettle(state);
    return state;
  }
  function omActive(state) { return state.players.filter(function (p) { return !p.out; }); }
  function omSettle(state) {
    state.players.forEach(function (p) { if (!p.out && p.hand.length === 0) { p.out = true; state.log.push({ kind: "sys", text: p.name + " 手里清空了，安全上岸。" }); } });
    const left = omActive(state);
    if (left.length <= 1) { state.status = "finished"; state.loser = left[0] ? left[0].key : null; state.log.push({ kind: "sys", text: (left[0] ? left[0].name + " 最后拿着鬼牌" : "没人拿着鬼牌") + "，输了。" }); }
    else if (state.players[state.turn].out) state.turn = omNextActive(state, state.turn);
    return state;
  }
  function omNextActive(state, from) { const L = state.players.length; for (let i = 1; i <= L; i++) { const j = (from + i) % L; if (!state.players[j].out) return j; } return from; }
  function omTarget(state) { return omNextActive(state, state.turn); }
  // 一手：从下家手里抽第 pick 张（从左数，0 起）
  function omAct(state, pick, say, rnd) {
    const p = state.players[state.turn], ti = omTarget(state), tg = state.players[ti];
    if (!p || state.status !== "playing") throw new Error("现在不是抽牌的时候");
    const k = Math.max(0, Math.min(tg.hand.length - 1, Math.floor(Number(pick) || 0)));
    const c = tg.hand.splice(k, 1)[0];
    const pair = !c.joker && p.hand.findIndex(function (x) { return x.r === c.r; });
    let txt = p.name + " 从 " + tg.name + " 手里抽了第 " + (k + 1) + " 张";
    if (!c.joker && pair >= 0) { p.hand.splice(pair, 1); txt += "，凑成一对 " + c.r + " 扔了"; }
    else { p.hand.push(c); cardShuffle(p.hand, rnd); txt += c.joker ? (p.isUser ? "——是鬼牌！" : "") : ""; }
    state.last = { by: p.key, from: tg.key, pos: k, joker: !!c.joker, paired: !c.joker && pair >= 0 };
    state.log.push({ kind: "move", player: p.key, text: txt + (say ? "　“" + String(say).slice(0, 160) + "”" : "") });
    state.turn = omNextActive(state, state.turn);
    return omSettle(state);
  }
  function OldMaidGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () { return restored && restored.status === "playing" ? restored : omNewGame(unoPlayers(props, 4)); });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [say, setSay] = useState(""), [hover, setHover] = useState(-1);
    const running = useRef("");
    const current = state.players[state.turn], me = current && current.isUser && state.status === "playing";
    const spectate = cfg.mode === "spectate";
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("oldmaid"); return; }
      saveGameSnap("oldmaid", { config: cfg, state: state, label: "还剩 " + omActive(state).length + " 人在抽" });
    }, [state]);
    useEffect(function () {
      if (!current || current.isUser || state.status !== "playing" || busy) return;
      const turnId = state.id + "#" + state.log.length + "#" + current.key;
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const ti = omTarget(state), tg = state.players[ti], n0 = tg.hand.length;
      const apply = function (pick, sayLine, delegated) {
        const n = JSON.parse(JSON.stringify(state));
        omAct(n, pick, sayLine);
        if (delegated && n.log.length) n.log[n.log.length - 1].text += "（代）";
        setState(n);
      };
      const rndPick = function () { return Math.floor(Math.random() * n0); };
      if (current.isNpc || cardLocal(cfg, "oldmaid")) { setTimeout(function () { try { apply(rndPick()); } catch (e) { setError(e.message); } running.current = ""; setBusy(false); }, 700); return; }
      const mine = current.hand.map(cardName).join(" ");
      const lastLine = state.last ? (state.players.find(function (p) { return p.key === state.last.by; }) || {}).name + " 上一手抽了 " + (state.players.find(function (p) { return p.key === state.last.from; }) || {}).name + " 的第 " + (state.last.pos + 1) + " 张" + (state.last.paired ? "，凑了对" : "") : "";
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在亲自玩「抽鬼牌」，不是在评论。保持你本人的声纹和性格。"
        + "\n规则：每个点数两张，凑成对就扔掉；牌里有一张鬼牌。轮流从下家手里扣着的牌里抽一张，最后手里剩鬼牌的人输。你看不见别人的牌，只能挑位置——可以盯着对方的手和表情猜，也可以随便抽。"
        + "\n只输出 JSON：{\"pick\":从左数第几张（1 到 " + n0 + "）,\"say\":\"可空的一句：试探、得意、慌张、逗对方都行\"}。别说出自己手里有没有鬼牌（想骗就骗）。";
      const ctx = "你手里：" + (mine || "（空）") + (current.hand.some(function (c) { return c.joker; }) ? "——鬼牌在你手里，别让人看出来" : "")
        + "\n这回你要从 " + tg.name + " 手里抽，TA 扣着 " + n0 + " 张。" + (lastLine ? "\n" + lastLine : "") + "\n最近：\n" + cardTalk(state, 8);
      routeSeatCall(current, api, sys, [{ role: "user", content: ctx }], { game: "oldmaid", turnId: turnId, expect: "{\"pick\":1,\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8300 } })
        .then(function (r) { const a = unoJson(r.value); const k = Math.floor(Number(a.pick) || 0) - 1; apply(k >= 0 && k < n0 ? k : rndPick(), a.say, r.delegated); })
        .catch(function () { try { apply(rndPick()); } catch (e2) { setError("这手没接稳：" + e2.message); } })
        .finally(function () { running.current = ""; setBusy(false); });
    }, [state, busy]);
    function userPick(k) { try { const n = JSON.parse(JSON.stringify(state)); omAct(n, k, say); setState(n); setSay(""); setHover(-1); setError(""); } catch (e) { setError(e.message); } }
    const u = state.players.find(function (p) { return p.isUser; });
    const tgIdx = me ? omTarget(state) : -1, tg = tgIdx >= 0 ? state.players[tgIdx] : null;
    const talking = useCardTableTalk(props, state, setState, { on: true, zh: "抽鬼牌", ready: !!me || state.status === "finished", every: spectate ? state.players.length * 2 : 0,
      view: function () { return state.players.map(function (q) { return q.name + "：" + (q.out ? "已经上岸" : "手里 " + q.hand.length + " 张"); }).join("，") + "\n最近：\n" + cardPublicLog(state); } });
    return h("div", { "data-wk": "gameplay", "data-part": "oldmaid", className: "h-full flex flex-col", style: gameTable("oldmaid", t) },
      h(Head, { zh: "抽鬼牌", en: state.status === "finished" ? "终局" : ("轮到 " + (current ? current.name : "—")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(CardSeats, { t: t, evalOf: { host: props, key: "oldmaid", zh: "抽鬼牌" }, log: state.log, seats: state.players.map(function (p, i) {
          return { key: p.key, name: p.name, cards: p.out ? 0 : p.hand.length, char: cardSeatChar(props, p), isUser: p.isUser, on: i === state.turn && state.status === "playing", out: p.out, hot: state.loser === p.key, sub: p.out ? "上岸" : p.hand.length + " 张" };
        }) }),
        feltBox(state.players.filter(function (p) { return !p.out && (!p.isUser || state.status === "finished"); }).map(function (p) {
          const open = spectate || state.status === "finished";
          return h("div", { key: p.key, style: { marginBottom: 10 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .8, marginBottom: 6 } }, p.name + " 手里" + (tg && tg.key === p.key ? " · 点一张抽走" : "")),
            h("div", { style: { display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" } }, p.hand.map(function (c, j) {
              const mine = tg && tg.key === p.key;
              return h(PlayCard, { key: j, c: open ? c : null, back: !open, w: 34, lift: mine && hover === j, hot: open && c.joker, onClick: mine ? function () { if (hover === j) userPick(j); else setHover(j); } : null });
            })));
        }).concat(state.status === "finished" && !state.players.some(function (p) { return !p.out; }) ? [] : []), "oldmaid"),
        u && !u.out && state.status === "playing" ? h("div", { "data-wk": "gameoldmaidmine", style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginRight: 4 } }, "我手里"),
          u.hand.map(function (c, j) { return h(PlayCard, { key: j, c: c, w: 32, hot: c.joker }); })) : null,
        h(CardLog, { t: t, part: "oldmaid", log: state.log, talking: talking }),
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          ((state.players.find(function (p) { return p.key === state.loser; }) || {}).name || "没人") + " 拿着鬼牌，输了！",
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const l = state.players.find(function (p) { return p.key === state.loser; });
            const ids = realCharIds(state.players);
            return { key: "oldmaid", zh: "抽鬼牌", ids: ids, wins: ids.filter(function (id) { return !l || id !== l.key; }), meWin: u ? !(l && l.isUser) : null,
              text: "一起玩了一局抽鬼牌，最后鬼牌落在" + ((l && (l.isUser ? "她" : l.name)) || "没人") + "手里。" };
          } })) : null),
      me ? h("div", { "data-wk": "gameactions", "data-part": "oldmaid", "data-kind": "pick", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 7, textAlign: "center" } }, hover >= 0 ? "再点一下第 " + (hover + 1) + " 张就抽走，或者换一张" : "点 " + (tg ? tg.name : "TA") + " 的一张牌（点一下先举起来，再点一下抽走）"),
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: say, onChange: function (e) { setSay(e.target.value); }, placeholder: "顺便说一句（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } })) :
      busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, (current ? current.name : "TA") + " 的手悬在牌上…") : null);
  }

  // ---------------- 21 点 ----------------
  // 庄家是牌桌（不是谁），一律要到 17 点；你和 TA 们各自跟庄家比。每手各押 10，一共 8 手，筹码最多的赢。
  const BJ_CHIPS = 100, BJ_BET = 10, BJ_HANDS = 8;
  function bjValue(cards) {
    let v = 0, aces = 0;
    cards.forEach(function (c) { if (c.r === "A") { aces++; v += 11; } else v += ["J", "Q", "K"].indexOf(c.r) >= 0 ? 10 : Number(c.r); });
    while (v > 21 && aces) { v -= 10; aces--; }
    return v;
  }
  // dealerKey：哪个座位坐庄（她 2026-10-16「21 点让 TA 当庄」）。坐庄的不下注、不要牌，手里那两张就是庄家的牌；
  //   大家赢的从 TA 筹码里出、输的进 TA 口袋。不给就是手机发牌，谁也不偏。
  function bjNewGame(players, rnd, dealerKey) {
    const hasDealer = !!dealerKey && players.some(function (p) { return p.key === dealerKey; }) && players.length > 1;
    const state = { id: "bj_" + Date.now().toString(36), status: "playing", hand: 0, log: [], dealer: [], winner: null,
      players: players.map(function (p) { const d = hasDealer && p.key === dealerKey; return Object.assign({}, p, { chips: d ? BJ_CHIPS * 2 : BJ_CHIPS, cards: [], bet: 0, done: false, result: "", isDealer: d }); }) };
    return bjNewHand(state, rnd);
  }
  function bjNewHand(state, rnd) {
    if (state.hand >= BJ_HANDS || state.players.every(function (p) { return p.isDealer || p.chips < BJ_BET; })) return bjFinish(state);
    state.hand += 1; state.deck = cardDeck(rnd); state.dealer = [state.deck.pop(), state.deck.pop()]; state.phase = "play";
    state.players.forEach(function (p) {
      p.result = ""; p.cards = []; p.bet = 0; p.done = true;
      if (!p.isDealer && p.chips >= BJ_BET) { p.bet = BJ_BET; p.chips -= BJ_BET; p.cards = [state.deck.pop(), state.deck.pop()]; p.done = bjValue(p.cards) === 21; }
    });
    const dlr = state.players.find(function (p) { return p.isDealer; });
    state.log.push({ kind: "sys", text: "—— 第 " + state.hand + " / " + BJ_HANDS + " 手 · 每人押 " + BJ_BET + "，" + (dlr ? dlr.name + "坐庄" : "庄家") + "亮出 " + cardName(state.dealer[0]) + " ——" });
    state.turn = state.players.findIndex(function (p) { return !p.done; });
    if (state.turn < 0) bjDealer(state);
    return state;
  }
  // 一手：{kind:"hit"|"stand"|"double", say}
  function bjAct(state, action) {
    const p = state.players[state.turn];
    if (!p || p.done || state.phase !== "play") throw new Error("现在不是要牌的时候");
    const say = String((action && action.say) || "").trim().slice(0, 160);
    let k = action.kind;
    if (k === "double" && (p.cards.length !== 2 || p.chips < p.bet)) k = "hit";
    let txt;
    if (k === "stand") { p.done = true; txt = "停牌（" + bjValue(p.cards) + "）"; }
    else {
      if (k === "double") { p.chips -= p.bet; p.bet *= 2; }
      p.cards.push(state.deck.pop());
      const v = bjValue(p.cards);
      txt = (k === "double" ? "加倍，" : "要牌，") + "拿到 " + cardName(p.cards[p.cards.length - 1]) + "，" + v + " 点" + (v > 21 ? "，爆了" : "");
      if (v >= 21 || k === "double") p.done = true;
    }
    state.log.push({ kind: "move", player: p.key, text: p.name + "：" + txt + (say ? "　“" + say + "”" : "") });
    if (p.done) { state.turn = state.players.findIndex(function (q) { return !q.done; }); if (state.turn < 0) bjDealer(state); }
    return state;
  }
  function bjDealer(state) {
    const live = state.players.some(function (p) { return p.bet && bjValue(p.cards) <= 21; });
    while (live && bjValue(state.dealer) < 17) state.dealer.push(state.deck.pop());
    const dv = bjValue(state.dealer), dbj = dv === 21 && state.dealer.length === 2, dlr = state.players.find(function (p) { return p.isDealer; });
    state.log.push({ kind: "sys", text: (dlr ? dlr.name + "（庄）" : "庄家") + "：" + state.dealer.map(cardName).join(" ") + "，" + dv + " 点" + (dv > 21 ? "，爆了" : "") });
    state.players.forEach(function (p) {
      if (!p.bet) return;
      const v = bjValue(p.cards), bj = v === 21 && p.cards.length === 2;
      let win = 0;
      if (v > 21) { p.result = "爆"; }
      else if (bj && !dbj) { win = Math.floor(p.bet * 2.5); p.result = "黑杰克"; }
      else if (dv > 21 || v > dv) { win = p.bet * 2; p.result = "赢"; }
      else if (v === dv) { win = p.bet; p.result = "平"; }
      else p.result = "输";
      p.chips += win;
      if (dlr) dlr.chips += p.bet - win;   // 庄家是 TA：赢的从 TA 那儿出，输的进 TA 口袋
    });
    state.log.push({ kind: "sys", text: state.players.filter(function (p) { return p.bet; }).map(function (p) { return p.name + " " + p.result; }).join("，") + "。" });
    state.phase = "done"; state.turn = -1;
    return state;
  }
  function bjFinish(state) {
    state.status = "finished"; state.phase = "done";
    const best = state.players.slice().sort(function (a, b) { return b.chips - a.chips; })[0];
    state.winner = best ? best.key : null;
    state.log.push({ kind: "sys", text: "散场。" + state.players.map(function (p) { return p.name + " " + p.chips; }).join("，") + "。" });
    return state;
  }
  function bjNpcMove(state, i, soft) { const p = state.players[i], v = bjValue(p.cards); return { kind: v <= 11 && p.cards.length === 2 && !soft ? "double" : v < (soft ? 15 : 17) ? "hit" : "stand" }; }
  function BlackjackGame(props) {
    const t = props.t, api = props.active, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () { return restored && restored.status === "playing" ? restored : bjNewGame(unoPlayers(props, 4), undefined, cfg.bjDealer === "ta" && (cfg.charIds || [])[0] ? String(cfg.charIds[0]) : null); });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [say, setSay] = useState("");
    const running = useRef("");
    const current = state.turn >= 0 ? state.players[state.turn] : null, me = current && current.isUser && state.phase === "play";
    const soft = cfg.mode === "easy";
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("blackjack"); return; }
      saveGameSnap("blackjack", { config: cfg, state: state, label: "第 " + state.hand + " 手" });
    }, [state]);
    useEffect(function () {
      if (!current || current.isUser || state.phase !== "play" || state.status !== "playing" || busy) return;
      const turnId = state.id + "#" + state.hand + "#" + current.key + "#" + current.cards.length;
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const idx = state.turn;
      const apply = function (a, delegated) { const n = JSON.parse(JSON.stringify(state)); try { bjAct(n, a); } catch (e) { const fb = bjNpcMove(state, idx, soft); fb.say = a && a.say; bjAct(n, fb); } if (delegated && n.log.length) n.log[n.log.length - 1].text += "（代）"; setState(n); };
      if (current.isNpc || cardLocal(cfg)) { setTimeout(function () { try { apply(bjNpcMove(state, idx, soft)); } catch (e) { setError(e.message); } running.current = ""; setBusy(false); }, 650); return; }
      const sys = gameVoiceRules() + seatIdentity(current) + "你正在亲自玩 21 点（跟庄家比，不是跟别人比），不是在评论。保持你本人的声纹和性格。"
        + "\n规则：点数越接近 21 越好，超过 21 就爆；A 算 1 或 11，JQK 算 10。庄家要到 17 点为止。你可以要牌、停牌，或者只在头两张时加倍（押注翻倍、只再拿一张）。冒不冒险照你这个人来。"
        + "\n只输出 JSON：{\"kind\":\"hit|stand|double\",\"say\":\"可空的一句：紧张、嘴硬、得意、跟旁边的人搭话都行\"}。";
      const ctx = "第 " + state.hand + " / " + BJ_HANDS + " 手。你手里：" + current.cards.map(cardName).join(" ") + "，" + bjValue(current.cards) + " 点；你还剩 " + current.chips + "，这手押了 " + current.bet
        + "\n庄家亮着：" + cardName(state.dealer[0]) + "\n桌上其他人：" + state.players.filter(function (p) { return p !== current && p.bet; }).map(function (p) { return p.name + " " + p.cards.map(cardName).join(" "); }).join("；")
        + "\n最近：\n" + cardTalk(state, 6);
      routeSeatCall(current, api, sys, [{ role: "user", content: ctx + "\n现在轮到你。" }], { game: "blackjack", turnId: turnId, expect: "{\"kind\":\"hit|stand|double\",\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 8300 } })
        .then(function (r) { const a = unoJson(r.value); apply(["hit", "stand", "double"].indexOf(a.kind) >= 0 ? { kind: a.kind, say: a.say } : bjNpcMove(state, idx, soft), r.delegated); })
        .catch(function () { try { apply(bjNpcMove(state, idx, soft)); } catch (e2) { setError("这手没接稳：" + e2.message); } })
        .finally(function () { running.current = ""; setBusy(false); });
    }, [state, busy]);
    function userAct(a) { try { const n = JSON.parse(JSON.stringify(state)); bjAct(n, Object.assign({}, a, { say: say })); setState(n); setSay(""); setError(""); } catch (e) { setError(e.message); } }
    function nextHand() { const n = JSON.parse(JSON.stringify(state)); bjNewHand(n); setState(n); }
    const u = state.players.find(function (p) { return p.isUser; });
    const btn = function (label, onClick, color, dis, o) { const wk = o && o.wk; return h("button", { "data-wk": wk || undefined, onClick: onClick, disabled: dis, style: { border: 0, borderRadius: 999, padding: "11px 8px", color: "#fff", background: dis ? t.line : color, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, label); };
    const showDealer = state.phase === "done";
    const talking = useCardTableTalk(props, state, setState, { on: cardLocal(cfg), zh: "21 点", ready: !!me || state.phase === "done" || state.status === "finished", every: 0,
      view: function () { const dl = state.players.find(function (q) { return q.isDealer; }); return "第 " + state.hand + " / " + BJ_HANDS + " 手；" + (dl ? dl.name + " 坐庄，大家都跟 TA 比，赢的从 TA 筹码里出" : "庄家是手机") + "；庄家" + (showDealer ? "：" + state.dealer.map(cardName).join(" ") + "，" + bjValue(state.dealer) + " 点" : "亮着 " + cardName(state.dealer[0]))
        + "\n" + state.players.filter(function (q) { return q.bet; }).map(function (q) { return q.name + "：" + q.cards.map(cardName).join(" ") + "，" + bjValue(q.cards) + " 点" + (q.result ? "，" + q.result : "") + "，剩 " + q.chips; }).join("；") + "\n最近：\n" + cardPublicLog(state); } });
    return h("div", { "data-wk": "gameplay", "data-part": "blackjack", className: "h-full flex flex-col", style: gameTable("blackjack", t) },
      h(Head, { zh: "21 点", en: state.status === "finished" ? "散场" : ("第 " + state.hand + " / " + BJ_HANDS + " 手" + (current ? " · 轮到 " + current.name : "")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(CardSeats, { t: t, evalOf: { host: props, key: "blackjack", zh: "21 点" }, log: state.log, seats: state.players.map(function (p, i) { return { key: p.key, name: p.name, chips: p.chips, unit: 25, dealer: p.isDealer, char: cardSeatChar(props, p), isUser: p.isUser, on: i === state.turn && state.phase === "play", out: !p.isDealer && p.chips < BJ_BET && !p.bet, hot: p.result === "赢" || p.result === "黑杰克", sub: (p.isDealer ? "坐庄 · " : p.result ? p.result + " · " : "") + p.chips }; }) }),
        feltBox([
          h("div", { key: "d", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .8 } }, ((state.players.find(function (p) { return p.isDealer; }) || {}).name ? state.players.find(function (p) { return p.isDealer; }).name + " 坐庄" : "庄家") + (showDealer ? " · " + bjValue(state.dealer) + " 点" : "")),
          h("div", { key: "dc", style: { display: "flex", justifyContent: "center", gap: 5, margin: "6px 0 12px" } }, state.dealer.map(function (c, j) { return h(PlayCard, { key: j + (j > 0 && showDealer ? "o" : "c") + state.hand, c: c, back: !showDealer && j > 0, flip: showDealer && j > 0, w: 46 }); })),
          h("div", { key: "ps", "data-wk": "gamebjhands", style: { display: "flex", flexDirection: "column", gap: 6 } }, state.players.filter(function (p) { return p.bet; }).map(function (p) {
            return h("div", { "data-wk": "block", key: p.key, style: { display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.18)", borderRadius: 11, padding: "5px 9px" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", width: 60, textAlign: "left", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
              p.cards.map(function (c, j) { return h(PlayCard, { key: j + "_" + state.hand, c: c, w: 30 }); }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginLeft: "auto" } }, bjValue(p.cards) + " 点" + (p.result ? " · " + p.result : "")));
          }))
        ], "blackjack"),
        h(CardLog, { t: t, part: "blackjack", log: state.log, talking: talking }),
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          ((state.players.find(function (p) { return p.key === state.winner; }) || {}).name || "没人") + " 筹码最多！",
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const w = state.players.find(function (p) { return p.key === state.winner; });
            return { key: "blackjack", zh: "21 点", ids: realCharIds(state.players), wins: w && realCharIds(state.players).indexOf(w.key) >= 0 ? [w.key] : [], meWin: u ? !!(w && w.isUser) : null,
              text: "一起玩了 " + state.hand + " 手 21 点，" + ((w && (w.isUser ? "她" : w.name)) || "没人") + " 筹码最多。" + state.players.map(function (p) { return (p.isUser ? "她" : p.name) + " " + p.chips; }).join("，") + "。" };
          } })) : null),
      state.status === "playing" && state.phase === "done" ? h("div", { "data-wk": "gameactions", "data-part": "blackjack", "data-kind": "next", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", textAlign: "center" } },
        h("button", { "data-wk": "gamebjnext", onClick: nextHand, style: { border: 0, borderRadius: 999, padding: "11px 26px", color: "#fff", background: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, state.hand >= BJ_HANDS ? "散场算账" : "发下一手")) :
      me ? h("div", { "data-wk": "gameactions", "data-part": "blackjack", "data-kind": "play", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: say, onChange: function (e) { setSay(e.target.value); }, placeholder: "顺便说一句（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", marginBottom: 8, background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } },
          btn("要牌", function () { userAct({ kind: "hit" }); }, t.tint, false, { wk: "gamebjhit" }),
          btn("停牌", function () { userAct({ kind: "stand" }); }, t.ink, false, { wk: "gamebjstand" }),
          btn("加倍", function () { userAct({ kind: "double" }); }, "#c0553f", !(current.cards.length === 2 && current.chips >= current.bet), { wk: "gamebjdouble" }))) :
      busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, (current ? current.name : "TA") + " 在想要不要再来一张…") : null);
  }

  // ---------------- 斗地主（她 2026-10-16「都做了宝宝」）----------------
  // 一副 54 张，三个人各 17、底牌 3 张。叫分 1~3，叫得最高的当地主拿底牌先出；
  // 牌型、能不能压、谁出完、算分全在本机。出牌一律手机来（组合太多，交给模型挑又贵又乱），
  // TA 们只负责一圈说一次桌上话（useCardTableTalk）——跟「手机出牌」那一档同一套。
  const DDZ_ROUNDS = 5;
  const DDZ_RZH = { 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王" };
  function ddzRankName(v) { return DDZ_RZH[v] || String(v); }
  function ddzDeck(rnd) {
    const d = cardDeck(rnd).map(function (c) { return { r: c.r, s: c.s, v: c.r === "2" ? 15 : c.v, uid: c.s + c.r }; });
    d.push({ joker: true, r: "小王", s: "", v: 16, uid: "SJ" }, { joker: true, r: "大王", s: "", v: 17, uid: "BJ" });
    return cardShuffle(d, rnd);
  }
  function ddzSort(hand) { return hand.slice().sort(function (a, b) { return a.v - b.v || String(a.s).localeCompare(String(b.s)); }); }
  function ddzCounts(cards) { const m = {}; cards.forEach(function (c) { m[c.v] = (m[c.v] || 0) + 1; }); return m; }
  // 认牌型：返回 { type, main, len } 或 null。main 用来比大小，len 管顺子、连对、飞机有几节
  function ddzAnalyze(cards) {
    const n = cards.length; if (!n) return null;
    const cnt = ddzCounts(cards), ranks = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
    const of = function (k) { return ranks.filter(function (r) { return cnt[r] === k; }); };
    const run = function (rs) { if (rs.length < 2) return false; if (rs[rs.length - 1] > 14) return false; for (let i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false; return true; };
    if (n === 1) return { type: "single", main: ranks[0], len: 1 };
    if (n === 2 && cnt[16] && cnt[17]) return { type: "rocket", main: 17, len: 1 };
    if (n === 2 && ranks.length === 1) return { type: "pair", main: ranks[0], len: 1 };
    if (n === 3 && ranks.length === 1) return { type: "trio", main: ranks[0], len: 1 };
    if (n === 4 && ranks.length === 1) return { type: "bomb", main: ranks[0], len: 1 };
    if (n === 4 && of(3).length === 1) return { type: "trio1", main: of(3)[0], len: 1 };
    if (n === 5 && of(3).length === 1 && of(2).length === 1) return { type: "trio2", main: of(3)[0], len: 1 };
    if (n >= 5 && ranks.length === n && run(ranks)) return { type: "straight", main: ranks[n - 1], len: n };
    if (n >= 6 && n % 2 === 0 && of(2).length === n / 2 && run(ranks)) return { type: "pairs", main: ranks[ranks.length - 1], len: n / 2 };
    if (n === 6 && of(4).length === 1) return { type: "four2", main: of(4)[0], len: 1 };
    if (n === 8 && of(4).length === 1 && of(2).length === 2) return { type: "four22", main: of(4)[0], len: 1 };
    // 飞机：连着的三张（2 和王不算），带 0 / 同数单张 / 同数对子
    const tri = ranks.filter(function (r) { return cnt[r] >= 3 && r <= 14; });
    for (let k = tri.length; k >= 2; k--) {
      for (let i = 0; i + k <= tri.length; i++) {
        const seg = tri.slice(i, i + k); if (!run(seg)) continue;
        const rest = {}; Object.keys(cnt).forEach(function (r) { rest[r] = cnt[r] - (seg.indexOf(Number(r)) >= 0 ? 3 : 0); });
        const left = Object.keys(rest).reduce(function (s, r) { return s + rest[r]; }, 0);
        if (left === 0 && n === 3 * k) return { type: "plane", main: seg[k - 1], len: k };
        if (left === k && n === 4 * k) return { type: "plane1", main: seg[k - 1], len: k };
        if (left === 2 * k && n === 5 * k && Object.keys(rest).every(function (r) { return rest[r] === 0 || rest[r] === 2; })) return { type: "plane2", main: seg[k - 1], len: k };
      }
    }
    return null;
  }
  function ddzBeats(a, b) {
    if (!a) return false; if (!b) return true;
    if (a.type === "rocket") return true; if (b.type === "rocket") return false;
    if (a.type === "bomb" && b.type !== "bomb") return true;
    return a.type === b.type && a.len === b.len && a.main > b.main;
  }
  const DDZ_TYPE_ZH = { single: "单张", pair: "对子", trio: "三张", trio1: "三带一", trio2: "三带二", straight: "顺子", pairs: "连对", plane: "飞机", plane1: "飞机带翅膀", plane2: "飞机带对子", four2: "四带二", four22: "四带两对", bomb: "炸弹", rocket: "王炸" };
  // 从手里挑 n 张某个点数的牌（按 uid 不重复）
  function ddzTake(hand, v, n, used) { const out = []; hand.forEach(function (c) { if (out.length < n && c.v === v && !used[c.uid]) { out.push(c); used[c.uid] = 1; } }); return out.length === n ? out : null; }
  // 带的牌：从最小的、没被占用的点数里挑；单张优先拿落单的，不拆炸弹、不拿王
  function ddzKickers(hand, used, k, size, avoid) {
    const cnt = {}; hand.forEach(function (c) { if (!used[c.uid]) cnt[c.v] = (cnt[c.v] || 0) + 1; });
    const ranks = Object.keys(cnt).map(Number).filter(function (r) { return avoid.indexOf(r) < 0 && cnt[r] >= size && cnt[r] < 4 && r < 16; })
      .sort(function (a, b) { return (cnt[a] === size ? 0 : 1) - (cnt[b] === size ? 0 : 1) || a - b; });
    if (ranks.length < k) return null;
    const out = []; ranks.slice(0, k).forEach(function (r) { out.push.apply(out, ddzTake(hand, r, size, used)); });
    return out;
  }
  // 照一个牌型找能压过去的最小那手（压不过返回 null）。free=自己领出，随便挑
  function ddzFind(hand, need) {
    const cnt = ddzCounts(hand), ranks = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
    const min = need ? need.main : 0, t = need ? need.type : null, L = need ? need.len : 0;
    const tryRun = function (size, len) {
      for (let top = Math.max(min + 1, 3 + len - 1); top <= 14; top++) {
        let ok = true; for (let r = top - len + 1; r <= top; r++) if (!(cnt[r] >= size)) { ok = false; break; }
        if (ok) { const used = {}, out = []; for (let r = top - len + 1; r <= top; r++) out.push.apply(out, ddzTake(hand, r, size, used)); return { cards: out, used: used, top: top }; }
      }
      return null;
    };
    if (t === "single" || t === "pair" || t === "trio" || t === "trio1" || t === "trio2") {
      const size = t === "single" ? 1 : t === "pair" ? 2 : 3;
      const cands = ranks.filter(function (r) { return r > min && cnt[r] >= size && cnt[r] < 4; }).sort(function (a, b) { return (cnt[a] === size ? 0 : 1) - (cnt[b] === size ? 0 : 1) || a - b; });
      for (let i = 0; i < cands.length; i++) {
        const used = {}, out = ddzTake(hand, cands[i], size, used);
        if (t === "trio1" || t === "trio2") { const k = ddzKickers(hand, used, 1, t === "trio1" ? 1 : 2, [cands[i]]); if (!k) continue; return out.concat(k); }
        return out;
      }
    } else if (t === "straight" || t === "pairs") {
      const r = tryRun(t === "straight" ? 1 : 2, L); if (r) return r.cards;
    } else if (t === "plane" || t === "plane1" || t === "plane2") {
      const r = tryRun(3, L);
      if (r) { if (t === "plane") return r.cards; const seg = []; for (let x = r.top - L + 1; x <= r.top; x++) seg.push(x); const k = ddzKickers(hand, r.used, L, t === "plane1" ? 1 : 2, seg); if (k) return r.cards.concat(k); }
    } else if (t === "four2" || t === "four22") {
      const b = ranks.filter(function (r) { return r > min && cnt[r] === 4; })[0];
      if (b) { const used = {}, out = ddzTake(hand, b, 4, used), k = ddzKickers(hand, used, 2, t === "four2" ? 1 : 2, [b]); if (k) return out.concat(k); }
    }
    return null;
  }
  function ddzBombs(hand, over) {
    const cnt = ddzCounts(hand), out = [];
    if (over && over.type === "rocket") return out;
    Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) { if (cnt[r] === 4 && (!over || over.type !== "bomb" || r > over.main)) out.push(hand.filter(function (c) { return c.v === r; })); });
    if (cnt[16] && cnt[17]) out.push(hand.filter(function (c) { return c.joker; }));
    return out;
  }
  // 领出：手里一把就能走完就全出；不然从最小的那个点数起，能顺就顺、能连就连、有三张就带一张
  function ddzLead(hand) {
    if (ddzAnalyze(hand)) return hand.slice();
    const cnt = ddzCounts(hand), lo = Math.min.apply(null, Object.keys(cnt).map(Number));
    for (let len = 12; len >= 5; len--) { for (let top = lo + len - 1; top <= Math.min(14, lo + len - 1); top++) { let ok = true; for (let r = top - len + 1; r <= top; r++) if (!cnt[r] || cnt[r] >= 3) { ok = false; break; } if (ok) { const used = {}, out = []; for (let r = top - len + 1; r <= top; r++) out.push.apply(out, ddzTake(hand, r, 1, used)); return out; } } }
    for (let len = 6; len >= 3; len--) { let ok = true; for (let r = lo; r < lo + len; r++) if (!(cnt[r] === 2) || r > 14) { ok = false; break; } if (ok) { const used = {}, out = []; for (let r = lo; r < lo + len; r++) out.push.apply(out, ddzTake(hand, r, 2, used)); return out; } }
    if (cnt[lo] === 3) { const used = {}, out = ddzTake(hand, lo, 3, used), k = ddzKickers(hand, used, 1, 1, [lo]) || ddzKickers(hand, used, 1, 2, [lo]); return k ? out.concat(k) : out; }
    if (cnt[lo] === 4) { const other = Object.keys(cnt).map(Number).filter(function (r) { return r !== lo; }).sort(function (a, b) { return a - b; })[0]; if (other) return hand.filter(function (c) { return c.v === other; }).slice(0, Math.min(cnt[other], 2)); return hand.filter(function (c) { return c.v === lo; }); }
    return hand.filter(function (c) { return c.v === lo; });
  }
  function ddzNewGame(players, rnd) {
    const state = { id: "ddz_" + Date.now().toString(36), status: "playing", round: 0, log: [], winner: null,
      players: players.slice(0, 3).map(function (p) { return Object.assign({}, p, { pts: 0, hand: [], role: "", played: 0 }); }) };
    return ddzNewRound(state, rnd);
  }
  function ddzNewRound(state, rnd) {
    if (state.round >= DDZ_ROUNDS) return ddzFinish(state);
    state.round += 1;
    const d = ddzDeck(rnd);
    state.players.forEach(function (p, i) { p.hand = ddzSort(d.slice(i * 17, i * 17 + 17)); p.role = ""; p.played = 0; });
    state.bottom = d.slice(51); state.phase = "bid"; state.bid = { n: 0, by: -1 }; state.bidCount = 0;
    state.bidTurn = (state.round - 1) % 3; state.turn = -1; state.last = null; state.passes = 0; state.mult = 1; state.bombs = 0; state.result = null; state.out = [];
    state.log.push({ kind: "sys", text: "—— 第 " + state.round + " / " + DDZ_ROUNDS + " 局，发好牌了，" + state.players[state.bidTurn].name + " 先叫分 ——" });
    return state;
  }
  // 叫分：n＝0 不叫，1~3 分；只能比上一个叫的高，叫到 3 分当场定地主；三个人都叫过一轮就定，都不叫重发
  function ddzBid(state, n, say, rnd) {
    if (state.phase !== "bid") throw new Error("现在不是叫分的时候");
    const p = state.players[state.bidTurn], v = Math.floor(Number(n) || 0);
    if (v && (v <= state.bid.n || v > 3)) throw new Error("要叫比 " + state.bid.n + " 分高的");
    if (v) state.bid = { n: v, by: state.bidTurn };
    state.log.push({ kind: "move", player: p.key, text: p.name + "：" + (v ? "叫 " + v + " 分" : "不叫") + (say ? "　“" + String(say).slice(0, 160) + "”" : "") });
    state.bidCount += 1;
    if (v === 3 || state.bidCount >= 3) {
      if (!state.bid.n) { state.log.push({ kind: "sys", text: "都不叫，重新发牌。" }); state.round -= 1; return ddzNewRound(state, rnd); }
      const lord = state.players[state.bid.by];
      state.players.forEach(function (q) { q.role = q === lord ? "lord" : "farmer"; });
      lord.hand = ddzSort(lord.hand.concat(state.bottom));
      state.phase = "play"; state.turn = state.bid.by;
      state.log.push({ kind: "sys", text: lord.name + " 当地主（" + state.bid.n + " 分），亮底牌：" + state.bottom.map(cardName).join(" ") + "，地主先出。" });
      return state;
    }
    state.bidTurn = (state.bidTurn + 1) % 3;
    return state;
  }
  // 出牌：uids＝要出的那几张；空数组＝不出（自己领出时不许不出）
  function ddzPlay(state, uids, say) {
    if (state.phase !== "play") throw new Error("现在不是出牌的时候");
    const i = state.turn, p = state.players[i], line = say ? "　“" + String(say).slice(0, 160) + "”" : "";
    const lead = !state.last || state.last.by === i || state.last.cleared;
    if (!uids || !uids.length) {
      if (lead) throw new Error("该你领出，不能不出");
      state.log.push({ kind: "move", player: p.key, text: p.name + "：不出" + line });
      state.passes += 1;
      state.turn = (i + 1) % 3;
      if (state.passes >= 2) { state.passes = 0; state.last = Object.assign({}, state.last, { cleared: true }); }
      return state;
    }
    const cards = uids.map(function (u) { return p.hand.find(function (c) { return c.uid === u; }); });
    if (cards.some(function (c) { return !c; })) throw new Error("手里没有这几张");
    const combo = ddzAnalyze(cards);
    if (!combo) throw new Error("这几张凑不成牌型");
    if (!lead && !state.last.cleared && !ddzBeats(combo, state.last.combo)) throw new Error("压不过上家的" + DDZ_TYPE_ZH[state.last.combo.type]);
    p.hand = p.hand.filter(function (c) { return uids.indexOf(c.uid) < 0; });
    p.played += 1;
    state.out = (state.out || []).concat(cards);   // 这一局桌上已经出掉的牌：TA 们说话前照这份记牌，不凭印象
    if (combo.type === "bomb" || combo.type === "rocket") { state.mult *= 2; state.bombs += 1; }
    state.last = { by: i, cards: ddzSort(cards), combo: combo };
    state.passes = 0;
    state.log.push({ kind: "move", player: p.key, text: p.name + "：" + DDZ_TYPE_ZH[combo.type] + " " + ddzSort(cards).map(cardName).join(" ") + (p.hand.length && p.hand.length <= 2 ? "（只剩 " + p.hand.length + " 张）" : "") + line });
    if (!p.hand.length) return ddzSettle(state, i);
    state.turn = (i + 1) % 3;
    return state;
  }
  function ddzSettle(state, wi) {
    const w = state.players[wi], lord = state.players.find(function (q) { return q.role === "lord"; }), lordWin = w === lord;
    const farmers = state.players.filter(function (q) { return q.role === "farmer"; });
    const spring = lordWin ? farmers.every(function (q) { return q.played === 0; }) : lord.played <= 1;
    if (spring) state.mult *= 2;
    const score = state.bid.n * state.mult;
    lord.pts += lordWin ? 2 * score : -2 * score;
    farmers.forEach(function (q) { q.pts += lordWin ? -score : score; });
    state.phase = "done"; state.turn = -1;
    state.result = { lordWin: lordWin, score: score, spring: spring };
    state.log.push({ kind: "sys", text: (lordWin ? "地主 " + lord.name + " 赢了" : "农民 " + farmers.map(function (q) { return q.name; }).join("、") + " 赢了") + (spring ? "，春天！" : "。")
      + "这局 " + state.bid.n + " 分" + (state.mult > 1 ? " × " + state.mult : "") + "。现在：" + state.players.map(function (q) { return q.name + " " + q.pts; }).join("，") + "。" });
    return state;
  }
  function ddzFinish(state) {
    state.status = "finished"; state.phase = "done";
    const best = state.players.slice().sort(function (a, b) { return b.pts - a.pts; })[0];
    state.winner = best ? best.key : null;
    state.log.push({ kind: "sys", text: "打完了。" + state.players.map(function (q) { return q.name + " " + q.pts + " 分"; }).join("，") + "。" });
    return state;
  }
  // 不调模型的一手：叫分看牌力；出牌能压就用最小的压，队友的牌不压，炸弹留着等对面快走完
  function ddzNpcBid(state, i, soft) {
    const h0 = state.players[i].hand, cnt = ddzCounts(h0);
    let s = (cnt[17] ? 3 : 0) + (cnt[16] ? 2 : 0) + (cnt[15] || 0) * 1.5 + (cnt[14] || 0) * 0.5 + Object.keys(cnt).filter(function (r) { return cnt[r] === 4; }).length * 3;
    if (soft) s -= 2;
    const want = s >= 9 ? 3 : s >= 7 ? 2 : s >= 5 ? 1 : 0;
    return want > state.bid.n ? want : 0;
  }
  function ddzNpcPlay(state, i, soft) {
    const p = state.players[i], hand = p.hand, last = state.last;
    const lead = !last || last.by === i || last.cleared;
    if (lead) return ddzLead(hand).map(function (c) { return c.uid; });
    const mate = state.players[last.by].role === p.role && p.role === "farmer";
    const danger = state.players.some(function (q, k) { return k !== i && q.role !== p.role && q.hand.length <= 3; }) || (p.role === "lord" ? false : state.players[last.by].role === "lord" && state.players[last.by].hand.length <= 5);
    // 队友出的牌：原来一律不接，结果那位农民一整局一张都没出过（她 2026-10-16 截图：17 张原封不动）。
    //   真人打法是「队友出小牌就顺手跟一张小的走掉」：跟得起、跟的是 J 以下的单张/对子，就顺掉；大牌、拆炸弹才让
    if (mate && !danger) {
      const easy = (last.combo.type === "single" || last.combo.type === "pair") ? ddzFind(hand, last.combo) : null;
      const ez = easy && ddzAnalyze(easy);
      if (ez && ez.main <= 11 && !ddzBombs(hand, { type: "single", main: 0, len: 1 }).some(function (b) { return b.some(function (c) { return easy.some(function (e) { return e.uid === c.uid; }); }); }))
        return easy.map(function (c) { return c.uid; });
      return [];
    }
    const plain = ddzFind(hand, last.combo);
    if (plain && !(mate && plain.length < hand.length && (last.combo.main >= 14))) return plain.map(function (c) { return c.uid; });
    if (!mate && (danger || hand.length <= 6) && !soft) {
      const b = ddzBombs(hand, last.combo)[0];
      if (b) return b.map(function (c) { return c.uid; });
    }
    return [];
  }
  function ddzHint(state, i) {
    const p = state.players[i], last = state.last;
    if (!last || last.by === i || last.cleared) return ddzLead(p.hand).map(function (c) { return c.uid; });
    const f = ddzFind(p.hand, last.combo); if (f) return f.map(function (c) { return c.uid; });
    const b = ddzBombs(p.hand, last.combo)[0]; return b ? b.map(function (c) { return c.uid; }) : [];
  }
  function DoudizhuGame(props) {
    const t = props.t, cfg = props.config || {};
    const restored = props.savedState && props.savedState.state;
    const [state, setState] = useState(function () { return restored && restored.status === "playing" ? restored : ddzNewGame(unoPlayers(props, 3)); });
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [say, setSay] = useState(""), [pick, setPick] = useState([]);
    const running = useRef("");
    const spectate = cfg.mode === "spectate", soft = cfg.mode === "easy";
    const actor = state.status !== "playing" ? null : state.phase === "bid" ? state.players[state.bidTurn] : state.phase === "play" ? state.players[state.turn] : null;
    const me = !!(actor && actor.isUser);
    const u = state.players.find(function (p) { return p.isUser; });
    // 放水：只对跟她不是一边的人放（队友照常打）
    const softFor = function (i) { return soft && !!u && state.players[i].role !== u.role; };
    const clone = function () { return JSON.parse(JSON.stringify(state)); };
    useEffect(function () {
      if (state.status === "finished") { clearGameSave("doudizhu"); return; }
      saveGameSnap("doudizhu", { config: cfg, state: state, label: "第 " + state.round + " 局" });
    }, [state]);
    useEffect(function () {
      if (!actor || actor.isUser || busy) return;
      const tid = state.id + "#" + state.round + "#" + state.phase + "#" + state.log.length;
      if (running.current === tid) return; running.current = tid; setBusy(true); setError("");
      setTimeout(function () {
        try {
          const n = clone();
          if (state.phase === "bid") ddzBid(n, ddzNpcBid(state, state.bidTurn, softFor(state.bidTurn)));
          else { try { ddzPlay(n, ddzNpcPlay(state, state.turn, softFor(state.turn))); } catch (e) { const n2 = clone(); ddzPlay(n2, ddzHint(state, state.turn)); setState(n2); running.current = ""; setBusy(false); return; } }
          setState(n);
        } catch (e) { setError(e.message); }
        running.current = ""; setBusy(false);
      }, 800);
    }, [state, busy]);
    const talking = useCardTableTalk(props, state, setState, { on: true, zh: "斗地主", ready: me || state.phase === "done" || state.status === "finished", every: spectate ? 6 : 0,
      view: function () {
        const lord = state.players.find(function (q) { return q.role === "lord"; });
        return "第 " + state.round + " / " + DDZ_ROUNDS + " 局；" + (lord ? "地主是 " + lord.name + "（" + state.bid.n + " 分" + (state.mult > 1 ? "，翻了 " + state.mult + " 倍" : "") + "），另外两个是农民，一伙的" : "还在叫分")
          + "\n" + state.players.map(function (q) { return q.name + "：手里还剩 " + q.hand.length + " 张，总分 " + q.pts; }).join("；")
          // 记牌（她 2026-10-16 截图：大王早出过了，TA 还说「大王还没见」）——只看最近几手是记不住的，把这一局出掉的大牌整份递过去
          + (function () {
            if (state.phase !== "play" && state.phase !== "done") return "";
            if (!Array.isArray(state.out)) return "";
            const cnt = {}; state.out.forEach(function (c) { if (c.v >= 14) cnt[c.v] = (cnt[c.v] || 0) + 1; });
            const TOTAL = { 17: 1, 16: 1, 15: 4, 14: 4 };
            const gone = [17, 16, 15, 14].filter(function (v) { return cnt[v]; }).map(function (v) { return ddzRankName(v) + (TOTAL[v] > 1 ? "×" + cnt[v] : ""); });
            const left = [17, 16, 15, 14].filter(function (v) { return (cnt[v] || 0) < TOTAL[v]; }).map(function (v) { return ddzRankName(v) + (TOTAL[v] > 1 ? "×" + (TOTAL[v] - (cnt[v] || 0)) : ""); });
            return "\n【记牌·这一局桌上已经出掉的大牌】" + (gone.length ? gone.join("、") : "还没有") + "；还没出现过的大牌：" + (left.length ? left.join("、") : "都出完了")
              + "（不知道在谁手里）。" + ((state.bottom || []).length ? "底牌是大家都看见了的：" + state.bottom.map(cardName).join(" ") + "，归了地主。" : "") + "这是桌上真实出过的牌，【不是每个人都记得住】：会记牌的人照这一行说；不怎么记牌的人可以记不清、说「好像出过了吧」、干脆不提——照各自的牌技和性子来，但别把出过的说成肯定没出。";
          })()
          + (state.last && !state.last.cleared ? "\n桌上最后一手：" + state.players[state.last.by].name + " 出的 " + DDZ_TYPE_ZH[state.last.combo.type] + " " + state.last.cards.map(cardName).join(" ") : "")
          + "\n最近：\n" + cardPublicLog(state);
      } });
    function act(fn) { try { const n = clone(); fn(n); setState(n); setSay(""); setPick([]); setError(""); } catch (e) { setError(e.message); } }
    const toggle = function (uid) { setPick(function (p) { return p.indexOf(uid) >= 0 ? p.filter(function (x) { return x !== uid; }) : p.concat([uid]); }); };
    const lead = state.phase === "play" && (!state.last || state.last.by === state.turn || state.last.cleared);
    const pickCombo = me && state.phase === "play" ? ddzAnalyze((u ? u.hand : []).filter(function (c) { return pick.indexOf(c.uid) >= 0; })) : null;
    const btn = function (label, onClick, color, dis, o) { const wk = o && o.wk; return h("button", { "data-wk": wk || undefined, onClick: onClick, disabled: dis, style: { border: 0, borderRadius: 999, padding: "11px 8px", color: "#fff", background: dis ? t.line : color, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, label); };
    const showAll = spectate || state.phase === "done" || state.status === "finished";
    return h("div", { "data-wk": "gameplay", "data-part": "doudizhu", className: "h-full flex flex-col", style: gameTable("doudizhu", t) },
      h(Head, { zh: "斗地主", en: state.status === "finished" ? "打完了" : ("第 " + state.round + " / " + DDZ_ROUNDS + " 局" + (actor ? " · " + (state.phase === "bid" ? actor.name + " 叫分" : "轮到 " + actor.name) : "")), onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3", style: { paddingTop: 12 } },
        h(CardSeats, { t: t, evalOf: { host: props, key: "doudizhu", zh: "斗地主" }, log: state.log, seats: state.players.map(function (p) {
          // 座位窄（80px）：一行只放「几张 · 几分」，地主农民看头像角上那个「地」
          return { key: p.key, name: p.name, dealer: p.role === "lord", badge: "地", char: cardSeatChar(props, p), isUser: p.isUser, on: actor === p,
            hot: state.result && (state.result.lordWin ? p.role === "lord" : p.role === "farmer"), sub: p.hand.length + "张 · " + p.pts + "分" };
        }) }),
        feltBox([
          h("div", { key: "a", style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .75, marginRight: 4 } }, "底牌"),
            (state.bottom || []).map(function (c, j) { return h(PlayCard, { key: j + (state.phase === "bid" ? "x" : "o") + state.round, c: c, back: state.phase === "bid" && !spectate, flip: state.phase !== "bid", w: 30 }); }),
            state.bid && state.bid.n ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .85, marginLeft: 8 } }, state.bid.n + " 分" + (state.mult > 1 ? " × " + state.mult : "")) : null),
          h("div", { key: "b", "data-wk": "gameddzlast", style: { marginTop: 14, minHeight: 74, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 } },
            state.last && !state.last.cleared && state.phase !== "bid" ? [
              h("div", { key: "w", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: .8 } }, state.players[state.last.by].name + " · " + DDZ_TYPE_ZH[state.last.combo.type]),
              h("div", { key: "c", style: { display: "flex", justifyContent: "center", flexWrap: "wrap" } }, state.last.cards.map(function (c, j) { return h("div", { key: c.uid + state.log.length, style: { marginLeft: j ? -14 : 0 } }, h(PlayCard, { c: c, w: 38 })); }))
            ] : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .7 } }, state.phase === "bid" ? "叫分中" : state.phase === "play" ? (actor ? actor.name + " 领出" : "") : "")),
          showAll ? h("div", { key: "h", style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } }, state.players.filter(function (p) { return !p.isUser && p.hand.length; }).map(function (p) {
            return h("div", { "data-wk": "block", key: p.key, style: { display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.18)", borderRadius: 11, padding: "5px 9px" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", width: 54, flexShrink: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
              h("div", { style: { display: "flex", flexWrap: "wrap", rowGap: 4 } }, p.hand.map(function (c, j) { return h("div", { key: c.uid, style: { marginLeft: j ? -10 : 0 } }, h(PlayCard, { c: c, w: 24 })); })));
          })) : null
        ], "doudizhu"),
        h(CardLog, { t: t, part: "doudizhu", log: state.log, talking: talking }),
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.tint } },
          ((state.players.find(function (p) { return p.key === state.winner; }) || {}).name || "没人") + " 分最多！",
          h(KeepMemBtn, { t: t, host: props, rep: function () {
            const w = state.players.find(function (p) { return p.key === state.winner; });
            return { key: "doudizhu", zh: "斗地主", ids: realCharIds(state.players), wins: w && realCharIds(state.players).indexOf(w.key) >= 0 ? [w.key] : [], meWin: u ? !!(w && w.isUser) : null,
              text: "一起打了 " + state.round + " 局斗地主，" + ((w && (w.isUser ? "她" : w.name)) || "没人") + " 分最多。" + state.players.map(function (p) { return (p.isUser ? "她" : p.name) + " " + p.pts; }).join("，") + "。" };
          } })) : null),
      state.status === "playing" && state.phase === "done" ? h("div", { "data-wk": "gameactions", "data-part": "doudizhu", "data-kind": "next", className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", textAlign: "center" } },
        h("button", { "data-wk": "gameddznext", onClick: function () { act(function (n) { ddzNewRound(n); }); }, style: { border: 0, borderRadius: 999, padding: "11px 26px", color: "#fff", background: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, state.round >= DDZ_ROUNDS ? "算总分" : "下一局")) :
      me && u ? h("div", { "data-wk": "gameactions", "data-part": "doudizhu", "data-kind": state.phase, className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { "data-wk": "gameddzhand", style: { display: "flex", flexWrap: "wrap", rowGap: 6, padding: "10px 0 6px 10px", justifyContent: "center" } }, u.hand.map(function (c, j) {
          return h("div", { key: c.uid, style: { marginLeft: j ? -14 : 0 } }, h(PlayCard, { c: c, w: 38, lift: pick.indexOf(c.uid) >= 0, onClick: state.phase === "play" ? function () { toggle(c.uid); } : null }));
        })),
        h("input", { "data-wk": "gameinput", "data-part": "talk", value: say, onChange: function (e) { setSay(e.target.value); }, placeholder: "顺便说一句（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", margin: "6px 0 8px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        state.phase === "bid" ? h("div", { "data-wk": "gameddzbid", style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 } },
          [0, 1, 2, 3].map(function (n) { return h("button", { key: n, onClick: function () { act(function (s) { ddzBid(s, n, say); }); }, disabled: n > 0 && n <= state.bid.n,
            style: { border: 0, borderRadius: 999, padding: "11px 6px", color: "#fff", background: n > 0 && n <= state.bid.n ? t.line : n ? t.tint : "#7a6f66", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, n ? n + " 分" : "不叫"); })) :
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 6 } },
          btn("提示", function () { setPick(ddzHint(state, state.turn)); }, "#7a6f66", false, { wk: "gameddzhint" }),
          btn("不出", function () { act(function (s) { ddzPlay(s, [], say); }); }, t.ink, lead, { wk: "gameddzpass" }),
          btn(pickCombo ? "出 " + DDZ_TYPE_ZH[pickCombo.type] : "出牌", function () { act(function (s) { ddzPlay(s, pick, say); }); }, "#c0553f", !pickCombo, { wk: "gameddzplay" }))) :
      busy && actor ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, actor.name + (state.phase === "bid" ? " 在想叫不叫…" : " 在理牌…")) : null);
  }

  if (typeof module === "object" && module.exports) module.exports = { cardDeck: cardDeck, pkEval5: pkEval5, pkCmp: pkCmp, pkBest: pkBest, pkNewGame: pkNewGame, pkNewHand: pkNewHand, pkAct: pkAct, pkOptions: pkOptions, pkNpcMove: pkNpcMove, omNewGame: omNewGame, omAct: omAct, omDiscardPairs: omDiscardPairs, bjValue: bjValue, bjNewGame: bjNewGame, bjNewHand: bjNewHand, bjAct: bjAct, bjNpcMove: bjNpcMove, ddzAnalyze: ddzAnalyze, ddzBeats: ddzBeats, ddzFind: ddzFind, ddzLead: ddzLead, ddzNewGame: ddzNewGame, ddzNewRound: ddzNewRound, ddzBid: ddzBid, ddzPlay: ddzPlay, ddzNpcBid: ddzNpcBid, ddzNpcPlay: ddzNpcPlay, ddzHint: ddzHint, unoLocalMove: unoLocalMove, cardLocal: cardLocal, cardMovesSince: cardMovesSince, cardSayOf: cardSayOf, spyGuessHits: spyGuessHits, seerTruthViolations: seerTruthViolations, enforceSeerTruth: enforceSeerTruth, wolfPublicThreats: wolfPublicThreats, wolfNightIntel: wolfNightIntel, avalonBoard: avalonBoard, MONO_BOARD: MONO_BOARD, monoMove: monoMove, monoNetWorth: monoNetWorth, monoAdvance: monoAdvance, monoOwnsGroup: monoOwnsGroup, monoRent: monoRent, monoGridPos: monoGridPos, monoMigrateSave: monoMigrateSave, monoMaxMoves: monoMaxMoves, monoShouldFlush: monoShouldFlush, monoCleanLogs: monoCleanLogs, monoStyle: monoStyle, monoNpcDecision: monoNpcDecision, monoAuctionCap: monoAuctionCap, monoAuctionPlan: monoAuctionPlan, routeSeatCall: routeSeatCall, liarLegalBid: liarLegalBid, liarCount: liarCount, liarNewGame: liarNewGame, liarAct: liarAct, liarNpcMove: liarNpcMove, liarNewRound: liarNewRound, storyNewGame: storyNewGame, storyAct: storyAct, storyText: storyText, tdLooksLikeDare: tdLooksLikeDare, tdPromptMatchesChoice: tdPromptMatchesChoice, tdPickFairTarget: tdPickFairTarget, tdPickNextAsker: tdPickNextAsker };
  // 聊天那头要按 key 报菜名（房间里的「TA可以拉你玩点什么」），别在那边再抄一份清单。
  Games.LIST = (typeof window !== "undefined" && window.GamesList) || GAMES.map(function (g) { return { key: g.key, zh: g.zh, min: g.min, max: g.max, rule: g.rule }; });
  if (typeof window !== "undefined") window.Games = Games;
})();
