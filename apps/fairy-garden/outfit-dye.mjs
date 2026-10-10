// Dye ownership is resolved per fragment in undeformed garment coordinates.
// It follows the source fabric boundary, never an interpolated triangle label.
import * as T from 'three';
import {OUTFITS} from './wardrobe.mjs?v=fg-127ffe874240ba15';
export const DYE_SLOTS=['cloth','trim','bottom','accent','boots','bag','socks','detail'];
export function regionShader(o){
 const id=o.userData.outfit,name=o.name;if(!OUTFITS[id])return null;
 if(name.includes('_sleeve'))return `si=${id==='academy'||id==='garden'?1:0};`;
 if(name.includes('_footwear')&&id==='tee')return 'si=sc.b>sc.r+.01&&sc.r<.72&&p.y>.05?2:4;';
 if(name.includes('_footwear'))return id==='suit'?'si=p.y>.12?2:4;if(p.y>.08&&p.y<.12&&sc.r>.5)si=6;':id==='cardigan'?'si=(piece.y>.105||(piece.x>.045&&piece.y>.083&&piece.w<.08))?2:4;':'si=4;';
 if(name.includes('_side_lining'))return 'si=0;';
 if(id==='ranger')return name.includes('_bag')||name.includes('_strap')?'si=3;':name.includes('_trousers')?'si=piece.x>.36?0:2;':'si=0;';
 if(id==='academy')return `
 si=piece.x<.30?2:0;
 if(piece.x>.61)si=1;
 if(p.y>.49&&p.y<.67&&p.z>.08&&sc.r-sc.g>.16&&sc.r-sc.b>.22)si=3;
 `;
 if(id==='garden')return `
 si=0;
 if(p.y>.50&&sc.r>.60&&sc.g>.52)si=1;
 if(piece.x>.50&&piece.y<.655&&piece.w>.08)si=sc.r>.65?1:3;
 
 // The ornament wraps around the pouch: its left ear is behind z=.14.
 if(piece.x>.315&&piece.y<.388&&piece.z<-.11&&piece.w>.105)si=7;
 if(p.y<.17)si=6;
 `;
 if(id==='cardigan')return `
 si=0;
 bool cream=(sc.g-sc.b)>max(sc.r-sc.g,.005)*.32;
 if(piece.x<.30||p.y<.40||p.y<.44&&cream)si=2;
 if(piece.z>.05&&piece.w>.025&&piece.x>.37&&piece.y<.54)si=5;
 if(p.z>.065&&p.y>.50&&cream)si=5;
 // Authored strap islands continue across the shoulder and down its back.
 if(piece.x>.65&&piece.x<.71&&piece.y>.71&&piece.y<.73&&piece.z>-.10&&piece.z<-.065)si=5;
 `;
 if(id==='jacket')return `
 si=piece.x<.30?2:0;
 // The shirt and the inside of its collar are complete UV panels, including shadows.
 if(piece.x>.39&&piece.y>.69&&abs(piece.z)<.06&&piece.w>.06)si=1;
 if(piece.x>.655&&abs(piece.z)<.064&&piece.w>-.07)si=1;
 if(p.y<.15&&(sc.r>.48||p.y<.06))si=4;
 `;
 if(id==='suit')return `
 si=piece.x<.30?2:0;
 if(p.y>.55){
  if(sc.r>.48&&sc.g>.47&&sc.b>.43)si=1;
  else if(abs(p.x)<.034&&p.y<.664&&p.z>.09)si=3;
 }
 if(p.y<.115)si=4;
 if(p.y>.085&&p.y<.145&&sc.r>.5)si=6;
 `;
 // T恤（2026-09-27）：按原贴图的布色分，不按高度线——T恤下摆盖着裤腰，一条高度线会把下摆涂成裤色。
 // 白布＝T恤；偏蓝的灰布＝牛仔裤（到 .35 为止）；脚边的白和最底下的鞋底＝球鞋。
 if(id==='tee')return `
 si=0;
 bool denim=sc.b>sc.r+.01&&sc.r<.72;
 if(denim&&p.y<.36)si=2;
 if(p.y<.2&&!denim||p.y<.05)si=4;
 `;
 return null;
}
export function attachRegionDye(o,previous){
 const code=regionShader(o);if(!code)return;pieceAttribute(o.geometry);
 const defaults=OUTFITS[o.userData.outfit].colors;
 const palette=DYE_SLOTS.map(k=>new T.Color(defaults[k]||'#ffffff'));
 const bases=DYE_SLOTS.map(k=>new T.Color(defaults[k]||'#ffffff'));
 o.userData.regionDye={palette};
 o.material.onBeforeCompile=sh=>{
  previous(sh);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 dyePiece;varying vec4 vDyePiece;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDyePiece=dyePiece;');
  sh.uniforms.uRegionColors={value:palette};sh.uniforms.uRegionBase={value:bases};
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vDyePiece;uniform vec3 uRegionColors[8];uniform vec3 uRegionBase[8];');
  // Replace the old interpolated slot classifier and tint, after the cloth repair map.
  const start=sh.fragmentShader.indexOf(' int si=int(clamp(floor(vSlot+.25)');
  const end=sh.fragmentShader.indexOf('diffuseColor.rgb*=tt;',start);
  if(start<0||end<start)throw Error('Missing shared outfit dye stage');
  sh.fragmentShader=sh.fragmentShader.slice(0,start)+`
   vec4 piece=vDyePiece;vec3 p=vOutfitRest,sc=pow(max(diffuseColor.rgb,vec3(0.)),vec3(1./2.2));int si=0;
   ${code}
   float fabricLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   float baseLight=max(.025,dot(uRegionBase[si],vec3(.2126,.7152,.0722)));
   ${o.userData.outfit==='jacket'?`// Lapel panels retain texture relief while removing baked near-black occlusion.
   bool lapel=piece.x>.614&&piece.x<.617&&piece.y>.68&&piece.y<.688&&abs(piece.z)>.09&&abs(piece.z)<.11;
   if(si==0&&lapel)fabricLight=baseLight*pow(max(fabricLight/baseLight,.001),.30);`:''}
   diffuseColor.rgb=uRegionColors[si]*clamp(fabricLight/baseLight,.08,1.65);
  `+sh.fragmentShader.slice(end+'diffuseColor.rgb*=tt;'.length);
 };
 const oldKey=o.material.customProgramCacheKey();o.material.customProgramCacheKey=()=>oldKey+'regions-'+o.userData.outfit+'-'+o.name;
}
export function dyeRegions(o,colors){const d=o.userData.regionDye;if(d)DYE_SLOTS.forEach((k,i)=>{if(colors[k])d.palette[i].set(colors[k]);});}

// UV islands retain the source's actual overlapping garment panels. A trouser
// island reaches the leg; a coat-tail island does not. Their shared world height
// must not be used as a horizontal paint cut across both layers.
function pieceAttribute(g){
 if(g.hasAttribute('dyePiece'))return;
 const p=g.attributes.position,n=p.count,parent=Int32Array.from({length:n},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const ix=g.index?.array||Uint32Array.from({length:n},(_,i)=>i);
 for(let i=0;i<ix.length;i+=3){const a=find(ix[i]);parent[find(ix[i+1])]=a;parent[find(ix[i+2])]=a;}
 const groups=new Map();for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
 const values=new Float32Array(n*4);for(const v of groups.values()){let lo=Infinity,hi=-Infinity,x=0,z=0;for(const i of v){lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));x+=p.getX(i);z+=p.getZ(i);}for(const i of v)values.set([lo,hi,x/v.length,z/v.length],i*4);}
 g.setAttribute('dyePiece',new T.BufferAttribute(values,4));
}
