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
 // The room plan is also read by art/fairy-garden/build_interiors.py; beds and walls have one source.
 const HOME_BEDS=Object.fromEntries([['dawn','蔷薇卧室',-7,-4.7,'rose'],['dusk','月色卧室',0,-6,'sage']].map(([id,label,x,z,palette])=>[id,{label,x,z,w:2.7,d:3.05,height:1.18,palette,base:.5,approach:{player:{x:x-.65,z:z+2.1},companion:{x:x+.65,z:z+2.1}},slots:{player:{x:x-.60,z:z+.87,y:1.41},companion:{x:x+.60,z:z+.87,y:1.41}}}]));
 const HOME_WALLS=[{x:-2,z:-4.3,w:.18,d:7,h:1.35},{x:-9.6,z:-.8,w:3.8,d:.18,h:1.1},{x:-3.8,z:-.8,w:3.6,d:.18,h:1.1},{x:-1.55,z:-1.8,w:.9,d:.18,h:1.1},{x:3.4,z:-1.8,w:4.8,d:.18,h:1.1},{x:5.8,z:-5.2,w:.18,d:6.8,h:1.2}];
 const HOME_FURNITURE=[{kind:'hearth',x:-10.75,z:.65,w:1.1,d:2.45},{kind:'sofa',x:-7.8,z:1.55,w:3.15,d:1.05},{kind:'table',x:-7.5,z:3.25,w:1.8,d:.9},{kind:'armchair',x:-10,z:3.8,w:1,d:1.1},{kind:'shelf',x:-3.1,z:1.25,w:.65,d:2.9},{kind:'kitchen',x:8.35,z:1.25,w:3.15,d:.85},{kind:'island',x:7.8,z:3.7,w:2.2,d:.85},{kind:'dining',x:3.7,z:2.25,w:2.2,d:1.15},...[-1,1].map(v=>({kind:'chair',x:3.7+v*.67,z:3.45,w:.6,d:.65,heading:Math.PI})),{kind:'armchair',x:9.5,z:-2.5,w:1.05,d:1.1},{kind:'roundtable',x:10.75,z:-2,w:.7,d:.7},{kind:'wardrobe',x:-10,z:-5.5,w:.8,d:1.65},{kind:'desk',x:-3.25,z:-5.25,w:.8,d:1.65},{kind:'bath',x:3.85,z:-6.65,w:1.45,d:2.4},{kind:'vanity',x:3.8,z:-3.2,w:1.8,d:.65},{kind:'console',x:-1.5,z:6.35,w:.65,d:1.8}];
 // Public hall and upstairs share geometry footprints with the Blender builder.
 const HALL_FURNITURE=[{kind:'hearth',x:-6.25,z:.4,w:1.15,d:2.3},{kind:'table',x:-2,z:1.15,w:4.8,d:1.05},{kind:'bench',x:-2,z:.05,w:4.8,d:.43},{kind:'bench',x:-2,z:2.25,w:4.8,d:.43},{kind:'shelf',x:-4.5,z:-3.8,w:3.9,d:.55},{kind:'lectern',x:3.1,z:-2.6,w:1.3,d:.7},...[1.65,3.15,4.65].flatMap(x=>[-1,.2].map(z=>({kind:'stool',x,z,w:.55,d:.55,heading:Math.PI}))),{kind:'stairs',x:5.75,z:2.05,w:1.7,d:2.3}];
 const DORM_ROOMS=[-5.25,-1.75,1.75,5.25].map((x,i)=>({id:'room'+(i+1),label:['松叶房','晨星房','铃兰房','月桂房'][i],x,bedX:x-.2,z:-2.45,w:1.55,d:2.25,target:{x:x+.9,z:-.85},palette:i%2?'sage':'rose'}));
 const DORM_WALLS=[...[-3.5,0,3.5].map(x=>({x,z:-2.15,w:.14,d:4.45,h:1.15})),...DORM_ROOMS.flatMap(r=>[-1,1].map(sign=>({x:r.x+sign*1.2,z:.12,w:1.05,d:.14,h:.95})))];
 const MUSEUM_EXTERIOR={x:-1.5,z:7.25,w:4.4,d:2.9,door:{x:-1.5,z:9.05},step:{x:-1.5,z:8.93,w:1.6,d:.46,height:.22}};
 const MUSEUM_DISPLAYS={
 flowers:{label:'花笺墙',target:{x:-2.5,z:-2.3},cabinet:{x:-2.5,z:-3.5,w:3.8,d:.6},slots:Array.from({length:6},(_,i)=>({x:-3.65+(i%3)*1.15,z:-3.75,y:1.15+Math.floor(i/3)*.95}))},
 alchemy:{label:'炼金陈列架',target:{x:2.65,z:-1.2},cabinet:{x:4,z:-1.2,w:.65,d:3.6},slots:Array.from({length:6},(_,i)=>({x:4,z:-2.45+(i%3)*1.2,y:1.02+Math.floor(i/3)*.8}))},
 fragments:{label:'碎片柜',target:{x:-2.7,z:.8},cabinet:{x:-4,z:.65,w:.65,d:3.5},slots:Array.from({length:6},(_,i)=>({x:-4,z:-.55+(i%3)*1.15,y:1.02+Math.floor(i/3)*.8}))}
 };
 const MAPS={
 garden:{name:'林边村落',outdoor:true,decorAssets:['./museum-exterior.glb?v=fg-06cafed5415b1737'],museum:MUSEUM_EXTERIOR,seats:{pond:{x:3.65,z:5.15,heading:Math.PI,companion:{x:4.4,z:5.15}}},pathLamp:{x:1.6,z:3.4},decor:{blooms:{x:-8.1,z:-.4,y:.32},lamps:Array.from({length:4},(_,i)=>({x:-6.5+i*.5,z:3.7}))},asset:'./village.glb?v=fg-06cafed5415b1737',renderer:'glb',ground:'asset',background:'#dfe5d5',light:3.5,radius:14,view:{x:-1,z:0},spawn:{x:9.1,z:-1},surfaces:[MUSEUM_EXTERIOR.step,{x:4,z:5.7,w:2.2,d:2.3,height:.31},{x:10,z:3.05,w:1.7,d:2.6,height:.38}],exits:{travel:{to:'forest'},enter:{to:'home'},hall:{to:'hall',action:'door',label:'走进公共厅',target:{x:-1,z:-1.65}},museum:{to:'museum',action:'door',label:'走进收藏馆',target:MUSEUM_EXTERIOR.door}},
 stations:{enter:{x:-5.4,z:3.55},well:{x:-2.7,z:3.05},board:{x:-2.4,z:-.95},bottle:{x:3.8,z:5.1},dive:{x:-2.7,z:3.05},garden:{x:-7.6,z:1.95},note:{x:-7.6,z:1.95},sow:{x:-7.6,z:1.95},brew:{x:-.6,z:4.2},craft:{x:-.6,z:4.2},travel:{x:10,z:-1},rest:{x:-5.4,z:3.55},star:{x:-5.8,z:4.5},lamp:{x:-6.4,z:4.3}},
 // ⚠️「自己的小屋」必须在这张名单里（她 2026-09-16：「我回不了家了」）：
 // 地点下拉是照这张表长的，表里没有家，她就只能靠「睡到明天」才回得去——
 // 那是【结束这一天】，不是【回家】。两件事不能只留一个。
 sites:{museum:{label:'收藏馆',target:MUSEUM_EXTERIOR.door,text:'南边的小馆亮着灯，点「走进收藏馆」看看留下的东西。'},bridge:{label:'溪上小桥',target:{x:10,z:3.05},text:'小溪从月潭流出来，木桥两端都能继续走。'},square:{label:'公共厅前广场',target:{x:-1,z:-.65},text:'长厅门前铺好了石子地，告示板还空着。'},market:{label:'空闲摊位',target:{x:-.7,z:1.25},text:'折好的布搭在木架上，空桌等着以后的集市。'},home:{label:'自己的小屋',target:{x:-5.4,z:3.55},text:'回到自家门前。点「走进小屋」可以进屋歇脚，睡觉再点「睡到明天」。'},hall:{label:'公共厅',target:{x:-1,z:-1.65},text:'到了公共厅门前。点「走进公共厅」，长桌、壁炉和楼上的宿舍都能去看看。'},neighbor1:{label:'左边的邻居屋',target:{x:-8,z:-2.5},text:'邻居屋的门前还空着，之后可以安排角色入住。'},neighbor2:{label:'林后的邻居屋',target:{x:-6,z:-5.6},text:'这是林后的邻居屋，窗边留着一小块花地。'},neighbor3:{label:'右边的邻居屋',target:{x:6,z:-4.5},text:'绕过月潭，就是第三间邻居屋。'},pond:{label:'月潭栈桥',target:{x:3.8,z:5.1},text:'到了月潭边。水面映着小屋的灯，可以在这里慢慢待着。'}},
 interactions:[{kind:'door',id:'museum',...MUSEUM_EXTERIOR.door,r:.65},{kind:'door',id:'hall',x:-1,z:-2.2,r:.42},{kind:'board',x:-2.4,z:-1.15,r:.8},{kind:'visit',id:'bridge',x:10,z:3.05,r:.5},{kind:'visit',id:'square',x:-1,z:-.65,r:.5},{kind:'visit',id:'market',x:-.7,z:1.25,r:.4},{kind:'well',x:-2.7,z:2,r:.75},{kind:'garden',x:-7.6,z:.2,w:1.9,d:2.1},{kind:'brew',x:-.6,z:3.2,r:.7},{kind:'travel',x:10,z:-1,r:.6},{kind:'star',x:-5.8,z:3.95,r:.4},...Object.entries({home:[-5.4,3.1],hall:[-1,-2.2],neighbor1:[-8,-2.7],neighbor2:[-6,-5.8],neighbor3:[6,-4.8],pond:[4,5.1]}).map(([id,[x,z]])=>({kind:'visit',id,x,z,r:.5}))],
 obstacles:[MUSEUM_EXTERIOR,{x:11,z:3,w:7.6,d:1.6,except:{x:10,z:3,w:1.55,d:2.5}},{id:"legacy-market-a",x:-.7,z:2.1,w:1.25,d:.55},{id:"legacy-market-b",x:-2.3,z:1.45,w:1.25,d:.55},{x:-2.4,z:-1.6,w:1.25,d:.28},{x:-5,z:1.6,w:3.5,d:2.9},{x:-1,z:-5,w:6.8,d:4.5},{x:6,z:-6,w:3.15,d:2.55},{x:-6,z:-7,w:2.6,d:2.2},{x:-8,z:-4,w:3.15,d:2.55},{x:5,z:-11,r:1},{x:-2.7,z:2,r:.72},{id:'alchemy-stove',x:-.6,z:3.2,r:.68},{id:'flowerbed-south',x:-7.6,z:.8,w:1.85,d:1.0},{id:'flowerbed-north',x:-7.6,z:-.4,w:1.85,d:1}, {x:4,z:3,rx:4.0,rz:3.35,except:{x:4,z:5.8,w:1.85,d:2.65}},
 ...[[-10,3],[-10,-1],[-9,-5],[-9,-9],[-5,-10],[-1,-11],[3,-11],[7,-10],[10,-7],[10,-3],[10,1],[-11,7]].map(([x,z])=>({x,z,r:.35}))]},
 home:{name:'林间的家',interior:true,asset:'./home-interior.glb?v=fg-06cafed5415b1737',renderer:'glb',background:'#d9cbbb',light:2.1,radius:8,viewSpan:17,bounds:{w:11.5,d:9.5},floor:.14,view:{x:0,z:.5},spawn:{x:0,z:4.35},plan:{w:12,d:10,wallHeight:3,dividerZ:-.6,doorCenters:[-3,3],doorWidth:2},beds:HOME_BEDS,walls:HOME_WALLS,furniture:HOME_FURNITURE,
 exits:{travel:{to:'garden',at:{x:-5.4,z:3.55}}},stations:{travel:{x:0,z:4.45},rest:HOME_BEDS.dawn.approach.player},
 sites:{living:{label:'壁炉客厅',target:{x:-1.45,z:2.4},text:'客厅里有软沙发，壁炉边可以慢慢待着。'},kitchen:{label:'餐厨间',target:{x:2,z:2.4},text:'木桌留着两个人的座位，杯子放在一起。'},dawn:{label:'晨光卧室',target:HOME_BEDS.dawn.approach.player,text:'这间是暖粉色的双人床。可以选同床、分房，或者让同行者先睡。'},dusk:{label:'月色卧室',target:HOME_BEDS.dusk.approach.player,text:'这间是鼠尾草绿的双人床，门外是安静的走廊。'}},
 interactions:[{kind:'travel',x:0,z:4.7,r:.55},...Object.entries(HOME_BEDS).map(([id,b])=>({kind:'bed',id,x:b.x,z:b.z,w:b.w,d:b.d}))],
 obstacles:[...HOME_WALLS,...HOME_FURNITURE,...Object.values(HOME_BEDS).map(b=>({x:b.x,z:b.z,w:b.w,d:b.d}))]},
 museum:{name:'拾光收藏馆',interior:true,renderer:'museum',decorAssets:['./museum-interior.glb?v=fg-06cafed5415b1737'],background:'#d5cdbb',light:2.2,radius:7,viewSpan:14.8,bounds:{w:9.5,d:7.5},floor:.14,view:{x:0,z:0},spawn:{x:0,z:3.2},plan:{w:10,d:8},displays:MUSEUM_DISPLAYS,
 exits:{travel:{to:'garden',at:MUSEUM_EXTERIOR.door,label:'走出收藏馆'}},stations:{travel:{x:0,z:3.5}},
 sites:Object.fromEntries(Object.entries(MUSEUM_DISPLAYS).map(([id,d])=>[id,{label:d.label,target:d.target,text:'收藏会在这里慢慢留下痕迹。'}])),
 interactions:[{kind:'travel',x:0,z:3.8,r:.55},...Object.entries(MUSEUM_DISPLAYS).map(([id,d])=>({kind:'visit',id,...d.cabinet}))],obstacles:[...Object.values(MUSEUM_DISPLAYS).map(d=>d.cabinet),{x:0,z:-.1,w:1.6,d:1.3}]},
 hall:{name:'炉光公共厅',interior:true,asset:'./public-hall.glb?v=fg-06cafed5415b1737',renderer:'glb',background:'#d7c8b5',light:2.1,radius:9,viewSpan:18,bounds:{w:13.5,d:8.5},floor:.14,view:{x:0,z:0},spawn:{x:0,z:3.85},plan:{w:14,d:9},furniture:HALL_FURNITURE,
 exits:{travel:{to:'garden',at:{x:-1,z:-1.65},label:'走出公共厅'},upstairs:{to:'dormitory',action:'door',label:'上楼去宿舍',target:{x:5.75,z:3.65}}},stations:{travel:{x:0,z:4}},
 sites:{hearth:{label:'壁炉旁',target:{x:-4.9,z:-1.55},text:'壁炉边摆着旧铜壶，暖光照着长桌的一端。'},table:{label:'公共长桌',target:{x:-2,z:3.1},text:'长桌旁留着许多座位，杯子和面包篮已经摆好。'},lesson:{label:'小讲堂',target:{x:3.1,z:1.25},text:'讲台后是一幅星图，矮凳围在一起。课程以后从这里开始。'},books:{label:'公共书架',target:{x:-4.5,z:-2.7},text:'一排魔法书靠着窗，桌角还有没收起的羽毛笔。'}},
 interactions:[{kind:'travel',x:0,z:4.25,r:.6},{kind:'door',id:'upstairs',x:5.75,z:3.2,w:1.7,d:1.6}],obstacles:HALL_FURNITURE},
 dormitory:{name:'公共厅楼上',interior:true,asset:'./hall-dormitory.glb?v=fg-06cafed5415b1737',renderer:'glb',background:'#d6cbbb',light:2,radius:9,viewSpan:18,bounds:{w:13.5,d:8.5},floor:.14,view:{x:0,z:0},spawn:{x:5.7,z:3.3},plan:{w:14,d:9},rooms:DORM_ROOMS,walls:DORM_WALLS,
 exits:{travel:{to:'hall',at:{x:5.75,z:3.65},label:'下楼回公共厅'}},stations:{travel:{x:5.7,z:3.65}},
 sites:Object.fromEntries(DORM_ROOMS.map(r=>[r.id,{label:r.label,target:r.target,text:r.label+'的床、书桌和窗帘已经布置好。房间还空着，之后可以安排角色入住。'}])),
 interactions:[{kind:'travel',x:5.7,z:3.9,r:.55}],obstacles:[...DORM_WALLS,...DORM_ROOMS.flatMap(r=>[{x:r.x-.2,z:r.z,w:r.w,d:r.d},{x:r.x+.95,z:-3.7,w:.75,d:.7}])]},
 depths:{name:'星井',renderer:'depths',background:'#1d2230',light:2.1,radius:3.4,spawn:{x:0,z:2.35},exits:{ladder:{to:'garden',at:{x:-2.7,z:3.05}}},
 stations:{ladder:{x:0,z:2.6},deeper:{x:0,z:-2.35}},
 interactions:[{kind:'ladder',x:0,z:2.6,r:.6},{kind:'deeper',x:0,z:-2.35,r:.6}],
 obstacles:[...Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return {x:Math.cos(a)*3.55,z:Math.sin(a)*3.55,r:.5};})]},
 forest:{name:'萤光林地',outdoor:true,seats:{pond:{x:-.95,z:.65,heading:Math.PI,companion:{x:-.15,z:.65}}},decorAssets:['./wishing-tree.glb?v=fg-06cafed5415b1737'],surfaces:[{kind:'hill',x:0,z:-6,rx:2.5,rz:1.85,height:.9}],sites:{wishingTree:{label:'林后许愿树',target:{x:0,z:-4.9},text:'老树长在缓坡上，枝头的空木牌轻轻晃着。许愿的玩法之后再来。'}},renderer:'forest',background:'#dbe5d6',light:2.4,radius:8.3,spawn:{x:-2.7,z:3.05},exits:{travel:{to:'garden'}},stations:{cast:{x:0,z:-4.9},travel:{x:-2.7,z:3.05},seed:{x:1.7,z:3}},interactions:[{kind:'visit',id:'wishingTree',x:0,z:-4.9,r:.65},{kind:'travel',x:-3.1,z:2.55,r:.55},{kind:'seed',x:1.7,z:2.5,r:.45}],obstacles:[{x:0,z:-6,r:.72},{x:-.7,z:-1.1,r:1.28,waterHeight:.125},...TREES.map(([x,z])=>({x,z,r:.44}))]}
 };
 // Expanded interior plans: the Blender kit and walkability read these same outlines and footprints.
 const home=MAPS.home;
 Object.assign(home,{radius:16,bounds:{w:25,d:18},viewSpan:13.8,view:{x:0,z:1},spawn:{x:0,z:7.45},plan:{w:24,d:17,wallHeight:3.8,outline:[[-11,-6.8],[-4.8,-6.8],[-4.8,-8.6],[5.8,-8.6],[5.8,-5.8],[10.8,-5.8],[12.1,-4.5],[12.1,1.8],[10.6,3.1],[10.6,5.8],[2.8,5.8],[2.8,8.2],[-2.8,8.2],[-2.8,5.8],[-10.8,5.8],[-11.8,4.6],[-11.8,-2.8],[-11,-3.6]].map(([x,z])=>({x,z})),arches:[{x:-6.8,z:-.8,w:2.2,h:3.25},{x:0,z:-1.8,w:2.4,h:3.55},{x:0,z:5.5,w:4.5,h:3.65},{x:7.1,z:-.8,w:3.2,h:3.5}],zones:[{id:'dawn',x:-7,z:-3.835,w:9.6,d:5.83,height:.5},{id:'dusk',x:1.9,z:-5.25,w:7.8,d:6.7,height:.5}]}});
 home.surfaces=[{x:-6.8,z:-.45,w:2.2,d:.35,height:.26},{x:-6.8,z:-.77,w:2.2,d:.3,height:.38},{x:0,z:-1.42,w:2.4,d:.38,height:.26},{x:0,z:-1.75,w:2.4,d:.3,height:.38},...home.plan.zones];
 home.stations.travel={x:0,z:7.65};home.stations.rest=HOME_BEDS.dawn.approach.player;home.interactions[0]={kind:'travel',x:0,z:7.95,r:.55};
 home.sites={entry:{label:'拱廊玄关',target:{x:0,z:6.2},text:'越过石砖门厅，拱廊通向屋里的暖光。'},living:{label:'壁炉会客室',target:{x:-5.2,z:3.3},text:'围着壁炉的沙发、绣毯和书架，把客厅围成一个能久坐的角落。'},kitchen:{label:'餐厨间',target:{x:5.6,z:3.1},text:'餐桌和操作台分开摆着，宽敞的过道一直通往花房。'},conservatory:{label:'玻璃花房',target:{x:8.8,z:-3.6},text:'高窗下摆着藤椅，草木沿着细铜架爬上去。'},dawn:{label:HOME_BEDS.dawn.label,target:HOME_BEDS.dawn.approach.player,text:'拱门后是蔷薇色的卧室，书桌和衣柜各占一个安静角落。'},dusk:{label:HOME_BEDS.dusk.label,target:HOME_BEDS.dusk.approach.player,text:'卧室藏在更深处，帷幔旁连着梳洗小间。'},bath:{label:'月色梳洗间',target:{x:2.5,z:-5.1},text:'铜脚浴缸与梳妆台边留着柔软的帷幔。'}};
 // Public interiors get their own spacious proportions, without stretching furniture or dolls.
 const hall=MAPS.hall;hall.plan={w:22,d:14,outline:[[-10,-7],[8,-7],[11,-4],[11,5],[8,7],[-10,7],[-12,4],[-12,-4]].map(([x,z])=>({x,z}))};hall.radius=15;hall.bounds={w:25,d:15};hall.viewSpan=14.8;hall.spawn={x:0,z:6};hall.view={x:0,z:0};
 const hallMove=p=>({...p,x:p.x*1.5,z:p.z*1.4});hall.furniture=HALL_FURNITURE.map(hallMove);hall.obstacles=[...hall.furniture];hall.sites=Object.fromEntries(Object.entries(hall.sites).map(([k,v])=>[k,{...v,target:hallMove(v.target)}]));hall.exits.upstairs.target=hallMove(hall.exits.upstairs.target);hall.stations.travel={x:0,z:6.2};hall.interactions=hall.interactions.map(hallMove);hall.interactions[0]={kind:'travel',x:0,z:6.6,r:.6};
 const dorm=MAPS.dormitory;dorm.plan={w:22,d:14,outline:[[-11,-7],[11,-7],[11,5],[8,7],[-8,7],[-11,5]].map(([x,z])=>({x,z}))};dorm.radius=14;dorm.bounds={w:22,d:14};dorm.viewSpan=14.8;dorm.spawn={x:8.6,z:5.6};dorm.exits.travel.at={...hall.exits.upstairs.target};dorm.stations.travel={x:8.6,z:5.9};dorm.interactions=[{kind:'travel',x:8.6,z:6.25,r:.6}];
 dorm.rooms=DORM_ROOMS.map(r=>({...r,x:r.x*1.5,bedX:r.x*1.5-.7,z:-4,w:1.75,d:2.5,target:{x:r.x*1.5+.8,z:-1.25}}));dorm.walls=[...[-5.25,0,5.25].map(x=>({x,z:-3.3,w:.16,d:7.4,h:1.2})),...dorm.rooms.flatMap(r=>[-1,1].map(sign=>({x:r.x+sign*1.8,z:.4,w:1.5,d:.16,h:1.0})))];dorm.obstacles=[...dorm.walls,...dorm.rooms.flatMap(r=>[{x:r.bedX,z:r.z,w:r.w,d:r.d},{x:r.x+1.45,z:-5.5,w:.8,d:1.5}])];dorm.sites=Object.fromEntries(dorm.rooms.map(r=>[r.id,{label:r.label,target:r.target,text:r.label+'有独立的睡眠角落、书桌和飘窗，房间还没有安排入住。'}]));
 const museum=MAPS.museum;museum.plan={w:18,d:13,outline:[[-7,-6.5],[7,-6.5],[9,-4.5],[9,4.5],[6,6.5],[-6,6.5],[-9,4.5],[-9,-4.5]].map(([x,z])=>({x,z}))};museum.radius=12;museum.bounds={w:18,d:13};museum.viewSpan=14.8;museum.spawn={x:0,z:5.5};museum.stations.travel={x:0,z:5.8};museum.interactions[0]={kind:'travel',x:0,z:6.2,r:.6};
 for(const [id,dx,dz]of [['flowers',-1.6,-2],['alchemy',3.7,0],['fragments',-3.7,0]]){const d=museum.displays[id];d.target={x:d.target.x+dx,z:d.target.z+dz};d.cabinet={...d.cabinet,x:d.cabinet.x+dx,z:d.cabinet.z+dz};d.slots=d.slots.map(p=>({...p,x:p.x+dx,z:p.z+dz}));}
 museum.displays.flowers.slots=museum.displays.flowers.slots.map(p=>({...p,z:museum.displays.flowers.cabinet.z+.12}));museum.sites=Object.fromEntries(Object.entries(museum.displays).map(([id,d])=>[id,{label:d.label,target:d.target,text:'收藏会在这座拱廊里慢慢留下痕迹。'}]));museum.interactions=[museum.interactions[0],...Object.entries(museum.displays).map(([id,d])=>({kind:'visit',id,...d.cabinet}))];museum.obstacles=[...Object.values(museum.displays).map(d=>d.cabinet),{x:0,z:-.1,w:1.6,d:1.3}];
 // Keep architectural posts, nightstands and floor plants on the same collision registry as the artwork.
 home.plan.plants=[{x:7.1,z:-4.9,size:1.1},{x:11.1,z:-4.6,size:1.1},{x:11.2,z:.9,size:1.1},{x:8.3,z:-1.4,size:1.1},{x:-1.9,z:5.25,size:1},{x:1.9,z:5.25,size:1},{x:-4.2,z:4.6,size:.85},{x:-9.8,z:-1.8,size:.85},{x:4.7,z:-2.5,size:.85}];
 home.plan.arches.push({x:9.8,z:-4.7,w:4.1,h:3.7},{x:9.8,z:-1.5,w:4.1,h:3.7});
 home.obstacles.push(...Object.values(home.beds).flatMap(b=>[-1,1].map(sign=>({x:b.x+sign*(b.w/2+.35),z:b.z-1,w:.52,d:.54}))));
 hall.plan.arches=[-6,0,6].map(x=>({x,z:-2.6,w:4.4,h:4.5}));hall.plan.plants=[{x:-9.5,z:4.9,size:1.3},{x:7.8,z:-5.7,size:1.3},{x:7.6,z:5.7,size:1.3}];
 dorm.plan.arches=dorm.rooms.map(r=>({x:r.x,z:.4,w:2,h:3.3}));dorm.plan.plants=dorm.rooms.map(r=>({x:r.x-1.7,z:-5.8,size:.7}));
 museum.plan.arches=[-5.8,5.8].map(x=>({x,z:3.2,w:3.7,h:4.2}));museum.plan.plants=[[-7.4,4.5],[7.4,4.5],[-7,-5],[7,-5]].map(([x,z])=>({x,z,size:1.1}));
 for(const m of [home,hall,dorm,museum])m.obstacles.push(...m.plan.plants.map(p=>({x:p.x,z:p.z,r:.28*p.size})),...m.plan.arches.flatMap(a=>[-1,1].map(sign=>({x:a.x+sign*a.w/2,z:a.z,r:.16}))));
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
 garden.flowerbeds=garden.obstacles.filter(p=>p.id?.startsWith('flowerbed-'));
 garden.museum=shiftTree(oldGarden.museum,'museum');garden.seats=shiftTree(oldGarden.seats,'pond');garden.decor=shiftTree(oldGarden.decor,'home');garden.pathLamp=villagePoint(oldGarden.pathLamp,'home');
 garden.surfaces=oldGarden.surfaces.map((p,i)=>shiftTree(p,i===0?'museum':'pond'));
 garden.exits={...oldGarden.exits,hall:shiftTree(oldGarden.exits.hall,'hall'),museum:shiftTree(oldGarden.exits.museum,'museum')};
 garden.spawn=villagePoint(oldGarden.spawn,'pond');garden.view=villagePoint(START,'home');garden.radius=32;
 garden.asset='./village-ground.glb?v=fg-06cafed5415b1737';garden.decorAssets=[];
 garden.chunks=Object.entries(VILLAGE_ZONES).map(([id,d])=>({id,x:d.cx+d.x,z:d.cz+d.z,radius:d.radius,asset:'./village-'+id+'.glb'}));
 // A literal URL is required for every asset so build-fairy-garden fingerprints references.
 const districtAssets=['./village-home.glb?v=fg-06cafed5415b1737','./village-hall.glb?v=fg-06cafed5415b1737','./village-neighbor1.glb?v=fg-06cafed5415b1737','./village-neighbor2.glb?v=fg-06cafed5415b1737','./village-neighbor3.glb?v=fg-06cafed5415b1737','./village-pond.glb?v=fg-06cafed5415b1737','./village-museum.glb?v=fg-06cafed5415b1737'];
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
 // Lisa: keep the flowerbeds visible on the right of the cottage, with all activities following.
 const shiftPlot=p=>Object.assign(p,{x:p.x+8.4,z:p.z+.5});
 for(const p of garden.flowerbeds){p.former={x:p.x,z:p.z,w:p.w,d:p.d};shiftPlot(p);}
 for(const id of ['garden','note','sow'])shiftPlot(garden.stations[id]);
 for(const p of garden.interactions)if(p.kind==='garden')shiftPlot(p);
 shiftPlot(garden.decor.blooms);
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
 garden.chunks.push({id:'lake-far',x:18,z:-2,radius:12,asset:'./village-lake-far.glb?v=fg-06cafed5415b1737'});
 function migrateVillagePosition(p){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return p;let best='home',distance=Infinity;for(const [id,d]of Object.entries(VILLAGE_ZONES)){const dist=Math.hypot(p.x-d.cx,p.z-d.cz);if(dist<distance){best=id;distance=dist;}}return villagePoint(p,best);}
 // Northern woodland is one continuous extension, streamed in three small districts.
 garden.oldTower={x:0,z:-46,r:2.65,height:10.5,door:{x:0,z:-42.65},
  trail:[{x:7,z:-17},{x:8,z:-21},{x:8,z:-23},{x:5,z:-25},{x:0,z:-28},{x:1,z:-31},{x:4,z:-34},{x:3,z:-37},{x:0,z:-40},{x:0,z:-42.65}],
  woods:[{x:8,z:-23},{x:5,z:-25},{x:0,z:-28},{x:1,z:-31},{x:4,z:-34},{x:3,z:-37},{x:0,z:-40}],width:3.4,
  trees:[],rocks:[{x:-4.5,z:-43,r:.65},{x:4.6,z:-45,r:.85},{x:3.7,z:-49,r:.7}],
  chunks:[{id:'northwood-edge',x:0,z:-24,radius:16,asset:'./village-northwood-edge.glb?v=fg-06cafed5415b1737'},
   {id:'northwood-deep',x:0,z:-35,radius:16,asset:'./village-northwood-deep.glb?v=fg-06cafed5415b1737'},
   {id:'old-tower',x:0,z:-47,radius:15,asset:'./village-old-tower.glb?v=fg-06cafed5415b1737'}]};
 const ruin=garden.oldTower;
 const pathDistance=(x,z)=>Math.min(...ruin.trail.slice(1).map((b,i)=>{const a=ruin.trail[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);}));
 const woodlandZone=z=>z>-29?'northwood-edge':z>-40?'northwood-deep':'old-tower';
 for(let row=0;row<11;row++)for(let col=0;col<11;col++){
  const x=-14+col*2.8+Math.sin(row*13+col*7)*.83,z=-22-row*2.9+Math.cos(col*11+row)*.75;
  if(pathDistance(x,z)<2.65||Math.hypot(x-ruin.x,z-ruin.z)<6.6)continue;
  ruin.trees.push({x,z,r:.26,height:4.7+((row*7+col*3)%8)*.32,kind:(row+col)%3?'fir':'oak',zone:woodlandZone(z)});
 }
 ruin.thickets=[-1,1].map(sign=>({kind:'thicket',polygon:[{x:sign*15,z:-23},...ruin.woods.map(p=>({x:p.x+sign*ruin.width/2,z:p.z})),{x:sign*15,z:-40}]}));
 garden.radius=55;garden.walkRegions=[{x:0,z:0,r:32},{polygon:[{x:-15,z:-22},{x:15,z:-22},{x:15,z:-54},{x:-15,z:-54}]}];
 // A gated side clearing leaves the established observatory trail open.
 ruin.clearing={x:8.45,z:-34,w:6.5,d:2.8};
 ruin.thickets[1].except={...ruin.clearing};
 ruin.trees=ruin.trees.filter(t=>Math.abs(t.x-ruin.clearing.x)>ruin.clearing.w/2+1.7||Math.abs(t.z-ruin.clearing.z)>ruin.clearing.d/2+1.7);
 ruin.fallenTree={x:6.5,z:-34,w:.7,d:2.8,opensWith:'fallenTree',approach:{x:5.4,z:-34},beyond:{x:9.8,z:-34}} ;
 garden.obstacles.push(ruin.fallenTree);
 garden.sites.fallenTree={label:'倒树后的林间空地',target:ruin.fallenTree.approach,text:'旁边仍是通往旧塔的泥路。这条支路被倒树封住，树根间透着一点微光。'};
 garden.interactions.push({kind:'visit',id:'fallenTree',...ruin.fallenTree.approach,r:.55});
 // 倒树【那一侧】和倒树【后面】是两处：fallenTree 站的是树这边，空地在四米开外，
 // 够不到 whereLabel 的四米二，于是岛上那个毛病它也有一份。
 garden.sites.clearing={label:'倒树后的空地',target:{...ruin.fallenTree.beyond},opensWith:ruin.fallenTree.opensWith,text:'倒树被抬起来之后，后面是一小片没人来过的空地。'};
 garden.interactions.push({kind:'visit',id:'clearing',...ruin.fallenTree.beyond,r:.55});
 garden.chunks.push({id:'fallen-tree',x:8.45,z:-34,radius:5,asset:'./opening-fallen-tree.glb?v=fg-06cafed5415b1737'});
 garden.obstacles.push(...ruin.thickets,...ruin.trees.map(({x,z,r})=>({x,z,r})),{x:ruin.x,z:ruin.z,r:ruin.r},...ruin.rocks);
 garden.chunks.push(...ruin.chunks);
 garden.sites.oldTower={label:'林尽头的旧塔',target:ruin.door,text:'小道在旧塔前停下来。石拱门被藤蔓和旧锁封着，里面还没有开放。'};
 garden.sites.hiddenPath={label:'隐蔽林间小道',target:ruin.trail[1],text:'树枝把入口遮住了一半，泥路在深林里拐了几个弯。沿着它走，可以找到旧塔。'};
 garden.interactions.push({kind:'visit',id:'oldTower',...ruin.door,r:.75},{kind:'visit',id:'hiddenPath',...ruin.trail[1],r:.6});
 // Southern railway stop: art, walkable platform and all solid props share this plan.
 garden.station={
  approach:[{x:-5,z:22},{x:-7,z:26},{x:-7,z:30},{x:-4,z:34},{x:0,z:36.4}],
  platform:{x:0,z:39,w:15,d:5.2,height:.18},step:{x:0,z:36.25,w:4,d:.3,height:.13},
  canopy:{x:.8,z:38.4,w:11.8,d:3.4,eave:3.55,rise:1.05},
  booth:{x:-5.3,z:38.1,w:2.6,d:2.3,h:2.65},
  benches:[{x:-1.6,z:38.3,w:2.4,d:.65},{x:3.2,z:38.3,w:2.4,d:.65}],
  posts:[...[-3.8,1,5.8].flatMap(x=>[37.1,39.7].map(z=>({x,z,r:.12})))],
  planters:[{x:-7,z:40.5,w:.65,d:1.3},{x:7,z:37.5,w:.65,d:1.3}],
  luggage:{x:5.9,z:39.4,w:1.15,d:.75},
  track:{x:0,z:43.2,w:36,d:3.2},fence:{x:0,z:41.75,w:36,d:.14},
  trees:[],target:{x:.6,z:40.65},
  chunks:[{id:'station-lane',x:-5,z:29,radius:9,asset:'./village-station-lane.glb?v=fg-06cafed5415b1737'},
   {id:'station',x:0,z:43.5,radius:18.5,asset:'./village-station.glb?v=fg-06cafed5415b1737'}]
 };
 const stop=garden.station,railwayZ=x=>stop.track.z+Math.max(0,Math.abs(x)-8)**2*.025;
 stop.track.points=Array.from({length:121},(_,i)=>{const x=-18+36*i/120;return {x,z:railwayZ(x)};});
 for(let i=0;i<9;i++)for(const side of [-1,1]){const x=side*(11.5+(i%3)*2.3),railZ=railwayZ(x);let z=31+i*2.1;if(Math.abs(z-railZ)<2.8)z=railZ+(z<railZ?-3:3);stop.trees.push({x,z,r:.22,height:3.8+(i%4)*.45});}
 for(const q of [{x:-10,z:25},{x:-3.6,z:27},{x:-10.5,z:29},{x:-2.5,z:30},{x:-8.5,z:33},{x:1.8,z:33}])stop.trees.push({...q,r:.20,height:4.3});
 garden.walkRegions.push({polygon:[{x:-18,z:26},{x:18,z:26},{x:18,z:49},{x:-18,z:49}]});
 garden.surfaces.push(stop.platform,stop.step);
 garden.obstacles.push(stop.booth,...stop.benches,...stop.posts,...stop.planters,stop.luggage,stop.track,stop.fence,...stop.trees.map(({x,z,r})=>({x,z,r})));
 garden.chunks.push(...stop.chunks);
 garden.sites.railway={label:'林边车站',target:stop.target,text:'弧形雨棚下有长椅和旧站钟，铁轨在林子深处转了弯。车站可以逛了，列车还没有开通。'};
 garden.interactions.push({kind:'visit',id:'railway',...stop.target,r:.7});
 // The first neighbour's attic shares its floor plan with the art builder and routing.
 const attic={name:'星图阁楼',interior:true,renderer:'glb',asset:'./neighbor1-interior.glb?v=fg-06cafed5415b1737',background:'#cbc8c2',light:2.1,radius:13,bounds:{w:20,d:15},viewSpan:13.8,floor:.14,view:{x:0,z:0},spawn:{x:0,z:5.9},
 plan:{w:19,d:14,outline:[[-8,-6],[2,-6],[2,-7],[6,-7],[8,-5],[8,4],[5,6],[2,6],[2,7],[-2,7],[-2,6],[-8,6],[-9,4],[-9,-3]].map(([x,z])=>({x,z})),arches:[],plants:[{x:-7.7,z:4.4,size:1},{x:6.5,z:3.5,size:1.1}]},
 surfaces:[{x:-5,z:-1.4,w:3,d:.4,height:.26},{x:-5,z:-1.8,w:3,d:.4,height:.38},{x:-4.6,z:-4,w:6.6,d:4,height:.5}],
 walls:[{x:-7.4,z:-2,w:1.2,d:.18,h:.9},{x:-2.4,z:-2,w:2.2,d:.18,h:.9}],
 furniture:[{kind:'hearth',x:-8,z:1,w:1.12,d:2.55},{kind:'sofa',x:-4.4,z:.6,w:2.8,d:1.05},{kind:'table',x:-4.4,z:2.35,w:1.85,d:1},{kind:'armchair',x:-2.2,z:2.4,w:1,d:1,heading:Math.PI/2},{kind:'desk',x:4,z:-5.6,w:2.7,d:1.05},{kind:'chair',x:4,z:-4.25,w:.7,d:.75,heading:Math.PI},{kind:'shelf',x:7.15,z:-1.5,w:.7,d:4.2},{kind:'roundtable',x:3.5,z:1.8,w:1.5,d:1.3},{kind:'armchair',x:3.5,z:3.25,w:.85,d:.85,heading:Math.PI},{kind:'armchair',x:3.5,z:.35,w:.85,d:.85},{kind:'console',x:-.7,z:-5.35,w:.7,d:1.6}],
 displayBeds:[{x:-5,z:-4.3,w:2.7,d:2.7,palette:'sage',base:.5}],
 stations:{travel:{x:0,z:6.35}},
 sites:{hearth:{label:'炉边会客角',target:{x:-5.8,z:3.5},text:'炉火照着软椅和旧织毯，窗外的树影慢慢摇。'},study:{label:'星图工作台',target:{x:2,z:-4.2},text:'凸窗下铺着星图，铜仪和空白笔记等着屋主回来。'},bedroom:{label:'半层睡眠间',target:{x:-3,z:-2.8},text:'两级宽台阶通向帷幔后的床铺。这间邻居屋还没有安排入住。'},tea:{label:'窗边茶桌',target:{x:5.2,z:1.8},text:'两张椅子朝着同一张小圆桌，茶杯留在桌上。'}},interactions:[{kind:'travel',x:0,z:6.7,r:.6}],obstacles:[]};
 // Rotated furniture keeps its actual outline, so diagonal shelves do not block empty corners.
 function furnitureFootprint(q){
  const h=q.heading||0,c=Math.cos(h),s=Math.sin(h);if(Math.abs(s)<1e-8)return {...q};
  if(Math.abs(c)<1e-8)return {...q,w:q.d,d:q.w};
  const {w,d,...meta}=q;return {...meta,polygon:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:q.x+a*w/2*c-b*d/2*s,z:q.z+a*w/2*s+b*d/2*c}))};
 }
 // The market's visible stalls and navigation footprints have one source of truth.
 garden.market={
  stalls:[{id:'marketHerbs',label:'月露药草棚',x:-4.7,z:-6.7,w:2.9,d:1.8,kind:'herbs',heading:0},{id:'marketCurios',label:'星砂奇物摊',x:2.8,z:-6.7,w:2.8,d:1.8,kind:'curios',heading:0},{id:'marketTea',label:'铜壶茶摊',x:4.5,z:-1.8,w:2.7,d:1.6,kind:'tea',heading:Math.PI/2},{id:'marketFlowers',label:'铃叶小花车',x:-4.8,z:-1.1,w:2.2,d:1.45,kind:'flowers',heading:-Math.PI/2}],
  poles:[{x:-6.5,z:-8.3,r:.12},{x:4.9,z:-8.3,r:.12},{x:6.1,z:.2,r:.12},{x:-6.4,z:.8,r:.12}],
  paving:{x:-.3,z:-4,w:13.8,d:10.2}
 };
 garden.obstacles=garden.obstacles.filter(q=>!q.id?.startsWith('legacy-market-'));
 garden.obstacles.push(...garden.market.stalls.map(furnitureFootprint),...garden.market.poles);
 Object.assign(garden.sites.market,{label:'灯串集市',text:'灯串下散着药草棚、奇物摊、茶摊和小花车。替村里做过事，摊主就来了，功绩在这儿换东西。'});
 for(const q of garden.market.stalls){
  const h=q.heading||0,reach=q.d/2+.65,target={x:q.x-Math.sin(h)*reach,z:q.z+Math.cos(h)*reach};
  garden.sites[q.id]={label:q.label,target,text:q.label+'的东西已经摆好了，眼下可以走近看看。'};
  garden.interactions.push({...furnitureFootprint(q),kind:'visit',id:q.id});
 }
 garden.chunks.push({id:'market',x:-.3,z:-4,radius:8,asset:'./village-market.glb?v=fg-06cafed5415b1737'});
 function connectInterior(id,m){
  MAPS[id]=m;const target=garden.sites[id].target;
  m.exits={travel:{to:'garden',at:{...target},label:'走出'+m.name}};
  m.obstacles=[...(m.walls||[]).map(furnitureFootprint),...(m.plan.posts||[]).map(p=>({x:p.x,z:p.z,r:p.r})),...m.furniture.map(furnitureFootprint),...m.displayBeds.flatMap(b=>[{x:b.x,z:b.z,w:b.w,d:b.d},...[-1,1].map(sign=>({x:b.x+sign*(b.w/2+.35),z:b.z-1,w:.52,d:.54}))]),...m.plan.plants.map(p=>({x:p.x,z:p.z,r:p.size*.28})),...m.plan.arches.flatMap(a=>[-1,1].map(sign=>({x:a.x+sign*a.w/2*Math.cos(a.heading||0),z:a.z+sign*a.w/2*Math.sin(a.heading||0),r:.20})))];
  m.interactions.push(...Object.entries(m.sites).map(([id,s])=>({kind:'visit',id,...s.target,r:.45})));
  garden.exits[id]={to:id,action:'door',label:'走进'+m.name,target:{...target}};
  garden.interactions=garden.interactions.map(p=>p.id===id?{...p,kind:'door'}:p);
  garden.sites[id].text=m.entryText||m.name+'已经可以进去看看；还没有安排角色入住。';
 }
 connectInterior('neighbor1',attic);
 const tower={name:'苔灯书塔',interior:true,renderer:'glb',asset:'./neighbor2-interior.glb?v=fg-06cafed5415b1737',background:'#cacbbd',light:2.1,radius:13,bounds:{w:21,d:15},viewSpan:13.8,floor:.14,view:{x:-2,z:0},spawn:{x:-2,z:6.15},
 plan:{w:20,d:14,tallWalls:[4,5,15],outline:[[-3,-7.1],[-.7,-6.7],[1.3,-5.6],[3.4,-4],[8,-4],[10,-2],[10,2],[8,4],[3.4,4],[1.3,5.1],[0,5.7],[0,7],[-4,7],[-4,5.9],[-6.3,5],[-8.2,3.3],[-9.25,1.1],[-9.5,-1.3],[-8.65,-3.7],[-7,-5.6],[-5.1,-6.7]].map(([x,z])=>({x,z})),arches:[{x:3.4,z:0,w:2.7,h:3.4,heading:Math.PI/2}],plants:[{x:-5.8,z:4.2,size:1.15},{x:8.5,z:-3.1,size:.9},{x:1.5,z:4.25,size:.8}]},
 walls:[{x:3.4,z:-2.675,w:.18,d:2.65,h:1.2},{x:3.4,z:2.675,w:.18,d:2.65,h:1.2}],surfaces:[],
 furniture:[...[-170,-140,-110,-80,-50].map(degrees=>{const a=degrees*Math.PI/180;return {kind:'bookcase',x:-3+Math.cos(a)*5.35,z:-.5+Math.sin(a)*5.35,w:1.95,d:.6,h:3.45,heading:a+Math.PI/2};}),{kind:'roundtable',x:-3,z:-1,w:2.3,d:2.3},{kind:'armchair',x:-3,z:.95,w:1,d:1,heading:Math.PI},{kind:'armchair',x:-5,z:-1,w:1,d:1,heading:-Math.PI/2},{kind:'desk',x:-6.2,z:2.7,w:2.1,d:1.1},{kind:'chair',x:-6.2,z:1.4,w:.7,d:.8},{kind:'stove',x:.65,z:2.8,w:1.2,d:1.2},{kind:'chest',x:6.8,z:3.15,w:2.1,d:.7}],
 displayBeds:[{x:7,z:-.6,w:2.7,d:2.7,palette:'rose',base:.14}],stations:{travel:{x:-2,z:6.5}},
 sites:{books:{label:'弧形书廊',target:{x:-5.8,z:-3.2},text:'书柜顺着圆塔的墙排开，书脊间夹着草叶和借阅便笺。'},reading:{label:'圆桌阅读区',target:{x:-1.15,z:.8},text:'厚书摊在绿毯中央的小桌上，旁边留了两张软椅。'},writing:{label:'窗下抄写桌',target:{x:-4.65,z:2.7},text:'羊皮纸旁搁着一支羽毛笔，墨瓶盖还没有拧紧。'},bedroom:{label:'圆窗卧室',target:{x:7,z:1.6},text:'拱门另一侧是独立卧室，圆窗映着林子的光。这间屋子还没有安排入住。'},stove:{label:'铜顶瓷炉',target:{x:1.9,z:2.7},text:'小瓷炉温着一壶水，铜罩被炉火映得发亮。'}},interactions:[{kind:'travel',x:-2,z:6.8,r:.6}],obstacles:[]};
 connectInterior('neighbor2',tower);
 const greenhouse={name:'铃叶花舍',interior:true,renderer:'glb',asset:'./neighbor3-interior.glb?v=fg-06cafed5415b1737',background:'#d6d5c5',light:2.1,radius:15,bounds:{w:24,d:16},viewSpan:13.8,floor:.14,view:{x:0,z:0},spawn:{x:0,z:6.2},
 plan:{w:23,d:15,outline:[[-9,-6.7],[-2,-6.7],[-2,-5.5],[2.6,-5.5],[8.8,-5.5],[11,-3.3],[11,3.6],[8.8,5.5],[2.1,5.5],[2.1,7],[-2.1,7],[-2.1,5.7],[-8.5,5.7],[-9.5,4],[-9.5,-3.5]].map(([x,z])=>({x,z})),lowWalls:[4,5],posts:[{x:2.9,z:-5.3,height:3.8,r:.055},{x:2.9,z:3.3,height:3.8,r:.055},...[-3,.2,3.3].map(z=>({x:10.65,z,height:3.8,r:.055}))],arches:[{x:-5.5,z:-1.6,w:2.5,h:3.3},{x:2.6,z:-.2,w:4,h:3.65,heading:Math.PI/2}],plants:[{x:4.1,z:-4.7,size:1.3},{x:9.3,z:-3.5,size:1.6},{x:10,z:0,size:1.2},{x:9.3,z:4.3,size:1.3},{x:3.6,z:4.2,size:1},{x:-8.1,z:4.35,size:.9}]},
 walls:[{x:-7.875,z:-1.6,w:2.25,d:.18,h:1.1},{x:-1.325,z:-1.6,w:5.85,d:.18,h:1.1}],surfaces:[],
 furniture:[{kind:'hearth',x:-8.5,z:.7,w:1.12,d:2.55},{kind:'sofa',x:-5.2,z:.65,w:2.7,d:1.05},{kind:'table',x:-5.2,z:2.45,w:1.8,d:.95},{kind:'armchair',x:-2.9,z:2.45,w:1,d:1,heading:Math.PI/2},{kind:'potting',x:6.5,z:-4.3,w:3,d:1.1},{kind:'potting',x:6.5,z:-1.5,w:2.8,d:1.05},{kind:'roundtable',x:6.8,z:2.25,w:1.35,d:1.35},{kind:'armchair',x:5.25,z:2.25,w:.95,d:.95,heading:-Math.PI/2},{kind:'armchair',x:8.35,z:2.25,w:.95,d:.95,heading:Math.PI/2},{kind:'vanity',x:-.4,z:-3.7,w:2,d:.7},{kind:'chest',x:-7.9,z:-2.5,w:1.35,d:.6}],
 displayBeds:[{x:-5.5,z:-4.65,w:2.7,d:2.7,palette:'sage',base:.14}],stations:{travel:{x:0,z:6.5}},
 sites:{living:{label:'炉边起居角',target:{x:-4,z:3.85},text:'花纹靠垫和软毯围着小壁炉，花房的光落在茶几上。'},bedroom:{label:'铃叶卧室',target:{x:-5.5,z:-2.35},text:'帷幔后的卧室安安静静，床边摆着一只织物箱。屋子还没有安排入住。'},potting:{label:'花房种植台',target:{x:6.5,z:-2.9},text:'陶盆、枝条和园艺笔记摆在窗下，种植玩法以后再接。'},tea:{label:'花房茶角',target:{x:6.8,z:3.7},text:'两张软椅朝着小圆桌，身边都是叶影。'},dressing:{label:'梳洗角',target:{x:-.4,z:-2.6},text:'铜框镜子边留着小瓷罐，外衣可以搭在门边。'}},interactions:[{kind:'travel',x:0,z:6.8,r:.6}],obstacles:[]};
 connectInterior('neighbor3',greenhouse);
 // The old tower uses the same door, collision and companion-map links as the other interiors.
 const observatory={name:'旧塔观星室',interior:true,renderer:'glb',asset:'./old-tower-interior.glb?v=fg-06cafed5415b1737',background:'#b8c3c0',light:1.8,radius:12,bounds:{w:18,d:16},viewSpan:14.5,floor:.14,view:{x:0,z:-.4},spawn:{x:0,z:6.1},
  entryText:'旧锁已经卸下，塔里的石阶通向观星台。可以进去看看旧星仪和星图。',
  plan:{w:16,d:14.4,outline:Array.from({length:32},(_,i)=>({x:8*Math.cos(i*Math.PI/16),z:7.2*Math.sin(i*Math.PI/16)})),arches:[],plants:[{x:-6.6,z:2.5,size:1.1},{x:6.6,z:2.4,size:.8}],
   gallery:{x:0,z:-5.65,w:16,d:3.3,height:.78},stairs:{x:3.5,z:-3.2,w:2,d:1.6,count:4,rise:.16},
   windows:[{x:-2.88,z:-6.13,w:1.25,h:3.15,heading:-.40},{x:1.47,z:-6.56,w:1.5,h:3.4,heading:.185}],
   ribs:[{x:-6.4,z:-3.65,h:5.7},{x:-4.5,z:-5.9,h:6.6},{x:0,z:-7.08,h:6.8},{x:4.5,z:-5.9,h:5.6}]},
  walls:[{x:-2.45,z:-4,w:9.9,d:.16,h:.68},{x:5.9,z:-4,w:2.8,d:.16,h:.68},{x:2.5,z:-3.2,w:.12,d:1.6,h:.72},{x:4.5,z:-3.2,w:.12,d:1.6,h:.72}],
  furniture:[{kind:'orrery',x:0,z:-.6,w:3.3,d:3.3},{kind:'telescope',x:4.1,z:-5.6,w:2.1,d:2.1},{kind:'desk',x:-2.4,z:-5.75,w:3.1,d:1.05},{kind:'chair',x:-2.4,z:-4.65,w:.75,d:.75,heading:Math.PI,palette:'blue'},{kind:'bookcase',x:-6.4,z:-1.8,w:2.6,d:.65,h:2.4,heading:-Math.PI/2},{kind:'chest',x:5.7,z:1.2,w:1.5,d:.8,palette:'blue'},{kind:'lectern',x:-3.8,z:2.1,w:1.1,d:.8}],
  surfaces:[],displayBeds:[],stations:{travel:{x:0,z:6.65}},
  sites:{orrery:{label:'铜环星仪',target:{x:.1,z:1.7},text:'几层铜环套着一颗暗蓝色的星球，底座刻着磨损的刻度。'},telescope:{label:'残顶观测台',target:{x:2.3,z:-5.05},text:'宽石阶通到高处，旧望远镜朝着残缺穹顶留下的天空。'},charts:{label:'旧星图桌',target:{x:-.1,z:-5.4},text:'旧星图摊在长桌上，圆规压着卷起的一角。'},archive:{label:'弧墙残卷架',target:{x:-4.9,z:-1.8},text:'书架贴着旧石墙，纸卷之间留着几处空位。'},trunk:{label:'观测行囊',target:{x:4.3,z:1.2},text:'铜扣木箱和旧工具留在墙边，像有人还会回来。'}},
  interactions:[{kind:'travel',x:0,z:6.85,r:.6}],obstacles:[]};
 observatory.bounds.w=23;
 observatory.decorAssets=['./opening-tower-vines.glb?v=fg-06cafed5415b1737'];
 const balcony=observatory.plan.outline;
 observatory.plan.outline=[{x:10.4,z:-1.5},{x:10.4,z:1.5},{x:7.8,z:1.5},...balcony.slice(2,-1),{x:7.8,z:-1.5}];
 observatory.plan.vines={x:7.65,z:0,w:.34,d:2.85,opensWith:'towerVines',approach:{x:6.7,z:0},beyond:{x:9.3,z:0}};
 observatory.sites.towerVines={label:'藤蔓观景口',target:observatory.plan.vines.approach,text:'藤蔓遮住了旧塔侧面的观景口，叶缝外面是一片远林。'};
 const op=observatory.plan;
 for(let i=0;i<op.stairs.count;i++)observatory.surfaces.push({x:op.stairs.x,z:op.stairs.z+op.stairs.d/2-(i+.5)*op.stairs.d/op.stairs.count,w:op.stairs.w,d:op.stairs.d/op.stairs.count,height:observatory.floor+(i+1)*op.stairs.rise});
 observatory.surfaces.push(op.gallery);
 op.outerWalls=op.outline.flatMap((a,i)=>{const b=op.outline[(i+1)%op.outline.length],x=(a.x+b.x)/2,z=(a.z+b.z)/2;if(z>6.8&&Math.abs(x)<2)return [];return [{x,z,w:Math.hypot(b.x-a.x,b.z-a.z),d:.24,h:z<-4?(x>5.5?2.8:5.2+(i%3)*.28):x<-6?3.1:.42,heading:Math.atan2(b.z-a.z,b.x-a.x)}];});
 op.posts=[...op.ribs.map(q=>({...q,r:.13})),...[-1,1].map(sign=>({x:sign*1.45,z:6.82,r:.16}))];
 observatory.walls.push(...op.outerWalls);
 connectInterior('oldTower',observatory);
 observatory.obstacles.push(observatory.plan.vines,...[-1,1].map(sign=>({x:7.65,z:sign*1.58,r:.15})));
 // The reed deck is the common surface contract: its steps and landing exist only after casting.
 garden.lake.reedBridge={x:21.65,z:1.9,w:1.45,d:.9,opensWith:'reedBridge',approach:{x:21.65,z:3.15},beyond:{x:21.65,z:-2.55},deckWidth:1.45};
 const reed=garden.lake.reedBridge;garden.obstacles.push(reed);
 reed.steps=[{x:reed.x,z:2.75,w:reed.deckWidth,d:.32,height:.23,opensWith:reed.opensWith},{x:reed.x,z:2.43,w:reed.deckWidth,d:.34,height:.38,opensWith:reed.opensWith},{x:reed.x,z:2.10,w:reed.deckWidth,d:.34,height:.53,opensWith:reed.opensWith},{x:reed.x,z:-.50,w:reed.deckWidth,d:4.90,height:.68,opensWith:reed.opensWith}];
 reed.landing={x:22.45,z:-2.3,w:3.1,d:1.6,height:.68,opensWith:reed.opensWith};
 garden.surfaces.push(...reed.steps,reed.landing);
 garden.seats.island={x:22.55,z:-2.3,heading:0,companion:{x:23.35,z:-2.3},opensWith:reed.opensWith,label:'小岛上陪你坐着'};
 // 审计（她 2026-09-18：「哪些地方还没有动作只是纯看的也做了」）：小桥、两岸、车站雨棚、广场、倒树后的空地
 //   原来只有一句描述。坐得下的地方就坐——同一套座位（喝茶／翻书／他来坐旁边）。
 // ⚠️落点取 sites 那个点（本来就站得住），他坐的那一点在旁边七十五公分；倒树后那处跟 site 一样要先开路。
 Object.assign(garden.seats,{
  bridge:{x:garden.sites.bridge.target.x,z:garden.sites.bridge.target.z,heading:Math.PI/2,companion:{x:garden.sites.bridge.target.x,z:garden.sites.bridge.target.z+.75},label:'在溪上小桥陪你坐着'},
  lakeNorth:{x:garden.sites.lakeNorth.target.x,z:garden.sites.lakeNorth.target.z,heading:Math.PI,companion:{x:garden.sites.lakeNorth.target.x+.75,z:garden.sites.lakeNorth.target.z},label:'在月湖北岸陪你坐着'},
  lakeEast:{x:garden.sites.lakeEast.target.x,z:garden.sites.lakeEast.target.z,heading:-Math.PI/2,companion:{x:garden.sites.lakeEast.target.x,z:garden.sites.lakeEast.target.z+.75},label:'在月湖东岸陪你坐着'},
  railway:{x:garden.sites.railway.target.x,z:garden.sites.railway.target.z,heading:0,companion:{x:garden.sites.railway.target.x+.75,z:garden.sites.railway.target.z},label:'在车站雨棚下陪你坐着'},
  square:{x:garden.sites.square.target.x,z:garden.sites.square.target.z,heading:Math.PI,companion:{x:garden.sites.square.target.x+.75,z:garden.sites.square.target.z},label:'在广场上陪你坐着'},
  clearing:{x:garden.sites.clearing.target.x,z:garden.sites.clearing.target.z,heading:0,companion:{x:garden.sites.clearing.target.x+.75,z:garden.sites.clearing.target.z},opensWith:garden.sites.clearing.opensWith,label:'在倒树后的空地陪你坐着'}});
 garden.interactions.unshift({kind:'sit',id:'island',...reed.landing});
 garden.sites.reedBridge={label:'芦苇桥头',target:reed.approach,text:'芦苇后面隔着湖水，小岛上的柳枝垂在水面。'};
 // ⚠️岛上原来【没有名字】：whereLabel 照 sites 认地方，没有这一条的话，
 //   两个人在岛上碰见，村里的账上写的是「在林边村落碰见」（2026-09-18 查出来的）。
 //   opensWith 让它在桥编起来之前不许走过去——同一个键，visit 和 sit 共用（见 shutError）。
 garden.sites.island={label:'湖心小岛',target:{x:reed.landing.x,z:reed.landing.z},opensWith:reed.opensWith,text:'柳枝垂到水面上，岛上只容得下两个人坐着。'};
 garden.interactions.push({kind:'visit',id:'island',x:reed.landing.x,z:reed.landing.z,r:.5});
 garden.interactions.push({kind:'visit',id:'reedBridge',...reed.approach,r:.55});
 garden.chunks.push({id:'reed-bridge',x:reed.x,z:0,radius:5,asset:'./opening-reed-bridge.glb?v=fg-06cafed5415b1737'});
 // Downstream workshop: one shared plan drives geometry, doors and navigation.
 const creekEnd=garden.lake.creek.at(-1),millCreek=[];
 for(let i=0;i<=40;i++){const t=i*14.2/40;millCreek.push({x:creekEnd.x+t,z:creekEnd.z+.14*t+.275*(1-Math.cos(Math.min(t/4,1)*Math.PI))});}
 const millWaterZ=x=>creekEnd.z+.14*(x-creekEnd.x)+.275*(1-Math.cos(Math.min((x-creekEnd.x)/4,1)*Math.PI));
 garden.watermill={parts:[{x:38.5,z:7.3,w:5.2,d:5.4,h:3.8},{x:41.6,z:9.1,w:1.9,d:3.6,h:2.5}],door:{x:37.1,z:10.55},creek:millCreek,width:garden.lake.creekWidth,
  wheel:{x:41.6,z:millWaterZ(41.6),r:1.52,center:1.72,d:.64},culvert:{x:47.9,z:millWaterZ(47.9),w:1.8,d:2.1},
  approach:[{x:25.7,z:6.1},{x:29.4,z:6.5},{x:32.4,z:8},{x:34.7,z:9.8},{x:37.1,z:10.55}],
  trees:[{x:31.3,z:4.1,r:.22,h:4.1},{x:34.5,z:3.3,r:.23,h:4.7},{x:39.9,z:2.5,r:.27,h:5.1},{x:44.5,z:5.4,r:.22,h:4.3},{x:46.9,z:10,r:.23,h:4.5}],
  chunk:{id:'watermill',x:37,z:8.5,radius:13,asset:'./village-watermill.glb?v=fg-06cafed5415b1737'}};
 const mill=garden.watermill;
 garden.walkRegions.push({polygon:[{x:28,z:-1},{x:49,z:-1},{x:49,z:20},{x:28,z:20}]});
 garden.obstacles.push(...mill.parts,...mill.trees,mill.culvert,{x:mill.wheel.x,z:mill.wheel.z,w:mill.wheel.r*2,d:mill.wheel.d},
  {polygon:[...mill.creek.map(p=>({x:p.x,z:p.z-mill.width/2})),...mill.creek.slice().reverse().map(p=>({x:p.x,z:p.z+mill.width/2}))]});
 garden.chunks.push(mill.chunk);
 garden.sites.watermill={label:'溪畔水磨坊',target:{...mill.door},text:'水从木轮下流过，屋里晾着草药。'};
 garden.interactions.push({kind:'door',id:'watermill',...mill.door,r:.65});
 const workshop={name:'水磨草药工坊',interior:true,renderer:'glb',asset:'./watermill-interior.glb?v=fg-06cafed5415b1737',background:'#cec9b9',light:2,radius:15,bounds:{w:23,d:16},viewSpan:15.5,floor:.14,view:{x:0,z:0},spawn:{x:0,z:6.1},
  entryText:'木水轮旁的小门通向草药工坊，可以进去参观研磨台和晾草廊。',
  plan:{w:22,d:15,outline:[[-10,-6.5],[6.5,-6.5],[6.5,-5.1],[10,-5.1],[10,3.8],[7.8,5.4],[2,5.4],[2,7],[-2,7],[-2,5.4],[-10,5.4]].map(([x,z])=>({x,z})),arches:[],posts:[-9.5,-5.4,-.5,5.8].map(x=>({x,z:-6.27,height:3.86,r:.10,timber:true})),plants:[{x:-8.9,z:4.2,size:1.1},{x:8.5,z:3.2,size:1.15}],lowWalls:[3,4]},
  walls:[],surfaces:[],displayBeds:[],
  furniture:[{kind:'millstone',x:-6.7,z:-3.7,w:3.5,d:3.5},{kind:'dryingrack',x:-1.9,z:-5.5,w:4,d:1.2},{kind:'apothecary',x:4.5,z:-5.8,w:2.6,d:.6,h:2.7},{kind:'island',x:-1.8,z:-.5,w:4,d:1.4},{kind:'distiller',x:7.4,z:-2.5,w:2.3,d:2.4},{kind:'potting',x:5.9,z:1.4,w:2.8,d:1.15},{kind:'desk',x:-6.5,z:2.9,w:2.3,d:1},{kind:'chair',x:-6.5,z:1.65,w:.75,d:.75,palette:'sage'},{kind:'chest',x:3,z:4.2,w:1.8,d:.7,palette:'sage'}],
  stations:{travel:{x:0,z:6.5}},
  sites:{grinding:{label:'石磨研磨区',target:{x:-4.1,z:-2.5},text:'木齿轮托着厚石磨，磨槽边留着草叶的碎屑。'},drying:{label:'横梁晾草架',target:{x:-1.9,z:-3.9},text:'小捆草药按颜色挂开，纸签在枝叶间露出一角。'},workbench:{label:'草药长工作台',target:{x:-1.8,z:1.1},text:'陶罐和铜秤摆在长台上，留着很宽的配药位置。'},distilling:{label:'铜壶蒸馏角',target:{x:5.4,z:-2.2},text:'弯曲的铜管绕向玻璃收集瓶。可以把材料放进去蒸馏，过几个游戏小时再回来取。'},window:{label:'临溪种植台',target:{x:5.9,z:2.6},text:'光照进窗边的陶盆，远处水声穿过木轮。'},journal:{label:'配方抄写桌',target:{x:-4.7,z:2.8},text:'一页药草笔记摊在桌上，旁边压着干燥的叶片。'}},
  interactions:[{kind:'travel',x:0,z:6.8,r:.6}],obstacles:[]};
 connectInterior('watermill',workshop);
 workshop.stations.mill=workshop.sites.workbench.target;
 workshop.interactions.unshift({kind:'mill',...workshop.sites.workbench.target,r:.7},{kind:'mill',...workshop.sites.grinding.target,r:.65},{kind:'mill',...workshop.sites.distilling.target,r:.65});
 const ACTIVITIES={workshop:{map:'watermill',target:workshop.sites.workbench.target,label:'在水磨工坊帮忙照看材料',gesture:'read'},
 flowers:{map:'garden',target:MAPS.garden.stations.garden,label:'照料月光花',gesture:'water'},herbs:{map:'forest',target:{x:.1,z:2.48},label:'观察铃叶草',gesture:'gather'},mushrooms:{map:'forest',target:{x:2.6,z:.98},label:'寻找会发光的蘑菇',gesture:'gather'},pond:{map:'forest',target:{x:-.7,z:.6},label:'在池边观察水纹',gesture:'read'},
  // ⚠️原来它的落点在【公共厅门口】，和「看告示板」「在村里走走」几乎同一处——
  //   一格时间圈成一片活动范围之后，三格转的是同一圈（广场／集市），那就是换了个
  //   形式的单调；而且「翻看魔法笔记」的人会溜达去集市摊位，看着就不对。
  //   书本来就在厅里那排架子上，挪进去既更对，也把那一圈分开了。
  study:{map:'hall',target:MAPS.hall.sites.books.target,label:'翻看魔法笔记',gesture:'read'},
  potion:{map:'garden',target:MAPS.garden.stations.brew,label:'研究炼药锅里的微光',gesture:'read'},glow:{map:'forest',target:{x:1.7,z:3},label:'等草丛里的萤光亮起来',gesture:'rest'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'在屋前歇脚',gesture:'rest'},rain:{map:'garden',target:MAPS.garden.stations.rest,label:'在屋檐下听雨',gesture:'read'},star:{map:'garden',target:MAPS.garden.stations.star,label:'看看星铃花的新芽',gesture:'read'},dive:{map:'garden',target:MAPS.garden.stations.well,label:'在井口往下看看',gesture:'read'},
  // v69.55 补：她那一路做出来的地方，他原来一个都够不着（公告栏、收藏馆、水边、集市、桥、许愿树、邻居屋）
  board:{map:'garden',target:MAPS.garden.stations.board,label:'看看告示板上贴了什么',gesture:'read'},
  museum:{map:'museum',target:{x:0,z:-1.6},label:'走进收藏馆，看你留下的那些东西',gesture:'read'},
  bottle:{map:'garden',target:MAPS.garden.stations.bottle,label:'在月潭边看水面上漂着什么',gesture:'read'},
  market:{map:'garden',target:{x:MAPS.garden.market.paving.x,z:MAPS.garden.market.paving.z},reach:6,label:'到灯串集市走走',gesture:'rest'},
  bridge:{map:'garden',target:MAPS.garden.sites.bridge.target,label:'坐在溪上小桥上',gesture:'sit'},
  wish:{map:'forest',target:MAPS.forest.sites.wishingTree.target,label:'去林后那棵许愿树下站一会儿',gesture:'rest'},
  neighbor:{map:'garden',target:MAPS.garden.sites.neighbor1.target,label:'到邻居屋门前转转',gesture:'rest'},
  hall:{map:'hall',target:MAPS.hall.sites.hearth.target,label:'在公共厅的炉边坐着',gesture:'read'},
  walk:{map:'garden',target:MAPS.garden.sites.square.target,label:'在村里走走',gesture:'rest'},
  // 吃饭这件事 codex 建了一整套（食材、食谱、加成、夜市摊），可他一天不吃一口。
  // ⚠️他不动她篮子里的东西：这一格只是【他坐在餐桌边】——她来吃的时候他在跟前，
  //   eat() 里「他在跟前就是一起吃的」那一条自己就成立了。
  meal:{map:'home',target:MAPS.home.sites.kitchen.target,label:'在餐桌边坐一会儿',gesture:'rest'},
  // 邻居回自己屋里。⚠️这一格【只有住在村里的人成立】（ACTIVITY_WHEN 里那一条），
  //   落点由 homeFor 换成 TA 自己那间屋——三间屋 codex 盖了十几处，
  //   住在里面的人原来一次都没进去过。
  indoors:{map:'garden',target:MAPS.garden.sites.neighbor1.target,label:'回自己屋里',gesture:'rest'},
  // 冬天湖面结冰，带路那十站里也写着「带她上冰面」，可他的日程里一格都没有。
  // ⚠️只有冬天成立——那道闸在 companion.mjs 的 ACTIVITY_WHEN（判据住在 world.mjs，
  //   rules.js 是它的上游，看不见）。
  ice:{map:'garden',target:{...MAPS.garden.lake.skateStart},label:'到结冰的湖面上站一会儿',gesture:'rest'},
  // v70.49 补：codex 这一季又长出来一批地方（车站、月湖两岸、林道、旧塔、小岛、倒树后的空地），
  // 他原来一个都够不着——和 v69.55 那次一模一样的形状，所以这一次连【怎么挑】也一起改了：
  // 地板表不再是手抄的一串 id，而是照这张表长的（见 companion.mjs 的 FLOOR_POOL）。
  // ⚠️opensWith＝这一处要先把路打开才去得了。名字借的是 codex 那边障碍物上已经在用的那个键，
  //   不另发明第二套说法；没打开的时候他不会被排到这儿，也就不会站在原地等一条不存在的小路。
  railway:{map:'garden',target:MAPS.garden.station.target,label:'在林边车站的雨棚下等一会儿',gesture:'sit'},
  lakeNorth:{map:'garden',target:MAPS.garden.sites.lakeNorth.target,label:'绕到月湖北岸看看对岸的村子',gesture:'read'},
  lakeEast:{map:'garden',target:MAPS.garden.sites.lakeEast.target,label:'沿着月湖东岸慢慢走',gesture:'rest'},
  hiddenPath:{map:'garden',target:MAPS.garden.sites.hiddenPath.target,label:'到隐蔽林道口看看',gesture:'rest'},
  tower:{map:'garden',target:MAPS.garden.sites.oldTower.target,label:'走到林尽头的旧塔底下',gesture:'read'},
  charts:{map:'oldTower',target:MAPS.oldTower.sites.charts.target,label:'在观星室翻旧星图',gesture:'read'},
  clearing:{map:'garden',target:MAPS.garden.oldTower.fallenTree.beyond,label:'到倒树后那片空地上待着',gesture:'rest',opensWith:'fallenTree'},
  // ⚠️落点取【登岸台的正中】，不是 seats.island.companion：那个位置是【她坐下时他挨着坐】的
  //   那一格，贴着台子边。他一个人过桥时会顺着 1.45 宽的芦苇桥边沿滑过去，落在台角外面
  //   三毫米的地方，然后「在原地等一条合适的小路」——实机跑了一遍才看见（2026-09-18）。
  island:{map:'garden',target:{x:MAPS.garden.lake.reedBridge.landing.x,z:MAPS.garden.lake.reedBridge.landing.z},label:'到湖心小岛上坐着',gesture:'sit',opensWith:'reedBridge'},
  // v70.77 审计（她 2026-09-18：「哪些动作没接上日程的也接了」）：她做得到的事里他一处都排不到的这四处——
  //   小路那盏灯、夜市（一季两晚，天黑那一格；companion.mjs 只在那两天排它）、自己家里面（原来只到屋前）、公共厅楼上。
  lamp:{map:'garden',target:MAPS.garden.stations.lamp,label:'到小路那盏灯下站一会儿',gesture:'rest'},
  fair:{map:'garden',target:MAPS.garden.sites.market.target,label:'去逛夜市',gesture:'rest'},
  living:{map:'home',target:MAPS.home.sites.living.target,label:'在自家壁炉边待着',gesture:'sit'},
  upstairs:{map:'dormitory',target:{x:.8,z:-1.25},reach:8.5,label:'上公共厅楼上看看那几间房',gesture:'rest'},
  // 换季那晚的灯会（v70.81）：不进抽签池，每季最后一晚天黑那一格钉在月潭栈桥（companion.mjs）
  festival:{map:'garden',target:MAPS.garden.stations.bottle,label:'到月潭栈桥放灯会的灯',gesture:'rest'}
 };
 // 旧塔那处藤蔓观景口也坐得下（审计补的：原来只有一句描述）
 MAPS.oldTower.seats={towerVines:{x:MAPS.oldTower.sites.towerVines.target.x,z:MAPS.oldTower.sites.towerVines.target.z,heading:Math.PI/2,companion:{x:MAPS.oldTower.sites.towerVines.target.x,z:MAPS.oldTower.sites.towerVines.target.z+.75},label:'在藤蔓观景口陪你坐着'}};
 // 他答应「我去某处等你」时能落实的地点（原来住在 world.mjs）。⚠️这张表是【唯一一份】：
 //   存档白名单（restoreCompanion）、游戏那头的 applyAction、写给模型的那句清单、
 //   手机那侧收回复时的白名单，四处都来问它——所以它住在两边都读得到的这一份里。
 // ⚠️只放【路一直是通的】那几处：芦苇桥、倒树那种要先开路的地方不进来，
 //   不然他答应得好好的，然后走到封口前面站住。
 // ⚠️tier＝处到哪一档才去得了（相处册，world.mjs 的 bondTier）：没写的就是一直开着的地板。
 const COMPANION_DESTINATIONS={pond:{map:'forest',target:{x:-.7,z:.6},label:'去池边坐一会儿'},garden:{map:'garden',target:MAPS.garden.stations.garden,label:'去看看月光花'},well:{map:'garden',target:MAPS.garden.stations.well,label:'去井边'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'回屋前等你'},
  // v70.49 补：codex 这一季长出来的地方，他一处都答应不了——她说「把新加的场景的动作交互也补上」
  market:{map:'garden',target:MAPS.garden.sites.market.target,label:'去灯串集市上等你',tier:1},
  lake:{map:'garden',target:MAPS.garden.sites.lakeNorth.target,label:'去月湖北岸',tier:1},
  hall:{map:'hall',target:MAPS.hall.sites.hearth.target,label:'去公共厅的炉边',tier:2},
  mill:{map:'watermill',target:MAPS.watermill.sites.workbench.target,label:'去水磨工坊等你',tier:2},
  railway:{map:'garden',target:MAPS.garden.station.target,label:'去林边车站的雨棚下',tier:3},
  tower:{map:'garden',target:MAPS.garden.sites.oldTower.target,label:'去林尽头的旧塔底下',tier:3}};
 // ── 礼物簿（她 2026-09-18：「做1和2」的 2）─────────────────────────────
 // 她能递给他的东西分七类。⚠️这张表【手机那侧和游戏这侧共用】：他的喜好按类别定
 //   （那一枪在手机那侧打），游戏这侧按类别结算；两边各抄一份就是同一层活在两处。
 // ⚠️这儿只有【类别】，没有「谁喜欢什么」：喜欢什么由他自己的人设长出来，不写在代码里。
 const GIFT_FAMILIES={flower:{label:'花',what:'月光花、星铃花，还有梦种长成的梦花'},dew:{label:'月露',what:'锅里炼出来、工坊蒸出来的月露'},herb:{label:'草木',what:'林地里采的铃叶草、荧光菇'},echo:{label:'回声一类',what:'井里带回的回声石，和用它做出来的东西'},dream:{label:'梦一类',what:'井里带回的梦屑，和用它做出来的东西'},sense:{label:'感官一类',what:'井里带回的感官晶，和用它做出来的东西'},relic:{label:'旧物一类',what:'井里带回的沉睡旧物、无名遗物，和修好、做出来的东西'},food:{label:'吃的',what:'夜市上买的、自家灶上做的：热茶、烤菇、糖、糕、汤圆、热汤、酒酿这些'}};
 const GIFT_STANCES={love:'真心喜欢',like:'挺喜欢',meh:'收下就收下',dislike:'不太想要'};
 // 一样一样地喜欢（她 2026-09-18：「每一档都单独吧」）。⚠️「怎么保证他不是什么都喜欢」：
 // 【分布由代码定】，模型只排先后——该加约束时掷轴，不掷答案（施工规则/bans-make-it-dumber.md）。
 // ⚠️放在 rules.js 是因为手机那侧和游戏那侧都要用同一张配额表；单子本身在 world.mjs（吃的在那儿）。
 const GIFT_ORDER=['love','like','meh','dislike'];
 function giftQuota(n){const total=Math.max(4,Math.min(400,Math.round(Number(n)||0)));
  const love=Math.max(1,Math.round(total*.18)),dislike=Math.max(1,Math.round(total*.18)),like=Math.max(1,Math.round(total*.26));
  return {love,like,dislike,meh:Math.max(1,total-love-like-dislike)};}
 // 他排好先后，代码照配额切：前几样算真心喜欢，最后几样算不太想要
 function stanceByRank(order,n=order.length){const quota=giftQuota(n),out={};let i=0;
  for(const stance of GIFT_ORDER)for(let k=0;k<quota[stance]&&i<order.length;k++,i++)out[order[i]]=stance;
  for(;i<order.length;i++)out[order[i]]='meh';return out;}
 const SEASONS=[
  {name:'春',tint:'#d8ecc0',dusk:1080,weather:{'晴日':45,'细雨':35,'薄雾':20}},
  {name:'夏',tint:'#afd08f',dusk:1140,weather:{'晴日':65,'细雨':25,'薄雾':10}},
  {name:'秋',tint:'#d4a16b',dusk:1020,weather:{'晴日':50,'细雨':20,'薄雾':30}},
  {name:'冬',tint:'#dfeaf0',dusk:960,weather:{'晴日':30,'细雪':50,'薄雾':20}}
 ];
 const seasonOf=day=>{const d=Math.max(1,Math.floor(Number(day)||1)),index=Math.floor((d-1)/14);return {...SEASONS[index%4],index,key:String(index),year:Math.floor(index/4)+1,day:(d-1)%14+1,start:index*14+1,end:index*14+14};};
 // A seeded daily draw: saved epoch + absolute day, independent of refresh, map and calls.
 const weather=(day,epoch='initial')=>{const d=Math.max(1,Math.floor(Number(day)||1));let h=2166136261;for(const ch of String(epoch)+':weather:'+d){h=Math.imul(h^ch.charCodeAt(0),16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;let draw=(h>>>0)/4294967296*100;for(const [kind,weight]of Object.entries(seasonOf(d).weather)){draw-=weight;if(draw<0)return kind;}return '晴日';};

 // Forms belong to the world; the text inside remains the original AI/user content.
 const WELL_CURIOS={shell:{name:'回声螺',color:'#9ddcdd'},seed:{name:'梦种',color:'#c2a2ee'},thread:{name:'留感丝',color:'#bfdc97'},relic:{name:'沉睡旧物',color:'#e7ba78'},rune:{name:'井纹残片',color:'#cee8f2'}};
 const WELL_TIDES={echo:{name:'回声潮',form:'shell',sign:'水滴落下后，井壁亮起一圈圈回声。'},dream:{name:'梦游潮',form:'seed',sign:'淡紫的光雾贴着水面，像没醒来的梦。'},weave:{name:'织光潮',form:'thread',sign:'细细的荧光丝挂在井沿和树根之间。'},old:{name:'旧日潮',form:'relic',sign:'石缝里的旧纹路泛起温暖的金光。'}};
 const WELL_KITS={none:{name:'空着手',form:null},bell:{name:'小铜铃',form:'shell'},pot:{name:'空种盆',form:'seed'},spool:{name:'绕线轴',form:'thread'},brush:{name:'软毛刷',form:'relic'}};
 const wellHash=key=>{let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;};
 const wellDraw=(weights,key)=>{let n=wellHash(key)*Object.values(weights).reduce((a,b)=>a+b,0);for(const [k,w]of Object.entries(weights)){n-=w;if(n<0)return k;}return Object.keys(weights).at(-1);};
 function wellTide(s){const day=Math.max(1,Math.floor(s?.day||1)),epoch=s?.epoch||'initial',season=seasonOf(day).index%4,w=weather(day,epoch),weights={echo:25,dream:25,weave:25,old:25};weights[['weave','echo','old','dream'][season]]+=18;if(w==='细雨')weights.echo+=20;if(w==='薄雾')weights.dream+=20;if(w==='细雪')weights.old+=16;const id=wellDraw(weights,epoch+':well-tide:'+day);return {id,...WELL_TIDES[id],day,weather:w};}
 function wellContext(s,depth=s.depth||1){const trip=s.map==='depths'&&s.wellTrip,day=trip?.day||s.day||1,kit=Object.hasOwn(WELL_KITS,trip?.kit||s.wellKit)?(trip?.kit||s.wellKit):'none',base={...s,day},tide=wellTide(base),key=(s.epoch||'initial')+':well-floor:'+day+':'+depth,ids=Object.keys(WELL_TIDES),anomaly=wellHash(key+':odd')<.16;let local=ids[Math.floor(wellHash(key)*ids.length)];if(anomaly)local=ids.filter(k=>k!==tide.id)[Math.floor(wellHash(key+':other')*3)];return {tide,local:{id:local,...WELL_TIDES[local]},anomaly,kit,day,depth};}
 function wellWeights(s,depth=s.depth||1){const c=wellContext(s,depth),weights={shell:20,seed:20,thread:20,relic:20};weights[c.tide.form]+=35;weights[c.local.form]+=c.anomaly?65:20;const f=WELL_KITS[c.kit].form;if(f)weights[f]+=18;return weights;}
 function wellFind(s,node){if(node.kind==='stone')return 'rune';const c=wellContext(s,node.depth);return wellDraw(wellWeights(s,node.depth),(s.epoch||'initial')+':well-find:'+c.day+':'+node.id);}
 function normalizePlan(raw,day){const season=seasonOf(day);if(!raw||!Array.isArray(raw.days)||raw.days.length!==14)throw Error('这一季需要完整的 14 天安排，可以重试。');const seen=new Set();const days=raw.days.map(d=>{if(!Number.isInteger(d.day)||d.day<1||d.day>14||seen.has(d.day)||!Array.isArray(d.activities)||d.activities.length!==3)throw Error('日期或活动数量没有对上，请重试这一季。');seen.add(d.day);return {day:d.day,note:String(d.note||'').slice(0,180),activities:d.activities.map(a=>{if(!a||!Object.hasOwn(ACTIVITIES,a.id))throw Error('有一项活动还不在这个世界里，请重试这一季。');return {id:a.id,note:String(a.note||'').slice(0,120)};})};}).sort((a,b)=>a.day-b.day);return {season:season.index,title:String(raw.title||'一起度过这一季').slice(0,60),days};}
 // 手指落在哪一样上。⚠️pad＝【手指宽容度】（她 2026-09-18：「他人在公告板前还是很难点到，
 // 范围能不能扩大点」）：判定圈是按【走到那儿算不算到了】定的，拿来当点击热区就太小了，
 // 何况他常常站在那样东西前面挡着。点的时候放宽一圈，走路和动作那两道闸照旧用原来的圈。
 function nearInteraction(map,p,depth,pad){const m=MAPS[map];if(!m)return null;
  const hit=hitInteraction(map,p,depth);if(hit||!(pad>0))return hit;
  let best=null,near=Infinity;
  for(const n of NODES)if(n.map===map&&(n.depth==null||n.depth===depth)){
   const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<.48+pad&&d<near){near=d;best={kind:'gather',id:n.id};}}
  for(const o of m.interactions){
   const d=o.r?Math.hypot(p.x-o.x,p.z-o.z)-o.r
    :Math.hypot(Math.max(0,Math.abs(p.x-o.x)-o.w/2),Math.max(0,Math.abs(p.z-o.z)-o.d/2));
   if(d<pad&&d<near){near=d;best=o;}}
  return best;}
 function hitInteraction(map,p,depth){const m=MAPS[map];if(!m)return null;const n=NODES.find(n=>n.map===map&&(n.depth==null||n.depth===depth)&&Math.hypot(n.x-p.x,n.z-p.z)<.48);if(n)return {kind:'gather',id:n.id};return m.interactions.find(o=>o.r?Math.hypot(p.x-o.x,p.z-o.z)<o.r:Math.abs(p.x-o.x)<o.w/2&&Math.abs(p.z-o.z)<o.d/2)||null;}
 root.FairyGardenRules={COMPANION_DESTINATIONS,GIFT_FAMILIES,GIFT_STANCES,GIFT_ORDER,giftQuota,stanceByRank,WELL_CURIOS,WELL_TIDES,WELL_KITS,wellTide,wellContext,wellWeights,wellFind,VILLAGE_ZONES,villagePoint,migrateVillagePosition,START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction,nearInteraction};
})(globalThis);
