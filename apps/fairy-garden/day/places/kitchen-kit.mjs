// The home and professional kitchen share the same utensil surfaces and anchors.
export function soupPot(k,g,{x,z,y,r=.13,contactY,lidY=y+.093,knobY=y+.13,body='#839a8d',soup='#c8c199',lid='#eee7d5',knob='#53675f'}){
 k.cylinder('SoupPot',{x,z,y,r,h:.16,color:body},g);
 k.cylinder('SoupSurface',{x,z,y:contactY-.003,r:r-.02,h:.008,color:soup},g);
 const cover=k.replaceableGroup('CookingPotLid',{},g);
 k.ellipsoid('PotLid',{x,z,y:lidY,w:r*2,h:.045,d:r*2,color:lid},cover);
 k.sphere('LidKnob',{x,z,y:knobY,r:.026,color:knob},cover);
 return cover;
}
export function preparationSurface(k,g,{x,z,y,contactY,contactZ=z,board='#b99569',food='#92ab80'}){
 k.box('PreparationBoard',{x,y,z,w:.64,h:.04,d:.34,color:board},g);
 for(let n=0;n<4;n++)k.ellipsoid('PreparationVegetable',{x:x-.17+n*.11,y:contactY,z:contactZ,w:.10,h:.05,d:.18,color:food},g);
}
