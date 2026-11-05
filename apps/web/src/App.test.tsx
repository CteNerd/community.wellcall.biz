import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App } from "./App.tsx";

afterEach(cleanup);

test("programs are explicitly planned and youth enrollment is not offered", () => {
  render(<App />);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeDefined();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Build your skills");
  expect(screen.getByText("From the codebase to the field.")).toBeDefined();
  expect(screen.getByText(/Enrollment is not open/)).toBeDefined();
  expect(screen.getByText(/guardian-consent requirements/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
});
