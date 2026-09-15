import React from 'react'
import { Archive, Lock, ShieldCheck } from 'lucide-react'
import {
  HOLDS, HOLD_KIND_LABEL, REGIME, REQUEST_FLAG_CRIT, REQUEST_FLAG_LABEL, REQUEST_KIND_LABEL, REQUEST_STATE_LABEL,
  RETENTION_LABEL, SEARCH_LABEL, SUBJECT_LABEL, privacySummary,
  type RequestState, type RetentionState, type SearchVerdict,
} from '@/domain/privacy'
import { AGENT_BY_ID } from '@/domain/estate'
import { DATA_ITEM_BY_ID, DATA_KIND_LABEL } from '@/domain/dataEstate'
import { NOW } from '@/domain/workSeed'
import { ThreadPanel } from '@/workspace/ThreadPanel'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { dateShort, num } from '@/lib/format'

/* ==========================================================================
   Privacy requests.

   The request list runs against the statutory clock. The selected request
   shows every store a person's data could be in, what the search found in
   each and whether a nil result can be believed, the hold on it, and what
   was done. Holds and retention sit below, since both decide what an
   erasure may touch.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const STATE_TONE: Record<RequestState, Tone> = {
  verifying_identity: 'neutral', locating: 'info', awaiting_approval: 'warn', fulfilling: 'agent', closed: 'ok', refused: 'neutral',
}
const VERDICT_TONE: Record<SearchVerdict, Tone> = { found: 'brand', none: 'ok', unvouched: 'warn', not_searched: 'crit' }
const RETENTION_TONE: Record<RetentionState, Tone> = { within: 'ok', past: 'crit', held: 'warn', unscheduled: 'neutral' }

const who = (by: string) => AGENT_BY_ID[by]?.name ?? by

export function PrivacyRequests() {
  const s = React.useMemo(() => privacySummary(), [])
  const [selected, setSelected] = React.useState(() => s.readings[0]?.request.id ?? '')
  const sel = s.readings.find((r) => r.request.id === selected)

  return (
    <>
      <PageHeader title="Privacy requests" subtitle={`Access, erasure and retrieval · ${REGIME.name} · ${REGIME.responseDays} days`} />

      <ProducedBy agents={['agt_archivist']} what="locating personal data across the data estate" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-6">
        <Metric size="sm" label="Open" value={s.open} />
        <Metric size="sm" label="Due ≤ 7 days" value={s.dueSoon} deltaTone={s.dueSoon ? 'warn' : 'ok'} />
        <Metric size="sm" label="Overdue" value={s.overdue} deltaTone={s.overdue ? 'crit' : 'ok'} />
        <Metric size="sm" label="Search gaps" value={s.withGaps} deltaTone={s.withGaps ? 'warn' : 'ok'} />
        <Metric size="sm" label="Breaches" value={s.breaches} deltaTone={s.breaches ? 'crit' : 'ok'} />
        <Metric size="sm" label="Active holds" value={s.holds.active} hint={`${s.holds.reviewOverdue} review overdue`} deltaTone={s.holds.reviewOverdue ? 'warn' : 'ok'} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Requests" subtitle={`${s.readings.length} requests`} right={<ShieldCheck size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Request</Th><Th>Kind</Th><Th>Subject</Th><Th>Received</Th><Th align="right">Due</Th>
                <Th>State</Th><Th align="right">Stores found</Th><Th>Flags</Th>
              </tr>
            </thead>
            <tbody>
              {s.readings.map((r) => (
                <Tr key={r.request.id} onClick={() => setSelected(r.request.id)} selected={r.request.id === selected}>
                  <Td className="font-mono text-2xs text-ink">{r.request.id}</Td>
                  <Td><Chip tone={r.request.kind === 'erasure' ? 'warn' : 'brand'}>{REQUEST_KIND_LABEL[r.request.kind]}</Chip></Td>
                  <Td className="text-2xs text-ink-2">
                    <span className="font-mono">{r.request.subject}</span>
                    <span className="block text-[10px] text-ink-3">{SUBJECT_LABEL[r.request.subjectType]}</span>
                  </Td>
                  <Td className="tnum text-2xs text-ink-2">{dateShort(r.request.receivedAt)}</Td>
                  <Td align="right" className="tnum text-2xs">
                    {r.open
                      ? <span className={r.daysLeft < 0 ? 'text-crit' : r.daysLeft <= 7 ? 'text-warn' : 'text-ink-2'}>{r.daysLeft < 0 ? `${-r.daysLeft} d over` : `${r.daysLeft} d`}</span>
                      : <span className="text-ink-3">{dateShort(r.request.closedAt ?? r.dueAt)}</span>}
                    {r.request.extended && <span className="block text-[10px] text-ink-3">extended</span>}
                  </Td>
                  <Td><Chip tone={STATE_TONE[r.request.state]}>{REQUEST_STATE_LABEL[r.request.state]}</Chip></Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{r.items.filter((i) => i.verdict === 'found').length || '—'}</Td>
                  <Td>
                    <div className="flex max-w-[280px] flex-wrap gap-1">
                      {r.flags.map((f) => <Chip key={f} tone={REQUEST_FLAG_CRIT[f] ? 'crit' : 'warn'}>{REQUEST_FLAG_LABEL[f]}</Chip>)}
                      {!r.flags.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {sel && (
          <Card
            className="mt-4"
            title={`${sel.request.id} · ${REQUEST_KIND_LABEL[sel.request.kind]}`}
            subtitle={`${sel.request.subject} · ${sel.request.approvedBy ? `approved by ${sel.request.approvedBy}` : 'not approved'}${sel.request.refusal ? ` · refused: ${sel.request.refusal}` : ''}`}
            right={<Chip tone={sel.gaps.length ? 'warn' : 'ok'}>{sel.items.length - sel.gaps.length}/{sel.items.length} stores vouched</Chip>}
          >
            {sel.items.length === 0 ? (
              <p className="text-2xs text-ink-3">Nothing searched.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Store</Th><Th>Class</Th><Th>Search</Th><Th align="right">Records</Th><Th>Hold</Th><Th>Action</Th><Th>Backups until</Th>
                  </tr>
                </thead>
                <tbody>
                  {sel.items.map((i) => (
                    <Tr key={i.item.id} className={i.verdict === 'not_searched' ? 'bg-crit/[0.04]' : i.verdict === 'unvouched' ? 'bg-warn/[0.05]' : undefined}>
                      <Td className="text-2xs text-ink">
                        {i.item.name}
                        <span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[i.item.kind]} · {i.item.platform}</span>
                      </Td>
                      <Td className="text-2xs text-ink-2">{i.item.classification ?? <Chip tone="crit">Unclassified</Chip>}</Td>
                      <Td>
                        <Chip tone={VERDICT_TONE[i.verdict]}>{SEARCH_LABEL[i.verdict]}</Chip>
                        {i.verdict === 'unvouched' && i.item.lineage !== 'mapped' && <span className="block text-[10px] text-ink-3">lineage {i.item.lineage}</span>}
                      </Td>
                      <Td align="right" className="tnum text-2xs text-ink-2">{i.verdict === 'found' ? num(i.records) : '—'}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {i.holds.map((h) => <Chip key={h.id} tone="warn" mono>{h.id}</Chip>)}
                          {!i.holds.length && <span className="text-2xs text-ink-3">—</span>}
                        </div>
                      </Td>
                      <Td className="text-2xs text-ink-2">
                        {i.action ? (
                          <>
                            <Chip tone={i.action.outcome === 'retained' ? 'warn' : 'ok'}>{i.action.outcome}</Chip>
                            <span className="block text-[10px] text-ink-3">
                              {who(i.action.by)} · {dateShort(i.action.at)}{i.action.evidenceId ? '' : ' · no evidence'}
                            </span>
                          </>
                        ) : i.verdict === 'found' ? <Chip tone="warn">Pending</Chip> : <span className="text-ink-3">—</span>}
                      </Td>
                      <Td className="tnum text-2xs text-ink-2">{i.residualUntil ? dateShort(i.residualUntil) : '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title="Holds" subtitle={`${HOLDS.length} holds`} right={<Lock size={13} className="text-ink-3" />}>
            <Table>
              <thead>
                <tr><Th>Hold</Th><Th>Stores</Th><Th>Covers</Th><Th align="right">Review</Th><Th>State</Th></tr>
              </thead>
              <tbody>
                {HOLDS.map((h) => {
                  const overdue = !h.releasedAt && Date.parse(h.reviewBy) < NOW.getTime()
                  return (
                    <Tr key={h.id}>
                      <Td className="max-w-[220px] text-2xs text-ink">
                        {h.matter}
                        <span className="block text-[10px] text-ink-3"><span className="font-mono">{h.id}</span> · {HOLD_KIND_LABEL[h.kind]} · {h.placedBy}</span>
                      </Td>
                      <Td className="max-w-[180px] text-2xs text-ink-2">
                        {h.itemIds.map((id) => <span key={id} className="block truncate">{DATA_ITEM_BY_ID[id]?.name ?? id}</span>)}
                      </Td>
                      <Td className="text-2xs text-ink-2">{h.subjects ? h.subjects.join(', ') : 'All records'}</Td>
                      <Td align="right" className={overdue ? 'tnum whitespace-nowrap text-2xs text-crit' : 'tnum whitespace-nowrap text-2xs text-ink-2'}>{dateShort(h.reviewBy)}</Td>
                      <Td>
                        {h.releasedAt
                          ? <Chip className="whitespace-nowrap">released</Chip>
                          : <Chip tone={overdue ? 'crit' : 'warn'} className="whitespace-nowrap">{overdue ? 'review overdue' : 'active'}</Chip>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>

          <Card title="Retention" subtitle={`${s.retention.length} stores`} right={<Archive size={13} className="text-ink-3" />}>
            <Table>
              <thead>
                <tr><Th>Store</Th><Th align="right">Schedule</Th><Th align="right">Oldest</Th><Th>State</Th></tr>
              </thead>
              <tbody>
                {s.retention.map((r) => (
                  <Tr key={r.item.id}>
                    <Td className="text-2xs text-ink">
                      {r.item.name}
                      <span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[r.item.kind]} · {r.item.classification ?? 'unclassified'}</span>
                    </Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{r.item.retentionDays ? `${num(r.item.retentionDays)} d` : '—'}</Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{r.item.oldestRecordDays ? `${num(r.item.oldestRecordDays)} d` : '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Chip tone={RETENTION_TONE[r.state]}>{RETENTION_LABEL[r.state]}</Chip>
                        {r.overDays > 0 && <Chip tone={RETENTION_TONE[r.state]}>{num(r.overDays)} d over</Chip>}
                        {r.state === 'held' && r.holds.map((h) => <Chip key={h.id} mono>{h.id}</Chip>)}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
      <ThreadPanel id="privacy" />
    </>
  )
}
