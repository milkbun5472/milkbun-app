import * as T from 'three';

// These profiles are shared by architecture, movable furniture and its previews.
export function rounded(w,h,r=Math.min(w,h)*.22){
 const s=new T.Shape(),a=w/2,b=h/2;r=Math.min(r,a,b);
 s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);return s;
}
export function arch(w,h){
 const s=new T.Shape(),r=w/2,shoulder=h-r;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,shoulder);s.absarc(0,shoulder,r,0,Math.PI,false);s.lineTo(-r,0);return s;
}
export function scallop(w,h){
 const s=new T.Shape(),a=w/2;s.moveTo(-a,0);s.lineTo(a,0);s.lineTo(a,h*.64);s.bezierCurveTo(a,h*.97,a*.58,h*1.12,0,h*.91);s.bezierCurveTo(-a*.58,h*1.12,-a,h*.97,-a,h*.64);s.closePath();return s;
}
export function pebble(w,d){
 const s=new T.Shape();s.moveTo(-w*.45,-d*.18);s.bezierCurveTo(-w*.5,-d*.52,w*.04,-d*.56,w*.37,-d*.32);s.bezierCurveTo(w*.58,-d*.13,w*.49,d*.36,w*.13,d*.46);s.bezierCurveTo(-w*.19,d*.58,-w*.54,d*.22,-w*.45,-d*.18);return s;
}
export function rimShape(outer,inner){const s=outer.clone();s.holes.push(new T.Path(inner.getPoints(32)));return s;}
export function shift(shape,x,y){return new T.Shape(shape.getPoints(32).map(p=>p.add(new T.Vector2(x,y))));}
export function ceramicCup(k,g,p,{x=0,z=0,y=1,color=p.paper,handle=1}={}){
 k.cylinder('CupFoot',{x,z,y:y-.065,r:.055,h:.025,color},g);k.cylinder('CupBody',{x,z,y,r:.075,h:.12,color},g);k.cylinder('TeaSurface',{x,z,y:y+.064,r:.059,h:.006,color:p.dark},g);
 k.tube('CupHandle',{points:[[x+handle*.065,y+.04,z],[x+handle*.13,y+.055,z],[x+handle*.15,y-.01,z],[x+handle*.075,y-.035,z]],r:.017,color},g);
}
