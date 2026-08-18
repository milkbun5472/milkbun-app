'use strict';

const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');

const DEFAULT_SSH = '/usr/bin/ssh';
const DEFAULT_REMOTE_SUBMIT = '/home/ubuntu/services/codex/bin/codex-lounge-submit.py';

function event(type, extra = {}) { return `${JSON.stringify({ type, ...extra })}\n`; }

function createVpsCodexRunner({
  sshPath = DEFAULT_SSH,
  sshAlias = 'vps',
  remoteSubmit = DEFAULT_REMOTE_SUBMIT,
  threadLabel = 'vps-lounge',
} = {}) {
  const running = new Set();
  return {
    exists() { return fs.existsSync(sshPath); },
    isRunning() { return running.size > 0; },
    health() {
      try {
        const value = execFileSync(sshPath, [sshAlias, 'systemctl', '--user', 'is-active', 'codex-lounge.service'], {
          encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return { exists: value === 'active', running: running.size > 0, transport: 'vps_file_inbox' };
      } catch {
        return { exists: false, running: running.size > 0, transport: 'vps_file_inbox' };
      }
    },
    async start({ threadId, prompt, spoolPath }) {
      fs.mkdirSync(require('node:path').dirname(spoolPath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(spoolPath, '', { mode: 0o600 });
      const dispatchId = require('node:path').basename(spoolPath, '.jsonl');
      const child = spawn(sshPath, [sshAlias, remoteSubmit, dispatchId], {
        stdio: ['pipe', 'pipe', 'pipe'], shell: false,
      });
      running.add(dispatchId);
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.once('close', (code, signal) => {
        const lines = [event('thread.started', { thread_id: threadId || threadLabel })];
        if (code === 0 && stdout.trim()) {
          lines.push(event('item.completed', {
            item: { id: `vps-${dispatchId}`, type: 'agent_message', text: stdout.trim() },
          }));
          lines.push(event('turn.completed', { usage: null }));
        } else {
          lines.push(event('turn.failed', { error: { message: stderr.trim() || `ssh exited ${code}` } }));
        }
        lines.push(event('process.exited', { exit_code: code, signal: signal || null }));
        try { fs.appendFileSync(spoolPath, lines.join('')); } catch {}
        running.delete(dispatchId);
      });
      child.stdin.end(prompt, 'utf8');
      return await new Promise((resolve, reject) => {
        child.once('spawn', () => resolve({ pid: child.pid }));
        child.once('error', (error) => { running.delete(dispatchId); reject(error); });
      });
    },
  };
}

module.exports = { createVpsCodexRunner, DEFAULT_SSH, DEFAULT_REMOTE_SUBMIT };
