import React from 'react'
import { Sparkles } from 'lucide-react'
import { Drawer } from '@/ui/primitives'
import { cn } from '@/lib/format'
import { useWorkspace } from './store'
import { VIEW_THREADS } from './threads'
import { ThreadView } from './Workspace'

/**
 * A conversation embedded in a page where decisions are made. It is the same
 * thread as any other, scoped to the page, and it never replaces the page.
 */
export function ThreadPanel({ id }: { id: keyof typeof VIEW_THREADS }) {
  const def = VIEW_THREADS[id]
  const [open, setOpen] = React.useState(false)
  const busy = useWorkspace((s) => Boolean(s.threads[def.id]?.running))
  const waiting = useWorkspace((s) => Boolean(s.threads[def.id]?.pending))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="thread-panel-open"
        className={cn(
          'fixed bottom-4 right-4 z-40 flex h-9 items-center gap-2 rounded-full border bg-surface px-3.5 text-xs text-ink shadow-pop transition-colors hover:border-ink-3',
          waiting ? 'border-warn/60' : 'border-line-strong',
        )}
      >
        <Sparkles size={13} className={cn(busy ? 'animate-pulse text-brand-ink' : 'text-ink-2')} />
        Ask about {def.title.toLowerCase()}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={def.title} subtitle="Conversation" width="max-w-[520px]">
        <div className="flex h-full min-h-0 flex-col">
          <ThreadView def={def} compact />
        </div>
      </Drawer>
    </>
  )
}
