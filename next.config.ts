import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Páginas que se unieron a otras: los enlaces viejos siguen funcionando.
  async redirects() {
    return [
      { source: "/contabilidad/revision", destination: "/contabilidad/documentos?vista=revisar", permanent: false },
      { source: "/contabilidad/configuracion", destination: "/configuracion", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
