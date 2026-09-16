// One canonical game source. Fingerprint its whole relative asset graph, including ESM and models.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='apps/fairy-garden',host='js/fairy-garden.js';
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
const files=walk(root).filter(p=>!p.endsWith('.test.mjs')&&!p.endsWith('README.md')&&!p.endsWith('build.json')).sort();
const strip=s=>s.replace(/\?v=fg-[a-f0-9]+/g,'');
const hash=createHash('sha256');for(const p of files){hash.update(p);hash.update(/\.(mjs|js|html|css)$/.test(p)?strip(readFileSync(p,'utf8')):readFileSync(p));}
hash.update(readFileSync(host,'utf8').replace(/BUILD = "(?:__GARDEN_BUILD__|fg-[a-f0-9]+)"/,'BUILD = "__GARDEN_BUILD__"'));
const build='fg-'+hash.digest('hex').slice(0,16);
for(const p of files.filter(p=>/\.(mjs|js|html|css)$/.test(p))){const s=strip(readFileSync(p,'utf8')).replace(/(['"])(\.?\/?[\w./-]+\.(?:mjs|js|css|glb))\1/g,(_,q,path)=>q+path+'?v='+build+q);writeFileSync(p,s);}
writeFileSync(host,readFileSync(host,'utf8').replace(/BUILD = "(?:__GARDEN_BUILD__|fg-[a-f0-9]+)"/,'BUILD = "'+build+'"'));
writeFileSync(root+'/build.json',JSON.stringify({build},null,2)+'\n');console.log(build);
