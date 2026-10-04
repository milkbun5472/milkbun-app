// One civil calendar for every world in an archive. Animation time is separate.
(function(root){
  const DAY=86400000, WEEK=['周日','周一','周二','周三','周四','周五','周六'];
  const pad=n=>String(n).padStart(2,'0');
  const ordinal=d=>Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY);
  const dateKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const number=(n,f=1)=>Number.isFinite(n)?Math.max(1,Math.floor(n)):f;
  function restore(raw,day=1,at=Date.now()){
    if(raw?.version===1&&Number.isInteger(raw.anchor)&&Number.isFinite(raw.startDay))
      return {version:1,anchor:raw.anchor,startDay:number(raw.startDay),day:number(raw.day,number(raw.startDay))};
    return {version:1,anchor:ordinal(new Date(at)),startDay:number(day),day:number(day)};
  }
  function sample(raw,at=Date.now()){
    const d=new Date(at),clock=restore(raw,1,at),weekday=d.getDay();
    const day=Math.max(clock.day,clock.startDay+ordinal(d)-clock.anchor);
    return {at,day,minute:d.getHours()*60+d.getMinutes(),second:d.getSeconds(),date:dateKey(d),weekday,week:WEEK[weekday],weekend:weekday===0||weekday===6,
      label:(d.getMonth()+1)+'月'+d.getDate()+'日 '+WEEK[weekday]+' '+pad(d.getHours())+':'+pad(d.getMinutes()),
      season:Math.floor((day-1)/14)%4,seasonDay:(day-1)%14+1};
  }
  function archive(data,at=Date.now()){
    const worlds=Object.values(data.worlds||{}),pets=data.worlds?.pets?.pets||[];
    const garden=data.worlds?.garden||data.world;
    const oldDay=Number.isFinite(garden?.day)?number(garden.day):Math.max(1,...worlds.map(w=>number(w?.day)),...pets.map(p=>number(p.career?.day)));
    const clock=restore(data.clock,oldDay,at);clock.day=sample(clock,at).day;
    return {...data,clock};
  }
  function world(data,id){const a=archive(data),w=a.worlds?.[id]||(id==='garden'?a.world:null);return w?{...w,clock:a.clock}:null;}
  function workWindow(time,plan={}){
    if(!time)return {open:true,label:'先到店里商量一班'};
    const morning=time.minute>=540&&time.minute<720,afternoon=time.minute>=840&&time.minute<1020;
    const permitted=!time.weekend||plan.weekend===true;
    const open=permitted&&(plan.shift==='morning'?morning:plan.shift==='afternoon'?afternoon:morning||afternoon);
    return {open,label:!permitted?'周末休息，仍可以逛店':open?'现在可以商量一班':'工作时段：09:00–12:00 / 14:00–17:00'};
  }
  function routine(time,seed=0){
    const m=time.minute,shift=(Number(seed)>>>0)%21;
    if(m<420+shift||m>=1320+shift)return {id:'sleep',label:'准备休息',home:true};
    if(m>=420+shift&&m<540)return {id:'breakfast',label:'早餐时间',home:true};
    if(m>=720+shift&&m<780)return {id:'lunch',label:'午饭时间',home:true};
    if(m>=1080+shift&&m<1140)return {id:'dinner',label:'晚饭时间',home:true};
    if(m>=780&&m<840)return {id:'nap',label:'午后歇一会儿',home:true};
    return {id:time.weekend?'weekend':'free',label:time.weekend?'周末自由活动':m>=1140?'晚间陪伴':'自己的小日子',home:false};
  }
  root.GameClock={restore,sample,archive,world,workWindow,routine};
})(globalThis);
