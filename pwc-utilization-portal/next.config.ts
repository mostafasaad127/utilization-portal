import type { NextConfig } from "next";

/**
 * Rendering model: every page is rendered per request. The portal serves
 * sensitive staffing data behind SSO and uses a nonce-based Content Security
 * Policy (see src/proxy.ts), which requires dynamic rendering, so Cache
 * Components / static shells are intentionally not enabled.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" }, // internal tool: never index
];

const nextConfig: NextConfig = {
  output: "standalone", // minimal server bundle for the container image
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    authInterrupts: true, // enables forbidden() / unauthorized()
    serverActions: {
      bodySizeLimit: "11mb", // spreadsheet import (10 MB file cap + multipart overhead)
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
