# Yanqiu durable wake queue

`wake_queue.py` merges three durable local sources:

- `inbox.jsonl`: Stack-chan taps
- `voice_inbox.jsonl`: transcribed Stack-chan voice turns
- `wake_inbox.jsonl`: hourly `launchd` alarms

The existing Claude sentinel remains one-shot. Re-arm it with:

```bash
cd /Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay
python3 wake_queue.py wait
```

The command claims one pending event and exits. Events that arrive while no
sentinel is running remain behind the persisted cursor and wake the next
sentinel immediately. Do not replace the cursor with a fresh `wc -l` baseline.

The launch agent runs `enqueue-hourly` at minute zero of every hour. It does
not call a model and does not create another Yanqiu session.
