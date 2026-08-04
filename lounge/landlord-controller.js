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
  async lisaAction(gameId, action) {
    const row = this._row(gameId);
    if (!row) throw new Error('牌局不存在');
    const state = this._state(row);
    if (state.turn !== 'lisa') throw new Error('还没轮到你');
    this._apply(state, 'lisa', action);
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
          state.status = 'paused';
          this._save(row, state, { error: `${target === 'codex' ? 'Codex' : '言秋'}这手没有成功收回（${result.reason || result.status}），牌桌已停住。` });
          return;
        }
        const reply = this.orch.getMessage(result.message_id);
        // 牌桌动作不混进公开聊天时间线；原文仍随 dispatch 留在本机，可审计。
        this.db.prepare('UPDATE messages SET automatic=1 WHERE message_id=?').run(reply.message_id);
        try {
          const action = parseAction(reply.content, state);
          this._apply(state, target, action);
          state.history.push({ kind: 'utterance', player: target, text: reply.content.slice(0, 300) });
          this._save(row, state);
        } catch (error) {
          state.status = 'paused';
          this._save(row, state, { error: `${target === 'codex' ? 'Codex' : '言秋'}的动作没读懂：${error.message}` });
          return;
        }
      }
    } finally { this.running.delete(gameId); }
  }
}

module.exports = { LandlordController };
