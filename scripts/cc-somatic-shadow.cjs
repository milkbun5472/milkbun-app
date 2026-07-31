"use strict";
const { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, appendFileSync } = require("node:fs");
const { join } = require("node:path");
const Core = require("../js/somatic-core.js");

function atomicJSON(path, value) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}
function observeTurn(projectDir, turn) {
  const dir = join(projectDir, ".claude", "cc-somatic-state");
  const statePath = join(dir, "state.json"), contextPath = join(dir, "context.json"), diagPath = join(dir, "diagnostic.jsonl");
  mkdirSync(dir, { recursive: true });
  const log = value => appendFileSync(diagPath, JSON.stringify({ at: new Date().toISOString(), ...value }) + "\n");
  try {
    if (!turn || !turn.turnId || !turn.lisaText) throw new Error("complete visible turn missing");
    let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : Core.createState("yanqiu", Date.now());
    if (state.lastTurnId === turn.turnId) return { duplicate: true };
    const events = Core.detect({ text: turn.lisaText, role: "user", mode: "symbolic", source: "cc" });
    const now = Date.now();
    events.forEach(event => { state = Core.ignite(state, event, now); });
    state = { ...Core.decayState(state, now), lastTurnId: turn.turnId };
    const snap = Core.snapshot(state, now);
    atomicJSON(statePath, state);
    atomicJSON(contextPath, { schemaVersion: 1, phase: "shadow", updatedAt: now, active: snap.active, count: snap.count });
    log({ turnId: turn.turnId, textHash: hash(turn.lisaText), textLength: turn.lisaText.length, eventCodes: events.map(e => e.labelCode), activeChannels: Object.keys(snap.active), shadowOnly: true });
    return { events, snapshot: snap, shadowOnly: true };
  } catch (error) {
    log({ outcome: "ignored", error: String(error && error.message || error).slice(0, 160), shadowOnly: true });
    return { error: true, shadowOnly: true };
  }
}
module.exports = { observeTurn };
