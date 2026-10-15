import test from 'node:test';
import assert from 'node:assert/strict';
import {motionProfile,inferMotionStyle,motionClock,motionPosture,MOTION_STYLES} from './motion-profile.mjs';
import {dailyTaskAt} from './daily-workflow.mjs';
import {buildSpace} from './spaces.mjs';
test('动作气质只参考明确性格，身份住址贫富不用于判断；否定和不明确的混合词回自然',()=>{
 assert.equal(inferMotionStyle('性格沉稳寡言，平时动作安静'),'calm');
 assert.equal(inferMotionStyle('做事干脆利落'),'brisk');assert.equal(inferMotionStyle('性格慵懒松弛'),'relaxed');assert.equal(inferMotionStyle('性格活泼好动'),'lively');
 for(const s of ['男生，富家研究员，住大房子','女生，贫穷的出租屋大学生','并不是安静的人，也不喜欢慵懒','他不安静','性格安静又活泼'])assert.equal(inferMotionStyle(s),'natural');
});
test('手动选择覆盖参考人设；同一人的气质与相位稳定，各人独立',()=>{
 const a=motionProfile({id:'a:ta',persona:'性格沉稳',style:'lively'}),b=motionProfile({id:'__me:me',persona:'性格沉稳',style:'lively'});
 assert.equal(a.style,'lively');assert.equal(a.source,'chosen');assert.deepEqual(a,motionProfile({id:'a:ta',persona:'性格沉稳',style:'lively'}));assert.notEqual(motionClock(3,a),motionClock(3,b));assert.equal(motionClock(3,null),3);assert.equal(motionProfile({style:'bad',persona:'动作利落'}).style,'brisk');
 assert.ok(motionPosture(motionProfile({style:'relaxed'}),1).tilt>motionPosture(motionProfile({style:'calm'}),1).tilt+.02);
 for(const style of Object.keys(MOTION_STYLES))for(const persona of ['', '性格活泼好动','性格沉稳寡言','动作干脆利落','平时慵懒松弛','性格安静又活泼']){const manual=motionProfile({id:'__me:me',persona,style});assert.equal(manual.style,style);assert.equal(manual.source,'chosen');}
});
test('两人做同一动作也错开相位，外观气质不改真实活动与家具接点',()=>{
 const map=buildSpace('dayHome'),spot=map.spots.find(s=>s.action==='tea'),a=motionProfile({id:'a:ta'}),b=motionProfile({id:'__me:me'});let distinct=0;
 for(let i=0;i<120;i++){const x=dailyTaskAt({action:'tea'},spot,map,i/10,{motion:a}),y=dailyTaskAt({action:'tea'},spot,map,i/10,{motion:b});assert.equal(x.furniture,y.furniture);assert.equal(x.kind,y.kind);if(Math.abs(x.progress-y.progress)>.05)distinct++;}assert.ok(distinct>100);
 for(const style of Object.keys(MOTION_STYLES)){const cook=map.spots.find(s=>s.action==='cook'),x=dailyTaskAt({action:'cook'},cook,map,3,{motion:motionProfile({style})}),plain=dailyTaskAt({action:'cook'},cook,map,3);assert.deepEqual(x.contact,plain.contact);assert.equal(dailyTaskAt({action:'cook'},cook,map,3,{motion:a,moving:true}),null);}
});
