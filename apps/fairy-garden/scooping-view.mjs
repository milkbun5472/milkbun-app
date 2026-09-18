import * as T from 'three';
import {createScoop} from './scooping.mjs?v=fg-5d2ce0321b5107f9';
import {MAPS,lakeFrozen} from './world.mjs?v=fg-5d2ce0321b5107f9';
export function makeScoopingView({scene,camera,lake,onClose}){
 const site=MAPS.garden.lake.bottle,root=new T.Group();root.visible=false;scene.add(root);
 const wood=new T.MeshStandardMaterial({color:'#ba9060',roughness:.75}),thread=new T.LineBasicMaterial({color:'#eadcc0',transparent:true,opacity:.7});
 const net=new T.Group();root.add(net);
 const rim=new T.Mesh(new T.TorusGeometry(.52,.026,8,48),wood);rim.rotation.x=Math.PI/2;net.add(rim);
 const positions=[];for(let i=-4;i<=4;i++){const a=i*.105,b=Math.sqrt(.49*.49-a*a);positions.push(a,0,-b,a,-.18,0,a,-.18,0,a,0,b,-b,0,a,0,-.18,a,0,-.18,a,b,0,a);}
 net.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)),thread));
 const handle=new T.Mesh(new T.CylinderGeometry(.025,.036,1,8),wood);handle.rotation.x=Math.PI/2;handle.position.z=.98;root.add(handle);
 const hole=new T.Mesh(new T.CircleGeometry(.85,48),new T.MeshStandardMaterial({color:'#3d7e8a',roughness:.25}));hole.rotation.x=-Math.PI/2;hole.position.set(site.x,MAPS.garden.lake.iceHeight+.012,site.z);root.add(hole);
 const light=new T.Mesh(new T.TorusGeometry(.72,.018,6,48),new T.MeshBasicMaterial({color:'#f7e8b4',transparent:true,opacity:.55}));light.rotation.x=Math.PI/2;root.add(light);
 const dialog=document.createElement('dialog');dialog.id='scooping-dialog';dialog.className='scene-activity brewing-dialog';dialog.setAttribute('aria-labelledby','scoop-title');dialog.innerHTML='<div class="dialog-title"><button class="activity-close" aria-label="返回月湖">‹</button><h2 id="scoop-title">月湖 · 捞一封来信</h2><span class="title-spacer"></span></div><div class="brew-body"><div class="brew-caption"><p id="scoop-instruction" aria-live="polite">拖动网兜靠近瓶子，松手收网。</p></div><div id="scoop-water" aria-label="拖网兜的水面"></div><div class="brew-controls"><p id="scoop-hint" aria-live="polite"></p><button id="scoop-assist">慢慢靠近瓶子</button><small>捞空可以再试 · 收上来才算领取</small></div></div>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s),ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-site.height),point=new T.Vector3();let session=null,config=null,view=null,pointer=null,assisting=false;
 const screen=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2};};
 function close(){if(!session)return;session=null;pointer=null;assisting=false;root.visible=false;dialog.close();document.body.classList.remove('brewing');onClose(view);}
 function release(){if(!session||session.stage!=='aim')return;pointer=null;const p=lake.bottle.position;if(session.release(Math.hypot(net.position.x-p.x,net.position.z-p.z))){$('#scoop-instruction').textContent='接住了，慢慢提起来……';$('#scoop-assist').hidden=true;}else $('#scoop-hint').textContent='这次擦过去了，再靠近一点就好。';}
 const surface=$('#scoop-water');surface.onpointerdown=e=>{if(session?.stage!=='aim')return;pointer=e.pointerId;surface.setPointerCapture(pointer);move(e);};
 function move(e){if(pointer!==e.pointerId||session?.stage!=='aim')return;ray.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);if(ray.ray.intersectPlane(plane,point)){net.position.x=site.x+Math.max(-1.25,Math.min(.3,point.x-site.x));net.position.z=site.z+Math.max(-.8,Math.min(.25,point.z-site.z));}}
 surface.onpointermove=move;surface.onpointerup=release;surface.onpointercancel=()=>{pointer=null;};surface.onlostpointercapture=()=>{pointer=null;};
 $('#scoop-assist').onclick=()=>{if(session?.stage==='aim'){assisting=true;$('#scoop-hint').textContent='沿着水纹，慢慢把网兜移过去……';}};
 $('.activity-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});window.addEventListener('blur',()=>{pointer=null;assisting=false;});
 return {get active(){return !!session;},get helping(){return !!session&&config.helper;},get stage(){return session?.stage;},
 open(options,saved){if(session)return;config=options;view=saved;session=createScoop();net.position.set(site.x-.55,site.height-.12,site.z-.55);root.visible=true;hole.visible=lakeFrozen(options.state);light.visible=options.helper;$('#scoop-assist').hidden=false;$('#scoop-instruction').textContent=hole.visible?'冰边化开了一小圈水，拖网兜接住瓶子。':'拖动网兜靠近瓶子，松手收网。';$('#scoop-hint').textContent=options.helper?'同行者在身旁替你指着瓶子。':'不用抢，瓶子会慢慢漂。';document.body.classList.add('brewing');dialog.showModal();},
 camera(){if(!session)return;const aspect=innerWidth/innerHeight,span=Math.max(4.6,6*aspect);camera.zoom=1;camera.userData.fogOffset=0;camera.left=-span/2;camera.right=span/2;camera.top=span/aspect/2;camera.bottom=-span/aspect/2;camera.position.set(site.x+3.2,5.5,site.z+6);camera.lookAt(site.x,.3,site.z+.4);camera.updateProjectionMatrix();camera.updateMatrixWorld();},
 update(dt,time){if(!session)return;this.camera();const bottle=lake.bottle;if(assisting&&session.stage==='aim'){net.position.x+=(bottle.position.x-net.position.x)*Math.min(1,dt*2);net.position.z+=(bottle.position.z-net.position.z)*Math.min(1,dt*2);if(net.position.distanceTo(bottle.position)<.3){assisting=false;release();}}
 if(config.hand){const hand=config.hand(),end=net.position.clone();end.z+=.48;const delta=hand.clone().sub(end);handle.position.copy(hand).add(end).multiplyScalar(.5);handle.scale.y=delta.length();handle.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
 light.position.set(bottle.position.x,site.height-.12,bottle.position.z);light.scale.setScalar(1+Math.sin(time*2)*.08);
 if(session.stage==='lift'){net.position.y=site.height-.12+session.progress*1.1;bottle.position.set(net.position.x,net.position.y+.14,net.position.z);}
 session.tick(dt,()=>{const commit=config.commit;close();commit();});},
 inspect:()=>session?{...session.snapshot(),net:screen(net.position),bottle:screen(lake.bottle.position),winter:hole.visible,helper:config.helper}:null,close};
}
