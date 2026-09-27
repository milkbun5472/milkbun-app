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
