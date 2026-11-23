import { expect, test, type Page } from '@playwright/test'

async function create(page: Page, button: string, name: string) {
  await page.getByRole('button', { name: button }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

// Only items with children expand, so wait for a folder's contents to load before clicking it.
async function expandFolder(page: Page, name: string) {
  const item = page.getByRole('treeitem', { name })
  await expect(item).toHaveAttribute('aria-expanded', 'false')
  await item.getByText(name, { exact: true }).click()
  await expect(item).toHaveAttribute('aria-expanded', 'true')
}

test('create folder, subfolder and page; saved markdown persists across reload', async ({ page }) => {
  const stamp = Date.now()
  const folder = `E2E folder ${stamp}`
  const sub = `E2E sub ${stamp}`
  const title = `E2E page ${stamp}`
  await page.goto('/?focus=notes')

  // A new folder is selected after creation, so the next item goes inside it.
  await create(page, 'New folder', folder)
  await create(page, 'New folder', sub)
  await create(page, 'New page', title)

  await expect(page.getByLabel('Title')).toHaveValue(title)
  await page.getByLabel('Content').fill('# Heading\n\nSome **bold** text')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('All changes saved')).toBeVisible()

  await page.reload()
  await expandFolder(page, folder)
  await expandFolder(page, sub)
  await page.getByRole('treeitem', { name: title }).click()
  await expect(page.getByLabel('Content')).toHaveValue('# Heading\n\nSome **bold** text')
  await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.getByRole('heading', { name: 'Heading' })).toBeVisible()
})

// #58: moving a page out of a nested folder could render it twice and blank the page.
test('moving a page between a nested folder and root 10 times keeps one tree item', async ({ page }) => {
  const stamp = Date.now()
  const sub = `E2E move sub ${stamp}`
  const title = `E2E move page ${stamp}`
  await page.goto('/?focus=notes')
  await create(page, 'New folder', `E2E move folder ${stamp}`)
  await create(page, 'New folder', sub)
  await create(page, 'New page', title)
  const item = page.getByRole('treeitem', { name: title })

  async function moveTo(target: string) {
    await page.getByRole('button', { name: 'Move' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').click()
    await page.getByRole('option', { name: target, exact: true }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
  }

  for (let i = 0; i < 10; i++) {
    await moveTo('(Root)')
    await expect(item).toHaveCount(1)
    await moveTo(sub)
    await expect(item).toHaveCount(1)
  }
  await expect(page.getByRole('tree')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('home notes card: recent pages, edits move a page to the top, New page opens the editor', async ({ page, baseURL }) => {
  const stamp = Date.now()
  const mk = async (title: string) => (await (await page.request.post('/api/notes/pages', { data: { title } })).json()).id
  const older = await mk(`E2E recent A ${stamp}`)
  await mk(`E2E recent B ${stamp}`)

  await page.goto('/')
  const card = page.getByRole('region', { name: 'Notes' })
  const links = card.getByRole('link')
  await expect(links.first()).toHaveText(new RegExp(`E2E recent B ${stamp}`))
  await expect(links.first()).toContainText('Root')

  // Edit the older page in the focus view; back on home it is first.
  await card.getByRole('link', { name: new RegExp(`E2E recent A ${stamp}`) }).click()
  await expect(page).toHaveURL(new URL(`/?focus=notes&page=${older}`, baseURL).href)
  await expect(page.getByLabel('Title')).toHaveValue(`E2E recent A ${stamp}`)
  await page.getByLabel('Content').fill('edited')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('All changes saved')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Notes' }).click()
  await expect(links.first()).toHaveText(new RegExp(`E2E recent A ${stamp}`))

  await card.getByRole('button', { name: 'New page' }).click()
  await expect(page).toHaveURL(/\/\?focus=notes&page=\d+$/)
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
})
