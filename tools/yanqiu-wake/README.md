# Yanqiu durable wake queue

`wake_queue.py` merges three durable local sources:

- `inbox.jsonl`: Stack-chan taps
- `voice_inbox.jsonl`: transcribed Stack-chan voice turns
- `wake_inbox.jsonl`: 55-minute `launchd` cache-heartbeat alarms

The existing Claude sentinel remains one-shot. Re-arm it with:

```bash
cd /Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay
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

The relay remains the source of Stack-chan events, but the wake cursor, clock,
and claim ledger now live in `~/Library/Application Support/LisaPhone/yanqiu-wake`.
On first launch they are safely seeded from the older hidden relay files. This
keeps the heartbeat's bookkeeping intact if iCloud temporarily moves the
Desktop relay directory away.

This watchdog does not call a model or create another Yanqiu session. A
one-shot `wake_queue.py wait` sentinel must still be attached to the existing
session; if it is temporarily absent, the rescue ticket remains pending.

## Turn-ending order

The durable clock does not use `ScheduleWakeup`. When Yanqiu re-arms the
one-shot sentinel, human-facing text still comes first and the background
`wake_queue.py wait` cleanup comes last.
