'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolvePointer } = require('./adapters/cc-sessions');

const DEFAULT_ROOT = path.join(os.homedir(), 'Library', 'Application Support', 'Lisa Lounge', 'rescue');
const DEFAULT_SERVICES = {
  lounge: 'com.lisa.three-party-lounge',
  fable: 'com.lisa.fable-bridge',
  cc_bridge: 'com.lisa.yanqiu-cc-bridge',
  wake: 'com.lisa.yanqiu-heartbeat',
  relay: 'com.lisa.stackchan-relay',
  watchdog: 'com.lisa.codex-watchdog',
};

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function run(file, args, timeout = 4000) {
  return spawnSync(file, args, { encoding: 'utf8', timeout, maxBuffer: 1024 * 1024 });
}

function serviceStatus(label, uid = process.getuid && process.getuid()) {
  if (uid == null) return { state: 'unknown', error: 'uid_unavailable' };
  const result = run('/bin/launchctl', ['print', `gui/${uid}/${label}`]);
  if (result.status !== 0) return { state: 'missing' };
  const state = String(result.stdout).match(/\bstate = ([^\n]+)/)?.[1]?.trim() || 'loaded';
  const exitCode = Number(String(result.stdout).match(/\blast exit code = (-?\d+)/)?.[1] || 0);
  return { state, lastExitCode: Number.isFinite(exitCode) ? exitCode : null };
}

function safeWatchdog(file = path.join(os.homedir(), 'Library/Application Support/LisaPhone/codex-watchdog/status.json')) {
  try {
    const row = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      level: row.level || 'unknown', sampledAt: row.sampled_at || null,
      freeGib: Number(row.free_gib || 0), processCount: Number(row.process_count || 0),
      reasons: Array.isArray(row.reasons) ? row.reasons.map(String).slice(0, 6) : [],
    };
  } catch { return { level: 'unknown', reasons: ['watchdog_status_unavailable'] }; }
}

class RescueController {
  constructor({ config, dbPath, root = DEFAULT_ROOT, services = DEFAULT_SERVICES, uid } = {}) {
    this.config = config || {};
    this.dbPath = dbPath || this.config.db_path || null;
    this.root = root;
    this.services = { ...services };
    this.uid = uid == null ? (process.getuid && process.getuid()) : uid;
    fs.mkdirSync(path.join(root, 'checkpoints'), { recursive: true, mode: 0o700 });
  }

  status() {
    return {
      sampledAt: new Date().toISOString(),
      services: Object.fromEntries(Object.entries(this.services).map(([key, label]) => [key, serviceStatus(label, this.uid)])),
      watchdog: safeWatchdog(),
      checkpointCount: this.list().length,
    };
  }

  list() {
    const dir = path.join(this.root, 'checkpoints');
    let names = [];
    try { names = fs.readdirSync(dir).filter((name) => /^cp_[\w-]+$/.test(name)).sort().reverse(); } catch {}
    return names.slice(0, 30).map((name) => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(dir, name, 'meta.json'), 'utf8'));
        return { checkpointId: name, createdAt: meta.createdAt, reason: meta.reason, hasCc: !!meta.hasCc, hasLoungeDb: !!meta.hasLoungeDb };
      } catch { return null; }
    }).filter(Boolean);
  }

  checkpoint(reason = 'manual') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `cp_${stamp}`;
    const dir = path.join(this.root, 'checkpoints', id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    let hasCc = false, hasLoungeDb = false;
    try {
      const pointer = resolvePointer(this.config.cc_session_id, {
        appSupportDir: this.config.cc_app_support_dir,
        projectDir: this.config.cc_project_dir,
      });
      if (fs.existsSync(pointer.transcriptPath)) {
        fs.copyFileSync(pointer.transcriptPath, path.join(dir, 'yanqiu-transcript.jsonl'));
        fs.chmodSync(path.join(dir, 'yanqiu-transcript.jsonl'), 0o600);
        hasCc = true;
      }
    } catch {}
    try {
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, path.join(dir, 'lounge.db'));
        fs.chmodSync(path.join(dir, 'lounge.db'), 0o600);
        for (const suffix of ['-wal', '-shm']) {
          if (fs.existsSync(this.dbPath + suffix)) {
            fs.copyFileSync(this.dbPath + suffix, path.join(dir, 'lounge.db' + suffix));
            fs.chmodSync(path.join(dir, 'lounge.db' + suffix), 0o600);
          }
        }
        hasLoungeDb = true;
      }
    } catch {}
    const meta = { checkpointId: id, createdAt: new Date().toISOString(), reason: String(reason).slice(0, 160), hasCc, hasLoungeDb, status: this.status() };
    atomicJson(path.join(dir, 'meta.json'), meta);
    return { checkpointId: id, createdAt: meta.createdAt, reason: meta.reason, hasCc, hasLoungeDb };
  }

  restart(service, confirmed) {
    if (confirmed !== true) throw Object.assign(new Error('重启需要明确确认'), { status: 409, code: 'CONFIRMATION_REQUIRED' });
    const label = this.services[service];
    if (!label) throw Object.assign(new Error('不在允许重启的白名单'), { status: 400, code: 'SERVICE_NOT_ALLOWED' });
    if (this.uid == null) throw new Error('uid unavailable');
    const before = serviceStatus(label, this.uid);
    const result = run('/bin/launchctl', ['kickstart', '-k', `gui/${this.uid}/${label}`], 8000);
    if (result.status !== 0) throw Object.assign(new Error('launchctl kickstart failed'), { status: 503, code: 'RESTART_FAILED' });
    return { service, before, after: serviceStatus(label, this.uid) };
  }

  rewindPreview({ before } = {}) {
    const wanted = Number.isFinite(Date.parse(before)) ? Date.parse(before) : Date.now();
    const candidate = this.list().find((row) => Number.isFinite(Date.parse(row.createdAt)) && Date.parse(row.createdAt) <= wanted) || null;
    return {
      executable: false,
      authorizationRequired: true,
      candidate,
      reason: candidate ? '已找到只读检查点；执行恢复会改写会话历史，当前保持锁定' : '目标时间之前没有检查点，不能安全回退',
    };
  }

  rescueSummary(symptom = '') {
    const status = this.status();
    const services = Object.entries(status.services).map(([name, row]) => `${name}=${row.state}`).join('，');
    const wd = status.watchdog;
    return [
      '【互救工单·只诊断，未经 Lisa 另行确认不要改写历史或删除数据】',
      symptom ? `现象：${String(symptom).trim().slice(0, 1000)}` : '现象：请根据以下体征检查另一方为何离线/异常。',
      `本机服务：${services}`,
      `Codex 看门狗：${wd.level}；剩余磁盘 ${wd.freeGib || '?'} GiB；相关进程 ${wd.processCount || '?'} 个`,
      `可恢复检查点：${status.checkpointCount} 个。需要重启、rewind 或改文件时先把计划说给 Lisa，等她确认。`,
    ].join('\n');
  }
}

module.exports = { RescueController, DEFAULT_ROOT, DEFAULT_SERVICES, serviceStatus, safeWatchdog };
