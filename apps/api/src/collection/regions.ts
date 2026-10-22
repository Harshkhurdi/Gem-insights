import { SOURCES } from "./registry";
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
export function collectionRegion(
  value = process.env.COLLECTION_REGION || "all",
): "all" | "north" {
  if (value !== "all" && value !== "north")
    throw new Error("COLLECTION_REGION must be all or north");
  return value;
}
export function collectionSources(region = collectionRegion()) {
  return SOURCES.filter(
    (s) =>
      s.adapter &&
      (region === "all" ||
        !s.states.length ||
        s.states.some((state) => NORTH_STATES.some((n) => n === state))),
  ).sort(
    (a, b) =>
      (region === "north"
        ? Number(!a.states.length) - Number(!b.states.length)
        : 0) || Number(a.adapter === "cppp") - Number(b.adapter === "cppp"),
  );
}
