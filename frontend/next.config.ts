import type { NextConfig } from 'next'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: version,
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${process.env.INTERNAL_API_URL || 'http://localhost:4000'}/api/:path*`,
    },
  ],
}

export default nextConfig
