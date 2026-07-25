# Stack-chan relay under launchd

This template belongs to the Mac relay Yanqiu is implementing. It does not
expose anything by itself; Tailscale Funnel remains a separate, explicit
configuration.

After the relay entry point and env-file format are final:

1. Copy `launchd/com.lisa.stackchan-relay.plist.example`.
2. Replace every `REPLACE_WITH_...` value with an absolute path.
3. Keep secrets in the relay env file, mode `0600`; never put them in the plist.
4. Validate and load:

```bash
plutil -lint ~/Library/LaunchAgents/com.lisa.stackchan-relay.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.lisa.stackchan-relay.plist
launchctl kickstart -k gui/$(id -u)/com.lisa.stackchan-relay
```

Inspect:

```bash
launchctl print gui/$(id -u)/com.lisa.stackchan-relay
tail -n 100 /path/to/logs/stackchan-relay.err.log
```

Unload before replacing the file:

```bash
launchctl bootout gui/$(id -u)/com.lisa.stackchan-relay
```

Do not load the example unchanged. We will produce the concrete plist only
after Yanqiu gives the relay's absolute entry point, working directory and
health-check behavior.

