# Astra for Managed Services

The agentic managed-services platform, built as a running application rather than a deck.

Astra sits between a client's existing tool estate — ITSM, observability, code, cloud, data
platforms — and the Artizent service organisation. It federates them into one operating fabric,
adds a governed agent workforce on top, and instruments the whole service with the telemetry
needed for autonomy governance and value-based commercials.

This repository implements the product specification (`Astra_Operate_Product_Specification_v1_2`)
as four working product surfaces on one control plane.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

The console starts at <http://localhost:5180>. `npm run build` produces a static bundle in
`dist/`; `npm run typecheck` runs the compiler with no emit.

---

## The agentic surfaces

The platform's thesis is that work is routed to a governed agent workforce, not to
queues of people who use AI tools. Two surfaces make that the interaction model rather
than a claim in a table.

**Astra Copilot** (`/copilot`) is the entry point. You state an intent in plain language.
The platform classifies it, routes it to an agent, and you watch that agent work: it
retrieves a decision-scoped context package under an enforced verification floor, reasons
in the open a line at a time, proposes a typed plan with a declared compensation on every
mutating step, and submits that plan to the Autonomy Policy Engine before anything is
touched. What the engine returns decides what happens next — execute, hold at a gate for a
named human, or refuse.

The policy beat is not a rendering of a decision made elsewhere. It calls the same
evaluator the runtime calls, so the mode on screen is the mode the engine returns for that
context. Ask it to remediate a tier-0 payments incident and it stops at L2 Approve-first.
Ask it to purge data and Custodian refuses at L1 — not because it was told to decline, but
because AC-71 is rated irreversible and the engine will not return anything higher.

**Agent Workforce** (`/workforce`) is the fleet as live workers rather than rows: fourteen
agents, two of them the client's own, each showing what it is doing right now, which phase
of its run it is in, its grades per action class, and its cost against the human cost it
displaces. Suspending one is a live, evidenced control.

## What is actually implemented

This is not a click-through prototype. The behaviour below is real code, not staged screens.

**The Autonomy Policy Engine runs.** `src/domain/policyEngine.ts` contains a lexer and evaluator
for the policy DSL. Policies authored as text compile to a decision function that takes an action
context — action class, blast radius, agent standing, context conditions, plan confidence — and
returns an execution mode with a rule-by-rule trace. The Policy Simulator in Atlas Workbench runs
this exact code path, which is why "what would the engine decide?" is answerable rather than
illustrative. Platform floors cannot be loosened by a policy; irreversible-and-unattended is
structurally impossible; a mutating step without a declared compensation is forced through a gate.

**The Evidence Chain verifies.** `src/domain/evidence.ts` hash-links every record to its
predecessor. The Evidence Explorer recomputes the entire chain in the browser and reports the
result. It also carries a demonstration control that edits one sealed record's payload as if
someone had reached the store directly — verification then reports the break, its sequence
number, and that every record after it is unverifiable.

**Approvals execute.** Approving a gated run in the Approval Inbox or on a work object advances
the run's DAG, appends a new approval record to the evidence chain, updates the work object's
lifecycle state and economics, and surfaces the sealed record id. Rejecting routes the work to a
human and records the reason as evaluation signal. Aborting unwinds completed mutating steps
through their declared compensations.

**The estate is live.** A simulation loop advances estate time one minute per tick: SLA clocks
run down, breach probability is recomputed, and work objects move through their lifecycle. The
global autonomy brake and an open major incident both stop autonomous progress, exactly as the
policy override describes.

**Roles change the application.** Assuming a role changes the landing screen, the navigable
surfaces, and who holds the approval pen. An auditor session is read-only, sees three of four
surfaces marked out of scope, and finds every approval control disabled.

**Knowledge verification moves the numbers.** Verifying an assertion in Transition Studio raises
it to human-verified, writes a knowledge record to the chain, and moves the reported
autonomy-eligible share — the F1 coupling, as a number rather than a claim.

---

## The four surfaces

