import React from 'react'
import { Link } from 'react-router-dom'
import { Bell, FileSearch, FlaskConical, ShieldAlert, TriangleAlert, Users } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { NOW } from '@/domain/workSeed'
import { COHORTS } from '@/domain/cohortSeed'
import { INCIDENT_CLASS_META, cohortMonitor, type AiIncident } from '@/domain/aiIncident'
import { PageHeader, AgentChip, EvidenceLink } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, pct } from '@/lib/format'

/* ==========================================================================
   AI Incidents — what the detectors found, and the two clocks the contract
   runs on each: notify within 24 hours, root-cause analysis within five
   business days. The oversight audit and the cohort monitor live here too,
   because they are the detectors an operator runs rather than the runtime.
   ========================================================================== */

const STATE_TONE: Record<AiIncident['state'], 'crit' | 'warn' | 'info' | 'ok'> = { open: 'crit', notified: 'warn', rca_published: 'info', closed: 'ok' }
const SEVERITY_TONE: Record<AiIncident['severity'], 'crit' | 'warn' | 'neutral'> = { P1: 'crit', P2: 'warn', P3: 'neutral' }

function remaining(dueAt: string, now: Date): { text: string; overdue: boolean } {
  const ms = new Date(dueAt).getTime() - now.getTime()
  const overdue = ms < 0
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3600000), m = Math.floor((abs % 3600000) / 60000)
  const text = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}m`
  return { text: overdue ? `${text} overdue` : text, overdue }
}

export function AiIncidents() {
  const incidents = useAstra((s) => s.aiIncidents)
  const audit = useAstra((s) => s.oversightAudit)
  const work = useAstra((s) => s.work)
  const clockOffset = useAstra((s) => s.clockOffsetMins)
  const notify = useAstra((s) => s.notifyAiIncident)
  const publishRca = useAstra((s) => s.publishRca)
  const close = useAstra((s) => s.closeAiIncident)
  const runAudit = useAstra((s) => s.runOversightAudit)
  const simulate = useAstra((s) => s.simulateOversightFailure)
  const raise = useAstra((s) => s.raiseAiIncident)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const now = new Date(NOW.getTime() + clockOffset * 60000)

  const open = incidents.filter((i) => i.state !== 'closed')
  const notifyOverdue = incidents.filter((i) => i.state === 'open' && new Date(i.notifyDueAt) < now)
  const rcaOverdue = incidents.filter((i) => (i.state === 'open' || i.state === 'notified') && new Date(i.rcaDueAt) < now)
  const report = React.useMemo(() => cohortMonitor(Object.values(work), COHORTS), [work])
  const flagged = report.cohorts.filter((c) => c.flagged)

  const rca = (i: AiIncident) => {
    const summary = window.prompt(`Root-cause analysis for ${i.id}. One paragraph: cause, corrective action, owner.`)
    if (summary?.trim()) publishRca(i.id, role.person, summary.trim())
  }

  return (
    <>
      <PageHeader
        title="AI Incidents"
        subtitle="Four classes, one detector each — with the notification and RCA clocks the contract sets"
        actions={
          <Button size="sm" variant="default" disabled={!role.canApprove} onClick={() => runAudit(role.person)}>
            <FileSearch size={12} /> Run oversight audit
          </Button>
        }
      />

      <ProducedBy agents={['agt_sentinel']} what="the detectors — groundedness, tool anomaly, the gateway classifiers, the chain audit and the cohort monitor" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Open incidents" value={open.length} deltaTone={open.length ? 'warn' : 'ok'} hint={`${incidents.length} in total`} />
        <Metric size="sm" label="Notification overdue" value={notifyOverdue.length} deltaTone={notifyOverdue.length ? 'crit' : 'ok'} hint="24-hour clock" />
        <Metric size="sm" label="RCA overdue" value={rcaOverdue.length} deltaTone={rcaOverdue.length ? 'crit' : 'ok'} hint="five business days" />
        <Metric size="sm" label="Oversight audit" value={audit ? `${audit.failures.length} / ${audit.checked}` : '—'} deltaTone={audit ? (audit.failures.length ? 'crit' : 'ok') : undefined} hint={audit ? `failures / actions checked · ${audit.at.slice(0, 16).replace('T', ' ')}` : 'not yet run'} />
        <Metric size="sm" label="Cohorts flagged" value={`${flagged.length} / ${report.cohorts.length}`} deltaTone={flagged.length ? 'warn' : 'ok'} hint={`|z| ≥ ${report.threshold}, n ≥ ${report.minN}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Incident register" subtitle="Every detection, its clocks, and what has been done about it">
          {incidents.length === 0 ? (
            <Empty title="No AI Incidents recorded" body="Detectors run inline on every proposal and at the gateway. Run the oversight audit, or use the demonstration control below, to see one raised." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Incident</Th>
                  <Th>Class</Th>
                  <Th>Detector</Th>
                  <Th>Agent</Th>
                  <Th>Detected</Th>
                  <Th>Notify by</Th>
                  <Th>RCA by</Th>
                  <Th>State</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => {
                  const n = remaining(i.notifyDueAt, now)
                  const r = remaining(i.rcaDueAt, now)
                  return (
                    <Tr key={i.id} className={i.state === 'open' && i.severity === 'P1' ? 'bg-crit/[0.05]' : undefined}>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <Chip tone={SEVERITY_TONE[i.severity]}>{i.severity}</Chip>
                          <span className="font-mono text-2xs text-ink">{i.id}</span>
                        </span>
                        <span className="mt-0.5 block max-w-[320px] text-[10px] leading-snug text-ink-3">{i.summary}</span>
                        {i.workObjectId && <Link to={`/operate/work/${i.workObjectId}`} className="text-[10px] text-brand-ink hover:underline">open finding →</Link>}
                      </Td>
                      <Td className="text-2xs text-ink-2" title={INCIDENT_CLASS_META[i.class].clause}>{INCIDENT_CLASS_META[i.class].label}</Td>
                      <Td><Chip mono>{i.detector}</Chip></Td>
                      <Td>{i.agentId ? <AgentChip id={i.agentId} /> : <span className="text-2xs text-ink-3">—</span>}</Td>
                      <Td className="text-2xs text-ink-2">{i.detectedAt.slice(0, 16).replace('T', ' ')}</Td>
                      <Td className={cn('text-2xs', i.state !== 'open' ? 'text-ok' : n.overdue ? 'text-crit' : 'text-ink-2')}>{i.state !== 'open' ? `sent ${i.notifiedAt?.slice(11, 16) ?? ''}` : n.text}</Td>
                      <Td className={cn('text-2xs', i.state === 'rca_published' || i.state === 'closed' ? 'text-ok' : r.overdue ? 'text-crit' : 'text-ink-2')}>{i.state === 'rca_published' || i.state === 'closed' ? 'published' : r.text}</Td>
                      <Td><Chip tone={STATE_TONE[i.state]}>{i.state.replace(/_/g, ' ')}</Chip></Td>
                      <Td>
                        {role.canApprove && (
                          <span className="flex gap-1">
                            {i.state === 'open' && <Button size="sm" variant="ghost" onClick={() => notify(i.id, role.person)}><Bell size={11} /> Notify</Button>}
                            {(i.state === 'open' || i.state === 'notified') && <Button size="sm" variant="ghost" onClick={() => rca(i)}><FileSearch size={11} /> RCA</Button>}
                            {i.state === 'rca_published' && <Button size="sm" variant="ghost" onClick={() => close(i.id, role.person)}>Close</Button>}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card
            title="Oversight audit"
            subtitle="Runs on the evidence chain itself, so the runtime cannot bypass it"
            right={<ShieldAlert size={13} className="text-ink-3" />}
          >
            <p className="text-2xs leading-relaxed text-ink-2">
              Every executed action whose decision was approve-first must have its approval earlier in the chain, and nothing may execute while the platform-wide brake is on. A failure raises an oversight-failure incident.
            </p>
            {audit ? (
              <div className="mt-3 rounded border border-line bg-sunken p-3">
                <div className="flex items-center gap-2">
                  <span className="label-cap">Last run</span>
                  <span className="text-2xs text-ink-3">{audit.at.slice(0, 16).replace('T', ' ')}</span>
                  <Chip tone={audit.failures.length ? 'crit' : 'ok'} className="ml-auto">{audit.failures.length ? `${audit.failures.length} failed` : 'clean'}</Chip>
                </div>
                <p className="mt-1 text-2xs text-ink-2">{audit.checked} actions checked.</p>
                {audit.failures.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {audit.failures.map((f) => (
                      <li key={f.evidenceId} className="text-2xs text-ink-2">
                        · {f.reason} <EvidenceLink id={f.evidenceId} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-3 text-2xs text-ink-3">Not yet run this session.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="default" disabled={!role.canApprove} onClick={() => runAudit(role.person)}><FileSearch size={11} /> Run audit</Button>
              <Button size="sm" variant="ghost" disabled={!role.canApprove} title="Appends an action record without its approval, then re-runs the audit" onClick={() => simulate(role.person)}>
                <FlaskConical size={11} /> Simulate an oversight failure
              </Button>
              <Button
                size="sm" variant="ghost" disabled={!role.canApprove}
                title="Raise the cohort monitor's current finding as an incident, if any cohort is flagged"
                onClick={() => {
                  const f = report.cohorts.filter((c) => c.flagged)
                  if (!f.length) return
                  raise({ class: 'discriminatory_pattern', detector: 'cohort_monitor', consequential: false, summary: `${f.length} cohort(s) show disparity beyond |z| ≥ ${report.threshold}.`, details: f.map((c) => `${c.label} (n=${c.n}): urgent z=${c.z.urgent.toFixed(2)}, gated z=${c.z.gated.toFixed(2)}, agent-handled z=${c.z.agent.toFixed(2)}.`) })
                }}
              >
                <Users size={11} /> Raise cohort finding
              </Button>
            </div>
          </Card>

          <Card
            title="Cohort monitor"
            subtitle="Disparity in priority, gating and agent handling across declared cohorts"
            right={<Users size={13} className="text-ink-3" />}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Cohort</Th>
                  <Th align="right">n</Th>
                  <Th align="right">P1/P2</Th>
                  <Th align="right">Gated</Th>
                  <Th align="right">Agent-handled</Th>
                  <Th align="right">max |z|</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td className="text-2xs text-ink-3">Whole estate</Td>
                  <Td align="right" className="text-2xs text-ink-3">{report.overall.n}</Td>
                  <Td align="right" className="text-2xs text-ink-3">{pct(report.overall.urgentRate * 100, 0)}</Td>
                  <Td align="right" className="text-2xs text-ink-3">{pct(report.overall.gatedRate * 100, 0)}</Td>
                  <Td align="right" className="text-2xs text-ink-3">{pct(report.overall.agentRate * 100, 0)}</Td>
                  <Td align="right" className="text-2xs text-ink-3">—</Td>
                  <Td></Td>
                </Tr>
                {report.cohorts.map((c) => {
                  const maxZ = Math.max(Math.abs(c.z.urgent), Math.abs(c.z.gated), Math.abs(c.z.agent))
                  return (
                    <Tr key={c.id} className={c.flagged ? 'bg-warn/[0.06]' : undefined}>
                      <Td className="text-2xs text-ink">{c.label}</Td>
                      <Td align="right" className={cn('text-2xs', c.n < report.minN ? 'text-ink-3' : 'text-ink-2')}>{c.n}</Td>
                      <Td align="right" className="text-2xs text-ink-2">{pct(c.urgentRate * 100, 0)}</Td>
                      <Td align="right" className="text-2xs text-ink-2">{pct(c.gatedRate * 100, 0)}</Td>
                      <Td align="right" className="text-2xs text-ink-2">{pct(c.agentRate * 100, 0)}</Td>
                      <Td align="right" className={cn('tnum text-2xs', maxZ >= report.threshold ? 'text-warn' : 'text-ink-2')}>{maxZ.toFixed(2)}</Td>
                      <Td>{c.flagged ? <Chip tone="warn"><TriangleAlert size={9} /> flagged</Chip> : c.n < report.minN ? <Chip tone="neutral">too few</Chip> : <Chip tone="ok">within band</Chip>}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <p className="mt-2 text-2xs leading-relaxed text-ink-3">
              Cohorts are declared by the estate, not the platform. A cohort flags only with n ≥ {report.minN} and a two-proportion |z| ≥ {report.threshold} on at least one metric — a population, never a single case.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
