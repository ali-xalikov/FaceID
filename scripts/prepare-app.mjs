// out/ -> www/ ; ilova ochilganda to'g'ridan-to'g'ri /skins/ sahifasiga o'tadi
import { cpSync, rmSync, writeFileSync } from "node:fs";
rmSync("www", { recursive: true, force: true });
cpSync("out", "www", { recursive: true });
writeFileSync(
  "www/index.html",
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/skins/"><body style="background:#09090b">',
);
