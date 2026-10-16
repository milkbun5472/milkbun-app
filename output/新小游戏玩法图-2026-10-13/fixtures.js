(() => {
  const characters=[{id:'demo-shenyu',name:'沈屿',color:'#73948a',tagline:'玩得认真，话直，输了也会嘴硬。',persona:'虚构演示。旧书修复师，逻辑清楚，话不多，爱接细节。'},{id:'demo-linxia',name:'林夏',color:'#aaa0c5',tagline:'爱观察措辞，也爱把故事拐个弯。',persona:'虚构演示。编辑，轻快，细心，喜欢接话。'}];
  const profile={name:'星奈',color:'#d4a18b'};
  const model={queue:[],calls:[],toasts:[],copies:[],memoryCalls:0};window.__gamesDemo=model;window.__characters=characters;window.__profile=profile;
  window.__gamePure=(function(module){eval(window.__gameSource);return module.exports;})({exports:{}});
  callAI=async(api,sys,msgs,opts)=>{model.calls.push({sys:String(sys),msgs,opts});if(!model.queue.length)throw Error('No prepared demo reply');let r=model.queue.shift();if(typeof r==='function')r=r(String(sys),msgs);return typeof r==='string'?r:JSON.stringify(r);};
  window.__queueGames=(...rs)=>model.queue.push(...rs);
  window.CCSeat=undefined;window.BackgroundGeneration=undefined;
  copyText=async s=>{model.copies.push(s);return true;};
  requestAppConfirm=(title,body,yes)=>yes();
  document.documentElement.classList.remove('fonts-pending');document.getElementById('root').style.display='none';document.getElementById('qiu-splash')?.remove();
  const el=document.createElement('div');el.id='games-demo';el.style='position:fixed;inset:0;z-index:100';document.body.append(el);const rr=ReactDOM.createRoot(el);let seq=0;
  const props={active:{model:'fictional-prepared-demo'},characters,profile,onBack:()=>{},toast:x=>model.toasts.push(x),moods:{},worldbook:'',worldbookFor:()=>'',isEngineer:()=>false,recentChatFor:()=>'',keepGameMemory:()=>{model.memoryCalls++;throw Error('Formal memory not part of screenshot task');}};
  window.__gamesMount=()=>rr.render(h(ThemeContext.Provider,{value:DEFAULT_THEME},h(Games,{...props,key:++seq})));
  const user={key:'user',name:profile.name,isUser:true,isNpc:false,alive:true};
  const cp=i=>({...characters[i],key:characters[i].id,isUser:false,isNpc:false,alive:true});
  const cfg=ids=>({mode:'normal',charIds:ids,npcCount:0,total:ids.length+1,injectChat:false,ccSeat:false,npcFill:false});
  function store(key,config,state,label){saveJSON('x_gamesSave',{[key]:{config,state,label}});localStorage.removeItem('wolf_save');__gamesMount();}
  window.__seedNewGame=key=>{
    const players=[{...user},cp(0),cp(1)],config=cfg(characters.map(c=>c.id));
    if(key==='liar'){
      const state=__gamePure.liarNewGame(players,()=>0);state.players[0].dice=[1,2,3,4,5];state.players[1].dice=[2,3,4,5,6];state.players[2].dice=[1,3,4,5,6];
      __gamePure.liarAct(state,{kind:'bid',n:4,f:4,say:'先叫到这里。'});
      __queueGames({kind:'bid',n:5,f:4,say:'你跟不跟？'},{kind:'bid',n:6,f:4,say:'别眨眼，六个四。'});
      store(key,config,state,'第1轮 · 桌上的话也带着各自的性子');
    }
    if(key==='story'){
      let n=0;const state=__gamePure.storyNewGame(players,3,()=>n++===0?.25:0);
      const lines=[['user','车票后面，画着一把小小的钥匙。',1],['demo-shenyu','他撑开雨伞，站牌上竟只写着昨天。',8],['demo-linxia','林夏把信封递回来，邮戳比今天早一年。',10],['user','月亮停在那个数字上，像一枚旧印章。',3],['demo-shenyu','一只猫走上空车，替他们按亮了末班的灯。',25],['demo-linxia','林夏递来一颗糖，说这趟要等他们自己决定。',8]];
      for(const [who,text,index] of lines)__gamePure.storyAct(state,who,text,()=> (index+.05)/35);
      Math.random=()=>0;
      __queueGames({line:'他把钥匙放在站牌下，没再锁那扇门。',say:'门留着，别写死。'},{line:'林夏收好那把钥匙，故事在天亮时停了下来。',say:'好了，留半页给下一次。'});
      store(key,config,state,'第7句 · 轮到星奈接词');
    }
    if(key==='date'){
      const dc=cfg([characters[0].id]);let n=0;const numbers=[.11,0,.55,.15,.4,.9];
      const state=DateGameCore.newGame(dc,()=>numbers[n++%numbers.length],{places:['arcade','photo','cafe','shop','river','book']});state.toys=[0,1,2];
      Math.random=()=>.62;
      assertDemo(state.missions.user==='plush'&&state.missions.char==='photo','Expected two different physical demo missions');
      __queueGames({place:'arcade',accept:true,row:1,pose:2,hint:'第二排，我停好了。你往中间一点。',say:'可以。但抓到了，你先选。'},{say:'抓到了。你选的那只，先抱着。'},{place:'photo',accept:false,row:0,pose:2,hint:'我准备歪歪头，你猜猜跟不跟得上。',say:'下一站去合照亭。这次我来定。'},{say:'行，这张动作对上了。别急，我要看一眼。'},{guess:'plush',say:'我先交了，你别看我的。'});
      store(key,dc,state,'第1站 · 你和TA各藏一张任务');
    }
  };
  function assertDemo(ok,msg){if(!ok)throw Error(msg);}
  window.__savedNewGame=k=>loadJSON('x_gamesSave',{})[k];
  saveJSON('x_gamesSave',{});__gamesMount();
})();
