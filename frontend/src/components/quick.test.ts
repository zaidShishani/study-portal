import { expect, test } from 'vitest'
import { noteTitle, textError } from './quick'

test('noteTitle: first non-empty line, trimmed, 200 code points (never half an emoji)', () => {
  expect(noteTitle('\n   \n  Hello  \nworld')).toBe('Hello')
  const title = noteTitle(`${'a'.repeat(199)}😀b`)
  expect(title).toBe(`${'a'.repeat(199)}😀`)
  expect(Array.from(title)).toHaveLength(200)
  // No lone surrogate left at the end.
  expect(encodeURIComponent(title)).toBeTruthy() // throws URIError on a lone surrogate
  expect(noteTitle(`${'a'.repeat(199)} b`)).toBe('a'.repeat(199))
})

test('textError: required, blank, max', () => {
  expect(textError('', 5)).toBe('Required')
  expect(textError('  ', 5)).toBe('Cannot be blank')
  expect(textError('123456', 5)).toBe('Max 5 characters')
  expect(textError('ok', 5)).toBe('')
})
