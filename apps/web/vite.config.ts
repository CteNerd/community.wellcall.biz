import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: { sourcemap: false },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"] },
});
