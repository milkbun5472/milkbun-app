// Shared display rules; full original speech remains in the room transcript.
export const BUBBLE_MIN=3200,BUBBLE_PER_CHAR=95,BUBBLE_MAX=15000,BUBBLE_GAP=520,VOICE_GAP=140;
export function bubbleHold(line){return Math.min(BUBBLE_MAX,BUBBLE_MIN+line.length*BUBBLE_PER_CHAR);}
export const bubbleShow=x=>String(x==null?'':x).replace(/\s+/g,' ').trim().slice(0,120);
export const bubbleSay=x=>String(x==null?'':x).trim();
export function bubbleRows(lines){return(Array.isArray(lines)?lines:[lines]).map(x=>({show:bubbleShow(x),say:bubbleSay(x)})).filter(x=>x.show).slice(0,12);}
