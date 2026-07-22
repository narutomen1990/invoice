import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ระบบใบกำกับภาษี — VM Camera Pro",
    short_name: "ใบกำกับภาษี",
    description: "ระบบออกใบกำกับภาษี / ใบเสนอราคา / ใบวางบิล",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
