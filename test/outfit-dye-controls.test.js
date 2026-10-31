const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/fairy-garden.js','utf8');
const fn=source.slice(source.indexOf('function DressControls('),source.indexOf('function DyeControl('));
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)});
const DyeControl=()=>{};
const DressControls=vm.runInNewContext('('+fn+')',{h,React:{Fragment:'fragment'},DyeControl,F_BODY:'sans-serif',HAIR_COLORS:[],G:{ink:'#344936',line:'#cbd4bd',deep:'#344936',soft:'#657561'}});
const flatten=n=>[n,...(n.children||[]).flatMap(c=>typeof c==='object'?flatten(c):[])];
test('each outfit exposes its actual dye regions; reset changes only its own palette',async()=>{
 const {OUTFITS,mergeLook,outfitColors}=await import('../apps/fairy-garden/wardrobe.mjs');
 const {restoreLook}=await import('../apps/fairy-garden/world.mjs');
 for(const [id,outfit] of Object.entries(OUTFITS)){
  let look={outfit:id,skin:'#112233',hairColor:'#223344',eye:'#334455',dims:{shoulder:.96},wardrobe:{academy:{cloth:'#fedcba'},suit:{bottom:'#abcdef'}}};
  look=mergeLook(look,{outfitColors:Object.fromEntries(Object.keys(outfit.colors).map(k=>[k,'#ff00ff']))});
  const other=structuredClone(look.wardrobe),stateBefore=structuredClone(look);
  const tree=DressControls({who:'self',look:{self:look},styles:{outfits:OUTFITS},game:()=>({getOutfit:()=>({id,colors:outfitColors(look)})}),pushLook:patch=>{look=mergeLook(look,patch);}});
  const controls=flatten(tree),dyes=controls.filter(n=>n.type===DyeControl);
  for(const label of Object.values(outfit.colorLabels))assert.equal(dyes.filter(n=>n.props.label===label).length,1,id+': '+label);
  assert.ok(!dyes.some(n=>['裤袜颜色','领带与点缀'].includes(n.props.label)));
  const reset=controls.find(n=>n.type==='button'&&n.children.includes('恢复本套默认配色'));
  assert.ok(reset,id);assert.ok(reset.props.style.minHeight>=44);reset.props.onClick();
  assert.deepEqual(outfitColors(look),outfit.colors,id+' exact defaults');
  for(const key of ['skin','hairColor','eye','dims'])assert.deepEqual(look[key],stateBefore[key]);
  for(const [key,palette] of Object.entries(other))if(key!==id)assert.deepEqual(look.wardrobe[key],palette);
  assert.deepEqual(outfitColors(restoreLook(JSON.parse(JSON.stringify(look)))),outfit.colors);
 }
});
test('legacy shoe palettes migrate without dropping old saved slots; new slots survive restore',async()=>{
 const {outfitColors,mergeLook}=await import('../apps/fairy-garden/wardrobe.mjs');
 const {restoreLook}=await import('../apps/fairy-garden/world.mjs');
 for(const [outfit,slot] of [['cardigan','trim'],['jacket','trim'],['suit','bottom']]){
  let look={outfit,wardrobe:{[outfit]:{[slot]:'#123456'}}};assert.equal(outfitColors(look).boots,'#123456');
  look=mergeLook(look,{outfitColors:{boots:'#ffdd44'}});look=restoreLook(JSON.parse(JSON.stringify(look)));
  assert.equal(outfitColors(look).boots,'#ffdd44');assert.equal(look.wardrobe[outfit][slot],'#123456');
 }
});
test('共用异瞳开关与双眼控件只写对应字段，关闭再打开保留两眼选色',async()=>{
 const {mergeLook,dyesOf}=await import('../apps/fairy-garden/wardrobe.mjs');
 let look={eye:'#3f6fa8',skin:'#dfb093',hair:'bob'};
 const render=()=>flatten(DressControls({who:'self',look:{self:look},styles:{},game:()=>({getDyes:()=>dyesOf(look)}),pushLook:p=>{look=mergeLook(look,p);}}));
 let nodes=render();assert.equal(nodes.filter(n=>n.type===DyeControl&&n.props.label==='眼睛').length,1);
 const toggle=on=>render().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:on}});
 toggle(true);nodes=render();for(const [label,value] of [['左眼','#4e8a62'],['右眼','#8a5bb0']])nodes.find(n=>n.type===DyeControl&&n.props.label===label).props.onChange(value);
 toggle(false);assert.equal(render().find(n=>n.type===DyeControl&&n.props.label==='眼睛').props.value,'#3f6fa8');
 toggle(true);assert.equal(render().find(n=>n.type===DyeControl&&n.props.label==='左眼').props.value,'#4e8a62');assert.equal(look.eyeRight,'#8a5bb0');assert.equal(look.skin,'#dfb093');
});

test('公共衣柜用当前草稿显示，iframe仍是上次颜色时开关和配色不回弹',async()=>{
 const {createWardrobe,mergeLook}=await import('../apps/fairy-garden/wardrobe.mjs');
 const previous={eye:'#334455',hair:'bob',skin:'#dfb093'};let look=previous;
 const api=createWardrobe(()=>({me:previous}));
 const render=()=>flatten(DressControls({who:'me',look:{me:look},styles:{},game:()=>api,pushLook:p=>{look=mergeLook(look,p);}}));
 render().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
 assert.equal(render().find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,true);
 render().find(n=>n.type===DyeControl&&n.props.label==='左眼').props.onChange('#aa3344');
 assert.equal(render().find(n=>n.type===DyeControl&&n.props.label==='左眼').props.value,'#aa3344');
 assert.equal(api.getDyes('me').eyeMode,'solid');assert.equal(previous.eyeLeft,undefined);
});
