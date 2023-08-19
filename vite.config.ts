import preact from "@preact/preset-vite"
import { resolve } from "path"
import { defineConfig } from "vite"
import logseqPlugin from "vite-plugin-logseq"

const PORT = 3003

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      strictPort: true,
      port: PORT,
    },
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          plugin: resolve(__dirname, "index.html"),
        },
        output: {
          entryFileNames: "[name]-[hash].js",
          assetFileNames: "[name][extname]",
        },
      },
    },
    plugins: [preact(), logseqPlugin()],
  }
})
