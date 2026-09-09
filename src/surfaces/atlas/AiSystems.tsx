import React from 'react'
import { ArrowUpRight, Ban, Check, Clock, Cpu, FileCheck2, Globe, Plus, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { NOW } from '@/domain/workSeed'
import { deletionManifest } from '@/domain/dataHandling'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Drawer, Empty, Field, Metric, Table, Td, Th, Tr, inputClass, selectClass } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   AI Systems — the registry the gateway enforces.

   This screen reads the gateway's registry rather than a seed file, because
   the gateway is the system of record: what is listed here is what a call
   can resolve to, and nothing else. Requests, approvals, overrides and
   revocations write back to it, and each is an evidence record here.
   ========================================================================== */

interface AiSystem {
  id: string
  vendor: string
  model: string
  version: string
  hosting: string
  region: string
  purposes: string[]
  status: 'approved' | 'pending' | 'revoked'
  approvedBy?: string
  approvedAt?: string
  requestedBy?: string
  requestedAt?: string
  noticeDueAt?: string
  attestations?: { zeroRetention: boolean; noTrainingOnCustomerData: boolean; ref: string }
  supplyChain?: { component: string; provider: string }[]
  history?: { at: string; by: string; from: string; to: string; reason: string; override?: boolean }[]
  residency?: { ok: boolean; reason?: string; rule?: string }
}

interface Registry {
  version: number
  exhibit: string
  policyRef: string
  noticeHours: number
  residency: { policyRef?: string; allowedRegions?: string[]; zeroRetentionRequired?: boolean; note?: string } | null
  servedModel: string | null
  systems: AiSystem[]
}

const STATUS_TONE: Record<AiSystem['status'], 'ok' | 'warn' | 'crit'> = { approved: 'ok', pending: 'warn', revoked: 'crit' }
const STANDARD_PURPOSES = ['plan_synthesis', 'causal_reasoning', 'runbook_drafting', 'narrative', 'log_extraction', 'verification_triage', 'event_classification']
const HOSTINGS = ['vendor_cloud', 'client_tenant', 'artizent_dedicated']

const fmt = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')
const inNotice = (s: AiSystem) => s.status === 'pending' && Boolean(s.noticeDueAt) && new Date(s.noticeDueAt!) > new Date()

