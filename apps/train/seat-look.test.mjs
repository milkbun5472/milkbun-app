import test from 'node:test';import assert from 'node:assert/strict';
import {startTrip,restoreTrip} from './travel.mjs';import {seatLook,lookForTa} from '../fairy-garden/wardrobe.mjs';
test('车上换的样貌重新发车/读档都还在',()=>{const t={...startTrip(null,()=>0),looks:{me:{hair:'bob'},companion:{hair:'korean'}}};const n=startTrip({day:3,minute:5,epoch:'e'},()=>0,t);assert.deepEqual(n.looks,t.looks);assert.deepEqual(restoreTrip(JSON.parse(JSON.stringify(n))).looks,t.looks);assert.equal(startTrip(null,()=>0).looks,undefined);});
test('没存过样貌：她那一侧是她，同行者按他/她',()=>{assert.equal(seatLook('me',null,'他').hair,lookForTa('她').hair);assert.equal(seatLook('companion',null,'他').hair,lookForTa('他').hair);assert.equal(seatLook('companion',{hair:'bob'},'他').hair,'bob');});
test('键盘顶起对话框：盖住多少顶多少，几十像素的安全区不算',async()=>{const {keyboardLift}=await import('./puzzle-view.mjs');assert.equal(keyboardLift(844,500,0),344);assert.equal(keyboardLift(844,800,0),0);});
test('回话中发送键不锁：按了排队而不是按不动',async()=>{const src=(await import('node:fs')).readFileSync(new URL('./puzzle-view.mjs',import.meta.url),'utf8');assert.ok(!src.includes("$('#desk-send').disabled=true"));assert.ok(src.includes('pendingSay=text'));});
test('她的话一按就上屏、输入框先清：不等 TA 回完',async()=>{const src=(await import('node:fs')).readFileSync(new URL('./puzzle-view.mjs',import.meta.url),'utf8');const t=src.slice(src.indexOf('async function talk'));assert.ok(t.indexOf("bubble(text,'you')")<t.indexOf('await host.chat('));assert.ok(src.includes("input.value='';talk(text);"));});
test('眼睛颜色：没选是原来那个棕，选了就带着走，读档不丢',async()=>{const {dyesOf,DEFAULT_EYE}=await import('../fairy-garden/wardrobe.mjs');const {restoreLook}=await import('../fairy-garden/world.mjs');assert.equal(dyesOf({}).eye,DEFAULT_EYE);assert.equal(dyesOf({eye:'#3f6fa8'}).eye,'#3f6fa8');assert.equal(restoreLook({eye:'#3f6fa8'}).eye,'#3f6fa8');
 const {readFileSync}=await import('node:fs');const js=readFileSync(new URL('../../js/fairy-garden.js',import.meta.url),'utf8');assert.ok(js.includes('pushLook({ eye })'));});
test('眯眼的脸不染：开心、惬意贴图里没有眼珠遮罩；默认脸有',async()=>{const {readFileSync}=await import('node:fs');
 // webp 带透明通道＝VP8X 头里 alpha 位；开心/惬意也带（统一格式），这里只钉脚本的规则
 const py=readFileSync(new URL('../../art/fairy-garden/doll/eye_mask.py',import.meta.url),'utf8');assert.ok(py.includes("CLOSED={'happy','cozy'}"));assert.ok(py.includes("BROWS={'proud','gloomy','sad','irritated'}"));});
test('陪伴心情词典：否定不认成开心，常见词都有脸',async()=>{const {readFileSync}=await import('node:fs');const src=readFileSync(new URL('../../js/companion.js',import.meta.url),'utf8');const i=src.indexOf('const FACE_RULES'),j=src.indexOf('];',i)+2;const FACE_RULES=new Function(src.slice(i,j)+';return FACE_RULES;')();
 const f=l=>{for(const [x,r] of FACE_RULES)if(r.test(l))return x;return 'default';};
 for(const [w,e] of [['不开心','gloomy'],['开心','happy'],['困惑','surprise'],['困倦','gloomy'],['痛快','happy'],['温柔','cozy'],['失望','sad'],['自信','proud'],['如释重负','relax'],['好奇','amazed'],['烦躁','irritated']])assert.equal(f(w),e,w);});
