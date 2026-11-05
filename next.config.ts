import type { NextConfig } from "next";

/**
 * Hostinger Node.js runs `next build` and `next start`. This app is a server
 * runtime because sessions, server actions, and admin APIs cannot be a static
 * export.
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
