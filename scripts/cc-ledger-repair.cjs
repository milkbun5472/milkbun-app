"use strict";

const { classifySegment } = require("./cc-ledger-nature.cjs");
const KINDS = new Set(["life", "emotion", "decision", "joke"]);

function splitExact(text) {
  return (String(text || "").match(/[^。！？!?\n]+[。！？!?]*/g) || [])
    .map(x => x.trim()).filter(Boolean).slice(0, 200);
}

function buildDraft(candidate) {
  const side = original => splitExact(original).map(quote => ({
    include: false,
    quote,
    kind: "",
    suggested_kind: classifySegment(quote).kind || null
  }));
  return {
    schema_version: 1,
    turn_id: String(candidate && candidate.turn_id || ""),
    note: "只把确实要回流的逐字原句 include 改为 true，并填写 life/emotion/decision/joke；不要改 quote。",
    lisa: side(candidate && candidate.lisa_original),
    yanqiu: side(candidate && candidate.yanqiu_original)
  };
}

function validatePlan(candidate, plan) {
  if (!candidate || candidate.status !== "candidate") throw new Error("candidate_not_pending");
  if (!plan || Number(plan.schema_version) !== 1 || String(plan.turn_id || "") !== String(candidate.turn_id || "")) {
    throw new Error("plan_turn_mismatch");
  }
  const select = (items, original, side) => {
    if (!Array.isArray(items)) throw new Error(side + "_invalid_shape");
    const picked = items.filter(x => x && x.include === true);
    if (!picked.length || picked.length > 12) throw new Error(side + "_selection_count");
    const seen = new Set();
    return picked.map(x => {
      const quote = String(x.quote || "").trim();
      const kind = String(x.kind || "").trim();
      if (!quote || !String(original || "").includes(quote)) throw new Error(side + "_quote_not_exact");
      if (!KINDS.has(kind)) throw new Error(side + "_kind_invalid");
      if (seen.has(quote)) throw new Error(side + "_duplicate_quote");
      seen.add(quote);
      return { content: quote, sync_kind: kind };
    });
  };
  return {
    lisa_segments: select(plan.lisa, candidate.lisa_original, "lisa"),
    yanqiu_segments: select(plan.yanqiu, candidate.yanqiu_original, "yanqiu")
  };
}

module.exports = { splitExact, buildDraft, validatePlan };