export function AiSystems() {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const logEvidence = useAstra((s) => s.logEvidence)
  const pushToast = useAstra((s) => s.pushToast)

  const [registry, setRegistry] = React.useState<Registry | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<string | null>(null)
  const [requesting, setRequesting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Data handling — the attestation cadence and certified deletion.
  const attestations = useAstra((s) => s.attestations)
  const deletions = useAstra((s) => s.deletions)
  const attest = useAstra((s) => s.attestTrainingExclusion)
  const clockOffset = useAstra((s) => s.clockOffsetMins)
  const now = new Date(NOW.getTime() + clockOffset * 60000)
  const lastAttestation = attestations[0]
  const attestationOverdue = lastAttestation ? new Date(lastAttestation.nextDueAt) < now : true

  const load = React.useCallback(() => {
    fetch('/api/agent/registry')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`gateway returned ${r.status}`))))
      .then((j: Registry) => { setRegistry(j); setError(null) })
      .catch((e: Error) => setError(e.message))
  }, [])

  React.useEffect(() => { load() }, [load])

  const applyView = (j: Registry & Record<string, unknown>) =>
    setRegistry({ version: j.version, exhibit: j.exhibit, policyRef: j.policyRef, noticeHours: j.noticeHours, residency: j.residency, servedModel: j.servedModel, systems: j.systems })

  const change = async (system: AiSystem, status: AiSystem['status'], reason: string, override = false) => {
    setBusy(system.id)
    try {
      const res = await fetch('/api/agent/registry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: system.id, status, by: role.person, reason, override }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error ?? 'The gateway refused the change')
      applyView(j)
      const evId = logEvidence(
        status === 'approved' ? 'approval' : 'decision',
        role.person,
        `AI system ${system.id} ${status}${j.overridden ? ' — notice period overridden' : ''} — ${system.vendor} ${system.model} (Exhibit ${j.exhibit} v${j.version})`,
        { from: j.from, to: status, reason, override: Boolean(j.overridden), purposes: system.purposes, hosting: system.hosting, region: system.region },
      )
      pushToast({
        title: status === 'revoked' ? `${system.model} revoked` : `${system.model} ${status}`,
        body: status === 'revoked'
          ? 'Every call resolving to this system is refused at the gateway from now on.'
          : j.overridden ? 'Approved inside the notice period — the override is on the record.' : 'Listed in the exhibit; the gateway will resolve to it.',
        tone: status === 'revoked' ? 'crit' : j.overridden ? 'warn' : 'ok',
        evidenceId: evId,
      })
    } catch (e) {
      pushToast({ title: 'Registry change refused', body: (e as Error).message, tone: 'crit' })
    } finally {
      setBusy(null)
    }
  }

  const overrideApprove = (system: AiSystem) => {
    const reason = window.prompt(`Approve ${system.model} before its notice period ends? Give the reason that will be recorded.`)
    if (!reason?.trim()) return
    void change(system, 'approved', reason.trim(), true)
  }

  const submitRequest = async (input: Record<string, unknown>, reason: string) => {
    const res = await fetch('/api/agent/registry/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, by: role.person, reason }),
    })
    const j = await res.json()
    if (!j.ok) throw new Error(j.error ?? 'The gateway refused the request')
    applyView(j)
    const sys: AiSystem = j.system
    const evId = logEvidence('decision', role.person, `AI system requested — ${sys.vendor} ${sys.model} (${sys.id}); notice due ${fmt(sys.noticeDueAt)}`, {
      system: sys.id, purposes: sys.purposes, hosting: sys.hosting, region: sys.region, noticeDueAt: sys.noticeDueAt, reason,
    })
    pushToast({ title: `${sys.model} requested`, body: `Pending in Exhibit ${j.exhibit}. Nothing resolves to it until approved — earliest ${fmt(sys.noticeDueAt)}.`, tone: 'info', evidenceId: evId })
  }

  const systems = registry?.systems ?? []
  const approved = systems.filter((s) => s.status === 'approved')
  const pending = systems.filter((s) => s.status === 'pending')
  const revoked = systems.filter((s) => s.status === 'revoked')
  const served = registry?.servedModel ? systems.find((s) => s.model === registry.servedModel) : undefined
  const servedUsable = served && served.status === 'approved' && served.residency?.ok !== false
  const purposeOptions = [...new Set([...STANDARD_PURPOSES, ...systems.flatMap((s) => s.purposes)])]

  return (
    <>
      <PageHeader
        title="AI Systems"
        subtitle={registry ? `Exhibit ${registry.exhibit} · registry v${registry.version} · enforced at the gateway under ${registry.policyRef}` : 'The approved model registry'}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={load}><RotateCcw size={12} /> Refresh</Button>
            <Button size="sm" variant="default" disabled={!registry} onClick={() => setRequesting(true)}><Plus size={12} /> Request a system</Button>
            <Button size="sm" variant="default" onClick={() => pushToast({ title: `Exhibit ${registry?.exhibit ?? ''} exported`, body: 'The registry table with its revision history, as the contract exhibit.', tone: 'ok' })}>
              <ArrowUpRight size={12} /> Export exhibit
            </Button>
          </>
        }
      />

      <ProducedBy agents={['agt_herald']} what="reading the gateway's registry — what a call can resolve to, and nothing else" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Approved systems" value={approved.length} hint="the only models a call may resolve to" />
        <Metric size="sm" label="Pending approval" value={pending.length} deltaTone={pending.length ? 'warn' : 'ok'} hint={`${registry?.noticeHours ?? 72}-hour notice before approval`} />
        <Metric size="sm" label="Revoked" value={revoked.length} hint="refused at the gateway, history kept" />
        <Metric
          size="sm"
          label="Served model"
          value={registry?.servedModel ?? '—'}
          deltaTone={servedUsable ? 'ok' : 'crit'}
          hint={served ? (servedUsable ? `listed as ${served.id}` : served.status !== 'approved' ? `listed but ${served.status} — every call is refused` : 'outside residency — every call is refused') : 'not in the registry — every call is refused'}
        />
        <Metric size="sm" label="Attested no-training" value={`${systems.filter((s) => s.attestations?.noTrainingOnCustomerData).length} / ${systems.length}`} hint="vendor attestation on file" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="m-4">
            <Empty title="Registry unavailable" body={`The agent gateway did not answer (${error}). Start it with npm run gateway.`} />
          </div>
        )}

        {registry && (
          <Table>
            <thead>
              <tr>
                <Th>System</Th>
                <Th>Vendor / model</Th>
                <Th>Version</Th>
                <Th>Hosting · region</Th>
                <Th>Purposes</Th>
                <Th>Attestations</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => (
                <React.Fragment key={s.id}>
                  <Tr onClick={() => setOpen(open === s.id ? null : s.id)} selected={open === s.id} className={s.status === 'revoked' ? 'bg-crit/[0.05]' : s.status === 'pending' ? 'bg-warn/[0.05]' : undefined}>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Cpu size={12} className="shrink-0 text-ink-3" />
                        <span className="font-mono text-2xs text-ink">{s.id}</span>
                        {registry.servedModel === s.model && <Chip tone="brand">serving</Chip>}
                      </span>
                    </Td>
                    <Td><span className="text-ink">{s.vendor}</span> <span className="text-ink-2">{s.model}</span></Td>
                    <Td className="text-2xs text-ink-2">{s.version}</Td>
                    <Td className="text-2xs text-ink-2">
                      {s.hosting.replace(/_/g, ' ')} · {s.region}
                      {s.residency && !s.residency.ok && (
                        <span className="mt-0.5 flex items-center gap-1 text-warn" title={s.residency.reason}>
                          <TriangleAlert size={10} /> outside residency
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {s.purposes.map((p) => <Chip key={p} mono>{p}</Chip>)}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        <Chip tone={s.attestations?.zeroRetention ? 'ok' : 'warn'}>{s.attestations?.zeroRetention ? 'zero retention' : 'retains'}</Chip>
                        <Chip tone={s.attestations?.noTrainingOnCustomerData ? 'ok' : 'crit'}>{s.attestations?.noTrainingOnCustomerData ? 'no training' : 'may train'}</Chip>
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Chip tone={STATUS_TONE[s.status]}>{s.status}</Chip>
                        {s.status === 'pending' && s.noticeDueAt && (
                          <span className={cn('flex items-center gap-1 text-2xs', inNotice(s) ? 'text-ink-3' : 'text-ok')} title={inNotice(s) ? 'Earliest the approval can land' : 'Notice period elapsed'}>
                            <Clock size={10} /> {fmt(s.noticeDueAt)}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td>
                      {role.canApprove && (
                        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {s.status === 'approved' && (
                            <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => change(s, 'revoked', 'Revoked from the AI Systems register')}>
                              <Ban size={11} /> Revoke
                            </Button>
                          )}
                          {s.status !== 'approved' && !inNotice(s) && (
                            <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => change(s, 'approved', s.status === 'pending' ? 'Approved after the notice period' : 'Re-approved from the AI Systems register')}>
                              <Check size={11} /> Approve
                            </Button>
                          )}
                          {inNotice(s) && (
                            <Button size="sm" variant="ghost" disabled={busy === s.id} title="Approve inside the notice period — the override is recorded" onClick={() => overrideApprove(s)}>
                              <TriangleAlert size={11} /> Override
                            </Button>
                          )}
                        </span>
                      )}
                    </Td>
                  </Tr>
                  {open === s.id && (
                    <tr>
                      <Td colSpan={8} className="bg-sunken">
                        <div className="grid gap-4 py-2 md:grid-cols-3">
                          <div>
                            <div className="label-cap">Supply chain</div>
                            <ul className="mt-1 space-y-0.5 text-2xs text-ink-2">
                              {(s.supplyChain ?? []).map((c) => <li key={c.component}>· {c.component} — {c.provider}</li>)}
                              {!s.supplyChain?.length && <li className="text-ink-3">none recorded</li>}
                            </ul>
                          </div>
                          <div>
                            <div className="label-cap">Attestation</div>
                            <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-2">
                              <ShieldCheck size={11} className={cn('mt-[2px] shrink-0', s.attestations?.noTrainingOnCustomerData ? 'text-ok' : 'text-crit')} />
                              {s.attestations?.ref ?? 'no attestation on file'}
                            </p>
                            {s.residency && !s.residency.ok && <p className="mt-1 text-2xs text-warn">{s.residency.reason} ({s.residency.rule})</p>}
                            {s.approvedBy && <p className="mt-1 text-2xs text-ink-3">Approved by {s.approvedBy} · {s.approvedAt?.slice(0, 10)}</p>}
                            {s.requestedBy && <p className="mt-1 text-2xs text-ink-3">Requested by {s.requestedBy} · {s.requestedAt?.slice(0, 10)}</p>}
                          </div>
                          <div>
                            <div className="label-cap">Revision history</div>
                            <ul className="mt-1 space-y-0.5 text-2xs text-ink-2">
                              {(s.history ?? []).slice().reverse().map((h, i) => (
                                <li key={i}>· {h.at.slice(0, 10)} — {h.from} → <span className={h.override ? 'text-warn' : 'text-ink'}>{h.to}</span> by {h.by}: {h.reason}</li>
                              ))}
                              {!s.history?.length && <li className="text-ink-3">no changes recorded</li>}
                            </ul>
                          </div>
                        </div>
                      </Td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        )}

        {registry && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <Card
              title="Residency rules"
              subtitle={registry.residency?.policyRef ? `Enforced at resolution under ${registry.residency.policyRef}` : 'No residency rules configured — any region resolves'}
              right={<Globe size={13} className="text-ink-3" />}
            >
              {registry.residency ? (
                <dl className="space-y-1.5 text-2xs">
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Permitted regions</dt><dd className="flex flex-wrap justify-end gap-1">{(registry.residency.allowedRegions ?? []).length ? registry.residency.allowedRegions!.map((r) => <Chip key={r} mono>{r}</Chip>) : <span className="text-ink-2">any</span>}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Zero retention</dt><dd className="text-ink-2">{registry.residency.zeroRetentionRequired ? 'required for every system' : 'not required'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Systems outside the rules</dt><dd className={systems.some((s) => s.residency && !s.residency.ok) ? 'text-warn' : 'text-ok'}>{systems.filter((s) => s.residency && !s.residency.ok).length}</dd></div>
                  {registry.residency.note && <p className="pt-1 leading-relaxed text-ink-3">{registry.residency.note}</p>}
                </dl>
              ) : (
                <p className="text-2xs text-ink-3">Add a residency block to the registry to pin regions and require zero-retention attestations.</p>
              )}
            </Card>

            <Card
              title="Training-exclusion attestation"
              subtitle="No customer data trains, tunes, evaluates or improves a model for anyone else — attested on a cadence"
              right={<FileCheck2 size={13} className={attestationOverdue ? 'text-crit' : 'text-ok'} />}
            >
              {lastAttestation ? (
                <dl className="space-y-1.5 text-2xs">
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Last attested</dt><dd className="text-ink-2">{lastAttestation.at.slice(0, 10)} by {lastAttestation.by}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Next due</dt><dd className={attestationOverdue ? 'text-crit' : 'text-ok'}>{lastAttestation.nextDueAt.slice(0, 10)}{attestationOverdue ? ' · overdue' : ''}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Rests on</dt><dd className="text-right text-ink-2">{lastAttestation.vendorRef}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Scope</dt><dd className="text-right text-ink-2">{lastAttestation.scope}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">On record</dt><dd className="text-ink-2">{attestations.length} attestation{attestations.length === 1 ? '' : 's'}</dd></div>
                </dl>
              ) : (
                <p className="text-2xs text-crit">No attestation on record.</p>
              )}
              {role.canApprove && (
                <div className="mt-3">
                  <Button size="sm" variant="default" onClick={() => {
                    const ref = window.prompt('Vendor document the attestation rests on (contract, addendum, date):', lastAttestation?.vendorRef ?? '')
                    if (!ref?.trim()) return
                    attest(role.person, ref.trim(), lastAttestation?.scope ?? 'Every approved AI system in the registry')
                  }}>
                    <FileCheck2 size={11} /> Attest now
                  </Button>
                </div>
              )}
            </Card>

            <Card
              title="Certified deletion"
              subtitle="Irreversible, so never by an agent: two named humans, a manifest, and the chain's root hash at the moment of deletion"
              right={<Trash2 size={13} className="text-ink-3" />}
            >
              {deletions.length === 0 ? (
                <p className="text-2xs text-ink-3">No deletions certified this session.</p>
              ) : (
                <ul className="space-y-2">
                  {deletions.map((d) => (
                    <li key={d.id} className="rounded border border-line bg-sunken p-2.5 text-2xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-ink">{d.id}</span>
                        <Chip mono>{d.scope.label}</Chip>
                        <span className="ml-auto text-ink-3">{d.at.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="mt-1 text-ink-2">{d.counts.workObjects} work objects, {d.counts.runs} runs, {d.counts.assertions} stale assertions removed — {d.reason}</p>
                      <p className="mt-1 font-mono text-[10px] text-ink-3">signers {d.requestedBy} + {d.secondControl} · pre-root {d.preRootHash.slice(0, 12)}… · manifest {d.manifestHash.slice(0, 12)}…</p>
                    </li>
                  ))}
                </ul>
              )}
              {role.canApprove && (
                <div className="mt-3">
                  <Button size="sm" variant="danger" onClick={() => setDeleting(true)}><Trash2 size={11} /> Certify a deletion</Button>
                </div>
              )}
            </Card>

            <Card title="Enforcement" subtitle="The registry is not a policy document; it is the only path a call can take">
              <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
                <li>· The gateway resolves the configured model against this registry for the purpose each phase serves. A model that is not listed, is revoked, is still pending, sits outside the residency rules, or is not approved for that purpose is refused before any vendor request is made.</li>
                <li>· A new system enters as pending with a {registry.noticeHours}-hour notice clock. Approval before the clock ends needs a typed override, which is recorded against the system and in the evidence chain.</li>
                <li>· The settings screen may only select among approved systems — it cannot introduce one.</li>
                <li>· Every completed call reports the model the vendor actually served; a difference from the registered model is recorded as the start of the change-notice clock.</li>
              </ul>
            </Card>
          </div>
        )}
      </div>

      <RequestDrawer open={requesting} onClose={() => setRequesting(false)} purposeOptions={purposeOptions} regions={registry?.residency?.allowedRegions ?? []} onSubmit={submitRequest} />
      <DeletionDrawer open={deleting} onClose={() => setDeleting(false)} />
    </>
  )
}

/* ------------------------------ Deletion drawer ----------------------------- */

function DeletionDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const work = useAstra((s) => s.work)
  const runs = useAstra((s) => s.runs)
  const assertions = useAstra((s) => s.assertions)
  const certify = useAstra((s) => s.certifyDeletion)
  const [tower, setTower] = React.useState(TOWERS[0]?.id ?? '')
  const [second, setSecond] = React.useState('')
  const [reason, setReason] = React.useState('')

  const manifest = React.useMemo(() => deletionManifest(Object.values(work), Object.values(runs), assertions, tower), [work, runs, assertions, tower])
  const sameSigner = second.trim() && second.trim().toLowerCase() === role.person.toLowerCase()
  const valid = tower && second.trim() && !sameSigner && reason.trim() && (manifest.workIds.length + manifest.assertionIds.length) > 0

  return (
    <Drawer open={open} onClose={onClose} title="Certify a deletion" subtitle="Closed work, its runs and stale assertions for one tower — never open work, never the chain" width="max-w-[520px]">
      <div className="space-y-3 p-4">
        <Field label="Scope — tower">
          <select value={tower} onChange={(e) => setTower(e.target.value)} className={selectClass}>
            {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="rounded border border-line bg-sunken p-3 text-2xs text-ink-2">
          <div className="label-cap">Manifest preview</div>
          <p className="mt-1">{manifest.workIds.length} closed work objects · {manifest.runIds.length} runs · {manifest.assertionIds.length} stale assertions in {TOWER_BY_ID[tower]?.name}</p>
          {manifest.workIds.length + manifest.assertionIds.length === 0 && <p className="mt-1 text-ink-3">Nothing in scope for this tower.</p>}
        </div>
        <Field label="Requested by"><input value={role.person} readOnly className={cn(inputClass, 'text-ink-3')} /></Field>
        <Field label="Second control (a different named human)" hint={sameSigner ? 'Four-eyes: the second control must be a different person' : undefined}>
          <input value={second} onChange={(e) => setSecond(e.target.value)} className={cn(inputClass, sameSigner && 'border-crit')} placeholder="e.g. V. Marchetti" />
        </Field>
        <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inputClass, 'resize-none')} placeholder="Retention schedule, customer request, contract exit…" /></Field>
        <div className="flex gap-2">
          <Button variant="danger" disabled={!valid} onClick={() => { certify(tower, role.person, second.trim(), reason.trim()); setSecond(''); setReason(''); onClose() }}>
            <Trash2 size={12} /> Delete and certify
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
        <p className="text-2xs leading-relaxed text-ink-3">
          AC-71 rules: no agent may execute this at any level. The certificate records both signers, the counts, the digest of the ordered manifest and the evidence chain's root hash immediately before deletion, and is itself the next sealed record.
        </p>
      </div>
    </Drawer>
  )
}

/* ------------------------------ Request drawer ------------------------------ */

function RequestDrawer({ open, onClose, purposeOptions, regions, onSubmit }: {
  open: boolean
  onClose: () => void
  purposeOptions: string[]
  regions: string[]
  onSubmit: (input: Record<string, unknown>, reason: string) => Promise<void>
}) {
  const pushToast = useAstra((s) => s.pushToast)
  const [vendor, setVendor] = React.useState('')
  const [model, setModel] = React.useState('')
  const [version, setVersion] = React.useState('')
  const [hosting, setHosting] = React.useState('vendor_cloud')
  const [region, setRegion] = React.useState(regions[0] ?? '')
  const [purposes, setPurposes] = React.useState<string[]>([])
  const [zdr, setZdr] = React.useState(false)
  const [noTrain, setNoTrain] = React.useState(false)
  const [ref, setRef] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => { if (!region && regions[0]) setRegion(regions[0]) }, [regions, region])

  const toggle = (p: string) => setPurposes((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  const valid = vendor.trim() && model.trim() && purposes.length > 0 && reason.trim()

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit({
        vendor: vendor.trim(), model: model.trim(), version: version.trim() || 'unspecified', hosting, region: region.trim() || 'unspecified',
        purposes, attestations: { zeroRetention: zdr, noTrainingOnCustomerData: noTrain, ref: ref.trim() || 'none on file' },
      }, reason.trim())
      setVendor(''); setModel(''); setVersion(''); setPurposes([]); setZdr(false); setNoTrain(false); setRef(''); setReason('')
      onClose()
    } catch (e) {
      pushToast({ title: 'Request refused', body: (e as Error).message, tone: 'crit' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Request a new AI system" subtitle="Enters the registry as pending; the notice clock starts now" width="max-w-[520px]">
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor"><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputClass} placeholder="e.g. Anthropic" /></Field>
          <Field label="Model id"><input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} placeholder="exact API model id" /></Field>
          <Field label="Version"><input value={version} onChange={(e) => setVersion(e.target.value)} className={inputClass} placeholder="vendor snapshot" /></Field>
          <Field label="Hosting">
            <select value={hosting} onChange={(e) => setHosting(e.target.value)} className={selectClass}>
              {HOSTINGS.map((h) => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Region" hint={regions.length ? `permitted: ${regions.join(', ')}` : undefined}>
            <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} placeholder="e.g. us-central" />
          </Field>
        </div>
        <Field label="Purposes">
          <div className="flex flex-wrap gap-1.5">
            {purposeOptions.map((p) => (
              <button key={p} type="button" onClick={() => toggle(p)} className={cn('rounded border px-2 py-0.5 font-mono text-2xs', purposes.includes(p) ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-ink-2 hover:border-ink-3')}>
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Attestations">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-2xs text-ink-2"><input type="checkbox" checked={zdr} onChange={(e) => setZdr(e.target.checked)} className="accent-brand" /> Zero-retention configuration available and enabled</label>
            <label className="flex items-center gap-2 text-2xs text-ink-2"><input type="checkbox" checked={noTrain} onChange={(e) => setNoTrain(e.target.checked)} className="accent-brand" /> Vendor attests no training on customer data</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} placeholder="attestation reference (contract, addendum, date)" />
          </div>
        </Field>
        <Field label="Reason for the request"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inputClass, 'resize-none')} placeholder="What it is for, and why an existing system does not cover it" /></Field>
        <div className="flex gap-2">
          <Button variant="primary" disabled={!valid || busy} onClick={submit}><Plus size={12} /> Submit request</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Drawer>
  )
}
