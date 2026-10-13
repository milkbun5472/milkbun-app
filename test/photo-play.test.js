const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), a = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("照片上的几种玩法都接上了", () => {
  assert.match(c, /const \[mode, setMode\] = useState\("draw"\);   \/\/ draw \| stamp \| cut/);
  assert.match(c, /text: ask \? "圈出来的这里是什么？" : "", doodle: true/);
  assert.match(c, /window\.__addSelfSticker\(url, charId(, cutName)?\)/);
  assert.match(a, /window\.__addSelfSticker = async \(dataUrl, charId(, name)?(, drawn)?(, captioned)?\) =>/);
  assert.doesNotMatch(a + c, /__setWallFromPhoto|wallfromphoto/);   // 设成壁纸撤了（她 2026-10-12：尺寸对不上）
  assert.match(c, /\.\.\.\(_doodle \? \{ doodle: true \} : \{\}\)/);
  assert.match(a, /if \(_doodleFresh\) \{\n\s+openCaps\.push\("drawBack"\);/);
  assert.match(a, /if \(_doodleFresh && parsed\.drawBack\) drawBackOn\(/);
});
