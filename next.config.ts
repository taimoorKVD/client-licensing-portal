import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Public values baked into a static export. Demo mode does not call Supabase,
 * and blank keys keep a build machine's secrets out of `out/`.
 */
const demoPublicEnv = {
  NEXT_PUBLIC_DATA_SOURCE: "demo",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
} as const;

function forceDemoMode(): void {
  for (const [key, value] of Object.entries(demoPublicEnv)) {
    process.env[key] = value;
  }
  delete process.env.SUPABASE_SECRET_KEY;
}

const nextConfig = (phase: string): NextConfig => {
  const staticExport = phase === PHASE_PRODUCTION_BUILD;

  if (staticExport) {
    // Server Components read process.env while pages are prerendered.
    // The `env` block below is what the client bundle inlines.
    forceDemoMode();
  }

  return {
    ...(staticExport
      ? {
          output: "export",
          // `/licenses/index.html` is what Apache serves for `/licenses/` at
          // the document root. Root-absolute links keep working from any page.
          trailingSlash: true,
          env: { ...demoPublicEnv },
        }
      : {
          cacheComponents: true,
          partialPrefetching: true,
        }),
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
};

export default nextConfig;
