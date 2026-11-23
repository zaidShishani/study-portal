import { expect, test } from '@playwright/test'

test('expand a panel, open a nested view, then refresh, browser Back and Escape restore state', async ({ page, baseURL }) => {
  const title = `E2E home deck ${Date.now()}`
  const res = await page.request.post('/api/decks', { data: { title } })
  expect(res.status()).toBe(201)
  const { id } = await res.json()
  const at = (path: string) => expect(page).toHaveURL(new URL(path, baseURL).href)

  await page.goto('/')
  await page.getByRole('button', { name: 'Expand Flashcards' }).click()
  await at('/?focus=flashcards')
  await expect(page.getByRole('heading', { level: 1, name: 'Flashcards' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'LeetCode' })).toHaveCount(0)

  await page.getByText(title).click()
  await at(`/?focus=flashcards&deck=${id}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

  await page.goBack()
  await at('/?focus=flashcards')
  await expect(page.getByRole('heading', { level: 1, name: 'Flashcards' })).toBeVisible()

  await page.keyboard.press('Escape')
  await at('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Flashcards' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'LeetCode' })).toBeVisible()

  await page.goBack()
  await at('/?focus=flashcards')
  await page.getByRole('button', { name: 'Back to home' }).click()
  await at('/')
})

test('home layout: two independent columns on desktop, one column in sketch order with no horizontal scroll at 375px', async ({ page }) => {
  const box = async (name: string) => (await page.getByRole('region', { name }).boundingBox())!
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const cards = await box('Flashcards')
  expect((await box('Calendar')).x).toBeGreaterThanOrEqual(cards.x + cards.width)
  expect((await box('Notes')).x).toBeGreaterThanOrEqual(cards.x + cards.width)
  // Independent columns: each card sits 24px under the one above it in its own column, whatever the other column's heights.
  const below = async (upper: string, lower: string) => {
    const [u, l] = [await box(upper), await box(lower)]
    expect(Math.round(l.y - (u.y + u.height))).toBe(24)
  }
  await below('Flashcards', 'LeetCode')
  await below('LeetCode', 'Roadmaps')
  await below('Calendar', 'Notes')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)

  await page.setViewportSize({ width: 375, height: 800 })
  const ys: number[] = []
  for (const name of ['Flashcards', 'Calendar', 'LeetCode', 'Notes', 'Roadmaps']) ys.push((await box(name)).y)
  expect([...ys].sort((a, b) => a - b)).toEqual(ys)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
