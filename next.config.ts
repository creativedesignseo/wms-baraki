import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A stray package-lock.json exists in the user's home dir, so Next would
  // otherwise infer the wrong workspace root. Pin Turbopack to this project.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
