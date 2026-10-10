// Shared offscreen readback for portraits, keepsakes and catalogue previews. The live
// framebuffer, viewport and scissor are restored even when capture fails.
export function renderPhoto(T,renderer,scene,camera,{width=640,height=480,quality=.78,format='image/jpeg'}={}){
 const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),buffer=new T.WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4);
 if(buffer.texture)buffer.texture.colorSpace=T.SRGBColorSpace;
 try{
  // A render target's viewport already uses physical pixels. setViewport would
  // apply the screen pixel ratio again, enlarging and cropping the captured scene.
  renderer.setRenderTarget(buffer);renderer.setScissorTest(false);renderer.render(scene,camera);
  renderer.readRenderTargetPixels(buffer,0,0,width,height,pixels);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height),stride=width*4;
  for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-y-1)*stride,(height-y)*stride),y*stride);
  ctx.putImageData(data,0,0);return canvas.toDataURL(format,quality);
 }finally{
  // Restore logical screen settings before binding the previous target, so a
  // nested target also recovers its own physical viewport and scissor.
  renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setRenderTarget(target);buffer.dispose();
 }
}

// Invisible wardrobe alternatives and parked props must not enlarge a portrait.
export function visibleBounds(T,roots){
 const box=new T.Box3();
 const visit=o=>{if(!o.visible)return;if(o.isMesh&&o.geometry){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox?.();if(o.geometry.boundingBox)box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}for(const child of o.children||[])visit(child);};
 for(const root of roots.filter(Boolean)){root.updateWorldMatrix(true,true);visit(root);}return box;
}
