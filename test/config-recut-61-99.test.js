// 她 2026-09-04：「设置页也还是好乱找不到东西，修一下吧」。
//
// 跟聊天设置那次（v61.79）一模一样的病，只是这一页更严重：
//   · 外观与壁纸／主题工作台／聊天气泡——【三张卡都在管长相】，
//     想改个颜色得先猜是哪一张；
//   · 「感知」这个词说的是什么完全看不出（其实是时间、位置、锁屏通知）；
//   · 图标是一堆几何符号（⌘ ◉ ✎ ? ◐ ✦ ◒ ↻ ▤ ⌁），? 和 ◐/◒ 几乎分不出；
//   · 十张 320px 高的大卡要滚一屏多——一眼扫不完的东西，怎么分类都难找。
//
// 这份测试钉的是那几条判据，不是钉文案。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const CFG = scr.slice(scr.indexOf("function Config(props) {"), scr.indexOf("function McpConfig("));
assert.ok(CFG.length > 6000, "抠不出 Config");

const ROWS = [...CFG.matchAll(/\{ key: "(\w+)", char: "(.)", title: "([^"]+)"/g)]
  .map(m => ({ key: m[1], char: m[2], title: m[3] }));

test("首页是一列窄行，一屏放得下——不是两列大卡", () => {
  assert.ok(ROWS.length >= 6 && ROWS.length <= 8, "首页现在 " + ROWS.length + " 行");
  // v62.48：表格的行是连着的，gap 一留它们就又读成一张张卡片了，所以 gap 归 0
  assert.match(CFG, /page === "home" && h\("div", \{ style: \{ display: "flex", flexDirection: "column", gap: 0/);
  // 原来那一串平级大卡要全撤掉（撤东西是删掉，不是留着）
  assert.doesNotMatch(CFG, /title: "API 与模型"/, "旧那张大卡还在");
  // v62.48：几何符号（◐ ◒ ✦ ⌨ ▧ ◖ ∞ ◉ ≋）全换成汉字栏号——它们是靠字体撑的字符，
  // 跟 emoji 同一个毛病，而且「◖」说明不了那是语音。所以这一条改判【汉字】。
  assert.doesNotMatch(CFG, /icon: "[^\u4e00-\u9fff\u00b7]"/, "还有靠字体撑的符号当图标");
  assert.match(CFG, /h\(ConfigTile, \{ icon: "色", tint: "#8a6d9c", title: "外观与壁纸"/);
});

test("索引牌一类一个字，撞不了车", () => {
  const chars = ROWS.map(r => r.char);
  assert.equal(new Set(chars).size, chars.length, "索引牌撞车了：" + chars.join(" "));
  for (const r of ROWS) assert.ok(/[一-鿿]/.test(r.char), r.key + " 的牌不是汉字");
  const keys = ROWS.map(r => r.key);
  assert.equal(new Set(keys).size, keys.length, "key 撞车了");
});

test("每一行写着现在是什么状态（不用点进去就知道）", () => {
  assert.equal(ROWS.length, [...CFG.matchAll(/state: \(\) =>/g)].length, "有几行没写状态");
  assert.match(CFG, /\}, row\.state\(\)\)/, "首页没把状态渲染出来");
  // 至少这几项要是【真读出来的】，不是写死的一句话
  assert.match(CFG, /props\.apiProfiles \|\| \[\]\)\.length/, "线路条数没真数");
  assert.match(CFG, /p\.timeAware !== false/, "时间感知没真读");
  assert.match(CFG, /f\[k\]\.global !== false/, "自动更新开了几项没真数");
});

test("三张都在管长相的卡合成一格，进去再分", () => {
  const row = ROWS.find(r => r.key === "look");
  assert.ok(row, "没有 look 这一格");
  assert.match(CFG, /page === "look" && h\(ConfigTileGrid/, "look 那一层没有子页");
  for (const t of ["外观与壁纸", "聊天气泡", "主题工作台"])
    assert.ok(CFG.indexOf('title: "' + t + '"') > CFG.indexOf('page === "look"'), t + " 没进 look 那一层");
});

test("返回一层一层退，不会一步跳回首页", () => {
  // api* → api、长相三兄弟 → look、小稿/问答 → write，其余 → home
  assert.match(CFG, /if \(\/\^api\[A-Z\]\/\.test\(page\)\) return setPage\("api"\);/);
  assert.match(CFG, /if \(page === "theme" \|\| page === "themeStudio" \|\| page === "bubble"\) return setPage\("look"\);/);
  assert.match(CFG, /if \(page === "cot" \|\| page === "qa"\) return setPage\("write"\);/);
  // 每一层都得有标题，不然顶栏是空的
  // v62.48：那二十个纯英文副标题从 v61.29 起就一个都没显示过（Head 有 zh 时不发纯拉丁 en），
  // 整块删掉了，meta 从 [中文, 英文] 变成一个中文字符串。
  for (const k of ["look", "write"]) assert.ok(new RegExp(k + ': "[^"]+"').test(CFG), k + " 没有标题");
  assert.doesNotMatch(CFG, /home: \["设置", "Config"\]/, "旧那份带英文的 meta 还留着");
});

test("每一行都点得开（key 有对应的那一页）", () => {
  const dead = ROWS.filter(r => !new RegExp('page === "' + r.key + '"').test(CFG));
  assert.deepEqual(dead.map(r => r.key), [], "这几行点进去是空的：" + dead.map(r => r.key).join(" / "));
});

test("配件那一行只有解锁了才出现", () => {
  assert.match(CFG, /if \(toyUnlocked && typeof ToyConfig === "function"\)\s*\n\s*homeRows\.push/);
  assert.match(CFG, /page === "toy" && toyUnlocked && typeof ToyConfig === "function"/, "没解锁却还能跳进那一页");
});

test("首页说清楚这一页管的是【整个 app】", () => {
  // 「角色的设置」和「app 的设置」是两页，她两边都找过——底下那句话就是指路的
  assert.match(CFG, /这一页管的是【整个 app】/);
  assert.match(CFG, /在他自己的聊天里点右上角/);
});
