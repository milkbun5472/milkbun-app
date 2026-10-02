const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 群里有人问「有打算 fish audio 语音接入吗」，她 2026-10-02：「fish 和 eleven lab 能接吗」「做吧」。
// 一个开关三选一，后面的语音条、通话、庭院全走同一条 ttsSynth，不各接一份。

function load(store, fetchImpl) {
  const cut = (a, b) => eng.slice(eng.indexOf(a), eng.indexOf(b));
  const src = [
    cut("function loadTtsApi(", "// 真声通话的耳朵"),
    cut("function ttsReady(", "// MiniMax 系统预置音色"),
    "const TTS_MARK_PAUSE = /<#\\s*\\d+(?:\\.\\d+)?\\s*#>/g;",
    cut("async function ttsSynthOther(", "// 克隆音色：①上传一段干净人声"),
    "return { loadTtsApi, saveTtsApi, ttsReady, ttsDefaultVoice, ttsSynthOther };"
  ].join("\n");
  const localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  const cleanBaseUrl = u => String(u || "").trim().replace(/\/+$/, "");
  return new Function("localStorage", "cleanBaseUrl", "fetchT", "Blob", src)(localStorage, cleanBaseUrl, fetchImpl, Blob);
}

test("老存档没有 provider 字段＝照旧 MiniMax，判据也照旧", () => {
  const e = load({ x_ttsApi: JSON.stringify({ enabled: true, groupId: "1", apiKey: "k" }) });
  const a = e.loadTtsApi();
  assert.equal(a.provider, "minimax");
  assert.equal(e.ttsReady(a), true);
  assert.equal(e.ttsDefaultVoice(a), "female-shaonv");
});

test("换家之后只看那一家的密钥，默认音色用设置里填的", () => {
  const e = load({ x_ttsApi: JSON.stringify({ enabled: true, provider: "elevenlabs", elKey: " sk_1 \n", elVoice: " v9 " }) });
  const a = e.loadTtsApi();
  assert.equal(a.elKey, "sk_1", "粘贴带进来的空白要清掉");
  assert.equal(e.ttsReady(a), true);
  assert.equal(e.ttsDefaultVoice(a), "v9");
  const f = load({ x_ttsApi: JSON.stringify({ enabled: true, provider: "fish" }) });
  assert.equal(f.ttsReady(), false, "fish 没填密钥不算接好");
  assert.equal(f.ttsDefaultVoice(), "", "别家没有 MiniMax 的预置 ID 可兜");
});

test("ElevenLabs：音色进路径、停顿换成它认的 break", async () => {
  let got;
  const e = load({}, async (url, o) => { got = { url, o }; return { ok: true, blob: async () => new Blob([new Uint8Array(500)], { type: "audio/mpeg" }) }; });
  const blob = await e.ttsSynthOther({ provider: "elevenlabs", elKey: "sk", elModel: "eleven_multilingual_v2" }, "你回来啦<#0.5#>饿不饿", "VID", 0.9);
  assert.ok(blob.size >= 500);
  assert.match(got.url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/VID\?/);
  assert.equal(got.o.headers["xi-api-key"], "sk");
  const body = JSON.parse(got.o.body);
  assert.match(body.text, /<break time="0\.5s" \/>/);
  assert.equal(body.voice_settings.speed, 0.9, "音色库里调的语速要带上");
});

test("Fish：reference_id 是音色、模型走请求头、停顿不留标签", async () => {
  let got;
  const e = load({}, async (url, o) => { got = { url, o }; return { ok: true, blob: async () => new Blob([new Uint8Array(500)]) }; });
  const blob = await e.ttsSynthOther({ provider: "fish", fishKey: "fk", fishModel: "s1", fishBase: "https://relay.example" }, "嗯<#0.3#>好", "REF", 1);
  assert.equal(blob.type, "audio/mpeg", "没带类型的要补上，不然 iOS 播不出来");
  assert.equal(got.url, "https://relay.example/v1/tts", "接口地址可以换成中转");
  assert.equal(got.o.headers.Authorization, "Bearer fk");
  assert.equal(got.o.headers.model, "s1");
  const body = JSON.parse(got.o.body);
  assert.equal(body.reference_id, "REF");
  assert.ok(!/<#/.test(body.text));
});

test("报错说人话：跨域被挡不许说成「写太长被掐断」", async () => {
  const e = load({}, async () => { throw new Error("连接中断了（Load failed）。多半是这次要写得太长"); });
  await assert.rejects(e.ttsSynthOther({ provider: "fish", fishKey: "k" }, "hi", "R", 1), /跨域/);
  const e2 = load({}, async () => ({ ok: false, status: 404, text: async () => "voice not found" }));
  await assert.rejects(e2.ttsSynthOther({ provider: "elevenlabs", elKey: "k" }, "hi", "R", 1), /声音 ID 不对/);
});

test("缓存钥匙带上服务商（MiniMax 不带，老缓存照旧命中）；合成只有一个入口", () => {
  assert.match(eng, /ttsCacheKey\(\(prov === "minimax" \? "" : prov \+ ":"\) \+ vid/);
  const syn = eng.slice(eng.indexOf("async function ttsSynth("), eng.indexOf("async function ttsSynthOther("));
  assert.match(syn, /ttsSynthOther\(a, synthTxt, vid, spd\)/);
  assert.match(syn, /idbAudPut\(key, blob\)/);
});

test("设置页三选一；克隆和语气标记只在 MiniMax 下出现；角色档案预置那排也只在 MiniMax 下", () => {
  assert.match(scr, /\["minimax", "MiniMax"\], \["elevenlabs", "ElevenLabs"\], \["fish", "Fish Audio"\]/);
  assert.match(scr, /\/\/ ---- 语气标记验货台 ----\n\s+c\.provider === "minimax" && h\(/);
  assert.match(scr, /\/\/ ---- 克隆音色：[^\n]*\n\s+c\.provider === "minimax" && h\(/);
  assert.match(scr, /ttsProv === "minimax" && h\("div", \{ className: "flex flex-wrap gap-1\.5 mb-2" \}, \(typeof TTS_VOICES/);
});

test("Fish 中转地址自带 /v1 也认", () => {
  for (const u of ["https://fishaudio.org/v1", "https://fishaudio.org/v1/", "https://fishaudio.org/v1/tts", "https://fishaudio.org"]) {
    const e = load({ x_ttsApi: JSON.stringify({ provider: "fish", fishBase: u }) });
    assert.equal(e.loadTtsApi().fishBase, "https://fishaudio.org", u);
  }
});

test("Fish 回 400 ERR_VOICE_NOT_FOUND 也要说成「声音 ID 不对」", async () => {
  const e = load({}, async () => ({ ok: false, status: 400, text: async () => '{"retryable":false,"code":"ERR_VOICE_NOT_FOUND"}' }));
  await assert.rejects(e.ttsSynthOther({ provider: "fish", fishKey: "k" }, "hi", "R", 1), /声音 ID 不对/);
});

test("MiniMax 模型：列表之外能自己填（群里问「只有 01 和 02 嘛」）", () => {
  assert.match(scr, /const MM_MODELS = \["speech-2\.8-hd",/);
  assert.match(scr, /h\("option", \{ value: "__custom" \}, "自己填…"\)/);
  assert.match(scr, /const custom = !!c\.modelCustom \|\| MM_MODELS\.indexOf\(cur\) < 0;/, "存着列表外的名字时要认得出是自己填的");
  assert.match(eng, /model: a\.model \|\| "speech-02-hd"/, "填空了就退回默认，不发空模型名");
});
