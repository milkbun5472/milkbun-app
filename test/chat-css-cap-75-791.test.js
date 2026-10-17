const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),ts=fs.readFileSync(__dirname+'/../js/theme-studio.js','utf8'),cp=fs.readFileSync(__dirname+'/../js/components.js','utf8');
test('单聊自己写 CSS：上限只写一处，存不了时留上一份，编辑框当场提醒长度',()=>{
  assert.match(ts,/const CHAT_CSS_MAX = 200000;/);
  assert.doesNotMatch(app,/customCSS\)\.slice\(0, 60000\)/);
  assert.match(app,/slice\(0, window\.ThemeStudio\.CHAT_CSS_MAX/);
  assert.match(app,/settingsFor\(activeChar\.id\)\.customCSS \|\| ""/);
  assert.match(cp,/"data-wk": "chatcsslen"/);
});
