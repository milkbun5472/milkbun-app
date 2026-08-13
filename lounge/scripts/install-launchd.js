'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LABEL = 'com.lisa.three-party-lounge';
const loungeDir = path.resolve(__dirname, '..');
const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(agentsDir, `${LABEL}.plist`);
const supportDir = path.join(os.homedir(), 'Library', 'Application Support', 'Lisa Lounge');
const runtimeDir = path.join(supportDir, 'runtime');
const runtimeConfigPath = path.join(supportDir, 'live-config.json');
const uid = typeof process.getuid === 'function' ? process.getuid() : null;

function xml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function launchctl(args, allowFailure = false) {
  const out = spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
  if (!allowFailure && out.status !== 0) throw new Error((out.stderr || out.stdout || `launchctl ${args.join(' ')} failed`).trim());
  return out;
}

function install() {
  if (uid == null) throw new Error('无法取得当前用户 uid');
  const domain = `gui/${uid}`;
  launchctl(['bootout', domain, plistPath], true);
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(path.join(loungeDir, 'data'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(supportDir, { recursive: true, mode: 0o700 });
  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  for (const name of ['adapters', 'public']) fs.cpSync(path.join(loungeDir, name), path.join(runtimeDir, name), { recursive: true });
  for (const name of ['budget.js', 'clock.js', 'db.js', 'landlord-controller.js', 'landlord.js', 'live-host.js', 'lock.js', 'orchestrator.js', 'rescue.js', 'rescue-cloud-consumer.js', 'server.js']) {
    fs.copyFileSync(path.join(loungeDir, name), path.join(runtimeDir, name));
  }
  const config = JSON.parse(fs.readFileSync(path.join(loungeDir, 'data', 'live-config.json'), 'utf8'));
  config.db_path = path.join(supportDir, 'lounge-live.db');
  config.wake_inbox = path.join(os.homedir(), 'Library/Application Support/LisaPhone/stackchan-relay/wake_inbox.jsonl');
  config.lounge_outbox = path.join(os.homedir(), 'Library/Application Support/LisaPhone/stackchan-relay/lounge_outbox.jsonl');
  fs.writeFileSync(runtimeConfigPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(runtimeConfigPath, 0o600);
  const oldDb = path.join(loungeDir, 'data', 'lounge-live.db');
  const newDb = config.db_path;
  if (!fs.existsSync(newDb) && fs.existsSync(oldDb)) {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(oldDb + suffix)) fs.copyFileSync(oldDb + suffix, newDb + suffix);
    }
  }
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>${xml(path.join(runtimeDir, 'live-host.js'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(runtimeDir)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>LOUNGE_CONFIG</key><string>${xml(runtimeConfigPath)}</string>
  </dict>
  <key>StandardOutPath</key><string>${xml(path.join(supportDir, 'lounge.out.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(path.join(supportDir, 'lounge.err.log'))}</string>
</dict>
</plist>
`;
  fs.writeFileSync(plistPath, plist, { mode: 0o600 });
  fs.chmodSync(plistPath, 0o600);
  launchctl(['bootstrap', domain, plistPath]);
  launchctl(['kickstart', '-k', `${domain}/${LABEL}`]);
  process.stdout.write('会客厅 launchd 已安装并启动（具体路径未打印）\n');
}

function uninstall() {
  if (uid == null) throw new Error('无法取得当前用户 uid');
  launchctl(['bootout', `gui/${uid}`, plistPath], true);
  try { fs.unlinkSync(plistPath); } catch {}
  try { fs.unlinkSync(runtimeConfigPath); } catch {}
  process.stdout.write('会客厅 launchd 已卸载\n');
}

if (process.argv[2] === 'uninstall') uninstall();
else install();
