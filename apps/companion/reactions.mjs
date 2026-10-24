// Screen facts only: no chat text, network, storage or generated dialogue here.
export function makeReactions(){
 let previous=null,nextNight=300,nextRain=0;const queue=[],last=new Map();
 const offer=(kind,now,ttl=12)=>{if(!queue.some(x=>x.kind===kind))queue.push({kind,expires:now+ttl});while(queue.length>4)queue.shift();};
 return {
  observe(ctx,now){
   if(previous&&((previous.idle&&!ctx.idle)||ctx.returnSeq!==previous.returnSeq))offer('welcome',now);
   if(ctx.typing&&!previous?.typing&&now-(last.get('peek')??-Infinity)>=60)offer('peek',now,8);
   if(ctx.rain&&!previous?.rain)nextRain=now;
   if(!ctx.rain){nextRain=Infinity;for(let i=queue.length-1;i>=0;i--)if(queue[i].kind==='umbrella')queue.splice(i,1);}
   previous={...ctx};
  },
  message(now){if(now-(last.get('notice')??-Infinity)>=15)offer('notice',now,8);},
  take(now,{busy=false,held=false,sleeping=false,hidden=false,ground=false,hour=12}={}){
   for(let i=queue.length-1;i>=0;i--)if(queue[i].expires<now)queue.splice(i,1);
   if(hidden||held)return null;
   const typing=!!previous?.typing;
   if(previous?.rain&&now>=nextRain&&!typing&&!sleeping&&!previous?.idle){offer('umbrella',now,120);nextRain=now+600;}
   const late=hour>=23||hour<6;
   if(!late)nextNight=now+300;
   if(late&&now>=nextNight&&!previous?.idle&&!typing&&!sleeping){offer('yawn',now,90);offer('rubeyes',now,100);nextNight=now+1800;}
   const i=queue.findIndex(x=>(!busy||(x.kind==='notice'&&!ground))&&(!sleeping||['welcome','notice'].includes(x.kind))&&(!typing||['peek','notice'].includes(x.kind)));
   if(i<0)return null;const [q]=queue.splice(i,1);last.set(q.kind,now);return q.kind;
  },
  reset(now=0){previous=null;queue.length=0;last.clear();nextNight=now+300;nextRain=0;}
 };
}
