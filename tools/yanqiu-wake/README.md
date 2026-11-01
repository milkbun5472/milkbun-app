# Yanqiu durable wake queue

`wake_queue.py` merges durable local sources from
`~/Library/Application Support/LisaPhone/stackchan-relay`:

- `inbox.jsonl`: Stack-chan taps
- `voice_inbox.jsonl`: transcribed Stack-chan voice turns
- `wake_inbox.jsonl`: 55-minute `launchd` cache-heartbeat alarms

The existing Claude sentinel remains one-shot. Re-arm it with:

```bash
cd /Users/lisa/yanqiu-den/stackchan-relay
python3 wake_queue.py wait
```

The command claims one pending event and exits. Events that arrive while no
sentinel is running remain behind the persisted cursor and wake the next
sentinel immediately. Do not replace the cursor with a fresh `wc -l` baseline.

The launch agent runs one lightweight, persistent `serve` supervisor. It
checks the clock every ten seconds, pins Yanqiu's CC session after the first
healthy scan, and sets its clock from Yanqiu's last
user-visible reply in that session. Only a real assistant text reply pushes
the next heartbeat 3300 seconds (55 minutes) forward; a Lisa message cannot
postpone it. If the session remains quiet past that point, the watchdog writes
one durable rescue ticket. This avoids launchd timer drift turning the intended
55-minute interval into an unpredictable late alarm.

`ScheduleWakeup` is deliberately not part of this clock. The CC hook blocks
that hand-wound path so a stale tool call can never freeze or reset the durable
clock.

There must be only one clock: `com.lisa.yanqiu-heartbeat`. The older
`com.lisa.yanqiu-hourly-wake` agent is retired; leaving both enabled creates
two unrelated ticket streams and makes a healthy 55-minute clock look random.

For a safe health check (no prompt, transcript path, or message body printed):

```bash
python3 wake_queue.py status
```

`pending.heartbeat > 0` means a durable rescue ticket is waiting for the
one-shot sentinel. It is not evidence that a ticket was lost.

The queue separately records each ticket claim in `.wake_claims.jsonl`.
Claiming a ticket means the sentinel exited; it does not prove that CC emitted
visible text or re-armed itself. If a claimed rescue has no new visible
activity after ten minutes, the watchdog writes one (and only one) retry
ticket. If that retry remains pending, `status` reports `awaiting_sentinel`.

## iCloud safety

The live relay, inboxes, uploads, audio, logs and executable scripts all live
outside Desktop/iCloud in `~/Library/Application Support/LisaPhone/stackchan-relay`.
The wake cursor, clock and claim ledger live next door in `yanqiu-wake`.
The Desktop copy is source/rollback material only and must never be used as a
launchd working directory or live inbox.

The supervisor also runs `sentinel_guard.py once` in a separately bounded
process. The guardian counts only real Python `wait` processes whose parent
tree reaches the pinned, registered Claude CLI session. A detached orphan,
another conversation, or a shell reading source cannot pass this check.

After three minutes without that sentinel, the existing Stack-chan alarm
asks Lisa to look. Only after **more than five minutes** does the guardian
resolve the existing Desktop pointer by `cliSessionId` and try one native
re-arm notice in that same conversation. Its fixed prefix is
`[复活守护自动叫醒]`. The native adapter requires the exact session URL,
an idle turn, and an empty composer. Live work and user drafts defer recovery.
The app's small read-only `ax-page` bridge reads CFURL page addresses that
System Events cannot marshal, then returns only scoped control paths and
booleans. AppleScript still performs every input/click action. The empty
contenteditable composer may contain its own newline, which is normalized
before checking for a draft; substantive text is never overwritten.
The guardian never runs `claude --resume`, creates a conversation, claims a
ticket, edits a transcript, or resets the queue cursor. A pending ticket stays
pending until the original session re-arms its own one-shot sentinel.

Successful delivery is only `awaiting_rearm`: an attached sentinel must
actually reappear before `healthy` is recorded. If it does not return within
two minutes, a fallback Stack-chan alarm asks Lisa to look. The **single**
attempt per outage is persisted **before** delivery. A process restart,
ambiguous timeout, failed delivery, or hours of silence cannot resend it.
Only the actual return of an attached sentinel resets the outage timer.

`wake_queue.py status` includes a safe `sentinel_guard` report, with state,
attempt count and timestamps. It omits conversation IDs, paths and text.
The guardian has its own `.sentinel_guard.json` and single-flight lock beside
the clock state, outside Desktop/iCloud. The existing `com.lisa.yanqiu-heartbeat`
launch agent owns both checks; no second clock or scheduled model run is added.

Installation:

```bash
python3 tools/yanqiu-wake/install_guard.py --dry-run
python3 tools/yanqiu-wake/install_guard.py
```

The installer compiles a dedicated background app, **言秋复活守护.app**
(`com.lisa.yanqiu-sentinel-guardian.native`). Grant that app only its required
Accessibility and Automation → System Events permissions **by hand** in
System Settings. No Full Disk Access, screen recording, network access, or
generic Terminal/Python Accessibility grant is needed. macOS Accessibility
permissions are app-wide; the exact-window restriction is enforced in code.
The app accepts only fresh local requests and ignores a previously answered
request nonce, so reopening it cannot replay an old wake notice.

A fresh installation keeps native delivery disabled while monitoring and the
three-minute alarm run normally. After Lisa grants permissions by hand, run:

```bash
python3 "$HOME/Library/Application Support/LisaPhone/yanqiu-wake/sentinel_guard.py" enable-native
```

This first performs a read-only probe. Only `ready` removes the delivery gate.
`status` reports `native_enabled: false` until then; no native wake is sent
while that gate exists.

The installer backs up scripts, installs runtime siblings together, replaces
legacy entrypoints with symlinks to the canonical runtime, and reloads
only the existing heartbeat agent. It never copies or resets a live inbox,
cursor, claim log or clock. A failed reload restores the prior scripts. Backups
and their restore manifest live in `LisaPhone/backups/sentinel-guard-*`.

To deliberately keep Claude closed, pause just the resurrection guardian:

```bash
python3 "$HOME/Library/Application Support/LisaPhone/yanqiu-wake/sentinel_guard.py" pause
python3 "$HOME/Library/Application Support/LisaPhone/yanqiu-wake/sentinel_guard.py" resume
```

This leaves the 55-minute clock and durable queue running. If macOS declines
Automation/Accessibility access, the guardian records the failed native
attempt and uses the existing alarm; it does not resend or change permissions.

## Turn-ending order

The durable clock does not use `ScheduleWakeup`. When Yanqiu re-arms the
one-shot sentinel, human-facing text still comes first and the background
`wake_queue.py wait` cleanup comes last.
