import React from 'react'
import type { CardKind } from '../types'
import type { ArtifactView } from './frame'
import { FiguresCard } from './figures'
import { AgentRunCard, ApprovalsCard, BriefCard, EstateOverviewCard, SlaCard, WorkItemCard, WorkQueueCard } from './operate'
import { coverageView } from './coverage'
import { dataEstateView, dataItemView } from './dataEstate'
import { dataReliabilityView } from './dataReliability'
import { privacyRequestView, privacyRequestsView } from './privacy'
import { releasesView } from './releases'
import { techDebtView } from './techDebt'

/* ==========================================================================
   The card registry. A result is drawn by one component at three sizes —
   the card in a message, the pane beside the thread, and the page it links
   to — so none of the three can disagree about a figure. A view that also
   has a page carries the page's heading, workers and conversation in
   `page`; `ArtifactPage` renders it around the same component.
   ========================================================================== */

export const CARDS: Record<CardKind, ArtifactView> = {
  estateOverview: { Body: EstateOverviewCard },
  brief: { Body: BriefCard },
  workQueue: { Body: WorkQueueCard },
  workItem: { Body: WorkItemCard },
  approvals: { Body: ApprovalsCard },
  sla: { Body: SlaCard },
  dataEstate: dataEstateView,
  dataItem: dataItemView,
  dataReliability: dataReliabilityView,
  privacyRequests: privacyRequestsView,
  privacyRequest: privacyRequestView,
  releases: releasesView,
  techDebt: techDebtView,
  coverage: coverageView,
  agentRun: { Body: AgentRunCard },
  figures: { Body: FiguresCard },
}

/** A card whose props do not match what the component expects shows nothing rather than failing the thread. */
export class CardBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <span className="text-2xs text-ink-3">—</span> : this.props.children
  }
}
