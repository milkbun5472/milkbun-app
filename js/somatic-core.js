(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SomaticCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = 1;
  const CHANNELS = Object.freeze({
    touch: { tauMs: 10 * 60 * 1000, threshold: 0.15 },
    smell: { tauMs: 20 * 60 * 1000, threshold: 0.15 },
    taste: { tauMs: 15 * 60 * 1000, threshold: 0.15 },
    sound: { tauMs: 7.5 * 60 * 1000, threshold: 0.15 }
  });
  const BODY = [
    ["头发|头顶|脑袋", "头顶", 0.8],
    ["脸|脸颊|面颊", "脸颊", 0.75],
    ["耳后|耳朵", "耳侧", 0.8],
    ["手腕", "手腕", 0.65],
    ["手心|掌心", "掌心", 0.65],
    ["手|手指", "手", 0.55],
    ["肩|肩膀", "肩膀", 0.5],
    ["后背|背", "后背", 0.45],
    ["腰", "腰侧", 0.55],
    ["脖子|颈", "颈侧", 0.75],
    ["额头", "额头", 0.65]
  ];
  const TOUCH = [
    ["抱住|抱了|拥抱|搂住|搂着", "被环抱着", 0.72],
    ["摸摸|摸了|摸着|揉揉|揉了|揉着", "被轻轻揉过", 0.58],
    ["捏捏|捏了|捏着", "被指尖捏过", 0.56],
    ["亲了|亲亲|吻了|吻住", "被柔软地碰过", 0.7],
    ["牵住|牵着|握住|握着", "被稳稳握着", 0.52],
    ["拍拍|拍了|拍着", "被轻轻拍过", 0.4],
    ["戳了|戳戳|蹭了|蹭蹭", "被短促地碰过", 0.38],
    ["靠在|贴着", "感到贴近的重量", 0.45]
  ];
  const NEGATION = /(?:没|没有|别|不要|不准|不能|并未|从未|差点|险些|想要|想|准备|打算|如果|假如|要是).{0,5}$/;
  const QUOTED = /^[“"'「『].*[”"'」』]$/s;

  const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
  const freshChannel = () => ({ value: 0, label: "", labelCode: "", entity: "", at: 0, source: "", mode: "" });
  function createState(charId, now) {
    return {
      schemaVersion: VERSION,
      charId: String(charId || ""),
      updatedAt: Number(now) || Date.now(),
      channels: { touch: freshChannel(), smell: freshChannel(), taste: freshChannel(), sound: freshChannel() }
    };
  }
  function decayValue(value, at, now, tauMs) {
    const elapsed = Math.max(0, (Number(now) || 0) - (Number(at) || 0));
    return clamp(value) * Math.exp(-elapsed / tauMs);
  }
  function decayState(input, now) {
    const base = input && input.channels ? input : createState(input && input.charId, now);
    const channels = {};
    Object.keys(CHANNELS).forEach(key => {
      const old = base.channels[key] || freshChannel();
      channels[key] = { ...old, value: decayValue(old.value, old.at, now, CHANNELS[key].tauMs), at: Number(now) || Date.now() };
    });
    return { ...base, updatedAt: Number(now) || Date.now(), channels };
  }
  function ignite(input, event, now) {
    if (!event || !CHANNELS[event.channel]) return decayState(input, now);
    const state = decayState(input, now), old = state.channels[event.channel];
    const delta = clamp(event.delta);
    const value = clamp(old.value + delta * (1 - old.value * 0.35));
    state.channels[event.channel] = {
      ...old,
      value,
      label: delta >= old.value * 0.35 || !old.label ? String(event.label || "") : old.label,
      labelCode: delta >= old.value * 0.35 || !old.labelCode ? String(event.labelCode || "") : old.labelCode,
      entity: event.entity ? String(event.entity) : old.entity,
      at: Number(now) || Date.now(),
      source: String(event.source || ""),
      mode: String(event.mode || "")
    };
    return state;
  }
  function snapshot(input, now) {
    const state = decayState(input, now), active = {};
    Object.keys(CHANNELS).forEach(key => {
      const row = state.channels[key];
      if (row.value >= CHANNELS[key].threshold) active[key] = { value: Math.round(row.value * 100) / 100, label: row.label, labelCode: row.labelCode, entity: row.entity, mode: row.mode };
    });
    return { state, active, count: Object.keys(active).length };
  }
  function clauseBefore(text, index) {
    return String(text || "").slice(Math.max(0, String(text || "").lastIndexOf("。", index - 1) + 1), index);
  }
  function blocked(text, index) {
    const before = clauseBefore(text, index).slice(-10);
    return NEGATION.test(before) || QUOTED.test(String(text || "").trim());
  }
  function sameClauseBody(text, start, end) {
    const clauseStart = Math.max(0, Math.max(text.lastIndexOf("，", start), text.lastIndexOf("。", start), text.lastIndexOf("\n", start)) + 1);
    const stops = [text.indexOf("，", end), text.indexOf("。", end), text.indexOf("\n", end)].filter(x => x >= 0);
    const clauseEnd = stops.length ? Math.min(...stops) : text.length;
    const clause = text.slice(clauseStart, clauseEnd);
    for (const [pattern, label, sensitivity] of BODY) {
      if (new RegExp(pattern).test(clause)) return { label, sensitivity };
    }
    return { label: "身上", sensitivity: 0.45 };
  }
  function cleanEntity(raw) {
    return String(raw || "").replace(/[“”"'「」『』，。！？、]/g, "").replace(/(?:的|味道|香味|气味|一股)$/g, "").trim().slice(0, 16);
  }
  function detectText(text, options) {
    const s = String(text || "").trim(), opts = options || {}, events = [];
    if (!s || opts.role === "assistant" || opts.kind === "ooc" || opts.kind === "system") return events;
    const mode = opts.mode === "physical" ? "physical" : "symbolic";
    const touchScale = mode === "physical" ? 1 : 0.32;
    for (const [pattern, contact, strength] of TOUCH) {
      const re = new RegExp(pattern), hit = re.exec(s);
      if (!hit || blocked(s, hit.index)) continue;
      if (/伸手|顺手|握手/.test(s.slice(Math.max(0, hit.index - 4), hit.index + hit[0].length + 4))) continue;
      const body = sameClauseBody(s, hit.index, hit.index + hit[0].length);
      events.push({ channel: "touch", delta: strength * body.sensitivity * touchScale, label: body.label + contact, labelCode: "touch:" + body.label, entity: body.label, mode, source: opts.source || "" });
      break;
    }
    // 嗅觉/味觉必须来自共同在场的线下事实。线上一句「我喝了粥」是 Lisa 的体验，
    // 不能让角色隔着屏幕也尝到；文字线上只保留象征触碰，真实语音另走 tone。
    const smell = mode === "physical" && /(?:闻到|闻着|闻见|嗅到|飘着)(?:一股|淡淡的|浓浓的)?([^，。！？]{1,16}?)(?:味道|香味|气味|味)?(?:[，。！？]|$)/.exec(s);
    if (smell && !blocked(s, smell.index)) {
      const entity = cleanEntity(smell[1]);
      if (entity) events.push({ channel: "smell", delta: mode === "physical" ? 0.46 : 0.2, label: "鼻尖还留着" + entity + "的气息", labelCode: "smell:present", entity, mode, source: opts.source || "" });
    }
    const taste = mode === "physical" && /(?:吃了|吃着|尝到|尝了|喝了|喝着|嘴里(?:还有|留着))([^，。！？]{1,16}?)(?:的味道|味|[，。！？]|$)/.exec(s);
    if (taste && !blocked(s, taste.index)) {
      const entity = cleanEntity(taste[1]);
      if (entity) events.push({ channel: "taste", delta: mode === "physical" ? 0.5 : 0.22, label: "舌尖还留着" + entity + "的味道", labelCode: "taste:present", entity, mode, source: opts.source || "" });
    }
    return events;
  }
  function detectTone(tone, options) {
    const observations = tone && Array.isArray(tone.observations) ? tone.observations.filter(Boolean) : [];
    if (!observations.length) return [];
    const safe = observations.slice(0, 2).join("、").slice(0, 50);
    return [{ channel: "sound", delta: 0.42, label: "耳边还留着她" + safe + "的声音", labelCode: "sound:prosody", entity: "", mode: "physical", source: options && options.source || "voice" }];
  }
  function detect(input) {
    const opts = input || {};
    return detectText(opts.text, opts).concat(detectTone(opts.tone, opts));
  }

  return { VERSION, CHANNELS, createState, decayValue, decayState, ignite, snapshot, detect, detectText, detectTone, cleanEntity };
});
