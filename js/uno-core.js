(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UnoCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const COLORS = ["R", "Y", "G", "B"];
  const LABEL = { R: "红", Y: "黄", G: "绿", B: "蓝", S: "跳过", V: "反转", D2: "+2", W: "变色", W4: "+4" };
  let seq = 0;
  function card(color, value) { return { uid: "u" + (++seq), color, value, code: color === "W" ? value : color + value }; }
  function makeDeck(random) {
    const deck = [];
    COLORS.forEach(c => {
      deck.push(card(c, "0"));
      for (let n = 1; n <= 9; n++) { deck.push(card(c, String(n))); deck.push(card(c, String(n))); }
      ["S", "V", "D2"].forEach(v => { deck.push(card(c, v)); deck.push(card(c, v)); });
    });
    for (let i = 0; i < 4; i++) { deck.push(card("W", "W")); deck.push(card("W", "W4")); }
    return shuffle(deck, random);
  }
  function shuffle(a, random) { const r = random || Math.random, out = a.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
  function refill(state, random) {
    if (state.deck.length || state.discard.length < 2) return;
    const top = state.discard[state.discard.length - 1];
    state.deck = shuffle(state.discard.slice(0, -1), random); state.discard = [top];
  }
  function draw(state, player, count, random) { const got = []; for (let i = 0; i < count; i++) { refill(state, random); if (!state.deck.length) break; const c = state.deck.pop(); player.hand.push(c); got.push(c); } return got; }
  function playable(c, state, hand) {
    const top = state.discard[state.discard.length - 1];
    if (!c || !top) return false;
    // 可选桌规：开启后，+2 可用任意颜色的 +2 继续叠，罚牌转给下一家。
    if (state.pendingDraw > 0) return !!(state.rules && state.rules.stackD2 && top.value === "D2" && c.value === "D2");
    if (c.value === "W") return true;
    // W4 随时能打（可以诈）：官方规则允许手里有同色时冒险偷出，代价是被下家质疑抓到罚 4。
    // 合法性在出牌那一刻记进 state.w4，质疑时由规则层翻牌结算——原来引擎级禁掉诈打，
    // 等于把「质疑 +4」这半条规则一起删了。
    if (c.value === "W4") return true;
    return c.color === state.color || c.value === top.value;
  }
  function nextIndex(state, steps) { const n = state.players.length; return (state.turn + state.direction * (steps || 1) % n + n) % n; }
  function newGame(players, random, rules) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 6) throw new Error("UNO 需要 2~6 人");
    const state = { id: "uno_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), players: players.map(p => ({ ...p, hand: [] })), deck: makeDeck(random), discard: [], color: null, turn: 0, direction: 1, pendingDraw: 0, drawnUid: null, round: 1, status: "playing", winner: null, rules: { stackD2: !!(rules && rules.stackD2) }, log: [] };
    state.players.forEach(p => draw(state, p, 7, random));
    let first = state.deck.findIndex(c => /^[0-9]$/.test(c.value)); if (first < 0) first = 0;
    state.discard.push(state.deck.splice(first, 1)[0]); state.color = state.discard[0].color;
    state.log.push({ kind: "start", text: "开局，每人 7 张；首牌 " + describe(state.discard[0]) });
    return state;
  }
  function describe(c) { return !c ? "" : (c.color === "W" ? LABEL[c.value] : LABEL[c.color] + (LABEL[c.value] || c.value)); }
  function withSay(note, action) {
    const line = String(action && action.say || "").trim().slice(0, 100);
    return line ? note + " · “" + line + "”" : note;
  }
  function legalCodes(state) { const p = state.players[state.turn]; return p.hand.filter(c => playable(c, state, p.hand)).map(c => c.code); }
  function act(state, action, random) {
    if (!state || state.status !== "playing") throw new Error("牌局已经结束");
    const p = state.players[state.turn], a = action || {};
    if (state.pendingDraw > 0) {
      if (a.kind === "play" && state.rules && state.rules.stackD2) {
        const idx = p.hand.findIndex(c => c.uid === a.uid || c.code === a.code), top = state.discard[state.discard.length - 1];
        if (idx < 0) throw new Error("手里没有这张牌");
        const c = p.hand[idx];
        if (!top || top.value !== "D2" || c.value !== "D2") throw new Error("罚牌中只能用 +2 继续叠加");
        p.hand.splice(idx, 1); state.discard.push(c); state.color = c.color; state.pendingDraw += 2; state.drawnUid = null;
        let note = p.name + " 叠加 " + describe(c) + "，累计 +" + state.pendingDraw;
        if (p.hand.length === 1 && !a.uno) { draw(state, p, 2, random); note += "；忘喊 UNO，罚摸 2 张"; }
        note = withSay(note, a); state.log.push({ kind: "play", player: p.key, text: note, code: c.code, delegated: !!a.delegated });
        if (!p.hand.length) { state.status = "finished"; state.winner = p.key; state.log.push({ kind: "finish", player: p.key, text: p.name + " 赢了！" }); return state; }
        state.turn = nextIndex(state); state.round++; return state;
      }
      if (a.kind === "challenge") {
        const top = state.discard[state.discard.length - 1];
        if (!state.w4 || !top || top.value !== "W4") throw new Error("现在没有可质疑的 +4");
        const culprit = state.players.find(x => x.key === state.w4.by);
        if (state.w4.illegal && culprit) {
          draw(state, culprit, 4, random);
          state.log.push({ kind: "challenge", player: p.key, text: withSay(p.name + " 质疑 +4——抓到了！" + culprit.name + " 手里其实还有" + (LABEL[state.w4.color] || "同色") + "牌，改由 TA 罚摸 4 张；" + p.name + " 不用摸，照常出牌", a) });
          state.pendingDraw = 0; state.drawnUid = null; state.w4 = null;
          return state; // 轮次不动：质疑成功的这一家接着正常出牌
        }
        draw(state, p, state.pendingDraw + 2, random);
        state.log.push({ kind: "challenge", player: p.key, text: withSay(p.name + " 质疑 +4——那张打得合规，罚摸 " + (state.pendingDraw + 2) + " 张", a) });
        state.pendingDraw = 0; state.drawnUid = null; state.w4 = null;
        state.turn = nextIndex(state); state.round++; return state;
      }
      if (a.kind === "play") throw new Error("官方规则不能叠加 +2");
      const n = state.pendingDraw; draw(state, p, n, random); state.pendingDraw = 0; state.drawnUid = null; state.w4 = null;
      state.log.push({ kind: "draw", player: p.key, text: withSay(p.name + " 摸 " + n + " 张", a) }); state.turn = nextIndex(state); state.round++; return state;
    }
    if (a.kind === "draw") {
      if (state.drawnUid) throw new Error("已经摸过牌了");
      const got = draw(state, p, 1, random); const c = got[0];
      state.log.push({ kind: "draw", player: p.key, text: withSay(p.name + " 摸 1 张", a) });
      if (c && playable(c, state, p.hand)) { state.drawnUid = c.uid; return state; }
      state.turn = nextIndex(state); state.round++; return state;
    }
    if (a.kind === "pass" && state.drawnUid) { state.log.push({ kind: "pass", player: p.key, text: withSay(p.name + " 不出", a) }); state.drawnUid = null; state.turn = nextIndex(state); state.round++; return state; }
    if (a.kind !== "play") throw new Error("无效动作");
    // 摸牌后只能认刚摸到的实体牌；同 code 的旧牌不能抢先被命中。
    const idx = state.drawnUid
      ? p.hand.findIndex(c => c.uid === state.drawnUid && (!a.uid || c.uid === a.uid) && (!a.code || c.code === a.code))
      : p.hand.findIndex(c => c.uid === a.uid || c.code === a.code);
    if (idx < 0) throw new Error("手里没有这张牌");
    const c = p.hand[idx];
    if (state.drawnUid && c.uid !== state.drawnUid) throw new Error("摸牌后只能打刚摸的那张");
    if (!playable(c, state, p.hand)) throw new Error("这张现在不能出");
    if (c.color === "W" && !COLORS.includes(a.color)) throw new Error("万能牌要选颜色");
    const priorColor = state.color;
    p.hand.splice(idx, 1); state.discard.push(c); state.color = c.color === "W" ? a.color : c.color; state.drawnUid = null;
    let note = p.name + " 出 " + describe(c) + (c.color === "W" ? "，改成" + LABEL[state.color] : "");
    if (p.hand.length === 1 && !a.uno) { draw(state, p, 2, random); note += "；忘喊 UNO，罚摸 2 张"; }
    note = withSay(note, a);
    state.log.push({ kind: "play", player: p.key, text: note, code: c.code, delegated: !!a.delegated });
    if (!p.hand.length) { state.status = "finished"; state.winner = p.key; state.log.push({ kind: "finish", player: p.key, text: p.name + " 赢了！" }); return state; }
    let steps = 1;
    if (c.value === "S") steps = 2;
    if (c.value === "V") { state.direction *= -1; if (state.players.length === 2) steps = 2; }
    if (c.value === "D2") state.pendingDraw = 2;
    if (c.value === "W4") { state.pendingDraw = 4; state.w4 = { by: p.key, illegal: p.hand.some(x => x.color === priorColor), color: priorColor }; }
    state.turn = nextIndex(state, steps); state.round++; return state;
  }
  return { COLORS, LABEL, makeDeck, newGame, playable, legalCodes, act, describe };
});
