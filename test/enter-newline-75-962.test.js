const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const cp=fs.readFileSync(__dirname+'/../js/components.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8');
test('回车换行开关：四个输入面共用 DraftInput，开了就只换行；设置·外观里一格',()=>{
  assert.match(cp,/function enterNewline\(\) \{/);
  assert.match(cp,/!e\.repeat && !e\.isComposing && e\.keyCode !== 229 && !enterNewline\(\)\) \{ e\.preventDefault\(\); fire\(\); \}/);
  assert.equal((cp.match(/h\(DraftInput/g)||[]).length,4);
  assert.match(sc,/saveJSON\("x_enterNewline", !nl\)/);
});
