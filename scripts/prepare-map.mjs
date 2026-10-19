import fs from "node:fs/promises";
import { geoArea } from "d3-geo";
const p = "apps/web/public/india-states.geojson";
const j = JSON.parse(await fs.readFile(p, "utf8"));
function dp(points, tol) {
  if (points.length < 5) return points;
  const a = points[0],
    b = points.at(-1);
  let index = 0,
    max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const v = points[i];
    let x = a[0],
      y = a[1],
      dx = b[0] - x,
      dy = b[1] - y;
    if (dx || dy) {
      const t = ((v[0] - x) * dx + (v[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    const d = (v[0] - x) ** 2 + (v[1] - y) ** 2;
    if (d > max) {
      max = d;
      index = i;
    }
  }
  return max > tol * tol
    ? [
        ...dp(points.slice(0, index + 1), tol).slice(0, -1),
        ...dp(points.slice(index), tol),
      ]
    : [a, b];
}
const special = {
  "JAMMU & KASHMIR": "Jammu and Kashmir",
  "DADRA,NAGAR HAVELI,DAMAN & DIU": "Dadra and Nagar Haveli and Daman and Diu",
  "ANDAMAN & NICOBAR": "Andaman and Nicobar Islands",
};
for (const f of j.features) {
  const raw = f.properties.STNAME;
  if (!raw) {
    const polys =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    for (const rings of polys)
      for (let k = 0; k < rings.length; k++) {
        const area = geoArea({ type: "Polygon", coordinates: [rings[k]] });
        if ((k === 0 && area > 2 * Math.PI) || (k > 0 && area < 2 * Math.PI))
          rings[k].reverse();
      }
    continue;
  }
  f.properties = {
    name:
      special[raw] ||
      raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    lgdCode: f.properties.State_LGD,
  };
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const rings of polys)
    for (let i = 0; i < rings.length; i++) {
      const simplified = dp(rings[i], 0.01);
      if (simplified.length >= 4)
        rings[i] = simplified.map((p) =>
          p.map((n) => Math.round(n * 1e5) / 1e5),
        );
    }
  for (const rings of polys)
    for (let k = 0; k < rings.length; k++) {
      const area = geoArea({ type: "Polygon", coordinates: [rings[k]] });
      if ((k === 0 && area > 2 * Math.PI) || (k > 0 && area < 2 * Math.PI))
        rings[k].reverse();
    }
}
j.attribution = {
  source: "LGD state boundaries (2024 snapshot), via bharatlas",
  url: "https://bharatlas.com/view/gb_adm1",
  license: "CC0-1.0 / CC-BY-4.0",
  processing:
    "Douglas-Peucker simplification at 0.01 degrees for dashboard display. Not for surveying.",
};
await fs.writeFile(p, JSON.stringify(j));
console.log(
  "Prepared",
  j.features.length,
  "state features; bytes",
  JSON.stringify(j).length,
);
