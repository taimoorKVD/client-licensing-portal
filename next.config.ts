import type { NextConfig } from "next";

/**
 * Hostinger Node.js runs `next build` and `next start`.
 * Keep the default server output. A static export has no sessions and no auth.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/app/login",
        permanent: false,
      },
      {
        source: "/login/:path*",
        destination: "/app/login/:path*",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
