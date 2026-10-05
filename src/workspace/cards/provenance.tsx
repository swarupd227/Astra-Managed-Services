import { FileSearch } from 'lucide-react'
import { PAGES } from '@/app/nav'
import {
  MATURITY_LABEL, ORIGIN_LABEL, ORIGIN_MEANING, ORIGIN_ORDER,
  provenanceFor, provenanceSummary,
  type DataSet, type Maturity, type Origin, type ProvenanceSummary,
} from '@/domain/provenance'
import { Card, Chip, Hint, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Where the figures come from.

   One row per dataset the application reads: its origin, the file or seed it
   came from, the screens it feeds, and what a reader must not do with it.
   The same register drives the marker in every page header, so a screen
   cannot describe itself one way here and another way there.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const ORIGIN_TONE: Record<Origin, Tone> = {
  client_extract: 'ok', platform_record: 'info', declared: 'warn', seeded: 'warn', not_built: 'neutral',
}
const MATURITY_TONE: Record<Maturity, Tone> = { live: 'ok', partial: 'warn', not_built: 'neutral' }

/**
 * The screens a dataset feeds, named as a person would name them. A screen
 * behind a group entry has no navigation row of its own, so its route's last
 * segment stands in rather than a raw path.
 */
const WORKSPACE: Record<string, string> = { '/': 'Workspace', '/w/': 'Workspace thread', '/brief': 'Brief' }

const screenName = (route: string) =>
  PAGES.find((n) => n.to === route)?.label
  ?? WORKSPACE[route]
  ?? route.split('/').filter(Boolean).pop()!.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())

const screensOf = (d: DataSet) => [...new Set(d.routes.map(screenName))]

/** The same counts, over one screen's datasets. */
function scopedSummary(path: string): ProvenanceSummary {
  const datasets = provenanceFor(path).datasets
  return {
    datasets,
    byOrigin: datasets.reduce(
      (acc, d) => ({ ...acc, [d.origin]: acc[d.origin] + 1 }),
      { client_extract: 0, platform_record: 0, seeded: 0, declared: 0, not_built: 0 } as Record<Origin, number>,
    ),
    routes: new Set(datasets.flatMap((d) => d.routes)).size,
    withCaution: datasets.filter((d) => d.caution).length,
  }
}

function ProvenanceMetrics({ props, size }: CardProps) {
  const path = String(props.path ?? '')
  const whole = provenanceSummary()
  // A card asked about one screen counts that screen's datasets, not the register's.
  const s = path ? scopedSummary(path) : whole
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Datasets" value={s.datasets.length} hint={path ? `feeding ${path}` : `across ${s.routes} screens`} />
      <Metric size="sm" label="From the client" value={s.byOrigin.client_extract} deltaTone="ok" hint="their own files, scoped and counted" />
      <Metric size="sm" label="Written by the platform" value={s.byOrigin.platform_record} deltaTone="ok" />
      <Metric size="sm" label="Demonstration" value={s.byOrigin.seeded} deltaTone="warn" hint="never evidence of this estate" />
      <Metric size="sm" label="Declared" value={s.byOrigin.declared} deltaTone="warn" hint="carried with whose statement it is" />
      <Metric size="sm" label="Carrying a caution" value={s.withCaution} hint={path ? undefined : `of ${whole.datasets.length} datasets`} />
    </Band>
  )
}

function DatasetsTable({ rows, full }: { rows: DataSet[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr><Th>What the figures are about</Th><Th>Origin</Th><Th>Source</Th>{full && <Th>Screens</Th>}{full && <Th>Do not use it for</Th>}<Th>State</Th></tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <Tr key={d.id}>
            <Td className="max-w-[250px] text-2xs text-ink">
              {d.name}
              {d.asOf && <span className="tnum block text-[10px] text-ink-3">as at {new Date(d.asOf).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
            </Td>
            <Td>
              <Hint text={ORIGIN_MEANING[d.origin]}>
                <Chip tone={ORIGIN_TONE[d.origin]} className="whitespace-nowrap">{ORIGIN_LABEL[d.origin]}</Chip>
              </Hint>
            </Td>
            <Td className="max-w-[330px] text-2xs leading-snug text-ink-2">{d.source}</Td>
            {full && (
              <Td>
                <div className="flex max-w-[220px] flex-wrap gap-1">
                  {screensOf(d).map((name) => <Chip key={name}>{name}</Chip>)}
                </div>
              </Td>
            )}
            {full && <Td className="max-w-[280px] text-2xs leading-snug text-ink-3">{d.caution ?? '—'}</Td>}
            <Td><Chip tone={MATURITY_TONE[d.maturity]}>{MATURITY_LABEL[d.maturity]}</Chip></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function ProvenanceBody({ props, size }: CardProps) {
  const path = String(props.path ?? '')
  const s = provenanceSummary()
  const scoped = path ? provenanceFor(path) : null
  const rows = scoped ? scoped.datasets : s.datasets

  if (size !== 'page') {
    const shown = limit(rows, size, 6)
    return <><DatasetsTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={rows.length} /></>
  }

  return (
    <Card
      title={scoped ? `What feeds ${scoped.path}` : 'Datasets'}
      subtitle={
        scoped
          ? `${rows.length} dataset${rows.length === 1 ? '' : 's'} · ${scoped.headline ? ORIGIN_LABEL[scoped.headline] : 'nothing registered'}`
          : ORIGIN_ORDER.filter((o) => s.byOrigin[o]).map((o) => `${s.byOrigin[o]} ${ORIGIN_LABEL[o].toLowerCase()}`).join(' · ')
      }
      right={<FileSearch size={13} className="text-ink-3" />}
    >
      <DatasetsTable rows={rows} full />
    </Card>
  )
}

export const provenanceView: ArtifactView = {
  Body: ProvenanceBody,
  Metrics: ProvenanceMetrics,
  page: {
    title: 'Where the figures come from',
    subtitle: 'Every dataset the platform reads, its origin, the screens it feeds and what it must not be used for',
    agents: ['agt_archivist', 'agt_herald'],
    what: 'reading the register behind every screen’s marker',
  },
}
