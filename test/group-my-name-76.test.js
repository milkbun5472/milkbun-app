const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8"), x = fs.readFileSync("js/assistant-extras.js", "utf8");
test("群里我那几条可以挂名字和头衔", () => {
  assert.match(c, /isU && gsp\.showMyName && h\("span", \{\n      "data-wk": "name", "data-me": "1",/);
  assert.match(c, /gRoleTag\(m\), h\("span", \{ style: \{ marginLeft: 4 \} \}, meName\)/);
  assert.match(c, /dispRow\("显示我的名字和头衔", showMyName, setShowMyName\)/);
  assert.match(c, /showMyAvatar: showMyAvatar, showMyName: showMyName,/);
  assert.match(x, /key: "showMyName", zh: "显示我的名字和头衔"/);
});
