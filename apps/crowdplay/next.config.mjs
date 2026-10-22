/** @type {import('next').NextConfig} */
const nextConfig = {
  // One address for everyone: the old crowdplay-psi link goes to the same
  // page on slimpse.vercel.app.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "crowdplay-psi.vercel.app" }],
        destination: "https://slimpse.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
