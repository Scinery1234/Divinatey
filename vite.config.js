import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Own (empty) PostCSS setup, so a parent folder's config (e.g. Tailwind) isn't picked up.
  css: { postcss: { plugins: [] } },
  server: { proxy: { "/api": "http://localhost:" + (process.env.PORT || 8787) } },
});
