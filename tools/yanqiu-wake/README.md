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

The launch agent runs `watchdog` once a minute. It reads the newest native
`ScheduleWakeup` call from Yanqiu's existing Claude session, including its
dynamic 3300-second delay and full prompt. Ordinary conversation activity
pushes the watchdog deadline forward. If the native chain fires and Yanqiu
continues talking, nothing is enqueued. Only when the session stays silent
past the expected wake time does the watchdog copy that exact dynamic prompt
into a durable rescue ticket.

This watchdog does not call a model or create another Yanqiu session. A
one-shot `wake_queue.py wait` sentinel must still be attached to the existing
session; if it is temporarily absent, the rescue ticket remains pending.
