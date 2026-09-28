// 把 js/assistant-manual.js 那一份攻略导成 markdown，贴回她那份「内置攻略草稿」文档用。
// 她 2026-09-28：「以后两边都要对齐」——app 里这份是准的，文档照它排；
// 她在文档里改了什么，再照着改回 assistant-manual.js 的 doc 字段，然后重跑这个脚本核一遍。
// 用法：node scripts/guide-to-md.mjs > 攻略.md
import fs from "node:fs";
const g = {};
new Function("window", fs.readFileSync(new URL("../js/assistant-manual.js", import.meta.url), "utf8"))(g);
const M = g.AssistantManual;
const out = [];
// 言秋那一片是他的东西，不进这份给大家看的攻略
M.APP_CATS.filter(cat => cat !== "言秋那一片").forEach(cat => {
  out.push("# " + cat, "");
  M.APPS.filter(a => a.cat === cat).forEach(a => {
    out.push("## " + a.zh, "");
    const list = M.appEntries(a.id);
    list.forEach(e => {
      if (list.length > 1) out.push("### " + e.zh, "");
      // 词条自己的小节往下降一级，免得跟 app 那一层撞
      const body = String(e.doc || e.what).replace(/^### /gm, list.length > 1 ? "#### " : "### ");
      out.push("在哪儿：" + e.where, "", body, "");
    });
  });
});
process.stdout.write(out.join("\n"));
