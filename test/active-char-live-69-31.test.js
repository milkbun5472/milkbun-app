// 她 2026-09-16：「我只是更新版本号没有让他重新说就换上了，是不是其实之前保存路径有bug」。
//
// 她判断得对，而且比「换头像有 bug」更准：**保存路径一直是好的，是屏幕在看一张旧快照。**
//   const [activeChar, setActiveChar] = useState(null)
// 存进去的是【点进聊天那一刻的角色对象本身】。后台把头像换了（pC 改的是 characters
// 那份 state），activeChar 手里还攥着旧对象，顶栏头像于是纹丝不动——
// 直到她退出去再进来、或者刷新整个 app，才重新从 characters 里取一份。
// 她刷了个版本号＝重新开机＝重新取，所以「没让他重新说就换上了」。
//
// ⚠️这不只坑换头像：**任何后台改到这个角色的事**（备注、人设、颜色、状态卡、
//   自我成长写回…）在她开着的那个聊天里都看不见。头像只是最显眼的那一个。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("打开着的那个人按 id 现取，不是点进来那一刻的快照", () => {
  assert.match(app, /const \[activeCharSel, setActiveChar\] = useState\(null\);/);
  // ⚠️find 不是 filter：这是按 id 单点取一个，不是遍历全体
  //（npc.test 那道闸拦的是「把全量 characters 拖进循环」，理由钉在那份测试里）
  assert.match(app, /\? \(characters\.find\(c => c && c\.id === activeCharSel\.id\) \|\| activeCharSel\)/);
  // 老写法不许留着
  assert.ok(!/const \[activeChar, setActiveChar\] = useState\(null\);/.test(app), "还存着快照");
});

test("群是同一个形状的第二处，照同一个改法", () => {
  assert.match(app, /const \[activeGroupSel, setActiveGroup\] = useState\(null\);/);
  assert.match(app, /\? \(groups\.find\(g => g && g\.id === activeGroupSel\.id\) \|\| activeGroupSel\)/);
  assert.ok(!/const \[activeGroup, setActiveGroup\] = useState\(null\);/.test(app));
});

test("找不到就退回快照——NPC、刚删掉的人不许因此白屏", () => {
  assert.match(app, /\|\| activeCharSel\)/);
  assert.match(app, /\|\| activeGroupSel\)/);
});

test("选择器还是那个 state：setActiveChar / setActiveGroup 的调用点一处都不用动", () => {
  // 改的是【读】那一侧；写那一侧原样保留，所以全库调用点不用跟着改
  assert.ok(app.indexOf("setActiveChar(") > 0);
  assert.ok(app.indexOf("setActiveGroup(") > 0);
  // 不许有人去 set 那个内部选择器（那就等于又开了第二条路）
  assert.ok(!/setActiveCharSel|setActiveGroupSel/.test(app));
});

test("两处拿【对象本身】当依赖的 effect 都有自锁，重跑是空操作", () => {
  // 现取之后对象身份会随 characters/groups 更新而变，这两处必须自己挡住重复执行，
  // 否则「默认进线下」会在后台改一次角色就再弹一次
  const a = app.slice(app.indexOf("  const autoOfflineRef = useRef(null);"), app.indexOf("}, [screen, activeRoomId, activeChar]);"));
  assert.match(a, /if \(autoOfflineRef\.current === cid\) return;/);
  const b = app.slice(app.indexOf("  const autoGOfflineRef = useRef(null);"), app.indexOf("}, [screen, activeGroup]);"));
  assert.match(b, /if \(autoGOfflineRef\.current === gid\) return;/);
});

test("换头像那条落地路本来就是对的，这次一个字没动", () => {
  // 她说「保存路径有 bug」——查下来保存一直没问题，所以这几行原样留着当对照
  assert.match(app, /pC\(p => p\.map\(x => x\.id === charId \? \{ \.\.\.x, avatarImage: msg\.imageRef \} : x\)\);/);
  assert.match(app, /saveJSON\("x_characters", n\);/);
  assert.match(app, /const prev = ch\.avatarImage \|\| "";/);
});
