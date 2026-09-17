import {seasonOf,weather,ACTIVITIES,journalText} from './world.mjs?v=fg-53f916426495c476';
// This book renders saved plans and local facts; opening it never calls a model.
export function installSeasonBook({getState,getHost,refresh}){
 const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let busy=false,lastScroll=0;
 function recordFor(host,day){try{return host?.planState(day);}catch(e){return {status:'failed',error:e.message};}}
 function draw(){const s=getState(),season=seasonOf(s.day),host=getHost(),record=recordFor(host,s.day),plan=record?.plan,body=$('season-days'),scroller=$('season-dialog').querySelector('.book-body'),scroll=$('season-dialog').open?scroller.scrollTop:lastScroll;
 $('season-title').textContent=`第 ${season.year} 年 · ${season.name}季`;
 $('season-summary').textContent=plan?plan.title:`每季 14 天，现在是第 ${season.day} 天。你们可以继续自由生活，也可以一起安排这一季。`;
 $('season-generate').disabled=busy||record?.status==='ready';$('season-generate').textContent=busy?'正在一起安排…':record?.status==='ready'?'这一季已安排好':record?'重试这一季':'一起安排这一季';
 $('season-policy').textContent='本季每天：'+Object.entries(season.weather).map(([kind,weight])=>kind+' '+weight+'%').join('、')+'。同一天刷新不重抽。'+'每位同行者每季生成一次，保存后每天沿用；新季节再由你点开安排。雨雪时会改到屋檐下活动。同行或等候时优先听你的招呼，想继续日程可在同行者面板点「按自己的安排」。';
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
 $('season-open').onclick=()=>{draw();$('season-dialog').showModal();$('season-dialog').querySelector('.book-body').scrollTop=lastScroll;};const rememberScroll=()=>{lastScroll=$('season-dialog').querySelector('.book-body').scrollTop;};$('season-close').onclick=()=>{rememberScroll();$('season-dialog').close();};$('season-dialog').addEventListener('cancel',rememberScroll);
 $('season-generate').onclick=async()=>{if(busy)return;const host=getHost();if(!host?.planSeason){$('season-error').textContent='从小手机进入并选择角色，就能一起安排这一季。';return;}busy=true;draw();try{await host.planSeason(!!recordFor(host,getState().day));refresh();}catch(e){$('season-error').textContent=e.message;}$('season-generate').disabled=false;busy=false;const message=$('season-error').textContent;draw();if(message&&!$('season-error').textContent)$('season-error').textContent=message;};
 return {draw};
}
