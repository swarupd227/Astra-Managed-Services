import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { ALL_NAV } from './nav'
import { ROLES } from '@/domain/reference'
import { TOWERS, AGENTS } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { cn } from '@/lib/format'

interface Cmd {
  id: string
  group: string
  label: string
  hint?: string
  run: () => void
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [q, setQ] = React.useState('')
  const [sel, setSel] = React.useState(0)
  const setRole = useAstra((s) => s.setRole)
  const setTheme = useAstra((s) => s.setTheme)
  const setDensity = useAstra((s) => s.setDensity)
  const theme = useAstra((s) => s.theme)
  const density = useAstra((s) => s.density)
  const brake = useAstra((s) => s.brake)
  const setBrake = useAstra((s) => s.setBrake)
  const roleId = useAstra((s) => s.roleId)
  const work = useAstra((s) => s.work)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const role = ROLES.find((r) => r.id === roleId)!

  const commands: Cmd[] = React.useMemo(() => {
    const out: Cmd[] = []
    ALL_NAV.forEach((n) =>
      out.push({ id: `nav-${n.to}`, group: n.surfaceName, label: n.label, hint: n.desc, run: () => nav(n.to) }),
    )
    Object.values(work)
      .slice(0, 400)
      .forEach((w) =>
        out.push({ id: `wo-${w.id}`, group: 'Work objects', label: `${w.ref} — ${w.title}`, hint: `${w.priority} · ${w.state}`, run: () => nav(`/operate/work/${w.id}`) }),
      )
    AGENTS.forEach((a) =>
      out.push({ id: `agt-${a.id}`, group: 'Agents', label: a.name, hint: a.codename, run: () => nav(`/atlas/agent/${a.id}`) }),
    )
    TOWERS.forEach((t) =>
      out.push({ id: `twr-${t.id}`, group: 'Towers', label: t.name, hint: `${t.state} · ${t.entities.toLocaleString()} entities`, run: () => nav(`/operate/board?tower=${t.id}`) }),
    )
    ROLES.forEach((r) =>
      out.push({
        id: `role-${r.id}`,
        group: 'Assume role',
        label: r.title,
        hint: `${r.person} · ${r.org === 'client' ? 'Client' : 'Artizent'}`,
        run: () => { setRole(r.id); nav(r.home) },
      }),
    )
    out.push(
      { id: 'theme', group: 'Preferences', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'density', group: 'Preferences', label: `Switch to ${density === 'compact' ? 'comfortable' : 'compact'} density`, run: () => setDensity(density === 'compact' ? 'comfortable' : 'compact') },
      {
        id: 'brake',
        group: 'Controls',
        label: brake.global ? 'Release the global autonomy brake' : 'Apply the global autonomy brake',
        hint: 'All agents drop to Advise. The action is evidenced.',
        run: () => setBrake('global', !brake.global, role.person),
      },
    )
    return out
  }, [nav, work, theme, density, brake.global, role.person, setRole, setTheme, setDensity, setBrake])

  const filtered = React.useMemo(() => {
    if (!q.trim()) return commands.filter((c) => c.group !== 'Work objects').slice(0, 40)
    const needle = q.toLowerCase()
    return commands
      .map((c) => {
        const l = c.label.toLowerCase()
        const score = l.startsWith(needle) ? 0 : l.includes(needle) ? 1 : (c.hint ?? '').toLowerCase().includes(needle) ? 2 : -1
        return { c, score }
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((x) => x.c)
  }, [q, commands])

  React.useEffect(() => setSel(0), [q])

  if (!open) return null

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => {
    ;(acc[c.group] ??= []).push(c)
    return acc
  }, {})
  let idx = -1

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[62vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-pop">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3">
          <Search size={14} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
              if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); onClose() }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Search screens, work objects, agents, towers — or assume a role"
            className="h-11 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-ink-3">esc</kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && <p className="px-4 py-6 text-center text-xs text-ink-3">Nothing matches “{q}”.</p>}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-3 py-1 text-2xs font-medium uppercase tracking-[0.09em] text-ink-3">{group}</div>
              {items.map((c) => {
                idx++
                const myIdx = idx
                const active = myIdx === sel
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setSel(myIdx)}
                    onClick={() => { c.run(); onClose() }}
                    className={cn('flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left', active ? 'bg-brand/12' : 'hover:bg-raised')}
                  >
                    <span className="min-w-0">
                      <span className={cn('block truncate text-xs', active ? 'text-ink' : 'text-ink-2')}>{c.label}</span>
                      {c.hint && <span className="block truncate text-2xs text-ink-3">{c.hint}</span>}
                    </span>
                    {active && <CornerDownLeft size={12} className="shrink-0 text-brand-ink" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
