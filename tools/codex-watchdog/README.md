# Codex leak watchdog

This local watchdog records evidence for the recurring ChatGPT/Codex process
leak. It is diagnostic-only: it never kills or restarts ChatGPT.

It samples every 30 seconds and reports:

- an abnormal rise in ChatGPT/Codex child process count;
- one process staying above 90% CPU for about three minutes;
- less than 3 GiB of free disk space;
- free disk falling by more than 1 GiB within ten minutes while less than
  20 GiB remains;
- free disk falling by more than 5 GiB across thirty minutes, even when ample
  space remains.

Short-lived Xcode, device-support, and app-updater writes are still recorded in
`status.json`, but no longer create a notification while the disk has at least
20 GiB free. This keeps the early leak alarm without treating normal installs
as incidents.

When a threshold persists, it sends a macOS notification and writes a compact
incident bundle under:

```text
~/Library/Application Support/LisaPhone/codex-watchdog/incidents/
```

The bundle contains a JSON summary, the Codex process list, and a three-second
bounded `lsof +L1` probe for only the most suspicious Codex PIDs. It does not
scan personal files or store conversation content.

Check the current state:

```bash
python3 tools/codex-watchdog/codex_watchdog.py status
```

Run one sample manually:

```bash
python3 tools/codex-watchdog/codex_watchdog.py once
```

The installed launch agent is `com.lisa.codex-watchdog`. Unload it with:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.lisa.codex-watchdog.plist
```
