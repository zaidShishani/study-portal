import { useLayoutEffect, useRef } from 'react'
import { motion } from '../theme/tokens'

/** Width from which home is the one-screen grid. */
export const WIDE_QUERY = '(min-width: 1100px)'

type Els = Record<string, HTMLElement | null>

const rect = (el: HTMLElement | null | undefined) => el?.getBoundingClientRect()

/**
 * FLIP for expand in place (Web Animations API). After `focus` changes, the expanded/collapsed card animates
 * from its old rect to its new one; the siblings fade + scale out (in on collapse). `slots` holds empty grid
 * items at each card's cell plus `full` spanning the whole area, so both ends are measurable after the
 * re-render. Narrow screens and reduced motion get an opacity fade only.
 */
export function useExpandFlip(focus: string | undefined, cards: { current: Els }, slots: { current: Els }) {
  const prev = useRef(focus)
  useLayoutEffect(() => {
    const from = prev.current
    prev.current = focus
    // First render (refresh on a focus URL), or a jump from one expanded panel to another: no animation.
    if (from === focus || (from && focus)) return
    const name = (focus ?? from)!
    const card = cards.current[name]
    // jsdom has no element.animate.
    if (!card?.animate) return
    const others = Object.entries(cards.current).flatMap(([k, el]) => (k !== name && el ? [el] : []))

    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia(WIDE_QUERY).matches) {
      for (const el of focus ? [card] : [card, ...others]) el.animate({ opacity: [0, 1] }, { duration: motion.delay })
      return
    }
    const start = rect(focus ? slots.current[name] : slots.current.full)
    const end = card.getBoundingClientRect()
    if (!start) return
    // Width/height rather than scale, so the header stays pinned and nothing stretches.
    card.animate(
      [
        { zIndex: 1, transform: `translate(${start.left - end.left}px, ${start.top - end.top}px)`, width: `${start.width}px`, height: `${start.height}px` },
        { zIndex: 1, transform: 'none', width: `${end.width}px`, height: `${end.height}px` },
      ],
      { duration: motion.expand, easing: motion.easing },
    )
    // The card body is the section's last child (Card: header, body).
    if (focus) card.querySelector(':scope > section > :last-child')?.animate({ opacity: [0, 1] }, { duration: motion.fade, delay: motion.delay, fill: 'backwards' })
    const shown = { opacity: 1, transform: 'none', visibility: 'visible' }
    const hidden = { opacity: 0, transform: 'scale(.98)', visibility: 'hidden' }
    for (const el of others) el.animate(focus ? [shown, hidden] : [hidden, shown], { duration: motion.fade, easing: motion.easing })
  }, [focus, cards, slots])
}
