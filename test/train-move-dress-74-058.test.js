// 列车：走动、去掉头顶名牌、设置里的改外貌（2026-09-25）
const assert = require("node:assert/strict");
const fs = require("fs");
const read = f => fs.readFileSync(require("path").join(__dirname, "..", f), "utf8");
const pass = read("apps/train/passengers.mjs"), game = read("apps/train/game.mjs"), html = read("apps/train/index.html"), fg = read("js/fairy-garden.js");

// 1. 名牌不再钉在玩偶头上
assert.ok(!pass.includes("train-passenger-name"), "no fixed name tag over the dolls");
// 2. 走动：路线、四个去处、回座位
for (const k of ["go(", "home(", "where("]) assert.ok(pass.includes(k), "passengers exposes " + k);
for (const spot of ["seat", "stand", "rack", "berth"]) assert.ok(html.includes('data-spot="' + spot + '"'), "move button " + spot);
assert.ok(html.includes('id="open-move"'), "nav has 走动");
assert.ok(/take-photo[\s\S]{0,400}passengers\?\.home\(\)/.test(game) || game.includes("passengers?.home()"), "photo brings both back");
// 3. 改外貌：游戏侧四个接口，存进列车自己那份 looks，庭院那身作兜底
for (const k of ["getLook:", "getDyes:", "getOutfit:", "setLook:"]) assert.ok(game.includes(k), "TrainGame." + k);
assert.ok(game.includes("mergeLook(lookOf(who),patch)"), "same merge as the garden");
assert.ok(pass.includes("state()?.looks?.me||journey.look||garden?.look"), "train look overrides garden look");
// 4. 宿主：庭院和列车共用同一份 DressControls
assert.equal((fg.match(/h\(DressControls,/g) || []).length, 2, "one control set, two places");
assert.ok(fg.includes('"改外貌"') && fg.includes('panel==="dress"'), "train settings has 改外貌");
// 5. 点地板走过去（74.059）：拖动不算点，落点夹在地板里
assert.ok(pass.includes("function goTo(") && pass.includes("function floorPoint("), "floor tap walking");
assert.ok(/Math\.hypot\(e\.clientX-d\.x,e\.clientY-d\.y\)>8/.test(game), "drags are not taps");
// 6. 站位不穿模（74.060）：床沿前、躲开梯子，面板那行字照实说
assert.ok(pass.includes("const FLOOR={x:[-3,3.1],z:[.3,1.45]}"), "floor stops before the berth edge");
assert.ok(!/spot==='rack'\)return\{x:p\.bed\.x/.test(pass), "rack spot no longer inside the ladder");
assert.ok(game.includes("function standAt(w)"), "rest panel reports where you actually are");
console.log("train move + dress 74.058 ok");
