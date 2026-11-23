import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import Card from './Card'
import ListRow from './ListRow'

afterEach(cleanup)

test('Card shows title as its heading, count, actions and the body', () => {
  render(
    <Card title="Flashcards" count="22 due" actions={<button>Start review</button>}>
      <p>body</p>
    </Card>,
  )
  const section = screen.getByRole('region', { name: 'Flashcards' })
  expect(screen.getByRole('heading', { level: 2, name: 'Flashcards' })).toBeTruthy()
  expect(section.textContent).toContain('22 due')
  expect(screen.getByRole('button', { name: 'Start review' })).toBeTruthy()
  expect(screen.getByText('body')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Expand/ })).toBeNull()
})

test('Card expand button calls onExpand and reflects expanded', () => {
  const onExpand = vi.fn()
  const { rerender } = render(
    <Card title="Notes" onExpand={onExpand}>
      x
    </Card>,
  )
  const expand = screen.getByRole('button', { name: 'Expand Notes' })
  expect(expand.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(expand)
  expect(onExpand).toHaveBeenCalledTimes(1)
  rerender(
    <Card title="Notes" onExpand={onExpand} expanded>
      x
    </Card>,
  )
  expect(screen.getByRole('button', { name: 'Collapse Notes' }).getAttribute('aria-expanded')).toBe('true')
})

test('ListRow is a button only when clickable', () => {
  const onClick = vi.fn()
  render(
    <>
      <ListRow>Static</ListRow>
      <ListRow onClick={onClick}>Two Sum</ListRow>
    </>,
  )
  expect(screen.queryByRole('button', { name: 'Static' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Two Sum' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
