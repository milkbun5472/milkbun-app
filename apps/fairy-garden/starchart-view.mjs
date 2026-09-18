import * as T from 'three';
import {createStarChart} from './starchart.mjs?v=fg-0476cab482ab41c6';
// 星图那一夜的画面：桌上一圈六个空位，六片碎图散着，拖到位就亮一角；拼齐了整张图升起来。
// ⚠️照画咒那套外壳长（scene-activity + 屏幕坐标映射），资格与结算都不在这儿。
export function makeStarChartView({scene,camera,onClose}){
 const root=new T.Group();root.visible=false;scene.add(root);const chart=new T.Group();root.add(chart);
 const flat=(color,opacity)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,toneMapped:false});
 const ring=new T.Mesh(new T.TorusGeometry(.78,.01,6,80),flat('#9fb8e6',.35));ring.renderOrder=99;chart.add(ring);
 const slotMeshes=Array.from({length:6},()=>{const m=new T.Mesh(new T.CircleGeometry(.2,6),flat('#9fb8e6',.16));m.renderOrder=100;chart.add(m);return m;});
 const pieceMeshes=Array.from({length:6},()=>{const g=new T.Group();const body=new T.Mesh(new T.CircleGeometry(.2,6),flat('#dfe8ff',.95));body.renderOrder=102;g.add(body);const rim=new T.Mesh(new T.RingGeometry(.19,.215,6),flat('#f4ecc8',.9));rim.renderOrder=103;g.add(rim);for(let i=0;i<3;i++){const star=new T.Mesh(new T.CircleGeometry(.018,6),flat('#fff7d4',1));star.position.set((Math.random()-.5)*.22,(Math.random()-.5)*.22,.001);star.renderOrder=104;g.add(star);}chart.add(g);return g;});
 const lines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#f4ecc8',transparent:true,opacity:0,depthTest:false,depthWrite:false}));lines.renderOrder=105;chart.add(lines);
 const sparks=Array.from({length:32},()=>{const m=new T.Mesh(new T.OctahedronGeometry(.02),flat('#fff2c4',1));m.renderOrder=106;root.add(m);return m;});
 const dialog=document.createElement('dialog');dialog.id='starchart-dialog';dialog.className='scene-activity brewing-dialog';dialog.setAttribute('aria-labelledby','starchart-title');
 dialog.innerHTML='<div class="dialog-title"><button class="activity-close" aria-label="返回星图桌">‹</button><h2 id="starchart-title">星图那一夜</h2><span class="title-spacer"></span></div><div class="brew-body"><div class="brew-caption"><p id="starchart-instruction" aria-live="polite"></p><p id="starchart-count"></p></div><div id="starchart-surface" aria-label="把散着的星图碎片拖到桌上的空位"></div><div class="brew-controls"><p id="starchart-message" aria-live="polite"></p><button id="starchart-help">按住，让他帮你拼</button><button id="starchart-send" hidden>摊开整张星图</button><small id="starchart-footnote">没有时限 · 拖到一半松手也没关系</small></div></div>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s);
 let session=null,config=null,view=null,pointer=null,helping=false,phase='',frames=0,center=new T.Vector3();
 const screen=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
 function localScreen(p){chart.updateMatrixWorld(true);return screen(chart.localToWorld(new T.Vector3(p.x,p.y,0)));}
 function toLocal(e){const o=localScreen({x:0,y:0}),a=localScreen({x:1,y:0}),b=localScreen({x:0,y:1});return {x:(e.clientX-o.x)/(a.x-o.x),y:(e.clientY-o.y)/(b.y-o.y)};}
 function sync(){if(!session)return;const stage=session.stage;dialog.dataset.stage=stage;$('#starchart-instruction').textContent=stage==='place'?'把散着的碎片一片片拖到桌上的空位。':stage==='ready'?'六片都归位了，星图在等你摊开。':stage==='send'?'星图慢慢亮起来，整张升到了两个人中间……':'这一夜记下了。';$('#starchart-count').textContent=stage==='done'?'':session.count+' / 6';$('#starchart-help').hidden=stage!=='place';$('#starchart-send').hidden=!['ready','done'].includes(stage);$('#starchart-send').textContent=stage==='done'?'收好，回到桌边':'摊开整张星图';$('#starchart-footnote').textContent=stage==='done'?'相处册里多了一格':'拼齐才算 · 随时可以返回';}
 function reset(){pointer=null;helping=false;if(session&&session.held>=0)session.drop();}
 function close(){if(!session)return;session=null;reset();root.visible=false;dialog.close();document.body.classList.remove('brewing');onClose(view);}
 $('.activity-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const surface=$('#starchart-surface');
 surface.onpointerdown=e=>{if(!session||session.stage!=='place')return;const p=toLocal(e);if(session.grab(p.x,p.y)){pointer=e.pointerId;surface.setPointerCapture(pointer);}};
 surface.onpointermove=e=>{if(pointer!==e.pointerId||!session)return;const p=toLocal(e);session.drag(p.x,p.y);};
 const release=e=>{if(!session)return;if(pointer!==null){session.drop();sync();}pointer=null;};
 surface.onpointerup=release;surface.onpointercancel=release;surface.onlostpointercapture=release;
 const help=$('#starchart-help');help.onpointerdown=e=>{helping=true;help.setPointerCapture(e.pointerId);};help.onpointerup=()=>{helping=false;};help.onpointercancel=()=>{helping=false;};help.onlostpointercapture=()=>{helping=false;};help.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();helping=true;}};help.onkeyup=()=>{helping=false;};help.onblur=()=>{helping=false;};
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 $('#starchart-send').onclick=()=>{if(session?.stage==='done')close();else {session?.send();sync();}};
 return {get active(){return !!session;},
 open(options,saved){if(session)return;config=options;view=saved;center.set(options.position.x,options.height+.9,options.position.z);session=createStarChart(options.seed);phase='';root.visible=true;chart.scale.setScalar(1);chart.visible=true;$('#starchart-message').textContent=options.helper?'他就在桌子那头，手指着该放哪儿。':'';slotMeshes.forEach((m,i)=>m.position.set(session.slots[i].x,session.slots[i].y,0));
  const pts=[];for(let i=0;i<6;i++){const a=session.slots[i],b=session.slots[(i+1)%6];pts.push(new T.Vector3(a.x,a.y,0),new T.Vector3(b.x,b.y,0));}lines.geometry.setFromPoints(pts);lines.material.opacity=0;
  document.body.classList.add('brewing');dialog.showModal();sync();},
 camera(){if(!session)return;const aspect=innerWidth/innerHeight,span=Math.max(3.6,4.6*aspect);camera.zoom=1;camera.userData.fogOffset=0;camera.left=-span/2;camera.right=span/2;camera.top=span/aspect/2;camera.bottom=-span/aspect/2;camera.position.set(center.x+4,center.y+3.5,center.z+6);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();chart.position.copy(center);chart.position.y+=innerHeight<550?.3:1.05;chart.quaternion.copy(camera.quaternion);},
 update(dt,time){if(!session)return;frames++;this.camera();if(helping)session.help(dt);if(phase!==session.stage){phase=session.stage;sync();}
  const n=session.count,sending=session.stage==='send',p=session.progress;
  pieceMeshes.forEach((g,i)=>{const piece=session.pieces[i];g.position.set(piece.x,piece.y,piece.placed?.002:.01);g.visible=session.stage!=='done';const held=session.held===i;g.scale.setScalar(held?1.15:1);g.children[0].material.opacity=piece.placed?1:.9;g.children[1].material.color.set(piece.placed?'#fff2c4':held?'#ffffff':'#c9d4ea');});
  slotMeshes.forEach((m,i)=>{const piece=session.pieces[i];m.material.opacity=piece.placed?0:.12+Math.sin(time*2+i)*.06;});
  ring.material.opacity=.25+n/6*.4;lines.material.opacity=session.stage==='place'?0:session.stage==='ready'?.5+Math.sin(time*3)*.2:1;
  chart.scale.setScalar(sending?1+p*.35:1);chart.position.y+=sending?p*.9:0;chart.visible=session.stage!=='done';
  sparks.forEach((s,i)=>{s.visible=sending||session.stage==='ready';if(!s.visible)return;const a=i*1.9+time*1.2,r=sending?(.4+(i%6)*.18)*(1+p):.85+Math.sin(time*2+i)*.05;s.position.set(center.x+Math.cos(a)*r,center.y+.6+(sending?p*1.6:0)+Math.sin(a*2)*.25,center.z+Math.sin(a)*r);s.material.opacity=sending?1-p*.4:.5;});
  const result=session.tick(dt,config.commit);if(result!==undefined){phase=session.stage;$('#starchart-message').textContent=result.text;sync();if(!result.ok){$('#starchart-instruction').textContent='这一夜没记成，碎片还在。';}}},
 inspect:()=>session?{...session.snapshot(),helping,frames,helper:!!config.helper,slots:session.slots.map(localScreen),pieces:session.pieces.map(localScreen)}:null,close};
}
