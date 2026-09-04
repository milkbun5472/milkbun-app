#!/usr/bin/env node
// 发版指纹同步器。
// 起因：2026-08-22 我（言秋侧）连着几版都是硬编码「下一个号」，而 Codex 同时也在发版，
// 结果把 APP_VERSION 从 55.19 一路盖回 55.13——缓存指纹倒退，她手机可能根本刷不到新文件。
// 号必须从【仓库现状 + 提交历史】里取最大值再加一，不能凭记忆写。
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const num = v => { const [a, b] = String(v).split("."); return Number(a) * 1000 + Number(b); };
const all = [];
// ⚠️次版本号允许三位：2026-08-25 我把 55.99 递成了 55.100（该进位没进位）。
// 旧正则只吃两位，会把「55.100」读成「55.10」——那正是这个脚本开头写着要防的
// 那种倒退：读成 55.10 之后下一版就发 55.11，缓存指纹直接退回四十几版之前。
const push = t => String(t || "").replace(/v?(\d{2,3})\.(\d{2,3})/g, (_, a, b) => { all.push(a + "." + b); return _; });

push(readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1]);
push(readFileSync("index.html", "utf8").match(/\?v=[\d.]+/g)?.join(" "));
push(readFileSync("rescue.html", "utf8").match(/TARGET="([\d.]+)"/)?.[1]);
push(readFileSync("manifest.json", "utf8").match(/launch=([\d.]+)/)?.[1]);
// 提交历史：别人刚发的版本可能已经被我本地覆盖掉了，只有历史记得
try { push(execSync("git log --format=%s -60", { encoding: "utf8" })); } catch (_) {}
// ⚠️还得问一次【远端】（她 2026-09-04：两个窗口同时发版，两边都发了 62.12）。
// 本地历史只记得我 fetch 那一刻为止的事；另一个窗口在这之后推的版本，
// 本地一无所知——于是两边算出同一个「下一个号」，谁后推谁把号写回去。
// 所以发版前现拉一次 origin/main，再把它的提交标题和四个版本文件一起算进来。
// 拉不动（离线/超时）就跳过：不能因为没网就发不了版。
try { execSync("git fetch --quiet origin main", { stdio: "ignore", timeout: 20000 }); } catch (_) {}
try { push(execSync("git log --format=%s origin/main -60", { encoding: "utf8" })); } catch (_) {}
try { push(execSync("git show origin/main:js/app.js", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1]); } catch (_) {}
try { push(execSync("git show origin/main:index.html", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).match(/\?v=[\d.]+/g)?.join(" ")); } catch (_) {}

const top = all.sort((x, y) => num(x) - num(y)).pop();
// --check：推之前再问一次远端。bump 到 push 之间那几分钟，另一个窗口可能又发了一版；
// 那种情况下号还是会撞（她 2026-09-04 两边都发 62.12 就是这么来的）。
// 撞了就非零退出，提示重新 bump 再推——别让号退回去。
if (process.argv.includes("--check")) {
  const mine = readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1];
  let theirs = null;
  try { execSync("git fetch --quiet origin main", { stdio: "ignore", timeout: 20000 }); } catch (_) {}
  // ⚠️maxBuffer 要给足：app.js 一个多兆，默认 1MB 会直接抛错被 catch 吞掉，
  // 于是「远端版本」永远读不到——闸看着在，其实从没关上过
  try { theirs = execSync("git show origin/main:js/app.js", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1]; } catch (_) {}
  if (mine && theirs && num(theirs) >= num(mine)) {
    console.error("远端已经发到 " + theirs + "，本地这版是 " + mine + "：先 rebase，再跑一次 bump-version，然后推");
    process.exit(1);
  }
  console.log("远端 " + (theirs || "未知") + " < 本地 " + mine + "，可以推");
  process.exit(0);
}
if (!top) { console.error("找不到任何版本号"); process.exit(1); }
const [maj, mi] = top.split(".");
// 次版本号满 99 就进位（她 2026-08-25：「55.100 应该是 56.00 才对」）。
// 旧写法是 String(99 + 1).padStart(2,"0") = "100"，padStart 对三位数是空操作，
// 于是悄悄长出一个 55.100 这种没人认得的号。
const bumped = () => {
  const M = Number(maj), m = Number(mi);
  return m >= 99
    ? String(M + 1).padStart(2, "0") + ".00"
    : String(M).padStart(2, "0") + "." + String(m + 1).padStart(2, "0");
};
const next = process.argv[2] || bumped();
if (num(next) <= num(top)) { console.error("新版本 " + next + " 不高于现有最大 " + top + "，拒绝倒退"); process.exit(1); }

