import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newPetBirth,restorePetBirth,adoptPetBirth,petBirthView} from './birth.mjs';
import {petEntry,newPetEntry,restorePetState,projectActivePet,snapshotPetState} from './state.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
process.env.TZ='America/Winnipeg';
const at=date=>new Date(date+'T12:00:00').getTime(),today=at('2026-10-04');
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
const savedBirth=(birthday,registeredOn=birthday)=>({birthday,registeredOn,adoptedOn:registeredOn});
const snapshot=state=>snapshotPetState(state,{position:state.position,room:state.room,outdoor:null,evening:false});

test('adoption covers every age from 56 to 84 days, with fixed estimated civil birthdays',()=>{
 const ages=[];
 for(let i=0;i<29;i++){
  const birth=newPetBirth({at:today,random:()=>i/29}),view=petBirthView(birth,today);
  ages.push(view.days);assert.equal(view.days,56+i);assert.equal(view.weeks,Math.floor((56+i)/7));
  assert.equal(birth.adoptedOn,'2026-10-04');assert.equal(birth.registeredOn,'2026-10-04');
  assert.equal(view.estimated,true);assert.equal(view.legacy,false);
 }
 assert.equal(new Set(ages).size,29);
 assert.equal(newPetBirth({at:today,random:()=>0}).birthday,'2026-08-09');
 assert.equal(newPetBirth({at:today,random:()=>1}).birthday,'2026-07-12');
 for(const roll of [-10,10,NaN,Infinity])assert.ok(ages.includes(petBirthView(newPetBirth({at:today,random:()=>roll}),today).days));
});

test('first pet is dated only on confirmed adoption; a draft crossing midnight retains its drawn age',()=>{
 const first=petEntry({configured:false,profile:{name:'团子'}},'first',{at:today});assert.equal(first.birth,null);
 adoptPetBirth(first,{at:today,random:()=>0});assert.equal(first.birth.birthday,'2026-08-09');
 const draft=newPetEntry({name:'栗子',species:'dog'},[first],()=>.5,today),start=petBirthView(draft.birth,today).days;
 adoptPetBirth(draft,{at:at('2026-10-05'),random:()=>{throw Error('must not redraw age');}});
 assert.equal(draft.birth.adoptedOn,'2026-10-05');assert.equal(petBirthView(draft.birth,at('2026-10-05')).days,start);
 assert.equal(petBirthView(draft.birth,today).days,start-1);
});

test('legacy birthdays are estimated once per pet and survive the canonical writer, renaming and selection',()=>{
 let draws=0;
 const state=restorePetState({configured:true,profile:{name:'团子'},care:{elapsed:90000},life:{at:at('2026-08-01')}},world,{at:today,random:()=>{draws++;return 0;}});
 assert.equal(draws,1);assert.equal(state.pets[0].birth.adoptedOn,null);assert.equal(state.pets[0].birth.registeredOn,'2026-10-04');
 const other=petEntry({configured:true,profile:{name:'栗子',species:'dog'},career:{balance:72}},'pet-2',{at:today,random:()=>1});
 state.pets.push(other);const births=state.pets.map(p=>structuredClone(p.birth));
 state.activePetId=other.id;projectActivePet(state);state.profile.name='栗栗';state.profile.look.base='#abcdef';
 state.day=999;state.care.elapsed=999999;state.clock={epoch:1,startDay:999,cycle:1};
 const saved=snapshot(state),restored=restorePetState(JSON.parse(JSON.stringify(saved)),world,{at:at('2026-10-11'),random:()=>{throw Error('birthday rerolled');}});
 assert.deepEqual(restored.pets.map(p=>p.birth),births);assert.equal(restored.profile.name,'栗栗');assert.equal(restored.pets[1].career.balance,72);
 assert.equal(petBirthView(restored.pets[0].birth,at('2026-10-11')).days,63);
 assert.equal(petBirthView(restored.pets[1].birth,at('2026-10-11')).days,91);
 assert.equal(petBirthView(restored.pets[0].birth,today).legacy,true);
 assert.ok(saved.pets.every(p=>!Object.hasOwn(p.birth,'age')&&!Object.hasOwn(p.birth,'days')));
});

test('real civil days grow age over DST and offline gaps independently of game time',()=>{
 const birth=newPetBirth({at:at('2026-03-01'),random:()=>0});
 const before=new Date('2026-03-07T23:55:00-06:00').getTime(),after=new Date('2026-03-08T23:55:00-05:00').getTime();
 assert.equal(after-before,23*3600000);assert.equal(petBirthView(birth,after).days-petBirthView(birth,before).days,1);
 const fallBefore=new Date('2026-10-31T23:55:00-05:00').getTime(),fallAfter=new Date('2026-11-01T23:55:00-06:00').getTime();
 assert.equal(fallAfter-fallBefore,25*3600000);assert.equal(petBirthView(birth,fallAfter).days-petBirthView(birth,fallBefore).days,1);
 assert.equal(petBirthView(birth,at('2026-04-01')).days-petBirthView(birth,at('2026-03-01')).days,31);
 assert.equal(petBirthView(birth,at('2027-03-01')).label,'1 岁 1 个月 25 天');
});

test('month and year ages use calendar anniversaries, including leap days and month ends',()=>{
 for(const [born,date,label]of[
  ['2026-01-31','2026-07-31','6 个月'],['2026-01-31','2026-08-01','6 个月 1 天'],
  ['2026-08-31','2027-02-28','6 个月'],['2026-08-31','2027-03-01','6 个月 1 天'],
  ['2024-02-29','2025-02-28','1 岁'],['2024-02-29','2025-03-01','1 岁 1 天'],
  ['2024-02-29','2028-02-29','4 岁'],['2026-08-09','2026-10-04','8 周']
 ])assert.equal(petBirthView(savedBirth(born),at(date)).label,label,born+' '+date);
});

test('broken dates are repaired locally; clock rollback never redraws a valid birthday',()=>{
 const valid=savedBirth('2026-08-09','2026-10-04');
 for(const raw of [null,{}, {...valid,birthday:'2026-02-30'},{...valid,birthday:'2026-8-9'}, {...valid,registeredOn:'bad'}, {...valid,adoptedOn:undefined}, {...valid,adoptedOn:'2026-08-01'},{...valid,adoptedOn:'2026-10-05'},{...valid,birthday:'2026-11-01'}])assert.equal(restorePetBirth(raw),null);
 const restored=petEntry({configured:true,birth:valid},'first',{at:at('2026-01-01'),random:()=>{throw Error('redraw');}});
 assert.deepEqual(restored.birth,valid);assert.equal(petBirthView(restored.birth,at('2026-01-01')).days,0);
 assert.equal(petBirthView(restored.birth,today).days,56);assert.deepEqual(restored.birth,valid);
 const repaired=petEntry({configured:true,birth:{birthday:'bad'}},'broken',{at:today,random:()=>1});
 assert.equal(repaired.birth.birthday,'2026-07-12');assert.equal(repaired.birth.adoptedOn,null);
 assert.equal(petBirthView({birthday:'bad'},today),null);
});
