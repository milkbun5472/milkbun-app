// 群友 2026-10-19：主题包不带桌面布局。她：搞个开关，导出能选、导入也能选
const test = require("node:test");
const assert = require("node:assert/strict");
const store = {};
global.window = global; global.document = { documentElement: {} };
global.loadJSON = (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d);
global.saveJSON = (k, v) => { store[k] = v; };
let n = 0;
global.imgVaultFetchBlob = async () => new Blob(["x"]);
global.FileReader = class { readAsDataURL() { this.result = "data:image/png;base64,eA=="; setTimeout(() => this.onload(), 0); } };
global.imgToVault = async () => "iv_new" + (++n);
require("../js/theme-studio.js");
const S = window.ThemeStudio;

test("主屏布局是第七样，默认不勾", () => {
  assert.ok(S.PACK_KEYS.includes("home"));
  assert.equal(S.cleanPick(null).home, false);
  assert.equal(S.cleanPick(null).icons, true, "别的几样照旧默认全要");
});
test("勾了才导出、带上贴纸图；导入换门牌、只认主屏那几份", async () => {
  store.x_homeLayout = { 0: ["chat", "w_cal"] };
  store.x_homeStickers = { home: [{ img: "iv_abc" }] };
  const off = JSON.parse(await S.exportPackage({ pick: { icons: true } }));
  assert.equal(off.home, undefined, "没勾就不许带走她的桌面");
  const on = JSON.parse(await S.exportPackage({ pick: { home: true } }));
  assert.deepEqual(on.home.x_homeLayout, { 0: ["chat", "w_cal"] });
  assert.ok(on.assets.iv_abc, "贴纸图没装进包");
  on.home.x_characters = ["别的键不许混进来"];
  const pkg = await S.importPackage(JSON.stringify(on));
  assert.equal(pkg.home.x_characters, undefined);
  assert.match(pkg.home.x_homeStickers.home[0].img, /^iv_new/);
  assert.ok(S.packHas(pkg, "home"));
  store.x_homeLayout = { 0: ["mine"] };
  S.homeApply(pkg.home);
  assert.deepEqual(store.x_homeLayout, { 0: ["chat", "w_cal"] });
});
test("界面：导入默认不勾主屏布局，正式应用才写", () => {
  const ui = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
  assert.match(ui, /sel\[x\.key\] = x\.has && x\.key !== "home";/);
  assert.match(ui, /setPendingHome\(sel\.home \? \(pack\.home \|\| null\) : null\);/);
  assert.match(ui, /const homeDone = pendingHome && studio\.homeApply \? studio\.homeApply\(pendingHome\) : false;/);
});
