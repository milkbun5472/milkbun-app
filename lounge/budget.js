'use strict';
// 三方会客厅 · 额度预算闸（Step 1，初审修补⑤）
// 施工图 §9 / §1 红线④
//  - max_auto_turns: 明确启动的自动 run 上限(一次 runOneEach = 1)；用尽→自动禁用
//  - daily_char_cap / daily_call_cap: 当日字符/调用软上限，达70%黄、达90%禁自动；手动主持仍可用(§9)
const WARN_RATIO = 0.7;
const DISABLE_RATIO = 0.9;

function ratioOf(used, cap) { return cap > 0 ? used / cap : 0; }

// level: 'ok' | 'warn' | 'disabled'
function budgetState(room) {
  const autoExhausted = room.auto_turns_used >= room.max_auto_turns;
  const charRatio = ratioOf(room.usage_today, room.daily_char_cap);
  const callRatio = ratioOf(room.calls_today, room.daily_call_cap);
  const ratio = Math.max(charRatio, callRatio);
  const dailyDisabled = ratio >= DISABLE_RATIO;

  let level = 'ok';
  if (ratio >= WARN_RATIO) level = 'warn';
  if (autoExhausted || dailyDisabled) level = 'disabled';

  return {
    level,
    autoExhausted,
    dailyDisabled,
    ratio,
    charRatio,
    callRatio,
    autoAllowedDaily: !dailyDisabled,
    autoTurnsLeft: Math.max(0, room.max_auto_turns - room.auto_turns_used),
  };
}

module.exports = { budgetState, ratioOf, WARN_RATIO, DISABLE_RATIO };
