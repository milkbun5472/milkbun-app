// App 互救台的 VPS 常驻执行器。
// 只领取当前户主的命令；只允许查看体征、建立只读检查点和重启白名单服务。
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import os from 'node:os';

const HOME = process.env.HOME;
const ROOT = join(HOME, 'services/rescue-consumer');
const ENV_FILES = [join(ROOT, '.env'), join(HOME, 'services/ledger-courier/.env')];
const DIAG = join(ROOT, 'logs/diagnostic.jsonl');
const CHECKPOINTS = join(ROOT, 'checkpoints');
const LEGACY_SUPABASE_URL = 'https://nposjnafsbikwfeoudbg.supabase.co';

export const SERVICES = Object.freeze({
  codex_lounge: 'codex-lounge.service',
  codex_worker: 'codex-worker.service',
  fable: 'fable-bridge.service',
  memory: 'memory-gateway.service',
  courier: 'ledger-courier.service',
  push: 'push-sender.service',
});

function readEnv(files = ENV_FILES) {
  const out = {};
  for (const file of files) {
    if (!existsSync(file)) continue;
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) throw new Error(`${file} 权限必须是 0600`);
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  if (!out.SUPABASE_SERVICE_KEY || !out.TARGET_USER) throw new Error('缺少 SUPABASE_SERVICE_KEY / TARGET_USER');
  return out;
}

function atomicJson(file, value) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  writeFileSync(file, readFileSync(tmp), { mode: 0o600 });
}

function systemctl(args) {
  try { return execFileSync('/usr/bin/systemctl', ['--user', ...args], { encoding: 'utf8', timeout: 8000 }).trim(); }
  catch (error) { return String(error.stdout || '').trim(); }
}

export function serviceStatus(label) {
  const state = systemctl(['is-active', label]) || 'unknown';
  const detail = systemctl(['show', label, '--property=MainPID,ActiveEnterTimestamp,ExecMainStatus', '--value']).split('\n');
  return { state, mainPid: Number(detail[0] || 0), activeSince: detail[1] || null, lastExitCode: Number(detail[2] || 0) };
}

export class VpsRescueConsumer {
  constructor({ env = readEnv(), fetchImpl = fetch, serviceStatusImpl = serviceStatus, restartImpl } = {}) {
    this.env = env;
    this.fetch = fetchImpl;
    this.serviceStatus = serviceStatusImpl;
    this.restart = restartImpl || ((label) => {
      execFileSync('/usr/bin/systemctl', ['--user', 'restart', label], { timeout: 12000 });
      return this.serviceStatus(label);
    });
  }

  headers(extra = {}) {
    const key = this.env.SUPABASE_SERVICE_KEY;
    return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
  }

  async request(pathname, options = {}) {
    const base = String(this.env.SUPABASE_URL || LEGACY_SUPABASE_URL).replace(/\/$/, '');
    const response = await this.fetch(base + pathname, { ...options, headers: this.headers(options.headers) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
  }

  async claim() {
    const uid = encodeURIComponent(this.env.TARGET_USER);
    const rows = await this.request(`/rest/v1/rescue_remote_commands?user_id=eq.${uid}&state=eq.queued&order=created_at.asc&limit=1`, { headers: { Accept: 'application/json' } });
    if (!rows?.[0]) return null;
    const row = rows[0];
    const claimed = await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}&state=eq.queued`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ state: 'claimed', claimed_at: new Date().toISOString() }),
    });
    return claimed?.[0] ? { ...row, ...claimed[0] } : null;
  }

  status() {
    const disk = statSync('/');
    void disk;
    return {
      executor: 'vps', sampledAt: new Date().toISOString(), hostname: os.hostname(),
      services: Object.fromEntries(Object.entries(SERVICES).map(([key, label]) => [key, this.serviceStatus(label)])),
      memory: { totalMib: Math.round(os.totalmem() / 1048576), freeMib: Math.round(os.freemem() / 1048576) },
      checkpointCount: this.listCheckpoints().length,
    };
  }

  listCheckpoints() {
    try { return readdirSync(CHECKPOINTS).filter((name) => /^cp_[\w-]+$/.test(name)).sort().reverse().slice(0, 30); }
    catch { return []; }
  }

  checkpoint(reason = 'Lisa 手机手动恢复点') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `cp_${stamp}`;
    const dir = join(CHECKPOINTS, id);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stateDir = join(HOME, 'services/codex/state');
    if (existsSync(stateDir)) cpSync(stateDir, join(dir, 'codex-state'), { recursive: true });
    const meta = { checkpointId: id, createdAt: new Date().toISOString(), reason: String(reason).slice(0, 160), scope: 'vps-runtime', status: this.status() };
    atomicJson(join(dir, 'meta.json'), meta);
    return { checkpointId: id, createdAt: meta.createdAt, reason: meta.reason, scope: meta.scope };
  }

  execute(row) {
    const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
    if (row.action === 'status') return this.status();
    if (row.action === 'checkpoint') return this.checkpoint(p.reason);
    if (row.action === 'restart') {
      if (p.confirmed !== true) throw new Error('重启需要明确确认');
      const label = SERVICES[String(p.service || '')];
      if (!label) throw new Error('该服务不在 VPS 重启白名单');
      const before = this.serviceStatus(label);
      const after = this.restart(label);
      return { executor: 'vps', service: p.service, before, after };
    }
    if (row.action === 'rewind_preview') {
      const id = this.listCheckpoints()[0] || null;
      return { executor: 'vps', executable: false, authorizationRequired: true, candidate: id, reason: id ? '已找到 VPS 只读检查点；真正回退仍锁定' : 'VPS 尚无检查点' };
    }
    if (row.action === 'rescue_ticket') return { executor: 'vps', symptom: String(p.symptom || '').slice(0, 1000), status: this.status(), dispatchRequired: true };
    throw new Error('未知互救命令');
  }

  async tick() {
    const row = await this.claim();
    if (!row) return false;
    try {
      const result = await Promise.resolve(this.execute(row));
      await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'completed', result, completed_at: new Date().toISOString() }) });
      return true;
    } catch (error) {
      await this.request(`/rest/v1/rescue_remote_commands?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'failed', error_text: String(error?.message || error).slice(0, 500), completed_at: new Date().toISOString() }) });
      return false;
    }
  }
}

async function main() {
  mkdirSync(join(ROOT, 'logs'), { recursive: true, mode: 0o700 });
  mkdirSync(CHECKPOINTS, { recursive: true, mode: 0o700 });
  const consumer = new VpsRescueConsumer();
  appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), event: 'started' }) + '\n');
  for (;;) {
    try { await consumer.tick(); }
    catch (error) { appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), event: 'tick_failed', error: String(error?.message || error).slice(0, 500) }) + '\n'); }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
