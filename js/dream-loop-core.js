// ============================================================
// 内在生活系统 D · 步骤 1：梦回路纯核（零 API、零 IO、可单测）
// 合同 inner_life_D_dream_loop_design.md：梦=四线消化产物。
// 拍板（2026-07-18 Lisa）：1B 情绪阈值制（不掷骰子，决定论）。
// 铁律：材料包只存引用+hash 绝不复制正文；一夜一梦幂等；梦≠记忆。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof window !== "undefined") window.DreamLoopCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(this, function () {
  "use strict";
  const REM_DELAY_MS = 90 * 60000;      // 入睡后 90 分钟进第一个 REM 窗
  const DREAM_INTENSITY_MIN = 0.45;     // 1B：当日情绪强度达标才做梦
  const MAX_REFS = 40;

  function hash(s) {
    let h = 5381; const str = String(s == null ? "" : s);
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // 夜键：以「入睡那晚的日期」为准（凌晨入睡归前一晚）
  function nightKeyOf(sleepStartTs, utcOffsetMinutes) {
    const t = new Date(Number(sleepStartTs) + (Number(utcOffsetMinutes) || 0) * 60000);
    const d = new Date(t.getTime());
    if (d.getUTCHours() < 6) d.setUTCDate(d.getUTCDate() - 1); // 凌晨0-6点入睡算前一晚
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }

  // 材料包：只收引用与哈希，绝不携带正文。
  // chatItems: [{id, content}]（content 只用于就地哈希，不出函数）
  // emotionCurrent: A线十维当前值；relationActiveAxes: B线 active 轴名数组；
  // afterglowLevel: 0~1；calendarEvents: [{kind,label}]（label 允许，属公开日历词）
  function buildMaterial(input) {
    const src = input || {};
    const refs = [];
    (Array.isArray(src.chatItems) ? src.chatItems : []).slice(-MAX_REFS).forEach(m => {
      if (m && m.id != null) refs.push({ kind: "chat", refId: String(m.id), hash: hash(m.content) });
    });
    (Array.isArray(src.calendarEvents) ? src.calendarEvents : []).slice(0, 4).forEach(ev => {
      if (ev && ev.label) refs.push({ kind: "calendar", refId: String(ev.kind || "event"), hash: hash(ev.label), label: String(ev.label).slice(0, 24) });
    });
    const emo = src.emotionCurrent && typeof src.emotionCurrent === "object" ? src.emotionCurrent : {};
    const peaks = Object.entries(emo)
      .map(([k, v]) => ({ axis: k, value: Number(v) || 0 }))
      .filter(p => Math.abs(p.value) >= 0.25)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);
    const relation = (Array.isArray(src.relationActiveAxes) ? src.relationActiveAxes : []).filter(x => typeof x === "string").slice(0, 6);
    const afterglow = Math.max(0, Math.min(1, Number(src.afterglowLevel) || 0));
    // 强度 = 情绪峰值绝对值最大者 + 关系轴активность加成 + 余温微量（封顶 1）
    const peakMax = peaks.length ? Math.abs(peaks[0].value) : 0;
    const intensity = Math.min(1, Math.round((peakMax + relation.length * 0.15 + afterglow * 0.1) * 100) / 100);
    return { refs, peaks, relationActiveAxes: relation, afterglowLevel: afterglow, intensity, chatCount: refs.filter(r => r.kind === "chat").length };
  }

  // 1B 情绪阈值制：强度不够或没有当日材料 → 无梦之夜（这也是信号，不是缺陷）
  function shouldDream(material, opts) {
    const m = material || {}, o = opts || {};
    const min = Number.isFinite(Number(o.intensityMin)) ? Number(o.intensityMin) : DREAM_INTENSITY_MIN;
    if (!m.chatCount) return { dream: false, reason: "no_material" };
    if ((Number(m.intensity) || 0) < min) return { dream: false, reason: "calm_night" };
    return { dream: true, reason: "intensity_met" };
  }

  // REM 窗判定：睡着 + 入睡满 90 分钟。不含幂等（幂等由队列按 nightKey 保证）。
  function remDue(sleepState, now) {
    const s = sleepState || {};
    if (s.phase !== "asleep" || !Number.isFinite(Number(s.sleepStartTs))) return false;
    return (Number(now) - Number(s.sleepStartTs)) >= REM_DELAY_MS;
  }

  // 队列幂等键：一角色一夜最多一场梦
  const dreamKey = (charId, nightKey) => hash(String(charId)) + "|" + String(nightKey);

  return Object.freeze({ REM_DELAY_MS, DREAM_INTENSITY_MIN, hash, nightKeyOf, buildMaterial, shouldDream, remDue, dreamKey });
});
