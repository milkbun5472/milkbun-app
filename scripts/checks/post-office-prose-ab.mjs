import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writerCases,captureShopProbe,probeMessages} from '../../test/fixtures/post-office-prose.mjs';
const parseJSON=createRequire(import.meta.url)('../../test/_model-json.js');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function proseMetrics(parsed){
 const rows=(Array.isArray(parsed?.lines)?parsed.lines:[parsed?.lines]).map(x=>typeof x==='string'?x:String(x?.text||'')).filter(x=>x.trim());
 const text=rows.join('\n'),sentences=text.split(/(?<=[。！？!?])/u).map(x=>x.trim()).filter(Boolean),shortAction=x=>Array.from(x).length<=16&&!/[「」“”"？?]/u.test(x)&&/挥.*手|伸.*懒腰|笑了|笑起来|叹.*气|欢呼|鞠躬|抱.*臂|扫.*地|拉.*灯|坐下|拍.*肩|递.*信|接.*信/u.test(x);
 const candidates=[];for(let i=1;i<sentences.length;i++)if(shortAction(sentences[i-1])&&shortAction(sentences[i]))candidates.push({at:i-1,text:sentences[i-1]+sentences[i]});
 return {text,characters:Array.from(text.replace(/\s/gu,'')).length,rows:rows.length,paragraphs:rows.flatMap(x=>x.split(/\n+/u)).filter(x=>x.trim()).length,sentences:sentences.length,shortActionCandidates:candidates};
}
export async function prepareComparison({before='bdf80f0fa',repeats=3}={}){
 if(!Number.isInteger(repeats)||repeats<2||repeats>5)throw Error('Use 2–5 repetitions per version and case');
 const beforeSource=execFileSync('git',['show',before+':js/app.js'],{encoding:'utf8',maxBuffer:8e6}),afterSource=readFileSync('js/app.js','utf8'),fixtures=await writerCases(),jobs=[];
 for(const fixture of fixtures){
  const captures={before:await captureShopProbe(beforeSource,fixture),after:await captureShopProbe(afterSource,fixture)};
  for(let repeat=1;repeat<=repeats;repeat++)for(const version of repeat%2?['before','after']:['after','before']){
   const capture=captures[version],messages=await probeMessages(capture);jobs.push({id:fixture.id+'-'+repeat+'-'+version,case:fixture.id,description:fixture.description,repeat,version,messages,maxTokens:capture.probe.maxTokens,inputHash:hash(messages)});
  }
 }
 return {format:1,beforeRef:execFileSync('git',['rev-parse',before],{encoding:'utf8'}).trim(),beforeAppHash:hash(beforeSource),afterAppHash:hash(afterSource),engineHash:hash(readFileSync('js/engine.js','utf8')),repeats,fixtures,jobs,notice:'Only fictional writer-built cases; prepared prompts are not generated stories. No model calls until a real transport is supplied.'};
}
export async function runComparison(prepared,{out,generate,model}={}){
 if(typeof generate!=='function'||!model)throw Error('A real, explicitly configured model transport and model name are required');
 mkdirSync(path.join(out,'responses'),{recursive:true});mkdirSync(path.join(out,'attempts'),{recursive:true});const results=[];
 for(const job of prepared.jobs){
  const file=path.join(out,'responses',job.id+'.json');let result;
  if(existsSync(file)){result=JSON.parse(readFileSync(file,'utf8'));if(result.inputHash!==job.inputHash||result.model!==model)throw Error('Existing response uses different inputs/model: '+job.id);}
  else{
   const attempt=path.join(out,'attempts',job.id+'.json');if(existsSync(attempt))throw Error('An unresolved attempt already exists for '+job.id+'; inspect it before deliberately retrying');
   writeFileSync(attempt,JSON.stringify({inputHash:job.inputHash,model,state:'started'})+'\n');
   const response=await generate({messages:job.messages,maxTokens:job.maxTokens,model,jobId:job.id});
   if(typeof response?.text!=='string')throw Error('The model transport did not return text for '+job.id);
   // Retain even malformed output. A failed format check must not silently spend another call.
   writeFileSync(attempt,JSON.stringify({inputHash:job.inputHash,model,state:'received',raw:response.text,usage:response.usage||null},null,2)+'\n');
   const parsed=parseJSON(response.text),metrics=proseMetrics(parsed);if(!metrics.text)throw Error('No valid story text in '+job.id+'; raw output was retained and no automatic retry was made');
   result={id:job.id,case:job.case,repeat:job.repeat,version:job.version,model,inputHash:job.inputHash,raw:response.text,parsed,metrics,usage:response.usage||null};
   writeFileSync(file,JSON.stringify(result,null,2)+'\n');
  }
  results.push(result);
 }
 return {status:'generated-awaiting-prose-review',model,count:results.length,results};
}
export function comparisonMarkdown(prepared,run=null){
 const rows=['# 邮局故事动作：新旧提示词正文对比','',run?'状态：真实模型样本已生成，仍需逐段审读可读性。':'状态：仅准备好对比输入，尚未调用真实模型；不能据此宣称文笔验收通过。','',`旧版基准：${prepared.beforeRef}（扩充动作前的6项清单）。新版：当前工作区正文优先、18项动作清单。`,`相同构造人设/店况，打烊和来访两种场景；每版每场景 ${prepared.repeats} 次，共 ${prepared.jobs.length} 次。只使用构造资料，公共 runProbe 系统开场照源码组装；buildBundle 是双方相同的虚构上下文，无私人聊天/记忆。`,'','未改写收到的正文。段数统计为界面会呈现的非空文本块；短动作句只是待人工查看的候选，不能据此自动判定文笔。',''];
 if(!run)return rows.concat(['实际生成对比：待完成。','长度/段落/衔接与可读性结论：待样本生成后填写。','']).join('\n');
 rows.push(`测试模型：${run.model}；实际保留 ${run.count} 份回应。`,'','| 场景 | 轮次 | 版本 | 正文字数 | 文本块 | 句数 | 连续短动作候选 |','|---|---:|---|---:|---:|---:|---:|');
 for(const x of run.results)rows.push(`| ${x.case} | ${x.repeat} | ${x.version} | ${x.metrics.characters} | ${x.metrics.paragraphs} | ${x.metrics.sentences} | ${x.metrics.shortActionCandidates.length} |`);
 rows.push('','## 正文原样留底','');
 for(const x of run.results)rows.push(`### ${x.case} / ${x.repeat} / ${x.version}`,'',x.metrics.text,'');
 rows.push('## 审读结论','', '待填写：逐场景比较长度、段落组织、句间衔接，以及是否为使用动作插入了内容。不能只按数字或动作标签数量判定。','');return rows.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),value=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];},out=value('--out','/tmp/post-office-prose-ab'),prepared=await prepareComparison({before:value('--before','bdf80f0fa'),repeats:Number(value('--repeats','3'))});
 mkdirSync(out,{recursive:true});const manifest=path.join(out,'inputs.json');
 if(existsSync(manifest)&&JSON.parse(readFileSync(manifest,'utf8')).jobs.some((x,i)=>x.inputHash!==prepared.jobs[i]?.inputHash))throw Error('Prepared inputs differ; use a new output directory rather than mixing experiments');
 writeFileSync(manifest,JSON.stringify(prepared,null,2)+'\n');
 let run=null;
 if(args.includes('--run')){
  const modulePath=value('--transport',null),model=value('--model',null);if(!modulePath||!model)throw Error('--run requires --transport and --model; keys must stay in local transport configuration');
  const {generate}=await import(pathToFileURL(path.resolve(modulePath)).href);run=await runComparison(prepared,{out,generate,model});writeFileSync(path.join(out,'results.json'),JSON.stringify(run,null,2)+'\n');
 }
 writeFileSync(path.join(out,'正文对比.md'),comparisonMarkdown(prepared,run));console.log(run?`Saved ${run.count} generated responses; prose review still required.`:`Prepared ${prepared.jobs.length} comparisons; real model calls: 0. Generation is pending a configured transport.`);
}
