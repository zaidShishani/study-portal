import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import MarkdownView from './MarkdownView'

afterEach(cleanup)

test('renders GFM tables and lists', () => {
  render(<MarkdownView>{'| a | b |\n|---|---|\n| 1 | 2 |\n\n- one\n- [x] done'}</MarkdownView>)
  expect(screen.getByRole('table')).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'a' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '2' })).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByRole('checkbox')).toBeTruthy()
})

test('shows raw HTML as text instead of rendering it', () => {
  const { container } = render(
    <MarkdownView>{'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'}</MarkdownView>,
  )
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('[onerror]')).toBeNull()
  expect(container.textContent).toContain('<script>alert(1)</script>')
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  // Each HTML block is its own paragraph.
  expect(container.querySelectorAll('p')).toHaveLength(2)
})

test('in-page anchors stay in the same tab', () => {
  render(<MarkdownView>{'[top](#top)'}</MarkdownView>)
  const link = screen.getByRole('link', { name: 'top' })
  expect(link.getAttribute('href')).toBe('#top')
  expect(link.getAttribute('target')).toBeNull()
  expect(link.getAttribute('rel')).toBeNull()
})

test('strips javascript: hrefs', () => {
  render(<MarkdownView>{'[x](javascript:alert(1))'}</MarkdownView>)
  expect(screen.getByText('x').closest('a')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
})

test('links open in a new tab with safe rel', () => {
  render(<MarkdownView>{'[site](https://example.com)'}</MarkdownView>)
  const link = screen.getByRole('link', { name: 'site' })
  expect(link.getAttribute('href')).toBe('https://example.com')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})
