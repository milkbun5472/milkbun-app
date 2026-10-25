const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=fs.readFileSync('js/engine.js','utf8'),components=fs.readFileSync('js/components.js','utf8');
const grab=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
function harness(){
 let now=Date.now(),calls=0,response={ok:true,json:async()=>({current:{temperature_2m:9,weather_code:61,is_day:0,wind_speed_10m:31},daily:{temperature_2m_max:[15],temperature_2m_min:[2],weather_code:[61]}})};
 const store=new Map(),timers=new Map(),events=()=>{const listeners=new Map();return {addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},removeEventListener(k,f){listeners.get(k)?.delete(f);},emit(k){for(const fn of listeners.get(k)||[])fn();}};};
 const document={...events(),hidden:false},window=events(),RealDate=Date;
 class Clock extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const ctx={Date:Clock,AbortController,document,window,Map,Number,WorldWeather:require('../js/world-weather.js'),loadJSON:()=>({}),setTimeout,clearTimeout,setInterval(fn){const id=timers.size+1;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},fetch:async url=>{calls++;assert.match(url,/current=temperature_2m,weather_code,is_day,wind_speed_10m/);return response;}};
 vm.createContext(ctx);vm.runInContext(grab(engine,'function weatherCacheKey','function wxNowCode'),ctx);vm.runInContext(grab(components,'const weatherCurrentWatchers','function WeatherWidget('),ctx);
 return {ctx,store,timers,document,window,get calls(){return calls;},get now(){return now;},advance(ms){now+=ms;},response(r){response=r;},async tick(){for(const fn of timers.values())await fn();},flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('当前天气请求合并，所选地点15分钟刷新，失败退避且不续旧数据时间',async()=>{
 const h=harness();const results=await Promise.all([h.ctx.weatherFor(10,20,{maxAge:900000}),h.ctx.weatherFor(10,20,{maxAge:900000})]);assert.equal(h.calls,1);assert.equal(results[0],results[1]);assert.equal(results[0].isDay,false);assert.equal(results[0].windSpeed,31);
 h.advance(899999);await h.ctx.weatherFor(10,20,{maxAge:900000});assert.equal(h.calls,1);h.advance(1);await h.ctx.weatherFor(10,20,{maxAge:900000});assert.equal(h.calls,2);
 const stamp=h.ctx.weatherCached(10,20).ts;h.advance(900001);h.response({ok:false,status:503});const old=await h.ctx.weatherFor(10,20,{maxAge:900000});assert.equal(old.ts,stamp);await h.ctx.weatherFor(10,20,{maxAge:900000});assert.equal(h.calls,3);h.advance(60001);await h.ctx.weatherFor(10,20,{maxAge:900000});assert.equal(h.calls,4);
});
test('组件与小人共用一份刷新，后台停、前台补、最后一处卸载清理',async()=>{
 const h=harness(),place={key:'me',real:true,lat:10,lng:20},a=[],b=[];
 const stopA=h.ctx.watchWeatherCurrent(place,s=>a.push(s)),stopB=h.ctx.watchWeatherCurrent(place,s=>b.push(s));await h.flush();assert.equal(h.calls,1);assert.equal(h.timers.size,1);assert.equal(a.at(-1).weather.code,61);assert.equal(b.at(-1).known,true);
 h.document.hidden=true;h.advance(1900000);await h.tick();assert.equal(h.calls,1);h.document.hidden=false;h.document.emit('visibilitychange');await h.flush();assert.equal(h.calls,2);assert.equal(a.at(-1).known,true);
 stopA();assert.equal(h.timers.size,1);stopB();assert.equal(h.timers.size,0);
});
test('换站先未知，不借旧站；过期不冒充晴，温度／风／昼夜缺项保持未知',()=>{
 const h=harness(),place={key:'me',real:true,lat:10,lng:20};
 const now=h.ctx.weatherCurrentSnapshot(place,{ts:h.now,t:20,code:0,dayCode:61});assert.equal(now.known,true);assert.equal(now.weather.code,0);assert.equal(now.weather.isDay,undefined);
 assert.equal(h.ctx.weatherCurrentSnapshot(place,{ts:h.now-1800000,t:20,code:61}).known,false);
 assert.equal(h.ctx.weatherCurrentSnapshot(place,{ts:h.now,t:20,dayCode:61}).known,false);
 assert.notEqual(now.placeId,h.ctx.weatherCurrentSnapshot({...place,lat:30},null).placeId);
});
test('世界共用同一生成结果；跟随现实地点时读真实温度风速昼夜，换跟随重置地点身份',async()=>{
 const h=harness(),place={key:'w:w1:北岭',seed:'w1|北岭',terrain:'山地'},seen=[];let follow={};h.ctx.loadJSON=()=>follow;
 const stop=h.ctx.watchWeatherCurrent(place,s=>seen.push(s));await h.flush();const fictional=seen.at(-1);assert.equal(h.calls,0);assert.equal(fictional.known,true);assert.equal(typeof fictional.weather.windSpeed,'number');assert.equal(typeof fictional.weather.isDay,'boolean');
 follow={w1:{lat:10,lng:20}};h.window.emit('weather-place');await h.flush();const real=seen.at(-1);assert.equal(h.calls,1);assert.equal(real.weather.isDay,false);assert.equal(real.weather.windSpeed,31);assert.notEqual(real.placeId,fictional.placeId);stop();
});
test('未知／畸形天气响应不写缓存',async()=>{
 const h=harness();h.response({ok:true,json:async()=>({current:{temperature_2m:null,weather_code:null}})});assert.equal(await h.ctx.weatherFor(10,20),null);assert.equal(h.store.get('wx_cache'),undefined);
});
