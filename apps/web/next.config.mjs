/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/engine", "@workspace/ui"],
  devIndicators: false,
}

export default nextConfig
