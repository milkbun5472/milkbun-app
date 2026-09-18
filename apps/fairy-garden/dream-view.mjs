import * as T from 'three';
import {MAPS,SEED_PLOTS,dreamStage,spotParse,seedPlot} from './world.mjs?v=fg-0fa4d02be9d6af65';
import {makeCurio} from './curio-view.mjs?v=fg-0fa4d02be9d6af65';
import {makeDreamFlower} from './keepsake-view.mjs?v=fg-0fa4d02be9d6af65';
export function makeDreamGarden(scene,getViews){
 const root=new T.Group();root.name='梦种花圃';scene.add(root);const plots=[];
 for(let i=0;i<SEED_PLOTS;i++){const b=MAPS.garden.flowerbeds[(1+Math.floor(i/3))%MAPS.garden.flowerbeds.length],g=new T.Group();g.position.set(b.x+(1-i%3)*b.w*.28,.30,b.z-.23);root.add(g);const model=makeDreamFlower(),seed=makeCurio('seed');seed.scale.setScalar(.32);g.add(model,seed);plots.push({g,model,seed});}
 const flying=makeCurio('seed');flying.scale.setScalar(.35);root.add(flying);
 return {root,update(s,time,job){root.visible=s.map==='garden';flying.visible=job?.kind==='dreamSow';if(flying.visible){const i=Array.from({length:SEED_PLOTS},(_,i)=>i).find(i=>!s.seeds.some(x=>!x.done&&seedPlot(s,x)===i))||0;flying.position.copy(plots[i].g.position);flying.position.y+=Math.max(0,1-job.time/1.5)*.9;flying.rotation.y=time*2;}const active=s.seeds.filter(x=>!x.done);plots.forEach((p,i)=>{const x=active.find(x=>seedPlot(s,x)===i);p.g.visible=!!x?.origin;if(!p.g.visible)return;const stage=dreamStage(s,x);p.seed.visible=stage===0;p.model.visible=stage>0;p.model.scale.setScalar(stage===1?.45:stage===2?.8:1);p.model.userData.flower.scale.setScalar(stage<3?.38:1);p.model.rotation.z=Math.sin(time*1.3+i)*.035;});
 },inspect(){return plots.filter(p=>p.g.visible&&root.visible).map(p=>({x:p.g.position.x,z:p.g.position.z,seed:p.seed.visible,size:p.model.scale.x}));}};
}
