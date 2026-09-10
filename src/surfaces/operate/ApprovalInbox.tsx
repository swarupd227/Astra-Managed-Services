import React from 'react'
import { Info, Smartphone } from 'lucide-react'
import { ACTION_CLASSES } from '@/domain/reference'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { useApprovals } from '@/domain/store'
import { OPERATIONAL } from '@/domain/metrics'
import { ApprovalCard } from './ApprovalCard'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Empty, Metric, selectClass } from '@/ui/primitives'
import { cn, mins, num } from '@/lib/format'

export function ApprovalInbox() {
  const approvals = useApprovals()
  const [tower, setTower] = React.useState('all')
  const [ac, setAc] = React.useState('all')
  const [mobilePreview, setMobilePreview] = React.useState(false)
  const [visible, setVisible] = React.useState(8)

  const filtered = approvals.filter(
    (w) => (tower === 'all' || w.tower === tower) && (ac === 'all' || w.autonomy?.actionClasses.includes(ac)),
  )

  const totalManualMins = approvals.reduce((s, w) => s + w.economics.estManualMins, 0)
  const tier0 = approvals.filter((w) => w.autonomy?.blastRadius.maxTier === 0).length

  return (
    <>
      <PageHeader
        title="Approval Inbox"
        subtitle="Ordered by SLA urgency × blast radius"
        meta={<Chip tone="warn">{approvals.length} awaiting</Chip>}
        actions={
          <>
            <Button size="sm" variant={mobilePreview ? 'primary' : 'ghost'} onClick={() => setMobilePreview((v) => !v)} title="Show the mobile rendering of the same card">
              <Smartphone size={12} /> Mobile
            </Button>
            <select value={ac} onChange={(e) => setAc(e.target.value)} className={cn(selectClass, 'w-[176px]')}>
              <option value="all">All action classes</option>
              {ACTION_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
            </select>
            <select value={tower} onChange={(e) => setTower(e.target.value)} className={cn(selectClass, 'w-[186px]')}>
              <option value="all">All towers</option>
              {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Gates open" value={approvals.length} />
        <Metric size="sm" label="Tier-0 blast radius" value={tier0} deltaTone={tier0 ? 'warn' : 'ok'} />
        <Metric size="sm" label="Manual effort held" value={mins(totalManualMins)} />
        <Metric size="sm" label="Median decision time" value={`${OPERATIONAL.medianDecisionSec}s`} hint="last 30 days" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <Empty
            title="No gates open"
            body="No gated runs waiting."
          />
        ) : (
          <div className={cn('mx-auto grid gap-3', mobilePreview ? 'max-w-[400px]' : 'max-w-4xl')}>
            {filtered.slice(0, visible).map((wo) => (
              <ApprovalCard key={wo.id} wo={wo} compactMode={mobilePreview} />
            ))}
            {filtered.length > visible && (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong bg-surface px-4 py-3">
                <span className="text-2xs text-ink-3">
                  {filtered.length - visible} more gate{filtered.length - visible > 1 ? 's' : ''} in the stack, sorted by urgency × blast radius.
                </span>
                <Button className="ml-auto" size="sm" variant="default" onClick={() => setVisible((v) => v + 8)}>
                  Show next 8
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}
