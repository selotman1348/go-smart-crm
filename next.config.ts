import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // The dashboard is the home page (BP-01); the proxy sends signed-out
    // users on to the login page.
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
