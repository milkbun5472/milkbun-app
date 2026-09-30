// Reuse the real ledger fixture and isolated browser from the layout regression.
const source = require('node:fs').readFileSync(require('node:path').join(__dirname,'ledger-reference-browser.cjs'),'utf8');
const stop = source.indexOf('await layout();');
if(stop<0)throw new Error('ledger browser bootstrap missing');
eval(source.slice(0,stop)+`
const mount = async skin => page.evaluate(skin=>{
 const d=loadJSON('x_ledger',null);d.settings.skin=skin;saveJSON('x_ledger',d);
 document.getElementById('ledger-test').remove();document.getElementById('rp-ticket')?.remove();
 const el=document.createElement('div');el.id='ledger-test';el.style='position:fixed;inset:0;z-index:2147483647';document.body.append(el);
 const onForwardToChat=(txnId,charId)=>{
  const msg=window.ledgerShareMessage(txnId,charId);if(!msg)return false;
  window.ledgerMarkShared(txnId,charId);window.rpShared={charId,msg};
  const card=document.createElement('div');card.id='rp-ticket';card.style='position:fixed;inset:0;z-index:2147483647;background:#e8e7f3;padding:80px 30px';document.body.append(card);
  ReactDOM.createRoot(card).render(React.createElement(ThemeContext.Provider,{value:DEFAULT_THEME},React.createElement(RecordedCard,{m:msg})));return true;
 };
 ReactDOM.createRoot(el).render(React.createElement(ThemeContext.Provider,{value:DEFAULT_THEME},React.createElement(Ledger,{characters:[{id:'rp-a',name:'角色甲'},{id:'rp-b',name:'角色乙'}],profile:{name:'测试'},onBack:()=>{},toast:()=>{},onForwardToChat})));
},skin);
for(const [w,h,skin] of [[320,568,'glass'],[390,844,'glass'],[430,932,'paper']]){
 await page.setViewportSize({width:w,height:h});await mount(skin);
 await root.getByRole('button',{name:'账单',exact:true}).click();
 await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').first().click();
 await root.locator('[data-ledger-share]').click();
 const picker=root.locator('[data-ledger-sharepicker]');
 assert.equal(await picker.locator('[data-ledger-recipient]').count(),2);
 const box=await picker.boundingBox();assert.equal(box.height,h,'share picker is a full mobile page');
 await snap('share-picker-'+w);await back();
 assert.equal(await root.locator('[data-ledger-overlay=txn]').count(),1,'cancel returns to the same receipt');
 await root.locator('[data-ledger-share]').click();await picker.locator('[data-ledger-recipient="rp-a"]').click();
 const sent=await page.evaluate(()=>window.rpShared);assert.equal(sent.charId,'rp-a');assert.equal(sent.msg.kind,'ledgershare');assert.equal(sent.msg.role,'user');
 assert.match(sent.msg.content,/星巴克/);
 assert.equal(await page.evaluate(()=>window.ledgerNoteFor('rp-b')),'','unselected character gains no access');
 assert.match(await page.evaluate(()=>window.ledgerNoteFor('rp-a')),/星巴克/);
 await page.waitForTimeout(350);assert.ok(await page.locator('#rp-ticket').getByText('拿给你看的这笔账',{exact:true}).isVisible());
 await snap('shared-ticket-'+w);
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['3 share picker sizes','cancel keeps receipt','single recipient','private bill isolation','glass and paper chat cards'],errors}));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
`);
