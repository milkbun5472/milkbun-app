// ═══ 情侣空间·花房（v62.33，她 2026-09-04 拍板做）═══
//
// 花靠什么长——这是这一样东西成不成立的全部：**靠你们真实的相处**，不靠浇水按钮。
// 养料直接蹭抽卡那条已经在跑的事件流：GachaKit.earn 判定「真的相处了一段」给了点数，
// 花就吃同一份（app.js 的 gachaEarn 在 got>0 时顺手喂过来）。不是新机制，
// 是给同一个事件多一个订阅者——判闸（90 分钟一段、日封顶）全在 GachaKit 那头，
// 这儿一条都不重写（一层写在两处的老病）。
//
// 不惩罚：不来它不死，只是打盹，回来就醒——这个 app 从不罚人离开
//（抽屉那页自己写着「这儿不会提醒你」）。
// 开完一茬收一枚干花、再种下一盆——留痕哲学，跟票根一路。
//
// 存档形状（写入方在 app.js 的 saveGarden 一族，测试桩照那儿写）：
// x_coupleGarden: { [charId]: { species, why, color, plantedTs, fed, lastFedTs,
//                               bloomTs, told, kept: [{species, why, color, ts}] } }
(function (root) {
  "use strict";
  // 阶段阈值：一段真聊天 40、一场线下 60、一天打卡 20（GachaKit.EARN 的数）。
  // 到开花约莫要 480——好好过一两个星期的日子，不是一晚上刷出来的。
  const STAGES = [
    { key: "seed",   at: 0,   zh: "刚种下" },
    { key: "sprout", at: 40,  zh: "发芽了" },
    { key: "leaf",   at: 160, zh: "抽了叶" },
    { key: "bud",    at: 320, zh: "含着苞" },
    { key: "bloom",  at: 480, zh: "开花了" }
  ];
  const DOZE_MS = 7 * 86400000;   // 一周没相处＝打盹（只是姿态，不掉任何东西）

  function stageOf(fed) {
    const f = Number(fed) || 0;
    let cur = STAGES[0];
    STAGES.forEach(function (s) { if (f >= s.at) cur = s; });
    return cur;
  }
  // 喂一口：量由调用方给（就是 GachaKit 刚结算出的那份），这儿只累加。
  // 没种花（species 空）就一口都不吃——花是他挑的，不是自动长出来的。
  function feed(g, amount, now) {
    if (!g || !g.species || !(Number(amount) > 0)) return g;
    const fed = (Number(g.fed) || 0) + Number(amount);
    const next = Object.assign({}, g, { fed: fed, lastFedTs: Number(now) || Date.now() });
    if (!next.bloomTs && stageOf(fed).key === "bloom") next.bloomTs = Number(now) || Date.now();
    return next;
  }
  function dozing(g, now) {
    if (!g || !g.species || !g.lastFedTs) return false;
    return (Number(now) || Date.now()) - Number(g.lastFedTs) > DOZE_MS;
  }

  const api = { STAGES: STAGES, DOZE_MS: DOZE_MS, stageOf: stageOf, feed: feed, dozing: dozing };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GardenKit = api;
})(typeof window !== "undefined" ? window : globalThis);
