import { expect, test } from '@playwright/test'

// shortcut: un-retire is covered in Vitest (DeckPage.test.tsx) only. Retiring needs four Right reviews on
// four different days and the API has no time-travel or fixture hook; add one if e2e coverage is needed.
test('expanded flashcards: create deck, add card, review it by keyboard in the inline panel', async ({ page }) => {
  const title = `E2E deck ${Date.now()}`
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Expand Flashcards' }).click()
  const card = page.getByRole('region', { name: 'Flashcards' })
  // Home's header has its own New deck; wait for the expanded view so the click hits the view's button.
  await expect(card.getByRole('navigation', { name: 'Decks' })).toBeVisible()
  await card.getByRole('button', { name: 'New deck' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await card.getByRole('navigation', { name: 'Decks' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(card.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible()
  await expect(card.getByRole('link', { name: new RegExp(title) })).toHaveAttribute('aria-current', 'page')
  const deckId = new URL(page.url()).searchParams.get('deck')
  await expect(card.getByRole('heading', { name: `Review · ${title}` })).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Nothing due' })).toBeVisible()

  await card.getByRole('button', { name: 'New card' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Front', { exact: true }).fill('What is **2 + 2**?')
  await dialog.getByLabel('Back', { exact: true }).fill('4')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  // Middle pane: two-line row with the due label; the review panel beside it picks the new card up.
  await expect(card.getByText('Due today')).toBeVisible()
  await expect(card.getByText('1 of 1')).toBeVisible()
  const face = card.getByText('Front', { exact: true })
  await expect(card.getByText('2 + 2')).toHaveCount(2)

  // Keyboard review: move focus off the dialog's opener first (shortcuts ignore focused buttons).
  await face.click()
  await page.keyboard.press('Space')
  await expect(card.getByText('Back', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Right 2' })).toBeVisible()
  await page.keyboard.press('2')
  await expect(card.getByRole('heading', { name: 'Done! Reviewed 1 card.' })).toBeVisible()

  await expect(card.getByText('In 1 day')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Review all' })).toBeVisible()
  const queue = await page.request.get(`/api/review/cards?deck_id=${deckId}`)
  expect(await queue.json()).toEqual([])
})

test('expanded headers fit a 375px phone: no horizontal page scroll (flashcards, problem)', async ({ page }) => {
  const deck = await (await page.request.post('/api/decks', { data: { title: `E2E phone deck with a long name ${Date.now()}` } })).json()
  const problem = await (await page.request.post('/api/problems', { data: { title: `E2E phone ${Date.now()}`, difficulty: 'Easy', pattern: 'Math' } })).json()
  await page.setViewportSize({ width: 375, height: 812 })
  for (const [url, panel, ready] of [
    [`/?focus=flashcards&deck=${deck.id}`, 'Flashcards', page.getByRole('button', { name: 'New deck' })],
    [`/?focus=leetcode&problem=${problem.id}`, 'LeetCode', page.getByRole('button', { name: 'Log attempt' })],
  ] as const) {
    await page.goto(url)
    await expect(ready).toBeVisible()
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true)
    // The header's last control (collapse) stays inside the card.
    const card = (await page.getByRole('region', { name: panel }).boundingBox())!
    const collapse = (await page.getByRole('button', { name: `Collapse ${panel}` }).boundingBox())!
    expect(collapse.x + collapse.width).toBeLessThanOrEqual(card.x + card.width)
  }
})
