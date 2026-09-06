// v64.88：她 2026-09-06 报「我们设的可以放 5 套预设那个按钮也是摆设」。
//
// 病根跟 v62.5x 那次 confirm 一字不差：**window.prompt 在 PWA / iOS 独立窗口里会被
// 系统吞掉，而且【不抛异常、直接返回 null】**。槽位那颗键当时写的是
//   try { nm = window.prompt(...) || ""; } catch (_) { nm = "预设 " + (i+1); }
// ——catch 一次都走不到（没有异常），走的是 `nm === "" → return`，
// 于是按下去什么都不发生。**「有兜底」和「兜底真的会跑」是两件事。**
//
// debate.js 里 v62.5x 就为这件事记过一次教训（「和 confirm 一样会被 iOS/PWA 永久吞掉」），
// 可全库还留着六处 window.prompt 和八处裸 confirm——又是
// 「一层写在十几处，一处修好，别处没跟上」（four-surfaces-same-context.md 那个形状）。
//
// 所以这份测试**逐个文件点名**，而不是数出现次数：
// 少接一处才红，将来新写一处也会红；不因为「总数对上了」而放行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JS = path.join(__dirname, "..", "js");
const read = f => fs.readFileSync(path.join(JS, f), "utf8");

// 唯一允许还留着原生 confirm 的两处，都不归这个窗口管：
//   app.js 那处是言秋的 CC 授权闸（「任何言秋的东西除了他本人都不准动」），
//   rescue-console.js 是 Codex 的互救台。
// ⚠️两处都不是「不用改」，是「不该由我改」。哪天它们的主人来改，把这里一起删掉。
const OWNED_ELSEWHERE = {
  "app.js": ['const approved = window.confirm("言秋想通过 CC 做这项操作'],
  "rescue-console.js": ["if (confirmText && !window.confirm(confirmText)) return;"]
};
// study.js 里那个 confirm 是组件自己的局部函数（function confirm(outline)），不是原生的
const LOCAL_SHADOW = { "study.js": ["confirm(draft);"] };

