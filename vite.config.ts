import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const secureTauriPath = fileURLToPath(new URL("./src/lib/secureTauri.ts", import.meta.url));

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@tauri-apps/plugin-dialog": secureTauriPath,
      "@tauri-apps/plugin-fs": secureTauriPath,
    },
  },
  clearScreen: false,
  server: {
    port: 1440,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1441,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/ag-psd")) return "ag-psd";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
    target: "es2021",
    chunkSizeWarningLimit: 600,
  },
}));
