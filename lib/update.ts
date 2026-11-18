const REPO = "ali-xalikov/FaceID";

export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export type UpdateInfo = { url: string };

/** GitHub Releases'dagi oxirgi APK bilan solishtiradi. Yangi bo'lsa yuklab olish havolasini qaytaradi. */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  if (BUILD_ID === "dev") return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/latest`);
    if (!res.ok) return null;
    const rel = await res.json();
    const latest = String(rel.body ?? "").trim();
    const asset = (rel.assets ?? []).find((a: { name: string }) => a.name.endsWith(".apk"));
    if (!latest || !asset || latest === BUILD_ID) return null;
    return { url: asset.browser_download_url };
  } catch {
    return null;
  }
}
