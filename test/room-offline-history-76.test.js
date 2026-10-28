const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
test("小房间里的线下读这间房自己的聊天（含上一场线下收线那张卡）", () => {
  assert.match(app, /let oCtx = sideRoom \? roomContextFor\(char, scopeKey, sideRoom, \{ queryText:/);
  assert.match(app, /m\.kind === "offlinelog" \? "（你们在这间房里见过一面："/);
  // 收线时那张卡就落在这间房的聊天里（写入方）
  assert.match(app, /pChat\(sideRoom \? scopeKey : charId, p => \[\.\.\.p, \{ role: "system", kind: "offlinelog", content: summary/);
});
