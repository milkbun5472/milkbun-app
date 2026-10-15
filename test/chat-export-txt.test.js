// 群友 2026-10-14：「单人的聊天记录可以导出吗」——聊天设置里导出 txt，可连线下一起按时间排
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
test("聊天设置里有导出，走 saveTextFile 存 txt；线下用 offlineSessionsText 同一支", () => {
  assert.match(app, /const exportChatText = async \(char, key, withOff\) =>/);
  assert.match(app, /onExportChat: withOff => exportChatText\(activeChar,/);
  assert.match(app, /offlineSessionsText\(\[x\], stamp, who\)/);
  assert.match(app, /saveTextFile\(who \+ "-聊天记录"/);
  assert.match(comp, /"data-wk": "csexportbtn", onClick: \(\) => onExportChat\(exportWithOff\)/);
  assert.match(comp, /const \[exportWithOff, setExportWithOff\] = useState\(false\)/);
});
