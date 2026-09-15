import type { Artifact } from '../types'

export interface CardProps {
  props: Artifact['props']
  size: 'card' | 'pane'
}

/** How many rows a compact card left out. A count, not a sentence. */
export function More({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null
  return <p className="tnum mt-1.5 text-right text-[10px] text-ink-3">+{total - shown}</p>
}
