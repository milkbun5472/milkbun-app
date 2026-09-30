// 她 2026-09-29：「为啥家里的卡在 300」。查下来不是缓存——
//   57c464e bump 到 74.301，后面那个「合并 main」解指纹冲突时取了【低的那边】，
//   又改回 74.300。于是代码是新的、指纹是旧的：手机看见 ?v= 没变就不重新下文件，
//   那一版所有改动永远进不了她手机，而测试全绿、开机正常、看不出任何异样。
// bump-version.mjs 开头写的正是这个病（「把 APP_VERSION 一路盖回 55.13」），
// 可它只在【发版那一刻】算最大值；把号改小的是【合并】，没人管。这一条就管合并。
// ⚠️判据和 bump-version 用同一个 num()：小数部分按小数比（73.301 > 73.30，73.31 > 73.301）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const root = path.join(__dirname, "..");
const num = v => { const [a, b] = String(v).split("."); return Number(a) * 1000 + Number(String(b || "").padEnd(3, "0").slice(0, 3)); };
const grab = t => [...String(t || "").matchAll(/v?(\d{2,3})\.(\d{2,3})/g)].map(m => m[1] + "." + m[2]);

const cur = fs.readFileSync(path.join(root, "js/app.js"), "utf8").match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1];

test("四份指纹要一致（改一处漏三处也是这个病）", () => {
  assert.ok(cur, "app.js 里读不到 APP_VERSION");
  const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const target = fs.readFileSync(path.join(root, "rescue.html"), "utf8").match(/TARGET="([\d.]+)"/)?.[1];
  const launch = fs.readFileSync(path.join(root, "manifest.json"), "utf8").match(/launch=([\d.]+)/)?.[1];
  assert.equal(target, cur, "救援页的 TARGET 落后了——白屏时唯一那条自救路会指向旧版");
  assert.equal(launch, cur, "manifest 的 launch 落后了");
  assert.ok(idx.includes("?v=" + cur), "index.html 里没有这一版的指纹");
});

test("指纹不许比历史上出现过的最大值小", () => {
  let past = [];
  try {
    // 只看最近这些提交的标题：发版提交的标题里一定带版本号
    past = grab(execSync("git log --format=%s -80", { cwd: root, encoding: "utf8" }));
  } catch (_) {
    return; // 不在 git 仓库里（比如别人解包跑测试）就跳过，不能因此发不了版
  }
  if (!past.length) return;
  const max = past.reduce((a, b) => (num(b) > num(a) ? b : a));
  assert.ok(num(cur) >= num(max),
    "指纹倒退了：现在是 " + cur + "，而历史上已经出过 " + max + "。\n" +
    "  多半是合并时把指纹冲突解成了【低的那边】——判据不是「取自己这边」，是【取大的那个】。\n" +
    "  低的那个一旦被选中，那一版所有改动都进不了手机，而且看起来一切正常。\n" +
    "  修法：node scripts/bump-version.mjs 重新打一个号（代码一个字都不用动）。");
});
