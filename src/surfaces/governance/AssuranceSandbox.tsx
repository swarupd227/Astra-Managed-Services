import React from 'react'
import { Link } from 'react-router-dom'
import { Check, Crosshair, FlaskConical, Gavel, ShieldCheck, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { AGENT_BY_ID, POLICY_BY_ID } from '@/domain/estate'
import { CONFORMANCE_CASES, runConformance } from '@/domain/conformance'
import { RED_TEAM_CASES } from '@/domain/redTeamSeed'
import { gatewayDeps, runRedTeam } from '@/domain/redTeam'
import { BIAS_CASES, runBiasSuite } from '@/domain/biasSuite'
import { COHORTS } from '@/domain/cohortSeed'
import { PageHeader, AgentChip, AutonomyChip, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr, selectClass } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   The assurance sandbox.

   Schedule O §(k) lets the customer benchmark the deployed system with
   provider-supplied tooling. This is that tooling, on the governance surface
   the auditor already has, and deliberately not gated on approval rights:
   every control here is read-only — it asserts nothing, changes nothing, and
   writes a verification record when it runs. A customer who can run it
   themselves does not need seven days' notice to ask.
   ========================================================================== */

export function AssuranceSandbox() {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const conformance = useAstra((s) => s.conformance)
  const recordConformance = useAstra((s) => s.recordConformance)
  const redTeam = useAstra((s) => s.redTeam)
  const recordRedTeam = useAstra((s) => s.recordRedTeam)
  const bias = useAstra((s) => s.bias)
  const recordBias = useAstra((s) => s.recordBias)
  const verification = useAstra((s) => s.verification)
  const runChainVerification = useAstra((s) => s.runChainVerification)
  const evidence = useAstra((s) => s.evidence)
  const pushToast = useAstra((s) => s.pushToast)

  const [busy, setBusy] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<string | null>(null)
  const [probe, setProbe] = React.useState(CONFORMANCE_CASES[0].id)

  const byCase = new Map((conformance?.results ?? []).map((r) => [r.caseId, r]))
  const probed = React.useMemo(() => runConformance(CONFORMANCE_CASES.filter((c) => c.id === probe)).results[0], [probe])
  const probeCase = CONFORMANCE_CASES.find((c) => c.id === probe)!

  const runRed = async () => {
    setBusy('red')
    try {
      recordRedTeam(await runRedTeam(RED_TEAM_CASES, gatewayDeps), role.person)
    } catch (e) {
      pushToast({ title: 'Red-team run failed', body: (e as Error).message, tone: 'crit' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Assurance Sandbox"
        subtitle="Run the platform's controls yourself — nothing here needs the provider"
        meta={role.readOnly ? <Chip tone="neutral">read-only role · full access here</Chip> : undefined}
        actions={
          <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => recordConformance(runConformance(), role.person)}>
            <Gavel size={12} /> Run conformance set
          </Button>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric
          size="sm" label="Commitments held"
          value={conformance ? `${conformance.held} / ${conformance.total}` : `— / ${CONFORMANCE_CASES.length}`}
          deltaTone={conformance ? (conformance.held === conformance.total ? 'ok' : 'crit') : undefined}
          hint={conformance?.at ? `run ${conformance.at.slice(0, 16).replace('T', ' ')}` : 'not run this session'}
        />
        <Metric
          size="sm" label="Red-team controls" value={redTeam ? `${redTeam.results.filter((r) => r.pass).length} / ${redTeam.results.length}` : `— / ${RED_TEAM_CASES.length}`}
          deltaTone={redTeam ? (redTeam.results.every((r) => r.pass) ? 'ok' : 'crit') : undefined}
        />
        <Metric
          size="sm" label="Bias disparities" value={bias ? bias.disparities.length : '—'}
          deltaTone={bias ? (bias.invariant ? 'ok' : 'crit') : undefined} hint={bias ? `${bias.pairs} matched pairs` : 'not run this session'}
        />
        <Metric
          size="sm" label="Evidence chain" value={verification ? (verification.valid ? 'intact' : 'broken') : '—'}
          deltaTone={verification ? (verification.valid ? 'ok' : 'crit') : undefined} hint={`${evidence.length.toLocaleString('en-GB')} records`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Contract conformance"
          subtitle="What the platform promises, checked against the engine that is actually deployed"
        >
          <Table>
            <thead>
              <tr><Th>Commitment</Th><Th>Where it comes from</Th><Th>Expected</Th><Th>Observed</Th><Th>Result</Th></tr>
            </thead>
            <tbody>
              {CONFORMANCE_CASES.map((c) => {
                const r = byCase.get(c.id)
                return (
                  <React.Fragment key={c.id}>
                    <Tr onClick={() => setOpen(open === c.id ? null : c.id)} selected={open === c.id} className={r && !r.holds ? 'bg-crit/[0.06]' : undefined}>
                      <Td className="max-w-[420px] text-2xs leading-snug text-ink">{c.commitment}</Td>
                      <Td className="text-2xs text-ink-3">{c.clause}</Td>
                      <Td className="text-2xs text-ink-2">{r?.expected ?? '—'}</Td>
                      <Td className="text-2xs text-ink-2">{r?.observed ?? 'not run'}</Td>
                      <Td>{r ? <Chip tone={r.holds ? 'ok' : 'crit'}>{r.holds ? <><Check size={9} /> holds</> : <><X size={9} /> FAILED</>}</Chip> : <span className="text-2xs text-ink-3">—</span>}</Td>
                    </Tr>
                    {open === c.id && r && (
                      <tr>
                        <Td colSpan={5} className="bg-sunken">
                          <div className="py-2">
                            <div className="label-cap">Decision basis</div>
                            <ul className="mt-1 space-y-0.5">
                              {r.reasons.map((x) => <li key={x} className="text-2xs text-ink-2">· {x}</li>)}
                            </ul>
                            {r.result.overrides.length > 0 && (
                              <>
                                <div className="label-cap mt-2 text-crit">Overrides</div>
                                <ul className="mt-1 space-y-0.5">
                                  {r.result.overrides.map((x) => <li key={x} className="text-2xs text-ink-2">· {x}</li>)}
                                </ul>
                              </>
                            )}
                          </div>
                        </Td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-2xs leading-relaxed text-ink-3">
            These are not replays of past decisions. The seeded history was produced by a simplified heuristic rather than by this evaluator, so comparing against it would measure the seed, not the policy. Each case instead states a commitment and tests whether the deployed engine still honours it.
          </p>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Decision probe" subtitle="The same evaluator the runtime uses, on an input vector you choose">
            <select value={probe} onChange={(e) => setProbe(e.target.value)} className={cn(selectClass, 'w-full')}>
              {CONFORMANCE_CASES.map((c) => <option key={c.id} value={c.id}>{c.commitment}</option>)}
            </select>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-line bg-sunken p-3">
              <span className="label-cap">Engine decision</span>
              <AutonomyChip mode={probed.result.mode} full />
              <span className="tnum text-2xs text-ink-3">{probed.result.evaluatedInMs} ms</span>
              <span className="ml-auto font-mono text-2xs text-ink-3">{POLICY_BY_ID[probeCase.policyId]?.name} {POLICY_BY_ID[probeCase.policyId]?.version}</span>
            </div>

            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-2xs">
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Action class</dt><dd className="font-mono text-ink-2">{probeCase.ctx.action.class}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Acting agent</dt><dd><AgentChip id={probeCase.agentId} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Blast tier</dt><dd className="tnum text-ink-2">{probeCase.ctx.blast.tier}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Agent ceiling</dt><dd className="text-ink-2">{AGENT_BY_ID[probeCase.agentId]?.ceiling.replace(/_/g, '-')}</dd></div>
            </dl>

            <div className="mt-3">
              <div className="label-cap">Rule-by-rule trace</div>
              <ul className="mt-1 space-y-1">
                {probed.result.trace.map((t) => (
                  <li key={t.ruleId} className={cn('rounded border px-2 py-1 text-2xs', t.matched ? 'border-brand/40 bg-brand/[0.05]' : 'border-line')}>
                    <span className="font-mono text-ink-3">{t.ruleId}</span>{' '}
                    <span className="font-mono text-ink-2">{t.when}</span>
                    <span className={cn('ml-1', t.matched ? 'text-brand-ink' : 'text-ink-3')}>→ {t.effect}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Available controls" subtitle="Each writes a verification record; none of them changes anything">
              <ul className="space-y-2">
                <li className="flex flex-wrap items-center gap-2 rounded border border-line p-2.5">
                  <Crosshair size={12} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 text-2xs text-ink-2">Red-team library — {RED_TEAM_CASES.length} cases against the gateway's classifier, the registry and the detectors</span>
                  <Button size="sm" variant="default" disabled={busy !== null} onClick={runRed}>{busy === 'red' ? 'Running…' : 'Run'}</Button>
                </li>
                <li className="flex flex-wrap items-center gap-2 rounded border border-line p-2.5">
                  <FlaskConical size={12} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 text-2xs text-ink-2">Bias suite — {BIAS_CASES.length} cases × {COHORTS.length} cohorts, matched pairs over the decision path</span>
                  <Button size="sm" variant="default" disabled={busy !== null} onClick={() => recordBias(runBiasSuite(COHORTS, BIAS_CASES), role.person)}>Run</Button>
                </li>
                <li className="flex flex-wrap items-center gap-2 rounded border border-line p-2.5">
                  <ShieldCheck size={12} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 text-2xs text-ink-2">Evidence chain — recompute every hash from genesis and report the first break</span>
                  <Button size="sm" variant="default" disabled={busy !== null} onClick={runChainVerification}>Verify</Button>
                </li>
              </ul>
              {verification && (
                <p className={cn('mt-2 text-2xs leading-relaxed', verification.valid ? 'text-ok' : 'text-crit')}>
                  {verification.valid
                    ? `Chain intact — ${verification.checked.toLocaleString('en-GB')} records recomputed in ${verification.durationMs} ms, root ${verification.rootHash.slice(0, 12)}…`
                    : `Chain broken from sequence ${verification.firstBreakSeq} — ${verification.brokenIds.length} record(s) affected.`}
                </p>
              )}
            </Card>

            <Card title="Purpose" subtitle="Schedule O §(k) — customer benchmarking">
              <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
                <li>· Every control on this page is read-only and available to a read-only role. A customer who can run the benchmark themselves does not need to give seven days' notice to ask for it.</li>
                <li>· Each run appends a verification record naming who ran it, so the fact that the customer exercised the control is itself auditable.</li>
                <li>· The decision probe runs the production evaluator, not a copy: what it shows is what the runtime would decide on the same inputs.</li>
                <li>· For the full evidence trail behind any of this, open the <Link to="/governance/evidence" className="text-brand-ink hover:underline">Evidence Explorer</Link>.</li>
              </ul>
              {conformance?.at && (
                <p className="mt-2 text-2xs text-ink-3">
                  Last conformance run sealed to the chain. <EvidenceLink id={evidence.filter((e) => e.summary.startsWith('Contract conformance')).at(-1)?.id ?? ''} />
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
