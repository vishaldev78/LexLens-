import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },

  // updated to use the new Next.js 14 app directory


  reactStrictMode: false,
  // Keep PDF libraries out of the bundler: pdfkit resolves its .afm font data
  // relative to its own module directory and pdf-parse references a test file,
  // so both must load from node_modules as normal Node packages.
  serverExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
