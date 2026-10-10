// Tag the real shell surfaces before batching removes individual mesh names.
export function tagRoomTones(root){
 root.traverse(o=>{
  const mat=o.material;if(!o.isMesh||!mat?.color||mat.map)return;
  if(/Ground|Water|Leaves|Leaf|TreeCrown|Grass/.test(o.name))mat.userData.dayTone='landscape';
  else if(/^(?:Floor|floor-join|ConcreteSeam|FloorPlank|FloorTile|TrackBed)$/.test(o.name))mat.userData.dayTone='floor';
  else if(/^(?:BackWall|LeftWall|WindowWall|WallPanel|LowCornerWall|ExtendedBedroomWall|PaperWindow)$/.test(o.name)&&mat.userData.dayTone!=='floor')mat.userData.dayTone='paper';
 });
}
