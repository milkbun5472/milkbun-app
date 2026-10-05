export const CHAT_MIN=.28,CHAT_MAX=.72;
export const chatRatio=value=>Number.isFinite(value)?Math.max(CHAT_MIN,Math.min(CHAT_MAX,value)):.5;
// Reserve useful space for both surfaces as the keyboard reduces the container.
export function chatLayout(value,height){const ratio=chatRatio(value);if(!Number.isFinite(height)||height<=0)return {ratio,scenePercent:(1-ratio)*100};const sceneMin=Math.min(112,height*.46),chatMin=Math.min(140,height*.54),chat=Math.max(chatMin,Math.min(height-sceneMin,height*ratio));return {ratio,scenePercent:(height-chat)/height*100};}
