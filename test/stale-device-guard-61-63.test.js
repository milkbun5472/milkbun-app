// v61.63 2026-09-04 事故：她 iPhone 上的 app 删了重装（是我叫她删的），数据没了；
// 随后她打开一台几个月没用过的网页版——那份存档【有角色】，于是 localMeaningful()
// 原样放行，开机自动 push 把手机刚备份的那份盖掉，少了三个角色。
//
// 病根：闸只有一半。localMeaningful() 防的是【空的盖掉云端】（2026-07-12 那次），
// 但它一个字都没说【旧的盖掉新的】。同一道闸当初只想到了一半。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const cloud = fs.readFileSync("js/cloud.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const nocomment = s => s.split("\n").map(l => l.split("//")[0]).join("\n");

test("autoPush 除了空壳闸，还要过【过期设备闸】", () => {
  const i = cloud.indexOf("async autoPush()");
  const fn = nocomment(cloud.slice(i, cloud.indexOf("\n    },", i)));
  assert.match(fn, /localMeaningful\(\)/, "空壳闸没了");
  assert.match(fn, /staleness\(user\.id\)/, "过期设备闸没接上");
  // 判定为过期时必须【直接 return】，不许推上去
  assert.match(fn, /if \(staleVerdict\.stale\) \{[\s\S]*?return;/);
});

test("过期的判据是【跨度】，不是【云端比本机新就拦】", () => {
  // 两台设备换着用时云端比本机新是常态，只要更新就拦＝天天弹窗。
  // 真正的事故形状是隔了很久的旧设备，所以按跨度判。
  assert.match(cloud, /const STALE_GAP_MS = 24 \* 3600 \* 1000;/);
  const i = cloud.indexOf("async staleness(");
  const fn = nocomment(cloud.slice(i, cloud.indexOf("\n    },", i)));
  assert.match(fn, /cloudAt - localAt > STALE_GAP_MS/);
  // 云端还没有存档时随便推，否则第一台设备永远推不上去
  assert.match(fn, /if \(!cloudAt\) return \{ stale: false/);
  // 从没同步过、却已经有本地存档 —— 正是事故那台的样子，也算过期
  assert.match(fn, /!localAt \|\|/);
});

test("拉回云端之后闸门要解除，否则恢复完第一次备份会被自己拦住", () => {
  assert.match(cloud, /markSynced\(updatedAt\) \{/);
  const i = cloud.indexOf("markSynced(updatedAt)");
  const fn = cloud.slice(i, cloud.indexOf("\n    },", i));
  assert.match(fn, /localStorage\.setItem\(MARK/);
  assert.match(fn, /staleVerdict = null/);
  // 手动「从云端恢复」不走 autoPull，必须自己盖一次 MARK
  assert.match(screens, /window\.Cloud\.markSynced\(row\.updated_at\)/);
});

test("手动备份也要拦一道：告诉她两边各是什么时候", () => {
  const i = screens.indexOf("const doPush = async ()");
  const fn = screens.slice(i, screens.indexOf("\n  };", i));
  assert.match(fn, /staleness\(u\.id\)/);
  assert.match(fn, /window\.confirm\(/);
  // 光说「云端比较新」没用，得把两个时刻摆出来让她自己判断
  assert.match(fn, /云端最后一次备份/);
  assert.match(fn, /这台设备最后一次同步/);
});

test("找回失联的角色：认领的是【云端还在、本机没有】的那些 id", () => {
  assert.match(screens, /function LostCharacterRescue\(/);
  const i = screens.indexOf("function LostCharacterRescue(");
  const fn = nocomment(screens.slice(i, screens.indexOf("\nfunction StorageMeter", i)));
  // 记忆行表和归档聊天都不在被覆盖的那份 blob 里，这两样才是找回的依据
  assert.match(fn, /memoryRowsFetchAll\(\)/);
  assert.match(fn, /chatArchiveGet\(e\.id\)/);
  // ⚠️v61.75：判据不是「这个人在不在本机」，是「TA 的记忆到齐了没有」。
  //   按前者写的话，上一版刚建回来的三个人这一页再也扫不到，而记忆压根没接上——
  //   等于建完就永远没救了（她 2026-09-04 报的第二个「不行」）。
  assert.match(fn, /filter\(e => !e\.here \|\| e\.missing > 0\)/);
  assert.match(fn, /if \(!haveMem\.has\(String\(m\.id\)\)\) \{/, "得逐条比本机缺不缺，不能只看人在不在");
  // 本机那份必须走 loadJSON —— x_memLib 住在 IDB 文字仓，localStorage 里那份是空的
  assert.match(fn, /loadJSON\("x_memLib", \[\]\)/);
  // 删掉的记忆不该把一个人从坟里拉出来
  assert.match(fn, /if \(m && m\.deleted\) return;/);
  // 重建必须沿用原 id，否则记忆和聊天接不回来
  assert.match(fn, /onRescue\(\{ id: e\.id,/);
});

test("重建走的是【原 id 原样落档】，而且已有的不许被顶掉", () => {
  const i = app.indexOf("onRescueChar: async c =>");
  const fn = app.slice(i, app.indexOf("\n    },", i));
  assert.match(fn, /p\.some\(x => x\.id === c\.id\) \? p : \[\.\.\.p, c\]/,
    "同 id 已经在了就别动它——不然会把现役角色洗成空人设");
});

test("这一页在数据管理里有入口", () => {
  assert.match(screens, /id: "rescue", title: "找回失联的角色"/);
  assert.match(screens, /if \(part === "rescue"\) content = h\(LostCharacterRescue/);
});

// v61.74 她报：「明明看到有记忆找回了但是建了就没了」。
// 病因跟这一整轮是同一个形状：**看得见的那一份和用得上的那一份，不是同一份。**
//   · 扫描页列的记忆是【直接问云端】要的（memoryRowsFetchAll）
//   · 聊天真正读的是【本机】那份 x_memLib——除非 memoryTableAuthorityOn() 开着
//     （默认是关的），云端多出来的行【永远不会】自己铺回本地
// 归档聊天是同一处的第二例：正文在云端 chat_archive 里，但「加载更早」这个按钮
// 出不出得来，看的是本机那本 x_chatArch 计数簿——它跟角色档案一起躺在被覆盖的
// saves 里，所以是 0。两处都得在建回来的时候【真的捞一次】。
test("建回来＝角色落档 + 记忆行捞回本地 + 归档计数补上", () => {
  const i = app.indexOf("onRescueChar: async c =>");
  assert.ok(i > 0, "onRescueChar 得是 async 的——它要等云端");
  const fn = nocomment(app.slice(i, app.indexOf("\n    },", i)));
  assert.match(fn, /memoryRowsFetchAll\(\)/, "没把记忆捞回来，建完就是个空人");
  assert.match(fn, /char_ids \|\| \[\]\)\.map\(String\)\.includes\(String\(c\.id\)\)/);
  assert.match(fn, /saveJSON\("x_memLib", next\)/);
  // 已经有的不重复塞
  assert.match(fn, /filter\(x => !have\.has\(x\.id\)\)/);
  // ⚠️不许走 saveMemLib：那会 enqueueDiff 把云端本来就有的行当新写的再推一遍
  assert.doesNotMatch(fn, /saveMemLib\(/,
    "走 saveMemLib 会把这些行当成新写的推回云端，撞 revision");
  // 归档聊天的计数簿
  assert.match(fn, /chatArchiveGet\(c\.id\)/);
  assert.match(fn, /saveJSON\("x_chatArch", marks\)/);
});

test("建完不许静默消失：得当场说接回了多少", () => {
  const i = screens.indexOf("function LostCharacterRescue(");
  const fn = screens.slice(i, screens.indexOf("\nfunction StorageMeter", i));
  // 原来是 setRows 把这一行滤掉——看上去就是「建了就没了」
  assert.doesNotMatch(fn, /setRows\(r => \(r \|\| \[\]\)\.filter/);
  assert.match(fn, /条记忆/);
  assert.match(fn, /把 " \+ e\.missing \+ " 条记忆接回来/, "人已经在的那一类，按钮要说清它这次干什么");
  assert.match(fn, /done\.error/, "捞失败要说出来，不能假装成功");
});
