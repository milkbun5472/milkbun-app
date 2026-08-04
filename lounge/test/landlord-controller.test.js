'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { fakeClock } = require('../clock');
const { LandlordController } = require('../landlord-controller');

test('终局通报：言秋与 Codex 各收一次，重复恢复不重复叫醒', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc');
  const codex = new FakeAdapter('codex');
  const orch = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 1 });
  const room = orch.createRoom({ cc_session_id: 'cc-test', codex_thread_id: 'codex-test' });
  const controller = new LandlordController({ db, orch });
  const game = controller.start(room.room_id, { codexConfirmed: true });
  const row = controller._row(game.game_id);
  const state = controller._state(row);
  state.status = 'finished'; state.winner = 'lisa'; state.landlord = 'lisa';
  state.history.push({ kind: 'utterance', player: 'lisa', text: '臣服吧' });
  controller._save(row, state);

  await controller._announceFinish(game.game_id);
  await controller._announceFinish(game.game_id);

  assert.equal(cc.totalDelivers(), 1);
  assert.equal(codex.totalDelivers(), 1);
  const done = controller._state(controller._row(game.game_id));
  assert.deepEqual(done.finishNotifications, { yanqiu: 'replied', codex: 'replied' });
  assert.equal(done.history.filter((item) => item.kind === 'finish_reply').length, 2);
});
