import { expect, test } from "@playwright/test";

test("shows the local E1 base", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stepable" })).toBeVisible();
  await expect(page.getByText("Identidad local E1.2")).toBeVisible();
});
