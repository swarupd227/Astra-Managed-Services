import { DATA_ITEM_BY_ID } from './dataEstate'
import { ENGAGEMENT } from './engagement'
import { readPublication, type PublishRecord } from './publication'
import { readRecommendations } from './recommendations'
import { NOW } from './workSeed'

/* ==========================================================================
   The board update, as a deck somebody carries out of the building.

   Every other artefact the platform makes is read inside it, next to its
   Sources row and its provenance marker. A deck is not: it is attached to an
   email, pasted into a pack, and shown on a screen three weeks later by
   somebody who was not in this conversation. Nothing travels with it except
   what is printed on it.

   So the provenance is printed on it. Every slide carries the figures' own
   as-at, whether the load behind them reconciled, and what they were read
   from. A deck built while a load is held says on its face that it is showing
   the earlier figures and why — because the one thing worse than a held load
   reaching a report is a held load reaching a board pack with nothing to say
   it was held.

   Figures come from the published side of the gate and nowhere else. If the
   latest load did not reconcile, the deck uses the last one that did and says
   so. It never shows a figure the platform would not stand behind, and it
   never shows a blank where a figure should be.
   ========================================================================== */

export interface DeckFigure {
  label: string
  value: string
  /** What it was read from, printed under the figure. */
  readFrom: string
}

export interface DeckSlide {
  title: string
  /** One short line under the title, where the slide needs one. */
  lead?: string
  figures?: DeckFigure[]
  bullets?: string[]
  /** Printed small at the foot of this slide. */
  footnote: string
}

export interface BoardDeck {
  client: string
  title: string
  /** When the deck was built. */
  builtAt: string
  /** The state of the data behind it, in one line, for the cover. */
  trust: string
  /** True where any figure on it comes from a load later than the newest held one. */
  showingEarlierFigures: boolean
  slides: DeckSlide[]
  /** Everything the deck read, for the record written when it is produced. */
  readFrom: string[]
}

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${n.toFixed(0)}`

const count = (n: number) => n.toLocaleString('en-GB')
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ')

/** How a measure is written, where the platform knows. Otherwise it is a count. */
const FORMAT: Record<string, (n: number) => string> = { revenue: money, fees: money, expenses: money }

/**
 * Builds the deck from the published side of the gate.
 *
 * `itemIds` are the loads whose figures the deck is about. Each contributes
 * its last *published* record — not its latest, which may be held.
 */
export function buildBoardDeck(opts: {
  publishLog: PublishRecord[]
  itemIds: string[]
  nowMs?: number
}): BoardDeck {
  const nowMs = opts.nowMs ?? NOW.getTime()
  const builtAt = new Date(nowMs).toISOString()
  const readings = opts.itemIds.map((id) => readPublication(opts.publishLog, id))

  const held = readings.filter((r) => r.state === 'held')
  const usable = readings.filter((r) => r.lastGood)
  const showingEarlierFigures = held.some((r) => r.lastGood)

  const trust = held.length === 0
    ? usable.length
      ? `Verified. Every figure is from a load that reconciled, the latest at ${when(usable[0].lastGood!.at)}.`
      : 'No load has been through the gate, so there are no verified figures to show.'
    : showingEarlierFigures
      ? `Showing earlier figures. ${held.length} load${held.length === 1 ? ' is' : 's are'} held, so the last figures that reconciled are used instead.`
      : `No figures. ${held.length} load${held.length === 1 ? ' is' : 's are'} held and nothing earlier reconciled.`

  const figures: DeckFigure[] = usable.flatMap((r) => {
    const g = r.lastGood!
    const fmt = (m: string, v: number) => (FORMAT[m] ?? count)(v)
    return [
      { label: `${r.name} — rows`, value: count(g.observed.rows), readFrom: `Load of ${when(g.at)}, reconciled` },
      ...Object.entries(g.observed.measures).map(([m, v]) => ({
        label: `${r.name} — ${m}`,
        value: fmt(m, v),
        readFrom: `Load of ${when(g.at)}, reconciled`,
      })),
    ]
  })

  // What the service is recommending, which is the half of a board update
  // that is not a number. Taken from the register rather than written here.
  let recommendations: string[] = []
  let recommendationSource = 'The recommendation register could not be read'
  try {
    const r = readRecommendations({ nowMs })
    recommendations = r.all.slice(0, 3).map((x) => x.title)
    recommendationSource = `${r.all.length} open across ${r.dimensions.length} areas the contract names`
  } catch {
    /* A register that cannot be read contributes nothing, and says so above. */
  }

  const provenance = `Astra · ${ENGAGEMENT.client} · built ${when(builtAt)} · figures from the publish gate`

  const slides: DeckSlide[] = [
    {
      title: `${ENGAGEMENT.client} — service update`,
      lead: trust,
      footnote: provenance,
    },
    {
      title: 'The figures',
      lead: showingEarlierFigures
        ? 'From the last loads that reconciled against what the source declared.'
        : 'From the latest loads, each reconciled against what the source declared.',
      figures,
      footnote: figures.length
        ? `${provenance} · every figure carries the load it came from`
        : `${provenance} · no load has reconciled, so no figure is shown`,
    },
    {
      title: 'What we are recommending',
      lead: recommendationSource,
      bullets: recommendations.length ? recommendations : ['Nothing is being recommended against this engagement today.'],
      footnote: `${provenance} · derived from the estate registers, not valued in currency`,
    },
  ]

  if (held.length) {
    slides.push({
      title: 'What is held, and why',
      lead: 'These loads did not reconcile. Their figures are not in this deck.',
      bullets: held.map((r) => `${r.name}: ${r.last?.reason ?? 'held'}${r.last?.workObjectId ? ` (${r.last.workObjectId})` : ''}`),
      footnote: `${provenance} · the gate holds a load rather than letting it reach a reader`,
    })
  }

  return {
    client: ENGAGEMENT.client,
    title: `${ENGAGEMENT.client} — service update`,
    builtAt,
    trust,
    showingEarlierFigures,
    slides,
    readFrom: [
      ...usable.map((r) => `${DATA_ITEM_BY_ID[r.itemId]?.name ?? r.itemId}: load of ${when(r.lastGood!.at)}`),
      recommendationSource,
    ],
  }
}
