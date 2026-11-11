import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExperiencePage } from "./ExperiencePage.tsx";
import { readPresentation } from "../presentation.ts";

afterEach(cleanup);

test("shows at least four tangible, clearly-labeled example artifacts across both tracks", () => {
  render(<ExperiencePage />);

  expect(screen.getByRole("heading", { level: 1, name: "What learners could actually do." })).toBeDefined();
  expect(screen.getByText(/not results already delivered to past participants/i)).toBeDefined();

  const exampleTitles = ["Ship a useful feature", "Quality is a profession", "Lead the work", "Run it responsibly"];
  for (const title of exampleTitles) {
    expect(screen.getByRole("heading", { name: title })).toBeDefined();
  }
  expect(screen.getAllByText("Office").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Field").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Trenches fundamentals" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Build the film-room habit" })).toBeDefined();
});

test("each example names a skill, practice artifact, mentor role and growth signal", () => {
  render(<ExperiencePage />);

  const card = screen.getByRole("heading", { name: "Ship a useful feature" }).closest("article") as HTMLElement;
  expect(within(card).getByText("Skill")).toBeDefined();
  expect(within(card).getByText("Practice artifact")).toBeDefined();
  expect(within(card).getByText("Mentor role")).toBeDefined();
  expect(within(card).getByText("Growth signal")).toBeDefined();
  expect(within(card).getByText(/Can explain a design trade-off/)).toBeDefined();
});

test("links back to the pathways page and does not open enrollment", () => {
  render(<ExperiencePage />);

  expect(screen.getByRole("link", { name: "office and field pathways" }).getAttribute("href")).toBe("/pathways");
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("link", { name: /apply now|become a mentor|join the program|register/i })).toBeNull();
});

test("navigation uses absolute links back to home-page anchors", () => {
  render(<ExperiencePage />);

  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const hrefByLabel = Object.fromEntries(
    within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]),
  );
  expect(hrefByLabel).toEqual({
    Mission: "/#mission",
    Pathways: "/pathways",
    Experience: "/experience",
    Participate: "/#participate",
    Collaborators: "/#ecosystem",
    Readiness: "/#readiness",
    FAQ: "/#faq",
  });
});

test("production presentation hides preview labeling, same as the home page", () => {
  render(<ExperiencePage presentation={readPresentation({
    VITE_COMMUNITY_PRESENTATION: "production", VITE_COMMUNITY_BRAND_LAUNCH_APPROVED: "true",
  })} />);

  expect(document.body.textContent).not.toMatch(/preview|provisional/i);
});
