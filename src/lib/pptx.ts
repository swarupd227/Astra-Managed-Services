import PptxGenJS from 'pptxgenjs'
import type { BoardDeck } from '@/domain/boardDeck'

/* ==========================================================================
   Turning a deck into a file.

   The spec decides what is on the slides; this only decides what they look
   like. The one rule it enforces is that the footnote goes on every slide,
   at a size somebody can still read in a screenshot — the provenance is the
   point of printing it, and provenance in four-point grey is decoration.
   ========================================================================== */

const INK = '1B1B1E'
const MUTED = '6B6B73'
const BRAND = 'FFDD00'
const CRIT = 'C0392B'

export async function downloadBoardDeck(deck: BoardDeck): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = deck.title
  pptx.company = 'Artizent'

  for (const [i, slide] of deck.slides.entries()) {
    const s = pptx.addSlide()

    // The cover carries the trust line in the brand colour when everything
    // reconciled and in red when it did not, so the state is legible before
    // anybody reads a word.
    const cover = i === 0
    s.addText(slide.title, {
      x: 0.6, y: cover ? 1.9 : 0.5, w: 8.8, h: cover ? 0.9 : 0.6,
      fontSize: cover ? 32 : 24, bold: true, color: INK,
    })

    if (slide.lead) {
      s.addText(slide.lead, {
        x: 0.6, y: cover ? 2.9 : 1.15, w: 8.8, h: 0.7,
        fontSize: cover ? 14 : 12,
        color: cover && deck.showingEarlierFigures ? CRIT : MUTED,
      })
    }

    if (slide.figures?.length) {
      const cols = Math.min(3, slide.figures.length)
      slide.figures.slice(0, 9).forEach((f, n) => {
        const col = n % cols
        const row = Math.floor(n / cols)
        const x = 0.6 + col * (8.8 / cols)
        const y = 2.0 + row * 1.25
        s.addText(f.label, { x, y, w: 8.8 / cols - 0.3, h: 0.3, fontSize: 10, color: MUTED })
        s.addText(f.value, { x, y: y + 0.26, w: 8.8 / cols - 0.3, h: 0.45, fontSize: 22, bold: true, color: INK })
        s.addText(f.readFrom, { x, y: y + 0.72, w: 8.8 / cols - 0.3, h: 0.3, fontSize: 8, color: MUTED })
      })
    }

    if (slide.bullets?.length) {
      s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), {
        x: 0.6, y: 2.0, w: 8.8, h: 2.8, fontSize: 12, color: INK, lineSpacingMultiple: 1.3,
      })
    }

    // Every slide, every time. Ten point, not four.
    s.addText(slide.footnote, { x: 0.6, y: 4.9, w: 8.8, h: 0.3, fontSize: 10, color: MUTED })
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 4.85, w: 0.5, h: 0.03, fill: { color: BRAND } })
  }

  await pptx.writeFile({ fileName: `${deck.client.replace(/\W+/g, '-')}-service-update.pptx` })
}
