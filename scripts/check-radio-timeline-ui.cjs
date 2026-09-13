// 独立浏览器与虚构人物，不使用真人存档或模型接口。
const { chromium } = require('playwright');
const fs=require('node:fs'), http=require('node:http'), path=require('node:path'), assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    const file=path.join(root,decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if(!file.startsWith(root+'/')) {res.writeHead(403);return res.end();}
    try {res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(file));}
    catch {res.writeHead(404);res.end();}
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const width of [320,390]) {
      const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
      const page=await ctx.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://**/*',r=>r.abort());
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.getByText('翻 开',{exact:true}).click();
      await page.evaluate(()=>{
        const host=document.createElement('div');host.id='timeline-qa';host.style='position:fixed;inset:0;z-index:99999;height:100dvh';document.body.append(host);
        window.qaCalls=0;window.qaPrompt='';
        window.qaSpeech=[];
        Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){window.qaSpeech.push(u);}}});
        window.SpeechSynthesisUtterance=function(text){this.text=text;};
        ReactDOM.createRoot(host).render(h(RadioTimelineScreen,{
          characters:[{id:'fixture',name:'测试角色',persona:'虚构测试人物'},{id:'other',name:'旁边那位',persona:'另一个虚构人物'}],loreFor:()=>'',onBack:()=>{},onLegacy:()=>{},
          onFragment:async()=>{window.qaCalls++;return {title:'测试片段',lines:[{kind:'narrator',text:'独听的场景'},{kind:'character',speaker:'测试角色',text:'共同听见的话'},{kind:'character',text:'还没播放的秘密'}]};},
          // v67.57：陪听的是谁由界面传进来（原来写死成广播里那个人）
          onCompanion:async(b,q,who)=>{window.qaWho=who;window.qaPrompt=RadioTimeline.companionPrompt(b,who,q);return {say:'测试回应'};}
        }));
      });
      await page.getByLabel('想听谁的时间线').selectOption('fixture');
      await page.getByLabel('想探索的事／分岔条件').fill('测试分岔');
      await page.getByRole('button',{name:'建立这条时间线',exact:true}).click();
      assert.equal(await page.evaluate(()=>qaCalls),0);
      await page.getByRole('button',{name:'接收这个频率的新章节',exact:true}).click();
      await page.getByRole('button',{name:'开始收听这一句',exact:true}).click();
      await page.getByLabel('谁陪你一起听').selectOption('fixture');
      await page.getByLabel('暂停，和他说一句').fill('你觉得呢');
      assert.ok(await page.getByRole('button',{name:'问问他',exact:true}).isDisabled());
      await page.getByRole('button',{name:'继续下一句',exact:true}).click();
      assert.equal(await page.locator('[data-radio-current]').count(),1);
      assert.equal(await page.getByText('独听的场景',{exact:true}).count(),0);
      assert.ok((await page.locator('[data-radio-current]').innerText()).includes('共同听见的话'));
      await page.getByRole('button',{name:'问问他',exact:true}).click();
      await page.getByText('测试角色：测试回应',{exact:true}).waitFor();
      const prompt=await page.evaluate(()=>qaPrompt);
      assert.equal(await page.evaluate(()=>qaWho),'fixture');
      assert.ok(prompt.includes('共同听见的话'));assert.ok(!prompt.includes('独听的场景'));assert.ok(!prompt.includes('还没播放的秘密'));
      // v67.57：换个人来陪听——他是从你切给他那一句开始听的，前面那些他不在场。
      // ⚠️这一条才是「陪听换人」真正要钉的东西：换了人之后，旧陪听者的见闻一句都不许跟过去。
      await page.getByLabel('谁陪你一起听').selectOption('other');
      await page.getByLabel('暂停，和他说一句').fill('你听见了吗');
      assert.ok(await page.getByRole('button',{name:'问问他',exact:true}).isDisabled(),'刚换的人还没听见任何一句，却已经能问了');
      assert.equal(await page.getByText('测试角色：测试回应',{exact:true}).count(),0,'上一位陪听者的对话跟着串到新来的这位名下了');
      await page.getByLabel('谁陪你一起听').selectOption('fixture');
      await page.getByText('测试角色：测试回应',{exact:true}).waitFor();
      assert.equal(await page.getByText('还没播放的秘密',{exact:true}).count(),0);
      await page.getByRole('button',{name:'已听回放（2）',exact:true}).click();
      assert.equal(await page.locator('[data-radio-current]').count(),0);
      assert.ok((await page.locator('[data-radio-history]').innerText()).includes('独听的场景'));
      assert.ok(!(await page.locator('[data-radio-history]').innerText()).includes('还没播放的秘密'));
      await page.getByRole('button',{name:'第1句 · 独听的场景',exact:true}).click();
      assert.ok((await page.locator('[data-radio-current]').innerText()).includes('独听的场景'));
      assert.equal(await page.getByText('共同听见的话',{exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'已听回放（2）',exact:true}).count(),1);
      await page.getByRole('button',{name:'继续下一句',exact:true}).click();
      const savedScroll=await page.locator('[data-radio-timeline]').evaluate(el=>{
        el.lastElementChild.scrollTop=120; return el.lastElementChild.scrollTop;
      });
      // DOM click avoids Playwright auto-scrolling; verify our own full-page return restoration.
      await page.getByRole('button',{name:'已听回放（2）',exact:true}).evaluate(el=>el.click());
      await page.locator('[data-radio-history]').waitFor();
      await page.screenshot({path:'/tmp/lisa-timeline-history-'+width+'.png'});
      await page.getByRole('button',{name:'返回当前句',exact:true}).click();
      const restoredScroll=await page.locator('[data-radio-timeline]').evaluate(el=>el.lastElementChild.scrollTop);
      assert.ok(Math.abs(restoredScroll-savedScroll)<2);
      await page.getByRole('button',{name:'已听回放（2）',exact:true}).click();
      await page.getByRole('button',{name:'返回当前句',exact:true}).click();
      assert.ok((await page.locator('[data-radio-current]').innerText()).includes('共同听见的话'));
      // 重新打开同一章，已有回放从存档听闻记录恢复，不依赖当前游标。
      await page.getByRole('button',{name:'回听 · 测试片段',exact:true}).click();
      assert.equal(await page.locator('[data-radio-current]').count(),0);
      await page.getByRole('button',{name:'已听回放（2）',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:/^第[12]句 · /}).count(),2);
      await page.getByRole('button',{name:'第2句 · 共同听见的话',exact:true}).click();
      await page.getByRole('button',{name:'连续收听（系统音色）',exact:true}).click();
      assert.equal(await page.evaluate(()=>qaSpeech.at(-1).text),'共同听见的话');
      assert.equal(await page.getByRole('button',{name:'已听回放（2）',exact:true}).count(),1);
      await page.getByRole('button',{name:'暂停声音',exact:true}).click();
      await page.evaluate(()=>{const u=qaSpeech.at(-1);if(u.onend)u.onend();});
      assert.ok((await page.locator('[data-radio-current]').innerText()).includes('共同听见的话'));
      await page.getByRole('button',{name:'连续收听（系统音色）',exact:true}).click();
      await page.evaluate(()=>qaSpeech.at(-1).onend());
      await page.waitForFunction(()=>document.querySelector('[data-radio-current]').textContent.includes('还没播放的秘密'));
      assert.ok((await page.locator('[data-radio-current]').innerText()).includes('还没播放的秘密'));
      assert.equal(await page.getByRole('button',{name:'已听回放（3）',exact:true}).count(),1);
      await page.evaluate(()=>qaSpeech.at(-1).onend());
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='暂停声音').disabled);
      assert.ok(await page.getByRole('button',{name:'暂停声音',exact:true}).isDisabled());
      assert.equal(await page.evaluate(()=>qaCalls),1);
      const layout=await page.locator('[data-radio-timeline]').evaluate(el=>({w:el.clientWidth,scroll:el.scrollWidth,body:el.lastElementChild.scrollHeight,view:el.lastElementChild.clientHeight}));
      assert.ok(layout.scroll<=width,JSON.stringify(layout));assert.ok(layout.body>layout.view);
      await page.screenshot({path:'/tmp/lisa-timeline-'+width+'.png'});
      await page.getByRole('button',{name:'连续收听（系统音色）',exact:true}).click();
      await page.getByLabel('暂停，和他说一句').focus();
      assert.ok(await page.getByRole('button',{name:'暂停声音',exact:true}).isDisabled());
      await page.getByRole('button',{name:'连续收听（系统音色）',exact:true}).click();
      await page.evaluate(()=>qaSpeech.at(-1).onerror({error:'not-allowed'}));
      await page.getByRole('alert').filter({hasText:'朗读中断了'}).waitFor();
      assert.ok(await page.getByRole('button',{name:'暂停声音',exact:true}).isDisabled());
      assert.equal(await page.evaluate(()=>qaCalls),1);
      assert.deepEqual(errors,[]);
      await ctx.close();console.log(width+'px: 单句替换、已听回放、重听/恢复、独听/陪听隔离、滚动通过');
    }
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
