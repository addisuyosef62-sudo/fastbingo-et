import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Render.com deployment: use Nitro's node-server preset so `bun run build`
// emits a Node-compatible server bundle at dist/server/index.mjs.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
    output: {
      dir: "dist",
      publicDir: "dist/client",
      serverDir: "dist/server",
    },
  },
});
