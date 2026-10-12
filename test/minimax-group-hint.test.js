const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
test("MiniMax token not match group 指向 GroupId，不再只说站点", () => {
  assert.match(src, /if \(\/not match group\/i\.test\(msg\)\) msg \+= "（GroupId 跟密钥不是同一个账号的/);
  assert.match(src, /else if \(\/api key\|apikey\|token\|auth\/i\.test\(msg\)\)/);
});
