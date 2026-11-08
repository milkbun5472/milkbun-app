// Both visits and closing scenes read the saved text in its original order.
// No generated text, guessed speakers, or model calls belong to the renderer.
export function splitStoryText(text,limit=52){
 const letters=Array.from(String(text||'')),out=[];let start=0;
 while(start<letters.length){let end=Math.min(letters.length,start+limit);if(end<letters.length){for(let i=end;i>start+limit*.45;i--)if(/[。！？；，、\n.!?; ]/.test(letters[i-1])){end=i;break;}}out.push(letters.slice(start,end).join(''));start=end;}
 return out;
}
export function storyBeats(turns=[],lines=[]){
 const rows=Array.isArray(turns)&&turns.length?turns:(Array.isArray(lines)?lines:[]).map(text=>({text}));
 return rows.flatMap((row,line)=>{const r=typeof row==='string'?{text:row}:row;if(!r||typeof r.text!=='string')return [];return splitStoryText(r.text).map((text,chunk)=>({...r,text,line,chunk,action:chunk?'talk':r.action||'talk'}));});
}
export function createStoryPlayback({turns,lines,onBeat=()=>{},onEnd=()=>{}}={}){
 const beats=storyBeats(turns,lines);let index=-1,time=0,ended=false;
 function next(){if(ended)return;time=0;index++;if(index>=beats.length){ended=true;onEnd();}else onBeat(beats[index]);}
 function step(dt,ready=true){if(ended)return;time+=Math.max(0,dt);const duration=Math.max(2.4,Math.min(7,Array.from(beats[index]?.text||'').length*.11+1.2));if(time>=duration&&(ready||time>=duration+8))next();}
 next();return {next,step,finish:()=>{if(!ended){ended=true;onEnd();}},get beat(){return ended?null:beats[index];},get ended(){return ended;},get index(){return index;},get total(){return beats.length;}};
}
