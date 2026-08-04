'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { openDb } = require('./db');
const { Orchestrator } = require('./orchestrator');
const { CCAdapter } = require('./adapters/cc');
const { CodexAdapter } = require('./adapters/codex');
const { createCodexCliRunner } = require('./adapters/codex-runner');
const { createWakeQueueSender } = require('./adapters/cc-wake-sender');
const { createLoungeServer } = require('./server');
const { LoungeOutboxConsumer } = require('./adapters/lounge-outbox-consumer');
const { LandlordController } = require('./landlord-controller');

const DEFAULT_CONFIG = path.join(__dirname, 'data', 'live-config.json');

function readFileWithRetry(filePath, attempts = 8) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try { return fs.readFileSync(filePath, 'utf8'); }
    catch (error) {
      lastError = error;
      if (!['EAGAIN', 'EBUSY'].includes(error && error.code) && Number(error && error.errno) !== -11) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80);
    }
  }
  throw lastError;
}

function readPrivateConfig(configPath = process.env.LOUNGE_CONFIG || DEFAULT_CONFIG) {
  const stat = fs.statSync(configPath);
  if ((stat.mode & 0o077) !== 0) throw new Error('live-config 权限必须是 0600');
  const config = JSON.parse(readFileWithRetry(configPath));
  for (const key of ['cc_session_id', 'codex_thread_id', 'cc_project_dir']) {
    if (!config[key] || typeof config[key] !== 'string') throw new Error(`live-config 缺 ${key}`);
  }
  return { ...config, configPath };
}

function codexProcessRunning(threadId) {
  try {
    const output = execFileSync('/usr/bin/pgrep', ['-af', 'codex'], { encoding: 'utf8', timeout: 1500 });
    return output.split('\n').some((line) => line.includes('exec resume') && line.includes(threadId));
  } catch { return false; }
}

function createLiveHost({ configPath, port } = {}) {
  const config = readPrivateConfig(configPath);
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true, mode: 0o700 });
  const db = openDb(config.db_path || path.join(__dirname, 'data', 'lounge-live.db'));
  const cc = new CCAdapter({
    db,
    projectDir: config.cc_project_dir,
    appSupportDir: config.cc_app_support_dir,
    sender: createWakeQueueSender({ inboxPath: config.wake_inbox }),
    outboxPath: config.lounge_outbox,
    silenceMs: Number(config.cc_silence_ms || 4000),
  });
  const runner = createCodexCliRunner({ cliPath: config.codex_cli_path });
  const codex = new CodexAdapter({
    db,
    runner,
    spoolDir: path.join(__dirname, 'data', 'codex-spool'),
    threadHealth: async (threadId) => ({
      exists: threadId === config.codex_thread_id,
      running: codexProcessRunning(threadId),
    }),
  });
  const orch = new Orchestrator({
    db,
    cc,
    codex,
    pollInterval: Number(config.poll_interval_ms || 800),
    defaultTimeoutMs: Number(config.timeout_ms || 180000),
    targetTimeoutMs: {
      yanqiu: Number(config.cc_timeout_ms || config.timeout_ms || 180000),
      codex: Number(config.codex_timeout_ms || 600000),
    },
  });
  let built;
  const landlord = new LandlordController({ db, orch, onChange: (roomId) => built && built.snapshot(roomId) });
  built = createLoungeServer({
    orch,
    landlord,
    runtime: { mode: 'live', cc: 'dedicated_wake_queue', codex: 'official_cli' },
    healthTargets: { cc: config.cc_session_id, codex: config.codex_thread_id },
    roomDefaults: {
      cc_session_id: config.cc_session_id,
      codex_thread_id: config.codex_thread_id,
      max_auto_turns: Number(config.max_auto_turns || 2),
      daily_call_cap: Number(config.daily_call_cap || 20),
      daily_char_cap: Number(config.daily_char_cap || 16000),
    },
  });
  const outboxConsumer = new LoungeOutboxConsumer({
    db, orch, outboxPath: config.lounge_outbox,
    onMessage: (roomId) => built.snapshot(roomId),
  });
  outboxConsumer.start(Number(config.outbox_poll_ms || 1000));
  built.server.on('close', () => outboxConsumer.stop());
  return { ...built, db, orch, landlord, outboxConsumer, config, port: Number(port || config.port || 8092) };
}

if (require.main === module) {
  const host = createLiveHost({ port: process.env.PORT });
  host.server.listen(host.port, '127.0.0.1', () => {
    process.stdout.write(`三方会客厅真实宿主：http://127.0.0.1:${host.port}\n`);
  });
}

module.exports = { createLiveHost, readPrivateConfig, readFileWithRetry, codexProcessRunning, DEFAULT_CONFIG };
