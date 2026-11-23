import { expect, test, type APIRequestContext } from '@playwright/test'

async function post<T>(request: APIRequestContext, url: string, data: object): Promise<T> {
  const res = await request.post(url, { data })
  expect(res.status(), url).toBe(201)
  return res.json()
}

test('seeded card, problem and roadmap show on the home cards; Review all opens the review', async ({ page }) => {
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
  await expect(main.getByRole('link', { name: `E2E dash deck ${tag}`, exact: true })).toHaveAttribute('href', `/?focus=flashcards&deck=${deck.id}`)
  await expect(main.getByRole('link', { name: `Review E2E dash deck ${tag}` })).toHaveAttribute('href', `/?focus=flashcards&review=${deck.id}`)
  // The calendar agenda lists today's due problem too; check the LeetCode panel's link.
  const leetcode = main.getByRole('region', { name: 'LeetCode' })
  await expect(leetcode.getByRole('link', { name: new RegExp(`E2E dash problem ${tag}`) })).toHaveAttribute(
    'href',
    `/?focus=leetcode&problem=${problem.id}`,
  )
  // Roadmaps card: pick the roadmap's tab, then its checkpoints and progress show.
  const roadmaps = main.getByRole('region', { name: 'Roadmaps' })
  await roadmaps.getByRole('button', { name: `E2E dash roadmap ${tag}` }).click()
  await expect(roadmaps.getByRole('link', { name: /Only step/ })).toHaveAttribute('href', `/?focus=roadmaps&roadmap=${roadmap.id}`)
  await expect(roadmaps.getByText('0 / 1')).toBeVisible()

  await main.getByRole('link', { name: 'Review all' }).click()
  await expect(page).toHaveURL(/\/\?focus=flashcards&review=all$/)
  await expect(page.getByText(/^1 of \d+$/)).toBeVisible()
})
