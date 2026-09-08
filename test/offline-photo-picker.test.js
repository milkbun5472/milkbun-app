const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/components.js'), 'utf8');
const code = src.slice(src.indexOf('function OfflinePhotoPicker('), src.indexOf('function useOfflinePhotoSend('));
function fixture(extra = {}) {
  const calls = [];
  const ctx = { h: (type, props, ...children) => ({ type, props, children }), F_BODY: 'test',
    resizeImageFile: async (...args) => { calls.push(args); return 'resized'; } };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const props = { t: {}, photoFileRef: { current: { click: () => calls.push('pick') } },
    photoImg: '', photoDesc: '', setPhotoImg: value => calls.push(['image', value]),
    setPhotoDesc: value => calls.push(['desc', value]), sendPhoto: () => calls.push('send'), sending: false, ...extra };
  return { tree: ctx.OfflinePhotoPicker(props), calls };
}
test('两处只用同一个选图表单，拍照功能仍各自保留', () => {
  assert.equal((src.match(/h\(OfflinePhotoPicker, /g) || []).length, 2);
  for (const name of ['OfflineMode', 'GroupOfflineMode']) {
    const a = src.indexOf('function ' + name + '('), b = src.indexOf('\nfunction ', a + 1);
    const body = src.slice(a, b);
    assert.match(body, /h\(OfflinePhotoPicker, \{ t, photoFileRef, photoImg, setPhotoImg, photoDesc, setPhotoDesc, sendPhoto, sending \}/);
    assert.doesNotMatch(body, /resizeImageFile\(f, 1600, 0\.86\)/);
    assert.match(body, /onShoot\(/);
  }
});
test('选图缩放参数、清空文件框、说明和发送回调保持原样', async () => {
  const f = fixture({ photoImg: 'preview' }), nodes = f.tree.children;
  nodes[0].props.onClick();
  const event = { target: { files: ['file'], value: 'chosen' } };
  nodes[1].props.onChange(event);
  await Promise.resolve();
  assert.equal(event.target.value, '');
  nodes[2].props.onChange({ target: { value: '说明' } }); nodes[3].props.onClick();
  assert.deepEqual(f.calls, ['pick', ['file', 1600, 0.86], ['image', 'resized'], ['desc', '说明'], 'send']);
  assert.equal(nodes[0].children[0].props.src, 'preview');
});
test('空图和发送中禁用按钮，各会话回调互不影响', () => {
  assert.equal(fixture().tree.children[3].props.disabled, true);
  assert.equal(fixture({ photoImg: 'x', sending: true }).tree.children[3].props.disabled, true);
  const a = fixture({ photoImg: 'a' }), b = fixture({ photoImg: 'b' });
  assert.equal(a.tree.children[3].props.disabled, false);
  a.tree.children[2].props.onChange({ target: { value: '只改甲' } });
  assert.deepEqual(b.calls, []);
});
