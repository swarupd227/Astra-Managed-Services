import React from 'react'
import { Link } from 'react-router-dom'
import { FileDown, Gavel, Timer } from 'lucide-react'
import { CLOCK_AUDIT, SLAS, clockElapsedMins, clockPausedMins } from '@/domain/ledgers'
import { TOWER_BY_ID } from '@/domain/estate'
import { useAstra, useOpenWork } from '@/domain/store'
import { PageHeader, PriorityChip, SlaClock } from '@/ui/domain'
import { Button, Card, Chip, Drawer, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { Gauge } from '@/ui/charts'
import { clock, cn, dateTime, mins, num, pct } from '@/lib/format'
import type { SlaSpec } from '@/domain/types'
import { OPERATIONAL } from '@/domain/metrics'
import { ProducedBy } from '@/ui/ProducedBy'


function AttainmentCell({ s }: { s: SlaSpec }) {
  const ok = s.attainmentMtd >= s.attainmentTarget
  const near = !ok && s.attainmentMtd >= s.attainmentTarget - 1.5
  return (
    <span className={cn('tnum font-medium', ok ? 'text-ok' : near ? 'text-warn' : 'text-crit')}>
      {s.metric === 'availability' ? s.attainmentMtd.toFixed(2) : s.attainmentMtd.toFixed(1)}
      <span className="ml-1 font-normal text-ink-3">/ {s.attainmentTarget}</span>
    </span>
  )
}

export function SlaCompliance() {
  const open = useOpenWork()
  const pushToast = useAstra((s) => s.pushToast)
  const [kind, setKind] = React.useState<'sla' | 'xla' | 'ola'>('sla')
  const [auditOpen, setAuditOpen] = React.useState(false)
  const [disputeOpen, setDisputeOpen] = React.useState(false)

  const list = SLAS.filter((s) => s.kind === kind)
  const jeopardy = open
    .filter((w) => w.breachProbability > 0.5)
    .sort((a, b) => b.breachProbability - a.breachProbability)
    .slice(0, 14)

  const creditPct = SLAS.filter((s) => s.kind === 'sla' && s.attainmentMtd < s.attainmentTarget)
    .reduce((sum, s) => {
      const band = s.credit.find((c) => {
        const [lo, hi] = c.band.replace('%', '').split('–').map((x) => parseFloat(x.replace('<', '')))
        return Number.isNaN(hi) ? s.attainmentMtd < lo : s.attainmentMtd >= lo && s.attainmentMtd < hi
      })
      return sum + (band?.pct ?? 0)
    }, 0)

  return (
    <>
      <PageHeader
        title="SLA & XLA Compliance"
        subtitle="Month to date · America/Chicago business calendar"
        actions={
          <>
            <Button size="sm" variant="default" onClick={() => setAuditOpen(true)}><Timer size={12} /> Clock audit</Button>
            <Button size="sm" variant="default" onClick={() => setDisputeOpen(true)}><Gavel size={12} /> Dispute workspace</Button>
            <Button size="sm" variant="primary" onClick={() => pushToast({ title: 'Signed extract issued', body: 'SLA compliance & credits statement, hashed and versioned. Finance consumes it directly.', tone: 'ok', evidenceId: 'ev_ext_2027_02' })}>
              <FileDown size={12} /> Issue statement
            </Button>
          </>
        }
      />

      <ProducedBy
        agents={["agt_sentinel", "agt_herald"]}
        what="validating each clock event and computing the credits that follow from them"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="SLAs attaining" value={`${SLAS.filter((s) => s.kind === 'sla' && s.attainmentMtd >= s.attainmentTarget).length} / ${SLAS.filter((s) => s.kind === 'sla').length}`} />
        <Metric size="sm" label="XLAs attaining" value={`${SLAS.filter((s) => s.kind === 'xla' && s.attainmentMtd >= s.attainmentTarget).length} / ${SLAS.filter((s) => s.kind === 'xla').length}`} deltaTone="warn" />
        <Metric size="sm" label="In jeopardy now" value={jeopardy.length} deltaTone={jeopardy.length ? 'warn' : 'ok'} hint="predicted breach > 50%" />
        <Metric size="sm" label="Credit position MTD" value={`${creditPct.toFixed(0)}%`} unit="of MRC" deltaTone={creditPct ? 'crit' : 'ok'} />
        <Metric size="sm" label="Disputes open" value={OPERATIONAL.openDisputes} hint={`${OPERATIONAL.disputeFirstReviewClosure}% closed at first review`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Attainment matrix"
          subtitle="Month to date against target"
          right={<Tabs value={kind} onChange={setKind} tabs={[{ id: 'sla', label: 'SLA', count: SLAS.filter((s) => s.kind === 'sla').length }, { id: 'xla', label: 'XLA', count: SLAS.filter((s) => s.kind === 'xla').length }, { id: 'ola', label: 'OLA / SIAM', count: SLAS.filter((s) => s.kind === 'ola').length }]} />}
        >
          <Table>
            <thead>
              <tr>
                <Th>Measure</Th>
                <Th>Tower</Th>
                <Th align="right">Target</Th>
                <Th align="right">Attainment MTD</Th>
                <Th align="right">Volume</Th>
                <Th align="right">Breaches</Th>
                <Th>Headroom</Th>
                <Th>Credit exposure</Th>
                <Th>Earnback</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-ink">{s.name}</Td>
                  <Td>{TOWER_BY_ID[s.tower]?.name}</Td>
                  <Td align="right">{s.targetMins ? mins(s.targetMins) : '—'}</Td>
                  <Td align="right"><AttainmentCell s={s} /></Td>
                  <Td align="right">{num(s.volumeMtd)}</Td>
                  <Td align="right" className={s.breachesMtd ? 'text-warn' : ''}>{s.breachesMtd}</Td>
                  <Td>
                    {s.headroom > 0 ? (
                      <span className="text-2xs text-ink-2">{s.headroom} more breach{s.headroom > 1 ? 'es' : ''} and still attain</span>
                    ) : (
                      <span className="text-2xs text-crit">no headroom left this month</span>
                    )}
                  </Td>
                  <Td>
                    {s.attainmentMtd >= s.attainmentTarget ? (
                      <Chip tone="ok">none</Chip>
                    ) : (
                      <Chip tone="crit">{s.credit[0].pct}% MRC band</Chip>
                    )}
                  </Td>
                  <Td className="max-w-[200px] truncate text-2xs text-ink-3" title={s.earnback}>{s.earnback}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card title="Predictive jeopardy" subtitle="Predicted breach risk with the policy response">
            <Table>
              <thead>
                <tr>
                  <Th>Ref</Th>
                  <Th>Work object</Th>
                  <Th>Pri</Th>
                  <Th align="right">Breach probability</Th>
                  <Th>Clock</Th>
                  <Th>Policy response</Th>
                </tr>
              </thead>
              <tbody>
                {jeopardy.map((w) => (
                  <Tr key={w.id}>
                    <Td className="font-mono text-ink-2">{w.ref}</Td>
                    <Td className="max-w-[280px] truncate">
                      <Link to={`/operate/work/${w.id}`} className="text-ink hover:text-brand-ink hover:underline">{w.title}</Link>
                    </Td>
                    <Td><PriorityChip p={w.priority} /></Td>
                    <Td align="right" className={w.breachProbability > 0.75 ? 'text-crit' : 'text-warn'}>{pct(w.breachProbability * 100, 0)}</Td>
                    <Td className="w-[92px]"><SlaClock elapsed={w.slaElapsedMins} target={w.slaTargetMins} paused={w.slaPaused} compactMode /></Td>
                    <Td className="text-2xs text-ink-3">
                      {w.breachProbability > 0.75 ? 'Senior routing + raised autonomy urgency within safe classes' : 'Priority escalation queued'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="space-y-4">
            <Card title="Pause discipline" subtitle="Clock pauses and reclassifications">
              <div className="flex items-center justify-around">
                <Gauge value={3.1} target={5} label="% of clock time paused" />
                <div className="text-2xs leading-relaxed text-ink-3">
                  <p>Pauses require a typed reason and, where policy demands, client acknowledgement.</p>
                  <p className="mt-2">Pause abuse is itself a reported metric. Reclassification after intake needs dual confirmation and is reported separately.</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-2xs">
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Paused work objects now</dt><dd className="tnum text-ink-2">{open.filter((w) => w.slaPaused).length}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Median pause duration</dt><dd className="tnum text-ink-2">1h 52m</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Pauses without acknowledgement</dt><dd className="tnum text-ok">0</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Post-intake reclassifications</dt><dd className="tnum text-ink-2">4 · all dual-confirmed</dd></div>
              </dl>
            </Card>

            <Card title="Contract as configuration" subtitle="The dispute battlegrounds, made explicit">
              <pre className="overflow-x-auto rounded border border-line bg-sunken p-2.5 font-mono text-[10px] leading-relaxed text-ink-2">
{`sla: INC_P2_RESOLUTION (tower: twr_payments) {
  metric: resolution_time  target: 4h
  attainment: 95% monthly
  clock: {
    start: validated_priority_set
    stop:  resolution_confirmed
    pauses: [awaiting_client(cap 8h/wo),
             vendor_dependency(logged),
             change_freeze_client_initiated]
    calendar: client_biz_hours(America/Chicago)
    holidays: client_set }
  priority_matrix: impact x urgency (client-approved v3)
  exclusions: [declared_MI_secondary_tickets]
  credit: tiered {94-95%: 2% MRC,
                  90-94%: 4%, <90%: 7%}
  earnback: 3 consecutive months >= 97%
  evidence: clock_audit_required }`}
              </pre>
            </Card>
          </div>
        </div>
      </div>

      <Drawer open={auditOpen} onClose={() => setAuditOpen(false)} title={`Clock audit — ${CLOCK_AUDIT.workObjectRef}`} subtitle={CLOCK_AUDIT.sla} width="max-w-[640px]">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <Metric size="sm" label="Target" value={clock(CLOCK_AUDIT.targetMins)} />
            <Metric size="sm" label="Clock elapsed" value={clock(clockElapsedMins())} hint={`${clock(clockPausedMins())} paused, excluded`} />
            <Metric size="sm" label="Verdict" value={clockElapsedMins() <= CLOCK_AUDIT.targetMins ? 'attained' : 'breached'} />
          </div>
          <ol className="mt-4 space-y-2">
            {CLOCK_AUDIT.events.map((e) => (
              <li key={e.evidence} className="flex gap-2.5 rounded border border-line bg-sunken p-2.5">
                <Chip tone={e.event === 'pause' ? 'warn' : e.event === 'clock_stop' ? 'ok' : 'neutral'} mono>{e.event}</Chip>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-2xs text-ink-3">{dateTime(e.at)}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-2">{e.detail}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-ink-3">{e.evidence}</span>
              </li>
            ))}
          </ol>
        </div>
      </Drawer>

      <Drawer open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Dispute workspace" subtitle="dsp_2027_003 · P2 breach, Zero Trust rollout, 09 February" width="max-w-[680px]">
        <div className="space-y-4 p-4">
          <div className="rounded border border-line bg-sunken p-3">
            <div className="label-cap">Position</div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
              Client asserts the clock should have paused during a vendor dependency on the Cisco SASE inspection engine. Artizent's
              position is that the dependency was not logged at the time and the pause rule requires a logged reference.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-line p-3">
              <div className="label-cap">Contract clause</div>
              <p className="mt-1.5 font-mono text-2xs leading-relaxed text-ink-2">pauses: [vendor_dependency(logged)]</p>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">Schedule B, clause 8.3.2 — a vendor pause requires the third-party reference recorded at the time of the pause.</p>
            </div>
            <div className="rounded border border-line p-3">
              <div className="label-cap">Evidence</div>
              <ul className="mt-1.5 space-y-1 font-mono text-2xs text-ink-3">
                <li>ev_clk_0388 · clock_start 09:04</li>
                <li>ev_clk_0391 · no pause event recorded</li>
                <li>ev_act_1140 · Cisco vendor ticket raised 11:52 (2h 48m later)</li>
                <li>ev_clk_0396 · clock_stop 14:12 — 5h 08m against 4h</li>
              </ul>
            </div>
          </div>
          <div className="rounded border border-info/35 bg-info/[0.06] p-3">
            <div className="label-cap">Platform observation</div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
              The Cisco ticket exists but was raised after the fact. Under SIAM attribution, 2h 20m of the elapsed time is attributable
              to the third party regardless of the pause question — which gives the client a factual basis in its own carrier
              negotiation rather than leaving both parties to argue about ours.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => { setDisputeOpen(false); pushToast({ title: 'Resolution recorded', body: 'Rationale attached. Precedent added — this pattern will be pre-decided next time.', tone: 'ok' }) }}>Record resolution</Button>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Close</Button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
