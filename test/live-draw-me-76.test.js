const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("片刻直播：她自己开播画她、锁她的脸；路人只画景", () => {
  assert.match(R("live.js"), /props\.draw\(s\.mode === "host" \? "me" : s\.mode === "watch" && !s\.stranger \? s\.charId : null, desc\)/);
  const app = R("app.js");
  assert.match(app, /draw: \(charId, desc\) => charId === "me" \? \(canShootMe\(null\) \? drawFromDesc\(meSubject\(null, userName\(profile\)\), desc, "self"\) : drawFromDesc\(null, desc, "none"\)\)/);
  assert.match(app, /closet: char\._closet != null \? char\._closet : closetTextFor\(char\.id\)/);
});
