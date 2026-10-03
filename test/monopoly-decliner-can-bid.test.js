// 她 2026-10-03：「为啥竞拍都不给我竞拍直接跳过了」——放弃原价的她也该能举牌
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const g = fs.readFileSync(path.join(__dirname, "..", "js/games.js"), "utf8");

test("放弃原价后拍卖不排除她，交回的竞价单接上", () => {
  assert.match(g, /const aq=runAuction\(ps,os,q\.tile,null,ls,events,lv,q\.extra\);if\(aq\)\{[^\n]*setPending\(aq\);setBusy\(false\);return;\}/);
});
test("她能不能举牌只看现金够不够起拍价，不用角色那套风险估算", () => {
  assert.match(g, /cap:p\.isUser\?Math\.floor\(\(p\.cash\|\|0\)\/10\)\*10:monoAuctionCap\(/);
});
