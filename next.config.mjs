/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone reduz o footprint no Node.js Web App da Hostinger
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "mariadb",
  ],
};

export default nextConfig;
