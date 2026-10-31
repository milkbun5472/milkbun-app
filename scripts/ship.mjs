#!/usr/bin/env node
// 一条命令发版（她 2026-10-13：「施工规则能不能搞让大家快一点，我等太久浪费我的时间，但是不能 compromise 质量」）。
//
// 原来发版是十来步手抄的链子：commit → fetch → merge → 收 STAMP 冲突 → bump → 手改 ?v= →
// check-version → 跑测试 → diff --check → commit → push 分支 → 再 fetch → 推 main，撞号了从头来。
// 每一步都有人抄错过：用 ; 串起来测试红了照推、bump 传了 --dry 把版本写成 "--dry"、
// 只跑一半测试就推、wip 合进 main 时测试没跟上（2026-10-13 公共版因此卡了六个红灯）。
// 这些坑全收进这一个脚本：哪一步不过就停，不推。
//
// 用法（先把改动写好，不用自己 commit）：
//   node scripts/ship.mjs --msg-file /tmp/msg.txt --entries couple,chat
//   node scripts/ship.mjs --msg-file /tmp/msg.txt --none "纯修内部，用法没变"
//   测试默认只跑这次动过的文件相关的那几份（她 2026-10-31「改吧」：每次推都跑全套太慢）：
//     改过的 test 文件本身＋源码里提到改过的文件名的测试＋版本/攻略戳那几份。全套留给公共版出货前，或者加 --full。
//   可选：--tests "test/x.test.js test/y.test.mjs"（自己点名）；--full（跑全套）
//         --brief "新增 xxx、yyy 挂点。"（不传就写「没动挂点」）
//         --allow 测试名片段（某个红灯【在 main 上也红、跟这次无关】时才用，要在回复里写明）
// msg 文件里写整段提交说明（含 Co-Authored-By 等尾注）；脚本会在第一行前面补上版本号。
//
// 跑到的那几份任何一个红就不推。别的窗口留在 main 上的红灯这里不替它查，出货前跑全套时才会撞见。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const msgFile = arg("--msg-file");
const entries = (arg("--entries") || "").split(",").map(s => s.trim()).filter(Boolean);
const none = arg("--none") || "";
const brief = arg("--brief") || "";
// --tests "test/a.test.js test/b.test.mjs"：只跑这次动过的那几份（她 2026-10-13：「不要跑全套！就跑动过的」）
let only = arg("--tests") || "";
const full = argv.includes("--full");
const allow = argv.flatMap((v, i) => v === "--allow" ? [argv[i + 1]] : []).filter(Boolean);
if (!msgFile || !existsSync(msgFile)) die("要给 --msg-file（提交说明，含尾注）");
if (!entries.length && !none) die("攻略那一关：--entries 写这版改了哪几条攻略，或 --none 写为什么不用改（manual-stamp 规矩）");

const sh = (c, o) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024, ...(o || {}) }).trim();
const tryd = c => { try { return sh(c); } catch (e) { return null; } };
function die(m) { console.error("✗ " + m); process.exit(1); }
const REMOTE = (() => { const rs = (tryd("git remote") || "origin").split("\n"); return rs.includes("origin") ? "origin" : rs[0]; })();
// 开工前先记下这次真改了哪些文件（后面会 bump 版本号、改 STAMP，那些不算）
const PRE_FILES = ((tryd("git diff --name-only " + REMOTE + "/main") || "") + "\n" + (tryd("git ls-files --others --exclude-standard") || "")).split("\n").filter(Boolean);
const BRANCH = sh("git rev-parse --abbrev-ref HEAD");
const GIT_DIR = sh("git rev-parse --absolute-git-dir");
const quote = s => "'" + String(s).replaceAll("'", "'\\''") + "'";
const VERSION_FILES = ["index.html", "manifest.json", "rescue.html", "js/app.js"];

