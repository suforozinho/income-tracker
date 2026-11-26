import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  // @react-pdf/renderer ships its own font and layout engines; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF route reads its font files from disk at runtime.
  outputFileTracingIncludes: {
    "/invoices/[id]/pdf": ["./src/pdf/fonts/**"],
  },
};

export default nextConfig;
