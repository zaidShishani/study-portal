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

  await page.goto('/calendar')
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
