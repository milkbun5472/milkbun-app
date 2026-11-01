import importlib.util
import json
import os
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "tools/yanqiu-wake"))
import sentinel_guard as guard
import wake_queue as wake
import install_guard as installer

SESSION = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
DESKTOP = "local_33333333-3333-4333-8333-333333333333"
NOW = 1_800_000_000_000


def processes(session=SESSION, attached=True):
    return {
        10: (1, "/Applications/Claude.app/Contents/MacOS/Claude"),
        20: (10, f"/runtime/claude --resume={session} --input-format stream-json"),
        30: (20, '/bin/zsh -c python3 "/runtime/wake_queue.py" wait'),
        40: (30 if attached else 1, f"/runtime/Python /runtime/wake_queue.py wait {session}"),
    }


class ProcessTests(unittest.TestCase):
    def test_real_wait_must_belong_to_pinned_claude(self):
        self.assertEqual(guard.attached_sentinels(processes(), SESSION), [40])
        self.assertEqual(guard.attached_sentinels(processes(OTHER), SESSION), [])
        self.assertEqual(guard.attached_sentinels(processes(attached=False), SESSION), [])

    def test_legacy_wait_without_argument_and_spaces_in_path(self):
        rows = processes()
        rows[20] = (10, f'/Users/lisa/Library/Application Support/Claude/claude-code/2.1.309/hash/claude.app/Contents/MacOS/claude --resume={SESSION}')
        rows[40] = (30, '/Library/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python /Users/lisa/Library/Application Support/LisaPhone/yanqiu-wake/wake_queue.py wait')
        self.assertEqual(guard.attached_sentinels(rows, SESSION), [40])

    def test_documented_relative_wait_command(self):
        rows = processes()
        rows[40] = (30, 'python3 wake_queue.py wait')
        self.assertEqual(guard.attached_sentinels(rows, SESSION), [40])

    def test_shell_readers_pgrep_and_supervisor_never_count(self):
        rows = {
            1: (0, '/bin/zsh -c cat "wake_queue.py wait"'),
            2: (1, 'pgrep -f wake_queue.py wait'),
            3: (1, '/runtime/Python /runtime/wake_queue.py serve'),
            4: (1, '/runtime/Python /runtime/wake_queue.py watchdog'),
            5: (1, '/bin/zsh -c while true; do python3 /runtime/wake_queue.py wait; done'),
        }
        self.assertEqual(guard.sentinel_processes(rows), {})

    def test_cycle_cannot_hang(self):
        rows = processes()
        rows[30] = (40, '/bin/zsh -c wait')
        self.assertEqual(guard.attached_sentinels(rows, SESSION), [])

    def test_shell_with_claude_argument_is_not_the_cli(self):
        self.assertEqual(guard.claude_session(f'/bin/zsh -c /runtime/claude --resume={SESSION}'), '')

    def test_eviction_spares_readers_and_own_shell_but_removes_orphan_loop(self):
        rows = processes()
        rows[50] = (1, '/bin/zsh -c cat "wake_queue.py wait"')
        rows[60] = (1, '/bin/zsh -c while true; do python3 /runtime/wake_queue.py wait; done')
        rows[70] = (60, '/runtime/Python /runtime/wake_queue.py wait')
        with patch.object(guard, 'process_table', return_value=rows), patch.object(wake.os, 'getpid', return_value=40), patch.object(wake.os, 'getppid', return_value=30), patch.object(wake.os, 'kill') as kill:
            wake.evict_stale_sentinels()
        self.assertEqual({call.args[0] for call in kill.call_args_list}, {60, 70})


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.transcript = self.root / f"{SESSION}.jsonl"
        self.transcript.write_text('{}\n')
        os.utime(self.transcript, ((NOW - 900_000) / 1000,) * 2)
        self.patches = [
            patch.object(guard, 'pinned_target', return_value=(SESSION, self.transcript)),
            patch.object(guard, 'process_table', return_value={}),
            patch.object(guard, 'desktop_target', return_value=DESKTOP),
            patch.object(guard, 'save'),
            patch.object(guard, 'recover', return_value='sent'),
            patch.object(guard, 'alert'),
        ]
        self.disabled = patch.object(guard, 'NATIVE_DISABLED', self.root / 'disabled')
        self.disabled.start()
        self.mocks = [p.start() for p in self.patches]

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.disabled.stop()
        self.tmp.cleanup()

    def gap(self, **extra):
        return {'session_id': SESSION, 'gap_since': NOW - guard.REVIVE_AFTER_MS - 1, **extra}

    def test_gap_gets_grace_before_single_attempt(self):
        state = guard.sample({}, NOW)
        self.assertEqual(state['status'], 'gap_grace')
        self.mocks[4].assert_not_called()
        state = guard.sample(state, NOW + guard.ALERT_AFTER_MS)
        self.mocks[5].assert_called_once_with()
        self.mocks[4].assert_not_called()
        state = guard.sample(state, NOW + guard.REVIVE_AFTER_MS)
        self.mocks[4].assert_not_called()
        state = guard.sample(state, NOW + guard.REVIVE_AFTER_MS + 1)
        self.assertEqual(state['status'], 'awaiting_rearm')
        self.assertEqual(state['attempts'], 1)
        self.mocks[4].assert_called_once_with(DESKTOP)
        self.assertEqual(self.mocks[3].call_args.args[0]['attempted_at'], NOW + guard.REVIVE_AFTER_MS + 1)

    def test_recent_work_defers_intervention(self):
        os.utime(self.transcript, (NOW / 1000,) * 2)
        state = guard.sample(self.gap(), NOW)
        self.assertEqual(state['status'], 'active')
        self.mocks[4].assert_not_called()

    def test_permission_gate_keeps_alarm_but_never_sends(self):
        guard.NATIVE_DISABLED.touch()
        state = guard.sample(self.gap(), NOW)
        self.assertEqual(state['status'], 'awaiting_permission')
        self.mocks[4].assert_not_called()
        self.mocks[5].assert_called_once_with()

    def test_success_requires_attached_sentinel(self):
        self.mocks[1].return_value = processes()
        state = guard.sample(self.gap(attempted_at=NOW - 50_000), NOW)
        self.assertEqual(state['status'], 'healthy')
        self.assertEqual(state['last_recovered_at'], NOW)
        self.assertNotIn('gap_since', state)
        self.mocks[4].assert_not_called()

    def test_no_repeat_during_grace_then_fallback_and_wait_for_human(self):
        state = guard.sample(self.gap(), NOW)
        state = guard.sample(state, NOW + 20_000)
        self.assertEqual(state['status'], 'awaiting_rearm')
        self.mocks[5].assert_called_once_with()
        state = guard.sample(state, NOW + guard.REARM_GRACE_MS)
        self.assertEqual(state['status'], 'needs_attention')
        guard.sample(state, NOW + guard.REARM_GRACE_MS + 10_000)
        self.mocks[4].assert_called_once()
        self.assertEqual([c.kwargs for c in self.mocks[5].call_args_list], [{}, {'fallback': True}])

    def test_timeout_is_uncertain_and_cannot_immediately_resend(self):
        self.mocks[4].side_effect = guard.subprocess.TimeoutExpired('adapter', 25)
        state = guard.sample(self.gap(), NOW)
        self.assertEqual(state['status'], 'adapter_failed')
        state = guard.sample(state, NOW + 10_000)
        self.assertEqual(state['status'], 'awaiting_rearm')
        self.mocks[4].assert_called_once()

    def test_revoked_permission_uses_one_attempt_and_falls_back(self):
        self.mocks[4].return_value = 'permission_required'
        state = guard.sample(self.gap(), NOW)
        state = guard.sample(state, NOW + 3600_000)
        self.assertEqual(state['status'], 'needs_attention')
        self.mocks[4].assert_called_once()
        self.assertEqual(self.mocks[5].call_count, 2)

    def test_one_attempt_per_outage_survives_restarts_and_hours(self):
        state = guard.sample(self.gap(), NOW)
        for elapsed in (120_000, 900_000, 3_600_000, 86_400_000):
            state = guard.sample(json.loads(json.dumps(state)), NOW + elapsed)
        self.assertEqual(state['status'], 'needs_attention')
        self.mocks[4].assert_called_once()
        self.assertEqual(self.mocks[5].call_count, 2)

    def test_real_return_resets_timer_for_the_next_outage(self):
        state = guard.sample(self.gap(), NOW)
        self.mocks[1].return_value = processes()
        state = guard.sample(state, NOW + 20_000)
        self.assertEqual(state['status'], 'healthy')
        self.mocks[1].return_value = {}
        state = guard.sample(state, NOW + 40_000)
        self.assertEqual(state['gap_since'], NOW + 40_000)
        self.assertNotIn('attempted_at', state)
        guard.sample(state, NOW + 40_000 + guard.REVIVE_AFTER_MS + 1)
        self.assertEqual(self.mocks[4].call_count, 2)

    def test_user_draft_and_busy_turn_are_left_alone(self):
        for outcome in ('draft_present', 'busy'):
            self.mocks[4].return_value = outcome
            state = guard.sample(self.gap(), NOW)
            self.assertEqual(state['status'], outcome)
            self.assertEqual(state['attempts'], 0)
            self.assertNotIn('attempted_at', state)
            self.assertEqual(state['gap_since'], NOW - guard.REVIVE_AFTER_MS - 1)
            self.mocks[5].reset_mock()

    def test_changed_pin_does_not_reuse_previous_gap(self):
        state = guard.sample({'session_id': OTHER, 'gap_since': 1, 'attempts': 3}, NOW)
        self.assertEqual(state['status'], 'gap_grace')
        self.assertNotIn('attempts', state)
        self.mocks[4].assert_not_called()

    def test_probe_failure_is_unknown_and_does_not_trigger_recovery(self):
        self.mocks[1].side_effect = OSError('ps unavailable')
        state = guard.sample(self.gap(), NOW)
        self.assertEqual(state['status'], 'probe_failed')
        self.mocks[4].assert_not_called()

    def test_ambiguous_target_alarms_without_delivery(self):
        self.mocks[2].side_effect = ValueError('desktop_target_ambiguous')
        state = guard.sample(self.gap(), NOW)
        guard.sample(state, NOW + 10_000)
        self.mocks[4].assert_not_called()
        self.mocks[5].assert_called_once()


