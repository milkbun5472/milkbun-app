// 群友 2026-11-27 许愿「可以改衣柜里的场合名字」：我的衣柜和TA的衣柜都能点场合名就地改；改成已有的名字就并成一组
const assert = require("node:assert/strict"), fs = require("fs");
const sc = fs.readFileSync("js/screens.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const grab = name => { const i = sc.indexOf("function " + name + "("); let d = 0, j = sc.indexOf("{", i); for (let k = j; k < sc.length; k++) { if (sc[k] === "{") d++; else if (sc[k] === "}" && --d === 0) return sc.slice(i, k + 1); } };
const f = new Function("CLOSET_MAX_OCCASIONS", "CLOSET_MAX_SETS", "CLOSET_MAX_TOTAL", grab("closetGroups") + grab("closetRenameOcc") + ";return closetRenameOcc;")(20, 20, 200);
const d = { closet: [{ occasion: "居家", sets: [{ name: "粉猫睡衣" }] }, { occasion: "睡觉", sets: [{ name: "长袖" }, { name: "粉猫睡衣" }] }, { occasion: "出门", sets: [{ name: "风衣" }] }] };
assert.deepEqual(f(d, "出门", "通勤").closet.map(g => g.occasion), ["居家", "睡觉", "通勤"]);
const m = f(d, "居家", "睡觉").closet;
assert.deepEqual(m.map(g => g.occasion), ["睡觉", "出门"], "撞名并成一组");
assert.deepEqual(m[0].sets.map(x => x.name), ["长袖", "粉猫睡衣"], "撞名的那身只留一身，一身不丢");
assert.equal(f(d, "居家", "  "), d, "空名不改");
assert.match(app, /onRenameOcc: myClosetRenameOcc/);
assert.match(app, /onRenameOcc: carryRenameOcc/);
assert.match(ui, /h\(OccName, \{ t, name: g\.occasion \|\| "平常", wk: "closetgroupname"/);
assert.match(ui, /h\(OccName, \{ t, name: g\.occasion, wk: "carryoccasionname"/);
console.log("ok");
