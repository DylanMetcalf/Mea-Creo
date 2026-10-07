import type { MetadataRoute } from "next";

/** Installable app (PWA): opens the client portal, or the workspace for the team. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mea Creo",
    short_name: "Mea Creo",
    description: "Your Mea Creo workspace and client portal.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    background_color: "#07110d",
    theme_color: "#07110d",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Client portal", url: "/portal" },
      { name: "Workspace", url: "/workspace" },
    ],
  };
}
