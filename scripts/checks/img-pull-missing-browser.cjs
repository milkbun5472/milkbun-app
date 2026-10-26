const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');(async()=>{const b=await pw.chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});const p=await b.newPage({serviceWorkers:'block'});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.BASE_URL||'http://127.0.0.1:8765/'));await p.waitForFunction(()=>typeof resolveImg==='function'&&typeof saveJSON==='function',null,{timeout:60000});
const r=await p.evaluate(async()=>{let calls=0;window.remoteMediaGet=async()=>{calls++;return new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'});};
 // engine's idbVaultGet calls remoteMediaGet by global name
 let fired=0;window.addEventListener('img-vault-filled',()=>fired++);
 const a=resolveImg('iv_test_missing_1');await new Promise(r=>setTimeout(r,800));const b2=resolveImg('iv_test_missing_1');
 return {first:a,second:String(b2).slice(0,5),calls,fired};});
console.log(JSON.stringify(r),errs);await b.close();})();
