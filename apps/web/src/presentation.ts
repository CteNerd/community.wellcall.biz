export function readPresentation(env: Record<string, unknown>) {
  const mode = env.VITE_COMMUNITY_PRESENTATION ?? "preview";
  if (mode !== "preview" && mode !== "production") throw new Error("Unknown community presentation");
  if (mode === "production" && env.VITE_COMMUNITY_BRAND_LAUNCH_APPROVED !== "true") {
    throw new Error("Production presentation requires explicit brand launch approval");
  }
  return { production: mode === "production", origin: mode === "production" ? "https://cutblock.org" : null };
}
