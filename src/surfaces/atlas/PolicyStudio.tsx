import React from 'react'
import { Check, GitBranch, Play, X } from 'lucide-react'
import { POLICIES, AGENTS, TOWERS, AGENT_BY_ID } from '@/domain/estate'
import { ACTION_CLASSES, AC, ROLE_BY_ID } from '@/domain/reference'
import { evaluate, modeLabel, type ActionContext, type EngineResult } from '@/domain/policyEngine'
import { PRESETS } from '@/domain/policySeed'
import { useAstra } from '@/domain/store'
import { PageHeader, AutonomyChip, GradeChip } from '@/ui/domain'
import { Button, Card, Chip, Field, Metric, Tabs, inputClass, selectClass } from '@/ui/primitives'
import { cn, dateShort, pct } from '@/lib/format'
import type { Grade, Policy } from '@/domain/types'
import { ProducedBy } from '@/ui/ProducedBy'

/** Renders the authored policy back as the YAML the git repo holds. */
function policyToYaml(p: Policy): string {
  const lines: string[] = []
  lines.push(`policy: ${p.name}_${p.version}`)
  lines.push(`applies_to: {towers: [${p.appliesTo.towers.join(', ')}], envs: [${p.appliesTo.envs.join(', ')}]}`)
  lines.push('rules:')
  p.rules.forEach((r) => {
    lines.push(`  - when: ${r.when}`)
    if (r.require) lines.push(`    require: ${r.require}`)
    if (r.mode) lines.push(`    mode: ${r.mode}`)
    if (r.maxMode) lines.push(`    override: max_mode: ${r.maxMode}`)
    if (r.gate) lines.push(`    gate: {approver_role: ${r.gate.approverRole}, artefacts: [${r.gate.artefacts.join(', ')}], timeout: ${r.gate.timeoutSec}s, escalates_to: ${r.gate.escalatesTo}}`)
    if (r.notify) lines.push(`    notify: [${r.notify.join(', ')}]`)
    if (r.abortWindowSec) lines.push(`    abort_window: ${r.abortWindowSec}s`)
  })
  lines.push(`budgets: {tokens_usd_per_run: ${p.budgets.tokensUsdPerRun.toFixed(2)}, runs_per_hour: ${p.budgets.runsPerHour}}`)
  lines.push(`evidence: seal_required: ${p.evidence.sealRequired}  export: [${p.evidence.exportTo.join(', ')}]`)
  return lines.join('\n')
}


