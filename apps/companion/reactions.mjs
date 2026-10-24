// Screen facts only: no chat text, network, storage or generated dialogue here.
const fresh=(s,now)=>!!s?.known&&Number.isFinite(s.expiresAt)&&s.expiresAt>now&&s.at<=now;
const wet=c=>c>=95?'thunder':(c>=71&&c<=77)||c===85||c===86?'snow':(c>=51&&c<=67)||(c>=80&&c<=82)?'rain':'';
export function weatherActions(snapshot,now=Date.now()){
 if(!fresh(snapshot,now))return [];
 const w=snapshot.weather||{},kind=wet(w.code),pool=[];
 if(kind==='thunder')pool.push('thunder','catchrain');
 else if(kind==='rain')pool.push('catchrain');
 else if(kind==='snow')pool.push('catchsnow');
 if(Number.isFinite(w.t)&&w.t<=8)pool.push('warmhands');
 if(Number.isFinite(w.t)&&w.t>=30)pool.push('wipesweat','fan');
 if(Number.isFinite(w.windSpeed)&&w.windSpeed>=28)pool.push('wind');
 if([0,1].includes(w.code)&&w.isDay===true)pool.push('shade');
 return pool;
}
export function makeReactions(){
 let previous=null,nextNight=300,nextWeather=0,weatherIndex=0,weatherKey='',rainStopUntil=0;const queue=[],last=new Map();
 const offer=(kind,now,ttl=12)=>{if(!queue.some(x=>x.kind===kind))queue.push({kind,expires:now+ttl});while(queue.length>4)queue.shift();};
 return {
  observe(ctx,now,wallNow=Date.now()){
   if(previous&&((previous.idle&&!ctx.idle)||ctx.returnSeq!==previous.returnSeq))offer('welcome',now);
   if(ctx.typing&&!previous?.typing&&now-(last.get('peek')??-Infinity)>=60)offer('peek',now,8);
   const old=previous?.weather,w=ctx.weather,pool=weatherActions(w,wallNow),key=(w?.placeId||'')+'|'+pool.join(',');
   const same=old?.placeId===w?.placeId;
   if(!same||!fresh(w,wallNow))rainStopUntil=0;
   if(same&&fresh(old,wallNow)&&fresh(w,wallNow)&&['rain','thunder'].includes(wet(old.weather?.code))&&!wet(w.weather?.code))rainStopUntil=now+120;
   if(wet(w?.weather?.code))rainStopUntil=0;
   if(key!==weatherKey){weatherKey=key;weatherIndex=0;nextWeather=Math.max(now,(last.get('weather')??-Infinity)+90);}
   previous={...ctx};
  },
  message(now){if(now-(last.get('notice')??-Infinity)>=15)offer('notice',now,8);},
  take(now,{busy=false,held=false,sleeping=false,hidden=false,ground=false,hour=12,weatherUmbrella=false,wallNow=Date.now()}={}){
   for(let i=queue.length-1;i>=0;i--)if(queue[i].expires<now)queue.splice(i,1);
   if(hidden||held)return null;
   const typing=!!previous?.typing;
   const late=hour>=23||hour<6;
   if(!late)nextNight=now+300;
   if(late&&now>=nextNight&&!previous?.idle&&!typing&&!sleeping){offer('yawn',now,90);offer('rubeyes',now,100);nextNight=now+1800;}
   const i=queue.findIndex(x=>(!busy||(x.kind==='notice'&&!ground))&&(!sleeping||['welcome','notice'].includes(x.kind))&&(!typing||['peek','notice'].includes(x.kind)));
   if(i>=0){const [q]=queue.splice(i,1);last.set(q.kind,now);return q.kind;}
   if(typing||sleeping||previous?.idle)return null;
   const w=previous?.weather;
   if(rainStopUntil>now&&fresh(w,wallNow)&&(!busy||weatherUmbrella)){rainStopUntil=0;last.set('weather',now);nextWeather=now+600;return weatherUmbrella?'rainclose':'raindry';}
   const pool=weatherActions(w,wallNow);
   if(!busy&&pool.length&&now>=nextWeather){const kind=pool[weatherIndex++%pool.length];last.set('weather',now);nextWeather=now+600;return kind;}
   return null;
  },
  reset(now=0){previous=null;queue.length=0;last.clear();nextNight=now+300;nextWeather=now;weatherIndex=0;weatherKey='';rainStopUntil=0;}
 };
}
