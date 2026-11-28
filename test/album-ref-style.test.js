const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 群友 2026-11-28「相册里的图都是写实的，人格档案馆选的是照参考图」「一个u一个c画成两个c」
assert(/const styleRef = !her && !faceShot && char\.photoStyle === "reference" && !!char\.refPhoto;/.test(app), "照参考图画风的空景也带上参考图");
assert(/styleRef \? \[char\.refPhoto\] : null/.test(app));
assert(/refPhoto: profile\.refPhoto, photoStyle: char\.photoStyle \}/.test(app), "拍她的那张也跟TA的画风");
assert(/\(charNamed && herNamed\)/.test(app), "两个人都点了名就是合照");
console.log("ok album-ref-style");
