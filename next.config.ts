import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  // Shareable mixer links (/mix/<hex>) all render the single /mix page. In
  // production public/_redirects does this rewrite at the edge; rewrites aren't
  // allowed with `output: "export"`, so the dev server gets its own copy.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      trailingSlash: true,
      async rewrites() {
        return [{ source: "/mix/:hex/", destination: "/mix/" }];
      },
    };
  }

  return {
    // Fully static app (localStorage-backed, no server routes), exported to
    // ./out and served as Cloudflare Workers static assets — see wrangler.jsonc.
    output: "export",
    trailingSlash: true,
  };
}
