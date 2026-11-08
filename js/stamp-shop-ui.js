(function(g){
 'use strict';const h=React.createElement,ink='#51483a',paper='#f8f0de';
 const button={minHeight:40,padding:'8px 12px',border:'1px solid #9f8e7144',borderRadius:8,background:'#fffaf0',color:ink,fontSize:13,textAlign:'left'};
 function StampShopFilters({characters=[],cards=[],filter={},onChange,wk='duelshopwinfilter',noWho=false,fit=[]}){
  const people=characters.filter(c=>cards.some(k=>k&&k.charId===c.id));
  return h('div',{'data-wk':wk,style:{display:'grid',gap:7,marginBottom:12}},
   h('input',{'aria-label':'搜卡名',value:filter.q||'',placeholder:'搜卡名…',onChange:e=>onChange({...filter,q:e.target.value}),style:{...button,width:'100%',minWidth:0,boxSizing:'border-box'}}),
   h('div',{style:{display:'grid',gridTemplateColumns:noWho?'minmax(0,1fr) minmax(0,1fr)':'repeat(3,minmax(0,1fr))',gap:7}},
    noWho?null:h('select',{'aria-label':'按角色筛选',value:filter.who||'',onChange:e=>onChange({...filter,who:e.target.value}),style:{...button,minWidth:0,boxSizing:'border-box'}},h('option',{value:''},'全部角色'),people.map(c=>h('option',{key:c.id,value:c.id},c.remark||c.name))),
    h('select',{'aria-label':'按稀有度筛选',value:filter.rar||'',onChange:e=>onChange({...filter,rar:e.target.value}),style:{...button,minWidth:0,boxSizing:'border-box'}},['','SSR','SR','R'].map(r=>h('option',{key:r,value:r},r||'全部稀有度'))),
    h('select',{'aria-label':'按种类筛选',value:filter.role||'',onChange:e=>onChange({...filter,role:e.target.value}),style:{...button,minWidth:0,boxSizing:'border-box'}},['','投递','火漆','补票','集邮','邮戳'].map(r=>h('option',{key:r,value:r},r?(fit.includes(r)?r+' ✦':r):'全部种类')))));
 }
 function ShopThumb({card}){const [url,setUrl]=React.useState(null);React.useEffect(()=>{let on=true;g.StampThumbnails?.url(card.cover||card.face).then(u=>{if(on)setUrl(u);}).catch(()=>{});return()=>{on=false;};},[card.id,card.cover,card.face]);return url?h('img',{src:url,alt:'',style:{width:42,height:56,objectFit:'cover',flexShrink:0}}):h('span',{'aria-hidden':true,style:{width:42,height:56,display:'grid',placeItems:'center',border:'1px dashed #a48c67',color:'#8a7355'}},'邮');}
 function StampShopPanel({target={},shop,characters=[],cards=[],onAction,onClose,onText,onReplay,busy,error}){
  const [page,setPage]=React.useState(target.type||'menu'),[post,setPost]=React.useState(target.post||''),[filter,setFilter]=React.useState({who:'',rar:'',q:''}),scroll=React.useRef(null),positions=React.useRef({}),history=React.useRef([]),windowFilter=React.useRef({who:'',rar:'',q:''});
  const change=(next,back=false)=>{positions.current[page]=scroll.current?.scrollTop||0;if(!back)history.current.push(page);if(next==='window')setFilter(windowFilter.current);setPage(next);};
  React.useLayoutEffect(()=>{if(scroll.current)scroll.current.scrollTop=positions.current[page]||0;},[page]);
  const back=()=>history.current.length?change(history.current.pop(),true):onClose();
  const D=g.StampDuel,name=id=>characters.find(c=>c.id===id)?.remark||characters.find(c=>c.id===id)?.name||'空着';
  const action=(type,args={})=>onAction(type,args),title=page==='window'?'橱窗':page==='decor'?'店里装修':page==='badge'?'店员工牌':page==='staff'?'店员排班':page==='story'?'打烊时店里的一段':page==='guest'?'来店里的客人':'邮局经营';
  const row=(label,fn,disabled=false,extra={})=>h('button',{...extra,onClick:fn,disabled:busy||disabled,style:{...button,opacity:disabled?.5:1,...extra.style}},label);
  const box={display:'grid',gap:9,marginBottom:18};let content;
  if(page==='staff'&&target.post){const who=shop.roster[target.post];return h('div',{className:'absolute inset-0',onClick:onClose,style:{zIndex:35}},h('section',{'data-wk':'fairypage','data-part':'shop-actions',role:'dialog','aria-label':name(who)+'的岗位菜单',onClick:e=>e.stopPropagation(),style:{position:'absolute',left:14,right:14,bottom:'calc(64px + env(safe-area-inset-bottom) * 0.4)',maxHeight:'65%',overflowY:'auto',padding:14,borderRadius:12,border:'1px solid #b9a17c',background:paper,boxShadow:'0 6px 26px #4d3d2833',color:ink}},
    h('strong',null,name(who)+' · '+target.post),h('p',{style:{fontSize:11,lineHeight:1.6,margin:'6px 0 10px'}},shop.phase==='plan'?'选一个空岗位，或挂自己的卡当工牌。':'这班已经开门，明天再调整岗位；工牌仍可更换。'),
    error&&h('p',{role:'alert',style:{fontSize:12,color:'#a44d36'}},error),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}},D.SHOP.POSTS.filter(p=>p!==target.post).map(to=>row('换去'+to,()=>action('move',{from:target.post,to,charId:who}),!who||!!shop.roster[to]||shop.phase!=='plan',{key:to})),
     row('挂工牌',()=>{setPost(target.post);setFilter({who,rar:'',q:''});change('badge');},!who),row('今天休息',()=>action('assign',{post:target.post,charId:'',expectedId:who}),!who||shop.phase!=='plan'),row('回到店里',onClose))));}
  if(page==='staff')content=h('div',{style:box},h('p',{style:{fontSize:12,lineHeight:1.8}},'开门前排班。换岗先腾出原岗位；休息后该岗空着。'),D.SHOP.POSTS.map(p=>h('section',{key:p,style:{...box,padding:12,border:'1px solid #a28a6744',borderRadius:8}},
   h('strong',null,p+' · '+name(shop.roster[p])),
   row('挂工牌',()=>{setPost(p);setFilter({who:shop.roster[p]||'',rar:'',q:''});change('badge');},!shop.roster[p]),
   h('select',{'aria-label':p+'排班',value:shop.roster[p]||'',disabled:busy||shop.phase!=='plan',onChange:e=>action('assign',{post:p,charId:e.target.value,expectedId:shop.roster[p]||''}),style:button},h('option',{value:''},'今天休息 · 空着'),characters.filter(c=>cards.some(k=>k.charId===c.id&&k.text)).map(c=>h('option',{key:c.id,value:c.id,disabled:D.SHOP.POSTS.some(q=>q!==p&&shop.roster[q]===c.id)},name(c.id)))))));
  else if(page==='window'||page==='badge'){
   const selected=page==='window'?shop.window:[shop.badge[post]],available=page==='badge'?cards.filter(c=>c.charId===shop.roster[post]):cards;
   content=h(React.Fragment,null,h('p',{style:{fontSize:12,lineHeight:1.8}},page==='window'?'点卡摆上或撤下（'+shop.window.length+' / '+D.shopWinSlots(shop)+'）。':post+' · '+name(shop.roster[post])+'的卡；点已挂的卡可以取下。R +6%、SR +10%、SSR +15%，✦ 是作用对上这个岗再 +5%。'),h(StampShopFilters,{characters,cards:available,filter,noWho:page!=='window',fit:page==='window'?[]:(D.SHOP_BADGE_FIT[post]||[]),onChange:value=>{setFilter(value);if(page==='window')windowFilter.current=value;}}),
    h('div',{style:box},...g.StampShop.sortedCards(available,selected,filter).map(c=>row(h(React.Fragment,null,h(ShopThumb,{card:c}),h('span',null,(selected.includes(c.id)?'已选 · ':'')+(c.text?.name||'一枚邮票'),h('small',{style:{display:'block',marginTop:4}},name(c.charId)+' · '+c.rarity+(page!=='window'&&D.shopBadgeFit(post,c)?' · ✦':'')))),()=>action(page==='window'?'window':'badge',page==='window'?{cardId:c.id}:{post,cardId:shop.badge[post]===c.id?'':c.id}),false,{key:c.id,'aria-pressed':selected.includes(c.id),style:{display:'flex',alignItems:'center',gap:10,borderColor:selected.includes(c.id)?'#719285':'#9f8e7144'}}))));
  }else if(page==='decor'){
   const month=new Date().getMonth()+1,names=D.SHOP.DECOR.map(d=>d.k).concat((D.SHOP.MONTHLY[month]||[]).map(x=>x[0]),shop.decor),all=[...new Set(names)];
   content=h('div',{style:box},h('p',{style:{fontSize:12,lineHeight:1.8}},shop.coins+' 枚邮花。买过的限定摆件过月也留着；每件最多翻新到三级。'),all.map(k=>{const d=D.shopDecorOf(k);if(!d)return null;const has=shop.decor.includes(k),lv=shop.decorLv[k]||1,cost=has?D.shopUpPrice(shop,k):d.price;return row(k+' · '+(has?'等级'+lv+' · '+(cost?'翻新 '+cost+' 枚':'已到顶'):'买下 '+cost+' 枚'),()=>action('decor',{name:k}),has&&!cost,{key:k,style:target.name===k?{borderColor:'#719285'}:{}});}));
  }else if(page==='story')content=h('div',{style:{...box,lineHeight:1.9,whiteSpace:'pre-wrap'}},shop.closing.length?shop.closing.map((line,i)=>h('p',{key:i},line)):h('p',null,'这次只关了门，没有写故事。'),...(shop.notes||[]).map((n,i)=>h('div',{key:'n'+i,style:{margin:'10px 0',padding:'8px 10px',background:'#fffbe8',boxShadow:'0 2px 5px rgba(47,42,34,.12)',lineHeight:1.6}},h('small',{style:{display:'block',color:'#9a6a4a'}},name(n.speakerId)+' 留的便条'),n.text)));
  else if(page==='guest')content=h('div',{style:box},shop.customers.map(c=>h('section',{key:c.id,style:{...box,padding:12,border:'1px solid #a28a6744',borderRadius:8}},h('strong',null,(c.visitor?name(c.charId):c.name||'寄信的客人')+(c.done?' · 已招待':'')),c.visitor?c.meet?.length?h(React.Fragment,null,c.meetCast?.staffId&&row('看看这段对话',()=>{onClose();onReplay(c.id);}),c.meet.map((line,i)=>h('p',{key:i,style:{fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap'}},line))):row('去文字版听他们说两句（一次调用）',onText):c.tough?row('去文字版打一局',onText,c.done):row(c.wantChar?'招待这位明信片客人':'招待',()=>action('serve',{id:c.id}),c.done))));
  else content=h('div',{style:box},h('p',{style:{fontSize:12,lineHeight:1.8}},'第 '+shop.day+' 天 · '+g.StampDuel.shopPeriod()+' · '+shop.coins+' 枚邮花。店里改的东西和集邮社同步。'),
   row('店员排班与工牌',()=>change('staff')),row('橱窗里的卡',()=>change('window')),row('装修与翻新',()=>change('decor')),row('今天的客人',()=>change('guest')),
   shop.phase==='plan'?row('开门接客',()=>action('open'),g.StampDuel.shopPeriod()==='半夜'):shop.phase==='open'?h(React.Fragment,null,row(g.StampShop.hasResult('close')?'保存已写好的打烊（不再调用）':'打烊并写店里的故事（花一次调用）',()=>action('close')),row('只关门（不写故事）',()=>action('closeLocal'))):row('重看打烊那段',()=>change('story')),
   row('去集邮社文字版',onText));
  return h('section',{'data-wk':'fairypage','data-part':'shop-actions',className:'absolute inset-0 flex flex-col',style:{background:paper,color:ink,zIndex:35}},h(Head,{zh:title,bg:'transparent',onBack:back}),
   h('div',{ref:scroll,onScroll:e=>{positions.current[page]=e.currentTarget.scrollTop;},className:'flex-1 min-h-0 overflow-y-auto',style:{padding:'14px 16px',fontFamily:F_BODY}},error&&h('p',{role:'alert',style:{fontSize:12,color:'#a44d36'}},error),busy&&h('p',{role:'status',style:{fontSize:12}},'正在处理，请稍等…'),content),
   h('div',{className:'shrink-0',style:{minHeight:56,padding:'6px 16px',paddingBottom:COMPOSER_PAD_BOTTOM,display:'flex',alignItems:'center',borderTop:'1px solid #a28a6744'}},row('回到店里',onClose)));
 }
 g.StampShopFilters=StampShopFilters;g.StampShopPanel=StampShopPanel;
})(window);
