const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const comp=fs.readFileSync('js/components.js','utf8'),app=fs.readFileSync('js/app.js','utf8');
test('同档横幅两个独立入口传入正确世界，聊天只挂一处',()=>{
 const a=comp.indexOf('function RoomWorldBanner('),b=comp.indexOf('function ChatThread(',a);assert.ok(a>=0&&b>a);
 const ctx={h:(type,props,...children)=>({type,props,children}),useTheme:()=>({ink:'#123',line:'#ddd'}),F_BODY:'serif'};vm.createContext(ctx);vm.runInContext(comp.slice(a,b),ctx);
 const picked=[],tree=ctx.RoomWorldBanner({onEnter:w=>picked.push(w)}),buttons=tree.children.flat().filter(n=>n.type==='button');
 assert.equal(buttons.length,2);buttons.forEach(n=>{assert.ok(n.props.style.minHeight>=44);n.props.onClick();});assert.deepEqual(picked,['garden','train']);
 assert.equal((comp.match(/h\(RoomWorldBanner,/g)||[]).length,1);
 assert.match(app,/entryWorld: gardenRoomWorld \|\|/);
 assert.match(app,/onEnterGarden:.*setGardenRoomWorld\(world === "train" \? "train" : "garden"\); setGardenOpen\(activeRoomId\)/);
 assert.match(app,/storeKey: "x_fairyGarden::" \+ key/);
});
