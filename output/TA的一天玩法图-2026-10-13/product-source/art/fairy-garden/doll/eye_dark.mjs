// 把 faces.json 里每张脸的深色笔画（眼睛那一条 path）单独画成 1024 黑白图 → eye-dark/<id>.png，给 eye_mask.py 用。
// 坐标和 decal.html 一样：viewBox -160..160。嘴是偏红的，自然不在里面。
// 用法：node art/fairy-garden/doll/eye_dark.mjs   （需要 playwright + /opt/pw-browsers/chromium）
import fs from 'fs';import {chromium} from 'playwright';
const here=new URL('.',import.meta.url).pathname,F=JSON.parse(fs.readFileSync(here+'../faces/faces.json','utf8'));
const dark=c=>{const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return r-g<45&&r+g+b<400;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}),p=await b.newPage({viewport:{width:1024,height:1024}});
fs.mkdirSync(here+'eye-dark',{recursive:true});
for(const [id,f] of Object.entries(F)){const svg=f.svg.replace(/fill="(#[0-9a-fA-F]{6})"/g,(m,c)=>dark(c)?'fill="#000"':'fill="none"');
 await p.setContent(`<style>html,body{margin:0;background:#fff}</style><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-160 -160 320 320">${svg}</svg>`);
 await p.screenshot({path:here+'eye-dark/'+id+'.png'});}
await b.close();
