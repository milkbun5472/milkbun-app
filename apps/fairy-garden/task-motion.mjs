import * as T from 'three';
import {emotionPose} from './emotion-pose.mjs?v=fg-e3f68dca93b2b897';
import {dailyTaskPose} from './daily-motion.mjs?v=fg-e3f68dca93b2b897';
import {pointToolAt} from './reach-hand.mjs?v=fg-e3f68dca93b2b897';

export const GUITAR_HOLD=[0,.14,0],GUITAR_STRUM=[.15,-.13,.093];

// Optional work gestures share the original traveler's rig and real hand anchors.
export function taskPose(task,time){
  if(!task)return null;
  if(task.daily)return dailyTaskPose(task);
  const kind=task.kind,p=Math.max(0,Math.min(1,task.progress||0)),pulse=Math.sin(time*5);
  if(kind==='read'||['wait','look-sign'].includes(kind))return kind==='look-sign'?{left:[0,0,0],right:[0,0,0],tilt:-.035,yaw:Math.sin(time*.7)*.025}:null;
  if(kind==='dance'||kind==='rehearse'){
    const q=emotionPose(kind==='dance'?'dance':'bow',time/(kind==='dance'?5.2:7)%1);
    return {...q,leftLeg:[kind==='dance'?Math.sin(time*2.8)*.11:0,0,0],rightLeg:[kind==='dance'?-Math.sin(time*2.8)*.11:0,0,0],lift:kind==='dance'?.025:0};
  }
  if(kind==='treadmill'){const stride=Math.sin(time*7.5);return {left:[-.18+stride*.32,0,.04],right:[-.18-stride*.32,0,-.04],leftElbow:-.60,rightElbow:-.60,leftLeg:[-stride*.48,0,0],rightLeg:[stride*.48,0,0],tilt:.035,lift:Math.abs(stride)*.012};}
  if(kind==='weights'){const curl=(Math.sin(time*2.2)+1)/2;return {left:[-.12,0,.12],right:[-.12,0,-.12],leftElbow:-.25-curl*.72,rightElbow:-.25-curl*.72,tilt:.012};}
  if(kind==='stretch'){const sway=Math.sin(time*.8);return {left:[-.15,0,.82],right:[-.15,0,-.82],leftElbow:-.12,rightElbow:-.12,tilt:.02,yaw:sway*.025};}
  if(['weight-pick','weight-return'].includes(kind))return {left:[-.55,0,.12],right:[-.55,0,-.12],leftElbow:-.3,rightElbow:-.3,tilt:Math.sin(Math.PI*p)*.04,reach:Math.sin(Math.PI*p)**2};
  if(kind==='basket-pick')return {left:[-.32,0,.12],right:[-.15,0,0],leftElbow:-.2,tilt:Math.sin(Math.PI*p)*.025,reach:Math.sin(Math.PI*p)**2};
  if(['market-pick','checkout','market-pack'].includes(kind))return {left:[-.15,0,.12],right:[-.3,0,-.12],rightElbow:-.4,tilt:.025,reach:Math.sin(Math.PI*p)**2};
  if(kind==='cashier')return {left:[-.25,0,.12],right:[-.45,0,-.12],rightElbow:-.5,tilt:.025,reach:.85,dx:pulse*.018};
  if(kind==='clipboard')return {left:[-.75,0,.08],right:[-.75,0,-.08],leftElbow:-.25,rightElbow:-.25,tilt:.055};
  if(kind==='ticket')return {left:[-.15,0,0],right:[-.65,0,-.1],rightElbow:-.5,tilt:.035};
  if(kind==='luggage'||kind==='pack'||kind==='take-luggage')return {left:[-.15,0,0],right:[-.25,0,-.12],rightElbow:-.25,tilt:kind==='luggage'?0:.04,reach:kind==='luggage'?0:Math.sin(Math.PI*p)**2};
  if(kind==='guitar')return {left:[-.75,0,.12],right:[-.55,0,-.1],leftElbow:-.55,rightElbow:-.8,tilt:.025,guitar:true,dx:Math.sin(time*7)*.025};
  if(kind==='craft')return {left:[-.8,0,.1],right:[-.65,0,-.1],leftElbow:-.5,rightElbow:-.75,tilt:.055,reach:1,dx:pulse*.028,dz:Math.cos(time*3)*.02};
  if(kind==='paint')return {left:[-.22,0,0],right:[-.6,0,-.1],rightElbow:-.8,tilt:.035,reach:1};
  if(kind==='piano')return {left:[-.7,0,.08],right:[-.7,0,-.08],leftElbow:-.75,rightElbow:-.75,tilt:.025,reach:1,dx:Math.sin(time*4)*.016,dy:Math.max(0,pulse)*.008};
  if(kind==='carry')return {left:[-.18,0,0],right:[-.8,0,-.12],rightElbow:0,tilt:0};
  if(kind==='select'||kind==='return'||kind==='tidy')return {left:[-.8,0,.12],right:[-.5,0,-.12],rightElbow:-.8,tilt:.025,reach:Math.sin(Math.PI*p)**2};
  if(kind==='write')return {left:[-.65,0,.1],right:[-.6,0,-.1],rightElbow:-.8,tilt:.045,reach:1,dx:pulse*.028,dz:Math.cos(time*3)*.017};
  if(kind==='type')return {left:[-.9,0,.08],right:[-.6,0,-.12],rightElbow:-.75,tilt:.025,reach:1,dx:pulse*.045,dy:Math.max(0,pulse)*.014};
  if(kind==='experiment')return {left:[-.6,0,.12],right:[-.55,0,-.12],rightElbow:-.8,tilt:.025,reach:1,dy:Math.max(0,Math.sin(time*1.4))*.028};
  if(kind==='observe')return {left:[-.2,0,0],right:[-.4,0,-.08],rightElbow:-.55,tilt:.08,reach:.8,dx:Math.sin(time)*.025};
  return null;
}
export function makeTaskProps(root,model,handPoint){
  const group=new T.Group();group.name='WorkActionProps';model.add(group);
  const cream=new T.MeshStandardMaterial({color:'#eee7d5',roughness:.9}),green=new T.MeshStandardMaterial({color:'#819f91',roughness:.85}),wood=new T.MeshStandardMaterial({color:'#b59a6d',roughness:.85});
  const mesh=(parent,geo,mat,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
  const step=mesh(root,new T.BoxGeometry(.48,1,.50),wood);step.name='WorkFootrest';
  const pen=new T.Group();pen.name='WorkPencil';group.add(pen);mesh(pen,new T.CylinderGeometry(.012,.012,.19,8),wood,0,-.085,0);mesh(pen,new T.ConeGeometry(.012,.03,8),green,0,-.195,0).rotation.z=Math.PI;
  const pipette=new T.Group();pipette.name='WorkPipette';group.add(pipette);mesh(pipette,new T.CylinderGeometry(.022,.016,.15,10),cream,0,-.055,0);mesh(pipette,new T.CylinderGeometry(.008,.006,.1,8),green,0,-.18,0);mesh(pipette,new T.CylinderGeometry(.025,.025,.025,10),green,0,.03,0);
  const book=new T.Group();book.name='CarriedWorkBook';group.add(book);mesh(book,new T.BoxGeometry(.26,.07,.32),cream);for(const y of [-.043,.043])mesh(book,new T.BoxGeometry(.28,.014,.34),green,0,y,0);
  const sample=new T.Group();sample.name='CarriedWorkSample';group.add(sample);mesh(sample,new T.CylinderGeometry(.04,.04,.15,10),cream,0,-.04,0);mesh(sample,new T.CylinderGeometry(.045,.045,.035,10),green,0,.055,0);
  const brush=new T.Group();brush.name='WorkBrush';group.add(brush);mesh(brush,new T.CylinderGeometry(.009,.009,.19,8),wood,0,-.085,0);mesh(brush,new T.BoxGeometry(.024,.04,.014),green,0,-.20,0);
  const clipboard=new T.Group();clipboard.name='WorkClipboard';group.add(clipboard);mesh(clipboard,new T.BoxGeometry(.30,.025,.34),green);mesh(clipboard,new T.BoxGeometry(.27,.007,.29),cream,0,.017,0);mesh(clipboard,new T.BoxGeometry(.09,.017,.025),wood,0,.025,-.13);
  const ticket=mesh(group,new T.BoxGeometry(.17,.008,.09),cream);ticket.name='WorkTicket';
  const guitar=new T.Group();guitar.name='HeldWorkGuitar';guitar.userData.strumTarget=GUITAR_STRUM;group.add(guitar);for(const [y,r]of [[-.26,.16],[-.11,.12]])mesh(guitar,new T.SphereGeometry(r,12,10),wood, .16,y,.05).scale.set(1,1,.24);mesh(guitar,new T.BoxGeometry(.042,.31,.03),wood,0,-.025,.05);for(let i=0;i<4;i++)mesh(guitar,new T.BoxGeometry(.002,.44,.004),cream,GUITAR_STRUM[0]+(i-1.5)*.013,GUITAR_STRUM[1],GUITAR_STRUM[2]);
  const suitcase=new T.Group();suitcase.name='WorkSuitcase';root.add(suitcase);mesh(suitcase,new T.BoxGeometry(.28,.40,.21),green,0,.24,0);for(const x of [-.095,.095])mesh(suitcase,new T.CylinderGeometry(.028,.028,.035,8),wood,x,.028,.065).rotation.z=Math.PI/2;
  const stems=[-.07,.07].map(x=>mesh(suitcase,new T.CylinderGeometry(.008,.008,1,6),wood,x,.49,0)),handle=mesh(suitcase,new T.BoxGeometry(.16,.025,.045),wood,0,.6,0);handle.name='SuitcaseGrip';
  const weights=['LeftWorkoutWeight','RightWorkoutWeight'].map(name=>{const g=new T.Group();g.name=name;group.add(g);mesh(g,new T.CylinderGeometry(.022,.022,.24,10),cream).rotation.z=Math.PI/2;for(const x of [-.12,.12])mesh(g,new T.CylinderGeometry(.065,.065,.065,12),green,x,0,0).rotation.z=Math.PI/2;return g;});
  const basket=new T.Group();basket.name='HeldShoppingBasket';group.add(basket);mesh(basket,new T.BoxGeometry(.36,.20,.27),green,0,-.25,0);for(const x of [-.14,.14])mesh(basket,new T.BoxGeometry(.018,.16,.022),wood,x,-.08,0);mesh(basket,new T.BoxGeometry(.30,.025,.028),wood);for(const z of [-.138,.138])for(const x of [-.12,-.04,.04,.12])mesh(basket,new T.BoxGeometry(.018,.13,.004),cream,x,-.25,z);
  const product=new T.Group();product.name='HeldMarketProduct';group.add(product);mesh(product,new T.SphereGeometry(.065,12,10),wood,0,-.04,.015);
  const bag=new T.Group();bag.name='HeldShoppingBag';group.add(bag);mesh(bag,new T.BoxGeometry(.29,.29,.22),wood,0,-.30,0);for(const x of [-.10,.10])mesh(bag,new T.BoxGeometry(.015,.15,.023),cream,x,-.09,0);mesh(bag,new T.BoxGeometry(.22,.018,.023),cream);
  const place=(o,side)=>{o.position.copy(group.worldToLocal(handPoint(side)));o.rotation.set(0,0,0);};
  return {update(task,moving=false){
    step.visible=!moving&&(task?.rise||0)>.001;if(step.visible){step.scale.y=task.rise;step.position.set(0,task.floor-root.position.y+task.rise/2,0);}
    pen.visible=!moving&&task?.kind==='write';pipette.visible=!moving&&task?.kind==='experiment';
    book.visible=!!task?.carry&&task.carryType!=='sample'&&task.carryType!=='clipboard'&&task.carryType!=='luggage'&&task.carryType!=='basket'&&task.carryType!=='weights'&&['carry','select','return'].includes(task.kind)&&!(task.kind==='return'&&task.progress>.8);
    const aim=(tool,length)=>pointToolAt(tool,group,handPoint('right'),task.contact,length);
    brush.visible=!moving&&task?.kind==='paint';clipboard.visible=task?.kind==='clipboard'||!!task?.carry&&task.carryType==='clipboard'&&['carry','select','return'].includes(task.kind)&&!(task.kind==='return'&&task.progress>.8);ticket.visible=!moving&&task?.kind==='ticket';guitar.visible=!moving&&task?.kind==='guitar';suitcase.visible=!!task?.luggage;
    sample.visible=!!task?.carry&&task.carryType==='sample'&&!(task.kind==='tidy'&&task.progress>.8);if(sample.visible)place(sample,task.kind==='experiment'?'left':'right');
    if(brush.visible)aim(brush,.22);
    if(clipboard.visible){place(clipboard,'right');if(task.kind==='clipboard')clipboard.position.lerp(group.worldToLocal(handPoint('left')),.5);clipboard.position.y-=.015;clipboard.rotation.x=.25;}
    if(ticket.visible){place(ticket,'right');ticket.position.z+=.04;ticket.rotation.x=.3;}
    if(guitar.visible){place(guitar,'left');guitar.position.add(new T.Vector3(...GUITAR_HOLD));}
    if(suitcase.visible){
      const q=new T.Vector3(task.luggage.x,task.luggage.y,task.luggage.z),p=task.progress||0;
      if(task.stow){const destination=new T.Vector3(task.stow.x,task.stow.y,task.stow.z),t=task.kind==='take-luggage'?1-p:p;q.lerp(destination,t*t*(3-2*t));}
      suitcase.position.copy(root.worldToLocal(q));suitcase.rotation.set(0,0,0);root.updateWorldMatrix(true,true);
      const held=task.luggageHeld||task.stow&&p>.1&&p<.9,grip=held?suitcase.worldToLocal(handPoint('right')):new T.Vector3(0,.49,0);handle.position.copy(grip);
      for(const [i,stem]of stems.entries()){const a=new T.Vector3(i===0?-.07:.07,.43,0),b=grip.clone().add(new T.Vector3(i===0?-.06:.06,0,0)),v=b.clone().sub(a);stem.position.copy(a.add(b).multiplyScalar(.5));stem.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());stem.scale.y=v.length();}
    }
    for(const [i,weight]of weights.entries()){weight.visible=!!task?.weights;if(weight.visible)place(weight,i===0?'left':'right');}
    basket.visible=!!task?.basket;product.visible=!!task?.product;bag.visible=!!task?.bag;
    if(basket.visible)place(basket,'left');if(product.visible)place(product,'right');if(bag.visible)place(bag,'left');
    if(pen.visible)aim(pen,.21);
    if(pipette.visible)aim(pipette,.23);
    if(book.visible){place(book,'right');book.position.y-=.035;book.position.z+=.07;book.rotation.x=.12;}
    root.userData.workAction={kind:task?.kind||null,weights:weights.every(w=>w.visible),basket:basket.visible,product:product.visible,bag:bag.visible,carry:book.visible,pen:pen.visible,pipette:pipette.visible,brush:brush.visible,clipboard:clipboard.visible,guitar:guitar.visible,ticket:ticket.visible,luggage:suitcase.visible,luggagePoint:suitcase.visible?suitcase.getWorldPosition(new T.Vector3()).toArray():null,rise:task?.rise||0,cushion:step.visible&&!!task.seated,target:task?.target||null};
  }};
}
