const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
test('陪伴戳一戳说一句：默认关、走 runProbe voice、连戳合并且有冷却',()=>{const s=fs.readFileSync('js/companion.js','utf8'),pet=fs.readFileSync('apps/companion/pet.mjs','utf8'),app=fs.readFileSync('js/app.js','utf8');
 assert.match(s,/usePokeTalk\(char, props, !!cfg\.pokeTalk\)/);assert.match(s,/runProbe\(p, ctx, \{ voice: true/);assert.match(s,/Date\.now\(\) - s\.last < 15000/);assert.match(s,/setTimeout\(fire, 1200\)/);
 assert.match(pet,/type:'pet-poke'/);assert.match(app,/CompanionFloat, \{[^}]*ctxFor: ctxFor/);});
