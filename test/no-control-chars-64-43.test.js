// 正则里看不见的字符（2026-09-06 抓到）。
//
// 她第四轮报「不行」，原文终于说了实话：
//   The prompt could not be submitted. The prompt contains sensitive words that
//   violate Google's Generative AI Prohibited Use policy…
// 也就是 Gemini 把【提示词本身】拦了，把那句拒绝当正文 200 回来了。
//
// 可这句话 app 早就认识：UPSTREAM_ERROR_PATTERNS 里就有一条
//   /^the prompt could not be submitted\b/i
// 而且注释里写着「她 2026-08-25 抓到过」。它为什么没拦住？
//
// 因为那个 `\b` 在源码里是一个【真正的退格字节 0x08】，不是「反斜杠 + b」两个字符。
// 看上去一模一样，实际要求文本里真有个退格符——**那条正则从写下来那天起
// 一次都没匹配过任何东西**。同一个文件里这样的有四条。
//
// ⚠️判据：**看不见的字符，肉眼永远查不出来，只能让机器扫。**
//   所以这道闸不是「把那四条改对」，是「以后再混进来当场红」。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");

// 允许的：换行、回车、制表符。其余 C0 控制字符一律不许出现在源码里。
const BAD = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
test("源码里不许有控制字符（那四条正则就是这么死的）", () => {
  const hits = [];
  const walk = dir => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "vendor") return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      if (!/\.(js|mjs|cjs|html|json|md)$/.test(e.name)) return;
      const txt = fs.readFileSync(full, "utf8");
      txt.split("\n").forEach((line, i) => {
        const m = line.match(BAD);
        if (!m) return;
        hits.push(path.relative(ROOT, full) + ":" + (i + 1) +
          " 有 0x" + m[0].charCodeAt(0).toString(16).padStart(2, "0"));
      });
    });
  };
  walk(path.join(ROOT, "js"));
  walk(path.join(ROOT, "test"));
  ["index.html", "rescue.html"].forEach(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      const m = line.match(BAD);
      if (m) hits.push(f + ":" + (i + 1) + " 有 0x" + m[0].charCodeAt(0).toString(16).padStart(2, "0"));
    });
  });
  assert.deepEqual(hits, [], "源码里混进了看不见的控制字符：\n" + hits.join("\n"));
});

// 光把字符换掉不够：得证明那几条现在【真的拦得住】她收到的那句话。
const src = fs.readFileSync(path.join(ROOT, "js", "engine.js"), "utf8");
const grab = (start, endTok) => { const i = src.indexOf(start); assert.ok(i > 0, "抠不出 " + start); return src.slice(i, src.indexOf(endTok, i) + endTok.length); };
const vm = require("node:vm");
const ctx = { console };
vm.createContext(ctx);
// ⚠️必须一次性跑进【同一个 script】：const 是 script scope，分开跑那个函数看不见它们
//   （我第一版就是分开跑的，测出来「没认出来」，差点把病因判到别处去）。
vm.runInContext([
  grab("const UPSTREAM_ERROR_PATTERNS", "\n];"),
  grab("const UPSTREAM_ERROR_PHRASES", "\n];"),
  grab("function upstreamErrorInContent", "\n}"),
  grab("function assertNotUpstreamError", "\n}"),
  "globalThis.U = upstreamErrorInContent; globalThis.A = assertNotUpstreamError; globalThis.P = UPSTREAM_ERROR_PATTERNS;"
].join("\n"), ctx);

// 她 2026-09-06 那张截图上的原话，一个字没改（320 字）
const GEMINI_BLOCK = "The prompt could not be submitted. The prompt contains sensitive words that violate Google's [Generative AI Prohibited Use policy](https://policies.google.com/terms/generative-ai/use-policy). Try rephrasing the prompt. If you think this was an error, [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting";

test("她收到的那句原话，现在拦得住", () => {
  assert.ok(GEMINI_BLOCK.length > 300, "得是【超过 300 字】的那一份——短语兜底那道闸只在 300 以内启用，这一条正是从它旁边溜过去的");
  assert.ok(ctx.U(GEMINI_BLOCK), "还是认不出来");
  assert.throws(() => ctx.A(GEMINI_BLOCK, "gemini", "〔diag〕"), /线路报错（不是模型写的正文）/);
  // 具体是被哪一条拦住的：必须是【锚在开头】的那条，不能只靠短语兜底——
  // 兜底有 300 字的长度上限，靠它等于把闸建在沙子上。
  assert.ok(ctx.P.some(re => re.test(GEMINI_BLOCK)), "只有短语兜底认得出，锚定那条还是死的");
});

test("那四条被退格符吃掉的，逐条验一遍", () => {
  [["empty response from gemini api", "空回复"],
   ["The prompt could not be submitted. 后面还有很多字", "提示词被拦"],
   ["Internal server error, please try again later", "上游 500"],
   ["Upstream error: no channel available", "中转没通道"]].forEach(([t, zh]) =>
    assert.ok(ctx.U(t), zh + " 这条还是拦不住"));
});

test("那道 300 字的闸是有用的：长正文里偶然出现那句话，不算线路错误", () => {
  // 短语兜底只在 300 字以内启用——因为「正文不会这么短还刚好在讲配额/密钥/拦截」。
  // 拆了这道闸，下面这段【角色自己写的长英文】就会被判成线路错误，
  // 而它只是在讲一个被拦下来的提示词。
  const LONG = "I kept staring at the screen for a long time last night, and I could not "
    + "figure out why the prompt was blocked when everything I typed felt so ordinary to me. "
    + "It was the kind of sentence you would say to me across the kitchen table, nothing more, "
    + "and yet the machine decided it was too much. I sat there rereading it, wondering whether "
    + "the problem was the words or the person who wrote them, and eventually I closed the laptop "
    + "and went to look for you instead.";
  assert.ok(LONG.length > 300, "得是超过 300 字的那一份，不然测不到这道闸");
  assert.match(LONG, /prompt was blocked/, "得真含着那句短语，不然它本来就不会被判错");
  assert.equal(ctx.U(LONG), "", "把角色写的长正文当成线路错误了——那道 300 字的闸被拆了");
});

test("角色本人说英文不许被误伤", () => {
  ["I could not stop thinking about the prompt you gave me last night.",
   "Empty. That's how the room felt after you left.",
   "The prompt on my screen blinked. I typed nothing."].forEach(t =>
    assert.equal(ctx.U(t), "", "把角色的正文当成线路错误了：" + t));
});
