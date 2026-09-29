import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Generates a minimal production bundle
   * that is ideal for Docker/Coolify.
   */
  output: "standalone",

  /*
   * Avoid exposing the framework header.
   */
  poweredByHeader: false,
};

export default nextConfig;