// 她 2026-09-09：「保存不了宝宝，动作开关保存了回去看还是关着的」。
//
// 病根不是开关写坏了，是【存档那头逐项手抄】：ChatSettings 收齐一个对象交出来，
// app.js 那个 onSave 又把字段一项一项重新列一遍写进 x_chatSettings。
// 两张名单，改一张另一张不会跟着——漏掉的那一项不报错、不提示，
// 界面上还照样弹「已保存」，只有下次点进来才发现它变回去了。
//
// 这一条就盯这件事：设置页交出来的每一项，存档那头都得接住。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");

// 取出一段花括号包住的对象字面量（从 start 那个 "{" 起算）
const objAt = (src, start) => {
  let d = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(start, i + 1); }
  }
  throw new Error("没闭合");
};
// 只认最外一层的键（跳过嵌套对象里的）
const topKeys = body => {
  const out = [];
  let d = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "(" || c === "[") d++;
    else if (c === "}" || c === ")" || c === "]") d--;
    else if (d === 1) {
      const m = /^([A-Za-z_$][\w$]*)\s*[,:]/.exec(body.slice(i));
      if (m && (i === 0 || /[\s{,]/.test(body[i - 1]))) { out.push(m[1]); i += m[1].length; }
    }
  }
  return out;
};

test("设置页交出来的每一项，存档那头都接住了", () => {
  // 设置页那一头：onSave({ ... }) 里列的所有键
  // ⚠️认这一处要靠【它自己的样子】，不许靠行号：ChatSettings 那个保存键长这样
  const i = comp.indexOf("onClick: () => onSave({\n      remark,");
  assert.ok(i > 0, "ChatSettings 的保存键没找到（它换样子了？）");
  const given = topKeys(objAt(comp, comp.indexOf("{", i + 17)));
  assert.ok(given.length > 20, "只解析到 " + given.length + " 项，解析器多半坏了");

  // 存档那一头：写进 x_chatSettings 的那个对象
  const j = app.indexOf("...settingsFor(activeChar.id),");
  assert.ok(j > 0, "x_chatSettings 那一处的写入没找到");
  const kept = topKeys(objAt(app, app.lastIndexOf("{", j)));
  assert.ok(kept.length > 20, "存档那头只解析到 " + kept.length + " 项，解析器多半坏了");

  // 这几项【故意】不进 x_chatSettings：它们落在角色卡上，onSave 里另有出口
  const ELSEWHERE = ["remark", "patSig"];
  const missing = given.filter(k => !kept.includes(k) && !ELSEWHERE.includes(k));
  assert.deepEqual(missing, [],
    "这几项设置页交出来了、存档那头没接：" + missing.join("、") + "——点了保存也会变回去");
});
