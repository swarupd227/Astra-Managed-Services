import React from 'react'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { ThreadPanel } from '../ThreadPanel'
import type { Artifact, CardKind } from '../types'
import { CARDS, CardBoundary } from './index'
import type { CardSize } from './frame'

/* ==========================================================================
   The three renderings of one view.

   `ArtifactBody` draws a result inside a message or the side pane;
   `ArtifactPage` draws the same components as a page, with the heading, the
   agents that produce the figures and the page's conversation around them.
   A page therefore cannot show different numbers from the card that links
   to it — there is only one component to change.
   ========================================================================== */

export function ArtifactBody({ kind, props, size }: { kind: CardKind; props: Artifact['props']; size: CardSize }) {
  const view = CARDS[kind]
  if (!view) return null
  const { Metrics, Body } = view
  return (
    <CardBoundary>
      {Metrics && <div className="mb-3"><Metrics props={props} size={size} /></div>}
      <Body props={props} size={size} />
    </CardBoundary>
  )
}

export function ArtifactPage({
  kind, props = {}, subtitle, meta, actions, children,
}: {
  kind: CardKind
  props?: Artifact['props']
  /** Overrides the view's own subtitle, for a page whose filter names what is shown. */
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const view = CARDS[kind]
  const page = view?.page
  if (!view || !page) return null
  const { Metrics, Body } = view

  return (
    <>
      <PageHeader title={page.title} subtitle={subtitle ?? page.subtitle} meta={meta} actions={actions} />

      {page.agents && page.what && <ProducedBy agents={page.agents} what={page.what} />}

      {Metrics && (
        <div className="shrink-0 border-b border-line bg-surface px-4 py-2.5">
          <Metrics props={props} size="page" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Body props={props} size="page" />
        {children}
      </div>

      {page.thread && <ThreadPanel id={page.thread} />}
    </>
  )
}
