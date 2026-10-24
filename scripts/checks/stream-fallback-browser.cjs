const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');(async()=>{const b=await pw.chromium.launch({...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});const p=await b.newPage({serviceWorkers:'block'});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.BASE_URL||'http://127.0.0.1:8765/'));await p.waitForFunction(()=>typeof callAI==='function'&&typeof saveJSON==='function',null,{timeout:60000});
const r=await p.evaluate(async()=>{const sent=[];const of=window.fetch;
 window.fetch=async(u,o)=>{if(!String(u).includes('fake.test'))return of(u,o);const body=JSON.parse(o.body);sent.push(!!body.stream);
  if(body.stream)return new Response(JSON.stringify({error:{message:'stream mode is not supported'}}),{status:400,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({choices:[{message:{content:'好的'}}]}),{status:200,headers:{'content-type':'application/json'}});};
 const route={id:'t',name:'测',baseUrl:'https://fake.test',apiKey:'k',model:'m1'};
 const out=[];
 out.push(await callAI(route,'sys',[{role:'user',content:'hi'}],{stream:true,maxTokens:8000}).then(x=>typeof x==='string'?x:JSON.stringify(x).slice(0,60)).catch(e=>'ERR '+e.message));
 const learned=loadJSON('x_noStream',[]);
 out.push(await callAI(route,'sys',[{role:'user',content:'hi'}],{stream:true,maxTokens:8000}).then(x=>typeof x==='string'?x:'obj').catch(e=>'ERR '+e.message));
 const can=routeCanStream(route); streamForget(route); const can2=routeCanStream(route); const off=routeCanStream({...route,streamMode:'off'});
 // 不该重发的：密钥错
 const sent2=sent.length; window.fetch=async(u,o)=>{if(!String(u).includes('fake.test'))return of(u,o);sent.push('k'+!!JSON.parse(o.body).stream);return new Response(JSON.stringify({error:{message:'invalid api key'}}),{status:401,headers:{'content-type':'application/json'}});};
 const e3=await callAI({...route,model:'m2'},'sys',[{role:'user',content:'hi'}],{stream:true,maxTokens:8000,noRetry:true}).catch(e=>'ERR');
 return {out,learned,sent,can,can2,off,keyTries:sent.length-sent2};});
console.log(JSON.stringify(r),errs.length);await b.close();})();
