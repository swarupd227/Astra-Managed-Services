import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/format'

/* ==========================================================================
   One entry, several views.

   Screens that answer the same question were separate entries in the rail,
   which made the platform look like a pile of screens rather than a service.
   They are grouped here instead: one entry, a strip of tabs, and the same
   page components underneath. Their own routes still work and still render
   them alone, so nothing that was linked or bookmarked breaks.
   ========================================================================== */

export interface GroupTab {
  id: string
  label: string
  element: React.ReactNode
}

export function Grouped({ tabs }: { tabs: GroupTab[] }) {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('tab')
  const active = tabs.find((t) => t.id === wanted) ?? tabs[0]

  return (
    <>
      <nav className="flex h-9 shrink-0 items-center gap-0.5 border-b border-line bg-surface px-3" aria-label="Views">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === tabs[0].id ? {} : { tab: t.id }, { replace: true })}
            aria-current={t.id === active.id}
            className={cn(
              'relative h-full px-2.5 text-2xs transition-colors',
              t.id === active.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {t.label}
            {t.id === active.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </nav>
      {active.element}
    </>
  )
}
