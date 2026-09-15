import React from 'react'
import type { CardKind } from '../types'
import type { CardProps } from './frame'
import { AgentRunCard, ApprovalsCard, BriefCard, EstateOverviewCard, SlaCard, WorkItemCard, WorkQueueCard } from './operate'
import { CoverageCard, DataEstateCard, DataItemCard, PrivacyRequestCard, PrivacyRequestsCard, ReleasesCard, TechDebtCard } from './registers'

/* ==========================================================================
   The card registry. A card renders from its kind and props; the same
   component draws the compact card in a message and the full view in the
   side pane, so the two can never disagree about a figure.
   ========================================================================== */

export const CARDS: Record<CardKind, React.ComponentType<CardProps>> = {
  estateOverview: EstateOverviewCard,
  brief: BriefCard,
  workQueue: WorkQueueCard,
  workItem: WorkItemCard,
  approvals: ApprovalsCard,
  sla: SlaCard,
  dataEstate: DataEstateCard,
  dataItem: DataItemCard,
  privacyRequests: PrivacyRequestsCard,
  privacyRequest: PrivacyRequestCard,
  releases: ReleasesCard,
  techDebt: TechDebtCard,
  coverage: CoverageCard,
  agentRun: AgentRunCard,
}

/** A card whose props do not match what the component expects shows nothing rather than failing the thread. */
export class CardBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <span className="text-2xs text-ink-3">—</span> : this.props.children
  }
}
