import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App } from "./App.tsx";
import { brand } from "./branding.ts";
import { readPresentation } from "./presentation.ts";

afterEach(cleanup);

test("public production requires explicit approval, carries real branding and keeps all intake closed", () => {
  expect(readPresentation({ PROD: true }).production).toBe(false);
  expect(() => readPresentation({ VITE_COMMUNITY_PRESENTATION: "production" })).toThrow(/approval/);
  expect(() => readPresentation({ VITE_COMMUNITY_PRESENTATION: "other" })).toThrow();
  render(<App presentation={readPresentation({
    VITE_COMMUNITY_PRESENTATION: "production", VITE_COMMUNITY_BRAND_LAUNCH_APPROVED: "true",
  })} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CUT BLOCK");
  expect(screen.getByText(brand.meaning)).toBeDefined();
  expect(document.body.textContent).not.toMatch(/preview|provisional|noindex/i);
  expect(screen.getByText(/Enrollment is not open/)).toBeDefined();
  expect(screen.getByText(/no active athletics, fitness, facility, or training service/i)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(document.body.textContent).toMatch(/no claim here about legal structure/);
});

test("the approved meaning and provisional brand are prominent", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(brand.meaning);
  expect(screen.getAllByRole("link", { name: /CUT BLOCK home/i })).toHaveLength(2);
  expect(screen.getByText(/provisional brand/i)).toBeDefined();
  expect(document.body.textContent).toContain(brand.tagline);
});

test("navigation links to the complete story, program, readiness, and FAQ sections", () => {
  render(<App />);

  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const navigationTargets = within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href")?.slice(1));

  expect(navigationTargets).toEqual(["story", "pathways", "approach", "readiness", "faq"]);
  for (const id of navigationTargets) {
    expect(document.getElementById(id ?? "")).not.toBeNull();
  }
  expect(screen.getByRole("heading", { name: /Technology \+ AI/ })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Mentorship" })).toBeDefined();
  expect(screen.getByRole("heading", { name: /Athletics \+ fitness/ })).toBeDefined();
  expect(screen.getAllByText(/^(planned adult pathway|future concept)$/i)).toHaveLength(3);
});

test("the guided-practice model and future readiness boundaries are explained", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Start with a challenge" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Make a game plan" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Practice, then get feedback" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Reflect and build forward" })).toBeDefined();
  expect(screen.getByText(/Enrollment is not open/)).toBeDefined();
  expect(screen.getByText(/Youth participation before safeguarding and guardian processes are reviewed/i)).toBeDefined();
  expect(screen.getByText(/no active athletics, fitness, facility, or training service/i)).toBeDefined();
});

test("FAQ content is meaningful and no application, contact, or enrollment flow is exposed", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Before you ask." })).toBeDefined();
  expect(screen.getAllByText(/Can I apply, enroll, or book a mentor now\?/)).toHaveLength(1);
  expect(screen.getByText(/Is CUT BLOCK a nonprofit or a registered organization\?/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  expect(document.querySelectorAll('a[href^="http"]').length).toBe(0);
});
