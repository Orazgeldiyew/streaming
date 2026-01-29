// import { defineConfig } from "vite";

// export default defineConfig({
//   root: ".",                  // запускаем из корня проекта
//   server: {
//     port: 5173,
//     strictPort: true,
//     proxy: {
//       "/api":"http://localhost:3010",
//       "/public":"http://localhost:3010",
//     }
//   }
// });
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// ✅ ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, "web"),
  build: {
    outDir: path.resolve(__dirname, "web/dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
