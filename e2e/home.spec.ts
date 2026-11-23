import { expect, test, type Page } from '@playwright/test'

const box = async (page: Page, name: string) => (await page.getByRole('region', { name }).boundingBox())!

test('expand a card in place, open a nested view, then refresh, browser Back and Escape restore state', async ({ page, baseURL }) => {
  const title = `E2E home deck ${Date.now()}`
  const res = await page.request.post('/api/decks', { data: { title } })
  expect(res.status()).toBe(201)
  const { id } = await res.json()
  const at = (path: string) => expect(page).toHaveURL(new URL(path, baseURL).href)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const grid = await box(page, 'Flashcards')
  await page.getByRole('button', { name: 'Expand Flashcards' }).click()
  await at('/?focus=flashcards')
  // Focus moves to the card title; the view adds no h1 of its own.
  await expect(page.getByRole('heading', { level: 2, name: 'Flashcards' })).toBeFocused()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'LeetCode' })).toHaveCount(0)
  // The card itself grows to the whole content area (Notes' right edge, Roadmaps' bottom edge).
  await expect(async () => {
    const full = await box(page, 'Flashcards')
    expect(full.width).toBeGreaterThan(grid.width + 300)
    expect(full.y + full.height).toBeGreaterThan(800)
  }).toPass()
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight)).toBe(true)

  await page.getByRole('navigation', { name: 'Decks' }).getByText(title).click()
  await at(`/?focus=flashcards&deck=${id}`)
  await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible()

  await page.goBack()
  await at('/?focus=flashcards')
  await expect(page.getByRole('navigation', { name: 'Decks' })).toBeVisible()

  await page.keyboard.press('Escape')
  await at('/')
  await expect(page.getByRole('button', { name: 'Expand Flashcards' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'LeetCode' })).toBeVisible()
  await expect(async () => expect((await box(page, 'Flashcards')).width).toBeCloseTo(grid.width, 0)).toPass()

  await page.goBack()
  await at('/?focus=flashcards')
  await page.getByRole('button', { name: 'Collapse Flashcards' }).click()
  await at('/')
})

test('home fits one screen at 1440x900 and 1280x800 in the 12-column grid; one column at 375px', async ({ page }) => {
  // Enough problems that the LeetCode list must scroll inside its card.
  for (let i = 0; i < 8; i++) {
    const res = await page.request.post('/api/problems', { data: { title: `E2E scroll ${Date.now()} ${i}`, difficulty: 'Easy', pattern: 'Math' } })
    expect(res.status()).toBe(201)
  }
  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'LeetCode' }).getByRole('link').first()).toBeVisible()
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight)).toBe(true)
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true)

    const [cards, leet, road, cal, notes] = await Promise.all(
      ['Flashcards', 'LeetCode', 'Roadmaps', 'Calendar', 'Notes'].map((n) => box(page, n)),
    )
    // Left 8 columns: Flashcards, LeetCode, Roadmaps stacked with 16px gaps; right 4: Calendar over Notes (rows 2-3).
    expect(Math.round(leet.y - (cards.y + cards.height))).toBe(16)
    expect(Math.round(road.y - (leet.y + leet.height))).toBe(16)
    expect(Math.round(cal.x - (cards.x + cards.width))).toBe(16)
    expect(Math.round(notes.y)).toBe(Math.round(leet.y))
    expect(Math.round(notes.y + notes.height)).toBe(Math.round(road.y + road.height))
    expect(Math.round(cards.height)).toBe(Math.round(leet.height))
    // 24px bottom padding: the grid ends exactly at the viewport edge.
    expect(Math.round(height - (road.y + road.height))).toBe(24)
    // The LeetCode body scrolls instead of the page.
    const body = page.getByRole('region', { name: 'LeetCode' }).locator('> div').last()
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  }

  await page.setViewportSize({ width: 375, height: 800 })
  const boxes = []
  for (const name of ['Flashcards', 'Calendar', 'LeetCode', 'Notes', 'Roadmaps']) boxes.push(await box(page, name))
  const ys = boxes.map((b) => b.y)
  expect([...ys].sort((a, b) => a - b)).toEqual(ys)
  for (const b of boxes) expect(Math.round(b.x)).toBe(Math.round(boxes[0].x))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
