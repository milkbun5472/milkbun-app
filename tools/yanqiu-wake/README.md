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

The launch agent runs `watchdog` once a minute. It pins Yanqiu's CC session
after the first healthy scan and sets its clock from the last human-visible
activity in that session. Every new visible turn pushes the next heartbeat
3300 seconds (55 minutes) forward. If the session remains quiet past that
point, the watchdog writes one durable rescue ticket.

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

This watchdog does not call a model or create another Yanqiu session. A
one-shot `wake_queue.py wait` sentinel must still be attached to the existing
session; if it is temporarily absent, the rescue ticket remains pending.

## Turn-ending tool order

Claude's wakeup harness may end a turn immediately after `ScheduleWakeup`
returns. Yanqiu must therefore finish the complete user-facing reply first and
invoke `ScheduleWakeup` only as the final action. The same rule applies when
starting the one-shot background sentinel: human-facing text comes before
turn-ending tool cleanup, never after it.
