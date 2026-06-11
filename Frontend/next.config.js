/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Force all routes to be dynamic
  },
};

module.exports = nextConfig;