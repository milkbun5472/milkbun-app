export const PROFESSIONAL_STYLES={original:'原有配色',warm:'暖木手作',clean:'清爽浅色',ink:'深木沉静',soft:'柔和奶油'};
export const PROFESSIONAL_OPTIONS={
 dayLaboratory:{label:'实验室',field:'equipment',values:{general:'通用实验',microscope:'显微观察',chemistry:'化学样品',none:'只留台面'}},
 dayStudio:{label:'创作室',field:'materials',values:{paint:'颜料画笔',fabric:'布料缝制',craft:'手作工具',none:'空工作台'}},
 dayClinic:{label:'诊室',field:'equipment',values:{general:'常用器材',none:'只留家具'}},
 dayRehearsal:{label:'排练室',field:'mode',values:{all:'乐器与镜墙',music:'只留乐器',dance:'只留镜墙',empty:'开阔排练地面'}},
 dayLibrary:{label:'图书馆',field:'display',values:{standard:'原有书籍',literature:'文学与读书札记',research:'学术资料与索引'}},
 dayStation:{label:'候车站',field:'display',values:{standard:'原有候车陈设',travel:'旅行地图与行李标签',commute:'通勤报刊与票夹'}},
 dayGym:{label:'健身房',field:'display',values:{standard:'原有训练陈设',strength:'力量训练记录',stretch:'舒展与柔韧用品'}},
 dayMarket:{label:'超市',field:'display',values:{standard:'原有货架陈设',fresh:'蔬果与采购清单',daily:'日用品与包装样品'}},
 dayOffice:{label:'办公室',field:'display',values:{standard:'原有办公陈设',creative:'设计色样与手稿',technical:'技术图纸与零件样品'}},
 dayCampus:{label:'课堂／校园',field:'display',values:{standard:'原有课堂陈设',science:'理科模型与笔记',literature:'文科书籍与札记'}},
 dayInvestigation:{label:'办案室',field:'display',values:{standard:'原有办案陈设',field:'外勤包与记录',analysis:'证据索引与档案'}},
 dayService:{label:'后厨／吧台',field:'display',values:{standard:'原有餐饮陈设',coffee:'咖啡豆与手冲用品',bakery:'烘焙配方与面团样品'}},
 dayFilm:{label:'拍摄棚',field:'display',values:{standard:'原有拍摄陈设',cinema:'分镜与胶片',portrait:'人像色卡与作品册'}},
 dayBroadcast:{label:'录音室／直播间',field:'display',values:{standard:'原有录音陈设',music:'唱片与谱册',voice:'配音台本与发音札记'}},
 dayLegal:{label:'律所／法庭',field:'display',values:{standard:'原有法律陈设',consultation:'咨询案卷与名片盒',hearing:'庭审索引与笔录'}},
 dayTraining:{label:'训练基地',field:'display',values:{standard:'原有基地陈设',field:'外勤地图与无线电',physical:'体能记录与补给'}},
 dayWorkshop:{label:'工坊／维修间',field:'display',values:{repair:'机械检修陈设',craft:'手作陶艺材料',woodwork:'木作色样与木料'}},
 dayStudy:{label:'古风书房／议事厅',field:'display',values:{literature:'文人书斋',strategy:'军务图卷',art:'书画色样与印章'}}
};
const matches={
 microscope:/显微|微生物|细胞/,chemistry:/化学|试剂|化工/,fabric:/缝纫|缝制|织布|纺织/,craft:/陶艺|陶瓷|手作/,dance:/舞蹈|练舞/,music:/音乐|钢琴|乐谱|唱片/,research:/科研|学术|研究资料/,travel:/旅行|旅游/,commute:/通勤/,strength:/力量训练|举铁/,stretch:/瑜伽|柔韧|拉伸/,fresh:/生鲜|蔬果/,daily:/日用品/,creative:/平面设计|设计师|设计图/,technical:/工程师|技术图纸/,science:/物理|数学|化学|理科/,literature:/文学|诗词|诗书|书斋/,field:/外勤|野外|巡查/,analysis:/分析案情|证据索引/,coffee:/咖啡师|手冲|咖啡豆/,bakery:/烘焙|面包师|甜点师/,cinema:/电影|分镜/,portrait:/人像摄影/,voice:/配音|播音/,consultation:/法律咨询|咨询律师/,hearing:/庭审|法官|书记员/,physical:/体能训练|体能教练/,woodwork:/木工|木作/,strategy:/军务|兵书|兵法|军事/,art:/书画|水墨|国画/
};
export function inferredProfessional(raw,id,persona=''){
 const option=PROFESSIONAL_OPTIONS[id];if(!option)return {};
 const text=String(persona).split(/[。！？；\n]/).filter(c=>!/(?:不喜欢|讨厌|排斥|并非|不是)/.test(c)).join('。'),values=Object.keys(option.values);
 let picked=raw[id]?.[option.field];
 if(!Object.hasOwn(option.values,picked))picked=values.find(v=>matches[v]?.test(text))||values[0];
 let style=raw[id]?.style;
 if(!Object.hasOwn(PROFESSIONAL_STYLES,style)){
  style=/喜欢|偏好|喜爱|爱用/.test(text)?/深木|深色木|沉静配色|复古深色/.test(text)?'ink':/浅色|清爽|简洁配色/.test(text)?'clean':/奶油|柔和|淡粉/.test(text)?'soft':/暖木|原木|藤编/.test(text)?'warm':'original':'original';
 }
 return {[option.field]:picked,style};
}
export function professionalOptions(raw={},id,persona=''){
 const option=PROFESSIONAL_OPTIONS[id];if(!option)return {};
 const picked=inferredProfessional(raw,id,persona),value=picked[option.field];
 const result=id==='dayRehearsal'?{instruments:['all','music'].includes(value),mirror:['all','dance'].includes(value),mode:value}:{[option.field]:value};
 if(picked.style!=='original')result.style=picked.style;
 return result;
}