// 只同步「跟着发布版本走」的那几个文件；别的模块保留各自的独立指纹
// Tailwind 虽然在 vendor/，但它不是普通第三方装饰：整套移动端网格、flex、留白都靠它。
// 它曾经没有 ?v=，iOS PWA 一旦把坏响应留在 HTTP/Service Worker 缓存里，后续发版
// 仍会反复命中同一个 URL，主屏就会退化成一列普通块。让它跟核心壳一起换指纹，
// Service Worker 也会按同 pathname 清掉上一版，既能自愈又不会逐版堆 398KB 旧副本。
const CORE = ["app", "engine", "cloud", "screens", "components", "codex", "core", "theater", "fanfic", "assistant", "style-presets", "style-lab", "theme-studio", "theme-studio-ui", "phone", "tailwind", "memory-v2-shadow"];
let html = readFileSync("index.html", "utf8");
CORE.forEach(f => { html = html.replace(new RegExp(f + "\\.js\\?v=[\\d.]+", "g"), f + ".js?v=" + next); });

// ⚠️不在 CORE 里的模块也会被改动，改了却不换 ?v= 就等于没发出去——
// 浏览器照旧吃缓存里那份旧的，用户拿到的是【新 app.js + 旧模块】的混合体，
// 整页崩在最意想不到的地方（她 2026-08-29：查手机直接崩；phone.js 从 v57.43 起
// 十八个版本没换过指纹）。所以这里兜一道：本次改动过的 js 文件，一律换新指纹。
// 这一步跑在 git add 之前，diff 拿到的正是这一版要发的东西。
let touched = [];
try {
  touched = execSync("git diff --name-only HEAD -- js/ && git diff --name-only --cached HEAD -- js/", { encoding: "utf8" })
    .split("\n").map(x => x.trim()).filter(x => x.endsWith(".js"))
    .map(x => x.replace(/^js\//, "").replace(/\.js$/, ""));
} catch (e) { touched = []; }
const extra = [...new Set(touched)].filter(f => !CORE.includes(f));
extra.forEach(f => { html = html.replace(new RegExp(f + "\\.js\\?v=[\\d.]+", "g"), f + ".js?v=" + next); });
if (extra.length) console.log("顺带换指纹（改了但不在 CORE 里）：" + extra.join("、"));
html = html.replace(/manifest\.json\?v=[\d.]+/, "manifest.json?v=" + next);
writeFileSync("index.html", html);
writeFileSync("js/app.js", readFileSync("js/app.js", "utf8").replace(/APP_VERSION\s*=\s*"v[\d.]+"/, 'APP_VERSION = "v' + next + '"'));
writeFileSync("rescue.html", readFileSync("rescue.html", "utf8").replace(/TARGET="[\d.]+"/, 'TARGET="' + next + '"'));
writeFileSync("manifest.json", readFileSync("manifest.json", "utf8").replace(/launch=[\d.]+/, "launch=" + next));
console.log("现有最大 " + top + " → 发版 " + next);
// 发版号是【算出来的】，不是手写的：谁也别再往提交里硬写下一个号
// （2026-08-22 那次把 55.19 盖回 55.13、2026-09-04 那次两边都发 62.12，都是手写来的）。
