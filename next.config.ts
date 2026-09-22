import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static app (localStorage-backed, no server routes), exported to
  // ./out and served as Cloudflare Workers static assets — see wrangler.jsonc.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
