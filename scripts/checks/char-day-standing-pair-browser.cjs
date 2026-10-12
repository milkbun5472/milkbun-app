// Shared real-rig audit, from different current standing positions near actual home walls.
process.env.DAY_ANCHOR='1';
process.env.DAY_KINDS||='hand,hug,pat,kiss,kiss-cheek,kiss-forehead,forehead,back-hug';
process.env.DAY_ORIGINS||=JSON.stringify([{a:{x:6.7,z:3.3},b:{x:0,z:4.8}},{a:{x:-6.7,z:3.3},b:{x:0,z:4.8}}]);
require('./char-day-pair-audit-browser.cjs');
