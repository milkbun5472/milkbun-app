const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 资料室(2026-08-18 Lisa):专访一直只喂角色卡、没有声纹样本(日记有);
// 四个媒体腔换的是戏服不是视角，所以补两块靠真实数据说话的版面。
test("专访接入声纹样本，资料室语录逐字验真、数据本地统计", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /function ownVoiceLines\(material, name\)/, "要能从素材里抽出本人原话");
  assert.match(w, /本周真实说过的话 · 声纹最高优先/, "专访要有声纹样本块");
  assert.match(w, /function weeklyStats\(mat, characters, uName\)/, "统计必须本地算");
  assert.match(w, /数字、人名、词全部照抄，一个都不许改/, "模型只配文，不碰数字");
  assert.match(w, /hay\.indexOf\(q\.text\) > -1/, "语录必须逐字来自真实记录");
  assert.match(w, /type: "desk"/, "资料室要成为一个版块");
  assert.match(w, /QUOTED · 本周语录/);
  assert.match(w, /BY THE NUMBERS/);
});
