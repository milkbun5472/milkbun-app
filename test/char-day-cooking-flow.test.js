const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function env(){const c={window:null,React:{createElement:(type,props,...children)=>typeof type==='function'?type(props||{}):({type,props:props||{},children:children.flat().filter(x=>x!=null&&x!==false)})}};c.window=c;vm.createContext(c);for(const f of ['apps/fairy-garden/day/kitchen.js','js/char-day-kitchen-ui.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);return c;}
function find(tree,predicate){return !tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...(tree.children||[]).flatMap(q=>find(q,predicate))];}
function content(tree){return tree==null?'':typeof tree!=='object'?String(tree):(tree.children||[]).map(content).join('');}
test('操作纸卡按真实食材给切菜／下锅选项，点下一步使用同一料理输入口，触区44px',()=>{
 const c=env(),K=c.CharDayKitchen,job={kind:'cook',recipeId:'tomato-egg',cooking:K.cookingSession('tomato-egg',{lead:'ta'})};let p=K.stepCooking(job,job.cooking.progress,{kind:'drop',id:'food-0',point:K.TABLE_ZONES.board});const calls=[],tree=c.CharDayKitchenGuide({job,status:{progress:p,feedback:'切开了'},station:'board',input:e=>calls.push(e)});
 assert.ok(content(tree).includes('切开了'));const buttons=find(tree,n=>n.type==='button');assert.ok(buttons.every(n=>n.props.style.minHeight>=44));const next=buttons.find(n=>n.props['data-part']==='board-pan');assert.ok(next);next.props.onClick();assert.equal(calls[0].kind,'board-pan');const paused=c.CharDayKitchenGuide({job,status:{progress:p,phase:'paused'},station:'board',input:()=>{}});assert.ok(find(paused,n=>n.type==='button').every(n=>n.props.disabled));
});
test('成品立即显示真实火候与调味；已经吃好仍可在原餐桌尝菜',()=>{
 const c=env(),K=c.CharDayKitchen,job={kind:'cook',recipeId:'tomato-egg',cooking:K.cookingSession('tomato-egg',{lead:'ta'}),ready:true};const p=job.cooking.progress;p.table.items.forEach(x=>{x.zone='plate';x.top=x.bottom=1;x.heatTime=28;});p.table.sealed=true;p.index=3;
 const tree=c.CharDayKitchenHUD({job,status:{progress:p},input:()=>{},finish:()=>{},plate:()=>{},preferences:{salt:'light'}});assert.ok(content(tree).includes('火候偏重'));assert.ok(content(tree).includes('偏干'));assert.ok(content(tree).includes('适中'));
 const meal={kind:'meal',ready:true,courses:[{id:'actual',recipeId:'tomato-egg',tabletop:p.table}]},events=[],hud=c.CharDayKitchenHUD({job:meal,status:{},input:e=>events.push(e),finish:()=>{}});const offer=find(hud,n=>n.props['data-wk']==='cdaykitchenoffer')[0];assert.ok(offer);offer.props.onClick();assert.equal(events[0].kind,'offer');
});
