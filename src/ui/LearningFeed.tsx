import { GraduationCap } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { LESSON_KIND_LABEL } from '@/domain/teaching'
import { AgentChip, EvidenceLink } from './domain'
import { Chip, Empty } from './primitives'
import { ago } from '@/lib/format'

/* ==========================================================================
   What the workforce has been taught (D8, AG-12).

   The addendum's test is not that a correction is stored — it is that the
   human sees it absorbed, with its blast radius. Every row here is a real
   correction with a reach the store computed at the time it was taught.
   ========================================================================== */

export function LearningFeed({ limit, className }: { limit?: number; className?: string }) {
  const lessons = useAstra((s) => s.lessons)
  const shown = limit ? lessons.slice(0, limit) : lessons

  if (!shown.length) {
    return (
      <Empty
        title="Nothing taught yet"
        body="No corrections yet."
      />
    )
  }

  return (
    <ul className={className}>
      {shown.map((l) => (
        <li key={l.id} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-b-0">
          <GraduationCap size={13} className="mt-0.5 shrink-0 text-ok" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="ok">{LESSON_KIND_LABEL[l.kind]}</Chip>
              <AgentChip id={l.agentId} />
              <span className="text-2xs text-ink-3">taught by {l.taughtBy}</span>
              <span className="ml-auto text-2xs text-ink-3">{ago(l.at)}</span>
            </div>
            <p className="mt-1 text-xs leading-snug text-ink">{l.correction}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs leading-relaxed text-ink-2">
              <span className="min-w-0 flex-1">{l.absorbed}</span>
              {l.evidenceId && <EvidenceLink id={l.evidenceId} compactMode />}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
