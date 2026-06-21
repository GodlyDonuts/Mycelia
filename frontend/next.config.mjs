/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // PGlite ships a WASM + data file that must load from node_modules at runtime;
  // keep it external so Next's server bundler doesn't try to inline the .wasm.
  serverExternalPackages: ["@electric-sql/pglite"],
}

export default nextConfig
