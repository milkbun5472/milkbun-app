// 秋秋能改线下那层的 CSS、能收能发文件、每条能复制（她 2026-10-05：「给秋秋开权限，给它发文件它也可以写文件」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const asst = R("js/assistant.js"), app = R("js/app.js"), comp = R("js/components.js");

test("offlinecss：写进这个人的线下设置那一格，过 ThemeStudio 那道洗；整页和悬浮屏两处都接上", () => {
  const i = asst.indexOf("    offlinecss: {"), j = asst.indexOf("    groupcss: {", i);
  assert.ok(i > 0 && j > i);
  const body = asst.slice(i, j);
  assert.match(body, /loadJ\("x_offlineSettings", \{\}\)/);
  assert.match(body, /ts\.unsafeReason\(css\)/);
  assert.match(body, /ctx\.onPatchOfflineSetting\(id, \{ customCSS: css \}\)/);
  assert.equal((app.match(/onPatchOfflineSetting: \(charId, patch\) => saveOfflineSettings\(charId, patch\),/g) || []).length, 2);
  assert.match(asst, /· offlinecss 这个人【线下见面那一层】的 CSS/);
});

test("美化那一路不被「不聊代码」那道门挡掉", () => {
  assert.match(asst, /if \(LOOK_TALK\.test\(s\)\) return false;/);
});

test("给她文件：file 原样保留不洗代码；卡片能复制全部、存成文件", () => {
  assert.match(asst, /const outFile = d\.file && typeof d\.file === "object"/);
  assert.match(asst, /return \{ reply: reply \|\| \(outFile \? "文件在下面。" : "改动稿在下面。"\), patches, file: outFile \};/);
  assert.match(asst, /\["存成文件", async \(\) => \{ try \{ await saveTextFile\(m\.outFile\.name, m\.outFile\.text,/);
  assert.match(comp, /function FileCard\(\{ m, actions \}\)/, "同一张文件卡，不另起一份");
  assert.match(asst, /"file":\{"name":"（可选）文件名","text":"完整内容"\}/);
});

test("她发文件：跟聊天发文件同一个 pickTextFile，收 CSS，内容接在这一句后面", () => {
  assert.match(asst, /pickTextFile\(m => setPic\(Object\.assign\(\{ kind: "file" \}, m\)\), \{ max: 60000 \}\)/);
  assert.match(comp, /inp\.accept = "\.txt,\.md,\.markdown,\.csv,\.json,\.srt,\.log,\.css,/);
  assert.match(asst, /const fileTail = isFile \? "\\n\\n【她发来的文件《" \+ pic\.name/);
});

test("每条回复都能一键复制；输出给足 65535", () => {
  assert.match(asst, /m\.text \? h\("button", \{ onClick: async \(\) => \{ const ok = typeof copyText === "function" && await copyText\(m\.text\);/);
  assert.match(asst, /maxTokens: 65535, timeout: 600000/);   // v74.926 长人设：等 10 分钟、走流式
  assert.doesNotMatch(asst, /maxTokens: 12000/);
});
