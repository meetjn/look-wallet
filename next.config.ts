import type { NextConfig } from 'next';

/// @notice Configures Next.js for mobile-first wallet application
const nextConfig: NextConfig = {
  /// @notice Enables React strict mode for better development experience
  reactStrictMode: true,
  /// @notice Optimize for mobile viewport sizes (6.1-6.9 inches)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

