const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function section(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start);return s.slice(start,end);}
test('shared wardrobe reads current owner and returns detached snapshots, including UI drafts',async()=>{
 const {createWardrobe,mergeLook}=await import('../apps/fairy-garden/wardrobe.mjs');
 let saved={me:{eye:'#112233',dims:{height:1.1},wardrobe:{academy:{cloth:'#abcdef'}}},companion:{eye:'#778899'}};
 const a=createWardrobe(()=>saved),other=createWardrobe(()=>({me:{eye:'#666666'}}));
 const snapshot=a.getLook();snapshot.me.dims.height=2;snapshot.me.wardrobe.academy.cloth='#ffffff';assert.equal(saved.me.dims.height,1.1);assert.equal(saved.me.wardrobe.academy.cloth,'#abcdef');
 const patch={eyeMode:'split',eyeLeft:'#123456',eyeRight:'#abcdef'},draft=mergeLook(saved.me,patch);
 assert.equal(a.wardrobeFor('me',draft).dyes.eyeMode,'split');assert.equal(a.getDyes('me').eyeMode,'solid','draft does not mutate source');
 saved={...saved,me:draft};assert.equal(a.getDyes('me').eyeLeft,'#123456');assert.equal(a.getDyes('companion').eyeMode,'solid');assert.equal(other.getDyes('me').eye,'#666666');assert.equal(a.wardrobeFor('missing',draft),null);assert.equal(a.getDyes('__proto__'),undefined);
 const copy=mergeLook(saved.me,{});copy.dims.height=9;copy.wardrobe.academy.cloth='#000000';assert.equal(saved.me.dims.height,1.1);assert.equal(saved.me.wardrobe.academy.cloth,'#abcdef');
});
test('garden real appearance writer isolates player, companion, neighbors, archive and failed saves',async()=>{
 const wardrobe=await import('../apps/fairy-garden/wardrobe.mjs'),world=await import('../apps/fairy-garden/world.mjs');
 let initial=world.freshState();initial=world.moveIn(initial,{charId:'neighbor-a',name:'邻居甲'});initial=world.moveIn(initial,{charId:'neighbor-b',name:'邻居乙'});
 // moveIn's real writer owns the neighbor shape; no hand-invented neighbor records.
 assert.equal(initial.neighbors.length,2);
 let archives={active:{id:'active',world:initial,worlds:{garden:initial},journey:{keep:1}},other:{look:{eye:'#999999'}}},fail=false,applied=[];
 const avatar=who=>({setLook:p=>applied.push([who,p])});
 const ctx={...wardrobe,...world,structuredClone,ready:true,data:structuredClone(initial),crew:new Map(initial.neighbors.map(n=>[String(n.charId),{avatar:avatar(n.charId)}])),playerAvatar:avatar('me'),companionAvatar:avatar('companion'),previewDolls:{},window:{},WORLDS:[{id:'garden'}],write:(key,next)=>{if(fail)throw Error('disk full');archives={...archives,[key]:structuredClone(next)};return next;}};
 ctx.save=()=>{try{ctx.saveWorld('active',()=>archives.active,ctx.data,'garden',world.takeJourney(ctx.data));return true;}catch{return false;}};
 vm.createContext(ctx);vm.runInContext(section(read('js/fairy-garden.js'),'function saveWorld(','function WorldSession('),ctx);vm.runInContext(section(read('apps/fairy-garden/game.mjs'),'const gardenWardrobe=','window.FairyGardenGame=')+'globalThis.applyLook=applyLook;globalThis.wardrobe=gardenWardrobe;',ctx);
 for(const [i,who]of ['me','companion',...initial.neighbors.map(n=>String(n.charId))].entries()){
  const before=structuredClone(archives),looks=ctx.wardrobe.getLook(),patch={eyeMode:'split',eyeLeft:['#112233','#223344','#334455','#445566'][i],eyeRight:'#abcdef'};
  assert.equal(ctx.applyLook(who,patch),true);const after=ctx.wardrobe.getLook();assert.equal(after[who].eyeLeft,patch.eyeLeft);for(const other of Object.keys(looks).filter(k=>k!==who))assert.deepEqual(after[other],looks[other]);assert.deepEqual(archives.other,before.other);assert.equal(archives.active.journey.keep,1);
 }
 const before=structuredClone(archives),count=applied.length,looks=ctx.wardrobe.getLook();assert.equal(ctx.applyLook('removed-neighbor',{eye:'#000000'}),false);assert.deepEqual(archives,before);
 fail=true;assert.equal(ctx.applyLook('me',{eyeLeft:'#ffffff'}),false);assert.deepEqual(archives,before);assert.deepEqual(ctx.wardrobe.getLook(),looks);assert.equal(applied.length,count);
});
test('train real writer copies its fallback, keeps other owners and rolls back failed writes',async()=>{
 const wardrobe=await import('../apps/fairy-garden/wardrobe.mjs'),src=read('apps/train/game.mjs');
 const archive={journey:{look:{eye:'#112233',dims:{height:1.1}},companionLook:{eye:'#778899'}},worlds:{garden:{look:{eye:'#444444'}}}},before=structuredClone(archive);
 const ctx={...wardrobe,structuredClone,host:{load:()=>archive,companion:()=>({ta:'他'})},state:{looks:{}},view:{},passengers:{people:[]},previewDolls:{},flush:()=>true};vm.createContext(ctx);vm.runInContext(section(src,'function lookOf(','function flush('),ctx);vm.runInContext('globalThis.setLook='+section(src,'setLook:(who,patch)=>','  chatContext:').trim().replace(/^setLook:/,'').replace(/,$/,'')+';',ctx);
 assert.equal(ctx.setLook('me',{eyeMode:'split',eyeLeft:'#abcdef',eyeRight:'#fedcba'}),true);assert.equal(ctx.state.looks.me.eyeLeft,'#abcdef');assert.equal(ctx.state.looks.companion,undefined);assert.deepEqual(archive,before);ctx.state.looks.me.dims.height=9;assert.equal(archive.journey.look.dims.height,1.1);
 const saved=structuredClone(ctx.state);ctx.flush=()=>false;assert.equal(ctx.setLook('companion',{eyeLeft:'#ffffff'}),false);assert.deepEqual(structuredClone(ctx.state),saved);assert.equal(ctx.setLook('wrong',{eyeLeft:'#ffffff'}),false);
});
