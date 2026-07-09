import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img2.finalfantasyxiv.com",
      },
      {
        protocol: "https",
        hostname: "img.finalfantasyxiv.com",
      },
      {
        protocol: "https",
        hostname: "lds-img.finalfantasyxiv.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
