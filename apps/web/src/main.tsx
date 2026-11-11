import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { InternalRoot } from "./internal/InternalRoot.tsx";
import { syntheticAllowed } from "./internal/config.ts";
import { PathwaysPage } from "./pages/PathwaysPage.tsx";
import { ExperiencePage } from "./pages/ExperiencePage.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const renderer = createRoot(root);
const path = location.pathname;
if (path === "/internal" || path === "/internal/") {
  if (import.meta.env.DEV && syntheticAllowed(import.meta.env.DEV, import.meta.env.VITE_COMMUNITY_SYNTHETIC_UAT, location.hostname)) {
    void import("./internal/synthetic.tsx").then(({ SyntheticRoot }) => renderer.render(<SyntheticRoot />));
  } else {
    renderer.render(<InternalRoot />);
  }
} else if (path === "/pathways" || path === "/pathways/") {
  renderer.render(<PathwaysPage />);
} else if (path === "/experience" || path === "/experience/") {
  renderer.render(<ExperiencePage />);
} else {
  renderer.render(<App />);
}
