const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.join(__dirname, "..");
const BRIDGE = path.join(root, "tools/fable-bridge/fable-bridge.mjs");

// 她 2026-09-02 在群里刷到「失败：spawn E2BIG」。
// E2BIG 是内核的 errno：argv 太长，进程根本起不来——那一轮压根没发出去。
// 病因是桥把【用户正文】当命令行参数递给 `claude`：
//     "-p", ...(hasImages ? [...] : [prompt])
// 桥自己早就为 system 记过这一课（第 18 行注释，改用 --system-prompt-file），
// 但用户那半句一直挂在 argv 上，话一长就撞同一堵墙。
//
// ⚠️这条必须【真跑】：grep「有没有写 stdin」证明不了内核会不会放行。
// 所以起一个假的 claude 摆进 PATH，让真的桥去调它，看正文到底从哪条路进去。

const BIG = "这是超长正文的记号。" + "群里又在说羊肉汤和劣马的事。".repeat(12000); // ~500KB UTF-8

function withStub(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-e2big-"));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const probe = path.join(dir, "probe.json");
  fs.writeFileSync(path.join(bin, "claude"), `#!/usr/bin/env node
const fs = require("fs");
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  fs.writeFileSync(${JSON.stringify(probe)}, JSON.stringify({
    argvHasPrompt: process.argv.slice(2).some(a => a.indexOf("超长正文的记号") >= 0),
    stdinHasPrompt: s.indexOf("超长正文的记号") >= 0
  }));
  process.stdout.write(JSON.stringify({ result: "收到了", session_id: "s1", usage: {} }));
});
`);
  fs.chmodSync(path.join(bin, "claude"), 0o755);
  return fn({ dir, bin, probe }).finally(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
}

async function ask(ctx, port, messages) {
  const cp = spawn(process.execPath, [BRIDGE], {
    env: { ...process.env, BRIDGE_PORT: String(port), PATH: ctx.bin + ":" + process.env.PATH,
      PROBE_OUT: ctx.probe, MEMGW_URL: "", MEMGW_TOKEN: "", BRIDGE_SECRET: "", BRIDGE_RESUME: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    await new Promise(r => setTimeout(r, 900));
    const r = await fetch("http://127.0.0.1:" + port + "/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-fable-5", messages })
    });
    const body = await r.text();
    let probe = null;
    try { probe = JSON.parse(fs.readFileSync(ctx.probe, "utf8")); } catch (e) {}
    return { status: r.status, body, probe };
  } finally { cp.kill(); }
}

test("半兆的正文也得递得进去，不许再撞 E2BIG", () => withStub(async ctx => {
  const r = await ask(ctx, 8931, [{ role: "system", content: "你是某某。" }, { role: "user", content: BIG }]);
  assert.ok(!/E2BIG/.test(r.body), "又把正文塞回 argv 了：" + r.body.slice(0, 120));
  assert.equal(r.status, 200);
  assert.equal(r.probe && r.probe.argvHasPrompt, false, "正文不许出现在命令行参数里");
  assert.equal(r.probe && r.probe.stdinHasPrompt, true, "正文要从 stdin 进去");
}));

test("普通短消息照旧走通", () => withStub(async ctx => {
  const r = await ask(ctx, 8932, [{ role: "system", content: "你是某某。" }, { role: "user", content: "这是超长正文的记号，其实很短" }]);
  assert.equal(r.status, 200);
  assert.match(r.body, /收到了/);
  assert.equal(r.probe.argvHasPrompt, false);
  assert.equal(r.probe.stdinHasPrompt, true);
}));

test("带图那条路一个字节都没动", () => withStub(async ctx => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const r = await ask(ctx, 8933, [{ role: "system", content: "你是某某。" },
    { role: "user", content: [{ type: "text", text: "这是超长正文的记号，看图" },
      { type: "image_url", image_url: { url: "data:image/png;base64," + png } }] }]);
  assert.equal(r.status, 200);
  assert.match(r.body, /收到了/);
  assert.equal(r.probe.stdinHasPrompt, true, "带图本来就走 stdin（stream-json），这条没被改坏");
}));

test("system 仍然走文件，不许有人把它挪回 argv", () => {
  const src = fs.readFileSync(BRIDGE, "utf8");
  assert.match(src, /"--system-prompt-file", sysFile/);
  // 正文那一支的 argv 里不许再出现 prompt
  const i = src.indexOf("const args = [");
  const args = src.slice(i, src.indexOf("];", i));
  assert.ok(!/:\s*\[prompt\]/.test(args), "正文又回到命令行参数上了");
  assert.match(src, /cp\.stdin\.write\(prompt \|\| ""\)/);
});
