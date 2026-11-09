import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{createRoomKit}=await import('../apps/fairy-garden/day/places/room-kit.mjs');
const {SHOP_FLOOR,SHOP_CHAIR,SHOP_BENCH,SHOP_CUSHIONS,windowSeat,visitorSeat}=await import('../apps/post-office/furniture.mjs');
test('邮局沿 TA 一天坐面：深椅与三级长凳的实际坐点和承托高度一致',()=>{
 const kit=createRoomKit(),chair=kit.chair(SHOP_CHAIR);kit.bench(SHOP_BENCH);const cushions=SHOP_CUSHIONS.map(p=>kit.box('pad',p));
 for(const level of [1,2,3]){
  cushions.forEach((p,i)=>p.visible=level>i+1);kit.root.updateMatrixWorld(true);
  for(const seat of [windowSeat(),visitorSeat(0,level),visitorSeat(1,level)]){
   const ray=new T.Raycaster(new T.Vector3(seat.seatX,2,seat.seatZ),new T.Vector3(0,-1,0)),hits=ray.intersectObject(kit.root,true).filter(h=>h.object.visible&&h.point.y<.8);
   assert.ok(hits.some(h=>Math.abs(h.point.y-(SHOP_FLOOR+seat.rise))<.003),JSON.stringify({level,seat,hits:hits.map(h=>h.point.y)}));
   assert.equal(seat.pose,seat.piece===SHOP_CHAIR.id?'deep':'chair');
  }
 }
 assert.equal(windowSeat().seatZ,SHOP_CHAIR.z+.2);assert.ok(chair);
});
