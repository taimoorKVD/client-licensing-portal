import type { NextConfig } from "next";

/**
 * Hostinger Node.js runs `next build` and `next start`.
 * Keep the default server output. A static export has no sessions and no auth.
 */
const nextConfig: NextConfig = {
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
