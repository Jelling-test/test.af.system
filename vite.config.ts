import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dotenv from "dotenv";
import { Buffer } from "node:buffer";

// Load env early so process.env is populated for proxy target
dotenv.config();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/camera-feed": {
        target: process.env.CAMERA_HOST || "http://127.0.0.1",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => "/axis-cgi/mjpg/video.cgi?fps=10&compression=30",
        headers: (() => {
          const user = process.env.CAMERA_USER || "";
          const pass = process.env.CAMERA_PASS || "";
          if (!user || !pass) return {} as Record<string, string>;
          const token = Buffer.from(`${user}:${pass}`).toString("base64");
          return { Authorization: `Basic ${token}` } as Record<string, string>;
        })(),
      },
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
