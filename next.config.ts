import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // For images or fetches from external domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "larksome-nell-lustrelessly.ngrok-free.dev",
      },
    ],
  },
  // Optional: if you use rewrites for ngrok OAuth
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `https://larksome-nell-lustrelessly.ngrok-free.dev/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
