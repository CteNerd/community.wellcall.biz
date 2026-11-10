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
          .replace("</head>", `  <link rel="canonical" href="${presentation.origin}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CUT BLOCK" />
    <meta property="og:title" content="CUT BLOCK — Build. Learn. Grow." />
    <meta property="og:description" content="Come Up Through Building, Learning, Opportunity &amp; Competition. Explore CUT BLOCK’s direction in learning and mentorship. Enrollment is closed." />
    <meta property="og:url" content="${presentation.origin}/" />
    <meta property="og:image" content="${presentation.origin}/assets/cut-block-social-7286a063c885.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="CUT BLOCK. Build. Learn. Grow. An illustration of two adults learning together through a hands-on technology project." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="CUT BLOCK — Build. Learn. Grow." />
    <meta name="twitter:description" content="Come Up Through Building, Learning, Opportunity &amp; Competition. Explore CUT BLOCK’s direction in learning and mentorship. Enrollment is closed." />
    <meta name="twitter:image" content="${presentation.origin}/assets/cut-block-social-7286a063c885.jpg" />
    <meta name="twitter:image:alt" content="CUT BLOCK. Build. Learn. Grow. An illustration of two adults learning together through a hands-on technology project." />
  </head>`);
      },
    }],
    server: { host: "127.0.0.1" },
    build: { sourcemap: false },
    test: { environment: "jsdom", include: ["src/**/*.test.tsx"] },
  };
});
