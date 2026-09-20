import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // "How it works" is folded into the landing page (design decision, mockups v2).
    return [{ source: "/how-it-works", destination: "/#how-it-works", permanent: false }];
  },
};

export default nextConfig;
