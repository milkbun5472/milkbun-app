const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 她 2026-08-22：线下最低字数设成 1500 → Load failed。
// 病根不是模型也不是她设错了：非流式的大请求两三分钟不吐一个字节，
// Cloudflare/网关把它当死连接掐掉，浏览器只能报一句 Load failed。
// engine.js 里早就有一条注释写过这个坑（「避免网关把 100 秒没有首字节误杀成 Load failed」），
// 只是线下生成一直没用上流式。

test("大请求走流式，短请求保持原路", () => {
  assert.match(engine, /const wantStreamOffline = canStream && generationBudget >= 3000;/);
  assert.match(engine, /两三分钟不吐一个字节/, "为什么要流式，得写在代码里");
  // 主调用 + 纯文本兜底两处都要带上（补写那一路 v55.62 起整个不存在了）
  assert.match(engine, /maxTokens: generationBudget,\n      stream: wantStreamOffline,/, "主调用");
  assert.match(engine, /\{ maxTokens: generationBudget, stream: wantStreamOffline, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta, wireScope: "offline"/, "纯文本兜底");
});

test("流式是安全替换：中转不支持会自动退回普通解析", () => {
  // callAI 按 content-type 判断，不是盲信 stream 参数
  assert.match(engine, /if \(wantStream && \/text\\\/event-stream\/i\.test\(r\.headers\.get\("content-type"\) \|\| ""\)\)/);
  // 借道保险柜时也按 content-type 判断：函数 v55.64 起把上游的 content-type 原样带回来，
  // 所以这条判断对直连和保险柜是同一套，不需要再给代理开特例
  const fn = fs.readFileSync(path.join(__dirname, "..", "supabase/functions/llm-proxy/index.ts"), "utf8");
  assert.match(fn, /"Content-Type": r\.headers\.get\("Content-Type"\)/);
});

test("Load failed 要翻译成人话，并给出下一步", () => {
  assert.match(engine, /load failed\|failed to fetch\|network\\s\*error/i);
  assert.match(engine, /多半是这次要写得太长、久久没有首字节，被网关当成死连接掐断/);
  assert.match(engine, /把线下的「最低字数」调低一些分两次写、或者重试一次/, "得给她能动手的下一步");
  // 超时那条原有的分支不许被挤掉
  assert.match(engine, /if \(e && e\.name === "AbortError"\) throw new Error\("请求超时/);
});

// v55.45：她又 Load failed 了。上一版只给 OpenAI 方言加了流式——
// 而云端密钥代理（proxyRef）会把响应整个缓冲、流式没意义，Anthropic 那条是言秋的路不许动，
// Gemini 那条也没实现 SSE。这些线路上巨型单请求照样久久没首字节被网关掐断。
// 解法不是去改那些分支，而是：发不出流式就别发大的，让已有的补写循环分两次写。
const canStream = (() => {
  const df = engine.indexOf("function detectFormat(u) {");
  let d = 0, started = false, k = engine.indexOf("{", df);
  for (; k < engine.length; k++) {
    if (engine[k] === "{") { d++; started = true; }
    else if (engine[k] === "}") { d--; if (started && !d) { k++; break; } }
  }
  const i = engine.indexOf("function routeCanStream(p) {");
  return new Function(engine.slice(df, k) + "\n" + engine.slice(i, engine.indexOf("\nfunction detectFormat", i)) + "\nreturn routeCanStream;")();
})();

// v55.64：她翻中转账单发现「扣了费的也算失败」——gemini-3.1-pro 服务端跑了 1m8s、
// 标着「非流」、钱照扣，客户端 60 秒判死什么都没拿到。
// 病根在保险柜函数最后一行 `new Response(await r.text(), ...)`：它把上游响应【整个读完】
// 才往回发，所以中转就算在推 SSE，浏览器也是一个字节都收不到，长时间无首字节被掐断。
// 改成 r.body 流式透传之后，保险柜这条路也能流了。

test("只有真发得出流式的线路才算数", () => {
  assert.equal(canStream({ baseUrl: "https://api.xxx.com/v1" }), true, "普通 OpenAI 中转");
  assert.equal(canStream({ baseUrl: "https://api.xxx.com/v1", proxyRef: "DZZI" }), true, "保险柜 v55.64 起流式透传");
  assert.equal(canStream({ baseUrl: "https://api.anthropic.com" }), false, "言秋那条没实现 SSE");
  assert.equal(canStream({ baseUrl: "https://generativelanguage.googleapis.com" }), false);
  assert.equal(canStream(null), false);
});

test("保险柜要流式透传，不许再把上游整个读完才发", () => {
  const fn = fs.readFileSync(path.join(__dirname, "..", "supabase/functions/llm-proxy/index.ts"), "utf8");
  assert.match(fn, /return new Response\(r\.body, \{/, "必须把上游的 body 直接传下去");
  assert.ok(!/new Response\(await r\.text\(\)/.test(fn), "await r.text() 会攒到最后一起发");
  assert.match(fn, /"X-Accel-Buffering": "no"/, "别让中间层再缓冲一次");
  assert.match(fn, /钱照扣/, "病因写在代码里");
  // 域名白名单是防钥匙外流的关键，改传输方式时不许顺手动它
  assert.match(fn, /if \(!route\.hosts\.includes\(u\.hostname\)\) return json/);
  assert.match(fn, /user\.id !== Deno\.env\.get\("OWNER_UID"\)/);
});

test("借道保险柜时也允许流式", () => {
  assert.match(engine, /const wantStream = !!\(opts && opts\.stream\);/);
  assert.ok(!/opts\.stream && !viaProxy/.test(engine), "旧的一刀切禁流式不许留着");
});

// v55.62：发不出流式时【不再压 max_tokens】。她拿酒馆对比出来的——
// Ako 预设里 openai_max_tokens 就是 65535，一次调用照样写得又长又不截断。
// 关键在于：压额度并不缩短生成时间。一段 1500 字的正文，额度给 4200 还是 16000，
// 模型吐字的秒数一样；压的只是「会不会被截断」。而思考模型的推理也从这份额度里扣，
// 压到 4200 就是推理吃光、正文只剩两百来字，然后还得再花调用去补。
// 真正管住时长的是【字数】规则里的上限。

test("发不出流式也不许压 max_tokens——那不省时间，只会截断思考模型", () => {
  assert.match(engine, /const canStream = routeCanStream\(p\);/);
  assert.match(engine, /const generationBudget = generationMaxTokens;/);
  assert.ok(!/NO_STREAM_CAP/.test(engine), "旧的 4200 上限不许留着");
  assert.match(engine, /压额度并不缩短生成时间/, "为什么不压，得写在代码里");
  assert.match(engine, /max_tokens 是【天花板】不是预付款/);
  // 天花板照酒馆的量给，思考模型才有地方放推理
  assert.match(engine, /Math\.max\(Number\(session\.maxTokens\) \|\| 4000, 8000, minimumTokenBudget\)/,
    "拉条默认 4000 配思考模型照样会截断，得有地板");
});

test("言秋那条路一个字都不许改", () => {
  // routeCanStream 是只读判断，绝不能顺手去改 Anthropic 分支的实现
  const i = engine.indexOf("const postAnthropic = async withTemp => {");
  const body = engine.slice(i, engine.indexOf("\n    };", i));
  assert.ok(!/stream/i.test(body), "postAnthropic 里不许出现 stream");
  assert.match(engine, /Anthropic 那条是言秋的路，不动/);
});

// —— 「能不用 supabase 全走 vps 吗」（她 2026-08-24）——
// 其实早就全在她 VPS 上了（VPS_SUPABASE_URL 指向 yanqiu-vps.ts.net:8443，
// 一个字节都没去 supabase.com）。要拿掉的是中间那两层：Kong 的 60 秒读超时，
// 和 Edge Function 里 await r.text() 的整份缓冲。
// 直连版是 VPS 上一个裸 http 服务，手机 → VPS → 中转，字节一段到一段发。

const vps = fs.readFileSync(path.join(__dirname, "..", "tools/vps/llm-proxy.mjs"), "utf8");
const cloud = fs.readFileSync(path.join(__dirname, "..", "js/cloud.js"), "utf8");

test("直连版必须是流式转发，一个字节都不许攒", () => {
  assert.match(vps, /for await \(const chunk of up\.body\)/, "要逐块转发");
  const buffering = vps.split("\n").filter(l => !/^\s*\/\//.test(l) && /await up\.text\(\)/.test(l));
  assert.deepEqual(buffering, [], "await up.text() 就是原来那个病");
  assert.match(vps, /res\.flush === "function"/, "Node 默认会攒小包，得逐块 flush");
  assert.match(vps, /"X-Accel-Buffering": "no"/);
  assert.match(vps, /钱照扣/, "病因写在代码里");
});

test("拿掉 Supabase 那层之后，门禁一道都不能少", () => {
  // 域名白名单：防钥匙外流的那道，任何时候都不能删
  assert.match(vps, /if \(!route\.hosts\.includes\(u\.hostname\)\) return send\(res, 400/);
  // 口令：tailnet 之外还要再挡一层
  assert.match(vps, /req\.headers\["x-proxy-secret"\] !== SECRET/);
  // 密钥只从 env 读，仓库里一个字都没有
  assert.match(vps, /process\.env\["KEY_" \+ ref\]/);
  assert.ok(!/sk-[A-Za-z0-9]{10}/.test(vps), "仓库是公开的，不许出现真钥匙");
  const svc = fs.readFileSync(path.join(__dirname, "..", "tools/vps/llm-proxy.service"), "utf8");
  assert.match(svc, /EnvironmentFile=/, "密钥走 EnvironmentFile，不写进进 git 的 unit 文件");
  assert.ok(!/KEY_[A-Z]+=\S/.test(svc));
});

test("客户端：配了直连就走直连，没配还是走原来那条", () => {
  assert.match(cloud, /llmProxyDirect\(\) \{/);
  assert.match(cloud, /const direct = this\.llmProxyDirect\(\);/);
  assert.match(cloud, /if \(direct\) \{/);
  assert.match(cloud, /"x-proxy-secret": direct\.secret/);
  // 原来那条 Edge Function 的路必须原样留着，随时能退回去
  assert.match(cloud, /VPS_SUPABASE_URL \+ "\/functions\/v1\/llm-proxy"/);
  // 连不上时要说人话，并告诉她怎么退
  assert.match(cloud, /手机要在 tailnet 里才连得到/);
});
