import { Link } from 'react-router-dom'
import { ArrowRight, Check, FileSignature, Gavel, Lightbulb, ShieldQuestion } from 'lucide-react'
import type { AskKind, BriefAsk } from '@/domain/brief'
import { Chip } from './primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   The Needs-You stack (Addendum A §A7.2, D5).

   "Humans never discover their obligations by browsing." One ranked stream of
   everything a person owes the platform — approvals, verifications,
   decisions, obligations, proposals — rather than four queues on four screens.

   The empty state is the brag: nothing needs you, because the workforce is
   running inside its floors.
   ========================================================================== */

export const ASK_META: Record<AskKind, { label: string; icon: typeof Gavel; tone: 'warn' | 'agent' | 'info' | 'crit' | 'brand' }> = {
  approval: { label: 'Approve', icon: Gavel, tone: 'warn' },
  verification: { label: 'Verify', icon: ShieldQuestion, tone: 'agent' },
  decision: { label: 'Decide', icon: FileSignature, tone: 'info' },
  obligation: { label: 'Obligation', icon: FileSignature, tone: 'crit' },
  proposal: { label: 'Proposed', icon: Lightbulb, tone: 'brand' },
}

export function AskRow({ ask, compact }: { ask: BriefAsk; compact?: boolean }) {
  const meta = ASK_META[ask.kind]
  const Icon = meta.icon
  return (
    <Link
      to={ask.to}
      className="group flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 shadow-e1 transition-colors hover:border-brand"
    >
      <Icon size={13} className={cn('mt-0.5 shrink-0', ask.yours ? 'text-brand-ink' : 'text-ink-3')} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip tone={meta.tone}>{meta.label}</Chip>
          {!ask.yours && <Chip tone="neutral">another owner</Chip>}
          {ask.ref && <span className="font-mono text-2xs text-ink-3">{ask.ref}</span>}
        </span>
        <span className="mt-1 block text-xs font-medium leading-snug text-ink group-hover:text-brand-ink">
          {ask.title}
        </span>
        {!compact && <span className="mt-0.5 block text-2xs leading-relaxed text-ink-3">{ask.detail}</span>}
      </span>
      <ArrowRight size={13} className="mt-0.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function NeedsYouStack({
  asks, limit = 8, autonomyPct,
}: {
  asks: BriefAsk[]
  limit?: number
  autonomyPct?: number
}) {
  const yours = asks.filter((a) => a.yours)
  const shown = yours.slice(0, limit)
  const overflow = yours.length - shown.length

  if (yours.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded border border-ok/40 bg-ok/[0.06] px-3 py-2.5">
        <Check size={13} className="mt-px shrink-0 text-ok" />
        <p className="text-2xs leading-relaxed text-ink-2">
          Nothing needs you
          {autonomyPct !== undefined && <> — workforce running at {Math.round(autonomyPct)}% autonomy</>}.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {shown.map((a) => <AskRow key={`${a.kind}-${a.id}`} ask={a} compact />)}
      {overflow > 0 && (
        <Link
          to="/operate/approvals"
          className="group flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-2xs text-ink-2 transition-colors hover:border-brand hover:text-brand-ink"
        >
          <span className="font-medium">{overflow} more</span>
          <span className="text-ink-3">further down the same ranking</span>
          <ArrowRight size={12} className="ml-auto shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
