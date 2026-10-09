/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      // Lint runs via `npm run lint` (eslint CLI); next lint is broken/deprecated
      ignoreDuringBuilds: true,
    },
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "randomuser.me",
        },
        {
          protocol: "https",
          hostname: "lh3.googleusercontent.com",
        },
      ],
    },
  
    experimental: {
      serverActions: {
        bodySizeLimit: "5mb",
      },
    },
  };
  
  export default nextConfig;