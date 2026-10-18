// 2026-10-18 起 char-day.js / fairy-garden.js 拆出 -core.js（开机那半）：读源码、跑沙盒都先带上 core
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=(fs.readFileSync('js/char-day-core.js','utf8')+'\n'+fs.readFileSync('js/char-day.js','utf8'));
test('照片和天气跟画面同一个时钟取日期，不各算各的',()=>{const i=src.indexOf('function sceneWeather('),j=src.indexOf('function',i+20);assert.ok(i>0&&j>i,'抠不出 sceneWeather');assert.match(src.slice(i,j),/date=day\|\|frame\.day/);assert.match(src,/sceneWeather\(char,now,!!preview,payload\.minute,preview\?null:state\?\.day\)/);assert.match(src,/day:state\?\.day&&!demo&&!preview\?state\.day:/);});
test('没有日程时角色卡和画面都给去日历的按钮',()=>{assert.equal((src.match(/"去日历给TA排今天"/g)||[]).length,2);assert.match(src,/!st\.hasPlan && h\("button", \{ onClick: \(\) => props\.onSchedule\?\.\(c\)/);});
test('更多先放一起做的事，设置类收在最后',()=>{const a=src.indexOf('menuSection("一起做点什么"'),b=src.indexOf('menuSection("你们的小家"'),c=src.indexOf('menuSection("更多设置"');assert.ok(a>0&&b>a&&c>b);const together=src.slice(a,b);assert.match(together,/cdaykitchenopen/);assert.match(together,/cdayalbumopen/);assert.match(together,/cdayoutingsopen/);});
test('换地方只说改画面不改日历，界面不出现演和旧术语',()=>{assert.match(src,/只换小世界画面里这一段在哪儿，不改日历/);for(const w of ['改位置','改阶段','动作气质','摆位试玩','跟角色钟走'])assert.ok(!src.includes(w),w);});
test('底栏中间键固定叫一起，此刻做什么写在小字里',()=>{const i=src.indexOf('"data-wk":"cdaylifeopen"'),j=src.indexOf('"data-wk":"cdayfollow"');assert.ok(i>0&&j>i,'抠不出中间键');const seg=src.slice(i,j+200);assert.equal((seg.match(/\},"一起",/g)||[]).length,3);assert.match(src,/const navButton=\(\{sub,\.\.\.attrs\},label,Icon,action,extra=\{\}\)=>/);for(const w of ['"走进来"','"约会"','"生活"'])assert.ok(!seg.includes(w),w);});
test('空档不再定格：白天按钟点在家歇、看书、喝茶，夜里睡觉，只换画面',()=>{
  const vm=require('node:vm'),ctx={console};ctx.window=ctx;ctx.root=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps/fairy-garden/day/catalog.js','utf8'),ctx);vm.runInContext(fs.readFileSync('js/char-day-link.js','utf8'),ctx);
  const L=ctx.CharDayLink,t0=Date.parse('2026-10-09T00:00:00Z'),spots=new Set();
  for(let h=0;h<12;h++){const v=L.resolve(null,t0+h*3600000,{minute:600,seed:'c1'});assert.equal(v.presentation.map,'dayHome');assert.ok(['rest','read','tea'].includes(v.presentation.spot));assert.equal(v.activitySlot,null);spots.add(v.presentation.spot);}
  assert.ok(spots.size>1,'白天会换着做');
  assert.equal(L.resolve(null,t0,{minute:120,seed:'c1'}).presentation.spot,'sleep');
  assert.equal(L.idleLabel(120),'在家睡着');assert.equal(L.idleLabel(600),'在家歇着');
  assert.match(src,/\.\.\.\(slot \? \[\] : \[visual\.presentation\?\.spot\]\)/);
});
test('空档按人设挑事：写明的爱好更常做，否定说法不算',()=>{
  const vm=require('node:vm'),ctx={console};ctx.window=ctx;ctx.root=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('apps/fairy-garden/day/catalog.js','utf8'),ctx);vm.runInContext(fs.readFileSync('js/char-day-link.js','utf8'),ctx);
  const L=ctx.CharDayLink;
  assert.deepEqual([...L.idleLikes('平时最爱窝在沙发看书，偶尔下厨')],['read','cook']);
  assert.deepEqual([...L.idleLikes('不爱看书，讨厌咖啡')],[]);
  const t0=Date.parse('2026-10-09T00:00:00Z'),count=likes=>{let n=0;for(let h=0;h<240;h++)if(L.resolve(null,t0+h*3600000,{minute:600,seed:'c1',likes}).presentation.spot==='cook')n++;return n;};
  assert.equal(count([]),0,'没写爱做饭就不去厨房');assert.ok(count(['cook'])>40,'写了爱做饭会常去厨房');
  assert.match(src,/likes:idleLikesOf\(char\?\.persona\)/);
});
test('此刻卡默认收起，详情点开才显示刚才/接下来/细条/地点',()=>{assert.match(src,/const \[nowMode, setNowMode\] = useState\("short"\), nowOpen = nowMode === "open";/);assert.match(src,/nowMode==="line"&&!showcase&&!trip \? h\("button",\{"aria-label":"展开此刻卡片"/);assert.match(src,/onClick:\(\)=>setNowMode\("line"\)/);assert.match(src,/flexDirection:"row",alignItems:"center",gap:3,whiteSpace:"nowrap"/);assert.match(src,/\(nowOpen\|\|showcase\|\|trip\) && !showcase && !trip && !!sceneNear && \(dayLine\(/);assert.match(src,/"aria-label":nowOpen\?"收起此刻详情":"展开此刻详情"/);assert.match(src,/maxHeight:nowOpen\?78:44,/);});
test('小相册每天自动存：开着看时每段存一张，打开相册自动补拍，同一段新图保留已写的念头',()=>{
  const i=src.indexOf('function mergePhotos('),j=src.indexOf('// Up to six stops',i);assert.ok(i>0&&j>i,'抠不出 mergePhotos');
  const merge=new Function(src.slice(i,j)+';return mergePhotos;')();
  const out=merge([{time:'09:00',src:'a',thought:'早'},{time:'12:00',src:'b'}],[{time:'09:00',src:'a2'},{time:'10:30',src:'c'}]);
  assert.deepEqual(out.map(p=>p.time),['09:00','10:30','12:00']);assert.equal(out[0].src,'a2');assert.equal(out[0].thought,'早');
  assert.match(src,/const albumAuto = !!char && homes\.albumAuto\?\.\[String\(char\.id\)\] !== false;/);
  assert.match(src,/shot\.key!==key\)return;\n\s*saveAlbum\(char\.id,day,cur=>\(\{\.\.\.\(cur\|\|\{\}\),photos:mergePhotos\(cur\?\.photos,\[/);
  assert.match(src,/albumFill\.current=tag;setAlbumOpen\(false\);/);
  assert.match(src,/role:"switch","aria-checked":albumAuto/);
  assert.match(src,/photos:\(cur\?\.photos\|\|photos\)\.map\(p=>\{const i=photos\.findIndex\(x=>x\.time===p\.time\)/);
});
test('上线前审计修补：照片进本机图库不进云、写入排队、换人清掉拍摄、补拍只补过去且每次打开一轮、停下保留已拍、挑人页按各自时钟',()=>{
  const i=src.indexOf('function saveAlbum('),j=src.indexOf('// One photo per stop',i);assert.ok(i>0&&j>i,'抠不出 saveAlbum');const save=src.slice(i,j);
  assert.match(save,/albumWrite\.catch\(\(\)=>\{\}\)\.then\(/);assert.match(save,/imgToVault\(p\.src\)/);
  assert.match(src,/const pick = value => \{setAlbumShoot\(null\);setAlbumOpen\(false\);setAlbumDay\(null\);/);
  assert.match(src,/albumRows\(state,\{pastOnly:true\}\)/);assert.match(src,/const tag=char\.id\+":"\+day;/);
  assert.match(src,/onClick:\(\)=>\{const done=albumShoot;setAlbumShoot\(null\);setPreview\(null\);if\(done\.photos\.length\)saveAlbum\(/);
  assert.match(src,/const st = dayState\(c, props\.plansFor\?\.\(c\) \|\| \{\}, now, clockOptions\(homes, c\.id\)\)/);
  assert.match(src,/src:albumImg\(ph\.src\)/);
});
