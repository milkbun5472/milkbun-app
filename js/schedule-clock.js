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
  // One current interval for schedule scenes. Readers supply the existing end/sleep helpers.
  const currentSlot = (char, plans, now, deviceOffset, { fillEnds = x => x, sleepCarry } = {}) => {
    if (!char) return null;
    const at = now == null ? Date.now() : Number(now), day = dayKey(char, at, deviceOffset);
    const plan = (plans || {})[day], seqs = fillEnds(Array.isArray(plan?.seqs) ? plan.seqs : []);
    const minute = localMinute(char, at, deviceOffset), index = currentSeqIdx(seqs, minute);
    const toMin = value => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "")); return m && +m[1] <= 24 && +m[2] < 60 && (+m[1] < 24 || +m[2] === 0) ? +m[1] * 60 + +m[2] : NaN; };
    const date = day.split("-").map(Number), midnight = Date.UTC(date[0], date[1] - 1, date[2]) - offsetMinutes(char, deviceOffset) * 60000;
    let cur = seqs[index], wraps = 0, previous = -1, startAt, endAt;
    if (cur) {
      for (let i = 0; i <= index; i++) { const m = toMin(seqs[i]?.time); if (previous >= 0 && previous - m > 720) wraps++; previous = m; }
      const start = toMin(cur.time), end = toMin(cur.end);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        startAt = midnight + (start + wraps * 1440) * 60000;
        if (startAt > at && wraps && minute < 720) startAt -= 86400000;
        endAt = startAt + ((end <= start ? end + 1440 : end) - start) * 60000;
      }
    }
    if (!(at >= startAt && at < endAt)) {
      const carry = sleepCarry?.((plans || {})[shiftDayKey(day, -1)], plan);
      if (!carry || minute < carry.from || minute >= carry.to) return null;
      cur = { ...carry, time: pad2(Math.floor(carry.from / 60)) + ":" + pad2(carry.from % 60), end: pad2(Math.floor(carry.to / 60)) + ":" + pad2(carry.to % 60) };
      startAt = midnight + carry.from * 60000; endAt = midnight + carry.to * 60000;
    }
    if (!String(cur?.title || "").trim()) return null;
    const scene = { charId: String(char.id), name: char.name, day, time: cur.time, end: cur.end, title: cur.title,
      location: cur.location || "", place: cur.place || "", type: cur.type || "other", world: cur.world || null, deviation: cur.deviation || null, startAt, endAt, carry: !!cur.carry };
    scene.key = JSON.stringify([scene.charId, day, startAt, endAt, scene.title, scene.location, scene.world, scene.deviation]);
    return scene;
  };
  return { formatDayParts, deviceDayKey, parseDayKey, offsetMinutes, dayKey, localMinute, shiftDayKey, currentSeqIdx, currentSlot };
});
