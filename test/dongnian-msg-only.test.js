const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("想你时只发消息：开了就不走愿望板和情侣空间两个出口", () => {
  assert.ok(/const _altOut = _cpNow && settingsFor\(cid\)\.dongnianMsgOnly !== true;/.test(app));
  assert.ok(/else if \(_altOut && !charHasOpenWish\(cid\)/.test(app));
  assert.ok(/else if \(_altOut && Math\.random\(\) < COUPLE_LEAVE_P\)/.test(app));
  assert.ok(/dongnianMsgOnly: s\.dongnianMsgOnly === true/.test(app), "存档那一处接住了");
  assert.ok(/      dongnianMsgOnly,/.test(comp) && /"想你时只发消息"/.test(comp));
});
