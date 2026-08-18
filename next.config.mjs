/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // ci runs `pnpm lint` and `pnpm typecheck` as their own steps, so letting the
  // build repeat them costs time and reports nothing new. `pnpm build` alone
  // does not typecheck.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig
