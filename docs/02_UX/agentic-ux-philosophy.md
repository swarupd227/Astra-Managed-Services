# Astra for Managed Services — the agentic UX philosophy

*Adapted from the Astra RE Harness guideline to this product. `CLAUDE.md` carries the short version.*

## The one-sentence model

**You talk to a team of agents, and they talk back.** The conversation is the primary surface. Every
action is an intent in plain language, typed or a suggestion chip phrased as one. Every result arrives as
an agent message with a card attached. Pages are artifact views the agents open, not the navigation model.

## The agents

Astra is the orchestrator. The agents of the engagement's fleet speak through their tools — Sentinel,
Diagnost, Remedian, Forge, Sentry-Q, Custodian, Prospect, Bursar, Warden, Archivist, Herald, Concierge —
and a reply is attributed to the one agent whose tools produced it, or to Astra when several did. The
fleet is seed data; another client's fleet produces its own.

Humans keep the gates: plan approval at the policy engine's gates, proposal decisions, objective
acceptance, the autonomy brake, agent suspension. Agents never cross a gate on their own.

## Rules

1. **Natural language everywhere.** Buttons inside artifact views are the same actions as the tools, never
   different ones.
2. **Every fact comes from a tool.** The orchestrator's prompt carries no estate facts. A figure, status,
   count or identifier must come from a tool called after the user's latest message. Tool calls stay on
   the message as **Sources**; tool results become the message's **cards**. A failed tool is reported with
   its reason.
3. **State-changing tools pause for confirmation.** The loop stops on a **Confirm / Not now** card naming
   the tool and its input. The gateway refuses a transcript carrying a call to a tool the role does not
   hold, or a state-changing result nobody confirmed, and rewrites a declined result to fixed text.
   There is no sign-in yet, so the role id is trusted from the request.
4. **Two controls, never merged.** The confirmation is "did you mean this". The Autonomy Policy Engine is
   "may an agent do this". `run_agent` hands an intent to the runtime; the engine still decides the mode.
5. **Agents narrate.** A run shows its beats live in its card; a gated run settles with a message from the
   agent that ran it. Replies end with two to four suggestions phrased as the next thing the user would type.
6. **Explained, then shown.** One or two plain sentences with the numbers, then the card. Sentences live only
   in agent messages: cards and pages stay figures, tables and chips, with no explanatory prose.
7. **Honesty over polish.** Anything not measured says so. Declared figures are called declared.
8. **One accent.** Dark by default. Yellow `#FFDD00` means exactly three things — an agent is working, the
   primary action, focus. Status uses ok / warn / crit / info. Agents have no colour of their own.
9. **Motion tells the truth.** Motion only for live work and arriving messages; `prefers-reduced-motion`
   collapses it.
10. **Nothing breaks what exists.** Routes stay. New surfaces add test ids; they do not rename old ones.

## Surfaces

- **Workspace** — `/` (Ask Astra) and `/w/:threadId`. Threads: Ask Astra; one per contract bundle; one per
  active mission; one for an open major incident. The rail leads with the conversations and the live agents;
  the existing views follow. The right pane shows the card the latest message opened, with *Open full view*.
  The global thread opens with Herald's brief.
- **Artifact views** — the existing pages. Pages where decisions are made (Approval Inbox, Proposals,
  Privacy Requests, Work Orders) embed a conversation scoped to the page; it never replaces the page.
- **⌘K** — a sentence goes to Astra in the open conversation first; screens, records and preferences are the
  fallbacks.

## How it is built

- `server/tool-catalogue.json` — every tool (name, speaking agent, surfaces, mutating, approval, schema,
  confirmation sentence) and every role's surfaces and rights. Read by the gateway and the browser, so they
  cannot disagree about a role.
- `server/converse.mjs` — role checks, transcript validation, the orchestrator prompt.
- `src/workspace/` — the loop (`store.ts`), tool executors (`tools.ts`, `toolsRegisters.ts`), card
  registry (`cards/`), runs (`runs.ts`), threads and the workspace UI.

## Extending it

- **New capability → a tool, not a page.** Add it to the catalogue with its surfaces and whether it mutates
  or needs the approval pen; add an executor that reads the same domain function the page reads and returns
  a compact payload plus a card. Then, if the result deserves it, a card kind; then, if the card deserves it,
  a page.
- **New long run → narrate it.** Publish its card as soon as it starts and settle it into the thread.
- **Anything new must be demonstrable as a sentence typed into a thread.**
