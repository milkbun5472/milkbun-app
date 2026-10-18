const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/theme-studio.js','utf8');
test('复制给 AI 那段讲清顶栏别写死高度、装饰别 fixed；现成写法里有顶栏那条',()=>{
  assert.match(s,/顶栏别写死 height/);
  assert.match(s,/别用 position: fixed/);
  assert.match(s,/"顶栏让开刘海、换手机不飘"/);
});
