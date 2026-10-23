const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"), vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("翻她手机：paycart 一趟一次，留得住要付的那几件", () => {
  const w = {}; vm.runInNewContext(fs.readFileSync(__dirname + "/../js/peek-phone.js", "utf8"), { window: w, setTimeout, Promise, console });
  const r = w.PeekPhone.cleanScript({ steps: [{ do: "open", app: "messages" }, { do: "paycart", items: ["「奶茶」", "耳机"] }, { do: "paycart", items: [] }] }, ["messages", "chat", "shop"], { who: [] });
  const pc = r.filter(x => x.do === "paycart");
  assert.equal(pc.length, 1); assert.deepEqual(pc[0].items, ["奶茶", "耳机"]);
});
test("paycart 落地：从TA钱包扣、从她购物车拿掉、变成TA替她付的订单；提示里摆出她购物车", () => {
  assert.match(app, /if \(step\.do === "paycart"\) \{/);
  assert.match(app, /removeCartUids\(pick\.map\(x => x\.uid\)\)/);
  // 2026-10-23 起翻手机和朋友圈共用 payHerCart，替你付的那张单照付钱的人写
  assert.match(app, /addOrder\(\{ name: x\.name, price: x\.price, cat: x\.cat, fromCharId: charId, payLabel: payLabel \}\)/);
  assert.match(app, /payHerCart\(viewerId, step\.items, "翻 " \+ userName\(profile\) \+ " 手机时替她付了购物车", vn \+ " 替你付的"\)/);
  assert.match(app, /她购物车里还躺着没付的/);
});
test("她朋友圈底下说点了就真点：反应和评论区回复都接 postCharTakeout，不另塞上下文", () => {
  assert.match(app, /const MOMENT_TAKEOUT_ASK = /);
  assert.match(app, /momentTakeouts\(d\.reactions, "name"\); momentTakeouts\(d\.replies, "name"\);/);
  assert.match(app, /if \(isMine\) \{ momentTakeouts\(reps, "author"\); momentCarts\(reps, "author"\); \}/);
  assert.match(app, /postCharTakeout\(c\.id, r\.takeout, \{ fromMoment: true \}\)/);
});
