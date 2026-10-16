// NAI 原生出图（她 2026-10-15 转来站长给的请求）：/ai/generate-image + director_reference_images 锁脸，回包 zip/图/JSON 都认
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const naiSrc = eng.slice(eng.indexOf("const naiFetch = async"), eng.indexOf("const isMinimax ="));
const zipSrc = core.slice(core.indexOf("async function openZip"), core.indexOf("async function epubToText"));
class FileReader { readAsDataURL(b) { b.arrayBuffer().then(ab => { this.result = "data:" + b.type + ";base64," + Buffer.from(ab).toString("base64"); this.onload(); }); } }
function run(a, refBlobs, reply) {
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return reply(); };
  const make = new Function("a", "refBlobs", "fetch", "FileReader", "size", "naiNegative", "useRef", "promptText", "ctrl",
    zipSrc + "\n" + naiSrc + "\nreturn naiFetch;");
  return { sent, go: make(a, refBlobs, fetch, FileReader, "1024x1536", "bad hands", true, "1girl, smile", { signal: null }) };
}
// 手搓一个 stored（不压缩）的 zip，里面一张 image_0.png
function zipOf(name, data) {
  const n = Buffer.from(name), lh = Buffer.alloc(30), ch = Buffer.alloc(46), eo = Buffer.alloc(22);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(0, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(0, 42);
  const cdOff = 30 + n.length + data.length;
  eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + n.length, 12); eo.writeUInt32LE(cdOff, 16);
  return Buffer.concat([lh, n, data, ch, n, eo]);
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
test("带参考照：发到 /ai/generate-image，脸走 director_reference_images，zip 里的图取出来", async () => {
  const { sent, go } = run({ baseUrl: "https://st.example/v1/", apiKey: "k", model: "" }, [new Blob([PNG], { type: "image/png" })],
    () => new Response(zipOf("image_0.png", PNG), { status: 200 }));
  const r = await go(); const d = await r.json();
  assert.equal(sent[0].url, "https://st.example/ai/generate-image");
  const b = sent[0].body, p = b.parameters;
  assert.equal(b.model, "nai-diffusion-4-5-full"); assert.equal(b.action, "generate"); assert.equal(b.input, "1girl, smile");
  assert.deepEqual([p.width, p.height], [832, 1216]);
  assert.equal(p.director_reference_images[0], PNG.toString("base64"));
  assert.deepEqual(p.director_reference_strength_values, [0.6]); assert.deepEqual(p.director_reference_secondary_strength_values, [0.4]);
  assert.equal(p.director_reference_descriptions[0].caption.base_caption, "character");
  assert.equal(p.v4_prompt.caption.base_caption, "1girl, smile"); assert.equal(p.v4_negative_prompt.caption.base_caption, "bad hands");
  assert.equal(d.data[0].b64_json, PNG.toString("base64"));
});
test("中转直接回 png、或报错时说清是哪个地址", async () => {
  let x = run({ baseUrl: "https://st.example/ai/generate-image", apiKey: "k", model: "nai-diffusion-4-5-curated" }, [], () => new Response(PNG, { status: 200 }));
  assert.equal((await (await x.go()).json()).data[0].b64_json, PNG.toString("base64"));
  assert.equal(x.sent[0].url, "https://st.example/ai/generate-image"); assert.equal(x.sent[0].body.model, "nai-diffusion-4-5-curated");
  x = run({ baseUrl: "https://st.example", apiKey: "k" }, [], () => new Response("nope", { status: 404 }));
  const r = await x.go(); assert.equal(r.status, 404); assert.match((await r.json()).error.message, /NAI 原生（https:\/\/st\.example\/ai\/generate-image）：nope/);
});
test("选了 NAI 原生就走它，不掉回别的门；设置里有这一项", () => {
  assert.ok(/if \(a\.apiFormat === "nai"\) r = await naiFetch\(\);/.test(eng));
  assert.ok(/const isNative = isMinimax \|\| a\.apiFormat === "nai";/.test(eng));
  assert.ok(/value: "nai" \}, "NAI 原生/.test(scr));
});

// 参考图要先垫进 NovelAI 认的三种画布，不然上游 500（她 2026-10-16 截图）
{
  const e = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  const i = e.indexOf("const naiFetch = async"), j = e.indexOf("const isMinimax =", i);
  if (!(i > 0 && j > i)) throw new Error("抠不出 naiFetch");
  const f = e.slice(i, j);
  if (!/\[1536, 1024\] : r < 0\.83 \? \[1024, 1536\] : \[1472, 1472\]/.test(f)) throw new Error("参考图没垫画布");
  if (!/toB64\(await naiCanvas\(b\)\)/.test(f)) throw new Error("垫好的画布没发出去");
}

// 被审核拦的不往「不锁脸」上指（她 2026-10-16 转来：blocked by moderation (sexual=0.74)）
{
  const e = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  const i = e.indexOf("async function generateSelfieImage("), j = e.indexOf("const naiFetch = async", i);
  if (!(i > 0 && j > i)) throw new Error("抠不出 generateSelfieImage");
  const f = e.slice(i, j), mod = f.indexOf("/moderation|content[_ ]?policy|safety|sexual|nsfw/i.test(m)"), site = f.indexOf("/参考照|锁脸|不收图片|image/i.test(m)");
  if (!(mod > 0 && site > mod)) throw new Error("审核拦截要先认出来，排在「站子不收图」之前");
}
