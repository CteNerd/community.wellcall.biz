import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PathwaysPage } from "./PathwaysPage.tsx";
import { readPresentation } from "../presentation.ts";

afterEach(cleanup);

test("renders the office (planned adult pilot) and field (future pathway) tracks with visible status text", () => {
  render(<PathwaysPage />);

  expect(screen.getByRole("heading", { level: 1, name: "Explore the development pathways." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "In the office" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "On the field" })).toBeDefined();
  expect(screen.getByText("Planned adult pilot")).toBeDefined();
  expect(screen.getByText("Future pathway")).toBeDefined();
  expect(document.getElementById("office")).not.toBeNull();
  expect(document.getElementById("field")).not.toBeNull();

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

test("includes illustrative, clearly-labeled artwork for each track", () => {
  render(<PathwaysPage />);

  const images = screen.getAllByRole("img");
  expect(images).toHaveLength(2);
  for (const image of images) {
    expect(image.getAttribute("alt")).toMatch(/illustrative cartoon artwork/i);
    expect(image.getAttribute("alt")).toMatch(/not a photo of real/i);
  }
});

test("links back to participate and experience, and does not open enrollment", () => {
  render(<PathwaysPage />);

  const intro = screen.getByText(/These are subjects you could study/).closest("div") as HTMLElement;
  expect(within(intro).getByRole("link", { name: "Participate" }).getAttribute("href")).toBe("/#participate");
  expect(within(intro).getByRole("link", { name: "Experience" }).getAttribute("href")).toBe("/experience");
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("link", { name: /apply now|become a mentor|join the program|register/i })).toBeNull();
});

test("navigation and footer use absolute links back to home-page anchors", () => {
  render(<PathwaysPage />);

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
  expect(screen.getAllByRole("link", { name: /CUT BLOCK home/i }).every((link) => link.getAttribute("href") === "/")).toBe(true);
  expect(screen.getByRole("link", { name: /Back to home/i }).getAttribute("href")).toBe("/");
});

test("production presentation hides preview labeling, same as the home page", () => {
  render(<PathwaysPage presentation={readPresentation({
    VITE_COMMUNITY_PRESENTATION: "production", VITE_COMMUNITY_BRAND_LAUNCH_APPROVED: "true",
  })} />);

  expect(document.body.textContent).not.toMatch(/preview|provisional/i);
  expect(screen.getByRole("link", { name: "281-692-7522" }).getAttribute("href")).toBe("tel:+12816927522");
});
