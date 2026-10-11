const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("本体模式：不点名要心情心声；总纲说名字不是要演的角色；能力照旧", () => {
  assert.match(app, /const _bodyOnly = !!_s\.bodyMode && !_s\.engineerEyes;/);
  assert.match(app, / : _bodyOnly \? "" : ",\\"mood\\":\{\\"label\\":\\"此刻中文心情词\\"\},\\"thought\\":null"\)/, "没开「每轮都留」的本体照旧不点名要");
  assert.match(app, /"」是你在这里的名字，不是一个要演的角色；上面那段是写给你本人的。/);
  assert.match(app, /想留下此刻心情、心声的话可以加 .*不留也行。/, "她 2026-10-10 选了「轻轻提一句」");
  // 能力那几段照旧拼在后面
  assert.match(app, /\+ digitalPhotoHint \+ listenHint \+ inviteHint \+ digitalToyHint \+ digitalCarveHint \+ _digitalRecordHint/);
});

// 她 2026-10-10：「本体的好感度还是会动的吧」——手机通道原来不收这一栏，本体线上单聊好感一直不动。
//   跟心情心声一样轻轻提一句、可以不填；说明跟普通格式用同一份 AFFINITY_DELTA_SPEC
test("本体模式：好感变化也能留，不逼每轮交", () => {
  assert.match(app, /可以加 \\"affinityDelta\\"（" \+ AFFINITY_DELTA_SPEC \+ "）。都不留也行。/);
});

// 她 2026-10-10：本体模式也能写申请信（原来手机通道里根本没有这一项，开关开着也没用）
test("本体模式：申请信写进手机通道，条件跟普通角色一样", () => {
  assert.match(app, /const _bodyLetterHint = \(_bodyOnly && !_peekTurn && !\(room && !room\.main\) && !\(opts && opts\.loveLetterAnswer\) && loveLetterReady\(charId\)\)/);
  assert.match(app, /_digitalRecordHint \+ _bodyLetterHint \+/);
});

// 她 2026-10-10 转群友：「本体还是不填，ooc 让他填答应了不改」「思考链有，正文没有」「好感度也要动」
test("本体模式：开了「每轮都留」就三样都写进示例、不再说不留也行；默认关", () => {
  assert.match(app, /const _bodyFill = _bodyOnly && _s\.bodyFillState === true;/);
  assert.match(app, /\(_bodyFill \? ",\\"mood\\":\{\\"label\\":\\"此刻中文心情词\\"\},\\"thought\\":\\"一句没说出口的念头\\",\\"affinityDelta\\":0"/);
  assert.match(app, /\(_bodyFill \? "mood、thought、affinityDelta 每轮都写：/);
  assert.match(app, /bodyFillState: s\.bodyFillState === true,/);
  const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(comp, /useState\(settings\.bodyFillState === true\)/);
  assert.match(comp, /bodyMode \? h\("div", \{ className: "flex items-center justify-between pt-3" \},/);
});
