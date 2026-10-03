import React from 'react'
import { Download, PackageOpen, ScrollText } from 'lucide-react'
import { useAstra } from '@/domain/store'
import {
  FORMAT_LABEL, OWNERSHIP_LABEL, PACK_PARTS, WITHHELD,
  type Ownership, type PackExport, type PackPart,
} from '@/domain/successorPack'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   The successor pack.

   What the client walks away with, part by part: what it is for, whose it
   is, how many records it holds and where they are read from. Every part
   builds here and now — the download button and the agent's tool emit the
   same content through the same function — and a production seals a
   manifest so what was handed over can be checked later, part by part.
   ========================================================================== */

const OWNERSHIP_TONE: Record<Ownership, 'brand' | 'neutral'> = { client: 'brand', supplier_grant: 'neutral' }

const n = (x: number) => x.toLocaleString('en-GB')
const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Hands the part to the browser as a file. The same build the tool calls. */
function download(part: PackPart) {
  const content = part.build()
  const type = part.format === 'json' ? 'application/json' : part.format === 'csv' ? 'text/csv' : 'text/markdown'
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${part.id}.${part.format === 'markdown' ? 'md' : part.format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function useExports(): PackExport[] {
  const log = useAstra((s) => s.packExports)
  return React.useMemo(() => [...log].sort((a, b) => b.at.localeCompare(a.at)), [log])
}

function PackMetrics({ size: cardSize }: CardProps) {
  const log = useExports()
  const last = log[0] ?? null
  const records = React.useMemo(() => PACK_PARTS.reduce((t, p) => t + p.rows(), 0), [])
  const clientOwned = PACK_PARTS.filter((p) => p.ownership === 'client').length
  return (
    <Band size={cardSize} cols={6}>
      <Metric size="sm" label="Parts" value={PACK_PARTS.length} hint={`${clientOwned} the client’s own`} />
      <Metric size="sm" label="Records" value={n(records)} hint="built on request" />
      <Metric size="sm" label="Withheld" value={WITHHELD.length} hint="each with its reason" />
      <Metric size="sm" label="Produced" value={log.length} deltaTone={log.length ? 'ok' : 'crit'} hint={log.length ? 'manifests sealed' : 'never produced'} />
      <Metric size="sm" label="Last produced" value={last ? stamp(last.at).split(',')[0] : 'Never'} hint={last ? last.by : 'counted, not produced'} />
      <Metric size="sm" label="Pack digest" value={last ? last.manifest.digest.slice(0, 8) : '—'} hint={last ? size(last.manifest.bytes) : undefined} />
    </Band>
  )
}

function PartsTable({ rows, full, digests }: { rows: PackPart[]; full: boolean; digests?: Record<string, { bytes: number; digest: string }> }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Part</Th><Th>Whose</Th><Th align="right">Records</Th><Th>Format</Th>
          {full && <Th>What the successor does with it</Th>}{full && <Th>Read from</Th>}
          {digests && <Th>As produced</Th>}
          {full && <Th />}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const built = digests?.[p.id]
          return (
            <Tr key={p.id}>
              <Td className="max-w-[230px] text-2xs text-ink">{p.name}</Td>
              <Td><Chip tone={OWNERSHIP_TONE[p.ownership]} className="whitespace-nowrap">{OWNERSHIP_LABEL[p.ownership]}</Chip></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{n(p.rows())}</Td>
              <Td className="text-2xs text-ink-3">{FORMAT_LABEL[p.format]}</Td>
              {full && <Td className="max-w-[330px] text-2xs leading-snug text-ink-2">{p.purpose}</Td>}
              {full && <Td className="max-w-[200px] text-2xs leading-snug text-ink-3">{p.readFrom}</Td>}
              {digests && (
                <Td className="tnum whitespace-nowrap text-2xs text-ink-3">
                  {built ? `${size(built.bytes)} · ${built.digest.slice(0, 8)}` : '—'}
                </Td>
              )}
              {full && (
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => download(p)}>
                    <Download size={11} />Download
                  </Button>
                </Td>
              )}
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function PackBody({ props, size: cardSize }: CardProps) {
  const log = useExports()
  const last = log[0] ?? null
  const digests = React.useMemo(
    () => (last ? Object.fromEntries(last.manifest.parts.map((p) => [p.id, { bytes: p.bytes, digest: p.digest }])) : undefined),
    [last],
  )
  const focus = String(props.focus ?? '')

  if (cardSize !== 'page') {
    if (focus === 'productions' && log.length) {
      return (
        <Table>
          <thead><tr><Th>Produced</Th><Th>By</Th><Th align="right">Records</Th><Th>Digest</Th></tr></thead>
          <tbody>
            {log.map((e) => (
              <Tr key={e.id}>
                <Td className="text-2xs text-ink">{stamp(e.at)}</Td>
                <Td className="text-2xs text-ink-2">{e.by}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{n(e.manifest.rows)}</Td>
                <Td className="tnum text-2xs text-ink-3">{e.manifest.digest.slice(0, 12)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )
    }
    const shown = limit(PACK_PARTS, cardSize, 6)
    return <><PartsTable rows={shown} full={false} digests={digests} /><More shown={shown.length} total={PACK_PARTS.length} /></>
  }

  return (
    <>
      <Card
        title="What the successor starts from"
        subtitle={`${PACK_PARTS.length} parts · ${n(PACK_PARTS.reduce((t, p) => t + p.rows(), 0))} records · every part builds on request`}
        right={<PackageOpen size={13} className="text-ink-3" />}
      >
        <PartsTable rows={PACK_PARTS} full digests={digests} />
      </Card>

      <Card
        className="mt-4"
        title="Deliberately not in the pack"
        subtitle={`${WITHHELD.length} exclusions, each with its reason`}
        right={<ScrollText size={13} className="text-ink-3" />}
      >
        <Table>
          <thead><tr><Th>Not included</Th><Th>Why</Th></tr></thead>
          <tbody>
            {WITHHELD.map((w) => (
              <Tr key={w.what}>
                <Td className="max-w-[240px] text-2xs text-ink">{w.what}</Td>
                <Td className="max-w-[560px] text-2xs leading-snug text-ink-3">{w.why}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card
        className="mt-4"
        title="Productions"
        subtitle={log.length ? `${log.length} sealed · last by ${last!.by}` : 'Never produced: the pack has only ever been counted'}
        right={<ScrollText size={13} className="text-ink-3" />}
      >
        {log.length ? (
          <Table>
            <thead>
              <tr><Th>Produced</Th><Th>By</Th><Th>Reason</Th><Th align="right">Parts</Th><Th align="right">Records</Th><Th align="right">Size</Th><Th>Pack digest</Th><Th>Sealed as</Th></tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <Tr key={e.id}>
                  <Td className="tnum whitespace-nowrap text-2xs text-ink">{stamp(e.at)}</Td>
                  <Td className="text-2xs text-ink-2">{e.by}</Td>
                  <Td className="max-w-[240px] text-2xs leading-snug text-ink-2">{e.reason}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{e.manifest.parts.length}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{n(e.manifest.rows)}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{size(e.manifest.bytes)}</Td>
                  <Td className="tnum text-2xs text-ink-3">{e.manifest.digest.slice(0, 12)}</Td>
                  <Td>{e.evidenceId ? <Chip tone="ok">{e.evidenceId}</Chip> : <span className="text-2xs text-ink-3">—</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead><tr><Th>Part</Th><Th>State</Th></tr></thead>
            <tbody>
              {PACK_PARTS.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-2xs text-ink">{p.name}</Td>
                  <Td><Chip>Builds on request, never produced</Chip></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

export const successorPackView: ArtifactView = {
  Body: PackBody,
  Metrics: PackMetrics,
  page: {
    title: 'Successor pack',
    subtitle: 'What the client walks away with, what is deliberately not in it, and every production with its sealed manifest',
    agents: ['agt_archivist', 'agt_herald'],
    what: 'building each part from the records it names',
  },
}
