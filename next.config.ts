import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,
  // Keep PDF libraries out of the bundler: pdfkit resolves its .afm font data
  // relative to its own module directory and pdf-parse references a test file,
  // so both must load from node_modules as normal Node packages.
  serverExternalPackages: ["pdfkit", "pdf-parse"],
};

export default nextConfig;
