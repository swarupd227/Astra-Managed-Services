import React from 'react'
import { Archive, BookText, Lock, ShieldCheck, Siren } from 'lucide-react'
import {
  BASIS_LABEL, HOLDS, HOLD_KIND_LABEL, INCIDENT_FLAG_CRIT, INCIDENT_FLAG_LABEL, INCIDENT_KIND_LABEL, INTAKE_LABEL, RECORD_FLAG_CRIT,
  RECORD_FLAG_LABEL, REGIME, REQUESTS, REQUEST_FLAG_CRIT, REQUEST_FLAG_LABEL, REQUEST_KIND_LABEL, REQUEST_STATE_LABEL,
  RETENTION_LABEL, SEARCH_LABEL, SUBJECT_LABEL, privacySummary, readRequest,
  type IncidentReading, type RecordReading, type RequestState, type RetentionState, type SearchVerdict,
} from '@/domain/privacy'
import { useAstra } from '@/domain/store'
import { AGENT_BY_ID } from '@/domain/estate'
import { CATEGORY_LABEL, DATA_ITEM_BY_ID, DATA_KIND_LABEL, SPECIAL_CATEGORIES } from '@/domain/dataEstate'
import { NOW } from '@/domain/workSeed'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { dateShort, dateTime, num } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

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

/** The register read with everything recorded this session, so page, card and tool agree. */
function useSummary() {
  const logged = useAstra((s) => s.privacyLog)
  const notices = useAstra((s) => s.incidentNotices)
  return React.useMemo(() => privacySummary(NOW.getTime(), logged, notices), [logged, notices])
}

const hrs = (h: number) => (Math.abs(h) < 1 ? `${Math.round(Math.abs(h) * 60)} m` : `${Math.abs(h).toFixed(Math.abs(h) < 10 ? 1 : 0)} h`)

function PrivacyMetrics({ size }: CardProps) {
  const s = useSummary()
  const page = size === 'page'
  return (
    <Band size={size} cols={7}>
      <Metric size="sm" label="Open" value={s.open} />
      <Metric size="sm" label="Due ≤ 7 days" value={s.dueSoon} deltaTone={s.dueSoon ? 'warn' : 'ok'} />
      {page && <Metric size="sm" label="Overdue" value={s.overdue} deltaTone={s.overdue ? 'crit' : 'ok'} />}
      <Metric size="sm" label="Search gaps" value={s.withGaps} deltaTone={s.withGaps ? 'warn' : 'ok'} />
      <Metric size="sm" label="Breaches" value={s.breaches} deltaTone={s.breaches ? 'crit' : 'ok'} />
      {page && <Metric size="sm" label="Active holds" value={s.holds.active} hint={`${s.holds.reviewOverdue} review overdue`} deltaTone={s.holds.reviewOverdue ? 'warn' : 'ok'} />}
      {page && <Metric size="sm" label="Incident notice owed" value={s.noticeOwed} deltaTone={s.noticeOwed ? 'warn' : 'ok'} hint={`${REGIME.clientNoticeHrs} h to the client`} />}
    </Band>
  )
}

function PrivacyRequestsBody({ props, size }: CardProps) {
  const s = useSummary()
  const [selected, setSelected] = React.useState(() => s.readings[0]?.request.id ?? '')
  const sel = s.readings.find((r) => r.request.id === selected)

  if (size !== 'page') {
    const shown = limit(s.readings, size)
    return (
      <>
        <Table>
          <thead><tr><Th>Request</Th><Th>State</Th><Th align="right">Due</Th><Th>Flags</Th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <Tr key={r.request.id}>
                <Td className="text-2xs text-ink"><span className="font-mono">{r.request.id}</span><span className="block text-[10px] text-ink-3">{REQUEST_KIND_LABEL[r.request.kind]}</span></Td>
                <Td><Chip tone={STATE_TONE[r.request.state]}>{REQUEST_STATE_LABEL[r.request.state]}</Chip></Td>
                <Td align="right" className={r.open && r.daysLeft <= 7 ? 'tnum text-2xs text-warn' : 'tnum text-2xs text-ink-2'}>{r.open ? `${r.daysLeft} d` : '—'}</Td>
                <Td><div className="flex max-w-[260px] flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone={REQUEST_FLAG_CRIT[f] ? 'crit' : 'warn'}>{REQUEST_FLAG_LABEL[f]}</Chip>)}{!r.flags.length && <span className="text-2xs text-ink-3">—</span>}</div></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <More shown={shown.length} total={s.readings.length} />
      </>
    )
  }

  return (
    <>
      <Card title="Data incidents" subtitle={`${s.incidents.length} incidents · ${REGIME.clientNoticeHrs} h client notice`} right={<Siren size={13} className="text-ink-3" />} className="mb-4">
        <IncidentsTable rows={s.incidents} full />
      </Card>

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
                <Td>
                  <Chip tone={r.request.kind === 'erasure' ? 'warn' : 'brand'}>{REQUEST_KIND_LABEL[r.request.kind]}</Chip>
                  <span className="block text-[10px] text-ink-3">{INTAKE_LABEL[r.request.intake]}</span>
                </Td>
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
          <PrivacyRequestBody props={{ id: sel.request.id }} size="page" />
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

      <Card className="mt-4" title="Records of processing" subtitle={`${s.records.length} activities`} right={<BookText size={13} className="text-ink-3" />}>
        <RecordsTable rows={s.records} full />
        <Unrecorded ids={s.unrecorded.map((u) => u.id)} />
      </Card>
    </>
  )
}

