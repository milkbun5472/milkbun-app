export const PROFESSIONAL_OPTIONS={
 dayLaboratory:{label:'研究器材',field:'equipment',values:{general:'通用实验',microscope:'显微观察',chemistry:'化学样品',none:'只留台面'}},
 dayStudio:{label:'创作材料',field:'materials',values:{paint:'颜料画笔',fabric:'布料缝制',craft:'手作工具',none:'空工作台'}},
 dayClinic:{label:'诊室器材',field:'equipment',values:{general:'常用器材',none:'只留家具'}},
 dayRehearsal:{label:'排练摆件',field:'mode',values:{all:'乐器与镜墙',music:'只留乐器',dance:'只留镜墙',empty:'开阔排练地面'}}
};
export function professionalOptions(raw={},id){const option=PROFESSIONAL_OPTIONS[id],value=raw[id]?.[option?.field];
 const picked=option&&Object.hasOwn(option.values,value)?value:Object.keys(option?.values||{})[0];
 if(id==='dayRehearsal')return {instruments:['all','music'].includes(picked),mirror:['all','dance'].includes(picked),mode:picked};
 return option?{[option.field]:picked}:{};
}
