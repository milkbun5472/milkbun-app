import * as T from 'three';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=fg-127ffe874240ba15';

// Furniture uses the existing traveler's .45 chair rise and .08 floor.
export const ROOM_SCALE={floor:.08,seat:.45,desk:.85,bench:1};
export function roomStructure({w=10,d=9}={}){
  return [
    {id:'BackWall',x:0,z:-d/2,w:w+.2,d:.18},
    {id:'LeftWall',x:-w/2,z:0,w:.18,d},
    {id:'DoorPostWest',x:-.95,z:d/2-.08,w:.16,d:.26},
    {id:'DoorPostEast',x:.95,z:d/2-.08,w:.16,d:.26}
  ];
}
export function roomObstacles(furniture,size){return [...roomStructure(size),...furniture.map(({id,x,z,w,d})=>({id,x,z,w,d}))];}
export function roomSeat(furniture,id,approach){
  const p=furniture.find(p=>p.id===id);
  if(!['chair','bench'].includes(p?.kind))throw new Error('Seat requires a constructed chair or bench: '+id);
  return {x:p.x,z:p.z,rise:p.seat??ROOM_SCALE.seat,heading:p.heading??0,piece:id,approach};
}
export function createRoomKit(){
  const root=new T.Group(),materials=new Map();
  const material=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.88,metalness:0}));return materials.get(color);};
  function group(name,{x=0,y=0,z=0,heading=0}={},parent=root){const g=new T.Group();g.name=name;g.position.set(x,y,z);g.rotation.y=heading;parent.add(g);return g;}
  function replaceableGroup(name,transform={},parent=root){const g=group(name,transform,parent);g.userData.replaceable=true;return g;}
  function box(name,{x=0,y=0,z=0,w=1,h=1,d=1,color='#dbc9ac',heading=0,radius=.04},parent=root){
    const r=Math.min(radius,w/3,h/3,d/3);let geometry;
    if(r>0){const a=w/2-r,b=d/2-r,s=new T.Shape();s.moveTo(-a,-b-r);s.lineTo(a,-b-r);s.quadraticCurveTo(a+r,-b-r,a+r,-b);s.lineTo(a+r,b);s.quadraticCurveTo(a+r,b+r,a,b+r);s.lineTo(-a,b+r);s.quadraticCurveTo(-a-r,b+r,-a-r,b);s.lineTo(-a-r,-b);s.quadraticCurveTo(-a-r,-b-r,-a,-b-r);geometry=new T.ExtrudeGeometry(s,{depth:Math.max(.001,h-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:0,bevelSegments:2,curveSegments:3,steps:1});geometry.rotateX(-Math.PI/2);geometry.center();}
    else geometry=new T.BoxGeometry(w,h,d);
    const mesh=new T.Mesh(geometry,material(color));mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.y=heading;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(name,{x=0,y=0,z=0,r=.1,h=.2,color='#dbc9ac',rotation},parent=root){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,16),material(color));mesh.name=name;mesh.position.set(x,y,z);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function sphere(name,{x=0,y=0,z=0,r=.5,color='#91a586'},parent=root){const mesh=new T.Mesh(new T.SphereGeometry(r,16,12),material(color));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function ellipsoid(name,{w=1,h=1,d=1,...v},parent=root){const mesh=sphere(name,{...v,r:.5},parent);mesh.scale.set(w,h,d);return mesh;}
  // Profile coordinates are local XY. Horizontal profiles turn Y into -Z.
  function profile(name,{shape,x=0,y=0,z=0,depth=.1,color='#dbc9ac',horizontal=false,bevel=.015},parent=root){
    const r=Math.min(bevel,depth/3),geometry=new T.ExtrudeGeometry(shape,{depth:depth-2*r,bevelEnabled:r>0,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:12,steps:1});
    geometry.translate(0,0,-(depth-2*r)/2);if(horizontal)geometry.rotateX(-Math.PI/2);
    const mesh=new T.Mesh(geometry,material(color));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function tube(name,{points,r=.025,color='#dbc9ac',closed=false},parent=root){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal'),geometry=new T.TubeGeometry(curve,Math.max(8,points.length*4),r,8,closed),mesh=new T.Mesh(geometry,material(color));
    mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function table({id,x,z,w,d,top=.85,color='#ba986e'}){const p=group(id,{x,z});box(id+'-top',{y:.08+top-.055,w,h:.11,d,color},p);for(const a of [-1,1])for(const b of [-1,1])box(id+'-leg',{x:a*(w/2-.15),z:b*(d/2-.15),y:.08+(top-.11)/2,w:.1,h:top-.11,d:.1,color:'#ad8b62'},p);return p;}
  function chair({id,x,z,heading=0,color='#789887',seat=.45}){const p=group(id,{x,z,heading});box(id+'-seat',{y:.08+seat-.045,w:.56,h:.09,d:.57,color},p);box(id+'-back',{y:.08+seat+.3,z:-.245,w:.56,h:.54,d:.075,color},p);for(const a of [-1,1])for(const b of [-1,1])box(id+'-leg',{x:a*.2,z:b*.2,y:.08+(seat-.09)/2,w:.065,h:seat-.09,d:.065,color:'#b49978'},p);return p;}
  function bench({id,x,z,w=2.8,d=.65,heading=0,color='#789887',seat=.45,legColor='#a58b70',solid=false}){
    const p=group(id,{x,z,heading});
    if(solid){
      box('SeatBase',{y:.35,w,h:.3,d,color},p);box('SeatCushion',{y:.49,w:w-.09,h:.09,d:d-.03,color},p);
      box('SeatBack',{y:.79,z:-d/2+.1,w,h:.75,d:.16,color},p);
      for(const s of [-1,1])box('SeatLeg',{x:s*(w/2-.22),y:.19,w:.11,h:.24,d:d-.2,color:legColor},p);
      return p;
    }
    box(id+'-seat',{y:ROOM_SCALE.floor+seat-.045,w,h:.09,d,color},p);
    box(id+'-back',{y:.08+seat+.28,z:-d/2+.04,w,h:.5,d:.08,color},p);
    for(const a of [-1,1])for(const b of [-1,1])box(id+'-leg',{x:a*(w/2-.22),z:b*(d/2-.1),y:ROOM_SCALE.floor+(seat-.09)/2,w:.075,h:seat-.09,d:.075,color:legColor},p);
    return p;
  }
  function sign(name,{text,x=0,y=0,z=0,w=1.8,h=.4,heading=0,color='#eee7d7',ink='#516b61'},parent=root){
    let mat=new T.MeshBasicMaterial({color,side:T.DoubleSide});
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(512*h/w);const c=canvas.getContext('2d');
      c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle=ink;c.font='500 '+Math.floor(canvas.height*.55)+'px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,canvas.width/2,canvas.height/2,canvas.width*.9);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;mat.dispose();mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
    }
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),mat);mesh.name=name;mesh.userData.label=text;mesh.position.set(x,y,z);mesh.rotation.y=heading;parent.add(mesh);return mesh;
  }
  function book(name,{x=0,y=0,z=0,w=.16,h=.46,d=.3,color='#879d83',flat=false},parent=root){const p=group(name,{x,y,z},parent);if(flat){box(name+'-pages',{w,h:.065,d,color:'#eee6d4',radius:.005},p);for(const a of [-1,1])box(name+'-cover',{y:a*.038,w:w+.035,h:.012,d:d+.035,color,radius:.005},p);}else{box(name+'-spine',{w,h,d,color,radius:.007},p);for(const a of [-1,1])box(name+'-band',{y:a*h*.31,z:d/2+.004,w:w*.75,h:.015,d:.008,color:'#e3d4af',radius:0},p);}return p;}
  function plant(x,z){const p=group('Plant',{x,z});cylinder('pot',{y:.24,r:.19,h:.32,color:'#c6a689'},p);for(let i=0;i<7;i++){const a=i*2.4;const leaf=box('leaf',{x:Math.sin(a)*.16,y:.57+i*.025,z:Math.cos(a)*.16,w:.12,h:.4,d:.075,color:i%2?'#799476':'#91a586'},p);leaf.rotation.z=Math.sin(a)*.5;}return p;}
  function room({w=10,d=9,floorColor='#cbb697',wallColor='#e6dfcb',accent='#7b9585',joins=true}){
    root.name='DayRoom';box('Floor',{y:-.07,w:w+.3,h:.3,d:d+.3,color:floorColor,radius:.05});
    if(joins)for(let i=0;i<Math.round(w/.5);i++)box('floor-join',{x:-w/2+i*.5,y:.084,w:.008,h:.002,d,color:'#bfa88a',radius:0});
    const structure=roomStructure({w,d});
    for(const p of structure.slice(0,2))box(p.id,{...p,y:1.65,h:3.3,color:wallColor});
    box('back-trim',{z:-d/2+.12,y:.22,w,h:.26,d:.075,color:accent});box('left-trim',{x:-w/2+.12,y:.22,w:.075,h:.26,d,color:accent});
    // The front is cut away; both visible door posts have matching map obstacles.
    for(const p of structure.slice(2))box(p.id,{...p,y:.55,h:1.1,color:accent});
    box('Threshold',{z:d/2-.05,y:.1,w:1.8,h:.035,d:.22,color:'#a88b66'});
  }
  function hingedDoor(name,{x=0,y=0,z=0,w=.5,h=1,d=.04,color='#c8d4c2',axis='z',sign=1,furniture},parent=root){
    const pivot=replaceableGroup(name+':hinge',{x:x-(axis==='z'?sign*w/2:0),y,z:z+(axis==='x'?sign*d/2:0)},parent);
    const door=box(name,{x:axis==='z'?sign*w/2:0,z:axis==='x'?-sign*d/2:0,w,h,d,color},pivot);
    box(name+':handle',{x:axis==='z'?sign*(w-.08):.045,y:0,z:axis==='x'?-sign*(d-.08):.04,w:.045,h:.14,d:.045,color:'#7b9383'},pivot);
    pivot.userData.dayDoor={furniture,swing:sign*(axis==='x'?1:-1)*.9};return pivot;
  }
  function finish(){
    root.updateMatrixWorld(true);const meshes=[];
    root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    // Keep replaceable equipment as a named group; merge within each material/owner.
    const ownerOf=o=>{let n=o;while(n&&n!==root){if(n.userData.replaceable||n.userData.furnitureId||n.userData.shellPart)return n;n=n.parent;}return root;};
    const owners=new Map();for(const o of meshes){const owner=ownerOf(o);if(!owners.has(owner))owners.set(owner,new Map());const byMat=owners.get(owner);if(!byMat.has(o.material))byMat.set(o.material,[]);const inverse=owner.matrixWorld.clone().invert(),geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();byMat.get(o.material).push(geometry.applyMatrix4(inverse.multiply(o.matrixWorld)));}
    for(const o of meshes){o.parent.remove(o);o.geometry.dispose();}
    for(const [owner,byMat]of owners)for(const [mat,geometries]of byMat){const merged=mergeGeometries(geometries);for(const g of geometries)g.dispose();const m=new T.Mesh(merged,mat);m.name='RoomBatch';m.castShadow=m.receiveShadow=true;owner.add(m);}return {root};
  }
  return {root,box,cylinder,sphere,ellipsoid,profile,tube,group,replaceableGroup,table,chair,bench,sign,book,plant,room,hingedDoor,finish,material};
}
