import { expect, test, type APIRequestContext } from '@playwright/test'

async function post<T>(request: APIRequestContext, url: string, data: object): Promise<T> {
  const res = await request.post(url, { data })
  expect(res.status(), url).toBe(201)
  return res.json()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('add a card from home', async ({ page }) => {
  const title = `E2E quick deck ${Date.now()}`
  const deck = await post<{ id: number }>(page.request, '/api/decks', { title })
  await page.goto('/')
  const cards = page.getByRole('region', { name: 'Flashcards' })
  await expect(cards.getByRole('button', { name: `Review ${title}` })).toBeDisabled()

  const form = cards.getByRole('form', { name: 'Quick add card' })
  await form.getByLabel('Deck').selectOption({ label: title })
  await form.getByLabel('Front').fill('hola')
  await form.getByLabel('Back').fill('hello')
  await form.getByRole('button', { name: 'Add' }).dblclick()
  await expect(form.getByLabel('Front')).toHaveValue('')
  // New cards are due today, so the deck's Review button turns on.
  await expect(cards.getByRole('link', { name: `Review ${title}` })).toHaveAttribute('href', `/?focus=flashcards&review=${deck.id}`)
  const list = await (await page.request.get(`/api/decks/${deck.id}/cards?status=all`)).json()
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ front: 'hola', back: 'hello' })
})

test('log an attempt from home', async ({ page }) => {
  const title = `E2E quick problem ${Date.now()}`
  const problem = await post<{ id: number }>(page.request, '/api/problems', { title, difficulty: 'Easy', pattern: 'Math' })
  await page.goto('/')
  const leet = page.getByRole('region', { name: 'LeetCode' })
  await leet.getByRole('group', { name: `Log attempt: ${title}` }).getByRole('button', { name: 'Solved' }).click()
  // The ladder moves its due date past today, so it leaves the due list.
  await expect(leet.getByRole('link', { name: title })).toHaveCount(0)
  const saved = await (await page.request.get(`/api/problems/${problem.id}`)).json()
  expect(saved).toMatchObject({ last_result: 'solved', review_count: 1 })
})

test('tick a checkpoint and add one from home', async ({ page }) => {
  const title = `E2E quick roadmap ${Date.now()}`
  const roadmap = await post<{ id: number }>(page.request, '/api/roadmaps', { title })
  await post(page.request, `/api/roadmaps/${roadmap.id}/checkpoints`, { title: 'Step one' })
  await page.goto('/')
  const road = page.getByRole('region', { name: 'Roadmaps' })
  await road.getByRole('button', { name: title }).click()
  await expect(road.getByText('0 / 1')).toBeVisible()

  // click, not check(): the box follows server state, so it flips after the PATCH + refetch.
  await road.getByRole('checkbox', { name: 'Step one' }).click()
  await expect(road.getByRole('checkbox', { name: 'Step one' })).toBeChecked()
  await expect(road.getByText('1 / 1')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)

  const input = road.getByLabel('Add a checkpoint')
  await input.fill('  Step two  ')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await expect(road.getByRole('link', { name: 'Step two' })).toBeVisible()
  await expect(road.getByText('1 / 2')).toBeVisible()
})

test('quick-capture a note; it appears in Recent', async ({ page }) => {
  const tag = Date.now()
  await post(page.request, '/api/notes/folders', { name: `E2E capture ${tag}` })
  await page.goto('/')
  const notes = page.getByRole('region', { name: 'Notes' })
  const form = notes.getByRole('form', { name: 'Quick note' })
  await form.getByLabel('Save to folder').selectOption({ label: `E2E capture ${tag}` })
  await form.getByLabel('Quick note').fill(`\n  Captured ${tag}  \nmore detail`)
  await form.getByRole('button', { name: 'Save' }).dblclick()
  await expect(form.getByLabel('Quick note')).toHaveValue('')
  const row = notes.getByRole('link', { name: new RegExp(`Captured ${tag}`) })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(`E2E capture ${tag} ·`)
})
