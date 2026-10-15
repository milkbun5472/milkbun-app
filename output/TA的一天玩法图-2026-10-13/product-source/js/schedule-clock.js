(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScheduleClock = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
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
  const epoch = value => value == null || !Number.isFinite(Number(value)) ? Date.now() : Number(value);
  const localDate = (char, nowMs, deviceOffsetMinutes) => new Date(epoch(nowMs) + offsetMinutes(char, deviceOffsetMinutes) * 60000);
  const dayKey = (char, nowMs, deviceOffsetMinutes) => {
    const d = localDate(char, nowMs, deviceOffsetMinutes);
    return formatDayParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const localMinute = (char, nowMs, deviceOffsetMinutes) => {
    const d = localDate(char, nowMs, deviceOffsetMinutes);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  // Opt in for scene readers. The schedule writer and calendar keep their
  // existing real-day buckets; virtual time only projects this viewer.
  const characterFrame = (char, nowMs, { followVirtual = true, deviceOffset } = {}) => {
    const realAt = epoch(nowMs);
    let config = null, displayAt = realAt;
    try {
      config = root?.vclockCfg?.(char?.id) || null;
      const mapped = config && root?.vclockMap?.(realAt, char?.id);
      if (config && Number.isFinite(mapped)) displayAt = mapped;
      else config = null;
    } catch (_) { config = null; }
    const virtual = !!config, at = virtual && followVirtual ? displayAt : realAt;
    const heldAt = config?.awayAt ? Number(config.awayAt) : Number(config?.speed) === 0 && config?.at != null ? Number(config.at) : null;
    const archiveAt = virtual && followVirtual && Number.isFinite(heldAt) && heldAt <= realAt ? heldAt : realAt;
    // A character's explicit zone stays fixed. The device's zone follows the
    // displayed date's daylight-saving offset when a clock jumps seasons.
    const displayOffset=offsetMinutes(char,deviceOffset??-new Date(displayAt).getTimezoneOffset());
    const sourceOffset=offsetMinutes(char,deviceOffset??-new Date(archiveAt).getTimezoneOffset());
    return { realAt, at, displayAt, virtual, offset:virtual&&followVirtual?displayOffset:sourceOffset,
      paused:virtual && (!!config.awayAt || Number(config.speed) === 0), followVirtual:virtual && followVirtual,
      sourceDay:dayKey(char, archiveAt, sourceOffset), day:dayKey(char, displayAt, displayOffset),
      minute:localMinute(char, displayAt, displayOffset) };
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
  // Correcting a later phase must not make the current interval a new event.
  // The live phase's effective anchor is already part of the scene activity.
  const intervalWorld = world => !world||typeof world!=="object" ? world : Object.fromEntries(Object.keys(world).sort().map(key=>[key,
    key!=="stages"||!Array.isArray(world.stages)?world[key]:world.stages.map(stage=>!stage||typeof stage!=="object"?stage:Object.fromEntries(Object.keys(stage).filter(k=>k!=="override").sort().map(k=>[k,stage[k]])))
  ]));
  // One current interval for schedule scenes. Readers supply the existing end/sleep helpers.
  const currentSlot = (char, plans, now, deviceOffset, { fillEnds = x => x, sleepCarry, planDay } = {}) => {
    if (!char) return null;
    const at = now == null ? Date.now() : Number(now), day = dayKey(char, at, deviceOffset);
    const sourceDay = typeof planDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(planDay) ? planDay : day;
    const plan = (plans || {})[sourceDay], seqs = fillEnds(Array.isArray(plan?.seqs) ? plan.seqs : []);
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
      const carry = sleepCarry?.((plans || {})[shiftDayKey(sourceDay, -1)], plan);
      if (!carry || minute < carry.from || minute >= carry.to) return null;
      cur = { ...carry, time: pad2(Math.floor(carry.from / 60)) + ":" + pad2(carry.from % 60), end: pad2(Math.floor(carry.to / 60)) + ":" + pad2(carry.to % 60) };
      startAt = midnight + carry.from * 60000; endAt = midnight + carry.to * 60000;
    }
    if (!String(cur?.title || "").trim()) return null;
    const scene = { charId: String(char.id), name: char.name, day, sourceDay: cur.carry ? shiftDayKey(sourceDay, -1) : sourceDay, seq: cur.seq, time: cur.time, end: cur.end, title: cur.title,
      location: cur.location || "", place: cur.place || "", type: cur.type || "other", world: cur.world || null, deviation: cur.deviation || null, startAt, endAt, carry: !!cur.carry };
    // Old prose becomes a structured chain on its first phase correction.
    // Compare the automatic chain in either form, so that materialization is
    // not a new event and cannot cancel the current interaction.
    const stages=root?.CharDayLink?.stagesFor?.(scene) || [];
    const linkedWorld=stages.length?intervalWorld({stages}):intervalWorld(scene.world);
    const deviation=scene.deviation?{...scene.deviation,...(stages.length?{world:linkedWorld}:scene.deviation.world?{world:intervalWorld(scene.deviation.world)}:{})}:scene.deviation;
    scene.key = JSON.stringify([scene.charId, day, startAt, endAt, scene.title, scene.location, linkedWorld, deviation]);
    if (sourceDay !== day) scene.key = JSON.stringify([scene.key, sourceDay]);
    return scene;
  };
  return { formatDayParts, deviceDayKey, parseDayKey, offsetMinutes, dayKey, localMinute, characterFrame, shiftDayKey, currentSeqIdx, currentSlot };
});
