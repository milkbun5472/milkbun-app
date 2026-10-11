// 旅行里订机票酒店（群友 2026-10-10 许愿「类携程」）：查一次花一次调用；挑、付零调用；付了 TA 记得，出发带进线下
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const scr = fs.readFileSync(require.resolve("../js/screens.js"), "utf8");

test("合计＝两个人的票 + 住几晚的房", () => {
  const i = app.indexOf("  const tripBookTotal = b =>"), j = app.indexOf(";\n", i) + 1;
  const f = new Function(app.slice(i, j).replace("const tripBookTotal =", "return"))();
  assert.equal(f({ pick: { flight: 1, hotel: 0 }, nights: 3, flights: [{ price: 500 }, { price: 800 }], hotels: [{ price: 400 }] }), 800 * 2 + 400 * 3);
  assert.equal(f({ pick: null }), 0);
  assert.equal(f({ pick: { flight: 0, hotel: 0, back: 1 }, nights: 2, flights: [{ price: 500 }], back: [{ price: 300 }, { price: 600 }], hotels: [{ price: 400 }] }), 500 * 2 + 600 * 2 + 400 * 2);
});
test("我付走自己的钱包、TA请客走 TA 的钱包，付完记进情侣空间；出发时订好的进开场", () => {
  const seg = app.slice(app.indexOf("  const tripBookPay = (char, who) => {"), app.indexOf("  const tripDepart = async char => {"));
  assert.match(seg, /walletSpend\(char\.id, total, label, "gift"\)/);
  assert.match(seg, /changeWallet\(-amt, label/);
  assert.match(seg, /coupleKeep\(char\.id,/);
  assert.match(app, /订好的：" \+ \[fl && /);
  assert.match(app, /onTripBook: tripBookSearch, onTripBookPick: tripBookPick, onTripBookPay: tripBookPay,/);
});
test("界面：旅行页里有订票那一块，按钮够大", () => {
  assert.match(scr, /h\(TripBooking, \{ partner, trip: cur, gen, onBook, onBookPick, onBookPay, hasKin \}\)/);
  const tb = scr.slice(scr.indexOf("function TripBooking("), scr.indexOf("function CoupleTrip("));
  assert.ok((tb.match(/minHeight: 44/g) || []).length >= 4);
});

test("丰富：AA、刷亲属卡不进待收货、出发日写进日历、前一晚 TA 提醒、路上小插曲", () => {
  const seg = app.slice(app.indexOf("  const tripBookPay = (char, who) => {"), app.indexOf("  const tripDepart = async char => {"));
  assert.match(seg, /payWithKinship\(char\.id, \[\{ name: label, price: total \}\], total, \{ noOrder: true \}\)/);
  assert.match(app, /if \(!\(opts && opts\.noOrder\)\) items\.forEach\(it => addOrder/);
  assert.match(app, /saveCalTimedEvent\(/);
  assert.match(app, /opts\.tripEve \? tripEveHint :/);
  assert.match(app, /pOnce\("tripeve:"/);
  assert.match(app, /const tripMishap = \(\) => Math\.random\(\) < 0\.4/);
  assert.match(app, /onTripDate: tripSetDate/);
});
test("界面：哪天出发、选座、AA/亲属卡按钮，钩子都登记了", () => {
  const ts = fs.readFileSync(require.resolve("../js/theme-studio.js"), "utf8");
  for (const k of ["tripdate", "tripseat"]) { assert.match(scr, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '"')); }
  assert.match(scr, /hasKin \? h\("button", \{ "data-wk": "tripbook", "data-part": "kin"/);
});
