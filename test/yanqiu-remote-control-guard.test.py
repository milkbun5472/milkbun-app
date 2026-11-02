import json
import os
import fcntl
import plistlib
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'tools/yanqiu-wake'))
import remote_control_guard as rc
import sentinel_guard as guard
import wake_queue as wake

SESSION = '11111111-1111-4111-8111-111111111111'
DESKTOP = 'local_33333333-3333-4333-8333-333333333333'
OTHER = 'local_44444444-4444-4444-8444-444444444444'
NOW = 1_800_000_000_000


class RemoteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.stack = ExitStack()
        self.metadata = {'sessionId': DESKTOP, 'cliSessionId': SESSION,
                         'remoteControlUserEnabled': True, 'isArchived': False}
        self.target = self.stack.enter_context(patch.object(rc, 'inspect_target', return_value=(DESKTOP, SESSION, 20, self.metadata)))
        self.native = self.stack.enter_context(patch.object(rc, 'native', return_value='remote_on'))
        self.save = self.stack.enter_context(patch.object(rc, 'save'))
        self.alert = self.stack.enter_context(patch.object(wake, 'notify_sentinel_gap'))
        self.stack.enter_context(patch.object(guard, 'NATIVE_DISABLED', self.root / 'disabled'))

    def tearDown(self):
        self.stack.close()
        self.tmp.cleanup()

    def sample(self, state=None, elapsed=0, scope=None, local='healthy'):
        return rc.sample(state or {}, scope if scope is not None else {'desktop_id': DESKTOP}, local, NOW + elapsed)

    def test_no_opt_in_does_not_inspect_or_connect(self):
        self.assertEqual(self.sample(scope={})['status'], 'disabled')
        self.target.assert_not_called()
        self.native.assert_not_called()

    def test_only_the_exact_opted_in_original_can_connect(self):
        self.assertEqual(self.sample(scope={'desktop_id': OTHER})['status'], 'out_of_scope')
        self.native.assert_not_called()

    def test_initial_on_then_confirmation_then_passive_periodic_check(self):
        state = self.sample()
        self.assertEqual(state['status'], 'confirming')
        self.sample(state, 10_000)
        self.assertEqual(self.native.call_count, 1)
        state = self.sample(state, rc.CONFIRM_MS)
        self.assertEqual(state['status'], 'remote_on')
        self.sample(state, 86_400_000)
        self.assertEqual([c.kwargs['probe'] for c in self.native.call_args_list], [False, True, True])
        self.assertTrue(self.native.call_args_list[-1].kwargs['passive'])
        self.assertEqual({c.args[0] for c in self.native.call_args_list}, {DESKTOP})

    def test_success_is_confirmed_after_switch_settles(self):
        self.native.side_effect = ['remote_restored', 'remote_on']
        state = self.sample()
        self.assertEqual(state['status'], 'confirming')
        self.assertNotIn('verified_at', state)
        state = self.sample(state, rc.CONFIRM_MS)
        self.assertEqual(state['verified_at'], NOW + rc.CONFIRM_MS)

    def test_new_backend_gets_its_own_connection_check(self):
        state = self.sample()
        state = self.sample(state, rc.CONFIRM_MS)
        self.target.return_value = (DESKTOP, SESSION, 99, self.metadata)
        state = self.sample(state, 50_000)
        self.assertEqual(state['status'], 'confirming')
        self.assertEqual(self.native.call_count, 3)

    def test_explicit_session_off_is_never_overridden(self):
        self.metadata['remoteControlUserEnabled'] = False
        self.assertEqual(self.sample()['status'], 'disabled_in_session')
        self.native.assert_not_called()

    def test_manual_reenable_can_be_observed_again(self):
        state = {'backend_key': f'{SESSION}:20', 'status': 'disabled_in_session', 'attempted_at': 1}
        self.assertEqual(self.sample(state)['status'], 'confirming')
        self.native.assert_called_once_with(DESKTOP, probe=False)

    def test_permission_gate_does_not_start_a_native_action(self):
        guard.NATIVE_DISABLED.touch()
        self.assertEqual(self.sample()['status'], 'awaiting_permission')
        self.native.assert_not_called()

    def test_local_revival_is_a_separate_prerequisite(self):
        state = self.sample(local='awaiting_rearm')
        self.assertEqual(state['status'], 'waiting_local')
        self.target.assert_not_called()
        self.native.assert_not_called()

    def test_unreliable_target_never_uses_a_recent_other_session(self):
        self.target.side_effect = ValueError('ambiguous target')
        self.assertEqual(self.sample()['status'], 'probe_failed')
        self.native.assert_not_called()

    def test_uncertain_timeout_does_not_repeat_connection_action(self):
        self.native.side_effect = [subprocess.TimeoutExpired('app', 25), 'remote_unknown', 'remote_off', 'remote_unknown']
        state = self.sample()
        state = self.sample(json.loads(json.dumps(state)), rc.CONFIRM_MS)
        state = self.sample(state, rc.FAIL_AFTER_MS)
        self.assertEqual(state['status'], 'needs_attention')
        self.sample(state, 86_400_000)
        self.assertEqual([c.kwargs['probe'] for c in self.native.call_args_list], [False, True, True, True])
        self.assertTrue(self.native.call_args_list[-1].kwargs['passive'])
        self.alert.assert_called_once_with(remote=True)

    def test_busy_and_draft_defer_without_spending_action(self):
        for outcome in ('busy', 'draft_present'):
            self.native.reset_mock()
            self.native.side_effect = [outcome, 'remote_on']
            state = self.sample()
            self.assertNotIn('attempted_at', state)
            self.sample(state, 30_000)
            self.assertEqual(self.native.call_count, 1)
            self.assertEqual(self.sample(state, 60_000)['status'], 'confirming')
            self.assertEqual([c.kwargs['probe'] for c in self.native.call_args_list], [False, False])

    def test_initial_noop_on_does_not_spend_single_real_enable(self):
        self.native.side_effect = ['remote_on', 'remote_off', 'remote_restored', 'remote_on']
        state = self.sample()
        state = self.sample(state, rc.CONFIRM_MS)
        self.assertEqual(state['status'], 'confirming')
        state = self.sample(state, 2 * rc.CONFIRM_MS)
        self.assertEqual(state['status'], 'remote_on')
        self.assertEqual([c.kwargs['probe'] for c in self.native.call_args_list], [False, True, False, True])

    def test_pending_connection_gets_no_second_enable(self):
        self.native.side_effect = ['remote_waiting', 'remote_off', 'remote_off']
        state = self.sample()
        state = self.sample(state, rc.CONFIRM_MS)
        state = self.sample(state, rc.FAIL_AFTER_MS)
        self.assertEqual(state['status'], 'needs_attention')
        self.assertEqual([c.kwargs['probe'] for c in self.native.call_args_list], [False, True, True])

    def test_periodic_proven_disconnect_allows_one_new_repair(self):
        self.native.side_effect = ['remote_on', 'remote_on', 'remote_off', 'remote_restored', 'remote_on']
        state = self.sample()
        state = self.sample(state, rc.CONFIRM_MS)
        state = self.sample(state, rc.CONFIRM_MS + rc.RECHECK_MS)
        self.assertEqual(state['status'], 'confirming')
        self.assertTrue(self.native.call_args_list[2].kwargs['passive'])
        self.assertFalse(self.native.call_args_list[3].kwargs['probe'])
        state = self.sample(state, 2 * rc.CONFIRM_MS + rc.RECHECK_MS)
        self.assertEqual(state['status'], 'remote_on')

    def test_hidden_ui_is_unobserved_and_never_used_as_proof_of_disconnect(self):
        self.native.side_effect = ['remote_on', 'remote_on', 'remote_hidden', 'remote_on']
        state = self.sample()
        state = self.sample(state, rc.CONFIRM_MS)
        state = self.sample(state, rc.CONFIRM_MS + rc.RECHECK_MS)
        self.assertEqual(state['status'], 'unobserved')
        state = self.sample(state, rc.CONFIRM_MS + 2 * rc.RECHECK_MS)
        self.assertEqual(state['status'], 'remote_on')
        self.assertEqual(sum(not c.kwargs['probe'] for c in self.native.call_args_list), 1)


