const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/assistant.js','utf8');
test('秋秋清空某一格 CSS：whole 填了、text 空的卡不再被当成格式不对',()=>{
  assert.match(s,/const CSS_CLEAR_OK = \{ chatcss: 1, offlinecss: 1, groupcss: 1 \};/);
  assert.match(s,/String\(x\.text \|\| ""\)\.trim\(\) \|\| cssClear\(x\) \|\|/);
  assert.match(s,/text 留空字符串——就是整份换成空/);
});