test("js 里不许再有裸的 window.prompt / confirm（PWA 会静默吞掉它们）", () => {
  const files = fs.readdirSync(JS).filter(f => f.endsWith(".js")).sort();
  assert.ok(files.length > 20, "js 目录扫空了，先看是不是路径不对");
  const bad = [];
  for (const f of files) {
    const src = read(f);
    src.split("\n").forEach((line, i) => {
      const code = line.replace(/^\s*\/\/.*$/, "");           // 整行注释不算
      if (!/(^|[^.\w$])(window\.)?(confirm|prompt)\s*\(/.test(code)) return;
      if (/requestApp(Confirm|Prompt)|__appPrompt|__appConfirm/.test(code)) return;
      if (/function\s+(confirm|prompt)\s*\(/.test(code)) return;   // 局部同名函数的定义
      if (/\/(?:[^/\\]|\\.)*prompt[^/]*\/[gimsuy]*/.test(code)) return; // 正则字面量里的 prompt
      const allow = (OWNED_ELSEWHERE[f] || []).concat(LOCAL_SHADOW[f] || []);
      if (allow.some(a => code.includes(a))) return;
      bad.push(f + ":" + (i + 1) + "  " + code.trim().slice(0, 90));
    });
  }
  assert.deepEqual(bad, [], "这几处还在用原生 confirm/prompt，PWA 里会被吞掉、按下去毫无反应：\n" + bad.join("\n"));
});

test("要她填字的那一层：components 只经 window.__appPromptOpen，自己不碰 window.prompt", () => {
  const comp = read("components.js");
  const i = comp.indexOf("function requestAppPrompt(");
  assert.ok(i > 0, "requestAppPrompt 不见了");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /window\.__appPromptOpen/, "requestAppPrompt 没走 App 那一层");
  assert.ok(!/window\.prompt/.test(seg), "requestAppPrompt 里又回去调原生 prompt 了");
  // 挂不上的时候要出声，不许静悄悄什么都不做——那就跟原来的摆设一模一样了
  assert.match(seg, /__toast/, "输入层没准备好时没有任何提示，跟摆设没区别");
});

test("PromptDialog：确定键的字色跟主题走，不写死白", () => {
  const comp = read("components.js");
  const i = comp.indexOf("function PromptDialog({");
  assert.ok(i > 0, "PromptDialog 不见了");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /fontWeight: 700, color: t\.bg2, background: t\.ink/, "确定键的字色不是 t.bg2");
  assert.ok(!/"#fff"/.test(seg), "又写死回白了（深色主题里就是白底白字）");
  assert.match(seg, /multiline\s*\?[\s\S]{0,200}h\("textarea"/, "多行那一支没了");
  assert.match(seg, /maxLength: maxLength \|\| undefined/, "字数上限没接上");
});

test("App 那一层：把 __appPromptOpen 挂上去，并且真的渲染 PromptDialog", () => {
  const app = read("app.js");
  assert.match(app, /const \[appPrompt, setAppPrompt\] = useState\(null\)/, "appPrompt 这个状态没了");
  assert.match(app, /window\.__appPromptOpen = open;/, "没把入口挂到 window 上");
  assert.match(app, /if \(window\.__appPromptOpen === open\) delete window\.__appPromptOpen;/, "卸载时没摘钩子（换页后会指向旧的 setState）");
  assert.match(app, /appPrompt && h\(PromptDialog, \{/, "没渲染 PromptDialog");
  // 回调抛异常不许静默：跟 ConfirmDialog 那一层同一套兜底
  assert.match(app, /onOk: v => \{ const fn = appPrompt\.onOk; setAppPrompt\(null\);/, "onOk 没有先关弹窗再跑回调");
});

test("这一轮换掉的那几处，逐个点名（少一处才红）", () => {
  const want = [
    ["theme-studio-ui.js", 'requestAppPrompt("给这一套起个名字"', "5 套预设槽位——她这次报的就是这颗"],
    ["screens.js", 'requestAppPrompt("歌单改名"', "歌单改名"],
    ["screens.js", 'requestAppPrompt("给这套思考方式起个名字"', "思考方式存预设"],
    ["screens.js", 'requestAppPrompt("退回给执笔人"', "退回给执笔人（多行）"],
    ["screens.js", 'requestAppConfirm("用「" + pr.name + "」替换当前内容？"', "小稿检查方式的内置预设"],
    ["screens.js", 'requestAppConfirm("本机现在一个角色都没有"', "空存档覆盖云端那道闸"],
    ["screens.js", 'requestAppConfirm("云端那份比这台设备新得多"', "过期设备覆盖云端那道闸"],
    ["screens.js", "requestAppConfirm(q, body, () => onSettleDebt(char.id, d.id)", "钱包结清一笔"],
    ["style-lab.js", 'requestAppPrompt("粘贴模块包"', "粘贴模块包（多行）"],
    ["style-lab.js", 'requestAppPrompt("搬哪一条过来？"', "从旧文风搬一条"],
    ["theater.js", 'requestAppConfirm("重开此线？"', "小剧场重开此线"],
    ["theater.js", 'requestAppConfirm("为这条线谢幕？"', "小剧场谢幕"],
    ["dream.js", 'requestAppConfirm("主动醒来，离开这场梦？"', "解梦馆醒来"],
    ["dream.js", 'requestAppConfirm("回到第 " + (k + 1) + " 幕重新选？"', "解梦馆回档"]
  ];
  const miss = want.filter(([f, needle]) => !read(f).includes(needle)).map(([f, , why]) => f + " · " + why);
  assert.deepEqual(miss, [], "这几处掉队了：\n" + miss.join("\n"));
});

test("两道云端防呆闸：拦下来之后不许直接备份，得等她自己点", () => {
  const src = read("screens.js");
  const seg = src.slice(src.indexOf("const doPush = () =>"), src.indexOf("const doPull ="));
  // 空存档那一支：弹完就 return，不许往下走
  assert.match(seg, /requestAppConfirm\("本机现在一个角色都没有"[\s\S]{0,320}?\n      return;/, "空存档那一支弹完还往下走了");
  assert.match(seg, /requestAppConfirm\("云端那份比这台设备新得多"[\s\S]{0,420}?\n        return;/, "过期设备那一支弹完还往下走了");
  // 真正动手的那一步单独一个函数，只能由确认回调叫起来
  assert.match(seg, /const doPushNow = async \(\) => \{\s*\n\s*setBusy\("push"\);/, "doPushNow 不见了");
  assert.ok(!/window\.confirm/.test(seg), "云端备份那两道闸又用回原生 confirm 了");
});