export function PolicyStudio() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [tab, setTab] = React.useState<'simulate' | 'author'>('simulate')
  const [policyId, setPolicyId] = React.useState('pol_change_std')
  const [agentId, setAgentId] = React.useState('agt_remedian')
  const [actionClass, setActionClass] = React.useState('AC-31')
  const [tier, setTier] = React.useState(0)
  const [services, setServices] = React.useState(1)
  const [dependents, setDependents] = React.useState(2)
  const [confidence, setConfidence] = React.useState(0.91)
  const [hasCompensation, setHasCompensation] = React.useState(true)
  const [majorIncident, setMajorIncident] = React.useState(false)
  const [freeze, setFreeze] = React.useState(false)
  const [assetContract, setAssetContract] = React.useState<string | null>('dc_datamart_v2')
  const [whitelisted, setWhitelisted] = React.useState(true)
  const [suspended, setSuspended] = React.useState(false)
  const [floor, setFloor] = React.useState<'unverified' | 'machine_corroborated' | 'human_verified'>('human_verified')
  const [drift, setDrift] = React.useState(false)
  const [presetLabel, setPresetLabel] = React.useState(PRESETS[0].label)

  const applyPreset = (label: string) => {
    const p = PRESETS.find((x) => x.label === label)
    if (!p) return
    setPresetLabel(label)
    setPolicyId(p.ctx.policyId)
    setAgentId(p.ctx.agentId)
    setActionClass(p.ctx.action!.class)
    setTier(p.ctx.blast!.tier)
    setServices(p.ctx.blast!.services)
    setDependents(p.ctx.blast!.dependents)
    setConfidence(p.ctx.plan!.confidence)
    setHasCompensation(Boolean(p.ctx.action!.hasCompensation))
    setMajorIncident(p.ctx.incident!.major_active)
    setFreeze(p.ctx.calendar!.freeze)
    setAssetContract(p.ctx.asset?.contract ?? 'dc_datamart_v2')
  }

  const agent = AGENT_BY_ID[agentId]
  const policy = POLICIES.find((p) => p.id === policyId)!

  const ctx: ActionContext = React.useMemo(
    () => ({
      action: { class: actionClass, env: 'prod', hasCompensation },
      blast: { tier, services, dependents, dataMutation: ['AC-44', 'AC-49', 'AC-71'].includes(actionClass) },
      agent: { id: agentId, grade: agent.grants as Record<string, Grade>, drift },
      plan: { confidence, verificationPack: AC[actionClass]?.verificationPack ?? null },
      incident: { major_active: majorIncident },
      calendar: { freeze },
      asset: { contract: assetContract, pii: 'restricted' },
      model: { id: 'simulated', vendor: 'simulated', version: 'n/a', whitelisted },
      suspensions: { any: suspended, global: false, tower: false, agent: false, actionClass: suspended, function: false },
      retrieval: { minVerification: floor },
    }),
    [actionClass, hasCompensation, tier, services, dependents, agentId, agent, confidence, majorIncident, freeze, assetContract, whitelisted, suspended, floor, drift],
  )

  const result: EngineResult = React.useMemo(() => evaluate(policy, ctx, agent.ceiling), [policy, ctx, agent.ceiling])

  return (
    <>
      <PageHeader
        title="Policy Editor & Simulator"
        subtitle="Runs the same evaluator as the runtime"
        actions={
          <Button size="sm" variant="default" disabled={!role.canApprove} onClick={() => pushToast({ title: 'Pull request opened', body: 'Production policy is pull-request-only. Merge requires review, and no upgrade may change autonomy behaviour without a replay regression pass.', tone: 'info' })}>
            <GitBranch size={12} /> Open PR
          </Button>
        }
      />

      {/* The agent under simulation, not a fixed pair — this screen lets you
          change who is acting, and the strip has to follow that. */}
      <ProducedBy
        agents={[agentId]}
        what={`the agent under simulation · ${modeLabel(agent.ceiling)} ceiling`}
      />

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'simulate', label: 'Simulator' }, { id: 'author', label: 'Policy source', count: POLICIES.length }]} />
      </div>

      {tab === 'simulate' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[340px_1fr] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface">
            <div className="border-b border-line p-3">
              <Field label="Scenario preset">
                <select value={presetLabel} onChange={(e) => applyPreset(e.target.value)} className={selectClass}>
                  {PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="space-y-3 border-b border-line p-3">
              <div className="label-cap">Action</div>
              <Field label="Policy">
                <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} className={selectClass}>
                  {POLICIES.map((p) => <option key={p.id} value={p.id}>{p.name} {p.version}</option>)}
                </select>
              </Field>
              <Field label="Action class">
                <select value={actionClass} onChange={(e) => setActionClass(e.target.value)} className={selectClass}>
                  {ACTION_CLASSES.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                </select>
              </Field>
              <Field label="Acting agent">
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={selectClass}>
                  {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name} — ceiling {modeLabel(a.ceiling)}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={hasCompensation} onChange={(e) => setHasCompensation(e.target.checked)} className="accent-brand" />
                Step declares a compensation (rollback)
              </label>
            </div>

            <div className="space-y-3 border-b border-line p-3">
              <div className="label-cap">Blast radius</div>
              <Field label={`Max tier reachable — ${tier}`}>
                <input type="range" min={0} max={3} value={tier} onChange={(e) => setTier(Number(e.target.value))} className="w-full accent-brand" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Services"><input type="number" min={1} value={services} onChange={(e) => setServices(Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Dependents"><input type="number" min={0} value={dependents} onChange={(e) => setDependents(Number(e.target.value))} className={inputClass} /></Field>
              </div>
            </div>

            <div className="space-y-3 border-b border-line p-3">
              <div className="label-cap">Context conditions</div>
              <Field label={`Plan confidence — ${confidence.toFixed(2)}`}>
                <input type="range" min={0.5} max={1} step={0.01} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-brand" />
              </Field>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={majorIncident} onChange={(e) => setMajorIncident(e.target.checked)} className="accent-brand" />
                Major incident active
              </label>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} className="accent-brand" />
                Change freeze in force
              </label>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={assetContract !== null} onChange={(e) => setAssetContract(e.target.checked ? 'dc_datamart_v2' : null)} className="accent-brand" />
                Affected data asset carries a contract
              </label>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={whitelisted} onChange={(e) => setWhitelisted(e.target.checked)} className="accent-brand" />
                Model is listed in the AI-system registry
              </label>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} className="accent-brand" />
                A suspension applies to this action class
              </label>
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <input type="checkbox" checked={drift} onChange={(e) => setDrift(e.target.checked)} className="accent-brand" />
                The agent's drift alarm is raised
              </label>
              <Field label="Verification floor the plan rests on">
                <select value={floor} onChange={(e) => setFloor(e.target.value as typeof floor)} className={selectClass}>
                  <option value="human_verified">human-verified</option>
                  <option value="machine_corroborated">machine-corroborated</option>
                  <option value="unverified">unverified</option>
                </select>
              </Field>
            </div>

            <div className="p-3">
              <div className="label-cap">Agent standing</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(agent.grants).map(([ac, g]) => <GradeChip key={ac} grade={g} ac={ac} />)}
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-ink-3">
                Ceiling {modeLabel(agent.ceiling)} · live success {agent.evaluation.liveSuccess90d ? pct(agent.evaluation.liveSuccess90d * 100) : 'n/a'} ·{' '}
                {agent.incidents.length ? `${agent.incidents.length} incident on record` : 'no incidents'}
              </p>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto p-4">
            <div className={cn('rounded-md border p-4', result.mode === 'autonomous' ? 'border-ok/40 bg-ok/[0.06]' : result.mode === 'supervised' ? 'border-brand/45 bg-brand/[0.06]' : result.mode === 'approve_first' ? 'border-warn/40 bg-warn/[0.06]' : 'border-crit/40 bg-crit/[0.06]')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="label-cap">Engine decision</span>
                <AutonomyChip mode={result.mode} full />
                <span className="tnum text-2xs text-ink-3">evaluated in {result.evaluatedInMs} ms</span>
                <span className="ml-auto font-mono text-2xs text-ink-3">{policy.name} {policy.version}</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Metric size="sm" label="Platform floor" value={modeLabel(result.floorApplied)} />
                <Metric size="sm" label="Gates required" value={result.gates.length || 'none'} />
                <Metric size="sm" label="Overrides applied" value={result.overrides.length} deltaTone={result.overrides.length ? 'warn' : 'ok'} />
                <Metric size="sm" label="Agent ceiling" value={modeLabel(agent.ceiling)} />
              </div>

              {result.gates.length > 0 && (
                <div className="mt-3 rounded border border-line bg-surface p-2.5">
                  <div className="label-cap">Gate design</div>
                  <ul className="mt-1.5 space-y-1 text-2xs text-ink-2">
                    {result.gates.map((g, i) => (
                      <li key={i}>
                        · <span className="text-ink">{g.role}</span> · timeout {Math.round(g.timeoutSec / 60)} min, then escalates to {g.escalatesTo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.overrides.length > 0 && (
                <div className="mt-3 rounded border border-crit/35 bg-crit/[0.05] p-2.5">
                  <div className="label-cap text-crit">Overrides</div>
                  <ul className="mt-1.5 space-y-1 font-mono text-2xs text-ink-2">
                    {result.overrides.map((o) => <li key={o}>· {o}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <Card className="mt-4" title="Rule-by-rule trace" subtitle="Written to evidence with the full input vector">
              <ol className="space-y-2">
                {result.trace.map((t) => (
                  <li key={t.ruleId} className={cn('rounded border p-2.5', t.matched ? 'border-brand/40 bg-brand/[0.05]' : 'border-line bg-sunken opacity-70')}>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.matched ? <Check size={12} className="shrink-0 text-brand-ink" /> : <X size={12} className="shrink-0 text-ink-3" />}
                      <span className="font-mono text-2xs text-ink-3">{t.ruleId}</span>
                      <span className="min-w-0 flex-1 break-all font-mono text-2xs text-ink-2">{t.when}</span>
                      <Chip tone={t.matched ? 'brand' : 'neutral'}>{t.effect}</Chip>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 pl-6">
                      {t.lines.map((l, i) => (
                        <li key={i} className="break-all font-mono text-[10px] leading-relaxed text-ink-3">{l}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="mt-4" title="Reasoning" subtitle="As carried on the approval card">
              <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
                {result.reasons.map((r) => <li key={r}>· {r}</li>)}
              </ul>
              <div className="mt-3 border-t border-line pt-3">
                <div className="label-cap">Input vector, as written to evidence</div>
                <pre className="mt-1.5 overflow-x-auto rounded border border-line bg-sunken p-2.5 font-mono text-[10px] leading-relaxed text-ink-3">
{JSON.stringify({ action: ctx.action, blast: ctx.blast, agent: { id: ctx.agent.id, grade: ctx.agent.grade[actionClass] ?? null }, plan: ctx.plan, incident: ctx.incident, calendar: ctx.calendar, asset: ctx.asset }, null, 2)}
                </pre>
              </div>
            </Card>
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {POLICIES.map((p) => (
              <Card
                key={p.id}
                title={`${p.name} ${p.version}`}
                subtitle={`${p.appliesTo.towers.map((t) => TOWERS.find((x) => x.id === t)?.name ?? t).join(', ')} · ${p.appliesTo.envs.join(', ')}`}
                right={<Chip tone="ok">in force</Chip>}
              >
                <pre className="overflow-x-auto rounded border border-line bg-sunken p-3 font-mono text-[10px] leading-relaxed text-ink-2">
{policyToYaml(p)}
                </pre>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-3">
                  <span className="break-all font-mono">{p.source}</span>
                  <span className="ml-auto">updated {dateShort(p.updatedAt)} by {p.updatedBy}</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" variant="default" onClick={() => { setPolicyId(p.id); setTab('simulate') }}><Play size={11} /> Simulate against this</Button>
                  <Button size="sm" variant="ghost" disabled={!role.canApprove} onClick={() => pushToast({ title: 'Rollback prepared', body: 'Policies are versioned with instant rollback. The prior version is already compiled and staged.', tone: 'info' })}>
                    Roll back
                  </Button>
                </div>
              </Card>
            ))}
          </div>

        </div>
      )}
    </>
  )
}
