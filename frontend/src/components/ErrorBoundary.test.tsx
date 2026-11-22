import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('boom')
}

test('shows the message instead of blanking when a child throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {}) // React logs caught render errors
  render(
    <ErrorBoundary message="Tree failed">
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert').textContent).toBe('Tree failed')
})
