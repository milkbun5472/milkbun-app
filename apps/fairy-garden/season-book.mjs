import {seasonOf,weather,ACTIVITIES,journalText,calendarMarks,festivalBook,villageRules} from './world.mjs?v=fg-06cafed5415b1737';
// This book renders saved plans and local facts; opening it never calls a model.
export function installSeasonBook({getState,getHost,refresh}){
 const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let busy=false,lastScroll=0;
 // 两条丝带书签（她 2026-09-18：「简易版攻略」→「村里的规矩」）：第一次翻开落在规矩页，之后落在日历。
 // ⚠️「看过没有」只是这台设备的小方便，存 localStorage；读不到就当没看过（隐私窗口、清过数据都会这样）
 const SEEN='fairy-garden-rules-seen';let page=(()=>{try{return localStorage.getItem(SEEN)?'calendar':'rules';}catch(e){return 'rules';}})();
 function showPage(next){page=next;$('season-page-calendar').hidden=page!=='calendar';$('season-page-rules').hidden=page!=='rules';for(const [id,key] of [['season-tab-calendar','calendar'],['season-tab-rules','rules']]){const b=$(id);b.classList.toggle('on',page===key);b.setAttribute('aria-selected',String(page===key));}
  if(page==='rules'){try{localStorage.setItem(SEEN,'1');}catch(e){}}}
 $('season-tab-calendar').onclick=()=>showPage('calendar');$('season-tab-rules').onclick=()=>showPage('rules');
 function drawRules(){const box=$('season-rules');box.replaceChildren();for(const r of villageRules()){const row=el('div');row.className='rule';row.append(el('b',r.head),el('span',r.text));box.append(row);}}
 function recordFor(host,day){try{return host?.planState(day);}catch(e){return {status:'failed',error:e.message};}}
 function draw(){const s=getState(),season=seasonOf(s.day),host=getHost(),record=recordFor(host,s.day),plan=record?.plan,body=$('season-days'),scroller=$('season-dialog').querySelector('.book-body'),scroll=$('season-dialog').open?scroller.scrollTop:lastScroll;
 $('season-title').textContent=`第 ${season.year} 年 · ${season.name}季`;
 $('season-summary').textContent=plan?plan.title:`每季 14 天，现在是第 ${season.day} 天。你们可以继续自由生活，也可以一起安排这一季。`;
 $('season-generate').disabled=busy||record?.status==='ready';$('season-generate').textContent=busy?'正在一起安排…':record?.status==='ready'?'这一季已安排好':record?'重试这一季':'一起安排这一季';
 $('season-policy').textContent='本季每天：'+Object.entries(season.weather).map(([kind,weight])=>kind+' '+weight+'%').join('、')+'。同一天刷新不重抽。'+'每位同行者每季生成一次，保存后每天沿用；新季节再由你点开安排。雨雪时会改到屋檐下活动。同行或等候时优先听你的招呼，想继续日程可在同行者面板点「按自己的安排」。';
 // 这一季的日历（她 2026-09-18）：集市日、换板子、他约你、花开、开封、瓶子到、他的生日，全从存档算
 // 换季那晚的灯会：这一季要带的三样攒到哪儿了（全从 world.festivalBook 来）
 {const f=festivalBook(s),box=$('season-festival');box.replaceChildren();box.append(el('b',f.done?'这一季的灯放过了':'第 '+f.day+' 天晚上 · 换季的灯会'+(f.tonight?(f.open?'（开着）':'（今晚）'):'')));if(!f.done){for(const n of f.needs){const row=el('span',n.label+(n.have?'':' · '+n.hint));row.className='need'+(n.have?' have':'');box.append(row);}box.append(el('small',f.ready?'东西齐了。那晚天黑后到月潭栈桥，他也会去。':'攒不齐就等下一季；放成了相处册一格、家里多一盏灯笼。'));}else box.append(el('small','放过 '+f.held+' 回。下一回是第 '+f.next+' 天。'));}
 {const cal=$('season-calendar');cal.replaceChildren();const marks=calendarMarks(s,s.birthday);for(let d=1;d<=14;d++){const cell=el('div');cell.className='cell'+(d===season.day?' today':d<season.day?' past':'');cell.append(el('b',String(d)));const w=el('span',weather(season.start+d-1,s.epoch));w.className='mark';cell.append(w);for(const m of marks[d]||[]){const mk=el('span',m);mk.className='mark'+(m==='集市'?' market':m==='他的生日'?' birthday':'');cell.append(mk);}cal.append(cell);}}
 $('season-error').textContent=record?.status==='failed'?record.error||'上次没有完成，可以重试。':'';
 $('season-error-detail').textContent=record?.detail||'';$('season-raw').hidden=!record?.detail;
 body.replaceChildren();
 if(plan)for(const day of plan.days){const details=el('details');details.open=day.day===season.day;const summary=el('summary',`${season.name} ${day.day} 日 · ${weather(season.start+day.day-1,s.epoch)}${day.day===season.day?' · 今天':''}`);details.append(summary,el('p',day.note));for(const [i,a]of day.activities.entries())details.append(el('p',`${['上午','下午','傍晚'][i]} · ${ACTIVITIES[a.id].label}${a.note?'：'+a.note:''}`));body.append(details);}
 else body.append(el('p','目前沿用同行者的日常偏好。生成安排后，角色会每天去相应地点；日程里的想法不是已经发生的事情。'));
 const m=s.magic;$('flower-book').textContent=m.discovered?`星铃花 · 已发现。花藏 ${m.flowers} 朵，屋前已有 ${m.lamps} 盏星铃灯。`:`星铃花 · 尚未收录。两人去林地唤醒种子，带回种下，隔天用清水照料两次后采收。种子 ${m.seeds} 颗${m.planted?'，新芽 '+m.growth+'/2':''}。`;
 $('flower-recipe').textContent='星铃花 ×1 ＋ 月光花 ×3 → 屋前星铃灯。每季林地会出现一颗新种子；小灯会在入夜后亮起。';
 const journal=$('garden-journal');journal.replaceChildren();for(const entry of [...s.journal].reverse().slice(0,30)){const when=seasonOf(entry.day);journal.append(el('p',`第 ${when.year} 年 ${when.name} ${when.day} 日 · ${journalText(entry)}`));}if(!s.journal.length)journal.append(el('p','睡到明天后，这一天真实发生的采集和制作会留在这里。显示最近 30 天，存档保留最近 120 天。'));
 scroller.scrollTop=scroll;
 }
 $('season-open').onclick=()=>{draw();drawRules();showPage(page);$('season-dialog').showModal();$('season-dialog').querySelector('.book-body').scrollTop=lastScroll;};const rememberScroll=()=>{lastScroll=$('season-dialog').querySelector('.book-body').scrollTop;};$('season-close').onclick=()=>{rememberScroll();$('season-dialog').close();};$('season-dialog').addEventListener('cancel',rememberScroll);
 $('season-generate').onclick=async()=>{if(busy)return;const host=getHost();if(!host?.planSeason){$('season-error').textContent='从小手机进入并选择角色，就能一起安排这一季。';return;}busy=true;draw();try{await host.planSeason(!!recordFor(host,getState().day));refresh();}catch(e){$('season-error').textContent=e.message;}$('season-generate').disabled=false;busy=false;const message=$('season-error').textContent;draw();if(message&&!$('season-error').textContent)$('season-error').textContent=message;};
 return {draw};
}
