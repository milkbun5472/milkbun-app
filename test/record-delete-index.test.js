const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const engine = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
const a = engine.indexOf('function recordIndexForDelete('), b = engine.indexOf('\n}', a) + 2;
const ctx = {}; vm.createContext(ctx); vm.runInContext(engine.slice(a, b), ctx);
test('重复 ID 删除点中的第二条，不动第一条', () => {
  const rows = [{ id: 'same', content: '保留' }, { id: 'same', content: '删除' }];
  const idx = ctx.recordIndexForDelete(rows, 'same', 1);
  assert.equal(idx, 1); assert.deepEqual(rows.filter((_, i) => i !== idx), [rows[0]]);
});
test('缺 ID 支持原索引，过期索引不能误删另一个 ID', () => {
  const rows = [{}, { id: 'b' }, { id: 'a' }];
  assert.equal(ctx.recordIndexForDelete(rows, undefined, 0), 0);
  assert.equal(ctx.recordIndexForDelete(rows, 'a', 1), 2);
  assert.equal(ctx.recordIndexForDelete(rows, 'gone', 1), -1);
  for (const index of [-1, 5, 0.5, undefined]) assert.equal(ctx.recordIndexForDelete(rows, undefined, index), -1);
});
test('四条删除链都用公共定位，持久化及消息观察链保留', () => {
  const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.equal((app.match(/recordIndexForDelete\(/g) || []).length, 4);
  assert.match(app, /targetIndex: idx/);
  assert.match(app, /commitJSONDurable\("x_offline:" \+ scopeKey, next\)/);
  assert.match(app, /commitJSONDurable\("x_goffline:" \+ groupId, next\)/);
});
