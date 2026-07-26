'use strict';
// 三方会客厅 · CC 会话定位（Step 2）
// local_<id>(MCP session_id) → 桌面指针 json(cliSessionId) → 项目 transcript 路径。
// 与 probe-0 报告 §1.1 的映射链一致。纯只读，不投递。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_APP_SUPPORT = path.join(os.homedir(), 'Library/Application Support/Claude/claude-code-sessions');

// 递归找 <ccSessionId>.json（桌面指针文件层级为 <ws>/<sub>/local_*.json）
function findPointer(dir, fileName) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const hit = findPointer(full, fileName); if (hit) return hit; }
    else if (e.name === fileName) return full;
  }
  return null;
}

// 返回 { cliSessionId, transcriptPath, completedTurns, lastActivityAt, isArchived, title }
function resolvePointer(ccSessionId, { appSupportDir = DEFAULT_APP_SUPPORT, projectDir } = {}) {
  if (!projectDir) throw new Error('resolvePointer 需要 projectDir(<uuid>.jsonl 所在项目目录)');
  const hit = findPointer(appSupportDir, `${ccSessionId}.json`);
  if (!hit) throw new Error(`未找到会话指针: ${ccSessionId}`);
  const meta = JSON.parse(fs.readFileSync(hit, 'utf8'));
  if (!meta.cliSessionId) throw new Error(`指针缺 cliSessionId: ${ccSessionId}`);
  return {
    cliSessionId: meta.cliSessionId,
    transcriptPath: path.join(projectDir, `${meta.cliSessionId}.jsonl`),
    completedTurns: meta.completedTurns,
    lastActivityAt: meta.lastActivityAt,
    isArchived: !!meta.isArchived,
    title: meta.title,
    pointerPath: hit,
  };
}

module.exports = { resolvePointer, findPointer, DEFAULT_APP_SUPPORT };
