'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_ENV = path.join(os.homedir(), 'Library/Application Support/LisaPhone/yanqiu-cc-bridge/.env');

function readEnv(file = DEFAULT_ENV) {
  const stat = fs.statSync(file);
  if ((stat.mode & 0o077) !== 0) throw new Error('互救台云桥凭据权限必须是 0600');
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  if (!out.SUPABASE_SERVICE_KEY || !out.TARGET_USER) throw new Error('互救台缺少本机云桥凭据');
  return out;
}

class RescueCloudConsumer {
  constructor({ rescue, envPath = DEFAULT_ENV, supabaseUrl = 'https://nposjnafsbikwfeoudbg.supabase.co' }) {
    this.rescue = rescue;
    this.envPath = envPath;
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.timer = null;
    this.running = false;
  }

  headers(extra = {}) {
    const env = readEnv(this.envPath);
    return { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
  }

  async request(pathname, options = {}) {
    const response = await fetch(this.supabaseUrl + pathname, { ...options, headers: this.headers(options.headers) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
  }

  async claim() {
    const env = readEnv(this.envPath);
    const query = `/rest/v1/rescue_remote_commands?user_id=eq.${encodeURIComponent(env.TARGET_USER)}&state=eq.queued&order=created_at.asc&limit=1`;
    const rows = await this.request(query, { headers: { Accept: 'application/json' } });
    const row = rows && rows[0];
    if (!row) return null;
    const claimed = await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}&state=eq.queued`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ state: 'claimed', claimed_at: new Date().toISOString() }),
    });
    return claimed && claimed[0] ? { ...row, ...claimed[0] } : null;
  }

  execute(row) {
    const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
    if (row.action === 'status') return this.rescue.status();
    if (row.action === 'checkpoint') return this.rescue.checkpoint(String(p.reason || '手机互救台'));
    if (row.action === 'restart') return this.rescue.restart(String(p.service || ''), p.confirmed === true);
    if (row.action === 'rewind_preview') return this.rescue.rewindPreview({ before: p.before });
    if (row.action === 'rescue_ticket') return { ticket: this.rescue.rescueSummary(String(p.symptom || '')), dispatchRequired: true };
    throw new Error('未知互救命令');
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const row = await this.claim();
      if (!row) return;
      try {
        const result = await Promise.resolve(this.execute(row));
        await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'completed', result, completed_at: new Date().toISOString() }) });
      } catch (error) {
        await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'failed', error_text: String(error && error.message || error).slice(0, 500), completed_at: new Date().toISOString() }) });
      }
    } finally { this.running = false; }
  }

  start(intervalMs = 5000) {
    if (this.timer) return;
    this.tick().catch(() => {});
    this.timer = setInterval(() => this.tick().catch(() => {}), Math.max(2000, Number(intervalMs) || 5000));
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = { RescueCloudConsumer, readEnv, DEFAULT_ENV };
