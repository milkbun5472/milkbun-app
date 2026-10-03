import {createCatMotion,normalizeTail} from './cat-motion.mjs?v=fg-a9ae1eeede4db867';
import {createCatDye,CAT_LOOK_KEY} from './cat-dye.mjs?v=fg-a9ae1eeede4db867';
export const PET_SPECIES_KEY='lisa-pet-preview-species-v1';
const readSaved=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const dataURL=name=>{const url=new URL(name,import.meta.url),build=new URL(import.meta.url).searchParams.get('v');if(build?.startsWith('fg-'))url.searchParams.set('v',build);return url.href;};
export async function loadPetCompanion(T,loader,{height=.88,persist=true,initialSpecies='cat',compressedMask=false}={}){
  const pets={};const saved=key=>persist?readSaved(key):null;const store=(key,value)=>{if(persist)save(key,value);};
  await Promise.all(['cat','dog'].map(async species=>{
    const version=species==='cat'?'pet-motion-4':'pet-dog-1';
    const [file,rig,mask]=await Promise.all([loader.loadAsync(dataURL(`${species}.glb?v=${version}`)),fetch(dataURL(`${species}-rig.json?v=pet-motion-4`)).then(r=>{if(!r.ok)throw Error('宠物骨骼 '+r.status);return r.json();}),new T.TextureLoader().loadAsync(dataURL(`${species}-mask.${compressedMask?'webp':'png'}?v=${version}`))]);
    const model=file.scene,bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),scale=height/bounds.getSize(new T.Vector3()).y;
    model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const dye=createCatDye(T,model,mask,rig.dye),lookKey=species==='cat'?CAT_LOOK_KEY:'lisa-pet-house-dog-look-v1';dye.set(saved(lookKey));
    pets[species]={model,rig,dye,lookKey,tailKey:`lisa-pet-${species}-tail-v1`,tail:normalizeTail(saved(`lisa-pet-${species}-tail-v1`)||{})};
  }));
  const root=new T.Group();for(const p of Object.values(pets))root.add(p.model);
  let species=(persist?saved(PET_SPECIES_KEY):initialSpecies)==='dog'?'dog':'cat',motion,options={};
  function bind(value=options){options=value;motion?.dispose();for(const [key,p] of Object.entries(pets))p.model.visible=key===species;motion=createCatMotion(T,pets[species].model,pets[species].rig,root,options);motion.setTail(pets[species].tail);motion.update(0,0);return motion;}
  function select(value){if(!pets[value])return;species=value;store(PET_SPECIES_KEY,species);bind();}
  return {root,bind,select,get species(){return species;},get model(){return pets[species].model;},get rig(){return pets[species].rig;},get dye(){return pets[species].dye;},get motion(){return motion;},get tail(){return {...pets[species].tail};},setTail(value){pets[species].tail=normalizeTail(value);motion?.setTail(pets[species].tail);store(pets[species].tailKey,pets[species].tail);return this.tail;},saveLook(value){const look=this.dye.set(value);store(pets[species].lookKey,look);return look;}};
}
// These controls are shared by the living room and the whole street. The
// settings float over the actual pet so users can see an angle change live.
export function mountPetControls(pet,{draw,onSpecies=()=>{}}){
  const choice=document.createElement('section');choice.className='pet-choice';choice.setAttribute('aria-label','选择宠物');
  choice.innerHTML='<label>陪伴 <select id="pet-species" aria-label="选择猫咪或狗狗"><option value="cat">猫咪</option><option value="dog">狗狗</option></select></label><button id="tail" aria-expanded="false" aria-controls="tail-panel">尾巴</button>';
  const panel=document.createElement('section');panel.id='tail-panel';panel.className='pet-settings';panel.hidden=true;panel.setAttribute('aria-label','尾巴姿态');
  panel.innerHTML='<div class="tail-head"><strong>尾巴姿态</strong><button id="tail-wag" aria-pressed="true">轻轻摇</button></div><label>抬低 <input id="tail-pitch" type="range" min="-25" max="25" step="1" aria-label="尾巴抬低角度"><output></output></label><label>左右 <input id="tail-yaw" type="range" min="-35" max="35" step="1" aria-label="尾巴左右角度"><output></output></label><button id="tail-reset">自然姿态</button>';
  document.body.append(choice,panel);
  const select=choice.querySelector('select'),button=choice.querySelector('button'),wag=panel.querySelector('#tail-wag'),pitch=panel.querySelector('#tail-pitch'),yaw=panel.querySelector('#tail-yaw');
  function sync(){select.value=pet.species;const value=pet.tail;pitch.value=value.pitch;yaw.value=value.yaw;pitch.nextElementSibling.value=value.pitch+'°';yaw.nextElementSibling.value=value.yaw+'°';wag.setAttribute('aria-pressed',String(value.wag));wag.textContent=value.wag?'轻轻摇':'不摇尾巴';}
  select.onchange=()=>{pet.select(select.value);sync();onSpecies();draw();};
  button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));const fur=document.getElementById('fur-panel');if(fur&&!panel.hidden){fur.hidden=true;document.getElementById('fur')?.setAttribute('aria-expanded','false');}};
  function change(){pet.setTail({wag:pet.tail.wag,pitch:Number(pitch.value),yaw:Number(yaw.value)});sync();draw();}
  pitch.oninput=yaw.oninput=change;wag.onclick=()=>{pet.setTail({...pet.tail,wag:!pet.tail.wag});sync();draw();};panel.querySelector('#tail-reset').onclick=()=>{pet.setTail({});sync();draw();};sync();
  return {sync};
}
