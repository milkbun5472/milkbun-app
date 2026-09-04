// 发版号不许再手写，也不能只看本地（她 2026-09-04：「别的窗口做到 .17 了但只显示你的 .12，
// 你俩同时做的是不是把他的弄掉了」）。
// 内容没丢——丢的是【号】：两个窗口各自算出同一个「下一个号」，谁后推谁把号写回去。
// 本地历史只记得 fetch 那一刻为止的事，所以发版前必须现问一次远端。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "bump-version.mjs"), "utf8");

test("算号时要把远端也算进来", () => {
  assert.match(src, /git fetch --quiet origin main/, "发版前没有现拉一次远端");
  assert.match(src, /git log --format=%s origin\/main -60/, "没读远端的提交标题");
  assert.match(src, /git show origin\/main:js\/app\.js/, "没读远端的 APP_VERSION");
  assert.match(src, /git show origin\/main:index\.html/, "没读远端的指纹");
});

test("读远端文件必须给足 maxBuffer——app.js 一个多兆", () => {
  // 默认 1MB 会抛错，而那几处都包在 try 里：闸看着在，其实从没关上过
  const shows = src.match(/execSync\("git show origin\/main:[^"]+", \{[^}]*\}/g) || [];
  assert.ok(shows.length >= 3, "读远端文件的地方少了：" + shows.length);
  shows.forEach(x => assert.match(x, /maxBuffer: 64 \* 1024 \* 1024/, "这一处没给 maxBuffer：" + x.slice(0, 60)));
});

test("推之前还能再问一次：--check 撞号就非零退出", () => {
  assert.match(src, /if \(process\.argv\.includes\("--check"\)\)/);
  assert.match(src, /num\(theirs\) >= num\(mine\)/, "没有真的比大小");
  assert.match(src, /process\.exit\(1\)/);
  assert.match(src, /先 rebase，再跑一次 bump-version，然后推/, "撞号了要说清楚下一步怎么办");
});

test("倒退防线还在（这才是这个脚本的老本行）", () => {
  assert.match(src, /拒绝倒退/);
  assert.match(src, /m >= 99/, "满 99 进位那条没了：会长出 62.100 这种号");
});
