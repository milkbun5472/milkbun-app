# Stack-chan relay under launchd

This plist runs Yanqiu's standard-library Python relay on Lisa's Mac. It does
not expose anything by itself; Tailscale Funnel remains a separate,
explicit configuration.

1. Copy `launchd/com.lisa.stackchan-relay.plist.example` to
   `~/Library/LaunchAgents/com.lisa.stackchan-relay.plist`.
2. Keep secrets in the relay's adjacent `.env`, mode `0600`; never put them in
   the plist or Git.
3. Validate and load:

```bash
plutil -lint ~/Library/LaunchAgents/com.lisa.stackchan-relay.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.lisa.stackchan-relay.plist
launchctl kickstart -k gui/$(id -u)/com.lisa.stackchan-relay
```

Inspect:

```bash
launchctl print gui/$(id -u)/com.lisa.stackchan-relay
tail -n 100 ~/Library/Logs/stackchan-relay.err.log
```

Unload before replacing the file:

```bash
launchctl bootout gui/$(id -u)/com.lisa.stackchan-relay
```

The checked-in example contains Lisa's concrete non-secret paths. If Python is
upgraded, update the absolute interpreter path before reloading the job;
launchd must not depend on an interactive shell's `PATH`.
