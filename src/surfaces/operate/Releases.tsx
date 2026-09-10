import React from 'react'
import { CalendarClock, Snowflake } from 'lucide-react'
import {
  FREEZES, PURPOSE_LABEL, RELEASE_FLAG_BLOCKS, RELEASE_FLAG_LABEL, RELEASE_STATE_LABEL, releaseSummary,
  type ReleaseState,
} from '@/domain/releases'
import { KIND_LABEL } from '@/domain/inventory'
import { AGENT_BY_ID } from '@/domain/estate'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { dateShort, pct } from '@/lib/format'

/* ==========================================================================
   Releases — the release calendar across the portfolio.

   Each row is read against the application's lifecycle: whether its code can
   be rolled back, whether it lands in a freeze, whether its regression pack
   passed, and — for enhancements — whether it carries authorised work orders.
   Blocking flags stop a release; the rest inform the go/no-go.
   ========================================================================== */

const STATE_TONE: Record<ReleaseState, 'neutral' | 'info' | 'brand' | 'warn' | 'agent' | 'ok' | 'crit'> = {
  planned: 'neutral', testing: 'info', approved: 'brand', held: 'warn', deployed: 'agent', verified: 'ok', rolled_back: 'crit',
}
const GATE_TONE = { pass: 'ok', fail: 'crit', pending: 'neutral' } as const

export function Releases() {
  const s = React.useMemo(() => releaseSummary(), [])

  return (
    <>
      <PageHeader title="Releases" subtitle="Vendor and internal releases across the application portfolio" />

      <ProducedBy agents={['agt_sentryq', 'agt_forge']} what="selecting and running regression packs" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Upcoming" value={s.upcoming} />
        <Metric size="sm" label="Next 14 days" value={s.next14d} />
        <Metric size="sm" label="Failing regression" value={s.gateFail} deltaTone={s.gateFail ? 'warn' : 'ok'} />
        <Metric size="sm" label="Blocked" value={s.blocked} deltaTone={s.blocked ? 'crit' : 'ok'} />
        <Metric size="sm" label="Change success" value={s.changeSuccessPct === null ? '—' : pct(s.changeSuccessPct, 0)} deltaTone={s.changeSuccessPct !== null && s.changeSuccessPct >= 90 ? 'ok' : 'warn'} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Change freezes" right={<Snowflake size={13} className="text-ink-3" />}>
          <div className="flex flex-wrap gap-1.5">
            {FREEZES.map((f) => (
              <Chip key={f.id} tone="info">{f.name} · {dateShort(f.start)} – {dateShort(f.end)}</Chip>
            ))}
            <Chip tone={s.inFreeze ? 'warn' : 'neutral'}>{s.inFreeze} release{s.inFreeze === 1 ? '' : 's'} inside a freeze</Chip>
          </div>
        </Card>

        <Card className="mt-4" title="Release calendar" subtitle={`${s.readings.length} releases`} right={<CalendarClock size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Release</Th><Th>Application</Th><Th>Origin</Th><Th>Purpose</Th><Th>Window</Th>
                <Th>State</Th><Th align="right">Regression</Th><Th>Gate</Th><Th>Flags</Th>
              </tr>
            </thead>
            <tbody>
              {s.readings.map((r) => (
                <Tr key={r.release.id} className={r.blocked ? 'bg-crit/[0.05]' : undefined}>
                  <Td className="text-2xs text-ink">
                    {r.release.version}
                    <span className="block font-mono text-[10px] text-ink-3">{r.release.id}</span>
                  </Td>
                  <Td className="text-2xs text-ink-2">
                    {r.app?.name ?? r.release.appId}
                    {r.app && <Chip tone="brand" className="ml-1.5">{KIND_LABEL[r.app.kind]}</Chip>}
                  </Td>
                  <Td className="text-2xs text-ink-2">{r.release.origin === 'vendor' ? 'Vendor' : 'Internal'} · {r.release.scope}</Td>
                  <Td className="text-2xs text-ink-2">
                    {PURPOSE_LABEL[r.release.purpose]}
                    {r.release.pwoIds.length > 0 && <span className="block font-mono text-[10px] text-ink-3">{r.release.pwoIds.join(', ')}</span>}
                  </Td>
                  <Td className="tnum text-2xs text-ink-2">{dateShort(r.release.windowStart)}</Td>
                  <Td><Chip tone={STATE_TONE[r.release.state]}>{RELEASE_STATE_LABEL[r.release.state]}</Chip></Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">
                    {r.release.regression ? `${r.release.regression.passed}/${r.release.regression.selected}` : '—'}
                    {r.release.regression && <span className="block text-[10px] text-ink-3">{AGENT_BY_ID[r.release.regression.runBy]?.name ?? r.release.regression.runBy}</span>}
                  </Td>
                  <Td><Chip tone={GATE_TONE[r.gate]}>{r.gate}</Chip></Td>
                  <Td>
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <Chip key={f} tone={RELEASE_FLAG_BLOCKS[f] ? 'crit' : 'warn'}>{RELEASE_FLAG_LABEL[f]}</Chip>
                      ))}
                      {!r.flags.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
