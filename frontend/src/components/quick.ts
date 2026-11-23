// Helpers for the home cards' inline forms (QuickForms, HomePage checkpoints).

/** 32px inputs (MUI's small is 40). */
export const dense = { '& .MuiInputBase-input': { py: 0.75, fontSize: 13 } }

/** Client-side check for UX; the server stays the authority. */
export const textError = (v: string, max: number) =>
  !v ? 'Required' : !v.trim() ? 'Cannot be blank' : v.length > max ? `Max ${max} characters` : ''

/** Note title = first non-empty line, trimmed, ≤200 chars. */
export const noteTitle = (text: string) => (text.split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 200)
