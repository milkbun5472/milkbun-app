const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/char-day.js','utf8');
test('照片和天气跟画面同一个时钟取日期，不各算各的',()=>{const i=src.indexOf('function sceneWeather('),j=src.indexOf('function',i+20);assert.ok(i>0&&j>i,'抠不出 sceneWeather');assert.match(src.slice(i,j),/date=day\|\|frame\.day/);assert.match(src,/sceneWeather\(char,now,!!preview,payload\.minute,preview\?null:state\?\.day\)/);assert.match(src,/day:state\?\.day&&!demo&&!preview\?state\.day:/);});
test('没有日程时角色卡和画面都给去日历的按钮',()=>{assert.equal((src.match(/"去日历给TA排今天"/g)||[]).length,2);assert.match(src,/!st\.hasPlan && h\("button", \{ onClick: \(\) => props\.onSchedule\?\.\(c\)/);});
test('更多先放一起做的事，设置类收在最后',()=>{const a=src.indexOf('menuSection("一起做点什么"'),b=src.indexOf('menuSection("你们的小家"'),c=src.indexOf('menuSection("更多设置"');assert.ok(a>0&&b>a&&c>b);const together=src.slice(a,b);assert.match(together,/cdaykitchenopen/);assert.match(together,/cdayalbumopen/);assert.match(together,/cdayoutingsopen/);});
test('换地方只说改画面不改日历，界面不出现演和旧术语',()=>{assert.match(src,/只换小世界画面里这一段在哪儿，不改日历/);for(const w of ['改位置','改阶段','动作气质','摆位试玩','跟角色钟走'])assert.ok(!src.includes(w),w);});