// 版本那几行冲突：两边都只是号不同，取 main 那侧（反正马上重写）
const takeTheirsStampLines = p => {
  let s = readFileSync(p, "utf8");
  s = s.replace(/<<<<<<< [^\n]*\n((?:(?!=======)[^\n]*\n)*?)=======\n((?:(?!>>>>>>>)[^\n]*\n)*?)>>>>>>> [^\n]*\n/g, (all, ours, theirs) =>
    /STAMP|APP_VERSION/.test(ours + theirs) && ours.split("\n").length <= 3 && theirs.split("\n").length <= 3 ? theirs : all);
  writeFileSync(p, s);
  return !/^<<<<<<< /m.test(s);
};

// index.html 冲突：取 main 那份（号马上重写），但【这一边新加的 <script src="js/…">】要插回去——
//   原来整份取 main，新文件的那一行就丢了，发出去的版本根本不加载它（char-transfer、ask-slip 两次都是这样丢的）
const keepNewScripts = () => {
  const key = l => (String(l).match(/src="(js\/[^"?]+)/) || [])[1];
  const ours = sh("git show :2:index.html").split("\n");
  const out = sh("git show " + REMOTE + "/main:index.html").split("\n");
  const have = new Set(out.map(key).filter(Boolean));
  ours.forEach((l, i) => {
    const k = key(l);
    if (!k || have.has(k)) return;
    let j = i - 1; while (j >= 0 && !(key(ours[j]) && have.has(key(ours[j])))) j--;
    const at = j >= 0 ? out.findIndex(x => key(x) === key(ours[j])) + 1 : out.length;
    out.splice(at, 0, l); have.add(k);
    console.log("index.html 合 main：保住新加的 " + k);
  });
  writeFileSync("index.html", out.join("\n") + "\n");
};
// 开跑前：上一次合到一半没收完、或者文件里还留着冲突标记，一律不动
if (existsSync(GIT_DIR + "/MERGE_HEAD")) die("有一次合并还没收完（.git/MERGE_HEAD 在）：先收好或 git merge --abort 再跑");
{ const left = tryd("git grep -lE \"^(<<<<<<<|>>>>>>>) \" -- js index.html test scripts");
  if (left) die("这些文件里还有冲突标记，先收干净：\n" + left); }
