// 她 2026-11-02：「别交出厂那一版」+「人设里的特点每轮都带不代表抓住了人物核心」。放在 CHARCARD_RULE 最前面，各处共用。
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const rule = eng.match(/const NOT_FACTORY_RULE = `([\s\S]*?)`;/)[1];
assert.match(rule, /【别交出厂那一版】/);
assert.match(rule, /换到别的故事、别的两个人身上，照样成立吗/);
assert.match(rule, /【特点露出来，不是拿出来】/);
assert.match(rule, /她资料里的职业和经历/);
assert.match(rule, /判据：把这句删掉/);
assert.match(eng, /const CHARCARD_RULE = NOT_FACTORY_RULE \+ `/);
assert.doesNotMatch(eng, /长相和身上带着的东西（穿孔/, "旧那段并进新段落了，别留两份");
assert.match(eng, /PERSONA_FIRST, ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME/);
assert.match(eng, /P\.push\(CHARCARD_RULE\);/);
// 她 2026-11-02：场景也不许每轮拿同一个细节；重心在景、心、景心之间换着走
assert.match(rule, /【每一轮看见新的，重心也换着走】/);
assert.match(rule, /注意力落的地方换了没有/);
