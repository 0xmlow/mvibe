import { defineConfig } from "vite";
// base "./" so the built page works when opened as a file:// URL by the render
// harness. With the default "/" the script tag resolves to the filesystem root.
export default defineConfig({
  base: "./",
  build: { outDir: "plate-dist", emptyOutDir: true, rollupOptions: { input: "plate.html" }, assetsInlineLimit: 0 },
});
