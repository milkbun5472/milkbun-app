// 自动落盘（js/auto-backup.js）。她 2026-11-09 交代的红线：
//   「这种碰数据的做不好，万一下次其他人打开数据没了」。
// 所以这一份的第一条测试不是「它备份得对不对」，是**它根本碰不到她的数据**：
//   只读存档、只写她挑的那个文件夹。做不好最坏是这次没备份上，绝不可能反过来弄坏谁的东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const src = read("auto-backup.js");
const app = read("app.js");
const bare = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const code = bare(src);

test("⭐红线：一个字都不许写回存档", () => {
  for (const [re, why] of [
    [/\btxtWrite\s*\(/, "写了文字金库"],
    [/\bidbTxtPut\s*\(/, "写了文字金库"],
    [/\bidbVaultPut\s*\(|\bidbVaultClear\s*\(/, "动了图库"],
    [/\bidbImgPut\s*\(|\bidbAlbumPut\s*\(/, "动了自拍/照片说明"],
    [/\bsaveJSON\w*\s*\(/, "走了存档写入口"],
    [/localStorage\.(setItem|removeItem|clear)\s*\(/, "写了 localStorage"],
  ]) assert.ok(!re.test(code), "auto-backup.js " + why + "——这个模块只许读存档、写外面那个文件夹");
  // 它确实只往自己那个小库里存「文件夹把手 + 一行时间戳」
  assert.match(code, /const DB = "x_autobackup"/, "把手该住在自己那个小库里");
  assert.ok(!/indexedDB\.open\((?!DB\b)/.test(code.replace(/indexedDB\.open\(DB,/g, "")), "开了别人的库");
});

test("自动那一路不许弹许可框，也不许在仓库没灌起来时写", () => {
  const run = src.slice(src.indexOf("async function run(force)"), src.indexOf("async function state()"));
  assert.ok(run.indexOf("txtVaultReady") > 0, "没问「文字库灌完了没有」就写，写出去的是残档");
  assert.match(run, /permission\(dir, false\)/, "自动这一路传了 ask=true：requestPermission 要手势，弹不出来还会吞掉这一轮");
  const pick = src.slice(src.indexOf("async function pick()"), src.indexOf("async function forget()"));
  assert.match(pick, /permission\(dir, true\)/, "她亲手点的那一下才该去要许可");
});

test("整类归零的那一份不写进去，免得把文件夹里好的挤掉", () => {
  const run = src.slice(src.indexOf("async function run(force)"), src.indexOf("async function state()"));
  assert.match(run, /m\.lastChats > 0 && chats === 0/, "判据不是「上次有、这次零」");
  assert.ok(run.indexOf("m.lastChats > 0") < run.indexOf("getFileHandle"), "闸得在真写文件之前");
});

test("先有新的再退旧的，而且只碰自己写的那些文件", () => {
  const run = src.slice(src.indexOf("async function run(force)"), src.indexOf("async function state()"));
  assert.ok(run.indexOf("w.close()") < run.indexOf("removeEntry"), "顺序反了就是「正要换新的时候断电」");
  assert.match(run, /n\.indexOf\(PREFIX\) === 0/, "没认前缀就删，会动到她放在那个文件夹里的别的东西");
});

test("攒包只有一份：auto-backup 和设置页用的是同一个 BackupPack", () => {
  assert.match(code, /BackupPack\.build\(/, "自动这一路另攒了一份，以后加新数据只会加在其中一条路上");
  assert.match(app, /window\.BackupPack\.build\(opts\)/, "设置页那一路没改成调公共的");
  // 钉「整份存档的收集」这一句本身：app.js 里还有表情包/图片包/只带几个人那几种别的导出，
  //   它们各有各的 __archive，不归这一条管。
  const COLLECT = /k\.startsWith\("x_"\) && k !== "x_neteaseCookie"/;
  assert.ok(!COLLECT.test(app), "app.js 里还留着第二套整份存档的收集逻辑");
  assert.match(read("backup-pack.js"), COLLECT, "公共那一份不见了");
});

test("界面上当面说清楚它不含图", () => {
  const ui = read("screens-ui.js");
  const seg = ui.slice(ui.indexOf("function AutoBackupSection"), ui.indexOf("function StorageMeter"));
  assert.ok(seg.length > 200, "抠不出 AutoBackupSection");
  assert.match(seg, /不含图片和自拍/, "不说清楚就是悄悄少图，比没有这个功能更坏");
  assert.match(seg, /iPhone/, "没有这个 API 的机器上要说明白，不能让人干等");
});
