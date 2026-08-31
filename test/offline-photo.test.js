const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), components = R("components.js");

// 她 2026-08-29：「我想要线下生图功能，这样在一块的时候可以生成合照」。
// 线上单聊早就能发照片，线下（人真的在一块）反而一张都拍不了。

test("线下拍照这一层，单人线下和群线下都接上了（四处一样喂）", () => {
  // 提示词：一份 offlinePhotoHint，两处线下各自调用
  assert.match(engine, /function offlinePhotoHint\(userName, charName, canDuo, isGroup\)/);
  assert.match(engine, /session\.photoOn\) \? offlinePhotoHint\(userName, char\.name, !!session\.photoDuo, false\)/, "单人线下没接");
  assert.match(engine, /offlinePhotoHint\(userName, "", \(session\.photoDuoMembers \|\| \[\]\)\.length > 0, true\)/, "群线下没接");
  // 能力从 app 侧算好传进来，两处都传
  assert.match(app, /photoOn: _offPhotoOn, photoDuo: _offPhotoOn && offlinePhotoCanDuo\(char\)/, "单人线下没传能力");
  assert.match(app, /photoMembers: _gShooters\.map\(c => c\.name\), photoDuoMembers: _gDuo\.map\(c => c\.name\), photoGroupOk: _gGroupOk/, "群线下没传能力");
  // 两处都会把模型填的那一格真的拍出来
  assert.match(app, /if \(res\.photo && res\.photo\.scene\) runOfflineShot\(/, "单人线下拿到 photo 没出图");
  assert.match(app, /if \(b\.photo && b\.photo\.scene && b\.senderId\)/, "群线下拿到 photo 没出图");
});

