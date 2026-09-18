import React from 'react'
import { cn } from '@/lib/format'
import type { Artifact } from '../types'

/* ==========================================================================
   One component per result.

   A result is drawn at three sizes by the same component: the compact card
   inside a message, the pane beside the thread, and the page it links to.
   The page is the widest reading of the same figures, never a second
   implementation of them, so a card and its page cannot drift apart.
   ========================================================================== */

export type CardSize = 'card' | 'pane' | 'page'

export interface CardProps {
  props: Artifact['props']
  size: CardSize
}

/** What a page needs around the view: its heading, its workers, its conversation. */
export interface PageMeta {
  title: string
  subtitle?: React.ReactNode
  /** Agent ids whose work produces the figures. */
  agents?: string[]
  /** What they produce, one clause, lower case. */
  what?: string
  /** The embedded conversation, for pages where decisions are made. */
  thread?: 'approvals' | 'proposals' | 'privacy' | 'workOrders'
}

export interface ArtifactView {
  /** The figures band. The page header strip on a page, the lead of the body elsewhere. */
  Metrics?: React.ComponentType<CardProps>
  Body: React.ComponentType<CardProps>
  /** Present when this view also has a page of its own. */
  page?: PageMeta
}

/** A compact card carries the first rows; a pane and a page carry all of them. */
export const limit = <T,>(rows: T[], size: CardSize, n = 6) => (size === 'card' ? rows.slice(0, n) : rows)

/** How many rows a compact card left out. A count, not a sentence. */
export function More({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null
  return <p className="tnum mt-1.5 text-right text-[10px] text-ink-3">+{total - shown}</p>
}

const COLS: Record<number, string> = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6' }

/** The figures grid: four across inside a card, the full band on a page. */
export function Band({ size, cols = 6, children }: { size: CardSize; cols?: number; children: React.ReactNode }) {
  return (
    <div className={cn('grid gap-3', size === 'page' ? cn('grid-cols-2 gap-4', COLS[cols]) : 'grid-cols-4')}>
      {children}
    </div>
  )
}
