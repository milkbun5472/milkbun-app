const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const clock=require('../js/schedule-clock.js'),weather=require('../js/world-weather.js'),maps=require('../js/map.js');
test('只读已有天气缓存与角色实际世界，预览和无资料不取现实天气',()=>{
 const at=new Date('2026-10-10T14:00:00Z').getTime();let reads=0;
 const world={id:'w1',name:'山城',regions:[{name:'北坡',terrain:'山地',nodes:[{name:'书院'}]}],pins:{fiction:'书院'}};
 const e={MapKit:maps,WorldWeather:weather,ScheduleClock:clock,loadJSON:key=>key==='x_worlds'?[world]:{},weatherCached:()=>{reads++;return {code:0,dayCode:65,ts:at};}};
 e.window=e;vm.createContext(e);vm.runInContext(fs.readFileSync('js/char-day.js','utf8'),e);
 const kit=e.CharDayKit;
 assert.equal(kit.sceneWeather({id:'real',tz:'0',home:{lat:49,lng:-97}},at).code,0);assert.equal(reads,1);
 assert.equal(kit.sceneWeather({id:'none',tz:'0'},at),null);assert.equal(kit.sceneWeather({id:'real',tz:'0',home:{lat:49,lng:-97}},at,true),null);assert.equal(reads,1);
 assert.equal(kit.sceneWeather({id:'fiction',tz:'0',home:{lat:49,lng:-97}},at).source,'world');assert.equal(reads,1);
 e.weatherCached=()=>({code:63,ts:at-3*3600000});assert.equal(kit.sceneWeather({id:'real',tz:'0',home:{lat:49,lng:-97}},at),null);
});
