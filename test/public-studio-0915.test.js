const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),phone=fs.readFileSync(__dirname+'/../js/phone.js','utf8');
test('实际照相馆调用带两边选中单品描述、不带未选衣柜且保留合照存档',async()=>{
 const start=app.indexOf('  const studioShoot = async '),end=app.indexOf('  const DRAWER_CAP',start);
 let scene,options,record;
 // 形状对应 genDateOutfits 的 put(): outfit/用户桶→closet→sets→name,note。
 assert.match(app,/saveMyCloset\(put\(myClosetRef.current, d && d.hers\)\)/);
 const c={profile:{name:'测试用户',refPhoto:'fixture-user'},imgApiReady:()=>true,setGen:()=>{},toast:()=>{},statesRef:{current:{}},
 carryRef:{current:{fictional:{outfit:{closet:[{occasion:'测试',sets:[{name:'外套',note:'蓝色棉外套'},{name:'鞋',note:'白色帆布鞋'},{name:'没选的',note:'不该发出'}]}]}}}},
 myClosetRef:{current:{closet:[{sets:[{name:'衬衣',note:'米色衬衣'}]}]}},
 buildPhotoPrompt:(char,s,st,o)=>{scene=s;options=o;return s;},buildMinimalPhotoPrompt:()=>'',
 generateSelfieImage:async()=>({url:'fixture-image'}),studioRef:{current:[]},STUDIO_CAP:30,
 setStudio:n=>record=n,saveJSON:()=>{},closetTextFor:()=>{throw Error('选定后不应读整柜')},
 // v69.01：出图时的「我」收成了公共的 photoMe（带固定服装锁和我的衣柜）。
 // 这儿故意让它返回一个哨兵衣柜——照相馆必须把它清掉，否则会跟她刚挑的那身打架。
 photoMe:n=>({name:(c.profile&&c.profile.name)||n,appearance:c.profile&&c.profile.appearance,
   refPhoto:c.profile&&c.profile.refPhoto,outfit:(c.profile&&c.profile.photoOutfit)||'',closet:'哨兵·整柜不该进来'})};
 vm.createContext(c);vm.runInContext(app.slice(start,end)+'\nthis.shoot=studioShoot;',c);
 const result=await c.shoot({id:'fictional',name:'测试角色',refPhoto:'fixture-char'},{scene:'测试场景',theirs:'外套、鞋',mine:'衬衣'});
 assert.ok(result);assert.match(scene,/外套（蓝色棉外套）＋鞋（白色帆布鞋）/);assert.match(scene,/衬衣（米色衬衣）/);
 assert.doesNotMatch(scene,/没选的|不该发出/);assert.equal(options.closet,'');assert.equal(options.kind,'duo');assert.equal(record[0].desc,scene);
 assert.equal(options.me.closet,'','她自己刚挑的那身不能被整柜顶掉');
 const pieces=Array.from({length:24},(_,i)=>({name:'单品'+i,note:'蓝'.repeat(47)+'🧥'+'不应进入'.repeat(10)}));
 c.carryRef.current.fictional.outfit.closet=[{sets:pieces}];
 const many=await c.shoot({id:'fictional',name:'测试角色',refPhoto:'fixture-char'},{scene:'测试场景',theirs:pieces.map(x=>x.name).join('、'),mine:''});
 assert.ok(many);
 for(const piece of pieces)assert.ok(scene.includes(piece.name+'（'+'蓝'.repeat(47)+'🧥）'),piece.name+'不应丢失，且48字符不能切坏emoji');
 assert.doesNotMatch(scene,/不应进入/);assert.ok(scene.length>300);
});
