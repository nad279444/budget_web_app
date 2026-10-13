/** @type {import('next').NextConfig} */
const nextConfig = {
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
        bodySizeLimit: "4mb",
      },
    },
  };
  
  export default nextConfig;