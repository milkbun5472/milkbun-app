const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("角色没传头像用程序画的那张，不从头像池拿", () => {
  const fn = comp.slice(comp.indexOf("function avatarSrcOf"), comp.indexOf("\n}", comp.indexOf("function avatarSrcOf")));
  assert.ok(fn.includes("avatarArt(seed)") && !fn.includes("autoAvatarSrc("));
  const av = comp.slice(comp.indexOf("function Avatar({"), comp.indexOf("function Eyebrow("));
  assert.ok(av.includes("src: avatarSrcOf(character)") && !av.includes("autoAvatarSrc("));
});
