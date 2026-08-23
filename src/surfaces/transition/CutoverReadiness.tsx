import React from 'react'
import { CheckCircle2, CircleSlash, Loader2, PenTool, PlayCircle, XCircle } from 'lucide-react'
import { HANDOVER, type HandoverArtefact } from '@/domain/knowledge'
import { TOWER_BY_ID } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric } from '@/ui/primitives'
import { cn, num, pct } from '@/lib/format'
import { ProducedBy } from '@/ui/ProducedBy'

const ICON: Record<HandoverArtefact['state'], typeof CheckCircle2> = {
  pass: CheckCircle2, fail: XCircle, running: Loader2, pending: CircleSlash,
}

const TONE: Record<HandoverArtefact['state'], 'ok' | 'crit' | 'brand' | 'neutral'> = {
  pass: 'ok', fail: 'crit', running: 'brand', pending: 'neutral',
}

export function CutoverReadiness() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [checks, setChecks] = React.useState(HANDOVER)
  const [running, setRunning] = React.useState(false)

  const tower = TOWER_BY_ID.twr_claims
  const passing = checks.filter((c) => c.state === 'pass').length
  const failing = checks.filter((c) => c.state === 'fail').length
  const gateOpen = failing === 0 && checks.every((c) => c.state === 'pass')

  const runChecks = () => {
    setRunning(true)
    setChecks((cs) => cs.map((c) => (c.state === 'pending' ? c : { ...c, state: 'running' as const })))
    setTimeout(() => {
      setChecks(HANDOVER)
      setRunning(false)
      pushToast({
        title: 'Acceptance checks re-run',
        body: `${HANDOVER.filter((c) => c.state === 'pass').length} pass, ${HANDOVER.filter((c) => c.state === 'fail').length} fail. The S3→S4 transition stays closed while any check fails.`,
        tone: 'warn',
      })
    }, 1400)
  }

  return (
    <>
      <PageHeader
        title="Cutover Readiness"
        subtitle="Handover acceptance checks · S3 → S4 gate"
        meta={<Chip tone="warn">{tower.name} · state {tower.state}</Chip>}
        actions={
          <>
            <Button size="sm" variant="default" onClick={runChecks} disabled={running}>
              <PlayCircle size={12} /> {running ? 'Running…' : 'Run acceptance checks'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!gateOpen || !role.canApprove}
              title={gateOpen ? 'Schedule the cutover' : 'Blocked — acceptance checks are failing'}
              onClick={() => pushToast({ title: 'Cutover scheduled', body: 'Reverse-shadow window opens with the incumbent for two weeks.', tone: 'ok' })}
            >
              Schedule cutover
            </Button>
          </>
        }
      />

      <ProducedBy
        agents={["agt_archivist", "agt_herald"]}
        what="assembling the handover artefacts these gates check"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Artefacts passing" value={`${passing} / ${checks.length}`} deltaTone={failing ? 'crit' : 'ok'} />
        <Metric size="sm" label="Blocking failures" value={failing} deltaTone={failing ? 'crit' : 'ok'} hint="each one closes the state transition" />
        <Metric size="sm" label="Estate entities" value={num(tower.entities)} hint={`${num(tower.assertions)} assertions hydrated`} />
        <Metric size="sm" label="Verified volume coverage" value={pct(tower.verificationCoverage, 1)} hint="against an 85% acceptance threshold" />
        <Metric size="sm" label="Provisional baseline" value={`${num(tower.baselineHrsPerQtr)} hrs`} hint="measured in shadow, day 24 of 28" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={cn('mb-4 rounded-md border p-3', gateOpen ? 'border-ok/40 bg-ok/[0.07]' : 'border-crit/40 bg-crit/[0.07]')}>
          <div className="flex items-start gap-2.5">
            {gateOpen ? <CheckCircle2 size={16} className="mt-px shrink-0 text-ok" /> : <XCircle size={16} className="mt-px shrink-0 text-crit" />}
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink">
                {gateOpen ? 'S3 → S4 transition is open' : 'S3 → S4 transition is closed'}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-2">
                {gateOpen
                  ? 'Every handover artefact exists and its acceptance check passes.'
                  : `${failing} acceptance check${failing > 1 ? 's are' : ' is'} failing. The S3 → S4 transition stays closed until they pass.`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {checks.map((c) => {
            const Icon = ICON[c.state]
            return (
              <article key={c.id} className={cn('rounded-md border bg-surface', c.state === 'fail' ? 'border-crit/40' : 'border-line')}>
                <div className="flex flex-wrap items-start gap-3 p-3">
                  <Icon size={16} className={cn('mt-px shrink-0', c.state === 'pass' ? 'text-ok' : c.state === 'fail' ? 'text-crit' : c.state === 'running' ? 'animate-spin text-brand-ink' : 'text-ink-3')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-medium text-ink">{c.artefact}</h3>
                      <Chip tone={TONE[c.state]}>{c.state === 'pass' ? 'accepted' : c.state === 'fail' ? 'blocking' : c.state === 'running' ? 'checking' : 'not started'}</Chip>
                    </div>
                    <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                      <span className="text-ink-2">Acceptance:</span> {c.acceptance}
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-ink-2">{c.detail}</p>
                    <p className="mt-1.5 text-2xs text-ink-3">
                      Consumed in Run by: <span className="text-ink-2">{c.consumedBy}</span>
                    </p>
                  </div>
                  {c.id === 'ho_2' && (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!role.canApprove}
                      onClick={() => pushToast({ title: 'Countersignature requested', body: 'Both parties sign platform-measured figures, not estimates. Variance notes must close first.', tone: 'info' })}
                    >
                      <PenTool size={11} /> Request countersign
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

      </div>
    </>
  )
}
