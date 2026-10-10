import {repairPetSkin} from './pet-skin.mjs?v=fg-7dbe5530b8cc1d34';
import {createPetEyes} from './pet-eyes.mjs?v=fg-7dbe5530b8cc1d34';
import {PET_MOODS,normalizePetMood} from './pet-mood.mjs?v=fg-7dbe5530b8cc1d34';
import {createCatMotion,normalizeTail} from './cat-motion.mjs?v=fg-7dbe5530b8cc1d34';
import {createCatDye,CAT_LOOK_KEY} from './cat-dye.mjs?v=fg-7dbe5530b8cc1d34';
export const PET_SPECIES_KEY='lisa-pet-preview-species-v1';
const readSaved=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const dataURL=name=>{const url=new URL(name,import.meta.url),build=new URL(import.meta.url).searchParams.get('v');if(build?.startsWith('fg-'))url.searchParams.set('v',build);return url.href;};
const sources=new Map();
function clonePetSource(source){const model=source.clone(true),pairs=new Map();function pair(a,b){pairs.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}pair(source,model);source.traverse(o=>{const copy=pairs.get(o);if(o.isMesh)copy.geometry=o.geometry.clone();if(o.isSkinnedMesh){copy.skeleton=o.skeleton.clone();copy.skeleton.bones=o.skeleton.bones.map(b=>pairs.get(b));copy.bind(copy.skeleton,o.bindMatrix);}});return model;}
export async function loadPetCompanion(T,loader,{height=.88,persist=true,initialSpecies='cat',compressedMask=false}={}){
  const pets={};const saved=key=>persist?readSaved(key):null;const store=(key,value)=>{if(persist)save(key,value);};
  await Promise.all(['cat','dog'].map(async species=>{
    const version=species==='cat'?'pet-motion-6':'pet-dog-4';
    const cacheKey=species+':'+compressedMask;if(!sources.has(cacheKey))sources.set(cacheKey,Promise.all([loader.loadAsync(dataURL(`${species}.glb?v=${version}`)),fetch(dataURL(`${species}-rig.json`)).then(r=>{if(!r.ok)throw Error('宠物骨骼 '+r.status);return r.json();}),new T.TextureLoader().loadAsync(dataURL(`${species}-mask.${compressedMask?'webp':'png'}?v=${version}`))]).catch(e=>{sources.delete(cacheKey);throw e;}));
    const [file,rig,mask]=await sources.get(cacheKey);
    const model=clonePetSource(file.scene),bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),scale=height/bounds.getSize(new T.Vector3()).y;
    model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    repairPetSkin(model,species);const dye=createCatDye(T,model,mask,rig.dye,{species}),lookKey=species==='cat'?CAT_LOOK_KEY:'lisa-pet-house-dog-look-v1';dye.set(saved(lookKey));const eyes=createPetEyes(model,species);
    let mouthMesh;model.traverse(o=>{if(o.isSkinnedMesh&&!o.userData.eyeBacking)mouthMesh=o;});const positions=mouthMesh.geometry.attributes.position,hint=new T.Vector3().fromArray(species==='dog'?[0,.44,.489]:[0,.425,.455]),mouthPoint=new T.Vector3(),probe=new T.Vector3();let nearest=Infinity;for(let i=0;i<positions.count;i++){probe.fromBufferAttribute(positions,i);const distance=probe.distanceToSquared(hint);if(distance<nearest){nearest=distance;mouthPoint.copy(probe);}}
    pets[species]={model,rig,dye,eyes,mouthPoint:mouthPoint.toArray(),lookKey,tailKey:`lisa-pet-${species}-tail-v1`,tail:normalizeTail(saved(`lisa-pet-${species}-tail-v1`)||{}),mood:normalizePetMood('neutral')};
  }));
  const root=new T.Group();for(const p of Object.values(pets))root.add(p.model);
  let species=(persist?saved(PET_SPECIES_KEY):initialSpecies)==='dog'?'dog':'cat',motion,boundSpecies,options={};
  function bind(value=options){options=value;const expressionState=boundSpecies===species?motion?.snapshot():undefined;motion?.dispose();for(const [key,p] of Object.entries(pets))p.model.visible=key===species;motion=createCatMotion(T,pets[species].model,pets[species].rig,root,{...options,expressionState,eyes:pets[species].eyes});boundSpecies=species;motion.setTail(pets[species].tail);motion.setMood(pets[species].mood);motion.update(0,0);return motion;}
  function select(value){if(!pets[value])return;species=value;store(PET_SPECIES_KEY,species);bind();}
  return {root,bind,select,respond:()=>motion?.respond()||false,dispose(){motion?.dispose();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();o.skeleton?.dispose();}});root.removeFromParent();},get species(){return species;},get mouthPoint(){return [...pets[species].mouthPoint];},get model(){return pets[species].model;},get rig(){return pets[species].rig;},get dye(){return pets[species].dye;},get motion(){return motion;},get mood(){return {...pets[species].mood};},get animating(){return this.tail.wag||this.mood.id!=='neutral'||!!motion?.animating;},setMood(value){pets[species].mood=normalizePetMood(value);motion?.setMood(pets[species].mood);return this.mood;},get tail(){return {...pets[species].tail};},setTail(value){pets[species].tail=normalizeTail(value);motion?.setTail(pets[species].tail);store(pets[species].tailKey,pets[species].tail);return this.tail;},saveLook(value){const look=this.dye.set(value);store(pets[species].lookKey,look);return look;}};
}
// These controls are shared by the living room and the whole street. The
// settings float over the actual pet so users can see an angle change live.
export function mountPetControls(pet,{draw,onSpecies=()=>{}}){
  const choice=document.createElement('section');choice.className='pet-choice';choice.setAttribute('aria-label','选择宠物');
  choice.innerHTML='<label>陪伴 <select id="pet-species" aria-label="选择猫咪或狗狗"><option value="cat">猫咪</option><option value="dog">狗狗</option></select></label><button id="tail" aria-expanded="false" aria-controls="tail-panel">尾巴</button><button id="mood" aria-expanded="false" aria-controls="mood-panel">体态</button>';
  const panel=document.createElement('section');panel.id='tail-panel';panel.className='pet-settings';panel.hidden=true;panel.setAttribute('aria-label','尾巴姿态');
  panel.innerHTML='<div class="tail-head"><strong>尾巴姿态</strong><button id="tail-wag" aria-pressed="true">轻轻摇</button></div><label>抬低 <input id="tail-pitch" type="range" min="-25" max="25" step="1" aria-label="尾巴抬低角度"><output></output></label><label>左右 <input id="tail-yaw" type="range" min="-35" max="35" step="1" aria-label="尾巴左右角度"><output></output></label><button id="tail-reset">自然姿态</button>';
  const moodPanel=document.createElement('section');moodPanel.id='mood-panel';moodPanel.className='pet-settings';moodPanel.hidden=true;moodPanel.setAttribute('aria-label','心情体态');
  moodPanel.innerHTML='<strong>心情体态</strong><p>看看它开心、困困或好奇时的样子。</p><div class="mood-grid">'+PET_MOODS.map(m=>`<button data-mood="${m.id}" aria-pressed="false">${m.label}</button>`).join('')+'</div>';
  document.body.append(choice,panel,moodPanel);
  const select=choice.querySelector('select'),button=choice.querySelector('#tail'),moodButton=choice.querySelector('#mood'),wag=panel.querySelector('#tail-wag'),pitch=panel.querySelector('#tail-pitch'),yaw=panel.querySelector('#tail-yaw');
  function sync(){moodPanel.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mood===pet.mood.id)));select.value=pet.species;const value=pet.tail;pitch.value=value.pitch;yaw.value=value.yaw;pitch.nextElementSibling.value=value.pitch+'°';yaw.nextElementSibling.value=value.yaw+'°';wag.setAttribute('aria-pressed',String(value.wag));wag.textContent=value.wag?'轻轻摇':'不摇尾巴';}
  select.onchange=()=>{pet.select(select.value);sync();onSpecies();draw();};
  function toggle(id){const open=document.getElementById(id+'-panel').hidden;for(const name of ['tail','mood','fur']){const el=document.getElementById(name+'-panel');if(el)el.hidden=name!==id||!open;document.getElementById(name)?.setAttribute('aria-expanded',String(name===id&&open));}}
  button.onclick=()=>toggle('tail');moodButton.onclick=()=>toggle('mood');
  moodPanel.onclick=event=>{const b=event.target.closest('[data-mood]');if(!b)return;pet.setMood(b.dataset.mood);sync();draw();};
  function change(){pet.setTail({wag:pet.tail.wag,pitch:Number(pitch.value),yaw:Number(yaw.value)});sync();draw();}
  pitch.oninput=yaw.oninput=change;wag.onclick=()=>{pet.setTail({...pet.tail,wag:!pet.tail.wag});sync();draw();};panel.querySelector('#tail-reset').onclick=()=>{pet.setTail({});sync();draw();};sync();
  return {sync};
}
