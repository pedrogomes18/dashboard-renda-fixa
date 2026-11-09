import type { NextConfig } from "next";

// NEXT_PUBLIC_API_URL é embutida no JavaScript na hora do build. Na Vercel, sem ela,
// o site publicado tentaria falar com localhost: melhor o build falhar com uma mensagem clara.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "Defina NEXT_PUBLIC_API_URL (URL da API no Render) em Settings > Environment Variables na Vercel e faça o redeploy.",
  );
}

const nextConfig: NextConfig = {
  // Gera um servidor enxuto em .next/standalone, usado pela imagem Docker.
  output: "standalone",
  cacheComponents: true,
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
