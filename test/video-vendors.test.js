// 可灵、即梦（她 2026-10-05：「先接可灵和即梦吧」）：字段照官方来源核对，跟 MiniMax 同一套「不补发收费任务」规矩
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/video-api.js"), "utf8");
function load(fetch) {
  const store = {}, ctx = { window: {}, cleanBaseUrl: v => String(v || "").trim().replace(/\/+$/, ""), loadJSON: (k, d) => store[k] ?? d, saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    fetch, setTimeout, clearTimeout, AbortController, DOMException, URL, Blob, Uint8Array, TypeError, console, crypto: globalThis.crypto, TextEncoder, btoa, unescape, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { api: ctx.window.VideoApi, store };
}
const ok = d => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });

test("可灵：image2video 收纯 base64，新式 API Key 直接当 Bearer；查到 succeed 才算成", async () => {
  const sent = [], { api } = load(async (url, init) => { sent.push({ url, init });
    return url.endsWith("/image2video") ? ok({ code: 0, message: "ok", data: { task_id: "k1", task_status: "submitted" } }) : ok({ code: 0, message: "ok", data: { task_id: "k1", task_status: "processing" } }); });
  api.save({ enabled: true, vendor: "kling", kling: { apiKey: "KEY", model: "kling-v2-1", mode: "std", duration: 5 } });
  await api.create("c|focus", "data:image/png;base64,AAAA", "轻轻眨眼");
  assert.equal(sent[0].url, "https://api-beijing.klingai.com/v1/videos/image2video");
  assert.equal(sent[0].init.headers.Authorization, "Bearer KEY");
  const body = JSON.parse(sent[0].init.body);
  assert.equal(body.image, "AAAA", "可灵要的是不带 data: 头的 base64");
  assert.equal(body.model_name, "kling-v2-1"); assert.equal(body.duration, "5");
  assert.equal(api.job("c|focus").taskId, "k1"); assert.equal(api.job("c|focus").vendor, "kling");
  await api.query("c|focus");
  assert.equal(sent[1].init.method, "GET"); assert.match(sent[1].url, /\/v1\/videos\/image2video\/k1$/);
  assert.equal(api.job("c|focus").status, "processing");
});
test("可灵：旧式 AK/SK 现签 HS256 JWT（iss＝AK）", async () => {
  const sent = [], { api } = load(async (url, init) => { sent.push(init); return ok({ code: 0, message: "ok", data: { task_id: "k2" } }); });
  api.save({ enabled: true, vendor: "kling", kling: { accessKey: "AK", secretKey: "SK" } });
  await api.create("c|call", "https://x/img.png", "动");
  const tok = sent[0].headers.Authorization.slice(7).split(".");
  assert.equal(tok.length, 3);
  assert.equal(JSON.parse(Buffer.from(tok[1], "base64url").toString()).iss, "AK");
  assert.equal(JSON.parse(sent[0].body).image, "https://x/img.png", "网址原样给");
});
test("可灵：业务失败（code≠0）、任务 failed 都明说，不冒充成功", async () => {
  const { api } = load(async () => ok({ code: 1102, message: "余额不足" }));
  api.save({ enabled: true, vendor: "kling", kling: { apiKey: "K" } });
  await assert.rejects(api.create("c|focus", "data:image/png;base64,A", "动"), /余额不足/);
  assert.equal(api.job("c|focus").status, "Submitting", "没拿到编号就留着待核对，不补发");
  const b = load(async () => ok({ code: 0, message: "ok", data: { task_id: "k3", task_status: "failed", task_status_msg: "图片不合规" } })).api;
  b.save({ enabled: true, vendor: "kling", kling: { apiKey: "K" } });
  b.patchMap(b.keys.JOBS, "c|focus", { vendor: "kling", taskId: "k3", baseUrl: "https://api-beijing.klingai.com" });
  await assert.rejects(b.query("c|focus"), /图片不合规/);
});
test("即梦：方舟 contents/generations/tasks，首帧 role＝first_frame；查询走 GET、换站拦住", async () => {
  const sent = [], { api } = load(async (url, init) => { sent.push({ url, init }); return init.method === "POST" ? ok({ id: "cgt-1" }) : ok({ id: "cgt-1", status: "running" }); });
  api.save({ enabled: true, vendor: "seedance", seedance: { apiKey: "ARK", model: "doubao-seedance-1-0-pro-250528", duration: 5, resolution: "720p" } });
  await api.create("c|default", "data:image/png;base64,BBBB", "呼吸");
  assert.equal(sent[0].url, "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks");
  assert.equal(sent[0].init.headers.Authorization, "Bearer ARK");
  const body = JSON.parse(sent[0].init.body);
  assert.equal(body.model, "doubao-seedance-1-0-pro-250528");
  assert.deepEqual(body.content[1], { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" }, role: "first_frame" });
  assert.equal(api.job("c|default").taskId, "cgt-1");
  await api.query("c|default"); assert.match(sent[1].url, /\/contents\/generations\/tasks\/cgt-1$/); assert.equal(sent[1].init.method, "GET");
  api.save({ seedance: { apiKey: "ARK", baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3" } });
  await assert.rejects(api.query("c|default"), /切回/); assert.equal(sent.length, 2);
});
test("老配置（只有 MiniMax 那几格）照旧是 MiniMax", () => {
  const { api } = load(async () => ok({}));
  api.save({ enabled: true, apiKey: "m" });
  assert.equal(api.load().vendor, "minimax"); assert.ok(api.ready());
});
