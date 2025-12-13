import type { NextConfig } from 'next';

/// @notice Configures Next.js for mobile-first wallet application
const nextConfig: NextConfig = {
  /// @notice Enables React strict mode for better development experience
  reactStrictMode: true,
  /// @notice Enable Turbo Pack for faster builds
  experimental: {
    turbo: {
      resolveAlias: {
        buffer: 'buffer',
      },
    },
  },
  /// @notice Optimize for mobile viewport sizes (6.1-6.9 inches)
  typescript: {
    ignoreBuildErrors: false,
    // Faster type checking
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  /// @notice Optimize webpack for faster builds
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // Optimize for development
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    return config;
  },
  /// @notice Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  /// @notice Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;


