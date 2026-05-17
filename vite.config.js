import { defineConfig } from "vite";

// Electron loads index.html via file:// — relative paths are required.
// "./" makes Vite emit href="./assets/..." instead of "/assets/...".
export default defineConfig({
  base: "./",
  build: {
    // Cap chunk-size warning a bit higher than default — the React monolith
    // is intentionally one bundle and we're not code-splitting.
    chunkSizeWarningLimit: 1200,
    // Plain index.html in dist/, no relative font breakage from sub-paths.
    assetsDir: "assets",
    emptyOutDir: true,
  },
  server: {
    strictPort: true,
    port: 5173,
  },
});
