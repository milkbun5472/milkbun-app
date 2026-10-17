const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8'),cp=fs.readFileSync(__dirname+'/../js/components.js','utf8');
test('各聊天窗自己写的 CSS：设置·外观里列出来，单聊、群、线下都能在外面清空',()=>{
  assert.match(app,/chatCssRows: \[\]\.concat\(/);
  assert.match(app,/onClearChatCss: \(kind, id\) =>/);
  assert.match(sc,/page === "chatCss" && section\(/);
  assert.match(sc,/setPage\("chatCss"\)/);
});
test('安全模式也停掉各聊天窗那几层',()=>{
  assert.match(cp,/function applyGroupLook\(css\) \{ mountStyle\("wk-group-look-css", lookSafe\(\) \? "" : css\); \}/);
  assert.match(cp,/L\.customCSS && !_safe/);
});
