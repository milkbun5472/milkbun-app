const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("换了情头，查他手机时他的微信头像和他微信里你的头像跟着换（群友 2026-10-26）", () => {
  const i = ui.indexOf("function WeChatViewFull"), body = ui.slice(i, ui.indexOf("\nfunction ", i + 10));
  assert.match(body, /const selfFace = typeof chatFace === "function" \? chatFace\(char\) : char;/);
  assert.match(body, /const herAv = \(char && char\.myChatAvatar\) \|\| \(profile && profile\.avatarImage\);/);
  assert.doesNotMatch(body, /avatarImage: profile && profile\.avatarImage/);
  assert.doesNotMatch(body, /h\(Avatar, \{ character: char,/);
  assert.match(body, /selfNames\.has\(m\.from\) \? selfFace\.avatarImage : m\.from === meName \? herAv/);
  assert.match(app, /avatarImage: char\.myChatAvatar \|\| profile\.avatarImage/);
});
