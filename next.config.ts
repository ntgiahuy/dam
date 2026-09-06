import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    resolveAlias: {
      "@node-projects/acad-ts": "./node_modules/@node-projects/acad-ts/dist/index-min.js",
    },
  },
};

export default nextConfig;
