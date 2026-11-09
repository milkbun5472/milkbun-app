import * as T from 'three';
import {disposeMap} from './map-loader.mjs?v=fg-7ab05eea5d268f50';
// Common WebGL setup and teardown for standalone worlds. Scene-specific lights,
// camera and simulation stay with their world.
export function createWorldRenderer(host,{pixelRatio=1.5,exposure=1.1,alpha=false,preserveDrawingBuffer=false}={}){
 const renderer=new T.WebGLRenderer({antialias:true,alpha,preserveDrawingBuffer});
 renderer.setPixelRatio(Math.min(devicePixelRatio,pixelRatio));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=exposure;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.prepend(renderer.domElement);
 return renderer;
}
export function disposeWorldRenderer(renderer,scene){
 disposeMap(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
}
