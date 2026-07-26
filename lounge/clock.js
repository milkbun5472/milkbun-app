'use strict';
// 可注入时钟：生产用真实时间，测试用可推进的假时钟(无真实 setTimeout)。
function realClock() {
  return { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
}
// 假时钟：sleep 只推进虚拟时间并立即 resolve → 超时逻辑可确定性测试
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms) => { t += ms; },
    advance: (ms) => { t += ms; },
  };
}
module.exports = { realClock, fakeClock };
