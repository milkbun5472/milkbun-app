(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SomaticReviewCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function summarize(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let samples = 0, events = 0, ccReplaySamples = 0;
    const sources = {}, channels = {};
    list.forEach(item => {
      const report = item && item.report || {};
      samples += Number(report.sampleCount) || 0;
      Object.entries(report.surfaces || {}).forEach(([key, value]) => {
        sources[key] = (sources[key] || 0) + (Number(value) || 0);
        if (key === "cc_ledger") ccReplaySamples += Number(value) || 0;
      });
      Object.entries(report.eventCounts || {}).forEach(([key, value]) => {
        channels[key] = (channels[key] || 0) + (Number(value) || 0);
        events += Number(value) || 0;
      });
    });
    const warnings = [];
    if (samples < 10) warnings.push({ code: "insufficient_samples", severity: "info", value: samples });
    if (samples >= 20 && events === 0) warnings.push({ code: "no_detected_events", severity: "warning", value: samples });
    const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
    if (samples >= 10 && topSource && topSource[1] / samples > 0.85) {
      warnings.push({ code: "single_source_dominance", severity: "info", source: topSource[0], ratio: Math.round(topSource[1] / samples * 100) / 100 });
    }
    return {
      sampleCount: samples, eventCount: events, characterCount: list.length,
      sources, channels, ccReplaySamples, warnings,
      enoughForHumanReview: samples >= 10 && !warnings.some(x => x.severity === "warning"),
      automaticPromotionAllowed: false
    };
  }

  return { summarize };
});
