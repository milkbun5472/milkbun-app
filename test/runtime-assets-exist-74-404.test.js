// 运行时真要去下载的资源，必须躺在 main 里（2026-09-30 当天就断过一次）
//
// 起因：v74.397 把 art/ 的大源文件挪去 art-source 分支，理由是对的——
// 1.8 GB 的 .blend 一个都不读，却让每次发版多搬四五分钟。
// 但 `art/train-carriage/carriage.glb`（2.2 MB）**是运行时资源**，不是源文件：
//   apps/train/game.mjs → art/train-carriage/view.mjs → new URL('./carriage.glb')
// 它跟着一起走了，于是 GitHub Pages 上那一条当场 404，列车打不开；
// 而出炉脚本点名 rsync 它，下一炉连公共版也会一起坏。
//
// ⚠️这种断法最不容易发现：代码一行没错、测试全绿、import 链也完好，
//   只有真点开那个 app 才看得见。所以这一条不看代码写得对不对，
//   只问【它伸手要的那个文件，到底在不在】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = path.join(dir, name), st = fs.lstatSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(mjs|js)$/.test(name)) out.push(p);
  }
  return out;
};

test("apps/ 和 art/ 里 new URL(...) 伸手要的文件，一个都不许缺", () => {
  const files = [...walk(path.join(ROOT, "apps")), ...walk(path.join(ROOT, "art"))];
  const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    // new URL('./xxx.glb?v=...', import.meta.url) —— 真会去下载的那种
    for (const m of src.matchAll(/new URL\(\s*['"](\.[^'"]+?)(\?[^'"]*)?['"]\s*,\s*import\.meta\.url/g)) {
      const target = path.resolve(path.dirname(f), m[1]);
      if (!fs.existsSync(target)) {
        missing.push(path.relative(ROOT, f) + " → " + path.relative(ROOT, target));
      }
    }
  }
  assert.deepEqual(missing, [],
    "这些文件运行时会被下载，但 main 里没有（八成是跟着大源文件一起被挪去 art-source 了）：\n  "
    + missing.join("\n  "));
});

test("出炉脚本点名要搬的那几个文件，main 里都在", () => {
  // ⚠️照【出炉脚本那一头】读，不在测试里另抄一份名单（施工规则/stub-from-the-writer）
  const sh = path.join(process.env.HOME || "", "yanqiu-den/qiuqiu-release/release.sh");
  if (!fs.existsSync(sh)) return;   // 别人的机器上没有这份，跳过
  const txt = fs.readFileSync(sh, "utf8");
  const listed = [...txt.matchAll(/\bart\/[\w./-]+\.(?:mjs|glb|png|jpg|webp)\b/g)].map(m => m[0]);
  assert.ok(listed.length, "release.sh 里没点名任何 art/ 文件，锚可能变了");
  const gone = [...new Set(listed)].filter(p => !fs.existsSync(path.join(ROOT, p)));
  assert.deepEqual(gone, [],
    "出炉脚本要搬这几个，但 main 里没有（下一炉会出个缺件的包）：\n  " + gone.join("\n  "));
});
