import { expect, test } from '@playwright/test'

test('reminder that just fired shows on the bell; clicking it clears the badge', async ({ page }) => {
  // Start from zero unread: other specs share this user and may leave reminders behind.
  await page.request.post('/api/notifications/read-all')
  // Start in 1 min with a 5-min reminder: fire time was 4 min ago.
  const start = new Date(Date.now() + 60_000).toISOString()
  const title = `E2E reminder ${Date.now()}`
  const res = await page.request.post('/api/events', {
    data: { title, start_at: start, remind_minutes_before: 5 },
  })
  expect(res.status()).toBe(201)

  await page.goto('/')
  await page.reload()
  const bell = page.getByRole('button', { name: 'Notifications, 1 unread' })
  await expect(bell).toBeVisible()
  await bell.click()
  await page.getByRole('menuitem', { name: new RegExp(title) }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread' })).toBeVisible()
})