class TargetTests(unittest.TestCase):
    def test_desktop_mapping_uses_existing_pointer_writer_fields(self):
        # Real Desktop pointer: sessionId + cliSessionId + isArchived, not title.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            directory = root / 'workspace' / 'account'
            directory.mkdir(parents=True)
            file = directory / f'{DESKTOP}.json'
            file.write_text(json.dumps({'sessionId': DESKTOP, 'cliSessionId': SESSION, 'isArchived': False}))
            with patch.object(guard, 'DESKTOP_SESSIONS', root):
                self.assertEqual(guard.desktop_target(SESSION), DESKTOP)
                with self.assertRaises(ValueError):
                    guard.desktop_target(OTHER)
                file.write_text(json.dumps({'sessionId': DESKTOP, 'cliSessionId': SESSION, 'isArchived': True}))
                with self.assertRaises(ValueError):
                    guard.desktop_target(SESSION)

    def test_no_discovery_or_unregistered_target(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            registered = root / 'registered.txt'
            registered.write_text(OTHER + '\n')
            with patch.object(wake, 'CLAUDE_PROJECT', root), patch.object(wake, 'YANQIU_SESSIONS_FILE', registered), patch.object(wake, 'load_watchdog', return_value={'session_file': str(root / f'{SESSION}.jsonl')}):
                with self.assertRaisesRegex(ValueError, 'target_unregistered'):
                    guard.pinned_target()

    def test_safe_status_omits_session_and_text(self):
        with patch.object(wake, 'load_json', return_value={'status': 'healthy', 'session_id': SESSION, 'prompt': 'secret'}):
            report = guard.status()
        self.assertNotIn('session_id', report)
        self.assertNotIn('prompt', report)


class QueueRegressionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.stack = ExitStack()
        self.stack.enter_context(patch.object(wake, 'RUNTIME', self.root))
        for key, value in (
            ('STATE', self.root / 'cursor.json'),
            ('WATCHDOG_STATE', self.root / 'clock.json'),
            ('CLAIM_LOG', self.root / 'claims.jsonl'),
            ('LEGACY_STATE', self.root / 'unused-cursor.json'),
            ('LEGACY_WATCHDOG_STATE', self.root / 'unused-clock.json'),
        ):
            self.stack.enter_context(patch.object(wake, key, value))
        self.stack.enter_context(patch.object(wake, 'SOURCES', {k: self.root / f'{k}.jsonl' for k in wake.SOURCES}))
        self.stack.enter_context(patch.object(wake, 'now_ms', return_value=NOW))
        self.stack.enter_context(patch.object(wake, 'record_desire_shadow'))
        self.activity = self.stack.enter_context(patch.object(wake, 'inspect_visible_activity', return_value={'session_file': '/fixed.jsonl', 'last_activity': NOW - 3_300_000}))
        wake.save_state({key: 0 for key in wake.SOURCES})

    def tearDown(self):
        self.stack.close()
        self.tmp.cleanup()

    def test_55_minute_rescue_stays_durable_and_no_retry_while_pending(self):
        before = wake.STATE.read_bytes()
        wake.watchdog()
        records = [json.loads(row) for row in wake.SOURCES['heartbeat'].read_text().splitlines()]
        self.assertEqual(records[0]['kind'], 'heartbeat_rescue')
        self.assertEqual(wake.STATE.read_bytes(), before)
        with patch.object(wake, 'now_ms', return_value=NOW + wake.RESCUE_RETRY_AFTER_MS):
            wake.watchdog()
        self.assertEqual(wake.pending_counts(wake.load_state())['heartbeat'], 1)
        self.assertTrue(wake.load_watchdog()['awaiting_sentinel'])

    def test_claimed_rescue_gets_exactly_one_retry(self):
        wake.watchdog()
        state = wake.load_state()
        state['heartbeat'] = 1
        wake.save_state(state)
        with patch.object(wake, 'now_ms', return_value=NOW + wake.RESCUE_RETRY_AFTER_MS):
            wake.watchdog()
            wake.watchdog()
        records = [json.loads(row) for row in wake.SOURCES['heartbeat'].read_text().splitlines()]
        self.assertEqual([r['kind'] for r in records], ['heartbeat_rescue', 'heartbeat_retry'])

    def test_lisa_or_thinking_cannot_postpone_clock(self):
        for content in ([{'type': 'text', 'text': 'hello'}], [{'type': 'thinking', 'thinking': 'private'}]):
            self.assertEqual(wake.visible_activity_at({'message': {'role': 'user', 'content': content}, 'timestamp': '2026-11-01T12:00:00Z'}), 0)
        self.assertEqual(wake.visible_activity_at({'message': {'role': 'assistant', 'content': [{'type': 'thinking', 'thinking': 'private'}]}, 'timestamp': '2026-11-01T12:00:00Z'}), 0)


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.runtime = self.root / 'yanqiu-wake'
        self.runtime.mkdir()
        self.source = self.root / 'source'
        self.source.mkdir()
        for name in installer.FILES:
            (self.source / name).write_bytes((ROOT / 'tools/yanqiu-wake' / name).read_bytes())
        self.legacy = self.root / 'relay/wake_queue.py'
        self.legacy.parent.mkdir()
        self.legacy.write_text('legacy\n')
        (self.runtime / 'wake_queue.py').write_text('previous\n')
        self.cursor = self.runtime / '.wake_cursor.json'
        self.cursor.write_text('{"heartbeat":900}\n')
        self.stack = ExitStack()
        for key, value in (('SOURCE', self.source), ('LISA_ROOT', self.root), ('RUNTIME', self.runtime), ('ENTRYPOINTS', (self.legacy,))):
            self.stack.enter_context(patch.object(installer, key, value))
        self.launch = self.stack.enter_context(patch.object(installer.subprocess, 'run'))
        native = self.root / 'built.app'
        native.mkdir()
        (native / 'payload').write_text('compiled app')
        self.stack.enter_context(patch.object(installer, 'build_native', return_value=native))

    def tearDown(self):
        self.stack.close()
        self.tmp.cleanup()

    def test_dry_run_does_not_copy_or_restart(self):
        self.assertFalse(installer.install(dry_run=True)['installed'])
        self.assertEqual(self.legacy.read_text(), 'legacy\n')
        self.launch.assert_not_called()

    def test_install_preserves_queue_and_backs_up_entrypoints(self):
        result = installer.install()
        self.assertTrue(result['installed'])
        self.assertEqual(self.cursor.read_text(), '{"heartbeat":900}\n')
        self.assertIn('os.execv', self.legacy.read_text())
        originals = json.loads((Path(result['backup']) / 'manifest.json').read_text())
        self.assertEqual(Path(originals[str(self.legacy)]).read_text(), 'legacy\n')
        self.assertEqual(Path(originals[str(self.runtime / 'wake_queue.py')]).read_text(), 'previous\n')
        self.launch.assert_called_once()

    def test_failed_reload_restores_previous_scripts(self):
        self.launch.side_effect = OSError('launchd unavailable')
        with self.assertRaises(OSError):
            installer.install()
        self.assertEqual(self.legacy.read_text(), 'legacy\n')
        self.assertEqual((self.runtime / 'wake_queue.py').read_text(), 'previous\n')
        self.assertFalse((self.runtime / 'sentinel_guard.py').exists())
        self.assertEqual(self.cursor.read_text(), '{"heartbeat":900}\n')


if __name__ == '__main__':
    unittest.main()
