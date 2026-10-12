// One description feeds home furniture, physical anchors, idle preferences and manual choices.
(function(root){
 const activities={
  piano:{label:'弹琴',furnitureLabel:'弧背小钢琴与琴凳',catalogId:'home-piano',kind:'piano',w:2.15,d:1.7,likes:'弹琴|练琴|钢琴|电钢琴|键盘乐器',target:{x:1.6,z:.58},heading:Math.PI,seat:{x:0,z:.58,rise:.45},contact:{x:-.16,y:.921,z:.20}},
  guitar:{label:'弹吉他',furnitureLabel:'吉他与谱架',catalogId:'home-guitar',kind:'guitar',w:.85,d:.62,likes:'吉他|拨弦|弹唱',target:{x:0,z:.90},heading:0},
  paint:{label:'在画架前画画',furnitureLabel:'折叠画架与颜料篮',catalogId:'home-easel',kind:'easel',w:1.2,d:.8,likes:'画画|绘画|画油画|水彩|素描|画稿|速写',target:{x:0,z:.67},heading:Math.PI,contact:{x:.12,y:.88,z:.32}},
  weights:{label:'练哑铃',furnitureLabel:'双层小哑铃架',catalogId:'home-weights',kind:'weights',w:1.15,d:.6,likes:'健身|举铁|力量训练|哑铃|练肌肉',target:{x:0,z:1.15},heading:0},
  stretch:{label:'在软垫上拉伸',furnitureLabel:'卷边运动软垫',catalogId:'home-mat',kind:'mat',w:1.65,d:2.1,walkThrough:true,surface:.035,likes:'瑜伽|拉伸|普拉提|舒展|健身|锻炼|运动',target:{x:0,z:0},heading:0}
 };
 // The existing placement writer and the phone reader share instance admission,
 // including original furniture's quota, ordering and the catalogue whitelist.
 function instances(raw,catalog,used=0,limit=80){
  const result=[];
  for(const [id,value]of Object.entries(raw||{})){
   if(used+result.length>=limit)break;
   if(!/^furniture-[1-9]\d{0,7}$/.test(id))continue;
   const item=catalog.find(p=>p.id===value?.catalogId);if(item)result.push({id,value,item});
  }
  return result;
 }
 function available(raw,inventory=root.CharDayCatalog?.find(p=>p.id==='dayHome')?.inventory){
  if(!inventory)return [];
  return [...new Set(instances(raw,inventory.catalog,inventory.baseCount,inventory.limit).filter(p=>p.value?.stored!==true&&activities[p.item.hobby]).map(p=>p.item.hobby))];
 }
 root.CharDayHomeHobbies={activities,instances,available};
})(globalThis);
