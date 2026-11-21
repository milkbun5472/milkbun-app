// 每一次调用在「调用记录」里都要有名字（她 2026-11-21「你自己去查其他没名字的调用」）：
//   没 logFrom/logLabel/tag/use、所在函数也不在 CALL_FN_LABEL、文件也不在 CALL_FILE_LABEL 的，就会显示成「其他·提示词开头几个字」。
//   新加调用：给它起个名（CALL_FN_LABEL 加一行，或调用处带 logFrom）。
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const path = require("path");
process.chdir(path.join(__dirname, ".."));
test("没有不知道叫什么的调用", () => {
const eng=fs.readFileSync("js/engine.js","utf8");
const MAP=JSON.parse(eng.match(/const CALL_FN_LABEL = Object\.freeze\((\{[^\n]*\})\)/)[1]);
const FMAP=JSON.parse(eng.match(/const CALL_FILE_LABEL = Object\.freeze\((\{[^\n]*\})\)/)[1]);
const SKIP=(eng.match(/const CALL_SKIP_FN = [^\n]*/)||[""])[0];
const res={};
for(const file of fs.readdirSync("js").filter(f=>f.endsWith(".js"))){
 if(FMAP[file.replace(".js","")]) continue;
 const L=fs.readFileSync("js/"+file,"utf8").split("\n");
 L.forEach((ln,i)=>{ if(!/\b(runProbe|runProbeRetry|callAI)\(/.test(ln)||/function (runProbe|runProbeRetry|callAI)\b/.test(ln))return;
  const win=L.slice(i,i+10).join(" "); if(/logFrom|logLabel|\btag:|\buse:/.test(win))return;
  const re=file==="app.js"?/^  (?:const|let|async function|function) ([\w$]+)/:/^(?:async function|function|const|let) ([\w$]+)/;
  let name="?";for(let j=i;j>=0;j--){const mm=L[j].match(re);if(mm){name=mm[1];break;}}
  if(MAP[name]||SKIP.includes('"'+name+'"'))return;
  (res[file+":"+name]=res[file+":"+name]||[]).push(i+1);});
}
assert.deepStrictEqual(Object.keys(res).map(k => k + " " + res[k].join(",")), [], "这些调用在调用记录里没名字");
});
