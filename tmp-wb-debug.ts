import { load } from "cheerio";
import { readFileSync } from "node:fs";
const $ = load(readFileSync("/tmp/wbmsc-t.html", encoding="utf-8", errors="replace").readFileSync ? "" : require("node:fs").readFileSync("/tmp/wbmsc-t.html"));
