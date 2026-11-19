/** Rasm faylini kichraytirib JPEG base64 qiladi (AI'ga yuborish uchun). */
export async function prepareImage(file: File): Promise<{ data: string; type: string; bmp: ImageBitmap }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return { data: c.toDataURL("image/jpeg", 0.8).split(",")[1], type: "image/jpeg", bmp };
}

/** Skrinshotdan katakni qirqib, kichik (80x80) rasm qaytaradi. Box yo'q/noto'g'ri bo'lsa "" . */
export function cropThumb(bmp: ImageBitmap, box?: number[]): string {
  if (!box || box.length !== 4 || box.some((n) => typeof n !== "number" || !isFinite(n))) return "";
  const [bx, by, bw, bh] = box;
  const x = Math.max(0, bx) * bmp.width;
  const y = Math.max(0, by) * bmp.height;
  const w = Math.min(bw, 1 - Math.max(0, bx)) * bmp.width;
  const h = Math.min(bh, 1 - Math.max(0, by)) * bmp.height;
  if (w < 8 || h < 8) return "";
  const S = 80;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#18181b";
  g.fillRect(0, 0, S, S);
  const k = Math.min(S / w, S / h); // sig'dirish (contain)
  g.drawImage(bmp, x, y, w, h, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
  return c.toDataURL("image/jpeg", 0.6);
}

/** Galereyadan tanlangan rasmni kichik (80x80) rasmga aylantiradi. */
export async function fileThumb(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  return cropThumb(bmp, [0, 0, 1, 1]);
}
