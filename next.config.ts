import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------

const CSP = [
  "default-src 'self'",

  // Next.js App Router requires 'unsafe-inline' for its hydration bootstrap
  // scripts and 'unsafe-eval' for dynamic chunk loading in dev.
  // To harden further, generate a per-request nonce in middleware and replace
  // 'unsafe-inline' with 'nonce-{nonce}' once you have a CSP audit in place.
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",

  // Tailwind utilities and Next.js font-face injection are inlined at build time.
  // next/font/google self-hosts Inter from /_next/static/ — no external CDN needed.
  "style-src 'self' 'unsafe-inline'",

  // Fonts are served from /_next/static/ (covered by 'self').
  "font-src 'self'",

  // Allow images from self and data URIs (avatars, favicon, og images).
  "img-src 'self' data: blob:",

  // API calls go only to this origin.
  "connect-src 'self'",

  // No plugins, no iframes, no base-tag hijacking.
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",

  // Upgrade any accidental http:// sub-resource requests to https://.
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Prevent page from being embedded in iframes (belt + suspenders with CSP).
  { key: "X-Frame-Options", value: "DENY" },

  // Block MIME-type sniffing (stops browsers from guessing content types).
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Send the full origin only to same-origin requests; only the origin to HTTPS.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Disable browser APIs this app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },

  // Tell browsers to only access the site over HTTPS for the next 2 years.
  // Remove or shorten max-age while you are still verifying your setup;
  // once stable, submit to https://hstspreload.org.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  { key: "Content-Security-Policy", value: CSP },
];

// ---------------------------------------------------------------------------
// Next.js config
// ---------------------------------------------------------------------------

const nextConfig: NextConfig = {
  // Strip the X-Powered-By header so the tech stack isn't advertised.
  poweredByHeader: false,

  // Surface hydration mismatches in development.
  reactStrictMode: true,

  // Enable gzip / brotli compression on serverless responses.
  compress: true,

  async headers() {
    return [
      {
        // Security headers on every route.
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Next.js content-hashes every file under /_next/static/ at build time,
        // so it is safe to cache them for a full year with immutable.
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes should never be served from a shared cache.
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
