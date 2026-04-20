import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bind to 0.0.0.0 in prod via the start script; app.hee.la → Caddy →
  // localhost:3000 (added to the server Caddyfile once the portal is deployed).
  poweredByHeader: false,
  // Output a standalone build so the Docker image is ~10× smaller.
  output: "standalone",
};

export default nextConfig;
