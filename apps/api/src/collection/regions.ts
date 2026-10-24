import { SOURCES, getSource } from "./registry";
export const NORTH_STATES = [
  "Delhi",
  "Punjab",
  "Haryana",
  "Chandigarh",
  "Himachal Pradesh",
  "Uttarakhand",
  "Uttar Pradesh",
  "Rajasthan",
  "Jammu and Kashmir",
  "Ladakh",
] as const;
export const CENTRAL_STATES = ["Madhya Pradesh", "Chhattisgarh"] as const;
export const SOUTH_STATES = [
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Andhra Pradesh",
  "Telangana",
  "Puducherry",
] as const;
export const EAST_STATES = [
  "West Bengal",
  "Bihar",
  "Jharkhand",
  "Odisha",
] as const;
export const WEST_STATES = [
  "Maharashtra",
  "Gujarat",
  "Goa",
  "Dadra and Nagar Haveli and Daman and Diu",
] as const;
export const NORTHEAST_STATES = [
  "Assam",
  "Arunachal Pradesh",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
] as const;
export const REGION_STATES = {
  north: NORTH_STATES,
  central: CENTRAL_STATES,
  south: SOUTH_STATES,
  east: EAST_STATES,
  west: WEST_STATES,
  northeast: NORTHEAST_STATES,
} as const;
export type CollectionRegion = "all" | keyof typeof REGION_STATES;
export const COLLECTION_REGIONS = [
  "all",
  ...Object.keys(REGION_STATES),
] as const;
export function collectionRegion(
  value = process.env.COLLECTION_REGION || "all",
): CollectionRegion {
  if (!(COLLECTION_REGIONS as readonly string[]).includes(value))
    throw new Error(
      `COLLECTION_REGION must be one of ${COLLECTION_REGIONS.join(", ")}`,
    );
  return value as CollectionRegion;
}
export function collectionSources(region = collectionRegion()) {
  const states = region === "all" ? null : REGION_STATES[region];
  return SOURCES.filter(
    (s) =>
      s.adapter &&
      (!states ||
        !s.states.length ||
        s.states.some((state) =>
          (states as readonly string[]).includes(state),
        )),
  ).sort(
    (a, b) =>
      (region !== "all"
        ? Number(!a.states.length) - Number(!b.states.length)
        : 0) || Number(a.adapter === "cppp") - Number(b.adapter === "cppp"),
  );
}

// CLI/queue target resolution: a region name selects its sources, anything
// else is a single source id, and no argument means the configured region.
export function collectionTargets(id?: string) {
  if (!id) return collectionSources();
  if ((COLLECTION_REGIONS as readonly string[]).includes(id))
    return collectionSources(id as CollectionRegion);
  return [getSource(id)];
}
