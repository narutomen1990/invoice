import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // produce a slim standalone build for Docker
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["@react-pdf/renderer", "puppeteer"],
};

export default nextConfig;
