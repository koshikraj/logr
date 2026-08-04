import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and pdfjs-dist use a worker that must be resolved by Node.js at
  // runtime — bundling them rewrites internal paths and breaks the worker loader.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async rewrites() {
    return [
      // The llms.txt proposal recommends a clean Markdown counterpart at
      // the human URL plus `.md`. App Router cannot express a partially
      // dynamic segment directly, so keep the public URL via an internal rewrite.
      { source: "/:username.md", destination: "/:username/markdown" },
    ];
  },
  async redirects() {
    return [
      // www serves the full site as 200s (duplicate host in search's eyes) —
      // collapse it onto the canonical apex with a permanent 308.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.logr.it" }],
        destination: "https://logr.it/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
