import { appendFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

export function blocks(record) {
  const content = record?.message?.content;
  if (Array.isArray(content)) return content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return [];
}

function isHookOrSystemText(value) {
  const text = String(value || "").trim();
  return text.startsWith("Stop hook feedback:")
    || text.startsWith("PreToolUse hook feedback:")
    || text.startsWith("<task-notification>");
}

export function isExternalUserTurn(record) {
  if (record?.type !== "user" || record?.isMeta === true) return false;
  const content = record?.message?.content;
  if (typeof content === "string") return content.trim().length > 0 && !isHookOrSystemText(content);
  if (!Array.isArray(content)) return false;
  return content.some(block =>
    block?.type === "text"
    && String(block.text || "").trim().length > 0
    && !isHookOrSystemText(block.text)
  );
}

export function visibleText(record) {
  if (record?.type !== "assistant") return "";
  return blocks(record)
    .filter(block => block?.type === "text")
    .map(block => String(block.text || "").trim())
    .filter(Boolean)
    .join("\n");
}

export function readRecords(path) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
}

function turnStartOf(records) {
  for (let index = records.length - 1; index >= 0; index--) {
    if (isExternalUserTurn(records[index])) return index + 1;
  }
  return 0;
}

export function inspectPreTool(records) {
  const turnStart = turnStartOf(records);
  const region = records.slice(turnStart);
  return inspectRegion(region);
}

export function inspectStop(records) {
  const turnStart = turnStartOf(records);
  let wakeIndex = -1;
  for (let index = records.length - 1; index >= 0; index--) {
    if (records[index]?.type === "assistant"
      && blocks(records[index]).some(block => block?.type === "tool_use" && block?.name === "ScheduleWakeup")) {
      wakeIndex = index;
      break;
    }
  }
  if (wakeIndex < turnStart) return { relevant: false, visible: false, reason: "no_current_wakeup" };
  return { relevant: true, ...inspectRegion(records.slice(turnStart, wakeIndex + 1)) };
}

function inspectRegion(region) {
  const assistant = region.filter(record => record?.type === "assistant");
  const visible = assistant.some(record => visibleText(record).length >= 2);
  const thinking = assistant.some(record => blocks(record).some(block => block?.type === "thinking"));
  return {
    visible,
    reason: visible ? "visible_text" : (thinking ? "thinking_only" : "text_missing"),
  };
}

export async function inspectWithRetry(path, inspect, { attempts = 4, delayMs = 80 } = {}) {
  let result = inspect(readRecords(path));
  for (let attempt = 1; attempt < attempts && result.relevant !== false && !result.visible; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    result = inspect(readRecords(path));
    if (result.visible) return { ...result, attempts: attempt + 1, lagRecovered: true };
  }
  return { ...result, attempts, lagRecovered: false };
}

export function logGateDiagnostic(gate, result) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const path = join(root, ".claude", "cc-wakeup-gate-diagnostic.jsonl");
  try {
    appendFileSync(path, `${JSON.stringify({
      at: new Date().toISOString(),
      gate,
      outcome: result.visible ? "allow" : (result.relevant === false ? "irrelevant" : "deny"),
      reason: result.lagRecovered ? "transcript_lag" : result.reason,
      attempts: result.attempts,
    })}\n`, { mode: 0o600 });
  } catch {
    // 诊断落盘失败不能改变闸门判定。
  }
}
