import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { setConfig, setRecords } from './domain/config'
import type { Engagement } from './domain/engagement'

/* ==========================================================================
   The bootstrap.

   The engagement's terms live in the database, so they are fetched before
   anything else is imported. Every reader in the domain stays synchronous
   because of that ordering — the contract moved out of the code without
   making twenty modules asynchronous.

   There is no fallback. If the configuration cannot be read the application
   does not start and says why, rather than mounting on terms nobody can
   change or, worse, on a copy that disagrees with the database.
   ========================================================================== */

const root = createRoot(document.getElementById('root')!)

function Stopped({ detail }: { detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <div className="max-w-lg rounded-md border border-crit/40 bg-surface p-5">
        <h1 className="font-display text-sm font-semibold text-ink">The platform did not start</h1>
        <p className="mt-2 text-2xs leading-relaxed text-ink-2">
          Its configuration is held in the database and could not be read, so there is nothing to run on.
          No copy is compiled in: the terms of an engagement are the client’s, and reading them from two
          places would eventually answer differently from each.
        </p>
        <p className="tnum mt-3 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-ink-3">{detail}</p>
      </div>
    </div>
  )
}

async function start() {
  const res = await fetch('/api/config')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `/api/config answered ${res.status}`)
  }
  const { engagements } = (await res.json()) as { engagements: Engagement[] }
  setConfig(engagements)

  // What people recorded before, for the engagement the surfaces read. A
  // failure here is as loud as a missing configuration: a register that
  // silently starts empty would read as a client who had never done anything.
  const live = engagements.find((e) => e.ingested?.estate) ?? engagements[0]
  const recs = await fetch(`/api/records?engagement=${encodeURIComponent(live.id)}`)
  if (!recs.ok) {
    const body = await recs.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `/api/records answered ${recs.status}`)
  }
  const { registers } = (await recs.json()) as { registers: Record<string, unknown[]> }
  setRecords(registers)

  // Imported only now: everything below reads the configuration as it loads.
  const { Root } = await import('./app/Root')
  root.render(<Root />)
}

start().catch((err: unknown) => {
  const detail = err instanceof Error ? err.message : String(err)
  console.error('Configuration could not be read:', detail)
  root.render(<Stopped detail={detail} />)
})
