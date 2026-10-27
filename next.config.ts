import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites() {
    return [
      { source: "/index.html", destination: "/" },
      ...["about", "membership", "gallery", "press", "startup", "contact"].map(
        (page) => ({ source: `/${page}`, destination: `/${page}.html` }),
      ),
    ];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
      },
    },
  },
};

export default nextConfig;
