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
    // middleware.ts runs on almost every path (see config.matcher below),
    // and Next.js separately buffers the request body for middleware with
    // its own 10mb default — independent of serverActions.bodySizeLimit
    // above. Without raising this too, large uploads (e.g. the FoxPro
    // Invoice.DBF import on /backup) get silently truncated by middleware
    // before the server action ever sees them, causing a multipart parse
    // error ("Unexpected end of form").
    middlewareClientMaxBodySize: "100mb",
  },
  serverExternalPackages: ["@react-pdf/renderer", "puppeteer", "dbffile"],
};

export default nextConfig;
