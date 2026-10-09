import React from 'react'
import { FileDown, Presentation } from 'lucide-react'
import { buildBoardDeck, type BoardDeck } from '@/domain/boardDeck'
import { useAstra } from '@/domain/store'
import { downloadBoardDeck } from '@/lib/pptx'
import { Button, Card, Chip, Empty, Metric } from '@/ui/primitives'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   The deck, before it leaves.

   Shown here as the slides it will become, so whoever sends it has seen what
   it says about its own figures before a board does.
   ========================================================================== */

function useDeck(props: Record<string, unknown>): BoardDeck {
  const publishLog = useAstra((s) => s.publishLog)
  const itemIds = Array.isArray(props.items) ? (props.items as string[]) : [...new Set(publishLog.map((p) => p.itemId))]
  return React.useMemo(() => buildBoardDeck({ publishLog, itemIds }), [publishLog, itemIds.join(',')])
}

function DeckMetrics({ props, size }: CardProps) {
  const deck = useDeck(props)
  const figures = deck.slides.reduce((n, s) => n + (s.figures?.length ?? 0), 0)
  return (
    <Band size={size} cols={3}>
      <Metric size="sm" label="Slides" value={deck.slides.length} />
      <Metric size="sm" label="Figures" value={figures} hint={figures ? 'each carrying its load' : 'nothing reconciled'} />
      <Metric
        size="sm"
        label="Data behind it"
        value={deck.showingEarlierFigures ? 'Earlier' : figures ? 'Latest' : '—'}
        deltaTone={deck.showingEarlierFigures ? 'warn' : figures ? 'ok' : undefined}
      />
    </Band>
  )
}

function DeckBody({ props }: CardProps) {
  const deck = useDeck(props)
  const [building, setBuilding] = React.useState(false)

  const build = async () => {
    setBuilding(true)
    try { await downloadBoardDeck(deck) } finally { setBuilding(false) }
  }

  if (!deck.slides.length) return <Empty title="Nothing to build a deck from" />

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone={deck.showingEarlierFigures ? 'warn' : 'ok'}>
          {deck.showingEarlierFigures ? 'Showing earlier figures' : 'Latest figures'}
        </Chip>
        <Button size="sm" variant="primary" disabled={building} onClick={build} className="ml-auto">
          <FileDown size={12} /> {building ? 'Building…' : 'Download the deck'}
        </Button>
      </div>

      <div className="space-y-3">
        {deck.slides.map((s, i) => (
          <Card key={s.title} title={`${i + 1}. ${s.title}`} subtitle={s.lead} right={<Presentation size={13} className="text-ink-3" />}>
            {s.figures?.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {s.figures.map((f) => (
                  <div key={f.label}>
                    <div className="label-cap">{f.label}</div>
                    <div className="tnum font-display text-base font-semibold text-ink">{f.value}</div>
                    <div className="text-[10px] text-ink-3">{f.readFrom}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {s.bullets?.length ? (
              <ul className="space-y-1.5">
                {s.bullets.map((b) => <li key={b} className="text-2xs leading-relaxed text-ink-2">{b}</li>)}
              </ul>
            ) : null}
            <p className="mt-2 border-t border-line pt-1.5 text-[10px] text-ink-3">{s.footnote}</p>
          </Card>
        ))}
      </div>
    </>
  )
}

export const boardDeckView: ArtifactView = {
  Body: DeckBody,
  Metrics: DeckMetrics,
  page: {
    title: 'Board update',
    subtitle: 'The deck as it will leave the platform, with the state of the data behind every figure printed on it',
    agents: ['agt_herald'],
    what: 'assembling a deck from the published side of the gate',
  },
}
