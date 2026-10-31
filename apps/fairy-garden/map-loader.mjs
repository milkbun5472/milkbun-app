import {createDistrictStream} from './district-stream.mjs?v=fg-90b53e2779ab7a1c';
// Scene-owned shadow materials prevent the renderer’s shared depth shader from retaining an unloaded map texture.
// One active map resource set. Simulation is independent of these GPU objects.
export function disposeMap(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [...(Array.isArray(o.material)?o.material:[o.material]),o.customDepthMaterial,o.customDistanceMaterial])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures){x.dispose();x.source?.data?.close?.();}}
export function createMapLoader({maps,loadAsset,factories,attach,detach}){
 const views={},pending=new Map();let generation=0,retained=null,closed=false;
 async function ensure(id,position){if(views[id])return views[id];if(pending.has(id)){const view=await pending.get(id);return view.stale&&!closed?ensure(id,position):view;}if(closed)throw Error('场景已经关闭');const ticket=generation,map=maps[id];if(!map)throw Error('未知地图');const promise=(async()=>{const view=map.asset?{root:await loadAsset(map.asset)}:await factories[map.renderer]();try{for(const url of map.decorAssets||[])view.root.add(await loadAsset(url));}catch(e){disposeMap(view.root);throw e;}if(closed||ticket!==generation&&retained!==id){disposeMap(view.root);return {...view,stale:true};}attach(view.root);view.root.visible=false;
 if(map.chunks){view.stream=createDistrictStream({chunks:map.chunks,loadAsset,attach:root=>{attach(root);root.visible=view.root.visible;},detach,dispose:disposeMap});try{await view.stream.prime(position||map.spawn);}catch(e){view.stream.close();detach(view.root);disposeMap(view.root);throw e;}}
 if(closed||ticket!==generation&&retained!==id){view.stream?.close();detach(view.root);disposeMap(view.root);return {...view,stale:true};}views[id]=view;return view;})();pending.set(id,promise);try{return await promise;}finally{if(pending.get(id)===promise)pending.delete(id);}}
 function keep(id){generation++;retained=id;for(const key of Object.keys(views))if(key!==id){views[key].stream?.close();detach(views[key].root);disposeMap(views[key].root);delete views[key];}}
 function close(){closed=true;keep(null);}
 return {views,ensure,keep,close};
}
