import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { InternalRoot } from "./internal/InternalRoot.tsx";
import { syntheticAllowed } from "./internal/config.ts";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const renderer = createRoot(root);
if (location.pathname === "/internal" || location.pathname === "/internal/") {
  if (import.meta.env.DEV && syntheticAllowed(import.meta.env.DEV, import.meta.env.VITE_COMMUNITY_SYNTHETIC_UAT, location.hostname)) {
    void import("./internal/synthetic.tsx").then(({ SyntheticRoot }) => renderer.render(<SyntheticRoot />));
  } else {
    renderer.render(<InternalRoot />);
  }
} else {
  renderer.render(<App />);
}
