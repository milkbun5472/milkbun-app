const test = require("node:test"); const assert = require("node:assert");
const c = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
test("在TA照片上画：大图里有入口，画完落进单聊、群聊的发照片那一步", () => {
  assert.match(c, /function DoodleEditor\(\{ src,( charId,)? onClose \}\)/);
  assert.match(c, /window\.dispatchEvent\(new CustomEvent\("doodle-photo"/);
  assert.match(c, /"data-wk": "doodlebtn"/);
  assert.equal((c.match(/window\.addEventListener\("doodle-photo", f\)/g) || []).length, 2);
  assert.match(c, /setSpecialImg\(u\);( setSpecialText\(d\.text \|\| ""\);)? setSpecialKind\("photo"\)/);
  assert.match(c, /setGroupPhotoImg\(u\); setPhotoOpen\(true\)/);
});
