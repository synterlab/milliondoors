import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isVercelBuild = process.env.VERCEL === "1";

let port = 3000;
let basePath = "/";

if (!isVercelBuild) {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  if (!process.env.BASE_PATH) {
    throw new Error(
      "BASE_PATH environment variable is required but was not provided.",
    );
  }
  basePath = process.env.BASE_PATH;
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
