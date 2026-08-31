const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-08-30（截图）：「角色朋友圈我都没刷新过他就自己出来的」
test("打开一个还没数据的版块＝自动生成一次，而且只生成一次", () => {
  const i = phone.indexOf("  useEffect(() => {\n    if (isLive || charData[appKey]) return;");
  assert.ok(i > 0, "打开即生成那一支不见了");
  const seg = phone.slice(i, i + 420);
  // 已经有数据就不许再生成——没有这个闸，每次点进来都是一刀
  assert.match(seg, /if \(isLive \|\| charData\[appKey\]\) return;/);
  assert.match(seg, /Promise\.resolve\(onGen\(char, appKey\)\)/);
  // 接真数据的那几个不该走生成
  assert.match(phone, /const isLive = PHONE_LIVE_KEYS\.indexOf\(appKey\) >= 0;/);
});

test("转圈的字得说实话：这一步是花钱的，不是「读取」", () => {
  // genPhoneApp 里是 runProbe，真去调模型；写「读取」会让人以为只是在翻存好的东西
  assert.match(app, /const genPhoneApp = async \(char, key, weekly\) => \{/);
  const g = app.slice(app.indexOf("const genPhoneApp = async"), app.indexOf("const genPhoneApp = async") + 1200);
  assert.match(g, /await runProbe\(/, "它确实是去调模型的");
  assert.doesNotMatch(phone, /label: "正在读取 " \+ zh/, "还写着「读取」");
  assert.match(phone, /label: "正在生成 " \+ zh \+ "…（这一步会调一次模型）"/);
  // 两个分支合成了一个，别再各写一遍
  assert.equal((phone.match(/正在生成 " \+ zh/g) || []).length, 1);
});

test("查手机会自己更新的两条路，各自都说得清", () => {
  // ① 打开没数据的版块 → 自动生成（上面那条）
  // ② 每周刷新 → 整份重生成，而且是在开 app 那一拍跑的
  assert.match(app, /const phoneWeeklySweep = async \(\) => \{/);
  // ⚠️别把整句话冻死。v58.89 起是一次唤起连着刷完这一周欠的所有人，
  // 所以报的是「几个都刷好了 / 刷了几个」，不再是「刚才刷了谁」。
  assert.match(app, /toast\(\(done === pending\.length/, "每周刷新还是无声的，她没法知道刚才为什么变了");
  assert.match(app, /"每周刷新：" \+ pending\.length \+ "/, "刷完没说这一轮刷了几个");
  // 例行刷新不许顺手改她在看谁
  assert.match(app, /if \(!weekly\) setSelPhone\(char\.id\);/);
});
