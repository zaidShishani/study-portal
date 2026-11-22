import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import MarkdownEditor from './MarkdownEditor'

afterEach(cleanup)

test('typing calls onChange with the new value', () => {
  const onChange = vi.fn()
  render(<MarkdownEditor value="" onChange={onChange} label="Notes" />)
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '# Hi' } })
  expect(onChange).toHaveBeenCalledWith('# Hi')
})

test('preview tab renders the markdown', () => {
  render(<MarkdownEditor value="**bold**" onChange={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByText('bold').tagName).toBe('STRONG')
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('preview of empty value shows a placeholder', () => {
  render(<MarkdownEditor value="" onChange={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByText('Nothing to preview')).toBeTruthy()
})
