// One kitchen catalog and transaction authority, consumed by both phone and scene.
(function(root){
 'use strict';
 const INGREDIENTS={tomato:'番茄',egg:'鸡蛋',noodle:'面条',mushroom:'蘑菇',rice:'米饭',potato:'土豆',carrot:'胡萝卜',greens:'青菜',tofu:'豆腐',chicken:'鸡肉',beef:'牛肉',shrimp:'虾仁',fish:'鱼肉',flour:'面粉',milk:'牛奶',butter:'黄油',cheese:'芝士',bread:'吐司',corn:'玉米',pumpkin:'南瓜',berry:'草莓',apple:'苹果',lemon:'柠檬',tea:'茶叶'};
 const CATEGORIES={staple:'饭面主食',home:'家常小炒',soup:'汤锅',breakfast:'早餐',bakery:'烘焙甜点',fresh:'轻食饮品'};
 const METHODS={stir:{label:'拌炒',seconds:12,steps:['洗切配菜','一起拌炒','分装两人份']},fry:{label:'煎炒',seconds:14,steps:['切好食材','翻炒收汁','摆盘上桌']},boil:{label:'煮汤',seconds:14,steps:['备好汤料','小火煮开','盛出热汤']},steam:{label:'蒸煮',seconds:14,steps:['揉面备馅','盖上蒸笼','装盘出笼']},bake:{label:'烘焙',seconds:18,steps:['和面拌料','放进小烤箱','出炉装盘']},mix:{label:'冷拌',seconds:10,steps:['洗切食材','拌好酱汁','装好两份']},brew:{label:'冲调',seconds:10,steps:['准备茶与水果','温热冲调','倒入两只杯子']}};
 const rows=[
 ['tomato-rice','番茄蛋饭','staple','stir',{tomato:1,egg:1,rice:1},'rice','tomato'],
 ['mushroom-noodle','菌菇汤面','staple','boil',{mushroom:1,noodle:1},'noodle','mushroom'],
 ['egg-noodle','番茄鸡蛋面','staple','boil',{tomato:1,egg:1,noodle:1},'noodle','tomato'],
 ['shrimp-rice','虾仁蛋炒饭','staple','stir',{shrimp:1,egg:1,rice:1,carrot:1},'rice','shrimp'],
 ['beef-rice','土豆牛肉盖饭','staple','fry',{beef:1,potato:1,rice:1},'rice','beef'],
 ['chicken-pasta','奶油鸡肉意面','staple','boil',{chicken:1,milk:1,mushroom:1,noodle:1},'noodle','chicken'],
 ['cheese-rice','芝士焗饭','staple','bake',{rice:1,cheese:1,corn:1,tomato:1},'gratin','corn'],
 ['vegetable-dumpling','蔬菜小饺子','staple','steam',{flour:1,greens:1,mushroom:1},'dumpling','greens'],
 ['tomato-egg','番茄炒蛋','home','fry',{tomato:1,egg:1},'stirfry','tomato'],
 ['mushroom-chicken','菌菇滑鸡','home','fry',{mushroom:1,chicken:1},'stirfry','chicken'],
 ['pepper-beef','彩蔬牛肉','home','fry',{beef:1,carrot:1,greens:1},'stirfry','beef'],
 ['crispy-tofu','香煎豆腐','home','fry',{tofu:1,greens:1},'tofu','greens'],
 ['lemon-fish','柠檬煎鱼','home','fry',{fish:1,lemon:1,butter:1},'fish','lemon'],
 ['butter-corn','黄油玉米土豆','home','fry',{corn:1,potato:1,butter:1},'stirfry','corn'],
 ['tomato-soup','番茄豆腐汤','soup','boil',{tomato:1,tofu:1},'soup','tomato'],
 ['pumpkin-soup','奶油南瓜汤','soup','boil',{pumpkin:1,milk:1},'soup','pumpkin'],
 ['chicken-soup','玉米鸡汤','soup','boil',{chicken:1,corn:1,carrot:1},'soup','corn'],
 ['mushroom-hotpot','菌菇双人小火锅','soup','boil',{mushroom:1,tofu:1,greens:1,beef:1},'hotpot','mushroom'],
 ['egg-toast','太阳蛋吐司','breakfast','fry',{egg:1,bread:1,butter:1},'toast','egg'],
 ['cheese-sandwich','芝士蔬菜三明治','breakfast','mix',{bread:1,cheese:1,tomato:1,greens:1},'sandwich','greens'],
 ['berry-pancake','草莓松饼','breakfast','fry',{flour:1,egg:1,milk:1,berry:1},'pancake','berry'],
 ['pumpkin-bun','南瓜小馒头','breakfast','steam',{pumpkin:1,flour:1,milk:1},'bun','pumpkin'],
 ['corn-porridge','玉米蔬菜粥','breakfast','boil',{rice:1,corn:1,greens:1},'porridge','corn'],
 ['berry-cake','草莓小蛋糕','bakery','bake',{flour:1,egg:1,milk:1,berry:1},'cake','berry'],
 ['apple-pie','苹果酥派','bakery','bake',{flour:1,butter:1,apple:1},'pie','apple'],
 ['butter-cookie','黄油曲奇','bakery','bake',{flour:1,butter:1,egg:1},'cookie','butter'],
 ['milk-pudding','草莓奶布丁','bakery','steam',{milk:1,egg:1,berry:1},'pudding','berry'],
 ['fruit-salad','缤纷水果碗','fresh','mix',{berry:1,apple:1,lemon:1},'salad','berry'],
 ['chicken-salad','鸡肉田园沙拉','fresh','mix',{chicken:1,greens:1,tomato:1,corn:1},'salad','greens'],
 ['lemon-tea','双杯柠檬茶','fresh','brew',{lemon:1,tea:1},'drink','lemon'],
 ['berry-milk','草莓牛奶','fresh','brew',{berry:1,milk:1},'drink','berry'],
 ['apple-tea','暖苹果茶','fresh','brew',{apple:1,tea:1},'drink','apple']
 ];
 const RECIPES=rows.map(([id,name,category,method,need,food,topping])=>({id,name,category,method,need,food,topping,steps:METHODS[method].steps,note:METHODS[method].steps.join('，')+'。'}));
 const recipe=id=>RECIPES.find(r=>r.id===id),validIds=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(id=>recipe(id)))];
 const TASTE={spice:{none:'不辣',mild:'微辣',hot:'香辣'},salt:{light:'清淡',regular:'适中',rich:'浓味'},sweet:{light:'少甜',regular:'适中',rich:'甜一些'}};
 const LEADS={auto:'自动参考厨艺',ta:'TA掌勺，我备菜',me:'我掌勺，TA备菜'};
 const SWAPS=[['chicken','beef','shrimp','tofu'],['greens','mushroom','carrot','corn']];
 const preference=(raw={})=>{raw=raw&&typeof raw==='object'?raw:{};return ({mode:raw.mode==='auto'?'auto':'hands',lead:Object.hasOwn(LEADS,raw.lead)?raw.lead:'auto',...Object.fromEntries(Object.keys(TASTE).map(k=>[k,Object.hasOwn(TASTE[k],raw[k])?raw[k]:'auto']))});};
 function inferredTaste(persona=''){
  const p=String(persona),out={spice:'none',salt:'regular',sweet:'regular',lead:'ta'};
  if(/(?:不吃|不喜欢|不能吃|忌|讨厌).{0,4}辣/.test(p))out.spice='none';else if(/(?:喜欢|爱吃|嗜|偏好).{0,5}辣/.test(p))out.spice='hot';
  if(/(?:清淡|少盐|低盐)/.test(p))out.salt='light';else if(/(?:喜欢|偏好|爱吃).{0,4}(?:浓味|重口)/.test(p))out.salt='rich';
  if(/(?:少糖|低糖|不爱甜|不喜欢甜|不吃甜)/.test(p))out.sweet='light';else if(/(?:喜欢|爱吃|嗜).{0,4}(?:甜食|甜点|甜口)/.test(p))out.sweet='rich';
  if(/(?:不会做饭|厨艺差|厨房小白|不擅长.{0,3}(?:做饭|烹饪))/.test(p))out.lead='me';return out;
 }
 function resolvePreferences(raw,persona=''){const q=preference(raw),a=inferredTaste(persona);return {...q,...Object.fromEntries(['lead',...Object.keys(TASTE)].map(k=>[k,q[k]==='auto'?a[k]:q[k]]))};}
 function alternatives(id){const r=recipe(id);return r?Object.keys(r.need).map(key=>({id:key,values:(SWAPS.find(g=>g.includes(key))||[key]).filter(v=>v===key||!Object.hasOwn(r.need,v))})).filter(x=>x.values.length>1):[];}
 function variation(id,raw={}){
  raw=raw&&typeof raw==='object'?raw:{};const r=recipe(id),swaps={};if(!r)return {swaps:{},spice:'none',salt:'regular',sweet:'regular',garnish:true};
  for(const row of alternatives(id)){const v=raw.swaps?.[row.id];if(row.values.includes(v)&&v!==row.id)swaps[row.id]=v;}
  const existing=new Set(Object.keys(r.need).map(k=>swaps[k]||k)),addins=Object.fromEntries(Object.entries(raw.addins||{}).filter(([k,n])=>Object.hasOwn(INGREDIENTS,k)&&!existing.has(k)&&Number(n)>0).slice(0,3).map(([k,n])=>[k,Math.min(2,Math.floor(Number(n))||1)]));
  return {swaps,addins,...(typeof raw.name==='string'&&raw.name.trim()?{name:raw.name.trim().slice(0,40)}:{}),...Object.fromEntries(Object.keys(TASTE).map(k=>[k,Object.hasOwn(TASTE[k],raw[k])?raw[k]:(k==='spice'?'none':'regular')])),garnish:raw.garnish!==false};
 }
 function recipeInfo(id,raw){const r=recipe(id);if(!r)return null;const v=variation(id,raw),need={};for(const [k,n]of Object.entries(r.need)){const key=v.swaps[k]||k;need[key]=(need[key]||0)+n;}for(const [k,n]of Object.entries(v.addins))need[k]=(need[k]||0)+n;return {...r,need,topping:v.swaps[r.topping]||r.topping,variation:v};}
 function tasteDescription(raw){const v=variation('tomato-rice',raw);return [TASTE.spice[v.spice],TASTE.salt[v.salt],TASTE.sweet[v.sweet]].join(' · ');}
 function dishName(d){const r=recipe(d?.recipeId);if(!r)return '';const v=variation(r.id,d.variation),changed=Object.entries(v.swaps).map(([a,b])=>INGREDIENTS[a]+'换'+INGREDIENTS[b]);const added=Object.keys(v.addins).map(k=>INGREDIENTS[k]);return (v.name||r.name)+(changed.length||added.length?'（'+[...changed,...(added.length?['加'+added.join('、')]:[])].join('、')+'）':'');}
 // Tabletop coordinates also supply the existing kitchen rig and furniture.
 const KITCHEN_ANCHORS={prep:{x:-1.05,z:.22,y:.995,contactZ:.30,contactY:1.04,handZ:.44,handY:1.19},cook:{x:1.08,z:.22,y:1.09,r:.13,gripY:1.30,contactY:1.16}};
 const TABLE_ZONES={basket:{x:-1.82,z:.16,w:.58,d:.40,y:1.06},board:{x:KITCHEN_ANCHORS.prep.x,z:KITCHEN_ANCHORS.prep.z,w:.64,d:.34,y:1.04},pan:{x:KITCHEN_ANCHORS.cook.x,z:KITCHEN_ANCHORS.cook.z,r:.25,y:1.16},plate:{x:-.08,z:.18,r:.27,y:1.05},tray:{x:-.08,z:-.22,w:.68,d:.26,y:1.05},sauce:{x:.43,z:.12,r:.07,y:1.10}};
 const FOOD_COLORS={tomato:'#d87955',egg:'#f2dcaf',noodle:'#dec995',mushroom:'#ab9174',rice:'#f1e4c9',potato:'#b69b70',carrot:'#dda16a',greens:'#809e68',tofu:'#eadfc6',chicken:'#d7a9a0',beef:'#aa766b',shrimp:'#e5a58a',fish:'#d7ac9a',flour:'#eee1c5',milk:'#f3e7d2',butter:'#dfc485',cheese:'#dfc377',bread:'#c59e76',corn:'#e6c776',pumpkin:'#dba16e',berry:'#cc737b',apple:'#bfa578',lemon:'#e2d18b',tea:'#809069'};
 const finite=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d,clamp=(x,a,b)=>Math.max(a,Math.min(b,finite(x))),copyTable=t=>JSON.parse(JSON.stringify(t));
 function tableState(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.items))return null;
  const ids=new Set(),items=raw.items.slice(0,64).filter(p=>p&&typeof p.id==='string'&&p.id.length<=90&&!ids.has(p.id)&&Object.hasOwn(INGREDIENTS,p.ingredient)&&ids.add(p.id)).map(p=>({id:p.id,source:String(p.source||p.id).slice(0,40),ingredient:p.ingredient,zone:['basket','board','pan','plate'].includes(p.zone)?p.zone:'basket',x:clamp(p.x,-2.2,2.2),z:clamp(p.z,-.35,.48),w:clamp(p.w,.025,.3),d:clamp(p.d,.025,.3),h:clamp(p.h,.015,.23),cut:!!p.cut,knead:clamp(p.knead,0,1),side:p.side===1?1:0,top:clamp(p.top,0,1),bottom:clamp(p.bottom,0,1),mix:clamp(p.mix,0,4),added:Math.max(0,finite(p.added)),toss:Math.max(0,finite(p.toss))}));
  return {version:1,items,sealed:!!raw.sealed,order:(Array.isArray(raw.order)?raw.order:[]).filter(id=>Object.hasOwn(INGREDIENTS,id)).slice(0,64),sauce:(Array.isArray(raw.sauce)?raw.sauce:[]).slice(0,64).map(q=>({x:clamp(q.x,-.34,.19),z:clamp(q.z,-.09,.45)})),auto:Math.max(0,finite(raw.auto)),autoPhase:Math.max(0,Math.floor(finite(raw.autoPhase)))};
 }
 function tableCreate(id,raw){const r=recipeInfo(id,raw);if(!r)return null;let n=0;return tableState({version:1,items:Object.entries(r.need).flatMap(([ingredient,amount])=>Array.from({length:amount},()=>{const index=n++,q=TABLE_ZONES.basket;return {id:'food-'+index,source:'food-'+index,ingredient,zone:'basket',x:q.x+(index%2-.5)*.23,z:q.z+(Math.floor(index/2)%2-.5)*.20,w:.22,d:.18,h:.14,top:r.method==='mix'?1:0,bottom:r.method==='mix'?1:0};})),order:[],sauce:[]});}
 function tableReady(item,method){return method==='mix'?item.mix>=1.25:method==='fry'?Math.min(item.top,item.bottom)>=.65:(item.top+item.bottom)/2>=.78;}
 function inTableZone(point,id){const q=TABLE_ZONES[id];return q.r?Math.hypot(point.x-q.x,point.z-q.z)<=q.r+.035:Math.abs(point.x-q.x)<=q.w/2+.03&&Math.abs(point.z-q.z)<=q.d/2+.03;}
 function tablePhase(t,method){if(t.sealed&&t.items.length)return 3;if(t.items.some(p=>['basket','board'].includes(p.zone)))return 0;return t.items.some(p=>p.zone==='pan'&&!tableReady(p,method))?1:2;}
 function tableHint(t,method){const i=tablePhase(t,method);return i===3?'这一盘摆好了':i===0?'点道具放大操作，把食材放上砧板后划切、分批下锅':i===1?method==='mix'?'拿起小勺，在碗里绕圈拌匀':method==='fry'?'拖锅柄向上翻面，转炉灶旋钮调火':/boil|bake|steam|brew/.test(method)?'慢慢等它熟，也可以先去忙别的':'拿起小勺，在锅里绕圈翻动，转炉灶旋钮调火':t.items.every(p=>p.zone==='plate')?'摆好位置，拖酱瓶淋酱，再把盘子拖到托盘':'把熟好的食材拖到盘子里';}
 function tableEvent(raw,event,method,elapsed=0){
  const t=copyTable(raw);if(t.sealed)return t;
  if(event.kind==='drop'){const p=t.items.find(p=>p.id===event.id),q=event.point;if(!p||!q||!Number.isFinite(q.x)||!Number.isFinite(q.z))return t;const zone=['plate','pan','board','basket'].find(z=>inTableZone(q,z));if(!zone||zone==='plate'&&(p.zone!=='plate'&&!tableReady(p,method)))return t;
   if(p.zone==='pan'&&zone==='board')return t;if(zone==='pan'&&p.zone!=='pan'){p.added=elapsed;t.order.push(p.ingredient);}if(p.ingredient==='flour'&&zone==='board'&&p.zone==='board')p.knead=Math.min(1,p.knead+Math.hypot(p.x-q.x,p.z-q.z)*3);const bounds=TABLE_ZONES[zone];let x=q.x,z=q.z;if(bounds.r){const r=Math.max(.025,bounds.r-Math.hypot(p.w,p.d)/2),d=Math.hypot(x-bounds.x,z-bounds.z);if(d>r){x=bounds.x+(x-bounds.x)*r/d;z=bounds.z+(z-bounds.z)*r/d;}}else{x=clamp(x,bounds.x-bounds.w/2+p.w/2,bounds.x+bounds.w/2-p.w/2);z=clamp(z,bounds.z-bounds.d/2+p.d/2,bounds.z+bounds.d/2-p.d/2);}Object.assign(p,{zone,x,z});return t;
  }
  if(event.kind==='slice'){
   const a=event.from,b=event.to;if(!a||!b||t.items.length>=64||![a.x,a.z,b.x,b.z].every(Number.isFinite))return t;
   const axis=Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?'z':'x',cross=axis==='x'?'z':'x';if(Math.abs(b[cross]-a[cross])<.13)return t;
   const hit=t.items.find(p=>(!event.id||p.id===event.id)&&p.zone==='board'&&!['milk','tea','rice','noodle','flour','butter','egg'].includes(p.ingredient)&&Math.min(a[cross],b[cross])<p[cross]-(cross==='x'?p.w:p.d)/2&&Math.max(a[cross],b[cross])>p[cross]+(cross==='x'?p.w:p.d)/2&&Math.abs((a[axis]+b[axis])/2-p[axis])<(axis==='x'?p.w:p.d)/2-.027);
   if(!hit)return t;const size=axis==='x'?'w':'d',length=hit[size],offset=(a[axis]+b[axis])/2-hit[axis],left=length/2+offset,right=length-left;if(Math.min(left,right)<.035)return t;
   const p={...hit,id:hit.id+'a',cut:true,[size]:left,[axis]:hit[axis]-right/2-.012},q={...hit,id:hit.id+'b',cut:true,[size]:right,[axis]:hit[axis]+left/2+.012};t.items.splice(t.items.indexOf(hit),1,p,q);return t;
  }
  if(event.kind==='stir'){
   const path=(event.path||[]).filter(q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.z)&&inTableZone(q,'pan')).slice(0,80);let distance=0;for(let i=1;i<path.length;i++)distance+=Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z);if(distance<.02)return t;const q=TABLE_ZONES.pan,turn=distance*4;
   for(const p of t.items.filter(p=>p.zone==='pan')){const x=p.x-q.x,z=p.z-q.z;p.x=q.x+x*Math.cos(turn)-z*Math.sin(turn);p.z=q.z+x*Math.sin(turn)+z*Math.cos(turn);p.mix=Math.min(4,p.mix+distance*2);}return t;
  }
  if(event.kind==='flip'){for(const p of t.items.filter(p=>p.zone==='pan')){p.side=1-p.side;p.toss=elapsed;}return t;}
  if(event.kind==='sauce'){for(const q of (event.path||[]).filter((_,i,a)=>i%Math.max(1,Math.ceil(a.length/64))===0||i===a.length-1).slice(-64))if(q&&inTableZone(q,'plate'))t.sauce.push({x:q.x,z:q.z});t.sauce=t.sauce.slice(-64);return t;}
  if(event.kind==='serve-plate'&&t.items.length&&t.items.every(p=>p.zone==='plate')&&inTableZone(event.point||{},'tray'))t.sealed=true;
  return t;
 }
 function tableTick(job,p,event){
  const dt=clamp(event.dt,0,.1),method=recipe(job.recipeId)?.method,t=copyTable(p.table),active=event.active!==false,held=event.held||'';t.auto+=dt;
  const prepAuto=active&&!event.prepPaused&&(job.cooking.mode==='auto'||job.cooking.lead==='me'),chefAuto=active&&!event.chefPaused&&(job.cooking.mode==='auto'||job.cooking.lead==='ta');
  if(prepAuto&&t.auto>=.65){t.auto=0;const item=t.items.find(q=>q.zone==='basket'&&q.id!==held)||t.items.find(q=>q.zone==='board'&&q.id!==held);if(item){if(item.zone==='basket')Object.assign(item,{zone:'board',x:TABLE_ZONES.board.x,z:TABLE_ZONES.board.z});else if(!item.cut&&!['milk','tea','rice','noodle','flour','butter','egg'].includes(item.ingredient)){const a={x:item.x-.3,z:item.z},b={x:item.x+.3,z:item.z};return {...p,table:tableEvent(t,{kind:'slice',id:item.id,from:a,to:b},method,p.elapsed),rev:p.rev+1};}else{Object.assign(item,{zone:'pan',x:TABLE_ZONES.pan.x+(t.items.indexOf(item)%3-1)*.09,z:TABLE_ZONES.pan.z+(t.items.indexOf(item)%2-.5)*.09,added:p.elapsed});t.order.push(item.ingredient);}p.rev++;}}
  for(const item of t.items.filter(q=>q.zone==='pan'&&q.id!==held)){
   if(chefAuto){item.mix=Math.min(4,item.mix+dt*.9);if(method==='fry'&&item.bottom>=.7&&!item.side){item.side=1;item.toss=p.elapsed;p.rev++;}}
   if(method!=='mix'){const rate=[.025,.145,.23][p.heat]*(method==='bake'?.75:1),side=item.side?'top':'bottom';item[side]=Math.min(1,item[side]+dt*rate);if(method!=='fry')item[item.side?'bottom':'top']=Math.min(1,item[item.side?'bottom':'top']+dt*rate*(.65+Math.min(1,item.mix)*.35));}
   if(chefAuto&&tableReady(item,method)){const n=t.items.indexOf(item),a=n*2.4,r=.035+Math.min(.18,n*.012);Object.assign(item,{zone:'plate',x:TABLE_ZONES.plate.x+Math.cos(a)*r,z:TABLE_ZONES.plate.z+Math.sin(a)*r});p.rev++;}
  }
  if(job.cooking.mode==='auto'&&chefAuto&&t.items.length&&t.items.every(q=>q.zone==='plate')){t.sealed=true;p.rev++;}
  return {...p,table:t};
 }
 function tabletopDish(raw){const t=tableState(raw);return t?{...t,items:t.items.filter(p=>p.zone==='plate'),sealed:true}:null;}
 function cookingProgress(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {index:Math.max(0,Math.min(3,Math.floor(Number(raw.index)||0))),work:Math.max(0,Math.min(12,Number(raw.work)||0)),wait:Math.max(0,Math.min(120,Number(raw.wait)||0)),elapsed:Math.max(0,Math.min(600,Number(raw.elapsed)||0)),heat:Math.max(0,Math.min(2,Math.round(Number(raw.heat??1)))),exposure:Math.max(0,Math.min(200,Number(raw.exposure)||0)),rev:Math.max(0,Math.floor(Number(raw.rev)||0)),...(tableState(raw.table)?{table:tableState(raw.table)}:{}),...(Array.isArray(raw.moments)?{moments:raw.moments.filter(x=>x&&typeof x.id==='string'&&typeof x.kind==='string').slice(-40)}:{}),...(raw.flour!=null?{flour:!!raw.flour}:{})};}
 function cookingSession(id,choices={},persona=''){
  const q=resolvePreferences(choices,persona);const v=variation(id,{...choices,...q,swaps:choices.swaps});const r=recipe(id),tabletop=['stir','fry','mix'].includes(r?.method)&&!['toast','pancake','sandwich'].includes(r.food);return {version:tabletop?2:1,mode:q.mode,lead:q.lead,variation:v,progress:{...cookingProgress(),...(tabletop?{table:tableCreate(id,v)}:{})}};
 }
 function cookingSpec(job,raw=job?.cooking?.progress){
  const p=cookingProgress(raw),r=recipe(job?.recipeId),method=r?.method||'stir';
  if(p.table){const index=tablePhase(p.table,method),passive=['bake','steam','boil','brew'].includes(method)&&p.table.items.some(q=>q.zone==='pan'&&!tableReady(q,method));return {index,method,passive,operation:index===0?'prepare':index===1?'stir':'plate',label:tableHint(p.table,method),target:index===0?'board':index===1?'pan':'plate',required:0,seconds:0,who:index===0?(job.cooking.lead==='ta'?'me':'ta'):job.cooking.lead,ready:index===3,tabletop:true,progress:p};}
  const passive=['bake','steam','boil','brew'].includes(method);
  const prep=['bake','steam'].includes(method)?'knead':method==='brew'?'add':'chop';
  const operation=p.index===0?prep:p.index===1?(passive?'wait':method==='fry'?'flip':method==='mix'?'mix':'stir'):p.index===2?'plate':'done';
  const names={chop:'切好配菜',knead:'揉匀面团',add:'放入茶与水果',wait:METHODS[method]?.steps[1],flip:'翻面煎香',mix:'拌匀食材',stir:'翻炒拌匀',plate:'盛出两人份',done:'做好了'};
  const lead=job?.cooking?.lead||'ta',who=p.index===0?(lead==='ta'?'me':'ta'):lead;
  return {index:p.index,method,passive:p.index===1&&passive,operation,label:names[operation],target:p.index===0?'prep':p.index===2?'serve':'pan',required:p.index===0?6:p.index===1?(passive?0:6):p.index===2?1:0,seconds:p.index===1?(passive?method==='bake'?14:method==='steam'?12:method==='boil'?10:7:4):0,who,ready:p.index===3,progress:p};
 }
 function cookingStations(job,raw=job?.cooking?.progress){
  if(!job?.cooking)return [];const q=cookingSpec(job,raw),table=q.tabletop;
  const panName=({mix:'拌碗',bake:'烤箱',steam:'蒸锅',boil:'汤锅',brew:'茶壶'})[q.method]||'炒锅';
  return table?[{id:'basket',label:'食材篮',hint:'把食材拖到旁边砧板'},{id:'board',label:'砧板',hint:'手指划过切菜；面团来回揉'},{id:'pan',label:panName,hint:q.method==='mix'?'绕圈拌匀；熟块拖到旁边盘子':'绕圈翻炒，上拉锅柄翻面；熟块拖到旁边盘子'},{id:'heat',label:'炉灶旋钮',hint:'上下拖动调火',disabled:q.method==='mix'},{id:'sauce',label:'酱瓶',hint:'在盘子上划过淋酱'},{id:'plate',label:'摆盘',hint:'拖动菜块摆位置；整盘拖到旁边托盘'}]:[
   {id:'prep',label:['bake','steam'].includes(q.method)?'揉面与擀面杖':q.method==='brew'?'加料碗':'备菜道具',hint:q.method==='brew'?'把茶与水果拖到碗里':q.operation==='knead'?'在面团上来回揉、推擀面杖':'手指划过食材切开',disabled:q.index!==0},
   {id:'pan',label:panName,hint:q.passive?'等它慢慢熟，旋钮可以调火':q.operation==='flip'?'向上拖锅柄翻面':'手指绕圈拌匀',disabled:q.index!==1},
   {id:'heat',label:'炉灶旋钮',hint:'上下拖动调火',disabled:q.index!==1||q.method==='mix'},
   {id:'plate',label:'盛盘',hint:'把这盘拖到旁边托盘',disabled:q.index!==2}];
 }
 function stationInfo(job,id,raw){return cookingStations(job,raw).find(q=>q.id===id)||{id,label:'厨房操作',hint:''};}
 function primaryStation(job,raw){const q=cookingSpec(job,raw);return q.tabletop?q.target:q.index===0?'prep':q.index===1?'pan':'plate';}
 const COOP={pass:{label:'递食材',seconds:4},bowl:{label:'接过小碗',seconds:4},steady:{label:'帮忙扶锅',seconds:5},guide:{label:'一起揉面',seconds:6},stir:{label:'贴近一起搅拌',seconds:6},wipe:{label:'擦掉脸上的面粉',seconds:4},taste:{label:'让TA尝一口',seconds:5},'taste-me':{label:'我也尝一口',seconds:5}};
 function cooperation(job,raw=job?.cooking?.progress){
  if(!job?.cooking||job.kind!=='cook')return [];const q=cookingSpec(job,raw),p=q.progress,t=p.table,method=q.method,need=recipeInfo(job.recipeId,job.cooking.variation).need;
  const edible=t?t.items.some(x=>['pan','plate'].includes(x.zone)&&tableReady(x,method)):q.index>=2;
  return Object.entries(COOP).map(([id,c])=>({...c,id,disabled:id==='pass'?(t?!t.items.some(x=>x.zone==='basket'):q.index!==0):id==='bowl'?false:id==='steady'?!['fry','stir'].includes(method)||(t?!t.items.some(x=>x.zone==='pan'):q.index!==1):id==='guide'?!need.flour||q.index!==0||!!t&&!t.items.some(x=>x.ingredient==='flour'&&x.zone==='board'):id==='stir'?!['mix','stir'].includes(method)||(t?!t.items.some(x=>x.zone==='pan'):q.index!==1):id==='wipe'?!p.flour:!edible,reason:id.startsWith('taste')&&!edible?'熟好一部分后再尝':id==='wipe'&&!p.flour?'揉面后再帮忙擦':id==='guide'?'备面时一起揉':id==='pass'?'备菜时递食材':'等到对应这一步'}));
 }
 function recordMoment(job,p,event){
  const kind=event.kind==='moment'?event.value:event.kind,id=String(event.id||('step-'+p.rev));if((p.moments||[]).some(q=>q.id===id))return p;
  const labels={slice:'划切食材',drop:'移动食材',flip:'翻锅',stir:'绕圈搅拌',sauce:'淋酱',heat:'调整火候',add:'临时加料',season:'调整口味',...Object.fromEntries(Object.entries(COOP).map(([k,c])=>[k,c.label]))};
  const row={id,kind,label:labels[kind]||'一起做饭',by:event.by||({'pass':job.cooking.lead,'bowl':job.cooking.lead,steady:job.cooking.lead==='ta'?'me':'ta',guide:'both',stir:'both',wipe:'ta',taste:'ta','taste-me':'me'}[kind]||'me'),...(event.kind==='moment'?{initiatedBy:'me'}:{}),elapsed:p.elapsed,stage:cookingSpec(job,p).label,...(event.ingredient?{ingredient:event.ingredient}:{}),...(kind?.startsWith('taste')?{taste:tasteDescription(job.cooking.variation),ingredients:Object.keys(recipeInfo(job.recipeId,job.cooking.variation).need),who:kind==='taste-me'?'me':'ta'}:{})};
  const moments=[...(p.moments||[]),row];while(moments.length>40){const plain=moments.findIndex(x=>!Object.hasOwn(COOP,x.kind));moments.splice(plain<0?0:plain,1);}return {...p,moments};
 }
 function menuBatch(raw){
  const menus=Array.isArray(raw)?raw:raw?.menus;if(!Array.isArray(menus))throw Error('这批菜单没有读完整，请重试。');
  return menus.slice(0,6).map((m,i)=>{const dishes=(Array.isArray(m.dishes)?m.dishes:[]).filter(d=>d&&recipe(d.recipeId)).slice(0,3);if(!dishes.length)throw Error('菜单里没有可用的做法，请重新生成。');const used=new Set();return {id:String(m.id||'menu-'+i).slice(0,80),name:String(m.name||'想做的这一桌').trim().slice(0,40),note:String(m.note||'').trim().slice(0,600),dishes:dishes.filter(d=>!used.has(d.recipeId)&&used.add(d.recipeId)).map(d=>({recipeId:d.recipeId,variation:variation(d.recipeId,d.variation),lead:['ta','me'].includes(d.lead)?d.lead:'auto',note:String(d.note||'').slice(0,400)}))};});
 }
 function menuChoices(raw){const s=kitchen(raw);return s.menu.map(recipeId=>({recipeId,variation:variation(recipeId,s.menuVariations?.[recipeId]),lead:s.menuLeads?.[recipeId]||s.preferences.lead}));}
 function stepCooking(job,raw,event={}){
  const before=cookingProgress(raw);let p={...before};const spec=cookingSpec(job,p);if(event.kind==='moment'){if(!cooperation(job,p).some(q=>q.id===event.value&&!q.disabled)||(p.moments||[]).some(q=>q.id===event.id))return p;p.rev++;if(event.value==='guide')p.flour=true;if(event.value==='wipe')p.flour=false;if(event.value==='pass'&&p.table){const item=p.table.items.find(q=>q.zone==='basket');if(item)p.table=tableEvent(p.table,{kind:'drop',id:item.id,point:TABLE_ZONES.board},spec.method,p.elapsed);}if(event.value==='guide'){if(p.table){const flour=p.table.items.find(q=>q.ingredient==='flour');if(flour){flour.zone='board';flour.x=TABLE_ZONES.board.x;flour.z=TABLE_ZONES.board.z;flour.knead=1;}}else p.work=Math.min(spec.required,p.work+3);}if(event.value==='stir'){if(p.table){const z=TABLE_ZONES.pan,path=Array.from({length:32},(_,i)=>({x:z.x+Math.cos(i/31*Math.PI*2)*.12,z:z.z+Math.sin(i/31*Math.PI*2)*.12}));p.table=tableEvent(p.table,{kind:'stir',path},spec.method,p.elapsed);}else p.work=Math.min(spec.required,p.work+3);}return recordMoment(job,p,event);}if(spec.ready)return p;
  if(p.table){if(event.kind==='heat')p.heat=Math.round(clamp(event.value,0,2));else if(event.kind==='tick'){p.elapsed+=clamp(event.dt,0,.1);p.exposure+=clamp(event.dt,0,.1)*p.heat;p=tableTick(job,p,event);}else if(['drop','slice','stir','flip','sauce','serve-plate'].includes(event.kind)){const next=tableEvent(p.table,event,spec.method,p.elapsed);if(JSON.stringify(next)===JSON.stringify(p.table))return p;p.table=next;}else return p;
   p.index=tablePhase(p.table,spec.method);if(event.kind!=='tick'||Math.floor(p.elapsed/2)>Math.floor(before.elapsed/2))p.rev++;if(event.kind!=='tick')p=recordMoment(job,p,event);if(p.table.items.some(q=>q.ingredient==='flour'&&q.knead>0))p.flour=true;return p;}
  if(event.kind==='heat'){p.heat=Math.max(0,Math.min(2,Math.round(Number(event.value)||0)));p.rev++;return p;}
  if(event.kind==='work'&&event.operation===spec.operation){p.work=Math.min(spec.required,p.work+Math.max(0,Math.min(1,Number(event.amount)||1)));if(spec.operation==='knead')p.flour=true;p.rev++;}
  if(event.kind==='tick'){
   const dt=Math.max(0,Math.min(.1,Number(event.dt)||0));p.elapsed+=dt;
   if(!event.operationPaused&&(job.cooking?.mode==='auto'||spec.who==='ta'))p.work=Math.min(spec.required,p.work+dt*2.1);
   if(spec.index===1){const rate=spec.method==='mix'?1:[.65,1,1.35][p.heat];p.wait+=dt*rate;if(spec.method!=='mix')p.exposure+=dt*p.heat;}
   if(Math.floor(p.elapsed/2)>Math.floor(before.elapsed/2))p.rev++;
  }
  if(p.work>=spec.required&&p.wait>=spec.seconds){p.index++;p.work=p.wait=0;p.rev++;}
  return p;
 }
 function mealFeedback(dish,prefs,persona=''){
  const actual=variation(dish.recipeId,dish.variation),q=resolvePreferences(prefs,persona),axes=Object.keys(TASTE).filter(k=>preference(prefs)[k]!=='auto'||(k==='spice'?/辣/:k==='salt'?/清淡|盐|重口|浓味/:/甜|糖/).test(String(persona)));
  const matching=axes.filter(k=>actual[k]===q[k]);return {taste:tasteDescription(actual),matching,known:axes.length>0,text:axes.length?(matching.length===axes.length?'这份口味符合厨房里记住的偏好。':'这份和厨房里记住的口味偏好有些不同。'):'TA的口味还没有明确记录，可以一起尝尝，再记住喜欢的做法。'};
 }

 const count=n=>Math.max(0,Math.min(99,Math.floor(Number(n)||0)));
 function kitchen(raw={}){raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return {...raw,version:3,preferences:preference(raw.preferences),customRecipes:(Array.isArray(raw.customRecipes)?raw.customRecipes:[]).filter(x=>x&&typeof x.id==='string'&&recipe(x.recipeId)).slice(-60),history:(Array.isArray(raw.history)?raw.history:[]).filter(x=>x&&Array.isArray(x.courses)).map(x=>({...x,courses:x.courses.filter(d=>d&&recipe(d.recipeId))})).slice(-30),
  ingredients:Object.fromEntries(Object.keys(INGREDIENTS).map(id=>[id,count(raw.ingredients?.[id])])),
  dishes:(Array.isArray(raw.dishes)?raw.dishes:[]).filter(d=>d&&typeof d.id==='string'&&recipe(d.recipeId)&&Number.isFinite(d.at)).map(d=>({...d,servings:Math.max(1,Math.min(2,Math.floor(d.servings)||2))})),
  menu:validIds(raw.menu).slice(0,3),menuVariations:Object.fromEntries(validIds(raw.menu).map(id=>[id,variation(id,raw.menuVariations?.[id])])),menuLeads:raw.menuLeads||{},menuName:String(raw.menuName||'').slice(0,40),menuSuggestions:Array.isArray(raw.menuSuggestions)?raw.menuSuggestions:[],cookingHistory:(Array.isArray(raw.cookingHistory)?raw.cookingHistory:[]).slice(-60),favorites:validIds(raw.favorites),made:Object.fromEntries(RECIPES.map(r=>[r.id,count(raw.made?.[r.id])])),
  pending:raw.pending&&typeof raw.pending.id==='string'&&['cook','meal'].includes(raw.pending.kind)?{...raw.pending}:null};}
 function shopping(raw,ids,variants){const s=kitchen(raw),need={};for(const id of validIds(ids??s.menu))for(const [key,n]of Object.entries(recipeInfo(id,(variants||s.menuVariations||{})[id]).need))need[key]=(need[key]||0)+n;return Object.entries(need).map(([id,n])=>({id,need:n,have:s.ingredients[id],missing:Math.max(0,n-s.ingredients[id])}));}
 function kitchenChange(raw,action){const s=kitchen(raw),p=s.pending;
  if(action.kind==='menu-suggestions'){const menus=menuBatch(action.menus);if(!menus.length)throw Error('这次没有生成菜单。');return {...s,menuSuggestions:menus,menuGeneratedAt:action.at,menuWish:String(action.wish||'')};}
  if(action.kind==='menu-set'){const m=menuBatch([action.menu])[0];return {...s,menu:m.dishes.map(d=>d.recipeId),menuName:m.name,menuVariations:Object.fromEntries(m.dishes.map(d=>[d.recipeId,d.variation])),menuLeads:Object.fromEntries(m.dishes.map(d=>[d.recipeId,d.lead]))};}
  if(action.kind==='menu-name')return {...s,menuName:String(action.name||'').trim().slice(0,40)};
  if(action.kind==='add-in'||action.kind==='season'){
   if(!p?.cooking||p.kind!=='cook'||p.ready)throw Error('这份已经做好，下一份再调整。');let v=variation(p.recipeId,p.cooking.variation),progress=cookingProgress(p.cooking.progress);
   if(action.kind==='add-in'){if(!Object.hasOwn(INGREDIENTS,action.ingredient)||Object.hasOwn(recipeInfo(p.recipeId,v).need,action.ingredient)||Object.keys(v.addins).length>=3)throw Error('再挑一种还没加过的配料，最多加三样。');if(s.ingredients[action.ingredient]<1)throw Error('先到食材篮补这一样。');v=variation(p.recipeId,{...v,addins:{...v.addins,[action.ingredient]:1}});
    if(progress.table){const old=progress.table.items,initial=tableCreate(p.recipeId,v);const additions=initial.items.filter(x=>!old.some(q=>q.source===x.source));progress.table={...progress.table,sealed:false,items:[...old,...additions]};progress.index=0;}
   }else{v=variation(p.recipeId,{...v,...Object.fromEntries(Object.entries(action.patch||{}).filter(([k])=>Object.hasOwn(TASTE,k)))});}
   progress.rev++;progress=recordMoment({...p,cooking:{...p.cooking,variation:v}},progress,{kind:action.kind==='add-in'?'add':'season',ingredient:action.ingredient,id:action.eventId,by:action.by});return {...s,pending:{...p,cooking:{...p.cooking,variation:v,progress}}};
  }
  if(action.kind==='preferences')return {...s,preferences:preference({...s.preferences,...action.patch})};
  if(action.kind==='remember'){const dish=s.dishes.find(d=>d.id===action.dishId)||p?.kind==='cook'&&p.ready&&{recipeId:p.recipeId,variation:p.cooking?.variation};if(!dish)throw Error('先做好这一份，再记下做法。');if(typeof action.id!=='string'||!action.id)throw Error('给做法重新生成编号。');const entry={id:action.id,sourceDishId:action.dishId,lead:dish.lead||'auto',day:dish.day,time:dish.time,loved:action.loved===true,at:action.at||Date.now(),tabletop:dish.tabletop||null,moments:dish.moments||[],recipeId:dish.recipeId,name:String(action.name||dish.variation?.name||recipe(dish.recipeId).name).trim().slice(0,40),variation:variation(dish.recipeId,{...dish.variation,name:action.name||dish.variation?.name||recipe(dish.recipeId).name})};return {...s,customRecipes:[...s.customRecipes.filter(x=>x.id!==entry.id),entry].slice(-60)};}
  if(action.kind==='pack'||action.kind==='unpack'){const dish=s.dishes.find(d=>d.id===action.dishId);if(!dish)throw Error('这份已经吃完了。');if(p?.kind==='meal'&&(p.dishIds||[p.dishId]).includes(dish.id))throw Error('这份已经上桌，先吃完这一桌。');return {...s,dishes:s.dishes.map(d=>d.id===dish.id?{...d,packed:action.kind==='pack',owner:action.kind==='pack'?'ta':undefined}:d)};}
  if(action.kind==='progress'){if(!p||p.id!==action.id||!p.cooking)throw Error('这一份已经收起了。');const progress=cookingProgress(action.progress);if(progress.rev<=cookingProgress(p.cooking.progress).rev)return s;if(p.cooking.version===2){const initial=tableCreate(p.recipeId,p.cooking.variation),t=progress.table;if(!t||!t.items.length)throw Error('食材还没放稳，请回到台面再试。');for(const original of initial.items){const pieces=t.items.filter(q=>q.source===original.source);if(!pieces.length||pieces.some(q=>q.ingredient!==original.ingredient)||Math.abs(pieces.reduce((n,q)=>n+q.w*q.d*q.h,0)-original.w*original.d*original.h)>1e-8)throw Error('这份食材没保存完整，请回到台面再试。');}if(t.items.some(q=>!initial.items.some(o=>o.source===q.source)))throw Error('这份食材没保存完整，请回到台面再试。');t.sealed=t.sealed&&t.items.every(q=>q.zone==='plate'&&tableReady(q,recipe(p.recipeId).method));progress.index=tablePhase(t,recipe(p.recipeId).method);}return {...s,pending:{...p,ready:progress.index===3,cooking:{...p.cooking,mode:action.mode==='auto'?'auto':action.mode==='hands'?'hands':p.cooking.mode,lead:action.lead==='me'?'me':action.lead==='ta'?'ta':p.cooking.lead,progress}}};}
  if(action.kind==='plate'){if(typeof action.mealId!=='string'||!action.mealId)throw Error('这一桌需要重新编号。');const done=kitchenChange(s,{kind:'finish',id:action.id,at:action.at});return kitchenChange(done,{kind:'serve',id:action.mealId,dishId:action.id});}

  if(action.kind==='stock'){if(!Object.hasOwn(INGREDIENTS,action.ingredient))throw Error('先选一种食材。');if(s.ingredients[action.ingredient]>=99)throw Error('这一样已经放满了。');return {...s,ingredients:{...s.ingredients,[action.ingredient]:Math.min(99,s.ingredients[action.ingredient]+3)}};}
  if(action.kind==='shop'){const ids=action.recipeId?[action.recipeId]:s.menu;if(!ids.length||ids.some(id=>!recipe(id)))throw Error('先选今天想做的菜。');const ingredients={...s.ingredients};for(const row of shopping(s,ids,action.variants||(action.variation&&action.recipeId?{[action.recipeId]:action.variation}:undefined)))ingredients[row.id]+=row.missing;return {...s,ingredients};}
  if(action.kind==='favorite'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');return {...s,favorites:s.favorites.includes(action.recipeId)?s.favorites.filter(id=>id!==action.recipeId):[...s.favorites,action.recipeId]};}
  if(action.kind==='menu'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');if(s.menu.includes(action.recipeId)){if(action.replace)return {...s,menuVariations:{...s.menuVariations,[action.recipeId]:variation(action.recipeId,action.variation)},menuLeads:{...s.menuLeads,[action.recipeId]:action.lead||s.preferences.lead}};return {...s,menu:s.menu.filter(id=>id!==action.recipeId)};}if(s.menu.length===3)throw Error('一桌先搭配三道菜，移掉一道再换。');return {...s,menu:[...s.menu,action.recipeId],menuVariations:{...s.menuVariations,[action.recipeId]:variation(action.recipeId,action.variation)},menuLeads:{...s.menuLeads,[action.recipeId]:action.lead||s.preferences.lead}};}
  if(action.kind==='cancel')return {...s,pending:null};
  if(action.kind==='begin'){if(p)throw Error('先做完或收起手头这一份。');if(s.dishes.length>=60)throw Error('餐盒已经放满了，先吃一些再做。');const r=recipe(action.recipeId);if(!r)throw Error('先选一个做法。');const session=action.choices?cookingSession(r.id,{...s.preferences,...action.choices},action.persona):null;const missing=shopping(s,[r.id],session?{[r.id]:session.variation}:{}).filter(row=>row.missing).map(row=>INGREDIENTS[row.id]+' ×'+row.missing);if(missing.length)throw Error('还缺：'+missing.join('、'));if(typeof action.id!=='string'||!action.id||s.dishes.some(d=>d.id===action.id))throw Error('这一份的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'cook',recipeId:r.id,ready:false,...(typeof action.day==='string'&&typeof action.time==='string'?{day:action.day,time:action.time,startedAt:action.at}:{}),...(session?{cooking:session}:{})}};}
  if(action.kind==='serve'){if(p)throw Error('先做完或收起手头这一份。');const ids=[...new Set(action.dishIds||[action.dishId])];if(!ids.length||ids.length>3)throw Error('一桌可以端上一到三道菜。');const courses=ids.map(id=>s.dishes.find(d=>d.id===id));if(courses.some(d=>!d||d.packed))throw Error('这份已经吃完了。');if(typeof action.id!=='string'||!action.id)throw Error('这一桌的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'meal',dishId:ids[0],dishIds:ids,courses:courses.map(d=>({...d})),recipeId:courses[0].recipeId,ready:false}};}
  if(!p||p.id!==action.id)throw Error('这一份已经收起了。');if(action.kind==='ready'){if(p.cooking?.version===2&&!cookingSpec(p).ready)throw Error('先把熟好的菜摆上托盘。');return {...s,pending:{...p,ready:true}};}
  if(action.kind!=='finish'||!p.ready)throw Error('先在现场完成，再收好这一份。');
  if(p.kind==='meal'){const ids=p.dishIds||[p.dishId];if(ids.some(id=>!s.dishes.some(d=>d.id===id)))throw Error('这份已经吃完了。');return {...s,pending:null,dishes:s.dishes.filter(d=>!ids.includes(d.id)),eaten:(Number(s.eaten)||0)+ids.length,tables:(Number(s.tables)||0)+1,history:[...s.history,{id:p.id,at:action.at,courses:(p.courses||[]).map(d=>({...d}))}].slice(-30)};}
  const r=recipeInfo(p.recipeId,p.cooking?.variation);if(!r)throw Error('做法没有找到，食材还在。');if(Object.entries(r.need).some(([id,n])=>s.ingredients[id]<n))throw Error('食材不够，先补齐这一份。');if(!Number.isFinite(action.at))throw Error('先重新收好这一份。');
  return {...s,pending:null,ingredients:Object.fromEntries(Object.entries(s.ingredients).map(([id,n])=>[id,n-(r.need[id]||0)])),cookingHistory:[...s.cookingHistory,{id:p.id,recipeId:r.id,at:action.at,...(p.day?{day:p.day,time:p.time}:{}),variation:p.cooking?.variation,lead:p.cooking?.lead,moments:p.cooking?.progress?.moments||[]}].slice(-60),dishes:[...s.dishes,{id:p.id,recipeId:r.id,at:action.at,...(p.day?{day:p.day,time:p.time}:{}),servings:2,...(p.cooking?{variation:p.cooking.variation,lead:p.cooking.lead,moments:p.cooking.progress?.moments||[],...(p.cooking.progress?.table?{tabletop:tabletopDish(p.cooking.progress.table)}:{}),finish:r.method==='mix'?'拌匀两人份':r.method==='bake'?(p.cooking.progress?.exposure>14?'烤色更深':'松软出炉'):['fry','stir'].includes(r.method)?(p.cooking.progress?.exposure>14?'煎得更香':'保留嫩口'):'慢火完成'}:{})}],made:{...s.made,[r.id]:Math.min(99,s.made[r.id]+1)}};
 }
 function cookingStage(job,elapsed=0){if(job?.kind==='cook'&&job.cooking){const spec=cookingSpec(job,typeof elapsed==='object'?elapsed:job.cooking.progress);return {...spec,duration:spec.seconds,phase:spec.ready?'ready':['preparing','stirring','serving'][spec.index]};}const r=recipe(job?.recipeId),m=METHODS[r?.method]||METHODS.stir,duration=job?.kind==='meal'?6+Math.max(0,(job.dishIds?.length||1)-1)*2:m.seconds;
  const index=elapsed<duration*.28?0:elapsed<duration*.78?1:2,phase=job?.kind==='meal'?'eating':['preparing','stirring','serving'][index];return {duration,index,phase,label:job?.kind==='meal'?'一起尝这桌菜':m.steps[index],method:r?.method||'stir'};}
 root.CharDayKitchen={COOP,cooperation,menuBatch,menuChoices,recordMoment,cookingStations,stationInfo,primaryStation,KITCHEN_ANCHORS,TABLE_ZONES,FOOD_COLORS,tableState,tableCreate,tableReady,inTableZone,tablePhase,tableHint,tableEvent,tabletopDish,TASTE,LEADS,preference,inferredTaste,resolvePreferences,alternatives,variation,recipeInfo,tasteDescription,dishName,cookingProgress,cookingSession,cookingSpec,stepCooking,mealFeedback,INGREDIENTS,CATEGORIES,METHODS,RECIPES,recipe,kitchen,kitchenChange,shopping,cookingStage};
})(globalThis);
