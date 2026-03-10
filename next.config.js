/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // We handle type errors manually - don't fail build on type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
