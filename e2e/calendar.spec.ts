import { expect, test, type Page } from '@playwright/test'

// Month-view day cell for a local YYYY-MM-DD date.
const day = (page: Page, date: string) => page.locator(`td.fc-daygrid-day[data-date="${date}"]`)

test('create a weekly event, see it on the expected days, edit its title, delete it', async ({ page }) => {
  const title = `E2E event ${Date.now()}`
  const renamed = `${title} renamed`
  // A month 2-4 years ahead, so existing data (or a failed earlier run) is unlikely to share its cells.
  const months = 24 + (Date.now() % 24)
  // The Monday of the week holding the 8th: it and the next 9 days are always in that month.
  const dates = await page.evaluate((months) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + months)
    d.setDate(8)
    d.setDate(8 - ((d.getDay() + 6) % 7))
    return [0, 1, 2, 7, 9, 14].map((offset) => {
      const x = new Date(d)
      x.setDate(d.getDate() + offset)
      return x.toLocaleDateString('en-CA')
    })
  }, months)
  const [mon, tue, wed, mon2, wed2, mon3] = dates

  await page.goto('/?focus=calendar')
  for (let i = 0; i < months; i++) await page.locator('.fc-next-button').click()
  // The day-number strip, not the cell centre, which may hold an event.
  await day(page, mon).locator('.fc-daygrid-day-top').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'New event' })).toBeVisible()
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByRole('combobox', { name: 'Repeats' }).click()
  await page.getByRole('option', { name: 'Weekly' }).click()
  await dialog.getByRole('checkbox', { name: 'Mon' }).check()
  await dialog.getByRole('checkbox', { name: 'Wed' }).check()
  await dialog.getByRole('radio', { name: 'After a number of occurrences' }).check()
  await dialog.getByRole('spinbutton', { name: 'Occurrences' }).fill('4')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  for (const date of [mon, wed, mon2, wed2]) await expect(day(page, date).getByText(title)).toBeVisible()
  for (const date of [tue, mon3]) await expect(day(page, date).getByText(title)).toHaveCount(0)

  await day(page, wed).getByText(title).click()
  await expect(dialog.getByRole('heading', { name: 'Edit event' })).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: 'Wed' })).toBeChecked()
  await dialog.getByLabel('Title').fill(renamed)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(day(page, mon2).getByText(renamed)).toBeVisible()

  await day(page, mon).getByText(renamed).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete event?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(renamed)).toHaveCount(0)
})

test('home calendar card: dot and agenda for today, day selection, expand opens the full calendar', async ({ page, baseURL }) => {
  const title = `E2E agenda ${Date.now()}`
  // Today 23:00-23:30 local, so it stays on today's date whatever time the test runs.
  const [start, end, todayNum] = await page.evaluate(() => {
    const d = new Date()
    d.setHours(23, 0, 0, 0)
    return [d.toISOString(), new Date(d.getTime() + 1_800_000).toISOString(), String(d.getDate())]
  })
  const res = await page.request.post('/api/events', { data: { title, start_at: start, end_at: end } })
  expect(res.status()).toBe(201)
  const { id } = await res.json()

  await page.goto('/')
  const card = page.getByRole('region', { name: 'Calendar' })
  await expect(card.getByText('Agenda for today')).toBeVisible()
  const item = card.getByRole('link', { name: new RegExp(title) })
  await expect(item).toBeVisible()
  await expect(card.getByRole('gridcell', { name: todayNum, exact: true })).toHaveAttribute('aria-description', 'Has items')

  await item.click()
  await expect(page).toHaveURL(new URL('/?focus=calendar', baseURL).href)
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  await expect(page.locator('.fc')).toBeVisible()
  await page.getByRole('button', { name: 'Back to home' }).click()

  // Another day in the visible month drops today's event from the list.
  const other = todayNum === '1' ? '2' : '1'
  await card.getByRole('gridcell', { name: other, exact: true }).click()
  await expect(card.getByText(/^Agenda for /)).not.toHaveText('Agenda for today')
  await expect(item).toHaveCount(0)

  await page.getByRole('button', { name: 'Expand Calendar' }).click()
  await expect(page).toHaveURL(new URL('/?focus=calendar', baseURL).href)
  await page.request.delete(`/api/events/${id}`)
})
