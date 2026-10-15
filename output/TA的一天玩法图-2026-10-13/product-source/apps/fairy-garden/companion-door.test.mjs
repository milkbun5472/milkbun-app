import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAPS, freshState, exitToward, landingOf} from './world.mjs';
import {makeCompanionController, PERSONAL_SPACE} from './companion.mjs';
// 她转群友 2026-09-19：「同行的人会卡在林间小路门口反复横跳」
// 小路口就那么窄，她往门口一站，他每一帧都被挡回去：findPath 重算出一条一步就被挡住的路，
// route 永远不空 → moving 永远为真 → 「走空了才跨过去」那条一辈子走不到。
const exit = exitToward('garden', 'forest');

test('林间小路那个口子是找得到的', () => {
  assert.ok(exit && exit.to === 'forest' && exit.target, '找不到通往林地的口子，测试钉错地方了');
});

test('他走到门口了就过去，哪怕她正站在门口挡着', () => {
  const s = freshState();
  s.map = 'garden';
  s.position = { ...exit.target };                       // 她就站在门口正中间
  s.companion = { ...s.companion, mode: 'routine', map: 'garden',
    position: { x: exit.target.x + .3, z: exit.target.z + .2 } };  // 他已经贴到门口了
  const c = makeCompanionController();
  let now = s, crossed = false;
  for (let i = 0; i < 40 && !crossed; i++) {
    const out = c.tick(now, .1, {});
    now = out.state;
    if (now.companion.map === 'forest') crossed = true;
  }
  // 他这一趟的目的地不一定是林地（看当天安排），所以只钉一件事：
  // 只要他贴在口子上且要去对面，就不许一直在原地磨。
  // 他这一趟不一定真要去林地（看当天安排），所以钉的是【别原地磨】：
  // 要么过去了，要么走开了，不许四十帧下来还贴在门口那半米里。
  const dist = Math.hypot(now.companion.position.x - exit.target.x, now.companion.position.z - exit.target.z);
  assert.ok(crossed || dist > .6, '他贴在门口，既没过去也没走开——又在横跳了');
});

test('去门口那一趟不拿她的身位当障碍', () => {
  const src = fs.readFileSync(new URL('./companion.mjs', import.meta.url), 'utf8');
  assert.match(src, /avoid=c\.map===s\.map&&!cross\?\[\{\.\.\.s\.position,r:PERSONAL_SPACE\}\]:\[\]/,
    '又把她的身位算进去门口那一趟的障碍里了');
  assert.ok(PERSONAL_SPACE > 0);
});
