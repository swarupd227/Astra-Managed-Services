import React from 'react'
import { ArrowUpRight, Ban, Check, Clock, Cpu, RotateCcw, ShieldCheck } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   AI Systems — the registry the gateway enforces.

   This screen reads the gateway's registry rather than a seed file, because
   the gateway is the system of record: what is listed here is what a call
   can resolve to, and nothing else. Approval and revocation write back to it.
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
  history?: { at: string; by: string; from: string; to: string; reason: string }[]
}

interface Registry {
  version: number
  exhibit: string
  policyRef: string
  servedModel: string | null
  systems: AiSystem[]
}

const STATUS_TONE: Record<AiSystem['status'], 'ok' | 'warn' | 'crit'> = { approved: 'ok', pending: 'warn', revoked: 'crit' }

export function AiSystems() {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const logEvidence = useAstra((s) => s.logEvidence)
  const pushToast = useAstra((s) => s.pushToast)

  const [registry, setRegistry] = React.useState<Registry | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    fetch('/api/agent/registry')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`gateway returned ${r.status}`))))
      .then((j: Registry) => { setRegistry(j); setError(null) })
      .catch((e: Error) => setError(e.message))
  }, [])

  React.useEffect(() => { load() }, [load])

  const change = async (system: AiSystem, status: AiSystem['status'], reason: string) => {
    setBusy(system.id)
    try {
      const res = await fetch('/api/agent/registry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: system.id, status, by: role.person, reason }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error ?? 'The gateway refused the change')
      setRegistry({ version: j.version, exhibit: j.exhibit, policyRef: j.policyRef, servedModel: j.servedModel, systems: j.systems })
      // The registry change is a governance decision; approval is a human approval.
      const evId = logEvidence(
        status === 'approved' ? 'approval' : 'decision',
        role.person,
        `AI system ${system.id} ${status} — ${system.vendor} ${system.model} (Exhibit ${j.exhibit} v${j.version})`,
        { from: j.from, to: status, reason, purposes: system.purposes, hosting: system.hosting, region: system.region },
      )
      pushToast({
        title: status === 'revoked' ? `${system.model} revoked` : `${system.model} ${status}`,
        body: status === 'revoked' ? 'Every call resolving to this system is refused at the gateway from now on.' : 'Listed in the exhibit; the gateway will resolve to it.',
        tone: status === 'revoked' ? 'crit' : 'ok',
        evidenceId: evId,
      })
    } catch (e) {
      pushToast({ title: 'Registry change refused', body: (e as Error).message, tone: 'crit' })
    } finally {
      setBusy(null)
    }
  }

  const systems = registry?.systems ?? []
  const approved = systems.filter((s) => s.status === 'approved')
  const pending = systems.filter((s) => s.status === 'pending')
  const revoked = systems.filter((s) => s.status === 'revoked')
  const served = registry?.servedModel ? systems.find((s) => s.model === registry.servedModel) : undefined

  return (
    <>
      <PageHeader
        title="AI Systems"
        subtitle={registry ? `Exhibit ${registry.exhibit} · registry v${registry.version} · enforced at the gateway under ${registry.policyRef}` : 'The approved model registry'}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={load}><RotateCcw size={12} /> Refresh</Button>
            <Button size="sm" variant="default" onClick={() => pushToast({ title: `Exhibit ${registry?.exhibit ?? ''} exported`, body: 'The registry table with its revision history, as the contract exhibit.', tone: 'ok' })}>
              <ArrowUpRight size={12} /> Export exhibit
            </Button>
          </>
        }
      />

      <ProducedBy agents={['agt_herald']} what="reading the gateway's registry — what a call can resolve to, and nothing else" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Approved systems" value={approved.length} hint="the only models a call may resolve to" />
        <Metric size="sm" label="Pending approval" value={pending.length} deltaTone={pending.length ? 'warn' : 'ok'} hint="72-hour notice running" />
        <Metric size="sm" label="Revoked" value={revoked.length} hint="refused at the gateway, history kept" />
        <Metric
          size="sm"
          label="Served model"
          value={registry?.servedModel ?? '—'}
          deltaTone={served && served.status === 'approved' ? 'ok' : 'crit'}
          hint={served ? (served.status === 'approved' ? `listed as ${served.id}` : `listed but ${served.status} — every call is refused`) : 'not in the registry — every call is refused'}
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
                    <Td className="text-2xs text-ink-2">{s.hosting.replace(/_/g, ' ')} · {s.region}</Td>
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
                          <span className="flex items-center gap-1 text-2xs text-ink-3" title="Earliest the approval can land">
                            <Clock size={10} /> {s.noticeDueAt.slice(0, 16).replace('T', ' ')}
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
                          {s.status !== 'approved' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === s.id || (s.status === 'pending' && Boolean(s.noticeDueAt) && new Date(s.noticeDueAt!) > new Date())}
                              title={s.status === 'pending' && s.noticeDueAt && new Date(s.noticeDueAt) > new Date() ? 'The 72-hour notice has not elapsed' : undefined}
                              onClick={() => change(s, 'approved', s.status === 'pending' ? 'Approved after the notice period' : 'Re-approved from the AI Systems register')}
                            >
                              <Check size={11} /> Approve
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
                            {s.approvedBy && <p className="mt-1 text-2xs text-ink-3">Approved by {s.approvedBy} · {s.approvedAt?.slice(0, 10)}</p>}
                            {s.requestedBy && <p className="mt-1 text-2xs text-ink-3">Requested by {s.requestedBy} · {s.requestedAt?.slice(0, 10)}</p>}
                          </div>
                          <div>
                            <div className="label-cap">Revision history</div>
                            <ul className="mt-1 space-y-0.5 text-2xs text-ink-2">
                              {(s.history ?? []).slice().reverse().map((h, i) => (
                                <li key={i}>· {h.at.slice(0, 10)} — {h.from} → <span className="text-ink">{h.to}</span> by {h.by}: {h.reason}</li>
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
          <div className="p-4">
            <Card title="How this is enforced" subtitle="The registry is not a policy document; it is the only path a call can take">
              <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
                <li>· The gateway resolves the configured model against this registry for the purpose each phase serves. A model that is not listed, is revoked, is still pending, or is not approved for that purpose is refused before any vendor request is made.</li>
                <li>· The settings screen may only select among approved systems — it cannot introduce one.</li>
                <li>· Every completed call reports the model the vendor actually served; a difference from the registered model is recorded as the start of the change-notice clock.</li>
                <li>· Approval, revocation and re-approval are written back with their history, so the exported exhibit and the enforced registry are the same file.</li>
              </ul>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
