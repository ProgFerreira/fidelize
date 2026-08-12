/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sem standalone: Hostinger usa `next start` e injeta/.env normalmente
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "mariadb",
    "prisma",
    "tsx",
  ],
};

export default nextConfig;
