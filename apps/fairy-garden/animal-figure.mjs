import * as T from 'three';

// Small scene animals share one procedural figure; no pet save or model load.
export function createAnimalFigure({species='cat',coat='calico',scale=1}={}){
 const root=new T.Group(),legs=[],owned=new Set(),dog=species==='dog',white='#eadfc9',orange=dog?'#c29357':'#bc8359',dark='#5b5148';root.name=dog?'ShibaFigure':'CalicoFigure';root.scale.setScalar(scale);
 function material(color,map=null){const m=new T.MeshStandardMaterial({color,map,roughness:.92});owned.add(m);return m;}
 function patches(head=false){
  if(typeof document==='undefined')return null;const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');c.fillStyle=white;c.fillRect(0,0,256,128);
  const marks=head?[[48,36,47,44,orange],[205,33,42,38,dark]]:[[48,54,46,29,orange],[139,39,29,23,dark],[209,78,42,31,orange],[103,94,25,24,dark]];
  for(const [x,y,rx,ry,color]of marks){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,.2,0,Math.PI*2);c.fill();}const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;owned.add(map);return map;
 }
 const fur=material(dog?orange:coat==='calico'?'#ffffff':white,dog?null:coat==='calico'?patches():null),headFur=material(dog?orange:coat==='calico'?'#ffffff':white,dog?null:coat==='calico'?patches(true):null),cream=material(white),ink=material('#514a41'),pink=material('#be9287'),inner=material('#ceaa9c');
 function oval(name,x,y,z,rx,ry,rz,mat=fur,parent=root){const g=new T.SphereGeometry(1,16,12);g.scale(rx,ry,rz);const m=new T.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);owned.add(g);return m;}
 const torso=oval('AnimalBody',0,.20,-.025,.115,.12,dog?.235:.215);oval('CreamChest',0,.21,.13,.09,.10,.075,cream);
 const head=new T.Group();head.name='AnimalHead';head.position.set(0,dog?.32:.30,.19);root.add(head);oval('AnimalFace',0,0,0,dog?.115:.119,dog?.113:.105,.105,headFur,head);
 function ear(side){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*.04,.065,0,side*.10,.17,-.015,side*.115,.055,.025,side*.04,.065,-.04,side*.10,.17,-.015,side*.115,.055,-.025],3));g.setIndex([0,1,2,5,4,3,0,3,4,0,4,1,1,4,5,1,5,2]);g.computeVertexNormals();const m=new T.Mesh(g,fur);m.name='PointedEar';head.add(m);owned.add(g);oval('EarInner',side*.077,.103,.015,.018,.035,.005,inner,head);}
 ear(-1);ear(1);
 if(dog){oval('ShibaMuzzle',0,-.037,.088,.077,.048,.053,cream,head);oval('Cheek',-.07,-.02,.04,.04,.046,.04,cream,head);oval('Cheek',.07,-.02,.04,.04,.046,.04,cream,head);}
 else for(const side of [-1,1])oval('CatMuzzle',side*.025,-.03,.085,.032,.023,.022,cream,head);
 for(const side of [-1,1]){oval('DarkEye',side*.049,.012,.089,dog?.012:.013,.017,.006,ink,head);oval('EyeCatchlight',side*.049-.003,.018,.095,.0035,.004,.002,cream,head);}
 oval('Nose',0,-.023,dog?.137:.109,.013,.008,.007,dog?ink:pink,head);
 const whiskerMaterial=new T.LineBasicMaterial({color:'#75675b'});owned.add(whiskerMaterial);
 if(!dog)for(const side of [-1,1])for(const dy of [-.012,.005]){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(side*.037,-.035,.097),new T.Vector3(side*.115,-.03+dy,.102)]);const line=new T.Line(g,whiskerMaterial);head.add(line);owned.add(g);}
 for(const x of [-.075,.075])for(const z of [-.17,.13]){const pivot=new T.Group();pivot.position.set(x,.18,z);root.add(pivot);oval('AnimalLeg',0,-.075,0,.034,.086,.037,fur,pivot);oval('CreamPaw',0,-.14,.012,.04,.035,.052,cream,pivot);legs.push({pivot,phase:(x<0?0:Math.PI)+(z<0?Math.PI:0)});}
 const tail=new T.Group();tail.position.set(0,.25,-.21);root.add(tail);
 const curve=dog?new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(0,.12,-.09),new T.Vector3(0,.19,-.03),new T.Vector3(0,.14,.035),new T.Vector3(0,.10,0)]):new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.035,.05,-.10),new T.Vector3(.065,.19,-.16),new T.Vector3(.03,.28,-.15)]);
 const tailGeometry=new T.TubeGeometry(curve,20,dog?.035:.023,8,false),tailMesh=new T.Mesh(tailGeometry,dog?fur:material(dark));tail.add(tailMesh);owned.add(tailGeometry);
 const mouth=new T.Object3D();mouth.name='AnimalMouth';mouth.position.set(0,-.045,dog?.14:.12);head.add(mouth);
 return {root,mouth,animate(time,{moving=false,held=false,lowerHead=0}={}){const speed=dog?11:10;for(const leg of legs)leg.pivot.rotation.x=moving?Math.sin(time*speed+leg.phase)*.5:held?.5:0;tail.rotation.z=Math.sin(time*2.7)*.12;head.rotation.x=lowerHead*.55;head.position.y=(dog?.32:.30)-lowerHead*.11;head.rotation.y=moving?Math.sin(time*4)*.025:Math.sin(time*.8)*.035;torso.position.y=.20+(moving?Math.abs(Math.sin(time*speed))*.009:0);},dispose(){for(const item of owned)item.dispose();root.removeFromParent();root.clear();}};
}
