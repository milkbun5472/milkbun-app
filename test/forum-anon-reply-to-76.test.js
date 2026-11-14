const test = require("node:test"); const assert = require("node:assert");
const U = require("fs").readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("匿名帖里楼中楼不露网名", () => { assert.match(U, /\(\(post && post\.anon\) \|\| cm\.anon \|\| r\.anon\) \? " 回复 匿名用户" : " 回复 @" \+ r\.toName/); });
