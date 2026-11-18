// out/ -> www/ ; Android "_" bilan boshlanadigan papkalarni tashlab yuboradi,
// shuning uchun _next -> nextassets deb qayta nomlanadi. Ilova /skins/ dan boshlanadi.
import { cpSync, rmSync, writeFileSync, renameSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

rmSync("www", { recursive: true, force: true });
cpSync("out", "www", { recursive: true });
renameSync("www/_next", "www/nextassets");

const textExt = /\.(html|js|css|json|txt|map)$/;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (textExt.test(f)) {
      const s = readFileSync(p, "utf8");
      if (s.includes("_next")) writeFileSync(p, s.replaceAll("_next", "nextassets"));
    }
  }
}
walk("www");

writeFileSync(
  "www/index.html",
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/skins/"><body style="background:#09090b">',
);
