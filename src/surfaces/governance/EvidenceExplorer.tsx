import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileDown, FlaskConical, RotateCcw, ShieldCheck, ShieldX, Link2 } from 'lucide-react'
import { EVIDENCE_KIND_LABEL, GENESIS } from '@/domain/evidence'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { AgentChip, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Drawer, Empty, Metric, Table, Td, Th, Tr, inputClass, selectClass } from '@/ui/primitives'
import { cn, dateTime, num } from '@/lib/format'
import type { EvidenceKind, EvidenceRecord } from '@/domain/types'
import { OPERATIONAL } from '@/domain/metrics'

const KIND_TONE: Record<EvidenceKind, 'neutral' | 'info' | 'warn' | 'brand' | 'ok' | 'agent' | 'crit'> = {
  observation: 'neutral', decision: 'warn', approval: 'brand', action: 'crit',
  verification: 'ok', economic: 'info', clock: 'neutral', knowledge: 'agent',
}

export function EvidenceExplorer() {
  const [params, setParams] = useSearchParams()
  const evidence = useAstra((s) => s.evidence)
  const verification = useAstra((s) => s.verification)
  const runVerify = useAstra((s) => s.runChainVerification)
  const tamper = useAstra((s) => s.tamperEvidence)
  const restore = useAstra((s) => s.restoreEvidence)
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [q, setQ] = React.useState(params.get('q') ?? '')
  const [kind, setKind] = React.useState<'all' | EvidenceKind>('all')
  const [detail, setDetail] = React.useState<EvidenceRecord | null>(null)

  React.useEffect(() => {
    const incoming = params.get('q')
    if (incoming) setQ(incoming)
  }, [params])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return evidence
      .filter((r) => (kind === 'all' || r.kind === kind))
      .filter((r) => {
        if (!needle) return true
        return (
          r.id.toLowerCase().includes(needle) ||
          r.actor.toLowerCase().includes(needle) ||
          r.summary.toLowerCase().includes(needle) ||
          (r.workObjectId ?? '').toLowerCase().includes(needle) ||
          (r.agentId ?? '').toLowerCase().includes(needle) ||
          (r.actionClass ?? '').toLowerCase().includes(needle) ||
          r.hash.startsWith(needle)
        )
      })
      .slice(-400)
      .reverse()
  }, [evidence, q, kind])

  const tampered = evidence.filter((r) => r.tampered)

  return (
    <>
      <PageHeader
        title="Evidence Explorer"
        subtitle="Append-only, hash-linked · retention 7 years"
        meta={role.readOnly ? <Chip tone="neutral">read-only session</Chip> : undefined}
        actions={
          <>
            <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Regulator pack exported', body: 'PDF with chain attestation, plus CEF/OCSF stream to the client SIEM and a GRC adapter push.', tone: 'ok' })}>
              <FileDown size={12} /> Export pack
            </Button>
            <Button size="sm" variant="primary" onClick={runVerify}>
              <ShieldCheck size={12} /> Verify chain
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Records in chain" value={num(evidence.length)} hint="7-year retention" />
        <Metric size="sm" label="Sealed" value={num(evidence.filter((r) => r.sealed).length)} hint="RPO 0" />
        <Metric
          size="sm"
          label="Chain state"
          value={verification ? (verification.valid ? 'verified' : 'broken') : 'not checked'}
          deltaTone={verification ? (verification.valid ? 'ok' : 'crit') : 'neutral'}
          hint={verification ? `${verification.checked} records in ${verification.durationMs} ms` : 'not yet verified'}
        />
        <Metric size="sm" label="Daily root anchored" value="external" />
        <Metric size="sm" label="Retrieval latency" value={`< ${OPERATIONAL.evidenceRetrievalSec} s`} />
      </div>

      {verification && (
        <div className={cn('flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2', verification.valid ? 'border-ok/35 bg-ok/[0.06]' : 'border-crit/40 bg-crit/[0.07]')}>
          {verification.valid ? <ShieldCheck size={14} className="shrink-0 text-ok" /> : <ShieldX size={14} className="shrink-0 text-crit" />}
          <span className="min-w-0 flex-1 text-2xs leading-relaxed text-ink-2">
            {verification.valid ? (
              <>
                Chain intact. {num(verification.checked)} records recomputed in {verification.durationMs} ms, from genesis{' '}
                <span className="font-mono text-ink-3">{GENESIS.slice(0, 8)}…</span> to root{' '}
                <span className="font-mono text-ink">{verification.rootHash.slice(0, 16)}…</span>
              </>
            ) : (
              <>
                Chain broken at sequence <span className="tnum text-crit">{verification.firstBreakSeq}</span>.{' '}
                {verification.brokenIds.length} record{verification.brokenIds.length > 1 ? 's do' : ' does'} not match the recomputed digest.
              </>
            )}
          </span>
          {tampered.length > 0 && (
            <Button size="sm" variant="default" onClick={restore}><RotateCcw size={11} /> Restore record</Button>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}) }}
          placeholder="Search by record id, work object, agent, action class, actor, summary or hash prefix…"
          className={cn(inputClass, 'flex-1')}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={cn(selectClass, 'w-[180px]')}>
          <option value="all">All record kinds</option>
          {(Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[]).map((k) => (
            <option key={k} value={k}>{EVIDENCE_KIND_LABEL[k]}</option>
          ))}
        </select>
        <span className="tnum shrink-0 text-2xs text-ink-3">{num(filtered.length)} shown</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <Empty title="No records match" body="Try a work object reference, an agent id, an action class such as AC-31, or a hash prefix." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th align="right">Seq</Th>
                <Th>Record</Th>
                <Th>Kind</Th>
                <Th>Actor</Th>
                <Th>Summary</Th>
                <Th>Linked</Th>
                <Th>Digest</Th>
                <Th>At</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Tr key={r.id} onClick={() => setDetail(r)} className={r.tampered ? 'bg-crit/[0.07]' : undefined}>
                  <Td align="right" className="font-mono text-ink-3">{r.seq}</Td>
                  <Td className="font-mono text-ink-2">{r.id}</Td>
                  <Td><Chip tone={KIND_TONE[r.kind]}>{EVIDENCE_KIND_LABEL[r.kind]}</Chip></Td>
                  <Td className="max-w-[150px] truncate">{r.actor}</Td>
                  <Td className="max-w-[380px] truncate text-ink">{r.summary}</Td>
                  <Td className="text-2xs">
                    <span className="flex flex-wrap items-center gap-1">
                      {r.workObjectId && (
                        <Link to={`/operate/work/${r.workObjectId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-brand-ink hover:underline">{r.workObjectId}</Link>
                      )}
                      {r.actionClass && <Chip mono>{r.actionClass}</Chip>}
                      {r.agentId && <AgentChip id={r.agentId} />}
                    </span>
                  </Td>
                  <Td className="font-mono text-[10px] text-ink-3">{r.hash.slice(0, 12)}…</Td>
                  <Td className="whitespace-nowrap text-2xs text-ink-3">{dateTime(r.at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? detail.summary : ''}
        subtitle={detail ? `${detail.id} · sequence ${detail.seq} · ${dateTime(detail.at)}` : ''}
        width="max-w-[640px]"
        footer={
          detail && !role.readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                onClick={() => { tamper(detail.id); setDetail(null) }}
                disabled={detail.tampered}
              >
                <FlaskConical size={12} /> Alter this record
              </Button>
              <span className="text-2xs leading-relaxed text-ink-3">
                Demonstration control — tamper with a record, then verify.
              </span>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-cap">Kind</div>
                <div className="mt-1"><Chip tone={KIND_TONE[detail.kind]}>{EVIDENCE_KIND_LABEL[detail.kind]}</Chip></div>
              </div>
              <div>
                <div className="label-cap">Sealed</div>
                <div className="mt-1"><Chip tone={detail.sealed ? 'ok' : 'neutral'}>{detail.sealed ? 'sealed & exported' : 'unsealed'}</Chip></div>
              </div>
            </div>

            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Hash chain</div>
              <dl className="mt-1.5 space-y-1.5 font-mono text-[10px]">
                <div>
                  <dt className="text-ink-3">prevHash</dt>
                  <dd className="break-all text-ink-2">{detail.prevHash}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">hash</dt>
                  <dd className={cn('break-all', detail.tampered ? 'text-crit' : 'text-ok')}>{detail.hash}</dd>
                </div>
              </dl>
            </div>

            <div>
              <div className="label-cap">Payload</div>
              <pre className="mt-1.5 overflow-x-auto rounded border border-line bg-sunken p-3 font-mono text-[10px] leading-relaxed text-ink-2">
{JSON.stringify(detail.payload, null, 2)}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-3 text-2xs">
              <div><span className="text-ink-3">Actor</span><div className="text-ink-2">{detail.actor}</div></div>
              {detail.workObjectId && <div><span className="text-ink-3">Work object</span><div className="font-mono text-ink-2">{detail.workObjectId}</div></div>}
              {detail.runId && <div><span className="text-ink-3">Run</span><div className="font-mono text-ink-2">{detail.runId}</div></div>}
              {detail.agentId && <div><span className="text-ink-3">Agent</span><div className="mt-0.5"><AgentChip id={detail.agentId} /></div></div>}
              {detail.actionClass && <div><span className="text-ink-3">Action class</span><div className="font-mono text-ink-2">{detail.actionClass}</div></div>}
            </div>

            <div className="rounded border border-line p-3">
              <div className="flex items-center gap-1.5"><Link2 size={11} className="text-brand-ink" /><span className="label-cap">Export adapters</span></div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                <Chip>SIEM · CEF, OCSF</Chip> <Chip>GRC platform</Chip> <Chip>Regulator PDF pack</Chip>
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
