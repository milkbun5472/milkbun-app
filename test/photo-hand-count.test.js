const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("对镜自拍说清手机在镜子里；生图每次都数手", () => {
  assert.ok(eng.includes("举手机的那只手和手机都在镜子里，镜头前面没有别的手伸进画面"));
  assert.ok(eng.includes("【数一数手】画面里每个人一共只有两条胳膊、两只手"));
});
