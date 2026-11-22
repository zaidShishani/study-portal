import { expect, test } from '@playwright/test'

test('home page renders the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Portal', { exact: true })).toBeVisible()
})

// Today last, so clicking it is a real navigation away from another page.
const NAV = [
  ['Flashcards', '/flashcards'],
  ['LeetCode', '/leetcode'],
  ['Notes', '/notes'],
  ['Roadmaps', '/roadmaps'],
  ['Calendar', '/calendar'],
  ['Today', '/'],
] as const

test('sidebar links navigate to each page', async ({ page, baseURL }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const [label, path] of NAV) {
    await nav.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new URL(path, baseURL).href)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
  }
})

test('unknown URL shows not found', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
