// Display-only inner thoughts. Preferences and one cached fragment use the home writer.
(function(root){
  'use strict';
  const INTERVAL=10*60000,inflight=new Set();
  function snapshot({char,slot,state,stageIndex,stage,activity,scope=''}){
    if(!char||!slot||!Number.isFinite(slot.startAt)||!Number.isFinite(slot.endAt))return null;
    const at=state.at,elapsed=Math.max(0,Math.min(slot.endAt,at)-slot.startAt),remaining=Math.max(0,slot.endAt-at);
    const key=JSON.stringify([String(char.id),scope,slot.key,stageIndex??-1,stage?.title,stage?.location]);
    return {key,charId:String(char.id),scope,slotKey:slot.key,at,realAt:state.realAt,day:state.day,time:state.time,offset:state.offset,
      startAt:slot.startAt,endAt:slot.endAt,elapsed,remaining,followVirtual:state.followVirtual,paused:state.paused,
      title:slot.deviation?.actual||slot.title,location:stage?.location||slot.deviation?.location||slot.location||'',
      stage:stage?.title||'',stageIndex:stageIndex??-1,activity:activity?.label||'',
      period:JSON.stringify([key,Math.floor(elapsed/INTERVAL)])};
  }
  function chatWindow(messages,frame,mapTime=x=>x){
    const rows=(messages||[]).filter(m=>m&&['user','assistant'].includes(m.role)&&!m.recalled&&m.content&&Number.isFinite(m.ts)&&m.ts<=frame.realAt).sort((a,b)=>a.ts-b.ts);
    // A frozen clock cannot locate older real messages within an activity interval.
    const during=frame.followVirtual&&frame.paused?[]:rows.filter(m=>{const at=mapTime(m.ts);return at>=frame.startAt&&at<=frame.at;});
    const first=during[0],before=first?rows.filter(m=>m.ts<first.ts):rows.filter(m=>frame.paused||mapTime(m.ts)<frame.startAt);
    return {during,before:before.slice(-8)};
  }
  function instruction(frame,window,previous,meName='对方'){
    const minutes=ms=>Math.floor(ms/60000),lines=rows=>rows.map(m=>JSON.stringify({说话者:m.role==='user'?meName:'你',现实时间:new Date(m.ts).toISOString(),内容:m.content})).join('\n');
    return [
      '为「TA的一天」写这一瞬间没有说出口的第一人称念头，1—3句。这里只展示心里掠过的一点东西，不是回复消息、日记、旁白或日程总结。措辞、关注点和断句由完整人设与此刻心情决定；可以很平常、走神、有点烦、惦记没做完的事，也可以什么都没想明白。',
      '从这一刻真正牵动你的事落笔，不要求覆盖素材。你自己的事情可以占满整个片段；聊天中的对方只在确实影响你或你自发想到时出现。短暂念头可以停在半句，不必收成道理或关系宣言。既有公共文风与反八股规则继续生效。',
      '【当前活动事实】'+JSON.stringify({当地日期:frame.day,当地时间:frame.time,活动时钟:frame.followVirtual?'角色钟':'现实钟',时钟暂停:!!frame.paused,原安排:frame.title,实际阶段:frame.stage||frame.title,地点:frame.location,本段已过分钟:minutes(frame.elapsed),本段剩余分钟:minutes(frame.remaining),画面当前活动:frame.activity||'尚未确认'}),
      '阶段是当前执行中的事，后续安排仍未发生。画面摆位只是活动展示，不构成新的主线经历；用户打开页面、走近小人或点动作本身不证明她现实里到场。若你是数字生命，按自己的真实身份想，3D场景不证明你拥有实体或执行过现实任务。睡着时允许朦胧碎念，不把未读的新消息当作已经知道。',
      '【这段活动期间的主聊天】\n'+(lines(window.during)||'没有可确认发生在本时段的主聊天；按自己的活动想。'),
      '【此前衔接】\n'+(lines(window.before)||'无')+(frame.followVirtual&&frame.paused?'\n角色钟暂停，以上按现实顺序提供近期衔接，不声称都发生在本活动内。':''),
      previous?'【上次展示的念头】\n'+JSON.stringify(previous)+'\n从现在的关注点续看，允许没什么变化；有新牵挂才转过去，不为刷新刻意翻花样。':''
    ].filter(Boolean).join('\n\n');
  }
  function textOf(value){
    if(typeof value?.thought!=='string'||!value.thought.trim())throw Error('这次没有生成念头，可以再试。');
    return value.thought.trim();
  }
  function useThoughts(options){
    const {useState,useRef,useEffect}=root.React;
    const [status,setStatus]=useState({}),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
    const pending=useRef(null),current=useRef(options),mounted=useRef(false),epoch=useRef(0),lastEnabled=useRef(options.enabled);
    if(lastEnabled.current!==options.enabled){epoch.current++;lastEnabled.current=options.enabled;}
    current.current=options;
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
    useEffect(()=>{setSaveError('');},[options.char?.id]);
    const setEnabled=async enabled=>{
      if(saving)return;setSaving(true);setSaveError('');
      const id=current.current.char?.id;
      // Invalidate a response as soon as she asks to close, even while saving.
      if(!enabled)epoch.current++;
      try{const next=await options.save(id,raw=>({...raw,enabled}));if(mounted.current)options.saved(next);}
      catch{if(mounted.current)setSaveError('没有保存成功，开关保持原样，可以再试。');}
      finally{if(mounted.current)setSaving(false);}
    };
    const refresh=async(manual=false)=>{
      const o=current.current,f=o.frame,id=f?.charId,gate='charDayThought|'+id;
      if(!o.enabled||!o.allowed||!f||inflight.has(id)||!root.AutoGate)return;
      if(!manual&&(o.cache?.period===f.period||!root.AutoGate.due(gate,f.period,{minIntervalMs:INTERVAL,maxTries:1})))return;
      const identity=o.context(o.char),revision=identity.revision,version=epoch.current;
      if(identity.scope!==f.scope)return;
      inflight.add(id);root.AutoGate.claim(gate,f.period);
      setStatus({key:f.key,busy:true});
      const valid=()=>mounted.current&&epoch.current===version&&current.current.enabled&&current.current.frame?.key===f.key&&current.current.context(current.current.char).revision===revision&&current.current.context(current.current.char).scope===f.scope;
      try{
        const held=pending.current,canSave=held?.key===f.key&&held.revision===revision&&held.version===version;
        const value=canSave?{thought:held.text}:await root.AutoGate.tagged('此刻的念头',()=>o.generate(o.char,f,identity,o.cache?.scope===f.scope?o.cache.text:''),'此刻的念头·'+(o.char.remark||o.char.name));
        const text=textOf(value);
        if(!valid())return;
        pending.current={key:f.key,text,revision,version};
        const next=await o.save(id,raw=>{
          if(!valid()||raw?.enabled!==true)return raw;
          return {...raw,cache:{key:f.key,scope:f.scope,text,ts:Date.now(),at:f.at,time:f.time,period:f.period}};
        });
        if(valid()){pending.current=null;o.saved(next);setStatus({key:f.key});}
      }catch(e){if(valid())setStatus({key:f.key,error:e?.message||'没能生成，可以再试。'});}
      finally{inflight.delete(id);if(mounted.current)setStatus(s=>s.key===f.key?{...s,busy:false}:s);}
    };
    useEffect(()=>{refresh(false);},[options.enabled,options.allowed,options.frame?.period,options.tick]);
    const cache=options.cache?.key===options.frame?.key&&options.cache?.scope===options.frame?.scope?options.cache:null;
    const held=pending.current,unsaved=held&&held.key===options.frame?.key&&held.version===epoch.current&&options.context(options.char).revision===held.revision?held.text:'';
    return {cache,unsaved,saving,saveError,setEnabled,refresh:()=>refresh(true),busy:status.key===options.frame?.key&&status.busy,error:status.key===options.frame?.key?status.error:''};
  }
  root.CharDayThoughts={INTERVAL,snapshot,chatWindow,instruction,textOf,useThoughts};
})(globalThis);
