import { defineConfig } from "vite";

// Builds the live token renderer. Output is inlined into one HTML file by
// wrapped-mint/build-piece.mjs, so a minted piece is a single document plus its GLB.
export default defineConfig({
  build: {
    outDir: "token-dist",
    emptyOutDir: true,
    rollupOptions: { input: "token.html" },
    assetsInlineLimit: 0,
  },
});
