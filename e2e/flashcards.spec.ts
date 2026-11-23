import { expect, test } from '@playwright/test'

// shortcut: un-retire is covered in Vitest (DeckPage.test.tsx) only. Retiring needs four Right reviews on
// four different days and the API has no time-travel or fixture hook; add one if e2e coverage is needed.
test('create deck, add card, review Right, card leaves the queue', async ({ page }) => {
  const title = `E2E deck ${Date.now()}`
  await page.goto('/')
  await page.getByRole('button', { name: 'Expand Flashcards' }).click()
  await page.getByRole('button', { name: 'New deck' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await page.getByText(title).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const deckId = new URL(page.url()).searchParams.get('deck')

  await page.getByRole('button', { name: 'New card' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Front', { exact: true }).fill('What is **2 + 2**?')
  await dialog.getByLabel('Back', { exact: true }).fill('4')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Stage 0 ·')).toBeVisible()

  await page.getByRole('link', { name: 'Start review (1 due)' }).click()
  await expect(page.getByText('1 of 1')).toBeVisible()
  await expect(page.getByText('2 + 2')).toBeVisible()
  await page.getByRole('button', { name: 'Show answer (Space)' }).click()
  await expect(page.getByText('4', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Right (2)' }).click()
  await expect(page.getByRole('heading', { name: 'Done! Reviewed 1 card.' })).toBeVisible()

  await page.getByRole('link', { name: 'Back to deck' }).click()
  await expect(page.getByRole('link', { name: 'Start review (0 due)' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('Stage 1 ·')).toBeVisible()
  const queue = await page.request.get(`/api/review/cards?deck_id=${deckId}`)
  expect(await queue.json()).toEqual([])
})
