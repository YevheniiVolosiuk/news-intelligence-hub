/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a tiny prod image.
  output: 'standalone',
  reactStrictMode: true,
  // Linting is a separate step (`npm run lint` via gts), not part of the image build.
  eslint: {ignoreDuringBuilds: true},
};

module.exports = nextConfig;
