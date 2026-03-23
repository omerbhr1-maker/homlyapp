import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Tree-shake large packages — only import what's actually used.
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/modifiers",
      "@dnd-kit/utilities",
    ],
  },
};

export default nextConfig;
