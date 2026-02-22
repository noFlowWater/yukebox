import { test, expect } from '@playwright/test'

const TEST_USER = { username: 'e2euser', password: 'e2epassword123' }
const BASE_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

test.describe('YukeBox UI', () => {
  test.beforeEach(async ({ page, context }) => {
    // Ensure test user exists (register is idempotent — 409 on duplicate is fine)
    await page.request.post(`${BASE_API}/api/auth/register`, {
      data: TEST_USER,
    })

    // Login and get cookies
    const loginRes = await page.request.post(`${BASE_API}/api/auth/login`, {
      data: TEST_USER,
    })

    // Extract cookies from response and set them on the browser context
    const setCookieHeaders = loginRes.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')
    for (const header of setCookieHeaders) {
      const parts = header.value.split(';')[0].split('=')
      const name = parts[0]
      const value = parts.slice(1).join('=')
      await context.addCookies([{
        name,
        value,
        domain: new URL(BASE_API).hostname,
        path: '/',
      }])
    }

    await page.goto('/')
  })

  // --- Layout ---

  test('renders page with search bar', async ({ page }) => {
    const input = page.getByPlaceholder('Search or paste YouTube URL...')
    await expect(input).toBeVisible()
  })

  test('renders queue and schedule tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Queue' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible()
  })

  test('renders player bar with idle state', async ({ page }) => {
    await expect(page.getByText('No track playing')).toBeVisible()
  })

  // --- Tabs ---

  test('queue tab is active by default', async ({ page }) => {
    const queueTab = page.getByRole('tab', { name: 'Queue' })
    await expect(queueTab).toHaveAttribute('data-state', 'active')
  })

  test('can switch to schedule tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Schedule' }).click()
    const scheduleTab = page.getByRole('tab', { name: 'Schedule' })
    await expect(scheduleTab).toHaveAttribute('data-state', 'active')
  })

  test('schedule tab shows form inputs', async ({ page }) => {
    await page.getByRole('tab', { name: 'Schedule' }).click()
    await expect(page.getByPlaceholder('Song name or YouTube URL')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible()
  })

  // --- Search ---

  test('search input accepts text', async ({ page }) => {
    const input = page.getByPlaceholder('Search or paste YouTube URL...')
    await input.fill('test query')
    await expect(input).toHaveValue('test query')
  })

  // --- Responsive ---

  test('layout is centered on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    const main = page.locator('main')
    await expect(main).toHaveClass(/max-w-2xl/)
  })

  test('layout works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const input = page.getByPlaceholder('Search or paste YouTube URL...')
    await expect(input).toBeVisible()
    await expect(page.getByText('No track playing')).toBeVisible()
  })
})
