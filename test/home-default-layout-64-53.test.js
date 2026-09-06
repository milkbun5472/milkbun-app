// 默认主屏按她自己那三页重排（她 2026-09-06 把整份 x_homeLayout 发过来：
// 「按我这样的布局把 app 默认布局重新排一遍」）。
//
// 这条测试钉的不是「摆成了哪个样子」——那个她随时会改。钉的是**重排的时候
// 最容易碰坏的那两样**，而且原来只有零星几个 app 各自钉了一条（月度印象、
// 文风台、跑团），别的二十来个谁掉了都没人吭声。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const foldersSrc = comp.slice(comp.indexOf("const DEFAULT_FOLDERS = {"), comp.indexOf("\n};", comp.indexOf("const DEFAULT_FOLDERS = {")) + 3);
const layoutSrc = comp.slice(comp.indexOf("  const DEFAULT_LAYOUT = ["), comp.indexOf("  const SP_RE = /^sp_/;"));
const FOLDERS = new Function(foldersSrc + "\nreturn DEFAULT_FOLDERS;")();
const LAYOUT = new Function(layoutSrc + "\nreturn DEFAULT_LAYOUT;")();
const REG = (() => {
  const i = comp.indexOf("  const REG = {"), j = comp.indexOf("\n  };", i);
  return new Function(comp.slice(i, j).replace(/G:[^,}]+/g, "G: null") + "\n  };\nreturn REG;")();
})();
const flat = [].concat.apply([], LAYOUT);
const placedFolders = flat.filter(k => String(k).slice(0, 2) === "f_");

test("REG 里每个 app / 组件，在默认桌面上都摸得着", () => {
  // 摸得着＝自己躺在某一页上，或者在一个【本身也摆在页面上】的默认文件夹里。
  // 光在 DEFAULT_FOLDERS 里有一条不算：文件夹没摆上去，里面的东西一样点不到。
  const reach = new Set(flat);
  placedFolders.forEach(fid => (FOLDERS[fid] ? FOLDERS[fid].keys : []).forEach(k => reach.add(k)));
  const missing = Object.keys(REG).filter(k => (REG[k].kind === "app" || REG[k].kind === "widget") && !reach.has(k));
  assert.deepEqual(missing, [],
    "这几个从默认桌面上掉了：" + missing.join(" ") +
    "（安全网会把它们硬塞回某一页，于是新装的人第一眼看到的就不是她排的那个样子）");
});

test("默认文件夹里不许有【这个版本根本没有】的 key", () => {
  // 她那份布局里带着 lifestyle 和 capsule，这个版本的 REG 里压根没有它们。
  // 照抄进来的话，那一格占着位置却渲染成 null——「看着是空的、放不进东西、
  // 也没有虚线落点」（她 2026-09-03 抓到过的那处死格）。
  const dead = [];
  Object.keys(FOLDERS).forEach(fid => (FOLDERS[fid].keys || []).forEach(k => { if (!REG[k]) dead.push(fid + "/" + k); }));
  assert.deepEqual(dead, [], "默认文件夹里有死 key：" + dead.join(" "));
  const deadLoose = flat.filter(k => String(k).slice(0, 2) !== "f_" && !REG[k]);
  assert.deepEqual(deadLoose, [], "默认页面上有死 key：" + deadLoose.join(" "));
});

test("每个默认文件夹都真的摆在某一页上，也没有摆了却不存在的", () => {
  const unplaced = Object.keys(FOLDERS).filter(fid => flat.indexOf(fid) < 0);
  assert.deepEqual(unplaced, [], "这几个默认文件夹建了却没摆上桌面：" + unplaced.join(" "));
  const ghosts = placedFolders.filter(fid => !FOLDERS[fid]);
  assert.deepEqual(ghosts, [], "页面上摆着不存在的文件夹：" + ghosts.join(" "));
  // 同一个 app 不许同时躺在两个文件夹里（第一个之外的会被当成「已放置」吞掉）
  const seen = {}, dup = [];
  Object.keys(FOLDERS).forEach(fid => (FOLDERS[fid].keys || []).forEach(k => { if (seen[k]) dup.push(k); seen[k] = fid; }));
  assert.deepEqual(dup, [], "这几个 app 进了两个默认文件夹：" + dup.join(" "));
});

test("她那三页的形状还在：组件当主角、app 收进文件夹", () => {
  assert.equal(LAYOUT.length, 3, "她自己就是三页（后面几页只有她的装饰，不进默认）");
  // 第一页最少：她那页只有名片、日历和三个「翻他」的文件夹，一个散着的 app 都没有
  const looseApps = p => p.filter(k => REG[k] && REG[k].kind === "app");
  assert.deepEqual(looseApps(LAYOUT[0]), [], "第一页散出了 app——她那一页是空着给组件的");
  assert.ok(LAYOUT[0].filter(k => String(k).slice(0, 2) === "f_").length >= 3, "第一页的文件夹少了");
  // 装饰是她自己的数据，不许进默认
  const decor = flat.filter(k => String(k).slice(0, 2) === "d_");
  assert.deepEqual(decor, [], "把她自己的装饰抄进默认布局了：" + decor.join(" "));
});
