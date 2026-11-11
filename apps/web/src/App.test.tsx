import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App, legacyHashRedirectTarget } from "./App.tsx";
import { brand } from "./branding.ts";
import { readPresentation } from "./presentation.ts";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

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

test("the approved meaning and provisional brand are prominent, and the acronym appears only once", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Potential shouldn't depend on who you know.");
  expect(screen.getAllByText(brand.meaning)).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: /CUT BLOCK home/i })).toHaveLength(2);
  expect(screen.getAllByText(/provisional working brand/i).length).toBeGreaterThan(0);
  expect(document.body.textContent).toContain("From the codebase to the field.");
});

test("navigation mixes home anchors with the pathways/experience pages, and all home anchors resolve", () => {
  render(<App />);

  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const navLinks = within(nav).getAllByRole("link");
  const hrefByLabel = Object.fromEntries(navLinks.map((link) => [link.textContent, link.getAttribute("href")]));

  expect(hrefByLabel).toEqual({
    Mission: "#mission",
    Pathways: "/pathways",
    Experience: "/experience",
    Participate: "#participate",
    Collaborators: "#ecosystem",
    Readiness: "#readiness",
    FAQ: "#faq",
  });
  for (const [label, href] of Object.entries(hrefByLabel)) {
    if (href?.startsWith("#")) expect(document.getElementById(href.slice(1)), label).not.toBeNull();
  }
});

test("legacy anchor #story still resolves on the home page", () => {
  render(<App />);
  expect(document.getElementById("story")).not.toBeNull();
  expect(document.getElementById("mission")).not.toBeNull();
});

test("legacy #approach hash maps to the new /experience page", () => {
  expect(legacyHashRedirectTarget("#approach")).toBe("/experience");
  expect(legacyHashRedirectTarget("#mission")).toBeNull();
  expect(legacyHashRedirectTarget("")).toBeNull();
});

test("mounting the home page with a legacy #approach bookmark redirects instead of scrolling, without throwing", () => {
  window.history.pushState({}, "", "/#approach");
  expect(() => render(<App />)).not.toThrow();
});

test("the mission section tells one human story without restating the acronym as a separate headline elsewhere", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /CUT BLOCK means/ })).toBeDefined();
  expect(screen.getByText(/offensive line and the engineering team/)).toBeDefined();
  expect(screen.queryByRole("heading", { name: /Where this could grow/i })).toBeNull();
  expect(screen.queryByRole("heading", { name: /bigger vision/i })).toBeNull();
});

test("the home pathways teaser summarizes both tracks and links out to the dedicated pages, without duplicating the full capability/field grids", () => {
  render(<App />);

  const pathwaysSection = document.getElementById("pathways") as HTMLElement;
  expect(within(pathwaysSection).getByText("Planned adult pilot")).toBeDefined();
  expect(within(pathwaysSection).getByText("Future pathway")).toBeDefined();
  expect(within(pathwaysSection).getByRole("heading", { name: "In the office" })).toBeDefined();
  expect(within(pathwaysSection).getByRole("heading", { name: "On the field" })).toBeDefined();
  expect(within(pathwaysSection).getByRole("link", { name: /See the full office pathway/ }).getAttribute("href")).toBe("/pathways#office");
  expect(within(pathwaysSection).getByRole("link", { name: /See the full field pathway/ }).getAttribute("href")).toBe("/pathways#field");
  expect(within(pathwaysSection).getByRole("link", { name: /Explore example learning experiences/ }).getAttribute("href")).toBe("/experience");

  // The detailed capability map and field focus cards now live on /pathways, not the home page.
  expect(screen.queryByRole("heading", { name: "Plan and deliver" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Offensive line" })).toBeNull();
  expect(document.getElementById("experience")).toBeNull();
});

test("pathways are not rendered as two audience roles; roles live separately in participate", () => {
  render(<App />);

  const pathwaysSection = document.getElementById("pathways") as HTMLElement;
  expect(within(pathwaysSection).queryByText("I want to grow.")).toBeNull();
  expect(within(pathwaysSection).queryByText("I want to give back.")).toBeNull();

  const participateSection = document.getElementById("participate") as HTMLElement;
  expect(within(participateSection).getByText("I want to grow.")).toBeDefined();
  expect(within(participateSection).getByText("I want to give back.")).toBeDefined();
  expect(document.getElementById("learner-journey")).not.toBeNull();
  expect(document.getElementById("mentor-journey")).not.toBeNull();
});

test("participate explains the proposed experience flow and progress evidence without promising outcomes", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "A proposed participant experience." })).toBeDefined();
  for (const step of ["Discover", "Choose", "Work", "Show", "Reflect"]) {
    expect(screen.getByRole("heading", { name: step })).toBeDefined();
  }
  expect(screen.getByText(/portfolio artifact, a test suite, a deployment/)).toBeDefined();
  expect(screen.getByText(/does not promise internships, jobs, scholarships, roster spots, college recruitment or professional contracts/)).toBeDefined();
});

test("ecosystem names The Lab as a labeled potential collaboration without claiming a formal partnership", () => {
  render(<App />);

  const ecosystemSection = document.getElementById("ecosystem") as HTMLElement;
  expect(screen.getByRole("heading", { name: "Potential collaborators." })).toBeDefined();
  expect(within(ecosystemSection).getByText("Potential collaboration — under discussion")).toBeDefined();
  expect(within(ecosystemSection).getByRole("heading", { name: "The Lab Performance & Strength" })).toBeDefined();
  expect(within(ecosystemSection).getByText(/Pat Robertson, a former Murray State football teammate/)).toBeDefined();
  expect(within(ecosystemSection).getByText(/is not an official CUT BLOCK partner today/)).toBeDefined();
  expect(within(ecosystemSection).getByText(/not CUT BLOCK cohort accomplishments, paid placements/)).toBeDefined();
});

test("hero CTAs lead into the pathways page and participate section without opening enrollment", () => {
  render(<App />);

  expect(screen.getByRole("link", { name: "Explore development pathways" }).getAttribute("href")).toBe("/pathways");
  expect(screen.getByRole("link", { name: "How the pilot may work" }).getAttribute("href")).toBe("#participate");
  expect(screen.getByText(/adult technology pilot planned · applications\s*closed · field training not open/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("link", { name: /apply now|become a mentor|join the program|register/i })).toBeNull();
});

test("FAQ content covers the pathway/role distinction and The Lab, with no application, contact, or enrollment flow exposed", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Before you ask." })).toBeDefined();
  expect(screen.getAllByText(/Can I apply, enroll, or book a mentor now\?/)).toHaveLength(1);
  expect(screen.getByText(/What's the difference between a pathway and a role\?/)).toBeDefined();
  expect(screen.getByText(/Is The Lab part of CUT BLOCK\?/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  expect(document.querySelectorAll('a[href^="tel:"]').length).toBe(0);
  expect(document.querySelectorAll('a[href^="http"]').length).toBe(0);
});
