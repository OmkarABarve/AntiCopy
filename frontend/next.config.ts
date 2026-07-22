import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so unrelated lockfiles elsewhere on the
  // machine don't confuse Turbopack's root inference.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
