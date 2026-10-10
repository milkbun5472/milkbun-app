const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('家具库与配色子页保留原iframe和试摆，沿公共顶栏单滚动与底安全区',()=>{
 const s=read('js/char-day.js');assert.match(s,/const closeDecorPanel=/);assert.match(s,/decorPositions\.current\[decorPanel\]=decorScroll\.current\.scrollTop/);
 assert.match(s,/"data-wk":"cdaydecorpanel",className:"absolute inset-0 flex flex-col"/);assert.match(s,/"data-wk":"cdaydecorbody",className:"flex-1 min-h-0 overflow-y-auto"/);
 assert.match(s,/h\(Head,\{zh:decorPanel/);assert.match(s,/onBack:decorPanel\?closeDecorPanel:cancelEditor/);assert.match(s,/safe-area-inset-bottom\) \* 0\.4/);assert.match(s,/minHeight:56/);
 assert.doesNotMatch(s,/h\(Sheet|localStorage\.|callAI\(|runProbe\(/);assert.match(s,/onClick:saveLayout/);assert.match(s,/if\(layoutBusy\|\|editor\?\.busy\)return/);
});
test('目录图从同一几何生成、复用渲染器且释放GPU资源，主材规则由公共目录提供',()=>{
 const scene=read('apps/fairy-garden/day/scene.mjs'),view=read('apps/fairy-garden/day/space-view.mjs'),finish=read('apps/fairy-garden/day/home-finish.mjs');
 assert.match(scene,/createSpaceView\('dayHome','warm'/);assert.match(scene,/furnitureOnly:true/);assert.match(scene,/readRenderTargetPixels/);assert.match(scene,/disposeMap\(view\.root\)/);assert.match(scene,/target\.dispose\(\)/);
 assert.match(scene,/furniturePrimary\(p,styleOf/);assert.match(view,/furniturePrimary\(a,base\)/);assert.match(view,/furnitureFinish\(result\.root\)/);assert.match(finish,/o\.material\.clone\(\)/);assert.match(finish,/new T\.CanvasTexture/);
});
