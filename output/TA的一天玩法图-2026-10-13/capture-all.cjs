const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const phase of [1,2,3,4]){
  console.log('FINAL CAPTURE PHASE',phase);
  const result=spawnSync(process.execPath,[path.join(__dirname,'capture.cjs'),String(phase)],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS ALL FOUR NATIVE CAPTURE PHASES');
