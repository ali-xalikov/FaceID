import FaceHome from "@/components/FaceHome";
import SkinsApp from "@/components/SkinsApp";

// APK yig'ishda NEXT_PUBLIC_APP_MODE=skins: ilova bosh sahifada (/) ochiladi.
export default function Page() {
  return process.env.NEXT_PUBLIC_APP_MODE === "skins" ? <SkinsApp /> : <FaceHome />;
}
