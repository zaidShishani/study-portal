import { expect, test, type Page } from '@playwright/test'

// The <dd> next to a detail label on the problem page.
const detail = (page: Page, label: string) => page.locator(`dt:text-is("${label}") + dd`)

async function logAttempt(page: Page, result: string) {
  await page.getByRole('button', { name: 'Log attempt' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(result, { exact: true }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test('create a problem, log failed then solved, and the ladder advances', async ({ page }) => {
  const title = `E2E problem ${Date.now()}`
  await page.goto('/')
  await page.getByRole('button', { name: 'Expand LeetCode' }).click()
  // Home's header has its own New problem; wait for the expanded view so the click hits the page's button.
  await expect(page.getByLabel('Difficulty')).toBeVisible()
  await page.getByRole('button', { name: 'New problem' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByLabel('Difficulty').selectOption('Easy')
  await dialog.getByLabel('Pattern').selectOption('Graph')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('link', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible()
  await expect(detail(page, 'Stage')).toHaveText('0')

  // The browser's timezone is synced to the user, so its "tomorrow" is the server's.
  const tomorrow = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-CA')
  })
  await logAttempt(page, 'Failed')
  await expect(detail(page, 'Stage')).toHaveText('1')
  await expect(detail(page, 'Next due')).toHaveText(tomorrow)
  await expect(detail(page, 'Last result')).toHaveText('Failed')

  await logAttempt(page, 'Solved')
  await expect(detail(page, 'Stage')).toHaveText('2')
  await expect(detail(page, 'Reviews')).toHaveText('2')
})
