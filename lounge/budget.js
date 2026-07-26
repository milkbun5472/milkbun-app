'use strict';
// 三方会客厅 · 额度预算闸（Step 1，优先级①）
// 施工图 §9 额度保护 / §1 红线④禁止无上限互聊
//  - max_auto_turns: 自动编排硬上限(默认2)，用尽→自动模式禁用
//  - daily_char_cap: 单房间每日软上限，达70%黄、达90%禁自动；手动主持仍可用(§9)

const WARN_RATIO = 0.7;
const DISABLE_RATIO = 0.9;

// level: 'ok' | 'warn' | 'disabled'
function budgetState(room) {
  const autoExhausted = room.auto_turns_used >= room.max_auto_turns;
  let charRatio = 0;
  if (room.daily_char_cap > 0) charRatio = room.chars_used_today / room.daily_char_cap;

  let level = 'ok';
  if (charRatio >= WARN_RATIO) level = 'warn';
  if (autoExhausted || charRatio >= DISABLE_RATIO) level = 'disabled';

  return {
    level,
    autoExhausted,
    charRatio,
    autoAllowed: !autoExhausted && charRatio < DISABLE_RATIO,
    autoTurnsLeft: Math.max(0, room.max_auto_turns - room.auto_turns_used),
  };
}

// 一次自动棒能不能发。手动主持(§9)不受 auto 上限约束，只被硬停/停止状态挡。
function canDispatch(room, { automatic }) {
  if (room.status === 'stopped') return { ok: false, reason: 'room_stopped' };
  if (room.pause_requested && automatic) return { ok: false, reason: 'paused' };
  if (!automatic) return { ok: true };               // 手动主持始终可发一棒
  const b = budgetState(room);
  if (!b.autoAllowed) {
    return { ok: false, reason: b.autoExhausted ? 'auto_turns_exhausted' : 'daily_char_cap' };
  }
  return { ok: true };
}

module.exports = { budgetState, canDispatch, WARN_RATIO, DISABLE_RATIO };
