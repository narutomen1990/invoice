import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // produce a slim standalone build for Docker
  output: "standalone",
  experimental: {
    serverActions: {
      // up to 100mb so /backup can accept the FoxPro Invoice.DBF
      // (~40 mb today, grows over time)
      bodySizeLimit: "100mb",
    },
  },
  serverExternalPackages: ["@react-pdf/renderer", "puppeteer", "dbffile"],
};

export default nextConfig;
