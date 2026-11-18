import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // statik ilova (Capacitor/APK uchun)
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
