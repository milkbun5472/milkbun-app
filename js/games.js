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
  // 各游戏规格。min/max 是「总玩家数」上下限。
  const GAMES = [
    { key: "spy", emoji: "🕵️", zh: "谁是卧底", en: "Who's the Spy", min: 3, max: 12,
      desc: "每人拿到一个词，卧底的词略有不同。轮流描述、投票揪出卧底。", rule: "3~12 人 · 1~2 名卧底 · 词系统出" },
    { key: "haigui", emoji: "🐢", zh: "海龟汤", en: "Lateral Puzzle", min: 2, max: 8,
      desc: "主持人给一个诡异「汤面」，你们只能问是 / 否问题，一步步还原真相。", rule: "2~8 人 · 题目系统出" },
    { key: "q25", emoji: "❓", zh: "25 问", en: "20 Questions", min: 2, max: 8,
      desc: "系统心里想一个东西，你们轮流问是 / 否问题，25 问内猜出来。", rule: "2~8 人 · 题目系统出" },
    { key: "tod", emoji: "🎲", zh: "真心话大冒险", en: "Truth or Dare", min: 2, max: 10,
      desc: "转瓶子，指到谁就选真心话或大冒险，题目由在场的人出。", rule: "2~10 人" },
    { key: "werewolf", emoji: "🐺", zh: "狼人杀", en: "Werewolf", min: 5, max: 12,
      desc: "狼人夜里行凶，好人白天靠推理投票放逐。当前板子：狼人 + 预言家 + 平民。", rule: "5~12 人 · 预言家局 · 不翻牌" },
    { key: "avalon", emoji: "⚔️", zh: "阿瓦隆", en: "Avalon", min: 5, max: 10,
      desc: "正义与邪恶的任务对抗，梅林认得坏人、刺客要在结局刺杀梅林。", rule: "5~10 人 · 任务制" },
    { key: "monopoly", emoji: "🏙️", zh: "大富翁", en: "Monopoly", min: 2, max: 6,
      desc: "绕城买地、收租和抽事件。角色会按人设谈买卖、拌嘴、结盟和记仇，不会只沉默掷骰子。", rule: "2~6 人 · 买地收租 · 破产淘汰" },
    { key: "uno", emoji: "🟥", zh: "UNO", en: "UNO", min: 2, max: 6,
      desc: "轮流出同色、同数字或功能牌。言秋在 CC 在线时会亲自打自己的座位，断线则由模型无感代打。", rule: "2~6 人 · 7 张起手 · +2 规则入场可选 · +4 · 反转/跳过 · 忘喊 UNO 罚 2 张" }
  ];

  // ---- 言秋亲打：统一终局回执 ----
  // 只要他坐过这一局，终局无论谁赢、他是否已出局，都要把完整赛果投回 CC。
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
      sys: "这局小游戏已经正式结束。票内是公开终局：胜负、身份揭晓、比分或排名，以及 Lisa 的结果。看完后用自己的口吻留一句自然赛后反应；可以庆祝、嘴硬、复盘、安慰或约下一局。不要继续行动，不写报告，不调用工具。只输出 JSON：{\"say\":\"...\"}。" + SKILL_RULE,
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
      } else if (onStatus) onStatus("赛果已经投给言秋，等他看到");
      return "";
    });
  }
  // 游戏生成统一走这个：更长超时 + 失败重试（人多时单次请求大、思考型模型慢，别一次超时就崩）
  async function callRetry(api, sys, msgs, opts) {
    opts = Object.assign({ timeout: 90000 }, opts || {});
    let last;
    for (let i = 0; i < 2; i++) { try { return await callAI(api, sys, msgs, opts); } catch (e) { last = e; } }
    throw last;
  }
  // 能力≠性格：所有游戏共用的反刻板铁律，焊进每次生成
  const SKILL_RULE ="【能力与性格分开·非常重要】把「性格风格」和「真实水平」当成两件事：性格只决定 TA 怎么说话、什么语气；真实水平由 TA 的职业、背景、受过的训练、人生经历决定，和性格无关。绝不能因为性格开朗 / 单纯 / 憨 / 软就把 TA 演成脑子不好、推理拉垮——一个性格像小太阳但职业是程序员的人，逻辑和推理其实很强、玩推理游戏心里门儿清，只是嘴上仍旧暖乎乎的。按真实水平决定「玩得多好」，按性格决定「怎么表达」。";

  // ---- 通用：分段控件 ----
  function Segmented(props) {
    const t = props.t;
    return h("div", { style: { display: "flex", gap: 6, background: t.bg2, borderRadius: 12, padding: 4 } },
      props.options.map(function (o) {
        const on = o.key === props.value;
        return h("button", { key: o.key, onClick: function () { props.onChange(o.key); },
          style: { flex: 1, padding: "8px 4px", borderRadius: 9, fontFamily: F_BODY, fontSize: 13.5, fontWeight: on ? 700 : 400, color: on ? "#f3efe6" : t.sub, background: on ? t.ink : "transparent", transition: "all .15s" } }, o.zh);
      }));
  }

  // ---- 通用：开关行 ----
  function ToggleRow(props) {
    const t = props.t;
    return h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0" } },
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, props.label),
        props.sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, props.sub) : null),
      h("button", { onClick: props.onToggle, className: "shrink-0", style: { width: 50, height: 29, borderRadius: 999, background: props.on ? t.ink : t.line, position: "relative", transition: "background .2s" } },
        h("span", { style: { position: "absolute", top: 3, left: props.on ? 24 : 3, width: 23, height: 23, borderRadius: 999, background: "#fff", transition: "left .2s" } })));
  }

  // ---- 通用：步进器 ----
  function Stepper(props) {
    const t = props.t;
    const btn = function (label, fn, dis) { return h("button", { onClick: fn, disabled: dis, style: { width: 26, height: 26, borderRadius: 7, border: "1px solid " + t.line, color: dis ? t.line : t.sub, fontFamily: F_BODY, fontSize: 16, lineHeight: "22px", background: t.bg2 } }, label); };
    return h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
      btn("−", function () { props.onChange(Math.max(props.min, props.value - 1)); }, props.value <= props.min),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, minWidth: 18, textAlign: "center" } }, props.value),
      btn("+", function () { props.onChange(Math.min(props.max, props.value + 1)); }, props.value >= props.max));
  }

  // ---- 存档（非 x_ 前缀 → 不进云同步，对局是临时的）----
  const WOLF_SAVE = "wolf_save";
  function loadWolfSave() { try { return JSON.parse(localStorage.getItem(WOLF_SAVE) || "null"); } catch (e) { return null; } }
  function saveWolf(s) { try { localStorage.setItem(WOLF_SAVE, JSON.stringify(s)); } catch (e) {} }
  function clearWolf() { try { localStorage.removeItem(WOLF_SAVE); } catch (e) {} }

  // ---- 通用对局存档（每种游戏一个槽；退出即存、打完即清；狼人杀走上面自己那套）----
  const GS_SAVE = "games_save";  // { [gameKey]: snapshot }
  function loadGamesSaves() { try { return JSON.parse(localStorage.getItem(GS_SAVE) || "{}") || {}; } catch (e) { return {}; } }
  function loadGameSave(k) { return loadGamesSaves()[k] || null; }
  function saveGameSnap(k, snap) { try { const all = loadGamesSaves(); all[k] = snap; localStorage.setItem(GS_SAVE, JSON.stringify(all)); } catch (e) {} }
  // CC 回执按 turn_id 幂等领取。仅用 day/round 或裸毫秒都可能在新局、时钟回拨、
  // 同毫秒连续出票时撞上旧回执；所有没有稳定局号的临时票统一加随机尾巴。
  function freshCCTurn(prefix) {
    return String(prefix || "game") + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function clearGameSave(k) { try { const all = loadGamesSaves(); delete all[k]; localStorage.setItem(GS_SAVE, JSON.stringify(all)); } catch (e) {} }
  // 玩家名单存/取：剥离不可靠的 char（React 元素/整份档案），续局按 key 从 characters/profile 重挂
  function serPlayers(players) { return (players || []).map(function (p) { return { key: p.key, name: p.name, isUser: !!p.isUser, isNpc: !!p.isNpc, role: p.role, side: p.side, word: p.word, skill: p.skill, persona: p.persona, alive: p.alive, engineer: !!p.engineer }; }); }
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
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 } },
      h("div", { onClick: props.onClose, style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" } }),
      h("div", { style: { position: "relative", background: t.bg, borderRadius: 16, padding: "16px 16px 16px", width: "100%", maxWidth: 340, maxHeight: "80%", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.32)" } },
        props.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, textAlign: "center", marginBottom: props.sub ? 3 : 12 } }, props.title) : null,
        props.sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", marginBottom: 12, lineHeight: 1.5, whiteSpace: "pre-line" } }, props.sub) : null,
        props.children,
        props.onClose ? h("button", { onClick: props.onClose, style: { display: "block", margin: "12px auto 0", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "4px 12px" } }, "先关掉 · 回看发言") : null));
  }
  function PlayerCard(props) {
    const t = props.t, p = props.p;
    // personaText 传入时用它（真心话喂完整人设）；否则真人角色只显一句 tagline、NPC 显生成的一句人设
    const persona = props.personaText != null ? props.personaText : (p.isUser ? "" : (p.isNpc ? (p.persona || "") : ((p.char && p.char.tagline) || "")));
    return h("div", { onClick: props.onClose, style: { position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } },
      h("div", { onClick: function (e) { e.stopPropagation(); }, style: { background: t.bg, borderRadius: 16, padding: "18px 18px 20px", width: "100%", maxWidth: 320, maxHeight: "76%", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.3)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } }, props.avatar,
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, p.name + (p.isUser ? "（你）" : "")),
            props.roleText ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: props.roleBad ? "#c0553f" : t.tint, marginTop: 2 } }, props.roleText) : (p.alive === false ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, "已出局（身份不公开）") : null))),
        // hideSkill：派对游戏（真心话）没有「牌桌能力」概念，直接看人设，不显空的能力评估
        props.hideSkill ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, letterSpacing: .5, marginBottom: 5 } }, "牌桌能力小传（系统评估）"),
        props.hideSkill ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.ink, marginBottom: persona ? 14 : 0 } }, p.isUser ? "这是你本人，系统没有替你评估水平——你自己发挥。" : (p.skill || "（没评估到）")),
        persona ? h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, letterSpacing: .5, marginBottom: 5 } }, props.hideSkill ? "人设" : "人设 / 补充"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.65, color: t.sub, whiteSpace: "pre-line" } }, persona)) : null,
        h("button", { onClick: props.onClose, style: { marginTop: 16, width: "100%", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px" } }, "关了")));
  }

  // ============================================================
  // 中枢（书架式游戏卡）
  // ============================================================
  function Games(props) {
    const t = useTheme();
    const [game, setGame] = useState(null);       // 进入配置的游戏
    const [session, setSession] = useState(null);  // {game, config, resume, saved} 进入对局
    const [saveTick, setSaveTick] = useState(0);   // 存档变动后强刷横幅
    const wolfSave = loadWolfSave();
    const gSaves = loadGamesSaves();               // 通用存档（卧底/海龟汤/25问/真心话/阿瓦隆）

    if (session) {
      const engineProps = { config: session.config, game: session.game, active: props.active, bgActive: props.bgActive, characters: props.characters, profile: props.profile, recentChatFor: props.recentChatFor, isEngineer: props.isEngineer, t: t, toast: props.toast, savedState: session.saved, onBack: function () { setSession(null); setSaveTick(function (x) { return x + 1; }); } };
      if (session.game.key === "spy") return h(SpyGame, engineProps);
      if (session.game.key === "werewolf") return h(WolfGame, Object.assign({}, engineProps, { resume: !!session.resume, savedState: session.saved }));
      if (session.game.key === "haigui" || session.game.key === "q25") return h(GuessGame, Object.assign({}, engineProps, { kind: session.game.key }));
      if (session.game.key === "tod") return h(TruthDareGame, engineProps);
      if (session.game.key === "avalon") return h(AvalonGame, engineProps);
      if (session.game.key === "monopoly") return h(MonopolyGame, engineProps);
      if (session.game.key === "uno") return h(UnoGame, engineProps);
      return h(GamePlay, { game: session.game, config: session.config, characters: props.characters, profile: props.profile, t: t, onBack: function () { setSession(null); } });
    }
    if (game) return h(GameSetup, {
      game: game, characters: props.characters, profile: props.profile, moods: props.moods, t: t,
      onBack: function () { setGame(null); },
      onStart: function (config) { setSession({ game: game, config: config }); }
    });
    const wolfGameDef = GAMES.find(function (g) { return g.key === "werewolf"; });

    // ---- 游戏架 ----
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "小游戏", en: "Games", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        // 未打完的存档：继续 / 弃掉
        wolfSave ? h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 13, background: t.tint + "16", border: "1px solid " + t.tint, margin: "2px 0 14px" } },
          h("div", { style: { fontSize: 22 } }, "🐺"),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, "狼人杀 · 上一局没打完"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, "第 " + (wolfSave.cycle || 1) + " 个昼夜 · " + ((wolfSave.players || []).filter(function (p) { return p.alive; }).length) + " 人存活")),
          h("button", { onClick: function () { setSession({ game: wolfGameDef, config: wolfSave.config, resume: true, saved: wolfSave }); }, style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 999, padding: "7px 15px" } }, "继续"),
          h("button", { onClick: function () { clearWolf(); setSaveTick(function (x) { return x + 1; }); }, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 4px" } }, "弃掉")) : null,
        // 通用存档条：每种没打完的游戏各一条
        Object.keys(gSaves).map(function (k) {
          const snap = gSaves[k]; if (!snap) return null;
          const def = GAMES.find(function (g) { return g.key === k; }); if (!def) return null;
          return h("div", { key: "gs_" + k, style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 13, background: t.tint + "16", border: "1px solid " + t.tint, margin: "2px 0 14px" } },
            h("div", { style: { fontSize: 22 } }, def.emoji),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, def.zh + " · 上一局没打完"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, snap.label || "点继续接着玩")),
            h("button", { onClick: function () { setSession({ game: def, config: snap.config, resume: true, saved: snap }); }, style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 999, padding: "7px 15px" } }, "继续"),
            h("button", { onClick: function () { clearGameSave(k); setSaveTick(function (x) { return x + 1; }); }, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 4px" } }, "弃掉"));
        }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, margin: "2px 2px 14px" } }, "邀角色开一局派对游戏。每局可选正常 / 放水 / 观战，人不够能拉 NPC 凑数。（不写进聊天记忆）"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          GAMES.map(function (g) {
            return h("button", { key: g.key, onClick: function () { setGame(g); },
              className: "active:opacity-80", style: { textAlign: "left", display: "flex", gap: 13, padding: "15px 15px", borderRadius: 15, background: t.bg2, border: "1px solid " + t.line } },
              h("div", { style: { fontSize: 30, lineHeight: 1, width: 40, textAlign: "center", flexShrink: 0, marginTop: 2 } }, g.emoji),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, g.zh),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, letterSpacing: .5, textTransform: "uppercase" } }, g.en)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.55, marginTop: 4 } }, g.desc),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6 } }, g.rule)));
          })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center", lineHeight: 1.7, marginTop: 20 } }, "选一个玩法，叫上想一起玩的角色吧。")));
  }

  // ============================================================
  // 开局配置：模式 + 选人（含人数上下限）+ NPC凑数 + 注入最近聊天
  // ============================================================
  function GameSetup(props) {
    const t = props.t, game = props.game;
    const chars = props.characters || [];
    const [mode, setMode] = useState("normal");
    const [picked, setPicked] = useState([]);        // 选中的角色 id
    const [npcFill, setNpcFill] = useState(true);
    const [npcWant, setNpcWant] = useState(-1);      // 用户想要的 NPC 数；-1 = 跟随「补到最低」
    const [injectChat, setInjectChat] = useState(false);
    const [ccSeat, setCcSeat] = useState(true);      // UNO：工程师之眼角色是否由 CC 本人亲打
    const [unoRule, setUnoRule] = useState("official"); // official 官方不叠；stack 常见桌规 +2 叠加
    const [godSel, setGodSel] = useState(null);      // 狼人杀神职选择；null=跟随标准板
    const [wolfRole, setWolfRole] = useState(null);  // 狼阵营特殊角色：null 普通狼 / wolfking / whitewolf
    const [winMode, setWinMode] = useState("side");  // 屠边 side / 屠城 all
    const [avOpts, setAvOpts] = useState({ percival: true, mordred: false, oberon: false }); // 阿瓦隆特殊角色

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
    const tooFew = spectate ? (picked.length + needNpc) < 2 : total < game.min;
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
    else if (tooFew) countMsg = spectate ? "观战至少要 2 个角色下场" : "还差人——至少 " + game.min + " 人" + (npcFill ? "（可加 NPC 凑数）" : "，或开 NPC 凑数");
    else if (avOverflow) countMsg = "特殊坏人槽位不够：当前人数最多再选 " + avSpecialRoom + " 组（派西维尔会连带莫甘娜）";
    else countMsg = "共 " + total + " 人" + (humanPlays ? "（含你）" : "（你观战）") + (needNpc ? " · 含 " + needNpc + " 个 NPC" : "");

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: game.zh, en: game.en, onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        // 规则条
        h("div", { style: { display: "flex", gap: 11, alignItems: "center", padding: "12px 14px", borderRadius: 13, background: t.bg2, margin: "2px 0 16px" } },
          h("div", { style: { fontSize: 26, width: 34, textAlign: "center" } }, game.emoji),
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.55 } }, game.desc),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4 } }, game.rule))),

        // 模式
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink, marginBottom: 8 } }, "模式"),
        h(Segmented, { t: t, value: mode, options: MODES, onChange: setMode }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.6, margin: "8px 2px 20px" } }, modeHint),

        game.key === "uno" ? h("div", { style: { marginBottom: 20 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink, marginBottom: 8 } }, "+2 规则"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 } },
            [{ key: "official", title: "官方规则", mark: "不能叠加", desc: "别人出 +2，你直接摸 2 张并跳过。" },
             { key: "stack", title: "叠加规则", mark: "可以反打", desc: "任意颜色 +2 都能顶；罚牌累计转给下一家。" }].map(function (o) {
              const on = unoRule === o.key;
              return h("button", { key: o.key, onClick: function () { setUnoRule(o.key); }, style: { textAlign: "left", borderRadius: 14, padding: "12px 11px", background: on ? t.tint + "16" : t.bg2, border: "1px solid " + (on ? t.tint : t.line) } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, o.title),
                h("div", { style: { display: "inline-block", margin: "6px 0 5px", padding: "2px 7px", borderRadius: 999, background: on ? t.tint : t.line, color: on ? "white" : t.sub, fontFamily: F_BODY, fontSize: 10.5 } }, o.mark),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.55 } }, o.desc));
            })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6 } }, "两种模式的其他规则完全一样；目前只有 +2 是否能叠加不同。")) : null,

        // 选人
        h("div", { style: { display: "flex", alignItems: "baseline", marginBottom: 8 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink } }, spectate ? "上场的角色" : "邀谁一起玩"),
          h("div", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 11.5, color: overMax || tooFew ? "#c0553f" : t.fog } }, countMsg)),
        chars.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "14px 2px" } }, "还没有角色，先去「人格档案馆」建几个")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              chars.map(function (c) {
                const on = picked.indexOf(c.id) >= 0;
                return h("button", { key: c.id, onClick: function () { toggle(c.id); },
                  style: { display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 12, background: on ? (t.tint + "16") : t.bg2, border: "1px solid " + (on ? t.tint : t.line) } },
                  h(Avatar, { character: c, size: 34, radius: 10 }),
                  h("div", { style: { flex: 1, textAlign: "left", minWidth: 0 } },
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.tagline || "")),
                  h("div", { style: { width: 22, height: 22, borderRadius: 999, flexShrink: 0, border: "2px solid " + (on ? t.tint : t.line), background: on ? t.tint : "transparent", color: "#fff", fontSize: 13, lineHeight: "19px", textAlign: "center" } }, on ? "✓" : ""));
              })),

        // 选项
        h("div", { style: { marginTop: 14, borderTop: "1px solid " + t.line } },
          h(ToggleRow, { t: t, label: "NPC 凑数", sub: "自动生成 NPC 补到最低人数——NPC 也有自己的人设和水平，不会为了推进而崩。", on: npcFill, onToggle: function () { setNpcFill(!npcFill); } }),
          // NPC 数量步进：默认补到最低，可继续加到 max（人多局更长、更看得出博弈）
          (npcFill && maxNpc > 0) ? h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0 12px" } },
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "NPC 数量"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "最少 " + minNpc + " 个补到 " + game.min + " 人，最多可加到 " + game.max + " 人（局更长、更看得出门道）。")),
            h(Stepper, { t: t, value: needNpc, min: minNpc, max: maxNpc, onChange: function (v) { setNpcWant(v); } })) : null,
          h("div", { style: { borderTop: "1px solid " + t.line } }),
          h(ToggleRow, { t: t, label: "注入最近聊天", sub: "把最近的聊天喂给上场角色，让 TA 带着当前的人设、心情、你俩的近况上场。只读不写——不会记进聊天记忆。", on: injectChat, onToggle: function () { setInjectChat(!injectChat); } }),
          ccSeatSupported ? h(ToggleRow, { t: t, label: "言秋本人亲打", sub: pickedEngineer ? "已经认出言秋。轮到他时只收 CC 本人的回答；没接上就跳过这一手，Gemini 不会冒充。" : "先把言秋选进本局；开关会保留，选中后由 CC 里的本人亲自玩。", on: ccSeat, onToggle: function () { setCcSeat(!ccSeat); } }) : null,
          // 狼人杀·神职配置（自选 + 随机 + 标准板）
          isWolfGame ? h("div", { style: { paddingTop: 12, marginTop: 6, borderTop: "1px solid " + t.line } },
            h("div", { style: { display: "flex", alignItems: "center", marginBottom: 6 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "神职配置"),
              h("button", { onClick: function () { setGodSel(randomBoard(total)); }, style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 12, color: t.tint, border: "1px solid " + t.tint, borderRadius: 999, padding: "3px 12px" } }, "🎲 随机"),
              h("button", { onClick: function () { setGodSel(null); }, style: { marginLeft: 8, fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "3px 4px" } }, "标准板")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: godOverflow ? "#c0553f" : t.fog, lineHeight: 1.5, marginBottom: 8 } }, godOverflow ? ("神职太多，最多 " + godRoom + " 个（至少留 1 民）") : "勾选想要的神职，其余是平民。屠边局：狼把神营或民营杀绝即胜。"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
              GODS.map(function (g) {
                const on = effGods.indexOf(g.key) >= 0;
                return h("button", { key: g.key, onClick: function () { const cur = effGods.slice(); const i = cur.indexOf(g.key); if (i >= 0) cur.splice(i, 1); else cur.push(g.key); setGodSel(cur); }, style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "6px 14px" } }, g.zh);
              })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "（预言家、女巫、猎人、守卫、白痴均已就绪，任选组合）"),
            // 狼阵营特殊角色（把一头狼换成狼王/白狼王）
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "狼阵营"),
              [{ key: null, zh: "普通狼" }, { key: "wolfking", zh: "狼王" }, { key: "whitewolf", zh: "白狼王" }].map(function (o) {
                const on = wolfRole === o.key;
                return h("button", { key: o.key || "plain", onClick: function () { setWolfRole(o.key); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: on ? "#fff" : t.ink, background: on ? "#c0553f" : t.bg2, border: "1px solid " + (on ? "#c0553f" : t.line), borderRadius: 999, padding: "5px 13px" } }, o.zh);
              })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, wolfRole === "wolfking" ? "狼王：出局时能开枪带走一人（被毒不能开）。" : wolfRole === "whitewolf" ? "白狼王：白天可自爆、当场带走一人后直接天黑。" : "把一头狼换成特殊狼（狼总数不变）。"),
            // 胜负模式
            h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "胜负"),
              h("div", { style: { flex: 1 } }, h(Segmented, { t: t, value: winMode, options: [{ key: "side", zh: "屠边" }, { key: "all", zh: "屠城" }], onChange: setWinMode }))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, winMode === "side" ? "屠边：狼把「神营」或「民营」杀绝即胜（标准竞技规则）。" : "屠城：场上剩余好人 ≤ 狼数（打平）时狼就赢。")) : null,
          // 阿瓦隆·特殊角色
          isAvalonGame ? h("div", { style: { paddingTop: 12, marginTop: 6, borderTop: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink, marginBottom: 2 } }, "特殊角色"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.5, marginBottom: 4 } }, "梅林 + 刺客固定在场，其余按人数配忠臣 / 爪牙。加特殊角色让博弈更深。"),
            [{ k: "percival", zh: "派西维尔 + 莫甘娜", d: "派西维尔认得梅林，但莫甘娜伪装成梅林混淆 TA（成对加入）" },
             { k: "mordred", zh: "莫德雷德", d: "坏人，且【梅林看不见 TA】——好人更难" },
             { k: "oberon", zh: "奥伯伦", d: "坏人，但和其他坏人互不相识、不知彼此" }].map(function (o) {
              return h(ToggleRow, { key: o.k, t: t, label: o.zh, sub: o.d, on: !!avOpts[o.k], onToggle: function () { setAvOpts(function (s) { const n = Object.assign({}, s); n[o.k] = !s[o.k]; return n; }); } });
            }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, "任务队伍规模按人数自动配，第 4 个任务在 7 人以上需 2 张失败票。3 个任务成功后刺客还有终局刺杀。")) : null)),

      // 底部开始
      h("div", { className: "shrink-0", style: { padding: "12px 18px calc(env(safe-area-inset-bottom) + 16px)", borderTop: "1px solid " + t.line } },
        h("button", { onClick: function () { if (canStart) props.onStart({ mode: mode, charIds: picked.slice(), npcFill: npcFill, npcCount: needNpc, injectChat: injectChat, ccSeat: ccSeat, unoRule: game.key === "uno" ? unoRule : undefined, total: total, gods: isWolfGame ? effGods.slice() : undefined, wolfRole: isWolfGame ? wolfRole : undefined, winMode: isWolfGame ? winMode : undefined, av: isAvalonGame ? avOpts : undefined }); },
          disabled: !canStart, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: canStart ? t.ink : t.line, borderRadius: 13, padding: "13px" } },
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
      h("div", { style: { width: 92, fontFamily: F_BODY, fontSize: 13, color: t.fog, flexShrink: 0 } }, k),
      h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.5 } }, v)); };
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: game.zh, en: game.en, onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-10", style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { textAlign: "center", padding: "30px 0 18px" } },
          h("div", { style: { fontSize: 54, lineHeight: 1 } }, game.emoji),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginTop: 12 } }, game.zh + " · 引擎开发中"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 6, lineHeight: 1.6 } }, "玩法和规则已经定好，这局的设置也收到了。\n引擎马上就来，先睹为快 👇")),
        h("div", { style: { background: t.bg2, borderRadius: 14, padding: "6px 15px", marginTop: 8 } },
          row("模式", modeZh),
          row("上场角色", names.length ? names.join("、") : "（无）"),
          row("总人数", cfg.total + " 人" + (cfg.mode === "spectate" ? "（你观战）" : "（含你）")),
          row("NPC 凑数", cfg.npcCount ? "补 " + cfg.npcCount + " 个 NPC" : (cfg.npcFill ? "开（本局够人，没补）" : "关")),
          row("注入最近聊天", cfg.injectChat ? "开——带当前人设/心情上场" : "关")),
        h("button", { onClick: props.onBack, className: "active:opacity-80", style: { marginTop: 22, alignSelf: "center", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 26px" } }, "返回改设置")));
  }

  // ============================================================
  // 谁是卧底 · 引擎
  // ============================================================
  const AC = (typeof ANTI_CLICHE !== "undefined") ? ANTI_CLICHE + "\n\n" : "";

  // 开局：出词 + 生成 NPC + 给每个玩家写「牌桌能力小传」（能力≠性格）
  async function setupSpy(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n你是「谁是卧底」的裁判 + 能力评估器。\n" +
      "1. 出一对词 pair：civ 平民词、spy 卧底词——两词【相关但不同】、都能描述、难度适中、别太生僻，别用明显包含关系的（如「苹果 / 苹果手机」不行；「咖啡 / 奶茶」「钢琴 / 吉他」这种才好）。\n" +
      "2. 生成 " + npcCount + " 个 NPC 玩家：name 中文名 + persona 一句人设（含【职业】与性格，尽量多样、别都是学生、别一个味）。\n" +
      "3. 给【每一个真实玩家】各写一句 skill「牌桌能力小传」：按上面的能力与性格分开原则，点出 TA 玩这种推理游戏时——藏词、听别人描述抓破绽、被怀疑时嘴硬博弈——的【真实强弱】（由职业背景推，别被性格带偏）。NPC 的 skill 也一并给。\n\n" +
      "【真实玩家】\n" + (lines || "（无）") +
      "\n\n【输出】只输出 JSON：{\"pair\":{\"civ\":\"\",\"spy\":\"\"},\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"能力小传\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "发牌：给词、" + npcCount + " 个 NPC、每个人的能力小传。" }], { maxTokens: 4500 });
    return extractJSON(raw) || {};
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
      sys: "「谁是卧底」第 " + roundNum + " 轮，按牌桌座次轮到你描述自己的词。你拿到的词是「" + (seat.word || "") + "」。"
        + "用【一句话】描述它：不能说出词本身，也别露骨到一句就被锁定。你想怎么说就怎么说，保持你自己的真实口吻。"
        + (priorForCc.length ? "\n\n【本轮排在你前面、已经真实说过的】\n" + priorForCc.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "\n（你是本轮第一个发言的人。）"),
      ask: "说一句。",
      expect: "{\"text\":\"一句描述\"}"
    });
    requireCCDone(cc, "言秋的描述票", function (d) { return !!String(d.text || "").trim(); });
    const mine = (cc.done && String(cc.done.text || "").trim())
      ? [{ name: cc.seat.name, text: String(cc.done.text).trim() }] : [];
    // 再生成排在他后面的人；他们能看到前桌 + 言秋刚才的真实发言。
    const priorAfter = priorForCc.concat(mine);
    const afterRows = after.length
      ? await genCluesBatch(api, after, priorAfter, roundNum, mode, ccPreface(cc, "按座次说过自己那一句了")) : [];
    return beforeRows.concat(mine, afterRows);
  }
  async function genCluesBatch(api, speakers, priorClues, roundNum, mode, preface) {
    const prior = priorClues.length ? priorClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "（本轮你们最先描述，前面还没人说）";
    const who = speakers.map(function (s) { return "■ " + s.name + "（TA 的词是「" + s.word + "」）真实水平：" + (s.skill || "普通"); }).join("\n");
    const easy = mode === "easy" ? "\n【放水局】适当留点破绽、别一上来就把话说得滴水不漏，给真人玩家留机会。" : "";
    const sys = AC + SKILL_RULE + "\n\n「谁是卧底」第 " + roundNum + " 轮描述。每人像真人围桌一样，随口用【一句 6～18 个汉字的口语】描述自己拿到的词。铁律：\n" +
      "· 不能直接说出词本身，也别露骨到一句就被锁定。\n" +
      "· 一句只露【一个】日常印象、使用感受或亲身联想。不要下定义，不要解释原理/机械结构，不要罗列功能配件，不要写百科、产品评测或说明书。\n" +
      "· 别写成散文谜语：禁止为了显聪明硬造长比喻、宏大哲理和『其核心机制在于』『它的体积和重量提醒你』『新手总以为』这种分析腔。像饭桌上脱口而出的短话，不像准备过的演讲。\n" +
      "· 好的口气示例：『小时候家里有一个』『我一般不会带它出门』『这个声音我挺熟』。示例只学松弛程度，不能照抄内容。\n" +
      "· 【具体程度严格按真实水平走·非常重要】高手点到即止、只给能【多向解读】的模糊线索，故意留白，让人一轮看不穿；只有低手才会说得太实把词几乎摊开。**绝不能所有人都描述得清清楚楚**——那样一轮就穿帮、毫无博弈，不好玩。整体要含蓄，信息一点点挤。\n" +
      "· 各人只知道自己的词、不知道谁跟自己不同。【高水平的少数派（卧底）】要善于从别人的描述里察觉『我的词好像和大家不是一路』，然后立刻把自己这句往大家的方向靠、含糊蒙混、绝不自曝；只有低水平的少数派才会照着自己的词直说而露馅。\n" +
      "· 先发言的人没有前文、只能凭自己的词说；后发言的人要顺着前面的风向调整措辞。" + easy +
      "\n\n【本轮已说过的】\n" + prior + "\n\n【现在这些人各说一句（按顺序）】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"clues\":[{\"name\":\"玩家名\",\"text\":\"一句描述\"}]}，顺序照上面。";
    const raw = await callRetry(api, sys, [{ role: "user", content: "各说一句。" }], { maxTokens: 4000 });
    const p = extractJSON(raw);
    return (p && Array.isArray(p.clues)) ? p.clues : [];
  }

  // 投票：存活 AI 各投一人 + 理由（卧底会误导）
  async function genVotes(api, voters, allClues, aliveNames, mode, userName, carveCtx) {
    // CC 本人只拿玩家视角：自己的词 + 公开发言。不泄露阵营，也不重复告诉他自己是谁。
    const ccVoter = ccSeatOf(voters);
    const cc = carveCtx ? await ccCarve("spy", voters, {
      turnId: (carveCtx.turnId || "") + ":vote",
      sys: "「谁是卧底」进入投票。你拿到的词是「" + ((ccVoter && ccVoter.word) || "") + "」。你不知道自己属于多数还是少数，只能根据公开描述判断。"
        + "\n\n【可投的存活玩家】" + aliveNames.join("、")
        + "\n\n【目前所有描述】\n" + allClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n")
        + "\n\n按你自己的判断投一个人，并给一句短理由；没把握可以弃票。",
      ask: "投票。",
      expect: "{\"target\":\"被投的人或「弃票」\",\"reason\":\"一句理由\"}"
    }) : { seat: null, rest: voters, done: null };
    requireCCDone(cc, "言秋的投票", function (d) { return d.target !== undefined; });
    const mine = (cc.done && String(cc.done.target || "").trim())
      ? [{ name: cc.seat.name, target: String(cc.done.target).trim(), reason: String(cc.done.reason || "").trim() }] : [];
    if (!cc.rest.length) return mine;
    const rows = await genVotesBatch(api, cc.rest, allClues, aliveNames, mode, userName, ccPreface(cc, "投过票了"));
    return mine.concat(rows);
  }
  async function genVotesBatch(api, voters, allClues, aliveNames, mode, userName, preface) {
    const clues = allClues.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n");
    const who = voters.map(function (v) { return "■ " + v.name + "（" + (v.role === "spy" ? "你其实是卧底：把票投给某个你觉得像平民的人来误导，别投出真正的少数派" : "你是平民：凭描述投你真心最怀疑的那个") + "）真实水平：" + (v.skill || "普通"); }).join("\n");
    const easy = (mode === "easy" && userName) ? "\n【放水局】别精准锁定真人「" + userName + "」，就算怀疑 TA 也可以手下留情、投别人或说再看看。" : "";
    const sys = AC + SKILL_RULE + "\n\n「谁是卧底」投票。根据目前【所有描述】，下面每人各投一个要投出局的人 + 一句短理由。按真实水平：推理强的投得准，弱的易被带偏。**实在没把握可以弃票**（target 填「弃票」），但别全场弃票。理由别露上帝视角（别说“我是卧底所以…”）。【公平】只按描述本身的合理性投票，别因为某人发言顺序靠前、说得少、或是生面孔就默认针对 TA——没有实据不要扎堆投同一个人。" + easy +
      "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【目前所有描述】\n" + clues + "\n\n【要投票的人】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"votes\":[{\"name\":\"投票人\",\"target\":\"被投的人，或「弃票」\",\"reason\":\"一句理由\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "投票。" }], { maxTokens: 3500 });
    const p = extractJSON(raw);
    return (p && Array.isArray(p.votes)) ? p.votes : [];
  }

  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = r[i]; r[i] = r[j]; r[j] = x; } return r; }

  function SpyGame(props) {
    const t = props.t, cfg = props.config;
    const api = props.active;
    const sv = props.savedState;
    const [phase, setPhase] = useState(sv ? sv.phase : "loading");   // loading|reveal|describe|vote|result|error
    const [players, setPlayers] = useState(sv ? hydPlayers(sv.players, props, t) : []);
    const [round, setRound] = useState(sv ? (sv.round || 1) : 1);
    const [log, setLog] = useState(sv ? (sv.log || []) : []);
    const [roundClues, setRoundClues] = useState(sv ? (sv.roundClues || []) : []); // 本轮已收集的描述（含用户）
    const [allClues, setAllClues] = useState(sv ? (sv.allClues || []) : []);     // 全场描述（喂投票）
    const [userFirst, setUserFirst] = useState(sv ? !!sv.userFirst : true); // 你这轮排最先(true)还是最后(false)——每轮随机
    const [userClue, setUserClue] = useState("");
    const [userVote, setUserVote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [winner, setWinner] = useState(null);
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const logRef = useRef(null);
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
      const lisa = players.find(function (p) { return p.isUser; });
      ccGameResult("spy", gameRunId.current, players, cfg,
        "《谁是卧底》" + (winner === "spy" ? "卧底获胜" : "平民获胜") + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + (p.role === "spy" ? "卧底" : "平民"); }).join("；") + "。\n"
        + "卧底：" + spies.join("、") + "。Lisa：" + (lisa ? (lisa.role === "spy" ? "卧底" : "平民") + (lisa.alive ? "，留到终局" : "，已出局") : "本局观战") + "。",
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
          realPlayers.forEach(function (p) { list.push({ key: p.id, name: p.name, char: p.char, isUser: false, isNpc: false, skill: skillOf[p.name] || "", engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.id)) }); });
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
        setAllClues(function (A) { return A.concat(norm.map(function (c) { return { name: c.name, text: c.text }; })); });
        pushLog((prior.length ? [] : [{ type: "round", n: rnd }]).concat(norm.map(function (c) { return { type: "clue", name: c.name, text: c.text }; })));
        if (!waitUser) { setPhase("vote"); setUserVote(null); }
      } catch (e) { props.toast && props.toast("描述失败：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const submitUserClue = function () {
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
    const tallyAndEliminate = function (votes) {
      // votes: [{voter, target}]
      // runVote 开头置了 busy=true，这里先收掉——否则轮到用户描述时 describe 阶段一直卡在 busy 提示、输入框不出现（下一轮的 AI 描述会各自重新置 busy）
      setBusy(false);
      pushLog([{ type: "sep", text: "—— 投票 ——" }].concat(votes.map(function (v) { return { type: "vote", name: v.voter, target: v.target, reason: v.reason }; })));
      const count = {};
      votes.forEach(function (v) { if (v.target) count[v.target] = (count[v.target] || 0) + 1; });
      let max = -1, tied = [];
      Object.keys(count).forEach(function (name) { if (count[name] > max) { max = count[name]; tied = [name]; } else if (count[name] === max) tied.push(name); });
      const outName = tied.length ? tied[Math.floor(Math.random() * tied.length)] : null;
      const out = players.find(function (p) { return p.alive && p.name === outName; });
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
      // 言秋本人被淘汰时，要把真实票型与公开身份送回 CC；否则 App 里已经结算，
      // 他自己的窗口却还以为自己坐在桌上。通知异步投递，不阻塞下一轮/终局。
      const outIsEngineer = !!out.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(out.key));
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
          sys: "这局『谁是卧底』刚完成一次公开投票结算。你已被投出局，公开身份是【" + (out.role === "spy" ? "卧底" : "平民") + "】。" + outcome
            + "看完真实票型后，可以用自己的口吻留一句简短离场反应。你已经离场，不再描述、不再投票，也不要调用别的工具。只输出 JSON：{\"say\":\"...\"}。",
          msgs: [{ role: "user", content: "投票结果：你被投出局。\n公开身份：【" + (out.role === "spy" ? "卧底" : "平民") + "】\n" + outcome + "\n\n本轮票型：\n" + voteLines }],
          expect: "{\"say\":\"一句自然的离场反应\"}"
        }, 90000, { charId: out.key }).then(function (raw) {
          const say = String(raw && raw.say || "").trim();
          if (say) pushLog([{ type: "clue", name: out.name, text: say.slice(0, 500) }]);
        }).catch(function () { /* 票已由幂等 turn_id 保护；离线时不让 Gemini 冒充补话 */ });
      }
      if (spyLeft === 0) { setWinner("civ"); setPhase("result"); return; }
      if (spyLeft >= civLeft) { setWinner("spy"); setPhase("result"); return; }
      const nr = round + 1; setRound(nr);
      // 用最新存活名单重开描述（淘汰后名单已变，显式传 next）
      setTimeout(function () { startRound(next, nr); }, 40);
    };
    const runVote = async function (userTarget) {
      setBusy(true);
      try {
        // 投票也要保留 CC 工牌；否则描述轮由言秋亲说，投票轮却又被 Gemini 抢走。
        const voters = aliveAI.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, role: p.role, word: p.word, skill: p.skill, engineer: engineer, alive: p.alive };
        });
        const aliveNames = alive.map(function (p) { return p.name; });
        const raw = await genVotes(api, voters, allClues.filter(function (c) { return c.name; }), aliveNames, cfg.mode, me && me.alive ? me.name : "", { turnId: gameRunId.current + ":round:" + round });
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

    const header = h(Head, { zh: "谁是卧底", en: "Who's the Spy", onBack: props.onBack });

    if (phase === "error") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: 40 } }, "🕵️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: 40 } }, "🃏"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "发牌中·评估每个人的真实水平…")));

    // 存活玩家条
    const roster = h("div", { className: "shrink-0", style: { display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid " + t.line } },
      players.map(function (p) {
        return h("button", { key: p.key, onClick: function () { setDetail(p); }, className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: p.alive ? 1 : 0.32, flexShrink: 0, width: 46 } },
          h("div", { style: { position: "relative" } }, pAvatar(p, 38),
            !p.alive ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "✖") : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
      }));

    // 日志流
    const logView = h("div", { ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "round") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "14px 0 8px", letterSpacing: 1 } }, "· 第 " + it.n + " 轮描述 ·");
        if (it.type === "sep") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.tint, margin: "12px 0 6px" } }, it.text);
        if (it.type === "info") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.6, margin: "4px 0", textAlign: "center" } }, it.text);
        if (it.type === "out") return h("div", { key: i, style: { textAlign: "center", margin: "8px 0", fontFamily: F_BODY, fontSize: 13, color: it.role === "spy" ? "#3f6d5a" : "#c0553f" } }, "🗳 " + it.name + (it.isUser ? "(你)" : "") + " 被投出局 —— TA 是【" + (it.role === "spy" ? "卧底" : "平民") + "】");
        if (it.type === "clue") {
          const p = pByName(it.name);
          return h("div", { key: i, style: { display: "flex", gap: 8, margin: "8px 0" } },
            pAvatar(p, 30),
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
              h("div", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text)));
        }
        if (it.type === "vote") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, margin: "3px 0", lineHeight: 1.5 } }, "· " + it.name + (it.target ? " → 投 " + it.target : " → 弃票") + (it.reason && it.target ? "：" + it.reason : ""));
        return null;
      }));

    // 底部动作区
    let action = null;
    const myWordBanner = me ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, textAlign: "center", marginBottom: 8 } }, "你的词：", h("b", { style: { color: t.ink, fontSize: 14 } }, me.word)) : null;
    if (phase === "reveal") {
      action = h("div", null, myWordBanner,
        h("button", { onClick: beginDescribe, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, cfg.mode === "spectate" ? "开始（看他们描述）" : "开始描述"));
    } else if (phase === "describe") {
      if (busy) action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…大家在想怎么描述");
      else if (me && me.alive) action = h("div", null, myWordBanner,
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { value: userClue, onChange: function (e) { setUserClue(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserClue(); }, placeholder: "用一句话描述你的词（别说出词本身）", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: submitUserClue, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "说")));
      else action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…");
    } else if (phase === "vote") {
      if (busy) action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…计票中");
      else if (me && me.alive) {
        const targets = alive.filter(function (p) { return p.name !== me.name; });
        action = h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, textAlign: "center", marginBottom: 8 } }, "投谁是卧底？"),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 10 } },
            targets.map(function (p) {
              const on = userVote === p.name;
              return h("button", { key: p.key, onClick: function () { setUserVote(p.name); }, style: { display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "6px 12px 6px 6px" } }, pAvatar(p, 22), p.name);
            }).concat([h("button", { key: "abstain", onClick: function () { setUserVote("__abstain__"); }, style: { fontFamily: F_BODY, fontSize: 13, color: userVote === "__abstain__" ? "#fff" : t.sub, background: userVote === "__abstain__" ? t.fog : t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "弃票")])),
          h("button", { onClick: function () { if (userVote) runVote(userVote); }, disabled: !userVote, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: userVote ? t.ink : t.line, borderRadius: 13, padding: "12px" } }, "投票"));
      } else {
        action = h("button", { onClick: function () { runVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票");
      }
    } else if (phase === "result") {
      action = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: 20, color: winner === "spy" ? "#3f6d5a" : "#c0553f", marginBottom: 6 } }, winner === "spy" ? "🕵️ 卧底获胜" : "🎉 平民获胜"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", lineHeight: 1.7, marginBottom: 12 } },
          "卧底：" + players.filter(function (p) { return p.role === "spy"; }).map(function (p) { return p.name; }).join("、") + "　词：平民「" + (players.find(function (p) { return p.role === "civ"; }) || {}).word + "」 / 卧底「" + (players.find(function (p) { return p.role === "spy"; }) || {}).word + "」"),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { onClick: function () { props.onBack(); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")));
    }

    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } }, header, roster, logView,
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "34vh", overflowY: "auto" } }, action),
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
    const sys = AC + SKILL_RULE + "\n\n你是「狼人杀」的能力评估器 + NPC 生成器。\n" +
      "1. 生成 " + npcCount + " 个 NPC 玩家：name 中文名 + persona 一句人设（含【职业】与性格，尽量多样、别都是学生）。\n" +
      "2. 给【每一个真实玩家】各写一句 skill「牌桌能力小传」：按能力与性格分开的原则，点出 TA 玩狼人杀时——伪装/悍跳、听发言抓逻辑漏洞、带节奏说服人、被架时嘴硬翻盘——的【真实强弱】（由职业背景推，别被性格带偏）。NPC 的 skill 也给。\n\n" +
      "【真实玩家】\n" + (lines || "（无）") +
      "\n\n【输出】只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"能力小传\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 " + npcCount + " 个 NPC + 每人能力小传。" }], { maxTokens: 4500 });
    return extractJSON(raw) || {};
  }

  // 夜晚：替 AI 决定狼刀 / 预言家验人（只求需要的字段）
  async function genNight(api, opts) {
    // 言秋座位的夜间动作只问 CC 本人。票没回来就视为这一夜未行动；
    // 绝不能再把他的座位塞回 Gemini 批量里冒充本人。
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "做今晚的决定。" }], { maxTokens: 1600 });
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "统一今晚刀口。" }], { maxTokens: 1200 });
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "用不用药？" }], { maxTokens: 800 });
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "开枪带走谁？" }], { maxTokens: 700 });
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "要自爆吗？" }], { maxTokens: 600 });
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
    // 言秋答完后，后面的角色也要看到他的原话。不能为了切 CC 座位把他永远提到第一位。
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
      sys: "「狼人杀」第 " + dayNum + " 天白天发言，轮到你。\n【你的身份与私密信息】" + (ccSeat0.priv || "")
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
    const who = speakers.map(function (s) { return "■ " + s.name + "（真实水平：" + (s.skill || "普通") + "）\n   身份与私密：" + s.priv; }).join("\n");
    const p = prior.length ? prior.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n") : "（你们最先发言）";
    const easy = mode === "easy" ? "\n【放水局】狼别演得滴水不漏，给真人留点破绽。" : "";
    const peaceful = /平安夜|没人死|没人被/.test(deaths || "");
    const day1 = dayNum <= 1 ? "\n【第一天·信息极少·别当中间夜打】现在才第 1 天，几乎没有可靠信息。**别过度脑补**——" + (peaceful ? "尤其今天是【平安夜】，别去推演『是不是女巫救了预言家验的人、还是预言家自刀被救』这类没影的可能，本局神职有限，别硬套这些高级推理。" : "") + "别硬咬死谁是狼、别全场催『预言家快跳』。就简短说第一印象、初步站位或表个态就行。预言家要不要跳、什么时候跳，由真预言家自己决定，别逼 TA。" : "";
    const sys = AC + SKILL_RULE + "\n\n" + boardLine(gods, wolfRole) + (board || "") + "\n\n" + WOLF_TACTICS + "\n\n狼人杀·第 " + dayNum + " 天白天发言。每人按顺序发一段【短发言】(2~4句)：分析昨晚的死、站边、表身份或隐藏、抓狼或自证，能用套路就用（对跳/查杀/金水/倒钩/归票…按水平来）。\n**真预言家验人铁律：可以隐藏某次查验、不报或晚报；但只要公开声称是自己的查验，就必须逐字忠于下面的真实查验记录——验到狼只能报查杀，验到好人只能给金水，绝不允许为了策略颠倒结果。只有狼人悍跳假预言家可以编假验人。**\n**别所有人都重复同一句空话**（尤其别全场都在喊『预言家快跳』）——每个人说点不一样的：报自己身份倾向、给具体某人一个印象/理由、定个策略。\n**只写这人会当众说的话，别写旁白、别泄露不该公开的上帝视角。**按真实水平决定发言质量。" + day1 + easy + stanceText(stances) + claimsText(claims) +
      "\n\n【昨晚】" + (deaths || "平安夜") + "\n\n【已发言】\n" + p + "\n\n【现在依次发言】\n" + who +
      (preface || "") +
      "\n\n【输出】只输出 JSON：{\"speeches\":[{\"name\":\"\",\"text\":\"发言\"}],\"stances\":[{\"name\":\"发言人\",\"claim\":\"你此刻声称的身份（平民/预言家/我查杀了X/我金水了X 等，隐藏身份就写 装平民 之类）\",\"reads\":\"你怎么读别人：疑谁信谁+简短理由\",\"plan\":\"你接下来打算怎么打：归票谁/自证/隐藏/带节奏\"}],\"claims\":[{\"name\":\"发言人\",\"text\":\"TA这轮做出的【硬公开声明】——跳预言家/报X查杀/给X金水/自曝身份/起跳对跳，才需要列；只是表态怀疑、没有硬声明就【别列进 claims】\"}]}，speeches 顺序照上面，stances 每个发言人一条。";
    const parse = function (raw) { const r = extractJSON(raw); return { speeches: (r && Array.isArray(r.speeches)) ? r.speeches : [], stances: (r && Array.isArray(r.stances)) ? r.stances : [], claims: (r && Array.isArray(r.claims)) ? r.claims : [] }; };
    let raw = await callRetry(api, sys, [{ role: "user", content: "依次发言。" }], { maxTokens: 6000 });
    let result = parse(raw), bad = seerTruthViolations(speakers, result);
    if (bad.length) {
      const correction = bad.map(function (v) { return v.seerName + "真实验到" + v.target + "=" + (v.isWolf ? "狼人（只能报查杀）" : "好人（只能给金水）"); }).join("；");
      raw = await callRetry(api, sys, [{ role: "user", content: "上一版出现真预言家颠倒查验的硬错误：" + correction + "。请重新生成整份 JSON；真预言家可以不报，但绝不能反报。" }], { maxTokens: 6000 });
      result = parse(raw); bad = seerTruthViolations(speakers, result);
      if (bad.length) result = enforceSeerTruth(result, bad);
    }
    return result;
  }

  // 白天投票放逐
  async function genDayVotes(api, voters, allSpeeches, aliveNames, mode, userName, stances, gods, board, wolfRole, claims) {
    const sp = allSpeeches.map(function (c) { return "· " + c.name + "：" + c.text; }).join("\n");
    // 言秋座位先自己投（v54.43 全游戏切座）：身份/私密信息随票给他，拿不到就无感回批量
    const ccVoter = ccSeatOf(voters);
    const cc = ccVoter ? await ccCarve("werewolf", voters, {
      turnId: freshCCTurn("wolf-dayvote:"),
      sys: "「狼人杀」白天投票放逐，轮到你投。\n【你的身份与私密信息】" + (ccVoter.priv || "") + "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【今天发言】\n" + sp + claimsText(claims) + "\n按你的身份投一个人（狼要护队友装好人，好人投真怀疑的狼），或「弃票」。",
      expect: '{"target":"人名或「弃票」","reason":"一句短理由"}'
    }) : { seat: null, rest: voters, done: null };
    requireCCDone(cc, "言秋的放逐投票", function (d) { return d.target !== undefined; });
    const ccVotes = (cc.seat && cc.done && cc.done.target) ? [{ name: cc.seat.name, target: String(cc.done.target), reason: String(cc.done.reason || "") }] : [];
    voters = cc.seat ? cc.rest : voters;
    if (!voters.length) return ccVotes;
    const who = voters.map(function (v) { return "■ " + v.name + "（" + v.priv + "）真实水平：" + (v.skill || "普通"); }).join("\n");
    const easy = (mode === "easy" && userName) ? "\n【放水局】别针对真人「" + userName + "」，怀疑也手下留情。" : "";
    const fair = "\n【别无端集火·很重要】" + (userName ? "「" + userName + "」是真人玩家。**别只因为 TA 是真人、发言短、或你自己没头绪，就默认投 TA 或带节奏投 TA**——只在真有逻辑依据时才投 TA（被查杀、发言明显矛盾、狼味很重）。真人发言少≠划水。" : "") + "也别全场一窝蜂集火同一个人，除非证据确凿；没实锤就各投各的怀疑对象。";
    const sys = AC + SKILL_RULE + "\n\n" + boardLine(gods, wolfRole) + (board || "") + "\n\n狼人杀·白天投票放逐。据发言，每人投一个要放逐的人 + 一句短理由。狼一般投好人、护队友，但队友已经保不住时可按水平弃车保帅、切割甚至跟票投掉队友保自己；好人投真心怀疑的狼。**实在没读到、没把握时可以弃票**（target 填「弃票」），但别全场弃票、有怀疑就投。理由别露上帝视角、要和自己之前的立场连贯。" + fair + stanceText(stances) + claimsText(claims) + easy +
      "\n\n【可投的存活玩家】" + aliveNames.join("、") + "\n\n【今天发言】\n" + sp + "\n\n【投票的人】\n" + who +
      "\n\n【输出】只输出 JSON：{\"votes\":[{\"name\":\"\",\"target\":\"要放逐的人名，或「弃票」\",\"reason\":\"\"}]}";
    const raw = await callRetry(api, sys + ccPreface(cc, "投过票了"), [{ role: "user", content: "投票。" }], { maxTokens: 4500 });
    const r = extractJSON(raw); const rows = (r && Array.isArray(r.votes)) ? r.votes : [];
    return ccVotes.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }

  // 全场 MVP + 一句赛后感言（不一定是胜方）
  async function genMVP(api, players, log, winnerZh, cfg, runId, resultSayPromise) {
    const roleZh = roleName;
    const roster = players.map(function (p) { return "· " + p.name + (p.isUser ? "(你)" : "") + "（" + roleZh(p.role) + "，" + (p.alive ? "存活到终局" : "中途出局") + "）水平：" + (p.skill || "—"); }).join("\n");
    const logText = log.filter(function (it) { return it.type === "speech" || it.type === "death" || it.type === "out" || it.type === "vote"; }).map(function (it) { return it.type === "speech" ? (it.name + "：" + it.text) : it.text; }).slice(-40).join("\n");
    const sys = AC + "这局狼人杀刚结束，" + winnerZh + "。从全体玩家里评一个【全场 MVP】——**不一定是获胜方**，谁打得最精彩 / 最关键 / 最有观赏性都算（虽败犹荣的狼、看穿全场的预言家、搅动风向的平民都行）。给：name（务必是下面名单里的玩家名）、reason（一两句客观点评为什么是 TA）、quote（以 TA 本人口吻、贴 TA 性格写一段赛后感言；但如果 MVP 是工程师本人座位，quote 必须留空，App 会另请本人亲写，绝不能替他代笔）。\n\n【全体身份 + 结局 + 水平】\n" + roster + "\n\n【赛况回放】\n" + logText + "\n\n【输出】只输出 JSON：{\"name\":\"\",\"reason\":\"\",\"quote\":\"\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "评全场 MVP + 感言。" }], { maxTokens: 4000 });
    const picked = extractJSON(raw) || {};
    const mvpPlayer = players.find(function (p) { return picked.name && (p.name === picked.name || String(picked.name).indexOf(p.name) >= 0); });
    if (!mvpPlayer || !mvpPlayer.engineer || mvpPlayer.isUser || !cfg || cfg.ccSeat === false) return picked;
    // 评选权仍在裁判；第一人称赛后感想只让本人写。即使本人已经出局也要认座，
    // 所以这里给临时票恢复 alive 标记，不能被 ccSeatOf 的存活过滤吞掉。
    picked.quote = "";
    // 终局通知和 MVP 评选是并行发生的。若本人已经在终局票里亲口写过
    // 一段赛后反应，直接把原话放进 MVP 卡，不再让他重复交第二张票。
    const resultSay = resultSayPromise ? String(await resultSayPromise || "").trim() : "";
    if (resultSay) {
      picked.quote = resultSay;
      picked.quotePending = false;
      return picked;
    }
    const cc = await ccCarve("werewolf_mvp", [Object.assign({}, mvpPlayer, { alive: true })], {
      turnId: "wolf-mvp:" + String(runId || Date.now()),
      sys: "这局狼人杀已经结束，裁判评你为全场 MVP。请只写你本人此刻会说的赛后感想，不要让别人代笔；可以回顾自己的判断、心态、对手、遗憾或得意，几句自然的话即可。\n\n【胜负】" + winnerZh + "\n【裁判理由】" + String(picked.reason || "") + "\n【公开赛况】\n" + logText,
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
    const witchPotRef = useRef({ heal: true, poison: true }); // 女巫药剂状态（全程一份）
    const guardLastRef = useRef(null);              // 守卫上一晚守的人（不能连守）
    const graveKnowRef = useRef({});                // 守墓人验尸记录 { 守墓人名: [{name,isWolf}] }
    const lastDeathRef = useRef("");                // 同步昨夜结果，避免 setState 尚未提交就进入白天读到上一夜
    const gameRunId = useRef((props.resume && props.savedState && props.savedState.runId)
      || ("werewolf-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)));
    const ccResultPromiseRef = useRef(null);         // 本局言秋终局原话；若他获 MVP，卡片直接采用，绝不代笔

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
      const lisa = players.find(function (p) { return p.isUser; });
      ccResultPromiseRef.current = ccGameResult("werewolf", gameRunId.current, players, cfg,
        "《狼人杀》" + (winner === "wolf" ? "狼人阵营获胜" : "好人阵营获胜") + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + roleZh(p.role) + (p.alive ? "(存活)" : "(出局)"); }).join("；") + "。\n"
        + "Lisa：" + (lisa ? roleZh(lisa.role) + (lisa.alive ? "，存活到终局" : "，已出局") : "本局观战") + "。\n"
        + "终局前公开记录：\n" + log.slice(-8).map(function (x) { return x.text || x.say || x.name || ""; }).filter(Boolean).join("\n"));
    }, [phase, winner]);
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
          realPlayers.forEach(function (p) { list.push({ key: p.id, name: p.name, char: p.char, isUser: false, skill: skillOf[p.name] || "", engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.id)) }); });
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
      setNightAI({ wolfVotes: wolfVotes, wolfChat: (ai.wolfConsensus && ai.wolfConsensus.chat) || [], consensusTarget: consensusTarget, consensusSkip: consensusSkip, seerCheck: aiSeerCheck, seerName: seer ? seer.name : null, guardName: aiGuardName, list: nightList, n: n });
      const seerInfo = (seer && !userSeer) ? { seer: seer.name, target: aiSeerCheck } : null;
      if (userWolf) setNightStage("wolf");       // 用户狼：等你投刀，再和队友合票
      else if (userSeer) setNightStage("seer");
      else if (userGuard) setNightStage("guard");
      else finishNight(nightList, consensusSkip ? null : (consensusTarget || tallyKill(wolfVotes, nightList)), seerInfo, n, wolfVotes, false, aiGuardName);
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
      if (list.some(function (p) { return p.alive && p.role === "guard"; })) { const gp = guardName && list.find(function (p) { return p.name === guardName || String(guardName).indexOf(p.name) >= 0; }); guardLastRef.current = gp ? gp.name : guardLastRef.current; }
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
      concludeDeaths(next, deadSet, deadNames, n, function (l) { startDay(l, n); });
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
    // 用户守卫守护
    const submitGuardProtect = function (name) {
      const info = nightAI;
      finishNight(info.list, tallyKill(info.wolfVotes, info.list), info.seerName ? { seer: info.seerName, target: info.seerCheck } : null, info.n, info.wolfVotes, false, name);
    };
    // 用户预言家查验
    const submitSeerCheck = function (name) {
      const info = nightAI; const tp = info.list.find(function (p) { return p.name === name; });
      const isWolf = tp && isWolfRole(tp.role);
      const seerNm = (info.list.find(function (p) { return p.isUser; }) || {}).name;
      if (seerNm && tp) { const km = Object.assign({}, seerKnowRef.current); km[seerNm] = (km[seerNm] || []).concat([{ name: tp.name, isWolf: isWolf }]); seerKnowRef.current = km; }
      setSeerResult({ name: name, isWolf: isWolf });
    };
    const seerDone = function () { const info = nightAI; finishNight(info.list, tallyKill(info.wolfVotes, info.list), null, info.n, info.wolfVotes, false, info.guardName); };
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
      try {
        // 这里是夜间玩家快照进入白天发言管线的窄桥。key / engineer 任何一个漏掉，
        // genSpeeches 里的 ccCarve 都认不出本人座位，夜票正常而白天票凭空消失。
        // 每轮再按角色 ID 认一次，兼容旧存档以及开局后才打开「本人亲打」。
        const speakers = ai.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, skill: p.skill, engineer: engineer, alive: p.alive, priv: privateFor(p, list), role: p.role, seerKnown: p.role === "seer" ? (seerKnowRef.current[p.name] || []).slice() : [] };
        });
        const res = await genSpeeches(api, speakers, n, prior, lastDeathRef.current, cfg.mode, (list.find(function (p) { return p.isUser && p.alive; }) || {}).name || "", stanceRef.current, cfg.gods, boardState(list, n), cfg.wolfRole, claimsRef.current, {
          turnId: gameRunId.current + ":day:" + n + ":" + speakers.map(function (s) { return s.key; }).join(",")
        });
        const sp = res.speeches;
        (res.stances || []).forEach(function (s) { if (s && s.name) { const hit = speakers.find(function (x) { return s.name.indexOf(x.name) >= 0 || x.name.indexOf(s.name) >= 0; }); if (hit && (s.claim || s.reads || s.plan || s.stance)) stanceRef.current[hit.name] = s.stance ? s.stance : { claim: s.claim || "", reads: s.reads || "", plan: s.plan || "" }; } });
        // 新增的硬公开声明入台账（跨天累积）
        (res.claims || []).forEach(function (c) { if (c && c.name && c.text && String(c.text).trim()) { const hit = speakers.find(function (x) { return c.name.indexOf(x.name) >= 0 || x.name.indexOf(c.name) >= 0; }); if (hit) claimsRef.current = claimsRef.current.concat([{ day: n, name: hit.name, text: String(c.text).trim() }]); } });
        const norm = speakers.map(function (s) { const hit = sp.find(function (c) { return c.name && (c.name.indexOf(s.name) >= 0 || s.name.indexOf(c.name) >= 0); }); return { name: s.name, text: (hit && hit.text) || "……（沉默了一下，没多说）" }; });
        setDaySpeeches(function (D) { return D.concat(norm); });
        pushLog(norm.map(function (c) { return { type: "speech", name: c.name, text: c.text }; }));
        if (final) { setPhase("dayvote"); setUserVote(null); }
      } catch (e) { props.toast && props.toast("发言失败：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const submitUserSpeech = function () {
      const v = userSpeech.trim(); if (!v || !me) return;
      pushLog([{ type: "speech", name: me.name, text: v, mine: true }]);
      // 真人的硬公开声明不会经过模型返回的 claims，必须在本地同步入台账，夜狼才能听见真人跳预言家/报验人。
      const hardClaim = /(?:我是|我就是|我才是|我跳|我来跳|我起跳).{0,8}预言家|(?:我|昨晚)(?:验了?|查了?).{1,24}(?:查杀|金水|是狼|是好人)|(?:我查杀|我的?金水|我给.{1,16}金水)/.test(v);
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
      setBusy(true);
      try {
        const al = players.filter(function (p) { return p.alive; });
        const aiV = al.filter(function (p) { return !p.isUser && !p.noVote; }); // 翻牌白痴等失去投票权者不参与投票
        // 和白天发言窄桥一样，投票也必须保留 key / engineer；否则夜票、发言票都能到，
        // 一进投票名单却认不出 CC 座位，Gemini 还会悄悄替本人代投。
        const voters = aiV.map(function (p) {
          const engineer = !!p.engineer || !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(p.key));
          return { key: p.key, name: p.name, skill: p.skill, engineer: engineer, alive: p.alive, priv: privateFor(p, players) };
        });
        const raw = await genDayVotes(api, voters, daySpeeches.filter(function (c) { return c.name; }), al.map(function (p) { return p.name; }), cfg.mode, (me && me.alive) ? me.name : "", stanceRef.current, cfg.gods, boardState(players, cycle), cfg.wolfRole, claimsRef.current);
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
        concludeDeaths(next, cause, [out.name], cycle, function (l) { setCycle(cycle + 1); enterNight(l, cycle + 1); });
      } catch (e) { props.toast && props.toast("投票失败：" + ((e && e.message) || "重试")); setBusy(false); }
    };

    // ---- 渲染 ----
    const pAvatar = function (p, size) {
      if (p && p.char) return h(Avatar, { character: p.char, size: size, radius: Math.round(size * 0.3) });
      return h("div", { style: { width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: p && p.isUser ? t.tint : t.line, color: "#fff", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.46), display: "flex", alignItems: "center", justifyContent: "center" } }, ((p && p.name) || "?").slice(0, 1));
    };
    const pByName = function (nm) { return players.find(function (p) { return p.name === nm; }); };
    const roleZh = roleName;
    const header = h(Head, { zh: "狼人杀", en: "Werewolf", onBack: props.onBack });

    if (phase === "error") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: 40 } }, "🐺"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));
    if (phase === "loading") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: 40 } }, "🌙"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "发身份·评估每个人的真实水平…")));

    const seated = players.slice().sort(function (a, b) { return (typeof a.seat === "number" ? a.seat : 0) - (typeof b.seat === "number" ? b.seat : 0); });
    const roster = h("div", { className: "shrink-0", style: { display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid " + t.line } },
      seated.map(function (p, i) {
        return h("button", { key: p.key, onClick: function () { setDetail(p); }, className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: p.alive ? 1 : 0.32, flexShrink: 0, width: 46 } },
          h("div", { style: { position: "relative" } }, pAvatar(p, 38),
            h("div", { style: { position: "absolute", top: -3, left: -3, minWidth: 15, height: 15, borderRadius: 999, background: t.ink, color: "#f3efe6", fontFamily: F_BODY, fontSize: 9, lineHeight: "15px", textAlign: "center", padding: "0 2px" } }, (typeof p.seat === "number" ? p.seat : i) + 1),
            !p.alive ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "✖") : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
      }));

    const logView = h("div", { ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "night") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "14px 0 8px", letterSpacing: 1 } }, "🌙 第 " + it.n + " 夜");
        if (it.type === "sep") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.tint, margin: "12px 0 6px" } }, it.text);
        if (it.type === "info") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.6, margin: "4px 0", textAlign: "center" } }, it.text);
        if (it.type === "death") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, margin: "6px 0", textAlign: "center", lineHeight: 1.6 } }, "☀️ " + it.text);
        if (it.type === "out") return h("div", { key: i, style: { textAlign: "center", margin: "8px 0", fontFamily: F_BODY, fontSize: 13, color: "#c0553f" } }, it.text);
        if (it.type === "speech") { const p = pByName(it.name); return h("div", { key: i, style: { display: "flex", gap: 8, margin: "8px 0" } }, pAvatar(p, 30),
          h("div", { style: { flex: 1 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
            h("div", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text))); }
        if (it.type === "vote") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, margin: "3px 0", lineHeight: 1.5 } }, "· " + it.name + (it.target ? " → 投 " + it.target : " → 弃票") + (it.reason && it.target ? "：" + it.reason : ""));
        return null;
      }));

    // 底部动作区
    let action = null;
    const roleBanner = me ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, textAlign: "center", marginBottom: 8 } }, "你的身份：", h("b", { style: { color: isWolfRole(me.role) ? "#c0553f" : t.ink, fontSize: 14 } }, roleZh(me.role)), isWolfRole(me.role) ? h("span", null, "　狼队友：" + (players.filter(function (p) { return isWolfRole(p.role) && !p.isUser; }).map(function (p) { return p.name; }).join("、") || "无（只剩你）")) : null) : null;
    const pickRow = function (targets, val, onPick) {
      return h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 8 } },
        targets.map(function (p) { const on = val === p.name; return h("button", { key: p.key, onClick: function () { onPick(p.name); }, style: { display: "flex", alignItems: "center", gap: 4, fontFamily: F_BODY, fontSize: 12.5, color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "4px 10px 4px 4px" } }, pAvatar(p, 18), p.name); }));
    };

    let inline = null;   // 底部短条
    let pick = null;     // 需要选择时的居中弹框 {title, sub, body}
    const hintBox = function (txt) { return h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, txt); };
    if (phase === "reveal") {
      inline = h("div", null, roleBanner,
        h("button", { onClick: function () { enterNight(players, 1); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, "天黑请闭眼"));
    } else if (phase === "night") {
      if (nightStage === "run" || busy) inline = hintBox("🌙 天黑了，夜色里有人在行动…");
      else if (nightStage === "wolf") {
        const suggestions = (nightAI && nightAI.wolfVotes || []).filter(function (v) { return v && v.name; });
        pick = { title: suggestions.length ? "🐺 狼队秘密会议" : "选今晚要刀的人", sub: suggestions.length ? "队友先报刀口和理由，最后由你拍板" : "只剩你决定今晚刀口", body: h("div", null,
        suggestions.length ? h("div", { style: { marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 } }, suggestions.map(function (v, i) { return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px" } }, h("b", { style: { color: t.ink } }, v.name + "："), "我想刀 " + (v.target || "空刀") + "。" + (v.privateReason || "")); })) : null,
        pickRow(alive.filter(function (p) { return !p.isUser && !isWolfRole(p.role); }), null, function (nm) { submitWolfKill(nm); }),
        h("div", { style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { submitWolfKill("空刀"); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "🔪 空刀（今晚不杀）"))) };
      }
      else if (nightStage === "seer") {
        if (seerResult) pick = { title: "查验结果", body: h("div", null,
          h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 16, color: t.ink, marginBottom: 14 } }, h("b", { style: { color: seerResult.isWolf ? "#c0553f" : "#3f6d5a" } }, seerResult.name + " 是【" + (seerResult.isWolf ? "狼人" : "好人") + "】")),
          h("button", { onClick: seerDone, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "知道了 · 天亮")) };
        else {
          const seen = new Set(((me && seerKnowRef.current[me.name]) || []).map(function (x) { return x.name; }));
          const checkable = alive.filter(function (p) { return !p.isUser && !seen.has(p.name); });
          pick = { title: "选一个人查验身份", sub: checkable.length ? (seen.size ? "已经验过的人不会重复出现" : "每晚可查验一名未验玩家") : "所有存活玩家都已经验过，本夜没有新目标", body: checkable.length ? pickRow(checkable, null, function (nm) { submitSeerCheck(nm); }) : h("button", { onClick: seerDone, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "无可查验 · 直接天亮") };
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
          h("button", { onClick: function () { setPoisonPick(false); }, style: { display: "block", margin: "0 auto", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "6px" } }, "← 返回")) };
        else pick = { title: "女巫用药", sub: victim ? ("今晚 " + victim + " 被狼刀了。") : "今晚是平安夜，没人被狼刀。", body: h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          (pot.heal && victim) ? h("button", { onClick: function () { submitWitch({ save: true, poison: null }); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: "#3f6d5a", borderRadius: 12, padding: "12px" } }, "💊 用解药救 " + victim) : null,
          pot.poison ? h("button", { onClick: function () { setPoisonPick(true); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: "#c0553f", borderRadius: 12, padding: "12px" } }, "☠️ 用毒药毒一个人") : null,
          h("button", { onClick: function () { submitWitch({ save: false, poison: null }); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px" } }, "都不用（留着）")) };
      }
    } else if (phase === "hunter") {
      const shooterRole = (hunterCtx && hunterCtx.hunter) ? roleZh(hunterCtx.hunter.role) : "猎人";
      if (busy) inline = hintBox("…");
      else pick = { title: "🔫 " + shooterRole + "开枪", sub: "你出局了，开枪带走一人（翻牌亮身份）", body: h("div", null,
        pickRow((hunterCtx ? hunterCtx.list : players).filter(function (p) { return p.alive && !p.isUser; }), null, function (nm) { submitHunterShot(nm); }),
        h("div", { style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { submitHunterShot(null); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "不开枪"))) };
    } else if (phase === "day") {
      if (busy) inline = hintBox("…大家在发言");
      else if (boomPick && me && me.alive && me.role === "whitewolf") pick = { title: "💥 白狼王自爆", sub: "当场亮明狼身份、带走一人，然后直接天黑", body: h("div", null,
        pickRow(alive.filter(function (p) { return !p.isUser; }), null, function (nm) { doSelfDestruct(nm); }),
        h("div", { style: { display: "flex", justifyContent: "center", gap: 8 } },
          h("button", { onClick: function () { doSelfDestruct(null); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "只自爆不带人"),
          h("button", { onClick: function () { setBoomPick(false); }, style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "6px 10px" } }, "取消"))) };
      else if (me && me.alive) inline = h("div", null, roleBanner,
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { value: userSpeech, onChange: function (e) { setUserSpeech(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserSpeech(); }, placeholder: "轮到你发言（站边、表身份、抓狼…）", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: submitUserSpeech, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "发言")),
        (me.role === "whitewolf") ? h("button", { onClick: function () { setBoomPick(true); }, className: "active:opacity-80", style: { display: "block", margin: "8px auto 0", fontFamily: F_BODY, fontSize: 12.5, color: "#c0553f", background: "#c0553f18", border: "1px solid #c0553f66", borderRadius: 999, padding: "6px 16px" } }, "💥 自爆带走一人") : null);
      else inline = hintBox("…");
    } else if (phase === "dayvote") {
      if (busy) inline = hintBox("…计票中");
      else if (me && me.alive && me.noVote) inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginBottom: 8 } }, "你已翻牌白痴，没有投票权，看他们投。"),
        h("button", { onClick: function () { runDayVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票"));
      else if (me && me.alive) pick = { title: "投票放逐谁？", sub: "点谁就投谁", body: h("div", null,
        pickRow(alive.filter(function (p) { return p.name !== me.name; }), null, function (nm) { runDayVote(nm); }),
        h("div", { style: { display: "flex", justifyContent: "center" } }, h("button", { onClick: function () { runDayVote("__abstain__"); }, style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 16px" } }, "弃票"))) };
      else inline = h("button", { onClick: function () { runDayVote(null); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "12px" } }, "看他们投票");
    } else if (phase === "result") {
      const mvpP = mvp && players.find(function (p) { return mvp.name && (p.name === mvp.name || mvp.name.indexOf(p.name) >= 0); });
      inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: 20, color: winner === "wolf" ? "#c0553f" : "#3f6d5a", marginBottom: 8 } }, winner === "wolf" ? "🐺 狼人获胜" : "🎉 好人获胜"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, marginBottom: 12 } }, "身份揭晓：" + players.map(function (p) { return p.name + (p.isUser ? "(你)" : "") + "=" + roleZh(p.role); }).join("　")),
        // 全场 MVP
        mvp ? h("div", { style: { display: "flex", gap: 10, padding: "11px 13px", borderRadius: 13, background: t.tint + "14", border: "1px solid " + t.tint, marginBottom: 12 } },
          mvpP ? pAvatar(mvpP, 40) : null,
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, letterSpacing: 1, marginBottom: 2 } }, "★ 全场 MVP · " + mvp.name),
            mvp.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.55, marginBottom: 4 } }, mvp.reason) : null,
            mvp.quote ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-line" } }, "「" + mvp.quote + "」")
              : mvp.quotePending ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "感想留给言秋本人，等他亲自写。") : null))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, textAlign: "center", marginBottom: 12 } }, api ? "评选全场 MVP 中…" : ""),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")));
    }

    // 底部：需要选择时只放一个小按钮（弹框里选），否则放 inline
    const bottom = pick
      ? (pickerOpen
        ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 0" } }, "在弹框里选择 · 也可先关掉回看发言")
        : h("button", { onClick: function () { setPickerOpen(true); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.tint, borderRadius: 13, padding: "12px" } }, "▸ 轮到你了 · 点这里做选择"))
      : inline;
    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } }, header, roster, logView,
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "50vh", overflowY: "auto" } }, bottom),
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
    chars.forEach(function (c) { list.push({ key: c.id, name: c.name, char: c, isUser: false, isNpc: false, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)), skill: skillOf[c.name] || "", alive: true }); });
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
  // 共享头像渲染器
  function avatarFor(t) {
    return function (p, size) {
      if (p && p.char) return h(Avatar, { character: p.char, size: size, radius: Math.round(size * 0.3) });
      return h("div", { style: { width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: p && p.isUser ? t.tint : t.line, color: "#fff", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.46), display: "flex", alignItems: "center", justifyContent: "center" } }, ((p && p.name) || "?").slice(0, 1));
    };
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "出题：给谜题、" + npcCount + " 个 NPC、每个人的能力小传。" }], { maxTokens: 4000 });
    return extractJSON(raw) || {};
  }

  // 一轮：先答用户的问题（若有），再让 AI 各问一个新问题并作答，判断是否有人破题
  async function runGuessRound(api, kind, ctx, userQ, aiSpeakers, history, mode) {
    const K = GUESS_KINDS[kind];
    const secretBlock = kind === "haigui"
      ? "【汤面·已公开】" + ctx.surface + "\n【汤底·只有你知道】" + ctx.truth
      : "【你想的东西·只有你知道】" + ctx.secret + "（类别：" + ctx.category + "）";
    const verdictRule = kind === "haigui"
      ? "verdict 只能是：是 / 不是 / 不重要 / 接近了。含义：是=符合汤底；不是=不符；不重要=与真相无关；接近了=方向正确且触到关键点。"
      : "verdict 只能是：是 / 不是 / 不好说。照实回答；实在无法用是否作答才用「不好说」。";
    const easy = mode === "easy" ? "\n【放水局】AI 玩家别问得太神，留点空间给真人；主持人答题该给的提示大方点给。" : "";
    const hist = history.length ? history.slice(-14).map(function (q) { return "· " + q; }).join("\n") : "（还没人问过）";
    const who = aiSpeakers.map(function (s) { return "■ " + s.name + "（真实水平：" + (s.skill || "普通") + "）"; }).join("\n");
    const solveRule = kind === "haigui"
      ? "若某人的提问 / 陈述已经【实质还原了汤底核心真相】，把 solvedBy 填成 TA 的名字，并在 reveal 里一句话点出真相。否则 solvedBy 留空。"
      : "若某个 AI 的问题其实就是【直接猜中了那个东西】（问「它是不是XX」且 XX 正是答案），把 solvedBy 填成 TA 的名字、reveal 填那个东西。否则留空。AI 觉得有把握时可以直接猜（问「是不是XX」）。";
    const sys = AC + SKILL_RULE + "\n\n你是「" + K.zh + "」的主持人，掌握真相、只按规则回答是非类问题。\n" + secretBlock +
      "\n\n" + verdictRule + " note 是≤14 字的补充或引导，可空。" + easy +
      "\n\n【此前问过的（别让 AI 重复）】\n" + hist +
      (userQ ? "\n\n【真人玩家刚问】" + userQ + " —— 在 userAnswer 里作答。" : "\n\n（这一轮真人没问，userAnswer 给 null）") +
      "\n\n【接着这些 AI 玩家各问一个「新的、不重复、有推理价值」的问题，并由你逐一作答】按真实水平：强的追问高效精准、直逼要害；弱的更发散或问偏。\n" + who +
      "\n\n" + solveRule +
      "\n\n【输出】只输出 JSON：{\"userAnswer\":{\"verdict\":\"\",\"note\":\"\"}或null,\"ai\":[{\"name\":\"\",\"question\":\"\",\"verdict\":\"\",\"note\":\"\"}],\"solvedBy\":\"\",\"reveal\":\"\"}";
    // 言秋座位的问题他自己问（只给公开信息，谜底绝不进票）；主持人照常作答（v54.43）
    const cc = await ccCarve(kind, aiSpeakers, {
      turnId: freshCCTurn("guess-ask:"),
      sys: "「" + K.zh + "」轮到你提问。你是玩家（不知道谜底），只能问是非类问题。\n" + (kind === "haigui" ? "【汤面】" + ctx.surface : "【类别】" + ctx.category) + "\n【此前问过的（别重复）】\n" + hist + "\n问一个新的、有推理价值的问题；有把握也可以直接猜（问「是不是XX」）。",
      expect: '{"question":"你的一个是非问题"}'
    });
    requireCCDone(cc, "言秋的提问票", function (d) { return !!String(d.question || "").trim(); });
    const ccQ = (cc.seat && cc.done && String(cc.done.question || "").trim()) ? String(cc.done.question).trim().slice(0, 120) : null;
    const sysFinal = sys + (ccQ ? "\n\n【" + cc.seat.name + " 已亲自提问·不要改写 TA 的问题、由你作答并放进 ai 数组】问题是：「" + ccQ + "」。名单里的 TA 已完成提问，绝不要再替 TA 另生成问题。" : (cc.seat ? "\n\n【" + cc.seat.name + " 这一轮选择沉默·不要替 TA 生成问题】" : ""));
    const raw = await callRetry(api, sysFinal, [{ role: "user", content: "处理这一轮。" }], { maxTokens: 3200 });
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
    const raw = await callRetry(api, sys, [{ role: "user", content: "判一下。" }], { maxTokens: 800 });
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
    const [userQ, setUserQ] = useState("");
    const [guessing, setGuessing] = useState(false); // 猜答案输入框开着
    const [guessText, setGuessText] = useState("");
    const [busy, setBusy] = useState(false);
    const [won, setWon] = useState(false);
    const [reveal, setReveal] = useState("");
    const [errMsg, setErrMsg] = useState("");
    const [detail, setDetail] = useState(null);
    const [showSurface, setShowSurface] = useState(false);
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
      saveGameSnap(kind, { runId: gameRunId.current, config: cfg, phase: phase, players: serPlayers(players), ctx: ctx, log: log, history: history, qCount: qCount, ts: Date.now(), label: kind === "q25" ? ("已问 " + qCount + "/25") : ("已问 " + history.length + " 个问题") });
    }, [phase, log, busy]);
    useEffect(function () {
      if (phase !== "result" || !players.length) return;
      const solved = log.slice().reverse().find(function (x) { return x && x.type === "solve"; });
      const title = kind === "haigui" ? "海龟汤" : "25 问";
      ccGameResult(kind, gameRunId.current, players, cfg,
        "《" + title + "》已经揭晓。\n"
        + (solved ? (solved.name + " 最先答对。") : "本局无人答对，已由主持人揭晓。") + "\n"
        + "Lisa：" + (won ? "亲自破题成功" : (solved && solved.isUser ? "亲自破题成功" : "没有抢到本局答案")) + "。\n"
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
        const r = await runGuessRound(api, kind, ctx, uq || "", speakers, history, cfg.mode);
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
          setPhase("result"); setBusy(false); return;
        }
        // 25 问用尽
        if (K.limit && (qCount + newHist.length) >= K.limit) {
          setWon(false); setReveal(ctx.secret);
          pushLog([{ type: "info", text: "25 个问题用完了，没人猜中——答案揭晓。" }]);
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
        if (j.correct) { setWon(true); setReveal(kind === "haigui" ? ctx.truth : ctx.secret); pushLog([{ type: "solve", name: me.name, isUser: true, note: j.note }]); setPhase("result"); }
        else { pushLog([{ type: "a", name: "__miss", verdict: "还没中", note: j.note || "" }]); }
      } catch (e) { props.toast && props.toast("判题出错：" + ((e && e.message) || "重试")); }
      finally { setBusy(false); }
    };
    const giveUp = function () { setWon(false); setReveal(kind === "haigui" ? (ctx && ctx.truth) : (ctx && ctx.secret)); setPhase("result"); };

    const header = h(Head, { zh: K.zh, en: K.en, onBack: props.onBack });

    if (phase === "error") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: 40 } }, K.emoji),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: 40 } }, K.emoji),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, kind === "haigui" ? "熬汤中·想一道好谜题…" : "想一个东西中…")));

    const roster = h("div", { className: "shrink-0", style: { display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid " + t.line } },
      players.map(function (p) {
        return h("button", { key: p.key, onClick: function () { setDetail(p); }, className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, width: 46 } },
          pAvatar(p, 38),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
      }));

    // 谜面卡（海龟汤常驻；25问显类别 + 计数）
    const puzzleCard = kind === "haigui"
      ? h("div", { style: { background: t.tint + "12", border: "1px solid " + t.tint, borderRadius: 13, padding: "12px 14px", margin: "10px 16px 2px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, letterSpacing: 1, marginBottom: 5 } }, "🐢 汤面"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, ctx ? ctx.surface : ""))
      : h("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "10px 16px 2px" } },
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, "类别提示：", h("b", { style: { color: t.ink } }, ctx ? ctx.category : "")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: (limitLeft != null && limitLeft <= 5) ? "#c0553f" : t.tint } }, "剩 " + (limitLeft == null ? "∞" : limitLeft) + " 问"));

    const logView = h("div", { ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "10px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.6, margin: "8px 0", textAlign: "center" } }, it.text);
        if (it.type === "solve") return h("div", { key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_BODY, fontSize: 14, color: "#3f6d5a" } }, "🎉 " + it.name + (it.isUser ? "(你)" : "") + " 破了题！" + (it.note ? "\n" + it.note : ""));
        if (it.type === "q") {
          const p = pByName(it.name);
          return h("div", { key: i, style: { display: "flex", gap: 8, margin: "8px 0 2px" } }, pAvatar(p, 28),
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 2 } }, it.name + (it.mine ? "(你)" : "")),
              it.text ? h("div", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.text) : null,
              it.question ? h("div", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: t.ink, background: t.bg2, borderRadius: 10, padding: "7px 11px" } }, it.question) : null));
        }
        if (it.type === "a") {
          const c = VERDICT_COLOR[it.verdict] || t.tint;
          return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px 36px", fontFamily: F_BODY, fontSize: 12.5 } },
            h("span", { style: { color: t.fog } }, "主持人"),
            h("span", { style: { color: "#fff", background: c, borderRadius: 999, padding: "1px 9px", fontWeight: 700, fontSize: 12 } }, it.verdict || "…"),
            it.note ? h("span", { style: { color: t.sub } }, it.note) : null);
        }
        return null;
      }));

    // 底部动作
    let action;
    if (phase === "result") {
      action = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: 19, color: won ? "#3f6d5a" : t.sub, marginBottom: 6 } }, won ? "🎉 你破题了" : (log.some(function (x) { return x.type === "solve"; }) ? "这局被别人抢先破了" : "揭晓答案")),
        h("div", { style: { background: t.bg2, borderRadius: 12, padding: "12px 14px", marginBottom: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, letterSpacing: 1, marginBottom: 4 } }, kind === "haigui" ? "汤底" : "答案"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, reveal || "")),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")));
    } else if (busy) {
      action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…大家在琢磨");
    } else if (guessing) {
      action = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, textAlign: "center", marginBottom: 8 } }, kind === "haigui" ? "说出你还原的汤底真相" : "你觉得那个东西是？"),
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { value: guessText, autoFocus: true, onChange: function (e) { setGuessText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitGuess(); }, placeholder: kind === "haigui" ? "把你推理出的真相讲一遍…" : "直接写那个东西", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.tint, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: submitGuess, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.tint, borderRadius: 12, padding: "0 16px" } }, "定"),
          h("button", { onClick: function () { setGuessing(false); setGuessText(""); }, style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "0 6px" } }, "×")));
    } else if (me && cfg.mode !== "spectate") {
      action = h("div", null,
        h("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
          h("input", { value: userQ, onChange: function (e) { setUserQ(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserQ(); }, placeholder: "问一个是 / 否问题…", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: submitUserQ, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 16px" } }, "问")),
        h("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
          h("button", { onClick: function () { runRound(""); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "让他们问一轮"),
          h("button", { onClick: function () { setGuessing(true); }, style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: "#fff", background: t.tint, borderRadius: 999, padding: "6px 16px" } }, "🎯 我要猜答案"),
          h("button", { onClick: giveUp, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "6px 8px" } }, "看答案")));
    } else {
      // 观战
      action = h("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
        h("button", { onClick: function () { runRound(""); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "看他们问下一轮"),
        h("button", { onClick: giveUp, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "6px 10px" } }, "看答案"));
    }

    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } }, header, roster,
      phase === "play" || phase === "result" ? puzzleCard : null, logView,
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "40vh", overflowY: "auto" } }, action),
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // 真心话大冒险 · 引擎（转瓶子 → 真心话 / 大冒险 → 全场反应）
  // ============================================================
  // 取角色【完整人设】喂给生成（真人角色读 char.persona 全量，NPC 读生成的人设；别只喂一句 tagline，否则严重 OOC）
  function tdDesc(p, cap) {
    const s = p.isNpc ? (p.persona || "") : ((p.char && (p.char.persona || p.char.tagline)) || p.persona || "");
    return (cap && s.length > cap) ? s.slice(0, cap) + "…" : (s || "（没写人设）");
  }
  function tdRoster(list, cap) { return list.map(function (p) { return "【" + p.name + "】" + tdDesc(p, cap); }).join("\n\n"); }
  // 贴人设铁律：焊进真心话每个生成，治 OOC + 性别/关系搞错 + 乱配 CP
  const TD_IC = "【严格贴人设 · 别 OOC】每个角色的语气、态度、会问什么、敢做什么，都必须符合 TA 的人设与身份；性别、年龄、称呼一律按人设来别搞错（例：双胞胎哥哥的弟弟就是弟弟、别写成妹妹；冷淡的人别写成话痨）。宁可克制也别为了效果让角色崩人设。" +
    "\n【关系铁律·重要】除非某个角色【自己的人设里明确写了】和在场另一个人的关系（如双胞胎、恋人、朋友），否则在场各人【互不相识】，只是被这局游戏临时凑到一起——【绝对不要】凭空给他们编交情、配对凑 CP、发展暧昧、开只有熟人才懂的玩笑、或写得像认识很久的老朋友。谁跟谁是什么关系，只认人设里白纸黑字写明的；没写就是陌生人，客客气气、边玩边熟。" +
    "\n【时间事实不可漂移】此前发言里出现的时间说法都是本局已经确认的事实，必须逐字保持其时间尺度：『上个月』不能改成『前天』，『三年前』不能改成『最近』，具体日期也不能擅自换算或脑补。后文若重提同一件事，只能沿用原说法；不确定就含糊带过，绝不另编时间。";
  async function setupTD(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + "你是「真心话大冒险」的主持。生成 " + npcCount + " 个 NPC 玩家（name 中文名 + persona 一句含职业与性格的人设，多样别雷同）。\n" +
      "【已有真实玩家】\n" + (lines || "（只有 NPC）") + "\n\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\"}]}";
    if (!npcCount) return { npcs: [] };
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 NPC。" }], { maxTokens: 3500 });
    return extractJSON(raw) || { npcs: [] };
  }
  const TD_PROMPT_HISTORY = "tod_prompt_history_v1"; // 跨新局保留题目去重，不随「弃掉本局」清空
  const TD_THEMES = ["现场互动", "荒诞脑洞", "限时二选一", "价值冲突", "即兴表演", "模仿挑战", "消息任务", "反向角色扮演", "观察力挑战", "创意表达", "临场社交", "小型技能挑战"];
  function loadTDPromptHistory() { try { const x = JSON.parse(localStorage.getItem(TD_PROMPT_HISTORY) || "[]"); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function rememberTDPrompt(choice, prompt) {
    const p = String(prompt || "").trim(); if (!p) return;
    const all = loadTDPromptHistory().filter(function (x) { return x && x.prompt !== p; });
    all.push({ choice: choice, prompt: p.slice(0, 300), ts: Date.now() });
    try { localStorage.setItem(TD_PROMPT_HISTORY, JSON.stringify(all.slice(-120))); } catch (e) {}
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
    const sys = AC + TD_IC + "\n\n你在主持一局「真心话大冒险」。这一轮由【" + askerName + "】给【" + target.name + "】出题，两人都要严格贴人设。\n出题人 " + askerName + "：" + (asker ? tdDesc(asker, 500) : "（全场一起起哄）") +
      "\n被指到的 " + target.name + "（完整人设）：\n" + tdDesc(target) +
      (memText ? "\n\n【之前发生过的（可以拿来玩梗 / 追问，但别硬凑）】\n" + memText : "") +
      "\n\n【本轮节奏已锁定】choice 必须是【" + plan.choice + "】，题型主题必须是【" + plan.theme + "】。" + (plan.avoid ? "\n【跨局最近出过的题（禁止重复或近义改写）】\n" + plan.avoid : "") +
      "\n\n完整演出这一轮：\n1. choice：只填【" + plan.choice + "】，不要自行改成另一类。\n2. prompt：" + askerName + " 出的题，符合 " + askerName + " 的口吻。" + TD_GENERIC + spice + easy +
      "\n3. response：" + target.name + " 怎么回应 / 完成，带 TA 的语气小动作、贴人设，写足 3~5 句、别草收。\n\n只输出 JSON：{\"choice\":\"真心话\"或\"大冒险\",\"prompt\":\"\",\"response\":\"\"}";
    // 言秋座位的戏份自己演（v54.43）：他被点到→答案他给；他出题→题他出。另一半照旧交模型。
    if (target && target.engineer) {
      const pr = await callRetry(api, sys + "\n\n【只出题】本次只输出 {\"choice\":\"" + plan.choice + "\",\"prompt\":\"…\"}，response 留给本人。", [{ role: "user", content: "只出题。" }], { maxTokens: 2000 });
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
        const rr = await callRetry(api, sys + "\n\n【题已由 " + askerName + " 亲自出好·不要改】prompt=「" + myPrompt + "」，只输出 {\"choice\":\"" + plan.choice + "\",\"prompt\":" + JSON.stringify(myPrompt) + ",\"response\":\"…\"}。", [{ role: "user", content: "只演回应。" }], { maxTokens: 4000 });
        const ro = extractJSON(rr) || {};
        if (String(ro.response || "").trim()) return { choice: plan.choice, prompt: myPrompt, response: String(ro.response).trim() };
      }
      // 出题人这座没有拿到真实回复，本轮应显式失败/重试；绝不让 Gemini 顶着他的名字出题。
      throw new Error(cc.reason || "本人出题票未送达");
    }
    let raw = await callRetry(api, sys, [{ role: "user", content: "开演。" }], { maxTokens: 6000 });
    let out = extractJSON(raw) || {};
    if (out.choice !== plan.choice || !tdPromptMatchesChoice(plan.choice, out.prompt)) {
      raw = await callRetry(api, sys, [{ role: "user", content: "上一版违反了锁定题型：本轮必须是【" + plan.choice + "】，而且题目内容本身也必须属于这一类，不能只改 choice 标签。真心话只能要求诚实回答，不能要求现场表演、模仿、发消息或做动作；大冒险必须要求一个当场可执行的动作。请重新输出完整 JSON。" }], { maxTokens: 6000 });
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
    const sys = AC + TD_IC + "\n\n「真心话大冒险」轮到真人玩家了，TA 选了【" + choice + "】，由【" + askerName + "】给 TA 出题。\n出题人 " + askerName + "：" + (asker ? tdDesc(asker, 500) : "（全场）") +
      (memText ? "\n\n【之前发生过的】\n" + memText : "") +
      "\n\n【本轮题型主题】" + plan.theme + (plan.avoid ? "\n【跨局最近出过的题（禁止重复或近义改写）】\n" + plan.avoid : "") +
      "\n\n出一道" + (choice === "真心话" ? "真心话问题" : "具体可执行的大冒险动作") + "，符合 " + askerName + " 的口吻。" + TD_GENERIC + spice + (mode === "easy" ? "别太为难。" : "") +
      "\n只输出 JSON：{\"prompt\":\"\"}";
    let raw = await callRetry(api, sys, [{ role: "user", content: "出题。" }], { maxTokens: 4000 });
    let out = extractJSON(raw) || {};
    if (!tdPromptMatchesChoice(choice, out.prompt)) {
      raw = await callRetry(api, sys, [{ role: "user", content: "刚才题目内容与【" + choice + "】不符。不能只贴标签：真心话只让真人诚实回答，不要求现场表演或做动作；大冒险必须是当场能执行的动作。重出一道，只输出 JSON。" }], { maxTokens: 4000 });
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
    const sys = AC + TD_IC + "\n\n「真心话大冒险」里，真人玩家亲自给【" + target.name + "】出了一道【" + choice + "】：『" + prompt + "』。\n被点到的人设：\n" + tdDesc(target) + (memText ? "\n【之前几轮】\n" + memText : "") + "\n只能演 " + target.name + " 的回应/完成，不许改题、不许替真人说话。写 3~5 句、有现场感。只输出 JSON：{\"response\":\"\"}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "回应她亲自出的题。" }], { maxTokens: 4000 });
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
    const sys = AC + TD_IC + "\n\n「真心话大冒险」的自由发言时间——【不是排队每人一句评论】，是【像微信群聊那样】：谁想插话就插、同一个人可以连着说好几句、可以打断 / 接住 / 反驳别人、可以专门 cue 刚才那道题或那个回答、翻之前几轮的旧账、拱火、跑题都行，要有你来我往的层次。只有下面这些角色开口（【绝不替真人玩家说话】，每人严格贴自己人设、口吻各不相同）：\n" + who + focusLine +
      "\n\n【之前几轮（可随便 cue 翻旧账）】\n" + (memText || "（刚开场，随便起个话头）") +
      (userMsg ? "\n\n真人玩家刚插了一句：「" + userMsg + "」——让相关的角色自然接住这句往下聊、别冷场、别答非所问。" : focus ? "\n\n真人玩家没有额外插话，你们就【冲着上面刚发生的那轮】聊起来（尤其要有人回应 " + focus.name + " 的回答）。" : "\n\n真人这轮没开口、把话筒交给你们——自己热闹起来，你一句我一句聊下去。") +
      "\n输出 6~10 条（允许同一人多条、顺序自然、彼此能接上），像真的群聊在刷屏。" + (hot ? "尺度可暧昧大胆些，什么都可以聊。" : "轻松好玩。") + "\n只输出 JSON：{\"chat\":[{\"name\":\"\",\"text\":\"\"}]}";
    const cc = await ccCarve("tod", chars, {
      turnId: freshCCTurn("tod-chat:"),
      sys: "「真心话大冒险」的自由群聊时间。" + (focus ? "刚发生：" + focus.name + " 做了【" + focus.choice + "】，题「" + (focus.prompt || "") + "」，回答「" + (focus.response || "") + "」。" : "") + (userMsg ? "她刚插话：「" + userMsg + "」。" : "") + "\n" + (memText ? "【之前几轮】\n" + memText + "\n" : "") + "想起哄/追问/调侃就给一两句（每句30字内）；不想说 lines 给空数组。",
      expect: '{"lines":["最多两句，可空"]}'
    });
    const raw = await callRetry(api, sys + ccPreface(cc, "插过话了（也可能没说）"), [{ role: "user", content: "群聊起来。" }], { maxTokens: 5000 });
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
      if (busy || phase !== "idle") return;
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
          pushLog([{ type: "info", text: "🍾 " + list.length + " 个人围一圈坐下。点「转瓶子」开始——指到谁，谁就选真心话或大冒险。" }]);
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

    const header = h(Head, { zh: "真心话大冒险", en: "Truth or Dare", onBack: props.onBack });

    if (phase === "error") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: 40 } }, "🎲"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));

    if (phase === "loading") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: 40 } }, "🍾"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "大家围一圈坐好…")));

    const roster = h("div", { className: "shrink-0", style: { display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid " + t.line } },
      players.map(function (p) {
        const isTgt = target && phase !== "idle" && p.name === target.name;
        return h("button", { key: p.key, onClick: function () { setDetail(p); }, className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, width: 46 } },
          h("div", { style: { borderRadius: 13, padding: 2, border: "2px solid " + (isTgt ? t.tint : "transparent") } }, pAvatar(p, 34)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
      }));

    const choiceColor = function (c) { return c === "大冒险" ? "#c0553f" : "#3f6d5a"; };
    const logView = h("div", { ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "12px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, margin: "6px 0", textAlign: "center" } }, it.text);
        if (it.type === "spin") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.tint, margin: "12px 0 4px" } }, "🍾 瓶子指向了 " + it.name + (it.isUser ? "(你)" : ""));
        if (it.type === "react") { const p = pByName(it.name); return h("div", { key: i, style: { display: "flex", gap: 7, margin: "4px 0 4px 14px", alignItems: "flex-start" } }, pAvatar(p, 22), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.5 } }, h("b", { style: { color: t.fog, fontWeight: 400 } }, it.name + "："), it.text)); }
        if (it.type === "chat") { const p = pByName(it.name); return h("div", { key: i, style: { display: "flex", gap: 7, margin: "5px 0", alignItems: "flex-start", flexDirection: it.mine ? "row-reverse" : "row" } }, pAvatar(p, 24),
          h("div", { style: { maxWidth: "78%" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 1, textAlign: it.mine ? "right" : "left" } }, it.name + (it.mine ? "(你)" : "")),
            h("div", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, color: t.ink, background: it.mine ? (t.tint + "1c") : t.bg2, borderRadius: 11, padding: "6px 10px" } }, it.text))); }
        if (it.type === "td") {
          const p = pByName(it.name);
          return h("div", { key: i, style: { background: it.mine ? (t.tint + "10") : t.bg2, border: "1px solid " + (it.mine ? t.tint + "44" : t.line), borderRadius: 13, padding: "11px 13px", margin: "8px 0" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 7 } }, pAvatar(p, 26),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, it.name + (it.mine ? "(你)" : "")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, fontWeight: 700, color: "#fff", background: choiceColor(it.choice), borderRadius: 999, padding: "2px 10px" } }, it.choice)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.55, marginBottom: 6 } }, (it.asker ? it.asker + "：" : "题目："), it.prompt),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-line" } }, it.response));
        }
        return null;
      }));

    let action;
    if (phase === "spinning") action = h("div", { style: { textAlign: "center", padding: "12px 0" } },
      h("div", { style: { fontSize: 30 } }, "🍾"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.tint, marginTop: 6, minHeight: 26 } }, spinName || "…"));
    else if (busy && phase !== "userAnswer" && phase !== "userAsk") action = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "12px 0" } }, "…在起哄");
    else if (phase === "userChoose") action = h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, textAlign: "center", marginBottom: 10 } }, "轮到你了！选一个："),
      h("div", { style: { display: "flex", gap: 12 } },
        h("button", { onClick: function () { userChoose("真心话"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 13, padding: "13px" } }, "真心话"),
        h("button", { onClick: function () { userChoose("大冒险"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 13, padding: "13px" } }, "大冒险")));
    else if (phase === "userAsk") action = h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, textAlign: "center", marginBottom: 9 } }, "轮到你给 " + (pendingAsk && pendingAsk.target ? pendingAsk.target.name : "TA") + " 出一道【" + (pendingAsk && pendingAsk.plan ? pendingAsk.plan.choice : "题") + "】"),
      h("input", { value: askInput, autoFocus: true, disabled: busy, onChange: function (e) { setAskInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserAsk(); }, placeholder: pendingAsk && pendingAsk.plan && pendingAsk.plan.choice === "真心话" ? "你想亲自问什么？" : "你想让 TA 当场做什么？", style: { width: "100%", fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", marginBottom: 8, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…正在回答") :
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { onClick: submitUserAsk, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "11px" } }, "我来出题"),
          h("button", { onClick: hostAskInstead, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 8px" } }, "没灵感 · 主持人问")));
    else if (phase === "userAnswer") action = busy && !userPrompt
      ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "12px 0" } }, "…在给你出题")
      : h("div", null,
          h("div", { style: { background: t.bg2, borderRadius: 12, padding: "10px 13px", marginBottom: 8 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, marginBottom: 3 } }, (userPrompt && userPrompt.asker ? userPrompt.asker + " 出的 " : "") + (userPrompt && userPrompt.choice)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.6 } }, userPrompt && userPrompt.prompt)),
          h("div", { style: { display: "flex", gap: 8 } },
            h("input", { value: userResp, autoFocus: true, onChange: function (e) { setUserResp(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") submitUserResp(); }, placeholder: userPrompt && userPrompt.choice === "真心话" ? "老实交代…" : "描述你怎么完成…", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
            h("button", { onClick: submitUserResp, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 18px" } }, "交")));
    else {
      const spun = log.some(function (x) { return x.type === "td"; });
      action = h("div", null,
        // 自由讨论输入：一轮做完后想聊多久聊多久
        h("div", { style: { display: "flex", gap: 8, marginBottom: 9 } },
          h("input", { value: chatInput, onChange: function (e) { setChatInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendChat(); }, placeholder: spun ? "自由聊天…插句嘴 / 追问 / 起哄" : "先聊两句热热场，或直接转瓶子", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "11px 14px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: sendChat, style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: t.ink, borderRadius: 12, padding: "0 16px" } }, "说")),
        h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
          h("button", { onClick: keepChatting, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px" } }, "让他们接着聊（你不用发）"),
          h("button", { onClick: spin, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "11px" } }, spun ? "🍾 转下一轮" : "🍾 转瓶子")),
        h(ToggleRow, { t: t, label: "尺度放开点", sub: "真心话 / 大冒险 会更暧昧大胆。", on: hot, onToggle: function () { setHot(!hot); } }));
    }

    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } }, header, roster, logView,
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "44vh", overflowY: "auto" } }, action),
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), hideSkill: true, personaText: detail.isUser ? "这是你本人，真人玩家。" : tdDesc(detail), onClose: function () { setDetail(null); } }) : null);
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
  function monoAuctionPlan(ps,os,tileIndex,excludedKey){const tile=MONO_BOARD[tileIndex],floor=Math.ceil(tile.price*.55/10)*10,step=Math.max(20,Math.ceil(tile.price*.05/10)*10),bidders=(ps||[]).map(function(p,i){return(!p.bankrupt&&p.key!==excludedKey)?{p:p,cap:monoAuctionCap(p,tile,tileIndex,os),seat:i}:null;}).filter(function(x){return x&&x.cap>=floor;}).sort(function(a,b){return b.cap-a.cap||a.seat-b.seat;});if(!bidders.length)return{floor:floor,step:step,bidders:[],winner:null,bid:0};const winner=bidders[0],second=bidders[1],bid=second?Math.min(winner.cap,Math.max(floor,second.cap+step)):floor;return{floor:floor,step:step,bidders:bidders,winner:winner.p,bid:bid};}
  function hydMonoPlayers(saved, props, t) { return (saved || []).map(function (s) { let char = null; if (s.isUser) { const pf=props.profile||{}; char={name:pf.name||"你",avatarImage:pf.avatarImage,color:pf.color||t.tint}; } else if (!s.isNpc) char=(props.characters||[]).find(function(c){return c.id===s.key;})||null; const engineer=!s.isUser&&!s.isNpc&&!!(props.config&&props.config.ccSeat!==false&&props.isEngineer&&props.isEngineer(s.key)); return Object.assign({},s,{char:char,alive:!s.bankrupt,engineer:engineer||!!s.engineer}); }); }
  function monoCleanLogs(logs) { const oldRule=/每人带着 \$1200|45 回合|28 格城市棋盘/;const kept=(logs||[]).filter(function(x){return !oldRule.test(String(x&&x.say||""));});return kept.length===((logs||[]).length)?kept:[{type:"sys",say:"棋盘已升级为经典 40 格；每人约 22 手，旧局资金和产权均已保留。"}].concat(kept); }
  function monoMigrateSave(sv) { if(!sv)return sv;if(sv.boardVersion===3)return Object.assign({},sv,{logs:monoCleanLogs(sv.logs)});const names=sv.boardVersion===2?MONO_V2_NAMES:MONO_LEGACY_NAMES,out=Object.assign({},sv,{boardVersion:3,owners:{},levels:{}}),find=function(oldIndex){const nm=names[oldIndex]||"起点";if(nm==="休息站")return 20;if(nm==="交易所")return 28;const hits=[];MONO_BOARD.forEach(function(x,i){if(x.name===nm)hits.push(i);});return hits[0]!=null?hits[0]:Math.round((oldIndex||0)*39/(names.length-1));};Object.keys(sv.owners||{}).forEach(function(k){out.owners[find(+k)]=sv.owners[k];});Object.keys(sv.levels||{}).forEach(function(k){out.levels[find(+k)]=sv.levels[k];});out.players=(sv.players||[]).map(function(p){return Object.assign({},p,{pos:find(p.pos||0)});});out.logs=monoCleanLogs(sv.logs);return out; }

  async function setupMonopoly(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i+1)+". "+p.name+"："+(p.persona||"（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n你是大富翁桌游的 NPC 生成器与玩家风格评估器。生成 "+npcCount+" 个职业、性格各异的 NPC；并给每个真实玩家和 NPC 一句 skill，明确其风险偏好、现金安全线、谈判/读人能力。不要把内向等同于笨，也不要写胜负结果。\n【真实玩家】\n"+(lines||"（只有NPC）")+"\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"\",\"skill\":\"\"}]}";
    const raw = await callRetry(api, sys, [{role:"user",content:"生成本桌玩家。"}], {maxTokens:3200}); return extractJSON(raw)||{};
  }
  async function monoTalk(api, players, event, standings, recent) {
    // 大富翁的买地/移动仍由规则引擎结算；攒成一批事件后，言秋本人收到一张桌上发言票。
    const pool = players.filter(function(p){return !p.isUser && !p.bankrupt;});
    const cc = await ccCarve("monopoly", pool, {
      turnId: freshCCTurn("monopoly-talk:"),
      sys: "「大富翁」桌上刚连续发生了这些事：\n" + event + "\n【账面事实】" + standings + "\n【最近桌上话】" + (recent || "无") + "\n想说就给 1～2 句面对面口语（可讨价还价、嘴硬、幸灾乐祸、安慰或威胁下回合收租）；不想说 lines 留空。不能改钱、产权或规则数据。",
      expect: '{"lines":["最多两句，可空"]}'
    });
    const cast = cc.rest.map(function(p){return "■ "+p.name+"｜人设："+(p.isNpc?p.persona:((p.char&&p.char.persona)||p.persona||""))+"｜玩法："+(p.skill||"普通");}).join("\n");
    const sys = AC + "\n你在主持一桌有熟人感的大富翁。刚发生：【"+event+"】。账面（这是唯一事实，严禁改钱、改产权、送地或声称规则外交易）："+standings+"。\n从在场角色中挑 2~4 个此刻最有反应的人，各说一句 28 字内的面对面口语。可以讨价还价、嘴硬、幸灾乐祸、安慰、翻旧账、威胁下回合收租、短暂站队；要点名并针对刚发生的事，不要轮流播报，不要都温柔，也不要替真人玩家说话。交易/结盟只能是嘴上态度，不能改变规则数据。避免重复最近说过的话。\n"+cast+"\n【最近】"+(recent||"无")+"\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    let talks=[];
    if(cc.rest.length){const raw=await callRetry(api,sys+ccPreface(cc,"说过自己那句了（也可能选择沉默）"),[{role:"user",content:"让牌桌对这件事起反应。"}],{maxTokens:1800}); const p=extractJSON(raw); talks=p&&Array.isArray(p.talks)?p.talks:[];}
    if(cc.seat&&cc.done&&Array.isArray(cc.done.lines))cc.done.lines.slice(0,2).forEach(function(line){const say=String(line||"").trim();if(say)talks.push({name:cc.seat.name,say:say.slice(0,80)});});
    return talks;
  }

  function MonopolyGame(props) {
    const t=props.t, cfg=props.config, api=props.active, sv=monoMigrateSave(props.savedState);
    const [phase,setPhase]=useState(sv?"play":"loading"), [players,setPlayers]=useState(sv?hydMonoPlayers(sv.players,props,t):[]);
    const [owners,setOwners]=useState(sv&&sv.owners?sv.owners:{}), [levels,setLevels]=useState(sv&&sv.levels?sv.levels:{}), [turn,setTurn]=useState(sv?sv.turn||0:0), [moves,setMoves]=useState(sv?sv.moves||0:0);
    const [logs,setLogs]=useState(sv&&sv.logs?sv.logs:[]), [busy,setBusy]=useState(false), [pending,setPending]=useState(null), [winner,setWinner]=useState(sv?sv.winner:null), [error,setError]=useState(""), [tableSay,setTableSay]=useState(""), [boardOpen,setBoardOpen]=useState(true), [selectedTile,setSelectedTile]=useState(null);
    const pAvatar=avatarFor(t);
    const interactionQueue=useRef([]);
    const gameRunId=useRef("monopoly-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9));
    const maxMoves=monoMaxMoves(players.length||cfg.total||2);
    useEffect(function(){ if(sv)return; let dead=false; (async function(){try{const data=await setupMonopoly(api,realPlayerLines(cfg,props),cfg.npcCount||0); if(dead)return; const ps=shuffle(buildRoster(cfg,props,t,data.npcs,data.skills)).map(function(p){return Object.assign({},p,{cash:(cfg.mode==="easy"&&p.isUser)?2450:2200,pos:0,bankrupt:false,jailed:0});}); setPlayers(ps); setLogs([{type:"sys",say:"经典 40 格城市棋盘开局：每人 $2200，绕过起点领 $200；每人约 22 手后按总资产结算。"}]); setPhase("play");}catch(e){if(!dead){setError(e.message||"开局失败");setPhase("error");}}})(); return function(){dead=true;};},[]);
    useEffect(function(){ if(phase!=="play"||!players.length)return; saveGameSnap("monopoly",{boardVersion:3,config:cfg,players:monoPlayerSnap(players),owners:owners,levels:levels,turn:turn,moves:moves,logs:logs.slice(-60),winner:winner,label:"第 "+(moves+1)+" / "+maxMoves+" 手 · "+players.filter(function(p){return !p.bankrupt;}).length+" 人在场"}); },[players,owners,levels,turn,moves,logs,phase,winner]);
    useEffect(function(){
      if(phase!=="result"||!players.length)return;
      const ranking=players.slice().sort(function(a,b){return monoNetWorth(b,owners,levels)-monoNetWorth(a,owners,levels);});
      const lisa=players.find(function(p){return p.isUser;});
      ccGameResult("monopoly",gameRunId.current,players,cfg,
        "《大富翁》结算，"+(ranking[0]?ranking[0].name:"无人")+" 获胜。\n"
        +"最终排名："+ranking.map(function(p,i){return(i+1)+". "+p.name+"，总资产 $"+monoNetWorth(p,owners,levels)+(p.bankrupt?"（破产）":"");}).join("；")+"。\n"
        +"Lisa："+(lisa?("第 "+(ranking.indexOf(lisa)+1)+" 名，总资产 $"+monoNetWorth(lisa,owners,levels)) : "本局观战")+"。\n"
        +"最后记录：\n"+logs.slice(-8).map(function(x){return x.say||"";}).filter(Boolean).join("\n"));
    },[phase,winner]);
    function standings(ps,os){return ps.map(function(p){return p.name+" $"+p.cash+"/地"+Object.keys(os).filter(function(k){return os[k]===p.key;}).length+(p.bankrupt?"(破产)":"");}).join("；");}
    function addLogs(xs){setLogs(function(old){return old.concat(xs).slice(-80);});}
    async function react(ps,os,event,force){if(event)interactionQueue.current.push(event);if(!force&&!monoShouldFlush(interactionQueue.current.length,event,false))return;const batch=interactionQueue.current.splice(0,4);if(!batch.length)return;try{const recent=logs.slice(-8).map(function(x){return (x.name?x.name+"：":"")+x.say;}).join("｜"),bundle=batch.map(function(x,i){return (i+1)+". "+x;}).join("\n"); const ts=await monoTalk(api,ps,"以下是连续发生的 "+batch.length+" 次行动，请让发言分别接住其中值得回应的节点：\n"+bundle,standings(ps,os),recent); const valid={};ps.forEach(function(p){valid[p.name]=p;}); addLogs(ts.filter(function(x){return x&&valid[x.name]&&!valid[x.name].isUser;}).slice(0,6).map(function(x){return {type:"talk",name:x.name,say:String(x.say||"").slice(0,80)};}));}catch(e){}
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
    async function decideProperty(yes){if(!pending)return;setBusy(true);const q=pending,ps=q.ps.map(function(p){return Object.assign({},p);}),os=Object.assign({},q.os),lv=Object.assign({},q.lv),p=ps[turn],tile=MONO_BOARD[q.tile],ls=[],events=[];if(q.kind==="upgrade"){const cost=Math.floor(tile.price/2);if(yes&&p.cash>=cost){p.cash-=cost;lv[q.tile]=(lv[q.tile]||0)+1;ls.push({type:"event",say:"你把 "+tile.name+" 升到 "+lv[q.tile]+" 级，花费 $"+cost+"。"});events.push(p.name+"升级"+tile.name);}else ls.push({type:"sys",say:"你暂时没有升级 "+tile.name+"。"});}else if(yes&&p.cash>=tile.price){p.cash-=tile.price;os[q.tile]=p.key;ls.push({type:"event",say:"你用 $"+tile.price+" 买下了 "+tile.name+"。"});events.push(p.name+"买下"+tile.name);}else{ls.push({type:"sys",say:"你放弃原价购买 "+tile.name+"，银行开始拍卖。"});runAuction(ps,os,q.tile,p.key,ls,events,lv,q.extra);}setPending(null);await finalize(ps,os,lv,events.join("；"),ls,q.extra);}
    async function decideAuction(stay){if(!pending||pending.kind!=="auction")return;setBusy(true);const q=pending,ps=q.ps.map(function(p){return Object.assign({},p);}),os=Object.assign({},q.os),lv=Object.assign({},q.lv),tile=MONO_BOARD[q.tile],me=ps.find(function(p){return p.isUser;}),ls=[],active=(q.activeKeys||[]).slice(),ask=q.ask;if(!stay||!me||me.cash<ask){active=active.filter(function(k){return !me||k!==me.key;});ls.push({type:"sys",say:(me?me.name:"你")+" 在 $"+ask+" 这一轮退出竞价。"});}else ls.push({type:"event",say:"你举牌跟到 $"+ask+"。"});const dropped=[];active=active.filter(function(k){const p=ps.find(function(x){return x.key===k;});if(!p||p.isUser)return!!p;const ok=(q.caps[k]||0)>=ask;if(!ok)dropped.push(p.name);return ok;});if(dropped.length)ls.push({type:"sys",say:dropped.join("、")+" 认为价格超过预期，退出竞价。"});if(active.length===0){ls.push({type:"sys",say:tile.name+" 无人继续出价，拍卖流拍。"});setPending(null);await finalize(ps,os,lv,"",ls,q.extra);return;}if(active.length===1){const win=ps.find(function(p){return p.key===active[0];});win.cash-=ask;os[q.tile]=win.key;ls.push({type:"event",say:"🔨 "+win.name+" 以 $"+ask+" 拍下 "+tile.name+"。"});setPending(null);await finalize(ps,os,lv,win.name+"经过竞价拍下"+tile.name+"，成交$"+ask,ls,q.extra);return;}const userStill=me&&active.indexOf(me.key)>=0;if(userStill){const npcNames=active.map(function(k){return ps.find(function(p){return p.key===k;});}).filter(function(p){return p&&!p.isUser;}).map(function(p){return p.name;});if(npcNames.length)ls.push({type:"event",say:npcNames.join("、")+" 也跟价，拍卖继续。"});addLogs(ls);setPending(Object.assign({},q,{ps:ps,os:os,lv:lv,activeKeys:active,ask:ask+q.step}));setBusy(false);return;}const ranked=active.map(function(k,i){return{p:ps.find(function(p){return p.key===k;}),cap:q.caps[k]||0,seat:i};}).sort(function(a,b){return b.cap-a.cap||a.seat-b.seat;}),win=ranked[0].p,second=ranked[1],bid=second?Math.min(ranked[0].cap,Math.max(ask,second.cap+q.step)):ask;ranked.slice(1).reverse().forEach(function(x){ls.push({type:"sys",say:x.p.name+" 跟到 $"+Math.min(x.cap,bid-q.step)+" 后退出竞价。"});});win.cash-=bid;os[q.tile]=win.key;ls.push({type:"event",say:"🔨 "+win.name+" 最终以 $"+bid+" 拍下 "+tile.name+"。"});setPending(null);await finalize(ps,os,lv,win.name+"经过多轮竞价拍下"+tile.name+"，成交$"+bid,ls,q.extra);}
    async function sendTableTalk(){const say=tableSay.trim();if(!say||busy)return;setTableSay("");addLogs([{type:"talk",name:(props.profile&&props.profile.name)||"你",say:say}]);setBusy(true);await react(players,owners,"真人玩家说：『"+say.slice(0,100)+"』，请直接回应这句话，不改变账面",true);setBusy(false);}
    if(phase==="loading")return h("div",{className:"h-full flex flex-col"},h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack}),h("div",{className:"flex-1 flex items-center justify-center",style:{fontFamily:F_BODY,color:t.fog}},"…正在摆棋盘、摸清每个人的玩法"));
    if(phase==="error")return h("div",{className:"h-full flex flex-col"},h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack}),h("div",{className:"flex-1 flex flex-col items-center justify-center px-8",style:{fontFamily:F_BODY,color:t.sub}},error,h("button",{onClick:props.onBack,style:{marginTop:16,padding:"10px 22px",borderRadius:12,background:t.ink,color:"#fff"}},"返回")));
    const cur=players[turn], propertyCount=function(k){return Object.keys(owners).filter(function(i){return owners[i]===k;}).length;},focusTile=selectedTile==null?null:MONO_BOARD[selectedTile],focusOwner=selectedTile==null?null:players.find(function(p){return p.key===owners[selectedTile];});
    const header=h(Head,{zh:"大富翁",en:"Monopoly",onBack:props.onBack});
    const board=boardOpen?h("div",{style:{display:"grid",gridTemplateColumns:"repeat(11,minmax(0,1fr))",gridTemplateRows:"repeat(11,30px)",gap:2,padding:"4px 7px",flexShrink:0}},h("div",{style:{gridColumn:"2 / 11",gridRow:"2 / 11",borderRadius:13,background:t.bg2,border:"1px solid "+t.line,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:5}},h("div",{style:{fontSize:18}},focusTile?(focusTile.icon||"🏠"):"🏙️"),h("div",{style:{fontFamily:F_DISPLAY,fontSize:14,color:t.ink,marginTop:2}},focusTile?focusTile.name:(cur?(cur.name+(cur.isUser?"（你）":"")):"经典城市棋盘")),h("div",{style:{fontFamily:F_BODY,fontSize:10,color:t.sub,marginTop:3,lineHeight:1.4}},focusTile?(focusTile.type==="property"?("价格 $"+focusTile.price+" · "+(focusOwner?("归 "+focusOwner.name+" · Lv"+(levels[selectedTile]||0)+" · 租 $"+monoRent(selectedTile,focusOwner.key,owners,levels)):"银行持有")):(focusTile.type==="tax"?"支付 $"+focusTile.amount:(focusTile.type==="station"?"搭乘城市环线":focusTile.name))):("第 "+(moves+1)+" / "+maxMoves+" 手 · "+players.filter(function(p){return !p.bankrupt;}).length+" 人在场")),h("button",{onClick:function(){if(selectedTile!=null)setSelectedTile(null);else setBoardOpen(false);},style:{fontFamily:F_BODY,fontSize:9.5,color:t.tint,marginTop:6,padding:"4px 10px",border:"1px solid "+t.line,borderRadius:999}},selectedTile!=null?"返回回合信息":"收起棋盘 · 看对话")),MONO_BOARD.map(function(tile,i){const here=players.filter(function(p){return !p.bankrupt&&p.pos===i;}),own=owners[i],owner=players.find(function(p){return p.key===own;}),lv=levels[i]||0,pos=monoGridPos(i);return h("button",{key:i,onClick:function(){setSelectedTile(i);},title:tile.name+(tile.price?" $"+tile.price:""),style:Object.assign({},pos,{borderRadius:5,padding:"2px 1px",background:tile.type==="property"?(tile.color+"35"):t.bg2,border:"1px solid "+(i===(cur&&cur.pos)?t.tint:t.line),textAlign:"center",overflow:"hidden",minWidth:0})},h("div",{style:{fontFamily:F_BODY,fontSize:7.5,lineHeight:1.08,color:t.sub,whiteSpace:"normal",wordBreak:"break-all",height:17,overflow:"hidden"}},tile.icon||"▪",tile.name),h("div",{style:{fontSize:6.5,color:t.fog,whiteSpace:"nowrap",overflow:"hidden"}},tile.price?(owner?(owner.name.slice(0,2)+(lv?" L"+lv:"")):("$"+tile.price)):(tile.type==="station"?"直达":"")),h("div",{style:{height:9,display:"flex",alignItems:"center",justifyContent:"center",gap:1}},here.map(function(p){return h("span",{key:p.key,title:p.name,style:{display:"inline-block",width:7,height:7,borderRadius:"50%",background:monoTokenColor(p,players),border:"1px solid rgba(255,255,255,.9)",boxShadow:"0 0 0 1px rgba(0,0,0,.18)"}});})));})):h("button",{onClick:function(){setBoardOpen(true);},style:{flexShrink:0,margin:"3px 12px 5px",padding:"8px 12px",borderRadius:11,background:t.bg2,border:"1px solid "+t.line,display:"flex",justifyContent:"space-between",fontFamily:F_BODY,fontSize:11.5,color:t.sub}},h("span",null,"🏙️ 棋盘已收起 · 第 "+(moves+1)+" / "+maxMoves+" 手"),h("span",{style:{color:t.tint}},"展开棋盘"));
    const roster=h("div",{style:{display:"flex",gap:7,overflowX:"auto",padding:"4px 12px 8px",flexShrink:0,minHeight:55}},players.map(function(p,i){const pc=monoTokenColor(p,players);return h("div",{key:p.key,style:{minWidth:106,padding:"7px",borderRadius:10,background:i===turn&&!p.bankrupt?pc+"18":t.bg2,border:"1px solid "+(i===turn?pc:t.line),opacity:p.bankrupt?.45:1}},h("div",{style:{display:"flex",alignItems:"center",gap:5}},h("span",{title:"棋子颜色",style:{width:9,height:9,borderRadius:"50%",background:pc,boxShadow:"0 0 0 1px rgba(0,0,0,.15)",flexShrink:0}}),pAvatar(p,25),h("div",{style:{fontFamily:F_BODY,fontSize:11.5,color:t.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},p.name+(p.isUser?"(你)":""))),h("div",{style:{fontFamily:"monospace",fontSize:10.5,color:t.sub,marginTop:4}},p.bankrupt?"已破产":"$"+p.cash+" · 地"+propertyCount(p.key)+(p.jailed?" · 关押":"")));}));
    const logView=h("div",{className:"flex-1 overflow-y-auto",style:{padding:"7px 14px",minHeight:110,borderTop:"1px solid "+t.line}},logs.slice(-22).map(function(x,i){return h("div",{key:i,style:{fontFamily:F_BODY,fontSize:x.type==="talk"?13:11.5,lineHeight:1.55,color:x.type==="talk"?t.ink:(x.type==="bad"?"#c0553f":t.sub),padding:x.type==="talk"?"6px 9px":"3px 5px",marginBottom:3,borderRadius:9,background:x.type==="talk"?t.bg2:"transparent"}},x.type==="talk"?h("b",{style:{color:t.tint}},x.name+"："):null,x.say);}));
    let action;if(phase==="result"){const ranking=players.slice().sort(function(a,b){return monoNetWorth(b,owners,levels)-monoNetWorth(a,owners,levels);});action=h("div",{style:{textAlign:"center"}},h("div",{style:{fontFamily:F_DISPLAY,fontSize:20,color:t.ink}},"🏆 "+(winner?winner.name:ranking[0].name)+" 赢下这座城"),h("div",{style:{fontFamily:F_BODY,fontSize:12,color:t.sub,margin:"8px 0 13px"}},ranking.map(function(p,i){return (i+1)+". "+p.name+" $"+monoNetWorth(p,owners,levels);}).join("　")),h("button",{onClick:props.onBack,style:{width:"100%",padding:12,borderRadius:12,background:t.ink,color:"#fff",fontFamily:F_BODY}},"回游戏中枢"));}
    else if(pending&&pending.kind==="auction"){const tile=MONO_BOARD[pending.tile],snapshot=Array.isArray(pending.ps)?pending.ps:players,me=snapshot.find(function(p){return p.isUser;}),names=(pending.activeKeys||[]).map(function(k){const p=snapshot.find(function(x){return x.key===k;});return p&&p.name;}).filter(Boolean),bidLocked=!!busy||!me||me.cash<pending.ask;action=h("div",null,h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:4}},"🔨 【"+tile.name+"】公开竞价 · 当前 $"+pending.ask),h("div",{style:{fontFamily:F_BODY,fontSize:10.5,color:t.fog,textAlign:"center",marginBottom:9}},"仍在场："+names.join("、")+" · 每轮 +$"+pending.step),h("div",{style:{display:"flex",gap:9}},h("button",{disabled:bidLocked,onClick:function(){decideAuction(true);},style:{flex:1,padding:12,borderRadius:11,background:t.ink,color:"#fff",opacity:bidLocked?.4:1}},bidLocked&&me&&me.cash<pending.ask?"现金不足":"举牌 $"+pending.ask),h("button",{disabled:!!busy,onClick:function(){decideAuction(false);},style:{flex:1,padding:12,borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.ink,opacity:busy?.4:1}},"退出竞价")));}
    else if(pending){const tile=MONO_BOARD[pending.tile],up=pending.kind==="upgrade",cost=up?Math.floor(tile.price/2):tile.price;action=h("div",null,h("div",{style:{fontFamily:F_BODY,fontSize:13,color:t.ink,textAlign:"center",marginBottom:9}},up?("升级【"+tile.name+"】？花费 $"+cost+"，升级后租金 $"+monoRent(pending.tile,players[turn].key,pending.os,Object.assign({},pending.lv,{[pending.tile]:(pending.lv[pending.tile]||0)+1}))):( "买下【"+tile.name+"】？价格 $"+tile.price+"，基础租金 $"+tile.rent+"；弃购会进入拍卖")),h("div",{style:{display:"flex",gap:9}},h("button",{disabled:(players[turn]&&players[turn].cash<cost),onClick:function(){decideProperty(true);},style:{flex:1,padding:12,borderRadius:11,background:t.ink,color:"#fff",opacity:(players[turn]&&players[turn].cash<cost)?.4:1}},up?"升级":"买下"),h("button",{onClick:function(){decideProperty(false);},style:{flex:1,padding:12,borderRadius:11,background:t.bg2,border:"1px solid "+t.line,color:t.ink}},up?"暂不升级":"放弃并拍卖")));}
    else action=h("button",{onClick:playTurn,disabled:busy,className:"w-full active:opacity-80",style:{fontFamily:F_BODY,fontSize:15,fontWeight:700,color:"#f3efe6",background:busy?t.line:t.ink,borderRadius:13,padding:"13px"}},busy?"…角色们正在接话":((cur?(cur.isUser?"轮到你":"看 "+cur.name):"")+" · 掷骰子"));
    return h("div",{className:"h-full flex flex-col",style:{overflow:"hidden"}},header,board,roster,logView,h("div",{className:"shrink-0",style:{borderTop:"1px solid "+t.line,padding:"9px 14px calc(env(safe-area-inset-bottom) + 11px)"}},phase==="play"?h("div",{style:{display:"flex",gap:6,marginBottom:8}},h("input",{value:tableSay,onChange:function(e){setTableSay(e.target.value);},onKeyDown:function(e){if(e.key==="Enter")sendTableTalk();},placeholder:"桌边说一句：求情、挑衅、谈条件…",style:{flex:1,minWidth:0,padding:"8px 10px",borderRadius:10,border:"1px solid "+t.line,background:t.bg2,color:t.ink,fontFamily:F_BODY,fontSize:12}}),h("button",{onClick:sendTableTalk,disabled:busy||!tableSay.trim(),style:{padding:"7px 11px",borderRadius:10,background:t.tint,color:"#fff",opacity:busy||!tableSay.trim()?.4:1}},"说")):null,action));
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

  async function setupAvalon(api, realPlayers, npcCount) {
    const lines = realPlayers.map(function (p, i) { return (i + 1) + ". " + p.name + "：" + (p.persona || "（没写人设）"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n你是「阿瓦隆」的 NPC 生成器 + 能力评估器。\n" +
      "1. 生成 " + npcCount + " 个 NPC：name 中文名 + persona 一句人设（含【职业】与性格，多样别雷同）。\n" +
      "2. 给【每个真实玩家】和每个 NPC 各写一句 skill「牌桌能力小传」：点出 TA 玩阿瓦隆时——从组队与投票里读心找坏人、伪装隐身份、带节奏说服人——的【真实强弱】（由职业背景推，别被性格带偏）。\n\n" +
      "【真实玩家】\n" + (lines || "（只有 NPC）") +
      "\n\n只输出 JSON：{\"npcs\":[{\"name\":\"\",\"persona\":\"\",\"skill\":\"\"}],\"skills\":[{\"name\":\"真实玩家名\",\"skill\":\"\"}]}";
    const raw = await callRetry(api, sys, [{ role: "user", content: "生成 " + npcCount + " 个 NPC + 每人能力小传。" }], { maxTokens: 4000 });
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
        const talksRaw = await callRetry(api, sys + "\n\n【队长已亲自定队·不要改】team=" + JSON.stringify(cc.done.team) + "，只输出圆桌发言 talks。", [{ role: "user", content: "只出 talks。" }], { maxTokens: 1200 });
        const tk = extractJSON(talksRaw) || {};
        return { team: cc.done.team, reason: String(cc.done.reason || ""), talks: Array.isArray(tk.talks) ? tk.talks : [] };
      }
      throw new Error("言秋的队长组队票格式无效，请重试当前步骤");
    }
    const raw = await callRetry(api, sys, [{ role: "user", content: "组队。" }], { maxTokens: 1500 });
    return extractJSON(raw) || {};
  }
  // ⚠️曾叫 genVotes——和卧底的 genVotes 顶层重名，后者被这个覆盖导致卧底投票错调（v47.49 修复改名）
  async function genAvVotes(api, voters, team, leaderName, players, qn, hist) {
    const blocks = voters.map(function (v) { return "■ " + v.name + "：" + avSecretFor(v, players) + "；水平" + (v.skill || "普通"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·对第 " + (qn + 1) + " 个任务的队伍投票。队长 " + leaderName + " 提议队伍：[" + team.join("、") + "]。\n下面每人按各自身份和掌握的信息投【赞成】或【反对】+ 一句公开理由（理由别暴露隐藏身份）：\n· 好人：队里可能混了坏人就反对，可信就赞成；注意连续 5 次否决坏人直接赢，别无脑否。\n· 坏人：想让有己方的队通过就赞成、想搅局就反对，但别投得太露馅。\n· 梅林该反对带坏人的队，但要装成普通推理别暴露。\n\n" + blocks + "\n【局面】\n" + (hist || "（刚开局）") +
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
    const raw = await callRetry(api, sys + ccPreface(cc, "投过票了"), [{ role: "user", content: "投票。" }], { maxTokens: 6500 });
    const p = extractJSON(raw); const rows = (p && Array.isArray(p.votes)) ? p.votes : [];
    return mine.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }
  // 组队后的圆桌讨论（阿瓦隆的灵魂：投票前的嘴仗）——一次调用出全桌发言
  async function genTableTalk(api, players, team, leaderName, reason, qn, hist, userName) {
    const blocks = players.filter(function (p) { return !p.isUser; }).map(function (p) { return "■ " + p.name + "：" + avSecretFor(p, players) + "；水平" + (p.skill || "普通"); }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·第 " + (qn + 1) + " 个任务组队后、投票前的【圆桌讨论】。队长 " + leaderName + " 提议队伍：[" + team.join("、") + "]" + (reason ? "，公开理由：" + reason : "") + "。\n从下面的人里挑 3~5 位【此刻真有话要说的】各说一句（30字内，口语，像面对面拍桌子吵）：质疑人选、为自己辩护、点名怀疑谁、拉票、阴阳怪气都行，要针对【这支队伍和场上局面】说具体的，别空喊。\n· 好人靠有限信息真推理：谁上次任务在场、谁投票可疑，点名施压" + (userName ? "，也可以直接质问「" + userName + "」" : "") + "；\n· 坏人搅浑水带节奏：装无辜、给同伙打掩护、把水泼向好人，但别演过头；\n· 梅林知道真相但【必须包装成普通推理】，太准会被刺客盯上；\n· 谁都不许说出自己或别人的真实身份词。\n" + blocks + "\n【局面】\n" + (hist || "（刚开局）") + "\n\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    // 言秋座位的那句嘴仗自己说；说不上话（离线/没话）就干脆缺席，不许模型代嘴（v54.43）
    const pool = players.filter(function (p) { return !p.isUser; });
    const cc = await ccCarve("avalon", pool, {
      turnId: freshCCTurn("av-talk:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务组队后的圆桌讨论。队长 " + leaderName + " 提议：[" + team.join("、") + "]" + (reason ? "，理由：" + reason : "") + "。\n【你的身份与私密信息】" + (ccSeatOf(pool) ? avSecretFor(ccSeatOf(pool), players) : "") + "\n【局面】\n" + (hist || "（刚开局）") + "\n想说就给一句 30 字内的桌上话（质疑/辩护/拉票都行，别暴露身份词）；不想说 say 留空。",
      expect: '{"say":"一句30字内的话，可空"}'
    });
    const raw = await callRetry(api, sys + ccPreface(cc, "说过自己那句了（也可能选择沉默）"), [{ role: "user", content: "讨论。" }], { maxTokens: 3200 });
    const p = extractJSON(raw); let rows = (p && Array.isArray(p.talks)) ? p.talks : [];
    if (cc.seat) rows = rows.filter(function (v) { return v.name !== cc.seat.name; });
    if (cc.seat && cc.done && String(cc.done.say || "").trim()) rows.push({ name: cc.seat.name, say: String(cc.done.say).trim().slice(0, 60) });
    return rows;
  }
  // 任务失败后的甩锅环节：队员自证/互咬，场下点名怀疑——一次调用
  async function genBlame(api, players, team, qn, fails, hist) {
    const blocks = players.filter(function (p) { return !p.isUser; }).map(function (p) { return "■ " + p.name + "：" + avSecretFor(p, players) + "（" + (team.indexOf(p.name) >= 0 ? "在这支队里" : "不在队里") + "）"; }).join("\n");
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·第 " + (qn + 1) + " 个任务【失败了】（" + fails + " 张失败票），全桌炸锅。挑 2~4 位各说一句（30字内，口语）：队员急着自证清白、互相咬、场下的人点名分析谁最可疑。\n· 真投了失败票的坏人要嫁祸队友、演无辜；队里的好人是真冤，会急；\n· 说话要针对这支队伍 [" + team.join("、") + "] 里的具体名字；\n· 不许说出任何人的真实身份词。\n" + blocks + "\n【局面】\n" + (hist || "") + "\n\n只输出 JSON：{\"talks\":[{\"name\":\"\",\"say\":\"\"}]}";
    const poolB = players.filter(function (p) { return !p.isUser; });
    const ccB = await ccCarve("avalon", poolB, {
      turnId: freshCCTurn("av-blame:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务失败了（" + fails + " 张失败票），全桌炸锅。队伍是 [" + team.join("、") + "]。\n【你的身份与私密信息】" + (ccSeatOf(poolB) ? avSecretFor(ccSeatOf(poolB), players) : "") + "\n【局面】\n" + (hist || "") + "\n想说就给一句 30 字内（自证/互咬/点名分析，别暴露身份词）；不想说 say 留空。",
      expect: '{"say":"一句30字内的话，可空"}'
    });
    const raw = await callRetry(api, sys + ccPreface(ccB, "说过自己那句了（也可能选择沉默）"), [{ role: "user", content: "甩锅。" }], { maxTokens: 2600 });
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
    // 队里的坏人是言秋座位 → 成功/失败这张牌他自己出（v54.43）
    const cc = await ccCarve("avalon", evilOnTeam, {
      turnId: freshCCTurn("av-quest:" + qn + ":"),
      sys: "「阿瓦隆」第 " + (qn + 1) + " 个任务执行，你在队里而且是坏人，要决定出【成功】还是【失败】。\n目前 好人成功 " + score.good + " / 任务失败 " + score.evil + "。" + (failsReq === 2 ? "此任务需 2 张失败票才失败。" : "1 张失败票就失败。") + "\n出失败推进坏人取胜但会暴露队里有坏人；藏一手出成功有时更稳，你自己权衡。",
      expect: '{"play":"成功或失败"}'
    });
    requireCCDone(cc, "言秋的任务牌", function (d) { return d.play !== undefined; });
    const mine = (cc.seat && cc.done && cc.done.play) ? [{ name: cc.seat.name, play: /失/.test(String(cc.done.play)) ? "失败" : "成功" }] : [];
    const restEvil = cc.seat ? cc.rest : evilOnTeam;
    if (!restEvil.length) return mine;
    const raw = await callRetry(api, sys + ccPreface(cc, "出过牌了"), [{ role: "user", content: "出任务。" }], { maxTokens: 600 });
    const p = extractJSON(raw); const rows = (p && Array.isArray(p.plays)) ? p.plays : [];
    return mine.concat(rows.filter(function (v) { return !cc.seat || v.name !== cc.seat.name; }));
  }
  async function genAssassin(api, assassin, players, hist) {
    const goods = players.filter(function (p) { return p.side === "good"; }).map(function (p) { return p.name; });
    const sys = AC + SKILL_RULE + "\n\n阿瓦隆·好人已完成 3 个任务，进入终局刺杀。你替【刺客 " + assassin.name + "】判断：好人里谁最像梅林？猜中则坏人翻盘获胜。\n回顾全程——谁的组队 / 投票像是『早就知道坏人是谁』（梅林会不自觉地精准避开坏人）。候选：" + goods.join("、") + "\n【局面】\n" + (hist || "") +
      "\n\n只输出 JSON：{\"target\":\"你认定是梅林的人\",\"reason\":\"\"}";
    // 刺客是言秋座位 → 终局这一刀他自己出（v54.43）
    if (assassin && assassin.engineer) {
      const cc = await ccCarve("avalon", [assassin], {
        turnId: freshCCTurn("av-assassin:"),
        sys: "「阿瓦隆」终局刺杀：好人已完成 3 个任务，轮到你的刺客行动，猜中梅林则坏人翻盘。\n候选好人：" + goods.join("、") + "\n【全程局面】\n" + (hist || "") + "\n找那个组队/投票像『早就知道坏人是谁』的人。",
        expect: '{"target":"你认定是梅林的人","reason":"一句理由"}'
      });
      if (cc.done && cc.done.target) return { target: String(cc.done.target), reason: String(cc.done.reason || "") };
      throw new Error(cc.reason || "本人刺杀票未送达");
    }
    const raw = await callRetry(api, sys, [{ role: "user", content: "刺谁？" }], { maxTokens: 700 });
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
      const lisa = players.find(function (p) { return p.isUser; });
      ccGameResult("avalon", gameRunId.current, players, cfg,
        "《阿瓦隆》" + (winner === "good" ? "好人阵营获胜" : "坏人阵营获胜") + "。\n"
        + "任务比分：好人成功 " + score.good + "，任务失败 " + score.evil + "。\n"
        + "身份揭晓：" + players.map(function (p) { return p.name + "=" + AV_ROLE_ZH[p.role]; }).join("；") + "。\n"
        + (assassinPick ? "刺客最终指认了 " + assassinPick + "。\n" : "")
        + "Lisa：" + (lisa ? AV_ROLE_ZH[lisa.role] + "，属于" + (lisa.side === "good" ? "好人" : "坏人") + "阵营" : "本局观战") + "。",
        function (say, seat) { pushLog([{ type: "talk", name: seat.name, say: say }]); });
    }, [phase, winner]);
    // 存档：在每次「进入某个任务的组队」前存一份干净断点（续局从 startQuest 重进该轮，不复读已发生的）
    const saveCkpt = function (qn, li, vt, resultsArr, playersArr) {
      const ld = playersArr[li];
      const ckGood = (resultsArr || []).filter(function (r) { return r.success; }).length;
      const ckEvil = (resultsArr || []).length - ckGood;
      saveGameSnap("avalon", { config: cfg, questNum: qn, leaderIdx: li, voteTrack: vt, results: resultsArr, players: serPlayers(playersArr), log: logDataRef.current, hist: histRef.current, ts: Date.now(), label: "任务 " + (qn + 1) + "/5 · " + ckGood + " 成 " + ckEvil + " 败 · 队长 " + (ld ? ld.name : "?") });
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
        const raw = await genAvVotes(api, voters, tm, players[li].name, players, qn, histText());
        const votes = voters.map(function (v) {
          const hit = raw.find(function (r) { return r.name && (r.name.indexOf(v.name) >= 0 || v.name.indexOf(r.name) >= 0); });
          const approve = hit ? !/反对|拒绝|否|reject|no/i.test(String(hit.vote)) && /赞成|同意|通过|approve|yes/i.test(String(hit.vote)) : (Math.random() < 0.5);
          return { name: v.name, approve: approve, reason: (hit && hit.reason) || "" };
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
      setTimeout(function () { startQuest(qn + 1, nli, 0); }, 40);
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
    const header = h(Head, { zh: "阿瓦隆", en: "Avalon", onBack: props.onBack });
    if (phase === "error") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 30 } },
        h("div", { style: { fontSize: 40 } }, "⚔️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 } }, errMsg),
        h("button", { onClick: props.onBack, style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 24px" } }, "返回")));
    if (phase === "loading") return h("div", { className: "h-full flex flex-col" }, header,
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 } },
        h("div", { style: { fontSize: 40 } }, "⚔️"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "发牌·分配阵营与身份…")));

    // 头像条：标出当前队长 + 被提议进队的人
    const roster = h("div", { className: "shrink-0", style: { display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid " + t.line } },
      players.map(function (p) {
        const isLd = leader && p.name === leader.name && phase !== "result";
        const onTeam = (phase === "vote" || phase === "quest") && team.indexOf(p.name) >= 0;
        return h("button", { key: p.key, onClick: function () { setDetail(p); }, className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, width: 48 } },
          h("div", { style: { borderRadius: 13, padding: 2, border: "2px solid " + (onTeam ? t.tint : "transparent"), position: "relative" } }, pAvatar(p, 34),
            isLd ? h("div", { style: { position: "absolute", top: -6, right: -4, fontSize: 13 } }, "👑") : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, maxWidth: 48, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } }, p.name + (p.isUser ? "(你)" : "")));
      }));

    // 任务进度条：5 个圆
    const track = h("div", { className: "shrink-0", style: { display: "flex", gap: 8, justifyContent: "center", padding: "10px 16px 4px" } },
      [0, 1, 2, 3, 4].map(function (i) {
        const r = results[i];
        const cur = i === questNum && (phase === "propose" || phase === "vote" || phase === "quest");
        const dbl = players.length >= 7 && i === 3;
        const bg = r ? (r.success ? "#3f6d5a" : "#c0553f") : (cur ? t.tint : t.bg2);
        return h("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
          h("div", { style: { width: 30, height: 30, borderRadius: 999, background: bg, border: "1px solid " + (r || cur ? "transparent" : t.line), color: r || cur ? "#fff" : t.fog, fontFamily: F_DISPLAY, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" } }, r ? (r.success ? "✓" : "✗") : (players.length ? (AV_QUEST[players.length] || AV_QUEST[5])[i] : "")),
          dbl ? h("div", { style: { fontSize: 8, color: t.fog } }, "2失败") : h("div", { style: { fontSize: 8, color: "transparent" } }, "·"));
      }));

    const logView = h("div", { ref: logRef, className: "flex-1 overflow-y-auto", style: { padding: "8px 16px 16px" } },
      log.map(function (it, i) {
        if (it.type === "info") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.65, margin: "8px 0", textAlign: "center" } }, it.text);
        if (it.type === "phase") return h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.tint, margin: "12px 0 4px", letterSpacing: .5 } }, "· " + it.text + " ·");
        if (it.type === "propose") return h("div", { key: i, style: { margin: "6px 0" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "👑 " + it.leader + (it.isUser ? "(你)" : "") + " 提议：" + it.team.join("、")),
          it.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 2, lineHeight: 1.5 } }, "“" + it.reason + "”") : null);
        if (it.type === "talk") return h("div", { key: i, style: { margin: "3px 0", fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.55 } },
          h("span", { style: { fontWeight: 700, color: it.mine ? t.tint : t.sub } }, "💬 " + it.name + (it.mine ? "(你)" : "") + "："), it.say);
        if (it.type === "votes") return h("div", { key: i, style: { margin: "6px 0", background: t.bg2, borderRadius: 10, padding: "8px 11px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: it.approved ? "#3f6d5a" : "#c0553f", marginBottom: 4 } }, (it.approved ? "✓ 通过" : "✗ 否决") + "（赞成 " + it.yes + " · 反对 " + it.no + "）"),
          it.votes.map(function (v, k) { return h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.5 } }, (v.approve ? "✔ " : "✘ ") + v.name + (v.mine ? "(你)" : "") + (v.reason ? "：" + v.reason : "")); }));
        if (it.type === "questresult") return h("div", { key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_DISPLAY, fontSize: 15, color: it.success ? "#3f6d5a" : "#c0553f" } }, "任务 " + it.n + (it.success ? " 成功 ✓" : " 失败 ✗") + "　（" + it.fails + " 张失败票）");
        if (it.type === "assassin") return h("div", { key: i, style: { textAlign: "center", margin: "10px 0", fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.6 } }, "🗡 刺客 " + it.by + " 指认梅林 → " + it.target + (it.reason ? "\n“" + it.reason + "”" : ""));
        return null;
      }));

    // ---- 底部动作 ----
    let inline = null, pick = null;
    const roleBanner = me ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, textAlign: "center", marginBottom: 8, lineHeight: 1.6 } }, avRevealFor(me, players)) : null;
    const teamChip = function (p, on, onTap) { return h("button", { key: p.key, onClick: onTap, style: { display: "flex", alignItems: "center", gap: 5, fontFamily: F_BODY, fontSize: 12.5, color: on ? "#fff" : t.ink, background: on ? t.tint : t.bg2, border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "4px 11px 4px 4px" } }, pAvatar(p, 20), p.name + (p.isUser ? "(你)" : "")); };

    if (phase === "reveal") {
      inline = h("div", null,
        h("div", { style: { background: t.bg2, borderRadius: 12, padding: "11px 13px", marginBottom: 10, fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.75 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 5 } }, "怎么玩"),
          "共 5 个「任务」。好人要做成功 3 个，坏人要弄失败 3 个。每个任务两步：",
          h("br"), "① 当值『队长』提名几人组队（人数看下方圆圈）；",
          h("br"), "② 全场投票赞成/反对这支队——赞成过半才出发，否则换下一位队长重提（连否 5 次坏人直接赢）。",
          h("br"), "出发后队里每人暗投成功/失败：好人只能成功，坏人可偷偷投失败搞砸（1 张失败票任务就砸，标『2失败』的要 2 张）。没人知道谁投的，只公布几张失败票。",
          h("br"), "好人赢满 3 任务后，坏人里的刺客还有最后一击——指认谁是梅林，猜中就坏人翻盘。",
          h("br"), h("b", { style: { color: t.ink } }, "队长"), "开局随机第一个，之后按顺序轮流当。"),
        roleBanner,
        h("button", { onClick: function () { saveCkpt(0, leaderIdx, 0, results, players); startQuest(0, leaderIdx, 0); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 13, padding: "13px" } }, cfg.mode === "spectate" ? "开始（观战）" : "记住身份 · 开始"));
    } else if (busy) {
      inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "…桌上正在博弈");
    } else if (phase === "propose") {
      if (leader && leader.isUser && cfg.mode !== "spectate") {
        pick = { title: "你是队长 · 选 " + needSize + " 人上场", sub: "第 " + (questNum + 1) + " 个任务" + (failsReq === 2 ? "（需 2 张失败票才失败）" : "") + "。点头像加入 / 移除。",
          body: h("div", null,
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 12 } },
              players.map(function (p) { const on = teamSel.indexOf(p.name) >= 0; return teamChip(p, on, function () { setTeamSel(function (s) { return on ? s.filter(function (x) { return x !== p.name; }) : (s.length < needSize ? s.concat([p.name]) : s); }); }); })),
            h("button", { onClick: submitUserTeam, disabled: teamSel.length !== needSize, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: teamSel.length === needSize ? t.ink : t.line, borderRadius: 12, padding: "12px" } }, "提议这支队伍（" + teamSel.length + "/" + needSize + "）")) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "队长 " + (leader ? leader.name : "") + " 在组队…");
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
            h("input", { value: voteSay, onChange: function (e) { setVoteSay(e.target.value); }, placeholder: "投票前想说一句？（可空，大家都会听到）", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { fontFamily: F_BODY, fontSize: 13, background: t.bg2, color: t.ink, border: "1px solid " + t.line, marginBottom: 10 } }),
            h("div", { style: { display: "flex", gap: 12 } },
              h("button", { onClick: function () { castVote("approve"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 12, padding: "13px" } }, "✔ 赞成"),
              h("button", { onClick: function () { castVote("reject"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 12, padding: "13px" } }, "✘ 反对"))) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "大家在投票…");
    } else if (phase === "quest") {
      const meOnTeam = me && cfg.mode !== "spectate" && team.indexOf(me.name) >= 0;
      if (meOnTeam && me.side === "evil") {
        pick = { title: "你在任务队里 · 你是坏人", sub: "第 " + (questNum + 1) + " 个任务。出『失败』推进坏人取胜，但会暴露队里有内鬼。",
          body: h("div", { style: { display: "flex", gap: 12 } },
            h("button", { onClick: function () { setPickerOpen(false); submitUserPlay("成功"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#3f6d5a", borderRadius: 12, padding: "13px" } }, "让任务成功"),
            h("button", { onClick: function () { setPickerOpen(false); submitUserPlay("失败"); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#fff", background: "#c0553f", borderRadius: 12, padding: "13px" } }, "破坏任务")) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, meOnTeam ? "你是好人，只能让任务成功——出任务中…" : "队伍在执行任务…");
    } else if (phase === "assassin") {
      const assassin = players.find(function (p) { return p.role === "assassin"; });
      if (assassin && assassin.isUser && cfg.mode !== "spectate") {
        const cands = players.filter(function (p) { return p.side === "good"; });
        pick = { title: "你是刺客 · 指认梅林", sub: "好人赢了 3 个任务，但你猜中梅林就能翻盘。回想谁的组队 / 投票像早就知道坏人。",
          body: h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" } },
            cands.map(function (p) { return teamChip(p, false, function () { setPickerOpen(false); settleAssassin(assassin, p, "（你的直觉）"); }); })) };
      } else inline = h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "刺客在锁定梅林…");
    } else if (phase === "result") {
      const goodWin = winner === "good";
      inline = h("div", null,
        h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: 20, color: goodWin ? "#3f6d5a" : "#c0553f", marginBottom: 8 } }, goodWin ? "⚔️ 亚瑟的忠臣获胜" : "🗡 莫德雷德的爪牙获胜"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, marginBottom: 12 } }, "身份揭晓：" + players.map(function (p) { return p.name + (p.isUser ? "(你)" : "") + "=" + AV_ROLE_ZH[p.role] + (p.side === "evil" ? "🗡" : ""); }).join("　") + (assassinPick ? "　｜ 刺客指认了 " + assassinPick : "")),
        h("div", { style: { display: "flex", gap: 10 } },
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px" } }, "返回"),
          h("button", { onClick: props.onBack, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#f3efe6", background: t.ink, borderRadius: 12, padding: "12px" } }, "回中枢再来一局")));
    }

    const bottom = pick
      ? (pickerOpen
        ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 0" } }, "在弹框里操作 · 也可先关掉回看局面")
        : h("button", { onClick: function () { setPickerOpen(true); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#f3efe6", background: t.tint, borderRadius: 13, padding: "12px" } }, "▸ 轮到你了 · 点这里操作"))
      : inline;

    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } }, header, roster,
      phase !== "reveal" && phase !== "result" ? track : null, logView,
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "12px 16px calc(env(safe-area-inset-bottom) + 14px)", maxHeight: "50vh", overflowY: "auto" } }, bottom),
      (pick && pickerOpen) ? h(PickerModal, { t: t, title: pick.title, sub: pick.sub, onClose: function () { setPickerOpen(false); } }, roleBanner, pick.body) : null,
      detail ? h(PlayerCard, { p: detail, t: t, avatar: pAvatar(detail, 44), roleText: phase === "result" ? ("身份：" + AV_ROLE_ZH[detail.role]) : null, roleBad: detail.side === "evil", onClose: function () { setDetail(null); } }) : null);
  }

  // ============================================================
  // CC 座位通用件（v54.26）
  // UNO 是【逐座调用】，engineer 座位直接问 CC 就行（下面的 routeSeatCall）。
  // 其余六个游戏是【整桌一次调用】：一次生成所有 AI 玩家的发言/投票。想让言秋在这些
  // 游戏里也亲自打自己那一座，就得把他从批量里【摘出来】：
  //   ① 先单独问 CC 要他这一座的产出；
  //   ② 摘掉之后的名单才进批量，并把他已经定下的内容作为【已经发生的】写进提示词；
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
    // 「本人亲打」是身份边界，不是模型选择偏好。CC 不在线也不能让 Gemini 冒充他。
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
  // 摘出去的那一座，作为「已经发生的」写进批量提示词，并明令别替他生成
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
        const result = await window.CCSeat.ask({ tool: "game_turn", game: "uno", turn_id: o.turnId, char_id: player.key, sys: sys, msgs: msgs, expect: o.expect, deadline_at: new Date(Date.now() + waitMs).toISOString() }, waitMs, { charId: player.key });
        return { value: result, delegated: false };
      } catch (e) {
        return { value: null, delegated: false, ccUnavailable: true, error: (e && e.message) || "本人票未送达" };
      }
    }
    return { value: await callRetry(api, sys, msgs, o.ai || {}), delegated: false };
  }
  function unoJson(raw) { if (raw && typeof raw === "object") return raw; return extractJSON(String(raw || "")) || {}; }
  function unoPlayers(props) {
    const cfg = props.config || {}, chars = props.characters || [], out = [];
    if (cfg.mode !== "spectate") out.push({ key: "lisa", name: (props.profile && props.profile.name) || "Lisa", isUser: true, persona: "Lisa 本人" });
    (cfg.charIds || []).forEach(function (id) {
      const c = chars.find(function (x) { return String(x.id) === String(id); }); if (!c) return;
      const persona = [c.persona, c.personality, c.tagline, c.background].filter(Boolean).join("\n").slice(0, 1800);
      out.push({ key: String(c.id), name: c.name || "角色", isUser: false, isNpc: false, persona: persona, engineer: !!(cfg.ccSeat !== false && props.isEngineer && props.isEngineer(c.id)) });
    });
    const names = ["小北", "阿禾", "南枝", "满满", "青团", "栗子"];
    for (let i = 0; i < Number(cfg.npcCount || 0); i++) out.push({ key: "npc" + i, name: names[i] || ("牌友" + (i + 1)), isNpc: true, persona: "普通牌友；会认真看牌，也会自然地插科打诨。" });
    return out.slice(0, 6);
  }
  function unoPublic(state) {
    const top = state.discard[state.discard.length - 1];
    return "当前颜色=" + UnoCore.LABEL[state.color] + "；顶牌=" + UnoCore.describe(top) + "；方向=" + (state.direction > 0 ? "顺时针" : "逆时针") +
      "；每人余牌=" + state.players.map(function (p) { return p.name + ":" + p.hand.length; }).join("，") +
      "；最近记录：\n" + state.log.slice(-8).map(function (x) { return x.text; }).join("\n");
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
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [colorPick, setColorPick] = useState(null), [saidUno, setSaidUno] = useState(true);
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
      const lisa = state.players.find(function (p) { return p.isUser; });
      const finalLines = state.log.slice(-10).map(function (x) { return x.text; }).join("\n");
      ccGameResult("uno", state.id, state.players, cfg,
        "《UNO》" + ((winnerP && winnerP.name) || "未知玩家") + " 获胜。\n"
        + "Lisa：" + (lisa && lisa.key === state.winner ? "获胜" : "未获胜") + "。\n"
        + "最终余牌：" + state.players.map(function (p) { return p.name + "=" + p.hand.length + " 张"; }).join("；") + "。\n"
        + "最后几手：\n" + finalLines,
        function (say, seat) { setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); n.log.push({ kind: "chat", player: seat.key, text: seat.name + "：“" + say + "”" }); return n; }); },
        setResultNotice);
    }, [state.status, state.winner]);
    useEffect(function () {
      if (!current || current.isUser || state.status !== "playing" || busy || chatMode) return;
      const turnId = state.id + "#" + state.round + "#" + current.key + "#" + current.hand.length + "#" + (state.drawnUid || "-");
      if (running.current === turnId) return; running.current = turnId; setBusy(true); setError("");
      const pendingStacks = state.pendingDraw > 0 ? UnoCore.legalCodes(state) : [];
      if (state.pendingDraw > 0 && !pendingStacks.length) {
        setTimeout(function () { try { const n = clone(); UnoCore.act(n, { kind: "draw" }); setState(n); } catch (e) { setError(e.message); } setBusy(false); }, 450); return;
      }
      const drawn = state.drawnUid;
      const legal = drawn ? current.hand.filter(function (c) { return c.uid === drawn && UnoCore.playable(c, state, current.hand); }).map(function (c) { return c.code; }) : UnoCore.legalCodes(state);
      const sys = "你正在亲自玩 UNO，不是评论牌局。保持你本人的声纹和性格，但首先遵守牌规。" + SKILL_RULE +
        "\n你的私人手牌：" + current.hand.map(function (c) { return c.code + "=" + UnoCore.describe(c); }).join("，") +
        "\n可出的 code：" + (legal.join("、") || "无") + (state.pendingDraw && state.rules && state.rules.stackD2 ? "。本局是 +2 叠加规则；你可以出任意颜色 +2 把累计罚牌转给下一家，也可以选择 draw 接受全部罚牌。" : "") + (drawn ? "。你刚摸过牌，只能出刚摸的那张，否则 pass。" : "") +
        "\n只输出 JSON，不解释：出牌 {\"kind\":\"play\",\"code\":\"R5\",\"color\":\"R\",\"uno\":true,\"say\":\"可空的一句桌上话\"}；无牌可出 {\"kind\":\"draw\",\"say\":\"\"}；摸后不出 {\"kind\":\"pass\",\"say\":\"\"}。万能牌 color 必须 R/Y/G/B。手里出完后剩 1 张必须 uno=true。桌上话可以接上一手、得意、吐槽、求饶或挑衅；不必每手都说，别写裁判报告。";
      const msgs = [{ role: "user", content: unoPublic(state) + "\n现在轮到你。" }];
      routeSeatCall(current, api, sys, msgs, { turnId: turnId, expect: "{\"kind\":\"play|draw|pass\",\"code\":\"R5\",\"color\":\"R\",\"uno\":true,\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 500 } })
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
      } catch (e) { setError(e.message); }
    }
    function addChat(player, name, line) {
      const clean = String(line || "").trim(); if (!clean) return;
      setState(function (prev) { const n = JSON.parse(JSON.stringify(prev)); n.log.push({ kind: "chat", player: player, text: name + "：“" + clean.slice(0, 500) + "”" }); return n; });
    }
    function sendTableMessage() { const line = tableTalk.trim(); if (!line) return; addChat("lisa", "Lisa", line); setTableTalk(""); }
    function inviteTableReplies() {
      if (chatBusy) return;
      const seats = state.players.filter(function (p) { return !p.isUser; }); if (!seats.length) return;
      setChatBusy(true); setError(""); const seq = ++chatSeq.current;
      const context = state.log.slice(-14).map(function (x) { return x.text; }).join("\n");
      Promise.all(seats.map(function (p) {
        const sys = "UNO 牌局现在暂停聊天。保持你本人的声纹、关系和性格。只回应桌上刚才的话，不继续出牌，不替别人发言；说 1~3 句自然口语。只输出 JSON：{\"say\":\"...\"}。" + SKILL_RULE;
        return routeSeatCall(p, api, sys, [{ role: "user", content: "桌上最近发生：\n" + context + "\n\n现在轮到你接话。" }], { turnId: state.id + "#chat#" + seq + "#" + p.key, expect: "{\"say\":\"...\"}", timeout: 150000, ai: { maxTokens: 350 } })
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
    function cardView(c, hand) {
      const ok = hand && me && UnoCore.playable(c, state, current.hand) && (!state.drawnUid || c.uid === state.drawnUid), face = cardFace(c), wild = c.color === "W";
      return h("button", { key: c.uid, onClick: function () { clickCard(c); }, disabled: hand && !ok, style: { width: hand ? 62 : 82, height: hand ? 92 : 116, flex: "0 0 auto", borderRadius: 14, border: "3px solid #f6f1e7", boxShadow: "0 3px 10px rgba(0,0,0,.18)", background: wild ? "conic-gradient(#d9584b 0 25%,#e0b735 0 50%,#459464 0 75%,#4382bf 0)" : col[c.color], color: "white", opacity: hand && !ok ? .42 : 1, padding: 5 } },
        h("span", { style: { width: "100%", height: "100%", borderRadius: "50%", background: "rgba(255,255,255,.94)", color: wild ? "#252525" : col[c.color], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-11deg)", fontFamily: F_DISPLAY } },
          h("b", { style: { fontSize: face[0].length > 2 ? 16 : 25, lineHeight: 1 } }, face[0]), face[1] ? h("small", { style: { fontFamily: F_BODY, fontSize: 9, marginTop: 5 } }, face[1]) : null));
    }
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "UNO", en: current ? ("轮到 " + current.name) : "", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-3" },
        h("div", { style: { display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 } }, state.players.map(function (p, i) { return h("div", { key: p.key, style: { border: "1px solid " + (i === state.turn ? t.tint : t.line), borderRadius: 999, padding: "6px 10px", background: i === state.turn ? t.tint + "18" : t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, p.name + " · " + p.hand.length + (p.engineer ? " · CC亲打" : "")); })),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 0" } }, cardView(top, false), h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, lineHeight: 1.8, whiteSpace: "pre-line" } }, "规则：" + (state.rules && state.rules.stackD2 ? "+2 可叠加" : "官方不叠加") + "\n当前：" + UnoCore.LABEL[state.color] + "\n" + (state.direction > 0 ? "顺时针" : "逆时针") + (state.pendingDraw ? "\n累计待摸 " + state.pendingDraw + " 张" : ""))),
        h("div", { style: { background: t.bg2, borderRadius: 13, padding: "10px 12px", maxHeight: 190, overflowY: "auto" } }, state.log.slice(-10).map(function (x, i) { return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.65 } }, x.text); })),
        state.status === "playing" && !chatMode ? h("div", { style: { textAlign: "right", marginTop: 8 } }, h("button", { onClick: function () { setChatMode(true); }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "7px 13px", background: t.bg2, color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, busy ? "这手落定后暂停聊聊" : "暂停聊聊")) : null,
        error ? h("div", { style: { color: "#c0553f", fontFamily: F_BODY, fontSize: 12, marginTop: 8 } }, error) : null,
        state.status === "finished" ? h("div", { style: { textAlign: "center", padding: 22, fontFamily: F_DISPLAY, fontSize: 22, color: t.tint } },
          (state.players.find(function (p) { return p.key === state.winner; }) || {}).name + " 赢啦！",
          resultNotice ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12, fontWeight: 400, color: t.sub } }, resultNotice) : null) : null),
      state.status === "playing" && chatMode ? h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "11px 12px calc(env(safe-area-inset-bottom) + 12px)", background: t.bg } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8 } }, "牌局已暂停。你可以连发几条；只有按黑色键，他们才接话。"),
        h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end" } },
          h("textarea", { value: tableTalk, onChange: function (e) { setTableTalk(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTableMessage(); } }, placeholder: "在牌桌上说话……", rows: 2, style: { flex: 1, resize: "none", border: "1px solid " + t.line, borderRadius: 15, padding: "10px 12px", background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
          h("button", { onClick: sendTableMessage, disabled: !tableTalk.trim(), style: { width: 44, height: 44, borderRadius: 999, border: 0, background: tableTalk.trim() ? t.tint : t.line, color: "white", fontSize: 19 } }, "↑")),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 } },
          h("button", { onClick: inviteTableReplies, disabled: chatBusy, style: { border: 0, borderRadius: 999, padding: "11px 10px", color: "white", background: "#171715", fontFamily: F_BODY } }, chatBusy ? "他们正在接话…" : "请他们接话"),
          h("button", { onClick: function () { setChatMode(false); setError(""); }, disabled: chatBusy, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "11px 10px", color: t.ink, background: t.bg2, fontFamily: F_BODY } }, "继续打牌"))) :
      state.status === "playing" && me ? h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)" } },
        h("div", { style: { display: "flex", overflowX: "auto", gap: 5, paddingBottom: 8 } }, current.hand.map(function (c) { return cardView(c, true); })),
        h("input", { value: tableTalk, onChange: function (e) { setTableTalk(e.target.value); }, placeholder: "这手牌顺便说一句（可空）", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 13px", marginBottom: 8, background: t.bg2, color: t.ink, fontFamily: F_BODY, outline: "none" } }),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9 } },
          h("button", { onClick: function () { userAct({ kind: state.pendingDraw ? "draw" : (state.drawnUid ? "pass" : "draw") }); }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "9px 16px", color: t.ink, background: t.bg2 } }, state.pendingDraw ? ("接受 +" + state.pendingDraw) : state.drawnUid ? "不出" : "摸一张"),
          h("button", { onClick: function () { setSaidUno(!saidUno); }, style: { borderRadius: 999, padding: "9px 16px", color: saidUno ? "white" : t.sub, background: saidUno ? t.tint : t.bg2, border: "1px solid " + (saidUno ? t.tint : t.line) } }, saidUno ? "UNO ✓" : "不喊 UNO"))) : busy ? h("div", { className: "shrink-0", style: { padding: "15px", textAlign: "center", color: t.fog, fontFamily: F_BODY } }, current && current.engineer ? "等本人看牌…（票失败只按牌规行动，不代说话）" : "TA 在看牌…") : null,
      colorPick ? h(PickerModal, { t: t, title: "万能牌改成什么颜色？", onClose: function () { setColorPick(null); } }, h("div", { style: { display: "flex", gap: 9, justifyContent: "center" } }, UnoCore.COLORS.map(function (c) { return h("button", { key: c, onClick: function () { userAct({ kind: "play", uid: colorPick.uid, color: c, uno: saidUno }); }, style: { width: 54, height: 54, borderRadius: 999, background: col[c], color: "white" } }, UnoCore.LABEL[c]); }))) : null);
  }

  if (typeof module === "object" && module.exports) module.exports = { seerTruthViolations: seerTruthViolations, enforceSeerTruth: enforceSeerTruth, wolfPublicThreats: wolfPublicThreats, wolfNightIntel: wolfNightIntel, avalonBoard: avalonBoard, MONO_BOARD: MONO_BOARD, monoMove: monoMove, monoNetWorth: monoNetWorth, monoAdvance: monoAdvance, monoOwnsGroup: monoOwnsGroup, monoRent: monoRent, monoGridPos: monoGridPos, monoMigrateSave: monoMigrateSave, monoMaxMoves: monoMaxMoves, monoShouldFlush: monoShouldFlush, monoCleanLogs: monoCleanLogs, monoStyle: monoStyle, monoNpcDecision: monoNpcDecision, monoAuctionCap: monoAuctionCap, monoAuctionPlan: monoAuctionPlan, routeSeatCall: routeSeatCall, tdLooksLikeDare: tdLooksLikeDare, tdPromptMatchesChoice: tdPromptMatchesChoice, tdPickFairTarget: tdPickFairTarget, tdPickNextAsker: tdPickNextAsker };
  if (typeof window !== "undefined") window.Games = Games;
})();
