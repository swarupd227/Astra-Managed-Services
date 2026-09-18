import React from 'react'
import { COVERED_BUNDLES, bundleCoverage } from '@/domain/coverage'
import { BUNDLE_BY_ID } from '@/domain/estate'
import { ArtifactPage } from '@/workspace/cards/view'
import { selectClass } from '@/ui/primitives'
import { cn } from '@/lib/format'

/** The page rendering of the coverage view, with the bundle it is read for. */
export function Coverage() {
  const [bundle, setBundle] = React.useState(COVERED_BUNDLES[0] ?? '')
  const name = React.useMemo(() => bundleCoverage(bundle).bundleName, [bundle])

  return (
    <ArtifactPage
      kind="coverage"
      props={{ bundle }}
      subtitle={`${name} · derived from agent charters`}
      actions={
        <select value={bundle} onChange={(e) => setBundle(e.target.value)} className={cn(selectClass, 'w-[260px]')}>
          {COVERED_BUNDLES.map((b) => <option key={b} value={b}>{b} · {BUNDLE_BY_ID[b]?.name ?? b}</option>)}
        </select>
      }
    />
  )
}
