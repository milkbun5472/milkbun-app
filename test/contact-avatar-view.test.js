const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("通讯录资料页点头像看原图，走全库那一份 ImageViewer（群友 2026-10-26）", () => {
  const i = comp.indexOf("function ContactDetail({"), body = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  assert.match(body, /const avFace = typeof chatFace === "function" \? chatFace\(character\) : character;/);
  assert.match(body, /"data-wk": "cdavatar", onClick: \(\) => \{ if \(avSrc\) setAvBig\(true\); \}/);
  assert.match(body, /h\(ImageViewer, \{ items: \[\{ src: avSrc,[^}]*\}\], at: 0, zoomable: true/);
});
