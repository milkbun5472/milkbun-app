// Component identity follows the constructed mesh and group names, never its
// current colour. The editor, placement writer, batches and preview share it.
const part=(id,label,match)=>({id,label,match});
const feet=part('feet','底座与脚',/Foot|Feet|Plinth|HiddenBase|PedestalStem|TrestleLeg|ChairBackSupport/);
const books=part('books','书本',/Book/);
const vase=part('vase','花瓶与花盆',/Vase|Pot|Basket(?!Handle|Weave)/);
const leaves=part('leaves','枝叶',/Leaf|Leaves|Stem|Succulent/);
const flowers=part('flowers','花朵',/Petal|DriedSeed/);
const base=part('base','底座',/Pedestal|Base|Stand|Foot/);
const kinds={
 bed:[part('curtains','纱幔',/Curtain/),part('pillow','枕头',/Pillow/),part('quilt','被子',/Duvet|Quilt(?!Turnback|Stitch)/),part('fold','被沿与缝线',/Fold|Turnback|Stitch/),part('mattress','床垫',/Mattress(?!Tray)/),feet,part('head','床头与床尾',/Head|Spindle|BedPost|BedArch|BedRod|Woven/)],
 sofa:[part('cushionLeft','左抱枕',o=>o.name==='SofaCushion'&&o.position.x<0),part('cushionRight','右抱枕',/SofaCushion/),part('buttons','软包扣饰',/UpholsteryButton/),part('seat','坐垫',/CollectionSeat|SofaSeat|CloudSeat|LeatherSeat/),part('back','靠背',/Back|Tufted|Woven/),part('arms','扶手',/Arm|Bolster|SteelLoop/),feet],
 table:[part('top','桌面',/TableTop/),part('legs','桌腿与支架',/Foot|Leg|Pedestal|Trestle|Column|Brace|Stretcher/),books,part('tableware','餐具与桌上摆件',/Plate|Cup|Tea|Vase|Flower|Leaf|Bookmark|Chopsticks|SingleStem/)],
 chair:[part('seat','坐垫',/ChairSeat/),part('back','靠背',/Back|Woven|Windsor|ChairReed/),feet],
 wardrobe:[part('doors','柜门',/CabinetFace|Tambour/),part('hardware','把手',/Knob|Pull/),feet],
 cabinet:[part('drawers','抽屉与柜门',/Drawer(?!Pull|Loop|Label)|CabinetFace|Tambour/),part('hardware','把手与标签',/Knob|Pull|Label/),part('shade','台灯灯罩',/Shade/),part('lamp','台灯支架',/Lamp/),feet],
 shelf:[books,part('basket','收纳藤篮',/Basket|Woven/),part('display','陶器摆件',/Vase|Bowl/),part('boards','层板',/Ledge|ShelfBoard/),part('back','背板与支撑',/InnerShadow|BackBrace/),feet],
 kitchen:[part('top','台面',/Worktop/),part('doors','柜门',/CounterDoor/),part('hardware','把手',/Knob/),part('sink','水槽',/Sink/),part('tap','水龙头',/Tap/),part('stove','灶台',/Cooktop|CookingRing/),part('lidKnob','锅盖把手',/LidKnob/),part('lid','锅盖',/PotLid/),part('soup','锅中汤汁',/SoupSurface/),part('pot','锅身',/PotBody|SoupPot/),part('ingredients','备菜食材',/PreparationIngredients/),part('board','备菜板',/Board/),part('tea','杯中茶水',/TeaSurface/),part('cups','杯子',/Cup/),feet],
 counter:[part('top','台面',/Worktop/),part('doors','柜门',/CounterDoor/),part('hardware','把手',/Knob/),part('utensils','备菜板',/Board/),part('tea','杯中茶水',/TeaSurface/),part('cups','杯子',/Cup/),part('food','面包',/Loaf/),feet],
 plant:[part('pot','花盆',/Pot(?!Soil)/),part('soil','泥土',/Soil/),part('leaves','叶片',/Leaf$/),part('stems','枝干',/Stem/)],
 light:[part('shade','灯罩',/Shade|Envelope|Dome|GlassPetal/),part('diffuser','灯罩内层',/Diffuser/),part('trim','灯罩骨架与顶饰',/Rib|Ring|Crown/),part('stem','灯杆',/Stem|Arm|BambooLeg/),feet],
 rug:[part('body','毯面',/Backing/),part('pattern','花纹与拼块',/Diamond|Island|Stripe/),part('border','编织与边框',/Loop|Border/)],
 screen:[part('weave','编织横纹',/Crossing/),part('cord','编织竖纹',/Upright/),part('panels','屏风面板',/Panel(?!Frame)/),feet],
 decor:[part('glass','玻璃',/Glass/),part('plant','植物',/Succulent/),part('soil','泥土',/Soil/),part('metal','金属框架',/TerrariumCorner/),part('record','唱片',/TurntableRecord/),part('label','唱片标签',/RecordLabel/),part('sleeves','唱片封套',/Sleeve/),part('player','唱机',/TurntableDeck|Tonearm/),part('horn','喇叭',/Gramophone|Horn/),feet]
};
const ornaments={
 'botanical-frame':[part('frame','画框',/Frame/),part('paper','画纸',/Paper/),part('stem','植物枝干',/Stem/),part('leaves','植物叶片',/Leaf/)],
 macrame:[part('rod','挂杆',/Rod/),part('cord','编绳',/Cord/),part('knots','结纹',/Knot/),part('tassels','流苏',/Tassel/)],
 'woven-wall-trio':[part('plates','壁盘',/Plate$/),part('braid','盘上编织',/Braid/)],
 'oval-mirror':[part('frame','镜框',/Frame|Crest/),part('glass','镜面',/Glass/),part('glint','镜面亮纹',/Glint/)],
 'bubble-mirror':[part('frame','镜框',/Frame/),part('glass','镜面',/Glass/),part('glint','镜面亮纹',/Glint/)],
 'pendulum-clock':[part('case','钟壳',/Case/),part('face','表盘',/Face/),part('hands','指针',/Hand/),part('pendulum','钟摆',/Pendulum/)],
 'landscape-frame':[part('frame','画框',/Frame/),part('sky','天空',/Sky/),part('hillLeft','左侧山丘',o=>o.name==='PaintedHill'&&o.position.x<0),part('hillRight','右侧山丘',/Hill/),part('sun','太阳',/Sun/)],
 'arch-art':[part('paper','画底',/Paper/),part('arch','拱门',/ColourArch/),part('opening','内层拱门',/Opening/)],
 'cloud-wall-shelf':[part('back','云朵背板',/Back/),part('shelf','架板',/Shelf$/),books,vase,leaves,flowers],
 'geometric-poster':[part('frame','画框',/Frame/),part('paper','画纸',/Paper/),part('block','方块',/Block/),part('circle','圆形',/Circle/),part('line','线条',/Line/)],
 'rail-wall-shelf':[part('rail','支架',/Rail/),part('boards','层板',/MetalShelf/),books,vase],
 'hanging-planter':[part('hook','挂钩',/Hook/),part('rope','吊绳',/Suspension/),vase,part('stems','垂枝',/Stem/),part('leaves','叶片',/Leaf/)],
 'flower-basket':[part('basket','花篮',/^Basket$/),part('weave','篮身编纹',/Weave/),part('handle','提手',/Handle/),flowers,leaves],
 'dried-vases':[part('vaseLeft','左花瓶',o=>/^Vase/.test(o.name)&&o.position.x<0),part('vaseRight','右花瓶',/Vase/),flowers,leaves],
 'bust-pedestal':[base,part('sculpture','石膏像',/Shoulders|Neck|Head|Nose/),part('eyes','眼睛',/Eye/)],
 'candle-pedestal':[base,part('holder','烛台支架',/Stem|Arms|Cup/),part('wax','蜡烛',/Wax/),part('flame','火焰',/Flame/)],
 'loop-sculpture':[base,part('sculpture','陶艺圆环',/Loop/)],
 'plush-bear':[part('body','小熊身体',/Body|Head|Ear|Arm|Foot/),part('face','眼睛与鼻子',/Eye|Nose/),part('muzzle','嘴边绒毛',/Muzzle/),part('ribbon','蝴蝶结',/Ribbon/)],
 'kinetic-sculpture':[base,part('rods','金属支杆',/Rod|Bar/),part('discLeft','左挂片',o=>o.name==='MobileDisc'&&o.position.x<0),part('discTop','右上挂片',o=>o.name==='MobileDisc'&&o.position.y>1),part('discBottom','右下挂片',/Disc/)],
 'glass-vase':[base,vase,flowers,leaves]
};
export function furniturePartDefinitions(p){return [...(ornaments[p.catalogId||p.id]||kinds[p.kind]||[]),part('structure',({bed:'床框',sofa:'沙发框架',table:'桌架细节',chair:'椅架',wardrobe:'柜身',cabinet:'柜身',shelf:'柜架',kitchen:'柜体',counter:'柜体',light:'灯具细节',screen:'屏风框架',decor:'柜体与底板'})[p.kind]||'主体细节',/.*/)];}
export const furnitureHex=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)?x.toLowerCase():'';
export function normalizePartColors(p,raw){
 const keys=new Set(furniturePartDefinitions(p).map(q=>q.id));
 return Object.fromEntries(Object.entries(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}).filter(([key,value])=>keys.has(key)&&furnitureHex(value)).map(([key,value])=>[key,furnitureHex(value)]));
}
export function patchPartColors(p,current,patch){
 if(patch===null)return {};
 const result=normalizePartColors(p,current),keys=new Set(furniturePartDefinitions(p).map(q=>q.id));
 for(const [key,value]of Object.entries(patch&&typeof patch==='object'&&!Array.isArray(patch)?patch:{}))if(keys.has(key)){if(value==='')delete result[key];else if(furnitureHex(value))result[key]=furnitureHex(value);}
 return result;
}
export function tagFurnitureParts(g,p){
 const definitions=furniturePartDefinitions(p),found=new Map();
 g.traverse(o=>{if(!o.isMesh)return;
  const names=[];for(let n=o;n&&n!==g;n=n.parent)names.push(n.name);const path=names.join('/');
  const q=definitions.find(q=>typeof q.match==='function'?q.match(o):q.match.test(path));o.userData.furniturePart=q.id;
  if(!found.has(q.id))found.set(q.id,{id:q.id,label:q.label,defaultColor:'#'+o.material.color.getHexString()});
 });
 g.userData.parts=definitions.filter(q=>found.has(q.id)).map(q=>({...found.get(q.id),color:p.partColors?.[q.id]||found.get(q.id).defaultColor,custom:!!p.partColors?.[q.id]}));
 g.userData.partColors=normalizePartColors(p,p.partColors);
}
export function applyFurniturePartColors(root){
 const replaced=new Set();
 for(const g of root.children){if(!g.userData.partColors)continue;const clones=new Map();
  g.traverse(o=>{const color=g.userData.partColors[o.userData.furniturePart];if(!o.isMesh||!color)return;
   const key=o.userData.furniturePart;if(!clones.has(key))clones.set(key,new Map());const group=clones.get(key),old=o.material;
   if(!group.has(old)){const next=old.clone();next.color.set(color);group.set(old,next);}o.material=group.get(old);replaced.add(old);
  });
 }
 const retained=new Set();root.traverse(o=>{if(o.isMesh)retained.add(o.material);});for(const m of replaced)if(!retained.has(m))m.dispose();
}
