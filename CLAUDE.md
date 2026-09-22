# CLAUDE.md

## The product model (read before touching any UI or agent code)

**You talk to a team of agents, and they talk back.** The conversation workspace is the primary surface; pages
are artifact views the agents open. Full guideline: **`docs/02_UX/agentic-ux-philosophy.md`**. The
non-negotiables:

1. Natural language is the primary way to do anything; buttons inside pages are the same actions as the tools.
2. Every fact the orchestrator states comes from a tool called after the user's latest message; tool calls stay
   on the message as Sources, results become cards. The orchestrator prompt carries no estate facts.
3. State-changing tools pause on a Confirm / Not now card; role rights are enforced in the gateway from
   `server/tool-catalogue.json`, the single source for tools and role permissions.
4. Sentences live only in agent messages. Cards and pages are figures, tables and chips — no explanatory prose.
5. Dark by default. `#FFDD00` yellow means only: agent working, primary action, focus.
6. Routes and test ids are stable. New capability → a tool in the catalogue plus an executor in
   `src/workspace/` → maybe a card → maybe a page. Anything new must be demonstrable as a typed sentence.
7. **This is a client-facing platform, and one client is not the product.** A client's contract, service
   lines, regime and what has been ingested for it are data — `src/domain/engagement.ts` — read by the
   same code for any client; service packs carry what the platform offers per service line. A stage
   marked `provider` (the bid) is ours: never shown to a role whose `org` is not `artizent`, in a screen
   or a tool result. What the platform makes faster at each stage, whose time it gives back, and whether
   the figure is measured, projected, declared or not measured, lives in `src/domain/acceleration.ts`.

## Azure deployment

The Azure CLI (`az`) is not installed/authenticated locally in this environment — do not attempt to run `az` commands directly. When Azure work is needed (deploying, inspecting, or configuring resources such as the `astra-managed-services-swarupd227` App Service), provide the exact `az` commands as copy-pasteable output instead, for the user to run manually in a fresh Azure Cloud Shell session.
