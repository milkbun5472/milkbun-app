async () => {
  const chars = [
    {id:'day-demo-a',name:'沈屿',gender:'male',tz:'0',persona:'虚构角色。旧书修复师，话不多，待人温柔但不黏人。喜欢木头与蓝色织物，爱画画和弹吉他，吃清淡的菜。'},
    {id:'day-demo-b',name:'林夏',gender:'female',tz:'0',persona:'虚构角色。插画编辑，性格活泼，今天在工作室整理画稿。'}
  ];
  const seqs = [
    {seq:1,time:'08:00',end:'09:00',title:'在家吃早饭',location:'小家的餐桌',type:'meal',world:{scene:'dayHome',spot:'meal'}},
    {seq:2,time:'09:00',end:'12:00',title:'修好旧书的书脊，整理修复记录',location:'旧书修复工坊',type:'work',world:{scene:'dayWorkshop',spot:'bench'}},
    {seq:3,time:'12:00',end:'13:00',title:'在小店吃午饭',location:'街角小店',type:'meal',world:{scene:'dayCafe',spot:'meal'}},
    {seq:4,time:'13:00',end:'16:00',title:'整理书页与修复笔记',location:'旧书修复工坊',type:'work',world:{scene:'dayWorkshop',spot:'bench'}},
    {seq:5,time:'16:00',end:'18:00',title:'散步，绕去街角喝一杯',location:'街边小路',type:'out',world:{scene:'dayStreet',spot:'walk'}},
    {seq:6,time:'18:00',end:'21:00',title:'在小家看书，等你一起吃晚饭',location:'小家窗边',type:'home',world:{scene:'dayHome',spot:'read'}},
    {seq:7,time:'21:00',end:'23:00',title:'在家休息，听会儿音乐',location:'小家起居区',type:'home',world:{scene:'dayHome',spot:'rest'}},
    {seq:8,time:'23:00',end:'24:00',title:'准备睡觉',location:'小家卧室',type:'sleep',world:{scene:'dayHome',spot:'sleep'}}
  ];
  const features=Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(k=>[k,{global:false,chars:{}}]));
  const data={
    x_characters:chars,x_profile:{name:'星奈',persona:'虚构用户，性格活泼，喜欢画画和一起做饭。'},
    x_schedules:{'day-demo-a':{'2026-10-13':{seqs}},'day-demo-b':{'2026-10-13':{seqs:[{seq:1,time:'09:00',end:'20:00',title:'在工作室整理画稿',location:'工作室',type:'create'}]}}},
    x_homeLayout:{'0':['fairyGarden','messages','calendar','w_taday']},x_homeFolders:[],
    x_api:[{id:'demo-api',baseUrl:'https://demo.invalid/v1',apiKey:'fictional',model:'demo'}],x_activeApi:'demo-api',
    x_settings:{timeAware:true},x_chatSettings:{'day-demo-a':{autoReplySec:0,busyHold:false}},
    x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features},
    x_companion:{charId:'day-demo-a',autoFace:false,float:false,looks:{'day-demo-a':{outfit:'academy',hair:'korean',hairColor:'#40362f',face:'relax',skin:'#dfb693'}}},
    x_charDayHomes:{version:3,albumAuto:{'day-demo-a':false},visitorActivities:{'day-demo-a':'manual'},styles:{'day-demo-a':'warm'},
      looks:{me:{outfit:'garden',hair:'airbang',hairColor:'#634630',skin:'#e3ba9c',face:'happy'}},
      socialPreferences:{'day-demo-a':{autoInteractions:false,followDates:true}}},
    'x_chat:day-demo-a':[
      {role:'user',content:'今天晚饭我来做，你帮我切菜。',ts:Date.now()-120000,read:true},
      {role:'assistant',content:'好，菜板给我。你慢慢选吃什么。',ts:Date.now()-90000,read:true}
    ]
  };
  for(const [k,v]of Object.entries(data))await saveJSONDurable(k,v);
}
