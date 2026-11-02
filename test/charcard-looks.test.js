// 她 2026-11-02：角色有舌钉，线下每一段都写金属小球。长相和身上的东西写进公共的角色卡准则（判据，不给例句）。
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const rule = eng.match(/const CHARCARD_RULE = `([\s\S]*?)`;/)[1];
assert.match(rule, /长相和身上带着的东西/);
assert.match(rule, /一场里写过一次/);
assert.match(rule, /判据：把这句删掉，读的人会不会忘了他有这个/);
// 线上单聊、线下叙事底座、群都从这一份取
assert.match(eng, /PERSONA_FIRST, ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME/);
assert.match(eng, /P\.push\(CHARCARD_RULE\);/);