function IncidentsTable({ rows, full }: { rows: IncidentReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Incident</Th>{full && <Th>Detected</Th>}<Th>Client notice</Th>{full && <Th>Client’s regulator clock</Th>}
          {full && <Th>External parties</Th>}<Th>Flags</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <Tr key={x.incident.id} className={x.flags.includes('notice_overdue') ? 'bg-crit/[0.05]' : x.flags.includes('notice_due_soon') ? 'bg-warn/[0.05]' : undefined}>
            <Td className="max-w-[280px] text-2xs text-ink">
              {x.incident.title}
              <span className="block text-[10px] text-ink-3">
                <span className="font-mono">{x.incident.id}</span> · {INCIDENT_KIND_LABEL[x.incident.kind]}
                {x.incident.subjects ? ` · ${num(x.incident.subjects)} people` : ''}{x.incident.closedAt ? ' · closed' : ''}
              </span>
            </Td>
            {full && <Td className="tnum whitespace-nowrap text-2xs text-ink-2">{dateTime(x.incident.detectedAt)}</Td>}
            <Td>
              {x.notice ? (
                <>
                  <Chip tone={x.flags.includes('notice_late') ? 'crit' : 'ok'} className="whitespace-nowrap">Notified · {dateTime(x.notice.at)}</Chip>
                  {full && <span className="block text-[10px] text-ink-3">{who(x.notice.by)} · {x.notice.reference}</span>}
                </>
              ) : (
                <Chip tone={x.hoursLeft !== null && x.hoursLeft < 0 ? 'crit' : 'warn'} className="whitespace-nowrap">
                  {x.hoursLeft !== null && x.hoursLeft < 0 ? `${hrs(x.hoursLeft)} over` : `${hrs(x.hoursLeft ?? 0)} left`}
                </Chip>
              )}
            </Td>
            {full && <Td className="tnum whitespace-nowrap text-2xs text-ink-2">{x.regulatorDueAt ? dateTime(x.regulatorDueAt) : '—'}</Td>}
            {full && (
              <Td>
                <div className="flex max-w-[180px] flex-wrap gap-1">
                  {x.recipients.map((r) => <Chip key={r.id}>{r.party ?? r.name}</Chip>)}
                  {!x.recipients.length && <span className="text-2xs text-ink-3">—</span>}
                </div>
              </Td>
            )}
            <Td>
              <div className="flex max-w-[240px] flex-wrap gap-1">
                {x.flags.map((f) => <Chip key={f} tone={INCIDENT_FLAG_CRIT[f] ? 'crit' : 'warn'}>{INCIDENT_FLAG_LABEL[f]}</Chip>)}
                {!x.flags.length && <span className="text-2xs text-ink-3">—</span>}
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function RecordsTable({ rows, full }: { rows: RecordReading[]; full: boolean }) {
  const party = (id: string) => DATA_ITEM_BY_ID[id]?.party ?? DATA_ITEM_BY_ID[id]?.name ?? id
  return (
    <Table>
      <thead>
        <tr>
          <Th>Activity</Th>{full && <Th>Receives</Th>}<Th>Declared</Th><Th>Reached by lineage</Th>{full && <Th>Transfers</Th>}<Th>DPIA</Th><Th>Flags</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <Tr key={x.record.id} className={x.flags.some((f) => RECORD_FLAG_CRIT[f]) ? 'bg-crit/[0.04]' : undefined}>
            <Td className="max-w-[220px] text-2xs text-ink">
              {x.record.activity}
              <span className="block text-[10px] text-ink-3"><span className="font-mono">{x.record.id}</span> · {BASIS_LABEL[x.record.basis]} · {x.record.owner}</span>
            </Td>
            {full && (
              <Td>
                <div className="flex max-w-[220px] flex-wrap gap-1">
                  {x.record.categories.map((c) => <Chip key={c} tone={SPECIAL_CATEGORIES.includes(c) ? 'crit' : 'neutral'}>{CATEGORY_LABEL[c]}</Chip>)}
                </div>
              </Td>
            )}
            <Td className="text-2xs text-ink-2">{x.record.recipientIds.map(party).join(', ') || '—'}</Td>
            <Td>
              <div className="flex max-w-[200px] flex-wrap gap-1">
                {x.reached.map((r) => <Chip key={r.id} tone={x.undeclared.includes(r) ? 'crit' : 'neutral'}>{r.party ?? r.name}</Chip>)}
                {!x.reached.length && <span className="text-2xs text-ink-3">—</span>}
              </div>
            </Td>
            {full && (
              <Td className="text-2xs text-ink-2">
                {x.record.recipientIds.map((id) => {
                  const d = DATA_ITEM_BY_ID[id]
                  const mech = x.record.transfers[id]
                  return (
                    <span key={id} className="block whitespace-nowrap">
                      {party(id)} · {d?.country ?? '—'} · {mech ?? (d?.country && REGIME.adequate.includes(d.country) ? 'Adequate' : <span className="text-crit">None</span>)}
                    </span>
                  )
                })}
                {!x.record.recipientIds.length && '—'}
              </Td>
            )}
            <Td>
              <Chip tone={x.record.dpia.state === 'done' ? 'ok' : x.special ? 'crit' : 'neutral'} className="whitespace-nowrap">
                {x.record.dpia.state === 'done' ? `Done · ${dateShort(x.record.dpia.at!)}` : x.special ? 'Required' : 'Not required'}
              </Chip>
            </Td>
            <Td>
              <div className="flex max-w-[220px] flex-wrap gap-1">
                {x.flags.map((f) => <Chip key={f} tone={RECORD_FLAG_CRIT[f] ? 'crit' : 'warn'}>{RECORD_FLAG_LABEL[f]}</Chip>)}
                {!x.flags.length && <span className="text-2xs text-ink-3">—</span>}
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

/** External recipients no record declares: a disclosure with nothing written down for it. */
function Unrecorded({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-line pt-2">
      <span className="label-cap mr-1">No record</span>
      {ids.map((id) => <Chip key={id} tone="crit">{DATA_ITEM_BY_ID[id]?.party ?? id} · {DATA_ITEM_BY_ID[id]?.name}</Chip>)}
    </div>
  )
}

function ObligationsMetrics({ size }: CardProps) {
  const s = useSummary()
  return (
    <Band size={size} cols={4}>
      <Metric size="sm" label="Notice owed" value={s.noticeOwed} deltaTone={s.noticeOwed ? 'warn' : 'ok'} />
      <Metric size="sm" label="Notified late" value={s.incidents.filter((i) => i.flags.includes('notice_late')).length} />
      <Metric size="sm" label="Records flagged" value={`${s.records.filter((r) => r.flags.length).length}/${s.records.length}`} />
      <Metric size="sm" label="No record" value={s.unrecorded.length} deltaTone={s.unrecorded.length ? 'crit' : 'ok'} />
    </Band>
  )
}

function ObligationsBody({ props, size }: CardProps) {
  const s = useSummary()
  const full = size !== 'card'
  if (String(props.focus ?? 'incidents') === 'records') {
    const shown = limit(s.records, size)
    return <><RecordsTable rows={shown} full={full} /><More shown={shown.length} total={s.records.length} /><Unrecorded ids={s.unrecorded.map((u) => u.id)} /></>
  }
  const shown = limit(s.incidents, size)
  return <><IncidentsTable rows={shown} full={full} /><More shown={shown.length} total={s.incidents.length} /></>
}

/** One request: what was searched, what was found, what was done. */
function PrivacyRequestBody({ props, size }: CardProps) {
  const id = String(props.id)
  const req = REQUESTS.find((r) => r.id === id)
  const logged = useAstra((s) => s.privacyLog)
  const r = React.useMemo(() => (req ? readRequest(req, NOW.getTime(), logged) : null), [req, logged])
  if (!req || !r) return <span className="text-2xs text-ink-3">—</span>
  const full = size !== 'card'
  const shown = limit(r.items, size, 8)
  if (!r.items.length) return <p className="text-2xs text-ink-3">Nothing searched.</p>

  return (
    <>
      {size !== 'page' && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <Chip tone={req.kind === 'erasure' ? 'warn' : 'brand'}>{REQUEST_KIND_LABEL[req.kind]}</Chip>
          <Chip tone={STATE_TONE[req.state]}>{REQUEST_STATE_LABEL[req.state]}</Chip>
          {r.open && <Chip tone={r.daysLeft <= 7 ? 'warn' : 'neutral'}>{r.daysLeft} d left</Chip>}
          {r.flags.map((f) => <Chip key={f} tone={REQUEST_FLAG_CRIT[f] ? 'crit' : 'warn'}>{REQUEST_FLAG_LABEL[f]}</Chip>)}
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Store</Th>{full && <Th>Class</Th>}<Th>Search</Th><Th align="right">Records</Th>
            {full && <Th>Hold</Th>}<Th>Action</Th>{full && <Th>Backups until</Th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((i) => (
            <Tr key={i.item.id} className={i.verdict === 'not_searched' ? 'bg-crit/[0.04]' : i.verdict === 'unvouched' ? 'bg-warn/[0.05]' : undefined}>
              <Td className="text-2xs text-ink">
                {i.item.name}
                {full
                  ? <span className="block text-[10px] text-ink-3">{DATA_KIND_LABEL[i.item.kind]} · {i.item.platform}</span>
                  : i.holds.length > 0 && <span className="ml-1 font-mono text-[10px] text-warn">{i.holds.map((h) => h.id).join(' ')}</span>}
              </Td>
              {full && <Td className="text-2xs text-ink-2">{i.item.classification ?? <Chip tone="crit">Unclassified</Chip>}</Td>}
              <Td>
                <Chip tone={VERDICT_TONE[i.verdict]}>{SEARCH_LABEL[i.verdict]}</Chip>
                {full && i.verdict === 'unvouched' && i.item.lineage !== 'mapped' && <span className="block text-[10px] text-ink-3">lineage {i.item.lineage}</span>}
              </Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{i.verdict === 'found' ? num(i.records) : '—'}</Td>
              {full && (
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {i.holds.map((h) => <Chip key={h.id} tone="warn" mono>{h.id}</Chip>)}
                    {!i.holds.length && <span className="text-2xs text-ink-3">—</span>}
                  </div>
                </Td>
              )}
              <Td className="text-2xs text-ink-2">
                {i.action ? (
                  <>
                    <Chip tone={i.action.outcome === 'retained' ? 'warn' : 'ok'}>{i.action.outcome}</Chip>
                    {full && (
                      <span className="block text-[10px] text-ink-3">
                        {who(i.action.by)} · {dateShort(i.action.at)}{i.action.evidenceId ? '' : ' · no evidence'}
                      </span>
                    )}
                  </>
                ) : full && i.verdict === 'found' ? <Chip tone="warn">Pending</Chip> : <span className="text-ink-3">—</span>}
              </Td>
              {full && <Td className="tnum text-2xs text-ink-2">{i.residualUntil ? dateShort(i.residualUntil) : '—'}</Td>}
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={r.items.length} />

      {r.recipients.length > 0 && (
        full ? (
          <Table className="mt-3">
            <thead>
              <tr><Th>External recipient</Th><Th>Receives</Th><Th>Via</Th><Th>{req.kind === 'erasure' ? 'Told' : 'Named'}</Th></tr>
            </thead>
            <tbody>
              {r.recipients.map((x) => (
                <Tr key={x.item.id} className={req.kind === 'erasure' && !x.notice ? 'bg-warn/[0.05]' : undefined}>
                  <Td className="text-2xs text-ink">
                    {x.item.name}
                    <span className="block text-[10px] text-ink-3">{x.item.party} · {x.item.transfer}</span>
                  </Td>
                  <Td>
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {(x.item.categories ?? []).map((c) => <Chip key={c} tone={SPECIAL_CATEGORIES.includes(c) ? 'crit' : 'neutral'}>{CATEGORY_LABEL[c]}</Chip>)}
                    </div>
                  </Td>
                  <Td className="text-2xs text-ink-2">{x.via.map((v) => v.name).join(', ')}</Td>
                  <Td>
                    {req.kind !== 'erasure'
                      ? <span className="text-2xs text-ink-3">—</span>
                      : x.notice
                        ? <Chip tone="ok">{who(x.notice.by)} · {dateShort(x.notice.at)}</Chip>
                        : <Chip tone="warn">Not told</Chip>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line pt-2">
            <span className="label-cap mr-1">External recipients</span>
            {r.recipients.map((x) => (
              <Chip key={x.item.id} tone={req.kind === 'erasure' && !x.notice ? 'warn' : 'neutral'}>{x.item.party ?? x.item.name}</Chip>
            ))}
          </div>
        )
      )}
    </>
  )
}

export const privacyRequestsView: ArtifactView = {
  Body: PrivacyRequestsBody,
  Metrics: PrivacyMetrics,
  page: {
    title: 'Privacy requests',
    subtitle: `Incidents, access, erasure and retrieval, holds, retention and records of processing · ${REGIME.name}`,
    agents: ['agt_archivist'],
    what: 'locating personal data across the data estate',
    thread: 'privacy',
  },
}

export const privacyRequestView: ArtifactView = { Body: PrivacyRequestBody }

export const privacyObligationsView: ArtifactView = { Body: ObligationsBody, Metrics: ObligationsMetrics }
