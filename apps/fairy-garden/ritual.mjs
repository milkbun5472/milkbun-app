// Visual routes only. Spell eligibility and fragment ownership stay in world.mjs.
const ring=(n,step=1)=>Array.from({length:n+1},(_,i)=>{const a=-Math.PI/2+(i*step%n)*Math.PI*2/n;return {x:Math.cos(a)*.82,y:Math.sin(a)*.82};});
export const SIGILS={
 echo:{color:'#9ce1e0',points:[{x:-.8,y:-.4},{x:-.4,y:.4},{x:0,y:-.4},{x:.4,y:.4},{x:.8,y:-.4}]},
 dream:{color:'#cfb9fa',points:ring(5,2)},
 sense:{color:'#a6e3b0',points:[{x:0,y:-.85},{x:-.72,y:0},{x:0,y:.85},{x:.72,y:0},{x:0,y:-.85},{x:0,y:0}]},
 relic:{color:'#f5d691',points:ring(6)}
};
export function createRitual(spell){
 const glyph=SIGILS[spell];if(!glyph)throw Error('Unknown spell');
 let count=0,stage='trace',elapsed=0,assist=0;
 return {glyph,get stage(){return stage;},get count(){return count;},get progress(){return stage==='send'?Math.min(1,elapsed/1.8):count/glyph.points.length;},
 touch(x,y){if(stage!=='trace'||!Number.isFinite(x)||!Number.isFinite(y))return false;const p=glyph.points[count];if(Math.hypot(x-p.x,y-p.y)>.25)return false;count++;if(count===glyph.points.length)stage='ready';return true;},
 help(dt){if(stage!=='trace')return;assist+=Math.max(0,Math.min(.1,dt));if(assist>=.5){assist=0;const p=glyph.points[count];this.touch(p.x,p.y);}},
 send(){if(stage!=='ready')return false;stage='send';return true;},
 tick(dt,commit){if(stage!=='send')return;elapsed+=Math.max(0,Math.min(.1,dt));if(elapsed>=1.8){stage='done';return commit();}},
 snapshot(){return {stage,count,progress:this.progress};}};
}
