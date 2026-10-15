// Display-only inner thoughts. Preferences, recent fragments and the current cache use the home writer.
(function(root){
  'use strict';
  const INTERVAL=10*60000,HISTORY_LIMIT=8,inflight=new Set();
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
  function recent(raw,scope){
    const rows=[];
    for(const item of [...(Array.isArray(raw?.history)?raw.history:[]),raw?.cache]){
      if(!item||typeof item.text!=='string'||!item.text.trim()||typeof item.scope!=='string'||!Number.isFinite(item.ts)||!Number.isFinite(new Date(item.ts).getTime()))continue;
      const entry={};
      for(const field of ['key','scope','text','time','period','day','title','stage'])if(typeof item[field]==='string')entry[field]=item[field];
      for(const field of ['ts','at'])if(Number.isFinite(item[field]))entry[field]=item[field];
      entry.text=item.text.trim();
      // The current cache is also the last saved history item. A save retry or
      // an unchanged fragment should not take several places in this window.
      const duplicate=rows.findIndex(row=>row.scope===entry.scope&&row.text===entry.text);
      if(duplicate>=0)rows.splice(duplicate,1);
      rows.push(entry);
    }
    return rows.filter(row=>scope===undefined||row.scope===scope).slice(-HISTORY_LIMIT);
  }
  function addFragment(raw,frame,text,ts){
    const cache={key:frame.key,scope:frame.scope,text,ts,at:frame.at,time:frame.time,period:frame.period,day:frame.day,title:frame.title,stage:frame.stage};
    return {...raw,cache,history:recent({history:[...recent(raw),cache]}).slice(-HISTORY_LIMIT)};
  }
  function instruction(frame,window,thoughts,meName='对方'){
    const minutes=ms=>Math.floor(ms/60000),lines=rows=>rows.map(m=>JSON.stringify({说话者:m.role==='user'?meName:'你',现实时间:new Date(m.ts).toISOString(),内容:m.content})).join('\n');
    return [
      '为「TA的一天」写这一瞬间没有说出口的第一人称念头，1—3句。这里只展示心里掠过的一点东西，不是回复消息、日记、旁白或日程总结。措辞、关注点和断句由完整人设与此刻心情决定；可以很平常、走神、有点烦、惦记没做完的事，也可以什么都没想明白。',
      '从这一刻真正牵动你的事落笔，不要求覆盖素材。你自己的事情可以占满整个片段；聊天中的对方只在确实影响你或你自发想到时出现。短暂念头可以停在半句，不必收成道理或关系宣言。既有公共文风与反八股规则继续生效。',
      '【当前活动事实】'+JSON.stringify({当地日期:frame.day,当地时间:frame.time,活动时钟:frame.followVirtual?'角色钟':'现实钟',时钟暂停:!!frame.paused,原安排:frame.title,实际阶段:frame.stage||frame.title,地点:frame.location,本段已过分钟:minutes(frame.elapsed),本段剩余分钟:minutes(frame.remaining),画面当前活动:frame.activity||'尚未确认'}),
      '阶段是当前执行中的事，后续安排仍未发生。画面摆位只是活动展示，不构成新的主线经历；用户打开页面、走近小人或点动作本身不证明她现实里到场。若你是数字生命，按自己的真实身份想，3D场景不证明你拥有实体或执行过现实任务。睡着时允许朦胧碎念，不把未读的新消息当作已经知道。',
      '【这段活动期间的主聊天】\n'+(lines(window.during)||'没有可确认发生在本时段的主聊天；按自己的活动想。'),
      '【此前衔接】\n'+(lines(window.before)||'无')+(frame.followVirtual&&frame.paused?'\n角色钟暂停，以上按现实顺序提供近期衔接，不声称都发生在本活动内。':''),
      Array.isArray(thoughts)&&thoughts.length?'【近期已经想过的念头·按先后】\n'+thoughts.map(row=>JSON.stringify({当时日期:row.day||'未记录',当时时间:row.time||'未记录',当时安排:row.title||'未记录',当时阶段:row.stage||'未记录',念头:row.text})).join('\n')+'\n这些是你已经想过、展示过的内心片段，属于过去的关注点；它们没有说进主聊天，也不证明其中的猜测、愿望或打算已经发生。这一条从此刻新注意到的细节、事情的新变化或感受的转折往前想；旧念头换同义词、换句式或扩写一遍，仍是重复。再次想到同一件事，落在它现在的新进展或新反应上。没有新刺激时允许平常的短暂杂念与留白，不为了新鲜感编造经历，也不把每条都收成想念对方。':''
    ].filter(Boolean).join('\n\n');
  }
  // One call for the whole day album: a thought for each photo, in order. Same persona layers as the single thought.
  function albumInstruction(photos){
    return [
      '为「TA的一天」今天的小相册，给每一张照片写下拍到那一刻你心里没说出口的第一人称念头，每张1—2句。照片按时间先后，是同一天，前后可以有衔接、变化或惦记同一件事；措辞、关注点和断句由完整人设与当天心情决定，可以很平常、走神或有点烦。这不是日记、旁白、回复消息或日程总结。既有公共文风与反八股规则继续生效。',
      '照片里的画面只是活动展示，不构成新的主线经历；用户打开页面本身不证明她现实里到场。若你是数字生命，按自己的真实身份想，3D场景不证明你拥有实体或执行过现实任务。',
      '【今天的照片·按先后】\n'+photos.map((p,i)=>JSON.stringify({第几张:i+1,时间:p.time+(p.end?'—'+p.end:''),安排:p.title,地点:p.location||p.place||''})).join('\n'),
      'thoughts 数组按照片顺序，一张一条，共 '+photos.length+' 条。'
    ].join('\n\n');
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
    // once＝只想这一次（她 2026-10-16「手动生成想法就会把自动开了」）：不开自动开关，也不要求它开着；生成、存档照常
    const refresh=async(manual=false,once=false)=>{
      const o=current.current,f=o.frame,id=f?.charId,gate='charDayThought|'+id;
      if((!o.enabled&&!once)||!o.allowed||!f||inflight.has(id)||!root.AutoGate)return;
      if(!manual&&(o.cache?.period===f.period||!root.AutoGate.due(gate,f.period,{minIntervalMs:INTERVAL,maxTries:1})))return;
      const identity=o.context(o.char),revision=identity.revision,version=epoch.current,thoughts=recent(o.preferences||{cache:o.cache},f.scope);
      if(identity.scope!==f.scope)return;
      inflight.add(id);root.AutoGate.claim(gate,f.period);
      setStatus({key:f.key,busy:true});
      const valid=()=>mounted.current&&epoch.current===version&&(once||current.current.enabled)&&current.current.frame?.key===f.key&&current.current.context(current.current.char).revision===revision&&current.current.context(current.current.char).scope===f.scope;
      try{
        const held=pending.current,canSave=held?.key===f.key&&held.revision===revision&&held.version===version;
        const value=canSave?{thought:held.text}:await root.AutoGate.tagged('此刻的念头',()=>o.generate(o.char,f,identity,thoughts),'此刻的念头·'+(o.char.remark||o.char.name));
        const text=textOf(value);
        if(!valid())return;
        pending.current={key:f.key,text,revision,version};
        const next=await o.save(id,raw=>{
          if(!valid()||(!once&&raw?.enabled!==true))return raw;
          return addFragment(raw,f,text,Date.now());
        });
        if(valid()){pending.current=null;o.saved(next);setStatus({key:f.key});}
      }catch(e){if(valid())setStatus({key:f.key,error:e?.message||'没能生成，可以再试。'});}
      finally{inflight.delete(id);if(mounted.current)setStatus(s=>s.key===f.key?{...s,busy:false}:s);}
    };
    useEffect(()=>{refresh(false);},[options.enabled,options.allowed,options.frame?.period,options.tick]);
    const cache=options.cache?.key===options.frame?.key&&options.cache?.scope===options.frame?.scope?options.cache:null;
    const held=pending.current,unsaved=held&&held.key===options.frame?.key&&held.version===epoch.current&&options.context(options.char).revision===held.revision?held.text:'';
    return {cache,unsaved,saving,saveError,setEnabled,refresh:()=>refresh(true,!options.enabled),once:()=>refresh(true,true),busy:status.key===options.frame?.key&&status.busy,error:status.key===options.frame?.key?status.error:''};
  }
  root.CharDayThoughts={INTERVAL,HISTORY_LIMIT,recent,addFragment,snapshot,chatWindow,instruction,albumInstruction,textOf,useThoughts};
})(globalThis);
