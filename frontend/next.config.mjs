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
  // pg + the DSQL signer are Node libraries (sockets, crypto) that must not be
  // bundled into the server build either.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@aws-sdk/dsql-signer"],
}

export default nextConfig
