const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/games.js','utf8');
test('俄罗斯方块能暂停，主循环只在 play 时跑、回来接着玩',()=>{
  const g=s.slice(s.indexOf('function TetrisGame'));
  assert.match(g,/if \(status !== "play"\) return;/);
  assert.match(g,/setStatus\("pause"\)/);
  assert.match(g,/status === "pause" \?[\s\S]{0,200}setStatus\("play"\)/);
});
