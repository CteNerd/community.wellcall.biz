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
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Potential shouldn't depend on who you know.");
  expect(screen.getByText(brand.meaning)).toBeDefined();
  expect(document.body.textContent).not.toMatch(/preview|provisional|noindex/i);
  expect(screen.getByText(/Enrollment is not open/)).toBeDefined();
  expect(screen.getByText(/no active athletics, fitness, facility, or training service/i)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(document.body.textContent).toMatch(/no claim here about legal structure/);
  expect(screen.getByRole("link", { name: "281-692-7522" }).getAttribute("href")).toBe("tel:+12816927522");
});

test("the approved meaning and provisional brand are prominent", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Potential shouldn't depend on who you know.");
  expect(screen.getByText(brand.meaning)).toBeDefined();
  expect(screen.getAllByRole("link", { name: /CUT BLOCK home/i })).toHaveLength(2);
  expect(screen.getAllByText(/provisional working brand/i).length).toBeGreaterThan(0);
  expect(document.body.textContent).toContain("From the codebase to the field.");
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
  expect(screen.getByRole("heading", { name: "I want to grow." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "I want to give back." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Build skills through practice." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Support learning with boundaries." })).toBeDefined();
  expect(screen.queryByRole("heading", { name: /Athletics \+ fitness/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Explore the learner journey" }).getAttribute("href")).toBe("#learner-journey");
  expect(screen.getByRole("link", { name: "Explore the mentor journey" }).getAttribute("href")).toBe("#mentor-journey");
  expect(screen.getByRole("heading", { name: "Where this could grow." })).toBeDefined();
});

test("the proposed pilot experience and future readiness boundaries are explained", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Learn by making. Grow with guidance." })).toBeDefined();
  for (const step of ["Discover", "Connect", "Build", "Grow"]) {
    expect(screen.getByRole("heading", { name: step })).toBeDefined();
  }
  expect(screen.getByText(/guidance, constructive feedback, accountable boundaries, and project reviews/)).toBeDefined();
  expect(screen.getByText(/after readiness, screening, and operating responsibilities are approved/)).toBeDefined();
  expect(document.body.textContent).not.toMatch(/game plan/i);
  expect(screen.getByText(/not programs available today/i)).toBeDefined();
  expect(screen.getByText(/Enrollment is not open/)).toBeDefined();
  expect(screen.getByText(/Youth participation before safeguarding and guardian processes are reviewed/i)).toBeDefined();
  expect(screen.getByText(/no active athletics, fitness, facility, or training service/i)).toBeDefined();
});

test("hero CTAs lead to the proposed experience and readiness without opening enrollment", () => {
  render(<App />);

  expect(screen.getByRole("link", { name: "Explore the proposed experience" }).getAttribute("href")).toBe("#approach");
  expect(screen.getByRole("link", { name: "See pilot readiness" }).getAttribute("href")).toBe("#readiness");
  expect(screen.getByText(/Adult pilot in planning · Applications and mentorship matching are not open/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("link", { name: /apply now|become a mentor|join the program|register/i })).toBeNull();
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