for (let round = 1; round <= 4; round++) {
  console.log("── 第 " + round + " 轮");
  // 1) 收进一个本地提交（发版提交最后再做一次，这个只是为了能合 main）
  sh("git add -A");
  if (tryd("git diff --cached --quiet") === null) sh("git commit -qm wip");
  // 2) 合最新 main
  sh("git fetch -q " + REMOTE + " main");
  if (tryd("git merge -q " + REMOTE + "/main -m \"merge main\"") === null) {
    const conflicted = sh("git diff --name-only --diff-filter=U").split("\n").filter(Boolean);
    for (const f of conflicted) {
      if (f === "index.html") { keepNewScripts(); continue; }
      if (VERSION_FILES.includes(f) && f !== "js/app.js") { sh("git show " + REMOTE + "/main:" + f + " > " + f, { shell: "/bin/bash" }); continue; }
      if (/assistant-manual\.js$|theme-studio\.js$|js\/app\.js$/.test(f) && takeTheirsStampLines(f)) continue;
      // 先把合了一半的状态退回去再停：不然下次一跑，开头那个 wip 提交会把带冲突标记的文件原样提交掉（2026-10-13 真出过）
      tryd("git merge --abort");
      die("合 main 有真冲突：" + f + "——已经退回合并前。手动 git merge " + REMOTE + "/main 收好（不许 checkout --ours）再重跑");
    }
    sh("git add -A"); sh("git commit -qm \"merge main\"");
  }
  // 3) 这一版动过哪些 js（相对 main），bump 自己看不见已提交的改动，这里补上指纹
  const changed = sh("git diff --name-only " + REMOTE + "/main...HEAD -- js/").split("\n").filter(f => f.endsWith(".js")).map(f => f.replace(/^js\//, "").replace(/\.js$/, "")).concat(["assistant-manual", "theme-studio"]);   // 下面一定会改这两份的戳
  const uniq = [...new Set(changed)]; changed.length = 0; changed.push(...uniq);
  // 号一律从【远端 main】+1：上一次在本地跑到一半停下的那次 bump 不算数（不然她那边会看到跳号）
  const mainV = sh("git show " + REMOTE + "/main:js/app.js").match(/APP_VERSION\s*=\s*"v(\d+)\.(\d+)"/);
  const mi = Number(String(mainV[2]).padEnd(3, "0").slice(0, 3));
  const nextV = mi >= 999 ? String(Number(mainV[1]) + 1).padStart(2, "0") + ".000" : mainV[1] + "." + String(mi + 1).padStart(3, "0");
  // 本地上次停在半路留下的高号先退回 main 的号，bump 才不会嫌「不高于现有最大」
  const mv = mainV[1] + "." + mainV[2], numv = v => { const [x, y] = String(v).split("."); return Number(x) * 1000 + Number(String(y).padEnd(3, "0").slice(0, 3)); };
  const down = (f, re) => { if (existsSync(f)) writeFileSync(f, readFileSync(f, "utf8").replace(re, (m0, pre, v) => numv(v) > numv(mv) ? pre + mv : m0)); };
  down("js/app.js", /(APP_VERSION\s*=\s*"v)([\d.]+)/g); down("index.html", /(\?v=)(\d{2}\.\d{2,3})(?![\d.])/g);
  down("manifest.json", /(launch=)([\d.]+)/g); down("rescue.html", /(TARGET=")([\d.]+)/g);
  // 本地历史里留着一次没推上 main 的发版提交（比如跑到一半被打断）：它的号也算「现有最大」，main+1 就会撞上它。
  //   那就不指定号，让 bump-version 自己取「现有最大 +1」——main 上跳过一个号，总比发不出去强（2026-10-30 卡在 76.940）
  let bump; try { bump = sh("node scripts/bump-version.mjs " + nextV); } catch (e) { if (!/不高于现有最大/.test(String((e && e.stderr) || e))) throw e; bump = sh("node scripts/bump-version.mjs"); }
  const V = readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*"v([\d.]+)"/)[1];
  console.log(bump.split("\n").pop());
  let html = readFileSync("index.html", "utf8");
  changed.forEach(f => { html = html.replace(new RegExp("(js/" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.js\\?v=)[\\d.]+", "g"), "$1" + V); });
  writeFileSync("index.html", html);
  // 4) 攻略戳、美化戳
  const man = readFileSync("js/assistant-manual.js", "utf8").replace(/const STAMP = \{[^\n]*\};/, "const STAMP = " + JSON.stringify({ v: "v" + V, entries, none }) + ";");
  writeFileSync("js/assistant-manual.js", man);
  const ts = readFileSync("js/theme-studio.js", "utf8").replace(/const BRIEF_STAMP = \{[^\n]*\};/, "const BRIEF_STAMP = " + JSON.stringify({ v: "v" + V, changed: brief, none: brief ? "" : "这一版没动美化挂点。" }).replace(/"(v|changed|none)":/g, "$1: ") + ";");
  writeFileSync("js/theme-studio.js", ts);
  // 5) 闸：指纹、语法、空白、全套测试
  if (tryd("node scripts/check-version.mjs") === null) die("check-version 不过：" + (tryd("node scripts/check-version.mjs 2>&1; true") || ""));
  for (const f of changed) if (existsSync("js/" + f + ".js") && tryd("node --check js/" + f + ".js") === null) die("语法错：js/" + f + ".js");
  if (tryd("git diff --check " + REMOTE + "/main") === null) die("git diff --check 不过（行尾空白／冲突标记）");
  console.log(only ? "跑这次相关的测试：" + only : "跑全套测试（并行）…");
  let out = "";
  // ⚠️钉死 tap 格式：下面认的是 tap 的「not ok」「# pass」。新版 node 管道里默认出的是另一种格式（✖ / ℹ pass），
  //   一行都认不出来，于是「没有红灯」，带着红灯照推（2026-10-16 v75.828 就是这么带着两条红推上去的）。
  //   还有一种「什么都没跑」：这个脚本自己在一个测试里被调起来时（ship-worktree.test.mjs），继承来的 NODE_TEST_CONTEXT
  //   会让里面这次 node --test 以为自己嵌在别的测试里，直接跳过、一条都不跑。拿掉它，让这一次真的跑。
  // ⚠️两个目录都要喂：测试分家住在 test/ 和 tests/ 两处，而这里原来只写了 test/*，
  //   于是 tests/ 那十来份从来没进过发版的闸——2026-10-29 翻出来时三条红灯已经红了半个月，
  //   没人看见，也拦不住任何东西。
  const FULL_SUITE = "test/*.test.js test/*.test.mjs tests/*.test.js tests/*.test.mjs";
  if (!only && !full) only = relatedTests();
  if (!only && !full) console.log("（没找到相关测试，退回全套）");
  const testEnv = Object.assign({}, process.env); delete testEnv.NODE_TEST_CONTEXT;
  try { out = sh("node --test --test-reporter=tap " + (only || FULL_SUITE) + " 2>&1", { shell: "/bin/bash", env: testEnv }); } catch (e) { out = String(e.stdout || "") + String(e.stderr || ""); }
  const fails = (out.match(/^not ok \d+ - .*$/gm) || []).filter(l => !allow.some(a => l.includes(a)));
  const pass = (out.match(/^# pass (\d+)/m) || [])[1], fail = (out.match(/^# fail (\d+)/m) || [])[1];
  console.log("测试：" + pass + " 过，" + fail + " 不过" + (allow.length ? "（--allow 放过：" + allow.join("、") + "）" : ""));
  // 读不出结果＝不知道过没过，一律当没过（不许再「看不懂就当绿」）
  if (pass === undefined || fail === undefined) die("读不出测试结果，不推：\n" + out.slice(-800));
  if (Number(fail) > 0 && !fails.length && !allow.length) die("测试报了 " + fail + " 条不过，但没认出是哪几条，不推：\n" + out.slice(-800));
  if (fails.length) die("有红灯，不推：\n" + fails.join("\n"));
  // 6) 发版提交 + 推
  const msg = readFileSync(msgFile, "utf8").replace(/^\s*/, "v" + V + " ");
  writeFileSync(GIT_DIR + "/SHIP_MSG", msg);
  sh("git add -A"); sh("git commit -q --allow-empty -F " + quote(GIT_DIR + "/SHIP_MSG"));   // 上一次停在半路时版本号已经跟着 wip 提交进去了，这里可能没有新改动，说明照样要落一条
  sh("git push -q " + REMOTE + " HEAD:" + BRANCH);
  sh("git fetch -q " + REMOTE + " main");
  if (tryd("git merge-base --is-ancestor " + REMOTE + "/main HEAD") === null) { console.log("main 在这期间又被别人推了，重来一轮"); continue; }
  if (tryd("git push -q " + REMOTE + " HEAD:main") === null) { console.log("推 main 被拒（多半又撞了），重来一轮"); continue; }
  console.log("✓ 已推 main：v" + V);
  process.exit(0);
}
die("连撞四轮没推上去，过一会儿再跑");

// 这次相关的测试：改过的测试文件本身，加上源码里点了改过文件名的测试，再加版本／攻略／美化戳那几份（每次发版都动它们）。
//   版本号、?v= 指纹、STAMP 这些每次都改的文件不算「改过」——不然 index.html、app.js 一挂上，几乎全套都会被拉进来。
function relatedTests() {
  const ls = d => { try { return sh("ls " + d).split("\n").filter(f => /\.test\.(m?js)$/.test(f)).map(f => d + "/" + f); } catch (e) { return []; } };
  const all = ls("test").concat(ls("tests"));
  const files = PRE_FILES;
  const pick = new Set(files.filter(f => all.includes(f)));
  const base = files.filter(f => !all.includes(f) && !/^(index\.html|manifest\.json|rescue\.html)$/.test(f))
    .map(f => f.split("/").pop()).filter(f => /\.(m?js|cjs|py|html|css|json)$/.test(f));
  const always = /\/(ship-|check-version|manual-stamp|brief-stamp|changelog)/;
  for (const t of all) {
    if (always.test(t)) { pick.add(t); continue; }
    if (!base.length) continue;
    let src = ""; try { src = readFileSync(t, "utf8"); } catch (e) { continue; }
    if (base.some(b => src.includes(b) || src.includes('"' + b.replace(/\.m?js$/, "") + '"'))) pick.add(t);
  }
  return [...pick].join(" ");
}
