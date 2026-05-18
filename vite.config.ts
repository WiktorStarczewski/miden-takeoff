import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { midenVitePlugin } from "@miden-sdk/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), midenVitePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
