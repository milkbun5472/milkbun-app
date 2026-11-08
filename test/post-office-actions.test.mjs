import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createShopFlow} from '../apps/post-office/flow.mjs';
import {STORY_ACTIONS,STORY_ACTION_IDS} from '../apps/fairy-garden/story-actions.mjs';
const staff=[{kind:'staff',id:'a',name:'甲',post:'柜台',x:-1.45,z:.1,yaw:0,look:{}},{kind:'staff',id:'b',name:'乙',post:'分拣',x:-2.25,z:-1.65,yaw:Math.PI,look:{}},{kind:'staff',id:'d',name:'丁',post:'看店',x:3,z:-.6,yaw:0,seatHeight:.53,look:{}}];
const state=decor=>({staff,customers:[],decor:decor||[{builder:'bench'},{builder:'lamp'}],closed:false,phase:'plan',ambient:false});
const additions=['wave','pat','stretch','hand','laugh','sigh','cheer','bow','crossarms','sweep','lamp','sit'];
const step=(f,n)=>{for(let i=0;i<n;i++)f.step(.05);};
for(const action of additions)test(action+' has a finite shared duration, performs and finishes without changing the original turns',()=>{
 const f=createShopFlow(),turns=[{speakerId:'a',actorId:'a',targetId:'b',action,text:'这是构造的原文。'.repeat(6)}],before=structuredClone(turns);f.reconcile(state());f.startClosing({turns});
 assert.ok(STORY_ACTIONS[action].seconds>0&&STORY_ACTIONS[action].seconds<=4);let performed=false;
 for(let i=0;i<1200&&!performed;i++){f.step(.05);performed=f.performance?.action===action&&f.performance.progress>=.55;}
 assert.ok(performed,JSON.stringify(f.snapshot()));if(action==='hand'){assert.equal(f.units.get('staff:a').letter,false);assert.equal(f.units.get('staff:b').letter,true);assert.ok(f.units.get('staff:b').letterId);}
 if(action==='pat')assert.equal(f.units.get('staff:b').partnerMotion.action,'pat');if(action==='lamp')assert.ok(f.storyLampOff);
 f.skipStory();step(f,2200);assert.ok(f.closingDone,JSON.stringify(f.snapshot()));assert.deepEqual(turns,before);
});
test('missing targets, self targets, unknown actions and an occupied last seat fall back to talk',()=>{
 for(const action of ['hand','pat','help','unknown','constructor','toString'])for(const targetId of ['absent','a']){const f=createShopFlow();f.reconcile(state());f.startClosing({turns:[{actorId:'a',targetId,action,text:'原文保留。'}]});assert.equal(f.performance.action,'talk');step(f,2200);assert.ok(f.closingDone);}
 const f=createShopFlow();f.reconcile(state([]));f.startClosing({turns:[{actorId:'a',action:'talk',text:'先说一句。'},{actorId:'a',action:'sit',text:'没有空座时仍继续演出。'}]});f.units.get('staff:d').seated=true;f.nextBeat();assert.equal(f.performance.action,'talk');
});
test('a target leaving mid-action releases the pair and continues as talk',()=>{
 const f=createShopFlow();f.reconcile(state());f.startClosing({turns:[{actorId:'a',targetId:'b',action:'hand',text:'这一句仍保留。'}]});f.units.delete('staff:b');step(f,1);assert.equal(f.performance.action,'talk');step(f,2200);assert.ok(f.closingDone);
});
test('consecutive speech has stable occasional nods and tilts confined to runtime',()=>{
 const sample=()=>{const f=createShopFlow(),rows=Array.from({length:30},(_,i)=>({speakerId:'a',actorId:'a',action:'talk',text:'构造的连续对白 '+i}));f.reconcile(state());f.startClosing({turns:rows});const idle=[];for(let i=0;i<30;i++){idle.push(f.units.get('staff:a').storyMotion.idle||null);f.nextBeat();}return idle;};
 const a=sample();assert.deepEqual(a,sample());assert.ok(a.includes('nod')&&a.includes('tilt')&&a.includes(null));
});
// Frozen from main b15a11427 before this work; only the permitted inventory is masked.
test('the story prompt changes only its action inventory',()=>{
 const source=readFileSync('js/app.js','utf8'),a=source.indexOf('const stampShopChat ='),b=source.indexOf('const openStamps =',a);assert.ok(a>0&&b>a);const body=source.slice(a,b),boundary='先照故事本来的样子写完整正文；写完再沿原有语句给每一句挑一个最贴的动作标签，没有贴切的就用 talk。动作标签只告诉3D场景怎么演，不是写作要求；正文原有的情节、动作描写、句子和段落保持原样，不为使用动作添加情节或动作描写，也不拆碎句子。',normalize=s=>s.replace(boundary,'').replace(/action 可用 .*?；其他动作/,'action 可用 <ACTIONS>；其他动作');
 const expected=readFileSync(new URL('./fixtures/post-office-story-prompt.sha256',import.meta.url),'utf8').trim();assert.equal(createHash('sha256').update(normalize(body).trim()).digest('hex'),expected);
 assert.equal(body.split(boundary).length,2,'the story-first boundary appears exactly once');assert.doesNotMatch(globalThis.CharacterStoryActions.prompt,/尽量多用|每句都要有动作|多样一点/);
 assert.match(body,/action 可用 .*CharacterStoryActions\.prompt/);const list=globalThis.CharacterStoryActions.prompt;for(const action of STORY_ACTION_IDS)assert.match(list,new RegExp('\\b'+action+'（'));
});
