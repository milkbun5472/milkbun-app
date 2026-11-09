// 群里生成我的自拍（群友 2026-11-04 许愿）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("群里照片多一档「生成我的自拍」，自拍／别人拍的两格跟单聊共用一份", () => {
  assert.match(cmp, /\["describe", "只发文字描述"\], \.\.\.\(onShootMe \? \[\["selfme", "生成我的自拍"\]\] : \[\]\)\]/);
  assert.equal((cmp.match(/h\(SelfMeAngle, \{/g) || []).length, 2);
  assert.equal((cmp.match(/"data-wk": "selfmeangle"/g) || []).length, 1, "那两格只写一份");
  assert.match(cmp, /onShootMe && onShootMe\(v, gSelfThird\)/);
});
test("app 里照这个群的面具画、走 drawGroupSelfie、画好挂进图片仓库", () => {
  assert.match(app, /onShootMe: \(scene, third\) => shootMeGroup\(activeGroup\.id, scene, third\)/);
  assert.match(app, /canShootMe\("g:" \+ groupId\)/);
  assert.match(app, /const mySelf = gPhotoKind === "myself" \|\| gPhotoKind === "myshot";/);
  assert.match(app, /if \(mySelf\) \{ try \{ const ref = await imgToVault\(await blobToDataUrl\(out\.blob\)\); if \(String\(ref \|\| ""\)\.indexOf\("iv_"\) === 0\) pGChat\(/);
  assert.match(app, /\(m\.kind === "photo" \|\| \(m\.kind === "selfie" && m\.role === "user"\)\) && m\.imageRef/);
});
test("群里她的那张靠右、挂她的头像", () => {
  assert.match(cmp, /"data-me": m\.role === "user" \? "1" : "0", "data-kind": m\.kind \|\| "", className: "py-1 flex items-start gap-2 " \+ \(m\.role === "user" \? "justify-end" : "justify-start"\)/);
});
