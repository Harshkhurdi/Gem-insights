import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLLECTION_REGIONS,
  collectionRegion,
  collectionSources,
} from "../apps/api/src/collection/regions";
import { SOURCES } from "../apps/api/src/collection/registry";

const regionalOf = (region: string) =>
  collectionSources(region as any).filter((s) => s.states.length);

test("collectionRegion accepts the seven documented values and rejects others", () => {
  for (const value of COLLECTION_REGIONS)
    assert.equal(collectionRegion(value), value);
  assert.equal(collectionRegion(undefined as any), "all");
  assert.throws(() => collectionRegion("invalid"), /COLLECTION_REGION must be/);
});

test("every region keeps national feeds while selecting only its own states", () => {
  const anchors: Record<string, { include: string[]; exclude: string[] }> = {
    north: {
      include: ["aiims-delhi", "phsc", "aiims-jodhpur", "hmscl"],
      exclude: ["gmscl", "wbmscl", "meghealth", "aiims-bhopal", "jipmer"],
    },
    central: {
      include: ["aiims-bhopal", "cgmscl-equipment", "aiims-raipur"],
      exclude: ["aiims-delhi", "jipmer", "gmscl", "wbmscl"],
    },
    south: {
      include: [
        "aiims-mangalagiri",
        "aiims-bibinagar",
        "jipmer",
        "kmscl",
        "tnmsc-archive-2024",
      ],
      exclude: ["aiims-delhi", "aiims-bhopal", "wbmscl", "meghealth"],
    },
    east: {
      include: ["wbmscl", "aiims-bhubaneswar"],
      exclude: ["aiims-bhopal", "gmscl", "jipmer", "aiims-delhi"],
    },
    west: {
      include: ["gmscl"],
      exclude: ["aiims-delhi", "wbmscl", "aiims-bhopal", "meghealth"],
    },
    northeast: {
      include: ["meghealth"],
      exclude: ["aiims-delhi", "wbmscl", "gmscl", "jipmer"],
    },
  };
  for (const [region, { include, exclude }] of Object.entries(anchors)) {
    const ids = collectionSources(region as any).map((s) => s.id);
    for (const id of include)
      assert.ok(ids.includes(id), `${region} must include ${id}`);
    for (const id of exclude)
      assert.ok(!ids.includes(id), `${region} must exclude ${id}`);
    // National feeds (no state) stay in every region.
    assert.ok(
      collectionSources(region as any).every(
        (s) => s.states.length || s.adapter,
      ),
    );
  }
});

test("regional ordering puts the region's own profiles ahead of national feeds", () => {
  const south = collectionSources("south");
  const firstNationalIndex = south.findIndex((s) => !s.states.length);
  assert.ok(firstNationalIndex > 0);
  assert.ok(
    south.slice(firstNationalIndex).every((s) => !s.states.length),
    "national feeds must sort after regional profiles",
  );
  // CPPP mirrors sort last among the national feeds.
  const national = south.slice(firstNationalIndex);
  const cpppIndex = national.findIndex((s) => s.adapter === "cppp");
  assert.ok(cpppIndex < 0 || cpppIndex >= national.length - 2);
});

test("regional selection covers every automated profile exactly once across regions", () => {
  const total = new Set<string>();
  for (const region of Object.keys(COLLECTION_REGIONS).filter(
    (r) => r !== "all",
  ))
    for (const s of regionalOf(region)) total.add(s.id);
  const allRegional = SOURCES.filter((s) => s.adapter && s.states.length).map(
    (s) => s.id,
  );
  assert.deepEqual([...total].sort(), [...new Set(allRegional)].sort());
});

test("region counts match the validated registry state", () => {
  assert.equal(collectionSources("all").length, 66);
  assert.equal(regionalOf("north").length, 45);
  assert.equal(regionalOf("central").length, 4);
  assert.equal(regionalOf("south").length, 8);
  assert.equal(regionalOf("east").length, 3);
  assert.equal(regionalOf("west").length, 1);
  assert.equal(regionalOf("northeast").length, 1);
});
