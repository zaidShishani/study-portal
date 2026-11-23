import { expect, test } from '@playwright/test'

// Other specs share this user and may add reminders, so assert on this spec's own item, not a global count.
test('reminder that just fired shows on the bell; clicking it marks it read', async ({ page }) => {
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
  const bell = page.getByRole('button', { name: /^Notifications, \d+\+? unread$/ })
  await expect(bell).not.toHaveAccessibleName('Notifications, 0 unread')
  await bell.click()
  await page.getByRole('menuitem', { name: new RegExp(title) }).click()
  await expect(page).toHaveURL(/\/calendar$/)

  await expect(async () => {
    const unread: { title: string }[] = await (await page.request.get('/api/notifications')).json()
    expect(unread.map((n) => n.title)).not.toContain(title)
  }).toPass()
  await bell.click()
  await expect(page.getByRole('menuitem', { name: new RegExp(title) })).toHaveCount(0)
})
