import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { geoArea, geoBounds } from "d3-geo";
import { STATES } from "../packages/core/domain";
const j = JSON.parse(
  readFileSync("apps/web/public/india-states.geojson", "utf8"),
);
test("licensed map has all 36 current state identities", () => {
  assert.equal(j.features.length, 36);
  assert.deepEqual(
    j.features.map((f: any) => f.properties.name).sort(),
    [...STATES].sort(),
  );
  assert.ok(j.attribution.license.includes("CC"));
});
test("each state polygon has correct spherical winding and no world-spanning fill", () => {
  for (const f of j.features) {
    assert.ok(geoArea(f) < 0.1, f.properties.name + " winding");
    const b = geoBounds(f);
    assert.ok(
      b[0][0] > 60 && b[1][0] < 100 && b[0][1] > 0 && b[1][1] < 40,
      f.properties.name + " bounds",
    );
  }
});
