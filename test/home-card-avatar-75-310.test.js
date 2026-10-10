// 名片头像跟面具走（群友 2026-10-10：「我反复上传照片保存，退出来为什么依旧是鸡」）。
//   桩照写入方：名片 x_homeCard 由 HOME_CARD_PRESET() 起头（avatar: QIU_AVATAR），名片编辑页亲手换才改 avatar；
//   面具头像落在 profile.avatarImage。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");

function load() {
  const i = comp.indexOf("const QIU_AVATAR = "), j = comp.indexOf("function HOME_CARD_PRESET(", i);
  assert.ok(i > 0 && j > i, "抠不出名片头像那一段");
  return new Function(comp.slice(i, j) + "\nreturn { homeCardAvatar, QIU_AVATAR };")();
}

test("名片还是出厂小鸡、面具换了照片：名片显示面具那张", () => {
  const { homeCardAvatar, QIU_AVATAR } = load();
  assert.equal(homeCardAvatar({ avatar: QIU_AVATAR }, { avatarImage: "iv_me" }), "iv_me");
  // 公共版出炉换了图片格式，旧存档里的地址还是原来那个
  assert.equal(homeCardAvatar({ avatar: "img/qiu-avatar.webp" }, { avatarImage: "iv_me" }), "iv_me");
});

test("名片编辑里亲手换过：用名片自己那张；面具没头像：还是小鸡", () => {
  const { homeCardAvatar, QIU_AVATAR } = load();
  assert.equal(homeCardAvatar({ avatar: "iv_card" }, { avatarImage: "iv_me" }), "iv_card");
  assert.equal(homeCardAvatar({ avatar: QIU_AVATAR }, {}), QIU_AVATAR);
  assert.equal(homeCardAvatar({}, { avatarImage: "iv_me" }), "iv_me");
});

test("名片上画的就是它", () => {
  assert.match(comp, /avatarImage: homeCardAvatar\(c, profile\), color: accent \}/);
  assert.match(comp, /function HOME_CARD_PRESET\(\) \{[\s\S]{0,200}avatar: QIU_AVATAR/, "出厂名片不再带小鸡了，这条要跟着改");
});
