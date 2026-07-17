// 内在生活系统 E · 潮汐纯逻辑（DORMANT）
// 第 1 步只供固定时钟单测；未接入 index.html、消息入口、prompt 或主动出口。
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InnerLifeETidalCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATES = Object.freeze(["awake", "maybe_sleeping", "uncertain"]);
  const EVENTS = Object.freeze({
    SLEEP_SIGNAL: "SLEEP_SIGNAL",
    WAKE_SIGNAL: "WAKE_SIGNAL",
    USER_TYPED_MESSAGE: "USER_TYPED_MESSAGE",
    SESSION_OPEN_NO_MESSAGE: "SESSION_OPEN_NO_MESSAGE",
    FOREGROUND_TICK_NO_MESSAGE: "FOREGROUND_TICK_NO_MESSAGE"
  });
  const SLEEP_WINDOW_MS = 90 * 60 * 1000;

  const SLEEP_RULES = Object.freeze([
    ["sleep_goodnight", /(?:晚安|先睡啦|先睡了|去睡啦|去睡了|我睡啦|我睡了|要睡啦|要睡了)/],
    ["sleep_nap", /(?:睡一会(?:儿)?|眯一会(?:儿)?|补个觉|去午睡|睡个午觉)/],
    ["sleep_lie_down", /(?:躺下睡|躺着睡|准备睡|该睡觉了)/]
  ]);
  const WAKE_RULES = Object.freeze([
    ["wake_up", /(?:我醒了|醒啦|醒了|睡醒了|起床了|起来了)/],
    ["wake_morning", /(?:早安|早上好)/]
  ]);
  const SLEEP_NEGATIONS = Object.freeze([
    /(?:没睡|没有睡|还没睡|不睡|别睡|不能睡|睡不着|不想睡|不用睡|不困)/
  ]);

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s，。！？、,.!?~～…：:；;“”‘’'"（）()【】\[\]]+/g, "");
  }

  function matchRule(text, rules) {
    for (const pair of rules) if (pair[1].test(text)) return pair[0];
    return null;
  }

  function classifyTidalMessage(value) {
    const normalized = normalizeText(value);
    if (!normalized) return { event: null, rule: "empty", normalized: "" };
    const wakeRule = matchRule(normalized, WAKE_RULES);
    if (wakeRule) return { event: EVENTS.WAKE_SIGNAL, rule: wakeRule, normalized };
    const sleepNegated = SLEEP_NEGATIONS.some(rule => rule.test(normalized));
    const sleepRule = sleepNegated ? null : matchRule(normalized, SLEEP_RULES);
    if (sleepRule) return { event: EVENTS.SLEEP_SIGNAL, rule: sleepRule, normalized };
    return { event: EVENTS.USER_TYPED_MESSAGE, rule: sleepNegated ? "sleep_negated" : "ordinary_message", normalized };
  }

  function safePrevious(previous, now) {
    if (!previous || !STATES.includes(previous.state)) {
      return { state: "awake", signalTs: null, signalKind: "boot", transitionReason: "default_awake", updatedTs: now };
    }
    return {
      state: previous.state,
      signalTs: Number.isFinite(previous.signalTs) ? previous.signalTs : null,
      signalKind: previous.signalKind || "boot",
      transitionReason: previous.transitionReason || "",
      updatedTs: Number.isFinite(previous.updatedTs) ? previous.updatedTs : now
    };
  }

  function reduceTidal(previous, event, nowValue) {
    const now = Number(nowValue);
    const safeNow = Number.isFinite(now) ? now : Date.now();
    const prev = safePrevious(previous, safeNow);
    try {
      let state = prev.state, signalTs = prev.signalTs, signalKind = prev.signalKind, reason = null;
      if (event === EVENTS.SLEEP_SIGNAL) {
        state = "maybe_sleeping"; signalTs = safeNow; signalKind = "sleep"; reason = "explicit_sleep_signal";
      } else if (event === EVENTS.WAKE_SIGNAL) {
        state = "awake"; signalTs = null; signalKind = "wake"; reason = "explicit_wake_signal";
      } else if (event === EVENTS.USER_TYPED_MESSAGE) {
        state = "awake"; signalTs = null; signalKind = "typed_message"; reason = "user_typed_message";
      } else if (event === EVENTS.SESSION_OPEN_NO_MESSAGE || event === EVENTS.FOREGROUND_TICK_NO_MESSAGE) {
        if (state === "maybe_sleeping" && signalTs != null && safeNow - signalTs > SLEEP_WINDOW_MS) {
          state = "uncertain"; signalKind = "timeout"; reason = "sleep_window_elapsed";
        }
      } else {
        return { next: prev, transition: null };
      }
      const next = { state, signalTs, signalKind, transitionReason: reason || prev.transitionReason, updatedTs: safeNow };
      const changed = state !== prev.state || signalTs !== prev.signalTs || signalKind !== prev.signalKind;
      return { next, transition: changed ? { from: prev.state, to: state, reason: next.transitionReason, at: safeNow } : null };
    } catch (_) {
      return { next: prev, transition: null };
    }
  }

  return Object.freeze({ STATES, EVENTS, SLEEP_WINDOW_MS, normalizeText, classifyTidalMessage, reduceTidal });
});
