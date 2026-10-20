import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load the database driver unbundled, so Cloudflare Workers get its Workers build
  // (deploy-cloudflare, episode 009). Harmless on Vercel.
  serverExternalPackages: ["postgres"],
  // Keep this file small. Each skill documents any option it adds here.
};

export default nextConfig;
