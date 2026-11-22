import { expect, test } from '@playwright/test'

test('create roadmap, add 3 checkpoints, check one, reorder persists after reload', async ({ page }) => {
  const title = `E2E roadmap ${Date.now()}`
  await page.goto('/roadmaps')
  await page.getByRole('button', { name: 'New roadmap' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await page.getByText(title).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  for (const name of ['First', 'Second', 'Third']) {
    await page.getByRole('button', { name: 'New checkpoint' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Title').fill(name)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('checkbox', { name: `Done: ${name}` })).toBeVisible()
  }
  await expect(page.getByText('0/3 · 0%')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Done: First' }).check()
  await expect(page.getByText('1/3 · 33%')).toBeVisible()

  const items = page.getByRole('main').getByRole('listitem')
  await page.getByRole('button', { name: 'Move up: Third' }).click()
  await expect(items.nth(1)).toContainText('Third')

  await page.reload()
  await expect(items.nth(0)).toContainText('First')
  await expect(items.nth(1)).toContainText('Third')
  await expect(items.nth(2)).toContainText('Second')
  await expect(page.getByRole('checkbox', { name: 'Done: First' })).toBeChecked()

  await page.getByRole('link', { name: 'Roadmaps' }).click()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toContainText('1/3 · 33%')
})
