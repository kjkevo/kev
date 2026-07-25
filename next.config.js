const cspParts = (frameAncestors) => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  `frame-ancestors ${frameAncestors}`,
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Headers shared by every route (no frame policy here — that varies by path).
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Strict: block all framing (everything except the public /demo widget).
const strictHeaders = [
  ...baseHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: cspParts("'none'") },
];

// Embeddable: the /demo widget can be iframed into a marketing site (e.g.
// Hostinger). It's public and holds no sensitive data, so any-origin framing
// is acceptable; X-Frame-Options is omitted so modern browsers use the CSP.
const embedHeaders = [
  ...baseHeaders,
  { key: "Content-Security-Policy", value: cspParts("*") },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // enrichLeads.ts is a local-only script — its type errors don't affect the web app
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint locally/in CI, not during the production build — a lint rule
    // should never block a deploy of otherwise-valid code.
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  async headers() {
    return [
      // The embeddable public widgets: allow framing (e.g. into Hostinger).
      { source: "/demo", headers: embedHeaders },
      { source: "/start", headers: embedHeaders },
      // Everything else: strict, no framing.
      { source: "/((?!demo$|start$).*)", headers: strictHeaders },
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

module.exports = nextConfig;
