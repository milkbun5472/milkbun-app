// 群友 2026-10-14：一起读正文字体能换成系统字体
const assert = require("node:assert/strict");
const r = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "read.js"), "utf8");
assert.match(r, /"data-wk": "readfont"/);
assert.match(r, /props\.onPatch\(\{ font: o\.key \}\)/);
assert.match(r, /window\.FontChoice\.FACES/);
assert.match(r, /fontFamily: readFontStack\(book\.font\)/);
console.log("ok");
// 自己传的字体也能挑；没邀人也能开「设定」（里头只有字体）
{ const r2 = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "read.js"), "utf8");
  require("node:assert").match(r2, /FC\.facesWith\(readCustom\(\)\)/);
  require("node:assert").match(r2, /setOpen \? h\("div",/);
  require("node:assert").match(r2, /partner \? h\("div", \{ style: \{ display: "flex", alignItems: "center", gap: 5 \} \},\n          h\("span", \{ style: \{ fontFamily: F_BODY, fontSize: 11, color: t\.fog, whiteSpace: "nowrap" \} \}, "每次批"\)/); }
