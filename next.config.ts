import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const paths = ["/forgot-password", "/reset-password", "/admin/forgot-password", "/admin/reset-password", "/account/security", "/admin/security", "/verify-email/:path*", "/api/auth/:path*"];
    return paths.map(source => ({ source, headers: [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }));
  },
};

export default nextConfig;
