import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { readPresentation } from "./src/presentation.ts";

export default defineConfig(({ mode }) => {
  const presentation = readPresentation({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
  plugins: [react(), {
    name: "community-presentation",
    transformIndexHtml(html) {
      if (!presentation.production) return html;
      return html
        .replace('    <meta name="robots" content="noindex, nofollow" />\n', "")
        .replace("CUT BLOCK Development — Preview", "CUT BLOCK — Build. Learn. Grow.")
        .replace("CUT BLOCK Development is a provisional, founder-led community-development concept. Preview only; enrollment is closed.",
          "Come Up Through Building, Learning, Opportunity & Competition. Explore CUT BLOCK’s direction in learning and mentorship. Enrollment is closed.")
        .replace("</head>", `  <link rel="canonical" href="${presentation.origin}/" />\n    <meta property="og:url" content="${presentation.origin}/" />\n  </head>`);
    },
  }],
  server: { host: "127.0.0.1" },
  build: { sourcemap: false },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"] },
}; });
