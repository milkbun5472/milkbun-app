(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScheduleClock = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const pad2 = n => String(n).padStart(2, "0");
  // m0 从 0 起算。日历/经期旧桶保留不补零的键；行程和事件日期使用补零键。
  const formatDayParts = (year, m0, day, legacy) => year + "-"
    + (legacy ? m0 + 1 : pad2(m0 + 1)) + "-" + (legacy ? day : pad2(day));
  const deviceDayKey = (date, legacy) => formatDayParts(date.getFullYear(), date.getMonth(), date.getDate(), legacy);
  const parseDayKey = key => {
    const parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const offsetMinutes = (char, deviceOffsetMinutes) => {
    const raw = char && char.tz;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const hours = Number.parseFloat(raw);
      if (Number.isFinite(hours)) return Math.round(hours * 60);
    }
    return Number.isFinite(Number(deviceOffsetMinutes)) ? Number(deviceOffsetMinutes) : -new Date().getTimezoneOffset();
  };
  const localDate = (char, nowMs, deviceOffsetMinutes) => new Date((Number(nowMs) || Date.now()) + offsetMinutes(char, deviceOffsetMinutes) * 60000);
  const dayKey = (char, nowMs, deviceOffsetMinutes) => {
    const d = localDate(char, nowMs, deviceOffsetMinutes);
    return formatDayParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const localMinute = (char, nowMs, deviceOffsetMinutes) => {
    const d = localDate(char, nowMs, deviceOffsetMinutes);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  const shiftDayKey = (key, days) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return key;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + Number(days || 0)));
    return formatDayParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const currentSeqIdx = (seqs, minute) => {
    let idx = -1, previous = -1, dayOffset = 0;
    (seqs || []).forEach((s, i) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s && (s._charTime || s.time) || "").trim());
      if (!m) return;
      const base = +m[1] * 60 + +m[2];
      if (previous >= 0 && base < previous && previous - base > 720) dayOffset++;
      if (base > previous || previous - base > 720) previous = base;
      const target = base + dayOffset * 1440;
      // 角色当地凌晨仍属于前一张生活时间线的跨午夜尾段。
      const nowOnTimeline = Number(minute) + (dayOffset > 0 && Number(minute) < 720 ? 1440 : 0);
      if (target <= nowOnTimeline) idx = i;
    });
    return idx;
  };
  return { formatDayParts, deviceDayKey, parseDayKey, offsetMinutes, dayKey, localMinute, shiftDayKey, currentSeqIdx };
});
