const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/components.js','utf8'),a=source.indexOf('function publishWeatherCurrent('),b=source.indexOf('function WeatherWidget(',a);assert.ok(a>=0&&b>a);
test('换站时不发布上一站的雨，真实站只发布对应缓存，世界只发布已有结果',()=>{
 const window={dispatchEvent(e){assert.equal(e.type,'weather-current');}},current={code:0,dayCode:61,ts:123};
 const context={window,Date,CustomEvent:class{constructor(type){this.type=type;}},weatherCached:()=>current};vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 const place={key:'me',real:true,lat:10,lng:20};context.publishWeatherCurrent(place,{code:61,ts:100},false);assert.equal(window.__weatherCurrent.weather,null);
 context.publishWeatherCurrent(place,current,false);assert.equal(window.__weatherCurrent.weather,current);assert.equal(window.__weatherCurrent.weather.code,0);
 const world={key:'w:w1:北岭',real:false},w={code:61};context.publishWeatherCurrent(world,w,true);assert.equal(window.__weatherCurrent.key,world.key);assert.equal(window.__weatherCurrent.weather,w);
});
