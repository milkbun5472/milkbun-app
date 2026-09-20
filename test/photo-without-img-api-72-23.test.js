// 「群聊和单聊能不能发虚拟照片啊？就是没配图 api 走跟我一样的假图带描述」（她 2026-09-20）。
//
// 原来 canSelfie 要求 imgApiReady()——没配图像通道就【连能力都不给】，于是她要照片，
// TA 只能打哈哈，看起来像「他不想拍」。可她自己发的假图早就有一张好看的卡了
// （PhotoCard：没有像素时画一张相纸，把那句描述印在上面），角色这一侧没接上而已。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("没配图像通道也把能力给他", () => {
  assert.match(app, /const canSelfie = !photoCooldown\.cooling;/, "能力还卡在 imgApiReady 上");
  // 有没有图像通道这件事还得留着——它决定的是【出不出像素】，不是【给不给能力】
  assert.match(app, /const canSelfieImg = \(typeof imgApiReady === "function"\) && imgApiReady\(\);/, "分不出有没有图像通道了");
});

test("画不出像素就落成只有描述的那一张，而不是什么都不发", () => {
  assert.match(app, /const _canDraw = photoScene && photoKind && typeof imgApiReady === "function" && imgApiReady\(\)/, "单聊那条判断没了");
  assert.match(app, /if \(photoScene && photoKind && !_canDraw\) \{/, "单聊画不出时还是什么都不发");
  assert.match(app, /kind: "photo", descOnly: true,\s*\n\s*desc: photoScene/, "单聊落的不是那张假图卡");
  // 群里同一条路（four-surfaces：单聊有的群里也得有）
  assert.match(app, /const _gCanDraw = gPhotoScene && gPhotoKind/, "群聊那条判断没了");
  assert.match(app, /kind: "photo", descOnly: true, desc: gPhotoScene/, "群聊没落成同一张卡");
  // ⚠️「没外貌也没参考照就不画人」那条老规矩不许被顺手撤掉
  assert.match(app, /photoKind === "view" \|\| photoKind === "part" \|\| char\.appearance \|\| char\.refPhoto/, "没脸可锁还硬画的老毛病回来了");
});

test("他得记得自己真发过，别下一轮说「我还没拍」", () => {
  assert.match(app, /m\.kind === "photo" && m\.descOnly\) \? "【你在这里已经实际发出一张照片/, "单聊那头没喂回去");
  assert.match(app, /m\.kind === "photo" && m\.descOnly\) \? "\[已经实际发出一张照片/, "群聊那头没喂回去");
});

test("群里那张卡不能再写死靠右", () => {
  // 原来 justify-end + mine:true——群里只有她会发图那会儿是对的，现在角色也发
  const i = comp.indexOf('if (m.kind === "photo") {\n      const pMine = m.role === "user";');
  assert.ok(i > 0, "群里那张照片卡还是老写法");
  const seg = comp.slice(i, i + 1200);
  assert.match(seg, /const pMine = m\.role === "user";/, "没按 role 判是谁发的");
  assert.match(seg, /!pMine && pCh \? h\(Avatar/, "角色发的那张没有头像");
  assert.match(seg, /!pMine && m\.senderName/, "群里看不出这张是谁发的");
  assert.ok(!/mine: true/.test(seg), "还写死 mine: true");
});

test("那张卡本来就画得出「没有像素」的样子——这次只是接上它", () => {
  assert.match(comp, /const face = m\.imageRef/, "PhotoCard 不再按有没有像素分两种画法");
  assert.match(comp, /没有像素的时候，这里放的就是她写的那句话/, "相面那一段没了");
});
