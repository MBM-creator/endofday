import type { MetadataRoute } from "next";

// TODO: Replace placeholder icons with real Made By Mobbs logo.
// Paths: public/icons/icon-192.png (192×192), public/icons/icon-512.png (512×512).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daily Site Report",
    short_name: "Daily Site Report",
    description: "Daily site report submission",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#0F172A",
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
