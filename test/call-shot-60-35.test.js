const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const shot = app.slice(app.indexOf("const runCallShot"), app.indexOf("const markCallBye"));
const endCall = app.slice(app.indexOf("const endCall"), app.indexOf("const endCall") + 2500);

// 她 2026-09-02：「视频通话选择可以为本次通话生成背景图吧就锁脸，谁在电话里都锁」
// ＋「结束了要留在聊天不能没了」。
// 视频通话原来只有一片深色底和一个头像圆——「看得见对方」这件事只写在提示词里，
// 屏幕上一点都看不出来。

test("只有视频通话、配了出图、而且有人有参考照，才给这个口子", () => {
  const can = app.slice(app.indexOf("const callShotCan"), app.indexOf("const runCallShot"));
  assert.match(can, /c\.mode !== "video"\) return false/, "语音通话没有画面这回事");
  assert.match(can, /imgApiReady\(\)/);
  assert.match(can, /participants \|\| \[\]\)\.some\(p => p && p\.refPhoto\)/, "一张参考照都没有就锁不住脸");
  assert.match(app, /onShot: callShotCan\(\) \? runCallShot : null/, "没接到通话页上");
});

test("谁在电话里都锁——不是只锁主叫那一个", () => {
  assert.match(shot, /const withRef = \(cur\.participants \|\| \[\]\)\.filter\(p => p && p\.refPhoto\)/);
  assert.match(shot, /withRef\.length > 1[\s\S]{0,220}withRef\.slice\(0, 4\)\.map/, "两个人以上要走合影那一路");
  assert.match(shot, /refPhoto: c2\.refPhoto/, "每人拿自己那张锁脸");
  // 参考图顺序＝点名顺序，错位脸就串
  assert.match(shot, /const refs = \(cast \? cast\.map\(x => x\.refPhoto\) : \[lead\.refPhoto\]\)\.filter\(Boolean\)/);
  assert.match(shot, /kind: cast \? "group" : "self"/);
});

test("画面从各人此刻的状态卡长出来，不是凭空编一个场景", () => {
  assert.match(shot, /freshLiveStateValue\(s2, "place"\), freshLiveStateValue\(s2, "action"\), freshLiveStateValue\(s2, "wearing"\)/);
  assert.match(shot, /这是一通视频通话里对面那一头的画面/);
});

test("换一张不许删旧的——挂断后每一张都要留在聊天里", () => {
  assert.match(shot, /shots: \[\.\.\.\(c\.shots \|\| \[\]\), key\]\.slice\(-4\)/, "删了就真没了；封顶 4 张");
  assert.ok(!/idbImgDel/.test(shot), "这一路不许删图");
  assert.match(endCall, /const shots = \(cur\.shots \|\| \[\]\)\.filter\(Boolean\);/);
  assert.match(endCall, /shots: shots\.length \? shots : undefined/, "没拍过就别在气泡上留个空字段");
});

test("聊天里那条通话记录把画面端出来，点开看整张", () => {
  const card = comp.slice(comp.indexOf("const label = m.dur"), comp.indexOf("function CallShotThumb("));
  assert.match(card, /\(m\.shots \|\| \[\]\)\.length \? h\("div"/);
  assert.match(card, /h\(CallShotThumb, \{ key: k, imgKey: k \}\)/);
  const th = comp.slice(comp.indexOf("function CallShotThumb("), comp.indexOf("// 通话记录中心"));
  assert.match(th, /useIdbImgUrl\(imgKey\)/);
  assert.match(th, /onClick: \(\) => setZoom\(true\)/, "点开看整张");
  assert.match(th, /ReactDOM\.createPortal/, "放大层要挂到 body，别被卡片的 transform 锚住");
});

test("通话页把画面铺成底，字还读得清", () => {
  const cs = comp.slice(comp.indexOf("function CallScreen("), comp.indexOf("// 懒 TTS 小播放器"));
  assert.match(cs, /const bgUrl = useIdbImgUrl\(bg\);/);
  assert.match(cs, /objectFit: "cover"/);
  assert.match(cs, /rgba\(10,10,12,\.\d+\)[\s\S]{0,120}rgba\(10,10,12,\.\d+\)/, "没有暗罩，白字压在照片上读不出来");
  assert.match(cs, /pointerEvents: "none"/, "底图不能吃掉点击");
  // 人已经在画面里了，再摆一个圆头像是两份同样的东西
  assert.match(cs, /bgUrl \? \[\] : \(isGroup \? people\.slice\(0, 4\) : \[primary\]\)\.map/);
});

test("取图那段只写一份，三处共用", () => {
  const hook = comp.slice(comp.indexOf("function useIdbImgUrl(imgKey) {"), comp.indexOf("// 角色自拍气泡"));
  assert.ok(hook.length > 200, "找不到 useIdbImgUrl");
  assert.match(hook, /if \(obj\) URL\.revokeObjectURL\(obj\)/, "objectURL 不撤就一直攒着（SelfieBubble 里也有一份，得切片才咬得住这一份）");
});
