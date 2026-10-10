// The scenery and traveler follow the same task. Reset movable props when work stops.
export function updateWorkScene(root,task,moving,time){
 if(!root)return;
 const playing=!moving&&task?.kind==='piano',guitar=root.getObjectByName('AcousticGuitar');
 if(guitar)guitar.visible=moving||task?.kind!=='guitar';
 root.traverse(o=>{if(o.name==='CookingPotLid'){const cooking=!moving&&task?.kind==='cook'&&o.parent.userData.furnitureId===task.furniture;o.position.y=cooking?.12:0;o.position.x=cooking?-.32:0;}});
 const keys=[];root.traverse(g=>{if(g.userData.key!=null){const n=g.userData.key,pressed=playing&&[9,12].includes(n)&&Math.sin(time*5+(n===9?0:Math.PI))>.25;g.rotation.x=pressed?.055:0;if(pressed)keys.push(n);}});
 root.userData.sceneAction={kind:task?.kind||null,pressedKeys:keys,guitarBorrowed:!!guitar&&!guitar.visible};
}
