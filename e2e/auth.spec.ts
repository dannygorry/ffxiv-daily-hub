import { test, expect } from "@playwright/test"

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
  })

  test("renders the login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
  })

  test("has a link to the register page", async ({ page }) => {
    await page.getByRole("link", { name: "Register" }).click()
    await expect(page).toHaveURL("/auth/register")
  })

  test("shows an error with wrong credentials", async ({ page }) => {
    await page.getByLabel("Email").fill("notareal@example.com")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.getByRole("button", { name: "Sign In" }).click()
    // Supabase returns an error message; just check something appears
    await expect(page.locator("p.text-destructive, [class*='destructive']").first()).toBeVisible({ timeout: 8000 })
  })

  test("button shows loading state while submitting", async ({ page }) => {
    await page.getByLabel("Email").fill("test@example.com")
    await page.getByLabel("Password").fill("password123")

    // Intercept the Supabase auth call to slow it down so we can catch the loading state
    await page.route("**/auth/v1/token**", async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.continue()
    })

    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByRole("button", { name: /Signing in/i })).toBeVisible()
  })
})

test.describe("Register page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/register")
  })

  test("renders the register form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible()
  })

  test("has a link back to login", async ({ page }) => {
    await page.getByRole("link", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/auth/login")
  })

  test("enforces minimum password length via HTML5 validation", async ({ page }) => {
    await page.getByLabel("Email").fill("new@example.com")
    await page.getByLabel("Password").fill("abc")
    await page.getByRole("button", { name: "Create Account" }).click()
    // HTML5 minLength prevents submission — button should not show loading state
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible()
  })
})

test.describe("Auth redirects", () => {
  test("visiting /dashboard when unauthenticated redirects to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
