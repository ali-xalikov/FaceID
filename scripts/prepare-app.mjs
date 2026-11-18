// out/ -> www/ ; Android "_" bilan boshlanadigan papkalarni tashlab yuboradi,
// shuning uchun _next -> nextassets deb qayta nomlanadi. Ilova bosh sahifada (/) ochiladi.
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
