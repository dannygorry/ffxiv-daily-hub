import { test, expect } from "@playwright/test"

test.describe("Home page (unauthenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("renders the hero heading", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("FFXIV")
  })

  test("shows Get Started and Sign In CTAs", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Get Started Free" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible()
  })

  test("Get Started link goes to /auth/register", async ({ page }) => {
    await page.getByRole("link", { name: "Get Started Free" }).click()
    await expect(page).toHaveURL("/auth/register")
  })

  test("Sign In link goes to /auth/login", async ({ page }) => {
    await page.getByRole("link", { name: "Sign In" }).click()
    await expect(page).toHaveURL("/auth/login")
  })

  test("shows feature callout cards", async ({ page }) => {
    await expect(page.getByText("Daily & Weekly Checklists")).toBeVisible()
    await expect(page.getByText("Multi-Character Support")).toBeVisible()
    await expect(page.getByText("Push Notifications")).toBeVisible()
  })

  test("shows Eorzea weather section", async ({ page }) => {
    await expect(page.getByText("Eorzea Weather")).toBeVisible()
  })

  test("shows Reset Timers section", async ({ page }) => {
    await expect(page.getByText("Reset Timers")).toBeVisible()
  })

  test("shows footer attribution", async ({ page }) => {
    await expect(page.getByText(/Fan-made tool/)).toBeVisible()
  })
})
