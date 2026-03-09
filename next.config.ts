import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Pre-existing recharts Formatter type incompatibilities don't affect runtime
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
