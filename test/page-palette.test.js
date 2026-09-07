const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = fs.readFileSync('js/core.js', 'utf8');
const studio = fs.readFileSync('js/theme-studio.js', 'utf8');
function setup() {
  let current = {};
  const api = new Function('current', studio.slice(studio.indexOf('const TOKENS = Object.freeze(['), studio.indexOf('const SLOT_KEY')) + ';return {tokensFor, themeFor, OWN_PALETTE};')(() => current);
  const palette = new Function('window', core.slice(core.indexOf('function pagePalette('), core.indexOf('const AV_COLORS')) + ';return {pagePalette, pageColor, paletteAlpha};')({ThemeStudio: api});
  return {...palette, api, set: value => current = value};
}
const colors = {bg:'white',bg2:'rgb(240, 240, 240)',ink:'#202020',sub:'#444444',fog:'#666666',line:'#bbbbbb',accent:'#713b91',tint:'hsl(30 40% 30%)'};
test('自带底稿：无覆盖保留身份、当前预览可覆盖、撤销还原、不会串页', () => {
  const p=setup(), base={...colors,bg:'#161a24',ink:'#eeeeee'};
  assert.equal(p.pagePalette('tarot',base),base);
  p.set({pageTokens:{tarot:colors}});
  assert.deepEqual(p.pagePalette('tarot',base),colors);
  assert.equal(p.pagePalette('dream',base),base);
  p.set({pageTokens:{}});
  assert.equal(p.pagePalette('tarot',base),base);
});
test('栏目别名只覆盖颜色，字体和栏目身份不丢，原底稿不被写入', () => {
  const p=setup(), base={paper:'#eee',muted:'#555',pale:'#ddd',ink:'#111',titleFace:'serif',id:'editorial'};
  p.set({pageTokens:{weekly:colors}});
  const got=p.pagePalette('weekly',base,{paper:'bg',muted:'sub',pale:'bg2'});
  assert.equal(got.paper,'white');assert.equal(got.muted,colors.sub);assert.equal(got.pale,colors.bg2);
  assert.equal(got.titleFace,'serif');assert.equal(got.id,'editorial');assert.equal(base.paper,'#eee');
});
test('单独一支色和非十六进制透明色也走公共机制', () => {
  const p=setup();p.set({pageTokens:{ledger:{bg:'white'}}});
  assert.equal(p.pageColor('ledger','bg','#f2ece0'),'white');
  assert.equal(p.pageColor('ledger','ink','#333'),'#333');
  assert.equal(p.paletteAlpha('#112233','22'),'#11223322');
  assert.match(p.paletteAlpha('rgb(1, 2, 3)','22'),/^color-mix\(in srgb, rgb\(1, 2, 3\)/);
});
test('接入的六页解除拦截，地图仍有明确原因', () => {
  const p=setup();
  for(const name of ['tarot','ledger','weekly','dreamjournal','impression','fanfic']) {
    assert.equal(p.api.OWN_PALETTE[name],undefined);
    assert.match(fs.readFileSync('js/'+name+'.js','utf8'),new RegExp('page(?:Palette|Color)\\("'+name+'"'));
  }
  assert.match(p.api.OWN_PALETTE.map,/地图/);
});
