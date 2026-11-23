import { expect, test } from '@playwright/test'

test('home page renders the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Study Portal', exact: true })).toBeVisible()
})

test('top bar navigates to Settings and Home', async ({ page, baseURL }) => {
  await page.goto('/flashcards')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(new URL('/settings', baseURL).href)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await nav.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL(new URL('/', baseURL).href)
  await expect(page.getByRole('region', { name: 'Flashcards' })).toBeVisible()
})

test('old section URLs redirect to focus views; including notes and calendar', async ({ page, baseURL }) => {
  // [old path, focus URL, expanded card, a heading inside the view (views have no h1 of their own)]
  for (const [path, url, panel, heading] of [
    ['/flashcards', '/?focus=flashcards', 'Flashcards', /^Review · /],
    ['/leetcode', '/?focus=leetcode', 'LeetCode', null],
    ['/roadmaps', '/?focus=roadmaps', 'Roadmaps', null],
    ['/flashcards/999999', '/?focus=flashcards&deck=999999', 'Flashcards', 'Deck not found'],
    ['/flashcards/review', '/?focus=flashcards&review=all', 'Flashcards', 'Review · All decks'],
    ['/leetcode/999999', '/?focus=leetcode&problem=999999', 'LeetCode', 'Problem not found'],
    ['/roadmaps/999999', '/?focus=roadmaps&roadmap=999999', 'Roadmaps', 'Roadmap not found'],
    ['/notes', '/?focus=notes', 'Notes', null],
    ['/calendar', '/?focus=calendar', 'Calendar', null],
  ] as [string, string, string, string | RegExp | null][]) {
    await page.goto(path)
    await expect(page).toHaveURL(new URL(url, baseURL).href)
    await expect(page.getByRole('button', { name: `Collapse ${panel}` })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)
    if (heading) await expect(page.getByRole('heading', { level: 3, name: heading })).toBeVisible()
  }
})

test('logout is disabled and its tooltip shows on keyboard focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Logout' })).toBeDisabled()
  await page.getByRole('link', { name: 'Settings' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tooltip')).toHaveText('Available once login is set up')
})

test('settings theme toggle changes the color scheme and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/settings')
  const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  await page.getByRole('button', { name: 'Dark' }).click()
  await expect.poll(scheme).toBe('dark')
  await page.reload()
  await expect.poll(scheme).toBe('dark')
  await page.getByRole('button', { name: 'Light' }).click()
  await expect.poll(scheme).toBe('light')
})

test('small screens collapse the links into a menu and keep the bell', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Notifications/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(new URL('/settings', baseURL).href)
})

test('unknown URL shows not found', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
