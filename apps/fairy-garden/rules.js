// Shared by the phone host, game simulation and renderer. Model output names existing activities.
(function(root){
 const START={x:-4.6,z:4.2},TREES=[[-3.9,-1.5],[-3,-3.6],[-3.3,-5.4],[3.7,-4.5],[3.8,-2.2],[4.15,.8],[-4.2,1.2]];
 // ── 星井（她 2026-09-16 点名要的「井底下潜」）─────────────────────────────
 // 井底是一层一层的：每层三处矿脉，位置由层数定死（同一层每次下去都在原地），
 // 采没采过仍然走已有的 picked 那套，不另造一份「这层采过了」。
 // 越深越容易出月石；月石把【往下的路】再打通两层，这就是下潜的进度感。
 const DEPTH_MAX=12,DEPTH_BASE=3;
 const depthNodes=depth=>[0,1,2].map(i=>{
  // ⚠️别贴着井壁长：采集点是站到 z+.48 去刨的，太靠外那个落脚点就嵌进石壁里了
  const a=(depth*2.1+i*2.4),r=1.15+((depth*7+i*3)%5)*.22;
  return {id:'vein-'+depth+'-'+i,map:'depths',depth,kind:(depth>=DEPTH_BASE&&i===((depth+1)%3))?'stone':'sand',
   x:+(Math.cos(a)*r).toFixed(2),z:+(Math.sin(a)*r).toFixed(2)};
 });
 const DEPTH_NODES=Array.from({length:DEPTH_MAX},(_,i)=>depthNodes(i+1)).flat();
 const NODES=[...DEPTH_NODES,{id:'herb-a',map:'forest',kind:'herb',x:-2.8,z:.2},{id:'herb-b',map:'forest',kind:'herb',x:.1,z:2},{id:'herb-c',map:'forest',kind:'herb',x:2.5,z:-2.1},{id:'mushroom-a',map:'forest',kind:'mushroom',x:2.6,z:.5},{id:'mushroom-b',map:'forest',kind:'mushroom',x:-1.8,z:-3.1}];
 // The room plan is also read by art/fairy-garden/build_house.py; beds and walls have one source.
 const HOME_BEDS=Object.fromEntries([['dawn','晨光卧室',-3,'rose'],['dusk','月色卧室',3,'sage']].map(([id,label,x,palette])=>[id,{label,x,z:-3.35,w:2.5,d:2.9,height:.82,palette,approach:{player:{x:x-.62,z:-1.35},companion:{x:x+.62,z:-1.35}},slots:{player:{x:x-.57,z:-2.48,y:1.05},companion:{x:x+.57,z:-2.48,y:1.05}}}]));
 const HOME_WALLS=[{x:0,z:-2.8,w:.18,d:4.4,h:1.5},{x:-5,z:-.6,w:2,d:.18,h:1.05},{x:0,z:-.6,w:4,d:.18,h:1.05},{x:5,z:-.6,w:2,d:.18,h:1.05},{x:1,z:.2,w:.15,d:1.6,h:.95},{x:1,z:4.2,w:.15,d:1.6,h:.95}];
 const HOME_FURNITURE=[{kind:'hearth',x:-5.35,z:1.15,w:1,d:1.65},{kind:'sofa',x:-3.2,z:2.05,w:2.5,d:.9},{kind:'table',x:-3.2,z:3.35,w:1.35,d:.6},{kind:'shelf',x:-5.5,z:3.8,w:.55,d:1.6},{kind:'kitchen',x:5.3,z:1.35,w:.8,d:3.2},{kind:'dining',x:3.35,z:2.6,w:1.5,d:.9},{kind:'chair',x:3.35,z:1.8,w:.55,d:.55},{kind:'chair',x:3.35,z:3.45,w:.55,d:.55}];
 // Public hall and upstairs share geometry footprints with the Blender builder.
 const HALL_FURNITURE=[{kind:'hearth',x:-6.25,z:.4,w:1.15,d:2.3},{kind:'table',x:-2,z:1.15,w:4.8,d:1.05},{kind:'bench',x:-2,z:.05,w:4.8,d:.43},{kind:'bench',x:-2,z:2.25,w:4.8,d:.43},{kind:'shelf',x:-4.5,z:-3.8,w:3.9,d:.55},{kind:'lectern',x:3.1,z:-2.6,w:1.3,d:.7},...[1.65,3.15,4.65].flatMap(x=>[-1,.2].map(z=>({kind:'stool',x,z,w:.55,d:.55}))),{kind:'stairs',x:5.75,z:2.05,w:1.7,d:2.3}];
 const DORM_ROOMS=[-5.25,-1.75,1.75,5.25].map((x,i)=>({id:'room'+(i+1),label:['松叶房','晨星房','铃兰房','月桂房'][i],x,bedX:x-.2,z:-2.45,w:1.55,d:2.25,target:{x:x+.9,z:-.85},palette:i%2?'sage':'rose'}));
 const DORM_WALLS=[...[-3.5,0,3.5].map(x=>({x,z:-2.15,w:.14,d:4.45,h:1.15})),...DORM_ROOMS.flatMap(r=>[-1,1].map(sign=>({x:r.x+sign*1.2,z:.12,w:1.05,d:.14,h:.95})))];
 const MUSEUM_EXTERIOR={x:-1.5,z:7.25,w:4.4,d:2.9,door:{x:-1.5,z:9.05},step:{x:-1.5,z:8.93,w:1.6,d:.46,height:.22}};
 const MUSEUM_DISPLAYS={
 flowers:{label:'花笺墙',target:{x:-2.5,z:-2.3},cabinet:{x:-2.5,z:-3.5,w:3.8,d:.6},slots:Array.from({length:6},(_,i)=>({x:-3.65+(i%3)*1.15,z:-3.75,y:1.15+Math.floor(i/3)*.95}))},
 alchemy:{label:'炼金陈列架',target:{x:2.65,z:-1.2},cabinet:{x:4,z:-1.2,w:.65,d:3.6},slots:Array.from({length:6},(_,i)=>({x:4,z:-2.45+(i%3)*1.2,y:1.02+Math.floor(i/3)*.8}))},
 fragments:{label:'碎片柜',target:{x:-2.7,z:.8},cabinet:{x:-4,z:.65,w:.65,d:3.5},slots:Array.from({length:6},(_,i)=>({x:-4,z:-.55+(i%3)*1.15,y:1.02+Math.floor(i/3)*.8}))}
 };
 const MAPS={
 garden:{name:'林边村落',outdoor:true,decorAssets:['./museum-exterior.glb?v=fg-fe4b3d221c1bce32'],museum:MUSEUM_EXTERIOR,seats:{pond:{x:3.65,z:5.15,heading:Math.PI,companion:{x:4.4,z:5.15}}},pathLamp:{x:1.6,z:3.4},decor:{blooms:{x:-8.1,z:-.4,y:.32},lamps:Array.from({length:4},(_,i)=>({x:-6.5+i*.5,z:3.7}))},asset:'./village.glb?v=fg-fe4b3d221c1bce32',renderer:'glb',ground:'asset',background:'#dfe5d5',light:3.5,radius:14,view:{x:-1,z:0},spawn:{x:9.1,z:-1},surfaces:[MUSEUM_EXTERIOR.step,{x:4,z:5.7,w:2.2,d:2.3,height:.31},{x:10,z:3.05,w:1.7,d:2.6,height:.38}],exits:{travel:{to:'forest'},enter:{to:'home'},hall:{to:'hall',action:'door',label:'走进公共厅',target:{x:-1,z:-1.65}},museum:{to:'museum',action:'door',label:'走进收藏馆',target:MUSEUM_EXTERIOR.door}},
 stations:{enter:{x:-5.4,z:3.55},well:{x:-2.7,z:3.05},board:{x:-1,z:-1.65},bottle:{x:3.8,z:5.1},dive:{x:-2.7,z:3.05},garden:{x:-7.6,z:1.55},note:{x:-7.6,z:1.55},sow:{x:-7.6,z:1.55},brew:{x:-3.6,z:3.8},craft:{x:-3.6,z:3.8},travel:{x:10,z:-1},rest:{x:-5.4,z:3.55},star:{x:-5.8,z:4.5},lamp:{x:-6.4,z:4.3}},
 // ⚠️「自己的小屋」必须在这张名单里（她 2026-09-16：「我回不了家了」）：
 // 地点下拉是照这张表长的，表里没有家，她就只能靠「睡到明天」才回得去——
 // 那是【结束这一天】，不是【回家】。两件事不能只留一个。
 sites:{museum:{label:'收藏馆',target:MUSEUM_EXTERIOR.door,text:'南边的小馆亮着灯，点「走进收藏馆」看看留下的东西。'},bridge:{label:'溪上小桥',target:{x:10,z:3.05},text:'小溪从月潭流出来，木桥两端都能继续走。'},square:{label:'公共厅前广场',target:{x:-1,z:-.65},text:'长厅门前铺好了石子地，告示板还空着。'},market:{label:'空闲摊位',target:{x:-.7,z:1.25},text:'折好的布搭在木架上，空桌等着以后的集市。'},home:{label:'自己的小屋',target:{x:-5.4,z:3.55},text:'回到自家门前。点「走进小屋」可以进屋歇脚，睡觉再点「睡到明天」。'},hall:{label:'公共厅',target:{x:-1,z:-1.65},text:'到了公共厅门前。点「走进公共厅」，长桌、壁炉和楼上的宿舍都能去看看。'},neighbor1:{label:'左边的邻居屋',target:{x:-8,z:-2.5},text:'邻居屋的门前还空着，之后可以安排角色入住。'},neighbor2:{label:'林后的邻居屋',target:{x:-6,z:-5.6},text:'这是林后的邻居屋，窗边留着一小块花地。'},neighbor3:{label:'右边的邻居屋',target:{x:6,z:-4.5},text:'绕过月潭，就是第三间邻居屋。'},pond:{label:'月潭栈桥',target:{x:3.8,z:5.1},text:'到了月潭边。水面映着小屋的灯，可以在这里慢慢待着。'}},
 interactions:[{kind:'door',id:'museum',...MUSEUM_EXTERIOR.door,r:.65},{kind:'door',id:'hall',x:-1,z:-2.2,r:.42},{kind:'board',x:-1.6,z:-2.1,r:.5},{kind:'visit',id:'bridge',x:10,z:3.05,r:.5},{kind:'visit',id:'square',x:-1,z:-.65,r:.5},{kind:'visit',id:'market',x:-.7,z:1.25,r:.4},{kind:'well',x:-2.7,z:2,r:.75},{kind:'garden',x:-7.6,z:.2,w:1.9,d:2.1},{kind:'brew',x:-3.6,z:3,r:.5},{kind:'travel',x:10,z:-1,r:.6},{kind:'star',x:-5.8,z:3.95,r:.4},...Object.entries({home:[-5.4,3.1],hall:[-1,-2.2],neighbor1:[-8,-2.7],neighbor2:[-6,-5.8],neighbor3:[6,-4.8],pond:[4,5.1]}).map(([id,[x,z]])=>({kind:'visit',id,x,z,r:.5}))],
 obstacles:[MUSEUM_EXTERIOR,{x:11,z:3,w:7.6,d:1.6,except:{x:10,z:3,w:1.55,d:2.5}},{x:-.7,z:2.1,w:1.25,d:.55},{x:-2.3,z:1.45,w:1.25,d:.55},{x:-2.4,z:-1.6,w:1.25,d:.28},{x:-5,z:1.6,w:3.5,d:2.9},{x:-1,z:-5,w:6.8,d:4.5},{x:6,z:-6,w:3.15,d:2.55},{x:-6,z:-7,w:2.6,d:2.2},{x:-8,z:-4,w:3.15,d:2.55},{x:5,z:-11,r:1},{x:-2.7,z:2,r:.72},{x:-3.6,z:3,r:.42},{x:-7.6,z:.8,w:1.85,d:1.0},{x:-7.6,z:-.4,w:1.85,d:1}, {x:4,z:3,rx:4.0,rz:3.35,except:{x:4,z:5.8,w:1.85,d:2.65}},
 ...[[-10,3],[-10,-1],[-9,-5],[-9,-9],[-5,-10],[-1,-11],[3,-11],[7,-10],[10,-7],[10,-3],[10,1],[-11,7]].map(([x,z])=>({x,z,r:.35}))]},
 home:{name:'林间的家',interior:true,asset:'./home-interior.glb?v=fg-fe4b3d221c1bce32',renderer:'glb',background:'#d9cbbb',light:2.1,radius:8,viewSpan:17,bounds:{w:11.5,d:9.5},floor:.14,view:{x:0,z:.5},spawn:{x:0,z:4.35},plan:{w:12,d:10,wallHeight:3,dividerZ:-.6,doorCenters:[-3,3],doorWidth:2},beds:HOME_BEDS,walls:HOME_WALLS,furniture:HOME_FURNITURE,
 exits:{travel:{to:'garden',at:{x:-5.4,z:3.55}}},stations:{travel:{x:0,z:4.45},rest:HOME_BEDS.dawn.approach.player},
 sites:{living:{label:'壁炉客厅',target:{x:-1.45,z:2.4},text:'客厅里有软沙发，壁炉边可以慢慢待着。'},kitchen:{label:'餐厨间',target:{x:2,z:2.4},text:'木桌留着两个人的座位，杯子放在一起。'},dawn:{label:'晨光卧室',target:HOME_BEDS.dawn.approach.player,text:'这间是暖粉色的双人床。可以选同床、分房，或者让同行者先睡。'},dusk:{label:'月色卧室',target:HOME_BEDS.dusk.approach.player,text:'这间是鼠尾草绿的双人床，门外是安静的走廊。'}},
 interactions:[{kind:'travel',x:0,z:4.7,r:.55},...Object.entries(HOME_BEDS).map(([id,b])=>({kind:'bed',id,x:b.x,z:b.z,w:b.w,d:b.d}))],
 obstacles:[...HOME_WALLS,...HOME_FURNITURE,...Object.values(HOME_BEDS).map(b=>({x:b.x,z:b.z,w:b.w,d:b.d}))]},
 museum:{name:'拾光收藏馆',interior:true,renderer:'museum',decorAssets:['./museum-interior.glb?v=fg-fe4b3d221c1bce32'],background:'#d5cdbb',light:2.2,radius:7,viewSpan:14.8,bounds:{w:9.5,d:7.5},floor:.14,view:{x:0,z:0},spawn:{x:0,z:3.2},plan:{w:10,d:8},displays:MUSEUM_DISPLAYS,
 exits:{travel:{to:'garden',at:MUSEUM_EXTERIOR.door,label:'走出收藏馆'}},stations:{travel:{x:0,z:3.5}},
 sites:Object.fromEntries(Object.entries(MUSEUM_DISPLAYS).map(([id,d])=>[id,{label:d.label,target:d.target,text:'收藏会在这里慢慢留下痕迹。'}])),
 interactions:[{kind:'travel',x:0,z:3.8,r:.55},...Object.entries(MUSEUM_DISPLAYS).map(([id,d])=>({kind:'visit',id,...d.cabinet}))],obstacles:[...Object.values(MUSEUM_DISPLAYS).map(d=>d.cabinet),{x:0,z:-.1,w:1.6,d:1.3}]},
 hall:{name:'炉光公共厅',interior:true,asset:'./public-hall.glb?v=fg-fe4b3d221c1bce32',renderer:'glb',background:'#d7c8b5',light:2.1,radius:9,viewSpan:18,bounds:{w:13.5,d:8.5},floor:.14,view:{x:0,z:0},spawn:{x:0,z:3.85},plan:{w:14,d:9},furniture:HALL_FURNITURE,
 exits:{travel:{to:'garden',at:{x:-1,z:-1.65},label:'走出公共厅'},upstairs:{to:'dormitory',action:'door',label:'上楼去宿舍',target:{x:5.75,z:3.65}}},stations:{travel:{x:0,z:4}},
 sites:{hearth:{label:'壁炉旁',target:{x:-4.9,z:-1.55},text:'壁炉边摆着旧铜壶，暖光照着长桌的一端。'},table:{label:'公共长桌',target:{x:-2,z:3.1},text:'长桌旁留着许多座位，杯子和面包篮已经摆好。'},lesson:{label:'小讲堂',target:{x:3.1,z:1.25},text:'讲台后是一幅星图，矮凳围在一起。课程以后从这里开始。'},books:{label:'公共书架',target:{x:-4.5,z:-2.7},text:'一排魔法书靠着窗，桌角还有没收起的羽毛笔。'}},
 interactions:[{kind:'travel',x:0,z:4.25,r:.6},{kind:'door',id:'upstairs',x:5.75,z:3.2,w:1.7,d:1.6}],obstacles:HALL_FURNITURE},
 dormitory:{name:'公共厅楼上',interior:true,asset:'./hall-dormitory.glb?v=fg-fe4b3d221c1bce32',renderer:'glb',background:'#d6cbbb',light:2,radius:9,viewSpan:18,bounds:{w:13.5,d:8.5},floor:.14,view:{x:0,z:0},spawn:{x:5.7,z:3.3},plan:{w:14,d:9},rooms:DORM_ROOMS,walls:DORM_WALLS,
 exits:{travel:{to:'hall',at:{x:5.75,z:3.65},label:'下楼回公共厅'}},stations:{travel:{x:5.7,z:3.65}},
 sites:Object.fromEntries(DORM_ROOMS.map(r=>[r.id,{label:r.label,target:r.target,text:r.label+'的床、书桌和窗帘已经布置好。房间还空着，之后可以安排角色入住。'}])),
 interactions:[{kind:'travel',x:5.7,z:3.9,r:.55}],obstacles:[...DORM_WALLS,...DORM_ROOMS.flatMap(r=>[{x:r.x-.2,z:r.z,w:r.w,d:r.d},{x:r.x+.95,z:-3.7,w:.75,d:.7}])]},
 depths:{name:'星井',renderer:'depths',background:'#1d2230',light:2.1,radius:3.4,spawn:{x:0,z:2.35},exits:{ladder:{to:'garden',at:{x:-2.7,z:3.05}}},
 stations:{ladder:{x:0,z:2.6},deeper:{x:0,z:-2.35}},
 interactions:[{kind:'ladder',x:0,z:2.6,r:.6},{kind:'deeper',x:0,z:-2.35,r:.6}],
 obstacles:[...Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return {x:Math.cos(a)*3.55,z:Math.sin(a)*3.55,r:.5};})]},
 forest:{name:'萤光林地',outdoor:true,seats:{pond:{x:-.95,z:.65,heading:Math.PI,companion:{x:-.15,z:.65}}},decorAssets:['./wishing-tree.glb?v=fg-fe4b3d221c1bce32'],surfaces:[{kind:'hill',x:0,z:-6,rx:2.5,rz:1.85,height:.9}],sites:{wishingTree:{label:'林后许愿树',target:{x:0,z:-4.9},text:'老树长在缓坡上，枝头的空木牌轻轻晃着。许愿的玩法之后再来。'}},renderer:'forest',background:'#dbe5d6',light:2.4,radius:8.3,spawn:{x:-2.7,z:3.05},exits:{travel:{to:'garden'}},stations:{travel:{x:-2.7,z:3.05},seed:{x:1.7,z:3}},interactions:[{kind:'visit',id:'wishingTree',x:0,z:-4.9,r:.65},{kind:'travel',x:-3.1,z:2.55,r:.55},{kind:'seed',x:1.7,z:2.5,r:.45}],obstacles:[{x:0,z:-6,r:.72},{x:-.7,z:-1.1,r:1.28},...TREES.map(([x,z])=>({x,z,r:.44}))]}
 };
 // Outdoor district placement is shared with the Blender exporter. Buildings retain their size.
 const VILLAGE_ZONES={home:{x:-8,z:5,cx:-5,cz:2,radius:6},hall:{x:0,z:-8,cx:-1,cz:-4,radius:6},neighbor1:{x:-10,z:-3,cx:-8,cz:-4,radius:3},neighbor2:{x:-7,z:-11,cx:-6,cz:-7,radius:3},neighbor3:{x:10,z:-7,cx:6,cz:-6,radius:3},pond:{x:8,z:5,cx:7,cz:3,radius:9},museum:{x:0,z:11,cx:-1.5,cz:7.25,radius:4}};
 function villagePoint(p,zone){const d=VILLAGE_ZONES[zone];return {...p,x:p.x+d.x,z:p.z+d.z};}
 function shiftTree(value,zone){if(Array.isArray(value))return value.map(v=>shiftTree(v,zone));if(!value||typeof value!=='object')return value;const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shiftTree(v,zone)]));return Number.isFinite(out.x)&&Number.isFinite(out.z)?villagePoint(out,zone):out;}
 // Legacy outdoor coordinates are retained above as the editable asset's coordinate frame.
 // Every semantic district moves rigidly; neither houses nor interaction radii are stretched.
 const oldGarden=MAPS.garden,garden={...oldGarden};
 const stationZone={enter:'home',well:'home',board:'hall',dive:'home',garden:'home',note:'home',sow:'home',brew:'home',craft:'home',travel:'pond',bottle:'pond',rest:'home',star:'home',lamp:'home'};
 const siteZone={museum:'museum',bridge:'pond',square:'hall',market:'hall',home:'home',hall:'hall',neighbor1:'neighbor1',neighbor2:'neighbor2',neighbor3:'neighbor3',pond:'pond'};
 garden.stations=Object.fromEntries(Object.entries(oldGarden.stations).map(([id,p])=>[id,villagePoint(p,stationZone[id])]));
 garden.sites=Object.fromEntries(Object.entries(oldGarden.sites).map(([id,p])=>[id,shiftTree(p,siteZone[id])]));
 garden.interactions=oldGarden.interactions.map(p=>shiftTree(p,siteZone[p.id]||stationZone[p.kind]));
 const obstacleZones=['museum','pond','hall','hall','hall','home','hall','neighbor3','neighbor2','neighbor1','trees','home','home','home','home','pond'];
 garden.obstacles=oldGarden.obstacles.map((p,i)=>obstacleZones[i]&&obstacleZones[i]!=='trees'?shiftTree(p,obstacleZones[i]):{...p,x:p.x*2,z:p.z*2});
 garden.museum=shiftTree(oldGarden.museum,'museum');garden.seats=shiftTree(oldGarden.seats,'pond');garden.decor=shiftTree(oldGarden.decor,'home');garden.pathLamp=villagePoint(oldGarden.pathLamp,'home');
 garden.surfaces=oldGarden.surfaces.map((p,i)=>shiftTree(p,i===0?'museum':'pond'));
 garden.exits={...oldGarden.exits,hall:shiftTree(oldGarden.exits.hall,'hall'),museum:shiftTree(oldGarden.exits.museum,'museum')};
 garden.spawn=villagePoint(oldGarden.spawn,'pond');garden.view=villagePoint(START,'home');garden.radius=32;
 garden.asset='./village-ground.glb?v=fg-fe4b3d221c1bce32';garden.decorAssets=[];
 garden.chunks=Object.entries(VILLAGE_ZONES).map(([id,d])=>({id,x:d.cx+d.x,z:d.cz+d.z,radius:d.radius,asset:'./village-'+id+'.glb'}));
 // A literal URL is required for every asset so build-fairy-garden fingerprints references.
 const districtAssets=['./village-home.glb?v=fg-fe4b3d221c1bce32','./village-hall.glb?v=fg-fe4b3d221c1bce32','./village-neighbor1.glb?v=fg-fe4b3d221c1bce32','./village-neighbor2.glb?v=fg-fe4b3d221c1bce32','./village-neighbor3.glb?v=fg-fe4b3d221c1bce32','./village-pond.glb?v=fg-fe4b3d221c1bce32','./village-museum.glb?v=fg-fe4b3d221c1bce32'];
 garden.chunks.forEach((c,i)=>c.asset=districtAssets[i]);
 MAPS.garden=garden;Object.assign(START,villagePoint(START,'home'));
 MAPS.home.exits.travel.at=garden.stations.enter;MAPS.hall.exits.travel.at=garden.exits.hall.target;MAPS.museum.exits.travel.at=garden.museum.door;MAPS.depths.exits.ladder.at=garden.stations.well;
 // Exterior footprints are also read by the Blender architecture builder. Door approaches stay put.
 garden.architecture={
 home:{style:'vine-cottage',parts:[{id:'main',x:-13,z:5.8,w:3.5,d:4.5,h:2.65},{id:'wing',x:-10.35,z:4.3,w:2.6,d:3.2,h:2.25}],door:{...garden.stations.enter},porch:{x:-13.4,z:8.36,w:1.6,d:.7,height:.18}},
 hall:{style:'bell-longhouse',parts:[{id:'main',x:-1,z:-13,w:8.2,d:4.5,h:3.35}],door:{...garden.exits.hall.target}},
 neighbor1:{style:'steep-attic',parts:[{id:'main',x:-18,z:-7.65,w:3.35,d:3.4,h:2.3}],door:{...garden.sites.neighbor1.target}},
 neighbor2:{style:'round-study',parts:[{id:'tower',x:-13,z:-18.3,r:1.35,h:3.65},{id:'wing',x:-11.25,z:-18.5,w:1.7,d:2.65,h:2.1}],door:{...garden.sites.neighbor2.target}},
 neighbor3:{style:'garden-house',parts:[{id:'main',x:16,z:-13.55,w:3.3,d:3.25,h:2.45},{id:'glass',x:18.5,z:-13.9,w:1.7,d:2.7,h:1.65}],door:{...garden.sites.neighbor3.target}},
 museum:{style:'arched-conservatory',parts:[{id:'main',x:-1.5,z:18.1,w:5.5,d:3.2,h:2.15}],door:{...garden.museum.door},porch:{...garden.museum.step}}
 };
 const architectureIndexes={museum:0,home:5,hall:6,neighbor3:7,neighbor2:8,neighbor1:9};
 for(const [id,building]of Object.entries(garden.architecture)){const [main,...wings]=building.parts;garden.obstacles[architectureIndexes[id]]={...main};garden.obstacles.push(...wings.map(p=>({...p})));}
 garden.surfaces.push(garden.architecture.home.porch);
 // More generous bounds include the new side wings and eaves in streaming decisions.
 for(const chunk of garden.chunks)if(garden.architecture[chunk.id])chunk.radius=Math.max(chunk.radius,6);
 // Lake outline is the shared source for Blender water/shore meshes and navigation.
 // The eastern tongue keeps the existing bridge and forest entrance on dry land.
 const shoreKnots=[[8.7,10.3],[7.4,8],[7,4],[8.2,.5],[11,-3.2],[15.8,-5.5],[21,-6.2],[25.2,-4.8],[28,-1.8],[28.2,1.8],[26.2,4.6],[24,3.3],[21.8,1.4],[19.2,1.5],[17.3,3.3],[16.5,6],[16.25,8.7],[14.6,10.7],[12,11.35]];
 const shore=[];for(let i=0;i<shoreKnots.length;i++){const n=shoreKnots.length,a=shoreKnots[(i+n-1)%n],b=shoreKnots[i],c=shoreKnots[(i+1)%n],d=shoreKnots[(i+2)%n];for(let j=0;j<6;j++){const t=j/6;shore.push(Object.fromEntries(['x','z'].map((key,k)=>[key,.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)])));}}
 garden.lake={shore,splitZ:2,waterHeight:.13,deck:{x:12,z:10.65,w:2.2,d:2.3,height:.31},bottle:{x:10.3,z:10.7,height:.35,target:{x:10.2,z:11.8}},island:{x:21,z:-2.7,rx:1.7,rz:1.05},trees:[{x:8.2,z:-2.3,r:.25},{x:12.4,z:-5.55,r:.3},{x:17,z:-7.4,r:.3},{x:23.1,z:-6.8,r:.28},{x:28.4,z:-3.8,r:.26},{x:28.5,z:4.4,r:.25},{x:24,z:5.2,r:.24}],outlooks:[{x:9,z:-3.7},{x:25.4,z:-6},{x:25.7,z:6.1}]};
 const creek=[];for(let i=0;i<=40;i++){const x=15.4+i*.46;creek.push({x,z:8+Math.sin(i*.15)*.17+Math.max(0,x-23)*.25});}garden.lake.creek=creek;garden.lake.creekWidth=1.25;
 garden.obstacles[1]={polygon:[...creek.map(p=>({x:p.x,z:p.z-.625})),...creek.slice().reverse().map(p=>({x:p.x,z:p.z+.625}))],except:{x:18,z:8,w:1.55,d:2.6}};
 garden.obstacles[15]={kind:'lake',polygon:shore,except:{...garden.lake.deck,w:1.85,d:2.65}};
 garden.obstacles.push(...garden.lake.trees,{...garden.lake.island});
 garden.lake.iceHeight=.22;garden.lake.skateStart={x:12,z:7.8};
 garden.spawn={...START};
 garden.stations.bottle={...garden.lake.bottle.target};
 garden.sites.pond={...garden.sites.pond,label:'林间月湖',text:'浅滩边有芦苇和漂流瓶，栈桥伸向湖面。远岸的树影一直延伸到小岛后面。'};
 garden.sites.lakeNorth={label:'月湖北岸',target:garden.lake.outlooks[0],text:'绕到北岸，隔着开阔的湖水能望见村落。'};
 garden.sites.lakeEast={label:'月湖东岸',target:garden.lake.outlooks[2],text:'水从芦苇旁流过，小岛就在对岸。可以沿着岸边慢慢走。'};
 for(const id of ['lakeNorth','lakeEast'])garden.interactions.push({kind:'visit',id,...garden.sites[id].target,r:.7});
 const nearLake=garden.chunks.find(c=>c.id==='pond');Object.assign(nearLake,{x:20,z:8,radius:16});
 garden.chunks.push({id:'lake-far',x:18,z:-2,radius:12,asset:'./village-lake-far.glb?v=fg-fe4b3d221c1bce32'});
 function migrateVillagePosition(p){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return p;let best='home',distance=Infinity;for(const [id,d]of Object.entries(VILLAGE_ZONES)){const dist=Math.hypot(p.x-d.cx,p.z-d.cz);if(dist<distance){best=id;distance=dist;}}return villagePoint(p,best);}
 const ACTIVITIES={
 flowers:{map:'garden',target:MAPS.garden.stations.garden,label:'照料月光花',gesture:'water'},herbs:{map:'forest',target:{x:.1,z:2.48},label:'观察铃叶草',gesture:'gather'},mushrooms:{map:'forest',target:{x:2.6,z:.98},label:'寻找会发光的蘑菇',gesture:'gather'},pond:{map:'forest',target:{x:-.7,z:.6},label:'在池边观察水纹',gesture:'read'},study:{map:'garden',target:MAPS.garden.sites.hall.target,label:'翻看魔法笔记',gesture:'read'},potion:{map:'garden',target:MAPS.garden.stations.brew,label:'研究炼药锅里的微光',gesture:'read'},glow:{map:'forest',target:{x:1.7,z:3},label:'等草丛里的萤光亮起来',gesture:'rest'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'在屋前歇脚',gesture:'rest'},rain:{map:'garden',target:MAPS.garden.stations.rest,label:'在屋檐下听雨',gesture:'read'},star:{map:'garden',target:MAPS.garden.stations.star,label:'看看星铃花的新芽',gesture:'read'},dive:{map:'garden',target:MAPS.garden.stations.well,label:'在井口往下看看',gesture:'read'},
  // v69.55 补：她那一路做出来的地方，他原来一个都够不着（公告栏、收藏馆、水边、集市、桥、许愿树、邻居屋）
  board:{map:'garden',target:MAPS.garden.stations.board,label:'看看告示板上贴了什么',gesture:'read'},
  museum:{map:'museum',target:MAPS.museum.sites.alchemy.target,label:'走进收藏馆，看你留下的那些东西',gesture:'read'},
  bottle:{map:'garden',target:MAPS.garden.stations.bottle,label:'在月潭边看水面上漂着什么',gesture:'read'},
  market:{map:'garden',target:MAPS.garden.sites.market.target,label:'在空摊位那儿待一会儿',gesture:'rest'},
  bridge:{map:'garden',target:MAPS.garden.sites.bridge.target,label:'坐在溪上小桥上',gesture:'rest'},
  wish:{map:'forest',target:MAPS.forest.sites.wishingTree.target,label:'去林后那棵许愿树下站一会儿',gesture:'rest'},
  neighbor:{map:'garden',target:MAPS.garden.sites.neighbor1.target,label:'到邻居屋门前转转',gesture:'rest'},
  hall:{map:'hall',target:MAPS.hall.sites.hearth.target,label:'在公共厅的炉边坐着',gesture:'read'},
  walk:{map:'garden',target:MAPS.garden.sites.square.target,label:'在村里走走',gesture:'rest'}
 };
 const SEASONS=[
  {name:'春',tint:'#d8ecc0',dusk:1080,weather:{'晴日':45,'细雨':35,'薄雾':20}},
  {name:'夏',tint:'#afd08f',dusk:1140,weather:{'晴日':65,'细雨':25,'薄雾':10}},
  {name:'秋',tint:'#d4a16b',dusk:1020,weather:{'晴日':50,'细雨':20,'薄雾':30}},
  {name:'冬',tint:'#dfeaf0',dusk:960,weather:{'晴日':30,'细雪':50,'薄雾':20}}
 ];
 const seasonOf=day=>{const d=Math.max(1,Math.floor(Number(day)||1)),index=Math.floor((d-1)/14);return {...SEASONS[index%4],index,key:String(index),year:Math.floor(index/4)+1,day:(d-1)%14+1,start:index*14+1,end:index*14+14};};
 // A seeded daily draw: saved epoch + absolute day, independent of refresh, map and calls.
 const weather=(day,epoch='initial')=>{const d=Math.max(1,Math.floor(Number(day)||1));let h=2166136261;for(const ch of String(epoch)+':weather:'+d){h=Math.imul(h^ch.charCodeAt(0),16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;let draw=(h>>>0)/4294967296*100;for(const [kind,weight]of Object.entries(seasonOf(d).weather)){draw-=weight;if(draw<0)return kind;}return '晴日';};
 function normalizePlan(raw,day){const season=seasonOf(day);if(!raw||!Array.isArray(raw.days)||raw.days.length!==14)throw Error('这一季需要完整的 14 天安排，可以重试。');const seen=new Set();const days=raw.days.map(d=>{if(!Number.isInteger(d.day)||d.day<1||d.day>14||seen.has(d.day)||!Array.isArray(d.activities)||d.activities.length!==3)throw Error('日期或活动数量没有对上，请重试这一季。');seen.add(d.day);return {day:d.day,note:String(d.note||'').slice(0,180),activities:d.activities.map(a=>{if(!a||!Object.hasOwn(ACTIVITIES,a.id))throw Error('有一项活动还不在这个世界里，请重试这一季。');return {id:a.id,note:String(a.note||'').slice(0,120)};})};}).sort((a,b)=>a.day-b.day);return {season:season.index,title:String(raw.title||'一起度过这一季').slice(0,60),days};}
 function hitInteraction(map,p,depth){const m=MAPS[map];if(!m)return null;const n=NODES.find(n=>n.map===map&&(n.depth==null||n.depth===depth)&&Math.hypot(n.x-p.x,n.z-p.z)<.48);if(n)return {kind:'gather',id:n.id};return m.interactions.find(o=>o.r?Math.hypot(p.x-o.x,p.z-o.z)<o.r:Math.abs(p.x-o.x)<o.w/2&&Math.abs(p.z-o.z)<o.d/2)||null;}
 root.FairyGardenRules={VILLAGE_ZONES,villagePoint,migrateVillagePosition,START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction};
})(globalThis);
