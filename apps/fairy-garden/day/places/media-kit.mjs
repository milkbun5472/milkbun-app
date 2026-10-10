// Cameras, microphone capsules and their physical contact anchors share one owner.
export function cameraRig(k,p,{name='CameraRig',small=false,heading=0,tableY=0,workFurniture=p.id}={}){
 const g=k.group(p.id,{x:p.x,z:p.z,heading}),h=tableY||1.14;
 if(!tableY){k.cylinder('TripodColumn',{y:.65,r:.035,h:1.06,color:'#647277'},g);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;k.tube('TripodLeg',{points:[[0,.58,0],[Math.cos(a)*.37,.08,Math.sin(a)*.37]],r:.028,color:'#647277'},g);}}
 else{k.cylinder('CameraDeskFoot',{y:tableY+.02,r:.11,h:.04,color:'#647277'},g);k.cylinder('CameraDeskStem',{y:tableY+.15,r:.022,h:.26,color:'#647277'},g);}
 const head=k.replaceableGroup(name+':head',{y:h+(tableY?.32:0)},g);head.userData.dayCamera=p.id;
 k.box('CameraBody',{w:small?.32:.55,h:small?.22:.36,d:small?.23:.40,color:'#4c626a'},head);
 k.cylinder('CameraLens',{z:small?-.16:-.29,r:small?.085:.13,h:small?.14:.25,color:'#364d59',rotation:[Math.PI/2,0,0]},head);
 k.cylinder('LensGlass',{z:small?-.235:-.42,r:small?.069:.104,h:.008,color:'#92b8bf',rotation:[Math.PI/2,0,0]},head);
 if(!small){k.box('CameraGrip',{x:-.20,y:.10,z:.29,w:.15,h:.06,d:.26,color:'#4c626a'},head);k.box('CameraMonitor',{x:.36,y:.06,z:.05,w:.06,h:.29,d:.30,color:'#9ab7bd'},head);}
 const light=k.replaceableGroup('CameraTally',{x:.15,y:.12,z:small?-.125:-.21},head);light.userData.daySignal={furniture:small?workFurniture:[p.id,'film-backdrop'],kinds:['camera','act','pose','stream']};k.sphere('TallyDot',{r:.023,color:'#de8075'},light);
 return g;
}
export function microphone(k,parent,{x=0,y=1.3,z=0,furniture,desk=false}={}){
 const g=k.group('Microphone:'+furniture,{x,z},parent);
 k.cylinder('MicBase',{y:desk?y-.28:.10,r:desk?.10:.19,h:.035,color:'#647a7c'},g);
 k.cylinder('MicStand',{y:desk?y-.15:(y-.10)/2+.10,r:.022,h:desk?.28:y-.10,color:'#647a7c'},g);
 k.cylinder('MicCapsule',{y:y+.05,r:.06,h:.21,color:'#455f68'},g);
 for(let i=0;i<5;i++)k.cylinder('MicGrille',{y:y-.02+i*.035,r:.064,h:.008,color:'#a6b9b7'},g);
 k.tube('PopFilterArm',{points:[[0,y-.12,0],[0,y+.02,.17]],r:.013,color:'#647a7c'},g);
 k.cylinder('PopFilter',{y:y+.06,z:.19,r:.11,h:.012,color:'#536b72',rotation:[Math.PI/2,0,0]},g);
 const signal=k.replaceableGroup('MicSignal',{y:y+.16,z:.04},g);signal.userData.daySignal={furniture,kinds:['voice','sing','stream']};k.sphere('MicOnLight',{r:.02,color:'#d99b73'},signal);
 return g;
}
export function softbox(k,p,{heading=0,color='#e6d8bb'}={}){
 const g=k.group(p.id,{x:p.x,z:p.z,heading});k.cylinder('LampStand',{y:1.03,r:.025,h:1.8,color:'#7b8583'},g);
 for(let i=0;i<3;i++){const a=i*2.094;k.tube('LampLeg',{points:[[0,.35,0],[Math.cos(a)*.28,.08,Math.sin(a)*.28]],r:.022,color:'#7b8583'},g);}
 const head=k.group('SoftboxHead',{y:2.12},g);head.rotation.x=-.22;k.box('SoftboxBack',{w:.72,h:.93,d:.18,color:'#64757a'},head);k.box('SoftboxDiffuser',{z:.10,w:.65,h:.85,d:.018,color},head);
 return g;
}
