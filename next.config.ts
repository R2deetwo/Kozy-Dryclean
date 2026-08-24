import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel doesn't need standalone output (it manages its own runtime).
  // Standalone is only useful for Docker / Node.js server deploys.
  // typescript: {
  //   ignoreBuildErrors: true,  // re-enable when ready to fix type errors
  // },
  reactStrictMode: false,
};

export default nextConfig;
