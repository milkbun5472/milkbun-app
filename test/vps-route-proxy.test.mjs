import test from "node:test";
import assert from "node:assert/strict";
import { slimRoute } from "../tools/vps/route-proxy.mjs";

test("route proxy 丢掉 step geometry，只保留手机导航字段", () => {
  const result = slimRoute({ routes: [{ distance: 1234, duration: 321, geometry: { coordinates: [[1, 2], [3, 4]] }, legs: [{ steps: [{
    name: "Main Street", distance: 120, duration: 20,
    geometry: "这坨必须消失", intersections: new Array(100).fill({ noisy: true }),
    maneuver: { type: "turn", modifier: "left", location: [1.5, 2.5] }
  }] }] }] });
  assert.deepEqual(result.geometry, [[1, 2], [3, 4]]);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].name, "Main Street");
  assert.equal(result.steps[0].maneuver.modifier, "left");
  assert.equal("geometry" in result.steps[0], false);
  assert.equal("intersections" in result.steps[0], false);
  assert.ok(JSON.stringify(result).length < 500);
});
