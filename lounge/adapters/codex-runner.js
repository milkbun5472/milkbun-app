'use strict';
// 官方 Codex CLI 运行器。无 shell、不扫 UI；stdout/stderr 都落本地单次 spool。
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_CODEX_CLI = '/Applications/ChatGPT.app/Contents/Resources/codex';

function createCodexCliRunner({ cliPath = process.env.CODEX_CLI_PATH || DEFAULT_CODEX_CLI } = {}) {
  return {
    cliPath,
    exists() { return fs.existsSync(cliPath); },
    async start({ threadId, prompt, spoolPath }) {
      fs.mkdirSync(path.dirname(spoolPath), { recursive: true, mode: 0o700 });
      const out = fs.openSync(spoolPath, 'a', 0o600);
      const child = spawn(cliPath, ['exec', 'resume', '--json', threadId, prompt], {
        stdio: ['ignore', out, out],
        detached: false,
        shell: false,
      });
      child.once('close', (code, signal) => {
        // stdout/stderr 完全关闭后追加本地监督事件，补足 CLI 未输出 turn.failed 的异常退出路径。
        try {
          fs.appendFileSync(spoolPath, `${JSON.stringify({
            type: 'process.exited', exit_code: code, signal: signal || null,
          })}\n`);
        } catch {}
      });
      return await new Promise((resolve, reject) => {
        child.once('spawn', () => {
          fs.closeSync(out);
          resolve({ pid: child.pid });
        });
        child.once('error', (e) => {
          try { fs.closeSync(out); } catch {}
          reject(e);
        });
      });
    },
  };
}

module.exports = { createCodexCliRunner, DEFAULT_CODEX_CLI };
