// GLTFLoader sanitizes colons in Object3D.name; userData.name retains the authored glTF name.
export function openingTag(node){
 const match=/^(shut|open):([A-Za-z][A-Za-z0-9]*)$/.exec(node.userData?.name||node.name||'');
 return match?{side:match[1],key:match[2]}:null;
}
