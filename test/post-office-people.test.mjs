import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {npcLook,NPC_COSTUMES} from '../apps/post-office/npc-appearance.mjs';
const c={};c.window=c;vm.runInNewContext(fs.readFileSync(new URL('../js/stamp-duel.js',import.meta.url),'utf8'),c);const D=c.StampDuel;
test('实际写客人名字的20×20词表，共用识别衣服与特征，所有组合稳定',()=>{
 assert.equal(D.FACE_WHO.length,20);assert.equal(D.FACE_ADJ.length,20);const styles=new Set(),features=new Set();
 for(const who of D.FACE_IDENTITIES)for(const feature of D.FACE_FEATURES){const customer={id:'same',name:feature.word+who.word},look=npcLook(customer,D);assert.equal(look.npcStyle,who.style);assert.ok(NPC_COSTUMES[look.npcStyle]);assert.equal(look.npcFeature,feature.id);assert.deepEqual(look,npcLook({...customer,id:'next-day'},D));styles.add(look.npcStyle);features.add(look.npcFeature);}
 assert.equal(styles.size,20);assert.equal(features.size,20);
 for(let seed=1;seed<120;seed++){let n=seed;const random=()=>((n=n*16807%2147483647)/2147483647),name=D.shopNewFace(random)[0];assert.notEqual(npcLook({name},D).npcStyle,'postcard');}
});
test('八位稀客按rareId认，与名字无关；固定路人保留，陌生名字才降级',()=>{
 for(const rare of D.RARE_GUESTS){const a=npcLook({rareId:rare.id,name:'不能按此名字猜'},D);assert.equal(a.npcStyle,'rare_'+rare.id);assert.equal(a.npcRare,rare.id);assert.equal(a.npcSpecies,rare.id==='cat'?'cat':'person');assert.ok(NPC_COSTUMES[a.npcStyle]);}
 for(const row of [...D.SHOP.NPC,...D.SHOP.TOUGH])assert.notEqual(npcLook({name:row[0]},D).npcStyle,'postcard');
 assert.equal(npcLook({name:'没有登记的客人'},D).npcStyle,'postcard');
 const extended={};extended.window=extended;vm.runInNewContext(fs.readFileSync(new URL('../js/stamp-duel.js',import.meta.url),'utf8').replace("['小男孩','child']","['小男孩','child'],['新身份','nurse']"),extended);
 assert.equal(npcLook({name:'戴草帽的新身份'},extended.StampDuel).npcStyle,'nurse');
});