| Surface | Primary users | What it does |
| --- | --- | --- |
| **Operate Console** | Service delivery teams, SDMs, resolvers | Tower boards with live SLA burn-down, the approval inbox, resolver workspace, shift board and generated handover, major-incident room, and the Service Graph |
| **Transition Studio** | Transition leads, incumbent SMEs, client teams | Coverage dashboard and graph-quality SLOs, keyboard-first verification queue, shadow scoreboard with disagreement drill-downs, machine-checked cutover readiness |
| **Governance Cockpit** | Client executives, service governance, commercial, audit | Executive home, SLA and XLA compliance with clock audits, glidepath and transform ledgers, autonomy posture heatmap, demand elimination, innovation register, decision and obligation registers, evidence explorer, reports and Ask Herald |
| **Atlas Workbench** | AI engineering, platform team | Agent fleet, employment records, evaluation centre and promotion pipeline, policy editor and simulator, TokenOps studio |

---

## Reference engagement

The application is populated with a deterministic reference estate: **Nordbank Group**, a European
banking and insurance estate at month 14 of a five-year managed-services contract, deployed
in-tenant in Azure North Europe with client-held keys.

Ten service towers sit at different points on the Transition → Run → Transform spine — two still
in transition, one in hypercare, seven in steady run with optimisation and transformation running
concurrently. Fourteen agents operate across them, two of which are client-owned and managed as a
service under the same governance regime.

The data is generated from a fixed seed. The numbers are identical on every load, because a
briefing where the figures move between refreshes is not credible.

---

## A suggested walkthrough

1. **Astra Copilot → "Remediate the latency breach on Retail Payments."** Watch the whole
   spine in about twenty seconds: routing, retrieval under a verification floor, reasoning,
   a typed plan with rollbacks, the policy engine returning L2 Approve-first because the
   blast radius reaches a tier-0 service, and the run held at a gate. Approve it and watch
   execution, canary verification, the ledger entry and the run cost land.
2. **Copilot → "Purge the archived transaction partitions."** The same machinery ends in a
   refusal. Custodian prepares the work and hands it to a human, because irreversible and
   agent-executed is a prohibited combination in the engine, not a setting on its record.
3. **Copilot → "Backfill claims_gold."** Capped at Advise: the asset has no data contract, so
   there is nothing to verify a backfill against. Codify before you automate, enforced.
4. **Agent Workforce.** Fourteen agents mid-task. Apply the global brake and watch the whole
   workforce drop to L1 with the reason stated.
5. **Atlas Workbench → Policy Simulator.** The same action class returns a different mode on a
   tier-0 service, a different one again during a major incident, and Advise regardless when
   the action is irreversible.
6. **Governance Cockpit → Evidence Explorer.** Verify the chain. Then open a record, alter it,
   and verify again — the break and everything after it goes unverifiable.
7. **Assume the Auditor role.** Three surfaces go out of scope, every control disappears, and
   the evidence remains.

Press `⌘K` (or `/`) anywhere for the command palette: screens, work objects, agents, towers, and
role switching.

---

## Architecture

```
src/
  domain/        Typed primitives, the policy engine, the agent runtime, the
                 evidence chain, the seeded reference estate, and the store
  ui/            Design system: primitives, hand-built SVG charts, and the
                 shared domain vocabulary (autonomy chips, SLA clocks,
                 evidence links, agent identity)
  app/           Shell, navigation, role switching, command palette
  surfaces/      The copilot and workforce surfaces plus the four consoles
  brand/         Artizent mark and lockup
  styles/        Design tokens
```

Charts are hand-built SVG rather than a charting library, so every mark, tick and label is under
the design system's control and the whole set renders identically in both themes off the same
tokens.

## Design

The palette is Artizent's. Warm paper carries the default light theme, with signal yellow
`#FFDD00` reserved for fills, active indicators and the mark; text and chart strokes use an
ink-safe brand value so nothing relies on yellow to be legible. A dark theme is available from
the toolbar. Typography is the brand set — Host Grotesk for display, DM Sans for
text, DM Mono for identifiers, hashes and policy source.

The governing UX idea from §15 holds throughout: each role sees the whole truth of their
responsibility on one screen, and every number on every screen opens into its evidence. Healthy
states are quiet; jeopardy, breach risk and demotions surface with defined severity styling. No
screen shows a number the platform cannot defend.

Both themes are AA-contrast checked. Density and theme are user preferences and persist.
