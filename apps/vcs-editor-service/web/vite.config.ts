import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The editor SPA. In dev it proxies the render API + media to the express
// service on :3000, so the whole app runs from `pnpm --filter vcs-editor-service
// web:dev` alongside `... dev`.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      "/v1": "http://localhost:3000",
      "/media": "http://localhost:3000",
    },
  },
  build: { outDir: "dist" },
});
