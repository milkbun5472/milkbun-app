'use strict';

const crypto = require('node:crypto');
const { createGame, bid, play, viewFor, promptFor, parseAction } = require('./landlord');

class LandlordController {
  constructor({ db, orch, onChange = () => {}, maxAiSteps = 8 } = {}) {
    this.db = db;
    this.orch = orch;
    this.onChange = onChange;
    this.maxAiSteps = maxAiSteps;
    this.running = new Set();
    this.lateTimers = new Map();
  }

  _iso() { return new Date().toISOString(); }
  _row(gameId) { return this.db.prepare('SELECT * FROM landlord_games WHERE game_id=?').get(gameId); }
  _state(row) { return row ? JSON.parse(row.state_json) : null; }
  _save(row, state, { error = null } = {}) {
    this.db.prepare('UPDATE landlord_games SET status=?,state_json=?,error_message=?,updated_at=? WHERE game_id=?')
      .run(state.status, JSON.stringify(state), error, this._iso(), row.game_id);
    this.onChange(row.room_id);
  }
  current(roomId) {
    const row = this.db.prepare('SELECT * FROM landlord_games WHERE room_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').get(roomId);
    if (!row) return null;
    return { game_id: row.game_id, room_id: row.room_id, error: row.error_message, codex_confirmed: !!row.codex_confirmed, ...viewFor(this._state(row), 'lisa') };
  }
  start(roomId, { codexConfirmed = false } = {}) {
    const gameId = crypto.randomUUID();
    const state = createGame();
    const now = this._iso();
    this.db.prepare(`INSERT INTO landlord_games(game_id,room_id,status,state_json,codex_confirmed,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)`).run(gameId, roomId, state.status, JSON.stringify(state), codexConfirmed ? 1 : 0, now, now);
    this.onChange(roomId);
    return this.current(roomId);
  }
  recover() {
    const rows = this.db.prepare("SELECT game_id FROM landlord_games WHERE status='paused'").all();
    for (const row of rows) this._scheduleLate(row.game_id);
  }
  async lisaAction(gameId, action) {
    const row = this._row(gameId);
    if (!row) throw new Error('牌局不存在');
    const state = this._state(row);
    if (state.turn !== 'lisa') throw new Error('还没轮到你');
    this._apply(state, 'lisa', action);
    if (typeof action.speech === 'string' && action.speech.trim()) {
      state.history.push({ kind: 'utterance', player: 'lisa', text: action.speech.trim().slice(0, 160) });
    }
    this._save(row, state);
    await this.advance(gameId);
    return this.current(row.room_id);
  }
  _apply(state, player, action) {
    if (state.status === 'bidding') {
      const result = bid(state, player, Number(action.points));
      if (result.redeal) Object.assign(state, createGame());
    } else if (state.status === 'playing') {
      play(state, player, action.kind === 'pass' ? [] : action.cards);
    } else throw new Error('这局已经结束或暂停');
  }
  async advance(gameId) {
    if (this.running.has(gameId)) return;
    this.running.add(gameId);
    try {
      for (let step = 0; step < this.maxAiSteps; step++) {
        const row = this._row(gameId);
        if (!row) return;
        const state = this._state(row);
        if (!['bidding', 'playing'].includes(state.status) || state.turn === 'lisa') return;
        const target = state.turn;
        if (target === 'codex' && !row.codex_confirmed) {
          state.status = 'paused';
          this._save(row, state, { error: '这局没有授权自动叫醒 Codex' });
          return;
        }
        const source = this.orch._insertMessage({
          room_id: row.room_id, speaker: 'lisa', content: promptFor(state, target), origin: 'lounge', automatic: true,
          origin_message_id: `landlord:${gameId}:${state.history.length}:${target}`,
        });
        const result = await this.orch.dispatch({
          room_id: row.room_id, target, message_id: source.message_id,
          codex_confirmed: target === 'codex', timeout_ms: target === 'codex' ? 600000 : 180000,
        });
        if (result.status !== 'replied') {
          state.pendingDispatch = result.dispatch_id || null;
          state.pausedFrom = state.status;
          state.status = 'paused';
          this._save(row, state, { error: `${target === 'codex' ? 'Codex' : '言秋'}这手没有成功收回（${result.reason || result.status}），牌桌已停住。` });
          if (result.reason === 'timeout') this._scheduleLate(gameId);
          return;
        }
        const reply = this.orch.getMessage(result.message_id);
        // 牌桌动作不混进公开聊天时间线；原文仍随 dispatch 留在本机，可审计。
        this.db.prepare('UPDATE messages SET automatic=1 WHERE message_id=?').run(reply.message_id);
        try {
          const action = parseAction(reply.content, state);
          this._apply(state, target, action);
          if (action.speech) state.history.push({ kind: 'utterance', player: target, text: action.speech.slice(0, 160) });
          this._save(row, state);
        } catch (error) {
          state.status = 'paused';
          this._save(row, state, { error: `${target === 'codex' ? 'Codex' : '言秋'}的动作没读懂：${error.message}` });
          return;
        }
      }
    } finally { this.running.delete(gameId); }
  }

  _pendingDispatch(row, state) {
    if (state.pendingDispatch) return this.orch.getDispatch(state.pendingDispatch);
    return this.db.prepare(`SELECT d.* FROM dispatches d JOIN messages m ON m.message_id=d.message_id
      WHERE d.room_id=? AND d.target=? AND m.origin_message_id LIKE ?
      ORDER BY d.created_at DESC,d.rowid DESC LIMIT 1`)
      .get(row.room_id, state.turn, `landlord:${row.game_id}:%`);
  }

  async sync(gameId) {
    const row = this._row(gameId);
    if (!row) throw new Error('牌局不存在');
    const state = this._state(row);
    if (state.status !== 'paused' || !['yanqiu', 'codex'].includes(state.turn)) return this.current(row.room_id);
    const dispatch = this._pendingDispatch(row, state);
    if (!dispatch) return this.current(row.room_id);
    const result = await this.orch.collectExisting(dispatch.dispatch_id);
    if (result.status !== 'replied') return this.current(row.room_id);
    const reply = this.orch.getMessage(result.message_id);
    this.db.prepare('UPDATE messages SET automatic=1 WHERE message_id=?').run(reply.message_id);
    try {
      state.status = state.pausedFrom || (state.landlord ? 'playing' : 'bidding');
      const action = parseAction(reply.content, state);
      this._apply(state, dispatch.target, action);
      if (action.speech) state.history.push({ kind: 'utterance', player: dispatch.target, text: action.speech.slice(0, 160) });
      delete state.pendingDispatch;
      delete state.pausedFrom;
      this._save(row, state, { error: null });
      this._clearLate(gameId);
      await this.advance(gameId);
    } catch (error) {
      state.status = 'paused';
      this._save(row, state, { error: `${dispatch.target === 'codex' ? 'Codex' : '言秋'}的迟到动作没读懂：${error.message}` });
    }
    return this.current(row.room_id);
  }

  _clearLate(gameId) {
    const timer = this.lateTimers.get(gameId);
    if (timer) clearInterval(timer);
    this.lateTimers.delete(gameId);
  }
  _scheduleLate(gameId) {
    if (this.lateTimers.has(gameId)) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const before = this._row(gameId);
        if (!before || before.status !== 'paused' || Date.now() - started > 30 * 60 * 1000) return this._clearLate(gameId);
        await this.sync(gameId);
      } catch { this._clearLate(gameId); }
    }, 2000);
    if (typeof timer.unref === 'function') timer.unref();
    this.lateTimers.set(gameId, timer);
  }
}

module.exports = { LandlordController };