class ScopeAndStatusTests(unittest.TestCase):
    def test_enabled_scope_is_private_and_does_not_change_global_settings(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            root = Path(directory)
            scope = root / 'scope.json'; state = root / 'state.json'
            stack.enter_context(patch.object(rc, 'SCOPE', scope))
            stack.enter_context(patch.object(rc, 'STATE', state))
            stack.enter_context(patch.object(guard, 'LOCK', root / 'lock'))
            stack.enter_context(patch.object(wake, 'RUNTIME', root))
            stack.enter_context(patch.object(rc, 'inspect_target', return_value=(DESKTOP, SESSION, 20, {'remoteControlUserEnabled': True})))
            native = stack.enter_context(patch.object(rc, 'native', return_value='remote_on'))
            with patch('builtins.print'):
                rc.enable()
            self.assertEqual(json.loads(scope.read_text()), {'desktop_id': DESKTOP})
            self.assertEqual(scope.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(state.read_text())['status'], 'pending')
            native.assert_called_once_with(DESKTOP, probe=True)
            self.assertEqual({p.name for p in root.iterdir()}, {'scope.json', 'state.json', 'lock'})

    def test_status_does_not_print_session_ids_or_remote_links(self):
        with patch.object(wake, 'load_json', side_effect=[{'status': 'remote_on', 'backend_key': SESSION}, {'desktop_id': DESKTOP}]):
            report = rc.status()
        self.assertEqual(report['status'], 'remote_on')
        self.assertNotIn(SESSION, json.dumps(report))
        self.assertNotIn(DESKTOP, json.dumps(report))


@unittest.skipUnless(sys.platform == 'darwin', 'native connection decision')
class NativeDecisionTests(unittest.TestCase):
    def test_already_on_and_unknown_never_plan_a_toggle(self):
        source = (ROOT / 'tools/yanqiu-wake/rearm.applescript').read_text()
        start = source.index('on remoteAction(')
        end = source.index('end remoteAction', start) + len('end remoteAction')
        self.assertGreater(end, start)
        for current, enabled, probe, expected in (
            ('remote_on', True, False, 'remote_on'),
            ('remote_on', True, True, 'remote_on'),
            ('remote_unknown', True, False, 'remote_unknown'),
            ('remote_off', False, False, 'remote_unavailable'),
            ('remote_off', True, True, 'remote_off'),
            ('remote_off', True, False, 'enable'),
        ):
            with self.subTest(current=current, enabled=enabled, probe=probe), tempfile.TemporaryDirectory() as d:
                script = source[start:end] + f'\non run\nreturn my remoteAction("{current}", {str(enabled).lower()}, {str(probe).lower()})\nend run\n'
                p = Path(d) / 'decision.applescript'; p.write_text(script)
                result = subprocess.run(['/usr/bin/osascript', str(p)], capture_output=True, text=True, check=True, timeout=4)
                self.assertEqual(result.stdout.strip(), expected)

    def test_passive_check_does_not_open_foreground_hidden_details(self):
        source = (ROOT / 'tools/yanqiu-wake/rearm.applescript').read_text()
        start = source.index('on passiveRemoteProbe(')
        end = source.index('end passiveRemoteProbe', start) + len('end passiveRemoteProbe')
        for foreground, page, toggle, expected in (
            (True, True, False, 'remote_hidden:0'),
            (True, True, True, 'remote_on:1'),
            (False, True, False, 'remote_on:1'),
            (False, False, False, 'wrong_window:0'),
        ):
            with self.subTest(foreground=foreground, page=page, toggle=toggle), tempfile.TemporaryDirectory() as directory:
                fixture = f'''use framework "Foundation"
property calls : 0
on snapshotFor(targetID)
 set s to current application's NSMutableDictionary's dictionary()
 s's setObject:"wrong_window" forKey:"status"
 s's setObject:{str(foreground).lower()} forKey:"foreground"
 if {str(page).lower()} then s's setObject:{{1}} forKey:"page"
 if {str(toggle).lower()} then s's setObject:{{1}} forKey:"remote_toggle"
 return s
end snapshotFor
on restoreRemote(targetID, probeOnly)
 set my calls to my calls + 1
 return "remote_on"
end restoreRemote
{source[start:end]}
on run
 return (my passiveRemoteProbe("fixture")) & ":" & (my calls as text)
end run
'''
                path = Path(directory) / 'passive.applescript'; path.write_text(fixture)
                result = subprocess.run(['/usr/bin/osascript', str(path)], check=True, capture_output=True, text=True, timeout=4)
                self.assertEqual(result.stdout.strip(), expected)


class NativeTransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name)
        self.stack = ExitStack()
        app = self.root / 'native.app'; app.mkdir()
        self.stack.enter_context(patch.object(guard, 'NATIVE_APP', app))
        self.stack.enter_context(patch.object(guard, 'NATIVE_LOCK', self.root / 'native.lock'))
        self.stack.enter_context(patch.object(wake, 'RUNTIME', self.root))
        self.run = self.stack.enter_context(patch.object(guard.subprocess, 'run', side_effect=self.reply))
        self.wrong_nonce = False

    def tearDown(self):
        self.stack.close(); self.tmp.cleanup()

    def reply(self, *args, **kwargs):
        request = plistlib.loads((self.root / '.sentinel_native_request.plist').read_bytes())
        reply = {'nonce': 'wrong' if self.wrong_nonce else request['nonce'], 'outcome': 'remote_on'}
        (self.root / '.sentinel_native_reply.plist').write_bytes(plistlib.dumps(reply))

    def test_remote_operation_is_not_encoded_as_a_wake_message(self):
        self.assertEqual(guard.native_call(DESKTOP, mode='remote-probe'), 'remote_on')
        request = plistlib.loads((self.root / '.sentinel_native_request.plist').read_bytes())
        self.assertEqual(request['mode'], 'remote-probe')
        self.assertEqual(request['target'], DESKTOP)
        self.assertNotIn('prompt', request)

    def test_bad_mode_and_foreign_reply_fail_closed(self):
        with self.assertRaises(ValueError):
            guard.native_call(DESKTOP, mode='unknown')
        self.run.assert_not_called()
        self.wrong_nonce = True
        self.assertEqual(guard.native_call(DESKTOP, mode='remote-recover'), 'adapter_failed')

    def test_another_native_request_gets_busy_without_overwriting_it(self):
        with guard.NATIVE_LOCK.open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(guard.native_call(DESKTOP, mode='remote-probe'), 'busy')
        self.run.assert_not_called()
        self.assertFalse((self.root / '.sentinel_native_request.plist').exists())


if __name__ == '__main__':
    unittest.main()
