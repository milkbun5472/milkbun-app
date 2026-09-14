// 她 2026-09-13 实测：iOS 把「高音质／增强」音色留给系统朗读和 Siri，不交给网页——
// 装了「月（高音质）」，网页这头列出来的还是只有 Tingting / Meijia。
// 所以自己架一张嘴（tools/tts-mouth，edge-tts，免费不要密钥），app 这头加一格端点。
//
// ⚠️它不是给她一个人开的私路：谁都能填自己的；没填就照旧系统音色，一格都不影响。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const engine = R("js/engine.js"), voice = R("js/radio-voice.js"), screens = R("js/screens.js");
const ui = R("js/radio-timeline-ui.js"), old = R("js/radio-ui.js");
const mouth = R("tools/tts-mouth/tts_mouth.py"), readme = R("tools/tts-mouth/README.md");

test("这一格跟真声耳朵是对称件：一样的形状，存在自己那把钥匙下", () => {
  assert.match(engine, /function loadVoiceMouth\(\)/);
  assert.match(engine, /localStorage\.getItem\("x_voiceMouth"\)/);
  assert.match(engine, /function voiceMouthReady\(a\) \{ a = a \|\| loadVoiceMouth\(\); return !!\(a\.base && a\.k\); \}/);
  // 地址尾巴上的斜杠要削掉，不然拼出来是 //say
  assert.match(engine, /a\.base = String\(a\.base \|\| ""\)\.trim\(\)\.replace\(\/\\\/\+\$\/, ""\);/);
  assert.match(engine, /a\.base \+ "\/say\?k=" \+ encodeURIComponent\(a\.k\)/);
});

test("降级链只有一份，而且失败一律退回系统音色——不许哑掉", () => {
  assert.ok(voice.indexOf("function speak(text, opts)") > 0, "speak 那一段抠不出来");
  // 端点不通、音频播不出来、play() 被拒——三条都落到系统音色上
  assert.match(voice, /\}\)\.catch\(\(\) => \{ bySystem\(\); \}\);/, "端点不通＝退回系统音色，不是报错");
  assert.match(voice, /audio\.onerror = \(\) => \{ drop\(\); audio = null; bySystem\(\); \}/);
  assert.match(voice, /p\.catch\(\(\) => \{ drop\(\); audio = null; bySystem\(\); \}\)/);
  // objectURL 每条路都要还回去
  assert.equal((voice.match(/drop\(\)/g) || []).length >= 3, true, "有一条路漏了 revokeObjectURL");
  // 没配端点就直接走系统音色，一枪不打
  assert.match(voice, /if \(!mouthOn\(\)\) \{ bySystem\(\);/);
});

test("两个电台都从这一份念，谁也别自己再写一套", () => {
  assert.match(ui, /root\.RadioVoice\.speak\(text, \{/);
  assert.match(old, /root\.RadioVoice\.speak\(t, \{ seed: r\.seed01\(id, "voice"\)/);
  assert.ok(!/new root\.SpeechSynthesisUtterance/.test(ui), "时间线电台又自己念了一份");
  assert.ok(!/new root\.SpeechSynthesisUtterance/.test(old), "旧电台又自己念了一份");
  // 停的时候两条路都要停（系统音色和那段音频）
  assert.match(voice, /if \(audio\) \{ try \{ audio\.pause\(\); \} catch \(e\) \{\} audio = null; \}/);
  assert.match(ui, /cancel: \(\) => \{ if \(utterance\) \{ utterance\.cancel\(\); utterance = null; \} \}/);
});

test("配了端点就不该再被「这台设备不支持朗读」挡住，也不再唠叨系统音色", () => {
  assert.match(ui, /const mouth = root\.RadioVoice && root\.RadioVoice\.mouthOn\(\);/);
  assert.match(ui, /if \(!mouth && \(!root\.speechSynthesis \|\| !root\.SpeechSynthesisUtterance\)\)/);
  assert.match(ui, /!voicePick && !root\.RadioVoice\.mouthOn\(\)/);
});

test("设置里有这一格，而且说清没配会怎样", () => {
  assert.match(screens, /function VoiceMouthConfig\(\{ toast \}\)/);
  assert.match(screens, /apiMouth: "电台嗓子"/);
  assert.match(screens, /title: "电台嗓子", sub: "自己架的朗读服务，没配就用系统音色"/);
  assert.match(screens, /page === "apiMouth" && section\(h\(VoiceMouthConfig/);
  assert.match(screens, /自动退回系统音色，不会哑掉/);
  // 试音要真的出声，不是只看 HTTP 200
  assert.match(screens, /await mouthSpeak\("这里是本台，试音。"/);
  assert.match(screens, /audRef\.current\.play\(\)/);
});

test("Mac 那头那一份：门锁、不记日志、说清它不是安全边界", () => {
  assert.match(mouth, /TOKEN = os\.environ\.get\("VOICE_TOKEN", ""\)\.strip\(\)/);
  assert.match(mouth, /if not TOKEN:/, "没设门锁就不许跑");
  assert.match(mouth, /def log_message\(self, \*a\):\n        pass/, "念过的每一句都是她和他的话，不该躺在日志里");
  assert.match(mouth, /def do_OPTIONS/, "网页跨域要它");
  assert.match(mouth, /MAX_CHARS/);
  assert.match(readme, /门锁只是挡住路过的人，不是安全边界/);
  assert.match(readme, /自动退回系统音色/);
  assert.match(readme, /pip3 install edge-tts/);
});
