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

test("the approved meaning and provisional brand are prominent, and the acronym appears only once", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Potential shouldn't depend on who you know.");
  expect(screen.getAllByText(brand.meaning)).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: /CUT BLOCK home/i })).toHaveLength(2);
  expect(screen.getAllByText(/provisional working brand/i).length).toBeGreaterThan(0);
  expect(document.body.textContent).toContain("From the codebase to the field.");
});

test("navigation links to every architecture section and all targets resolve", () => {
  render(<App />);

  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const navigationTargets = within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href")?.slice(1));

  expect(navigationTargets).toEqual(["mission", "pathways", "experience", "participate", "ecosystem", "readiness", "faq"]);
  for (const id of navigationTargets) {
    expect(document.getElementById(id ?? "")).not.toBeNull();
  }
});

test("legacy anchors #story and #approach still resolve so old bookmarks keep working", () => {
  render(<App />);

  expect(document.getElementById("story")).not.toBeNull();
  expect(document.getElementById("approach")).not.toBeNull();
  expect(document.getElementById("mission")).not.toBeNull();
  expect(document.getElementById("experience")).not.toBeNull();
});

test("the mission section tells one human story without restating the acronym as a separate headline elsewhere", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /CUT BLOCK means/ })).toBeDefined();
  expect(screen.getByText(/offensive line and the engineering team/)).toBeDefined();
  expect(screen.queryByRole("heading", { name: /Where this could grow/i })).toBeNull();
  expect(screen.queryByRole("heading", { name: /bigger vision/i })).toBeNull();
});

test("pathways distinguishes office (planned adult pilot) and field (future pathway) tracks with visible status text", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "In the office" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "On the field" })).toBeDefined();
  expect(screen.getByText("Planned adult pilot")).toBeDefined();
  expect(screen.getByText("Future pathway")).toBeDefined();

  for (const group of [
    "Plan and deliver", "Engineer and build", "Validate quality",
    "Operate and scale", "Lead and grow", "Explore future disciplines",
  ]) {
    expect(screen.getByRole("heading", { name: group })).toBeDefined();
  }
  expect(screen.getByText(/Project management, requirements, agile delivery/)).toBeDefined();
  expect(screen.getByText(/QA, exploratory testing, automation, accessibility/)).toBeDefined();

  for (const area of ["Offensive line", "Defensive line", "Shared development", "Additional positions"]) {
    expect(screen.getByRole("heading", { name: area })).toBeDefined();
  }
  expect(screen.getByText(/No field training program, gym, facility, youth program or/)).toBeDefined();
});

test("pathways are not rendered as two audience roles; roles live separately in participate", () => {
  render(<App />);

  const pathwaysSection = document.getElementById("pathways");
  expect(pathwaysSection).not.toBeNull();
  expect(within(pathwaysSection as HTMLElement).queryByText("I want to grow.")).toBeNull();
  expect(within(pathwaysSection as HTMLElement).queryByText("I want to give back.")).toBeNull();

  const participateSection = document.getElementById("participate");
  expect(participateSection).not.toBeNull();
  expect(within(participateSection as HTMLElement).getByText("I want to grow.")).toBeDefined();
  expect(within(participateSection as HTMLElement).getByText("I want to give back.")).toBeDefined();
  expect(document.getElementById("learner-journey")).not.toBeNull();
  expect(document.getElementById("mentor-journey")).not.toBeNull();
});

test("experience section shows at least four tangible, clearly-labeled example artifacts across both tracks", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "What learners could actually do." })).toBeDefined();
  expect(screen.getByText(/not results already delivered to past participants/i)).toBeDefined();

  const exampleTitles = ["Ship a useful feature", "Quality is a profession", "Lead the work", "Run it responsibly"];
  for (const title of exampleTitles) {
    expect(screen.getByRole("heading", { name: title })).toBeDefined();
  }
  // At least one example illustrates each track.
  const experienceSection = document.getElementById("experience");
  expect(within(experienceSection as HTMLElement).getAllByText("Office").length).toBeGreaterThan(0);
  expect(within(experienceSection as HTMLElement).getAllByText("Field").length).toBeGreaterThan(0);
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

test("hero CTAs lead into the new architecture without opening enrollment", () => {
  render(<App />);

  expect(screen.getByRole("link", { name: "Explore development pathways" }).getAttribute("href")).toBe("#pathways");
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
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  expect(document.querySelectorAll('a[href^="http"]').length).toBe(0);
});
