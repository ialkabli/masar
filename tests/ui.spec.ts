import { test, expect } from "@playwright/test";
test("Arabic login, responsive workspace, and explicit logout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("Portfolio!2026");
  await page.getByRole("button", { name: "دخول إلى مساحة العمل" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".page-heading h1")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "القائمة", exact: true }).click();
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "أهلًا بعودتك." }),
  ).toBeVisible();
});
