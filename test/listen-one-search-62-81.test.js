// v62.81 她 2026-09-05：「发现那里显示我的账号和搜索，但是明明设置这边也可以搜索了而且还是有两次，
// 然后设置那边搜索框还有个意义不明的上传件但是添加歌曲那边也有上传本地」。
// 数下来搜索在三处：发现页、设置页顶上那条、添加歌曲里的「搜歌名」。传本地在两处：搜索条旁边那颗上传钮、添加歌曲·本地。
// 规矩：一样东西一个家——搜歌只住「发现」，传本地只住「添加歌曲 · 本地」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const LT = src.slice(src.indexOf("function ListenTogether("), src.indexOf("function CoupleQAConfig("));
const HOME = LT.slice(LT.indexOf("  const homeTab = h("), LT.indexOf("  // ============ 我的 tab"));
const CLOUD = LT.slice(LT.indexOf("  const cloudTab = h("), LT.indexOf("  // ── 底：唱片自己的那圈纹"));

test("设置页里没有搜索：条没了、结果没了、添加歌曲里的「搜歌名」也没了", () => {
  assert.doesNotMatch(HOME, /全网 搜索歌曲/, "设置页顶上那条搜索框还在");
  assert.doesNotMatch(HOME, /tabBtn\("search"/, "添加歌曲里还有「搜歌名」");
  assert.doesNotMatch(HOME, /addTab === "search"/);
  assert.doesNotMatch(LT, /const doSearch = /, "设置页那套搜索函数还留着——留着就有人再把它接回去");
  assert.doesNotMatch(LT, /const \[results, setResults\]/);
});

test("传本地只住「添加歌曲 · 本地」一处：搜索条旁边那颗上传钮没了", () => {
  assert.doesNotMatch(HOME, /ic\("upload"/, "那颗上传钮还在");
  assert.match(HOME, /tabBtn\("local", "本地"\)/, "本地那一栏不能一起撤掉");
  assert.match(HOME, /选一个音频文件/, "本地上传的入口没了");
});

test("搜歌住在「发现」，而且不要账号：有接口就开", () => {
  assert.match(CLOUD, /placeholder: "搜网易云全库：歌名 \/ 歌手"/, "发现页的搜索框没了");
  assert.match(LT, /useState\(now \? "play" : \(apiBase \? "cloud" : "home"\)\)/, "落地页还按账号切");
  // 没账号：只有搜索，账号那几段换一句指路
  assert.match(CLOUD, /: !cookie \? h\("div", \{ style: \{ fontFamily: F_BODY, fontSize: 12, color: t\.fog/, "没账号时发现页没告诉她去哪儿连账号");
  assert.match(CLOUD, /先能搜。到「设置」里扫码连上网易云账号/);
});

test("指路的字只指真名：去「发现」搜歌", () => {
  const stale = LT.match(/"[^"]*去「(首页|曲库)」[^"]*"/g) || [];
  assert.deepEqual(stale, []);
  assert.match(LT, /去「发现」搜/, "空状态没告诉她去发现搜");
});
