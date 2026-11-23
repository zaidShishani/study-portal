import { expect, test, type APIRequestContext } from '@playwright/test'

async function post<T>(request: APIRequestContext, url: string, data: object): Promise<T> {
  const res = await request.post(url, { data })
  expect(res.status(), url).toBe(201)
  return res.json()
}

test('seeded card, problem and roadmap show on the home panels; Start review opens the review', async ({ page }) => {
  const tag = Date.now()
  const { request } = page
  const deck = await post<{ id: number }>(request, '/api/decks', { title: `E2E dash deck ${tag}` })
  await post(request, `/api/decks/${deck.id}/cards`, { front: 'Dashboard front', back: 'Back' })
  const problem = await post<{ id: number }>(request, '/api/problems', {
    title: `E2E dash problem ${tag}`,
    difficulty: 'Hard',
    pattern: 'Graph',
  })
  const roadmap = await post<{ id: number }>(request, '/api/roadmaps', { title: `E2E dash roadmap ${tag}` })
  await post(request, `/api/roadmaps/${roadmap.id}/checkpoints`, { title: 'Only step' })

  await page.goto('/')
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: new RegExp(`E2E dash deck ${tag}`) })).toHaveAttribute(
    'href',
    `/?focus=flashcards&review=${deck.id}`,
  )
  await expect(main.getByRole('link', { name: new RegExp(`E2E dash problem ${tag}`) })).toHaveAttribute(
    'href',
    `/?focus=leetcode&problem=${problem.id}`,
  )
  const roadmapLink = main.getByRole('link', { name: new RegExp(`E2E dash roadmap ${tag}`) })
  await expect(roadmapLink).toHaveAttribute('href', `/?focus=roadmaps&roadmap=${roadmap.id}`)
  await expect(roadmapLink).toContainText('0/1 · 0%')

  await main.getByRole('link', { name: 'Start review' }).click()
  await expect(page).toHaveURL(/\/\?focus=flashcards&review=all$/)
  await expect(page.getByText(/^1 of \d+$/)).toBeVisible()
})
