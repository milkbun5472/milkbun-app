import {DUR,touchForMood} from './motion.mjs?v=fg-90b53e2779ab7a1c';
import {highFiveHit} from './touch-targets.mjs?v=fg-90b53e2779ab7a1c';
// 两种尺寸共用眼前这一小段互动；离开/换人就重置，不写角色的长期状态。
export function makeInteractions(){
 let headAt=-Infinity,headCount=0,liftAt=-Infinity,liftCount=0;
 return {
  reset(){headAt=liftAt=-Infinity;headCount=liftCount=0;},
  breakHead(){headAt=-Infinity;headCount=0;},
  touch(target,act,now,mood){
   const kind=target?.kind,side=target?.side||'left';
   if(kind==='head'){
    headCount=now-headAt<=8?Math.min(3,headCount+1):1;headAt=now;
    const response=mood==='irritated'?(headCount===1?'emotion-dodge-left':'emotion-irritated')
     :['sad','gloomy'].includes(mood)&&headCount===1?'emotion-'+mood
     :headCount===1?'emotion-headlook':headCount===2?'emotion-headpat':'emotion-headnest';
    // 连续摸到第三下后留在靠近你的姿势，不每点一下就把头弹回起点。
    const p=act?.kind===response?(now-act.start)/DUR[response]:0;
    return {kind:response,start:now-Math.min(.42,Math.max(0,p))*DUR[response],source:'touch'};
   }
   headAt=-Infinity;headCount=0;
   const response=touchForMood(mood,kind,side);
   if(response)return {kind:response,start:now,source:'touch'};
   if(kind==='hand'){
    if(highFiveHit(act,side,now,DUR[act?.kind]))return {kind:'emotion-clap-'+side,start:now,source:'touch'};
    // 举手中/手刚放下时多点一下，以及点错另一只手，都保留原邀请。
    if(/^emotion-five-(left|right)$/.test(act?.kind||''))return act;
    return {kind:'emotion-five-'+side,start:now,source:'touch'};
   }
   return {kind:'emotion-dodge-'+side,start:now,source:'touch'};
  },
  drop(now,mood){
   headAt=-Infinity;headCount=0;liftCount=now-liftAt<=20?Math.min(2,liftCount+1):1;liftAt=now;
   return {kind:'land',start:now,source:'touch',after:liftCount>1?['emotion-crossarms']:['emotion-tidy',touchForMood(mood,'lift')]};
  }
 };
}
// 所有入口的举手都能接招；自然结束才续后一个动作，聊天/睡眠/换人直接覆盖即取消。
export function afterInteraction(action,now){
 const follow=Array.isArray(action.after)?action.after.slice():action.after?[action.after]:[];
 if(!follow.length&&/^emotion-five-(left|right)$/.test(action.kind))follow.push('emotion-peek');
 const kind=follow.shift();return kind?{kind,start:now,source:action.source,after:follow}:null;
}
