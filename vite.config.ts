import { defineConfig } from "vite";

export default defineConfig({
  root: ".",                  // запускаем из корня проекта
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api":"http://localhost:3010",
      "/public":"http://localhost:3010",
    }
  }
});
