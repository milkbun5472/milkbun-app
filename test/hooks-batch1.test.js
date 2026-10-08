// 挂点补课第一批（她 2026-10-08）：查手机、一起听、两个钱包、世界书、记忆库
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const scr = rd("screens.js"), phone = rd("phone.js"), ts = rd("theme-studio.js");
const PAGES = {
  phone: [phone, ["phonepage", "phonerow", "phoneicon", "phonewidget"]],
  listen: [scr, ["listenpage", "listentitle", "listenartist", "listenctrl", "listenlyric", "listentab"]],
  wallet: [scr, ["walletpage", "walletbalance", "walletslip", "walletkin"]],
  cwallet: [scr, ["cwpage", "cwrow", "cwbalance", "cwsec", "cwline"]],
  lore: [scr, ["lorepage", "loreintro", "lorefilter", "lorestamp", "lorecard", "loretitle", "lorebody", "loreswitch"]],
  memlib: [scr, ["mempage", "memtab", "memwho", "memroom", "memdate", "memcard", "memtext"]]
};
for (const [pg, [src, hooks]] of Object.entries(PAGES)) {
  test(pg + "：页面上挂了，也登记在只管这一页的那组里", () => {
    const a = ts.indexOf('pages:Object.freeze(["' + pg + '"])');
    assert.ok(a > 0, pg + " 没登记");
    const reg = ts.slice(a, ts.indexOf("}),", a));
    for (const k of hooks) {
      assert.ok(src.includes('"data-wk": "' + k + '"'), "页面上没挂 " + k);
      assert.ok(reg.includes('["' + k + '"'), "没登记 " + k);
    }
  });
}
