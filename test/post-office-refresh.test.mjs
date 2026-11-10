import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(host,view){
 const source=fs.readFileSync(new URL('../apps/post-office/game.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function refresh(){'),end=source.indexOf('function animate(',start);
 assert.ok(start>=0&&end>start);
 const context={host,view,status:{textContent:''},closed:false,closing:false,paused:false,failed:false,key:'',pending:null,refreshAgain:false,projectShop:shop=>shop};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nglobalThis.refresh=refresh;',context);return context;
}

test('a refresh during an older scene read waits for one fresh projection with the latest facts',async()=>{
 let value=0,release,entered,reads=0;
 const firstView=new Promise(resolve=>{entered=resolve;});
 const block=new Promise(resolve=>{release=resolve;});const applied=[];
 const h=harness({async sync(){},read(){reads++;return {shop:{value}};}},{async sync(next){applied.push(next.value);if(applied.length===1){entered();await block;}},pause(){}});
 const first=h.refresh();await firstView;value=1;const second=h.refresh();value=2;const third=h.refresh();
 assert.equal(second,first);assert.equal(third,first);let finished=false;second.then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);
 release();await Promise.all([first,second,third]);assert.deepEqual(applied,[0,2]);assert.equal(reads,2);assert.equal(h.key,'{"value":2}');assert.equal(h.pending,null);
});

test('a failed read releases the refresh slot so an explicit retry can recover',async()=>{
 let broken=true,reads=0;const errors=[];
 const h=harness({async sync(){if(broken)throw Error('fixture read failed');},read(){reads++;return {shop:{value:3}};},error:message=>errors.push(message)},{async sync(){},pause(){}});
 await h.refresh();assert.equal(h.failed,true);assert.equal(h.pending,null);assert.deepEqual(errors,['fixture read failed']);
 broken=false;await h.refresh();assert.equal(h.failed,false);assert.equal(reads,1);assert.equal(h.status.textContent,'');
 h.closed=true;await h.refresh();assert.equal(reads,1);
});