test("photo 字段真的会从模型那边回来（声明了没人接＝白写）", () => {
  // 单人线下的返回值
  assert.match(engine, /photo: \(session\.photoOn && parsed\.photo && typeof parsed\.photo === "object"/, "单人线下没把 photo 取出来");
  // 群线下每个 beat 的返回值
  assert.match(engine, /photo: \(spk && b\.photo && typeof b\.photo === "object"/, "群线下 beat 没把 photo 取出来");
  // 输出形状里也要说一句，否则模型压根不知道有这个字段
  assert.match(engine, /【photo 格式】这一拍真拍了才填/, "单人线下输出形状里没写 photo");
  assert.match(engine, /"photo\\":\\"（仅角色 beat，可选）这一拍真拍了照片才填/, "群线下输出形状里没写 photo");
});

test("合照要两张脸都有真参考照，否则降级——绝不一张真一张编", () => {
  assert.match(app, /const offlinePhotoCanDuo = char => !!\(char && char\.refPhoto && profile && profile\.refPhoto\)/);
  assert.match(app, /if \(kind === "duo" && !offlinePhotoCanDuo\(char\)\) kind = "other"/, "duo 没有降级这一道");
  assert.match(app, /if \(kind === "group" && \(!cast \|\| cast\.length < 2\)\) \{ kind = "other"; cast = null; \}/, "多人合影凑不齐人也要降级");
  // 提示词那一侧同理：凑不出 duo 就不该把这个选项摆出来
  assert.match(engine, /if \(canDuo\) kinds\.push/);
});

test("拍过的那一格要回到上下文里，别下一拍又说自己没拍过", () => {
  assert.match(engine, /已经实际拍下一张/, "单人线下历史里没说拍过");
  assert.match(engine, /【已经实际拍下一张/, "群线下历史里没说拍过");
  // 两边都得认得 kind，别把合照说成自拍
  assert.match(engine, /m\.photoKind === "duo" \? "你和" \+ userName \+ "的合照"/);
  assert.match(engine, /m\.photoKind === "group" \? "在场几个人的合影"/);
});

test("出图这件事只有一份实现，单人和群共用", () => {
  // 判据是【线下只有一份】，不是全文件共几份（头像、线上单聊、线上群聊各有各的）。
  const bodyOf = (src, head) => {
    const i = src.indexOf(head);
    assert.ok(i > 0, "找不到 " + head);
    let d = 0, b = src.indexOf("{", i + head.length - 2);
    for (let k = b; k < src.length; k++) {
      if (src[k] === "{") d++;
      else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1);
    }
    throw new Error("配不上括号：" + head);
  };
  const shot = bodyOf(app, "const runOfflineShot = async (arg) => {");
  assert.equal((shot.match(/generateSelfieImage\(/g) || []).length, 1, "共用的那份里应当只出一次图");
  const gOff = bodyOf(app, "const genGroupOfflineFrom = async (group, workSess) => {");
  assert.equal((gOff.match(/generateSelfieImage\(/g) || []).length, 0, "群线下不许自己再抄一套出图");
  const sOff = bodyOf(app, "const genOfflineFrom = async (charId, workSess) => {");
  assert.equal((sOff.match(/generateSelfieImage\(/g) || []).length, 0, "单人线下也不许自己再抄一套");
  assert.match(app, /const runOfflineShot = async \(arg\) => \{/);
  assert.match(app, /if \(groupId\) pushGOffMsg\(groupId, \{ \.\.\.r,/, "群那一路没往群会话里写");
  assert.match(app, /groupId \? patchGOffMsg\(groupId, sid, q\) : patchOffMsg\(char\.id, sid, q\)/, "改一处该同时落到两处线下");
});

test("冷却那把尺子认得线下的 role（不认就永远解不开）", () => {
  const i = app.indexOf("const photoCooldownState = (messages, senderId) => {");
  const seg = app.slice(i, i + 1600);
  assert.match(seg, /m\.role === "assistant" \|\| m\.role === "char"/, "线下角色消息的 role 是 char，只认 assistant 就数不满三轮");
});

test("手动拍一张不花模型调用——画面从状态卡长出来", () => {
  const i = app.indexOf("const offlineShotNow = async (charId, kind) => {");
  assert.ok(i > 0, "找不到手动拍那条");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.doesNotMatch(seg, /await (generateOffline|callAI|gen[A-Z])/, "手动拍不许顺手再调一次模型");
  assert.match(seg, /freshLiveStateValue\(st, "action"\)/);
  assert.match(seg, /runOfflineShot\(\{ char, kind, scene \}\)/);
});

test("界面：线下那张卡认得照片，抽屉里能当场拍", () => {
  assert.match(components, /if \(m\.kind === "selfie"\) return h\("div", \{ className: "my-2\.5" \}/, "OffCard 不认 selfie 就什么都不显示");
  // 单人线下三种拍法 + 群线下的合影
  assert.match(components, /\["duo", "我俩合照", canShoot && canShootDuo\]/);
  assert.match(components, /onShoot\("group"\)/);
  // 失败提示别写死「自拍」——合照失败说「自拍没拍成」是错的
  assert.match(components, /m\.photoKind === "group" \? "合影" : m\.photoKind === "duo" \? "合照"/);
});

// duoPhotosFor 真跑一遍：线上 + 线下都要捞到，且没进过线下的角色不能因此少一半
test("合照墙把线下那些也捞上来，并且不靠「今天进过线下」", () => {
  // ⚠️别冻它挂在哪：v58.94 把它从 props 里那一行提成具名的 duoPhotosOf（里程碑册也要用）。
  // 要证的是【行为】：线上线下都捞得到、没加载过要回盘上捞、转圈和失败的不上墙。
  const i = app.indexOf("  const duoPhotosOf = cid => {");
  assert.ok(i > 0, "找不到 duoPhotosOf");
  assert.match(app, /duoPhotosFor: duoPhotosOf,/, "合照墙没接上这一处");
  const body = app.slice(i + "  const duoPhotosOf = ".length, app.indexOf("\n  };", i) + 4);
  const mk = (id, ts, extra) => Object.assign({ id, kind: "selfie", photoKind: "duo", imgKey: "k" + id, ts }, extra || {});
  const chats = { c1: [mk("on", 100)] };
  const disk = { "x_offline:c1": [{ msgs: [mk("off", 200)] }] };
  // v58.97 起合照墙还认照相馆拍的那些，所以桩里要给 studioRef（这儿给空的，只验线上/线下两路）
  const run = offlines => new Function("chats", "offlines", "loadJSON", "studioRef",
    "return (" + body.replace(/;\s*$/, "") + ");")(chats, offlines, k => disk[k] || [], { current: [] });
  // ① 内存里已经加载过线下
  const a = run({ c1: disk["x_offline:c1"] })("c1");
  assert.deepEqual(a.map(x => x.imgKey), ["koff", "kon"], "线上线下都要有，且新的在前");
  // ② 今天还没进过线下——不能因此只剩线上那一半
  const b = run({})("c1");
  assert.deepEqual(b.map(x => x.imgKey), ["koff", "kon"], "没加载过就该回 localStorage 里捞");
  // ③ 还在生成中/失败的不上墙
  const disk2 = { "x_offline:c1": [{ msgs: [mk("p", 300, { pending: true }), mk("f", 400, { failed: true })] }] };
  const c = new Function("chats", "offlines", "loadJSON", "studioRef", "return (" + body.replace(/;\s*$/, "") + ");")(
    { c1: [] }, {}, k => disk2[k] || [], { current: [] })("c1");
  assert.deepEqual(c, [], "转圈的和失败的不该上墙");
});

// 线下那份是 durable 键：占位一次、结果一次，两次挨太近会撞上 WAL 的读回自检
// （后一次盖掉前一次正在核对的那版，控制台报 read-back mismatch）。
// 秒失败的情况（key 配错、断网）本来也不需要先转一圈圈，所以占位延后 300ms 再挂。
test("出图秒失败时不留下两次紧挨着的写入", () => {
  const i = app.indexOf("const runOfflineShot = async (arg) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.match(seg, /const holdTimer = setTimeout\(place, 300\)/, "占位没有延后");
  assert.match(seg, /clearTimeout\(holdTimer\);\s*\n\s*if \(!placed\) \{ placed = true; push\(q\); return; \}/,
    "结果先到时应当只写一次：直接把终态挂上去，而不是先挂占位再改");
});
